/**
 * Plant coin value / economy price per plant level.
 *
 * Formula:
 * - Level 1 = 10
 * - Each next level multiplies by 1.3
 * - Then round by tiers:
 *   < 100   → ceil to nearest 5
 *   < 1000  → ceil to nearest 10
 *   >= 1000 → round to nearest 100
 */
export function getPlantCoinValue(level: number): number {
  const safeLevel = Math.max(1, Math.floor(level));
  const raw = 10 * Math.pow(1.3, safeLevel - 1);

  if (raw < 100) return Math.ceil(raw / 5) * 5;
  if (raw < 1000) return Math.ceil(raw / 10) * 10;
  return Math.round(raw / 100) * 100;
}

