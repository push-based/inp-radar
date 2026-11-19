import { readFile } from 'node:fs/promises';

import type { Download } from '@playwright/test';

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

test('records the tab and the panel, with subtitles for each interaction', async ({
  page,
  openPanel,
}) => {
  await page.goto(`${SITE}/connect`);
  const panel = await openPanel(page);
  const record = panel.locator('#record');

  await expect(panel.locator('#status')).toHaveAttribute('data-state', 'connected');
  await record.click();
  await expect(record).toHaveAttribute('data-recording', 'true');
  await page.waitForTimeout(500);
  await page.click('#slow');
  await expect(panel.locator('#event-log tr', { hasText: 'click' })).toHaveCount(1);

  const downloads: Download[] = [];

  panel.on('download', (download) => downloads.push(download));
  await record.click();
  await expect(record).toHaveText('Record');
  await expect.poll(() => downloads.length).toBe(3);

  const names = downloads.map((download) => download.suggestedFilename());
  const base = names[0]?.replace(/-page\.mp4$/, '');

  expect(names).toEqual([`${base}-page.mp4`, `${base}-panel.mp4`, `${base}-page.vtt`]);
  expect(base).toMatch(/^inp-radar-inp-radar\.test-/);

  const subtitles = await readFile((await downloads[2]?.path()) ?? '', 'utf8');

  expect(subtitles).toMatch(/^WEBVTT\n\n00:00:0\d\.\d{3} --> /);
  expect(subtitles).toMatch(/Worst interaction: .*click.* · \d+ ms · (needs improvement|poor)/);
});

test('records the whole window to one video, without subtitles when unticked', async ({
  page,
  openPanel,
}) => {
  await page.goto(`${SITE}/connect`);
  const panel = await openPanel(page);
  const record = panel.locator('#record');
  const subtitles = panel.getByLabel('Subtitles');

  await expect(panel.locator('#status')).toHaveAttribute('data-state', 'connected');
  await panel.locator('#record-mode').selectOption('window');
  await subtitles.uncheck();
  await record.click();
  await expect(record).toHaveAttribute('data-recording', 'true');
  await expect(panel.locator('#record-mode')).toBeDisabled();
  await expect(subtitles).toBeDisabled();
  await page.click('#slow');
  await expect(panel.locator('#event-log tr', { hasText: 'click' })).toHaveCount(1);

  const names: string[] = [];

  panel.on('download', (download) => names.push(download.suggestedFilename()));
  await record.click();
  await expect(record).toHaveText('Record');
  await expect.poll(() => names.length).toBe(1);
  await page.waitForTimeout(500);
  expect(names).toEqual([
    expect.stringMatching(/^inp-radar-inp-radar\.test-.+-window\.(mp4|webm)$/),
  ]);

  await panel.reload();
  await expect(panel.locator('#record-mode')).toHaveValue('window');
  await expect(panel.getByLabel('Subtitles')).not.toBeChecked();
});
