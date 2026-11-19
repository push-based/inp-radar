import './fonts.css';
import { PORT_NAME, type InpSnapshot, type PageMessage } from '@/shared/protocol';

import { createEventLog } from './event-log';
import type { Meter } from './meter';
import { createPulse } from './pulse';
import { createRadar } from './radar';
import { recordingSupported, startRecording, stopRecording } from './recorder';

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

// --- Optional recording of the measured tab --------------------------------

const recordButton = $('record', HTMLButtonElement);
let recordingTabId: number | undefined;
let recordingStart = 0;
let recordingTimer: ReturnType<typeof setInterval> | undefined;

function renderRecording(label?: string) {
  const recording = recordingTabId !== undefined;
  const seconds = Math.floor((Date.now() - recordingStart) / 1000);
  const time = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;

  recordButton.dataset.recording = String(recording);
  recordButton.textContent = label ?? (recording ? `Stop ${time}` : 'Record');
}

// The tab was closed, or the user dismissed Chrome's debugging bar.
function onDetach(source: Browser.debugger.Debuggee) {
  if (source.tabId !== recordingTabId) return;

  recordingTabId = undefined;
  clearInterval(recordingTimer);
  renderRecording();
}

async function finishRecording(id: number) {
  recordingTabId = undefined;
  clearInterval(recordingTimer);
  browser.debugger.onDetach.removeListener(onDetach);
  renderRecording('Saving…');

  const video = await stopRecording(id);
  const link = document.createElement('a');
  const host = pageUrl.split('/')[0] || 'page';
  const stamp = new Date().toISOString().slice(0, 19).replaceAll(':', '-');

  link.href = URL.createObjectURL(video);
  link.download = `inp-radar-${host}-${stamp}.mp4`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 60_000);
}

recordButton.hidden = !recordingSupported(navigator.userAgent);

recordButton.addEventListener('click', async () => {
  const id = recordingTabId ?? tabId;

  if (id === undefined) return;

  recordButton.disabled = true;

  try {
    if (recordingTabId !== undefined) {
      await finishRecording(id);
    } else {
      await startRecording(id);
      browser.debugger.onDetach.addListener(onDetach);
      recordingTabId = id;
      recordingStart = Date.now();
      recordingTimer = setInterval(() => renderRecording(), 500);
    }

    renderRecording();
  } catch (error) {
    console.error(error);
    recordButton.title = error instanceof Error ? error.message : String(error);
    renderRecording('Record failed');
  } finally {
    recordButton.disabled = false;
  }
});

connectToActiveTab();
