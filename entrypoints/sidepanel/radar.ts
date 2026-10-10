/**
 * The "radar" frame meter, adapted from the INP demo by Phil Walton
 * (https://github.com/GoogleChromeLabs/web-perf-demos/tree/main/inp-demo,
 * Apache-2.0).
 *
 * In the demo the radar's own requestAnimationFrame loop runs on the page's
 * main thread, so it stalls when the page is blocked. The side panel runs in a
 * separate process, so here the sweep is driven by the panel's clock and the
 * coloured wedge measures how long it's been since the page's last heartbeat.
 */

const SPEED = 3000; // Milliseconds per one full revolution.

export interface Radar {
  /** Call whenever a heartbeat arrives from the page. */
  beat(): void;
  /** Inactive = greyed out, no wedge (page hidden or not connected). */
  setActive(active: boolean): void;
}

export function createRadar(clock: HTMLElement): Radar {
  let active = false;
  let lastFrame = performance.now();
  let lastBeat = lastFrame;
  // Start of the wedge. Same role as `lastFrameTime` in the demo.
  let lagStart = lastFrame;

  function draw(now: number) {
    const elapsed = now - lastFrame;
    lastFrame = now;

    clock.style.transform = `rotate(${now / SPEED}turn)`;

    if (active) {
      // Play catch up at double speed once the page is responsive again, but
      // never past the last proof of life, and never more than 1 turn behind.
      lagStart = Math.min(
        lastBeat,
        Math.max(now - SPEED, lagStart + elapsed * 2),
      );

      const offset = Math.max(10, 360 * ((now - lagStart) / SPEED));
      clock.style.background = `conic-gradient(var(--clock-face),
        var(--clock-face) ${360 - offset}deg,
        hsl(${Math.max(0, 120 - offset)}deg, 100%, 50%))`;
    }

    requestAnimationFrame(draw);
  }
  requestAnimationFrame(draw);

  return {
    beat() {
      lastBeat = performance.now();
    },
    setActive(next) {
      if (next === active) return;
      active = next;
      lastBeat = lagStart = performance.now();
      clock.classList.toggle('active', active);
      if (!active) clock.style.removeProperty('background');
    },
  };
}
