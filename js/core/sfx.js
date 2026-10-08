// Sound effects, synthesized on the fly with the Web Audio API — no audio files.
// Melodic cues use the Chinese pentatonic scale (宫商角徵羽: C D E G A) for flavor.
// The AudioContext is created lazily on the first play(), which always happens inside
// a user gesture (click/tap), so browsers' autoplay rules are satisfied.

import { getState } from './store.js';

let ctx = null;
let master = null;

function audio() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.6;
    master.connect(ctx.destination);
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

/** One enveloped oscillator note. Times are seconds from now. */
function tone(freq, start, dur, { type = 'sine', gain = 0.2, attack = 0.005, to } = {}) {
  const t0 = ctx.currentTime + start;
  const osc = ctx.createOscillator();
  const env = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (to) osc.frequency.exponentialRampToValueAtTime(to, t0 + dur);
  env.gain.setValueAtTime(0.0001, t0);
  env.gain.exponentialRampToValueAtTime(gain, t0 + attack);
  env.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(env).connect(master);
  osc.start(t0);
  osc.stop(t0 + dur + 0.05);
}

/** A filtered burst of white noise (paper, clicks, the register drawer). */
function noise(start, dur, { gain = 0.15, freq = 2000, type = 'bandpass', q = 1 } = {}) {
  const t0 = ctx.currentTime + start;
  const buffer = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * dur), ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  const src = ctx.createBufferSource();
  const filter = ctx.createBiquadFilter();
  const env = ctx.createGain();
  src.buffer = buffer;
  filter.type = type;
  filter.frequency.value = freq;
  filter.Q.value = q;
  env.gain.setValueAtTime(gain, t0);
  env.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  src.connect(filter).connect(env).connect(master);
  src.start(t0);
  src.stop(t0 + dur);
}

// Pentatonic pitches (Hz)
const P = { C5: 523.25, D5: 587.33, E5: 659.25, G5: 783.99, A5: 880, C6: 1046.5, D6: 1174.66, E6: 1318.51, G6: 1567.98, A6: 1760 };

const SOUNDS = {
  /** Soft wood-block tap for Continue buttons. */
  tap() {
    tone(1250, 0, 0.06, { type: 'sine', gain: 0.12, to: 850 });
    noise(0, 0.02, { gain: 0.05, freq: 3500 });
  },
  /** Tiny tick for toggles and switches. */
  tick() {
    tone(2600, 0, 0.025, { type: 'square', gain: 0.025 });
  },
  /** Correct answer: bright rising pentatonic chime. */
  best() {
    [P.G5, P.C6, P.E6].forEach((f, i) => tone(f, i * 0.07, 0.4, { type: 'triangle', gain: 0.16 }));
    tone(P.E6 * 2, 0.2, 0.35, { gain: 0.04 });
  },
  /** Acceptable answer: gentle two-note shrug. */
  ok() {
    tone(P.E5, 0, 0.25, { type: 'triangle', gain: 0.13 });
    tone(P.D5, 0.12, 0.3, { type: 'triangle', gain: 0.11 });
  },
  /** Wrong answer: a low, friendly "bonk-bonk". */
  wrong() {
    tone(240, 0, 0.18, { type: 'square', gain: 0.06, to: 170 });
    tone(200, 0.13, 0.24, { type: 'square', gain: 0.06, to: 130 });
  },
  /** Unscored reply. */
  neutral() {
    tone(P.G5, 0, 0.18, { type: 'triangle', gain: 0.1 });
  },
  /** Bubbly pop when a dish goes into the cart. */
  add() {
    tone(380, 0, 0.1, { gain: 0.2, to: 950 });
    tone(P.C6, 0.06, 0.15, { type: 'triangle', gain: 0.06 });
  },
  /** Reverse pop when a dish is removed. */
  remove() {
    tone(800, 0, 0.1, { gain: 0.16, to: 300 });
  },
  /** Menu opening: a quick paper rustle. */
  page() {
    noise(0, 0.1, { gain: 0.14, freq: 2800, q: 0.7 });
    noise(0.07, 0.12, { gain: 0.1, freq: 4200, q: 0.7 });
  },
  /** Order placed: a service bell — 叮! */
  bell() {
    tone(2093, 0, 1.3, { gain: 0.12, attack: 0.002 });
    tone(2093 * 2.76, 0, 0.6, { gain: 0.035, attack: 0.002 });
    tone(2093 * 5.4, 0, 0.25, { gain: 0.015, attack: 0.002 });
  },
  /** Entering a restaurant: a soft gong. */
  gong() {
    tone(98, 0, 2.2, { gain: 0.22, attack: 0.01, to: 92 });
    tone(98 * 2.42, 0, 1.6, { gain: 0.08, attack: 0.01 });
    tone(98 * 3.95, 0, 1.0, { gain: 0.04, attack: 0.01 });
    noise(0, 0.25, { gain: 0.04, freq: 500, type: 'lowpass' });
  },
  /** Checkout: cash register ka-ching. */
  register() {
    noise(0, 0.03, { gain: 0.2, freq: 3000, type: 'highpass' });
    noise(0.07, 0.06, { gain: 0.16, freq: 1800, q: 2 });
    tone(P.E6 * 2, 0.14, 0.7, { type: 'triangle', gain: 0.07, attack: 0.002 });
    tone(P.A6 * 2, 0.2, 0.9, { type: 'triangle', gain: 0.07, attack: 0.002 });
  },
  /** Badge unlocked: a little pentatonic fanfare. */
  badge() {
    [P.C5, P.D5, P.E5, P.G5, P.A5].forEach((f, i) => tone(f, i * 0.08, 0.2, { type: 'triangle', gain: 0.12 }));
    [P.C6, P.E6, P.G6].forEach((f) => tone(f, 0.42, 0.8, { type: 'triangle', gain: 0.08 }));
  },
  /** Level up: whoosh plus a rising run. */
  levelUp() {
    tone(260, 0, 0.45, { type: 'sawtooth', gain: 0.04, to: 1300 });
    [P.G5, P.A5, P.C6, P.D6, P.E6, P.G6].forEach((f, i) => tone(f, 0.25 + i * 0.06, 0.3, { type: 'triangle', gain: 0.11 }));
  },
};

export function play(name) {
  if (!getState().settings.soundEffects) return;
  if (!audio()) return;
  try {
    SOUNDS[name]?.();
  } catch (err) {
    console.warn('[sfx]', err);
  }
}

/** Play several sounds in sequence: playSequence([['register', 0], ['badge', 700]]). */
export function playSequence(steps) {
  for (const [name, delayMs] of steps) setTimeout(() => play(name), delayMs);
}
