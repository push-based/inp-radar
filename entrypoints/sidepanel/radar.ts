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

import { rate } from '@/utils/protocol';
import { SPEED, lagDegrees, type Meter } from './meter';

export function createRadar(clock: HTMLElement): Meter {
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

      // Coloured by the INP thresholds, like the metric and the event log.
      const lag = now - lagStart;
      clock.style.background = `conic-gradient(var(--clock-face),
        var(--clock-face) ${360 - lagDegrees(lag)}deg, var(--${rate(lag)}))`;
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
