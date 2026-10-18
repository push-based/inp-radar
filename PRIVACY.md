# INP Radar privacy policy

_Last updated: 18 October 2026_

INP Radar is a Chrome extension by PushBased that shows how responsive the page
in the active tab is. This policy covers the extension and the data it handles.

## What it handles

While a page is open, the extension's content script observes the page's
interactions and frames:

- the type of each interaction (such as click or keydown), its timing and a CSS
  selector for the element it targeted,
- the time between the page's animation frames,
- the address of the page, so the side panel can show which page it measures.

It doesn't read which key was pressed, form values or page text, and it doesn't
change the page.

## Where it goes

Nowhere outside your browser. The content script sends the measurements only to
the extension's own side panel. The extension makes no network requests, has no
accounts, and uses no analytics or tracking. The measurements are kept in memory
and are gone when the page is closed or reloaded. Nothing is written to storage.

The side panel links to push-based.io. Following that link is an ordinary visit
to that website, under its own privacy policy.

## Sharing

The data is never sold, shared with or transferred to anyone, and it's never
used for anything other than showing the measurements in the side panel.

## Changes

If the extension starts handling data differently, this page will change first,
with a new date at the top.

## Contact

Questions about this policy: [team@push-based.io](mailto:team@push-based.io).
The source code is at
[github.com/push-based/inp-radar](https://github.com/push-based/inp-radar).
