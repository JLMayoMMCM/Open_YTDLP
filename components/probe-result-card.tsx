import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { ProbeResponse } from "@/lib/formats/types";

function formatDuration(seconds: number | null): string | null {
  if (seconds == null) return null;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const mm = h > 0 ? String(m).padStart(2, "0") : String(m);
  const ss = String(s).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

export function ProbeResultCard({ probe }: { probe: ProbeResponse }) {
  const duration = formatDuration(probe.duration);

  return (
    <Card>
      <CardContent className="flex gap-4">
        {probe.thumbnail ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={probe.thumbnail}
            alt=""
            className="h-24 w-40 shrink-0 rounded-xl object-cover"
          />
        ) : null}
        <div className="flex min-w-0 flex-col gap-1.5">
          <p className="line-clamp-2 text-sm font-medium">{probe.title}</p>
          <p className="text-sm text-muted-foreground">
            {[probe.uploader, duration].filter(Boolean).join(" · ")}
          </p>
          <Badge variant="secondary" className="w-fit capitalize">
            {probe.extractor}
          </Badge>
        </div>
      </CardContent>
    </Card>
  );
}
