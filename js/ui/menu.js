// Menu Modal: browse dishes, customize (少辣 / 不要香菜 …), build an order, submit.

import { h, $ } from './dom.js';
import { tri, inline, speakButton } from './text.js';
import { getState } from '../core/store.js';
import { setOrder } from '../core/actions.js';
import {
  addLine, defaultChoices, describeLine, getGroup, getItem, linePrice, orderPhrase, orderTotal, removeOne, unitPrice,
} from '../engine/order.js';

const TITLE = { zh: '菜单', zht: '菜單', py: 'càidān', en: 'Menu' };
const SAY_IT = { zh: '你可以说：', zht: '你可以說：', py: 'Nǐ kěyǐ shuō:', en: 'You can say:' };
const TAGS = {
  signature: { emoji: '🏆', zh: '招牌', py: 'zhāopái', en: 'House special' },
  vegetarian: { emoji: '🌱', zh: '素', py: 'sù', en: 'Vegetarian' },
  spicy: { emoji: '🌶️', zh: '辣', py: 'là', en: 'Spicy' },
};

let dlg;
let m = null; // { restaurant, draft, editing, selection, onSubmit }

export function initMenu() {
  dlg = document.getElementById('menu-dialog');
  dlg.addEventListener('close', () => { m = null; });
  // Click on the backdrop closes the sheet.
  dlg.addEventListener('click', (e) => { if (e.target === dlg) dlg.close(); });
}

export function openMenu(restaurant, { onSubmit }) {
  m = {
    restaurant,
    draft: structuredClone(getState().activeMeal?.order ?? []),
    editing: null,
    selection: null,
    onSubmit,
  };
  render();
  dlg.showModal();
}

function menu() {
  return m.restaurant.menu;
}

function render() {
  dlg.replaceChildren(
    h('div', { class: 'sheet-inner' },
      h('header', { class: 'sheet-head' },
        m.editing
          ? h('button', { type: 'button', class: 'btn btn-ghost btn-sm', onClick: () => { m.editing = null; render(); } }, '← Menu')
          : h('h2', { class: 'sheet-title' }, '📖 ', inline(TITLE)),
        h('button', { type: 'button', class: 'icon-btn icon-btn-dark', 'aria-label': 'Close menu', onClick: () => dlg.close() }, '✕')),
      h('div', { class: 'sheet-body', id: 'menu-body' }, m.editing ? customizeView() : listView()),
      cartView()));
  $('#menu-body', dlg).scrollTop = 0;
  if (m.editing) refreshCustomize();
}

// ---- Dish list -------------------------------------------------------------

function listView() {
  // `hidden` items (broths, sauce-bar fees…) are only ever added by dialogue.
  const visible = (cat) => cat.items.filter((item) => !item.hidden);
  return menu().categories.filter((cat) => visible(cat).length).map((cat) => h('section', { class: 'menu-cat' },
    h('h3', { class: 'menu-cat-title' }, inline(cat.name)),
    h('ul', { class: 'menu-items', role: 'list' }, visible(cat).map((item) => h('li', null,
      h('button', {
        type: 'button', class: 'menu-item',
        onClick: () => { m.editing = item.id; m.selection = defaultChoices(menu(), item); render(); },
      },
      h('span', { class: 'menu-emoji', 'aria-hidden': 'true' }, item.emoji),
      h('span', { class: 'menu-item-body' },
        tri(item.name, { size: 'md' }),
        item.tags?.length > 0 && h('span', { class: 'tags' }, item.tags.map((t) => TAGS[t] && h('span', { class: 'tag' }, `${TAGS[t].emoji} ${TAGS[t].en}`)))),
      h('span', { class: 'price' }, item.price === 0 ? 'Free' : `¥${item.price}`),
      h('span', { class: 'add-mark', 'aria-hidden': 'true' }, '+')))))));
}

// ---- Customize one dish ----------------------------------------------------

function customizeView() {
  const item = getItem(menu(), m.editing);
  return [
    h('div', { class: 'dish-head' },
      h('span', { class: 'dish-emoji', 'aria-hidden': 'true' }, item.emoji),
      h('div', null, h('h2', { class: 'dish-title' }, tri(item.name, { size: 'lg' })),
        h('span', { class: 'price' }, item.price === 0 ? 'Free' : `¥${item.price}`))),
    item.note && h('p', { class: 'note' }, h('span', { class: 'note-icon', 'aria-hidden': 'true' }, '🏮'), item.note),
    (item.options ?? []).map((gid) => optionGroup(gid, getGroup(menu(), gid))),
    h('div', { class: 'say-it', id: 'say-it' }),
    h('button', { type: 'button', class: 'btn btn-primary btn-block', id: 'add-btn', onClick: addCurrent }),
  ].flat();
}

function optionGroup(gid, group) {
  const multi = group.type === 'multi';
  return h('fieldset', { class: 'opt-group' },
    h('legend', null, inline(group.label), multi && h('small', null, ' · pick any')),
    group.note && h('p', { class: 'opt-note' }, group.note),
    h('div', { class: 'opt-chips' }, group.choices.map((c) => h('label', { class: 'opt-chip' },
      h('input', {
        type: multi ? 'checkbox' : 'radio',
        name: `opt-${gid}`,
        value: c.id,
        checked: m.selection[gid]?.includes(c.id),
        onChange: () => onOptionChange(gid, multi),
      }),
      h('span', { class: 'opt-chip-face' },
        tri(c.text, { size: 'sm' }),
        c.price ? h('span', { class: 'opt-price' }, `+¥${c.price}`) : null)))));
}

function onOptionChange(gid, multi) {
  const inputs = dlg.querySelectorAll(`input[name="opt-${gid}"]`);
  m.selection[gid] = [...inputs].filter((i) => i.checked).map((i) => i.value);
  if (!multi && m.selection[gid].length === 0) return;
  refreshCustomize();
}

function currentLine() {
  return { itemId: m.editing, qty: 1, choices: structuredClone(m.selection) };
}

function refreshCustomize() {
  const line = currentLine();
  const phrase = orderPhrase(menu(), line);
  $('#say-it', dlg).replaceChildren(
    h('span', { class: 'say-it-label' }, inline(SAY_IT)),
    h('div', { class: 'say-it-row' }, tri(phrase, { size: 'md', peekable: true }), speakButton(phrase)));
  const price = unitPrice(menu(), line);
  $('#add-btn', dlg).textContent = `Add to order · 加入 · ¥${price}`;
}

function addCurrent() {
  m.draft = addLine(m.draft, currentLine());
  m.editing = null;
  render();
  $('.cart', dlg)?.classList.add('bump');
}

// ---- Cart footer -----------------------------------------------------------

function cartView() {
  const total = orderTotal(menu(), m.draft);
  const wallet = getState().wallet.cny;
  const tooPoor = total > wallet;
  const empty = m.draft.length === 0;

  const footer = h('footer', { class: 'cart' },
    empty
      ? h('p', { class: 'cart-empty' }, inline({ zh: '还没点菜', zht: '還沒點菜', py: 'hái méi diǎn cài', en: 'Nothing ordered yet' }))
      : h('ul', { class: 'cart-lines', role: 'list' }, m.draft.map((line, i) => {
          const d = describeLine(menu(), line);
          return h('li', { class: 'cart-line' },
            h('span', { class: 'cart-line-name' }, inline(d)),
            h('span', { class: 'price' }, `¥${linePrice(menu(), line)}`),
            line.locked
              ? h('span', { class: 'cart-lock', title: 'Added during the conversation', 'aria-label': 'Included — added during the conversation' }, '🔒')
              : h('button', {
                  type: 'button', class: 'icon-btn icon-btn-dark icon-btn-sm', 'aria-label': `Remove one ${d.en}`,
                  onClick: () => { m.draft = removeOne(m.draft, i); render(); },
                }, '−'));
        })),
    h('div', { class: 'cart-total' },
      h('span', null, 'Total ', h('strong', null, `¥${total}`)),
      h('span', { class: tooPoor ? 'wallet is-short' : 'wallet' }, `Wallet ¥${wallet}`)),
    tooPoor && h('p', { class: 'cart-warn' }, inline({ zh: '钱不够！', zht: '錢不夠！', py: 'Qián bú gòu!', en: 'Not enough money — remove something.' })),
    h('button', {
      type: 'button', class: 'btn btn-primary btn-block', disabled: empty || tooPoor, onClick: submit,
    }, 'Place order · ', h('span', { class: 'zh-s', lang: 'zh-Hans' }, '点好了'), h('span', { class: 'zh-t', lang: 'zh-Hant' }, '點好了')));

  return footer;
}

function submit() {
  const { draft, onSubmit } = m;
  setOrder(draft);
  dlg.close();
  onSubmit();
}
