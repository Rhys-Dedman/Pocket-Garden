/**
 * Snapshot matching “right after FTUE 11”: FTUE done, level 1, empty grid, default upgrades, starter goals.
 */
import type { BoardCell } from '../types';
import {
  createInitialCropsState,
  createInitialHarvestState,
  createInitialSeedsState,
  getCropYieldPerHarvest,
} from '../components/UpgradeList';
import { normalizeBarnShelvesUnlocked } from '../constants/barnShelves';
import { GAME_SAVE_VERSION, type GameSaveV1 } from './gameSave';

const getHexDistance = (q: number, r: number): number => (Math.abs(q) + Math.abs(r) + Math.abs(q + r)) / 2;

function generateInitialGrid(): BoardCell[] {
  const cells: BoardCell[] = [];
  for (let q = -2; q <= 2; q++) {
    const r1 = Math.max(-2, -q - 2);
    const r2 = Math.min(2, -q + 2);
    for (let r = r1; r <= r2; r++) {
      const distance = getHexDistance(q, r);
      const locked = distance === 2;
      cells.push({ q, r, item: null, locked });
    }
  }
  return cells;
}

/** Same center as `getGoalCropRequired` with zero random offset (stable save). */
function postFtueGoalCropRequired(playerLevel: number, cropYieldLevel: number): number {
  const baseGoal = 3 + Math.floor(cropYieldLevel * 0.5) + Math.floor(playerLevel / 4);
  return Math.max(3, Math.round(baseGoal * 1.0));
}

export function createPostFtueCleanSave(): GameSaveV1 {
  const seedsState = createInitialSeedsState();
  const harvestState = createInitialHarvestState();
  const cropsState = createInitialCropsState();
  const playerLevel = 1;
  const cropYieldLevel = getCropYieldPerHarvest(cropsState);
  const req = postFtueGoalCropRequired(playerLevel, cropYieldLevel);

  return {
    v: GAME_SAVE_VERSION,
    savedAt: Date.now(),
    pendingOfflineEarnings: 0,
    money: 0,
    grid: generateInitialGrid(),
    seedProgress: 0,
    harvestProgress: 0,
    harvestCharges: 3,
    seedsState,
    harvestState,
    cropsState,
    seedsInStorage: 5,
    highestPlantEver: 1,
    playerLevel,
    playerLevelProgress: 0,
    plantMasteryGoalsCompleted: 0,
    plantMasteryOrdersProgress: 0,
    plantMasteryTargetLevel: 1,
    plantMasteryUnlockPending: [],
    plantMasteryUnlockedLevels: [],
    plantMasteryIntroBarComplete: false,
    collectionFtueCompleted: false,
    collectionFtuePhase: null,
    activeTab: 'SEEDS',
    activeScreen: 'FARM',
    isExpanded: false,
    rewardedOffers: [],
    barnNotification: false,
    goalSlots: ['green', 'green', 'green', 'empty', 'empty'],
    goalPlantTypes: [1, 2, 3, 0, 0],
    goalLoadingSeconds: 15,
    goalCounts: [req, req, req, 0, 0],
    goalAmountsRequired: [req, req, req, 0, 0],
    goalCompletedValues: [0, 0, 0, 0, 0],
    goalDisplayOrder: [0, 1, 2],
    coinGoalVisible: false,
    coinGoalValue: 0,
    coinGoalTimeRemaining: 30,
    newGoalsSinceDiscovery: 0,
    lastMergeDiscoveryLevel: 1,
    lastSpawnedGoalLevels: [0, 0],
    activeFtueStage: null,
    ftue2SeedFireCount: 0,
    ftue2FadingOut: false,
    ftue3FadingOut: false,
    ftue4Pending: false,
    ftue4FadingOut: false,
    ftue7Scheduled: false,
    ftue7UnrevealedSlots: [],
    ftue7RevealMode: false,
    ftue7SeedFireCount: 0,
    ftue7FadingOut: false,
    ftue8FadingOut: false,
    ftue9CollectedCount: 0,
    ftue9FadingOut: false,
    ftue10Phase: null,
    ftue10GreenFlashUpgradeId: null,
    ftue10FadingOut: false,
    ftueSeedSurplusActivated: true,
    ftueHarvestSurplusActivated: true,
    ftue10PostClosePending: false,
    ftue10ButtonsNormalEarly: false,
    ftue11StartQueued: false,
    ftueUpgradePanelVisible: true,
    ftuePlayerLevelVisible: true,
    activeBoosts: [],
    pendingUnlockUpgradeId: null,
    levelUpPopupQueue: [],
    wildGrowthAccumulatorMs: 0,
    barnShelvesUnlocked: normalizeBarnShelvesUnlocked(),
  };
}
