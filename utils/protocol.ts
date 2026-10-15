/**
 * Messages sent from the content script (running in the measured page) to the
 * side panel over a long-lived port. The panel opens the port with
 * `browser.tabs.connect(tabId, { name: PORT_NAME })`.
 */

export const PORT_NAME = 'inp-radar';

export type Rating = 'good' | 'needs-improvement' | 'poor';

export interface InpSnapshot {
  value: number;
  rating: Rating;
  interactionType?: 'pointer' | 'keyboard';
  interactionTarget?: string;
  inputDelay: number;
  processingDuration: number;
  presentationDelay: number;
}

export interface EventRecord {
  /** Sequential interaction number within this page view (1-based). */
  interaction: number;
  interactionId: number;
  name: string;
  duration: number;
  inputDelay: number;
  processingDuration: number;
  presentationDelay: number;
  /** Wall-clock time (ms since epoch) the event started. */
  timestamp: number;
}

export type PageMessage =
  /** Sent once on connect, so a late-opened panel catches up. */
  | {
      type: 'hello';
      url: string;
      visible: boolean;
      inp: InpSnapshot | null;
      events: EventRecord[];
    }
  /** Sent on every page animation frame while the panel is connected. */
  | { type: 'beat' }
  | { type: 'visibility'; visible: boolean }
  | { type: 'inp'; inp: InpSnapshot }
  | { type: 'event'; event: EventRecord }
  /** Page restored from bfcache: metrics start over. */
  | { type: 'reset'; url: string };

export function rate(value: number): Rating {
  if (value <= 200) return 'good';

  if (value <= 500) return 'needs-improvement';

  return 'poor';
}
