# Chrome Web Store listing

The text for the **Store listing** tab of the developer dashboard. The images
next to this file come from `pnpm store-images`.

## Summary

The store shows the `description` from the manifest (`wxt.config.ts`) as the
summary, so it ships with the zip:

> Live INP value, main-thread radar and event log for the current page, in a
> side panel.

## Category and language

- **Category:** Developer Tools
- **Language:** English

## Detailed description

The dashboard takes plain text, so this block is pasted as is.

```text
INP Radar shows when a page's main thread is blocked, live, in Chrome's side panel.

A click can get a poor INP without doing anything slow itself. If a timer or a tracking script is blocking the main thread when the click lands, the click has to wait, and that wait counts as input delay. A single test click usually misses those blocks, so the problem is easy to overlook.

Open any page and watch:
• Radar and heartbeat trace: background work shows up as spikes, often on a steady beat.
• INP breakdown: input delay, processing and presentation, with the target element.
• Event log: every interaction of 16 ms or more.

Use it to time a DevTools trace: record across a spike to find the blocking work, or wait until the page is idle, then click to measure the interaction on its own.

Try it on the demo page: https://push-based.github.io/inp-radar/demo/

The radar comes from Phil Walton's INP demo (https://chrome.dev/inp-demo/), which built on earlier work by Monica Dinculescu and Dan Abramov.

Nothing leaves your browser. Open source: https://github.com/push-based/inp-radar
```
