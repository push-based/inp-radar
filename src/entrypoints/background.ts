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
  const targets = new Map<VideoName, Browser.debugger.Debuggee>();
  const send = (reply: RecorderReply) => port.postMessage(reply);

  const onDetach = (source: Browser.debugger.Debuggee) => {
    for (const [video, target] of targets) {
      if (!sameTarget(source, target)) continue;

      targets.delete(video);
      send({ type: 'lost', video });
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

        await readRecording(target, (data, base64) => send({ type: 'chunk', video, data, base64 }));
        send({ type: 'saved', video });
      } catch (cause) {
        send({ type: 'failed', video, message: describe(cause) });
      }
    }

    send({ type: 'stopped' });
  };

  browser.debugger.onDetach.addListener(onDetach);
  port.onMessage.addListener((request: RecorderRequest) => {
    handle(request).catch((cause) => send({ type: 'error', message: describe(cause) }));
  });
  // The panel closed or reloaded: end whatever it was still recording.
  port.onDisconnect.addListener(() => {
    browser.debugger.onDetach.removeListener(onDetach);

    for (const target of targets.values()) void discardRecording(target);
  });
}

function describe(cause: unknown) {
  return cause instanceof Error ? cause.message : String(cause);
}
