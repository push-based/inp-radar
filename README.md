# INP Radar

A Chrome extension that shows a live INP value, a main-thread "radar" and an
event log for the current tab, in a side panel that stays open while you
interact with the page. Inspired by Phil Walton's
[INP demo](https://chrome.dev/inp-demo/)
([source](https://github.com/GoogleChromeLabs/web-perf-demos/tree/main/inp-demo)).

Built with [WXT](https://wxt.dev) and vanilla TypeScript.

## Development

```bash
pnpm install
pnpm dev        # launches Chrome with the extension loaded, hot reloading
pnpm build      # production build in .output/chrome-mv3
pnpm compile    # type-check
```

To load a build manually, open `chrome://extensions`, enable Developer mode,
click **Load unpacked** and pick `.output/chrome-mv3`. Click the toolbar icon to
open the side panel.

## How it works

```
┌──────────── page tab ─────────────┐        ┌──── side panel ────┐
│ content script (page main thread) │  port  │ sidepanel/         │
│  • PerformanceObserver('event')   │ ─────▶ │  • INP + breakdown │
│  • onINP (web-vitals/attribution) │        │  • radar           │
│  • rAF heartbeat                  │        │  • event log       │
└───────────────────────────────────┘        └────────────────────┘
```

- `entrypoints/content.ts` measures inside the page. It buffers INP and event
  entries so a panel opened late still shows history, and only runs the
  heartbeat while a panel is connected.
- `entrypoints/sidepanel/` connects to the active tab with `tabs.connect`,
  follows tab switches and navigations, and renders.
- `utils/protocol.ts` defines the messages between the two.

### The radar

In the original demo the radar animates on the page's main thread, so it
freezes when the page is blocked. The side panel runs in a different process,
so it would never freeze. Instead, the content script sends a heartbeat on every
page animation frame. The panel spins the sweep on its own clock and draws the
wedge as the time since the last heartbeat. When the page is blocked the wedge
grows and turns red, then catches up once frames resume.

## Limitations

- Tabs that were open before the extension was installed need a reload.
- `chrome://` pages and the Chrome Web Store can't be measured.
- Only the top frame is measured.
- The event log only lists events of 16 ms or more (the Event Timing minimum).
