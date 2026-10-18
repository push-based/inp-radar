# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **PushBased consultants** running performance audits, live client sessions and workshops. They interact with a client's page while watching responsiveness in real time, often while sharing their screen.
- **Front-end developers in general** who are debugging slow interactions on their own sites. The extension is also published publicly as a PushBased showcase.

The job in both cases: find out why interactions on a page are slow. There are two usual causes. Either the interaction itself is expensive, or the main thread is already blocked by background work (recurring timers, tracking scripts) when the user clicks. Users know what INP is, but most tools only show them the first cause.

## Product Purpose

INP Radar is a Chrome extension (MV3, side panel) that shows when a page's main thread is blocked, live, while you watch or use the page. For the current tab it shows:

- a main-thread "radar" that visibly lags when the page is blocked,
- an ECG-style heartbeat trace of time since the page's last frame,
- a live INP value with its breakdown (input delay, processing, presentation) and target element,
- an event log of interactions of 16 ms or more.

The radar and trace reveal background blocks before anyone clicks: a recurring timer shows up as spikes at a steady interval. The breakdown tells the two causes apart. High input delay means the click waited behind other work. High processing or presentation means the interaction itself is expensive.

Success means you know when to record a Chrome DevTools Performance trace. Either record across a block to find the background work, or wait for the main thread to go idle and then interact, so the trace shows only the interaction's own cost.

## Positioning

Most INP tooling starts from an interaction: you click, then measure. That misses the case where the click is cheap but lands while background work has the main thread blocked. INP Radar shows those blocks without any interaction, on any live page.

The panel renders in a separate process from the page, so it keeps animating while the page is blocked. The original on-page INP demo freezes. Here the radar and trace draw the block itself: the wedge grows and the trace spikes for as long as frames are missing.

## Operating Context

- Lives in Chrome's side panel next to the page under test, typically 260–500 px wide and full window height.
- Used during hands-on debugging, audits, conference talks and workshops, where it's often screen-shared or projected.
- Used alongside the Chrome DevTools Performance panel. INP Radar shows when to record and when to click; the trace shows what ran.
- Follows tab switches and navigations; tabs opened before install need a reload. `chrome://` pages and the Chrome Web Store can't be measured; only the top frame is measured.

## Capabilities and Constraints

- Built with WXT and vanilla TypeScript, with no UI framework. Entry points: `src/entrypoints/content.ts` (measures in the page) and `src/entrypoints/sidepanel/` (renders). The message protocol is in `src/shared/protocol.ts`.
- Metrics come from `web-vitals` (attribution build) and `PerformanceObserver('event')`. Thresholds follow Core Web Vitals: good ≤ 200 ms, needs improvement ≤ 500 ms, poor above that. The heartbeat trace also marks 50 ms, the long-task threshold.
- The panel shows when the main thread is blocked, not which script blocked it. Script attribution using the Long Animation Frames API is planned; until then, the DevTools trace finds the culprit.
- The side panel must stay cheap to render, because it's measuring someone else's main thread. The heartbeat only runs while a panel is connected.
- Licensed Apache-2.0. Radar and panel styles are adapted from Google's INP demo (see `NOTICE`).

## Brand Commitments

- A PushBased product. The brand stays **subtle**: the PushBased design system (colors, type, spacing, radius, icons) governs the visual layer, but the panel carries no logo or "by PushBased" credit. The tool comes first; the brand shows in the details.
- Voice follows the PushBased guide: clear, confident, a knowledgeable colleague, inclusive. Instructive and neutral for documentation, helpful and empathetic for errors, brief for success states. Be concise and use active voice.
- Terminology follows web.dev and Chrome's documentation, so readers can search for it: the main thread is **blocked** (not "hotspot"), by **long tasks** or **long animation frames**, often from **recurring timers** or other **background work**; the cost to a click is **input delay**; a quiet main thread is **idle**.
- Source of truth for the visual system: the PushBased Design Guide (https://design-guide.push-based.io), which requires a Google sign-in. Its tokens are captured in `DESIGN.md`.

## Evidence on Hand

- None in the repo: no screenshots, testimonials, usage numbers or case studies. Don't invent any.
- Planned: a demo page that reproduces both causes (a recurring timer doing heavy work, and an expensive click handler). It will be the worked example in the docs.
- Credits: Phil Walton's INP demo (https://chrome.dev/inp-demo/), Apache-2.0.

## Product Principles

1. **Show the block as it happens.** Every visualization is there to make main-thread blocking visible the moment it occurs, not after the fact, and whether or not anyone is interacting.
2. **Never be the bottleneck.** The panel must not add measurable cost to the page under test.
3. **Numbers you can trust at a glance.** INP, durations and ratings use Core Web Vitals thresholds and are readable from across a room.
4. **Explain, don't just score.** Show the breakdown (input delay, processing, presentation) and the target element, so it's clear which cause you're looking at and what to trace next.

## Accessibility & Inclusion

- WCAG 2.2 AA contrast for all text and meaningful color (including rating colors and chart lines) in both light and dark themes.
