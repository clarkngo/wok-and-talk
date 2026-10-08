// Settings dialog: text-layer toggles, speech, profile, and Save Data (Import / Export / Reset).

import { h, $, $$ } from './dom.js';
import { toast } from './toast.js';
import * as store from '../core/store.js';
import { setSetting, setProfileName } from '../core/actions.js';
import { canSpeak, hasChineseVoice, speak } from '../core/speech.js';
import { levelInfo } from '../engine/rewards.js';
import { play } from '../core/sfx.js';

let dlg;

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

/** Reflect settings onto <html> classes (CSS shows/hides layers) and every [data-setting] control. */
export function applySettings(settings) {
  const root = document.documentElement;
  root.classList.toggle('hide-pinyin', !settings.showPinyin);
  root.classList.toggle('hide-english', !settings.showEnglish);
  root.classList.toggle('script-traditional', settings.script === 'traditional');
  root.classList.toggle('tap-speak', settings.tapToSpeak);
  syncSettingControls(settings);
}

export function syncSettingControls(settings = store.getState().settings) {
  for (const el of $$('[data-setting]')) {
    const value = settings[el.dataset.setting];
    if (el.type === 'checkbox') el.checked = !!value;
    else if (el.type === 'range') el.value = String(value);
    else if (el.tagName === 'BUTTON') {
      el.setAttribute('aria-pressed', String(el.dataset.value ? value === el.dataset.value : !!value));
    }
  }
}

/** Any element with data-setting works anywhere in the app (dining toggles, settings dialog). */
function wireSettingControls() {
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-setting]');
    if (!btn) return;
    const key = btn.dataset.setting;
    const current = store.getState().settings[key];
    if (btn.dataset.value) setSetting(key, current === btn.dataset.value ? btn.dataset.off : btn.dataset.value);
    else setSetting(key, !current);
    play('tick');
  });
  document.addEventListener('change', (e) => {
    const el = e.target;
    if (!(el instanceof HTMLInputElement) || !el.dataset.setting) return;
    if (el.type === 'checkbox') {
      setSetting(el.dataset.setting, el.checked);
      play('tick');
    }
    else if (el.type === 'range') setSetting(el.dataset.setting, Number(el.value));
  });
}

export function initSettings() {
  dlg = document.getElementById('settings-dialog');
  dlg.addEventListener('click', (e) => { if (e.target === dlg) dlg.close(); });
  wireSettingControls();
  document.addEventListener('click', (e) => {
    if (e.target.closest('[data-open="settings"]')) openSettings();
  });
}

export function openSettings() {
  render();
  dlg.showModal();
}

function switchRow(key, label, sub) {
  return h('label', { class: 'switch-row' },
    h('span', null, h('strong', null, label), sub && h('small', null, sub)),
    h('input', { type: 'checkbox', role: 'switch', class: 'switch', 'data-setting': key }));
}

function render() {
  const s = store.getState();
  const lvl = levelInfo(s.progress.exp);

  dlg.replaceChildren(h('div', { class: 'sheet-inner' },
    h('header', { class: 'sheet-head' },
      h('h2', { class: 'sheet-title' }, '⚙️ Settings'),
      h('button', { type: 'button', class: 'icon-btn icon-btn-dark', 'aria-label': 'Close settings', onClick: () => dlg.close() }, '✕')),

    h('div', { class: 'sheet-body' },
      h('section', { class: 'settings-section' },
        h('h3', null, 'Display'),
        switchRow('showPinyin', 'Show Pinyin', 'Tone-marked romanization above the characters'),
        switchRow('showEnglish', 'Show English', 'Hide it for a harder challenge — tap a line to peek'),
        h('div', { class: 'seg-row' },
          h('strong', null, 'Characters'),
          h('div', { class: 'segmented', role: 'group', 'aria-label': 'Character set' },
            h('button', { type: 'button', 'data-setting': 'script', 'data-value': 'simplified', 'data-off': 'simplified', lang: 'zh-Hans', 'data-no-speak': '' }, '简体 Simplified'),
            h('button', { type: 'button', 'data-setting': 'script', 'data-value': 'traditional', 'data-off': 'traditional', lang: 'zh-Hant', 'data-no-speak': '' }, '繁體 Traditional')))),

      h('section', { class: 'settings-section' },
        h('h3', null, 'Audio'),
        canSpeak
          ? [
              switchRow('soundEffects', 'Sound effects', 'Chimes, pops, bells and gongs as you play'),
              switchRow('tapToSpeak', 'Tap Chinese to hear it', 'Tap any Chinese characters in the game to hear them spoken'),
              switchRow('autoSpeak', 'Read lines aloud', hasChineseVoice() ? 'Uses your device’s Mandarin voice' : 'No Mandarin voice found — install one in your OS settings'),
              h('label', { class: 'range-row' },
                h('strong', null, 'Speech speed'),
                h('input', { type: 'range', min: '0.5', max: '1.2', step: '0.1', 'data-setting': 'speechRate' }),
                h('button', { type: 'button', class: 'btn btn-ghost btn-sm', onClick: () => speak('你好，欢迎光临！', store.getState().settings.speechRate) }, '🔊 Test')),
            ]
          : h('p', { class: 'muted' }, 'Speech isn’t supported in this browser.')),

      h('section', { class: 'settings-section' },
        h('h3', null, 'Profile'),
        h('label', { class: 'field' },
          h('span', null, 'Your name'),
          h('input', {
            type: 'text', maxlength: '40', value: s.profile.name, autocomplete: 'nickname',
            onChange: (e) => setProfileName(e.target.value),
          }))),

      h('section', { class: 'settings-section' },
        h('h3', null, 'Save data'),
        h('p', { class: 'muted' },
          store.isPersistent()
            ? `Progress saves automatically in this browser. Last saved ${new Date(s.meta.updatedAt).toLocaleString()}.`
            : '⚠️ This browser is blocking storage, so progress won’t survive a reload. Export to keep it.'),
        h('p', { class: 'save-summary' }, `Lv ${lvl.level} · ${s.progress.exp} EXP · ¥${s.wallet.cny} · ${plural(Object.keys(s.progress.badges).length, 'badge')} · ${plural(s.progress.mealsCompleted, 'meal')}`),
        h('div', { class: 'save-actions' },
          h('button', { type: 'button', class: 'btn btn-primary', onClick: onExport }, '⬇️ Export JSON'),
          h('label', { class: 'btn btn-ghost file-btn' },
            '⬆️ Import JSON',
            h('input', { type: 'file', accept: 'application/json,.json', class: 'visually-hidden', onChange: onImportFile }))),
        h('div', { id: 'import-preview' }),
        h('details', { class: 'danger-zone' },
          h('summary', null, 'Reset progress'),
          h('p', { class: 'muted' }, 'Erase all progress in this browser. Export first if you might want it back.'),
          h('button', { type: 'button', class: 'btn btn-danger', onClick: onReset }, 'Erase everything'))))));

  syncSettingControls();
}

function onExport() {
  try {
    store.exportSave();
    toast('Save file downloaded.', 'success');
  } catch (err) {
    console.error(err);
    toast('Export failed.', 'error');
  }
}

async function onImportFile(e) {
  const input = e.target;
  const file = input.files?.[0];
  input.value = ''; // allow re-selecting the same file
  if (!file) return;
  const slot = $('#import-preview', dlg);
  try {
    const next = await store.readSaveFile(file);
    const lvl = levelInfo(next.progress.exp);
    slot.replaceChildren(h('div', { class: 'import-card' },
      h('strong', null, `Import “${file.name}”?`),
      h('p', null, `${next.profile.name} · Lv ${lvl.level} · ${next.progress.exp} EXP · ¥${next.wallet.cny} · ${plural(Object.keys(next.progress.badges).length, 'badge')} · ${plural(next.progress.mealsCompleted, 'meal')}`),
      h('p', { class: 'muted' }, 'This replaces your current progress in this browser.'),
      h('div', { class: 'save-actions' },
        h('button', {
          type: 'button', class: 'btn btn-primary',
          onClick: () => { store.replaceState(next); toast('Save imported. 欢迎回来！', 'success'); render(); },
        }, 'Replace my progress'),
        h('button', { type: 'button', class: 'btn btn-ghost', onClick: () => slot.replaceChildren() }, 'Cancel'))));
  } catch (err) {
    slot.replaceChildren(h('p', { class: 'import-error', role: 'alert' }, `Couldn’t import: ${err.message}`));
  }
}

function onReset() {
  if (!confirm('Erase all Wok & Talk progress in this browser? This cannot be undone.')) return;
  store.resetState();
  toast('Progress reset. Fresh start!', 'success');
  render();
}
