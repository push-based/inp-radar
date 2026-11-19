/**
 * The messages between the side panel and the background script for "Page +
 * panel" recording.
 *
 * The background script owns the `chrome.debugger` sessions, not the panel: a
 * session belongs to the page that attached it, and a closing panel can't
 * reliably detach on its way out, which would leave Chrome recording, with its
 * "started debugging" bar up, until the panel came back. When the panel's port
 * drops, the background script detaches, which ends the recording.
 */

export const RECORDING_PORT = 'inp-radar-recording';

export type VideoName = 'page' | 'panel';

/** Why Chrome detached a target, as `chrome.debugger.onDetach` reports it. */
export type DetachReason = `${Browser.debugger.DetachReason}`;

export type RecorderRequest =
  | { type: 'start'; page: Browser.debugger.Debuggee; panel: Browser.debugger.Debuggee }
  /** Stops these videos and streams them back, one after the other. */
  | { type: 'stop'; videos: VideoName[] };

export type RecorderReply =
  | { type: 'started' }
  | { type: 'chunk'; video: VideoName; data: string; base64: boolean }
  | { type: 'saved'; video: VideoName }
  | { type: 'failed'; video: VideoName; message: string }
  /** Every video asked for in `stop` was saved or failed. */
  | { type: 'stopped' }
  | { type: 'error'; message: string }
  /**
   * Chrome detached this video's target: `target_closed` when its tab closed
   * or can't be recorded any more, `canceled_by_user` when the user dismissed
   * the debugging bar.
   */
  | { type: 'lost'; video: VideoName; reason: DetachReason };
