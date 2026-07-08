"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";

interface ResolutionSelectProps {
  resolutions: number[];
  value: number | "best";
  onChange: (value: number | "best") => void;
  disabled?: boolean;
}

export function ResolutionSelect({ resolutions, value, onChange, disabled }: ResolutionSelectProps) {
  const items: Record<string, string> = {
    best: "Highest available",
    ...Object.fromEntries(resolutions.map((h) => [String(h), `${h}p`])),
  };

  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor="resolution-select">Resolution</Label>
      <Select
        items={items}
        value={String(value)}
        onValueChange={(v) => onChange(v === "best" ? "best" : Number(v))}
        disabled={disabled}
      >
        <SelectTrigger id="resolution-select" className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="best">Highest available</SelectItem>
          {resolutions.map((height) => (
            <SelectItem key={height} value={String(height)}>
              {height}p
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
