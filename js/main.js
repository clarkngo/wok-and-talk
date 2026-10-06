// Entry point: boot the store, load the catalog, wire screens together.
//
// Flow:  Hub ──► Dining Room ──(openMenu)──► Menu Modal ──► Dining Room ──(checkout)──► Checkout ──► Hub

import * as store from './core/store.js';
import { loadCatalog } from './core/content.js';
import { levelInfo } from './engine/rewards.js';
import { h } from './ui/dom.js';
import { showScreen, screenRoot } from './ui/screens.js';
import { toast } from './ui/toast.js';
import { initHub, renderHub } from './ui/hub.js';
import { initDining, enterDining } from './ui/dining.js';
import { initMenu } from './ui/menu.js';
import { initCheckout, renderCheckout } from './ui/checkout.js';
import { initSettings, applySettings } from './ui/settings.js';

const nav = {
  toHub() {
    renderHub();
    showScreen('hub');
  },
  toDining(restaurantId, opts) {
    return enterDining(restaurantId, opts);
  },
  toCheckout(result) {
    renderCheckout(result);
  },
};

function renderTopbar(state) {
  const lvl = levelInfo(state.progress.exp);
  const level = document.getElementById('stat-level');
  const wallet = document.getElementById('stat-wallet');
  level.textContent = `Lv ${lvl.level}`;
  level.title = `Foodie level ${lvl.level} · ${lvl.into}/${lvl.needed} EXP to next level`;
  wallet.textContent = `¥${state.wallet.cny}`;
}

function wireGlobalUI() {
  document.addEventListener('click', (e) => {
    // Brand button → hub
    if (e.target.closest('[data-nav="hub"]')) {
      if (document.documentElement.dataset.activeScreen !== 'error') nav.toHub();
      return;
    }
    // Tap a peekable line to temporarily reveal hidden Pinyin/English.
    const peek = e.target.closest('[data-peekable]');
    if (peek && !e.target.closest('button')) peek.classList.toggle('peek');
  });
}

function showBootError(err) {
  console.error(err);
  const isFile = location.protocol === 'file:';
  screenRoot('error').replaceChildren(
    h('div', { class: 'boot-error' },
      h('h1', null, '🥡 The kitchen is closed'),
      h('p', null, isFile
        ? 'Browsers block loading game data from file:// pages. Start a local web server in the project folder instead:'
        : `Couldn't load game data (${err.message}).`),
      isFile && h('pre', null, 'python3 -m http.server 8000'),
      h('button', { type: 'button', class: 'btn btn-primary', onClick: () => location.reload() }, 'Try again')));
  showScreen('error');
}

async function boot() {
  const state = store.getState();
  applySettings(state.settings);
  renderTopbar(state);

  store.subscribe((s) => {
    applySettings(s.settings);
    renderTopbar(s);
    if (document.documentElement.dataset.activeScreen === 'hub') renderHub();
  });

  wireGlobalUI();
  initSettings();
  initMenu();

  let catalog;
  try {
    catalog = await loadCatalog();
  } catch (err) {
    return showBootError(err);
  }

  const context = { catalog, nav };
  initHub(context);
  initDining(context);
  initCheckout(context);

  nav.toHub();

  if (store.loadIssue === 'corrupt') toast('Your saved game was damaged, so a fresh one was started. A backup was kept.', 'error', 6000);
  if (store.loadIssue === 'unavailable') toast('Storage is blocked — use Export to keep your progress.', 'error', 6000);
}

boot();
