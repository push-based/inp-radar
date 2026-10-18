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
INP Radar shows when a page's main thread is blocked, live, in Chrome's side panel next to the page.

A click can get a poor INP (Interaction to Next Paint) without doing anything slow itself. If a recurring timer or a tracking script has the main thread blocked when the click lands, the click waits until that work is done, and the wait counts as input delay. A single test click usually lands between blocks and looks fine, so this cause is easy to miss.

Open any site, leave it alone and watch. Background work shows up as spikes, often on a regular beat. Those are the moments when a user's click would get a poor INP.

WHAT THE PANEL SHOWS

• Main-thread radar. The sweep keeps turning while the page is blocked, and the wedge grows for as long as the page renders no frames. It turns amber past 200 ms and red past 500 ms.
• Heartbeat trace. The time since the page's last frame, drawn as an ECG-style strip. A recurring timer shows up as spikes at a steady interval.
• INP and its breakdown. The interaction that set INP, split into input delay, processing and presentation, with its target element. High input delay means the click waited behind other work. High processing or presentation means the interaction itself is expensive.
• Event log. Every interaction of 16 ms or more, newest first.

USING IT WITH A DEVTOOLS TRACE

INP Radar tells you when to record a trace in the Chrome DevTools Performance panel, and when to click:

• Catch a block. Watch for the spikes, then record a trace across one. The trace shows the work that blocked the main thread.
• Wait for idle. Wait for a quiet stretch where the trace stays flat, then interact. Nothing else is running, so the trace shows the interaction's own cost.

The panel shows when the main thread is blocked, not which script blocked it. The DevTools trace is where you find the culprit.

TRY IT

Click the toolbar icon to open the side panel. It measures the active tab and follows you when you switch tabs or navigate.

The demo page reproduces both causes of a slow interaction, a recurring timer and an expensive click handler: https://push-based.github.io/inp-radar/demo/

Tabs that were open before you installed INP Radar need a reload. chrome:// pages and the Chrome Web Store can't be measured.

PRIVACY

INP Radar measures the page inside your browser and sends nothing anywhere. There are no accounts, analytics or tracking.

The radar is adapted from Phil Walton's INP demo. INP Radar is open source under the Apache 2.0 license: https://github.com/push-based/inp-radar
```
