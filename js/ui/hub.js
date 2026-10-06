// Restaurant Selection Hub.

import { h, mount } from './dom.js';
import { tri, inline } from './text.js';
import { screenRoot } from './screens.js';
import { getState } from '../core/store.js';
import { abandonMeal } from '../core/actions.js';
import { levelInfo } from '../engine/rewards.js';

const GREETING = {
  zh: '今天想吃什么？', zht: '今天想吃什麼？',
  py: 'Jīntiān xiǎng chī shénme?', en: 'What do you feel like eating today?',
};
const COMING_SOON = { zh: '敬请期待', zht: '敬請期待', py: 'jìngqǐng qīdài', en: 'Coming soon' };

let ctx;

export function initHub(context) {
  ctx = context;
}

export function renderHub() {
  const state = getState();
  const { catalog, nav } = ctx;
  const lvl = levelInfo(state.progress.exp);
  const byId = Object.fromEntries(catalog.restaurants.map((r) => [r.id, r]));

  const root = screenRoot('hub');
  mount(root,
    h('div', { class: 'hub-hero' },
      h('h1', { class: 'hub-title' }, `你好, ${state.profile.name}!`),
      tri(GREETING, { size: 'md', peekable: true }),
      h('div', { class: 'xp', role: 'group', 'aria-label': 'Foodie EXP' },
        h('div', { class: 'xp-row' },
          h('strong', null, `Lv ${lvl.level} Foodie`),
          h('span', null, `${lvl.into} / ${lvl.needed} EXP`)),
        h('div', { class: 'xp-bar', role: 'progressbar', 'aria-valuemin': 0, 'aria-valuemax': lvl.needed, 'aria-valuenow': lvl.into },
          h('span', { style: { width: `${Math.round(lvl.pct * 100)}%` } })))),

    state.activeMeal && byId[state.activeMeal.restaurantId] && resumeBanner(byId[state.activeMeal.restaurantId], nav),

    h('h2', { class: 'section-title' }, 'Pick a restaurant'),
    h('ul', { class: 'restaurant-grid', role: 'list' },
      catalog.restaurants.map((r) => h('li', null, restaurantCard(r, state, nav)))),

    h('h2', { class: 'section-title' }, 'Badges ',
      h('span', { class: 'count' }, `${Object.keys(state.progress.badges).length}/${catalog.badges.length}`)),
    h('ul', { class: 'badge-shelf', role: 'list' },
      catalog.badges.map((b) => badgeTile(b, state.progress.badges[b.id]))),
  );
}

function resumeBanner(r, nav) {
  return h('div', { class: 'resume-banner' },
    h('span', { class: 'resume-emoji', 'aria-hidden': 'true' }, r.emoji),
    h('div', { class: 'resume-text' },
      h('strong', null, 'Meal in progress'),
      h('span', null, inline(r.name))),
    h('div', { class: 'resume-actions' },
      h('button', { type: 'button', class: 'btn btn-primary btn-sm', onClick: () => nav.toDining(r.id, { resume: true }) }, 'Resume'),
      h('button', {
        type: 'button', class: 'btn btn-ghost btn-sm',
        onClick: () => { if (confirm('Leave this meal? Your conversation progress here will be lost.')) { abandonMeal(); renderHub(); } },
      }, 'Leave')));
}

function restaurantCard(r, state, nav) {
  const playable = r.status === 'playable';
  const prog = state.restaurants[r.id];
  const stars = prog?.bestStars ?? 0;

  const onClick = () => {
    const meal = getState().activeMeal;
    if (meal && meal.restaurantId === r.id) return nav.toDining(r.id, { resume: true });
    if (meal && !confirm('You have a meal in progress elsewhere. Leave it and come here instead?')) return;
    nav.toDining(r.id);
  };

  return h('button', {
    type: 'button',
    class: `restaurant-card${playable ? '' : ' is-locked'}`,
    style: { '--card-a': r.colors[0], '--card-b': r.colors[1] },
    disabled: !playable,
    onClick: playable ? onClick : undefined,
  },
  h('span', { class: 'card-art', 'aria-hidden': 'true' }, r.emoji),
  h('span', { class: 'card-body' },
    h('span', { class: 'card-cuisine' }, inline(r.cuisine)),
    tri(r.name, { size: 'md' }),
    h('span', { class: 'card-blurb' }, r.blurb),
    h('span', { class: 'card-meta' },
      h('span', { class: 'difficulty', title: `Difficulty ${r.difficulty}/3` },
        h('span', { 'aria-hidden': 'true' }, '🌶️'.repeat(r.difficulty)),
        h('span', { class: 'visually-hidden' }, `Difficulty ${r.difficulty} of 3`)),
      playable
        ? h('span', { class: 'stars', title: 'Best result' },
            h('span', { 'aria-hidden': 'true' }, '★'.repeat(stars) + '☆'.repeat(3 - stars)),
            h('span', { class: 'visually-hidden' }, `Best: ${stars} of 3 stars`))
        : h('span', { class: 'soon' }, inline(COMING_SOON)))));
}

function badgeTile(b, earnedAt) {
  return h('li', {
    class: `badge${earnedAt ? ' is-earned' : ''}`,
    title: earnedAt ? `${b.name.en} — earned ${new Date(earnedAt).toLocaleDateString()}` : `Locked: ${b.hint}`,
  },
  h('span', { class: 'badge-emoji', 'aria-hidden': 'true' }, earnedAt ? b.emoji : '🔒'),
  h('span', { class: 'badge-name' }, inline(b.name)),
  h('span', { class: 'badge-hint' }, earnedAt ? b.hint : `Locked · ${b.hint}`));
}
