// Dining Room: renders the scene, the NPC dialogue box, choices and feedback.

import { h, $, mount } from './dom.js';
import { tri, inline, speakButton } from './text.js';
import { screenRoot, showScreen } from './screens.js';
import { openMenu } from './menu.js';
import { syncSettingControls } from './settings.js';
import { toast } from './toast.js';
import { getState } from '../core/store.js';
import { loadRestaurant } from '../core/content.js';
import { speak } from '../core/speech.js';
import * as actions from '../core/actions.js';
import { getNode, interpolate, resolveChoice, visibleChoices } from '../engine/dialogue.js';
import { describeOrder, orderTotal } from '../engine/order.js';

const NARRATOR = { avatar: '📜', name: { zh: '旁白', zht: '旁白', py: 'pángbái', en: 'Narrator' } };

const GRADE_UI = {
  best:    { icon: '✓', label: 'Perfect!',        zh: '很好！', py: 'Hěn hǎo!' },
  ok:      { icon: '◐', label: 'Understood, but…', zh: '还行。', zht: '還行。', py: 'Hái xíng.' },
  wrong:   { icon: '✗', label: 'Not quite',        zh: '不对。', zht: '不對。', py: 'Bú duì.' },
  neutral: { icon: '→', label: 'Okay',             zh: '好的。', py: 'Hǎo de.' },
};

let ctx;
let restaurant = null;

export function initDining(context) {
  ctx = context;
  document.addEventListener('keydown', onKey);
}

export async function enterDining(restaurantId, { resume = false } = {}) {
  try {
    restaurant = await loadRestaurant(restaurantId);
  } catch (err) {
    console.error(err);
    toast(`Couldn't load that restaurant. ${err.message}`, 'error');
    return ctx.nav.toHub();
  }
  const meal = getState().activeMeal;
  if (!resume || meal?.restaurantId !== restaurant.id || !(meal.nodeId in restaurant.dialogue)) {
    actions.startMeal(restaurant);
  }
  renderShell();
  showScreen('dining');
  renderNode(getState().activeMeal.nodeId);
}

// ---------------------------------------------------------------------------

function renderShell() {
  const r = restaurant;
  const props = (r.scene.props ?? []).map((p, i) => h('span', { class: `prop prop-${i}` }, p));
  screenRoot('dining').replaceChildren(
    h('div', { class: 'scene', style: { '--scene-a': r.scene.colors[0], '--scene-b': r.scene.colors[1] } },
      h('div', { class: 'scene-bar' },
        h('button', { type: 'button', class: 'btn btn-glass btn-sm', onClick: leave }, '← Leave'),
        h('h1', { class: 'scene-title' }, tri(r.name, { size: 'sm' })),
        layerToggles()),
      h('div', { class: 'scene-art', 'aria-hidden': 'true' },
        props,
        h('span', { class: 'scene-npc', id: 'scene-npc' }, ''))),
    h('article', { class: 'dialogue', id: 'dialogue', 'aria-live': 'polite' }));
  syncSettingControls();
}

function layerToggles() {
  return h('div', { class: 'layer-toggles', role: 'group', 'aria-label': 'Text layers' },
    h('button', { type: 'button', class: 'toggle', 'data-setting': 'showPinyin', 'aria-pressed': 'true' }, 'Pīnyīn'),
    h('button', { type: 'button', class: 'toggle', 'data-setting': 'showEnglish', 'aria-pressed': 'true' }, 'EN'),
    h('button', {
      type: 'button', class: 'toggle', 'data-setting': 'script', 'data-value': 'traditional', 'data-off': 'simplified',
      'aria-pressed': 'false', title: 'Traditional characters', lang: 'zh-Hant', 'data-no-speak': '',
    }, '繁'));
}

function leave() {
  // Progress is saved on every step, so leaving is always safe.
  toast('Meal saved — resume it any time from the hub.');
  ctx.nav.toHub();
}

function speakerInfo(id) {
  return id === 'narrator' ? NARRATOR : restaurant.npcs[id];
}

function mealVars() {
  const meal = getState().activeMeal;
  return {
    order: describeOrder(restaurant.menu, meal.order),
    total: orderTotal(restaurant.menu, meal.order),
  };
}

function renderNode(nodeId) {
  const node = getNode(restaurant, nodeId);
  actions.setNode(nodeId);

  const speaker = speakerInfo(node.speaker);
  const line = node.line && interpolate(node.line, mealVars());
  const box = $('#dialogue');
  $('#scene-npc').textContent = speaker.avatar;

  mount(box,
    h('header', { class: 'speaker' },
      h('span', { class: 'speaker-avatar', 'aria-hidden': 'true' }, speaker.avatar),
      h('span', { class: 'speaker-name' }, inline(speaker.name))),
    line && h('div', { class: `line${node.speaker === 'narrator' ? ' is-narration' : ''}` },
      tri(line, { size: 'lg', peekable: true }),
      speakButton(line)),
    node.note && h('aside', { class: 'note' }, h('span', { class: 'note-icon', 'aria-hidden': 'true' }, '🏮'), node.note),
    h('div', { class: 'responses', id: 'responses' }),
    h('div', { class: 'feedback-slot', id: 'feedback' }));

  box.classList.remove('enter');
  void box.offsetWidth; // restart the entrance animation
  box.classList.add('enter');

  if (node.choices) renderChoices(node, nodeId);
  else if (node.action) renderAction(node);
  else renderContinue(node.next);

  if (line && getState().settings.autoSpeak) speak(line.zh, getState().settings.speechRate);
  focusFirst();
}

function renderChoices(node, nodeId) {
  const flags = getState().activeMeal.flags;
  const list = h('ol', { class: 'choices', 'aria-label': 'Your reply' },
    visibleChoices(node, flags).map((choice, i) => h('li', null,
      h('button', {
        type: 'button',
        class: 'choice',
        dataset: { key: String(i + 1) },
        onClick: (e) => pick(node, nodeId, choice, e.currentTarget),
      },
      h('span', { class: 'choice-key', 'aria-hidden': 'true' }, String(i + 1)),
      tri(choice.text, { size: 'md' })))));
  $('#responses').replaceChildren(list);
}

function pick(node, nodeId, choice, btn) {
  const result = resolveChoice(node, choice);
  actions.recordAnswer(restaurant, nodeId, choice, result);
  if (getState().settings.autoSpeak) speak(choice.text.zh, getState().settings.speechRate);

  btn.classList.add(`is-${result.grade}`);
  if (result.retry) {
    btn.disabled = true;
  } else {
    for (const b of document.querySelectorAll('#responses .choice')) {
      b.disabled = true;
      if (b !== btn) b.classList.add('is-dimmed');
    }
  }

  const ui = GRADE_UI[result.grade];
  const panel = h('div', { class: `feedback feedback-${result.grade}`, role: 'status' },
    h('p', { class: 'feedback-head' },
      h('span', { class: 'feedback-icon', 'aria-hidden': 'true' }, ui.icon),
      h('strong', null, ui.label),
      ' ',
      h('span', { class: 'feedback-zh' }, h('span', { class: 'zh-s', lang: 'zh-Hans' }, ui.zh), h('span', { class: 'zh-t', lang: 'zh-Hant' }, ui.zht ?? ui.zh)),
      h('span', { class: 'feedback-py' }, ui.py)),
    choice.feedback && h('p', null, choice.feedback),
    choice.note && h('p', { class: 'note' }, h('span', { class: 'note-icon', 'aria-hidden': 'true' }, '🏮'), choice.note),
    result.retry
      ? h('p', { class: 'feedback-hint' }, 'Pick another reply.')
      : continueButton(result.next));

  mount($('#feedback'), panel);
  panel.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  if (!result.retry) panel.querySelector('button')?.focus({ preventScroll: true });
}

function continueButton(next, label = 'Continue') {
  return h('button', { type: 'button', class: 'btn btn-primary btn-block', onClick: () => renderNode(next) },
    `${label} · `, h('span', { class: 'zh-s', lang: 'zh-Hans' }, '继续'), h('span', { class: 'zh-t', lang: 'zh-Hant' }, '繼續'), ' →');
}

function renderContinue(next) {
  $('#responses').replaceChildren(continueButton(next));
}

function renderAction(node) {
  const slot = $('#responses');
  if (node.action === 'openMenu') {
    const open = () => openMenu(restaurant, { onSubmit: () => renderNode(node.next) });
    slot.replaceChildren(
      h('button', { type: 'button', class: 'btn btn-primary btn-block', onClick: open },
        '📖 Open the menu · ', h('span', { class: 'zh-s', lang: 'zh-Hans' }, '看菜单'), h('span', { class: 'zh-t', lang: 'zh-Hant' }, '看菜單')));
  } else if (node.action === 'checkout') {
    const total = orderTotal(restaurant.menu, getState().activeMeal.order);
    slot.replaceChildren(
      h('button', {
        type: 'button', class: 'btn btn-primary btn-block',
        onClick: () => ctx.nav.toCheckout(actions.completeMeal(restaurant, ctx.catalog.badges)),
      }, `💳 Pay ¥${total} & finish · `, h('span', { class: 'zh-s', lang: 'zh-Hans' }, '结账'), h('span', { class: 'zh-t', lang: 'zh-Hant' }, '結賬')));
  }
}

function focusFirst() {
  const target = document.querySelector('#responses button:not(:disabled)');
  target?.focus({ preventScroll: true });
}

/** Number keys 1–9 pick a reply while the dining room is open. */
function onKey(e) {
  if (document.documentElement.dataset.activeScreen !== 'dining') return;
  if (document.querySelector('dialog[open]') || e.metaKey || e.ctrlKey || e.altKey) return;
  if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
  const btn = document.querySelector(`#responses .choice[data-key="${e.key}"]:not(:disabled)`);
  if (btn) {
    e.preventDefault();
    btn.click();
  }
}
