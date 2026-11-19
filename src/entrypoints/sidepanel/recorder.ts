/**
 * Optional video recording of the measured tab, with Chrome's native
 * `Page.startScreenRecording` (Chrome 153+) over `chrome.debugger`. Chrome
 * captures frames from the tab's compositor and encodes AV1 MP4 out of
 * process, so recording doesn't run on the page's main thread.
 *
 * Same calls as https://github.com/push-based/chrome-recorder.
 */

/** `Page.startScreenRecording` shipped in Chrome 153. */
const MIN_CHROME = 153;

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

export async function startRecording(tabId: number): Promise<void> {
  const target = { tabId };

  await browser.debugger.attach(target, '1.3');

  try {
    await browser.debugger.sendCommand(target, 'Page.startScreenRecording', { frameRate: 60 });
  } catch (error) {
    await browser.debugger.detach(target).catch(() => {});

    throw error;
  }
}

/** Stops recording `tabId` and returns the MP4. */
export async function stopRecording(tabId: number): Promise<Blob> {
  const target = { tabId };

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

function toByte(character: string): number {
  return character.charCodeAt(0);
}
