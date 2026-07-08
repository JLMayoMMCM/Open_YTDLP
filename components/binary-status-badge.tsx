"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { CheckCircleIcon, SpinnerIcon, WarningIcon } from "@phosphor-icons/react";

interface HealthResponse {
  available: boolean;
  version: string | null;
}

export function BinaryStatusBadge() {
  const [health, setHealth] = useState<HealthResponse | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/health")
      .then((res) => res.json())
      .then((body: HealthResponse) => {
        if (!cancelled) setHealth(body);
      })
      .catch(() => {
        if (!cancelled) setHealth({ available: false, version: null });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!health) {
    return (
      <Badge variant="secondary">
        <SpinnerIcon className="animate-spin" /> checking yt-dlp…
      </Badge>
    );
  }

  if (!health.available) {
    return (
      <Badge variant="destructive" title="Install yt-dlp — see README.md">
        <WarningIcon /> yt-dlp: missing
      </Badge>
    );
  }

  return (
    <Badge variant="secondary" title={health.version ?? undefined}>
      <CheckCircleIcon /> yt-dlp: OK
    </Badge>
  );
}
