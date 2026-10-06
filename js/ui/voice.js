// Tap-to-speak: tapping any Chinese text in the game reads it aloud.
// Every Chinese string is rendered inside an element with lang="zh-Hans" / "zh-Hant"
// (see text.js), so one delegated listener covers dialogue, replies, menu, cart,
// receipt, badges and button labels. The hidden script is display:none, so the
// tapped element is always the one the player is looking at.
// Opt an element out with data-no-speak (e.g. the 简体/繁體 switches).

import { canSpeak, hasChineseVoice, speak } from '../core/speech.js';
import { getState } from '../core/store.js';
import { toast } from './toast.js';

let speakingEl = null;
let warned = false;

function clearHighlight() {
  speakingEl?.classList.remove('is-speaking');
  speakingEl = null;
}

export function initTapToSpeak() {
  // Capture phase, so we still hear the text when a button's own handler re-renders the page.
  document.addEventListener('click', (e) => {
    const { tapToSpeak, speechRate } = getState().settings;
    if (!tapToSpeak) return;
    const el = e.target.closest?.('[lang|="zh"]');
    if (!el || el.closest('[data-no-speak]')) return;
    const text = el.textContent.trim();
    if (!text) return;

    if (!canSpeak) {
      if (!warned) toast('Speech isn’t supported in this browser.', 'error');
      warned = true;
      return;
    }
    if (!hasChineseVoice() && !warned) {
      toast('No Mandarin voice found — install one in your device’s language settings for the best audio.', 'info', 5000);
      warned = true;
    }

    clearHighlight();
    speakingEl = el;
    el.classList.add('is-speaking');
    speak(text, speechRate, {
      onDone: () => { if (speakingEl === el) clearHighlight(); },
    });
  }, true);
}
