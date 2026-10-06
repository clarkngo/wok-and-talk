// Progression math and badge rules. Pure functions — no DOM, no state access.

export const EXP_PER_LEVEL = 100;

export function levelInfo(exp) {
  const level = Math.floor(exp / EXP_PER_LEVEL) + 1;
  const into = exp % EXP_PER_LEVEL;
  return { level, into, needed: EXP_PER_LEVEL, pct: into / EXP_PER_LEVEL };
}

export function starsFor(pct) {
  if (pct >= 0.9) return 3;
  if (pct >= 0.6) return 2;
  return 1;
}

/** Rewards scale from 50% (poor answers) to 100% (perfect) of the restaurant's base reward. */
export function mealRewards(restaurant, score, maxScore) {
  const pct = maxScore > 0 ? score / maxScore : 1;
  const scale = 0.5 + 0.5 * pct;
  return {
    pct,
    stars: starsFor(pct),
    exp: Math.round(restaurant.rewards.exp * scale),
    cny: Math.round(restaurant.rewards.cny * scale),
  };
}

const BADGE_RULES = {
  mealsCompleted: (c, ctx) => ctx.state.progress.mealsCompleted >= c.count,
  restaurantsCompleted: (c, ctx) =>
    Object.values(ctx.state.restaurants).filter((r) => r.completions > 0).length >= c.count,
  perfectMeal: (c, ctx) => ctx.pct >= 1 && (!c.restaurant || c.restaurant === ctx.restaurantId),
  orderedChoice: (c, ctx) => ctx.order.some((line) => (line.choices[c.group] ?? []).includes(c.choice)),
};

/**
 * Which badges become newly earned after a meal?
 * ctx: { state (already updated for this meal), restaurantId, pct, order }
 */
export function evaluateBadges(badgeDefs, ctx) {
  return badgeDefs.filter((b) => {
    if (ctx.state.progress.badges[b.id]) return false;
    const rule = BADGE_RULES[b.condition.type];
    if (!rule) {
      console.warn(`[badges] Unknown condition type "${b.condition.type}" on ${b.id}`);
      return false;
    }
    return rule(b.condition, ctx);
  });
}
