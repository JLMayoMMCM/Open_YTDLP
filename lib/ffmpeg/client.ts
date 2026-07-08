import { FFmpeg } from "@ffmpeg/ffmpeg";
import { toBlobURL } from "@ffmpeg/util";

// Client-only. Runs the single-thread @ffmpeg/core build (self-hosted under
// public/ffmpeg-core/, see scripts/copy-ffmpeg-core.mjs) inside the Web
// Worker that @ffmpeg/ffmpeg's FFmpeg class manages internally — no custom
// worker file needed. Multi-thread core is deliberately NOT used for v1: it
// requires COOP/COEP cross-origin isolation, which would also apply to the
// probed video's thumbnail <img> (served from the source site, e.g.
// i.ytimg.com) and break it unless that host happens to send a matching
// CORP header.

let ffmpegPromise: Promise<FFmpeg> | null = null;

export type FfmpegProgressCallback = (progress: number) => void;

async function getFFmpeg(): Promise<FFmpeg> {
  if (!ffmpegPromise) {
    ffmpegPromise = (async () => {
      const ffmpeg = new FFmpeg();
      const baseURL = "/ffmpeg-core";
      await ffmpeg.load({
        coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, "text/javascript"),
        wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, "application/wasm"),
      });
      return ffmpeg;
    })();
  }
  return ffmpegPromise;
}

/** True once the wasm core has been loaded (used to decide whether to show a "loading engine" state). */
export function isFfmpegLoaded(): boolean {
  return ffmpegPromise != null;
}

function withProgress(ffmpeg: FFmpeg, onProgress?: FfmpegProgressCallback) {
  if (!onProgress) return () => {};
  const handler = ({ progress }: { progress: number }) => {
    // ffmpeg.wasm can report progress slightly outside [0,1] (and NaN before
    // the first frame is processed); clamp for a sane progress bar.
    if (Number.isFinite(progress)) onProgress(Math.min(1, Math.max(0, progress)));
  };
  ffmpeg.on("progress", handler);
  return () => ffmpeg.off("progress", handler);
}

/** Stream-copy mux of a separate video + audio stream into a single container. Mirrors yt-dlp's FFmpegMergerPP. */
export async function muxStreams(
  video: Uint8Array,
  videoExt: string,
  audio: Uint8Array,
  audioExt: string,
  outExt: "mp4" | "mkv",
  onProgress?: FfmpegProgressCallback,
): Promise<Uint8Array> {
  const ffmpeg = await getFFmpeg();
  const unsubscribe = withProgress(ffmpeg, onProgress);
  const inVideo = `in_video.${videoExt}`;
  const inAudio = `in_audio.${audioExt}`;
  const out = `out.${outExt}`;

  try {
    await ffmpeg.writeFile(inVideo, video);
    await ffmpeg.writeFile(inAudio, audio);
    const code = await ffmpeg.exec([
      "-i", inVideo,
      "-i", inAudio,
      "-c", "copy",
      "-map", "0:v:0",
      "-map", "1:a:0",
      ...(outExt === "mp4" ? ["-movflags", "+faststart"] : []),
      out,
    ]);
    if (code !== 0) throw new Error(`ffmpeg mux failed (exit ${code})`);
    const data = await ffmpeg.readFile(out);
    return data as Uint8Array;
  } finally {
    unsubscribe();
    await Promise.all(
      [inVideo, inAudio, out].map((f) => ffmpeg.deleteFile(f).catch(() => {})),
    );
  }
}

/** Transcodes an audio-only stream to mp3/m4a at a target bitrate. Mirrors yt-dlp's FFmpegExtractAudioPP. */
export async function transcodeAudio(
  input: Uint8Array,
  inExt: string,
  target: "mp3" | "m4a",
  kbps: number,
  onProgress?: FfmpegProgressCallback,
): Promise<Uint8Array> {
  const ffmpeg = await getFFmpeg();
  const unsubscribe = withProgress(ffmpeg, onProgress);
  const inFile = `in.${inExt}`;
  const outFile = `out.${target}`;

  const codecArgs =
    target === "mp3"
      ? ["-c:a", "libmp3lame", "-b:a", `${kbps}k`]
      : ["-c:a", "aac", "-b:a", `${kbps}k`];

  try {
    await ffmpeg.writeFile(inFile, input);
    const code = await ffmpeg.exec(["-i", inFile, "-vn", ...codecArgs, outFile]);
    if (code !== 0) throw new Error(`ffmpeg transcode failed (exit ${code})`);
    const data = await ffmpeg.readFile(outFile);
    return data as Uint8Array;
  } finally {
    unsubscribe();
    await Promise.all([inFile, outFile].map((f) => ffmpeg.deleteFile(f).catch(() => {})));
  }
}

/** Passthrough remux when no merge/transcode is needed but the container should still change (rare; usually a no-op copy). */
export async function remux(
  input: Uint8Array,
  inExt: string,
  outExt: string,
  onProgress?: FfmpegProgressCallback,
): Promise<Uint8Array> {
  const ffmpeg = await getFFmpeg();
  const unsubscribe = withProgress(ffmpeg, onProgress);
  const inFile = `in.${inExt}`;
  const outFile = `out.${outExt}`;

  try {
    await ffmpeg.writeFile(inFile, input);
    const code = await ffmpeg.exec(["-i", inFile, "-c", "copy", outFile]);
    if (code !== 0) throw new Error(`ffmpeg remux failed (exit ${code})`);
    const data = await ffmpeg.readFile(outFile);
    return data as Uint8Array;
  } finally {
    unsubscribe();
    await Promise.all([inFile, outFile].map((f) => ffmpeg.deleteFile(f).catch(() => {})));
  }
}
