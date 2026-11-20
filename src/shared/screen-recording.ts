/**
 * Chrome's native `Page.startScreenRecording` (Chrome 153+) over
 * `chrome.debugger`, run by the background script (see recording.ts). Chrome
 * captures frames from each page's compositor and encodes AV1 MP4 out of
 * process, so recording doesn't run on the page's main thread.
 *
 * Same calls as https://github.com/push-based/chrome-recorder.
 */

export type Target = Browser.debugger.Debuggee;

interface StreamResult {
  stream?: string;
}

interface ReadResult {
  data: string;
  base64Encoded?: boolean;
  eof: boolean;
}

export async function startRecording(target: Target): Promise<void> {
  await browser.debugger.attach(target, '1.3');

  try {
    await browser.debugger.sendCommand(target, 'Page.startScreenRecording', { frameRate: 60 });
  } catch (cause) {
    await discardRecording(target);

    throw cause;
  }
}

/**
 * Stops recording `target` and returns the stream handle of its MP4, to read
 * with `readRecording`. Detaches if there's no video to read.
 */
export async function stopRecording(target: Target): Promise<string> {
  try {
    // SAFETY: Page.stopScreenRecording returns `{ stream?: IO.StreamHandle }`.
    const result = (await browser.debugger.sendCommand(target, 'Page.stopScreenRecording')) as
      | StreamResult
      | undefined;

    if (!result?.stream) throw new Error('Chrome returned no video.');

    return result.stream;
  } catch (cause) {
    await discardRecording(target);

    throw cause;
  }
}

/** Hands a stopped recording's MP4 to `onChunk` piece by piece, then detaches. */
export async function readRecording(
  target: Target,
  handle: string,
  onChunk: (data: string, base64: boolean) => void,
): Promise<void> {
  try {
    for (;;) {
      // SAFETY: IO.read returns `{ data, base64Encoded?, eof }`.
      const chunk = (await browser.debugger.sendCommand(target, 'IO.read', {
        handle,
        size: 4 * 1024 * 1024,
      })) as ReadResult;

      if (chunk.data) onChunk(chunk.data, chunk.base64Encoded === true);

      if (chunk.eof) break;
    }

    await browser.debugger.sendCommand(target, 'IO.close', { handle });
  } finally {
    await discardRecording(target);
  }
}

/** Detaches without saving; detaching also ends Chrome's recording. */
export async function discardRecording(target: Target): Promise<void> {
  await browser.debugger.detach(target).catch(() => {});
}

export function sameTarget(a: Target, b: Target): boolean {
  return a.tabId !== undefined ? a.tabId === b.tabId : a.targetId === b.targetId;
}
