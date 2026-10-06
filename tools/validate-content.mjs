#!/usr/bin/env node
// Lints every restaurant file in data/restaurants and cross-checks the catalog.
// Usage:  node tools/validate-content.mjs

import { readFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { validateRestaurant } from '../js/engine/validate.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const readJSON = async (p) => JSON.parse(await readFile(join(root, p), 'utf8'));

const problems = [];
const catalog = await readJSON('data/catalog.json');
const files = (await readdir(join(root, 'data/restaurants'))).filter((f) => f.endsWith('.json'));
const restaurants = {};

for (const f of files) {
  const r = await readJSON(`data/restaurants/${f}`);
  if (`${r.id}.json` !== f) problems.push(`${f}: id "${r.id}" doesn't match file name`);
  restaurants[r.id] = r;
  problems.push(...validateRestaurant(r));
}

for (const entry of catalog.restaurants) {
  if (entry.status === 'playable' && !restaurants[entry.id]) {
    problems.push(`catalog: "${entry.id}" is playable but data/restaurants/${entry.id}.json is missing`);
  }
}

const KNOWN_CONDITIONS = ['mealsCompleted', 'restaurantsCompleted', 'perfectMeal', 'orderedChoice'];
for (const b of catalog.badges) {
  if (!KNOWN_CONDITIONS.includes(b.condition?.type)) problems.push(`catalog badge ${b.id}: unknown condition "${b.condition?.type}"`);
  if (b.condition?.type === 'orderedChoice') {
    const found = Object.values(restaurants).some((r) => r.menu.optionGroups[b.condition.group]?.choices.some((c) => c.id === b.condition.choice));
    if (!found) problems.push(`catalog badge ${b.id}: no restaurant has option ${b.condition.group}.${b.condition.choice}`);
  }
}

if (problems.length) {
  console.error(`✗ ${problems.length} problem(s):\n  ` + problems.join('\n  '));
  process.exit(1);
}
console.log(`✓ Content OK — ${files.length} restaurant(s), ${catalog.badges.length} badge(s).`);
