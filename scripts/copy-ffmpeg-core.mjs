// Copies the single-thread @ffmpeg/core wasm/js bundle into public/ so the
// browser loads it same-origin instead of from a CDN. Runs on postinstall.
import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const src = join(root, "node_modules", "@ffmpeg", "core", "dist", "umd");
const dest = join(root, "public", "ffmpeg-core");

if (!existsSync(src)) {
  console.warn("[copy-ffmpeg-core] @ffmpeg/core not installed yet, skipping.");
  process.exit(0);
}

mkdirSync(dest, { recursive: true });
for (const file of ["ffmpeg-core.js", "ffmpeg-core.wasm"]) {
  copyFileSync(join(src, file), join(dest, file));
}
console.log("[copy-ffmpeg-core] copied ffmpeg-core assets to public/ffmpeg-core/");
