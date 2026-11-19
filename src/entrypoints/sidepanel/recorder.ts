/**
 * Optional video recording of the measured tab and of this side panel, with
 * Chrome's native `Page.startScreenRecording` (Chrome 153+) over
 * `chrome.debugger`. Chrome captures frames from each page's compositor and
 * encodes AV1 MP4 out of process, so recording doesn't run on the page's main
 * thread.
 *
 * Same calls as https://github.com/push-based/chrome-recorder.
 */

/** `Page.startScreenRecording` shipped in Chrome 153. */
const MIN_CHROME = 153;

export type Target = Browser.debugger.Debuggee;

interface StreamResult {
  stream?: string;
}

interface ReadResult {
  data: string;
  base64Encoded?: boolean;
  eof: boolean;
}

export function recordingSupported(userAgent: string): boolean {
  const match = /Chrom(?:e|ium)\/(\d+)/.exec(userAgent);

  return match !== null && Number(match[1]) >= MIN_CHROME;
}

/**
 * The debugger target of this side panel. A side panel has no tab, and every
 * window's panel has the same URL, so it's found by a unique title.
 */
export async function panelTarget(): Promise<Target> {
  const title = document.title;
  const marker = `${title} ${crypto.randomUUID()}`;

  document.title = marker;

  try {
    const targets = await browser.debugger.getTargets();
    const panel = targets.find((target) => target.title === marker);

    if (!panel) throw new Error('Could not find the side panel to record.');

    return { targetId: panel.id };
  } finally {
    document.title = title;
  }
}

export async function startRecording(target: Target): Promise<void> {
  await browser.debugger.attach(target, '1.3');

  try {
    await browser.debugger.sendCommand(target, 'Page.startScreenRecording', { frameRate: 60 });
  } catch (error) {
    await browser.debugger.detach(target).catch(() => {});

    throw error;
  }
}

/** Stops recording `target` and returns the MP4. */
export async function stopRecording(target: Target): Promise<Blob> {
  try {
    // SAFETY: Page.stopScreenRecording returns `{ stream?: IO.StreamHandle }`.
    const result = (await browser.debugger.sendCommand(target, 'Page.stopScreenRecording')) as
      | StreamResult
      | undefined;

    const handle = result?.stream;

    if (!handle) throw new Error('Chrome returned no video.');

    const chunks: BlobPart[] = [];

    for (;;) {
      // SAFETY: IO.read returns `{ data, base64Encoded?, eof }`.
      const chunk = (await browser.debugger.sendCommand(target, 'IO.read', {
        handle,
        size: 4 * 1024 * 1024,
      })) as ReadResult;

      if (chunk.data) {
        chunks.push(chunk.base64Encoded ? Uint8Array.from(atob(chunk.data), toByte) : chunk.data);
      }

      if (chunk.eof) break;
    }

    await browser.debugger.sendCommand(target, 'IO.close', { handle });

    return new Blob(chunks, { type: 'video/mp4' });
  } finally {
    await browser.debugger.detach(target).catch(() => {});
  }
}

/** Detaches without saving, for a recording that can't be finished. */
export async function discardRecording(target: Target): Promise<void> {
  await browser.debugger.detach(target).catch(() => {});
}

function toByte(character: string): number {
  return character.charCodeAt(0);
}
