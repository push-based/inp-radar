import { describeError } from '@/shared/errors';
import {
  RECORDING_PORT,
  type RecorderReply,
  type RecorderRequest,
  type VideoName,
} from '@/shared/recording';
import {
  discardRecording,
  readRecording,
  sameTarget,
  startRecording,
  type Target,
} from '@/shared/screen-recording';

export default defineBackground(() => {
  // Clicking the toolbar icon opens the side panel instead of a popup, so it
  // stays open while you interact with the page.
  browser.sidePanel
    .setPanelBehavior({ openPanelOnActionClick: true })
    .catch((error) => console.error(error));

  browser.runtime.onConnect.addListener((port) => {
    if (port.name === RECORDING_PORT) serveRecording(port);
  });
});

/** Runs one panel's "Page + panel" recording (see shared/recording.ts). */
function serveRecording(port: Browser.runtime.Port) {
  const targets = new Map<VideoName, Target>();
  // Set once the panel is gone: nothing is sent after that, and whatever the
  // panel was starting or saving is detached instead.
  let closed = false;

  const send = (reply: RecorderReply) => {
    if (closed) return;

    try {
      port.postMessage(reply);
    } catch {
      // The port died before onDisconnect ran; onDisconnect cleans up.
    }
  };

  const onDetach = (source: Target, reason: `${Browser.debugger.DetachReason}`) => {
    for (const [video, target] of targets) {
      if (!sameTarget(source, target)) continue;

      targets.delete(video);
      send({ type: 'lost', video, reason });
    }
  };

  const handle = async (request: RecorderRequest) => {
    if (request.type === 'start') {
      await startRecording(request.page);

      try {
        await startRecording(request.panel);
      } catch (cause) {
        await discardRecording(request.page);

        throw cause;
      }

      // The panel closed while this was attaching, after onDisconnect already
      // detached everything it knew about.
      if (closed) {
        await Promise.all([discardRecording(request.page), discardRecording(request.panel)]);

        return;
      }

      targets.set('page', request.page);
      targets.set('panel', request.panel);
      send({ type: 'started' });

      return;
    }

    // One video failing doesn't stop the other from being saved.
    for (const video of request.videos) {
      const target = targets.get(video);

      targets.delete(video);

      try {
        if (!target) throw new Error('it was no longer recording');

        await readRecording(target, (data, base64) => {
          // Nobody is left to receive the video: stop reading, which detaches.
          if (closed) throw new Error('The panel closed.');

          send({ type: 'chunk', video, data, base64 });
        });
        send({ type: 'saved', video });
      } catch (cause) {
        send({ type: 'failed', video, message: describeError(cause) });
      }
    }

    send({ type: 'stopped' });
  };

  browser.debugger.onDetach.addListener(onDetach);
  port.onMessage.addListener((request: RecorderRequest) => {
    handle(request).catch((cause) => send({ type: 'error', message: describeError(cause) }));
  });
  // The panel closed or reloaded: end whatever it was still recording.
  port.onDisconnect.addListener(() => {
    closed = true;
    browser.debugger.onDetach.removeListener(onDetach);

    for (const target of targets.values()) void discardRecording(target);

    targets.clear();
  });
}
