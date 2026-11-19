import { Zip, ZipPassThrough } from 'fflate';

/** One file in a recording download, such as `page.mp4`. */
export interface RecordingFile {
  name: string;
  file: Blob;
}

/**
 * Bundles a recording's files into one zip, so Stop is a single download.
 * The videos are already compressed (AV1, VP9), so they're stored as is: each
 * file is streamed through in chunks rather than copied whole, which keeps
 * long recordings from being held in memory several times over.
 */
export async function zipRecording(files: RecordingFile[]): Promise<Blob> {
  const parts: Uint8Array<ArrayBuffer>[] = [];
  let failure: Error | null = null;

  const zip = new Zip((error, data) => {
    if (error) failure = error;
    else parts.push(new Uint8Array(data));
  });

  for (const { name, file } of files) {
    const entry = new ZipPassThrough(name);

    zip.add(entry);

    const reader = file.stream().getReader();

    for (;;) {
      const { done, value } = await reader.read();

      if (done) break;

      entry.push(value);
    }

    entry.push(new Uint8Array(0), true);
  }

  zip.end();

  if (failure) throw failure;

  return new Blob(parts, { type: 'application/zip' });
}
