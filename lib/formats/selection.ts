import type { AudioContainer, Mode, ProbeFormat } from "./types";

/** Distinct video heights, sorted descending. */
export function listResolutions(formats: ProbeFormat[]): number[] {
  return Array.from(
    new Set(formats.filter((f) => f.height != null).map((f) => f.height as number)),
  ).sort((a, b) => b - a);
}

/** Distinct audio bitrates (kbps) among audio-bearing formats, sorted descending. */
export function listAudioBitrates(formats: ProbeFormat[]): number[] {
  return Array.from(
    new Set(
      formats
        .filter((f) => f.acodec != null && f.abr != null && f.abr > 0)
        .map((f) => Math.round(f.abr as number)),
    ),
  ).sort((a, b) => b - a);
}

function isMp4Friendly(f: ProbeFormat): boolean {
  const codec = (f.vcodec ?? f.acodec ?? "").toLowerCase();
  return (
    codec.startsWith("avc1") ||
    codec.startsWith("mp4a") ||
    codec.startsWith("h264") ||
    codec.startsWith("aac")
  );
}

/**
 * Picks the best video-bearing format for a given mode/resolution cap.
 *
 * For "video_audio", picks the overall highest-quality candidate first
 * (by height, then bitrate) regardless of whether it's progressive or
 * video-only — a merge is never avoided at the cost of resolution. Only
 * when the top pick requires a merge do we check for a progressive format
 * at that *exact same* height, and swap to it, since that avoids the merge
 * at no quality cost. Most sites only offer progressive streams up to a
 * modest height (e.g. YouTube tops out around 360p), with everything
 * higher available solely as separate streams — always preferring
 * progressive would silently cap "Highest available" at that low height.
 */
export function pickVideoFormat(
  formats: ProbeFormat[],
  mode: Extract<Mode, "video_audio" | "video_only">,
  resolution: number | "best",
): ProbeFormat | null {
  const cap = resolution === "best" ? Infinity : resolution;
  const withVideo = formats.filter((f) => f.vcodec != null && (f.height ?? 0) <= cap);
  if (withVideo.length === 0) return null;

  const rank = (f: ProbeFormat) => (f.height ?? 0) * 100000 + (f.tbr ?? 0);
  const pickBest = (pool: ProbeFormat[]) =>
    pool.reduce((best, f) => (rank(f) > rank(best) ? f : best));

  if (mode === "video_only") {
    const videoOnly = withVideo.filter((f) => !f.isProgressive);
    return pickBest(videoOnly.length > 0 ? videoOnly : withVideo);
  }

  const best = pickBest(withVideo);
  if (!best.isProgressive) {
    const matchingProgressive = withVideo.filter(
      (f) => f.isProgressive && f.height === best.height,
    );
    if (matchingProgressive.length > 0) return pickBest(matchingProgressive);
  }
  return best;
}

/** Nearest-at-or-above the requested bitrate, else the highest available. */
export function pickAudioFormat(formats: ProbeFormat[], bitrate: number | "best"): ProbeFormat | null {
  const withAudio = formats.filter((f) => f.acodec != null);
  if (withAudio.length === 0) return null;

  // Note: deliberately not falling back to `tbr` here — for a progressive
  // (video+audio) format tbr is the *combined* bitrate, and probe.ts's
  // normalizeFormat() already folds tbr into abr for genuine audio-only
  // formats where yt-dlp omits abr. So `abr` alone is the trustworthy signal.
  const abr = (f: ProbeFormat) => f.abr ?? 0;

  if (bitrate === "best") {
    return withAudio.reduce((best, f) => (abr(f) > abr(best) ? f : best));
  }

  const atOrAbove = withAudio.filter((f) => abr(f) >= bitrate);
  if (atOrAbove.length > 0) {
    return atOrAbove.reduce((best, f) => (abr(f) < abr(best) ? f : best));
  }
  return withAudio.reduce((best, f) => (abr(f) > abr(best) ? f : best));
}

export function needsMerge(mode: Mode, videoFormat: ProbeFormat | null): boolean {
  if (mode !== "video_audio" || !videoFormat) return false;
  return !videoFormat.isProgressive;
}

export function needsTranscode(
  mode: Mode,
  audioContainer: AudioContainer,
): boolean {
  return mode === "audio_only" && audioContainer !== "best";
}

/** mp4 only when both streams are mp4-friendly (stream-copy is always safe otherwise as mkv). */
export function chooseOutputContainer(
  videoFormat: ProbeFormat | null,
  audioFormat: ProbeFormat | null,
): "mp4" | "mkv" {
  const videoOk = !videoFormat || isMp4Friendly(videoFormat);
  const audioOk = !audioFormat || isMp4Friendly(audioFormat);
  return videoOk && audioOk ? "mp4" : "mkv";
}
