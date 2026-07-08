"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { CaretDownIcon, MagnifyingGlassIcon, SpinnerIcon } from "@phosphor-icons/react";

interface UrlInputFormProps {
  onSubmit: (url: string, cookies?: string) => void;
  busy: boolean;
}

export function UrlInputForm({ onSubmit, busy }: UrlInputFormProps) {
  const [url, setUrl] = useState("");
  const [cookies, setCookies] = useState("");
  const [showCookies, setShowCookies] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = url.trim();
    if (trimmed) onSubmit(trimmed, cookies.trim() || undefined);
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
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
      </div>

      <button
        type="button"
        onClick={() => setShowCookies((v) => !v)}
        className="flex w-fit items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
      >
        <CaretDownIcon className={showCookies ? "rotate-180 transition-transform" : "transition-transform"} />
        Cookies (advanced, optional)
      </button>

      {showCookies ? (
        <div className="flex flex-col gap-1">
          <Textarea
            value={cookies}
            onChange={(e) => setCookies(e.target.value)}
            placeholder="Paste cookies.txt content (Netscape format) — needed if a site returns a &quot;sign in to confirm you're not a bot&quot; error"
            className="min-h-20 font-mono text-xs"
          />
          <p className="text-xs text-muted-foreground">
            Used only for this request — sent to the server, applied to a single yt-dlp call, then discarded. Never stored.
          </p>
        </div>
      ) : null}
    </form>
  );
}
