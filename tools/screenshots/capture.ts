/**
 * Renders the README screenshots of the side panel: a still and a short
 * animation, in light and dark. Uses the same setup as the e2e tests (the
 * built extension in Playwright's Chromium, sidepanel.html in a tab beside the
 * test page) and plays the same interactions every time.
 *
 * Run with `pnpm screenshots`. Joining the GIFs needs Python 3 with Pillow.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { chromium, type Page } from '@playwright/test';

import { PAGE, SITE } from '../../e2e/test-page.ts';
import { SPEED as SWEEP } from '../../src/entrypoints/sidepanel/meter.ts';

const ROOT = path.resolve(import.meta.dirname, '../..');
const EXTENSION_PATH = path.join(ROOT, '.output/chrome-mv3');
const OUT = path.join(ROOT, 'docs/screenshots');

// Wide enough for the two-column layout (25rem), about as wide as Chrome
// opens the side panel.
const VIEWPORT = { width: 400, height: 860 };

// When each button is clicked, in ms after the sweep starts. The blocks
// (300, 600, 1500 ms) all fit in one sweep, so the heartbeat shows three
// spikes side by side.
const SCRIPT = [
  { at: 150, button: '#slow' },
  { at: 800, button: '#very-slow' },
  { at: 1750, button: '#frozen' },
];

// The still is taken 1.1 s into the frozen block: the wedge is red and the
// last spike is still climbing.
const STILL_AT = 2850;

// The animation runs until the wedge has caught up after the frozen block,
// then holds the last frame before it loops.
const ANIMATION_LENGTH = 5000;
const FINAL_HOLD = 1500;

const FRAME_INTERVAL = 80;

if (!existsSync(path.join(EXTENSION_PATH, 'manifest.json'))) {
  throw new Error(`No extension build in ${EXTENSION_PATH}. Run \`pnpm build\` first.`);
}

for (const scheme of ['light', 'dark'] as const) {
  await capture(scheme, 'still');
  await capture(scheme, 'animation');
}

async function capture(scheme: 'light' | 'dark', kind: 'still' | 'animation') {
  const context = await chromium.launchPersistentContext('', {
    channel: 'chromium',
    colorScheme: scheme,
    deviceScaleFactor: 2,
    viewport: VIEWPORT,
    args: [`--disable-extensions-except=${EXTENSION_PATH}`, `--load-extension=${EXTENSION_PATH}`],
  });

  await context.route(`${SITE}/**`, (route) =>
    route.fulfill({ contentType: 'text/html', body: PAGE }),
  );

  const worker = context.serviceWorkers()[0] ?? (await context.waitForEvent('serviceworker'));
  const site = context.pages()[0] ?? (await context.newPage());

  await site.goto(`${SITE}/checkout`);

  // As in e2e/fixtures.ts: the panel follows the active tab, so it connects
  // to `site` once that's brought back to the front.
  const panel = await context.newPage();

  await panel.goto(`chrome-extension://${new URL(worker.url()).host}/sidepanel.html`);
  await site.bringToFront();
  await panel.locator('#status[data-state="connected"]').waitFor();

  // Clicking by position skips Playwright's actionability checks, which wait
  // on the page and would shift the timing.
  const targets = await Promise.all(
    SCRIPT.map(async ({ at, button }) => {
      const box = await site.locator(button).boundingBox();

      if (!box) throw new Error(`${button} is not on the page`);

      return { at, x: box.x + box.width / 2, y: box.y + box.height / 2 };
    }),
  );

  // Started early, so its setup doesn't land in the middle of the sweep.
  const screencast = kind === 'animation' ? await startScreencast(panel) : undefined;

  // Let a full clean sweep draw a flat line first, then start at the top.
  await panel.waitForTimeout(SWEEP);

  const start = await nextSweep(panel);

  const clicks = targets.map(async ({ at, x, y }) => {
    await waitUntil(start + at);
    await site.mouse.click(x, y);
  });

  if (screencast) {
    await waitUntil(start + ANIMATION_LENGTH);
    writeGif(await screencast.stop(), start, path.join(OUT, `sidepanel-${scheme}.gif`));
  } else {
    await waitUntil(start + STILL_AT);
    await panel.screenshot({ path: path.join(OUT, `sidepanel-${scheme}.png`) });
  }

  await Promise.all(clicks);
  await context.close();
}

/** Waits for the panel's sweep to wrap, and returns that moment in local time. */
async function nextSweep(panel: Page) {
  const untilWrap = await panel.evaluate((sweep) => sweep - (performance.now() % sweep), SWEEP);
  const start = Date.now() + Math.round(untilWrap);

  await waitUntil(start);

  return start;
}

async function waitUntil(time: number) {
  const delay = time - Date.now();

  if (delay > 0) await new Promise((resolve) => setTimeout(resolve, delay));
}

interface Frame {
  /** Epoch ms. */
  time: number;
  /** Base64 PNG. */
  data: string;
}

/**
 * Records the panel with a CDP screencast. Unlike a screenshot per frame it
 * doesn't stall rendering, which would show up as blips in the heartbeat.
 */
async function startScreencast(panel: Page) {
  const cdp = await panel.context().newCDPSession(panel);
  const frames: Frame[] = [];

  cdp.on('Page.screencastFrame', ({ data, metadata, sessionId }) => {
    frames.push({ time: (metadata.timestamp ?? Date.now() / 1000) * 1000, data });
    void cdp.send('Page.screencastFrameAck', { sessionId });
  });

  // Headless Chromium sends frames in CSS pixels, so the GIF is half the
  // resolution of the stills. That keeps it small, too.
  await cdp.send('Page.startScreencast', { format: 'png' });

  return {
    async stop() {
      await cdp.send('Page.stopScreencast');
      await cdp.detach();

      return frames;
    },
  };
}

/** Joins the frames between `start` and the end of the animation into a GIF. */
function writeGif(frames: Frame[], start: number, file: string) {
  const end = start + ANIMATION_LENGTH;
  const dir = mkdtempSync(path.join(tmpdir(), 'inp-radar-frames-'));
  const times: number[] = [];

  try {
    // Keep a frame every FRAME_INTERVAL or so; each shows until the next one.
    for (const frame of frames) {
      const last = times.at(-1);

      if (frame.time < start || frame.time > end) continue;

      if (last !== undefined && frame.time - last < FRAME_INTERVAL) continue;

      times.push(frame.time);
      writeFileSync(
        path.join(dir, `${String(times.length).padStart(4, '0')}.png`),
        Buffer.from(frame.data, 'base64'),
      );
    }

    const durations = times.map((time, i) => Math.round((times[i + 1] ?? end + FINAL_HOLD) - time));

    execFileSync('python3', [
      path.join(import.meta.dirname, 'frames-to-gif.py'),
      dir,
      file,
      durations.join(','),
    ]);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
