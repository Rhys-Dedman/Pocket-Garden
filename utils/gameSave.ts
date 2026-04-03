/**
 * Persistent game save (localStorage). FTUE + progression + offline earnings bank.
 */
import type { BoardCell, ScreenType, TabType } from '../types';
import type { FtueStageId } from '../ftue/ftueConfig';
import type {
  HarvestState,
  RewardedOffer,
  SeedsState,
  UpgradeState,
} from '../components/UpgradeList';
import type { ActiveBoostData } from '../components/ActiveBoostIndicator';
import { STORE_STARTER_PACK_COUNTDOWN_END_MS_KEY } from '../offers';
import { normalizeBarnShelvesUnlocked } from '../constants/barnShelves';
import { PLANT_MASTERY_ORDERS_PER_SEGMENT, getMaxStoredOrdersProgressForTarget } from '../constants/plantMastery';
import { parseCollectionFtuePhase } from '../constants/collectionFtue';
import { AUTO_MERGE_STORAGE_KEY } from './autoMergeMode';

function normalizePlantMasteryUnlockPending(raw: unknown): number[] {
  if (!Array.isArray(raw)) return [];
  const set = new Set<number>();
  for (const x of raw) {
    const n = typeof x === 'number' ? x : Number.parseInt(String(x), 10);
    if (Number.isFinite(n)) {
      const k = Math.floor(n);
      if (k >= 1 && k <= 24) set.add(k);
    }
  }
  return [...set].sort((a, b) => a - b);
}

function normalizePlantMasteryUnlockedLevels(raw: unknown): number[] {
  if (!Array.isArray(raw)) return [];
  const set = new Set<number>();
  for (const x of raw) {
    const n = typeof x === 'number' ? x : Number.parseInt(String(x), 10);
    if (Number.isFinite(n)) {
      const k = Math.floor(n);
      if (k >= 1 && k <= 24) set.add(k);
    }
  }
  return [...set].sort((a, b) => a - b);
}

export const GAME_SAVE_STORAGE_KEY = 'pocket-garden-save-v1';

export const GAME_SAVE_VERSION = 1 as const;

/** Full buffer of normal goals before a +1 discovery order may spawn. Same curve as runtime discovery pacing. */
export function getDiscoveryGoalBuffer(highestPlant: number): number {
  const h = Math.max(0, Math.floor(highestPlant));
  if (h <= 3) return 4;
  if (h <= 4) return 6;
  if (h <= 5) return 9;
  if (h <= 6) return 12;
  if (h <= 7) return 14;
  if (h <= 8) return 16;
  if (h <= 9) return 18;
  return 20;
}

export interface GameSaveV1 {
  v: typeof GAME_SAVE_VERSION;
  savedAt: number;
  /** Uncollected offline surplus total (shown in Offline Earnings popup + new sim on load) */
  pendingOfflineEarnings: number;
  money: number;
  grid: BoardCell[];
  seedProgress: number;
  harvestProgress: number;
  harvestCharges: number;
  seedsState: SeedsState;
  harvestState: HarvestState;
  cropsState: Record<string, UpgradeState>;
  seedsInStorage: number;
  highestPlantEver: number;
  playerLevel: number;
  playerLevelProgress: number;
  /** Lifetime count of completed goals/orders (legacy / analytics). */
  plantMasteryGoalsCompleted: number;
  /** Orders completed toward current plant mastery segment (0..ordersPerSegment-1 while filling; segment max when terminal). */
  plantMasteryOrdersProgress: number;
  /** Next plant level (1–24) shown beside the mastery bar; segment credit applies to this plant when the bar fills. */
  plantMasteryTargetLevel: number;
  /** Plant levels (1–24) with mastery unlock available from the bar (not yet purchased). */
  plantMasteryUnlockPending: number[];
  /** Plant levels (1–24) where mastery has been purchased. */
  plantMasteryUnlockedLevels: number[];
  /**
   * After first Collection visit from level 5: bar shows fake 15/15 (display L4) until intro clears, then normal level 5 tally.
   * Next collected goal clears this; bar then mirrors player level progress; golden-pot queue advances on player level-up.
   */
  plantMasteryIntroBarComplete?: boolean;
  /** After collection FTUE fully finished (tapped Garden at end). */
  collectionFtueCompleted?: boolean;
  /** Resumable step for collection FTUE; cleared when completed. */
  collectionFtuePhase?: string | null;
  activeTab: TabType;
  activeScreen: ScreenType;
  isExpanded: boolean;
  rewardedOffers: RewardedOffer[];
  barnNotification: boolean;
  goalSlots: ('empty' | 'loading' | 'green' | 'completed')[];
  goalPlantTypes: number[];
  goalLoadingSeconds: number;
  goalCounts: number[];
  goalAmountsRequired: number[];
  goalCompletedValues: number[];
  goalDisplayOrder: number[];
  /** Discovery-order light-green frame until first crop bounce ends; optional on older saves. */
  goalDiscoveryLightGreenActive?: boolean[];
  coinGoalVisible: boolean;
  coinGoalValue: number;
  coinGoalTimeRemaining: number;
  /** @deprecated Derived on save as `buffer - discoveryGoalsRemaining` for older readers. */
  newGoalsSinceDiscovery: number;
  /** Goals remaining until a discovery order may spawn; authoritative when present. */
  discoveryGoalsRemaining?: number;
  lastMergeDiscoveryLevel: number;
  lastSpawnedGoalLevels: [number, number];
  activeFtueStage: FtueStageId | null;
  ftue2SeedFireCount: number;
  ftue2FadingOut: boolean;
  ftue3FadingOut: boolean;
  ftue4Pending: boolean;
  ftue4FadingOut: boolean;
  ftue7Scheduled: boolean;
  ftue7UnrevealedSlots: number[];
  ftue7RevealMode: boolean;
  ftue7SeedFireCount: number;
  ftue7FadingOut: boolean;
  ftue8FadingOut: boolean;
  ftue9CollectedCount: number;
  ftue9FadingOut: boolean;
  ftue10Phase: 'point_orders' | 'panel_open_orders' | 'finger' | null;
  ftue10GreenFlashUpgradeId: string | null;
  ftue10FadingOut: boolean;
  ftueSeedSurplusActivated: boolean;
  ftueHarvestSurplusActivated: boolean;
  ftue10PostClosePending: boolean;
  ftue10ButtonsNormalEarly: boolean;
  ftue11StartQueued: boolean;
  ftueUpgradePanelVisible: boolean;
  ftuePlayerLevelVisible: boolean;
  activeBoosts: ActiveBoostData[];
  pendingUnlockUpgradeId: string | null;
  levelUpPopupQueue: number[];
  /**
   * Wild Growth: ms accumulated toward next auto-duplicate (0 when upgrade inactive).
   * Missing on old saves → 0.
   */
  wildGrowthAccumulatorMs?: number;
  /** Shed shelves unlocked (6); missing on old saves → treated as all true in loader. */
  barnShelvesUnlocked: boolean[];
}

/** Best-effort when `goalDiscoveryLightGreenActive` missing (undiscovered tier === highest + 1 only). */
export function deriveGoalDiscoveryLightGreenActive(
  goalSlots: GameSaveV1['goalSlots'],
  goalPlantTypes: number[],
  highestPlantEver: number
): boolean[] {
  const h = Math.max(0, Math.floor(highestPlantEver));
  if (h >= 24) return [false, false, false, false, false];
  const discoveryTier = h + 1;
  return [0, 1, 2, 3, 4].map((i) => {
    const st = goalSlots[i];
    if (st !== 'green' && st !== 'loading') return false;
    const pl = goalPlantTypes[i] ?? 0;
    return pl >= 1 && pl === discoveryTier;
  });
}

export function loadGameSave(): GameSaveV1 | null {
  if (typeof localStorage === 'undefined') return null;
  try {
    const raw = localStorage.getItem(GAME_SAVE_STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as GameSaveV1;
    if (data?.v !== GAME_SAVE_VERSION || !Array.isArray(data.grid)) return null;
    if (!Array.isArray(data.levelUpPopupQueue)) data.levelUpPopupQueue = [];
    if (typeof data.pendingOfflineEarnings !== 'number' || Number.isNaN(data.pendingOfflineEarnings)) {
      data.pendingOfflineEarnings = 0;
    }
    if (typeof data.money !== 'number' || !Number.isFinite(data.money)) {
      data.money = 0;
    }
    if (!Array.isArray(data.activeBoosts)) data.activeBoosts = [];
    data.barnShelvesUnlocked = normalizeBarnShelvesUnlocked(data.barnShelvesUnlocked);
    if (typeof data.plantMasteryGoalsCompleted !== 'number' || !Number.isFinite(data.plantMasteryGoalsCompleted)) {
      data.plantMasteryGoalsCompleted = 0;
    }
    data.plantMasteryGoalsCompleted = Math.max(0, Math.floor(data.plantMasteryGoalsCompleted));
    if (typeof data.plantMasteryOrdersProgress !== 'number' || !Number.isFinite(data.plantMasteryOrdersProgress)) {
      data.plantMasteryOrdersProgress = 0;
    }
    data.plantMasteryOrdersProgress = Math.max(0, Math.floor(data.plantMasteryOrdersProgress));
    if (typeof data.plantMasteryTargetLevel !== 'number' || !Number.isFinite(data.plantMasteryTargetLevel)) {
      data.plantMasteryTargetLevel = 1;
    }
    data.plantMasteryTargetLevel = Math.max(1, Math.min(24, Math.floor(data.plantMasteryTargetLevel)));
    data.plantMasteryUnlockPending = normalizePlantMasteryUnlockPending(data.plantMasteryUnlockPending);
    data.plantMasteryUnlockedLevels = normalizePlantMasteryUnlockedLevels(
      (data as GameSaveV1 & { plantMasteryUnlockedLevels?: unknown }).plantMasteryUnlockedLevels
    );
    if (typeof data.plantMasteryIntroBarComplete !== 'boolean') {
      data.plantMasteryIntroBarComplete = false;
    }
    if (data.plantMasteryIntroBarComplete && data.plantMasteryTargetLevel !== 1) {
      data.plantMasteryIntroBarComplete = false;
    }
    const seg = PLANT_MASTERY_ORDERS_PER_SEGMENT;
    const maxP = getMaxStoredOrdersProgressForTarget(
      data.plantMasteryTargetLevel,
      seg,
      data.plantMasteryIntroBarComplete,
    );
    data.plantMasteryOrdersProgress = Math.min(data.plantMasteryOrdersProgress, maxP);
    if (typeof data.collectionFtueCompleted !== 'boolean') {
      data.collectionFtueCompleted = false;
    }
    let cPhase = parseCollectionFtuePhase(data.collectionFtuePhase);
    if (data.collectionFtueCompleted) cPhase = null;
    else {
      if (cPhase === 'popup_free' && data.plantMasteryUnlockPending.includes(1)) {
        cPhase = 'point_unlock';
      }
      if (cPhase === 'wait_reveal' && data.plantMasteryUnlockedLevels.includes(1)) {
        cPhase = 'point_bonuses';
      }
    }
    data.collectionFtuePhase = cPhase;
    const wg = (data as GameSaveV1).wildGrowthAccumulatorMs;
    if (typeof wg !== 'number' || !Number.isFinite(wg)) {
      (data as GameSaveV1).wildGrowthAccumulatorMs = 0;
    } else {
      (data as GameSaveV1).wildGrowthAccumulatorMs = Math.max(0, wg);
    }
    const gdl = data.goalDiscoveryLightGreenActive;
    if (!Array.isArray(gdl) || gdl.length !== 5) {
      data.goalDiscoveryLightGreenActive = deriveGoalDiscoveryLightGreenActive(
        data.goalSlots,
        data.goalPlantTypes,
        data.highestPlantEver
      );
    } else {
      data.goalDiscoveryLightGreenActive = gdl.map((x) => x === true);
    }
    return data;
  } catch {
    return null;
  }
}

export function persistGameSave(save: GameSaveV1): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(GAME_SAVE_STORAGE_KEY, JSON.stringify(save));
  } catch {
    /* quota / private mode */
  }
}

export function clearGameSave(): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.removeItem(GAME_SAVE_STORAGE_KEY);
  } catch {
    /* ignore */
  }
  try {
    localStorage.removeItem(STORE_STARTER_PACK_COUNTDOWN_END_MS_KEY);
  } catch {
    /* ignore */
  }
  try {
    localStorage.removeItem(AUTO_MERGE_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}
