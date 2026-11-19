import {
  RECORDING_PORT,
  type RecorderReply,
  type RecorderRequest,
  type VideoName,
} from '@/shared/recording';

import type { RecordingFile } from './archive';

/**
 * Optional video recording from the side panel. "Page + panel" asks the
 * background script to run Chrome's native recorder on the measured tab and on
 * this panel (see shared/recording.ts); "Whole window" records a window picked
 * in Chrome's share dialog, here in the panel.
 */

/** `Page.startScreenRecording` shipped in Chrome 153. */
const MIN_CHROME = 153;

/** How long to look for this panel's debugger target after retitling it. */
const PANEL_LOOKUP_ATTEMPTS = 20;
const PANEL_LOOKUP_INTERVAL = 50;

export type Target = Browser.debugger.Debuggee;

declare global {
  interface Uint8ArrayConstructor {
    /** Chrome 140+; the recorder only runs on Chrome 153+. */
    fromBase64(base64: string): Uint8Array<ArrayBuffer>;
  }
}

export function recordingSupported(userAgent: string): boolean {
  const match = /Chrom(?:e|ium)\/(\d+)/.exec(userAgent);

  return match !== null && Number(match[1]) >= MIN_CHROME;
}

/**
 * The debugger target of this side panel. A side panel has no tab, and every
 * window's panel has the same URL, so it's found by a unique title. Chrome
 * picks up the title change asynchronously, so this polls for a moment.
 */
export async function panelTarget(): Promise<Target> {
  const title = document.title;
  const marker = `${title} ${crypto.randomUUID()}`;

  document.title = marker;

  try {
    for (let attempt = 0; attempt < PANEL_LOOKUP_ATTEMPTS; attempt++) {
      const targets = await browser.debugger.getTargets();
      const panel = targets.find((target) => target.title === marker);

      if (panel) return { targetId: panel.id };

      await new Promise((resolve) => setTimeout(resolve, PANEL_LOOKUP_INTERVAL));
    }

    throw new Error('Could not find the side panel to record.');
  } finally {
    document.title = title;
  }
}

/** What came back from stopping a "Page + panel" recording. */
export interface StopResult {
  files: RecordingFile[];
  /** "page.mp4: reason" for each video that couldn't be saved. */
  failures: string[];
}

/** A "Page + panel" recording, run by the background script. */
export class NativeRecording {
  readonly #port: Browser.runtime.Port;
  #onReply: ((reply: RecorderReply) => void) | undefined;
  #onClosed: (() => void) | undefined;

  private constructor(port: Browser.runtime.Port, onLost: (video: VideoName) => void) {
    this.#port = port;
    port.onMessage.addListener((reply: RecorderReply) => {
      if (reply.type === 'lost') onLost(reply.video);
      else this.#onReply?.(reply);
    });
    port.onDisconnect.addListener(() => this.#onClosed?.());
  }

  /**
   * Starts recording `page` and `panel`. `onLost` runs when Chrome detaches
   * one of them: its tab closed, or the user dismissed the debugging bar.
   */
  static async start(
    page: Target,
    panel: Target,
    onLost: (video: VideoName) => void,
  ): Promise<NativeRecording> {
    const recording = new NativeRecording(
      browser.runtime.connect({ name: RECORDING_PORT }),
      onLost,
    );

    try {
      await recording.#request({ type: 'start', page, panel }, (reply, done) => {
        if (reply.type === 'started') done();
      });
    } catch (cause) {
      recording.close();

      throw cause;
    }

    return recording;
  }

  /** Stops `videos`, collects them and closes the connection. */
  async stop(videos: VideoName[]): Promise<StopResult> {
    const chunks = new Map<VideoName, BlobPart[]>();
    const result: StopResult = { files: [], failures: [] };

    try {
      await this.#request({ type: 'stop', videos }, (reply, done) => {
        if (reply.type === 'chunk') {
          const parts = chunks.get(reply.video) ?? [];

          parts.push(reply.base64 ? Uint8Array.fromBase64(reply.data) : reply.data);
          chunks.set(reply.video, parts);
        } else if (reply.type === 'saved') {
          const file = new Blob(chunks.get(reply.video) ?? [], { type: 'video/mp4' });

          result.files.push({ name: `${reply.video}.mp4`, file });
          chunks.delete(reply.video);
        } else if (reply.type === 'failed') {
          result.failures.push(`${reply.video}.mp4: ${reply.message}`);
        } else if (reply.type === 'stopped') {
          done();
        }
      });
    } finally {
      this.close();
    }

    return result;
  }

  /** Disconnecting makes the background script detach whatever still records. */
  close(): void {
    this.#onReply = undefined;
    this.#onClosed = undefined;
    this.#port.disconnect();
  }

  #request(
    request: RecorderRequest,
    onReply: (reply: RecorderReply, done: () => void) => void,
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      this.#onReply = (reply) => {
        if (reply.type === 'error') reject(new Error(reply.message));
        else onReply(reply, resolve);
      };

      this.#onClosed = () => reject(new Error('The background script stopped.'));
      this.#port.postMessage(request);
    });
  }
}

/** Chrome's extra `getDisplayMedia` hints, not yet in TypeScript's DOM types. */
interface ChromeDisplayMediaOptions extends DisplayMediaStreamOptions {
  selfBrowserSurface?: 'include' | 'exclude';
}

export interface WindowRecording {
  stream: MediaStream;
  recorder: MediaRecorder;
  chunks: Blob[];
  /** Resolves once the recorder has delivered its last chunk. */
  stopped: Promise<void>;
}

/**
 * Records a window the user picks in Chrome's share dialog, meant for the
 * Chrome window itself: page, side panel and tab bar in one video. Uses
 * `MediaRecorder` (VP9 WebM, falling back to what the browser has), since the
 * native recorder only sees one page. `onEnded` runs if sharing is stopped
 * from Chrome's own "Stop sharing" button.
 *
 * VP9 WebM first: Chrome's software H.264 and AV1 MediaRecorder paths
 * produced corrupt frames for window captures in testing; VP9 decoded cleanly.
 */
export async function startWindowRecording(onEnded: () => void): Promise<WindowRecording> {
  const options: ChromeDisplayMediaOptions = {
    video: { displaySurface: 'window', frameRate: 60 },
    audio: false,
    selfBrowserSurface: 'include',
  };

  const stream = await navigator.mediaDevices.getDisplayMedia(options);

  try {
    const mimeType = ['video/webm;codecs=vp9', 'video/webm', 'video/mp4'].find((type) =>
      MediaRecorder.isTypeSupported(type),
    );

    const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 12_000_000 });
    const chunks: Blob[] = [];

    // Listening before anything can end the stream: the last chunk arrives
    // after the recorder already reports "inactive", right before "stop".
    const stopped = new Promise<void>((resolve) =>
      recorder.addEventListener('stop', () => resolve(), { once: true }),
    );

    recorder.addEventListener('dataavailable', (event) => {
      if (event.data.size > 0) chunks.push(event.data);
    });
    stream.getVideoTracks()[0]?.addEventListener('ended', onEnded, { once: true });
    recorder.start(1000);

    return { stream, recorder, chunks, stopped };
  } catch (cause) {
    stopTracks(stream);

    throw cause;
  }
}

export async function stopWindowRecording(recording: WindowRecording): Promise<Blob> {
  const { stream, recorder, chunks, stopped } = recording;

  if (recorder.state !== 'inactive') recorder.stop();

  await stopped;
  stopTracks(stream);

  return new Blob(chunks, { type: recorder.mimeType });
}

function stopTracks(stream: MediaStream): void {
  for (const track of stream.getTracks()) track.stop();
}
