/**
 * Offline simulation for seed/harvest recharge bars and surplus coins (into offline earnings, not wallet).
 */
import {
  getSeedStorageMax,
  getSeedSurplusValue,
  getHarvestSpeedLevel,
  type SeedsState,
  type UpgradeState,
} from '../components/UpgradeList';
import { hasActiveDoubleCoinsBoostAt } from '../offers';
import type { FtueStageId } from '../ftue/ftueConfig';
import type { GameSaveV1 } from './gameSave';
import type { BoardCell } from '../types';
import {
  getWildGrowthIntervalMsForLevel,
  pickWildGrowthSpawn,
  spawnWildGrowthPlantOnGrid,
  WILD_GROWTH_UNLOCK_PLAYER_LEVEL,
} from './wildGrowth';
import {
  applyGoldenPotHarvestPerMinute,
  applyGoldenPotProductionPerMinute,
} from '../constants/goldenPotBonuses';

const HARVEST_CHARGES_MAX = 3;

/**
 * Offline surplus coins are disabled until FTUE 11 (recharge intro) is dismissed.
 * Also blocks the brief FTUE 6→7 window where `activeFtueStage` is null but `ftue7Scheduled` is true.
 */
export function isOfflineCoinEarningsBlockedByFtue(
  s: Pick<GameSaveV1, 'activeFtueStage' | 'ftue7Scheduled' | 'ftue11StartQueued'>
): boolean {
  return (
    s.activeFtueStage !== null ||
    s.ftue7Scheduled === true ||
    s.ftue11StartQueued === true
  );
}
/** Wall-time cap for offline simulation: earnings beyond this are discarded. */
export const MAX_OFFLINE_ACCUMULATION_MS = 3 * 60 * 60 * 1000;

export interface OfflineSimInput {
  savedAt: number /** epoch ms when game was last saved */;
  deltaMs: number;
  seedProgress: number;
  harvestProgress: number;
  harvestCharges: number;
  seedsInStorage: number;
  seedsState: SeedsState;
  cropsState: Record<string, UpgradeState>;
  /** Pass `icon` when present on save so Double Coins matches even if `offerId` was omitted. */
  activeBoosts: { offerId?: string; endTime: number; icon?: string }[];
  activeFtueStage: FtueStageId | null;
  ftue7Scheduled: boolean;
  ftueSeedSurplusActivated: boolean;
  ftueHarvestSurplusActivated: boolean;
  /** Used with seed tier so surplus coin base matches live play (auto-scales with discoveries). */
  highestPlantEver: number;
  /**
   * When false (e.g. FTUE not finished), seed/harvest still simulate but surplus is not banked as offline coins.
   */
  earnOfflineCoins?: boolean;
  /** Golden pots unlocked (`plantMastery.unlockedLevels.length`); affects bar fill rates when bonuses apply. */
  goldenPotCount?: number;
}

export interface OfflineSimResult {
  seedProgress: number;
  harvestProgress: number;
  harvestCharges: number;
  seedsInStorage: number;
  offlineSurplusCoins: number;
}

function seedBarFrozen(stage: FtueStageId | null): boolean {
  if (stage == null) return false;
  return (
    stage !== 'recharge_pre_upgrade' &&
    stage !== 'first_upgrade' &&
    stage !== 'recharge_intro'
  );
}

function harvestBarFrozen(stage: FtueStageId | null, ftue7Scheduled: boolean): boolean {
  if (ftue7Scheduled) return true;
  return (
    stage === 'first_harvest' ||
    stage === 'first_goal_collect' ||
    stage === 'first_more_orders' ||
    stage === 'first_harvest_multi'
  );
}

export function simulateOfflineSeedHarvest(input: OfflineSimInput): OfflineSimResult {
  let seedProgress = input.seedProgress;
  let harvestProgress = input.harvestProgress;
  let harvestCharges = input.harvestCharges;
  let seedsInStorage = input.seedsInStorage;
  let offlineSurplusCoins = 0;
  const earnCoins = input.earnOfflineCoins !== false;

  let remaining = Math.min(Math.max(0, input.deltaMs), MAX_OFFLINE_ACCUMULATION_MS);
  const seedFrozen = seedBarFrozen(input.activeFtueStage);
  const harvestFrozen = harvestBarFrozen(input.activeFtueStage, input.ftue7Scheduled);

  const surplusSeedsState = input.ftueSeedSurplusActivated
    ? ({
        ...input.seedsState,
        seed_surplus: {
          level: Math.max(1, input.seedsState?.seed_surplus?.level ?? 0),
          progress: 0,
        },
      } as SeedsState)
    : input.seedsState;
  const surplusValue = getSeedSurplusValue(surplusSeedsState, Math.max(1, input.highestPlantEver));
  const maxCap = getSeedStorageMax(input.seedsState);

  const seedProdLevel = input.seedsState?.seed_production?.level ?? 0;
  const harvestSpeedLevel = getHarvestSpeedLevel(input.cropsState);
  const goldPots = input.goldenPotCount ?? 0;

  const getSeedRatePerMs = (wallTime: number) => {
    if (seedFrozen) return 0;
    const hasRapid = input.activeBoosts.some((b) => b.offerId === 'rapid_seeds' && b.endTime > wallTime);
    let perMin = hasRapid ? 15 : (3 + (7 * Math.min(9, Math.max(0, seedProdLevel))) / 9);
    perMin = applyGoldenPotProductionPerMinute(perMin, goldPots);
    return (perMin * 100) / (60 * 1000);
  };

  const getHarvestRatePerMs = (wallTime: number) => {
    if (harvestFrozen) return 0;
    const hasRapid = input.activeBoosts.some((b) => b.offerId === 'rapid_harvest' && b.endTime > wallTime);
    let perMin = hasRapid ? 15 : (3 + (7 * Math.min(9, Math.max(0, harvestSpeedLevel))) / 9);
    perMin = applyGoldenPotHarvestPerMinute(perMin, goldPots);
    return (perMin * 100) / (60 * 1000);
  };

  const processSeedComplete = () => {
    const wallTime = input.savedAt + elapsed;
    const doubleCoinsMult = hasActiveDoubleCoinsBoostAt(input.activeBoosts, wallTime) ? 2 : 1;
    const doubleLevel = input.seedsState.double_seeds?.level ?? 0;
    const doubleChance = Math.min(1, doubleLevel * 0.1);
    const seedsToAdd = Math.random() < doubleChance ? 2 : 1;
    const total = seedsInStorage + seedsToAdd;
    const capped = Math.min(maxCap, total);
    const excess = total - capped;
    seedsInStorage = capped;
    if (earnCoins && excess > 0 && surplusValue > 0 && input.ftueSeedSurplusActivated) {
      const base = excess * surplusValue;
      offlineSurplusCoins += doubleCoinsMult === 2 ? Math.round(base * 2) : base;
    }
    seedProgress = 0;
  };

  const processHarvestComplete = () => {
    const wallTime = input.savedAt + elapsed;
    const doubleCoinsMult = hasActiveDoubleCoinsBoostAt(input.activeBoosts, wallTime) ? 2 : 1;
    if (harvestCharges < HARVEST_CHARGES_MAX) {
      harvestCharges++;
    } else if (earnCoins && surplusValue > 0 && input.ftueHarvestSurplusActivated) {
      offlineSurplusCoins += doubleCoinsMult === 2 ? Math.round(surplusValue * 2) : surplusValue;
    }
    harvestProgress = 0;
  };

  let elapsed = 0;
  let iter = 0;
  const maxIter = 500_000;

  while (remaining > 0 && iter < maxIter) {
    iter++;
    const wallTime = input.savedAt + elapsed;
    const rS = getSeedRatePerMs(wallTime);
    const rH = getHarvestRatePerMs(wallTime);

    if (rS <= 0 && rH <= 0) break;

    let dt = remaining;
    if (rS > 0 && seedProgress < 100) {
      dt = Math.min(dt, (100 - seedProgress) / rS);
    }
    if (rH > 0 && harvestProgress < 100) {
      dt = Math.min(dt, (100 - harvestProgress) / rH);
    }
    if (!Number.isFinite(dt) || dt < 1e-9) break;

    seedProgress = Math.min(100, seedProgress + rS * dt);
    harvestProgress = Math.min(100, harvestProgress + rH * dt);
    elapsed += dt;
    remaining -= dt;

    while (seedProgress >= 100 - 1e-9) {
      processSeedComplete();
    }
    while (harvestProgress >= 100 - 1e-9) {
      processHarvestComplete();
    }
  }

  return {
    seedProgress,
    harvestProgress,
    harvestCharges,
    seedsInStorage,
    offlineSurplusCoins,
  };
}

export interface WildGrowthOfflineInput {
  deltaMs: number;
  playerLevel: number;
  /** `cropsState.wild_growth.level` — speed tiers; 0 = 120s baseline once feature is unlocked. */
  wildGrowthUpgradeLevel: number;
  grid: BoardCell[];
  wildGrowthAccumMs: number;
}

export interface WildGrowthOfflineResult {
  grid: BoardCell[];
  wildGrowthAccumMs: number;
}

/** Simulates Wild Growth timer and spawns while away (grid mutates on a deep copy). */
export function simulateWildGrowthOffline(input: WildGrowthOfflineInput): WildGrowthOfflineResult {
  let grid = input.grid.map((c) => ({
    ...c,
    item: c.item ? { ...c.item } : null,
  }));
  if (input.playerLevel < WILD_GROWTH_UNLOCK_PLAYER_LEVEL) {
    return { grid, wildGrowthAccumMs: 0 };
  }
  const intervalMs = getWildGrowthIntervalMsForLevel(input.wildGrowthUpgradeLevel);
  if (intervalMs <= 0) {
    return { grid, wildGrowthAccumMs: input.wildGrowthAccumMs };
  }

  let accum = Math.max(0, input.wildGrowthAccumMs);
  let wall = 0;
  const delta = Math.min(Math.max(0, input.deltaMs), MAX_OFFLINE_ACCUMULATION_MS);
  const noReserved = new Set<number>();

  while (wall < delta) {
    const hasPlant = grid.some((c) => !c.locked && c.item != null);
    if (!hasPlant) {
      break;
    }

    if (accum < intervalMs) {
      const step = Math.min(intervalMs - accum, delta - wall);
      accum += step;
      wall += step;
      continue;
    }

    const pick = pickWildGrowthSpawn(grid, noReserved);
    if (!pick) {
      break;
    }
    grid = spawnWildGrowthPlantOnGrid(grid, pick);
    accum = 0;
  }

  return { grid, wildGrowthAccumMs: accum };
}
