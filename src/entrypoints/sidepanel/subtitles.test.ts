import { describe, expect, it } from 'vitest';

import type { EventRecord } from '@/shared/protocol';

import { interactionSubtitles } from './subtitles';

const START = 1_000_000;

function event(interaction: number, name: string, at: number, duration: number): EventRecord {
  return {
    interaction,
    interactionId: interaction * 10,
    name,
    duration,
    inputDelay: 2,
    processingDuration: duration - 10,
    presentationDelay: 8,
    timestamp: START + at,
  };
}

describe('interactionSubtitles', () => {
  it('writes one cue per interaction at its time in the video', () => {
    const vtt = interactionSubtitles(
      [
        event(1, 'pointerdown', 1500, 312),
        event(1, 'click', 1500, 312),
        event(2, 'click', 65_250, 608),
      ],
      START,
      START + 70_000,
    );

    expect(vtt).toBe(
      [
        'WEBVTT',
        '',
        '00:00:01.500 --> 00:00:03.500',
        'pointerdown / click · 312 ms · needs improvement',
        'input delay 2 ms · processing 302 ms · presentation 8 ms',
        '',
        '00:01:05.250 --> 00:01:07.250',
        'Worst interaction: click · 608 ms · poor',
        'input delay 2 ms · processing 598 ms · presentation 8 ms',
        '',
      ].join('\n'),
    );
  });

  it('keeps long interactions on screen for their whole duration', () => {
    expect(interactionSubtitles([event(1, 'keydown', 0, 2500)], START, START + 5000)).toContain(
      '00:00:00.000 --> 00:00:02.500',
    );
  });

  it('ends a cue where the next interaction starts', () => {
    const vtt = interactionSubtitles(
      [event(1, 'click', 1000, 300), event(2, 'click', 1800, 300)],
      START,
      START + 5000,
    );

    expect(vtt).toContain('00:00:01.000 --> 00:00:01.800');
    expect(vtt).toContain('00:00:01.800 --> 00:00:03.800');
  });

  it('takes the breakdown from the entry whose handler ran', () => {
    const pointerdown = { ...event(1, 'pointerdown', 0, 272), processingDuration: 0 };
    const click = { ...event(1, 'click', 0, 272), processingDuration: 250 };

    expect(interactionSubtitles([pointerdown, click], START, START + 5000)).toContain(
      'processing 250 ms',
    );
  });

  it('ignores events outside the recording and returns nothing without any', () => {
    expect(interactionSubtitles([event(1, 'click', -50, 300)], START, START + 1000)).toBe('');
    expect(interactionSubtitles([], START, START + 1000)).toBe('');
  });
});
