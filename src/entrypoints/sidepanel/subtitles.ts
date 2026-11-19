import { rate, type EventRecord } from '@/shared/protocol';

/**
 * WebVTT subtitles for a recording: one cue per interaction from the event
 * log, at the moment it happened in the video, so a slow interaction can be
 * found by playing the video with its `.vtt` file next to it.
 */

/** How long a cue stays on screen, at least, so it can be read. */
const MIN_CUE_LENGTH = 2000;

const RATING_LABELS = {
  good: 'good',
  'needs-improvement': 'needs improvement',
  poor: 'poor',
};

/**
 * Builds the subtitles for events logged between `start` and `end` (wall-clock
 * ms). Returns an empty string when no interaction falls inside the recording.
 */
export function interactionSubtitles(events: EventRecord[], start: number, end: number): string {
  const interactions = new Map<number, EventRecord[]>();

  for (const event of events) {
    if (event.timestamp < start || event.timestamp > end) continue;

    const group = interactions.get(event.interaction) ?? [];

    group.push(event);
    interactions.set(event.interaction, group);
  }

  const cues = [...interactions.values()].map((group) => summarize(group, start));

  if (cues.length === 0) return '';

  const worst = cues.reduce((a, b) => (b.duration > a.duration ? b : a));
  const lines = ['WEBVTT', ''];

  const sorted = cues.toSorted((a, b) => a.at - b.at);

  for (const [index, cue] of sorted.entries()) {
    const label = cue === worst ? 'Worst interaction: ' : '';
    // Shown for at least MIN_CUE_LENGTH, but never over the next interaction.
    const next = sorted[index + 1]?.at ?? Infinity;
    const until = Math.min(cue.at + Math.max(cue.duration, MIN_CUE_LENGTH), next);

    lines.push(
      `${timestamp(cue.at)} --> ${timestamp(until)}`,
      `${label}${cue.names} · ${Math.round(cue.duration)} ms · ${RATING_LABELS[rate(cue.duration)]}`,
      cue.breakdown,
      '',
    );
  }

  return lines.join('\n');
}

interface Summary {
  at: number;
  duration: number;
  names: string;
  breakdown: string;
}

function summarize(group: EventRecord[], start: number): Summary {
  // Entries of one interaction share a duration (rounded to 8 ms); the one
  // whose handler ran holds the processing time, so it breaks the tie.
  const slowest = group.reduce((a, b) =>
    b.duration > a.duration ||
    (b.duration === a.duration && b.processingDuration > a.processingDuration)
      ? b
      : a,
  );

  const first = Math.min(...group.map((event) => event.timestamp));
  const names = [...new Set(group.map((event) => event.name))].join(' / ');

  const breakdown = [
    `input delay ${Math.round(slowest.inputDelay)} ms`,
    `processing ${Math.round(slowest.processingDuration)} ms`,
    `presentation ${Math.round(slowest.presentationDelay)} ms`,
  ].join(' · ');

  return { at: first - start, duration: slowest.duration, names, breakdown };
}

/** `hh:mm:ss.mmm`, as WebVTT wants it. */
function timestamp(milliseconds: number): string {
  const total = Math.max(0, Math.round(milliseconds));
  const pad = (value: number, length = 2) => String(value).padStart(length, '0');

  return `${pad(Math.floor(total / 3_600_000))}:${pad(Math.floor(total / 60_000) % 60)}:${pad(
    Math.floor(total / 1000) % 60,
  )}.${pad(total % 1000, 3)}`;
}
