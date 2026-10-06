// Loads static game content (JSON under /data). Paths are relative so the
// game works from a GitHub Pages project subpath like /wok-and-talk/.

import { validateRestaurant } from '../engine/validate.js';

const cache = new Map();

async function getJSON(url) {
  if (!cache.has(url)) {
    cache.set(url, fetch(url).then((res) => {
      if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
      return res.json();
    }).catch((err) => {
      cache.delete(url); // allow a retry
      throw err;
    }));
  }
  return cache.get(url);
}

/** The hub catalog: restaurant cards + badge definitions. */
export function loadCatalog() {
  return getJSON('data/catalog.json');
}

export async function loadRestaurant(id) {
  if (!/^[a-z0-9-]+$/.test(id)) throw new Error(`Bad restaurant id "${id}"`);
  const data = await getJSON(`data/restaurants/${id}.json`);
  if (!data.__checked) {
    const problems = validateRestaurant(data);
    if (problems.length) console.warn(`[content] ${problems.length} problem(s) in ${id}.json:\n` + problems.join('\n'));
    Object.defineProperty(data, '__checked', { value: true });
  }
  return data;
}
