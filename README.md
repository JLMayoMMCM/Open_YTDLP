# Open_YTDLP

A local web app for downloading video or audio from any [yt-dlp](https://github.com/yt-dlp/yt-dlp)-supported site (YouTube and hundreds of others) — built with Next.js, React, and [shadcn/ui](https://ui.shadcn.com/). Rendering (merging separate video/audio streams, transcoding audio) happens **entirely in your browser** via [ffmpeg.wasm](https://ffmpegwasm.netlify.app/) — the server only resolves formats and proxies the raw bytes.

**Author:** KunRansu

**Tech stack:** Next.js · React · TypeScript · Tailwind CSS · shadcn/ui — with [yt-dlp](https://github.com/yt-dlp/yt-dlp) (extraction) and [ffmpeg.wasm](https://ffmpegwasm.netlify.app/) (in-browser rendering) as the core contributions that make this project possible.

Pick a mode (video + audio / video only / audio only), a resolution, and an audio bitrate — each with a "highest available" option — then click **Extract**. Your browser opens a native Save As dialog immediately, downloads the source stream(s), renders the final file, and writes it straight to the location you picked. Nothing is stored on the server and there is no download history.

## How it works

- **Server (Next.js API routes, Node.js):** shells out to the `yt-dlp` binary to probe a URL's available formats (`/api/probe`) and to resolve a chosen format (or video+audio pair) to its real, short-lived direct URL (`/api/resolve`). A small streaming proxy (`/api/stream`) pipes the raw bytes to the browser (most sites block direct cross-origin fetches from a webpage, and some require the exact headers yt-dlp used to resolve the URL).
- **Client (React, ffmpeg.wasm):** fetches the source stream(s) through the proxy, then — only when actually needed — merges video+audio or transcodes audio to mp3/m4a at your chosen bitrate, entirely in a Web Worker. The result is written to disk via the File System Access API's save dialog (opened at the moment you click Extract, before any network/render work starts — browsers require an active user gesture to open it), or via a regular browser download for browsers that don't support that API (e.g. Firefox, Safari).

## Setup (Windows)

1. Install [Node.js](https://nodejs.org/) 20+.
2. Install [yt-dlp](https://github.com/yt-dlp/yt-dlp) — the extraction engine:
   - `winget install yt-dlp.yt-dlp` (restart your terminal afterwards so PATH updates), **or**
   - download `yt-dlp.exe` from the [latest release](https://github.com/yt-dlp/yt-dlp/releases/latest) and add it to your PATH, **or**
   - drop `yt-dlp.exe` directly into this project's `bin\` folder — no PATH changes needed.
3. Install dependencies and run:
   ```powershell
   npm install
   npm run dev
   ```
   `npm install` also copies the ffmpeg.wasm engine files into `public/ffmpeg-core/` (see `scripts/copy-ffmpeg-core.mjs`) so they're served same-origin instead of from a CDN.
4. Open http://localhost:3000 in a Chromium-based browser (Chrome/Edge) for the full native Save As experience — other browsers work too, falling back to a regular download.

## Deploying to Netlify

The probe/resolve/health API routes shell out to a `yt-dlp` binary, which doesn't exist in Netlify's build/function image by default. To make that work:

- **`netlify/plugins/fetch-ytdlp/`** is a local Netlify build plugin that runs `scripts/fetch-ytdlp-linux.mjs` in `onPreBuild`, downloading the current Linux `yt-dlp` build into `bin/yt-dlp` (chmod'd executable) before `next build` runs. It's wired up in `netlify.toml`.
- **`next.config.ts`**'s `outputFileTracingIncludes` forces that binary into the `/api/probe`, `/api/resolve`, and `/api/health` function bundles — Next's automatic tracer can't see it since it's a runtime `path.join`/`existsSync` lookup (see `lib/ytdlp/binary.ts`), not a static import.
- Connect the repo to Netlify — the plugin, `netlify.toml`, and Next.js auto-detection handle the rest; no manual build command changes needed.

**Known platform caveats to verify after your first deploy** (these depend on your Netlify plan/runtime version, which this repo can't pin from the outside):
- Netlify's synchronous function response-timeout ceiling (commonly ~10–26s depending on plan) may be tighter than a slow site's extraction time — `probeUrl`/`resolveStreams` use a 20s internal timeout to fail cleanly before that, but a very slow extractor could still exceed your plan's ceiling.
- `/api/stream` returns a streamed `Response` body; confirm your Netlify plan/runtime actually streams it through rather than buffering, especially for large video files.

## Usage

1. Paste a video URL and click **Fetch Info**.
2. Choose a **Mode** (Video + Audio / Video only / Audio only), a **Resolution** (video modes), and an **Audio bitrate** — each has a "Highest available" option. For Audio only, also pick an **Audio format** (Best = no re-encode, or MP3/M4A at your chosen bitrate).
3. Click **Extract**. Your browser's save dialog opens immediately — pick a location. The app then downloads the source stream(s) and renders the final file client-side before writing it to disk.
4. You can cancel at any point while it's resolving/downloading/rendering.

## Notes / limitations

- Single videos only — playlist/channel URLs are rejected with a clear message.
- One extraction at a time per tab; nothing is queued or persisted server-side.
- ffmpeg.wasm holds the source stream(s) and rendered output in browser memory (no first-class streaming-to-disk in the underlying library), so very large downloads may be memory-constrained — the UI warns when a selection looks unusually large.
- The File System Access API (the upfront save-location picker) is currently Chromium-only; other browsers fall back to a normal browser download once rendering finishes.
- `next.config.ts` disables the `turbopackFileSystemCacheForDev` experiment (on by default since Next 16.1.0): in this project it leaked ~60MB of `next dev` process memory per Fast Refresh/recompile cycle with no upper bound, which is what turns into multi-GB dev-server memory usage over a long session. Re-test before re-enabling it on a future Next upgrade.

## Project structure

```
app/              Next.js App Router: page.tsx (UI) + api/ route handlers (probe, resolve, stream, health)
components/       React components, including shadcn/ui primitives under components/ui/
lib/ytdlp/        Server-only: locates and shells out to the yt-dlp binary
lib/proxy/        Server-only: signs/verifies short-lived stream tokens for the byte proxy
lib/formats/      Shared types + client-side format/quality selection logic
lib/ffmpeg/       Client-only: ffmpeg.wasm wrapper (mux/transcode)
lib/save/         Client-only: Save As (File System Access API) + download fallback
hooks/            useExtractJob — the client-side state machine driving the whole flow
public/ffmpeg-core/  Generated at `npm install` — self-hosted ffmpeg.wasm engine assets (gitignored)
bin/              Optional local yt-dlp.exe (gitignored) — on Netlify, populated at build time instead (see below)
netlify/plugins/  Local Netlify build plugin that fetches the Linux yt-dlp binary pre-build
scripts/          copy-ffmpeg-core.mjs (postinstall) + fetch-ytdlp-linux.mjs (Netlify onPreBuild)
next.config.ts    outputFileTracingIncludes (bundles bin/yt-dlp for serverless) + dev memory workaround (see Notes)
netlify.toml      Netlify build config: Node version pin + fetch-ytdlp plugin registration
```
