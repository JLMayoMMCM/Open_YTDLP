"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import type { AudioContainer } from "@/lib/formats/types";

const LABELS: Record<AudioContainer, string> = {
  best: "Best (original)",
  mp3: "MP3",
  m4a: "M4A / AAC",
};

interface AudioContainerSelectProps {
  value: AudioContainer;
  onChange: (value: AudioContainer) => void;
  disabled?: boolean;
}

export function AudioContainerSelect({ value, onChange, disabled }: AudioContainerSelectProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor="audio-container-select">Audio format</Label>
      <Select
        items={LABELS}
        value={value}
        onValueChange={(v) => onChange(v as AudioContainer)}
        disabled={disabled}
      >
        <SelectTrigger id="audio-container-select" className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {(Object.keys(LABELS) as AudioContainer[]).map((container) => (
            <SelectItem key={container} value={container}>
              {LABELS[container]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
