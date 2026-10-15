---
name: INP Radar
description: A bench instrument for main-thread responsiveness, built on the PushBased design system.
colors:
  primary: "#7839EE"
  primary-hover: "#6927DA"
  on-primary: "#FCFCFD"
  focus: "#875BF7"
  selection: "#ECE9FE"
  background: "#FCFCFD"
  surface: "#EEF2F6"
  row-alt: "#F8FAFC"
  ink: "#121926"
  muted: "#4B5565"
  hairline: "#E3E8EF"
  grid: "#CDD5DF"
  signal-good: "#15803D"
  signal-needs-improvement: "#B45309"
  signal-poor: "#DC2626"
  breakdown-input-delay: "#C3B5FD"
  breakdown-processing: "#875BF7"
  breakdown-presentation: "#5720B7"
  primary-dark: "#C3B5FD"
  primary-hover-dark: "#DDD6FE"
  on-primary-dark: "#0D121C"
  background-dark: "#0D121C"
  surface-dark: "#121926"
  ink-dark: "#F8FAFC"
  muted-dark: "#9AA4B2"
  hairline-dark: "#202939"
  grid-dark: "#364152"
  bezel-dark: "#CDD5DF"
  signal-good-dark: "#4ADE80"
  signal-needs-improvement-dark: "#FBBF24"
  signal-poor-dark: "#F87171"
  breakdown-input-delay-dark: "#DDD6FE"
  breakdown-processing-dark: "#A48AFB"
  breakdown-presentation-dark: "#7839EE"
typography:
  readout:
    fontFamily: "Geist Mono, ui-monospace, monospace"
    fontSize: "3rem"
    fontWeight: 500
    lineHeight: 1
    letterSpacing: "-0.04em"
    fontFeature: "tnum"
  title:
    fontFamily: "Geist Mono, ui-monospace, monospace"
    fontSize: "0.875rem"
    fontWeight: 600
    lineHeight: "1.25rem"
  body:
    fontFamily: "Geist, system-ui, -apple-system, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: "1.25rem"
  label:
    fontFamily: "Geist, system-ui, -apple-system, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 400
    lineHeight: "1rem"
  data:
    fontFamily: "Geist Mono, ui-monospace, monospace"
    fontSize: "0.75rem"
    fontWeight: 400
    lineHeight: "1rem"
    fontFeature: "tnum"
rounded:
  sm: "0.125rem"
  md: "0.375rem"
  lg: "0.5rem"
  xl: "0.75rem"
  full: "9999px"
spacing:
  "1": "0.25rem"
  "2": "0.5rem"
  "3": "0.75rem"
  "4": "1rem"
  "5": "1.25rem"
  "6": "1.5rem"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    typography: "{typography.body}"
    rounded: "{rounded.md}"
    padding: "0.25rem 0.75rem"
  button-primary-hover:
    backgroundColor: "{colors.primary-hover}"
    textColor: "{colors.on-primary}"
  instrument-panel:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.xl}"
    padding: "1.25rem 1rem"
  instrument-screen:
    backgroundColor: "{colors.background}"
    rounded: "{rounded.lg}"
    padding: "0.25rem"
  event-row:
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    padding: "0.25rem 0.5rem"
  event-row-alt:
    backgroundColor: "{colors.row-alt}"
---

# Design System: INP Radar

## Overview

**Creative North Star: "The Bench Instrument"**

INP Radar should feel like a precision instrument on a workbench, an oscilloscope next to the device under test. The chassis is calm and neutral: tonal grey panels, no shadows, no decoration. Color is a signal, not styling. Green, amber and red appear only when the page's main thread gives them a reason, and they follow the Core Web Vitals thresholds (≤ 200 ms good, ≤ 500 ms needs improvement, above that poor) wherever they appear: the INP readout, the radar wedge, the heartbeat trace and the event log.

The visual layer is the PushBased design system (https://design-guide.push-based.io), applied quietly. Geist carries the interface and Geist Mono carries every measured number, so readouts line up and read as data. PushBased violet is the brand's single voice. It's used for the one action and for the INP breakdown, which is explanation rather than verdict, so it never competes with the rating colors. Beyond the details, the only explicit branding is a quiet maker's credit at the foot of the panel.

The panel runs in a narrow (260–500 px) side panel next to the page under test, often screen-shared in audits and talks. Density is moderate: big enough to read from across a room, compact enough to keep the event log in view.

**Key Characteristics:**

- Neutral tonal chassis; depth comes from surface steps, never shadows.
- Signal colors are reserved for performance ratings, at the CWV thresholds.
- Violet for the single action and the breakdown, never for status.
- Geist Mono for measurements; Geist for language.
- Follows the system theme, light and dark, both at WCAG AA.

## Colors

A cool slate neutral chassis with one violet voice and three signal colors that mean exactly one thing each.

### Primary

- **PushBased Violet** (primary): the reload action, focus rings and text selection. In dark mode it shifts to the light violets (primary-dark), because the guide warns that mid violets burn on dark surfaces.
- **Breakdown Violets** (breakdown-input-delay → breakdown-processing → breakdown-presentation): three tonal steps of the brand violet for the INP phases. They explain the score rather than judge it, and each always sits next to a text label and value.

### Neutral

- **Bench Ink** (ink): primary text and the instrument bezels (the radar ring and heartbeat screen frame).
- **Muted Slate** (muted): qualifiers, labels, timestamps and secondary text. Holds 6.7:1 on the chassis surface.
- **Paper** (background): the panel background and the face of the instrument screens.
- **Chassis Grey** (surface): the instrument panels that hold the INP readout, radar and heartbeat.
- **Hairline** (hairline): the status-bar divider and table header rule.
- **Grid Line** (grid): the dashed 50/200/500 ms reference lines on the heartbeat screen, and scrollbars.

### Signal

- **Signal Green** (signal-good), **Signal Amber** (signal-needs-improvement), **Signal Red** (signal-poor): from the guide's success, warning and error scales. In light mode they're the 700/700/600 steps, so they also work as body-size text on the background. Dark mode uses the 400 steps.

### Named Rules

**The Signal Rule.** Green, amber and red mean good, needs improvement and poor, at 200 ms and 500 ms. Nothing else in the panel uses them, and no visualization invents its own color ramp.

**The One Voice Rule.** Violet marks the single action and the INP breakdown. It never marks status.

**The Reserved Pink Rule.** The PushBased secondary pink sits too close to Signal Red. It's not used in the panel, except inside the PushBased logo mark in the footer credit.

## Typography

**Body Font:** Geist (self-hosted from `@fontsource-variable/geist`, Latin subset only, then system-ui)
**Data Font:** Geist Mono (self-hosted from `@fontsource-variable/geist-mono`, Latin subset only, then ui-monospace)

**Character:** Geist is a neutral neo-grotesque that keeps the chrome quiet. Geist Mono gives every measurement fixed-width digits, so values line up and changing numbers don't jitter.

### Hierarchy

- **Readout** (Geist Mono 500, 3rem, line-height 1, -0.04em): the live INP value, colored by its rating. The only large type in the panel.
- **Title** (Geist Mono 600, 0.875rem / 1.25rem): channel titles ("INP", "Event log"), the PushBased `text-subtitle` style.
- **Body** (Geist 400, 0.875rem / 1.25rem): status text, labels, event names.
- **Label** (Geist 400, 0.75rem / 1rem): qualifiers such as "(since page load)", table headers (500), breakdown legend.
- **Data** (Geist Mono 400, 0.75rem / 1rem, tabular numbers): durations, timestamps, interaction ids, the target selector and the heartbeat peak.

### Named Rules

**The Measured-In-Mono Rule.** A number that was measured is set in Geist Mono with tabular figures. Language is set in Geist. Mono is never a "technical" costume for prose.

**The No Fake Italics Rule.** Qualifiers in `<em>` are muted and upright. Only the upright Geist faces are bundled.

## Layout

A single column at the panel's width. Under the status bar, an auto-fit grid of instrument panels (`minmax(11rem, 1fr)`, 0.75rem gap) places the INP readout and radar side by side when there's room and stacks them otherwise. The heartbeat panel always spans the full width. The event log fills the remaining height and scrolls under a sticky header. The status bar and the credit footer stay fixed; when the panel is too short for the instruments, the content between them scrolls.

Spacing uses the PushBased 4 px scale: 1rem panel padding, 0.75rem between panels, 1.5rem before the event log. The panel has a minimum width of 260 px; there are no breakpoints, because the grid's auto-fit does the work.

## Elevation & Depth

Flat. There are no shadows. Depth comes from tonal steps: background → chassis surface → instrument screen. The bezels around the radar and heartbeat screens are inset 3 px rings in Bench Ink (Bezel Grey in dark mode) that frame the readouts like hardware displays. Inactive instruments fade to 25% opacity instead of disappearing, so the layout never jumps.

**The Flat Chassis Rule.** No `box-shadow` except the inset bezel ring on instrument screens.

## Shapes

Soft but precise. Panels use `rounded.xl` (12 px), instrument screens `rounded.lg` (8 px), buttons `rounded.md` (6 px) and legend swatches `rounded.sm` (2 px). The radar, the status dot and the breakdown bar are fully round. Segments in the breakdown bar are separated by a 1 px gap rather than borders.

## Components

### Buttons

- **Shape:** gently rounded (`rounded.md`, 6 px).
- **Primary:** PushBased Violet fill, Paper text in Geist 500 at body size, 0.25rem × 0.75rem padding. Dark mode uses light violet with Bench Ink text.
- **Hover / Focus:** fill steps one shade deeper (lighter in dark mode) over 150 ms ease-out; a 2 px violet focus ring at 2 px offset.
- There's only one button today (reload an unreachable page). Keep it the only filled control in view.

### Cards / Containers (instrument panels)

- **Corner Style:** `rounded.xl` (12 px).
- **Background:** Chassis Grey (surface).
- **Shadow Strategy:** none (see Elevation & Depth).
- **Border:** none.
- **Internal Padding:** 1.25rem × 1rem; the heartbeat panel uses 1rem.

### Status bar

A single row with a hairline rule underneath. An 8 px status dot uses the signal colors: green when connected, amber while connecting or when the tab is hidden, red when unreachable. Beside it is the page URL in Muted Slate, truncated with an ellipsis.

### Radar (signature)

A 9rem circular screen with a Bench Ink bezel and hand. The sweep turns on the panel's own clock. The wedge behind the hand is the time since the page's last frame, filled with the signal color for that lag, so a block grows the wedge and moves it from green to amber to red.

### Heartbeat trace (signature)

A 7rem screen inside a full-width panel. A 2 px trace on a square-root scale, with dashed Grid Line references at 50, 200 and 500 ms labeled in 10 px Geist Mono. Each segment takes the signal color for its lag. The peak readout sits in Data type at the panel's lower right.

### Credit footer

A single centered row under a hairline rule, always pinned to the bottom of the panel: "Made with ♥ by [mark] PushBased" in Label type and Muted Slate, linking to push-based.io with UTM attribution (`utm_source=inp-radar`). The heart is violet; the logo mark keeps its brand colours (deep violet base, which switches to Bench Ink's dark-mode value, and the secondary pink accent) at 0.75rem tall. Text deepens to Bench Ink on hover. It stays muted and small so it never competes with the instruments.

### Event log table

Sticky header in Label type (Muted Slate, 500) over a hairline rule. Rows alternate background per interaction (not per row), so events from the same interaction read as a group. Durations are Data type, semibold, and only take a signal color when they need improvement or are poor; good durations stay Bench Ink.

## Logo

The mark is a radar scope centered on a click. A Paper pointer clicks the exact center of a Bench Ink screen, and the scope's sweep line and primary-400 afterglow turn around that point. Behind them are Grid Line range rings and crosshairs, inside a Bezel Grey rim. It says what the tool does: every interaction is measured from where it happened. The violet is the brand voice, not a signal color, so the mark makes no claim about a page. The wordmark is "INP Radar" in Geist 600, outlined to paths, with the cap height centered on the scope.

- `assets/logo/mark.svg` is the master mark. The same mark works on light and dark backgrounds: the dark screen stands out on light ones, and the grey rim outlines it on dark ones.
- `assets/logo/mark-32.svg` (one ring plus crosshairs) and `mark-16.svg` (no grid) are simplified for the toolbar. Their pointer is larger and moves up and left so it stays inside the rim.
- `assets/logo/logo.svg` and `logo-dark.svg` are the lockups for the README and other docs. Only the wordmark color changes.
- `public/icon/*.png` are rendered from these SVGs. The 16 and 32 px icons fill their box; 48 px and up are inset. The 128 px icon draws a 104 px scope, which optically matches the Web Store's 96 px square artwork inside 16 px of padding.

## Do's and Don'ts

### Do:

- **Do** take every color, size, space and radius from `entrypoints/sidepanel/tokens.css` (PushBased primitives), through the role variables in `style.css`.
- **Do** color performance values only with the signal colors, using `rate()` from `utils/protocol.ts`, so the metric, radar, trace and log always agree.
- **Do** set measured numbers in Geist Mono with tabular figures.
- **Do** check both themes. Text holds 4.5:1 and large readouts hold 3:1 (WCAG AA).
- **Do** keep the panel cheap: CSS-variable changes and a single canvas, no layout thrash in the per-frame loops.

### Don't:

- **Don't** use the PushBased secondary pink in the panel outside the logo mark; it reads as an error.
- **Don't** use violet for status, or signal colors for decoration.
- **Don't** add shadows, gradients (beyond the radar's functional conic wedge) or glass effects to the chassis.
- **Don't** add branding beyond the footer credit; the brand stays subtle.
- **Don't** use mid violets (500 and darker) as text or fills on dark surfaces.
