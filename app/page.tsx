"use client";

import { useMemo } from "react";
import { UrlInputForm } from "@/components/url-input-form";
import { ProbeResultCard } from "@/components/probe-result-card";
import { ModeSelect } from "@/components/mode-select";
import { ResolutionSelect } from "@/components/resolution-select";
import { BitrateSelect } from "@/components/bitrate-select";
import { AudioContainerSelect } from "@/components/audio-container-select";
import { ExtractPanel } from "@/components/extract-panel";
import { BinaryStatusBadge } from "@/components/binary-status-badge";
import { SiteFooter } from "@/components/site-footer";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { FilmSlateIcon, WarningIcon } from "@phosphor-icons/react";
import { useExtractJob } from "@/hooks/use-extract-job";

export default function Home() {
  const job = useExtractJob();

  const inProgress = ["resolving", "fetching", "rendering", "saving"].includes(job.phase);
  const isProbing = job.phase === "probing";

  const largeSourceWarning = useMemo(() => {
    if (!job.probe) return null;
    const cap = job.selection.resolution;
    const candidate = job.probe.formats.find(
      (f) => f.height != null && (cap === "best" || f.height <= cap),
    );
    const bytes = candidate?.filesize ?? candidate?.filesizeApprox ?? null;
    if (bytes && bytes > 1.5 * 1024 * 1024 * 1024) {
      return "This selection is quite large. ffmpeg.wasm processes everything in browser memory, so very large files may run out of memory on some machines.";
    }
    return null;
  }, [job.probe, job.selection.resolution]);

  return (
    <>
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-10">
      <header className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="flex items-center gap-2 text-lg font-semibold tracking-tight">
            <FilmSlateIcon className="size-5 text-primary" weight="fill" />
            Open_YTDLP
          </h1>
          <p className="text-sm text-muted-foreground">
            Download video or audio from any yt-dlp-supported site — merged
            and rendered entirely in your browser.
          </p>
        </div>
        <BinaryStatusBadge />
      </header>

      <Card>
        <CardContent className="flex flex-col gap-3">
          <UrlInputForm onSubmit={job.probeVideo} busy={isProbing} />
          {job.phase === "error" && job.probeError ? (
            <Alert variant="destructive">
              <WarningIcon />
              <AlertTitle>Could not fetch that URL</AlertTitle>
              <AlertDescription>{job.probeError}</AlertDescription>
            </Alert>
          ) : null}
        </CardContent>
      </Card>

      {job.probe ? (
        <>
          <ProbeResultCard probe={job.probe} />

          <Card>
            <CardContent className="flex flex-col gap-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <ModeSelect
                  value={job.selection.mode}
                  onChange={(mode) => job.updateSelection({ mode })}
                  disabled={inProgress}
                />
                {job.selection.mode !== "audio_only" ? (
                  <ResolutionSelect
                    resolutions={job.probe.resolutions}
                    value={job.selection.resolution}
                    onChange={(resolution) => job.updateSelection({ resolution })}
                    disabled={inProgress}
                  />
                ) : null}
                {job.selection.mode !== "video_only" ? (
                  <BitrateSelect
                    bitrates={job.probe.audioBitrates}
                    value={job.selection.audioBitrate}
                    onChange={(audioBitrate) => job.updateSelection({ audioBitrate })}
                    disabled={inProgress}
                  />
                ) : null}
                {job.selection.mode === "audio_only" ? (
                  <AudioContainerSelect
                    value={job.selection.audioContainer}
                    onChange={(audioContainer) => job.updateSelection({ audioContainer })}
                    disabled={inProgress}
                  />
                ) : null}
              </div>

              {largeSourceWarning ? (
                <Alert>
                  <WarningIcon />
                  <AlertDescription>{largeSourceWarning}</AlertDescription>
                </Alert>
              ) : null}

              <ExtractPanel
                phase={job.phase}
                fetchProgress={job.fetchProgress}
                renderProgress={job.renderProgress}
                error={job.error}
                savedFilename={job.savedFilename}
                onExtract={job.startExtract}
                onCancel={job.cancel}
              />
            </CardContent>
          </Card>
        </>
      ) : null}
    </div>
    <SiteFooter />
    </>
  );
}
