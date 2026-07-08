"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { MagnifyingGlassIcon, SpinnerIcon } from "@phosphor-icons/react";

interface UrlInputFormProps {
  onSubmit: (url: string) => void;
  busy: boolean;
}

export function UrlInputForm({ onSubmit, busy }: UrlInputFormProps) {
  const [url, setUrl] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = url.trim();
    if (trimmed) onSubmit(trimmed);
  };

  return (
    <form onSubmit={handleSubmit} className="flex items-center gap-2">
      <Input
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        placeholder="Paste a video URL (YouTube, Vimeo, and hundreds more)"
        className="h-9 flex-1"
        autoFocus
      />
      <Button type="submit" size="default" disabled={busy || url.trim().length === 0}>
        {busy ? <SpinnerIcon className="animate-spin" /> : <MagnifyingGlassIcon />}
        Fetch Info
      </Button>
    </form>
  );
}
