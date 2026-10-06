// Checkout: receipt (小票) + rewards summary.

import { h, mount } from './dom.js';
import { tri, inline } from './text.js';
import { screenRoot, showScreen } from './screens.js';
import { describeLine, linePrice } from '../engine/order.js';

const PAYMENT = {
  qr: { zh: '扫码支付', zht: '掃碼支付', py: 'sǎomǎ zhīfù', en: 'QR code' },
  cash: { zh: '现金', zht: '現金', py: 'xiànjīn', en: 'Cash' },
};

let ctx;

export function initCheckout(context) {
  ctx = context;
}

export function renderCheckout(result) {
  const r = result.restaurant;
  const { nav } = ctx;
  const pay = PAYMENT[result.flags.payment];
  const stars = '★'.repeat(result.stars) + '☆'.repeat(3 - result.stars);

  mount(screenRoot('checkout'),
    h('h1', { class: 'checkout-title' }, '🎉 Meal complete!'),
    h('p', { class: 'checkout-sub' }, inline({ zh: '吃饱了！', zht: '吃飽了！', py: 'Chī bǎo le!', en: "I'm full!" })),

    h('div', { class: 'receipt', role: 'group', 'aria-label': 'Receipt' },
      h('div', { class: 'receipt-head' },
        tri(r.name, { size: 'sm' }),
        h('span', { class: 'receipt-kind' }, inline({ zh: '小票', py: 'xiǎopiào', en: 'Receipt' }))),
      h('ul', { class: 'receipt-lines', role: 'list' }, result.order.map((line) => h('li', null,
        h('span', null, inline(describeLine(r.menu, line))),
        h('span', { class: 'price' }, `¥${linePrice(r.menu, line)}`)))),
      h('div', { class: 'receipt-total' },
        h('span', null, inline({ zh: '合计', zht: '合計', py: 'héjì', en: 'Total' })),
        h('strong', null, `¥${result.total}`)),
      pay && h('div', { class: 'receipt-pay' }, 'Paid by ', inline(pay)),
      h('p', { class: 'receipt-note' }, 'No tip needed — tipping isn’t customary in mainland China.')),

    h('div', { class: 'rewards' },
      h('div', { class: 'reward reward-stars' },
        h('span', { class: 'stars big', 'aria-hidden': 'true' }, stars),
        h('span', null, `${result.score} / ${result.maxScore} conversation points`),
        h('span', { class: 'visually-hidden' }, `${result.stars} of 3 stars`)),
      h('div', { class: 'reward' }, h('strong', null, `+${result.exp}`), h('span', null, 'Foodie EXP')),
      h('div', { class: 'reward' }, h('strong', null, `+¥${result.cny}`), h('span', null, 'Lesson reward')),
      h('div', { class: 'reward' }, h('strong', null, `¥${result.walletAfter}`), h('span', null, 'Wallet now'))),

    result.levelAfter > result.levelBefore && h('p', { class: 'level-up' }, `⬆️ Level up! You're now a Lv ${result.levelAfter} Foodie.`),

    result.newBadges.length > 0 && h('div', { class: 'new-badges' },
      h('h2', { class: 'section-title' }, 'New badges'),
      h('ul', { class: 'badge-shelf', role: 'list' }, result.newBadges.map((b) => h('li', { class: 'badge is-earned is-new' },
        h('span', { class: 'badge-emoji', 'aria-hidden': 'true' }, b.emoji),
        h('span', { class: 'badge-name' }, inline(b.name)),
        h('span', { class: 'badge-hint' }, b.hint))))),

    h('div', { class: 'checkout-actions' },
      h('button', { type: 'button', class: 'btn btn-primary', onClick: () => nav.toHub() }, '🏠 Back to hub'),
      h('button', { type: 'button', class: 'btn btn-ghost', onClick: () => nav.toDining(r.id) }, '🔁 Eat here again')));

  showScreen('checkout');
}
