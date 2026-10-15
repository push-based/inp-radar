import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { Meter } from './meter';
import { createRadar } from './radar';

const FRAME = 16;

describe('createRadar', () => {
  let clock: HTMLElement;
  let radar: Meter;

  /** The INP rating the wedge is coloured with, or '' when it isn't drawn. */
  const wedge = () => clock.style.background.match(/var\(--([a-z-]+)\)\)$/)?.[1] ?? '';

  /** Runs `ms` of panel frames, with the page beating on every frame or not at all. */
  function run(ms: number, beating: boolean) {
    for (let t = 0; t < ms; t += FRAME) {
      vi.advanceTimersByTime(FRAME);

      if (beating) radar.beat();
    }
  }

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['requestAnimationFrame', 'performance'] });
    clock = document.createElement('div');
    radar = createRadar(clock);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('draws no wedge until a page is connected', () => {
    run(500, false);

    expect(wedge()).toBe('');
    expect(clock.classList.contains('active')).toBe(false);
  });

  it('shows a small green wedge while the page beats every frame', () => {
    radar.setActive(true);
    run(1000, true);

    expect(clock.classList.contains('active')).toBe(true);
    expect(wedge()).toBe('good');
  });

  it('grows the wedge through the INP thresholds while the page is blocked', () => {
    radar.setActive(true);
    run(200, true);

    run(150, false);
    expect(wedge()).toBe('good');

    run(200, false);
    expect(wedge()).toBe('needs-improvement');

    run(300, false);
    expect(wedge()).toBe('poor');
  });

  it('catches up once beats resume', () => {
    radar.setActive(true);
    run(200, true);
    run(800, false);
    expect(wedge()).toBe('poor');

    // Catching up runs at double speed, so it takes a while to unwind.
    run(100, true);
    expect(wedge()).not.toBe('good');

    run(1000, true);
    expect(wedge()).toBe('good');
  });

  it('removes the wedge when the page goes away', () => {
    radar.setActive(true);
    run(200, true);
    radar.setActive(false);

    expect(wedge()).toBe('');
    expect(clock.classList.contains('active')).toBe(false);
  });
});
