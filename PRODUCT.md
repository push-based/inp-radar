# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **PushBased consultants** running performance audits, live client sessions and workshops. They interact with a client's page while watching responsiveness in real time, often while sharing their screen.
- **Front-end developers in general** who are debugging slow interactions on their own sites. The extension is also published publicly as a PushBased showcase.

The job in both cases: interact with a page and immediately see whether the main thread is keeping up, which interaction set the INP, and why (input delay, processing or presentation).

## Product Purpose

INP Radar is a Chrome extension (MV3, side panel) that shows, for the current tab:

- a live INP value with its attribution breakdown and target element,
- a main-thread "radar" that visibly lags when the page is blocked,
- an ECG-style heartbeat trace of time since the page's last frame,
- an event log of interactions of 16 ms or more.

Success means you can see a blocked main thread as it happens, and leave knowing which interaction to fix.

## Positioning

The panel renders in a separate process from the page, so it keeps animating while the page is blocked. Rather than freezing like the original on-page INP demo, the radar and trace draw the block itself: the wedge grows and the trace spikes for as long as frames are missing. It works on any page, not just a demo page.

## Operating Context

- Lives in Chrome's side panel next to the page under test, typically 260–500 px wide and full window height.
- Used during hands-on debugging, audits, conference talks and workshops, where it's often screen-shared or projected.
- Follows tab switches and navigations; tabs opened before install need a reload. `chrome://` pages and the Chrome Web Store can't be measured; only the top frame is measured.

## Capabilities and Constraints

- Built with WXT and vanilla TypeScript, with no UI framework. Entry points: `src/entrypoints/content.ts` (measures in the page) and `src/entrypoints/sidepanel/` (renders). The message protocol is in `src/shared/protocol.ts`.
- Metrics come from `web-vitals` (attribution build) and `PerformanceObserver('event')`. Thresholds follow Core Web Vitals: good ≤ 200 ms, needs improvement ≤ 500 ms, poor above that.
- The side panel must stay cheap to render, because it's measuring someone else's main thread. The heartbeat only runs while a panel is connected.
- Licensed Apache-2.0. Radar and panel styles are adapted from Google's INP demo (see `NOTICE`).

## Brand Commitments

- A PushBased product. The brand stays **subtle**: the PushBased design system (colors, type, spacing, radius, icons) governs the visual layer, but the panel carries no logo or "by PushBased" credit. The tool comes first; the brand shows in the details.
- Voice follows the PushBased guide: clear, confident, a knowledgeable colleague, inclusive. Instructive and neutral for documentation, helpful and empathetic for errors, brief for success states. Be concise and use active voice.
- Source of truth for the visual system: the PushBased Design Guide (https://design-guide.push-based.io), which requires a Google sign-in. Its tokens are captured in `DESIGN.md`.

## Evidence on Hand

- None in the repo: no screenshots, testimonials, usage numbers or case studies. Don't invent any.
- Credits: Phil Walton's INP demo (https://chrome.dev/inp-demo/), Apache-2.0.

## Product Principles

1. **Show the block as it happens.** Every visualization is there to make main-thread blocking visible the moment it occurs, not after the fact.
2. **Never be the bottleneck.** The panel must not add measurable cost to the page under test.
3. **Numbers you can trust at a glance.** INP, durations and ratings use Core Web Vitals thresholds and are readable from across a room.
4. **Explain, don't just score.** Show the breakdown (input delay, processing, presentation) and the target element, so the next step is obvious.

## Accessibility & Inclusion

- WCAG 2.2 AA contrast for all text and meaningful color (including rating colors and chart lines) in both light and dark themes.
