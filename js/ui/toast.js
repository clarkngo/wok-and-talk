import { h } from './dom.js';

/** @param {'info'|'success'|'error'} type */
export function toast(message, type = 'info', ms = 3500) {
  const el = h('div', { class: `toast toast-${type}` }, message);
  document.getElementById('toasts').append(el);
  setTimeout(() => {
    el.classList.add('out');
    el.addEventListener('animationend', () => el.remove(), { once: true });
    setTimeout(() => el.remove(), 600); // fallback when animations are disabled
  }, ms);
}
