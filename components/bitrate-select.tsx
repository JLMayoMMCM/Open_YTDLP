"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";

interface BitrateSelectProps {
  bitrates: number[];
  value: number | "best";
  onChange: (value: number | "best") => void;
  disabled?: boolean;
}

export function BitrateSelect({ bitrates, value, onChange, disabled }: BitrateSelectProps) {
  const items: Record<string, string> = {
    best: "Highest available",
    ...Object.fromEntries(bitrates.map((kbps) => [String(kbps), `${kbps} kbps`])),
  };

  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor="bitrate-select">Audio bitrate</Label>
      <Select
        items={items}
        value={String(value)}
        onValueChange={(v) => onChange(v === "best" ? "best" : Number(v))}
        disabled={disabled}
      >
        <SelectTrigger id="bitrate-select" className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="best">Highest available</SelectItem>
          {bitrates.map((kbps) => (
            <SelectItem key={kbps} value={String(kbps)}>
              {kbps} kbps
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
