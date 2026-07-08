// Minimal ambient types for the File System Access API. Not yet part of
// TypeScript's bundled lib.dom.d.ts; only used client-side and only on
// browsers that implement it (feature-detected via supportsFileSystemAccess()).

interface FileSystemWritableFileStream extends WritableStream {
  write(data: BufferSource | Blob | string): Promise<void>;
  seek(position: number): Promise<void>;
  truncate(size: number): Promise<void>;
}

interface FileSystemFileHandle {
  readonly kind: "file";
  readonly name: string;
  createWritable(options?: { keepExistingData?: boolean }): Promise<FileSystemWritableFileStream>;
}

interface SaveFilePickerAcceptType {
  description?: string;
  accept: Record<string, string[]>;
}

interface SaveFilePickerOptions {
  suggestedName?: string;
  types?: SaveFilePickerAcceptType[];
  excludeAcceptAllOption?: boolean;
}

interface Window {
  showSaveFilePicker?(options?: SaveFilePickerOptions): Promise<FileSystemFileHandle>;
}
