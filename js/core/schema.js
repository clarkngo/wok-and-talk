// Player-state schema: defaults, versioned migrations, and sanitizing of
// untrusted input (localStorage contents or an imported file).
// The formal JSON Schema lives in /schemas/player-state.schema.json — keep both in sync.

export const APP_ID = 'wok-and-talk';
export const SCHEMA_VERSION = 1;
export const STARTING_CNY = 100;

export class SaveError extends Error {
  constructor(message) {
    super(message);
    this.name = 'SaveError';
  }
}

export function createDefaultState(now = new Date().toISOString()) {
  return {
    meta: { app: APP_ID, schemaVersion: SCHEMA_VERSION, createdAt: now, updatedAt: now },
    profile: { name: 'Foodie' },
    settings: {
      showPinyin: true,
      showEnglish: true,
      script: 'simplified', // 'simplified' | 'traditional'
      autoSpeak: false,
      tapToSpeak: true, // tap any Chinese text to hear it
      speechRate: 0.9,
    },
    wallet: { cny: STARTING_CNY },
    progress: { exp: 0, mealsCompleted: 0, badges: {} }, // badges: { [badgeId]: earnedAtISO }
    restaurants: {}, // { [restaurantId]: RestaurantProgress }
    phrasebook: {}, // { ["restaurantId/nodeId/choiceId"]: { seen, correct, lastSeenAt } }
    activeMeal: null, // in-progress meal so a reload resumes mid-conversation
  };
}

export function createRestaurantProgress() {
  return { visits: 0, completions: 0, bestScore: 0, bestStars: 0, lastVisitedAt: null };
}

// Each entry upgrades a save FROM that version to the next one.
// Example for a future v2:  1: (s) => { s.profile.avatar = '🐼'; s.meta.schemaVersion = 2; return s; },
const MIGRATIONS = {};

function migrate(raw) {
  let s = raw;
  let v = s.meta.schemaVersion;
  while (v < SCHEMA_VERSION) {
    const step = MIGRATIONS[v];
    if (!step) throw new SaveError(`Can't upgrade a v${v} save.`);
    s = step(s);
    v = s.meta.schemaVersion;
  }
  return s;
}

/**
 * Accepts a parsed JSON value — either an export envelope
 * `{ app, schemaVersion, exportedAt, state }` or a bare state object —
 * and returns a clean, fully-populated state. Throws SaveError on bad input.
 */
export function parseSave(input) {
  if (!isObj(input)) throw new SaveError('The file is not a JSON object.');
  const raw = input.app === APP_ID && isObj(input.state) ? input.state : input;
  if (!isObj(raw.meta) || raw.meta.app !== APP_ID) {
    throw new SaveError("This doesn't look like a Wok & Talk save file.");
  }
  const v = raw.meta.schemaVersion;
  if (!Number.isInteger(v) || v < 1) throw new SaveError('The save file has an invalid version.');
  if (v > SCHEMA_VERSION) {
    throw new SaveError(`This save is from a newer version of the game (v${v}). Refresh to update, then try again.`);
  }
  return sanitize(migrate(structuredClone(raw)));
}

// ---------------------------------------------------------------------------
// Sanitizing: rebuild from defaults, copying only well-typed values.

function sanitize(raw) {
  const s = createDefaultState();
  s.meta.createdAt = isoOr(raw.meta.createdAt, s.meta.createdAt);
  s.meta.updatedAt = isoOr(raw.meta.updatedAt, s.meta.updatedAt);

  s.profile.name = str(raw.profile?.name, s.profile.name).trim().slice(0, 40) || s.profile.name;

  const st = isObj(raw.settings) ? raw.settings : {};
  s.settings = {
    showPinyin: bool(st.showPinyin, true),
    showEnglish: bool(st.showEnglish, true),
    script: st.script === 'traditional' ? 'traditional' : 'simplified',
    autoSpeak: bool(st.autoSpeak, false),
    tapToSpeak: bool(st.tapToSpeak, true),
    speechRate: clamp(num(st.speechRate, 0.9), 0.5, 1.5),
  };

  s.wallet.cny = int(raw.wallet?.cny, STARTING_CNY);

  const p = isObj(raw.progress) ? raw.progress : {};
  s.progress.exp = int(p.exp, 0);
  s.progress.mealsCompleted = int(p.mealsCompleted, 0);
  s.progress.badges = mapObj(p.badges, (v) => (typeof v === 'string' ? v : null));

  s.restaurants = mapObj(raw.restaurants, (r) => isObj(r) ? {
    visits: int(r.visits, 0),
    completions: int(r.completions, 0),
    bestScore: clamp(int(r.bestScore, 0), 0, 100),
    bestStars: clamp(int(r.bestStars, 0), 0, 3),
    lastVisitedAt: typeof r.lastVisitedAt === 'string' ? r.lastVisitedAt : null,
  } : null);

  s.phrasebook = mapObj(raw.phrasebook, (e) => isObj(e) ? {
    seen: int(e.seen, 0),
    correct: int(e.correct, 0),
    lastSeenAt: typeof e.lastSeenAt === 'string' ? e.lastSeenAt : null,
  } : null);

  s.activeMeal = sanitizeMeal(raw.activeMeal);
  return s;
}

function sanitizeMeal(m) {
  if (!isObj(m) || typeof m.restaurantId !== 'string' || typeof m.nodeId !== 'string') return null;
  const order = Array.isArray(m.order) ? m.order.flatMap((line) => {
    if (!isObj(line) || typeof line.itemId !== 'string') return [];
    return [{
      itemId: line.itemId,
      qty: clamp(int(line.qty, 1), 1, 20),
      choices: mapObj(line.choices, (ids) => Array.isArray(ids) ? ids.filter((x) => typeof x === 'string') : null),
    }];
  }) : [];
  return {
    restaurantId: m.restaurantId,
    nodeId: m.nodeId,
    order,
    score: int(m.score, 0),
    maxScore: int(m.maxScore, 0),
    answered: mapObj(m.answered, (v) => (v === true ? true : null)),
    flags: mapObj(m.flags, (v) => (['string', 'number', 'boolean'].includes(typeof v) ? v : null)),
    startedAt: isoOr(m.startedAt, new Date().toISOString()),
  };
}

// ---------------------------------------------------------------------------
// Tiny coercion helpers

const UNSAFE_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

function isObj(v) { return v !== null && typeof v === 'object' && !Array.isArray(v); }
function str(v, fallback) { return typeof v === 'string' ? v : fallback; }
function bool(v, fallback) { return typeof v === 'boolean' ? v : fallback; }
function num(v, fallback) { return typeof v === 'number' && Number.isFinite(v) ? v : fallback; }
function int(v, fallback) { return Math.max(0, Math.round(num(v, fallback))); }
function clamp(v, lo, hi) { return Math.min(hi, Math.max(lo, v)); }
function isoOr(v, fallback) { return typeof v === 'string' && !Number.isNaN(Date.parse(v)) ? v : fallback; }

/** Copy an object's entries through `fn`, dropping nulls and prototype-polluting keys. */
function mapObj(v, fn) {
  const out = {};
  if (!isObj(v)) return out;
  for (const [k, val] of Object.entries(v)) {
    if (UNSAFE_KEYS.has(k) || k.length > 200) continue;
    const mapped = fn(val);
    if (mapped !== null && mapped !== undefined) out[k] = mapped;
  }
  return out;
}
