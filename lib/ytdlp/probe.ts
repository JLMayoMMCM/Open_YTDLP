import { execFile } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { findYtDlp } from "./binary";
import type { RawYtDlpFormat, RawYtDlpInfo } from "./types";
import type { ProbeFormat, ProbeResponse } from "@/lib/formats/types";

const execFileAsync = promisify(execFile);

/**
 * Writes `cookies` (Netscape cookie-file format, pasted by the user) to a
 * temp file scoped to this single yt-dlp invocation, passes it via
 * `--cookies`, then deletes it — the cookie text is never persisted beyond
 * the request that carried it. No-op (no `--cookies` flag) when omitted.
 */
export async function withCookiesFile<T>(
  cookies: string | undefined,
  run: (cookieArgs: string[]) => Promise<T>,
): Promise<T> {
  if (!cookies) return run([]);
  const dir = await mkdtemp(join(tmpdir(), "ytdlp-cookies-"));
  const file = join(dir, "cookies.txt");
  try {
    await writeFile(file, cookies, "utf8");
    return await run(["--cookies", file]);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

// YouTube increasingly serves its "Sign in to confirm you're not a bot"
// challenge to requests from datacenter/serverless IP ranges (e.g. Netlify's).
// The mobile/TV player clients use a different auth flow that isn't subject
// to that check, so requesting them first works around it without needing
// cookies. Shared with resolve.ts so probing and resolving see the same
// (and thus cache-compatible) format IDs.
export const YTDLP_COMMON_ARGS = [
  "--extractor-args",
  "youtube:player_client=android,ios,tv",
  "--no-playlist",
  "--no-warnings",
  "--no-cache-dir",
];

export class YtDlpNotFoundError extends Error {
  constructor() {
    super(
      "yt-dlp binary not found. Install it (winget install yt-dlp.yt-dlp) or drop yt-dlp.exe into bin/ — see README.md.",
    );
    this.name = "YtDlpNotFoundError";
  }
}

export class ProbeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProbeError";
  }
}

function isMediaFormat(f: RawYtDlpFormat): boolean {
  if (f.has_drm) return false;
  if (f.protocol === "mhtml") return false; // storyboard thumbnails
  const hasVideo = f.vcodec != null && f.vcodec !== "none";
  const hasAudio = f.acodec != null && f.acodec !== "none";
  return hasVideo || hasAudio;
}

function normalizeFormat(f: RawYtDlpFormat): ProbeFormat {
  const hasVideo = f.vcodec != null && f.vcodec !== "none";
  const hasAudio = f.acodec != null && f.acodec !== "none";
  // For audio-only formats, yt-dlp sometimes omits `abr` but still sets
  // `tbr` (total bitrate == audio bitrate when there's no video track), so
  // that's a safe fallback. For progressive (video+audio) formats, `tbr` is
  // the *combined* bitrate — using it as the audio bitrate would wildly
  // overstate it, so leave abr null there unless yt-dlp reported it directly.
  let abr: number | null = null;
  if (hasAudio) {
    if (f.abr && f.abr > 0) abr = f.abr;
    else if (!hasVideo && f.tbr) abr = f.tbr;
  }
  return {
    formatId: f.format_id,
    ext: f.ext ?? "bin",
    vcodec: hasVideo ? (f.vcodec as string) : null,
    acodec: hasAudio ? (f.acodec as string) : null,
    height: f.height ?? null,
    width: f.width ?? null,
    fps: f.fps ?? null,
    abr,
    vbr: hasVideo ? (f.vbr || null) : null,
    tbr: f.tbr ?? null,
    filesize: f.filesize ?? null,
    filesizeApprox: f.filesize_approx ?? null,
    isProgressive: hasVideo && hasAudio,
    protocol: f.protocol ?? "https",
  };
}

/**
 * Runs `yt-dlp --dump-single-json` for a URL and normalizes the result.
 * Rejects playlist/channel URLs the same way the old backend did — this app
 * only ever operates on a single video.
 */
export async function probeUrl(url: string, cookies?: string): Promise<ProbeResponse> {
  const bin = findYtDlp();
  if (!bin) throw new YtDlpNotFoundError();

  let stdout: string;
  try {
    // Kept comfortably under typical serverless function response-timeout
    // ceilings (e.g. Netlify's default synchronous function limit) so a
    // slow extractor fails with our own message instead of a bare 504.
    stdout = await withCookiesFile(cookies, async (cookieArgs) => {
      const result = await execFileAsync(
        bin,
        ["--dump-single-json", ...YTDLP_COMMON_ARGS, ...cookieArgs, "--", url],
        { timeout: 20_000, maxBuffer: 20 * 1024 * 1024 },
      );
      return result.stdout;
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new ProbeError(cleanYtDlpError(message));
  }

  let info: RawYtDlpInfo;
  try {
    info = JSON.parse(stdout);
  } catch {
    throw new ProbeError("Could not parse yt-dlp output for that URL.");
  }

  if (info._type === "playlist") {
    throw new ProbeError("Playlists are not supported yet — paste a single video URL.");
  }

  const rawFormats = (info.formats ?? []).filter(isMediaFormat);
  const formats = rawFormats.map(normalizeFormat);

  const resolutions = Array.from(
    new Set(formats.filter((f) => f.height != null).map((f) => f.height as number)),
  ).sort((a, b) => b - a);

  const progressiveResolutions = Array.from(
    new Set(
      formats.filter((f) => f.isProgressive && f.height != null).map((f) => f.height as number),
    ),
  ).sort((a, b) => b - a);

  const audioBitrates = Array.from(
    new Set(
      formats
        .filter((f) => f.acodec != null && f.abr != null && f.abr > 0)
        .map((f) => Math.round(f.abr as number)),
    ),
  ).sort((a, b) => b - a);

  const hasAudio = formats.some((f) => f.acodec != null);

  return {
    videoId: info.id ?? "",
    title: info.title ?? "Unknown",
    thumbnail: info.thumbnail ?? null,
    duration: info.duration ?? null,
    uploader: info.uploader ?? null,
    webpageUrl: info.webpage_url ?? url,
    extractor: info.extractor ?? info.extractor_key ?? "unknown",
    formats,
    resolutions,
    progressiveResolutions,
    audioBitrates,
    hasAudio,
  };
}

/** yt-dlp errors are usually prefixed with "ERROR: " and can be quite long; keep just the first line. */
export function cleanYtDlpError(message: string): string {
  const match = message.match(/ERROR:\s*(.+)/);
  const line = (match ? match[1] : message).split("\n")[0].trim();
  return line || "Could not read any information for that URL.";
}
