import { defineConfig } from 'wxt';

// See https://wxt.dev/api/config.html
export default defineConfig({
  srcDir: 'src',
  manifest: {
    name: 'INP Radar',
    description:
      'Live INP value, main-thread radar and event log for the current page, in a side panel.',
    homepage_url: 'https://github.com/push-based/inp-radar',
    // chrome.sidePanel shipped in Chrome 114.
    minimum_chrome_version: '114',
    permissions: ['sidePanel'],
    action: {
      default_title: 'Open INP Radar',
    },
  },
});
