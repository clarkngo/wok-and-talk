// Game actions: the only place that mutates player state (via store.update).
// UI modules call these; they never edit state directly.

import { getState, update } from './store.js';
import { createRestaurantProgress } from './schema.js';
import { MAX_POINTS, applyEffects } from '../engine/dialogue.js';
import { orderTotal } from '../engine/order.js';
import { evaluateBadges, levelInfo, mealRewards } from '../engine/rewards.js';

const now = () => new Date().toISOString();

// ---- Settings & profile ----------------------------------------------------

export function setSetting(key, value) {
  update((s) => { s.settings[key] = value; });
}

export function setProfileName(name) {
  const clean = String(name).trim().slice(0, 40);
  if (clean) update((s) => { s.profile.name = clean; });
}

// ---- Meal lifecycle ---------------------------------------------------------

export function startMeal(restaurant) {
  update((s) => {
    s.activeMeal = {
      restaurantId: restaurant.id,
      nodeId: restaurant.startNode,
      order: [],
      score: 0,
      maxScore: 0,
      answered: {},
      flags: {},
      startedAt: now(),
    };
    const r = (s.restaurants[restaurant.id] ??= createRestaurantProgress());
    r.visits += 1;
    r.lastVisitedAt = now();
  });
}

export function abandonMeal() {
  update((s) => { s.activeMeal = null; });
}

export function setNode(nodeId) {
  if (getState().activeMeal?.nodeId === nodeId) return;
  update((s) => { if (s.activeMeal) s.activeMeal.nodeId = nodeId; });
}

/** Score the first graded answer on each node, apply effects, and log the phrase. */
export function recordAnswer(restaurantId, nodeId, choice, result) {
  update((s) => {
    const m = s.activeMeal;
    if (!m) return;
    if (result.scored && !m.answered[nodeId]) {
      m.answered[nodeId] = true;
      m.maxScore += MAX_POINTS;
      m.score += result.points;
    }
    applyEffects(m.flags, choice.effects);

    const key = `${restaurantId}/${nodeId}/${choice.id}`;
    const entry = (s.phrasebook[key] ??= { seen: 0, correct: 0, lastSeenAt: null });
    entry.seen += 1;
    if (result.grade === 'best') entry.correct += 1;
    entry.lastSeenAt = now();
  });
}

export function setOrder(order) {
  update((s) => { if (s.activeMeal) s.activeMeal.order = order; });
}

/**
 * Pay, grant rewards and badges, close the meal.
 * Returns a summary object for the checkout screen.
 */
export function completeMeal(restaurant, badgeDefs) {
  const meal = getState().activeMeal;
  if (!meal) throw new Error('No meal in progress');

  const total = orderTotal(restaurant.menu, meal.order);
  const rewards = mealRewards(restaurant, meal.score, meal.maxScore);
  const levelBefore = levelInfo(getState().progress.exp).level;
  let newBadges = [];

  update((s) => {
    s.wallet.cny = Math.max(0, s.wallet.cny - total) + rewards.cny;
    s.progress.exp += rewards.exp;
    s.progress.mealsCompleted += 1;

    const r = (s.restaurants[restaurant.id] ??= createRestaurantProgress());
    r.completions += 1;
    r.bestScore = Math.max(r.bestScore, Math.round(rewards.pct * 100));
    r.bestStars = Math.max(r.bestStars, rewards.stars);

    newBadges = evaluateBadges(badgeDefs, {
      state: s, restaurantId: restaurant.id, pct: rewards.pct, order: meal.order,
    });
    for (const b of newBadges) s.progress.badges[b.id] = now();

    s.activeMeal = null;
  });

  const after = getState();
  return {
    restaurant,
    order: meal.order,
    flags: meal.flags,
    total,
    score: meal.score,
    maxScore: meal.maxScore,
    ...rewards,
    newBadges,
    levelBefore,
    levelAfter: levelInfo(after.progress.exp).level,
    walletAfter: after.wallet.cny,
  };
}
