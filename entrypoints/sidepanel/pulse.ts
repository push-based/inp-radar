/**
 * An ECG-style trace of the page's main thread, sweeping left to right in sync
 * with the radar. Each column plots how long it had been since the page's last
 * frame, so a healthy page draws a flat line and a blocked one draws a spike
 * that climbs for as long as the block lasts.
 */

import { SPEED, lagColor, type Meter } from './meter';

const FRAME = 1000 / 60; // A lag of one frame or less sits on the baseline.
const MAX_LAG = 1000; // Lags at or above this hit the top of the screen.
const GRID = [50, 200, 500]; // Reference lines, in ms.
const GAP = 12; // Blank columns ahead of the cursor, like a monitor's erase bar.
const PADDING = 6;

export function createPulse(
  canvas: HTMLCanvasElement,
  readout: HTMLElement,
): Meter {
  const ctx = canvas.getContext('2d')!;
  let width = 0;
  let height = 0;
  // Lag in ms for each CSS-pixel column. NaN = nothing to draw.
  let samples = new Float32Array(0);
  let cursor = -1;
  let active = false;
  let lastBeat = performance.now();
  let colors = readColors();
  let lastReadout = '';

  function readColors() {
    const style = getComputedStyle(canvas);
    return {
      grid: style.getPropertyValue('--line'),
      label: style.getPropertyValue('--muted'),
      font: `10px ${style.fontFamily}`,
    };
  }

  function resize() {
    width = canvas.clientWidth;
    height = canvas.clientHeight;
    canvas.width = Math.round(width * devicePixelRatio);
    canvas.height = Math.round(height * devicePixelRatio);
    samples = new Float32Array(Math.max(1, Math.floor(width))).fill(NaN);
    cursor = -1;
  }

  // Square-root scale: single dropped frames are visible, long blocks still fit.
  function y(lag: number) {
    const v = Math.min(1, Math.sqrt(Math.max(0, lag - FRAME) / (MAX_LAG - FRAME)));
    return PADDING + (1 - v) * (height - PADDING * 2);
  }

  function inGap(column: number) {
    const ahead = (column - cursor + samples.length) % samples.length;
    return ahead > 0 && ahead <= GAP;
  }

  function record(now: number) {
    const n = samples.length;
    const next = Math.floor(((now % SPEED) / SPEED) * n);
    const lag = active ? now - lastBeat : NaN;

    if (cursor < 0) {
      samples[next] = lag;
    } else {
      for (let i = cursor; i !== next; ) {
        i = (i + 1) % n;
        samples[i] = lag;
      }
    }
    cursor = next;
  }

  function draw() {
    ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
    ctx.clearRect(0, 0, width, height);

    // Reference lines.
    ctx.font = colors.font;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'bottom';
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 3]);
    for (const lag of GRID) {
      const lineY = Math.round(y(lag)) + 0.5;
      ctx.strokeStyle = colors.grid;
      ctx.beginPath();
      ctx.moveTo(0, lineY);
      ctx.lineTo(width, lineY);
      ctx.stroke();
      ctx.fillStyle = colors.label;
      ctx.fillText(`${lag} ms`, width - PADDING, lineY - 1);
    }
    ctx.setLineDash([]);

    // The trace, one segment per column so each can take its own colour.
    ctx.lineWidth = 2;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    for (let i = 1; i < samples.length; i++) {
      const a = samples[i - 1] ?? NaN;
      const b = samples[i] ?? NaN;
      if (Number.isNaN(a) || Number.isNaN(b) || inGap(i) || inGap(i - 1)) {
        continue;
      }
      ctx.strokeStyle = lagColor(Math.max(a, b));
      ctx.beginPath();
      ctx.moveTo(i - 1, y(a));
      ctx.lineTo(i, y(b));
      ctx.stroke();
    }

    // The bright head of the trace.
    const head = samples[cursor];
    if (head !== undefined && !Number.isNaN(head)) {
      ctx.fillStyle = lagColor(head);
      ctx.beginPath();
      ctx.arc(cursor, y(head), 3.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function updateReadout() {
    let peak = 0;
    for (const lag of samples) if (lag > peak) peak = lag;
    const text = active && peak > 0 ? `peak ${Math.round(peak)} ms` : '';
    if (text !== lastReadout) {
      readout.textContent = lastReadout = text;
    }
  }

  function frame(now: number) {
    if (width > 0) {
      record(now);
      draw();
      updateReadout();
    }
    requestAnimationFrame(frame);
  }

  new ResizeObserver(resize).observe(canvas);
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    colors = readColors();
  });
  requestAnimationFrame(frame);

  return {
    beat() {
      lastBeat = performance.now();
    },
    setActive(next) {
      if (next === active) return;
      active = next;
      lastBeat = performance.now();
      canvas.parentElement?.classList.toggle('active', active);
    },
  };
}
