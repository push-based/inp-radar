import { onINP } from 'web-vitals/attribution';
import {
  PORT_NAME,
  type EventRecord,
  type InpSnapshot,
  type PageMessage,
} from '@/utils/protocol';

const MAX_BUFFERED_EVENTS = 200;

export default defineContentScript({
  matches: ['<all_urls>'],
  runAt: 'document_start',

  main() {
    // Everything here runs on the page's main thread, so it sees the same
    // jank the user does. The panel only renders what we send it.
    let port: Browser.runtime.Port | null = null;
    let inp: InpSnapshot | null = null;
    let events: EventRecord[] = [];
    let interactionNumbers = new Map<number, number>();
    let heartbeat = 0;

    const send = (message: PageMessage) => port?.postMessage(message);
    const visible = () => document.visibilityState === 'visible';

    // --- Heartbeat: one message per page frame -------------------------------
    // While the main thread is blocked no frames run, no beats arrive, and the
    // panel's radar shows the gap growing.
    function beat() {
      send({ type: 'beat' });
      heartbeat = requestAnimationFrame(beat);
    }

    function startHeartbeat() {
      if (!heartbeat && port && visible()) {
        heartbeat = requestAnimationFrame(beat);
      }
    }

    function stopHeartbeat() {
      cancelAnimationFrame(heartbeat);
      heartbeat = 0;
    }

    // --- Event log -----------------------------------------------------------
    new PerformanceObserver((list) => {
      // SAFETY: this observer subscribes only to `type: 'event'` (below), and
      // every 'event' entry is a PerformanceEventTiming.
      for (const entry of list.getEntries() as PerformanceEventTiming[]) {
        if (!entry.interactionId) continue;

        let interaction = interactionNumbers.get(entry.interactionId);

        if (interaction === undefined) {
          interaction = interactionNumbers.size + 1;
          interactionNumbers.set(entry.interactionId, interaction);
        }

        const record: EventRecord = {
          interaction,
          interactionId: entry.interactionId,
          name: entry.name,
          duration: entry.duration,
          inputDelay: entry.processingStart - entry.startTime,
          processingDuration: entry.processingEnd - entry.processingStart,
          // `duration` is rounded to 8ms, so this can dip below zero.
          presentationDelay: Math.max(
            0,
            entry.startTime + entry.duration - entry.processingEnd,
          ),
          timestamp: performance.timeOrigin + entry.startTime,
        };

        events.push(record);

        if (events.length > MAX_BUFFERED_EVENTS) events.shift();
        send({ type: 'event', event: record });
      }
    }).observe({ type: 'event', durationThreshold: 16, buffered: true });

    // --- INP -----------------------------------------------------------------
    onINP(
      ({ value, rating, attribution }) => {
        inp = {
          value,
          rating,
          interactionType: attribution.interactionType,
          interactionTarget: attribution.interactionTarget,
          inputDelay: attribution.inputDelay,
          processingDuration: attribution.processingDuration,
          presentationDelay: attribution.presentationDelay,
        };
        send({ type: 'inp', inp });
      },
      { reportAllChanges: true, durationThreshold: 0 },
    );

    // --- Page lifecycle --------------------------------------------------------
    document.addEventListener('visibilitychange', () => {
      send({ type: 'visibility', visible: visible() });

      if (visible()) startHeartbeat();
      else stopHeartbeat();
    });

    addEventListener('pageshow', (event) => {
      if (!event.persisted) return;
      // Restored from bfcache: this is a new page view as far as INP goes.
      inp = null;
      events = [];
      interactionNumbers = new Map();
      send({ type: 'reset', url: location.href });
    });

    // --- Connection from the side panel ---------------------------------------
    browser.runtime.onConnect.addListener((p) => {
      if (p.name !== PORT_NAME) return;

      port?.disconnect();
      port = p;
      p.onDisconnect.addListener(() => {
        if (port !== p) return;
        port = null;
        stopHeartbeat();
      });

      send({
        type: 'hello',
        url: location.href,
        visible: visible(),
        inp,
        events,
      });
      startHeartbeat();
    });
  },
});
