// Dialogue-tree helpers. Pure functions — no DOM, no state access.

export const POINTS = { best: 10, ok: 5, wrong: 0, neutral: 0 };
export const MAX_POINTS = POINTS.best;
export const ACTIONS = ['openMenu', 'checkout'];

export function getNode(restaurant, id) {
  const node = restaurant.dialogue[id];
  if (!node) throw new Error(`Dialogue node "${id}" not found in ${restaurant.id}`);
  return node;
}

/** Does a `requires` clause pass against the current meal flags? */
export function meetsRequires(requires, flags = {}) {
  if (!requires?.flags) return true;
  return Object.entries(requires.flags).every(([k, v]) => (flags[k] ?? false) === v);
}

export function visibleChoices(node, flags) {
  return (node.choices ?? []).filter((c) => meetsRequires(c.requires, flags));
}

/**
 * Decide what a picked choice means.
 * A `wrong` choice with no explicit `next` is a retry: the player stays on the node.
 */
export function resolveChoice(node, choice) {
  const grade = choice.grade ?? 'neutral';
  const retry = grade === 'wrong' && choice.next == null;
  return {
    grade,
    points: POINTS[grade] ?? 0,
    scored: grade !== 'neutral',
    retry,
    next: retry ? null : (choice.next ?? node.next ?? null),
  };
}

/** Apply a choice's effects to a flags object (mutates and returns it). */
export function applyEffects(flags, effects = []) {
  for (const fx of effects) {
    if (fx.type === 'setFlag') flags[fx.flag] = fx.value ?? true;
  }
  return flags;
}

/**
 * Replace `{name}` placeholders in a trilingual text object.
 * A var may be a plain string/number (same in every layer) or a text object
 * whose matching layer is used (`zht` falls back to `zh`).
 */
export function interpolate(text, vars = {}) {
  const out = {};
  for (const [layer, value] of Object.entries(text)) {
    out[layer] = typeof value !== 'string' ? value : value.replace(/\{(\w+)\}/g, (m, key) => {
      const v = vars[key];
      if (v == null) return m;
      if (typeof v === 'object') return v[layer] ?? (layer === 'zht' ? v.zh : undefined) ?? m;
      return String(v);
    });
  }
  return out;
}
