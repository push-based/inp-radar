import './fonts.css';
import { describeError } from '@/shared/errors';
import { PORT_NAME, type InpSnapshot, type PageMessage } from '@/shared/protocol';
import type { DetachReason, VideoName } from '@/shared/recording';

import { fitsInZip, zipRecording, type RecordingFile } from './archive';
import { createEventLog } from './event-log';
import type { Meter } from './meter';
import { createPulse } from './pulse';
import { createRadar } from './radar';
import {
  NativeRecording,
  panelTarget,
  recordingSupported,
  startWindowRecording,
  stopWindowRecording,
  type WindowRecording,
} from './recorder';

const MAX_RETRIES = 10;
const RETRY_DELAY = 300;

function $(id: string): HTMLElement;
function $<T extends HTMLElement>(id: string, type: new () => T): T;
function $(id: string, type = HTMLElement) {
  const element = document.getElementById(id);

  if (!(element instanceof type)) {
    throw new Error(`#${id} is missing or not a ${type.name}`);
  }

  return element;
}

const meters: Meter[] = [
  createRadar($('clock')),
  createPulse($('pulse', HTMLCanvasElement), $('pulse-readout')),
];

const log = createEventLog($('event-log', HTMLTableSectionElement));

// --- Rendering -------------------------------------------------------------

type State = 'connecting' | 'connected' | 'hidden' | 'unreachable';

function setStatus(state: State, text: string) {
  $('status').dataset.state = state;
  $('status-text').textContent = text;
  $('status-text').title = text;
  $('reload').hidden = state !== 'unreachable';
  $('clock-label').textContent = state === 'hidden' ? 'Paused (tab hidden)' : 'Main thread';

  for (const meter of meters) meter.setActive(state === 'connected');
}

function renderInp(inp: InpSnapshot | null) {
  $('inp-box').dataset.rating = inp?.rating ?? '';
  $('inp-value').textContent = inp ? String(Math.round(inp.value)) : '–';
  $('breakdown').hidden = !inp;
  $('inp-target').textContent = '';

  if (!inp) return;

  const parts = {
    'input-delay': inp.inputDelay,
    processing: inp.processingDuration,
    presentation: inp.presentationDelay,
  };

  for (const [key, value] of Object.entries(parts)) {
    $(`bar-${key}`).style.flexGrow = String(value);
    $(`inp-${key}`).textContent = `${Math.round(value)} ms`;
  }

  const target = inp.interactionTarget
    ? `${inp.interactionType ?? 'interaction'} → ${inp.interactionTarget}`
    : '';

  $('inp-target').textContent = target;
  $('inp-target').title = target;
}

function describe(url: string) {
  try {
    const { host, pathname } = new URL(url);

    return host + pathname;
  } catch {
    return url;
  }
}

function handle(message: PageMessage) {
  switch (message.type) {
    case 'hello':
      retries = 0;
      pageUrl = describe(message.url);
      renderInp(message.inp);
      log.reset(message.events);

      setStatus(message.visible ? 'connected' : 'hidden', pageUrl);
      break;
    case 'beat':
      for (const meter of meters) meter.beat();
      break;
    case 'visibility':
      setStatus(message.visible ? 'connected' : 'hidden', pageUrl);
      break;
    case 'inp':
      renderInp(message.inp);
      break;
    case 'event':
      log.add(message.event);
      break;
    case 'reset':
      pageUrl = describe(message.url);
      renderInp(null);
      log.reset();
      setStatus('connected', pageUrl);
      break;
  }
}

// --- Connection to the active tab ------------------------------------------

const panelWindow = await browser.windows.getCurrent();
let tabId: number | undefined;
let port: Browser.runtime.Port | null = null;
let connected = false;
let retries = 0;
let retryTimer: ReturnType<typeof setTimeout> | undefined;
let pageUrl = '';

function connect(id: number | undefined) {
  clearTimeout(retryTimer);
  const previous = port;
  port = null;
  connected = false;
  previous?.disconnect();
  renderInp(null);
  log.reset();

  tabId = id;
  pageUrl = '';

  if (id === undefined) return;
  setStatus('connecting', 'Connecting…');

  const p = browser.tabs.connect(id, { name: PORT_NAME });
  port = p;
  p.onMessage.addListener((message: PageMessage) => {
    if (port !== p) return;

    if (message.type === 'hello') connected = true;
    handle(message);
  });
  p.onDisconnect.addListener(() => {
    // Read lastError so Chrome doesn't log "Could not establish connection".
    void browser.runtime.lastError;

    if (port !== p) return;
    port = null;
    connected = false;
    renderInp(null);
    log.reset();

    // The page navigated away, or has no content script yet. Retry for a
    // moment before giving up.
    if (retries++ < MAX_RETRIES) {
      setStatus('connecting', 'Waiting for page…');
      retryTimer = setTimeout(() => connect(id), RETRY_DELAY);
    } else {
      setStatus(
        'unreachable',
        "Can't measure this page. Reload it, or it may be a page extensions can't access (chrome://, Web Store).",
      );
    }
  });
}

async function connectToActiveTab() {
  const [tab] = await browser.tabs.query({
    active: true,
    windowId: panelWindow.id,
  });

  retries = 0;
  connect(tab?.id);
}

browser.tabs.onActivated.addListener(({ tabId: id, windowId }) => {
  if (windowId !== panelWindow.id) return;
  retries = 0;
  connect(id);
});

browser.tabs.onUpdated.addListener((id, info) => {
  if (id !== tabId || info.status !== 'complete' || connected) return;
  retries = 0;
  connect(id);
});

$('reload').addEventListener('click', () => {
  if (tabId !== undefined) browser.tabs.reload(tabId);
});

// --- Optional recording ------------------------------------------------------
//
// "Page + panel": Chrome's native recorder, two separate AV1 videos.
// "Whole window": the Chrome window picked in the share dialog, one video.
// Stop downloads one zip with the video(s) inside.

type RecordMode = 'native' | 'window';

type Recording =
  | { mode: 'native'; host: string; session: NativeRecording }
  | { mode: 'window'; host: string; capture: WindowRecording };

const MODE_KEY = 'inp-radar:record-mode';
const recordButton = $('record', HTMLButtonElement);
const modeSelect = $('record-mode', HTMLSelectElement);
const recordMessage = $('record-message');
let recording: Recording | undefined;
let recordingStart = 0;
let recordingTimer: ReturnType<typeof setInterval> | undefined;

function renderRecording(label?: string) {
  const seconds = Math.floor((Date.now() - recordingStart) / 1000);
  const time = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;

  recordButton.dataset.recording = String(recording !== undefined);
  recordButton.textContent = label ?? (recording ? `Stop ${time}` : 'Record');
  modeSelect.disabled = recording !== undefined;
}

/** A line under the controls about the last recording; empty hides it. */
function showMessage(text: string) {
  recordMessage.textContent = text;
  recordMessage.hidden = text === '';
}

function endRecording() {
  recording = undefined;
  clearInterval(recordingTimer);
}

/** Why Chrome stopped one of the videos, as shown to the user. */
function lostCause(video: VideoName, reason: DetachReason) {
  if (reason === 'canceled_by_user') return "Recording was cancelled from Chrome's debugging bar";

  return video === 'page'
    ? "The recorded tab was closed or can't be recorded any more"
    : 'The panel stopped recording';
}

// Chrome detached one of the videos. Whatever still records is saved;
// dismissing the debugging bar usually detaches both, so then nothing is left.
function onLost(video: VideoName, reason: DetachReason) {
  if (recording?.mode !== 'native') return;

  const other: VideoName = video === 'page' ? 'panel' : 'page';
  const cause = lostCause(video, reason);

  void stop({
    videos: [other],
    explain: (saved) =>
      saved ? `${cause}, so only the ${other} video was saved.` : `${cause}. Nothing was saved.`,
  });
}

// The background script went away mid-recording, taking the recording with it.
function onDropped() {
  if (recording?.mode !== 'native') return;

  endRecording();
  renderRecording();
  showMessage('Recording stopped unexpectedly. Nothing was saved.');
}

/**
 * How a recording ends: which "Page + panel" videos are still there to save,
 * and, when it ended on its own, what to tell the user about it.
 */
interface Ending {
  videos: VideoName[];
  explain?: (saved: boolean) => string;
}

/** Ends the recording, saves what it recorded and resets the controls. */
async function stop(ending: Ending = { videos: ['page', 'panel'] }) {
  const current = recording;

  if (!current) return;

  endRecording();
  recordButton.disabled = true;
  renderRecording('Saving…');

  try {
    await finishRecording(current, ending);
  } catch (cause) {
    fail(cause);
  } finally {
    recordButton.disabled = false;
    renderRecording();
  }
}

async function finishRecording(current: Recording, { videos, explain }: Ending) {
  if (current.mode === 'window') {
    const video = await stopWindowRecording(current.capture);
    const extension = video.type.startsWith('video/webm') ? 'webm' : 'mp4';

    await save(current.host, [{ name: `window.${extension}`, file: video }]);

    return;
  }

  // One video failing doesn't throw away the other.
  const { files, failures } = await current.session.stop(videos);

  if (files.length > 0) await save(current.host, files);

  if (explain) {
    showMessage(explain(files.length > 0));

    return;
  }

  if (files.length === 0) throw new Error(failures.join('; '));

  if (failures.length > 0) showMessage(`Saved without ${failures.join('; ')}`);
}

async function save(host: string, files: RecordingFile[]) {
  const base = `inp-radar-${host.replaceAll(/[^\w.-]+/g, '-')}-${localStamp(new Date())}`;

  if (fitsInZip(files)) {
    download(await zipRecording(files), `${base}.zip`);

    return;
  }

  // Too large for a plain zip: each file on its own instead.
  for (const { name, file } of files) download(file, `${base}-${name}`);
}

function download(file: Blob, name: string) {
  const link = document.createElement('a');

  link.href = URL.createObjectURL(file);
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 60_000);
}

/** `2026-11-19T18-08-10` in local time, safe in a file name. */
function localStamp(now: Date) {
  const pad = (value: number) => String(value).padStart(2, '0');

  return (
    `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}` +
    `T${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}`
  );
}

async function beginRecording(mode: RecordMode, id: number) {
  // The host now, before a tab switch or navigation can change it. Only a
  // connected page's URL is this tab's; otherwise it may be the previous tab's.
  const host = (connected && pageUrl.split('/')[0]) || 'page';

  if (mode === 'window') {
    const capture = await startWindowRecording(() => {
      if (recording?.mode === 'window' && recording.capture === capture) void stop();
    });

    recording = { mode, host, capture };
  } else {
    const session = await NativeRecording.start({ tabId: id }, await panelTarget(), {
      onLost,
      onDropped,
    });

    recording = { mode, host, session };
  }

  recordingStart = Date.now();
  recordingTimer = setInterval(() => renderRecording(), 500);
}

// Catch boundary: whatever was thrown is shown under the controls.
function fail(cause: unknown) {
  // A cancelled share dialog and a policy or permission block look the same.
  if (cause instanceof DOMException && cause.name === 'NotAllowedError') {
    showMessage("Screen sharing was cancelled or isn't allowed.");

    return;
  }

  console.error(cause);
  showMessage(`Recording failed: ${describeError(cause)}`);
}

function readMode(): RecordMode {
  return modeSelect.value === 'window' ? 'window' : 'native';
}

try {
  modeSelect.value = localStorage.getItem(MODE_KEY) === 'window' ? 'window' : 'native';
} catch {
  // Storage is only a convenience.
}

modeSelect.addEventListener('change', () => {
  try {
    localStorage.setItem(MODE_KEY, readMode());
  } catch {
    // Storage is only a convenience.
  }
});

$('record-controls').hidden = !recordingSupported(navigator.userAgent);

recordButton.addEventListener('click', async () => {
  if (recording) {
    await stop();

    return;
  }

  if (tabId === undefined) return;

  recordButton.disabled = true;
  showMessage('');

  try {
    await beginRecording(readMode(), tabId);
  } catch (cause) {
    fail(cause);
  } finally {
    recordButton.disabled = false;
    renderRecording();
  }
});

connectToActiveTab();
