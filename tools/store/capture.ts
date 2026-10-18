/**
 * Renders the Chrome Web Store images into store/. The small promo tile is
 * tools/store/promo.html at 440×280. The screenshots are the demo page with
 * the side panel beside it, 1280×800, for each scene in light and dark. They
 * use the same setup as the e2e tests (the built extension in Playwright's
 * Chromium, sidepanel.html in a tab beside the page) and play the same
 * interactions every time.
 *
 * The real side panel can't be opened from a script, so the page and the
 * panel are captured separately and placed side by side, as Chrome shows them.
 *
 * Run with `pnpm store-images`.
 */
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import { chromium, type Page } from '@playwright/test';

import { SPEED as SWEEP } from '../../src/entrypoints/sidepanel/meter.ts';

const ROOT = path.resolve(import.meta.dirname, '../..');
const EXTENSION_PATH = path.join(ROOT, '.output/chrome-mv3');
const OUT = path.join(ROOT, 'store');

/** Origin the demo page is served from. Requests to it never leave Playwright. */
const SITE = 'http://inp-radar.test';
const DEMO = readFileSync(path.join(ROOT, 'demo/index.html'), 'utf8');

// The store takes screenshots at exactly 1280×800. The panel gets its
// two-column width (25rem), the page the rest, less a 1px divider.
const SIZE = { width: 1280, height: 800 };
const PANEL = { width: 400, height: SIZE.height };
const SITE_VIEWPORT = { width: SIZE.width - PANEL.width - 1, height: SIZE.height };

const DIVIDER = { light: '#E3E8EF', dark: '#202939' };

// The demo's recurring timer blocks for BLOCK ms every INTERVAL ms. It's
// restarted as the panel's sweep wraps, so every block starts at a whole
// second into the sweep and the heartbeat trace shows three spikes per sweep.
const INTERVAL = 1000;
const BLOCK = 300;

interface Scene {
  name: string;
  /** Button clicks, in ms after the timer restarts. */
  clicks: { at: number; button: string }[];
}

const SCENES: Scene[] = [
  // A cheap click 50 ms into a block: almost all of its INP is input delay.
  { name: 'blocked', clicks: [{ at: 2050, button: '#cheap' }] },
  // An expensive click while the page is idle: almost all of it is processing.
  { name: 'expensive', clicks: [{ at: 1400, button: '#expensive' }] },
];

// The page is captured while it's idle, after the clicks. The panel is
// captured 150 ms into a block, two-thirds of the way through the next sweep:
// the wedge is open, two earlier spikes are on the trace and a third is
// climbing.
const SITE_AT = 2600;
const PANEL_AT = SWEEP + 2150;

if (!existsSync(path.join(EXTENSION_PATH, 'manifest.json'))) {
  throw new Error(`No extension build in ${EXTENSION_PATH}. Run \`pnpm build\` first.`);
}

mkdirSync(OUT, { recursive: true });

await renderPromo();

for (const scene of SCENES) {
  for (const scheme of ['light', 'dark'] as const) {
    await capture(scene, scheme);
  }
}

async function renderPromo() {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 440, height: 280 } });

  await page.goto(pathToFileURL(path.join(import.meta.dirname, 'promo.html')).href);
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: path.join(OUT, 'promo-small.png') });
  await browser.close();
}

async function capture(scene: Scene, scheme: 'light' | 'dark') {
  const context = await chromium.launchPersistentContext('', {
    channel: 'chromium',
    colorScheme: scheme,
    viewport: SITE_VIEWPORT,
    args: [`--disable-extensions-except=${EXTENSION_PATH}`, `--load-extension=${EXTENSION_PATH}`],
  });

  await context.route(`${SITE}/**`, (route) =>
    route.fulfill({ contentType: 'text/html', body: DEMO }),
  );

  const worker = context.serviceWorkers()[0] ?? (await context.waitForEvent('serviceworker'));
  const site = context.pages()[0] ?? (await context.newPage());

  await site.goto(`${SITE}/demo/`);

  // As in e2e/fixtures.ts: the panel follows the active tab, so it connects
  // to `site` once that's brought back to the front.
  const panel = await context.newPage();

  await panel.setViewportSize(PANEL);
  await panel.goto(`chrome-extension://${new URL(worker.url()).host}/sidepanel.html`);
  await site.bringToFront();
  await panel.locator('#status[data-state="connected"]').waitFor();

  // Clicking by position skips Playwright's actionability checks, which wait
  // on the page and would shift the timing. The page is scrolled so the
  // buttons are in view, and stays there for the screenshot.
  const targets = [];

  for (const { at, button } of scene.clicks) {
    await site.locator(button).scrollIntoViewIfNeeded();

    const box = await site.locator(button).boundingBox();

    if (!box) throw new Error(`${button} is not on the page`);

    targets.push({ at, x: box.x + box.width / 2, y: box.y + box.height / 2 });
  }

  // Let a full clean sweep draw a flat line first, then start at the top.
  await panel.waitForTimeout(SWEEP);
  await nextSweep(panel);

  const start = await restartTimer(site);

  const clicks = targets.map(async ({ at, x, y }) => {
    await waitUntil(start + at);
    await site.mouse.click(x, y);
  });

  await waitUntil(start + SITE_AT);

  const page = await site.screenshot();

  await waitUntil(start + PANEL_AT);

  const side = await panel.screenshot();

  await Promise.all(clicks);
  await compose(panel, page, side, scheme, path.join(OUT, `${scene.name}-${scheme}.png`));
  await context.close();
}

/** Waits for the panel's sweep to wrap. */
async function nextSweep(panel: Page) {
  const untilWrap = await panel.evaluate((sweep) => sweep - (performance.now() % sweep), SWEEP);

  await waitUntil(Date.now() + Math.round(untilWrap));
}

/**
 * Sets the demo's timer to INTERVAL and BLOCK, which restarts it, and returns
 * when that happened in local time. The first block starts INTERVAL ms later.
 * The inputs are set from script, not typed into: a click elsewhere would blur
 * a focused input, and its change event would restart the timer again.
 */
async function restartTimer(site: Page) {
  return site.evaluate(
    ([block, interval]) => {
      const blockInput = document.querySelector<HTMLInputElement>('#block-ms');
      const intervalInput = document.querySelector<HTMLInputElement>('#interval-ms');

      if (!blockInput || !intervalInput) throw new Error('The timer settings are not on the page');

      blockInput.value = String(block);
      intervalInput.value = String(interval);
      intervalInput.dispatchEvent(new Event('change'));

      return Date.now();
    },
    [BLOCK, INTERVAL],
  );
}

async function waitUntil(time: number) {
  const delay = time - Date.now();

  if (delay > 0) await new Promise((resolve) => setTimeout(resolve, delay));
}

/** Places the page and the panel side by side, as Chrome shows them. */
async function compose(
  tab: Page,
  page: Buffer,
  side: Buffer,
  scheme: 'light' | 'dark',
  file: string,
) {
  const src = (png: Buffer) => `data:image/png;base64,${png.toString('base64')}`;

  await tab.setViewportSize(SIZE);
  await tab.setContent(`<!doctype html>
    <body style="margin: 0; display: flex; background: ${DIVIDER[scheme]}">
      <img src="${src(page)}" style="display: block; margin-right: 1px" />
      <img src="${src(side)}" style="display: block" />
    </body>`);
  await tab.screenshot({ path: file });
}
