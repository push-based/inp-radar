import { expect, SITE, test } from './fixtures';

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

  await page.click('#very-slow');

  // The readout is the peak lag in the current 3 s sweep.
  await expect
    .poll(async () => Number((await readout.textContent())?.match(/\d+/)?.[0]))
    .toBeGreaterThanOrEqual(600);

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
