// @vitest-environment node
import { unzipSync } from 'fflate';
import { describe, expect, it } from 'vitest';

import { fitsInZip, zipRecording } from './archive';

async function bytes(blob: Blob) {
  return new Uint8Array(await blob.arrayBuffer());
}

describe('zipRecording', () => {
  it('stores each file uncompressed under its name', async () => {
    const page = new Uint8Array(4096).fill(7);
    const panel = new Uint8Array([1, 2, 3]);

    const zip = await zipRecording([
      { name: 'page.mp4', file: new Blob([page]) },
      { name: 'panel.mp4', file: new Blob([panel]) },
    ]);

    const entries = unzipSync(await bytes(zip));

    expect(zip.type).toBe('application/zip');
    expect(Object.keys(entries)).toEqual(['page.mp4', 'panel.mp4']);
    expect(entries['page.mp4']).toEqual(page);
    expect(entries['panel.mp4']).toEqual(panel);
    // Stored, not deflated: the repetitive page bytes would shrink to almost nothing.
    expect(zip.size).toBeGreaterThan(page.length + panel.length);
  });

  it('writes the CRC-32 of each file', async () => {
    const zip = await bytes(
      await zipRecording([
        { name: 'a.txt', file: new Blob(['The quick brown fox jumps over the lazy dog']) },
      ]),
    );

    // Local file header: CRC-32 at offset 14. Known value for this sentence.
    expect(new DataView(zip.buffer).getUint32(14, true)).toBe(0x414fa339);
  });
});

describe('fitsInZip', () => {
  it('rejects files a plain zip cannot address', () => {
    const small = { name: 'page.mp4', file: new Blob([new Uint8Array(10)]) };
    // Only `size` is read, so a stand-in avoids allocating 4 GiB.
    const huge = { name: 'page.mp4', file: { size: 0xffff_ffff } };

    expect(fitsInZip([small])).toBe(true);
    expect(fitsInZip([huge])).toBe(false);
  });
});
