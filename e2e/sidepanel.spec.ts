import { readFile } from 'node:fs/promises';

import type { Locator, Page } from '@playwright/test';
import { unzipSync } from 'fflate';

import { expect, test } from './fixtures';
import { SITE } from './test-page';

test('connects to the active tab', async ({ page, openPanel }) => {
  await page.goto(`${SITE}/connect`);
  const panel = await openPanel(page);

  await expect(panel.locator('#status')).toHaveAttribute('data-state', 'connected');
  await expect(panel.locator('#status-text')).toHaveText('inp-radar.test/connect');
  await expect(panel.locator('#inp-value')).toHaveText('–');
  await expect(panel.locator('#event-log tr')).toHaveCount(0);
});

test('reports INP and logs events for a slow interaction', async ({ page, openPanel }) => {
  await page.goto(`${SITE}/slow`);
  const panel = await openPanel(page);

  await expect(panel.locator('#status')).toHaveAttribute('data-state', 'connected');

  await page.click('#slow');

  const inp = panel.locator('#inp-box');

  await expect(inp).toHaveAttribute('data-rating', 'needs-improvement');
  await expect
    .poll(async () => Number(await panel.locator('#inp-value').textContent()))
    .toBeGreaterThanOrEqual(300);
  await expect(panel.locator('#breakdown')).toBeVisible();
  await expect(panel.locator('#inp-target')).toContainText('#slow');

  const click = panel.locator('#event-log tr', { hasText: 'click' });

  await expect(click).toHaveCount(1);
  await expect(click).toHaveAttribute('data-rating', 'needs-improvement');
  await expect(click.locator('td').first()).toHaveText('1');
});

test('INP keeps the worst interaction', async ({ page, openPanel }) => {
  await page.goto(`${SITE}/worst`);
  const panel = await openPanel(page);

  await expect(panel.locator('#status')).toHaveAttribute('data-state', 'connected');

  await page.click('#very-slow');
  await expect(panel.locator('#inp-box')).toHaveAttribute('data-rating', 'poor');

  await page.click('#slow');

  const clicks = panel.locator('#event-log tr', { hasText: 'click' });

  // Newest first: the second interaction is on top, and was the faster one.
  await expect(clicks).toHaveCount(2);
  await expect(clicks.first()).toHaveAttribute('data-rating', 'needs-improvement');
  await expect(panel.locator('#inp-box')).toHaveAttribute('data-rating', 'poor');
  await expect(panel.locator('#inp-target')).toContainText('#very-slow');
  expect(Number(await panel.locator('#inp-value').textContent())).toBeGreaterThanOrEqual(600);
});

test('the heartbeat shows how long the page was blocked', async ({ page, openPanel }) => {
  await page.goto(`${SITE}/heartbeat`);
  const panel = await openPanel(page);
  const readout = panel.locator('#pulse-readout');

  await expect(panel.locator('#clock')).toContainClass('active');
  await expect(readout).toHaveText(/^peak \d+ ms$/);

  await page.click('#frozen');

  // The readout is the peak lag in the current 3 s sweep. The panel samples
  // it on its own frames, which can be several hundred ms apart when the
  // machine is busy, so the block is long and the bar is well below it.
  await expect
    .poll(async () => Number((await readout.textContent())?.match(/\d+/)?.[0]))
    .toBeGreaterThanOrEqual(1000);

  // Once beats resume the radar wedge catches up and turns green again.
  // Without beats the lag would only keep growing.
  await expect(panel.locator('#clock')).toHaveAttribute('style', /var\(--good\)\)/);
});

test('follows tab switches', async ({ context, page, openPanel }) => {
  await page.goto(`${SITE}/first`);
  const panel = await openPanel(page);

  await page.click('#slow');
  await expect(panel.locator('#event-log tr', { hasText: 'click' })).toHaveCount(1);

  const other = await context.newPage();

  await other.goto(`${SITE}/other`);
  await other.bringToFront();
  await expect(panel.locator('#status-text')).toHaveText('inp-radar.test/other');
  await expect(panel.locator('#status')).toHaveAttribute('data-state', 'connected');
  await expect(panel.locator('#event-log tr')).toHaveCount(0);

  // Switching back restores the first tab's history from its buffer.
  await page.bringToFront();
  await expect(panel.locator('#status-text')).toHaveText('inp-radar.test/first');
  await expect(panel.locator('#event-log tr', { hasText: 'click' })).toHaveCount(1);
  await expect(panel.locator('#inp-box')).toHaveAttribute('data-rating', 'needs-improvement');
});

test('a panel opened late catches up on earlier interactions', async ({ page, openPanel }) => {
  await page.goto(`${SITE}/late`);
  await page.click('#slow');
  await expect(page.locator('#slow')).toHaveText('Slow ✓');

  const panel = await openPanel(page);

  await expect(panel.locator('#status')).toHaveAttribute('data-state', 'connected');
  await expect(panel.locator('#inp-box')).toHaveAttribute('data-rating', 'needs-improvement');
  await expect(panel.locator('#event-log tr', { hasText: 'click' })).toHaveCount(1);
});

test('follows the tab when it navigates', async ({ page, openPanel }) => {
  await page.goto(`${SITE}/first`);
  const panel = await openPanel(page);

  await page.click('#slow');
  await expect(panel.locator('#event-log tr', { hasText: 'click' })).toHaveCount(1);

  await page.goto(`${SITE}/second`);

  await expect(panel.locator('#status-text')).toHaveText('inp-radar.test/second');
  await expect(panel.locator('#status')).toHaveAttribute('data-state', 'connected');
  await expect(panel.locator('#inp-value')).toHaveText('–');
  await expect(panel.locator('#event-log tr')).toHaveCount(0);
});

test('says when a page cannot be measured', async ({ page, openPanel }) => {
  await page.goto('chrome://version');
  const panel = await openPanel(page);

  await expect(panel.locator('#status')).toHaveAttribute('data-state', 'unreachable', {
    timeout: 10_000,
  });
  await expect(panel.locator('#reload')).toBeVisible();
});

/** Waits for the one download Stop produces and returns its name and zip entries. */
async function stopAndUnzip(panel: Page, record: Locator) {
  const download = panel.waitForEvent('download');

  await record.click();

  const file = await download;
  const entries = unzipSync(await readFile((await file.path()) ?? ''));

  await expect(record).toHaveText('Record');

  return { name: file.suggestedFilename(), entries };
}

test('records the tab and the panel into one zip', async ({ page, openPanel }) => {
  await page.goto(`${SITE}/connect`);
  const panel = await openPanel(page);
  const record = panel.locator('#record');

  await expect(panel.locator('#status')).toHaveAttribute('data-state', 'connected');
  await record.click();
  await expect(record).toHaveAttribute('data-recording', 'true');
  await page.waitForTimeout(1000);

  const { name, entries } = await stopAndUnzip(panel, record);

  expect(name).toMatch(/^inp-radar-inp-radar\.test-[\dT-]+\.zip$/);
  expect(Object.keys(entries)).toEqual(['page.mp4', 'panel.mp4']);

  for (const video of Object.values(entries)) {
    // An MP4 starts with an "ftyp" box.
    expect(new TextDecoder().decode(video.subarray(4, 8))).toBe('ftyp');
  }
});

test('closing the panel mid-recording stops it, so the next recording works', async ({
  page,
  openPanel,
}) => {
  await page.goto(`${SITE}/connect`);
  const first = await openPanel(page);

  await expect(first.locator('#status')).toHaveAttribute('data-state', 'connected');
  await first.locator('#record').click();
  await expect(first.locator('#record')).toHaveAttribute('data-recording', 'true');
  await first.close();

  const panel = await openPanel(page);
  const record = panel.locator('#record');

  // The background script detached when the closed panel's port dropped, so
  // the extension can attach to the tab again. (Chrome's own `attached` flag
  // can't tell: Playwright keeps its own debugger attached to every page.)
  await expect
    .poll(() =>
      panel.evaluate(`(async () => {
        const target = (await chrome.debugger.getTargets()).find((t) => t.url.startsWith('${SITE}'));
        try {
          await chrome.debugger.attach({ tabId: target.tabId }, '1.3');
          await chrome.debugger.detach({ tabId: target.tabId });
          return 'free';
        } catch (error) {
          return error.message;
        }
      })()`),
    )
    .toBe('free');
  await expect(panel.locator('#status')).toHaveAttribute('data-state', 'connected');
  await record.click();
  await expect(record).toHaveAttribute('data-recording', 'true');
  await page.waitForTimeout(500);

  const { entries } = await stopAndUnzip(panel, record);

  expect(Object.keys(entries)).toEqual(['page.mp4', 'panel.mp4']);
  await expect(panel.locator('#record-message')).toBeHidden();
});

test('records the whole window into one zip', async ({ page, openPanel }) => {
  await page.goto(`${SITE}/connect`);
  const panel = await openPanel(page);
  const record = panel.locator('#record');

  await expect(panel.locator('#status')).toHaveAttribute('data-state', 'connected');
  await panel.locator('#record-mode').selectOption('window');
  await record.click();
  await expect(record).toHaveAttribute('data-recording', 'true');
  await expect(panel.locator('#record-mode')).toBeDisabled();
  await page.waitForTimeout(1000);

  const { name, entries } = await stopAndUnzip(panel, record);

  expect(name).toMatch(/^inp-radar-inp-radar\.test-[\dT-]+\.zip$/);
  expect(Object.keys(entries)).toEqual([expect.stringMatching(/^window\.(webm|mp4)$/)]);

  await panel.reload();
  await expect(panel.locator('#record-mode')).toHaveValue('window');
});

test('closing the recorded tab still saves the panel video', async ({ page, openPanel }) => {
  await page.goto(`${SITE}/connect`);
  const panel = await openPanel(page);
  const record = panel.locator('#record');

  await expect(panel.locator('#status')).toHaveAttribute('data-state', 'connected');
  await record.click();
  await expect(record).toHaveAttribute('data-recording', 'true');
  await page.waitForTimeout(500);

  const download = panel.waitForEvent('download');

  await page.close();

  const entries = unzipSync(await readFile((await (await download).path()) ?? ''));

  expect(Object.keys(entries)).toEqual(['panel.mp4']);
  await expect(panel.locator('#record-message')).toHaveText(
    "The recorded tab was closed or can't be recorded any more, so only the panel video was saved.",
  );
  await expect(record).toHaveText('Record');
});
