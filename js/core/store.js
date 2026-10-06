// Single source of truth for player state, persisted to localStorage.
// All writes go through update(); every subscriber is notified afterwards.

import { APP_ID, SCHEMA_VERSION, SaveError, createDefaultState, parseSave } from './schema.js';

const STORAGE_KEY = 'wok-and-talk/save';
const MAX_IMPORT_BYTES = 1_000_000;

const listeners = new Set();
let storageAvailable = true;
/** Set during boot if the saved game couldn't be read: 'corrupt' | 'unavailable' | null */
export let loadIssue = null;

let state = loadFromStorage();

function loadFromStorage() {
  let raw;
  try {
    raw = localStorage.getItem(STORAGE_KEY);
  } catch {
    storageAvailable = false;
    loadIssue = 'unavailable';
    return createDefaultState();
  }
  if (!raw) return createDefaultState();
  try {
    return parseSave(JSON.parse(raw));
  } catch (err) {
    console.warn('[store] Saved game unreadable — keeping a backup and starting fresh.', err);
    loadIssue = 'corrupt';
    try { localStorage.setItem(`${STORAGE_KEY}.corrupt-${Date.now()}`, raw); } catch { /* ignore */ }
    return createDefaultState();
  }
}

function persist() {
  if (!storageAvailable) return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (err) {
    console.warn('[store] Could not save progress.', err);
    storageAvailable = false;
  }
}

function emit() {
  for (const fn of listeners) fn(state);
}

export function getState() {
  return state;
}

export function isPersistent() {
  return storageAvailable;
}

/** Apply a mutation to a copy of the state, then persist and notify. */
export function update(mutator) {
  const draft = structuredClone(state);
  mutator(draft);
  draft.meta.updatedAt = new Date().toISOString();
  state = draft;
  persist();
  emit();
}

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function replaceState(next) {
  state = next;
  persist();
  emit();
}

export function resetState() {
  replaceState(createDefaultState());
}

// Keep multiple open tabs in sync.
window.addEventListener('storage', (e) => {
  if (e.key !== STORAGE_KEY || !e.newValue) return;
  try {
    state = parseSave(JSON.parse(e.newValue));
    emit();
  } catch { /* ignore a bad write from another tab */ }
});

// ---------------------------------------------------------------------------
// Import / Export

export function buildExport() {
  return {
    app: APP_ID,
    schemaVersion: SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    state,
  };
}

/** Download the current save as a JSON file. */
export function exportSave() {
  const json = JSON.stringify(buildExport(), null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const date = new Date().toISOString().slice(0, 10);
  const a = Object.assign(document.createElement('a'), {
    href: url,
    download: `wok-and-talk-save-${date}.json`,
  });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Read and validate a user-chosen File. Resolves to a clean state; does not apply it. */
export async function readSaveFile(file) {
  if (file.size > MAX_IMPORT_BYTES) throw new SaveError('That file is too large to be a save file.');
  let json;
  try {
    json = JSON.parse(await file.text());
  } catch {
    throw new SaveError("That file isn't valid JSON.");
  }
  return parseSave(json);
}
