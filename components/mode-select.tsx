"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import type { Mode } from "@/lib/formats/types";

const MODE_LABELS: Record<Mode, string> = {
  video_audio: "Video + Audio",
  video_only: "Video only",
  audio_only: "Audio only",
};

interface ModeSelectProps {
  value: Mode;
  onChange: (mode: Mode) => void;
  disabled?: boolean;
}

export function ModeSelect({ value, onChange, disabled }: ModeSelectProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor="mode-select">Mode</Label>
      <Select
        items={MODE_LABELS}
        value={value}
        onValueChange={(v) => onChange(v as Mode)}
        disabled={disabled}
      >
        <SelectTrigger id="mode-select" className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {(Object.keys(MODE_LABELS) as Mode[]).map((mode) => (
            <SelectItem key={mode} value={mode}>
              {MODE_LABELS[mode]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
