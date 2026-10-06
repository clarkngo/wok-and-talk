// Menu & order logic. Pure functions — no DOM, no state access.
//
// An order is an array of lines:  { itemId, qty, choices: { [groupId]: [choiceId, ...] } }

const indexCache = new WeakMap();

function indexMenu(menu) {
  let idx = indexCache.get(menu);
  if (!idx) {
    idx = { items: new Map() };
    for (const cat of menu.categories) for (const item of cat.items) idx.items.set(item.id, item);
    indexCache.set(menu, idx);
  }
  return idx;
}

export function getItem(menu, itemId) {
  const item = indexMenu(menu).items.get(itemId);
  if (!item) throw new Error(`Menu item "${itemId}" not found`);
  return item;
}

export function getGroup(menu, groupId) {
  const group = menu.optionGroups[groupId];
  if (!group) throw new Error(`Option group "${groupId}" not found`);
  return group;
}

/** Initial selections for an item: each single-choice group gets its default (or first) choice. */
export function defaultChoices(menu, item) {
  const out = {};
  for (const gid of item.options ?? []) {
    const g = getGroup(menu, gid);
    out[gid] = g.type === 'multi' ? [] : [(g.choices.find((c) => c.default) ?? g.choices[0]).id];
  }
  return out;
}

function selectedChoices(menu, line) {
  const item = getItem(menu, line.itemId);
  return (item.options ?? []).flatMap((gid) => {
    const g = getGroup(menu, gid);
    return (line.choices[gid] ?? []).map((cid) => g.choices.find((c) => c.id === cid)).filter(Boolean);
  });
}

export function unitPrice(menu, line) {
  const item = getItem(menu, line.itemId);
  return item.price + selectedChoices(menu, line).reduce((sum, c) => sum + (c.price ?? 0), 0);
}

export function linePrice(menu, line) {
  return unitPrice(menu, line) * line.qty;
}

export function orderTotal(menu, order) {
  return order.reduce((sum, line) => sum + linePrice(menu, line), 0);
}

function sameChoices(a, b) {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const k of keys) {
    const x = [...(a[k] ?? [])].sort().join();
    const y = [...(b[k] ?? [])].sort().join();
    if (x !== y) return false;
  }
  return true;
}

/** Returns a new order with `line` added (merged into an identical line if present). */
export function addLine(order, line) {
  const i = order.findIndex((l) => l.itemId === line.itemId && sameChoices(l.choices, line.choices));
  if (i === -1) return [...order, { ...line, qty: line.qty ?? 1 }];
  return order.map((l, j) => (j === i ? { ...l, qty: Math.min(20, l.qty + (line.qty ?? 1)) } : l));
}

/** Returns a new order with one unit removed from line `index`. */
export function removeOne(order, index) {
  return order.flatMap((l, j) => (j !== index ? [l] : l.qty > 1 ? [{ ...l, qty: l.qty - 1 }] : []));
}

// ---------------------------------------------------------------------------
// Text descriptions (trilingual)

const SEP = {
  zh: { open: '（', close: '）', inner: '、', outer: '，' },
  py: { open: ' (', close: ')', inner: ', ', outer: ', ' },
  en: { open: ' (', close: ')', inner: ', ', outer: ', ' },
};
SEP.zht = SEP.zh;

/** "牛肉拉面（毛细、少辣）×2" in every layer. Choices marked `silent` are omitted. */
export function describeLine(menu, line) {
  const item = getItem(menu, line.itemId);
  const spoken = selectedChoices(menu, line).filter((c) => !c.silent);
  const out = {};
  for (const layer of ['zh', 'zht', 'py', 'en']) {
    const s = SEP[layer];
    const name = item.name[layer] ?? item.name.zh;
    const opts = spoken.map((c) => c.text[layer] ?? c.text.zh);
    out[layer] = name
      + (opts.length ? s.open + opts.join(s.inner) + s.close : '')
      + (line.qty > 1 ? `${layer.startsWith('zh') ? '' : ' '}×${line.qty}` : '');
  }
  return out;
}

export function describeOrder(menu, order) {
  const lines = order.map((l) => describeLine(menu, l));
  const out = {};
  for (const layer of ['zh', 'zht', 'py', 'en']) out[layer] = lines.map((l) => l[layer]).join(SEP[layer].outer);
  return out;
}

/**
 * What the player could say out loud to order this item:
 * "牛肉拉面，毛细，少辣，不要香菜。"
 */
export function orderPhrase(menu, line) {
  const item = getItem(menu, line.itemId);
  const spoken = selectedChoices(menu, line).filter((c) => !c.silent);
  const parts = (layer) => [item.name[layer] ?? item.name.zh, ...spoken.map((c) => c.text[layer] ?? c.text.zh)];
  const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
  return {
    zh: parts('zh').join('，') + '。',
    zht: parts('zht').join('，') + '。',
    py: cap(parts('py').join(', ')) + '.',
    en: cap(parts('en').join(', ')) + '.',
  };
}
