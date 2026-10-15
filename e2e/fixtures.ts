import { existsSync } from 'node:fs';
import path from 'node:path';

import { chromium, test as base, type BrowserContext, type Page } from '@playwright/test';

const EXTENSION_PATH = path.resolve(import.meta.dirname, '../.output/chrome-mv3');

/** Origin the test pages are served from. Requests to it never leave Playwright. */
export const SITE = 'http://inp-radar.test';

/**
 * A page with buttons that block the main thread for a given time on click,
 * so interactions have a predictable duration.
 */
const PAGE = `<!doctype html>
<html lang="en">
  <head><meta charset="utf-8" /><title>INP Radar test page</title></head>
  <body>
    <button id="slow" data-block="300">Slow</button>
    <button id="very-slow" data-block="600">Very slow</button>
    <button id="frozen" data-block="1500">Frozen</button>
    <script>
      for (const button of document.querySelectorAll('[data-block]')) {
        button.addEventListener('click', () => {
          const end = performance.now() + Number(button.dataset.block);
          while (performance.now() < end) {}
          button.textContent += ' ✓';
        });
      }
    </script>
  </body>
</html>`;

interface Fixtures {
  context: BrowserContext;
  extensionId: string;
  /** Opens the side panel UI as a tab and points it at `site`. */
  openPanel: (site: Page) => Promise<Page>;
}

export const test = base.extend<Fixtures>({
  // Extensions need a persistent context and full Chromium (not the headless
  // shell), which still runs headless with `channel: 'chromium'`.
  // Playwright reads fixture dependencies from this pattern, so it must exist.
  // oxlint-disable-next-line no-empty-pattern
  context: async ({}, use) => {
    if (!existsSync(path.join(EXTENSION_PATH, 'manifest.json'))) {
      throw new Error(`No extension build in ${EXTENSION_PATH}. Run \`pnpm build\` first.`);
    }

    const context = await chromium.launchPersistentContext('', {
      channel: 'chromium',
      args: [`--disable-extensions-except=${EXTENSION_PATH}`, `--load-extension=${EXTENSION_PATH}`],
    });

    await context.route(`${SITE}/**`, (route) =>
      route.fulfill({ contentType: 'text/html', body: PAGE }),
    );

    await use(context);
    await context.close();
  },

  extensionId: async ({ context }, use) => {
    const worker = context.serviceWorkers()[0] ?? (await context.waitForEvent('serviceworker'));

    await use(new URL(worker.url()).host);
  },

  // The real side panel can't be opened from a test (it needs a toolbar
  // click), so this loads the same page in a tab. The panel measures the
  // active tab of its window, so activating `site` afterwards makes it
  // connect there, just like switching tabs with the panel open. Headless
  // Chromium treats background tabs as visible, so the panel keeps animating;
  // in headed runs it's throttled and the heartbeat test can't pass.
  openPanel: async ({ context, extensionId }, use) => {
    await use(async (site) => {
      const panel = await context.newPage();

      await panel.goto(`chrome-extension://${extensionId}/sidepanel.html`);
      await site.bringToFront();

      return panel;
    });
  },
});

export { expect } from '@playwright/test';
