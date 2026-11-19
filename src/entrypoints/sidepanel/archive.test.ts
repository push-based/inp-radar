// @vitest-environment node
import { unzipSync } from 'fflate';
import { describe, expect, it } from 'vitest';

import { zipRecording } from './archive';

describe('zipRecording', () => {
  it('stores each file uncompressed under its name', async () => {
    const page = new Uint8Array(4096).fill(7);
    const panel = new Uint8Array([1, 2, 3]);

    const zip = await zipRecording([
      { name: 'page.mp4', file: new Blob([page]) },
      { name: 'panel.mp4', file: new Blob([panel]) },
    ]);

    const entries = unzipSync(new Uint8Array(await zip.arrayBuffer()));

    expect(zip.type).toBe('application/zip');
    expect(Object.keys(entries)).toEqual(['page.mp4', 'panel.mp4']);
    expect(entries['page.mp4']).toEqual(page);
    expect(entries['panel.mp4']).toEqual(panel);
    // Stored, not deflated: the repetitive page bytes would shrink to almost nothing.
    expect(zip.size).toBeGreaterThan(page.length + panel.length);
  });
});
