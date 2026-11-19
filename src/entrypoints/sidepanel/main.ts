import './fonts.css';
import { PORT_NAME, type EventRecord, type InpSnapshot, type PageMessage } from '@/shared/protocol';

import { createEventLog } from './event-log';
import type { Meter } from './meter';
import { createPulse } from './pulse';
import { createRadar } from './radar';
import {
  discardRecording,
  panelTarget,
  recordingSupported,
  startRecording,
  startWindowRecording,
  stopRecording,
  stopWindowRecording,
  type Target,
  type WindowRecording,
} from './recorder';
import { interactionSubtitles } from './subtitles';

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

      // A reconnect (tab switch, navigation) replays the page's buffered events.
      for (const event of message.events) keepForSubtitles(event);
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
      keepForSubtitles(message.event);
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
// Either way, a WebVTT file next to the video marks each logged interaction.

type RecordMode = 'native' | 'window';

type Recording =
  | { mode: 'native'; page: Target; panel: Target }
  | { mode: 'window'; capture: WindowRecording };

const MODE_KEY = 'inp-radar:record-mode';
const SUBTITLES_KEY = 'inp-radar:record-subtitles';
const recordButton = $('record', HTMLButtonElement);
const modeSelect = $('record-mode', HTMLSelectElement);
const subtitlesCheckbox = $('record-subtitles', HTMLInputElement);
let recording: Recording | undefined;
let recordingStart = 0;
let recordedEvents = new Map<string, EventRecord>();

/** Remembers an event while recording, once, however often it's replayed. */
function keepForSubtitles(event: EventRecord) {
  if (recording)
    recordedEvents.set(`${event.interactionId}:${event.name}:${event.timestamp}`, event);
}

let recordingTimer: ReturnType<typeof setInterval> | undefined;

function renderRecording(label?: string) {
  const seconds = Math.floor((Date.now() - recordingStart) / 1000);
  const time = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;

  recordButton.dataset.recording = String(recording !== undefined);
  recordButton.textContent = label ?? (recording ? `Stop ${time}` : 'Record');
  modeSelect.disabled = recording !== undefined;
  subtitlesCheckbox.disabled = recording !== undefined;
}

function endRecording() {
  recording = undefined;
  clearInterval(recordingTimer);
  browser.debugger.onDetach.removeListener(onDetach);
}

// The tab was closed, or the user dismissed Chrome's debugging bar: the
// recording can't be finished, so drop the other half too.
function onDetach(source: Target) {
  if (recording?.mode !== 'native') return;

  const { page, panel } = recording;
  const isPage = source.tabId !== undefined && source.tabId === page.tabId;

  if (!isPage && source.targetId !== panel.targetId) return;

  endRecording();
  void discardRecording(isPage ? panel : page);
  renderRecording();
}

function download(file: Blob, name: string) {
  const link = document.createElement('a');

  link.href = URL.createObjectURL(file);
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 60_000);
}

function extensionOf(video: Blob) {
  return video.type.startsWith('video/webm') ? 'webm' : 'mp4';
}

async function finishRecording(current: Recording) {
  const end = Date.now();

  const subtitles = subtitlesCheckbox.checked
    ? interactionSubtitles([...recordedEvents.values()], recordingStart, end)
    : '';

  const host = pageUrl.split('/')[0] || 'page';
  const stamp = new Date().toISOString().slice(0, 19).replaceAll(':', '-');
  const base = `inp-radar-${host}-${stamp}`;

  const saveSubtitles = (suffix: string) => {
    if (subtitles) download(new Blob([subtitles], { type: 'text/vtt' }), `${base}-${suffix}.vtt`);
  };

  endRecording();
  renderRecording('Saving…');

  if (current.mode === 'window') {
    const video = await stopWindowRecording(current.capture);

    download(video, `${base}-window.${extensionOf(video)}`);
    saveSubtitles('window');

    return;
  }

  const [pageVideo, panelVideo] = await Promise.all([
    stopRecording(current.page),
    stopRecording(current.panel),
  ]);

  download(pageVideo, `${base}-page.mp4`);
  download(panelVideo, `${base}-panel.mp4`);
  saveSubtitles('page');
}

async function beginRecording(mode: RecordMode, id: number) {
  recordedEvents = new Map();

  if (mode === 'window') {
    const capture = await startWindowRecording(() => {
      if (recording?.mode === 'window' && recording.capture === capture) void stop();
    });

    recordingStart = Date.now();
    recording = { mode, capture };
  } else {
    const page: Target = { tabId: id };
    const panel = await panelTarget();

    recordingStart = Date.now();
    await startRecording(page);

    try {
      await startRecording(panel);
    } catch (error) {
      await discardRecording(page);

      throw error;
    }

    browser.debugger.onDetach.addListener(onDetach);
    recording = { mode, page, panel };
  }

  recordingTimer = setInterval(() => renderRecording(), 500);
}

async function stop() {
  if (!recording) return;

  recordButton.disabled = true;

  try {
    await finishRecording(recording);
    renderRecording();
  } catch (error) {
    fail(error);
  } finally {
    recordButton.disabled = false;
  }
}

// Catch boundary: whatever was thrown is shown on the button.
// oxlint-disable-next-line anti-slop/no-unknown-parameters
function fail(error: unknown) {
  console.error(error);
  recordButton.title = error instanceof Error ? error.message : String(error);
  renderRecording('Record failed');
}

function readMode(): RecordMode {
  return modeSelect.value === 'window' ? 'window' : 'native';
}

try {
  modeSelect.value = localStorage.getItem(MODE_KEY) === 'window' ? 'window' : 'native';
  subtitlesCheckbox.checked = localStorage.getItem(SUBTITLES_KEY) !== 'off';
} catch {
  // Storage is only a convenience.
}

function saveChoices() {
  try {
    localStorage.setItem(MODE_KEY, readMode());
    localStorage.setItem(SUBTITLES_KEY, subtitlesCheckbox.checked ? 'on' : 'off');
  } catch {
    // Storage is only a convenience.
  }
}

modeSelect.addEventListener('change', saveChoices);

subtitlesCheckbox.addEventListener('change', saveChoices);

$('record-controls').hidden = !recordingSupported(navigator.userAgent);

recordButton.addEventListener('click', async () => {
  if (recording) {
    await stop();

    return;
  }

  if (tabId === undefined) return;

  recordButton.disabled = true;

  try {
    await beginRecording(readMode(), tabId);
    renderRecording();
  } catch (error) {
    fail(error);
  } finally {
    recordButton.disabled = false;
  }
});

connectToActiveTab();
