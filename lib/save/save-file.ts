// Client-only. Handles the "Save As" step of an extraction.
//
// showSaveFilePicker() requires an active user-activation gesture, which
// will have long expired by the time a merge/transcode finishes. So the
// picker must be opened at the moment of the Extract button click (the one
// guaranteed valid gesture) — see openSaveTarget() — and the resulting
// handle is written to only once rendering completes.
//
// Firefox/Safari don't implement the File System Access API at all, so
// there's no picker to open up front; those fall back to synthesizing an
// <a download> click once the final bytes are ready.

const MIME_TYPES: Record<string, string> = {
  mp4: "video/mp4",
  mkv: "video/x-matroska",
  mp3: "audio/mpeg",
  m4a: "audio/mp4",
};

export function mimeTypeForExt(ext: string): string {
  return MIME_TYPES[ext] ?? "application/octet-stream";
}

export function supportsFileSystemAccess(): boolean {
  return typeof window !== "undefined" && "showSaveFilePicker" in window;
}

/** Strips characters that are illegal in Windows/macOS/Linux filenames and trims length. */
export function sanitizeFilename(name: string, maxLength = 120): string {
  const cleaned = name.replace(/[<>:"/\\|?*\x00-\x1f]/g, "_").trim();
  return cleaned.slice(0, maxLength) || "download";
}

export type SaveTarget =
  | { kind: "handle"; handle: FileSystemFileHandle }
  | { kind: "fallback" }
  | { kind: "cancelled" };

/**
 * Opens the native save dialog immediately (must be called synchronously
 * from within the Extract button's click handler) when supported. Returns
 * "fallback" on browsers without the API, or "cancelled" if the user
 * dismissed the picker — callers should abort the whole job on "cancelled".
 */
export async function openSaveTarget(suggestedName: string, ext: string): Promise<SaveTarget> {
  if (!window.showSaveFilePicker) return { kind: "fallback" };

  try {
    const handle = await window.showSaveFilePicker({
      suggestedName: `${suggestedName}.${ext}`,
      types: [
        {
          description: ext.toUpperCase(),
          accept: { [mimeTypeForExt(ext)]: [`.${ext}`] },
        },
      ],
    });
    return { kind: "handle", handle };
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      return { kind: "cancelled" };
    }
    throw err;
  }
}

export async function writeToTarget(
  target: SaveTarget,
  bytes: Uint8Array,
  suggestedName: string,
  ext: string,
): Promise<void> {
  // Re-wrap in a plain ArrayBuffer-backed copy: ffmpeg.wasm/fetch can hand
  // back a Uint8Array typed as Uint8Array<ArrayBufferLike>, which TS won't
  // accept where a strict ArrayBuffer-backed BufferSource/BlobPart is expected.
  const data = new Uint8Array(bytes);

  if (target.kind === "handle") {
    const writable = await target.handle.createWritable();
    await writable.write(data);
    await writable.close();
    return;
  }

  // Fallback: synthesize a download via an anchor tag.
  const blob = new Blob([data], { type: mimeTypeForExt(ext) });
  const url = URL.createObjectURL(blob);
  try {
    const a = document.createElement("a");
    a.href = url;
    a.download = `${suggestedName}.${ext}`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  }
}
