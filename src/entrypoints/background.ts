import { describeError } from '@/shared/errors';
import {
  RECORDING_PORT,
  type DetachReason,
  type RecorderReply,
  type RecorderRequest,
  type VideoName,
} from '@/shared/recording';
import {
  discardRecording,
  readRecording,
  sameTarget,
  startRecording,
  stopRecording,
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

  // Becomes true once both videos record; until then a detach isn't reported
  // to the panel, start just fails instead.
  let live = false;

  const onDetach = (source: Target, reason: DetachReason) => {
    for (const [video, target] of targets) {
      if (!sameTarget(source, target)) continue;

      targets.delete(video);

      if (live) send({ type: 'lost', video, reason });
    }
  };

  const start = async (page: Target, panel: Target) => {
    // Tracked from the moment each attaches, so a detach during the other's
    // start is seen, and a closing panel detaches it.
    await startRecording(page);
    targets.set('page', page);

    try {
      await startRecording(panel);
      targets.set('panel', panel);
    } catch (cause) {
      targets.delete('page');
      await discardRecording(page);

      throw cause;
    }

    // The panel closed while this was attaching, after onDisconnect already
    // detached everything it knew about.
    if (closed) {
      await Promise.all([discardRecording(page), discardRecording(panel)]);

      return;
    }

    if (targets.size < 2) {
      await Promise.all([...targets.values()].map(discardRecording));
      targets.clear();

      throw new Error('The tab closed while the recording was starting.');
    }

    live = true;
    send({ type: 'started' });
  };

  const stop = async (videos: VideoName[]) => {
    // Stop every video first, so they end at the same moment, then read them.
    const stopped = await Promise.all(
      videos.map(async (video) => {
        const target = targets.get(video);

        targets.delete(video);

        try {
          if (!target) throw new Error('it was no longer recording');

          return { video, target, handle: await stopRecording(target) };
        } catch (cause) {
          send({ type: 'failed', video, message: describeError(cause) });

          return null;
        }
      }),
    );

    // One video failing doesn't stop the other from being saved.
    for (const result of stopped) {
      if (!result) continue;

      const { video, target, handle } = result;

      try {
        await readRecording(target, handle, (data, base64) => {
          // Nobody is left to receive the video: stop reading, which detaches.
          if (closed) throw new Error('The panel closed.');

          send({ type: 'chunk', video, data, base64 });
        });
        send({ type: 'saved', video });
      } catch (cause) {
        send({ type: 'failed', video, message: describeError(cause) });
      }
    }

    live = false;
    send({ type: 'stopped' });
  };

  const handle = (request: RecorderRequest) =>
    request.type === 'start' ? start(request.page, request.panel) : stop(request.videos);

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
