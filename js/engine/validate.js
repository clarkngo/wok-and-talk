// Content linter for restaurant data files. Pure — runs in the browser
// (warnings in the console) and in Node via tools/validate-content.mjs.

import { ACTIONS } from './dialogue.js';

const GRADES = ['best', 'ok', 'wrong', 'neutral'];

/** Returns a list of human-readable problems; empty means the file looks good. */
export function validateRestaurant(r) {
  const problems = [];
  const err = (path, msg) => problems.push(`${r?.id ?? '?'} › ${path}: ${msg}`);

  const checkText = (path, t, { needPinyin = true } = {}) => {
    if (!t || typeof t !== 'object') return err(path, 'missing text object');
    if (!t.zh) err(path, 'missing "zh"');
    if (!t.en) err(path, 'missing "en"');
    if (needPinyin && !t.py) err(path, 'missing "py"');
  };

  for (const key of ['id', 'name', 'startNode', 'npcs', 'dialogue', 'menu', 'rewards']) {
    if (r?.[key] == null) err(key, 'required');
  }
  if (problems.length) return problems;

  checkText('name', r.name);
  const nodes = r.dialogue;
  const menuItemIds = new Set((r.menu.categories ?? []).flatMap((cat) => cat.items.map((i) => i.id)));
  const refOk = (id) => typeof id === 'string' && id in nodes;
  if (!refOk(r.startNode)) err('startNode', `unknown node "${r.startNode}"`);

  for (const [id, npc] of Object.entries(r.npcs)) checkText(`npcs.${id}.name`, npc.name);

  // Dialogue nodes
  const reachable = new Set();
  const queue = [r.startNode];
  const edges = (n) => [n.next, ...(n.choices ?? []).map((c) => c.next)].filter(Boolean);

  for (const [id, n] of Object.entries(nodes)) {
    const p = `dialogue.${id}`;
    if (n.speaker !== 'narrator' && !(n.speaker in r.npcs)) err(p, `unknown speaker "${n.speaker}"`);
    if (n.line) checkText(`${p}.line`, n.line);
    if (n.action && !ACTIONS.includes(n.action)) err(p, `unknown action "${n.action}"`);
    if (n.action === 'openMenu' && !refOk(n.next)) err(p, 'openMenu needs a valid "next"');
    if (!n.choices && !n.action && !refOk(n.next)) err(p, 'dead end — needs choices, an action, or "next"');
    if (n.next && !refOk(n.next)) err(`${p}.next`, `unknown node "${n.next}"`);

    const ids = new Set();
    (n.choices ?? []).forEach((c, i) => {
      const cp = `${p}.choices[${i}]`;
      if (!c.id) err(cp, 'missing "id"');
      else if (ids.has(c.id)) err(cp, `duplicate id "${c.id}"`);
      ids.add(c.id);
      checkText(`${cp}.text`, c.text);
      if (c.grade && !GRADES.includes(c.grade)) err(cp, `unknown grade "${c.grade}"`);
      if (c.next && !refOk(c.next)) err(`${cp}.next`, `unknown node "${c.next}"`);
      if (!c.next && !n.next && c.grade !== 'wrong') err(cp, 'no "next" (only wrong answers may retry)');
      (c.effects ?? []).forEach((fx, j) => {
        const fp = `${cp}.effects[${j}]`;
        if (fx.type === 'setFlag') { if (!fx.flag) err(fp, 'setFlag needs "flag"'); }
        else if (fx.type === 'addItem') { if (!menuItemIds.has(fx.item)) err(fp, `unknown menu item "${fx.item}"`); }
        else err(fp, `unknown effect type "${fx.type}"`);
        if (fx.type === 'addItem' && c.grade === 'wrong' && !c.next) err(fp, 'addItem on a retry choice would add the item every attempt');
      });
    });
    if (n.choices && !n.choices.some((c) => c.grade !== 'wrong')) err(p, 'every choice is wrong — player is stuck');
  }

  while (queue.length) {
    const id = queue.shift();
    if (reachable.has(id) || !nodes[id]) continue;
    reachable.add(id);
    queue.push(...edges(nodes[id]));
  }
  for (const id of Object.keys(nodes)) if (!reachable.has(id)) err(`dialogue.${id}`, 'unreachable from startNode');
  if (![...reachable].some((id) => nodes[id].action === 'checkout')) err('dialogue', 'no reachable checkout node');

  // Menu
  const groups = r.menu.optionGroups ?? {};
  for (const [gid, g] of Object.entries(groups)) {
    checkText(`menu.optionGroups.${gid}.label`, g.label);
    if (!['single', 'multi'].includes(g.type)) err(`menu.optionGroups.${gid}`, 'type must be "single" or "multi"');
    g.choices.forEach((c, i) => checkText(`menu.optionGroups.${gid}.choices[${i}].text`, c.text));
  }
  const itemIds = new Set();
  for (const cat of r.menu.categories ?? []) {
    checkText(`menu.${cat.id}.name`, cat.name);
    for (const item of cat.items) {
      const ip = `menu.${cat.id}.${item.id}`;
      if (itemIds.has(item.id)) err(ip, 'duplicate item id');
      itemIds.add(item.id);
      checkText(`${ip}.name`, item.name);
      if (!(Number.isFinite(item.price) && item.price >= 0)) err(ip, 'price must be a non-negative number');
      for (const gid of item.options ?? []) if (!(gid in groups)) err(ip, `unknown option group "${gid}"`);
    }
  }

  const addedByDialogue = new Set(Object.values(nodes).flatMap((n) => (n.choices ?? [])
    .flatMap((c) => (c.effects ?? []).filter((fx) => fx.type === 'addItem').map((fx) => fx.item))));
  for (const cat of r.menu.categories ?? []) {
    for (const item of cat.items) {
      if (item.hidden && !addedByDialogue.has(item.id)) err(`menu.${cat.id}.${item.id}`, 'hidden but never added by dialogue — players can never get it');
    }
  }

  return problems;
}
