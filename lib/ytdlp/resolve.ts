import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { findYtDlp } from "./binary";
import type { RawYtDlpInfo } from "./types";
import { YtDlpNotFoundError, ProbeError, cleanYtDlpError, YTDLP_COMMON_ARGS, withCookiesFile } from "./probe";

const execFileAsync = promisify(execFile);

export interface ResolvedStream {
  formatId: string;
  url: string;
  headers: Record<string, string>;
  filesize: number | null;
}

/**
 * Resolves 1-2 format IDs (a single progressive/audio-only format, or a
 * "video+audio" pair to merge) to their real, short-lived direct URLs. This
 * is deliberately re-resolved right before proxying rather than reusing
 * probe-time URLs, since some sites' direct URLs are short-lived/IP-bound.
 */
export async function resolveStreams(
  url: string,
  formatIds: string[],
  cookies?: string,
): Promise<ResolvedStream[]> {
  if (formatIds.length < 1 || formatIds.length > 2) {
    throw new ProbeError("Expected 1 or 2 format IDs to resolve.");
  }

  const bin = findYtDlp();
  if (!bin) throw new YtDlpNotFoundError();

  const selector = formatIds.join("+");

  let stdout: string;
  try {
    // See probe.ts for why this is kept under 30s.
    stdout = await withCookiesFile(cookies, async (cookieArgs) => {
      const result = await execFileAsync(
        bin,
        ["-f", selector, ...YTDLP_COMMON_ARGS, ...cookieArgs, "-j", "--", url],
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
    throw new ProbeError("Could not parse yt-dlp output while resolving streams.");
  }

  if (info.requested_formats && info.requested_formats.length > 0) {
    return info.requested_formats.map((f) => ({
      formatId: f.format_id,
      url: f.url ?? "",
      headers: f.http_headers ?? {},
      filesize: f.filesize ?? f.filesize_approx ?? null,
    }));
  }

  if (info.url) {
    return [
      {
        formatId: info.format_id ?? formatIds[0],
        url: info.url,
        headers: info.http_headers ?? {},
        filesize: null,
      },
    ];
  }

  throw new ProbeError("yt-dlp did not resolve a direct URL for the requested format(s).");
}
