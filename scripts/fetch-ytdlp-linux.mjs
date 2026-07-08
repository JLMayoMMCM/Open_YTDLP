// Netlify-build-only. Downloads the standalone Linux yt-dlp binary into
// bin/yt-dlp so next.config.ts's outputFileTracingIncludes can bundle it
// into the probe/resolve/health serverless functions. Not part of
// `npm install`/postinstall — local dev (Windows) supplies its own
// yt-dlp.exe per the README, and running this on a non-Linux machine would
// produce a binary nothing there can execute. Invoked by
// netlify/plugins/fetch-ytdlp during onPreBuild.
import { chmodSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const RELEASE_URL = "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_linux";
const root = dirname(dirname(fileURLToPath(import.meta.url)));
const destDir = join(root, "bin");
const dest = join(destDir, "yt-dlp");

const res = await fetch(RELEASE_URL, { redirect: "follow" });
if (!res.ok) {
  console.error(`[fetch-ytdlp-linux] Failed to download yt-dlp: HTTP ${res.status}`);
  process.exit(1);
}

const bytes = new Uint8Array(await res.arrayBuffer());
mkdirSync(destDir, { recursive: true });
writeFileSync(dest, bytes);
chmodSync(dest, 0o755);

console.log(`[fetch-ytdlp-linux] wrote ${dest} (${bytes.length} bytes)`);
