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

export const GAME_SAVE_STORAGE_KEY = 'pocket-garden-save-v1';

export const GAME_SAVE_VERSION = 1 as const;

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
  coinGoalVisible: boolean;
  coinGoalValue: number;
  coinGoalTimeRemaining: number;
  newGoalsSinceDiscovery: number;
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
}
