import { beforeEach, describe, expect, it } from 'vitest';

import type { EventRecord } from '@/shared/protocol';

import { createEventLog, type EventLog } from './event-log';

function record(interaction: number, name: string, duration: number): EventRecord {
  return {
    interaction,
    interactionId: interaction * 100,
    name,
    duration,
    inputDelay: 10,
    processingDuration: duration - 20,
    presentationDelay: 10,
    timestamp: Date.UTC(2026, 0, 1),
  };
}

describe('createEventLog', () => {
  let tbody: HTMLTableSectionElement;
  let log: EventLog;

  const rows = () => [...tbody.rows];
  const cells = (row: HTMLTableRowElement) => [...row.cells].map((cell) => cell.textContent);

  beforeEach(() => {
    tbody = document.createElement('tbody');
    log = createEventLog(tbody);
  });

  it('adds a row per event, newest first', () => {
    log.add(record(1, 'pointerdown', 40));
    log.add(record(1, 'click', 48));

    expect(rows().map((row) => cells(row).slice(0, 3))).toEqual([
      ['1', 'click', '48 ms'],
      ['1', 'pointerdown', '40 ms'],
    ]);
  });

  it('rates each row by its duration', () => {
    log.add(record(1, 'click', 120));
    log.add(record(2, 'click', 320));
    log.add(record(3, 'click', 720));

    expect(rows().map((row) => row.dataset.rating)).toEqual(['poor', 'needs-improvement', 'good']);
  });

  it('alternates shading per interaction, not per event', () => {
    log.add(record(1, 'pointerdown', 40));
    log.add(record(1, 'click', 40));
    log.add(record(2, 'keydown', 40));

    expect(rows().map((row) => row.className)).toEqual(['even', 'odd', 'odd']);
  });

  it('puts the breakdown in the row tooltip', () => {
    log.add(record(1, 'click', 300.4));

    expect(rows()[0]?.title).toBe(
      ['Input delay: 10 ms', 'Processing: 280 ms', 'Presentation: 10 ms'].join('\n'),
    );
  });

  it('keeps only the newest 200 rows', () => {
    for (let i = 1; i <= 205; i++) log.add(record(i, 'click', 40));

    expect(rows()).toHaveLength(200);
    expect(cells(rows()[0]!)[0]).toBe('205');
    expect(cells(rows().at(-1)!)[0]).toBe('6');
  });

  it('reset replaces the rows with the given events', () => {
    log.add(record(1, 'click', 40));
    log.reset([record(7, 'keydown', 40), record(8, 'keyup', 40)]);

    expect(rows().map((row) => cells(row)[1])).toEqual(['keyup', 'keydown']);

    log.reset();

    expect(rows()).toHaveLength(0);
  });
});
