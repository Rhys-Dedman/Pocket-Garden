/**
 * Golden pot count = `plantMastery.unlockedLevels.length` (tiers 1–24).
 * Thresholds match `GOLD_POT_BONUS_TIERS` in GoldenPotBonusesPopup.
 */
export const GOLDEN_POT_BONUS_OFFLINE_2X_AT = 4;
export const GOLDEN_POT_BONUS_INSTANT_ORDERS_AT = 8;
export const GOLDEN_POT_BONUS_PRODUCTION_150_AT = 12;
export const GOLDEN_POT_BONUS_HARVEST_150_AT = 16;
export const GOLDEN_POT_BONUS_MERGE_COINS_2X_AT = 20;
export const GOLDEN_POT_BONUS_AUTO_MERGE_AT = 24;

export function hasGoldenPotOfflineEarningsDouble(count: number): boolean {
  return count >= GOLDEN_POT_BONUS_OFFLINE_2X_AT;
}

export function hasGoldenPotInstantOrders(count: number): boolean {
  return count >= GOLDEN_POT_BONUS_INSTANT_ORDERS_AT;
}

export function hasGoldenPotProduction150(count: number): boolean {
  return count >= GOLDEN_POT_BONUS_PRODUCTION_150_AT;
}

export function hasGoldenPotHarvest150(count: number): boolean {
  return count >= GOLDEN_POT_BONUS_HARVEST_150_AT;
}

export function hasGoldenPotMergeCoinsDouble(count: number): boolean {
  return count >= GOLDEN_POT_BONUS_MERGE_COINS_2X_AT;
}

export function hasGoldenPotAutoMergeUnlocked(count: number): boolean {
  return count >= GOLDEN_POT_BONUS_AUTO_MERGE_AT;
}

/** 1.5× seed / harvest bar fill rate when the corresponding bonus is active. */
export function applyGoldenPotProductionPerMinute(perMinute: number, goldenPotCount: number): number {
  return hasGoldenPotProduction150(goldenPotCount) ? perMinute * 1.5 : perMinute;
}

export function applyGoldenPotHarvestPerMinute(perMinute: number, goldenPotCount: number): number {
  return hasGoldenPotHarvest150(goldenPotCount) ? perMinute * 1.5 : perMinute;
}
