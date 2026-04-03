/** Completed customer orders needed to fill one plant mastery segment. */
export const PLANT_MASTERY_ORDERS_PER_SEGMENT = 50;

/**
 * Max stored `ordersProgress` while filling a segment (before rollover on the next goal).
 * Until `plantMasteryIntroBarComplete`, bar shows 15/15 (fake L4); after intro, normal level goals (e.g. 0/20 at L5).
 */
export function getMaxStoredOrdersProgressForTarget(
  targetLevel: number,
  seg: number = PLANT_MASTERY_ORDERS_PER_SEGMENT,
  introBarComplete?: boolean,
): number {
  if (targetLevel >= 24) return seg;
  if (targetLevel === 1 && introBarComplete) return seg;
  return seg - 1;
}
/** Coins to purchase mastery for level 1 plant. */
export const PLANT_MASTERY_UNLOCK_COST_BASE = 5000;
/** Per-level multiplier on the previous step (level n uses base × multiplier^(n−1), then rounded). */
export const PLANT_MASTERY_UNLOCK_COST_MULTIPLIER = 1.3;
/** Additive glow pulse duration (synced across plants). */
export const PLANT_MASTERY_GLOW_MS = 2000;

/**
 * Snap coin costs to readable tiers:
 * - under 10k → nearest 500
 * - under 100k → nearest 1,000
 * - under 1M → nearest 10,000 (bridge band; not specified separately above)
 * - 1M+ → nearest 100,000
 */
function roundPlantMasteryUnlockCost(raw: number): number {
  if (raw < 10_000) {
    return Math.round(raw / 500) * 500;
  }
  if (raw < 100_000) {
    return Math.round(raw / 1_000) * 1_000;
  }
  if (raw < 1_000_000) {
    return Math.round(raw / 10_000) * 10_000;
  }
  return Math.round(raw / 100_000) * 100_000;
}

/** Mastery coin cost for unlocking the golden pot on `level` (1-based plant tier). Plant 1 is 0 (free purchase flow). */
export function getPlantMasteryUnlockCost(level: number): number {
  const safeLevel = Math.max(1, Math.floor(level));
  if (safeLevel === 1) return 0;
  const raw =
    PLANT_MASTERY_UNLOCK_COST_BASE * Math.pow(PLANT_MASTERY_UNLOCK_COST_MULTIPLIER, safeLevel - 1);
  return roundPlantMasteryUnlockCost(raw);
}
