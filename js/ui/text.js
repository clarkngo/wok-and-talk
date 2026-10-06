// Renders a trilingual text object { zh, zht?, py, en } as stacked layers.
// Which layers are visible is decided purely by CSS classes on <html>
// (hide-pinyin / hide-english / script-traditional), so toggling never re-renders.

import { h } from './dom.js';
import { speak } from '../core/speech.js';
import { getState } from '../core/store.js';

/**
 * @param {{zh:string, zht?:string, py?:string, en?:string}} text
 * @param {{size?:'sm'|'md'|'lg', peekable?:boolean, className?:string}} opts
 *   peekable: tapping temporarily reveals hidden Pinyin/English.
 */
export function tri(text, { size = 'md', peekable = false, className = '' } = {}) {
  return h('span', {
    class: `tri tri-${size} ${className}`.trim(),
    dataset: peekable ? { peekable: '' } : undefined,
    title: peekable ? 'Tap to peek at hidden Pinyin / English' : undefined,
  },
  text.py && h('span', { class: 'tri-py' }, text.py),
  h('span', { class: 'tri-zh' },
    h('span', { class: 'zh-s', lang: 'zh-Hans' }, text.zh),
    h('span', { class: 'zh-t', lang: 'zh-Hant' }, text.zht ?? text.zh)),
  text.en && h('span', { class: 'tri-en', lang: 'en' }, text.en));
}

/** A one-line "zh · py" label, for compact chips. Respects the same toggles. */
export function inline(text) {
  return h('span', { class: 'tri tri-inline' },
    h('span', { class: 'tri-zh' },
      h('span', { class: 'zh-s', lang: 'zh-Hans' }, text.zh),
      h('span', { class: 'zh-t', lang: 'zh-Hant' }, text.zht ?? text.zh)),
    text.py && h('span', { class: 'tri-py' }, text.py),
    text.en && h('span', { class: 'tri-en', lang: 'en' }, text.en));
}

export function speakButton(text, label = 'Listen') {
  const zh = () => (getState().settings.script === 'traditional' ? text.zht ?? text.zh : text.zh);
  return h('button', {
    type: 'button',
    class: 'speak-btn',
    'aria-label': `${label}: ${text.en ?? text.zh}`,
    title: 'Listen',
    onClick: (e) => { e.stopPropagation(); speak(zh(), getState().settings.speechRate); },
  }, '🔊');
}
