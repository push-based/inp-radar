# Chrome Web Store privacy answers

The answers for the **Privacy** tab of the developer dashboard. Each text block
is pasted as is.

## Single purpose

```text
INP Radar measures how responsive the page in the active tab is and shows it in Chrome's side panel: when the page's main thread is blocked, the page's INP (Interaction to Next Paint) with its breakdown into input delay, processing and presentation, and a log of slow interactions. Everything it does serves that one measurement.
```

## Permission justifications

**sidePanel**

```text
The extension's whole interface is a side panel. It sits next to the page it measures, and because it renders in its own process, it keeps animating while the page's main thread is blocked. That's what lets it show the block as it happens.
```

**Host permission** (the content script matches `<all_urls>`)

```text
The content script measures responsiveness inside the page. It observes interaction timing with the PerformanceObserver API and the web-vitals library, and sends a heartbeat on each animation frame while the side panel is open. It runs on all sites because developers use it on whichever page they are debugging, and it starts at document_start so it records every interaction from page load, since INP covers the whole page view. It reads no page text, changes nothing on the page and makes no network requests. Measurements go only to the extension's own side panel.
```

## Remote code

**No, I am not using remote code.** All code ships in the package.

## Data usage

The store counts data that's only processed on the device as handled, so this
is disclosed even though nothing leaves the browser.

Tick **User activity** and nothing else. The content script observes
interactions on the page: the event type (such as click or keydown), its timing
and a CSS selector for the target element. It doesn't read which key was
pressed, form values or page text.

Left unticked, with the reason:

- **Web history:** the panel shows the current tab's URL, but the extension
  keeps no list of visited pages.
- **Website content:** the target selector names an element (such as
  `button#cheap`), not its text or media.
- Everything else (personally identifiable, health, financial, authentication,
  personal communications, location): never touched.

Tick all three certifications:

- I do not sell or transfer user data to third parties, outside of the approved
  use cases.
- I do not use or transfer user data for purposes that are unrelated to my
  item's single purpose.
- I do not use or transfer user data to determine creditworthiness or for
  lending purposes.

## Privacy policy

```text
https://push-based.github.io/inp-radar/privacy.html
```

The page is [`PRIVACY.md`](../PRIVACY.md), published by the Pages workflow.
