"use client";

import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  CheckCircleIcon,
  DownloadSimpleIcon,
  SpinnerIcon,
  WarningIcon,
  XIcon,
} from "@phosphor-icons/react";
import type { ExtractPhase } from "@/lib/formats/types";

const IN_PROGRESS_PHASES: ExtractPhase[] = ["resolving", "fetching", "rendering", "saving"];

const PHASE_LABELS: Partial<Record<ExtractPhase, string>> = {
  resolving: "Resolving source…",
  fetching: "Downloading source stream(s)…",
  rendering: "Rendering with ffmpeg…",
  saving: "Writing file…",
  done: "Saved",
  cancelled: "Cancelled",
};

interface ExtractPanelProps {
  phase: ExtractPhase;
  fetchProgress: Record<string, number>;
  renderProgress: number;
  error: string | null;
  savedFilename: string | null;
  onExtract: () => void;
  onCancel: () => void;
  disabled?: boolean;
}

function progressValue(
  phase: ExtractPhase,
  fetchProgress: Record<string, number>,
  renderProgress: number,
): number | null {
  if (phase === "fetching") {
    const values = Object.values(fetchProgress);
    if (values.length === 0) return null;
    return (values.reduce((a, b) => a + b, 0) / values.length) * 100;
  }
  if (phase === "rendering") return renderProgress * 100;
  if (phase === "done") return 100;
  return null; // indeterminate for resolving/saving
}

export function ExtractPanel({
  phase,
  fetchProgress,
  renderProgress,
  error,
  savedFilename,
  onExtract,
  onCancel,
  disabled,
}: ExtractPanelProps) {
  const inProgress = IN_PROGRESS_PHASES.includes(phase);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        {inProgress ? (
          <Button type="button" variant="outline" onClick={onCancel}>
            <XIcon /> Cancel
          </Button>
        ) : (
          <Button type="button" onClick={onExtract} disabled={disabled}>
            <DownloadSimpleIcon /> Extract
          </Button>
        )}
      </div>

      {inProgress ? (
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <SpinnerIcon className="size-4 animate-spin" />
            {PHASE_LABELS[phase]}
          </div>
          <Progress value={progressValue(phase, fetchProgress, renderProgress)} />
        </div>
      ) : null}

      {phase === "done" ? (
        <Alert>
          <CheckCircleIcon />
          <AlertTitle>Saved</AlertTitle>
          <AlertDescription>{savedFilename}</AlertDescription>
        </Alert>
      ) : null}

      {phase === "error" && error ? (
        <Alert variant="destructive">
          <WarningIcon />
          <AlertTitle>Extraction failed</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
    </div>
  );
}
