import { rate, type EventRecord } from '@/utils/protocol';

const MAX_ROWS = 200;

const timeFormat = new Intl.DateTimeFormat(undefined, {
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  fractionalSecondDigits: 3,
  hour12: false,
});

export interface EventLog {
  add(event: EventRecord): void;
  reset(events?: EventRecord[]): void;
}

export function createEventLog(tbody: HTMLTableSectionElement): EventLog {
  function cell(text: string, className?: string) {
    const td = document.createElement('td');
    td.textContent = text;
    if (className) td.className = className;
    return td;
  }

  function add(event: EventRecord) {
    const tr = document.createElement('tr');
    // Alternate shading per interaction so its events read as a group.
    tr.className = event.interaction % 2 ? 'odd' : 'even';
    tr.dataset.rating = rate(event.duration);
    tr.title = [
      `Input delay: ${Math.round(event.inputDelay)} ms`,
      `Processing: ${Math.round(event.processingDuration)} ms`,
      `Presentation: ${Math.round(event.presentationDelay)} ms`,
    ].join('\n');

    tr.append(
      cell(String(event.interaction)),
      cell(event.name),
      cell(`${Math.round(event.duration)} ms`, 'value duration'),
      cell(timeFormat.format(event.timestamp), 'value time'),
    );

    tbody.prepend(tr);
    while (tbody.rows.length > MAX_ROWS) tbody.lastElementChild?.remove();
  }

  return {
    add,
    reset(events = []) {
      tbody.replaceChildren();
      events.forEach(add);
    },
  };
}
