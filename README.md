# YTDLP UI

A local web app for downloading YouTube videos, powered by [yt-dlp](https://github.com/yt-dlp/yt-dlp) on the backend and styled with [FrankenUI](https://franken-ui.dev/). Pick a resolution and choose to download video+audio, video only, or audio only (best/mp3/m4a).

## Setup (Windows)

1. Install Python 3.11+ (from python.org or the Microsoft Store). `run.ps1` uses `py -3` to pick whichever Python 3 you have installed.
2. Install [ffmpeg](https://ffmpeg.org/) — required for merging separate video/audio streams and for mp3/m4a conversion:
   - `winget install Gyan.FFmpeg` (restart your terminal afterwards so PATH updates), **or**
   - download an "essentials" build from https://www.gyan.dev/ffmpeg/builds/, unzip, and add its `bin` folder to your PATH, **or**
   - drop `ffmpeg.exe` and `ffprobe.exe` directly into this project's `bin\` folder — no PATH changes needed.
3. Run:
   ```powershell
   .\run.ps1
   ```
   This creates a virtual environment, installs dependencies, and starts the server at http://127.0.0.1:8000.
4. Open http://127.0.0.1:8000 in your browser.

If you ever see a `.venv\Scripts\Activate.ps1 cannot be loaded` error, run `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned` once and retry.

## Usage

1. Paste a YouTube video URL and click **Fetch Info**.
2. Choose a mode (Video + Audio / Video only / Audio only), a resolution, and (for audio-only) a format.
   - Options that require ffmpeg are labeled and disabled if ffmpeg isn't installed.
3. Click **Add to Queue**. Downloads run one at a time; progress streams live.
4. Set your preferred output directory under **Settings** (defaults to `downloads/` in this folder).

## Notes / limitations (v1)

- Single videos only — playlist URLs are rejected with a clear message.
- Downloads are processed sequentially, not in parallel.
- The job queue is in-memory and resets when the server restarts (your saved output directory persists in `data/settings.json`).
- Cancelling only works while a job is still queued, not once it has started downloading.

## FrankenUI assets

The FrankenUI CSS/JS bundles are vendored locally under `static/vendor/franken/` (from `franken-ui@2.1.2` on jsDelivr) so the app works fully offline. If you need to refresh them:

```powershell
Invoke-WebRequest https://cdn.jsdelivr.net/npm/franken-ui@2.1.2/dist/css/core.min.css -OutFile static\vendor\franken\core.min.css
Invoke-WebRequest https://cdn.jsdelivr.net/npm/franken-ui@2.1.2/dist/css/utilities.min.css -OutFile static\vendor\franken\utilities.min.css
Invoke-WebRequest https://cdn.jsdelivr.net/npm/franken-ui@2.1.2/dist/js/core.iife.js -OutFile static\vendor\franken\core.iife.js
Invoke-WebRequest https://cdn.jsdelivr.net/npm/franken-ui@2.1.2/dist/js/icon.iife.js -OutFile static\vendor\franken\icon.iife.js
```

## Project structure

```
app/            FastAPI backend (routers, yt-dlp integration, download queue, WebSocket progress)
static/         Frontend: index.html, css/, js/, vendor/franken/
data/           Persisted settings (created at first run)
downloads/      Default download output directory
bin/            Optional local ffmpeg.exe/ffprobe.exe
```
