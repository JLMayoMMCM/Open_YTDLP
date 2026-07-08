// Shared wire types, used by both the server (API routes) and the client
// (components/hooks). Mirrors the shape returned by app/api/probe.

export type Mode = "video_audio" | "video_only" | "audio_only";

export type AudioContainer = "best" | "mp3" | "m4a";

export interface ProbeFormat {
  formatId: string;
  ext: string;
  vcodec: string | null;
  acodec: string | null;
  height: number | null;
  width: number | null;
  fps: number | null;
  /** kbps */
  abr: number | null;
  /** kbps */
  vbr: number | null;
  /** kbps */
  tbr: number | null;
  /** bytes */
  filesize: number | null;
  /** bytes */
  filesizeApprox: number | null;
  isProgressive: boolean;
  protocol: string;
}

export interface ProbeResponse {
  videoId: string;
  title: string;
  thumbnail: string | null;
  duration: number | null;
  uploader: string | null;
  webpageUrl: string;
  extractor: string;
  formats: ProbeFormat[];
  /** Distinct video heights, sorted desc. Replaces the old static RESOLUTION_BUCKETS list. */
  resolutions: number[];
  /** Heights available as a single already-muxed (video+audio) stream. */
  progressiveResolutions: number[];
  /** Distinct audio bitrates (kbps), sorted desc. */
  audioBitrates: number[];
  hasAudio: boolean;
}

export type ExtractPhase =
  | "idle"
  | "probing"
  | "probed"
  | "awaiting-save-location"
  | "resolving"
  | "fetching"
  | "rendering"
  | "ready"
  | "saving"
  | "done"
  | "error"
  | "cancelled";

export interface ExtractSelection {
  mode: Mode;
  /** height in pixels, or "best" */
  resolution: number | "best";
  /** kbps, or "best" */
  audioBitrate: number | "best";
  audioContainer: AudioContainer;
}
