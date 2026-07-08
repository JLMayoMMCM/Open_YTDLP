import { existsSync } from "node:fs";
import path from "node:path";

// Server-only. Mirrors the old Python backend's find_ffmpeg(): check PATH
// first, then fall back to a binary dropped into the repo's bin/ folder.
// See README.md for how to obtain yt-dlp.exe.

const REPO_ROOT = process.cwd();
const BIN_NAMES = process.platform === "win32" ? ["yt-dlp.exe"] : ["yt-dlp"];

let cached: string | null | undefined;

function findOnPath(): string | null {
  const dirs = (process.env.PATH ?? "").split(path.delimiter).filter(Boolean);
  for (const dir of dirs) {
    for (const name of BIN_NAMES) {
      // turbopackIgnore: PATH directories are only known at runtime, not
      // something the bundler should trace/include.
      const candidate = path.join(/*turbopackIgnore: true*/ dir, name);
      if (existsSync(candidate)) return candidate;
    }
  }
  return null;
}

function findBundled(): string | null {
  for (const name of BIN_NAMES) {
    // turbopackIgnore: this is a runtime-only lookup of a user-provided
    // binary (see README), not a file the bundler needs to trace/include.
    const candidate = path.join(/*turbopackIgnore: true*/ REPO_ROOT, "bin", name);
    if (existsSync(candidate)) return candidate;
  }
  return null;
}

/** Resolves the yt-dlp binary path, caching the result for the process lifetime. */
export function findYtDlp(): string | null {
  if (cached !== undefined) return cached;
  cached = findOnPath() ?? findBundled() ?? null;
  return cached;
}

/** Clears the cached binary path (mainly useful for tests/health-check refresh). */
export function refreshYtDlpBinary(): void {
  cached = undefined;
}
