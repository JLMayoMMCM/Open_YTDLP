// Loose types for yt-dlp's own JSON output (--dump-single-json / -j). yt-dlp
// doesn't publish a formal schema and fields vary a lot by extractor, so these
// are intentionally permissive (most fields optional/nullable).

export interface RawYtDlpFormat {
  format_id: string;
  ext?: string;
  protocol?: string;
  vcodec?: string | null;
  acodec?: string | null;
  height?: number | null;
  width?: number | null;
  fps?: number | null;
  abr?: number | null;
  vbr?: number | null;
  tbr?: number | null;
  filesize?: number | null;
  filesize_approx?: number | null;
  has_drm?: boolean;
  url?: string;
  http_headers?: Record<string, string>;
}

export interface RawYtDlpInfo {
  _type?: string;
  id?: string;
  title?: string;
  thumbnail?: string | null;
  duration?: number | null;
  uploader?: string | null;
  webpage_url?: string;
  extractor?: string;
  extractor_key?: string;
  formats?: RawYtDlpFormat[];

  // Present when -f resolves to a single format (progressive/audio-only download).
  url?: string;
  http_headers?: Record<string, string>;
  format_id?: string;

  // Present when -f resolves to a "video+audio" pair (e.g. "137+140").
  requested_formats?: RawYtDlpFormat[];
}
