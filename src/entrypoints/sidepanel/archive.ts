/** One file in a recording download, such as `page.mp4`. */
export interface RecordingFile {
  name: string;
  file: Blob;
}

/** A plain zip stores sizes and offsets in 32 bits; past that it needs ZIP64. */
const ZIP_LIMIT = 0xffff_ffff;

const LOCAL_HEADER = 30;
const CENTRAL_HEADER = 46;
const END_OF_DIRECTORY = 22;
const VERSION = 20;

/** Names are UTF-8. */
const UTF8_FLAG = 0x0800;

/** Whether `files` fit in a plain (non-ZIP64) zip. */
export function fitsInZip(files: { name: string; file: Pick<Blob, 'size'> }[]): boolean {
  // Each name is stored twice, at most 3 UTF-8 bytes per UTF-16 unit.
  const total = files.reduce(
    (sum, { name, file }) => sum + file.size + LOCAL_HEADER + CENTRAL_HEADER + 6 * name.length,
    END_OF_DIRECTORY,
  );

  return total < ZIP_LIMIT;
}

/**
 * Bundles a recording's files into one zip, so Stop is a single download.
 * The videos are already compressed (AV1, VP9), so they're stored as is, and
 * the zip refers to their Blobs rather than copying them: only the headers are
 * new bytes, so a long recording isn't held in memory twice. Each file is read
 * once, in chunks, for its checksum. Check `fitsInZip` first.
 */
export async function zipRecording(files: RecordingFile[]): Promise<Blob> {
  if (!fitsInZip(files)) throw new RangeError('The recording is too large for a zip.');

  const encoder = new TextEncoder();
  const [time, date] = dosDateTime(new Date());
  const parts: BlobPart[] = [];
  const directory: Uint8Array<ArrayBuffer>[] = [];
  let offset = 0;

  for (const { name, file } of files) {
    const nameBytes = encoder.encode(name);
    const crc = await crc32(file);

    const local = new Uint8Array(LOCAL_HEADER + nameBytes.length);
    const header = new DataView(local.buffer);

    header.setUint32(0, 0x04034b50, true);
    header.setUint16(4, VERSION, true);
    header.setUint16(6, UTF8_FLAG, true);
    header.setUint16(8, 0, true); // stored
    header.setUint16(10, time, true);
    header.setUint16(12, date, true);
    header.setUint32(14, crc, true);
    header.setUint32(18, file.size, true);
    header.setUint32(22, file.size, true);
    header.setUint16(26, nameBytes.length, true);
    local.set(nameBytes, LOCAL_HEADER);

    const central = new Uint8Array(CENTRAL_HEADER + nameBytes.length);
    const entry = new DataView(central.buffer);

    entry.setUint32(0, 0x02014b50, true);
    entry.setUint16(4, VERSION, true);
    entry.setUint16(6, VERSION, true);
    entry.setUint16(8, UTF8_FLAG, true);
    entry.setUint16(10, 0, true); // stored
    entry.setUint16(12, time, true);
    entry.setUint16(14, date, true);
    entry.setUint32(16, crc, true);
    entry.setUint32(20, file.size, true);
    entry.setUint32(24, file.size, true);
    entry.setUint16(28, nameBytes.length, true);
    entry.setUint32(42, offset, true);
    central.set(nameBytes, CENTRAL_HEADER);

    parts.push(local, file);
    directory.push(central);
    offset += local.length + file.size;
  }

  const directorySize = directory.reduce((sum, entry) => sum + entry.length, 0);
  const end = new Uint8Array(END_OF_DIRECTORY);
  const footer = new DataView(end.buffer);

  footer.setUint32(0, 0x06054b50, true);
  footer.setUint16(8, files.length, true);
  footer.setUint16(10, files.length, true);
  footer.setUint32(12, directorySize, true);
  footer.setUint32(16, offset, true);

  return new Blob([...parts, ...directory, end], { type: 'application/zip' });
}

/** MS-DOS time and date, as zip headers store them (local time, 2 s steps). */
function dosDateTime(now: Date): [number, number] {
  const time = (now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1);
  const date = ((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate();

  return [time, date];
}

const CRC_TABLE = Uint32Array.from({ length: 256 }, (_, index) => {
  let value = index;

  for (let bit = 0; bit < 8; bit++) value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;

  return value;
});

/** The zip (IEEE) CRC-32 of `file`, read in chunks. */
async function crc32(file: Blob): Promise<number> {
  const reader = file.stream().getReader();
  let crc = 0xffff_ffff;

  for (;;) {
    const { done, value } = await reader.read();

    if (done) break;

    for (let index = 0; index < value.length; index++) {
      crc = (CRC_TABLE[(crc ^ value[index]!) & 0xff] ?? 0) ^ (crc >>> 8);
    }
  }

  return (crc ^ 0xffff_ffff) >>> 0;
}
