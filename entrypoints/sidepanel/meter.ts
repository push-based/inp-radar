/** Shared by the radar and the pulse trace so they sweep in sync. */

export const SPEED = 3000; // Milliseconds per one full sweep.

/** A display fed by the page's per-frame heartbeat. */
export interface Meter {
  /** Call whenever a heartbeat arrives from the page. */
  beat(): void;
  /** Inactive = greyed out, no lag shown (page hidden or not connected). */
  setActive(active: boolean): void;
}

/** Size in degrees of the radar wedge for a given lag (ms). */
export function lagDegrees(lag: number) {
  return Math.max(10, 360 * (lag / SPEED));
}

/** Green → red, using the same mapping as the radar wedge. */
export function lagColor(lag: number) {
  return `hsl(${Math.max(0, 120 - lagDegrees(lag))}deg, 100%, 50%)`;
}
