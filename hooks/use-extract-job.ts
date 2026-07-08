"use client";

import { useCallback, useRef, useState } from "react";
import type { ExtractPhase, ExtractSelection, ProbeResponse } from "@/lib/formats/types";
import {
  chooseOutputContainer,
  needsMerge,
  needsTranscode,
  pickAudioFormat,
  pickVideoFormat,
} from "@/lib/formats/selection";
import { muxStreams, transcodeAudio } from "@/lib/ffmpeg/client";
import { openSaveTarget, sanitizeFilename, writeToTarget } from "@/lib/save/save-file";

interface ExtractState {
  phase: ExtractPhase;
  probe: ProbeResponse | null;
  probeError: string | null;
  selection: ExtractSelection;
  fetchProgress: Record<string, number>;
  renderProgress: number;
  error: string | null;
  savedFilename: string | null;
}

const DEFAULT_SELECTION: ExtractSelection = {
  mode: "video_audio",
  resolution: "best",
  audioBitrate: "best",
  audioContainer: "best",
};

function initialState(): ExtractState {
  return {
    phase: "idle",
    probe: null,
    probeError: null,
    selection: DEFAULT_SELECTION,
    fetchProgress: {},
    renderProgress: 0,
    error: null,
    savedFilename: null,
  };
}

interface ResolvedStreamToken {
  formatId: string;
  token: string;
  filesize: number | null;
}

async function fetchWithProgress(
  token: string,
  signal: AbortSignal,
  onProgress: (fraction: number) => void,
): Promise<Uint8Array> {
  const res = await fetch(`/api/stream?token=${encodeURIComponent(token)}`, { signal });
  if (!res.ok || !res.body) {
    throw new Error(`Failed to fetch source stream (status ${res.status})`);
  }

  const total = Number(res.headers.get("content-length")) || 0;
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let received = 0;

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) {
      chunks.push(value);
      received += value.length;
      if (total > 0) onProgress(received / total);
    }
  }

  const merged = new Uint8Array(received);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.length;
  }
  return merged;
}

function qualityTag(selection: ExtractSelection): string {
  if (selection.mode === "audio_only") {
    const bitrate = selection.audioBitrate === "best" ? "best" : `${selection.audioBitrate}k`;
    return `audio-${selection.audioContainer}-${bitrate}`;
  }
  const resolution = selection.resolution === "best" ? "best" : `${selection.resolution}p`;
  return `${selection.mode}-${resolution}`;
}

export function useExtractJob() {
  const [state, setState] = useState<ExtractState>(initialState);
  const abortRef = useRef<AbortController | null>(null);

  const patch = useCallback((partial: Partial<ExtractState>) => {
    setState((prev) => ({ ...prev, ...partial }));
  }, []);

  const probeVideo = useCallback(async (url: string) => {
    abortRef.current?.abort();
    setState((prev) => ({
      ...initialState(),
      selection: prev.selection,
      phase: "probing",
    }));

    try {
      const res = await fetch("/api/probe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Failed to fetch video info.");
      const probe = body as ProbeResponse;
      patch({
        phase: "probed",
        probe,
        selection: {
          mode: "video_audio",
          resolution: "best",
          audioBitrate: "best",
          audioContainer: "best",
        },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to fetch video info.";
      patch({ phase: "error", probeError: message });
    }
  }, [patch]);

  const updateSelection = useCallback((partial: Partial<ExtractSelection>) => {
    setState((prev) => ({ ...prev, selection: { ...prev.selection, ...partial } }));
  }, []);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    setState(initialState());
  }, []);

  const cancel = useCallback(() => {
    abortRef.current?.abort();
    setState((prev) => ({ ...prev, phase: "cancelled" }));
  }, []);

  const startExtract = useCallback(async () => {
    const { probe, selection } = state;
    if (!probe) return;

    const videoFormat =
      selection.mode !== "audio_only"
        ? pickVideoFormat(probe.formats, selection.mode, selection.resolution)
        : null;
    const audioFormat =
      selection.mode !== "video_only"
        ? pickAudioFormat(probe.formats, selection.audioBitrate)
        : null;

    if (selection.mode !== "audio_only" && !videoFormat) {
      patch({ phase: "error", error: "No video format available for that selection." });
      return;
    }
    if (selection.mode !== "video_only" && !audioFormat) {
      patch({ phase: "error", error: "No audio format available for that selection." });
      return;
    }

    const mustMerge = needsMerge(selection.mode, videoFormat);
    const mustTranscode = needsTranscode(selection.mode, selection.audioContainer);

    let outExt: string;
    if (selection.mode === "audio_only") {
      outExt = mustTranscode ? (selection.audioContainer === "best" ? "m4a" : selection.audioContainer) : (audioFormat!.ext);
    } else if (mustMerge) {
      outExt = chooseOutputContainer(videoFormat, audioFormat);
    } else {
      outExt = videoFormat!.ext;
    }

    const suggestedName = sanitizeFilename(`${probe.title} (${qualityTag(selection)})`);

    // Must be the very next call with no awaited work before it, so the
    // click gesture that triggered startExtract() is still "active".
    const saveTarget = await openSaveTarget(suggestedName, outExt);
    if (saveTarget.kind === "cancelled") {
      patch({ phase: "cancelled" });
      return;
    }

    // Only fetch a separate audio stream when we'll actually use it: either
    // audio-only mode, or a video_audio merge. A progressive video_audio
    // pick (mustMerge === false) already contains its own audio track, so
    // fetching + resolving a second audio-only stream would be wasted
    // bandwidth (and the wrong format selector to boot).
    const needVideo = selection.mode !== "audio_only";
    const needAudio = selection.mode === "audio_only" || (selection.mode === "video_audio" && mustMerge);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      patch({ phase: "resolving", error: null, fetchProgress: {}, renderProgress: 0 });
      const formatIds = [
        needVideo ? videoFormat?.formatId : null,
        needAudio ? audioFormat?.formatId : null,
      ].filter((id): id is string => Boolean(id));
      const resolveRes = await fetch("/api/resolve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: probe.webpageUrl, formatIds }),
        signal: controller.signal,
      });
      const resolveBody = await resolveRes.json();
      if (!resolveRes.ok) throw new Error(resolveBody.error ?? "Failed to resolve source streams.");
      const streams = resolveBody.streams as ResolvedStreamToken[];

      patch({ phase: "fetching" });
      const byFormatId = new Map(streams.map((s) => [s.formatId, s]));

      const fetchOne = async (formatId: string) => {
        const stream = byFormatId.get(formatId);
        if (!stream) throw new Error(`Missing resolved stream for format ${formatId}`);
        return fetchWithProgress(stream.token, controller.signal, (fraction) => {
          setState((prev) => ({
            ...prev,
            fetchProgress: { ...prev.fetchProgress, [formatId]: fraction },
          }));
        });
      };

      let videoBytes: Uint8Array | null = null;
      let audioBytes: Uint8Array | null = null;

      if (needVideo && needAudio) {
        [videoBytes, audioBytes] = await Promise.all([
          fetchOne(videoFormat!.formatId),
          fetchOne(audioFormat!.formatId),
        ]);
      } else if (needVideo) {
        videoBytes = await fetchOne(videoFormat!.formatId);
      } else if (needAudio) {
        audioBytes = await fetchOne(audioFormat!.formatId);
      }

      let finalBytes: Uint8Array;

      if (selection.mode === "audio_only") {
        finalBytes = audioBytes!;
        if (mustTranscode) {
          patch({ phase: "rendering" });
          const target = selection.audioContainer === "best" ? "m4a" : selection.audioContainer;
          const kbps = selection.audioBitrate === "best" ? 192 : selection.audioBitrate;
          finalBytes = await transcodeAudio(finalBytes, audioFormat!.ext, target, kbps, (p) =>
            patch({ renderProgress: p }),
          );
        }
      } else if (mustMerge) {
        patch({ phase: "rendering" });
        finalBytes = await muxStreams(
          videoBytes!,
          videoFormat!.ext,
          audioBytes!,
          audioFormat!.ext,
          outExt as "mp4" | "mkv",
          (p) => patch({ renderProgress: p }),
        );
      } else {
        finalBytes = videoBytes!;
      }

      patch({ phase: "saving" });
      await writeToTarget(saveTarget, finalBytes, suggestedName, outExt);

      patch({ phase: "done", savedFilename: `${suggestedName}.${outExt}` });
    } catch (err) {
      if (controller.signal.aborted) {
        patch({ phase: "cancelled" });
        return;
      }
      const message = err instanceof Error ? err.message : "Extraction failed.";
      patch({ phase: "error", error: message });
    }
  }, [state, patch]);

  return {
    ...state,
    probeVideo,
    updateSelection,
    startExtract,
    cancel,
    reset,
  };
}
