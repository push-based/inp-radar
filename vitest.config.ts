import { defineConfig } from 'vitest/config';
import { WxtVitest } from 'wxt/testing/vitest-plugin';

// WxtVitest sets up the `@/` aliases, WXT's auto-imports and a fake `browser`
// API (wxt/testing/fake-browser), as in WXT's unit testing guide.
export default defineConfig({
  plugins: [WxtVitest()],
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'jsdom',
  },
});
