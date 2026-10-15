import { defineConfig } from '@playwright/test';

// The tests load the production build from .output/chrome-mv3, so run
// `pnpm build` first (`pnpm e2e` does both).
export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    trace: 'retain-on-failure',
  },
});
