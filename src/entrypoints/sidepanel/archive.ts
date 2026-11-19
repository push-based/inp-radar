import { zipSync, type Zippable } from 'fflate';

/** One file in a recording download, such as `page.mp4`. */
export interface RecordingFile {
  name: string;
  file: Blob;
}

/**
 * Bundles a recording's files into one zip, so Stop is a single download.
 * The videos are already compressed (AV1, VP9), so they're stored as is
 * (level 0): zipping just copies the bytes.
 */
export async function zipRecording(files: RecordingFile[]): Promise<Blob> {
  const entries: Zippable = {};

  for (const { name, file } of files) {
    entries[name] = [new Uint8Array(await file.arrayBuffer()), { level: 0 }];
  }

  return new Blob([zipSync(entries)], { type: 'application/zip' });
}
