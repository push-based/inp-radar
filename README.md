<h1>
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="design/logo/logo-dark.svg">
    <img src="design/logo/logo.svg" alt="INP Radar" height="56">
  </picture>
</h1>

A Chrome extension that shows a live INP value, a main-thread "radar", an
ECG-style heartbeat trace and an event log for the current tab, in a side panel
that stays open while you interact with the page. Inspired by Phil Walton's
[INP demo](https://chrome.dev/inp-demo/)
([source](https://github.com/GoogleChromeLabs/web-perf-demos/tree/main/inp-demo)).

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="docs/screenshots/sidepanel-dark.png">
    <img src="docs/screenshots/sidepanel-light.png" alt="The INP Radar side panel during a 1.5 s main-thread block: INP of 600 ms with its breakdown, a red radar wedge, three spikes on the heartbeat trace and the event log" width="400">
  </picture>
</p>

Built with [WXT](https://wxt.dev) and vanilla TypeScript.

## Development

```bash
pnpm install
pnpm dev        # launches Chrome with the extension loaded, hot reloading
pnpm build      # production build in .output/chrome-mv3
pnpm compile    # type-check
pnpm test       # unit tests (Vitest); `pnpm test:watch` to re-run on change
pnpm e2e        # build, then run the Playwright end-to-end tests
pnpm screenshots # build, then re-render the README screenshots
```

Unit tests sit next to the code as `*.test.ts` and run in jsdom with WXT's
Vitest plugin, which provides the `@/` aliases and a fake `browser` API.

The end-to-end tests in `e2e/` load the built extension into Playwright's
Chromium (run `pnpm exec playwright install chromium` once). The side panel
can't be opened from a test, so they load `sidepanel.html` in a tab and then
switch to the test page, which the panel follows as it would the active tab.

The screenshots in `docs/screenshots/` come from `tools/screenshots/capture.ts`,
which uses the same setup and clicks the test page on a fixed schedule. Joining
the GIF frames needs Python 3 with Pillow.

To load a build manually, open `chrome://extensions`, enable Developer mode,
click **Load unpacked** and pick `.output/chrome-mv3`. Click the toolbar icon to
open the side panel.

## How it works

```
┌──────────── page tab ─────────────┐        ┌──── side panel ────┐
│ content script (page main thread) │  port  │ sidepanel/         │
│  • PerformanceObserver('event')   │ ─────▶ │  • INP + breakdown │
│  • onINP (web-vitals/attribution) │        │  • radar + pulse   │
│  • rAF heartbeat                  │        │  • event log       │
└───────────────────────────────────┘        └────────────────────┘
```

- `src/entrypoints/content.ts` measures inside the page. It buffers INP and
  event entries so a panel opened late still shows history, and only runs the
  heartbeat while a panel is connected.
- `src/entrypoints/sidepanel/` connects to the active tab with `tabs.connect`,
  follows tab switches and navigations, and renders.
- `src/shared/protocol.ts` defines the messages between the two.

### The radar

In the original demo the radar animates on the page's main thread, so it
freezes when the page is blocked. The side panel runs in a different process,
so it would never freeze. Instead, the content script sends a heartbeat on every
page animation frame. The panel spins the sweep on its own clock and draws the
wedge as the time since the last heartbeat. When the page is blocked the wedge
grows, turning amber past 200 ms and red past 500 ms (the INP thresholds), then
catches up once frames resume.

### The heartbeat trace

`sidepanel/pulse.ts` draws the same signal as an ECG-style strip on a canvas,
sweeping left to right in sync with the radar. Each column plots the time since
the page's last frame on a square-root scale, with reference lines at 50, 200
and 500 ms. A healthy page draws a flat green line. A block draws a spike that
climbs for as long as it lasts and drops when frames resume, so you can compare
several blocks side by side. The readout shows the peak in the current sweep.

Here the page blocks its main thread for 300, 600 and 1500 ms on three clicks:

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="docs/screenshots/sidepanel-dark.gif">
    <img src="docs/screenshots/sidepanel-light.gif" alt="Animation of the side panel as three clicks block the page: the radar wedge grows and turns red, the heartbeat spikes and INP rises to 1504 ms" width="400">
  </picture>
</p>

## Limitations

- Tabs that were open before the extension was installed need a reload.
- `chrome://` pages and the Chrome Web Store can't be measured.
- Only the top frame is measured.
- The event log only lists events of 16 ms or more (the Event Timing minimum).

## License

[Apache-2.0](LICENSE). The radar and side panel styles are adapted from
Google's INP demo, also Apache-2.0. See [NOTICE](NOTICE).
