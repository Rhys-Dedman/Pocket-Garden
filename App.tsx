
import React, { useState, useCallback, useRef, useEffect } from 'react';
import { createPortal, flushSync } from 'react-dom';
import { HexBoard, type HexBoardHandle } from './components/HexBoard';
import { UpgradeTabs } from './components/UpgradeTabs';
import { UpgradeList, createInitialSeedsState, createInitialHarvestState, createInitialCropsState, getSeedLevelFromHighestPlant, getBonusSeedChance, getSeedSurplusValue, getSeedStorageMax, getCropYieldPerHarvest, getHarvestSpeedLevel, getMergeHarvestChance, getGoalLoadingSeconds, getMarketValueMultiplier, getPremiumOrdersMinLevel, getSurplusSalesMultiplier, isSurplusSalesUnlocked, getHappyCustomerChance, HarvestState, UpgradeState, RewardedOffer, getLevelUnlockInfo, isCustomerSpeedMaxed } from './components/UpgradeList';
import { Navbar } from './components/Navbar';
import { StoreScreen } from './components/StoreScreen';
import { SideAction } from './components/SideAction';
import { Projectile } from './components/Projectile';
import { LeafBurst, LEAF_BURST_BASELINE_COUNT, LEAF_BURST_SMALL_COUNT } from './components/LeafBurst';
import { UnlockBurst } from './components/UnlockBurst';
import { CellHighlightBeam } from './components/CellHighlightBeam';
import { ShelfUnlockConeBurst } from './components/ShelfUnlockConeBurst';
import { CoinPanel, CoinPanelData } from './components/CoinPanel';
import { PlantPanel, PlantPanelData } from './components/PlantPanel';
import { GoalCoinParticle, GoalCoinParticleData } from './components/GoalCoinParticle';
import { WalletImpactBurst } from './components/WalletImpactBurst';
import { PageHeader, MAX_VISIBLE_BOOST_SLOTS } from './components/PageHeader';
import { DiscoveryPopup } from './components/DiscoveryPopup';
import { PurchaseSuccessfulPopup, type PurchaseSuccessfulRewardRow } from './components/PurchaseSuccessfulPopup';
import { LevelUpPopup } from './components/LevelUpPopup';
import { PlantInfoPopup } from './components/PlantInfoPopup';
import { PlantWithPot } from './components/PlantWithPot';
import { LimitedOfferPopup } from './components/LimitedOfferPopup';
import { FakeAdPopup } from './components/FakeAdPopup';
import { PauseMenuPopup } from './components/PauseMenuPopup';
import { BoostParticle, BoostParticleData } from './components/BoostParticle';
import { ActiveBoostData, ACTIVE_BOOST_INDICATOR_SIZE_PX } from './components/ActiveBoostIndicator';
import { UpgradeTabsRef } from './components/UpgradeTabs';
import { ButtonLeafBurst } from './components/ButtonLeafBurst';
import { BarnParticle, BarnParticleData } from './components/BarnParticle';
import { LoadingScreen } from './components/LoadingScreen';
import { FtuePopup } from './components/FtuePopup';
import { Ftue2Overlay } from './components/Ftue2Overlay';
import { Ftue3Overlay } from './components/Ftue3Overlay';
import { Ftue4Overlay } from './components/Ftue4Overlay';
import { Ftue5Overlay } from './components/Ftue5Overlay';
import { Ftue6Overlay } from './components/Ftue6Overlay';
import { Ftue7Overlay } from './components/Ftue7Overlay';
import { Ftue8Overlay } from './components/Ftue8Overlay';
import { Ftue9Overlay } from './components/Ftue9Overlay';
import { Ftue10Overlay } from './components/Ftue10Overlay';
import { Ftue11Overlay } from './components/Ftue11Overlay';
import { Ftue95Overlay } from './components/Ftue95Overlay';
import { TabType, ScreenType, BoardCell, Item, DragState } from './types';
import type { FtueStageId } from './ftue/ftueConfig';
import { assetPath } from './utils/assetPath';
import { getTickCount60, TARGET_FRAME_MS, scheduleNextFrame } from './utils/raf60';
import { getPerformanceMode } from './utils/performanceMode';
import { getAutoMergeMode } from './utils/autoMergeMode';
import {
  DOUBLE_COINS_HEADER_ICON,
  DOUBLE_COINS_OFFER_ID,
  LIMITED_OFFERS,
  LIMITED_OFFERS_AD_POOL,
  STORE_BUNDLE_OFFERS,
  STORE_COIN_OFFERS,
  getOfferById,
  isStorePremiumOnlyOfferId,
  applyDoubleCoinsVisualAmount,
  isCoinMultiplierBoostId,
  isLegacyCoinMultiplierOfferId,
  pickInitialStoreFreeOfferSlots,
  pickStoreDurationOfferId,
  getStorePurchaseBoostGrants,
  type StoreCoinOfferConfig,
} from './offers';
import {
  loadGameSave,
  persistGameSave,
  clearGameSave,
  type GameSaveV1,
  GAME_SAVE_VERSION,
} from './utils/gameSave';
import { isOfflineCoinEarningsBlockedByFtue, simulateOfflineSeedHarvest, simulateWildGrowthOffline } from './utils/offlineSimulate';
import {
  getWildGrowthIntervalMsForLevel,
  pickWildGrowthSpawn,
  WILD_GROWTH_UNLOCK_PLAYER_LEVEL,
} from './utils/wildGrowth';
import { OfflineEarningsPopup } from './components/OfflineEarningsPopup';
import { BARN_SHELF_COUNT, normalizeBarnShelvesUnlocked } from './constants/barnShelves';
import {
  PLANT_MASTERY_GLOW_MS,
  PLANT_MASTERY_ORDERS_PER_SEGMENT,
  getPlantMasteryUnlockCost,
} from './constants/plantMastery';
import { formatCompactNumber } from './utils/formatCompactNumber';
import { getPlantCoinValue } from './utils/plantValue';

/** Coin per plant level (economy). */
export function getCoinValueForLevel(level: number): number {
  return getPlantCoinValue(level);
}

/** Max plant goal slots: 3 until level 7 (Extra Orders), then 4. Slot 4 (5th) is reserved for coin goal only. */
const getMaxGoalSlots = (playerLevel: number): number =>
  playerLevel >= 7 ? 4 : 3;

/** Merge with no matching goal: coin panel uses seed-surplus scale (default cream panel bg). */
const MERGE_COIN_HARVEST_PANEL_SCALE = 1.5;

/** Goals required to level up. Level 1→2: 7; then each level = round(previous × 1.35) */
const getGoalsRequiredForLevel = (level: number): number => {
  if (level <= 1) return 7;
  let prev = 7;
  for (let i = 2; i <= level; i++) {
    prev = Math.round(prev * 1.35);
  }
  return prev;
};

/** Goal difficulty scaling: 0.9 = easier, 1.0 = normal, 1.1 = harder, 1.2 = much harder */
const GOAL_DIFFICULTY_SCALING = 1.0;

/** Double Coins duration when granted from a limited-offer / upgrade-panel rewarded ad (offer has no duration in config). */
const REWARDED_DOUBLE_COINS_AD_DURATION_MS = 30 * 60 * 1000;

function buildPurchaseSuccessRewards(config: StoreCoinOfferConfig): PurchaseSuccessfulRewardRow[] {
  const rows: PurchaseSuccessfulRewardRow[] = [
    {
      offerLineText: config.offerLineText,
      durationText: config.durationText,
      ...(config.rewardStripIconPath ? { coinIconPath: config.rewardStripIconPath } : {}),
    },
  ];
  if ('extraRewardRows' in config && config.extraRewardRows?.length) {
    for (const r of config.extraRewardRows) {
      rows.push({
        offerLineText: r.offerLineText,
        durationText: r.durationText,
        ...(r.coinIconPath ? { coinIconPath: r.coinIconPath } : {}),
        ...(r.coinIconScale != null ? { coinIconScale: r.coinIconScale } : {}),
      });
    }
  }
  return rows;
}

/** Build limited offer popup state from offer id (uses offers.ts config). */
function buildLimitedOfferPopupState(
  offerId: string,
  overrides?: { activeBoostEndTime?: number; highestPlantEver?: number }
): {
  isVisible: boolean;
  title: string;
  imageSrc: string;
  subtitle: string;
  description: string;
  buttonText: string;
  offerId: string;
  tab: TabType;
  durationMinutes: number | null;
  durationSeconds?: number | null;
  activeBoostEndTime?: number;
  subtitleSettingsStyle?: boolean;
  hideOfferDurationBlock?: boolean;
  imageLevel?: number;
} | null {
  const resolvedOfferId = isLegacyCoinMultiplierOfferId(offerId) ? DOUBLE_COINS_OFFER_ID : offerId;
  const offer = getOfferById(resolvedOfferId);
  if (!offer) return null;
  const specialDeliveryLevel =
    offer.id === 'special_delivery' && overrides?.highestPlantEver != null
      ? Math.max(1, Math.min(24, overrides.highestPlantEver - 1))
      : null;
  const imageSrc = assetPath(offer.headerIcon);
  const isCoinMult = isCoinMultiplierBoostId(resolvedOfferId);
  return {
    isVisible: true,
    title: 'Limited Offer',
    imageSrc,
    ...(specialDeliveryLevel != null ? { imageLevel: specialDeliveryLevel } : {}),
    subtitle: isCoinMult ? 'Double Coins' : offer.title,
    description: offer.description,
    buttonText: 'Accept Offer',
    offerId: offer.id,
    tab: offer.upgradeTab,
    durationMinutes: isCoinMult ? null : offer.durationMinutes,
    durationSeconds: isCoinMult ? null : offer.durationSeconds ?? null,
    subtitleSettingsStyle: isCoinMult,
    ...overrides,
  };
}

function normalizeBoostOfferIdForMerge(offerId: string | undefined): string | undefined {
  if (!offerId) return undefined;
  return isLegacyCoinMultiplierOfferId(offerId) ? DOUBLE_COINS_OFFER_ID : offerId;
}

function boostIconForOfferId(offerId: string, fallbackIcon?: string): string {
  if (isCoinMultiplierBoostId(offerId)) return DOUBLE_COINS_HEADER_ICON;
  const o = getOfferById(offerId);
  return o?.headerIcon ?? fallbackIcon ?? '/assets/icons/icon_seedproduction.png';
}

function predictBoostParticleTargetSlot(prev: ActiveBoostData[], offerId: string | undefined): number {
  const oid = normalizeBoostOfferIdForMerge(offerId);
  if (!oid) return Math.min(Math.max(0, prev.length), MAX_VISIBLE_BOOST_SLOTS - 1);
  const idx = prev.findIndex((b) => normalizeBoostOfferIdForMerge(b.offerId) === oid);
  const raw = idx >= 0 ? idx : prev.length;
  return Math.min(raw, MAX_VISIBLE_BOOST_SLOTS - 1);
}

/** Same-offer boosts stack (one entry, time added). Distinct offers can exceed 5; bar shows first N visible. */
function applyBoostParticleImpact(prev: ActiveBoostData[], data: BoostParticleData): ActiveBoostData[] {
  let oid = normalizeBoostOfferIdForMerge(data.offerId ?? '');
  const iconPath = data.icon ?? '';
  if (!oid && (iconPath.includes('coinmultiplier') || iconPath.includes('coin_multiplier'))) {
    oid = DOUBLE_COINS_OFFER_ID;
  }
  const now = Date.now();
  /** Min 1ms: duration 0 used to make boosts instantly expired and broke wallet multipliers + indicator. */
  const added = Math.max(1, data.durationMs ?? 60000);

  if (!oid) {
    return [
      ...prev,
      {
        id: `boost-${now}`,
        endTime: now + added,
        durationMs: added,
        icon: data.icon ?? '/assets/icons/icon_seedproduction.png',
        offerId: data.offerId,
      },
    ];
  }

  const matchIndex = prev.findIndex((b) => normalizeBoostOfferIdForMerge(b.offerId) === oid);

  if (matchIndex < 0) {
    const icon = boostIconForOfferId(oid, data.icon);
    return [
      ...prev,
      {
        id: `boost-${oid}-${now}`,
        endTime: now + added,
        durationMs: added,
        icon,
        offerId: oid,
      },
    ];
  }

  const existing = prev[matchIndex];
  const remaining = Math.max(0, existing.endTime - now);
  const newRemaining = remaining + added;
  const icon = boostIconForOfferId(oid, existing.icon || data.icon);

  return prev.map((b, i) =>
    i === matchIndex
      ? {
          ...b,
          endTime: now + newRemaining,
          durationMs: newRemaining,
          icon,
          offerId: oid,
        }
      : b
  );
}

function normalizeActiveBoostsAfterLoad(boosts: ActiveBoostData[]): ActiveBoostData[] {
  const now = Date.now();
  const list = boosts
    .filter((b) => b.endTime > now)
    .map((b) => {
      let oid = normalizeBoostOfferIdForMerge(b.offerId) ?? b.offerId;
      const ic = b.icon ?? '';
      if (!oid && (ic.includes('coinmultiplier') || ic.includes('coin_multiplier'))) {
        oid = DOUBLE_COINS_OFFER_ID;
      }
      const remaining = Math.max(0, b.endTime - now);
      const durationMs = b.durationMs > 0 ? b.durationMs : Math.max(1, remaining);
      return {
        ...b,
        offerId: oid,
        icon: boostIconForOfferId(oid ?? '', b.icon),
        durationMs,
      };
    });

  const byOffer = new Map<string, ActiveBoostData[]>();
  for (const b of list) {
    const key = b.offerId ?? '';
    if (!byOffer.has(key)) byOffer.set(key, []);
    byOffer.get(key)!.push(b);
  }

  const merged: ActiveBoostData[] = [];
  for (const [oid, group] of byOffer) {
    if (group.length === 1) {
      merged.push(group[0]);
      continue;
    }
    const totalRemain = group.reduce((s, b) => s + Math.max(0, b.endTime - now), 0);
    const first = group[0];
    merged.push({
      ...first,
      offerId: oid,
      icon: boostIconForOfferId(oid, first.icon),
      endTime: now + totalRemain,
      durationMs: totalRemain,
    });
  }
  return merged;
}

/** Number of NEW goals that must spawn after "discovering a plant" (merge) before we may show one +1 discovery goal. Only reset when player discovers by merge. */
const getDiscoveryGoalBuffer = (highestPlant: number): number => {
  if (highestPlant <= 3) return 4;
  if (highestPlant <= 4) return 6;
  if (highestPlant <= 5) return 8;
  if (highestPlant <= 6) return 10;
  if (highestPlant <= 7) return 12;
  if (highestPlant <= 8) return 14;
  if (highestPlant <= 9) return 16;
  return 18; // 10+
};

/** Discovery popup coin reward = `getCoinValueForLevel(plant)` × this (before Double Coins boost). */
const PLANT_DISCOVERY_COIN_MULTIPLIER = 5;

/**
 * Pick plant level for a new goal.
 * - "Discovering a plant" = merging to a new highest level. Only that event starts/resets the counter.
 * - Counter = new goals spawned since last merge discovery. We ONLY reset it in handleMerge when they discover.
 * - Discovery goal (highest+1) is ONLY allowed when: (1) NO discovery goal on board, (2) counter >= buffer. Impossible before that.
 * - If a discovery goal is already on board, we only show normal goals until they reach that level (then it's no longer discovery).
 * - Variety: last = last SPAWNED goal (loading→active). Next goal must NEVER be the same as last (no 2 same in a row). Call site updates lastSpawnedRef after every spawn.
 */
const pickGoalPlantLevel = (
  highestPlantEver: number,
  minLevel: number,
  seedLevel: number,
  newGoalsSinceDiscoveryRef: { current: number },
  lastMergeDiscoveryLevelRef: { current: number },
  lastSpawnedRef: { current: [number, number] },
  hasDiscoveryGoalOnBoard: boolean
): number => {
  const effectiveMin = Math.max(minLevel, seedLevel);
  const maxForRandom = Math.min(24, highestPlantEver);
  const buffer = getDiscoveryGoalBuffer(highestPlantEver);
  const [secondLast, last] = lastSpawnedRef.current;

  const pickRandomWithVariety = (): number => {
    const levels: number[] = [];
    for (let L = effectiveMin; L <= maxForRandom; L++) levels.push(L);
    if (levels.length === 0) return Math.max(seedLevel, Math.min(24, effectiveMin));
    // Absolutely never pick the same level as last spawned (loading→active); goals can complete out of order.
    let pool = last > 0 ? levels.filter((L) => L !== last) : levels;
    if (pool.length === 0) {
      // Only one level in range and it's the same as last – pick nearest other level to avoid repeat
      if (last - 1 >= effectiveMin) pool = [last - 1];
      else if (last + 1 <= maxForRandom) pool = [last + 1];
      else pool = [last]; // unavoidable (e.g. only level 1 in range)
    }
    // Also avoid 3 in a row (secondLast === last and we'd pick last again – already excluded above)
    if (secondLast === last && last > 0 && pool.length > 1) {
      const nextPool = pool.filter((L) => L !== last);
      if (nextPool.length > 0) pool = nextPool;
    }
    const level = pool[Math.floor(Math.random() * pool.length)];
    return Math.max(seedLevel, Math.min(24, level));
  };

  // Discovery goal already on board: only normal goals. Call site will increment counter for this spawn.
  if (hasDiscoveryGoalOnBoard) {
    return pickRandomWithVariety();
  }
  // Wrong "cycle": player discovered a new plant but counter wasn't reset. Recover.
  if (lastMergeDiscoveryLevelRef.current !== highestPlantEver) {
    lastMergeDiscoveryLevelRef.current = highestPlantEver;
    newGoalsSinceDiscoveryRef.current = 0;
  }
  // Strict: discovery ONLY after buffer new goals. When allowed, next goal is 100% discovery (highest+1), not a chance.
  if (highestPlantEver < 24 && newGoalsSinceDiscoveryRef.current >= buffer) {
    return highestPlantEver + 1;
  }
  return pickRandomWithVariety();
};

/** Crops required for goal order. Scales with player level (every 4 levels), crop yield, and has random variation. */
const getGoalCropRequired = (
  playerLevel: number,
  cropYieldLevel: number,
  goalDifficultyScaling: number = GOAL_DIFFICULTY_SCALING
): number => {
  const baseGoal =
    3 + Math.floor(cropYieldLevel * 0.5) + Math.floor(playerLevel / 4);
  const variationRange = 1 + Math.floor(playerLevel / 10);
  const randomOffset = Math.floor(Math.random() * (2 * variationRange + 1)) - variationRange;
  const variedGoal = baseGoal + randomOffset;
  const scaledGoal = Math.round(variedGoal * goalDifficultyScaling);
  return Math.max(3, scaledGoal);
};
import { ErrorBoundary } from './components/ErrorBoundary';

/** Ease-out for opening: easeOutQuint over first 50% (fast start, slow end), then hold */
const easeOutOpen = (t: number) => (t < 0.5 ? 1 - Math.pow(1 - t * 2, 5) : 1);
/** Ease-out for closing */
const easeOutClose = (t: number) => 1 - Math.pow(1 - t, 3);

/** Animate height with JS for reliable easing (CSS transitions weren't applying curve on open) */
function useAnimatedPanelHeight(isExpanded: boolean) {
  const [height, setHeight] = useState(isExpanded ? 279 : 50);
  const heightRef = useRef(height);
  heightRef.current = height;
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const target = isExpanded ? 279 : 50;
    const from = heightRef.current;
    if (Math.abs(from - target) < 1) return;

    const startTime = Date.now();
    const duration = isExpanded ? 1400 : 350;
    const ease = isExpanded ? easeOutOpen : easeOutClose;

    const tick = () => {
      const elapsed = Date.now() - startTime;
      const t = Math.min(1, elapsed / duration);
      const eased = ease(t);
      const next = from + (target - from) * eased;
      setHeight(t >= 1 ? target : next);
      if (t < 1) {
        rafRef.current = requestAnimationFrame(tick);
      }
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [isExpanded]);

  return height;
}

// Preload popup assets on module load to prevent flash of unstyled content
const POPUP_ASSETS_TO_PRELOAD = [
  assetPath('/assets/popups/popup_header.png'),
  assetPath('/assets/popups/popup_divider.png'),
  assetPath('/assets/vfx/particle_leaf_1.png'),
  assetPath('/assets/vfx/particle_leaf_2.png'),
  assetPath('/assets/plants/plant_pot.png'),
  assetPath('/assets/plants/plant_pot_m1.png'),
  ...([1, 2, 3, 4, 5].map((n) => assetPath(`/assets/icons/icons_goals/icon_goal_${n}.png`))),
];

POPUP_ASSETS_TO_PRELOAD.forEach((src) => {
  const img = new Image();
  img.src = src;
});

/** Goal icon for plant level: plant_N uses icon_goal_N.png (plants 1-24) */
const getGoalIconForPlantLevel = (plantLevel: number): string =>
  assetPath(`/assets/icons/icons_goals/icon_goal_${Math.max(1, Math.min(24, plantLevel))}.png`);

/** Negative animation-delay so every barn plant mastery glow shares the same phase. */
const PLANT_MASTERY_GLOW_ANIM_DELAY_SEC = -((Date.now() % PLANT_MASTERY_GLOW_MS) / 1000);

type PlantMasterySlice = {
  ordersProgress: number;
  targetLevel: number;
  unlockPending: number[];
  unlockedLevels: number[];
};

/** Plant names and descriptions for discovery popups */
const PLANT_DATA: Record<number, { name: string; description: string }> = {
  1: { name: 'Tiny Sprout', description: 'A tiny green shoot just starting out, doing its best to look important.' },
  2: { name: 'Young Sapling', description: 'A small tree in the making that already seems quite proud of itself.' },
  3: { name: 'Wild Fern', description: 'A cheerful tangle of leaves growing in whatever direction feels right today.' },
  4: { name: 'Rosette Succulent', description: 'A neat spiral of sturdy leaves best admired from a respectful distance.' },
  5: { name: 'Little Daisy', description: 'A simple little flower with an open face that\'s always happy to be included.' },
  6: { name: 'Spring Daffodil', description: 'Shows up early every year and behaves like it deserves the credit.' },
  // Swap text only between levels 7–9 (sprites/icons unchanged):
  // 7 ← 9, 8 ← 7, 9 ← 8
  7: { name: 'Fresh Lavender', description: 'Soft little flowers with a gentle scent that quietly spreads whether invited or not.' },
  8: { name: 'Pink Tulip', description: 'A tidy upright bloom that looks like it prefers things done properly.' },
  9: { name: 'Chrysanthemum', description: 'An impressive number of petals with no clear signs of stopping.' },
  10: { name: 'Thorny Rose', description: 'A beautiful bloom that encourages admiration at a sensible distance.' },
  11: { name: 'Cherry Blossom', description: 'Delicate petals that look ready to drift away the moment you get attached.' },
  12: { name: 'Blooming Iris', description: 'Wide elegant petals arranged like they know they turned out well.' },
  13: { name: 'Sacred Lotus', description: 'Perfect layered petals resting peacefully as if the rest of the garden can sort itself out.' },
  14: { name: 'Golden Sunflower', description: 'A shining bloom that never seems to get tired of being in the spotlight.' },
  15: { name: 'Corn Cobb', description: 'Kernels lined up in perfect rows like they practiced beforehand.' },
  16: { name: 'Sweet Strawberry', description: 'Bright little berries that rarely survive long enough to be shared.' },
  17: { name: 'Crunchy Carrot', description: 'Bright orange and pointy, making it a popular choice with snowmen.' },
  18: { name: 'Glossy Eggplant', description: 'A polished fruit that looks like it expects compliments.' },
  19: { name: 'Juicy Tomato', description: 'Round fruits gathering together like they have important things to discuss.' },
  20: { name: 'Sour Lemon', description: 'Bright and beautiful on the outside with a surprisingly bitter attitude.' },
  21: { name: 'Plump Pumpkin', description: 'A steady grower that never seems embarrassed about taking up space.' },
  22: { name: 'Garden Grapes', description: 'Clusters of fruit packed tightly together with no concern for personal space.' },
  23: { name: 'Crisp Apple', description: 'The most recognizable fruit and clearly aware of it.' },
  24: { name: 'Tree Star', description: 'A rare leafy treat that has remained popular since the age of dinosaurs.' },
};

function getPlantData(level: number): { name: string; description: string } {
  return PLANT_DATA[level] ?? { 
    name: `Plant Lv.${level}`, 
    description: 'A mysterious new plant species.' 
  };
}

// Helper to calculate hex distance from center (0,0) in axial coordinates
const getHexDistance = (q: number, r: number): number => {
  return (Math.abs(q) + Math.abs(r) + Math.abs(q + r)) / 2;
};

/** FTUE_2: first two seeds always land in these two cells (4 and 13). Order doesn't matter. */
const FTUE_2_SEED_CELL_A = 4;
const FTUE_2_SEED_CELL_B = 13;

const generateInitialGrid = (): BoardCell[] => {
  const cells: BoardCell[] = [];
  for (let q = -2; q <= 2; q++) {
    const r1 = Math.max(-2, -q - 2);
    const r2 = Math.min(2, -q + 2);
    for (let r = r1; r <= r2; r++) {
      // Outer ring (distance 2 from center) starts locked
      const distance = getHexDistance(q, r);
      const locked = distance === 2;
      cells.push({ q, r, item: null, locked });
    }
  }
  return cells;
};

export interface ProjectileData {
  id: string;
  startX: number;
  startY: number;
  targetIdx: number;
  plantLevel: number; // The level of plant to spawn on impact
  /** When true, projectile is Special Delivery: on impact spawn or upgrade cell, then beam + bounce */
  isSpecialDelivery?: boolean;
  /** Lucky Seed bonus shot: distinct yellow trail / head (coin gold tone). */
  isLuckyGrowth?: boolean;
}

/** First mount after "Reset progress": strip stray save + skip quick resume. Also used for normal quick-resume detection. */
function getInitialQuickResumeLoad(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    if (sessionStorage.getItem('pocket-garden-reset-v1') === '1') {
      sessionStorage.removeItem('pocket-garden-reset-v1');
      clearGameSave();
      return false;
    }
  } catch {
    /* ignore */
  }
  try {
    const s = loadGameSave();
    return !!(s && s.v === GAME_SAVE_VERSION);
  } catch {
    return false;
  }
}

/**
 * Max merge **result** tier allowed while plant orders are open: `min` of active green goal plant types.
 * Merging L+L → (L+1) must satisfy (L+1) ≤ cap, so we never auto-merge past the strictest open order (e.g. order for 4 blocks 4+4→5).
 * No plant goals → null (no cap except level 24).
 */
function getActiveOrderMergeResultCap(
  goalPlantTypes: number[],
  goalSlots: ('empty' | 'loading' | 'green' | 'completed')[],
  goalCounts: number[]
): number | null {
  const tiers: number[] = [];
  for (let i = 0; i < goalPlantTypes.length; i++) {
    const pt = goalPlantTypes[i];
    if (pt < 1 || pt > 24) continue;
    if (goalSlots[i] !== 'green') continue;
    if ((goalCounts[i] ?? 0) <= 0) continue;
    tiers.push(pt);
  }
  if (tiers.length === 0) return null;
  return Math.min(...tiers);
}

/**
 * Targets of in-flight seeds whose plant is not on the grid yet (`spawnCropAt` runs in onImpact but the
 * projectile stays mounted until the fly animation ends). Excluding only these cells fixes auto-merge stalling
 * while other mergable pairs are already valid.
 */
function getPendingSeedImpactTargets(grid: BoardCell[], projectiles: ProjectileData[]): Set<number> {
  const pending = new Set<number>();
  for (const p of projectiles) {
    const cell = grid[p.targetIdx];
    if (!cell?.item) pending.add(p.targetIdx);
  }
  return pending;
}

/** Same merge eligibility as manual play (HexBoard drop): same level + type, not locked, not max tier; not hex-adjacency. */
function canAutoMergePlantPair(
  grid: BoardCell[],
  i: number,
  j: number,
  mergeResultCap: number | null,
  excludeCells?: ReadonlySet<number>
): boolean {
  if (excludeCells?.has(i) || excludeCells?.has(j)) return false;
  const cell = grid[i];
  const other = grid[j];
  if (!cell?.item || cell.locked || !other?.item || other.locked) return false;
  if (other.item.level !== cell.item.level || other.item.type !== cell.item.type) return false;
  const L = cell.item.level;
  if (L >= 24) return false;
  if (mergeResultCap != null && L + 1 > mergeResultCap) return false;
  return true;
}

/**
 * Pick a merge pair matching **player** rules: any two unlocked plants with same level/type may merge (fly across the board).
 * Lowest tier first, then deterministic (smaller source index, then target).
 */
function findBestAutoMergePair(
  grid: BoardCell[],
  mergeResultCap: number | null,
  excludeCells?: ReadonlySet<number>
): { sourceIdx: number; targetIdx: number } | null {
  let minTier = Infinity;
  for (let i = 0; i < grid.length; i++) {
    for (let j = i + 1; j < grid.length; j++) {
      if (!canAutoMergePlantPair(grid, i, j, mergeResultCap, excludeCells)) continue;
      const L = grid[i].item!.level;
      if (L < minTier) minTier = L;
    }
  }
  if (minTier === Infinity) return null;

  let bestA = -1;
  let bestB = -1;
  for (let i = 0; i < grid.length; i++) {
    if (grid[i].item?.level !== minTier) continue;
    for (let j = i + 1; j < grid.length; j++) {
      if (!canAutoMergePlantPair(grid, i, j, mergeResultCap, excludeCells)) continue;
      if (grid[j].item!.level !== minTier) continue;
      if (bestA < 0 || i < bestA || (i === bestA && j < bestB)) {
        bestA = i;
        bestB = j;
      }
    }
  }
  if (bestA < 0) return null;
  return { sourceIdx: bestA, targetIdx: bestB };
}

/** Wait after seed impact or merge settle before running auto-merge scan. */
const AUTO_MERGE_POST_SETTLE_MS = 500;
/** Second full-board scan after a programmatic merge (catches another pair if the first try was early or state was still settling). */
const AUTO_MERGE_POST_MERGE_FOLLOWUP_MS = AUTO_MERGE_POST_SETTLE_MS + 120;
const AUTO_MERGE_POLL_MS = 320;
/** When the primary scan finds no pair, retry after this delay (transient mid-merge / React commit timing). Up to 2 passes per “empty” streak. */
const AUTO_MERGE_NULL_BACKUP_MS = 500;
/** Auto-merge must not start until this long after a plant lands from a seed, if that plant is part of the chosen pair. */
const AUTO_MERGE_SEED_INVOLVED_GRACE_MS = 1000;

function autoMergeSeedGraceRemainMsForPair(
  sourceIdx: number,
  targetIdx: number,
  now: number,
  landMap: ReadonlyMap<number, number>
): number {
  let remain = 0;
  for (const idx of [sourceIdx, targetIdx]) {
    const ts = landMap.get(idx);
    if (ts != null) remain = Math.max(remain, AUTO_MERGE_SEED_INVOLVED_GRACE_MS - (now - ts));
  }
  return remain;
}

export default function App() {
  // Loading screen state
  const [isLoading, setIsLoading] = useState(true);
  const [gameOpacity, setGameOpacity] = useState(0);
  /** Skip splash when a valid save exists at first paint (quick black fade instead). */
  const [useQuickResumeLoad] = useState(getInitialQuickResumeLoad);
  const pendingQuickLoadFinishRef = useRef(false);
  
  const [activeTab, setActiveTab] = useState<TabType>('SEEDS');
  const [activeScreen, setActiveScreen] = useState<ScreenType>('FARM');
  const [isExpanded, setIsExpanded] = useState(false);
  const panelHeight = useAnimatedPanelHeight(isExpanded);
  const [money, setMoney] = useState(0);
  // Used for synchronous updates during pagehide/unload so persisted snapshots are correct.
  const moneyRef = useRef<number>(money);
  useEffect(() => {
    moneyRef.current = money;
  }, [money]);

  const [grid, setGrid] = useState<BoardCell[]>(generateInitialGrid());
  const [seedProgress, setSeedProgress] = useState(0);
  const [harvestProgress, setHarvestProgress] = useState(0);
  const [isSeedFlashing, setIsSeedFlashing] = useState(false);
  /** Harvest charges: max 3, start full (3/3); white button when > 0 */
  const HARVEST_CHARGES_MAX = 3;
  const [harvestCharges, setHarvestCharges] = useState(HARVEST_CHARGES_MAX);
  const harvestChargesRef = useRef(HARVEST_CHARGES_MAX);
  harvestChargesRef.current = harvestCharges;
  const [seedsState, setSeedsState] = useState(createInitialSeedsState);
  const [harvestState, setHarvestState] = useState<HarvestState>(createInitialHarvestState);
  const [cropsState, setCropsState] = useState<Record<string, UpgradeState>>(createInitialCropsState);
  const [highestPlantEver, setHighestPlantEver] = useState(1); // Track highest plant level ever created
  const highestPlantEverRef = useRef(1);
  const [seedsInStorage, setSeedsInStorage] = useState(5); // Start 5/5; max grows with Storage Capacity (15)
  
  // Discovery popup state
  const [discoveryPopup, setDiscoveryPopup] = useState<{ isVisible: boolean; level: number } | null>(null);
  /** Paid store purchase confirmation (IAP stub); Collect fires boost particles + activation. */
  const [purchaseSuccessfulUi, setPurchaseSuccessfulUi] = useState<{
    headerImageSrc: string;
    rewards: PurchaseSuccessfulRewardRow[];
  } | null>(null);
  const pendingPurchaseBoostsRef = useRef<{ offerId: string; durationMs: number; icon: string }[]>([]);
  // Plant info popup state (for barn)
  const [plantInfoPopup, setPlantInfoPopup] = useState<{ isVisible: boolean; level: number } | null>(null);
  // Limited offer popup state
  const [limitedOfferPopup, setLimitedOfferPopup] = useState<{
    isVisible: boolean;
    title?: string;
    imageSrc: string;
    subtitle: string;
    description: string;
    buttonText: string;
    offerId?: string;
    tab?: TabType;
    durationMinutes?: number | null;
    durationSeconds?: number | null;
    activeBoostEndTime?: number;
    subtitleSettingsStyle?: boolean;
    hideOfferDurationBlock?: boolean;
    imageLevel?: number;
  } | null>(null);
  const lastLimitedOfferShownAtRef = useRef<number>(0);
  const lastShownOfferIdRef = useRef<string | null>(null);
  const lastShownOfferTabRef = useRef<TabType | null>(null);
  const lastLimitedOfferClosedAtRef = useRef<number>(0);
  const lastFakeAdClosedAtRef = useRef<number>(0); // 10s cooldown before showing limited offer popup after closing fake ad
  const lastOtherPopupClosedAtRef = useRef<number>(0); // 5–10s cooldown after closing level up / discovery / seed progression / plant info before showing limited offer
  const showFakeAdRef = useRef<boolean>(false); // so timers can pause while fake ad is visible
  const limitedOfferCooldownInitializedRef = useRef(false);
  // Rewarded offers shown in upgrade list (when player declines popup)
  const [rewardedOffers, setRewardedOffers] = useState<RewardedOffer[]>([]);
  // Discovery reward particles: fly from discovery popup reward icon to wallet.
  const [activeDiscoveryCoinParticles, setActiveDiscoveryCoinParticles] = useState<GoalCoinParticleData[]>([]);
  // Discovery CTA particle: fly from popup button to Collection nav button.
  const [activeBarnParticles, setActiveBarnParticles] = useState<BarnParticleData[]>([]);
  // Active rewarded-ad boosts (max 5); each has endTime and duration for radial countdown
  const [activeBoosts, setActiveBoostsState] = useState<ActiveBoostData[]>([]);
  /** Keep in sync with `activeBoosts` on every commit *inside* the setter so rAF / timers see boosts immediately (before the next render). */
  const activeBoostsRef = useRef<ActiveBoostData[]>(activeBoosts);
  /**
   * Flush synchronously so `activeBoostsRef` matches committed boosts before any other work in this
   * tick (e.g. another rAF batching wallet credits). React 18 otherwise may defer updaters past rAF.
   */
  const setActiveBoosts = useCallback((action: React.SetStateAction<ActiveBoostData[]>) => {
    flushSync(() => {
      if (typeof action === 'function') {
        setActiveBoostsState((prev) => {
          const next = action(prev);
          activeBoostsRef.current = next;
          return next;
        });
      } else {
        activeBoostsRef.current = action;
        setActiveBoostsState(action);
      }
    });
  }, []);
  /** Two store slots: current duration-boost offer id each (rotates after 15m cooldown). */
  const [storeFreeOfferSlots, setStoreFreeOfferSlots] = useState<[string, string]>(() => pickInitialStoreFreeOfferSlots());
  /** Per-slot cooldown end (ms); 0 = FREE available. */
  const [storeSlotCooldownEnds, setStoreSlotCooldownEnds] = useState<[number, number]>([0, 0]);

  const handleStoreSlotCooldownEnded = useCallback((slotIndex: number) => {
    setStoreFreeOfferSlots((slots) => {
      const prevThis = slots[slotIndex];
      const other = slots[1 - slotIndex];
      const nextId = pickStoreDurationOfferId(new Set([prevThis, other]));
      const next: [string, string] = [...slots] as [string, string];
      next[slotIndex] = nextId;
      return next;
    });
    setStoreSlotCooldownEnds((ends) => {
      const next: [number, number] = [...ends] as [number, number];
      next[slotIndex] = 0;
      return next;
    });
  }, []);

  const [boostParticles, setBoostParticles] = useState<BoostParticleData[]>([]);
  const [boostBursts, setBoostBursts] = useState<{ id: string; x: number; y: number; startTime: number }[]>([]);
  const activeBoostAreaRef = useRef<HTMLDivElement>(null);
  const headerLeftWrapperRef = useRef<HTMLDivElement>(null);
  const storeActiveBoostAreaRef = useRef<HTMLDivElement>(null);
  const storeHeaderLeftWrapperRef = useRef<HTMLDivElement>(null);
  const storeWalletRef = useRef<HTMLButtonElement>(null);
  // When user closes limited offer (X): open panel, scroll to offer, flash yellow then return to light yellow
  const [pendingOfferHighlightId, setPendingOfferHighlightId] = useState<string | null>(null);
  // Pause menu (opened from settings/gear button)
  const [pauseMenuOpen, setPauseMenuOpen] = useState(false);
  const [autoMergeSetting, setAutoMergeSetting] = useState(() => getAutoMergeMode());
  /** Uncollected offline surplus (persistent); also drives save version for popup. */
  const pendingOfflineEarningsRef = useRef(0);
  /** Synced to offline earnings popup display amount (for reliable collect payout). */
  const offlinePopupAmountRef = useRef(0);
  const [offlineEarningsUi, setOfflineEarningsUi] = useState<{
    open: boolean;
    amount: number;
    showDoubleButton: boolean;
    rewardBounceKey: number;
  } | null>(null);
  /** After offline earnings closes, block limited/rewarded offer popups for 10s (auto + manual). */
  const lastOfflineEarningsClosedAtRef = useRef<number>(0);
  const prevOfflineEarningsOpenRef = useRef(false);
  /** Ref so pagehide/visibility flush can safely detect the popup state without stale closures. */
  const offlineEarningsOpenRef = useRef(false);
  /** Per-popup guard so we only auto-credit once per offline earnings popup open. */
  const offlineEarningsAutoCollectedRef = useRef(false);
  /** Latest save closure for interval / pagehide (updated every render). */
  const persistGameSnapshotRef = useRef<() => void>(() => {});
  /** When true, skip all persists (prevents pagehide flush from re-saving after clearGameSave + reload). */
  const suppressGameSaveRef = useRef(false);
  /** Only allow writing progress to localStorage after FTUE 11 is fully closed. */
  const ftue11PersistenceEnabledRef = useRef(false);
  /** After spamming Unlock plant, show discovery only for this level when pause closes */
  const discoveryLevelAfterPauseCloseRef = useRef<number | null>(null);
  // Fake ad popup: show full-screen "ad", on Complete ad run callback then close
  const [showFakeAd, setShowFakeAd] = useState(false);
  showFakeAdRef.current = showFakeAd;
  const [pendingAdComplete, setPendingAdComplete] = useState<(() => void) | null>(null);
  // Ref for upgrade tabs to get tab element positions
  const upgradeTabsRef = useRef<UpgradeTabsRef>(null);
  // Barn notification: unread mastery unlocks waiting in Shed.
  const [barnNotification, setBarnNotification] = useState(false);
  const [seenMasteryUnlockLevels, setSeenMasteryUnlockLevels] = useState<number[]>([]);
  const [barnAttentionBounceLevels, setBarnAttentionBounceLevels] = useState<number[]>([]);
  const [unlockingCellIndices, setUnlockingCellIndices] = useState<number[]>([]); // Cells currently playing unlock animation
  // Goals: 3 slots until player level 7 (Extra Orders unlock); then 4 plant goal slots. Slot 4 (5th) is coin goal only.
  const [goalSlots, setGoalSlots] = useState<('empty' | 'loading' | 'green' | 'completed')[]>(['green', 'green', 'green', 'empty', 'empty']);
  const [goalPlantTypes, setGoalPlantTypes] = useState<number[]>([1, 2, 3, 0, 0]); // plant level 1-5 per slot when green
  const goalSlotsRef = useRef(goalSlots);
  const goalPlantTypesRef = useRef(goalPlantTypes);
  goalSlotsRef.current = goalSlots;
  goalPlantTypesRef.current = goalPlantTypes;
  const newGoalsSinceDiscoveryRef = useRef(0); // NEW goals spawned since last discovery (merge); discovery shows after getDiscoveryGoalBuffer(highest) new goals
  const lastMergeDiscoveryLevelRef = useRef(0); // highest level when we last reset the counter; only allow discovery when this === current highest (same "cycle")
  const lastSpawnedGoalLevelsRef = useRef<[number, number]>([0, 0]); // [second-to-last, last] for variety (no 2 same in a row, never 3)
  const lastProcessedGoalLoadingSlotRef = useRef<number | null>(null); // prevent duplicate pick/increment when effect runs twice (e.g. Strict Mode) for same loading slot
  const nextGoalSpawnIdRef = useRef(0); // unique id per spawn so we can dedupe in setTimeout without confusing reused slot indices
  const lastCommittedSpawnIdRef = useRef<number | null>(null); // only increment once per spawnId (same slot can load again for a different goal)
  const [goalLoadingSeconds, setGoalLoadingSeconds] = useState(15); // countdown 15->0 (Order Speed: 15 base - 2 per level)
  const [goalTransitionSlot, setGoalTransitionSlot] = useState<number | null>(null); // slot transitioning loading->green (for fade)
  const [goalTransitionFade, setGoalTransitionFade] = useState(false); // triggers fade: loading out, green in
  const [goalSlotFadeInSlot, setGoalSlotFadeInSlot] = useState<number | null>(null); // slot fading in 0→100% over 500ms; countdown waits until done
  const [goalCounts, setGoalCounts] = useState<number[]>([3, 3, 3, 0, 0]); // remaining count per slot when green (e.g. 3→2→1)
  const [goalAmountsRequired, setGoalAmountsRequired] = useState<number[]>([3, 3, 3, 0, 0]); // crops required when goal was created (for reward calc)
  const [goalCompletedValues, setGoalCompletedValues] = useState<number[]>([0, 0, 0, 0, 0]); // coin value when completed (plantValue × amountRequired × 2)
  const [goalImpactSlots, setGoalImpactSlots] = useState<number[]>([]); // slots currently playing impact (white flash + icon scale)
  const [goalBounceSlots, setGoalBounceSlots] = useState<number[]>([]); // slots currently bouncing (panel down)
  const [goalSlidingUpSlots, setGoalSlidingUpSlots] = useState<Set<number>>(new Set()); // slots currently playing slide-up animation
  const [goalCompactionStagger, setGoalCompactionStagger] = useState<{ completedSlotIdx: number; completedPosition: number; oldDisplayIndices: number[]; isOverlapping?: boolean } | null>(null);
  const [goalDisplayOrder, setGoalDisplayOrder] = useState<number[]>([0, 1, 2]); // Fixed left-to-right order; never reshuffle by plant type
  const [activeGoalCoinParticles, setActiveGoalCoinParticles] = useState<GoalCoinParticleData[]>([]);
  const goalIconRef0 = useRef<HTMLImageElement>(null);
  const goalIconRef1 = useRef<HTMLImageElement>(null);
  const goalIconRef2 = useRef<HTMLImageElement>(null);
  const goalIconRef3 = useRef<HTMLImageElement>(null);
  const goalIconRef4 = useRef<HTMLImageElement>(null);
  const goalIconRefs = [goalIconRef0, goalIconRef1, goalIconRef2, goalIconRef3, goalIconRef4];
  // Coin goal: always in 5th slot (index 4), 30s timer, 30s between spawns, tap → fake ad → explode to wallet
  const [coinGoalVisible, setCoinGoalVisible] = useState(false);
  const [coinGoalValue, setCoinGoalValue] = useState(0);
  const [coinGoalTimeRemaining, setCoinGoalTimeRemaining] = useState(30);
  const [coinGoalBounce, setCoinGoalBounce] = useState(false);
  const coinGoalIconRef = useRef<HTMLImageElement>(null);
  const lastCoinGoalHiddenAtRef = useRef<number>(Date.now());
  const nextCoinGoalDelayRef = useRef<number>(30000 + Math.random() * 30000); // 30–60s until next spawn, new random each hide
  const pendingAdSourceRef = useRef<'limitedOffer' | 'upgradeList' | 'coinGoal' | 'offlineEarnings' | 'storeFreeOffer' | null>(null);
  const pendingOfferIdRef = useRef<string | null>(null); // for boost particle: only shoot if offer has duration
  const [activePlantPanels, setActivePlantPanels] = useState<PlantPanelData[]>([]);
  const [fertilizingCellIndices, setFertilizingCellIndices] = useState<number[]>([]); // Cells currently playing fertilize animation

  // Calculate locked cell count from grid
  const lockedCellCount = grid.filter(cell => cell.locked).length;
  // Calculate fertilizable cell count (unlocked and not already fertile)
  const fertilizableCellCount = grid.filter(cell => !cell.locked && !cell.fertile).length;
  const [seedBounceTrigger, setSeedBounceTrigger] = useState(0); // increment each 100% so bounce animation re-runs
  const [harvestBounceTrigger, setHarvestBounceTrigger] = useState(0); // increment each harvest so bounce animation re-runs

  const seedStorageLevel = seedsState?.seed_storage?.level ?? 0;
  const seedStorageMax = getSeedStorageMax(seedsState); // 5 + level, max 15
  const seedLevel = getSeedLevelFromHighestPlant(highestPlantEver); // Seed level scales with highest plant discovered
  
  const gridRef = useRef<BoardCell[]>([]);
  gridRef.current = grid;
  const [activeProjectiles, setActiveProjectiles] = useState<ProjectileData[]>([]);
  const activeProjectilesRef = useRef<ProjectileData[]>([]);
  activeProjectilesRef.current = activeProjectiles;
  const hexBoardRef = useRef<HexBoardHandle>(null);
  const autoMergeRecheckTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Absolute timestamp (Date.now()) for the next scheduled tryStart; coalesces so a later schedule() never cancels an earlier retry. */
  const nextAutoMergeTryAtRef = useRef<number | null>(null);
  /** Cell index → time a seed-planted crop landed (for 1s merge grace when that plant is in the pair). */
  const recentSeedLandTimesRef = useRef<Map<number, number>>(new Map());
  /** After a null-pair scan, arm one “wave” of two delayed retries (poll would exhaust a counter before delays fire). */
  const autoMergeNullBackupWaveArmedRef = useRef(false);
  const scheduleAutoMergeRecheckRef = useRef<(delayMs: number) => void>(() => {});
  /** Batches simultaneous seed impacts into one setGrid (double seeds landing same frame). */
  const pendingProjectileCropSpawnsRef = useRef<Map<number, number>>(new Map());
  const projectileCropSpawnFlushScheduledRef = useRef(false);
  const tryStartAutoMergeRef = useRef<() => void>(() => {});
  const prevAutoMergeCapRef = useRef<number | null | undefined>(undefined);
  const wildGrowthAccumMsRef = useRef(0);
  const applyWildGrowthSpawnAtCellRef = useRef<(targetIdx: number, plantLevel: number) => void>(() => {});
  const [impactCellIdx, setImpactCellIdx] = useState<number | null>(null);
  const [returnImpactCellIdx, setReturnImpactCellIdx] = useState<number | null>(null);
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [sourceCellFadeOutIdx, setSourceCellFadeOutIdx] = useState<number | null>(null);
  const [newCellImpactIdx, setNewCellImpactIdx] = useState<number | null>(null);
  const [leafBursts, setLeafBursts] = useState<{ id: string; x: number; y: number; startTime: number }[]>([]);
  const [leafBurstsSmall, setLeafBurstsSmall] = useState<{ id: string; x: number; y: number; startTime: number; particleCount?: number; useCircle?: boolean }[]>([]);
  const [unlockBursts, setUnlockBursts] = useState<{ id: string; x: number; y: number; startTime: number }[]>([]);
  const [masteryPurchaseConeBursts, setMasteryPurchaseConeBursts] = useState<{ id: string; x: number; y: number; startTime: number }[]>([]);
  const [buttonLeafBursts, setButtonLeafBursts] = useState<{ id: string; x: number; y: number; startTime: number }[]>([]);
  const [goalCoinLeafBursts, setGoalCoinLeafBursts] = useState<{ id: string; x: number; y: number; startTime: number }[]>([]);
  const [cellHighlightBeams, setCellHighlightBeams] = useState<{ id: string; x: number; y: number; cellWidth: number; cellHeight: number; startTime: number; showHexSprite?: boolean; sparkleCount?: number; sparkleSizeScale?: number; sparkleHeightScale?: number }[]>([]);
  const [activeCoinPanels, setActiveCoinPanels] = useState<CoinPanelData[]>([]);
  const [coinPanelPortalRect, setCoinPanelPortalRect] = useState<{ left: number; top: number; width: number; height: number; scale: number } | null>(null);
  const [harvestBounceCellIndices, setHarvestBounceCellIndices] = useState<number[]>([]);
  const [maxPlantToasts, setMaxPlantToasts] = useState<{ id: string; x: number; y: number; startTime: number }[]>([]);
  const [walletFlashActive, setWalletFlashActive] = useState(false);
  const [walletBursts, setWalletBursts] = useState<{ id: number; trigger: number }[]>([]);
  /** Increments on coin impact to trigger wallet icon bounce (sparkles removed, bounce kept). */
  const [walletBounceTrigger, setWalletBounceTrigger] = useState(0);
  const [playerLevel, setPlayerLevel] = useState(1);
  const [playerLevelProgress, setPlayerLevelProgress] = useState(0); // 0-5, 5 goals to level up
  const [plantMasteryGoalsCompleted, setPlantMasteryGoalsCompleted] = useState(0);
  const [plantMastery, setPlantMastery] = useState<PlantMasterySlice>({
    ordersProgress: 0,
    targetLevel: 1,
    unlockPending: [],
    unlockedLevels: [],
  });
  const [masteryPurchaseRevealLevels, setMasteryPurchaseRevealLevels] = useState<number[]>([]);
  const masteryPurchaseRevealTimeoutRef = useRef<number | null>(null);
  const skipNextBarnPendingBounceRef = useRef(false);

  /** One increment per collected goal — same moment as player level XP (not on plant-panel impact; avoids double-count). */
  const applyGoalCollectedProgress = useCallback(() => {
    setPlantMasteryGoalsCompleted((c) => c + 1);
    const seg = PLANT_MASTERY_ORDERS_PER_SEGMENT;
    setPlantMastery((m) => {
      if (m.targetLevel === 24 && m.ordersProgress >= seg) {
        return m;
      }
      const nextP = m.ordersProgress + 1;
      if (nextP < seg) {
        return { ...m, ordersProgress: nextP };
      }
      const pending = m.unlockPending.includes(m.targetLevel)
        ? m.unlockPending
        : [...m.unlockPending, m.targetLevel].sort((a, b) => a - b);
      if (m.targetLevel < 24) {
        return {
          ordersProgress: 0,
          targetLevel: m.targetLevel + 1,
          unlockPending: pending,
          unlockedLevels: m.unlockedLevels,
        };
      }
      return {
        ordersProgress: seg,
        targetLevel: 24,
        unlockPending: pending,
        unlockedLevels: m.unlockedLevels,
      };
    });
  }, []);

  // Testing cheat: instantly complete the current mastery segment.
  const completeMasterySegmentCheat = useCallback(() => {
    const seg = PLANT_MASTERY_ORDERS_PER_SEGMENT;
    setPlantMastery((m) => {
      if (m.targetLevel === 24 && m.ordersProgress >= seg) return m;
      const pending = m.unlockPending.includes(m.targetLevel)
        ? m.unlockPending
        : [...m.unlockPending, m.targetLevel].sort((a, b) => a - b);
      if (m.targetLevel < 24) {
        return {
          ...m,
          ordersProgress: 0,
          targetLevel: m.targetLevel + 1,
          unlockPending: pending,
        };
      }
      return {
        ...m,
        ordersProgress: seg,
        targetLevel: 24,
        unlockPending: pending,
      };
    });
  }, []);

  const purchasePlantMasteryForLevel = useCallback(
    (level: number) => {
      const cost = getPlantMasteryUnlockCost(level);
      setPlantMastery((prev) => {
        if (!prev.unlockPending.includes(level)) return prev;
        if (money < cost) return prev;
        setMoney((m) => m - cost);
        return {
          ...prev,
          unlockPending: prev.unlockPending.filter((x) => x !== level),
          unlockedLevels: prev.unlockedLevels.includes(level)
            ? prev.unlockedLevels
            : [...prev.unlockedLevels, level].sort((a, b) => a - b),
        };
      });
    },
    [money]
  );

  const triggerMasteryPurchaseReveal = useCallback((level: number) => {
    if (masteryPurchaseRevealTimeoutRef.current) {
      window.clearTimeout(masteryPurchaseRevealTimeoutRef.current);
    }
    const el = barnScrollRef.current;
    const plantEl = el?.querySelector(`[data-barn-plant-level="${level}"]`) as HTMLElement | null;
    const r = plantEl?.getBoundingClientRect();
    if (r) {
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      const startTime = Date.now();
      setMasteryPurchaseConeBursts((prev) => [
        ...prev,
        { id: `mastery-buy-cone-${level}-${startTime}-${Math.random().toString(36).slice(2)}`, x: cx, y: cy, startTime },
      ]);
      setCellHighlightBeams((prev) => [
        ...prev,
        {
          id: `mastery-buy-beam-${level}-${startTime}-${Math.random().toString(36).slice(2)}`,
          x: cx,
          y: cy,
          cellWidth: r.width,
          cellHeight: r.height,
          startTime,
          showHexSprite: false,
          sparkleCount: 20,
          sparkleSizeScale: 2,
          sparkleHeightScale: 1.9,
        },
      ]);
    }
    setMasteryPurchaseRevealLevels((prev) => (prev.includes(level) ? prev : [...prev, level]));
    masteryPurchaseRevealTimeoutRef.current = window.setTimeout(() => {
      setMasteryPurchaseRevealLevels((prev) => prev.filter((x) => x !== level));
      masteryPurchaseRevealTimeoutRef.current = null;
    }, 650);
  }, []);

  const [playerLevelFlashTrigger, setPlayerLevelFlashTrigger] = useState(0);
  const [levelUpPopup, setLevelUpPopup] = useState<{ isVisible: boolean; level: number } | null>(null);
  /** Queued level-up popups (e.g. from pause menu fast-level); shown one by one after pause menu closes. */
  const [levelUpPopupQueue, setLevelUpPopupQueue] = useState<number[]>([]);
  /** FTUE: current stage (e.g. 'welcome' after splash); null when not in FTUE */
  const [activeFtueStage, setActiveFtueStage] = useState<FtueStageId | null>(null);
  /** Warning FTUE: shown when unlocked grid is full and all plants are unique. */
  const [outOfSpaceFtueVisible, setOutOfSpaceFtueVisible] = useState(false);
  /** Gate so dismissing doesn't instantly re-open until condition clears then re-enters. */
  const outOfSpaceArmedRef = useRef(true);
  /** FTUE_2: number of seeds fired (must be exactly 2 to complete); block 3rd tap */
  const [ftue2SeedFireCount, setFtue2SeedFireCount] = useState(0);
  /** FTUE_2: true when fading out finger + text after 2 seeds */
  const [ftue2FadingOut, setFtue2FadingOut] = useState(false);
  /** FTUE_2: block further seed taps after 2 (ref so rapid 3rd tap can't slip through before state updates) */
  const ftue2SeedsBlockedRef = useRef(false);
  /** FTUE_3: true when fading out finger + textbox after successful 4→13 merge */
  const [ftue3FadingOut, setFtue3FadingOut] = useState(false);
  /** FTUE_4: true when fading out textbox after "Lets Harvest!" click */
  const [ftue4FadingOut, setFtue4FadingOut] = useState(false);
  /** FTUE_4: true after FTUE 3 completes; start FTUE 4 only when player clicks "Excellent!" on plant 2 discovery */
  const [ftue4Pending, setFtue4Pending] = useState(false);
  type FtueRect = { left: number; top: number; width: number; height: number };
  /** FTUE: button rects in game-container coordinates (448×796 space) so overlays scale with the app. */
  const [seedButtonRect, setSeedButtonRect] = useState<FtueRect | null>(null);
  const [harvestButtonRect, setHarvestButtonRect] = useState<FtueRect | null>(null);
  /** FTUE: hide player level section until we reveal it (set to true when FTUE 6 shows) */
  const [ftuePlayerLevelVisible, setFtuePlayerLevelVisible] = useState(false);
  /** FTUE 7: after collecting in FTUE 6, schedule spawn of 2 goals then show "more orders" overlay */
  const [ftue7Scheduled, setFtue7Scheduled] = useState(false);
  const ftue7SkipLoadingSlot0Ref = useRef(false); // skip standard "start loading" for slot 0 when FTUE 7 will spawn goals
  /** Slots 0/1 in position but hidden until we reveal (fade-in); use goal-no-transition for both during this phase */
  const [ftue7UnrevealedSlots, setFtue7UnrevealedSlots] = useState<number[]>([]);
  const [ftue7RevealMode, setFtue7RevealMode] = useState(false); // true from first reveal until we clear fade-in slot
  /** Slots playing spawn bounce (panel + icon bounce, no white flash); cleared after 500ms */
  const [goalSpawnBounceSlots, setGoalSpawnBounceSlots] = useState<number[]>([]);
  const [ftue7SeedFireCount, setFtue7SeedFireCount] = useState(0);
  const [ftue7FadingOut, setFtue7FadingOut] = useState(false);
  const [ftue8FadingOut, setFtue8FadingOut] = useState(false);
  /** FTUE 9: collect both goals – finger on slot 1; fade out after both collected. No new goal loading during FTUE 9. */
  const [ftue9CollectedCount, setFtue9CollectedCount] = useState(0);
  const [ftue9FadingOut, setFtue9FadingOut] = useState(false);
  const ftue9NoNewGoalsRef = useRef(false);
  /** FTUE 10: manual – point_orders (tap Orders to open), panel_open_orders (tap Seeds), finger (tap purchase) */
  type Ftue10Phase = 'point_orders' | 'panel_open_orders' | 'finger';
  const [ftue10Phase, setFtue10Phase] = useState<Ftue10Phase | null>(null);
  const [ftue10GreenFlashUpgradeId, setFtue10GreenFlashUpgradeId] = useState<string | null>(null);
  const [ftue10FadingOut, setFtue10FadingOut] = useState(false);
  const [ftueSeedSurplusActivated, setFtueSeedSurplusActivated] = useState(false);
  const [ftueHarvestSurplusActivated, setFtueHarvestSurplusActivated] = useState(false);
  const [ftue10PostClosePending, setFtue10PostClosePending] = useState(false);
  const [ftue11StartQueued, setFtue11StartQueued] = useState(false);
  const [ftue10BigBounceActive, setFtue10BigBounceActive] = useState(false);
  const [ftue10ButtonsNormalEarly, setFtue10ButtonsNormalEarly] = useState(false);
  const [ftue95ShowTextbox, setFtue95ShowTextbox] = useState(false);
  const [ftue95FadingOut, setFtue95FadingOut] = useState(false);
  const ftue11Delay1Ref = useRef<ReturnType<typeof setTimeout> | null>(null);
  const ftue11Delay2Ref = useRef<ReturnType<typeof setTimeout> | null>(null);
  const ftue11InFlightRef = useRef(false);
  const ftue10BigBounceTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const ftue95EnterTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const ftue95StartOnceRef = useRef(false);

  // FTUE 10 → 11: wait until upgrade panel is fully closed, enable surplus, then show FTUE 11.
  useEffect(() => {
    if (!ftue11StartQueued) return;
    // Panel closed height target is 50 (see useAnimatedPanelHeight). Wait until we reach it.
    if (panelHeight > 50.5) return;

    // Prevent double-scheduling if panelHeight fluctuates around the threshold.
    if (ftue11InFlightRef.current) return;
    ftue11InFlightRef.current = true;

    if (ftue11Delay1Ref.current) clearTimeout(ftue11Delay1Ref.current);
    if (ftue11Delay2Ref.current) clearTimeout(ftue11Delay2Ref.current);

    // upgrade panel closes -> immediately set progress -> immediately show FTUE11 textbox
    if (ftue10PostClosePending) {
      setFtueSeedSurplusActivated(true);
      setFtueHarvestSurplusActivated(true);
      setHarvestCharges(HARVEST_CHARGES_MAX);
      harvestChargesRef.current = HARVEST_CHARGES_MAX;
      setFtue10PostClosePending(false);
    }

    setActiveFtueStage('recharge_intro');
    setFtue11StartQueued(false);
    ftue11InFlightRef.current = false;
  }, [ftue11StartQueued, panelHeight, ftue10PostClosePending]);
  /** FTUE 10: purchase button rect (measured in App like harvest/seed) so overlay uses same viewport coords */
  const [ftue10PurchaseButtonRect, setFtue10PurchaseButtonRect] = useState<FtueRect | null>(null);
  const ftue10PurchaseButtonRef = useRef<HTMLButtonElement | null>(null);
  /** FTUE: hide upgrade panel until we reveal it (set to true when ready) */
  const [ftueUpgradePanelVisible, setFtueUpgradePanelVisible] = useState(false);
  /** FTUE: hide seeds button during loading and welcome; reveal when FTUE_2 (seed_tap) shows. Hidden from first frame so no fade-in flash. */
  const ftueHideSeedsButton = isLoading || activeFtueStage === 'welcome';
  /** FTUE: hide harvest button during loading and welcome/seed_tap/merge_drag/first_goal (visible during first_harvest and first_harvest_multi for FTUE 5 & 8). */
  const ftueHideHarvestButton = isLoading || activeFtueStage === 'welcome' || activeFtueStage === 'seed_tap' || activeFtueStage === 'merge_drag' || activeFtueStage === 'first_goal';
  /** FTUE: hide goals area during welcome/seed_tap/merge_drag (empty during FTUE 1–3) */
  const ftueHideGoals = activeFtueStage === 'welcome' || activeFtueStage === 'seed_tap' || activeFtueStage === 'merge_drag';
  /**
   * Seeds button in "free" mode – 0% progress, badge "FREE".
   * - Stay green-free through FTUE 1–10 (including FTUE 10 close), and only switch to normal when FTUE 11 textbox shows.
   */
  const seedsFreeMode =
    (
      (activeFtueStage != null && activeFtueStage !== 'recharge_intro') ||
      ftue7Scheduled
    ) &&
    // During FTUE 10 ("first_upgrade") we still want to see normal seed progress.
    activeFtueStage !== 'first_upgrade' &&
    !ftue10ButtonsNormalEarly;
  /**
   * Harvest button free mode:
   * - Stay green-free through FTUE 5–10 (including FTUE 10 close), and only switch to normal when FTUE 11 textbox shows.
   */
  const harvestFreeMode =
    (
      (activeFtueStage != null && activeFtueStage !== 'recharge_intro') ||
      ftue7Scheduled
    ) &&
    activeFtueStage !== 'welcome' &&
    activeFtueStage !== 'seed_tap' &&
    activeFtueStage !== 'merge_drag' &&
    activeFtueStage !== 'first_goal' &&
    !ftue10ButtonsNormalEarly;
  const [pendingUnlockUpgradeId, setPendingUnlockUpgradeId] = useState<string | null>(null);
  const nextWalletBurstIdRef = useRef(0);
  const nextGoalCoinBurstIdRef = useRef(0);
  const levelUpGuardRef = useRef(false);
  const walletFlashTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Batch coin panel impacts (many harvests) to one setState flush per frame for FPS. */
  const pendingCoinImpactRef = useRef({ total: 0, scheduled: false });
  const walletImpactFlushRafRef = useRef<number>(0);
  const pendingMergeLevelIncreaseRef = useRef<number>(1);
  const plantButtonRef = useRef<HTMLDivElement>(null);
  const harvestButtonRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  /** Full-viewport layer for discovery reward coin VFX — same CSS space as modal popups so spawn matches getBoundingClientRect. */
  const discoveryRewardFxLayerRef = useRef<HTMLDivElement>(null);
  // Coin panel portal: compute the scaled game-container position so coin panels can render above FTUE overlays.
  useEffect(() => {
    const update = () => {
      const el = containerRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const s = appScaleRef.current || 1;
      setCoinPanelPortalRect({ left: r.left, top: r.top, width: r.width / s, height: r.height / s, scale: s });
    };
    update();
    window.addEventListener('resize', update);
    const raf = requestAnimationFrame(update);
    return () => {
      window.removeEventListener('resize', update);
      cancelAnimationFrame(raf);
    };
  }, []);

  useEffect(() => {
    return () => {
      if (ftue11Delay1Ref.current) clearTimeout(ftue11Delay1Ref.current);
      if (ftue11Delay2Ref.current) clearTimeout(ftue11Delay2Ref.current);
      if (ftue10BigBounceTimeoutRef.current) clearTimeout(ftue10BigBounceTimeoutRef.current);
      if (ftue95EnterTimeoutRef.current) clearTimeout(ftue95EnterTimeoutRef.current);
    };
  }, []);

  // FTUE 9.5: big bounce -> show textbox -> loop bounce until confirm
  useEffect(() => {
    if (activeFtueStage !== 'recharge_pre_upgrade') {
      ftue95StartOnceRef.current = false;
      setFtue95ShowTextbox(false);
      setFtue95FadingOut(false);
      return;
    }
    if (ftue95StartOnceRef.current) return;
    ftue95StartOnceRef.current = true;

    setFtue95ShowTextbox(false);
    setFtue95FadingOut(false);

    // Enable the recharge/surplus behavior now, and move bars to 75% to demonstrate quickly.
    setFtueSeedSurplusActivated(true);
    setFtueHarvestSurplusActivated(true);
    seedProgressRef.current = 75;
    setSeedProgress(75);
    harvestProgressRef.current = 75;
    setHarvestProgress(75);
    setHarvestCharges(HARVEST_CHARGES_MAX);
    harvestChargesRef.current = HARVEST_CHARGES_MAX;

    // Swap buttons to normal + leaf burst + big bounce.
    setFtue10ButtonsNormalEarly(true);
    triggerSeedButtonLeafBurst();
    triggerHarvestButtonLeafBurst();
    setFtue10BigBounceActive(true);
    if (ftue10BigBounceTimeoutRef.current) clearTimeout(ftue10BigBounceTimeoutRef.current);
    ftue10BigBounceTimeoutRef.current = setTimeout(() => setFtue10BigBounceActive(false), 500);

    if (ftue95EnterTimeoutRef.current) clearTimeout(ftue95EnterTimeoutRef.current);
    ftue95EnterTimeoutRef.current = setTimeout(() => {
      setFtue95ShowTextbox(true);
    }, 500);
  }, [activeFtueStage]);
  const farmColumnRef = useRef<HTMLDivElement>(null);
  const hexAreaRef = useRef<HTMLDivElement>(null);
  const walletRef = useRef<HTMLButtonElement>(null);
  const walletIconRef = useRef<HTMLSpanElement>(null);
  const barnButtonRef = useRef<HTMLButtonElement>(null);
  const barnScrollRef = useRef<HTMLDivElement>(null);
  const barnScrollYRef = useRef(0);
  const barnAttentionBounceTimeoutRef = useRef<number | null>(null);
  const barnEnterFocusTimeoutRef = useRef<number | null>(null);
  // Slots with in-flight crops that will complete the goal; exclude from routing so follow-up harvests go to next goal
  const goalsPendingCompletionRef = useRef<Set<number>>(new Set());
  /** Crop amount already flying to each goal slot (mid-air panels); subtract on impact so rapid harvest taps can't over-commit */
  const goalInFlightHarvestBySlotRef = useRef<Record<number, number>>({});
  const nextRewardedAdOfferIndexRef = useRef(0);
  activeBoostsRef.current = activeBoosts;

  useEffect(() => {
    goalSlots.forEach((s, i) => {
      if (s === 'green') goalsPendingCompletionRef.current.delete(i);
      if (s !== 'green') goalInFlightHarvestBySlotRef.current[i] = 0;
    });
  }, [goalSlots]);

  useEffect(() => { highestPlantEverRef.current = highestPlantEver; }, [highestPlantEver]);

  const toContainerRect = useCallback((r: DOMRect): FtueRect | null => {
    const container = containerRef.current;
    const s = appScaleRef.current || 1;
    if (!container) return null;
    const cr = container.getBoundingClientRect();
    return {
      left: (r.left - cr.left) / s,
      top: (r.top - cr.top) / s,
      width: r.width / s,
      height: r.height / s,
    };
  }, []);

  // FTUE_2: keep seed button rect for overlay hole + finger + text position
  const updateSeedButtonRect = useCallback(() => {
    const btn = plantButtonRef.current;
    if (!btn) return;
    const r = btn.getBoundingClientRect();
    setSeedButtonRect(toContainerRect(r));
  }, [toContainerRect]);
  useEffect(() => {
    if (activeFtueStage !== 'seed_tap' && !ftue2FadingOut && activeFtueStage !== 'first_more_orders' && !ftue7FadingOut) return;
    updateSeedButtonRect();
    window.addEventListener('resize', updateSeedButtonRect);
    const raf = requestAnimationFrame(updateSeedButtonRect);
    return () => {
      window.removeEventListener('resize', updateSeedButtonRect);
      cancelAnimationFrame(raf);
    };
  }, [activeFtueStage, ftue2FadingOut, ftue7FadingOut, updateSeedButtonRect]);

  // FTUE 6: fade in player level section when collect-coins step shows
  useEffect(() => {
    if (activeFtueStage === 'first_goal_collect') setFtuePlayerLevelVisible(true);
  }, [activeFtueStage]);

  // FTUE 7: 700ms after FTUE 6 collect, put both goals in position then reveal (500ms apart), then 0.5s later show textbox/finger
  useEffect(() => {
    if (!ftue7Scheduled) return;
    const t1 = setTimeout(() => {
      ftue7SkipLoadingSlot0Ref.current = false;
      setGoalSlots((s) => { const n = [...s]; n[0] = 'green'; n[1] = 'green'; return n; });
      setGoalPlantTypes((p) => { const n = [...p]; n[0] = 1; n[1] = 2; return n; });
      setGoalCounts((c) => { const n = [...c]; n[0] = 5; n[1] = 3; return n; });
      setGoalAmountsRequired((a) => { const n = [...a]; n[0] = 5; n[1] = 3; return n; });
      setGoalDisplayOrder([0, 1]);
      setFtue7UnrevealedSlots([0, 1]);
      setFtue7RevealMode(true);
      setGoalSlotFadeInSlot(0);
      setGoalBounceSlots((prev) => (prev.includes(0) ? prev : [...prev, 0]));
      setGoalSpawnBounceSlots((prev) => (prev.includes(0) ? prev : [...prev, 0]));
    }, 700);
    const t2 = setTimeout(() => {
      setGoalBounceSlots((prev) => prev.filter((s) => s !== 0));
      setGoalSpawnBounceSlots((prev) => prev.filter((s) => s !== 0));
      setGoalSlotFadeInSlot(1);
      setFtue7UnrevealedSlots((prev) => prev.filter((s) => s !== 0));
      setGoalBounceSlots((prev) => (prev.includes(1) ? prev : [...prev, 1]));
      setGoalSpawnBounceSlots((prev) => (prev.includes(1) ? prev : [...prev, 1]));
    }, 1200);
    const t3 = setTimeout(() => {
      setGoalBounceSlots((prev) => prev.filter((s) => s !== 1));
      setGoalSpawnBounceSlots((prev) => prev.filter((s) => s !== 1));
      setGoalSlotFadeInSlot(null);
      setFtue7UnrevealedSlots([]);
      setFtue7RevealMode(false);
    }, 1700);
    const t4 = setTimeout(() => {
      setActiveFtueStage('first_more_orders');
      setFtue7Scheduled(false);
    }, 1700); // 0.5s after goal 2 (goal 2 at 1.2s, textbox at 1.7s)
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); clearTimeout(t4); };
  }, [ftue7Scheduled]);

  // FTUE_5: keep harvest button rect for overlay hole + finger + text
  const updateHarvestButtonRect = useCallback(() => {
    const btn = harvestButtonRef.current;
    if (!btn) return;
    const r = btn.getBoundingClientRect();
    setHarvestButtonRect(toContainerRect(r));
  }, [toContainerRect]);
  useEffect(() => {
    if (activeFtueStage !== 'first_harvest' && activeFtueStage !== 'first_harvest_multi' && activeFtueStage !== 'first_upgrade') return;
    updateHarvestButtonRect();
    window.addEventListener('resize', updateHarvestButtonRect);
    const raf = requestAnimationFrame(updateHarvestButtonRect);
    return () => {
      window.removeEventListener('resize', updateHarvestButtonRect);
      cancelAnimationFrame(raf);
    };
  }, [activeFtueStage, updateHarvestButtonRect]);

  // FTUE_10: measure purchase button in App (same as harvest/seed) so overlay finger uses correct viewport coords
  const updateFtue10PurchaseButtonRect = useCallback(() => {
    const btn = ftue10PurchaseButtonRef.current;
    if (!btn) {
      setFtue10PurchaseButtonRect(null);
      return;
    }
    const r = btn.getBoundingClientRect();
    setFtue10PurchaseButtonRect(toContainerRect(r));
  }, [toContainerRect]);
  useEffect(() => {
    if (ftue10Phase !== 'finger') {
      setFtue10PurchaseButtonRect(null);
      return;
    }
    updateFtue10PurchaseButtonRect();
    const t1 = setTimeout(updateFtue10PurchaseButtonRect, 100);
    const t2 = setTimeout(updateFtue10PurchaseButtonRect, 250);
    const t3 = setTimeout(updateFtue10PurchaseButtonRect, 350);
    window.addEventListener('resize', updateFtue10PurchaseButtonRect);
    const raf = requestAnimationFrame(updateFtue10PurchaseButtonRect);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      window.removeEventListener('resize', updateFtue10PurchaseButtonRect);
      cancelAnimationFrame(raf);
    };
  }, [ftue10Phase, updateFtue10PurchaseButtonRect]);

  // FTUE: keep seeds and harvest progress bars at 0% (reset refs + state) during early FTUEs.
  // After FTUE 10 purchase (ftue10FadingOut) and during FTUE 11 (recharge_intro), allow normal recharge timers to run.
  useEffect(() => {
    const isFtue10PostPurchaseFade = activeFtueStage === 'first_upgrade' && ftue10FadingOut;
    if (
      (
        activeFtueStage != null &&
        activeFtueStage !== 'recharge_pre_upgrade' &&
        activeFtueStage !== 'first_upgrade' &&
        activeFtueStage !== 'recharge_intro' &&
        !isFtue10PostPurchaseFade
      ) ||
      ftue7Scheduled
    ) {
      seedProgressRef.current = 0;
      setSeedProgress(0);
    }
    if (activeFtueStage === 'first_harvest' || activeFtueStage === 'first_goal_collect' || activeFtueStage === 'first_more_orders' || activeFtueStage === 'first_harvest_multi' || ftue7Scheduled) {
      harvestProgressRef.current = 0;
      setHarvestProgress(0);
    }
  }, [activeFtueStage, ftue7Scheduled, ftue10FadingOut]);

  // FTUE 8: when both goals (slot 0 and 1) are completed, start FTUE 9 immediately (block collect) and fade out FTUE 8 overlay
  useEffect(() => {
    if (activeFtueStage !== 'first_harvest_multi') return;
    if (goalSlots[0] === 'completed' && goalSlots[1] === 'completed') {
      setActiveFtueStage('first_collect_both'); // FTUE 9 blocks taps immediately so player can't collect before overlay shows
      setFtue8FadingOut(true);
    }
  }, [activeFtueStage, goalSlots]);

  // FTUE 9: block new goal loading while active or fading out (collect 1 → 1 goal left, no loading)
  useEffect(() => {
    ftue9NoNewGoalsRef.current = activeFtueStage === 'first_collect_both' || ftue9FadingOut;
  }, [activeFtueStage, ftue9FadingOut]);

  const prevSeedLevelRef = useRef(0);

  const [spriteCenter, setSpriteCenter] = useState({ x: 50, y: 50 }); // % relative to column, for sprite center

  // Track viewport dimensions for responsive scaling
  // Use visualViewport when available (more accurate on mobile when browser chrome shows/hides)
  const getViewportSize = () => {
    if (typeof window === 'undefined') return { width: 420, height: 800, offsetTop: 0 };
    const vv = window.visualViewport;
    if (vv) {
      // Use the smaller of visualViewport and innerWidth for width - ensures we never overflow on devices where they differ
      const width = Math.min(vv.width, window.innerWidth);
      return { width, height: vv.height, offsetTop: vv.offsetTop ?? 0 };
    }
    return { width: window.innerWidth, height: window.innerHeight, offsetTop: 0 };
  };
  const [viewportWidth, setViewportWidth] = useState(typeof window !== 'undefined' ? getViewportSize().width : 420);
  const [viewportHeight, setViewportHeight] = useState(typeof window !== 'undefined' ? getViewportSize().height : 800);
  const [viewportOffsetTop, setViewportOffsetTop] = useState(typeof window !== 'undefined' ? getViewportSize().offsetTop : 0);
  const viewportWrapperRef = useRef<HTMLDivElement | null>(null);
  
  useEffect(() => {
    const update = () => {
      const { width, height, offsetTop } = getViewportSize();
      setViewportWidth(width);
      setViewportHeight(height);
      setViewportOffsetTop(offsetTop);
      // Prevent scroll accumulation causing apparent vertical drift while resizing.
      if (viewportWrapperRef.current) viewportWrapperRef.current.scrollTop = 0;
    };
    update();
    window.addEventListener('resize', update);
    const vv = window.visualViewport;
    if (vv) vv.addEventListener('resize', update);
    if (vv) vv.addEventListener('scroll', update);
    return () => {
      window.removeEventListener('resize', update);
      if (vv) {
        vv.removeEventListener('resize', update);
        vv.removeEventListener('scroll', update);
      }
    };
  }, []);

// Countdown timer for rewarded offers (1 second tick). Don't remove an offer at 0s while its popup is open. Pause while fake ad is visible.
  const protectedOfferId = limitedOfferPopup?.isVisible ? (limitedOfferPopup?.offerId ?? null) : null;
  useEffect(() => {
    if (rewardedOffers.length === 0) return;

    const interval = setInterval(() => {
      if (showFakeAdRef.current) return;
      setRewardedOffers(prev => {
        const updated = prev.map(offer => ({
          ...offer,
          timeRemaining: offer.timeRemaining !== undefined ? Math.max(0, offer.timeRemaining - 1) : undefined
        }));

        // Remove expired offers (timer reached 0), unless that offer's popup is currently open
        return updated.filter(o => o.timeRemaining === undefined || o.timeRemaining > 0 || (protectedOfferId != null && o.id === protectedOfferId));
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [rewardedOffers.length > 0, protectedOfferId]);

  useEffect(() => {
    const open = offlineEarningsUi?.open === true;
    offlineEarningsOpenRef.current = open;
    if (open && !prevOfflineEarningsOpenRef.current) {
      offlineEarningsAutoCollectedRef.current = false;
    }
    if (prevOfflineEarningsOpenRef.current && !open) {
      lastOfflineEarningsClosedAtRef.current = Date.now();
    }
    prevOfflineEarningsOpenRef.current = open;
  }, [offlineEarningsUi?.open]);

  /** Dismiss limited offer if offline earnings takes priority (no double popup). */
  useEffect(() => {
    if (!offlineEarningsUi?.open) return;
    setLimitedOfferPopup((prev) => {
      if (!prev?.isVisible) return prev;
      const now = Date.now();
      lastLimitedOfferClosedAtRef.current = now;
      lastLimitedOfferShownAtRef.current = now;
      return null;
    });
  }, [offlineEarningsUi?.open]);

  const canOpenLimitedOfferRewardPopup = useCallback(() => {
    if (offlineEarningsUi?.open) return false;
    const t = lastOfflineEarningsClosedAtRef.current;
    if (t > 0 && Date.now() - t < 10000) return false;
    return true;
  }, [offlineEarningsUi?.open]);

  // Auto-trigger limited offer popup: Rule 1 max 1 per 90s, Rule 2 never same twice in a row, Rule 3 after 90s pick best trigger else at 120s random, Rule 4 level >= 2 only
  useEffect(() => {
    if (playerLevel < 2 || LIMITED_OFFERS.length === 0) return;
    if (!limitedOfferCooldownInitializedRef.current) {
      limitedOfferCooldownInitializedRef.current = true;
      lastLimitedOfferShownAtRef.current = Date.now();
    }
    const interval = setInterval(() => {
      if (limitedOfferPopup?.isVisible) return;
      if (showFakeAdRef.current) return; // never show limited offer while fake ad is on screen
      // Only auto-show rewarded / limited offers on the garden screen (not Store or Barn)
      if (activeScreen !== 'FARM') return;
      // Don't show limited offer while another popup is on screen
      if (offlineEarningsUi?.open) return;
      if (lastOfflineEarningsClosedAtRef.current > 0 && Date.now() - lastOfflineEarningsClosedAtRef.current < 10000) return;
      if (levelUpPopup?.isVisible) return;
      if (discoveryPopup?.isVisible) return;
      if (purchaseSuccessfulUi) return;
      if (plantInfoPopup?.isVisible) return;
      const now = Date.now();
      // Don't show another popup for 10s after user just closed one
      if (lastLimitedOfferClosedAtRef.current && (now - lastLimitedOfferClosedAtRef.current) < 10000) return;
      if (lastFakeAdClosedAtRef.current && (now - lastFakeAdClosedAtRef.current) < 10000) return;
      // Wait 7.5s after user closed level up / discovery / plant info before showing limited offer
      if (lastOtherPopupClosedAtRef.current && (now - lastOtherPopupClosedAtRef.current) < 7500) return;
      const elapsed = now - lastLimitedOfferShownAtRef.current;
      if (elapsed < 90000) return; // Rule 1: 90s cooldown
      const unlockedCount = grid.filter(c => !c.locked).length;
      const filledCount = grid.filter(c => !c.locked && c.item != null).length;
      const gardenFillPercent = unlockedCount > 0 ? filledCount / unlockedCount : 0;
      const lastId = lastShownOfferIdRef.current;
      const lastTab = lastShownOfferTabRef.current;
      // Eligible: trigger matches and not same as last
      const hasGoalAvailable = goalSlots.some(s => s === 'green' || s === 'loading');
      const eligible = LIMITED_OFFERS.filter(o => {
        if (isStorePremiumOnlyOfferId(o.id)) return false;
        if (isCoinMultiplierBoostId(o.id)) return false;
        if (o.id === lastId) return false;
        if (o.trigger === 'garden_fill_max_50') return gardenFillPercent <= 0.5;
        if (o.trigger === 'wallet_empty') return money === 0;
        if (o.trigger === 'anytime') return true;
        if (o.trigger === 'order_speed_not_maxed') return !isCustomerSpeedMaxed(harvestState);
        if (o.trigger === 'has_goal_available') return hasGoalAvailable;
        return false;
      });
      // Prefer a different category (tab) from the previous offer for variety
      const pickFrom = (list: typeof LIMITED_OFFERS) => {
        if (list.length === 0) return null;
        const differentTab = list.filter(o => o.upgradeTab !== lastTab);
        const pool = differentTab.length > 0 ? differentTab : list;
        return pool[Math.floor(Math.random() * pool.length)];
      };
      let offerToShow: typeof LIMITED_OFFERS[0] | null = null;
      if (eligible.length > 0) {
        offerToShow = pickFrom(eligible);
      } else if (elapsed >= 120000) {
        const other = LIMITED_OFFERS.filter(o => {
          if (isStorePremiumOnlyOfferId(o.id)) return false;
          if (isCoinMultiplierBoostId(o.id)) return false;
          if (o.id === lastId) return false;
          if (o.trigger === 'garden_fill_max_50') return gardenFillPercent <= 0.5;
          if (o.trigger === 'wallet_empty') return money === 0;
          if (o.trigger === 'anytime') return true;
          if (o.trigger === 'order_speed_not_maxed') return !isCustomerSpeedMaxed(harvestState);
          if (o.trigger === 'has_goal_available') return hasGoalAvailable;
          return false;
        });
        offerToShow = pickFrom(other);
      }
      if (offerToShow) {
        const state = buildLimitedOfferPopupState(offerToShow.id, { highestPlantEver });
        if (state) {
          setLimitedOfferPopup(state);
          lastShownOfferIdRef.current = offerToShow.id;
          lastShownOfferTabRef.current = offerToShow.upgradeTab;
          // 90s cooldown starts when user closes popup (timer starts), not when we show it
        }
      }
    }, 2000);
    return () => clearInterval(interval);
  }, [playerLevel, grid, money, limitedOfferPopup?.isVisible, goalSlots, harvestState, highestPlantEver, levelUpPopup?.isVisible, discoveryPopup?.isVisible, purchaseSuccessfulUi, plantInfoPopup?.isVisible, offlineEarningsUi?.open, activeScreen]);

  // Derive which tabs have offers (for tab notification coloring)
  const tabsWithOffers = new Set(rewardedOffers.map(o => o.tab));
  
  // Calculate scale to fit 9:16 app into viewport
  // Base dimensions match the original max-w-md (448px) with 9:16 aspect
  const baseWidth = 448;
  const baseHeight = 796; // 448 * 16/9
  const mobileBreakpoint = 500;
  const safeTop = viewportWidth < mobileBreakpoint ? Math.max(viewportOffsetTop, 50) : 0;
  const availableHeight = viewportHeight - safeTop;
  const scaleX = viewportWidth / baseWidth;
  const scaleY = availableHeight / baseHeight;
  const fitScale = Math.min(scaleX, scaleY);
  // Same as splash: scale to fit viewport (height or width). Wide browser = fill height, pillarbox on sides.
  const appScale = fitScale;
  const appScaleRef = useRef(appScale);
  appScaleRef.current = appScale;
  
  // Calculate barn scale: only apply on narrow mobile screens (below 500px)
  // On wider screens, use scale 1 (no scaling)
  const barnDesignWidth = 470;
  const barnPadding = 20;
  const barnScale = viewportWidth >= mobileBreakpoint 
    ? 1 
    : Math.min(1, (viewportWidth - barnPadding) / barnDesignWidth);

  const masterySeg = PLANT_MASTERY_ORDERS_PER_SEGMENT;
  const masteryBarNumerator =
    plantMastery.targetLevel === 24 && plantMastery.ordersProgress >= masterySeg
      ? masterySeg
      : plantMastery.ordersProgress;
  const masteryBarFillPct = (masteryBarNumerator / masterySeg) * 100;
  const unreadMasteryUnlockLevels = plantMastery.unlockPending.filter(
    (level) => !seenMasteryUnlockLevels.includes(level)
  );

  const updateSpriteCenter = useCallback(() => {
    const col = farmColumnRef.current;
    const area = hexAreaRef.current;
    if (!col || !area) return;
    const colRect = col.getBoundingClientRect();
    const areaRect = area.getBoundingClientRect();
    const centerX = (areaRect.left + areaRect.width / 2 - colRect.left) / colRect.width * 100;
    const centerY = (areaRect.top + areaRect.height / 2 - colRect.top) / colRect.height * 100;
    setSpriteCenter({ x: centerX, y: centerY });
  }, []);

  useEffect(() => {
    updateSpriteCenter();
    const col = farmColumnRef.current;
    const area = hexAreaRef.current;
    if (!col || !area) return;
    const ro = new ResizeObserver(updateSpriteCenter);
    ro.observe(col);
    ro.observe(area);
    return () => ro.disconnect();
  }, [updateSpriteCenter]);

  // When panel opens/closes, drive sprite position every frame (1400ms for open, 700ms for close)
  useEffect(() => {
    let rafId: number;
    let endAt = 0;
    const tick = () => {
      if (Date.now() < endAt) {
        updateSpriteCenter();
        rafId = requestAnimationFrame(tick);
      }
    };
    endAt = Date.now() + (isExpanded ? 1400 : 350);
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [isExpanded, updateSpriteCenter]);

  // Barn scroll: drag with momentum, moves background + shelves together
  const [barnScrollY, setBarnScrollY] = useState(0);
  
  useEffect(() => {
    const el = barnScrollRef.current;
    if (!el) return;
    
    let isDown = false;
    let startY = 0;
    let startScrollY = 0;
    let velocityY = 0;
    let lastY = 0;
    let lastTime = 0;
    let rafId: number;
    
    const getMaxScroll = () => {
      const shelves = el.querySelector('[data-barn-shelves]') as HTMLElement;
      if (!shelves) return 0;
      // Account for barn scale - content is scaled so actual visual height is smaller
      const shelvesBottom = (shelves.offsetTop + shelves.offsetHeight) * barnScale;
      const viewportHeight = el.clientHeight;
      // Keep less trailing space below the last shelf; then add back 25px bottom spacing.
      return Math.max(0, shelvesBottom - viewportHeight - 55);
    };
    
    const updateScroll = (newValue: number) => {
      barnScrollYRef.current = newValue;
      setBarnScrollY(newValue);
    };
    
    const momentumLoop = () => {
      if (!isDown && Math.abs(velocityY) > 0.1) {
        const maxScroll = getMaxScroll();
        const newScroll = Math.max(0, Math.min(barnScrollYRef.current - velocityY, maxScroll));
        updateScroll(newScroll);
        velocityY *= 0.94;
        rafId = requestAnimationFrame(momentumLoop);
      }
    };
    
    const handleMouseDown = (e: MouseEvent) => {
      isDown = true;
      velocityY = 0;
      cancelAnimationFrame(rafId);
      startY = e.pageY;
      startScrollY = barnScrollYRef.current;
      lastY = e.pageY;
      lastTime = Date.now();
      window.addEventListener('mousemove', handleMouseMoveGlobal);
      window.addEventListener('mouseup', handleMouseUpGlobal);
    };
    
    const handleMouseMoveGlobal = (e: MouseEvent) => {
      if (!isDown) return;
      const dy = e.pageY - startY;
      const now = Date.now();
      if (now - lastTime > 0) velocityY = velocityY * 0.2 + (e.pageY - lastY) * 0.8;
      const maxScroll = getMaxScroll();
      const newScroll = Math.max(0, Math.min(startScrollY - dy, maxScroll));
      updateScroll(newScroll);
      lastY = e.pageY;
      lastTime = now;
    };
    
    const handleMouseUpGlobal = () => {
      if (!isDown) return;
      isDown = false;
      window.removeEventListener('mousemove', handleMouseMoveGlobal);
      window.removeEventListener('mouseup', handleMouseUpGlobal);
      if (Math.abs(velocityY) > 1) {
        rafId = requestAnimationFrame(momentumLoop);
      }
    };
    
    // Touch support
    const handleTouchStart = (e: TouchEvent) => {
      isDown = true;
      velocityY = 0;
      cancelAnimationFrame(rafId);
      startY = e.touches[0].pageY;
      startScrollY = barnScrollYRef.current;
      lastY = e.touches[0].pageY;
      lastTime = Date.now();
    };
    
    const handleTouchMove = (e: TouchEvent) => {
      if (!isDown) return;
      const dy = e.touches[0].pageY - startY;
      const now = Date.now();
      if (now - lastTime > 0) velocityY = velocityY * 0.2 + (e.touches[0].pageY - lastY) * 0.8;
      const maxScroll = getMaxScroll();
      const newScroll = Math.max(0, Math.min(startScrollY - dy, maxScroll));
      updateScroll(newScroll);
      lastY = e.touches[0].pageY;
      lastTime = now;
    };
    
    const handleTouchEnd = () => {
      if (!isDown) return;
      isDown = false;
      if (Math.abs(velocityY) > 1) {
        rafId = requestAnimationFrame(momentumLoop);
      }
    };
    
    el.addEventListener('mousedown', handleMouseDown);
    el.addEventListener('touchstart', handleTouchStart, { passive: true });
    el.addEventListener('touchmove', handleTouchMove, { passive: true });
    el.addEventListener('touchend', handleTouchEnd);
    
    return () => {
      el.removeEventListener('mousedown', handleMouseDown);
      el.removeEventListener('touchstart', handleTouchStart);
      el.removeEventListener('touchmove', handleTouchMove);
      el.removeEventListener('touchend', handleTouchEnd);
      window.removeEventListener('mousemove', handleMouseMoveGlobal);
      window.removeEventListener('mouseup', handleMouseUpGlobal);
      cancelAnimationFrame(rafId);
    };
  }, [barnScale]);

  useEffect(() => {
    if (activeScreen === 'BARN') {
      setBarnNotification(false);
      return;
    }
    setBarnNotification(unreadMasteryUnlockLevels.length > 0);
  }, [activeScreen, unreadMasteryUnlockLevels.length]);

  useEffect(() => {
    if (activeScreen !== 'BARN') return;
    if (plantMastery.unlockPending.length === 0) return;
    if (skipNextBarnPendingBounceRef.current) {
      skipNextBarnPendingBounceRef.current = false;
      return;
    }

    if (barnEnterFocusTimeoutRef.current) window.clearTimeout(barnEnterFocusTimeoutRef.current);
    barnEnterFocusTimeoutRef.current = window.setTimeout(() => {
      const targetLevel = plantMastery.unlockPending[0];
      const el = barnScrollRef.current;
      if (!el) return;
      setSeenMasteryUnlockLevels((prev) => (prev.includes(targetLevel) ? prev : [...prev, targetLevel]));

      // Staggered scale bounce only (no beam/sparkle VFX).
      setBarnAttentionBounceLevels([]);
      plantMastery.unlockPending.forEach((level, idx) => {
        const delayMs = idx * 180;
        window.setTimeout(() => {
          if (activeScreen !== 'BARN') return;
          setBarnAttentionBounceLevels((prev) => (prev.includes(level) ? prev : [...prev, level]));
        }, delayMs);
      });
      if (barnAttentionBounceTimeoutRef.current) window.clearTimeout(barnAttentionBounceTimeoutRef.current);
      const bounceAnimMs = 500;
      barnAttentionBounceTimeoutRef.current = window.setTimeout(() => {
        setBarnAttentionBounceLevels([]);
        barnAttentionBounceTimeoutRef.current = null;
      }, Math.max(bounceAnimMs + 50, (plantMastery.unlockPending.length - 1) * 180 + bounceAnimMs + 50));
      barnEnterFocusTimeoutRef.current = null;
    }, 150);
  }, [activeScreen, barnScale, plantMastery.unlockPending]);

  useEffect(() => {
    return () => {
      if (barnAttentionBounceTimeoutRef.current) {
        window.clearTimeout(barnAttentionBounceTimeoutRef.current);
      }
      if (barnEnterFocusTimeoutRef.current) {
        window.clearTimeout(barnEnterFocusTimeoutRef.current);
      }
      if (masteryPurchaseRevealTimeoutRef.current) {
        window.clearTimeout(masteryPurchaseRevealTimeoutRef.current);
      }
    };
  }, []);

  // Get cells that have projectiles in flight (reserved)
  const reservedCellsSet = new Set(activeProjectiles.map(p => p.targetIdx));
  
  // Grid is "full" when all unlocked cells have items OR have incoming projectiles
  const isGridFull = grid.every((cell, idx) => cell.locked || cell.item !== null || reservedCellsSet.has(idx));

  // Out-of-space condition: every unlocked cell is filled AND every plant level is unique.
  const isOutOfSpaceUniqueFill = (() => {
    const unlocked = grid.filter((c) => !c.locked);
    if (unlocked.length === 0) return false;
    const seen = new Set<number>();
    for (const c of unlocked) {
      const lvl = c.item?.level;
      if (lvl == null) return false;
      if (seen.has(lvl)) return false;
      seen.add(lvl);
    }
    return true;
  })();

  useEffect(() => {
    // If the FTUE overlay system isn't mounted yet, don't attempt to show.
    if (!coinPanelPortalRect) return;
    if (!isOutOfSpaceUniqueFill) {
      outOfSpaceArmedRef.current = true;
      setOutOfSpaceFtueVisible(false);
      return;
    }
    if (outOfSpaceArmedRef.current) {
      outOfSpaceArmedRef.current = false;
      setOutOfSpaceFtueVisible(true);
    }
  }, [isOutOfSpaceUniqueFill, coinPanelPortalRect]);

  const spawnProjectile = useCallback((targetIdx: number, plantLevel: number, isSpecialDelivery?: boolean, isLuckyGrowth?: boolean) => {
    if (plantButtonRef.current && containerRef.current) {
      const scale = appScaleRef.current;
      const btnRect = plantButtonRef.current.getBoundingClientRect();
      const containerRect = containerRef.current.getBoundingClientRect();
      const startX = ((btnRect.left + btnRect.width / 2) - containerRect.left) / scale;
      const startY = ((btnRect.top + btnRect.height / 2) - containerRect.top) / scale;
      
      const newProj: ProjectileData = {
        id: Math.random().toString(36).substr(2, 9),
        startX,
        startY,
        targetIdx,
        plantLevel,
        ...(isSpecialDelivery ? { isSpecialDelivery: true } : {}),
        ...(isLuckyGrowth ? { isLuckyGrowth: true } : {}),
      };
      setActiveProjectiles(prev => [...prev, newProj]);
    }
  }, []);

  const wildGrowthUpgradeLevel = cropsState.wild_growth?.level ?? 0;
  useEffect(() => {
    if (playerLevel < WILD_GROWTH_UNLOCK_PLAYER_LEVEL) {
      wildGrowthAccumMsRef.current = 0;
    }
  }, [playerLevel]);

  // Wild Growth: auto-duplicate at interval once player level ≥ unlock (no seed flight); spawn + beam via ref.
  useEffect(() => {
    if (isLoading) return;
    if (playerLevel < WILD_GROWTH_UNLOCK_PLAYER_LEVEL) return;
    const intervalMs = getWildGrowthIntervalMsForLevel(wildGrowthUpgradeLevel);
    if (intervalMs <= 0) return;

    let last = performance.now();
    let rafId = 0;

    const tick = (now: number) => {
      rafId = requestAnimationFrame(tick);
      const dt = Math.min(now - last, 4000);
      last = now;
      if (dt <= 0) return;

      const g = gridRef.current;
      const hasPlant = g.some((c) => !c.locked && c.item != null);
      if (!hasPlant) return;

      let acc = wildGrowthAccumMsRef.current;
      if (acc < intervalMs) {
        acc = Math.min(intervalMs, acc + dt);
        wildGrowthAccumMsRef.current = acc;
        return;
      }

      const reserved = new Set(activeProjectilesRef.current.map((p) => p.targetIdx));
      const pick = pickWildGrowthSpawn(g, reserved);
      if (!pick) {
        wildGrowthAccumMsRef.current = intervalMs;
        return;
      }

      wildGrowthAccumMsRef.current = 0;
      applyWildGrowthSpawnAtCellRef.current(pick.targetIdx, pick.plantLevel);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [isLoading, playerLevel, wildGrowthUpgradeLevel]);

  // Tap decay: progress per tap goes from 40% down to 10% the more taps in the last 5 seconds. Resets after 5s idle.
  const TAP_DECAY_WINDOW_MS = 5000;
  const seedTapTimestampsRef = useRef<number[]>([]);
  const harvestTapTimestampsRef = useRef<number[]>([]);
  const getTapProgressPercent = (timestampsRef: React.MutableRefObject<number[]>) => {
    const now = Date.now();
    const cutoff = now - TAP_DECAY_WINDOW_MS;
    timestampsRef.current = timestampsRef.current.filter(t => t >= cutoff);
    const count = timestampsRef.current.length;
    const percent = Math.max(10, 35 - count * 5);
    timestampsRef.current.push(now);
    return percent;
  };

  // Seed Production upgrade: auto-increase progress. Visual: 10%..100% (+10% per level). Rate: 3/min..10/min (linear).
  const seedProductionLevel = seedsState?.seed_production?.level ?? 0;
  const lastSeedProgressTimeRef = useRef<number>(0);
  const seedProgressRef = useRef<number>(0);
  const seedRaf60LastTickRef = useRef<number>(0);
  const tapZoomRef = useRef<{ start: number; end: number; startTime: number; duration: number } | null>(null);
  const [tapZoomTrigger, setTapZoomTrigger] = useState(0);

  /** Tap on empty seed/harvest button (no charges): +5% bar per tap */
  const TAP_BAR_PERCENT = 5;
  /** Merge same-level plants: +20% on both seed and harvest bars */
  const MERGE_BAR_PERCENT = 20;
  // Tap zoom: animate tap % per seed tap over a very short duration (fast smooth zoom)
  useEffect(() => {
    const zoom = tapZoomRef.current;
    if (!zoom) return;
    let rafId: number;
    const durationMs = 100;
    const easeOutCubic = (t: number) => 1 - (1 - t) ** 3;
    const tick = () => {
      const zoom = tapZoomRef.current;
      if (!zoom) return;
      const elapsed = Date.now() - zoom.startTime;
      const t = Math.min(1, elapsed / durationMs);
      const alpha = easeOutCubic(t);
      const value = zoom.start + (zoom.end - zoom.start) * alpha;
      seedProgressRef.current = value;
      if (t >= 1) {
        seedProgressRef.current = zoom.end;
        tapZoomRef.current = null;
        if (zoom.end >= 100) {
          setSeedProgress(100);
          setIsSeedFlashing(true);
        }
        return;
      }
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [tapZoomTrigger]);

  // Only update React state when we hit 100% or reset; progress bar is driven at 60fps via progressRef in SideAction
  useEffect(() => {
    // Don't start progress until loading is complete
    if (isLoading) return;
    
    // Rapid Seeds boost: 15/min; otherwise 3/min..10/min linear across 9 upgrades (level 0..9)
    const hasRapidSeedsBoost = activeBoosts.some(b => b.offerId === 'rapid_seeds');
    const perMinute = hasRapidSeedsBoost ? 15 : (3 + (7 * Math.min(9, Math.max(0, seedProductionLevel))) / 9);
    lastSeedProgressTimeRef.current = Date.now();
    let rafId: number;
    const percentPerMs = (perMinute * 100) / (60 * 1000); // % progress per millisecond
    const tick = () => {
      if (tapZoomRef.current) {
        lastSeedProgressTimeRef.current = Date.now();
        rafId = requestAnimationFrame(tick);
        return;
      }
    // FTUE: seeds in free mode – don't advance progress.
    // Allow normal recharge during FTUE 9.5 (recharge_pre_upgrade), FTUE 10 (first_upgrade), and beyond.
    if (
      activeFtueStage != null &&
      activeFtueStage !== 'recharge_pre_upgrade' &&
      activeFtueStage !== 'first_upgrade' &&
      activeFtueStage !== 'recharge_intro'
    ) {
        rafId = requestAnimationFrame(tick);
        return;
      }
      const n = getTickCount60(seedRaf60LastTickRef);
      if (n === 0) {
        rafId = requestAnimationFrame(tick);
        return;
      }
      lastSeedProgressTimeRef.current = Date.now();
      const deltaMs = Math.min(n * TARGET_FRAME_MS, 50); // cap for tab backgrounding
      const added = deltaMs * percentPerMs;
      const next = Math.min(100, seedProgressRef.current + added);
      seedProgressRef.current = next;
      if (next >= 100) {
        setSeedProgress(100);
        setIsSeedFlashing(true);
        setSeedBounceTrigger((t) => t + 1); // increment so bounce re-runs every revolution
      }
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [seedProductionLevel, isLoading, activeBoosts, activeFtueStage]);

  // Goal loading countdown: Order Speed (15s base - 1s per level, min 5). Rush Orders boost = 0s. Don't start until slot is 100% faded in.
  const goalIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    if (isLoading) return;
    const loadingIdx = goalSlots.findIndex((s) => s === 'loading');
    if (loadingIdx < 0) return;
    // Don't run countdown while slot is fading in (0→100% over 500ms)
    if (loadingIdx === goalSlotFadeInSlot) return;
    const hasRushOrdersBoost = activeBoosts.some(b => b.offerId === 'rush_orders');
    const effectiveGoalLoadingSeconds = hasRushOrdersBoost ? 0 : getGoalLoadingSeconds(harvestState);
    // Only process each loading slot once (avoids double-counting in React Strict Mode / duplicate effect runs)
    if (lastProcessedGoalLoadingSlotRef.current === loadingIdx) {
      if (goalIntervalRef.current) clearInterval(goalIntervalRef.current);
      if (effectiveGoalLoadingSeconds <= 0) return () => {}; // duplicate instant run: skip entirely
      // else fall through so we re-set the interval (cleanup may have cleared it)
    } else {
      lastProcessedGoalLoadingSlotRef.current = loadingIdx;
    }
    if (goalIntervalRef.current) clearInterval(goalIntervalRef.current);
    if (effectiveGoalLoadingSeconds <= 0) {
      // Instant: complete immediately
      const spawnId = nextGoalSpawnIdRef.current++;
      setGoalBounceSlots((prev) => prev.includes(loadingIdx) ? prev : [...prev, loadingIdx]);
      setGoalTransitionSlot(loadingIdx);
      setGoalTransitionFade(false);
      const minLevel = getPremiumOrdersMinLevel(harvestState);
      const seedLevel = getSeedLevelFromHighestPlant(highestPlantEverRef.current);
      const slots = goalSlotsRef.current;
      const types = goalPlantTypesRef.current;
      const highest = highestPlantEverRef.current;
      const hasDiscoveryOnBoard = slots.some((s, i) => i !== loadingIdx && s === 'green' && (types[i] ?? 0) === highest + 1);
      const plantLevel = pickGoalPlantLevel(highest, minLevel, seedLevel, newGoalsSinceDiscoveryRef, lastMergeDiscoveryLevelRef, lastSpawnedGoalLevelsRef, hasDiscoveryOnBoard);
      lastSpawnedGoalLevelsRef.current = [lastSpawnedGoalLevelsRef.current[1], plantLevel];
      setGoalPlantTypes((p) => { const n = [...p]; n[loadingIdx] = plantLevel; return n; });
      const cropYieldLevel = cropsState?.crop_value?.level ?? 0;
      const goalRequired = getGoalCropRequired(playerLevel, cropYieldLevel);
      setGoalCounts((c) => { const next = [...c]; next[loadingIdx] = goalRequired; return next; });
      setGoalAmountsRequired((a) => { const next = [...a]; next[loadingIdx] = goalRequired; return next; });
      requestAnimationFrame(() => requestAnimationFrame(() => setGoalTransitionFade(true)));
      setTimeout(() => {
        lastProcessedGoalLoadingSlotRef.current = null; // allow next loading slot to be processed
        const alreadyCommitted = lastCommittedSpawnIdRef.current === spawnId;
        if (!alreadyCommitted && plantLevel <= highest) newGoalsSinceDiscoveryRef.current++; // exactly once per spawn (spawnId dedupes duplicate timeout runs; slot index would under-count when slot reused)
        lastCommittedSpawnIdRef.current = spawnId;
        const maxSlots = getMaxGoalSlots(playerLevel);
        const firstEmptyIdx = goalSlots.findIndex((s, i) => s === 'empty' && i < maxSlots);
        setGoalBounceSlots((prev) => prev.filter((s) => s !== loadingIdx));
        setGoalSlots((slots) => {
          const next = [...slots];
          next[loadingIdx] = 'green';
          if (firstEmptyIdx >= 0) next[firstEmptyIdx] = 'loading';
          return next;
        });
        if (firstEmptyIdx >= 0) {
          setGoalDisplayOrder((prev) => (prev.includes(firstEmptyIdx) ? prev : [...prev, firstEmptyIdx]));
          setGoalSlotFadeInSlot(firstEmptyIdx);
          setGoalLoadingSeconds(hasRushOrdersBoost ? 0 : getGoalLoadingSeconds(harvestState));
          setTimeout(() => setGoalSlotFadeInSlot(null), 500);
        }
        setGoalTransitionSlot(null);
        setGoalTransitionFade(false);
      }, 500);
      return () => {};
    }
    goalIntervalRef.current = setInterval(() => {
      setGoalLoadingSeconds((prev) => {
        if (prev <= 1) {
          if (goalIntervalRef.current) {
            clearInterval(goalIntervalRef.current);
            goalIntervalRef.current = null;
          }
          const spawnId = nextGoalSpawnIdRef.current++;
          setGoalBounceSlots((prev) => prev.includes(loadingIdx) ? prev : [...prev, loadingIdx]);
          setGoalTransitionSlot(loadingIdx);
          setGoalTransitionFade(false);
          const minLevel = getPremiumOrdersMinLevel(harvestState);
          const seedLevel = getSeedLevelFromHighestPlant(highestPlantEverRef.current);
          const slots = goalSlotsRef.current;
          const types = goalPlantTypesRef.current;
          const highest = highestPlantEverRef.current;
          const hasDiscoveryOnBoard = slots.some((s, i) => i !== loadingIdx && s === 'green' && (types[i] ?? 0) === highest + 1);
          const plantLevel = pickGoalPlantLevel(highest, minLevel, seedLevel, newGoalsSinceDiscoveryRef, lastMergeDiscoveryLevelRef, lastSpawnedGoalLevelsRef, hasDiscoveryOnBoard);
          lastSpawnedGoalLevelsRef.current = [lastSpawnedGoalLevelsRef.current[1], plantLevel];
          setGoalPlantTypes((p) => { const n = [...p]; n[loadingIdx] = plantLevel; return n; });
          const cropYieldLevel = cropsState?.crop_value?.level ?? 0;
          const goalRequired = getGoalCropRequired(playerLevel, cropYieldLevel);
          setGoalCounts((c) => {
            const next = [...c];
            next[loadingIdx] = goalRequired;
            return next;
          });
          setGoalAmountsRequired((a) => { const next = [...a]; next[loadingIdx] = goalRequired; return next; });
          requestAnimationFrame(() => requestAnimationFrame(() => setGoalTransitionFade(true)));
          setTimeout(() => {
            lastProcessedGoalLoadingSlotRef.current = null; // allow next loading slot to be processed
            const alreadyCommitted = lastCommittedSpawnIdRef.current === spawnId;
            if (!alreadyCommitted && plantLevel <= highest) newGoalsSinceDiscoveryRef.current++; // exactly once per spawn (spawnId dedupes duplicate timeout runs)
            lastCommittedSpawnIdRef.current = spawnId;
            const maxSlots = getMaxGoalSlots(playerLevel);
            const firstEmptyIdx = goalSlots.findIndex((s, i) => s === 'empty' && i < maxSlots);
            setGoalBounceSlots((prev) => prev.filter((s) => s !== loadingIdx));
            setGoalSlots((slots) => {
              const next = [...slots];
              next[loadingIdx] = 'green';
              if (firstEmptyIdx >= 0) next[firstEmptyIdx] = 'loading';
              return next;
            });
            if (firstEmptyIdx >= 0) {
              setGoalDisplayOrder((prev) => (prev.includes(firstEmptyIdx) ? prev : [...prev, firstEmptyIdx]));
              setGoalSlotFadeInSlot(firstEmptyIdx);
              setGoalLoadingSeconds(hasRushOrdersBoost ? 0 : getGoalLoadingSeconds(harvestState));
              setTimeout(() => setGoalSlotFadeInSlot(null), 500);
            }
            setGoalTransitionSlot(null);
            setGoalTransitionFade(false);
          }, 500);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => {
      if (goalIntervalRef.current) {
        clearInterval(goalIntervalRef.current);
        goalIntervalRef.current = null;
      }
    };
  }, [isLoading, goalSlots, goalSlotFadeInSlot, harvestState, playerLevel, cropsState, activeBoosts]);

  // When player levels up and unlocks a new goal slot, start loading in that slot if empty and no other loading
  useEffect(() => {
    if (isLoading) return;
    const maxSlots = getMaxGoalSlots(playerLevel);
    const hasLoading = goalSlots.some((s) => s === 'loading');
    if (hasLoading) return;
    for (let i = 3; i < maxSlots; i++) {
      if (goalSlots[i] === 'empty') {
        setGoalSlots((s) => { const n = [...s]; n[i] = 'loading'; return n; });
        setGoalDisplayOrder((prev) => (prev.includes(i) ? prev : [...prev, i]));
        setGoalSlotFadeInSlot(i);
        setGoalLoadingSeconds(getGoalLoadingSeconds(harvestState));
        setTimeout(() => setGoalSlotFadeInSlot(null), 500);
        break;
      }
    }
  }, [playerLevel, isLoading, goalSlots, harvestState]);

  // Coin goal: show after 30–60s (random) since last hide; only from level 2; repeats forever
  useEffect(() => {
    if (playerLevel < 2 || coinGoalVisible) return;
    const interval = setInterval(() => {
      const now = Date.now();
      if (now - lastCoinGoalHiddenAtRef.current >= nextCoinGoalDelayRef.current) {
        const cropYieldLevel = cropsState?.crop_value?.level ?? 0;
        const amountRequired = getGoalCropRequired(playerLevel, cropYieldLevel);
        const plantValue = getCoinValueForLevel(highestPlantEver);
        const marketMultiplier = getMarketValueMultiplier(harvestState);
        const rawValue = plantValue * amountRequired * marketMultiplier * 1.0;
        const roundedValue = Math.round(rawValue / 5) * 5;
        setCoinGoalValue(roundedValue);
        setCoinGoalTimeRemaining(30);
        setCoinGoalVisible(true);
        setCoinGoalBounce(true);
        setTimeout(() => setCoinGoalBounce(false), 400);
      }
    }, 2000);
    return () => clearInterval(interval);
  }, [coinGoalVisible, playerLevel, highestPlantEver, cropsState, harvestState]);
  // Hide coin goal if player drops below level 2
  useEffect(() => {
    if (playerLevel < 2 && coinGoalVisible) {
      setCoinGoalVisible(false);
      lastCoinGoalHiddenAtRef.current = Date.now();
      nextCoinGoalDelayRef.current = 30000 + Math.random() * 30000;
    }
  }, [playerLevel, coinGoalVisible]);

  // Coin goal: 30s countdown; at 0 hide and schedule next spawn (30–60s random). Pause while fake ad is visible.
  useEffect(() => {
    if (!coinGoalVisible) return;
    const interval = setInterval(() => {
      if (showFakeAdRef.current) return;
      setCoinGoalTimeRemaining((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, [coinGoalVisible]);
  useEffect(() => {
    if (!coinGoalVisible || coinGoalTimeRemaining > 0) return;
    lastCoinGoalHiddenAtRef.current = Date.now();
    nextCoinGoalDelayRef.current = 30000 + Math.random() * 30000;
    setCoinGoalVisible(false);
    setCoinGoalTimeRemaining(30);
  }, [coinGoalVisible, coinGoalTimeRemaining]);

  // When seed level increases: auto-level plants below seed level (with beam VFX) and bump any lower-level goals up to the new seed level.
  useEffect(() => {
    const newSeedLevel = getSeedLevelFromHighestPlant(highestPlantEver);
    if (newSeedLevel <= prevSeedLevelRef.current) return;
    prevSeedLevelRef.current = newSeedLevel;

    // 1. Auto-level plants on board that are below seed level
    setGrid((prevGrid) => {
      const cellsToUpgrade: number[] = [];
      prevGrid.forEach((cell, idx) => {
        if (cell.item && cell.item.level < newSeedLevel) cellsToUpgrade.push(idx);
      });
      if (cellsToUpgrade.length === 0) return prevGrid;
      // Spawn beams for each cell (after DOM update)
      requestAnimationFrame(() => {
        const beams: { id: string; x: number; y: number; cellWidth: number; cellHeight: number; startTime: number }[] = [];
        cellsToUpgrade.forEach((cellIdx) => {
          const hexEl = document.getElementById(`hex-${cellIdx}`);
          if (hexEl) {
            const rect = hexEl.getBoundingClientRect();
            beams.push({
              id: `seed-level-up-${cellIdx}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
              x: rect.left + rect.width / 2,
              y: rect.top + rect.height / 2,
              cellWidth: rect.width,
              cellHeight: rect.height,
              startTime: Date.now(),
            });
          }
        });
        if (beams.length > 0) setCellHighlightBeams((b) => [...b, ...beams]);
      });
      const newGrid = prevGrid.map((cell, idx) => {
        if (cell.item && cell.item.level < newSeedLevel) {
          return { ...cell, item: { ...cell.item, level: newSeedLevel } };
        }
        return cell;
      });
      return newGrid;
    });

    // 2. Upgrade any lower-level goals to the new seed level so they never become impossible.
    const slotsToUpgrade: number[] = [];
    goalSlots.forEach((s, i) => {
      if (s === 'green' && (goalPlantTypes[i] ?? 0) < newSeedLevel) slotsToUpgrade.push(i);
    });
    if (slotsToUpgrade.length > 0) {
      // Swap the goal icon/type but keep the required amount + remaining count the same.
      setGoalPlantTypes((prev) => {
        const next = [...prev];
        slotsToUpgrade.forEach((slotIdx) => { next[slotIdx] = newSeedLevel; });
        return next;
      });
      slotsToUpgrade.forEach((slotIdx) => {
        setGoalBounceSlots((prev) => prev.includes(slotIdx) ? prev : [...prev, slotIdx]);
        setTimeout(() => setGoalBounceSlots((b) => b.filter((i) => i !== slotIdx)), 400);
      });
    }
  }, [highestPlantEver, harvestState, playerLevel, goalSlots, goalPlantTypes, goalAmountsRequired, grid]);

  /**
   * At 100% seed progress: +1 seed; cap at storage max. Excess → surplus coin or lost.
   */
  useEffect(() => {
    if (seedProgress !== 100 || !isSeedFlashing) return;
    seedProgressRef.current = 0;
    setSeedProgress(0);
    setTimeout(() => setIsSeedFlashing(false), 300);

    const doubleSeedsLevel = seedsState?.double_seeds?.level ?? 0;
    const doubleChance = Math.min(1, doubleSeedsLevel * 0.1);
    const seedsToAdd = Math.random() < doubleChance ? 2 : 1;
    const surplusValue = getSeedSurplusValue(
      ftueSeedSurplusActivated
        ? ({ ...seedsState, seed_surplus: { level: Math.max(1, seedsState?.seed_surplus?.level ?? 0), progress: 0 } } as any)
        : seedsState,
      highestPlantEver
    );
    const maxCap = getSeedStorageMax(seedsState);

    const total = seedsInStorage + seedsToAdd;
    const capped = Math.min(maxCap, total);
    const excess = total - capped;

    setSeedsInStorage(capped);

    if (excess > 0 && surplusValue > 0) {
      const container = containerRef.current;
      const plantBtn = plantButtonRef.current;
      const walletIcon = walletIconRef.current;
      const wallet = walletRef.current;
      const walletEl = walletIcon || wallet;
      if (container && plantBtn && walletEl) {
        const scale = appScaleRef.current;
        const containerRect = container.getBoundingClientRect();
        const btnRect = plantBtn.getBoundingClientRect();
        const startX = (btnRect.left + btnRect.width / 2 - containerRect.left) / scale;
        const startY = (btnRect.top + btnRect.height / 2 - containerRect.top) / scale;
        const hoverX = startX;
        const panelHeightPx = 14;
        const offsetUp = (panelHeightPx / 2 + 4) * 1.2;
        const hoverY = (btnRect.top - containerRect.top) / scale - offsetUp;
        const panelsToAdd = Array.from({ length: excess }, (_, i) => ({
          id: `seed-surplus-${Date.now()}-${i}-${Math.random().toString(36).slice(2)}`,
          value: applyDoubleCoinsVisualAmount(surplusValue, activeBoostsRef.current),
          startX,
          startY,
          hoverX,
          hoverY,
          moveToWalletDelayMs: 0,
          scale: 1.5,
        }));
        setActiveCoinPanels((p) => [...p, ...panelsToAdd]);
      }
    }
  }, [seedProgress, isSeedFlashing, seedsInStorage, seedsState, seedStorageMax, ftueSeedSurplusActivated, highestPlantEver]);

  // Harvest surplus coin panels: when harvest charges overflow at 100% capacity, turn the overflow into coins.
  const spawnHarvestSurplusCoinPanels = (overflowCycles: number) => {
    if (overflowCycles <= 0) return;
    // Harvest surplus uses the same multiplier as Seed Surplus (seed_surplus upgrade).
    const surplusValue = getSeedSurplusValue(
      ftueSeedSurplusActivated
        ? ({ ...seedsState, seed_surplus: { level: Math.max(1, seedsState?.seed_surplus?.level ?? 0), progress: 0 } } as any)
        : seedsState,
      highestPlantEverRef.current
    );
    if (surplusValue <= 0) return;

    const container = containerRef.current;
    const harvestBtn = harvestButtonRef.current;
    const walletIcon = walletIconRef.current;
    const wallet = walletRef.current;
    const walletEl = walletIcon || wallet;

    if (!container || !harvestBtn || !walletEl) return;

    const scale = appScaleRef.current;
    const containerRect = container.getBoundingClientRect();
    const btnRect = harvestBtn.getBoundingClientRect();
    const startX = (btnRect.left + btnRect.width / 2 - containerRect.left) / scale;
    const startY = (btnRect.top + btnRect.height / 2 - containerRect.top) / scale;
    const hoverX = startX;
    const panelHeightPx = 14;
    const offsetUp = (panelHeightPx / 2 + 4) * 1.2;
    const hoverY = (btnRect.top - containerRect.top) / scale - offsetUp;

    const panelsToAdd = Array.from({ length: overflowCycles }, (_, i) => ({
      id: `harvest-surplus-${Date.now()}-${i}-${Math.random().toString(36).slice(2)}`,
      value: applyDoubleCoinsVisualAmount(surplusValue, activeBoostsRef.current),
      startX,
      startY,
      hoverX,
      hoverY,
      moveToWalletDelayMs: 0,
      scale: 1.5,
    }));

    setActiveCoinPanels((p) => [...p, ...panelsToAdd]);
  };

  const harvestProgressRef = useRef<number>(0);
  const harvestTapZoomRef = useRef<{ start: number; end: number; startTime: number; duration: number } | null>(null);
  const [harvestTapZoomTrigger, setHarvestTapZoomTrigger] = useState(0);
  const harvestSpeedLevel = getHarvestSpeedLevel(cropsState);
  const lastHarvestProgressTimeRef = useRef<number>(0);
  const harvestRaf60LastTickRef = useRef<number>(0);

  // Harvest auto-progress (Harvest Speed + Rapid Harvest); at 100% +1 charge (waste if full), reset bar — like seeds production
  useEffect(() => {
    if (isLoading) return;
    const hasRapidHarvestBoost = activeBoosts.some(b => b.offerId === 'rapid_harvest');
    const perMinute = hasRapidHarvestBoost ? 15 : (3 + (7 * Math.min(9, Math.max(0, harvestSpeedLevel))) / 9);
    lastHarvestProgressTimeRef.current = Date.now();
    let rafId: number;
    const percentPerMs = (perMinute * 100) / (60 * 1000);
    const tick = () => {
      if (harvestTapZoomRef.current) {
        lastHarvestProgressTimeRef.current = Date.now();
        rafId = scheduleNextFrame(tick);
        return;
      }
      // FTUE 5–8 + gap before FTUE 7: harvest in free mode – don't advance progress
      if (activeFtueStage === 'first_harvest' || activeFtueStage === 'first_goal_collect' || activeFtueStage === 'first_more_orders' || activeFtueStage === 'first_harvest_multi' || ftue7Scheduled) {
        rafId = scheduleNextFrame(tick);
        return;
      }
      const n = getTickCount60(harvestRaf60LastTickRef);
      if (n === 0) {
        rafId = scheduleNextFrame(tick);
        return;
      }
      const deltaMs = Math.min(n * TARGET_FRAME_MS, 50);
      let next = harvestProgressRef.current + deltaMs * percentPerMs;
      let cycled = false;
      let overflowCycles = 0;
      let c = harvestChargesRef.current;
      while (next >= 100) {
        next -= 100;
        cycled = true;
        if (c < HARVEST_CHARGES_MAX) {
          c++;
        } else {
          overflowCycles++;
        }
        setHarvestBounceTrigger((t) => t + 1);
      }
      harvestProgressRef.current = next;
      if (cycled) setHarvestProgress(next);
      if (cycled) {
        harvestChargesRef.current = c;
        setHarvestCharges(c);
      }
      if (overflowCycles > 0) spawnHarvestSurplusCoinPanels(overflowCycles);
      rafId = scheduleNextFrame(tick);
    };
    rafId = scheduleNextFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [harvestSpeedLevel, isLoading, activeBoosts, activeFtueStage, ftue7Scheduled, ftueHarvestSurplusActivated, ftueSeedSurplusActivated, seedsState]);

  // Harvest tap zoom: TAP_BAR_PERCENT per tap when no charges (fast smooth zoom)
  useEffect(() => {
    const zoom = harvestTapZoomRef.current;
    if (!zoom) return;
    let rafId: number;
    const durationMs = 100;
    const easeOutCubic = (t: number) => 1 - (1 - t) ** 3;
    const tick = () => {
      const zoom = harvestTapZoomRef.current;
      if (!zoom) return;
      const elapsed = Date.now() - zoom.startTime;
      const t = Math.min(1, elapsed / durationMs);
      const alpha = easeOutCubic(t);
      const value = zoom.start + (zoom.end - zoom.start) * alpha;
      harvestProgressRef.current = value;
      if (t >= 1) {
        harvestProgressRef.current = zoom.end;
        harvestTapZoomRef.current = null;
        if (zoom.end >= 100) {
          let p = zoom.end;
          let c = harvestChargesRef.current;
          let overflowCycles = 0;
          while (p >= 100) {
            p -= 100;
            if (c < HARVEST_CHARGES_MAX) c++;
            else overflowCycles++;
          }
          harvestProgressRef.current = p;
          setHarvestProgress(p);
          harvestChargesRef.current = c;
          setHarvestCharges(c);
          setHarvestBounceTrigger((t) => t + 1);
          if (overflowCycles > 0) {
            spawnHarvestSurplusCoinPanels(overflowCycles);
          }
        }
        return;
      }
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [harvestTapZoomTrigger, ftueHarvestSurplusActivated, ftueSeedSurplusActivated, seedsState]);

  // Leaf burst when harvest gains first charge (button turns white)
  const prevHarvestChargesRef = useRef(harvestCharges);
  useEffect(() => {
    const prev = prevHarvestChargesRef.current;
    prevHarvestChargesRef.current = harvestCharges;
    if (prev === 0 && harvestCharges > 0 && harvestButtonRef.current && !getPerformanceMode()) {
      const rect = harvestButtonRef.current.getBoundingClientRect();
      setButtonLeafBursts(prev => [...prev, {
        id: `harvest-${Date.now()}`,
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2,
        startTime: Date.now()
      }]);
    }
  }, [harvestCharges]);

  // Helper function to trigger seed button leaf burst (called when shooting a seed)
  const triggerSeedButtonLeafBurst = useCallback(() => {
    if (plantButtonRef.current && !getPerformanceMode()) {
      const rect = plantButtonRef.current.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      setButtonLeafBursts(prev => [...prev, {
        id: `seed-${Date.now()}`,
        x: centerX,
        y: centerY,
        startTime: Date.now()
      }]);
    }
  }, []);

  const triggerHarvestButtonLeafBurst = useCallback(() => {
    if (harvestButtonRef.current && !getPerformanceMode()) {
      const rect = harvestButtonRef.current.getBoundingClientRect();
      setButtonLeafBursts(prev => [...prev, {
        id: `harvest-tap-${Date.now()}`,
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2,
        startTime: Date.now()
      }]);
    }
  }, []);

  const spawnCropAt = useCallback((index: number, plantLevel: number = 1) => {
    setGrid(prev => {
      const newGrid = [...prev];
      if (newGrid[index] && newGrid[index].item === null) {
        recentSeedLandTimesRef.current.set(index, Date.now());
        newGrid[index] = {
          ...newGrid[index],
          item: {
            id: Math.random().toString(36).substr(2, 9),
            level: plantLevel,
            type: 'CROP'
          }
        };
      }
      return newGrid;
    });
    setImpactCellIdx(index);
    setTimeout(() => setImpactCellIdx(null), 500);
  }, []);

  const flushPendingProjectileCropSpawns = useCallback(() => {
    projectileCropSpawnFlushScheduledRef.current = false;
    const pending = pendingProjectileCropSpawnsRef.current;
    if (pending.size === 0) return;
    const entries = Array.from(pending.entries());
    pending.clear();
    setGrid((prev) => {
      let next = [...prev];
      let changed = false;
      for (const [index, plantLevel] of entries) {
        const cell = next[index];
        if (cell && cell.item === null) {
          recentSeedLandTimesRef.current.set(index, Date.now());
          next[index] = {
            ...cell,
            item: {
              id: Math.random().toString(36).slice(2, 11),
              level: plantLevel,
              type: 'CROP',
            },
          };
          changed = true;
        }
      }
      return changed ? next : prev;
    });
    const lastIdx = entries[entries.length - 1]![0];
    setImpactCellIdx(lastIdx);
    setTimeout(() => setImpactCellIdx(null), 500);
    scheduleAutoMergeRecheckRef.current(AUTO_MERGE_POST_SETTLE_MS);
  }, []);

  const queueSpawnCropFromProjectile = useCallback(
    (index: number, plantLevel: number) => {
      pendingProjectileCropSpawnsRef.current.set(index, plantLevel);
      if (!projectileCropSpawnFlushScheduledRef.current) {
        projectileCropSpawnFlushScheduledRef.current = true;
        queueMicrotask(() => {
          flushPendingProjectileCropSpawns();
        });
      }
    },
    [flushPendingProjectileCropSpawns]
  );

  const applyWildGrowthSpawnAtCell = useCallback((targetIdx: number, plantLevel: number) => {
    spawnCropAt(targetIdx, plantLevel);
    queueMicrotask(() => scheduleAutoMergeRecheckRef.current(AUTO_MERGE_POST_SETTLE_MS));
    requestAnimationFrame(() => {
      const hexEl = document.getElementById(`hex-${targetIdx}`);
      if (!hexEl) return;
      const r = hexEl.getBoundingClientRect();
      if (!getPerformanceMode()) {
        setLeafBurstsSmall((prev) => [
          ...prev,
          {
            id: `wild-growth-burst-${targetIdx}-${Date.now()}`,
            x: r.left + r.width / 2,
            y: r.top + r.height / 2,
            startTime: Date.now(),
          },
        ]);
      }
      setCellHighlightBeams((prev) => [
        ...prev,
        {
          id: `wild-growth-beam-${targetIdx}-${Date.now()}`,
          x: r.left + r.width / 2,
          y: r.top + r.height / 2,
          cellWidth: r.width,
          cellHeight: r.height,
          startTime: Date.now(),
        },
      ]);
    });
  }, [spawnCropAt]);

  useEffect(() => {
    applyWildGrowthSpawnAtCellRef.current = applyWildGrowthSpawnAtCell;
  }, [applyWildGrowthSpawnAtCell]);

  const handleTabChange = (tab: TabType) => {
    if (activeFtueStage === 'first_upgrade' && ftue10Phase === 'point_orders' && tab === 'SEEDS') {
      setIsExpanded(true);
      setFtue10Phase('panel_open_orders');
      return;
    }
    if (activeFtueStage === 'first_upgrade' && ftue10Phase === 'panel_open_orders' && tab === 'CROPS') {
      setActiveTab('CROPS');
      setFtue10Phase('finger');
      setFtue10GreenFlashUpgradeId('harvest_speed');
      return;
    }
    setActiveTab(tab);
    if (!ftueUpgradePanelVisible) return; // FTUE: panel hidden until we reveal it
    setIsExpanded(true);
  };

  // When upgrade panel is hidden by FTUE, keep it collapsed so state is correct when we reveal later
  useEffect(() => {
    if (!ftueUpgradePanelVisible && isExpanded) setIsExpanded(false);
  }, [ftueUpgradePanelVisible, isExpanded]);

  // Handle tap on locked cell: open CROPS tab (opens the upgrade panel). Set to false to disable.
  const ENABLE_LOCKED_CELL_TAP = false;
  const handleLockedCellTap = useCallback(() => {
    if (!ftueUpgradePanelVisible) return;
    setActiveTab('CROPS');
    setIsExpanded(true);
  }, [ftueUpgradePanelVisible]);

  // Handle unlocking a cell when plot_expansion is upgraded
  const handleUnlockCell = useCallback(() => {
    // Find all locked cell indices
    const lockedIndices = grid.map((cell, idx) => cell.locked ? idx : -1).filter(idx => idx !== -1);
    if (lockedIndices.length === 0) return;
    
    // Pick a random locked cell
    const randomIdx = lockedIndices[Math.floor(Math.random() * lockedIndices.length)];
    
    // Start unlock animation
    setUnlockingCellIndices(prev => [...prev, randomIdx]);
    
    // Spawn unlock burst (50% particles) and green highlight beam at the cell center
    const hexEl = document.getElementById(`hex-${randomIdx}`);
    if (hexEl) {
      const rect = hexEl.getBoundingClientRect();
      setUnlockBursts(prev => [
        ...prev,
        {
          id: `unlock-${randomIdx}-${Date.now()}`,
          x: rect.left + rect.width / 2,
          y: rect.top + rect.height / 2,
          startTime: Date.now(),
        },
      ]);
      // Yellow highlight beam for unlock
      setCellHighlightBeams(prev => [
        ...prev,
        {
          id: `unlock-beam-${randomIdx}-${Date.now()}`,
          x: rect.left + rect.width / 2,
          y: rect.top + rect.height / 2,
          cellWidth: rect.width,
          cellHeight: rect.height,
          startTime: Date.now(),
        },
      ]);
    }
    
    // After animation, unlock the cell
    setTimeout(() => {
      setGrid(prev => {
        const newGrid = [...prev];
        newGrid[randomIdx] = { ...newGrid[randomIdx], locked: false };
        return newGrid;
      });
      setUnlockingCellIndices(prev => prev.filter(idx => idx !== randomIdx));
    }, 200);
  }, [grid]);

  // Handle fertilizing a cell when fertile_soil is upgraded
  const handleFertilizeCell = useCallback(() => {
    // Find all fertilizable cell indices (unlocked and not already fertile)
    // Prioritize empty cells
    const fertilizableEmptyIndices = grid.map((cell, idx) => 
      !cell.locked && !cell.fertile && !cell.item ? idx : -1
    ).filter(idx => idx !== -1);
    
    const fertilizableWithPlantIndices = grid.map((cell, idx) => 
      !cell.locked && !cell.fertile && cell.item ? idx : -1
    ).filter(idx => idx !== -1);
    
    // Try empty cells first, then cells with plants
    let targetIndices = fertilizableEmptyIndices.length > 0 
      ? fertilizableEmptyIndices 
      : fertilizableWithPlantIndices;
    
    if (targetIndices.length === 0) return;
    
    // Pick a random fertilizable cell
    const randomIdx = targetIndices[Math.floor(Math.random() * targetIndices.length)];
    
    // Start fertilize animation
    setFertilizingCellIndices(prev => [...prev, randomIdx]);
    
    // Spawn yellow highlight beam VFX at the cell
    const hexEl = document.getElementById(`hex-${randomIdx}`);
    if (hexEl) {
      const rect = hexEl.getBoundingClientRect();
      setCellHighlightBeams(prev => [
        ...prev,
        {
          id: `fertilize-${randomIdx}-${Date.now()}`,
          x: rect.left + rect.width / 2,
          y: rect.top + rect.height / 2,
          cellWidth: rect.width,
          cellHeight: rect.height,
          startTime: Date.now(),
        },
      ]);
    }
    
    // After animation, mark the cell as fertile (sync with beam animation ~200ms for the sprite swap)
    setTimeout(() => {
      setGrid(prev => {
        const newGrid = [...prev];
        newGrid[randomIdx] = { ...newGrid[randomIdx], fertile: true };
        return newGrid;
      });
      setFertilizingCellIndices(prev => prev.filter(idx => idx !== randomIdx));
    }, 200);
  }, [grid]);

  const handlePlantClick = (e: React.MouseEvent) => {
    e.stopPropagation();

    // FTUE_2: must tap exactly 2 times to plant 2 seeds; block 3rd tap (ref so rapid taps can't slip through before state updates)
    if (activeFtueStage === 'seed_tap' && (ftue2SeedFireCount >= 2 || ftue2SeedsBlockedRef.current)) return;
    // FTUE_3: seeds button blocked during merge-drag step
    if (activeFtueStage === 'merge_drag') return;
    // FTUE_7: must tap exactly 2 times; block 3rd tap
    if (activeFtueStage === 'first_more_orders' && ftue7SeedFireCount >= 2) return;

    // When white (seeds in storage) or FTUE 7 (free 2 seeds): only fire seed, no progress
    if (seedsInStorage > 0 || activeFtueStage === 'first_more_orders') {
      // Get cells that have projectiles in flight (reserved)
      const reservedCells = new Set(activeProjectiles.map(p => p.targetIdx));
      
      // Only target unlocked empty cells that don't have incoming projectiles
      const emptyIndices = grid
        .map((cell, idx) => (cell.item === null && !cell.locked && !reservedCells.has(idx) ? idx : null))
        .filter((idx): idx is number => idx !== null);
      if (emptyIndices.length > 0) {
        // FTUE_2: first seed → cell 4, second seed → cell 13. Pick by which is still empty (avoids stale state on second tap).
        let targetIdx: number;
        if (activeFtueStage === 'seed_tap') {
          if (emptyIndices.includes(FTUE_2_SEED_CELL_A)) targetIdx = FTUE_2_SEED_CELL_A;
          else if (emptyIndices.includes(FTUE_2_SEED_CELL_B)) targetIdx = FTUE_2_SEED_CELL_B;
          else targetIdx = emptyIndices[Math.floor(Math.random() * emptyIndices.length)];
        } else if (activeFtueStage === 'first_more_orders') {
          targetIdx = ftue7SeedFireCount === 0 ? 4 : 8;
        } else {
          targetIdx = emptyIndices[Math.floor(Math.random() * emptyIndices.length)];
        }
        // First projectile: always standard tier from current seed level.
        spawnProjectile(targetIdx, seedLevel);
        if (!seedsFreeMode) setSeedsInStorage((prev) => Math.max(0, prev - 1));
        triggerSeedButtonLeafBurst();
        // FTUE_2: count this seed; after 2, start fade out
        if (activeFtueStage === 'seed_tap') {
          setFtue2SeedFireCount((c) => {
            const next = c + 1;
            if (next >= 2) {
              ftue2SeedsBlockedRef.current = true;
              setFtue2FadingOut(true);
              setTimeout(() => setActiveFtueStage('merge_drag'), 400); // Delay before FTUE_3 (match FTUE 2 fade-out so unblock is immediate)
            }
            return next;
          });
        }
        // FTUE_7: count this seed; after 2, start fade out
        if (activeFtueStage === 'first_more_orders') {
          setFtue7SeedFireCount((c) => {
            const next = c + 1;
            if (next >= 2) {
              setFtue7FadingOut(true);
            }
            return next;
          });
        }

        // Double Seeds + Lucky Seed: independent rolls. Both can proc → 3 projectiles (2× standard + 1× seedLevel+1 bonus).
        const skipExtraSeeds = activeFtueStage === 'seed_tap' || activeFtueStage === 'first_more_orders';
        const doubleSeedsLevel = seedsState?.double_seeds?.level ?? 0;
        const doubleChancePct = skipExtraSeeds ? 0 : Math.min(100, doubleSeedsLevel * 10);
        const luckyChancePct = skipExtraSeeds ? 0 : getBonusSeedChance(seedsState);
        const doubleProcs = doubleChancePct > 0 && Math.random() * 100 < doubleChancePct;
        const luckyProcs = luckyChancePct > 0 && Math.random() * 100 < luckyChancePct;

        const usedTargets = new Set<number>([targetIdx]);
        const pickNextTarget = (): number | null => {
          const cand = emptyIndices.filter((i) => !usedTargets.has(i));
          if (cand.length === 0) return null;
          const pick = cand[Math.floor(Math.random() * cand.length)];
          usedTargets.add(pick);
          return pick;
        };

        let staggerMs = 50;
        if (doubleProcs) {
          const t2 = pickNextTarget();
          if (t2 != null) {
            window.setTimeout(() => spawnProjectile(t2, seedLevel), staggerMs);
            staggerMs += 50;
          }
        }
        if (luckyProcs) {
          const bonusLevel = Math.min(24, Math.max(1, seedLevel + 1));
          const t3 = pickNextTarget();
          if (t3 != null) {
            window.setTimeout(() => spawnProjectile(t3, bonusLevel, false, true), staggerMs);
          }
        }
      }
      return;
    }

    if (isSeedFlashing) return;

    // FTUE 1–4 free mode: progress bar doesn't move, don't add progress on tap
    if (seedsFreeMode) return;

    // Seed button: TAP_BAR_PERCENT when empty (no seeds to fire)
    const tapPercent = TAP_BAR_PERCENT;
    const start = Math.max(0, seedProgressRef.current);
    const totalAfterTap = start + tapPercent;
    
    if (totalAfterTap > 100) {
      // Tap goes past 100%: add 1 seed (cap storage max). If already full, excess → surplus coin or lost.
      const remainder = totalAfterTap - 100;
      const surplusValue = getSeedSurplusValue(
        ftueSeedSurplusActivated
          ? ({ ...seedsState, seed_surplus: { level: Math.max(1, seedsState?.seed_surplus?.level ?? 0), progress: 0 } } as any)
          : seedsState,
        highestPlantEverRef.current
      );
      if (seedsInStorage >= seedStorageMax && surplusValue > 0) {
        const container = containerRef.current;
        const plantBtn = plantButtonRef.current;
        const walletIcon = walletIconRef.current;
        const wallet = walletRef.current;
        const walletEl = walletIcon || wallet;
        if (container && plantBtn && walletEl) {
          const scale = appScaleRef.current;
          const containerRect = container.getBoundingClientRect();
          const btnRect = plantBtn.getBoundingClientRect();
          const startX = (btnRect.left + btnRect.width / 2 - containerRect.left) / scale;
          const startY = (btnRect.top + btnRect.height / 2 - containerRect.top) / scale;
          const panelHeightPx = 14;
          const offsetUp = (panelHeightPx / 2 + 4) * 1.2;
          const hoverY = (btnRect.top - containerRect.top) / scale - offsetUp;
          setActiveCoinPanels((p) => [...p, { id: `seed-surplus-tap-${Date.now()}`, value: applyDoubleCoinsVisualAmount(surplusValue, activeBoostsRef.current), startX, startY, hoverX: startX, hoverY, moveToWalletDelayMs: 0, scale: 1.5 }]);
        }
      }
      setSeedsInStorage((prev) => Math.min(seedStorageMax, prev + 1));
      seedProgressRef.current = 0;
      setSeedProgress(0);
      setIsSeedFlashing(false);
      setSeedBounceTrigger((t) => t + 1);
      tapZoomRef.current = { start: 0, end: remainder, startTime: Date.now(), duration: 100 };
      setTapZoomTrigger((n) => n + 1);
    } else {
      // Normal tap: zoom from start to end (capped at 100%)
      const end = Math.min(100, totalAfterTap);
      tapZoomRef.current = { start, end, startTime: Date.now(), duration: 100 };
      setTapZoomTrigger((n) => n + 1);
    }

    setActiveTab('SEEDS');
  };

  const calculateFarmValue = useCallback(() => {
    return grid.reduce((acc, cell) => {
      if (!cell.item) return acc;
      return acc + Math.pow(3, cell.item.level - 1) * 25;
    }, 0);
  }, [grid]);

  const handleHarvestClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (harvestTapZoomRef.current) return;

    // FTUE 5 free mode: harvest works but doesn't consume charges; no progress bar fill
    if (harvestFreeMode) {
      const hasPlant = grid.some((c) => c.item);
      if (!hasPlant) return;
      let canSpendCharge = isSurplusSalesUnlocked(harvestState, playerLevel);
      if (!canSpendCharge) {
        for (let i = 0; i < goalSlots.length; i++) {
          if (goalSlots[i] !== 'green' || (goalCounts[i] ?? 0) <= 0) continue;
          const inFlight = goalInFlightHarvestBySlotRef.current[i] ?? 0;
          if ((goalCounts[i] ?? 0) - inFlight <= 0) continue;
          const pt = goalPlantTypes[i] ?? 0;
          if (grid.some((cell) => cell.item && cell.item.level === pt)) {
            canSpendCharge = true;
            break;
          }
        }
      }
      if (!canSpendCharge) return;
      performHarvest(0, '');
      triggerHarvestButtonLeafBurst();
      setHarvestBounceTrigger((t) => t + 1);
      setActiveTab('CROPS');
      return;
    }

    if (harvestCharges > 0) {
      const hasPlant = grid.some((c) => c.item);
      if (!hasPlant) return;
      let canSpendCharge = isSurplusSalesUnlocked(harvestState, playerLevel);
      if (!canSpendCharge) {
        for (let i = 0; i < goalSlots.length; i++) {
          if (goalSlots[i] !== 'green' || (goalCounts[i] ?? 0) <= 0) continue;
          const inFlight = goalInFlightHarvestBySlotRef.current[i] ?? 0;
          if ((goalCounts[i] ?? 0) - inFlight <= 0) continue;
          const pt = goalPlantTypes[i] ?? 0;
          if (grid.some((cell) => cell.item && cell.item.level === pt)) {
            canSpendCharge = true;
            break;
          }
        }
      }
      if (!canSpendCharge) return;
      performHarvest(0, '');
      triggerHarvestButtonLeafBurst();
      setHarvestBounceTrigger((t) => t + 1);
      setHarvestCharges((c) => Math.max(0, c - 1));
      setActiveTab('CROPS');
      return;
    }

    const tapPercent = TAP_BAR_PERCENT;
    const current = harvestProgressRef.current;
    const totalAfter = current + tapPercent;
    if (totalAfter >= 100) {
      const remainder = totalAfter - 100;
      let c = harvestChargesRef.current;
      if (c < HARVEST_CHARGES_MAX) c++;
      harvestProgressRef.current = remainder;
      setHarvestProgress(remainder);
      setHarvestCharges(c);
      setHarvestBounceTrigger((t) => t + 1);
      harvestTapZoomRef.current = { start: 0, end: remainder, startTime: Date.now(), duration: 100 };
      setHarvestTapZoomTrigger((t) => t + 1);
    } else {
      harvestTapZoomRef.current = { start: current, end: totalAfter, startTime: Date.now(), duration: 100 };
      setHarvestTapZoomTrigger((t) => t + 1);
    }
    setActiveTab('CROPS');
  };

  // Helper: get hex neighbors in axial coordinates
  const getHexNeighborCoords = (q: number, r: number): [number, number][] => {
    return [
      [q + 1, r], [q - 1, r],
      [q, r + 1], [q, r - 1],
      [q + 1, r - 1], [q - 1, r + 1]
    ];
  };

  // Helper: check if a cell has an adjacent cell with the same level plant
  const hasAdjacentSameLevel = (cellIdx: number, gridSnapshot: BoardCell[]): boolean => {
    const cell = gridSnapshot[cellIdx];
    if (!cell.item) return false;
    const neighbors = getHexNeighborCoords(cell.q, cell.r);
    return gridSnapshot.some((other, otherIdx) => {
      if (otherIdx === cellIdx || !other.item) return false;
      return neighbors.some(([nq, nr]) => other.q === nq && other.r === nr && other.item!.level === cell.item!.level);
    });
  };

  // Helper: get adjacent cell indices for a given cell
  const getAdjacentCellIndices = (cellIdx: number, gridSnapshot: BoardCell[]): number[] => {
    const cell = gridSnapshot[cellIdx];
    if (!cell) return [];
    const neighbors = getHexNeighborCoords(cell.q, cell.r);
    const adjacentIndices: number[] = [];
    gridSnapshot.forEach((other, otherIdx) => {
      if (otherIdx === cellIdx) return;
      if (neighbors.some(([nq, nr]) => other.q === nq && other.r === nr)) {
        adjacentIndices.push(otherIdx);
      }
    });
    return adjacentIndices;
  };

  // Perform a single harvest
  // Plant harvest: if goal exists for plant level (1-5 → slot 0-4), spawn plant panel to goal. Else spawn coin panel.
  const performHarvest = useCallback((delayMs: number = 0, idSuffix: string = '') => {
    const container = containerRef.current;
    const wallet = walletRef.current;
    const walletIcon = walletIconRef.current;
    const walletEl = walletIcon || wallet;
    const harvestCellIndices: number[] = [];

    if (container && walletEl) {
      const scale = appScaleRef.current;
      const containerRect = container.getBoundingClientRect();
      const walletRect = walletEl.getBoundingClientRect();
      const walletCenterX = (walletRect.left + walletRect.width / 2 - containerRect.left) / scale;
      const walletCenterY = (walletRect.top + walletRect.height / 2 - containerRect.top) / scale;

      const coinPanelsWithDist: { panel: CoinPanelData; dist: number }[] = [];
      const plantPanelsWithDist: { panel: PlantPanelData; dist: number }[] = [];

      const cropYieldPerHarvest = getCropYieldPerHarvest(cropsState);
      const hasDoubleHarvestBoost = activeBoosts.some(b => b.offerId === 'double_harvest');
      const effectiveCropYield = hasDoubleHarvestBoost ? cropYieldPerHarvest * 2 : cropYieldPerHarvest;

      const getGoalIconCenter = (slotIdx: number): { x: number; y: number } | null => {
        const iconEl = goalIconRefs[slotIdx]?.current;
        if (!iconEl) return null;
        const r = iconEl.getBoundingClientRect();
        return {
          x: (r.left + r.width / 2 - containerRect.left) / scale,
          y: (r.top + r.height / 2 - containerRect.top) / scale,
        };
      };

      const surplusMultiplier = getSurplusSalesMultiplier(harvestState);
      const surplusSalesUnlocked = isSurplusSalesUnlocked(harvestState, playerLevel);
      const allocated: Record<number, number> = {}; // per-slot allocation within this harvest
      // Snapshot so one performHarvest pass doesn't double-count panels we spawn in this same pass
      const inFlightAtStart: Record<number, number> = { ...goalInFlightHarvestBySlotRef.current };
      grid.forEach((cell, cellIdx) => {
        if (!cell.item) return;
        const level = cell.item.level;
        const slotIdx = level >= 1 && level <= 24
          ? (() => {
              let best = -1;
              let minRemaining = Infinity;
              goalPlantTypes.forEach((pt, i) => {
                if (pt !== level || goalSlots[i] !== 'green' || (goalCounts[i] ?? 0) <= 0 || goalsPendingCompletionRef.current.has(i)) return;
                const remaining = (goalCounts[i] ?? 0) - (inFlightAtStart[i] ?? 0) - (allocated[i] ?? 0);
                if (remaining > 0 && remaining < minRemaining) {
                  minRemaining = remaining;
                  best = i;
                }
              });
              return best;
            })()
          : -1;
        const hasGoalForPlant = slotIdx >= 0;
        if (!hasGoalForPlant && !surplusSalesUnlocked) return;
        harvestCellIndices.push(cellIdx);

        const hexEl = document.getElementById(`hex-${cellIdx}`);
        if (!hexEl) return;
        const hexRect = hexEl.getBoundingClientRect();
        const startX = (hexRect.left + hexRect.width / 2 - containerRect.left) / scale;
        const startY = (hexRect.top + hexRect.height / 2 - containerRect.top) / scale;
        const hoverX = startX;
        const hexTopY = (hexRect.top - containerRect.top) / scale;
        const panelHeightPx = 14;
        const offsetUp = (panelHeightPx / 2 + 4) * 0.8;
        const hoverY = hexTopY - offsetUp;

        if (hasGoalForPlant) {
          // Fertile soil should yield double crops when harvesting (and stack on top of rewards like double_harvest).
          const cellCropYield = effectiveCropYield * (cell.fertile ? 2 : 1);
          allocated[slotIdx] = (allocated[slotIdx] ?? 0) + cellCropYield;
          goalInFlightHarvestBySlotRef.current[slotIdx] = (goalInFlightHarvestBySlotRef.current[slotIdx] ?? 0) + cellCropYield;
          if ((goalCounts[slotIdx] ?? 0) - (inFlightAtStart[slotIdx] ?? 0) - (allocated[slotIdx] ?? 0) <= 0) {
            goalsPendingCompletionRef.current.add(slotIdx);
          }
          const goalCenter = getGoalIconCenter(slotIdx);
          const dist = goalCenter ? Math.hypot(hoverX - goalCenter.x, hoverY - goalCenter.y) : 0;
          const plantLevel = goalPlantTypes[slotIdx] ?? slotIdx + 1;
          plantPanelsWithDist.push({
            dist,
            panel: {
              id: `plant-${cellIdx}-${Date.now()}-${Math.random().toString(36).slice(2)}${idSuffix}`,
              goalSlotIdx: slotIdx,
              iconSrc: getGoalIconForPlantLevel(plantLevel),
              harvestAmount: cellCropYield,
              startX,
              startY,
              hoverX,
              hoverY,
              moveToTargetDelayMs: delayMs,
              ...(activeFtueStage === 'first_harvest' ? { visualScale: 2 } : {}),
            },
          });
        } else {
          const baseValue = getCoinValueForLevel(level);
          let value = baseValue;
          if (cell.fertile) value *= 2;
          value = Math.floor(value * surplusMultiplier);
          if (hasDoubleHarvestBoost) value *= 2;
          value = applyDoubleCoinsVisualAmount(value, activeBoostsRef.current);
          const dist = Math.hypot(hoverX - walletCenterX, hoverY - walletCenterY);
          coinPanelsWithDist.push({
            dist,
            panel: {
              id: `coin-${cellIdx}-${Date.now()}-${Math.random().toString(36).slice(2)}${idSuffix}`,
              value,
              startX,
              startY,
              hoverX,
              hoverY,
              moveToWalletDelayMs: delayMs,
            },
          });
        }
      });

      setTimeout(() => {
        setHarvestBounceCellIndices(harvestCellIndices);
        setTimeout(() => setHarvestBounceCellIndices([]), 250);

        // Batch leaf bursts; when many harvests reduce count + particles for FPS. Performance mode: stricter limits.
        const now = Date.now();
        const harvestCount = harvestCellIndices.length;
        const perfMode = getPerformanceMode();
        const manyHarvests = perfMode ? harvestCount > 4 : harvestCount > 10;
        const veryManyHarvests = perfMode ? harvestCount > 8 : harvestCount > 15;
        const cellIndicesToBurst = veryManyHarvests
          ? harvestCellIndices.filter((_, i) => i % (perfMode ? 4 : 3) === 0)
          : harvestCellIndices;
        const newBursts = cellIndicesToBurst
          .map((cellIdx) => {
            const hexEl = document.getElementById(`hex-${cellIdx}`);
            if (!hexEl) return null;
            const r = hexEl.getBoundingClientRect();
            return {
              id: `harvest-${cellIdx}-${now}-${Math.random().toString(36).slice(2)}${idSuffix}`,
              x: r.left + r.width / 2,
              y: r.top + r.height / 2,
              startTime: now,
              ...(manyHarvests ? { particleCount: veryManyHarvests || perfMode ? 1 : 2 } : {}),
            };
          })
          .filter((b): b is NonNullable<typeof b> => b !== null);
        if (newBursts.length > 0 && !getPerformanceMode()) {
          setLeafBurstsSmall((prev) => [...prev, ...newBursts]);
        }

        if (coinPanelsWithDist.length > 0) {
          const N = coinPanelsWithDist.length;
          const minDist = Math.min(...coinPanelsWithDist.map((x) => x.dist));
          const maxDist = Math.max(...coinPanelsWithDist.map((x) => x.dist));
          const range = maxDist - minDist || 1;
          const maxStaggerMs = N <= 1 ? 0 : Math.min(300, 300 * (N - 1) / 4);
          const panels: CoinPanelData[] = coinPanelsWithDist.map(({ panel, dist }) => ({
            ...panel,
            moveToWalletDelayMs: panel.moveToWalletDelayMs + ((dist - minDist) / range) * maxStaggerMs,
          }));
          setActiveCoinPanels(prev => [...prev, ...panels]);
        }

        if (plantPanelsWithDist.length > 0) {
          const N = plantPanelsWithDist.length;
          const minDist = Math.min(...plantPanelsWithDist.map((x) => x.dist));
          const maxDist = Math.max(...plantPanelsWithDist.map((x) => x.dist));
          const range = maxDist - minDist || 1;
          const maxStaggerMs = N <= 1 ? 0 : Math.min(300, 300 * (N - 1) / 4);
          const panels: PlantPanelData[] = plantPanelsWithDist.map(({ panel, dist }) => ({
            ...panel,
            moveToTargetDelayMs: panel.moveToTargetDelayMs + ((dist - minDist) / range) * maxStaggerMs,
          }));
          setActivePlantPanels(prev => [...prev, ...panels]);
        }
      }, delayMs);
    }
  }, [grid, cropsState, goalSlots, goalCounts, goalPlantTypes, harvestState, playerLevel, activeFtueStage, activeBoosts]);

  // Perform merge harvest: roll chance per adjacent cell to harvest (spawn coin or plant panel) without removing plant
  const performMergeHarvest = useCallback((centerCellIdx: number, chancePercent: number, excludeCellIdx?: number) => {
    const container = containerRef.current;
    const wallet = walletRef.current;
    const walletIcon = walletIconRef.current;
    const walletEl = walletIcon || wallet;

    if (!container || !walletEl) return;

    const adjacentIndices = getAdjacentCellIndices(centerCellIdx, grid);
    const adjacentWithCrops = adjacentIndices.filter(idx => idx !== excludeCellIdx && grid[idx]?.item != null);
    if (adjacentWithCrops.length === 0) return;

    const triggeredCells = adjacentWithCrops.filter(() => Math.random() * 100 < chancePercent);
    if (triggeredCells.length === 0) return;

    const scale = appScaleRef.current;
    const containerRect = container.getBoundingClientRect();
    const walletRect = walletEl.getBoundingClientRect();
    const walletCenterX = (walletRect.left + walletRect.width / 2 - containerRect.left) / scale;
    const walletCenterY = (walletRect.top + walletRect.height / 2 - containerRect.top) / scale;

    const coinPanelsWithDist: { panel: CoinPanelData; dist: number }[] = [];
    const plantPanelsWithDist: { panel: PlantPanelData; dist: number }[] = [];
    /** Chain harvest (merge-adjacent): always 1 crop toward goals; no crop yield, no double-harvest ad */
    const mergeHarvestCropAmount = 1;
    const allocated: Record<number, number> = {};
    const inFlightAtStartMerge: Record<number, number> = { ...goalInFlightHarvestBySlotRef.current };

    const getGoalIconCenter = (slotIdx: number): { x: number; y: number } | null => {
      const iconEl = goalIconRefs[slotIdx]?.current;
      if (!iconEl) return null;
      const r = iconEl.getBoundingClientRect();
      return {
        x: (r.left + r.width / 2 - containerRect.left) / scale,
        y: (r.top + r.height / 2 - containerRect.top) / scale,
      };
    };

    const mergeBursts: { id: string; x: number; y: number; startTime: number; particleCount?: number }[] = [];
    const mergeBeams: { id: string; x: number; y: number; cellWidth: number; cellHeight: number; startTime: number }[] = [];
    const mergeNow = Date.now();
    const mergeCount = triggeredCells.length;
    const manyMergeHarvests = mergeCount > 10;
    const veryManyMergeHarvests = mergeCount > 15;

    triggeredCells.forEach((cellIdx) => {
      const cell = grid[cellIdx];
      if (!cell.item) return;

      const level = cell.item.level;
      const slotIdx = level >= 1 && level <= 24
        ? (() => {
            let best = -1;
            let minRemaining = Infinity;
            goalPlantTypes.forEach((pt, i) => {
              if (pt !== level || goalSlots[i] !== 'green' || (goalCounts[i] ?? 0) <= 0 || goalsPendingCompletionRef.current.has(i)) return;
              const remaining = (goalCounts[i] ?? 0) - (inFlightAtStartMerge[i] ?? 0) - (allocated[i] ?? 0);
              if (remaining > 0 && remaining < minRemaining) {
                minRemaining = remaining;
                best = i;
              }
            });
            return best;
          })()
        : -1;
      const hasGoalForPlant = slotIdx >= 0;

      const hexEl = document.getElementById(`hex-${cellIdx}`);
      if (!hexEl) return;

      const hexRect = hexEl.getBoundingClientRect();
      const startX = (hexRect.left + hexRect.width / 2 - containerRect.left) / scale;
      const startY = (hexRect.top + hexRect.height / 2 - containerRect.top) / scale;
      const hoverX = startX;
      const hexTopY = (hexRect.top - containerRect.top) / scale;
      const panelHeightPx = 14;
      const offsetUp = (panelHeightPx / 2 + 4) * 0.8;
      const hoverY = hexTopY - offsetUp;

      if (hasGoalForPlant) {
        allocated[slotIdx] = (allocated[slotIdx] ?? 0) + mergeHarvestCropAmount;
        goalInFlightHarvestBySlotRef.current[slotIdx] = (goalInFlightHarvestBySlotRef.current[slotIdx] ?? 0) + mergeHarvestCropAmount;
        if ((goalCounts[slotIdx] ?? 0) - (inFlightAtStartMerge[slotIdx] ?? 0) - (allocated[slotIdx] ?? 0) <= 0) {
          goalsPendingCompletionRef.current.add(slotIdx);
        }
        const goalCenter = getGoalIconCenter(slotIdx);
        const dist = goalCenter ? Math.hypot(hoverX - goalCenter.x, hoverY - goalCenter.y) : 0;
        const plantLevel = goalPlantTypes[slotIdx] ?? slotIdx + 1;
        plantPanelsWithDist.push({
          dist,
          panel: {
            id: `merge-plant-${cellIdx}-${mergeNow}-${Math.random().toString(36).slice(2)}`,
            goalSlotIdx: slotIdx,
            iconSrc: getGoalIconForPlantLevel(plantLevel),
            harvestAmount: mergeHarvestCropAmount,
            startX,
            startY,
            hoverX,
            hoverY,
            moveToTargetDelayMs: 0,
            ...(activeFtueStage === 'first_harvest' ? { visualScale: 2 } : {}),
          },
        });
      } else {
        let value = getCoinValueForLevel(level);
        if (cell.fertile) value *= 2;
        value = Math.floor(value);
        /* Coin panel → wallet when no goal; base tier value only (no Surplus Sales multiplier). */
        value = applyDoubleCoinsVisualAmount(value, activeBoostsRef.current);
        const dist = Math.hypot(hoverX - walletCenterX, hoverY - walletCenterY);
        coinPanelsWithDist.push({
          dist,
          panel: {
            id: `merge-harvest-${cellIdx}-${mergeNow}-${Math.random().toString(36).slice(2)}`,
            value,
            startX,
            startY,
            hoverX,
            hoverY,
            moveToWalletDelayMs: 0,
            scale: MERGE_COIN_HARVEST_PANEL_SCALE,
          },
        });
      }

      mergeBursts.push({
        id: `merge-harvest-burst-${cellIdx}-${mergeNow}-${Math.random().toString(36).slice(2)}`,
        x: hexRect.left + hexRect.width / 2,
        y: hexRect.top + hexRect.height / 2,
        startTime: mergeNow,
        ...(manyMergeHarvests ? { particleCount: veryManyMergeHarvests ? 1 : 2 } : {}),
      });
      mergeBeams.push({
        id: `merge-harvest-highlight-${cellIdx}-${mergeNow}-${Math.random().toString(36).slice(2)}`,
        x: hexRect.left + hexRect.width / 2,
        y: hexRect.top + hexRect.height / 2,
        cellWidth: hexRect.width,
        cellHeight: hexRect.height,
        startTime: mergeNow,
      });
    });

    if (mergeBursts.length > 0 && !getPerformanceMode()) {
      setLeafBurstsSmall((prev) => [...prev, ...mergeBursts]);
    }
    if (mergeBeams.length > 0) {
      setCellHighlightBeams((prev) => [...prev, ...mergeBeams]);
    }

    if (coinPanelsWithDist.length > 0) {
      const N = coinPanelsWithDist.length;
      const minDist = Math.min(...coinPanelsWithDist.map((x) => x.dist));
      const maxDist = Math.max(...coinPanelsWithDist.map((x) => x.dist));
      const range = maxDist - minDist || 1;
      const maxStaggerMs = N <= 1 ? 0 : Math.min(200, 200 * (N - 1) / 4);
      const panels: CoinPanelData[] = coinPanelsWithDist.map(({ panel, dist }) => ({
        ...panel,
        moveToWalletDelayMs: ((dist - minDist) / range) * maxStaggerMs,
      }));
      setActiveCoinPanels(prev => [...prev, ...panels]);
    }

    if (plantPanelsWithDist.length > 0) {
      const N = plantPanelsWithDist.length;
      const minDist = Math.min(...plantPanelsWithDist.map((x) => x.dist));
      const maxDist = Math.max(...plantPanelsWithDist.map((x) => x.dist));
      const range = maxDist - minDist || 1;
      const maxStaggerMs = N <= 1 ? 0 : Math.min(200, 200 * (N - 1) / 4);
      const panels: PlantPanelData[] = plantPanelsWithDist.map(({ panel, dist }) => ({
        ...panel,
        moveToTargetDelayMs: ((dist - minDist) / range) * maxStaggerMs,
      }));
      setActivePlantPanels(prev => [...prev, ...panels]);
    }

    setHarvestBounceCellIndices(triggeredCells);
    setTimeout(() => setHarvestBounceCellIndices([]), 250);
  }, [grid, goalSlots, goalCounts, goalPlantTypes, harvestState, playerLevel, activeFtueStage]);

  // Called by HexBoard when starting a merge to calculate level increase
  const getMergeLevelIncrease = useCallback((_currentPlantLevel: number) => {
    pendingMergeLevelIncreaseRef.current = 1;
    return 1;
  }, []);

  const spawnMaxPlantReachedToast = useCallback((cellIdx: number) => {
    requestAnimationFrame(() => {
      const el = document.getElementById(`hex-${cellIdx}`);
      if (!el) return;
      const r = el.getBoundingClientRect();
      // Store viewport coordinates so we can render in a fixed portal (no dependency on coin panel portal rect).
      const x = r.left + r.width / 2;
      const y = r.top + r.height / 2;
      const id = `max-plant-${cellIdx}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const startTime = Date.now();
      setMaxPlantToasts((prev) => [...prev, { id, x, y, startTime }]);
      window.setTimeout(() => {
        setMaxPlantToasts((prev) => prev.filter((t) => t.id !== id));
      }, 1000);
    });
  }, []);

  const handleMerge = (sourceIdx: number, targetIdx: number) => {
    // Check if this will be a merge before updating state
    const source = grid[sourceIdx];
    const target = grid[targetIdx];
    const willMerge = source.item && target.item && target.item.level === source.item.level;

    // Deny merges beyond max plant tier (24). Snap dragged plant back and show toast on the static plant.
    if (willMerge && source.item?.level === 24 && target.item?.level === 24) {
      spawnMaxPlantReachedToast(targetIdx);
      return;
    }

    // FTUE_3: successful drag 4→13 merge → fade out finger + textbox
    if (activeFtueStage === 'merge_drag' && sourceIdx === 4 && targetIdx === 13 && willMerge) {
      setFtue3FadingOut(true);
    }
    
    // Use the level increase that was calculated when the merge started (by HexBoard calling getMergeLevelIncrease)
    const levelIncrease = pendingMergeLevelIncreaseRef.current;
    
    // Calculate the new level for tracking highest plant ever
    const newLevel = willMerge && target.item ? target.item.level + levelIncrease : null;
    
    setGrid(prev => {
      const newGrid = [...prev];
      const source = newGrid[sourceIdx];
      const target = newGrid[targetIdx];
      if (!source.item) return prev;
      if (target.item && target.item.level === source.item.level) {
        newGrid[targetIdx] = {
          ...target,
          item: { ...target.item, level: target.item.level + levelIncrease }
        };
        newGrid[sourceIdx] = { ...source, item: null };
      } else if (!target.item) {
        newGrid[targetIdx] = { ...target, item: source.item };
        newGrid[sourceIdx] = { ...source, item: null };
      }
      return newGrid;
    });
    
    // Update highest plant ever if we created a new record and show discovery popup.
    // Use ref (not state) so we always reset the discovery counter even if state is stale/batched.
    if (newLevel != null && newLevel > highestPlantEverRef.current) {
      setHighestPlantEver(newLevel);
      highestPlantEverRef.current = newLevel; // Sync ref so next goal spawn sees new level immediately
      newGoalsSinceDiscoveryRef.current = 0; // ONLY reset here: "discovering a plant" = merge to new highest. Counter for next discovery goal starts now.
      lastMergeDiscoveryLevelRef.current = newLevel; // same "cycle": only allow discovery when current highest === this (never use pre-merge count)
      // Show discovery popup immediately when merge starts (feels more responsive)
      setDiscoveryPopup({ isVisible: true, level: newLevel });
      // FTUE 3: discovery popup hides FTUE 3 overlay so onFadeOutComplete never runs; set ftue4Pending so "Excellent!" starts FTUE 4
      if (newLevel === 2 && activeFtueStage === 'merge_drag') setFtue4Pending(true);
    }
    
    // Chain Harvest: per-cell chance to instantly harvest adjacent crops (without removing them)
    if (willMerge) {
      const mergeHarvestChance = getMergeHarvestChance(cropsState);
      if (mergeHarvestChance > 0) {
        performMergeHarvest(targetIdx, mergeHarvestChance, sourceIdx);
      }
      // Harvest bar: MERGE_BAR_PERCENT per merge
      {
        let p = harvestProgressRef.current + MERGE_BAR_PERCENT;
        let c = harvestChargesRef.current;
        while (p >= 100) {
          p -= 100;
          if (c < HARVEST_CHARGES_MAX) c++;
        }
        harvestProgressRef.current = p;
        setHarvestProgress(p);
        setHarvestCharges(c);
        setHarvestBounceTrigger((t) => t + 1);
      }
      // Seed bar: MERGE_BAR_PERCENT per merge
      {
        const seedMergeDelta = MERGE_BAR_PERCENT;
        let sp = tapZoomRef.current ? tapZoomRef.current.end : seedProgressRef.current;
        sp += seedMergeDelta;
        if (sp >= 100) {
          const remainder = sp - 100;
          const surplusValue = getSeedSurplusValue(
            ftueSeedSurplusActivated
              ? ({ ...seedsState, seed_surplus: { level: Math.max(1, seedsState?.seed_surplus?.level ?? 0), progress: 0 } } as any)
              : seedsState,
            highestPlantEverRef.current
          );
          const maxCap = getSeedStorageMax(seedsState);
          setSeedsInStorage((prev) => {
            const wasFull = prev >= maxCap;
            const next = Math.min(maxCap, prev + 1);
            if (wasFull && surplusValue > 0) {
              const container = containerRef.current;
              const plantBtn = plantButtonRef.current;
              const walletIcon = walletIconRef.current;
              const wallet = walletRef.current;
              const walletEl = walletIcon || wallet;
              if (container && plantBtn && walletEl) {
                const scale = appScaleRef.current;
                const containerRect = container.getBoundingClientRect();
                const btnRect = plantBtn.getBoundingClientRect();
                const startX = (btnRect.left + btnRect.width / 2 - containerRect.left) / scale;
                const startY = (btnRect.top + btnRect.height / 2 - containerRect.top) / scale;
                const panelHeightPx = 14;
                const offsetUp = (panelHeightPx / 2 + 4) * 1.2;
                const hoverY = (btnRect.top - containerRect.top) / scale - offsetUp;
                queueMicrotask(() =>
                  setActiveCoinPanels((p) => [
                    ...p,
                    {
                      id: `seed-surplus-merge-${Date.now()}`,
                      value: applyDoubleCoinsVisualAmount(surplusValue, activeBoostsRef.current),
                      startX,
                      startY,
                      hoverX: startX,
                      hoverY,
                      moveToWalletDelayMs: 0,
                      scale: 1.5,
                    },
                  ])
                );
              }
            }
            return next;
          });
          seedProgressRef.current = remainder;
          setSeedProgress(remainder);
          setIsSeedFlashing(false);
          tapZoomRef.current =
            remainder > 0 ? { start: 0, end: remainder, startTime: Date.now(), duration: 100 } : null;
          setTapZoomTrigger((n) => n + 1);
          setSeedBounceTrigger((t) => t + 1);
        } else {
          seedProgressRef.current = sp;
          setSeedProgress(sp);
          if (tapZoomRef.current) {
            tapZoomRef.current.end = sp;
          } else {
            tapZoomRef.current = { start: sp - seedMergeDelta, end: sp, startTime: Date.now(), duration: 100 };
          }
          setTapZoomTrigger((n) => n + 1);
        }
      }
    }
  };

  const clearAutoMergeRecheckTimeoutOnly = useCallback(() => {
    if (autoMergeRecheckTimeoutRef.current != null) {
      window.clearTimeout(autoMergeRecheckTimeoutRef.current);
      autoMergeRecheckTimeoutRef.current = null;
    }
  }, []);

  const clearAutoMergeRecheckTimeout = useCallback(() => {
    clearAutoMergeRecheckTimeoutOnly();
    nextAutoMergeTryAtRef.current = null;
  }, [clearAutoMergeRecheckTimeoutOnly]);

  const scheduleAutoMergeRecheck = useCallback(
    (delayMs: number) => {
      const wantAt = Date.now() + delayMs;
      const existing = nextAutoMergeTryAtRef.current;
      if (existing != null && wantAt >= existing) {
        return;
      }
      clearAutoMergeRecheckTimeoutOnly();
      nextAutoMergeTryAtRef.current = wantAt;
      autoMergeRecheckTimeoutRef.current = window.setTimeout(() => {
        autoMergeRecheckTimeoutRef.current = null;
        nextAutoMergeTryAtRef.current = null;
        tryStartAutoMergeRef.current();
      }, Math.max(0, wantAt - Date.now()));
    },
    [clearAutoMergeRecheckTimeoutOnly]
  );

  const tryStartAutoMerge = useCallback(() => {
    if (!autoMergeSetting || !getAutoMergeMode()) return;
    if (isLoading) return;
    if (activeFtueStage !== null || ftue11StartQueued) return;
    // Never merge while Settings is open (user should see the board when merges run).
    if (pauseMenuOpen) return;
    // Intentionally allow auto-merge while discovery / level-up are open so merge chains do not stall
    // (e.g. L2+L2→L3 opens discovery while two L1 pairs are still on the board).
    if (offlineEarningsUi?.open) return;
    if (showFakeAd) return;
    if (purchaseSuccessfulUi) return;
    if (limitedOfferPopup?.isVisible) return;
    if (plantInfoPopup?.isVisible) return;
    if (activeScreen !== 'FARM') return;
    // Board is always mounted on the farm column; merges must not depend on upgrade tab or panel height.
    if (dragState != null) return;
    const now = Date.now();
    const landMap = recentSeedLandTimesRef.current;
    for (const [idx, ts] of [...landMap]) {
      if (now - ts > AUTO_MERGE_SEED_INVOLVED_GRACE_MS + 2000) landMap.delete(idx);
    }
    const snap = gridRef.current;
    const pendingImpact = getPendingSeedImpactTargets(snap, activeProjectilesRef.current);
    const mergeCap = getActiveOrderMergeResultCap(goalPlantTypes, goalSlots, goalCounts);
    const pair = findBestAutoMergePair(snap, mergeCap, pendingImpact);
    if (!pair) {
      if (!autoMergeNullBackupWaveArmedRef.current) {
        autoMergeNullBackupWaveArmedRef.current = true;
        window.setTimeout(() => tryStartAutoMergeRef.current(), AUTO_MERGE_NULL_BACKUP_MS);
        window.setTimeout(() => {
          tryStartAutoMergeRef.current();
          autoMergeNullBackupWaveArmedRef.current = false;
        }, AUTO_MERGE_NULL_BACKUP_MS * 2);
      }
      return;
    }
    autoMergeNullBackupWaveArmedRef.current = false;
    const graceRemain = autoMergeSeedGraceRemainMsForPair(pair.sourceIdx, pair.targetIdx, now, landMap);
    if (graceRemain > 0) {
      scheduleAutoMergeRecheck(graceRemain);
      return;
    }
    const ok =
      hexBoardRef.current?.beginProgrammaticMerge(pair.sourceIdx, pair.targetIdx, snap) ?? false;
    if (!ok) scheduleAutoMergeRecheck(280);
  }, [
    autoMergeSetting,
    isLoading,
    activeFtueStage,
    ftue11StartQueued,
    pauseMenuOpen,
    offlineEarningsUi?.open,
    showFakeAd,
    purchaseSuccessfulUi,
    limitedOfferPopup?.isVisible,
    plantInfoPopup?.isVisible,
    activeScreen,
    dragState,
    goalPlantTypes,
    goalSlots,
    goalCounts,
    scheduleAutoMergeRecheck,
  ]);

  useEffect(() => {
    tryStartAutoMergeRef.current = tryStartAutoMerge;
  }, [tryStartAutoMerge]);

  useEffect(() => {
    scheduleAutoMergeRecheckRef.current = scheduleAutoMergeRecheck;
  }, [scheduleAutoMergeRecheck]);

  /** When open orders change the merge-result cap, retry (e.g. goal completed → can merge higher again). */
  useEffect(() => {
    const cap = getActiveOrderMergeResultCap(goalPlantTypes, goalSlots, goalCounts);
    if (prevAutoMergeCapRef.current === cap) return;
    prevAutoMergeCapRef.current = cap;
    if (!autoMergeSetting || !getAutoMergeMode()) return;
    if (pauseMenuOpen || isLoading) return;
    scheduleAutoMergeRecheck(0);
  }, [goalPlantTypes, goalSlots, goalCounts, autoMergeSetting, pauseMenuOpen, isLoading, scheduleAutoMergeRecheck]);

  useEffect(() => {
    if (!autoMergeSetting) return;
    const id = window.setInterval(() => tryStartAutoMergeRef.current(), AUTO_MERGE_POLL_MS);
    return () => clearInterval(id);
  }, [autoMergeSetting, activeFtueStage, isLoading, activeScreen, pauseMenuOpen]);

  /** Any grid mutation re-arms a merge attempt (debounced) so we never “miss” a pair after merges/seeds settle. */
  useEffect(() => {
    if (!autoMergeSetting || !getAutoMergeMode()) return;
    if (isLoading) return;
    const id = window.setTimeout(() => tryStartAutoMergeRef.current(), 400);
    return () => window.clearTimeout(id);
  }, [grid, autoMergeSetting, isLoading]);

  /** Cancel delayed rechecks while Settings is open; when it closes (or load finishes), try once so merges can start. */
  useEffect(() => {
    if (isLoading) return;
    if (pauseMenuOpen) {
      clearAutoMergeRecheckTimeout();
      return;
    }
    if (!autoMergeSetting || !getAutoMergeMode()) return;
    scheduleAutoMergeRecheck(0);
  }, [pauseMenuOpen, autoMergeSetting, isLoading, clearAutoMergeRecheckTimeout, scheduleAutoMergeRecheck]);

  useEffect(() => () => clearAutoMergeRecheckTimeout(), [clearAutoMergeRecheckTimeout]);

  const onProgrammaticMergeSettled = useCallback(() => {
    // Full-board scan after settle; extra delayed tries drain multiple same-tier merges (e.g. two L1+L1 before L2+L2).
    scheduleAutoMergeRecheck(AUTO_MERGE_POST_SETTLE_MS);
    window.setTimeout(() => tryStartAutoMergeRef.current(), AUTO_MERGE_POST_MERGE_FOLLOWUP_MS);
    window.setTimeout(() => tryStartAutoMergeRef.current(), AUTO_MERGE_POST_MERGE_FOLLOWUP_MS + 280);
    window.setTimeout(() => tryStartAutoMergeRef.current(), AUTO_MERGE_POST_MERGE_FOLLOWUP_MS + 600);
  }, [scheduleAutoMergeRecheck]);

  // Swap plants when dropping on a non-mergeable plant
  const handleSwap = useCallback((sourceIdx: number, targetIdx: number) => {
    setGrid(prev => {
      const newGrid = [...prev];
      const sourceCell = newGrid[sourceIdx];
      const targetCell = newGrid[targetIdx];
      if (!sourceCell.item || !targetCell.item) return prev;
      // Swap the items
      const tempItem = sourceCell.item;
      newGrid[sourceIdx] = { ...sourceCell, item: targetCell.item };
      newGrid[targetIdx] = { ...targetCell, item: tempItem };
      return newGrid;
    });
  }, []);

  const getScreenIndex = () => {
    switch (activeScreen) {
      case 'STORE': return 0;
      case 'FARM': return 1;
      case 'BARN': return 2;
      default: return 1;
    }
  };

  const screenTranslateX = `translateX(-${(getScreenIndex() * 100) / 3}%)`;

  /** Apply saved game + offline sim; returns total offline coin payout pending (not wallet). */
  const hydrateFromSave = useCallback((save: GameSaveV1) => {
    const cropsNorm: Record<string, UpgradeState> = { ...save.cropsState };
    if (!cropsNorm.wild_growth) cropsNorm.wild_growth = { level: 0, progress: 0 };

    setMoney(save.money);
    setSeedsState(save.seedsState);
    setHarvestState(save.harvestState);
    setCropsState(cropsNorm);
    setSeedsInStorage(save.seedsInStorage);
    setHighestPlantEver(save.highestPlantEver);
    highestPlantEverRef.current = save.highestPlantEver;
    setPlayerLevel(save.playerLevel);
    setPlayerLevelProgress(save.playerLevelProgress);
    setPlantMasteryGoalsCompleted(save.plantMasteryGoalsCompleted ?? 0);
    setPlantMastery({
      ordersProgress: save.plantMasteryOrdersProgress,
      targetLevel: save.plantMasteryTargetLevel,
      unlockPending: [...save.plantMasteryUnlockPending],
      unlockedLevels: [...save.plantMasteryUnlockedLevels],
    });
    setActiveTab(save.activeTab);
    setRewardedOffers(save.rewardedOffers.filter((o) => !isStorePremiumOnlyOfferId(o.id)));
    setBarnNotification(save.barnNotification);
    setGoalSlots(save.goalSlots);
    setGoalPlantTypes(save.goalPlantTypes);
    setGoalLoadingSeconds(save.goalLoadingSeconds);
    setGoalCounts(save.goalCounts);
    setGoalAmountsRequired(save.goalAmountsRequired);
    setGoalCompletedValues(save.goalCompletedValues);
    setGoalDisplayOrder(save.goalDisplayOrder);
    setCoinGoalVisible(save.coinGoalVisible);
    setCoinGoalValue(save.coinGoalValue);
    setCoinGoalTimeRemaining(save.coinGoalTimeRemaining);
    newGoalsSinceDiscoveryRef.current = save.newGoalsSinceDiscovery;
    lastMergeDiscoveryLevelRef.current = save.lastMergeDiscoveryLevel;
    lastSpawnedGoalLevelsRef.current = [...save.lastSpawnedGoalLevels] as [number, number];
    setActiveFtueStage(save.activeFtueStage);
    setFtue2SeedFireCount(save.ftue2SeedFireCount);
    setFtue2FadingOut(save.ftue2FadingOut);
    setFtue3FadingOut(save.ftue3FadingOut);
    setFtue4Pending(save.ftue4Pending);
    setFtue4FadingOut(save.ftue4FadingOut);
    setFtue7Scheduled(save.ftue7Scheduled);
    setFtue7UnrevealedSlots(save.ftue7UnrevealedSlots);
    setFtue7RevealMode(save.ftue7RevealMode);
    setFtue7SeedFireCount(save.ftue7SeedFireCount);
    setFtue7FadingOut(save.ftue7FadingOut);
    setFtue8FadingOut(save.ftue8FadingOut);
    setFtue9CollectedCount(save.ftue9CollectedCount);
    setFtue9FadingOut(save.ftue9FadingOut);
    setFtue10Phase(save.ftue10Phase);
    setFtue10GreenFlashUpgradeId(save.ftue10GreenFlashUpgradeId);
    setFtue10FadingOut(save.ftue10FadingOut);
    setFtueSeedSurplusActivated(save.ftueSeedSurplusActivated);
    setFtueHarvestSurplusActivated(save.ftueHarvestSurplusActivated);
    setFtue10PostClosePending(save.ftue10PostClosePending);
    setFtue10ButtonsNormalEarly(save.ftue10ButtonsNormalEarly);
    setFtue11StartQueued(save.ftue11StartQueued);
    setFtueUpgradePanelVisible(save.ftueUpgradePanelVisible);
    setFtuePlayerLevelVisible(save.ftuePlayerLevelVisible);
    const now = Date.now();
    setActiveBoosts(normalizeActiveBoostsAfterLoad(save.activeBoosts.filter((b) => b.endTime > now)));
    setPendingUnlockUpgradeId(
      save.pendingUnlockUpgradeId === 'fertile_soil' ? 'wild_growth' : save.pendingUnlockUpgradeId
    );
    setLevelUpPopupQueue(save.levelUpPopupQueue);

    seedProgressRef.current = save.seedProgress;
    setSeedProgress(save.seedProgress);
    harvestProgressRef.current = save.harvestProgress;
    setHarvestProgress(save.harvestProgress);
    harvestChargesRef.current = save.harvestCharges;
    setHarvestCharges(save.harvestCharges);

    const elapsed = Math.max(0, Date.now() - save.savedAt);
    const ftueBlocksOffline = isOfflineCoinEarningsBlockedByFtue(save);
    const sim = simulateOfflineSeedHarvest({
      savedAt: save.savedAt,
      deltaMs: elapsed,
      seedProgress: save.seedProgress,
      harvestProgress: save.harvestProgress,
      harvestCharges: save.harvestCharges,
      seedsInStorage: save.seedsInStorage,
      seedsState: save.seedsState,
      cropsState: cropsNorm,
      activeBoosts: save.activeBoosts.map((b) => ({ offerId: b.offerId, endTime: b.endTime, icon: b.icon })),
      activeFtueStage: save.activeFtueStage,
      ftue7Scheduled: save.ftue7Scheduled,
      ftueSeedSurplusActivated: save.ftueSeedSurplusActivated,
      ftueHarvestSurplusActivated: save.ftueHarvestSurplusActivated,
      highestPlantEver: save.highestPlantEver,
      earnOfflineCoins: !ftueBlocksOffline,
    });
    seedProgressRef.current = sim.seedProgress;
    setSeedProgress(sim.seedProgress);
    harvestProgressRef.current = sim.harvestProgress;
    setHarvestProgress(sim.harvestProgress);
    harvestChargesRef.current = sim.harvestCharges;
    setHarvestCharges(sim.harvestCharges);
    setSeedsInStorage(sim.seedsInStorage);

    const wildOut = simulateWildGrowthOffline({
      deltaMs: elapsed,
      playerLevel: save.playerLevel,
      wildGrowthUpgradeLevel: cropsNorm.wild_growth?.level ?? 0,
      grid: save.grid,
      wildGrowthAccumMs: save.wildGrowthAccumulatorMs ?? 0,
    });
    wildGrowthAccumMsRef.current = wildOut.wildGrowthAccumMs;
    setGrid(wildOut.grid);

    const pendingBank = ftueBlocksOffline ? 0 : (save.pendingOfflineEarnings ?? 0);
    const totalOffline = pendingBank + sim.offlineSurplusCoins;
    pendingOfflineEarningsRef.current = totalOffline;
    return totalOffline;
  }, []);

  const handleQuickResumeHydrate = useCallback(() => {
    const save = loadGameSave();
    if (!save || save.v !== GAME_SAVE_VERSION) return;
    pendingQuickLoadFinishRef.current = true;
    const ftue11Completed =
      save.activeFtueStage === null &&
      save.ftueSeedSurplusActivated === true &&
      save.ftueHarvestSurplusActivated === true;

    // If FTUE 11 wasn't completed, treat this as a fresh run:
    // clear any partial progress save so the user restarts from splash/FTUE welcome.
    if (!ftue11Completed) {
      suppressGameSaveRef.current = true;
      clearGameSave();
      suppressGameSaveRef.current = false;

      ftue11PersistenceEnabledRef.current = false;
      pendingOfflineEarningsRef.current = 0;
      setOfflineEarningsUi(null);
      setActiveFtueStage('welcome');
      setIsExpanded(false);
      setActiveScreen('FARM');
      return;
    }

    ftue11PersistenceEnabledRef.current = true;
    const totalOffline = hydrateFromSave(save);
    setIsExpanded(false);
    setActiveScreen('FARM');
    if (totalOffline > 0) {
      setOfflineEarningsUi(null);
      setTimeout(() => {
        setOfflineEarningsUi({
          open: true,
          amount: totalOffline,
          showDoubleButton: true,
          rewardBounceKey: 0,
        });
      }, 610);
    } else {
      setOfflineEarningsUi(null);
    }
  }, [hydrateFromSave]);

  // Splash complete OR quick resume black fade complete — fade in gameplay
  const handleLoadComplete = useCallback(() => {
    if (pendingQuickLoadFinishRef.current) {
      pendingQuickLoadFinishRef.current = false;
      setIsLoading(false);
      const fadeInDuration = 340;
      const startTime = Date.now();
      const animate = () => {
        const elapsed = Date.now() - startTime;
        const newOpacity = Math.min(1, elapsed / fadeInDuration);
        setGameOpacity(newOpacity);
        if (elapsed < fadeInDuration) requestAnimationFrame(animate);
        else setGameOpacity(1);
      };
      requestAnimationFrame(animate);
      return;
    }

    const save = loadGameSave();
    if (save && save.v === GAME_SAVE_VERSION) {
      const ftue11Completed =
        save.activeFtueStage === null &&
        save.ftueSeedSurplusActivated === true &&
        save.ftueHarvestSurplusActivated === true;

      if (!ftue11Completed) {
        suppressGameSaveRef.current = true;
        clearGameSave();
        suppressGameSaveRef.current = false;

        ftue11PersistenceEnabledRef.current = false;
        setActiveFtueStage('welcome');
        pendingOfflineEarningsRef.current = 0;
        setOfflineEarningsUi(null);
        setIsExpanded(false);
        setActiveScreen('FARM');
      } else {
        ftue11PersistenceEnabledRef.current = true;
        const totalOffline = hydrateFromSave(save);
        setIsExpanded(false);
        setActiveScreen('FARM');
        if (totalOffline > 0) {
          setOfflineEarningsUi(null);
          setTimeout(() => {
            setOfflineEarningsUi({
              open: true,
              amount: totalOffline,
              showDoubleButton: true,
              rewardBounceKey: 0,
            });
          }, 770);
        } else {
          setOfflineEarningsUi(null);
        }
      }
    } else {
      ftue11PersistenceEnabledRef.current = false;
      setActiveFtueStage('welcome');
      pendingOfflineEarningsRef.current = 0;
      setOfflineEarningsUi(null);
    }

    setIsLoading(false);
    const fadeInDuration = 500;
    const startTime = Date.now();
    const animate = () => {
      const elapsed = Date.now() - startTime;
      const newOpacity = Math.min(1, elapsed / fadeInDuration);
      setGameOpacity(newOpacity);
      if (elapsed < fadeInDuration) {
        requestAnimationFrame(animate);
      } else {
        setGameOpacity(1);
      }
    };
    requestAnimationFrame(animate);
  }, [hydrateFromSave]);

  persistGameSnapshotRef.current = () => {
    if (suppressGameSaveRef.current) return;
    if (!ftue11PersistenceEnabledRef.current) return;
    if (isLoading) return;
    const payload: GameSaveV1 = {
      v: GAME_SAVE_VERSION,
      savedAt: Date.now(),
      pendingOfflineEarnings: pendingOfflineEarningsRef.current,
      money: moneyRef.current,
      grid,
      seedProgress: seedProgressRef.current,
      harvestProgress: harvestProgressRef.current,
      harvestCharges: harvestChargesRef.current,
      seedsState,
      harvestState,
      cropsState,
      seedsInStorage,
      highestPlantEver,
      playerLevel,
      playerLevelProgress,
      plantMasteryGoalsCompleted,
      plantMasteryOrdersProgress: plantMastery.ordersProgress,
      plantMasteryTargetLevel: plantMastery.targetLevel,
      plantMasteryUnlockPending: [...plantMastery.unlockPending],
      plantMasteryUnlockedLevels: [...plantMastery.unlockedLevels],
      activeTab,
      activeScreen,
      isExpanded,
      rewardedOffers,
      barnNotification,
      barnShelvesUnlocked: normalizeBarnShelvesUnlocked(),
      goalSlots,
      goalPlantTypes,
      goalLoadingSeconds,
      goalCounts,
      goalAmountsRequired,
      goalCompletedValues,
      goalDisplayOrder,
      coinGoalVisible,
      coinGoalValue,
      coinGoalTimeRemaining,
      newGoalsSinceDiscovery: newGoalsSinceDiscoveryRef.current,
      lastMergeDiscoveryLevel: lastMergeDiscoveryLevelRef.current,
      lastSpawnedGoalLevels: [...lastSpawnedGoalLevelsRef.current] as [number, number],
      activeFtueStage,
      ftue2SeedFireCount,
      ftue2FadingOut,
      ftue3FadingOut,
      ftue4Pending,
      ftue4FadingOut,
      ftue7Scheduled,
      ftue7UnrevealedSlots,
      ftue7RevealMode,
      ftue7SeedFireCount,
      ftue7FadingOut,
      ftue8FadingOut,
      ftue9CollectedCount,
      ftue9FadingOut,
      ftue10Phase,
      ftue10GreenFlashUpgradeId,
      ftue10FadingOut,
      ftueSeedSurplusActivated,
      ftueHarvestSurplusActivated,
      ftue10PostClosePending,
      ftue10ButtonsNormalEarly,
      ftue11StartQueued,
      ftueUpgradePanelVisible,
      ftuePlayerLevelVisible,
      activeBoosts,
      pendingUnlockUpgradeId,
      levelUpPopupQueue,
      wildGrowthAccumulatorMs: wildGrowthAccumMsRef.current,
    };
    persistGameSave(payload);
  };

  const autoCollectOfflineEarningsForUnload = () => {
    if (!offlineEarningsOpenRef.current) return;
    if (offlineEarningsAutoCollectedRef.current) return;

    // Only trust the pending bank value: collect button immediately sets this to 0.
    // That prevents any chance of double-credit if pagehide happens right after Collect.
    const amtToCollect = pendingOfflineEarningsRef.current;
    if (amtToCollect <= 0) {
      pendingOfflineEarningsRef.current = 0;
      offlinePopupAmountRef.current = 0;
      offlineEarningsAutoCollectedRef.current = true;
      setOfflineEarningsUi(null);
      lastOfflineEarningsClosedAtRef.current = Date.now();
      return;
    }

    pendingOfflineEarningsRef.current = 0;
    offlinePopupAmountRef.current = 0;
    offlineEarningsAutoCollectedRef.current = true;

    // Synchronous update for persistence (pagehide may happen before React re-renders).
    // Offline bank already reflects boosted surplus etc. from sim — no shop Double Coins here.
    const credit = amtToCollect;
    moneyRef.current += credit;
    setMoney((prev) => prev + credit);

    // Prevent "welcome back" popup on next launch.
    setOfflineEarningsUi(null);
    lastOfflineEarningsClosedAtRef.current = Date.now();
  };

  useEffect(() => {
    offlinePopupAmountRef.current = offlineEarningsUi?.amount ?? 0;
  }, [offlineEarningsUi?.amount]);

  /** Persist once when leaving loading screen so quick refresh doesn’t lose a new session. */
  useEffect(() => {
    if (isLoading) return;
    persistGameSnapshotRef.current();
  }, [isLoading]);

  useEffect(() => {
    if (isLoading) return;
    const id = window.setInterval(() => persistGameSnapshotRef.current(), 5000);
    const flush = () => {
      autoCollectOfflineEarningsForUnload();
      persistGameSnapshotRef.current();
    };
    window.addEventListener('pagehide', flush);
    const vis = () => {
      if (document.visibilityState === 'hidden') flush();
    };
    document.addEventListener('visibilitychange', vis);
    return () => {
      clearInterval(id);
      window.removeEventListener('pagehide', flush);
      document.removeEventListener('visibilitychange', vis);
    };
  }, [isLoading]);

  return (
    <ErrorBoundary>
      <>
        <style>{`
          @keyframes ftue11ButtonBigBounce {
            0% { transform: scale(0.9); }
            30% { transform: scale(1.2); }
            55% { transform: scale(0.8); }
            75% { transform: scale(0.95); }
            100% { transform: scale(0.9); }
          }
          @keyframes ftue11ButtonBounce {
            0%, 100% { transform: scale(0.9); }
            50% { transform: scale(1.0); }
          }
        `}</style>
      {/* Loading Screen */}
      {isLoading && (
        <LoadingScreen
          variant={useQuickResumeLoad ? 'quick' : 'splash'}
          onQuickResumeHydrate={useQuickResumeLoad ? handleQuickResumeHydrate : undefined}
          onLoadComplete={handleLoadComplete}
        />
      )}
      <div
        ref={viewportWrapperRef}
        className={`fixed inset-0 flex justify-center bg-[#050608] items-center overflow-hidden`}
        style={{
          opacity: gameOpacity,
          // Keep layout height aligned with appScale (which is based on visualViewport when available).
          // This prevents the whole game from drifting up/down when CSS vh and visualViewport diverge.
          height: viewportHeight,
          minHeight: viewportHeight,
          paddingTop: viewportWidth < mobileBreakpoint ? Math.max(viewportOffsetTop, 50) : 0,
          boxSizing: 'border-box',
        }}
      >
      <div
        className="relative"
        style={{
          // IMPORTANT: transforms don't affect layout size. We size this wrapper to the *scaled* size
          // and absolutely-position the unscaled game inside it, so the page never gets accidental overflow
          // that can cause the "drift up" while resizing.
          width: 448 * appScale,
          height: 796 * appScale,
          flexShrink: 0,
          overflow: 'hidden',
        }}
      >
      <div
        ref={containerRef}
        id="game-container"
        className="absolute left-0 top-0 shadow-[0_0_100px_rgba(0,0,0,0.9)] overflow-hidden flex flex-col select-none font-['Inter'] bg-[#0c0d12]"
        style={{
          width: '448px',
          height: '796px',
          transform: `scale(${appScale})`,
          transformOrigin: 'top left',
        }}
      >
        <div className="flex-grow relative overflow-hidden min-h-0" style={{ zIndex: 10 }}>
          <div 
            className="absolute inset-0 flex transition-transform duration-700 ease-[cubic-bezier(0.16,1,0.3,1)]"
            style={{ transform: screenTranslateX, width: '300%' }}
          >
            <div className="w-1/3 h-full bg-[#5b433c]">
              <StoreScreen
                money={money}
                walletFlashActive={walletFlashActive}
                onAddMoney={(amt) => setMoney(prev => prev + amt)}
                onSettingsClick={() => setPauseMenuOpen(true)}
                onFreeOfferClick={(offerId, slotIndex) => {
                  pendingAdSourceRef.current = 'storeFreeOffer';
                  pendingOfferIdRef.current = offerId;
                  setShowFakeAd(true);
                  setPendingAdComplete(() => () => {
                    setShowFakeAd(false);
                    setStoreSlotCooldownEnds((ends) => {
                      const next: [number, number] = [...ends] as [number, number];
                      next[slotIndex] = Date.now() + 15 * 60 * 1000;
                      return next;
                    });
                  });
                }}
                activeBoosts={activeBoosts}
                activeBoostAreaRef={storeActiveBoostAreaRef}
                headerLeftWrapperRef={storeHeaderLeftWrapperRef}
                onBoostComplete={(id, rect) => {
                  setActiveBoosts((prev) => prev.filter((b) => b.id !== id));
                  if (rect) {
                    setBoostBursts((prev) => [
                      ...prev,
                      {
                        id: `boost-burst-${Date.now()}`,
                        x: rect.left + rect.width / 2,
                        y: rect.top + rect.height / 2,
                        startTime: Date.now(),
                      },
                    ]);
                  }
                }}
                onBoostClick={(boost) => {
                  if (!boost.offerId) return;
                  if (!canOpenLimitedOfferRewardPopup()) return;
                  const state = buildLimitedOfferPopupState(boost.offerId, { activeBoostEndTime: boost.endTime, highestPlantEver });
                  if (state) setLimitedOfferPopup(state);
                }}
                walletRef={storeWalletRef}
                storeFreeOfferSlots={storeFreeOfferSlots}
                storeSlotCooldownEnds={storeSlotCooldownEnds}
                onStoreSlotCooldownEnded={handleStoreSlotCooldownEnded}
                onStoreCoinPurchase={(offerId) => {
                  const config =
                    STORE_COIN_OFFERS.find((c) => c.id === offerId) ??
                    STORE_BUNDLE_OFFERS.find((c) => c.id === offerId);
                  if (!config) return;
                  pendingPurchaseBoostsRef.current = getStorePurchaseBoostGrants(config);
                  setPurchaseSuccessfulUi({
                    headerImageSrc: assetPath(config.headerIcon),
                    rewards: buildPurchaseSuccessRewards(config),
                  });
                }}
              />
            </div>

            <div ref={farmColumnRef} className="w-1/3 h-full flex flex-col relative overflow-hidden grass-texture">
              {/* Grass Detail Overlay */}
              <div className="absolute inset-0 pointer-events-none grass-blades opacity-40 z-[1]"></div>
              {/* 1. Bleed: flat #3d8f38, full column, behind sprite (visible behind upgrade curve) */}
              <div
                className="absolute inset-0 pointer-events-none z-0"
                style={{ background: '#3d8f38' }}
              />
              {/* 2. Background sprite: primary, on top of bleed; center pinned to hex grid; transition matches upgrade panel (700ms, cubic-bezier) */}
              <div className="absolute inset-0 pointer-events-none overflow-hidden z-[5]">
                <img
                  src={assetPath('/assets/background/background_grass.png')}
                  alt=""
                  className="absolute flex-shrink-0 flex-grow-0"
                  style={{
                    left: `${spriteCenter.x}%`,
                    top: `${spriteCenter.y}%`,
                    width: 'auto',
                    height: 'auto',
                    maxWidth: 'none',
                    maxHeight: 'none',
                    objectFit: 'none',
                    transform: 'translate(-50%, -50%) scale(0.65)',
                  }}
                />
              </div>

              {/* 3. Top UI gradient: above grass, below top UI & hex; top pinned; full sprite visible, stretched horizontally */}
              <div
                className="absolute left-0 right-0 top-0 pointer-events-none z-[6] overflow-hidden"
                style={{ height: '280px' }}
              >
                <img
                  src={assetPath('/assets/topui/topui_gradient.png')}
                  alt=""
                  className="block w-full h-full"
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'fill',
                    objectPosition: 'top center',
                  }}
                />
              </div>

              {/* Farm Header - pinned to this screen */}
              <div className="relative z-50 w-full">
                <PageHeader
                  money={money}
                  walletRef={walletRef}
                  walletIconRef={walletIconRef}
                  walletFlashActive={walletFlashActive}
                  walletBurstCount={walletBounceTrigger}
                  onWalletClick={() => setActiveScreen('STORE')}
                  hidePlayerLevel={!ftuePlayerLevelVisible}
                  playerLevel={playerLevel}
                  playerLevelProgress={playerLevelProgress}
                  playerLevelFlashTrigger={playerLevelFlashTrigger}
                  playerLevelGoalsRequired={getGoalsRequiredForLevel(playerLevel)}
                  onXpBoostClick={() => {
                    applyGoalCollectedProgress();
                    setPlayerLevelProgress((prev) => {
                      const next = prev + 1;
                      const goalsRequired = getGoalsRequiredForLevel(playerLevel);
                      if (next >= goalsRequired) {
                        if (!levelUpGuardRef.current) {
                          levelUpGuardRef.current = true;
                          const nextLevel = playerLevel + 1;
                          if (nextLevel <= 10) {
                            setLevelUpPopup({ isVisible: true, level: nextLevel });
                          } else {
                            setPlayerLevel((l) => l + 1);
                            setTimeout(() => { levelUpGuardRef.current = false; }, 0);
                            return 0;
                          }
                          setTimeout(() => { levelUpGuardRef.current = false; }, 0);
                        }
                        return goalsRequired;
                      }
                      return next;
                    });
                    setPlayerLevelFlashTrigger((t) => t + 1);
                  }}
                  onGiftClick={() => {
                    if (!canOpenLimitedOfferRewardPopup()) return;
                    const state = buildLimitedOfferPopupState('seed_storm');
                    if (state) setLimitedOfferPopup(state);
                  }}
                  onPauseClick={() => setPauseMenuOpen(true)}
                  activeBoosts={activeBoosts}
                  activeBoostAreaRef={activeBoostAreaRef}
                  activeBoostMinWidthPx={ACTIVE_BOOST_INDICATOR_SIZE_PX}
                  headerLeftWrapperRef={headerLeftWrapperRef}
                  onBoostComplete={(id, rect) => {
                    setActiveBoosts((prev) => prev.filter((b) => b.id !== id));
                    if (rect) {
                      setBoostBursts((prev) => [
                        ...prev,
                        {
                          id: `boost-burst-${Date.now()}`,
                          x: rect.left + rect.width / 2,
                          y: rect.top + rect.height / 2,
                          startTime: Date.now(),
                        },
                      ]);
                    }
                  }}
                  onBoostClick={(boost) => {
                    if (!boost.offerId) return;
                    if (!canOpenLimitedOfferRewardPopup()) return;
                    const state = buildLimitedOfferPopupState(boost.offerId, { activeBoostEndTime: boost.endTime, highestPlantEver });
                    if (state) setLimitedOfferPopup(state);
                  }}
                />
              </div>

              {/* Goals Area - 5 goals, overlapping, left justified; compact when one completes (slide-over) */}
              <div 
                className="relative w-full z-20 flex-shrink-0 pointer-events-none"
                style={{ height: '85px', marginLeft: 20 }}
              >
                <div 
                  className="absolute left-0 right-0 overflow-hidden"
                  style={{ top: -25, height: 110, paddingTop: 25 }}
                >
                {[0, 1, 2, 3, 4].map((slotIdx) => {
                  const maxGoalSlots = getMaxGoalSlots(playerLevel);
                  const visibleOrder = goalDisplayOrder.filter((i) => goalSlots[i] !== 'empty' && i < maxGoalSlots);
                  const goalDisplayIndex = visibleOrder.indexOf(slotIdx);
                  const state = goalSlots[slotIdx];
                  const isBouncing = goalBounceSlots.includes(slotIdx);
                  const isFtue4Bounce = activeFtueStage === 'first_goal' && slotIdx === 0 && !ftue4FadingOut;
                  const isTransitioning = goalTransitionSlot === slotIdx;
                  const isLoadingState = state === 'loading';
                  const isGreenState = state === 'green';
                  const isCompletedState = state === 'completed';
                  const isEmpty = state === 'empty';
                  const isFadingIn = slotIdx === goalSlotFadeInSlot;
                  const isFtue7RevealNoSlide = ftue7RevealMode && (slotIdx === 0 || slotIdx === 1);
                  const isFtue7Hidden = ftue7UnrevealedSlots.includes(slotIdx) && slotIdx !== goalSlotFadeInSlot;
                  const isSlidingUp = goalSlidingUpSlots.has(slotIdx);
                  const showSlot = !ftueHideGoals && (!isEmpty || isTransitioning || isCompletedState);
                  const loadingOpacity = isLoadingState ? (goalTransitionFade ? 0 : 1) : isTransitioning ? (goalTransitionFade ? 0 : 1) : 0;
                  const greenOpacity = isGreenState ? 1 : isTransitioning ? (goalTransitionFade ? 1 : 0) : 0;
                  const showGreenContent = isGreenState || (isTransitioning && goalTransitionFade);
                  const showCompletedContent = isCompletedState;
                  const showLoadingText = isLoadingState && !goalTransitionFade;
                  const handleCompletedTap = () => {
                    if (!isCompletedState || isSlidingUp) return;
                    if (slotIdx === 0 && activeFtueStage === 'first_goal_collect') {
                      setActiveFtueStage(null);
                      ftue7SkipLoadingSlot0Ref.current = true;
                      setFtue7Scheduled(true);
                      setActivePlantPanels((prev) => prev.filter((p) => p.goalSlotIdx !== 0 && p.goalSlotIdx !== 1));
                    }
                    if (activeFtueStage === 'first_collect_both') {
                      setFtue9CollectedCount((c) => {
                        const next = c + 1;
                        if (next >= 2) setFtue9FadingOut(true);
                        return next;
                      });
                    }
                    setGoalSlidingUpSlots((prev) => new Set(prev).add(slotIdx));
                    const iconEl = goalIconRefs[slotIdx]?.current;
                    const container = containerRef.current;
                    if (iconEl && container) {
                      const r = iconEl.getBoundingClientRect();
                      const cr = container.getBoundingClientRect();
                      const startX = (r.left + r.width / 2 - cr.left) / appScale;
                      const startY = (r.top + r.height / 2 - cr.top) / appScale;
                      const baseValue = goalCompletedValues[slotIdx] ?? 0;
                      const preDouble = baseValue * (activeBoosts.some(b => b.offerId === 'happiest_customers') ? 2 : 1);
                      const value = applyDoubleCoinsVisualAmount(preDouble, activeBoostsRef.current);
                      setActiveGoalCoinParticles((prev) => [...prev, { id: `goal-coin-${slotIdx}-${Date.now()}`, startX, startY, value }]);
                      applyGoalCollectedProgress();
                      // Player level: +1 progress on tap (not when coins hit wallet). Goals required = 2^level (2, 4, 8, ...)
                      setPlayerLevelProgress((prev) => {
                        const next = prev + 1;
                        const goalsRequired = getGoalsRequiredForLevel(playerLevel);
                        if (next >= goalsRequired) {
                          if (!levelUpGuardRef.current) {
                            levelUpGuardRef.current = true;
                            const nextLevel = playerLevel + 1;
                            if (nextLevel <= 10) {
                              setLevelUpPopup({ isVisible: true, level: nextLevel });
                            } else {
                              setPlayerLevel((l) => l + 1);
                              setTimeout(() => { levelUpGuardRef.current = false; }, 0);
                              return 0;
                            }
                            setTimeout(() => { levelUpGuardRef.current = false; }, 0);
                          }
                          return goalsRequired; // Stay at 100% until Unlock Now clicked
                        }
                        return next;
                      });
                      setPlayerLevelFlashTrigger((t) => t + 1);
                      if (!getPerformanceMode()) {
                        setGoalCoinLeafBursts((prev) => [...prev, {
                          id: `goal-coin-lb-${nextGoalCoinBurstIdRef.current++}`,
                          x: r.left + r.width / 2,
                          y: r.top + r.height / 2 + 30,
                          startTime: Date.now(),
                        }]);
                      }
                    }
                    setTimeout(() => {
                      const displayOrderBefore = goalDisplayOrder.filter((i) => goalSlots[i] !== 'empty');
                      const completedPosition = displayOrderBefore.indexOf(slotIdx);
                      const oldDisplayIndices = [0, 1, 2, 3, 4].map((i) => {
                        const p = displayOrderBefore.indexOf(i);
                        return p >= 0 ? p : -1;
                      });
                      const numSlidingGoals = displayOrderBefore.filter((_, pos) => pos > completedPosition).length;
                      const slideDurationMs = 350;
                      const staggerMs = 75;
                      const totalSlideMs = slideDurationMs + Math.max(0, numSlidingGoals - 1) * staggerMs;

                      setGoalSlots((s) => { const n = [...s]; n[slotIdx] = 'empty'; return n; });
                      setGoalPlantTypes((p) => { const n = [...p]; n[slotIdx] = 0; return n; });
                      setGoalCompletedValues((v) => { const n = [...v]; n[slotIdx] = 0; return n; });
                      setGoalSlidingUpSlots((prev) => { const next = new Set(prev); next.delete(slotIdx); return next; });
                      setGoalDisplayOrder((prev) => prev.filter((i) => i !== slotIdx));
                      setGoalCompactionStagger((prev) => ({
                        completedSlotIdx: slotIdx,
                        completedPosition,
                        oldDisplayIndices,
                        isOverlapping: prev !== null,
                      }));

                      setTimeout(() => {
                        setGoalCompactionStagger(null);
                        const maxSlots = getMaxGoalSlots(playerLevel);
                        setGoalSlots((s) => {
                          if (ftue9NoNewGoalsRef.current) return s; // FTUE 9: no new goal loading; keep slot empty
                          const hasLoading = s.some((state) => state === 'loading');
                          if (hasLoading) return s;
                          const n = [...s];
                          if (n[slotIdx] === 'empty' && slotIdx < maxSlots) {
                            if (slotIdx === 0 && ftue7SkipLoadingSlot0Ref.current) return s; // FTUE 7 spawns slot 0 & 1 at 1s/1.2s
                            n[slotIdx] = 'loading';
                            setGoalDisplayOrder((prev) => (prev.includes(slotIdx) ? prev : [...prev, slotIdx]));
                            setGoalSlotFadeInSlot(slotIdx);
                            setGoalLoadingSeconds(getGoalLoadingSeconds(harvestState));
                            setTimeout(() => setGoalSlotFadeInSlot(null), 500);
                            return n;
                          }
                          return s;
                        });
                      }, totalSlideMs);
                    }, 500);
                  };
                  const SLOT_STEP_PX = 75;
                  const slideDelayMs = goalCompactionStagger && goalCompactionStagger.oldDisplayIndices[slotIdx] > goalCompactionStagger.completedPosition
                    ? (goalCompactionStagger.isOverlapping ? 0 : (goalCompactionStagger.oldDisplayIndices[slotIdx] - goalCompactionStagger.completedPosition - 1) * 75)
                    : 0;
                  return (
                    <div
                      key={slotIdx}
                      id={slotIdx === 0 ? 'goal-slot-0' : slotIdx === 1 ? 'goal-slot-1' : undefined}
                      className={`absolute ${(isFadingIn || isFtue7RevealNoSlide || goalSpawnBounceSlots.includes(slotIdx)) ? 'goal-no-transition' : 'goal-slide-over'} ${isFtue4Bounce ? 'goal-bounce-ftue4' : (isBouncing || goalSpawnBounceSlots.includes(slotIdx)) && !isFadingIn ? 'goal-bounce' : ''} ${isFadingIn && (isBouncing || goalSpawnBounceSlots.includes(slotIdx)) ? 'goal-slot-fade-in-with-bounce' : isFadingIn ? 'goal-slot-fade-in' : ''} ${isSlidingUp ? 'goal-slide-up' : ''} ${showCompletedContent ? 'pointer-events-auto cursor-pointer' : 'pointer-events-none'}`}
                      style={{
                        width: '105px',
                        height: '210px',
                        marginRight: '-30px',
                        marginTop: '-25px',
                        left: goalDisplayIndex >= 0 ? goalDisplayIndex * SLOT_STEP_PX : -9999,
                        opacity: isFtue7Hidden ? 0 : (isFadingIn ? undefined : (showSlot ? 1 : 0)),
                        visibility: goalDisplayIndex >= 0 ? 'visible' : 'hidden',
                        transitionDelay: slideDelayMs ? `${slideDelayMs}ms` : undefined,
                      }}
                      onClick={showCompletedContent && !isSlidingUp ? handleCompletedTap : undefined}
                    >
                      {showSlot && (
                        <>
                          <img src={assetPath('/assets/goals/goal_shadow.png')} alt="" className="absolute inset-0 w-full h-full object-contain object-top transition-opacity duration-100" style={{ zIndex: 1, opacity: greenOpacity }} />
                          <img src={assetPath('/assets/goals/goal_loading.png')} alt="" className="absolute inset-0 w-full h-full object-contain object-top transition-opacity duration-100" style={{ zIndex: 2, opacity: loadingOpacity }} />
                          <img src={assetPath('/assets/goals/goal_green.png')} alt="" className="absolute inset-0 w-full h-full object-contain object-top transition-opacity duration-100" style={{ zIndex: 3, opacity: greenOpacity }} />
                          <img src={assetPath('/assets/goals/goal_yellow.png')} alt="" className="absolute inset-0 w-full h-full object-contain object-top" style={{ zIndex: 4, opacity: 0 }} />
                          <img src={assetPath('/assets/goals/goal_lightgreen.png')} alt="" className={`absolute inset-0 w-full h-full object-contain object-top ${goalImpactSlots.includes(slotIdx) && !isCompletedState ? 'goal-impact-lightgreen' : ''}`} style={{ zIndex: 5, opacity: goalImpactSlots.includes(slotIdx) && !isCompletedState ? undefined : 0 }} />
                          <img src={assetPath('/assets/goals/goal_cream.png')} alt="" className="absolute inset-0 w-full h-full object-contain object-top" style={{ zIndex: 5, opacity: isCompletedState ? 1 : 0 }} />
                          {showGreenContent && !showCompletedContent && (
                            <>
                              <img ref={goalIconRefs[slotIdx]} src={getGoalIconForPlantLevel(goalPlantTypes[slotIdx] ?? slotIdx + 1)} alt="" className={`absolute left-1/2 object-contain pointer-events-none transition-opacity duration-100 ${(goalImpactSlots.includes(slotIdx) || goalSpawnBounceSlots.includes(slotIdx)) ? 'goal-icon-bounce' : ''}`} style={{ zIndex: 6, bottom: '71%', width: 40, height: 40, opacity: greenOpacity, transform: 'translate(-50%, -2px)' }} />
                              <span className="absolute left-1/2 font-bold pointer-events-none transition-opacity duration-100" style={{ zIndex: 6, bottom: '62%', color: goalImpactSlots.includes(slotIdx) ? '#537b38' : '#a1b54e', fontSize: '15px', opacity: greenOpacity, transform: 'translate(-50%, -1px)' }}>{goalCounts[slotIdx]}</span>
                            </>
                          )}
                          {showCompletedContent && (
                            <>
                              <img ref={goalIconRefs[slotIdx]} src={assetPath('/assets/icons/icon_coin.png')} alt="" className={`absolute left-1/2 object-contain pointer-events-none ${isBouncing ? 'goal-icon-bounce' : ''}`} style={{ zIndex: 6, bottom: '71%', width: 40, height: 40, transform: 'translate(-50%, -2px)' }} />
                              <span className="absolute left-1/2 font-bold pointer-events-none" style={{ zIndex: 6, bottom: '62%', color: '#c99959', fontSize: '15px', transform: 'translate(-50%, -1px)' }}>{formatCompactNumber(applyDoubleCoinsVisualAmount((goalCompletedValues[slotIdx] ?? 0) * (activeBoosts.some(b => b.offerId === 'happiest_customers') ? 2 : 1), activeBoosts))}</span>
                            </>
                          )}
                          {showLoadingText && (
                            <span className="absolute left-1/2 font-bold pointer-events-none" style={{ zIndex: 6, bottom: '64%', color: '#fff4d0', fontSize: '13px', transform: 'translate(-50%, -1px)', opacity: 0.75 }}>{goalLoadingSeconds}s</span>
                          )}
                        </>
                      )}
                    </div>
                  );
                })}
                {/* Coin goal: always 5th slot (index 4), yellow bg, 30s radial, tap → fake ad → explode to wallet */}
                {coinGoalVisible && playerLevel >= 2 && !ftueHideGoals && (
                  <div
                    className={`absolute goal-slide-over pointer-events-auto cursor-pointer ${coinGoalBounce ? 'goal-bounce' : ''}`}
                    style={{
                      width: '105px',
                      height: '210px',
                      marginRight: '-30px',
                      marginTop: '-25px',
                      left: 4 * 75,
                      zIndex: 10,
                    }}
                    onClick={() => {
                      if (showFakeAd) return;
                      pendingAdSourceRef.current = 'coinGoal';
                      setShowFakeAd(true);
                      setPendingAdComplete(() => () => {
                        pendingAdSourceRef.current = null;
                        const happiestActive = activeBoostsRef.current.some(b => b.offerId === 'happiest_customers');
                        const effectiveValue = coinGoalValue * (happiestActive ? 2 : 1);
                        const iconEl = coinGoalIconRef.current;
                        const container = containerRef.current;
                        if (iconEl && container) {
                          const r = iconEl.getBoundingClientRect();
                          const cr = container.getBoundingClientRect();
                          const startX = (r.left + r.width / 2 - cr.left) / appScale;
                          const startY = (r.top + r.height / 2 - cr.top) / appScale;
                          if (!getPerformanceMode()) {
                            setGoalCoinLeafBursts((prev) => [...prev, {
                              id: `goal-coin-lb-${nextGoalCoinBurstIdRef.current++}`,
                              x: r.left + r.width / 2,
                              y: r.top + r.height / 2 + 30,
                              startTime: Date.now(),
                            }]);
                          }
                          setActiveGoalCoinParticles((prev) => [
                            ...prev,
                            {
                              id: `coin-goal-${Date.now()}`,
                              startX,
                              startY,
                              value: effectiveValue,
                              skipHappyCustomerRoll: true,
                              skipDoubleCoinsMultiplier: true,
                            },
                          ]);
                        }
                        lastCoinGoalHiddenAtRef.current = Date.now();
                        nextCoinGoalDelayRef.current = 30000 + Math.random() * 30000;
                        setCoinGoalVisible(false);
                        setCoinGoalTimeRemaining(30);
                      });
                    }}
                  >
                    <img src={assetPath('/assets/goals/goal_shadow.png')} alt="" className="absolute inset-0 w-full h-full object-contain object-top" style={{ zIndex: 1, opacity: 0.4 }} />
                    <img src={assetPath('/assets/goals/goal_yellow.png')} alt="" className="absolute inset-0 w-full h-full object-contain object-top" style={{ zIndex: 2 }} />
                    <div className="absolute left-1/2 pointer-events-none" style={{ zIndex: 6, bottom: '70%', width: 42, height: 42, transform: 'translate(-50%, -1px)' }}>
                      <svg width="42" height="42" viewBox="0 0 42 42" className="absolute left-0 top-0 block" style={{ transform: 'rotate(-90deg)' }}>
                        <circle cx="21" cy="21" r="20" fill="transparent" stroke="#ea9940" strokeWidth="2.5" />
                        <circle
                          cx="21"
                          cy="21"
                          r="20"
                          fill="transparent"
                          stroke="#c77d34"
                          strokeWidth="2.5"
                          strokeLinecap="round"
                          strokeDasharray={2 * Math.PI * 20}
                          style={{ strokeDashoffset: 2 * Math.PI * 20 * (1 - Math.max(0, coinGoalTimeRemaining) / 30), transition: 'stroke-dashoffset 0.2s linear' }}
                        />
                      </svg>
                      <img ref={coinGoalIconRef} src={assetPath('/assets/icons/icon_coin_watchad.png')} alt="" className="object-contain absolute z-[1]" style={{ left: 1, top: 1, width: 40, height: 40, pointerEvents: 'none' }} />
                    </div>
                    <span className="absolute left-1/2 font-bold pointer-events-none" style={{ zIndex: 6, bottom: '62%', color: '#c77d34', fontSize: '13px', transform: 'translate(-50%, -1px)' }}>{formatCompactNumber(coinGoalValue * (activeBoosts.some(b => b.offerId === 'happiest_customers') ? 2 : 1))}</span>
                  </div>
                )}
                </div>
              </div>

              <div 
                ref={hexAreaRef}
                className="relative flex-grow flex flex-col items-center justify-center overflow-visible z-10"
              >
                {/* Only tapping this backdrop (background) closes the panel; hex cells and plants do not */}
                <div
                  className="absolute inset-0 z-0 cursor-pointer"
                  style={{ touchAction: 'manipulation' }}
                  onClick={() => setIsExpanded(false)}
                  aria-label="Close upgrade panel"
                />
                <div 
                  className="absolute bottom-4 w-full px-3 flex justify-between items-end z-20 pointer-events-none transition-all"
                  style={{ 
                    transitionDuration: isExpanded ? '1400ms' : '350ms',
                    transitionTimingFunction: isExpanded ? 'cubic-bezier(0.05, 0, 0, 1)' : 'cubic-bezier(0.22, 0, 0.12, 1)',
                  }}
                >
                   <div
                     className="pointer-events-auto flex items-center justify-center"
                     ref={plantButtonRef}
                     style={{
                       transformOrigin: 'center center',
                       ...(ftue10BigBounceActive
                         ? { animation: 'ftue11ButtonBigBounce 500ms ease-in-out 1' }
                         : (activeFtueStage === 'recharge_pre_upgrade' && ftue95ShowTextbox && !ftue95FadingOut)
                         ? { animation: 'ftue11ButtonBounce 2s ease-in-out infinite' }
                         : { transform: 'scale(0.9)' }),
                       ...(ftueHideSeedsButton && { visibility: 'hidden' as const, pointerEvents: 'none' as const }),
                       ...(activeFtueStage === 'merge_drag' && { pointerEvents: 'none' as const }),
                     }}
                     onClick={(e) => e.stopPropagation()}
                   >
<SideAction
                        label="Plant"
                        icon={assetPath(`/assets/plants/plant_${seedLevel}.png`)}
                        iconNode={<PlantWithPot level={seedLevel} mastered={plantMastery.unlockedLevels.includes(seedLevel)} wrapperClassName="h-full w-full" />}
                        iconScale={1.35}
                        iconOffsetY={-1}
                        progress={seedsFreeMode ? 0 : Math.max(0, Math.min(1, seedProgress / 100))}
                        progressRef={seedProgressRef}
                        color="#a7c957"
                        isActive={activeTab === 'SEEDS' && isExpanded}
                        isFlashing={seedsFreeMode ? (ftue7Scheduled ? false : (activeFtueStage === 'first_more_orders' ? (ftue7SeedFireCount >= 2 ? false : true) : (ftue2SeedFireCount >= 2 ? false : true))) : seedsInStorage > 0}
                        shouldAnimate={!isGridFull}
                        isBoardFull={isGridFull}
                        storageCount={seedsInStorage}
                        storageMax={seedStorageMax}
                        freeMode={seedsFreeMode}
                        bounceTrigger={seedBounceTrigger}
                        onClick={handlePlantClick}
                      />
                   </div>
                   <div
                     className="pointer-events-auto flex items-center justify-center"
                     ref={harvestButtonRef}
                     style={{
                       transformOrigin: 'center center',
                       ...(ftue10BigBounceActive
                         ? { animation: 'ftue11ButtonBigBounce 500ms ease-in-out 1' }
                         : (activeFtueStage === 'recharge_pre_upgrade' && ftue95ShowTextbox && !ftue95FadingOut)
                         ? { animation: 'ftue11ButtonBounce 2s ease-in-out infinite' }
                         : { transform: 'scale(0.9)' }),
                       ...(ftueHideHarvestButton && { visibility: 'hidden' as const, pointerEvents: 'none' as const }),
                     }}
                     onClick={(e) => e.stopPropagation()}
                   >
                     <SideAction 
                        label="Harvest" 
                        icon={assetPath('/assets/icons/icon_harvest.png')} 
                        progress={harvestFreeMode ? 0 : harvestProgress / 100}
                        progressRef={harvestProgressRef}
                        color="#a7c957"
                        isActive={activeTab === 'HARVEST' && isExpanded}
                        isFlashing={harvestFreeMode ? (activeFtueStage === 'first_harvest' || activeFtueStage === 'first_harvest_multi') : harvestCharges > 0}
                        shouldAnimate={true}
                        isBoardFull={false}
                        noRotateOnFlash={true}
                        storageCount={harvestCharges}
                        storageMax={HARVEST_CHARGES_MAX}
                        freeMode={harvestFreeMode}
                        bounceTrigger={harvestBounceTrigger}
                        iconScale={1.275}
                        onClick={handleHarvestClick}
                      />
                   </div>
                </div>

                {/* Reduced height from 340px to 323px (5% smaller); pointer-events-none so taps on background close upgrade panel */}
                <div className="relative w-full flex items-center justify-center h-[323px] overflow-visible pointer-events-none" style={{ marginBottom: '35px' }}>
                  <HexBoard
                    ref={hexBoardRef}
                    isActive={activeTab === 'CROPS' && isExpanded}
                    grid={grid}
                    onMerge={handleMerge}
                    onSwap={handleSwap}
                    impactCellIdx={impactCellIdx}
                    returnImpactCellIdx={returnImpactCellIdx}
                    onReturnImpact={(idx) => {
                      setReturnImpactCellIdx(idx);
                      if (idx != null) setTimeout(() => setReturnImpactCellIdx(null), 100);
                    }}
                    onLandOnNewCell={(targetIdx) => {
                      setNewCellImpactIdx(targetIdx);
                      setTimeout(() => setNewCellImpactIdx(null), 300);
                    }}
                    onReleaseFromCell={(cellIdx) => {
                      setSourceCellFadeOutIdx(cellIdx);
                      setTimeout(() => setSourceCellFadeOutIdx(null), 150);
                    }}
                    sourceCellFadeOutIdx={sourceCellFadeOutIdx}
                    newCellImpactIdx={newCellImpactIdx}
                    containerRef={containerRef}
                    dragState={dragState}
                    setDragState={setDragState}
                    harvestBounceCellIndices={harvestBounceCellIndices}
                    getMergeLevelIncrease={getMergeLevelIncrease}
                    onLockedCellTap={ENABLE_LOCKED_CELL_TAP ? handleLockedCellTap : undefined}
                    unlockingCellIndices={unlockingCellIndices}
                    fertilizingCellIndices={fertilizingCellIndices}
                    appScale={appScale}
                    ftue3OnlyMerge4To13={activeFtueStage === 'merge_drag'}
                    masteredPlantLevels={plantMastery.unlockedLevels}
                    onMaxTierMergeAttempt={(staticCellIdx) => {
                      spawnMaxPlantReachedToast(staticCellIdx);
                    }}
                    onProgrammaticMergeSettled={onProgrammaticMergeSettled}
                    onMergeImpactStart={(cellIdx, px, py, mergeResultLevel) => {
                      const container = containerRef.current;
                      if (!container) return;
                      const scale = appScaleRef.current;
                      const rect = container.getBoundingClientRect();
                      if (!getPerformanceMode()) {
                        setLeafBursts((prev) => [
                          ...prev,
                          {
                            id: Math.random().toString(36).slice(2),
                            x: rect.left + px * scale,
                            y: rect.top + py * scale,
                            startTime: Date.now(),
                          },
                        ]);
                      }
                      if (mergeResultLevel != null) {
                        const slotIdx = mergeResultLevel >= 1 && mergeResultLevel <= 24
                          ? (() => {
                              let best = -1;
                              let minRemaining = Infinity;
                              goalPlantTypes.forEach((pt, i) => {
                                if (pt !== mergeResultLevel || goalSlots[i] !== 'green' || (goalCounts[i] ?? 0) <= 0 || goalsPendingCompletionRef.current.has(i)) return;
                                const inFlight = goalInFlightHarvestBySlotRef.current[i] ?? 0;
                                const remaining = (goalCounts[i] ?? 0) - inFlight;
                                if (remaining > 0 && remaining < minRemaining) {
                                  minRemaining = remaining;
                                  best = i;
                                }
                              });
                              return best;
                            })()
                          : -1;
                        const hasGoalForPlant = slotIdx >= 0;
                        /** Merge result cell: 1 crop to goal if any; else coin panel → wallet (base coin value for merged tier). */
                        const harvestAmount = 1;
                        const hexEl = document.getElementById(`hex-${cellIdx}`);
                        const panelHeightPx = 14;
                        const offsetUp = (panelHeightPx / 2 + 4) * 0.4;
                        const hoverX = px;
                        const hoverY = hexEl
                          ? ((hexEl.getBoundingClientRect().top - rect.top) / scale) - offsetUp
                          : py - offsetUp;
                        if (hasGoalForPlant) {
                          goalInFlightHarvestBySlotRef.current[slotIdx] = (goalInFlightHarvestBySlotRef.current[slotIdx] ?? 0) + harvestAmount;
                          if ((goalCounts[slotIdx] ?? 0) - (goalInFlightHarvestBySlotRef.current[slotIdx] ?? 0) <= 0) {
                            goalsPendingCompletionRef.current.add(slotIdx);
                          }
                          const plantLevel = goalPlantTypes[slotIdx] ?? slotIdx + 1;
                          setActivePlantPanels((prev) => [
                            ...prev,
                            {
                              id: `merge-plant-${cellIdx}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
                              goalSlotIdx: slotIdx,
                              iconSrc: getGoalIconForPlantLevel(plantLevel),
                              harvestAmount,
                              startX: px,
                              startY: py,
                              hoverX,
                              hoverY,
                              moveToTargetDelayMs: 0,
                              ...(activeFtueStage === 'first_harvest' ? { visualScale: 2 } : {}),
                            },
                          ]);
                        } else {
                          const cell = grid[cellIdx];
                          let value = getCoinValueForLevel(mergeResultLevel);
                          if (cell?.fertile) value *= 2;
                          value = Math.floor(value);
                          /* Same coin panel + wallet path as surplus harvest; no Surplus Sales multiplier. */
                          value = applyDoubleCoinsVisualAmount(value, activeBoostsRef.current);
                          setActiveCoinPanels((prev) => [
                            ...prev,
                            {
                              id: `merge-${cellIdx}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
                              value,
                              startX: px,
                              startY: py,
                              hoverX,
                              hoverY,
                              moveToWalletDelayMs: 0,
                              scale: MERGE_COIN_HARVEST_PANEL_SCALE,
                            },
                          ]);
                        }
                      }
                    }}
                    onDeletePlant={(cellIdx, px, py) => {
                      const container = containerRef.current;
                      if (!container) return;
                      const scale = appScaleRef.current;
                      const rect = container.getBoundingClientRect();
                      if (!getPerformanceMode()) {
                        setLeafBurstsSmall((prev) => [
                          ...prev,
                          {
                            id: `delete-${cellIdx}-${Date.now()}`,
                            x: rect.left + px * scale,
                            y: rect.top + py * scale,
                            startTime: Date.now(),
                            particleCount: 30,
                            useCircle: true,
                          },
                        ]);
                      }
                      // Remove the plant from the grid
                      setGrid((prev) => {
                        const newGrid = [...prev];
                        newGrid[cellIdx] = { ...newGrid[cellIdx], item: null };
                        return newGrid;
                      });
                    }}
                  />
                </div>
              </div>

              <div 
                onClick={(e) => e.stopPropagation()}
                className="flex flex-col overflow-visible relative z-30 flex-shrink-0 shadow-[0_-15px_50px_rgba(0,0,0,0.15)] rounded-t-[32px]"
                style={{
                  height: panelHeight,
                  minHeight: 0,
                  background: '#fcf0c6',
                  borderTop: '1px solid #ebdbaf',
                  touchAction: 'manipulation',
                  opacity: ftueUpgradePanelVisible ? 1 : 0,
                  pointerEvents: ftueUpgradePanelVisible ? 'auto' : 'none',
                  transition: 'opacity 400ms ease-out',
                }}
              >
                {/* Upgrade panel top UI: inside panel, anchored to its top edge so it moves together with open/close animation and opacity */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsExpanded((prev) => !prev);
                  }}
                  className="pointer-events-auto absolute left-1/2 top-0"
                  style={{
                    transform: 'translate(-50%, -100%)',
                    opacity: ftueUpgradePanelVisible ? 1 : 0,
                    transition: 'opacity 400ms ease-out',
                  }}
                >
                  <div className="relative">
                    <img
                      src={assetPath('/assets/topui/ui_upgradepanel_open.png')}
                      alt=""
                      className="block"
                      style={{ width: 120, height: 'auto' }}
                    />
                    <img
                      src={assetPath('/assets/topui/ui_upgradepanel_arrow.png')}
                      alt=""
                      className="absolute left-1/2 top-1/2"
                      style={{
                        width: 32,
                        height: 'auto',
                        transform: `translate(-50%, -28%) rotate(${isExpanded ? 0 : 180}deg)`,
                        transformOrigin: '50% 50%',
                        transition: 'transform 350ms cubic-bezier(0.05, 0, 0, 1)',
                      }}
                    />
                  </div>
                </button>

                <UpgradeTabs 
                  ref={upgradeTabsRef}
                  activeTab={activeTab} 
                  onTabChange={handleTabChange}
                  tabsWithOffers={tabsWithOffers}
                  isExpanded={isExpanded}
                />
                <div className="flex-grow min-h-0 overflow-hidden relative flex flex-col">
                  <UpgradeList 
                    activeTab={activeTab} 
                    onTabChange={handleTabChange} 
                    money={money} 
                    setMoney={setMoney}
                    seedsState={seedsState}
                    setSeedsState={setSeedsState}
                    harvestState={harvestState}
                    setHarvestState={setHarvestState}
                    cropsState={cropsState}
                    setCropsState={setCropsState}
                    lockedCellCount={lockedCellCount}
                    onUnlockCell={handleUnlockCell}
                    fertilizableCellCount={fertilizableCellCount}
                    onFertilizeCell={handleFertilizeCell}
                    highestPlantEver={highestPlantEver}
                    masteredPlantLevels={plantMastery.unlockedLevels}
                    rewardedOffers={rewardedOffers}
                    playerLevel={playerLevel}
                    pendingUnlockUpgradeId={pendingUnlockUpgradeId}
                    pendingOfferHighlightId={pendingOfferHighlightId}
                    isExpanded={isExpanded}
                    protectedOfferId={limitedOfferPopup?.isVisible && limitedOfferPopup?.offerId ? limitedOfferPopup.offerId : null}
                    ftue10GreenFlashUpgradeId={ftue10GreenFlashUpgradeId}
                    ftue10PurchaseButtonRef={ftue10PurchaseButtonRef}
                    ftue10LockScroll={activeFtueStage === 'first_upgrade' && ftue10Phase === 'finger'}
                    onUpgradePurchase={(upgradeId) => {
                      if (upgradeId === 'harvest_speed' && activeFtueStage === 'first_upgrade') {
                        // FTUE 10: on purchase, bounce Harvest button like a tap.
                        setHarvestBounceTrigger((t) => t + 1);
                        setFtue10Phase(null);
                        setFtue10GreenFlashUpgradeId(null);
                        setFtue10FadingOut(true);
                        // Defer the "return to normal" + seed surplus activation until the upgrade panel has fully closed.
                        setFtue10PostClosePending(true);
                      }
                    }}
                    onRewardedOfferPanelClick={(offerId) => {
                      if (!canOpenLimitedOfferRewardPopup()) return;
                      const state = buildLimitedOfferPopupState(offerId, { highestPlantEver });
                      if (state) setLimitedOfferPopup(state);
                    }}
                    onRewardedOfferClick={(offerId) => {
                      // Tap on Watch Ad button: open fake ad directly (skip popup), grant reward on Activate Reward
                      pendingAdSourceRef.current = 'upgradeList';
                      pendingOfferIdRef.current = offerId;
                      setShowFakeAd(true);
                      setPendingAdComplete(() => () => {
                        setRewardedOffers(prev => prev.filter(o => o.id !== offerId));
                        setShowFakeAd(false);
                        // Apply same offer rewards as limited offer popup path (e.g. Seed Storm)
                        if (offerId === 'seed_storm') {
                          const g = gridRef.current;
                          const reservedCells = new Set(activeProjectilesRef.current.map(p => p.targetIdx));
                          const emptyIndices = g
                            .map((cell, idx) => (cell.item === null && !cell.locked && !reservedCells.has(idx) ? idx : null))
                            .filter((idx): idx is number => idx !== null);
                          emptyIndices.forEach((targetIdx, i) => {
                            setTimeout(() => spawnProjectile(targetIdx, seedLevel), 200 * i);
                          });
                        }
                        // Special Delivery: shoot a seed that spawns/upgrades to high-level plant; beam + bounce on impact
                        if (offerId === 'special_delivery') {
                          const plantLevel = Math.max(1, highestPlantEverRef.current - 1);
                          const g = gridRef.current;
                          const reserved = new Set(activeProjectilesRef.current.map(p => p.targetIdx));
                          const emptyIndices = g.map((c, i) => (!c.locked && c.item === null && !reserved.has(i) ? i : -1)).filter((i): i is number => i !== -1);
                          let targetIdx: number;
                          if (emptyIndices.length > 0) {
                            targetIdx = emptyIndices[Math.floor(Math.random() * emptyIndices.length)];
                          } else {
                            const withPlants = g.map((c, i) => (c.item ? { idx: i, level: c.item.level } : null)).filter((x): x is { idx: number; level: number } => x != null);
                            if (withPlants.length === 0) return;
                            withPlants.sort((a, b) => a.level - b.level);
                            targetIdx = withPlants[0].idx;
                          }
                          spawnProjectile(targetIdx, plantLevel, true, true);
                        }
                        if (offerId && isCoinMultiplierBoostId(offerId)) {
                          setActiveBoosts((prev) =>
                            applyBoostParticleImpact(prev, {
                              id: `boost-ad-${DOUBLE_COINS_OFFER_ID}-${Date.now()}`,
                              startX: 0,
                              startY: 0,
                              offerId: DOUBLE_COINS_OFFER_ID,
                              durationMs: REWARDED_DOUBLE_COINS_AD_DURATION_MS,
                              icon: DOUBLE_COINS_HEADER_ICON,
                            })
                          );
                        }
                      });
                    }}
                  />
                </div>
              </div>
            </div>

            <div className="w-1/3 h-full flex flex-col relative overflow-hidden">
              {/* 1. Bleed: flat barn color, full column, behind sprite */}
              <div
                className="absolute inset-0 pointer-events-none z-0"
                style={{ background: '#5c3d2e' }}
              />

              {/* Barn scrollable area - background and shelves move together */}
              <div 
                ref={barnScrollRef}
                className="absolute inset-0 overflow-hidden cursor-grab active:cursor-grabbing select-none z-10"
              >
                {/* Content container that moves with scroll - fixed width centered, overflow visible for large elements */}
                <div 
                  data-barn-content
                  className="absolute"
                  style={{ 
                    left: '50%',
                    transform: `translateX(-50%) translateY(${-barnScrollY}px) scale(${barnScale})`,
                    transformOrigin: 'top center',
                    width: '420px',
                    minHeight: '150%',
                    overflow: 'visible',
                  }}
                >
                  {/* Background sprite: fixed size, centered behind content */}
                  <div className="absolute pointer-events-none" style={{ zIndex: 0, left: '50%', top: 0, transform: 'translateX(-50%)', overflow: 'visible' }}>
                    <img
                      src={assetPath('/assets/background/background_barn.png')}
                      alt=""
                      style={{
                        width: '2000px',
                        height: 'auto',
                        maxWidth: 'none',
                      }}
                    />
                  </div>

                  {/* Barn roof at the top - fixed pixel size, centered */}
                  <div className="relative pointer-events-none" style={{ zIndex: 1, overflow: 'visible' }}>
                    <img
                      src={assetPath('/assets/barn/barn_roof.png')}
                      alt="Barn Roof"
                      style={{
                        width: '800px',
                        height: 'auto',
                        maxWidth: 'none',
                        position: 'relative',
                        left: '50%',
                        transform: 'translateX(-50%)',
                      }}
                    />
                  </div>

                  {/* Plant mastery panel in the added shelf gap (absolute so it doesn't shift layout). */}
                  <div
                    className="absolute pointer-events-auto"
                    style={{ zIndex: 2, left: '50%', top: 170, transform: 'translateX(-50%)' }}
                  >
                    <div className="relative" style={{ width: '300px' }}>
                      <img
                        src={assetPath('/assets/topui/ui_plantmastery.png')}
                      alt="Plant Collection"
                        style={{
                          width: '300px',
                          height: 'auto',
                          maxWidth: 'none',
                        }}
                      />
                      <div
                        className="absolute inset-0 flex flex-col items-center"
                        style={{ paddingTop: 30, paddingLeft: 14, paddingRight: 14 }}
                      >
                        <h2
                          className="font-black tracking-tight text-center"
                          style={{
                            color: '#5c4a32',
                            fontFamily: 'Inter, sans-serif',
                            fontSize: '28px',
                            lineHeight: 1,
                          }}
                        >
                          Plant Collection
                        </h2>
                        <div className="w-full flex items-center justify-center" style={{ marginTop: 4, marginBottom: 6 }}>
                          <img
                            src={assetPath('/assets/popups/popup_divider.png')}
                            alt=""
                            className="h-auto object-contain"
                            style={{ width: '220px' }}
                          />
                        </div>
                        <p
                          className="font-medium text-center leading-relaxed italic w-full"
                          style={{
                            color: '#c2b280',
                            fontFamily: 'Inter, sans-serif',
                            fontSize: '0.875rem',
                            paddingLeft: 8,
                            paddingRight: 8,
                            marginBottom: 8,
                          }}
                        >
                          Complete orders to unlock golden pots for your plants!
                        </p>
                        {/* Plant mastery: outer bar flat L/R; green fill has curved right “head” */}
                        <div className="flex items-center justify-center gap-0 w-full" style={{ marginTop: 0, marginLeft: -2 }}>
                          <img
                            src={assetPath('/assets/icons/icon_plantmastery.png')}
                            alt=""
                            className="w-[36px] h-[36px] object-contain shrink-0 relative z-20"
                            style={{ marginLeft: 8, marginRight: -8 }}
                            draggable={false}
                          />
                          <div
                            className="relative inline-flex items-center border overflow-hidden"
                            style={{
                              width: '159px',
                              height: 26,
                              backgroundColor: '#775041',
                              borderWidth: 2,
                              borderColor: '#e9dcaf',
                            }}
                          >
                            <div className="flex-1 h-full flex items-stretch relative" style={{ padding: 1.5 }}>
                              <span
                                className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none font-black text-xs leading-none z-10"
                                style={{
                                  color: '#fcf0c7',
                                  WebkitTextStroke: '1px rgba(0,0,0,0.5)',
                                  paintOrder: 'stroke fill',
                                }}
                              >
                                {masteryBarNumerator}/{masterySeg}
                              </span>
                              <div className="w-full h-full overflow-hidden bg-[#775041]">
                                <div
                                  className="relative h-full overflow-hidden"
                                  style={{
                                    width: `${masteryBarFillPct}%`,
                                    transition: 'width 250ms cubic-bezier(0.25, 1, 0.5, 1)',
                                    borderTopRightRadius: 9999,
                                    borderBottomRightRadius: 9999,
                                  }}
                                >
                                  <div
                                    className="w-full h-full overflow-hidden relative"
                                    style={{
                                      padding: 1,
                                      borderTopRightRadius: 9999,
                                      borderBottomRightRadius: 9999,
                                      background: 'linear-gradient(180deg, #d2e894 0%, #8fb33a 100%)',
                                    }}
                                  >
                                    <div
                                      className="h-full w-full"
                                      style={{
                                        borderTopRightRadius: 9999,
                                        borderBottomRightRadius: 9999,
                                        background: 'linear-gradient(180deg, #b8d458 0%, #8fb33a 100%)',
                                      }}
                                    />
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                          <div
                            className="w-[44px] h-[44px] shrink-0 relative z-20"
                            style={{ marginLeft: -13, marginTop: -3 }}
                          >
                            <PlantWithPot
                              level={plantMastery.targetLevel}
                              mastered={plantMastery.unlockedLevels.includes(plantMastery.targetLevel)}
                              wrapperClassName="h-full w-full"
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Shelves: Unlock pill + glow when mastery is pending purchase for that plant */}
                  <div className="relative flex flex-col items-center" style={{ marginTop: 165 }} data-barn-shelves>
                    {Array.from({ length: BARN_SHELF_COUNT }, (_, shelfIndex) => {
                      const startPlant = shelfIndex * 4 + 1;
                      return (
                        <div
                          key={shelfIndex}
                          className="flex-shrink-0 relative"
                          style={{
                            marginTop: shelfIndex === 0 ? 0 : -80,
                            width: '490px',
                          }}
                        >
                          <img
                            src={assetPath('/assets/barn/barn_shelf.png')}
                            alt={`Shelf ${shelfIndex + 1}`}
                            className="pointer-events-none"
                            style={{ width: '100%', height: 'auto' }}
                          />
                          <div
                            className="absolute flex justify-center items-center"
                            style={{
                              left: '50%',
                              transform: 'translateX(-50%)',
                              bottom: '125px',
                              gap: '-10px',
                              zIndex: 10,
                              minHeight: '95px',
                              width: '100%',
                            }}
                          >
                            {[0, 1, 2, 3].map((plantOffset) => {
                              const plantLevel = startPlant + plantOffset;
                              const isPlantDiscovered = plantLevel <= highestPlantEver;
                              const showMasteryUnlock =
                                isPlantDiscovered && plantMastery.unlockPending.includes(plantLevel);
                              const isPendingRevealBounce = barnAttentionBounceLevels.includes(plantLevel);
                              const isMasteryPurchaseBounce = masteryPurchaseRevealLevels.includes(plantLevel);
                              const isAnyShelfBounceActive = isPendingRevealBounce || isMasteryPurchaseBounce;
                              return (
                                <div
                                  key={plantOffset}
                                  data-barn-plant-level={plantLevel}
                                  className={`relative flex items-center justify-center shrink-0 ${
                                    isPlantDiscovered ? 'group cursor-pointer pointer-events-auto' : 'pointer-events-none'
                                  }`}
                                  style={{ width: '95px', height: '95px' }}
                                  role={isPlantDiscovered ? 'button' : undefined}
                                  tabIndex={isPlantDiscovered ? 0 : undefined}
                                  onClick={
                                    isPlantDiscovered
                                      ? (e) => {
                                          e.stopPropagation();
                                          setPlantInfoPopup({ isVisible: true, level: plantLevel });
                                        }
                                      : undefined
                                  }
                                  onKeyDown={
                                    isPlantDiscovered
                                      ? (e) => {
                                          if (e.key === 'Enter' || e.key === ' ') {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            setPlantInfoPopup({ isVisible: true, level: plantLevel });
                                          }
                                        }
                                      : undefined
                                  }
                                >
                                  {showMasteryUnlock && (
                                    <div
                                      className="absolute left-1/2 z-[5] pointer-events-auto"
                                      style={{ top: '100%', transform: 'translateX(-50%)', marginTop: 0 }}
                                    >
                                      <div
                                        style={{
                                          transform: 'scale(0.5)',
                                          transformOrigin: 'top center',
                                        }}
                                      >
                                        <div
                                          className="rounded-full p-[10px]"
                                          style={{ backgroundColor: '#c4ac7f', boxSizing: 'border-box' }}
                                        >
                                          <div
                                            className="rounded-full p-[3px]"
                                            style={{ backgroundColor: '#ad9467', boxSizing: 'border-box' }}
                                          >
                                            <button
                                              type="button"
                                              className="flex w-full min-w-0 select-none items-center justify-center rounded-full font-black shadow-[0_5px_0_#6e8d2d,0_8px_16px_rgba(0,0,0,0.15),inset_0_2px_0_rgba(255,255,255,0.35)] transition-[transform,box-shadow] active:translate-y-[2px] active:shadow-[inset_0_3px_6px_rgba(0,0,0,0.15)]"
                                              style={{
                                                boxSizing: 'border-box',
                                                height: 52,
                                                minWidth: 143,
                                                paddingLeft: 22,
                                                paddingRight: 22,
                                                paddingTop: 0,
                                                paddingBottom: 0,
                                                backgroundColor: '#b8d458',
                                                border: '3px solid #6e8d2d',
                                                color: '#4a6b1e',
                                                fontFamily: 'Inter, sans-serif',
                                                fontSize: 'calc(1.28rem + 2px)',
                                                lineHeight: 1,
                                                textShadow: '0 1px 0 rgba(255,255,255,0.3)',
                                                WebkitTapHighlightColor: 'transparent',
                                              }}
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                setPlantInfoPopup({ isVisible: true, level: plantLevel });
                                              }}
                                            >
                                              Unlock
                                            </button>
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                  )}
                                  <div
                                    className={`relative z-10 flex h-full w-full items-center justify-center ${
                                      isPlantDiscovered
                                        ? (isAnyShelfBounceActive ? 'group-active:scale-95' : 'transition-transform duration-75 group-active:scale-95')
                                        : ''
                                    } ${isPendingRevealBounce ? 'mastery-shed-reveal-bounce' : ''} ${
                                      isMasteryPurchaseBounce ? 'mastery-unlock-purchase-bounce' : ''
                                    }`}
                                  >
                                    <PlantWithPot
                                      level={isPlantDiscovered ? plantLevel : 0}
                                      mastered={isPlantDiscovered && plantMastery.unlockedLevels.includes(plantLevel)}
                                      className={isMasteryPurchaseBounce ? 'mastery-unlock-white-flash' : ''}
                                      wrapperClassName="h-full w-full"
                                      masteryAdditiveGlow={activeScreen === 'BARN' && (showMasteryUnlock || isMasteryPurchaseBounce)}
                                      masteryGlowDelaySec={PLANT_MASTERY_GLOW_ANIM_DELAY_SEC}
                                    />
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Shed Header - overlay on top (no top bar bg, just plant wallet + settings) */}
              <div className="absolute top-0 left-0 right-0 z-50 pointer-events-none">
                <div className="pointer-events-auto">
                  <PageHeader money={money} walletFlashActive={walletFlashActive} plantWallet={{ unlockedCount: highestPlantEver, totalCount: 24 }} hideTopBarBg hideFps onPauseClick={() => setPauseMenuOpen(true)} />
                </div>
              </div>
            </div>
          </div>
        </div>

        <Navbar 
          activeScreen={activeScreen} 
          onScreenChange={(screen) => {
            setActiveScreen(screen);
            if (screen === 'BARN') {
              setBarnNotification(false);
            }
          }} 
          barnButtonRef={barnButtonRef}
          notifications={{
            BARN: barnNotification,
          }}
        />

        {/* Leaf burst: portal to body so never clipped; viewport coords */}
        {(activeScreen === 'FARM' || activeScreen === 'BARN') && createPortal(
          <div className="fixed inset-0 pointer-events-none overflow-visible" style={{ zIndex: 55 }}>
            {maxPlantToasts.map((t) => (
              <div
                key={t.id}
                className="max-plant-toast absolute select-none"
                style={{
                  left: t.x,
                  top: t.y - 26,
                  transform: 'translate(-50%, -50%)',
                  zIndex: 9999,
                  fontFamily: 'Inter, sans-serif',
                  fontWeight: 900,
                  fontSize: '20px',
                  letterSpacing: '-0.02em',
                  color: '#ffffff',
                  textShadow:
                    `0 2px 0 rgba(0,0,0,0.25), ` +
                    `1.5px 0 0 #1f5a2a, ` +
                    `-1.5px 0 0 #1f5a2a, ` +
                    `0 1.5px 0 #1f5a2a, ` +
                    `0 -1.5px 0 #1f5a2a`,
                  whiteSpace: 'nowrap',
                  opacity: 1,
                }}
              >
                Max Plant Reached
              </div>
            ))}
            {leafBursts.map((b) => (
              <LeafBurst
                key={b.id}
                x={b.x}
                y={b.y}
                startTime={b.startTime}
                appScale={appScale}
                onComplete={() => setLeafBursts((prev) => prev.filter((x) => x.id !== b.id))}
              />
            ))}
            {leafBurstsSmall.map((b) => (
              <LeafBurst
                key={b.id}
                x={b.x}
                y={b.y}
                startTime={b.startTime}
                particleCount={b.particleCount ?? LEAF_BURST_SMALL_COUNT}
                useCircle={b.useCircle}
                appScale={appScale}
                onComplete={() => setLeafBurstsSmall((prev) => prev.filter((x) => x.id !== b.id))}
              />
            ))}
            {masteryPurchaseConeBursts.map((b) => (
              <ShelfUnlockConeBurst
                key={b.id}
                x={b.x}
                y={b.y}
                startTime={b.startTime}
                scale={1.35}
                particleCount={26}
                onComplete={() => setMasteryPurchaseConeBursts((prev) => prev.filter((x) => x.id !== b.id))}
              />
            ))}
            {unlockBursts.map((b) => (
              <UnlockBurst
                key={b.id}
                x={b.x}
                y={b.y}
                startTime={b.startTime}
                appScale={appScale}
                onComplete={() => setUnlockBursts((prev) => prev.filter((x) => x.id !== b.id))}
              />
            ))}
            {buttonLeafBursts.map((b) => (
              <ButtonLeafBurst
                key={b.id}
                x={b.x}
                y={b.y}
                startTime={b.startTime}
                appScale={appScale}
                onComplete={() => setButtonLeafBursts((prev) => prev.filter((x) => x.id !== b.id))}
              />
            ))}
            {goalCoinLeafBursts.map((b) => (
              <LeafBurst
                key={b.id}
                x={b.x}
                y={b.y}
                startTime={b.startTime}
                particleCount={LEAF_BURST_BASELINE_COUNT}
                appScale={appScale}
                spriteVariant="gold"
                burstScale={1.25}
                onComplete={() => setGoalCoinLeafBursts((prev) => prev.filter((x) => x.id !== b.id))}
              />
            ))}
            {boostBursts.map((b) => (
              <LeafBurst
                key={b.id}
                x={b.x}
                y={b.y}
                startTime={b.startTime}
                particleCount={LEAF_BURST_SMALL_COUNT}
                appScale={appScale}
                spriteVariant="gold"
                burstScale={0.5}
                useCircle
                onComplete={() => setBoostBursts((prev) => prev.filter((x) => x.id !== b.id))}
              />
            ))}
            {cellHighlightBeams.map((b) => (
              <CellHighlightBeam
                key={b.id}
                x={b.x}
                y={b.y}
                cellWidth={b.cellWidth}
                cellHeight={b.cellHeight}
                startTime={b.startTime}
                showHexSprite={b.showHexSprite}
                sparkleCount={b.sparkleCount}
                sparkleSizeScale={b.sparkleSizeScale}
                sparkleHeightScale={b.sparkleHeightScale}
                onComplete={() => setCellHighlightBeams((prev) => prev.filter((x) => x.id !== b.id))}
              />
            ))}
          </div>,
          document.body
        )}

        {/* FTUE overlays: portal to body, but positioned + scaled to match game-container */}
        {coinPanelPortalRect && createPortal(
          <div
            className="fixed pointer-events-none"
            style={{
              left: coinPanelPortalRect.left,
              top: coinPanelPortalRect.top,
              width: coinPanelPortalRect.width,
              height: coinPanelPortalRect.height,
              transform: `scale(${coinPanelPortalRect.scale})`,
              transformOrigin: 'top left',
              zIndex: 100,
            }}
          >
            {/* FTUE: Welcome (FTUE_1) - only "Lets go!" is clickable */}
            {activeFtueStage === 'welcome' && (
              <FtuePopup
                isVisible={true}
                onClose={() => {
                  setActiveFtueStage('seed_tap');
                  setFtue2SeedFireCount(0);
                  setFtue2FadingOut(false);
                }}
                blockBackdropClick={true}
                header={{ icon: assetPath('/assets/icons/icon_happycustomer.png') }}
                title="Welcome Gardener!"
                showDivider={true}
                description="Lets plant some seeds, grow some crops & make the customers happy"
                button={{ text: "Lets go!" }}
                burstWidth={260}
                burstHeight={320}
                appScale={1}
              />
            )}

            {/* Warning: Out of Space — blocks input; re-shows whenever grid becomes full+unique again */}
            <FtuePopup
              isVisible={outOfSpaceFtueVisible}
              onClose={() => setOutOfSpaceFtueVisible(false)}
              blockBackdropClick={true}
              position="top"
              topOffsetPx={120}
              title="Out of Space"
              showDivider={true}
              description="You can remove plants by dragging them off the garden board"
              button={{ text: 'Thanks!' }}
              burstWidth={260}
              burstHeight={320}
              appScale={1}
            />
            {/* FTUE_2: overlay (hole + finger + text above Seeds button); fade in 1s after FTUE_1, fade out after 2 seeds */}
            {(activeFtueStage === 'seed_tap' || ftue2FadingOut) && (
              <Ftue2Overlay
                buttonRect={seedButtonRect}
                isActive={activeFtueStage === 'seed_tap'}
                isFadingOut={ftue2FadingOut}
                seedFireCount={ftue2SeedFireCount}
                onFadeOutComplete={() => {
                  setFtue2FadingOut(false);
                  /* keep ftue2SeedFireCount at 2 so seeds button stays green through FTUE 3–5 (and 6) */
                }}
              />
            )}
            {/* FTUE_3: finger slides 4→13, textbox "Merge these two plants together"; only valid move is drag 4→13; fades out on merge; hide when New Discovery (plant 2) popup is up */}
            {(activeFtueStage === 'merge_drag' || ftue3FadingOut) && !discoveryPopup && (
              <Ftue3Overlay
                isActive={activeFtueStage === 'merge_drag'}
                isFadingOut={ftue3FadingOut}
                appScale={appScale}
                onFadeOutComplete={() => {
                  setFtue3FadingOut(false);
                  setFtue4Pending(true);
                }}
              />
            )}
            {/* FTUE_4: textbox + "Lets Harvest!" next to goal slot 0; only button tappable; click stops bounce and fades out */}
            {(activeFtueStage === 'first_goal' || ftue4FadingOut) && (
              <Ftue4Overlay
                isActive={activeFtueStage === 'first_goal'}
                isFadingOut={ftue4FadingOut}
                appScale={appScale}
                onLetsHarvest={() => {
                  setGoalBounceSlots((prev) => prev.filter((s) => s !== 0));
                  setFtue4FadingOut(true);
                }}
                onFadeOutComplete={() => {
                  harvestProgressRef.current = 0;
                  setHarvestProgress(0);
                  setActiveFtueStage('first_harvest');
                  setFtue4FadingOut(false);
                }}
              />
            )}
            {/* FTUE_5: harvest visible (free mode); textbox + finger from other side; only harvest tappable; ends when goal slot 0 completed */}
            {(activeFtueStage === 'first_harvest') && (
              <Ftue5Overlay
                buttonRect={harvestButtonRect}
                isActive={activeFtueStage === 'first_harvest'}
              />
            )}
            {(activeFtueStage === 'first_harvest_multi' || ftue8FadingOut) && (
              <Ftue8Overlay
                buttonRect={harvestButtonRect}
                isActive={activeFtueStage === 'first_harvest_multi'}
                isFadingOut={ftue8FadingOut}
                onFadeOutComplete={() => {
                  setFtue8FadingOut(false);
                }}
              />
            )}
            {(activeFtueStage === 'first_collect_both' || ftue9FadingOut) && (
              <Ftue9Overlay
                isActive={activeFtueStage === 'first_collect_both'}
                isFadingOut={ftue9FadingOut}
                appScale={appScale}
                onFadeOutComplete={() => {
                  setFtue9FadingOut(false);
                  setFtue9CollectedCount(0);
                  // FTUE 9.5: recharge intro + bounce -> proceed to upgrade on confirm
                  setFtueUpgradePanelVisible(false);
                  setIsExpanded(false);
                  setActiveFtueStage('recharge_pre_upgrade');
                }}
              />
            )}
            {(activeFtueStage === 'recharge_pre_upgrade' || ftue95FadingOut) && (
              <Ftue95Overlay
                seedButtonRect={seedButtonRect}
                harvestButtonRect={harvestButtonRect}
                isVisible={activeFtueStage === 'recharge_pre_upgrade' && ftue95ShowTextbox}
                isFadingOut={ftue95FadingOut}
                onConfirm={() => {
                  setFtue95FadingOut(true);
                }}
                onFadeOutComplete={() => {
                  setFtue95FadingOut(false);
                  setFtue95ShowTextbox(false);
                  // Stop bouncing once we leave this stage.
                  setFtue10BigBounceActive(false);

                  // FTUE 10: reveal upgrade panel (closed on Seeds), then user opens it manually (finger 1).
                  setFtueUpgradePanelVisible(true);
                  setActiveTab('SEEDS');
                  setIsExpanded(false);
                  setActiveFtueStage('first_upgrade');
                  setFtue10Phase('point_orders');
                }}
              />
            )}
            {(activeFtueStage === 'first_upgrade' || ftue10FadingOut) && (
              <Ftue10Overlay
                harvestButtonRect={harvestButtonRect}
                phase={ftue10Phase}
                purchaseButtonRect={ftue10PurchaseButtonRect}
                appScale={appScale}
                isFadingOut={ftue10FadingOut}
                onFadeOutComplete={() => {
                  // FTUE 10 complete: close upgrade panel; no bounce changes here.
                  setFtue10FadingOut(false);
                  setFtue10Phase(null);
                  setIsExpanded(false);
                  // Keep panel visible in closed state
                  setFtueUpgradePanelVisible(true);
                  // Show FTUE 11 after the upgrade panel is fully closed.
                  setFtue11StartQueued(true);
                }}
              />
            )}
            {activeFtueStage === 'recharge_intro' && (
              <Ftue11Overlay
                seedButtonRect={seedButtonRect}
                harvestButtonRect={harvestButtonRect}
                onConfirm={() => {
                  // FTUE 11 is fully closed: from now on we save progress + allow offline earnings.
                  ftue11PersistenceEnabledRef.current = true;
                  persistGameSnapshotRef.current();
                  setActiveFtueStage(null);

                  // Spawn 3 starter goals (plant 1/2/3) with 0.5s stagger and bounce.
                  const maxSlots = getMaxGoalSlots(playerLevel);
                  const cropYieldLevel = getCropYieldPerHarvest(cropsState);
                  const plantLevels = [1, 2, 3];
                  const emptySlots: number[] = [];
                  for (let i = 0; i < maxSlots && emptySlots.length < plantLevels.length; i++) {
                    if (goalSlots[i] === 'empty') emptySlots.push(i);
                  }
                  emptySlots.forEach((slotIdx, index) => {
                    const level = plantLevels[index];
                    setTimeout(() => {
                      const required = getGoalCropRequired(playerLevel, cropYieldLevel);
                      setGoalSlots((prev) => {
                        const next = [...prev];
                        next[slotIdx] = 'green';
                        return next;
                      });
                      setGoalPlantTypes((prev) => {
                        const next = [...prev];
                        next[slotIdx] = level;
                        return next;
                      });
                      setGoalCounts((prev) => {
                        const next = [...prev];
                        next[slotIdx] = required;
                        return next;
                      });
                      setGoalAmountsRequired((prev) => {
                        const next = [...prev];
                        next[slotIdx] = required;
                        return next;
                      });
                      setGoalDisplayOrder((prev) => (prev.includes(slotIdx) ? prev : [...prev, slotIdx]));
                      setGoalSpawnBounceSlots((prev) => (prev.includes(slotIdx) ? prev : [...prev, slotIdx]));
                      setTimeout(() => {
                        setGoalSpawnBounceSlots((prev) => prev.filter((s) => s !== slotIdx));
                      }, 500);
                      // Quitting mid-stagger should still retain goals created so far.
                      persistGameSnapshotRef.current();
                    }, index * 500);
                  });
                }}
              />
            )}
            {/* FTUE_6: goal in coin state – textbox + finger on goal slot 0; only goal tappable; tap to collect and end */}
            {activeFtueStage === 'first_goal_collect' && (
              <Ftue6Overlay isActive={activeFtueStage === 'first_goal_collect'} appScale={appScale} />
            )}
            {/* Block all input from FTUE 6 collect until FTUE 7 overlay (finger + textbox) appears */}
            {ftue7Scheduled && (
              <div className="absolute inset-0 z-[98]" style={{ pointerEvents: 'auto' }} aria-hidden />
            )}
            {/* FTUE_7: more orders – textbox + finger at seeds; only seeds tappable; 2 taps then fade out */}
            {(activeFtueStage === 'first_more_orders' || ftue7FadingOut) && (
              <Ftue7Overlay
                buttonRect={seedButtonRect}
                isActive={activeFtueStage === 'first_more_orders'}
                isFadingOut={ftue7FadingOut}
                onFadeOutComplete={() => {
                  setFtue7FadingOut(false);
                  setFtue7SeedFireCount(0);
                  setActiveFtueStage('first_harvest_multi'); // FTUE 8 starts immediately after FTUE 7 fades out
                }}
              />
            )}
          </div>,
          document.body
        )}
        {/* Modals (level up, discovery, offers, pause): above surplus coin panels */}
        {createPortal(
          <div className="fixed inset-0 pointer-events-none" style={{ zIndex: 220 }}>
            {/* Level Up Popup */}
            {levelUpPopup && (() => {
              const unlockInfo = getLevelUnlockInfo(levelUpPopup.level);
              return (
                <LevelUpPopup
                  isVisible={levelUpPopup.isVisible}
                  onClose={() => {
                    lastOtherPopupClosedAtRef.current = Date.now();
                    setLevelUpPopup(null);
                    setLevelUpPopupQueue((q) => {
                      if (q.length > 0) {
                        setLevelUpPopup({ isVisible: true, level: q[0] });
                        return q.slice(1);
                      }
                      return q;
                    });
                    queueMicrotask(() => {
                      tryStartAutoMergeRef.current();
                      scheduleAutoMergeRecheckRef.current(0);
                    });
                  }}
                  level={levelUpPopup.level}
                  title={unlockInfo.title}
                  description={unlockInfo.description}
                  icon={unlockInfo.icon}
                  onUnlockNow={() => {
                    // Settings "Level Up" already advances `playerLevel` before showing the popup.
                    // Only increment here if the player is still below the popup level.
                    setPlayerLevel((l) => (l < levelUpPopup.level ? l + 1 : l));
                    setPlayerLevelProgress(0);
                    if (unlockInfo.upgradeId === 'seed_surplus') {
                      setSeedsState((prev) => ({
                        ...prev,
                        seed_surplus: { level: 1, progress: 0 },
                      }));
                    }
                    if (unlockInfo.upgradeId === 'merge_harvest') {
                      setCropsState((prev) => ({
                        ...prev,
                        merge_harvest: { level: 1, progress: 0 },
                      }));
                    }
                    if (unlockInfo.tab && ftueUpgradePanelVisible) {
                      setIsExpanded(true);
                      setActiveTab(unlockInfo.tab);
                      if (unlockInfo.upgradeId) {
                        setPendingUnlockUpgradeId(unlockInfo.upgradeId);
                        setTimeout(() => setPendingUnlockUpgradeId(null), 2500);
                      }
                    }
                  }}
                  appScale={appScale}
                />
              );
            })()}

            {/* Discovery Popup */}
            {discoveryPopup && (
              <DiscoveryPopup
                isVisible={discoveryPopup.isVisible}
                onClose={() => {
                  lastOtherPopupClosedAtRef.current = Date.now();
                  setDiscoveryPopup(null);
                  queueMicrotask(() => {
                    tryStartAutoMergeRef.current();
                    scheduleAutoMergeRecheckRef.current(0);
                  });
                }}
                title="New Discovery"
                imageSrc={assetPath(`/assets/plants/plant_${Math.max(1, Math.min(24, discoveryPopup.level))}.png`)}
                imageLevel={discoveryPopup.level}
                subtitle={getPlantData(discoveryPopup.level).name}
                description={getPlantData(discoveryPopup.level).description}
                buttonText={discoveryPopup.level === 2 ? 'Excellent!' : 'Add to Collection'}
                rewardAmount={applyDoubleCoinsVisualAmount(
                  getCoinValueForLevel(discoveryPopup.level) * PLANT_DISCOVERY_COIN_MULTIPLIER,
                  activeBoosts
                )}
                showCloseButton={false}
                closeOnBackdropClick={false}
                appScale={appScale}
                onButtonClick={(startPoint) => {
                  const rewardValue = applyDoubleCoinsVisualAmount(
                    getCoinValueForLevel(discoveryPopup.level) * PLANT_DISCOVERY_COIN_MULTIPLIER,
                    activeBoostsRef.current
                  );
                  // Render particles in a fixed full-viewport layer (portaled with modals) so coords match
                  // the popup's viewport getBoundingClientRect — avoids scaled #game-container transform mismatch.
                  const layer = discoveryRewardFxLayerRef.current;
                  if (layer) {
                    const lr = layer.getBoundingClientRect();
                    const startX = startPoint.x - lr.left;
                    const startY = startPoint.y - lr.top;
                    setActiveDiscoveryCoinParticles((prev) => [...prev, {
                      id: `discovery-reward-${Date.now()}-${Math.random().toString(36).slice(2)}`,
                      startX,
                      startY,
                      value: rewardValue,
                    }]);
                  }
                  // From plant 3 onward, also shoot a green particle to Collection and set nav notification.
                  if (discoveryPopup.level >= 3 && containerRef.current) {
                    const cr = containerRef.current.getBoundingClientRect();
                    const scale = appScaleRef.current;
                    setActiveBarnParticles((prev) => [
                      ...prev,
                      {
                        id: `discovery-collection-${Date.now()}-${Math.random().toString(36).slice(2)}`,
                        startX: (startPoint.x - cr.left) / scale,
                        startY: (startPoint.y - cr.top) / scale,
                      },
                    ]);
                  }

                  // FTUE 4 progression from first plant-2 discovery still happens on confirm.
                  if (discoveryPopup.level === 2 && ftue4Pending) {
                    setFtue4Pending(false);
                    setActiveFtueStage('first_goal');
                    setGoalSlots(['green', 'empty', 'empty', 'empty', 'empty']);
                    setGoalPlantTypes([2, 0, 0, 0, 0]);
                    setGoalCounts([3, 0, 0, 0, 0]);
                    setGoalAmountsRequired([3, 0, 0, 0, 0]);
                    setGoalDisplayOrder([0]);
                  }
                }}
              />
            )}

            {purchaseSuccessfulUi && (
              <PurchaseSuccessfulPopup
                isVisible
                headerImageSrc={purchaseSuccessfulUi.headerImageSrc}
                rewards={purchaseSuccessfulUi.rewards}
                appScale={appScale}
                onClose={() => {
                  lastOtherPopupClosedAtRef.current = Date.now();
                  pendingPurchaseBoostsRef.current = [];
                  setPurchaseSuccessfulUi(null);
                }}
                onCollect={(buttonRect) => {
                  const boosts = [...pendingPurchaseBoostsRef.current];
                  pendingPurchaseBoostsRef.current = [];
                  const isFromStore = activeScreen === 'STORE';
                  const wrapper = isFromStore ? storeHeaderLeftWrapperRef.current : headerLeftWrapperRef.current;
                  if (!wrapper || boosts.length === 0) return;
                  const wr = wrapper.getBoundingClientRect();
                  const scale = wr.width / wrapper.offsetWidth;
                  /** Premium Collect: spawn from right side of green button, then arc to boosts. */
                  const collectOriginX = buttonRect.right - 12;
                  const collectOriginY = buttonRect.top + buttonRect.height / 2;
                  /** Space impacts so each particle lands before the next slot prediction (~500ms flight). */
                  const staggerMs = boosts.length > 1 ? 560 : 175;
                  boosts.forEach((b, i) => {
                    window.setTimeout(() => {
                      const slot = predictBoostParticleTargetSlot(activeBoostsRef.current, b.offerId);
                      setBoostParticles((prev) => [
                        ...prev,
                        {
                          id: `boost-iap-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 9)}`,
                          startX: (collectOriginX - wr.left) / scale,
                          startY: (collectOriginY - wr.top) / scale,
                          targetSlotIndex: slot,
                          offerId: b.offerId,
                          durationMs: b.durationMs,
                          icon: b.icon,
                          sourceScreen: isFromStore ? 'store' : 'farm',
                        },
                      ]);
                    }, i * staggerMs);
                  });
                }}
              />
            )}

            {/* Plant Info Popup (Barn) */}
            {plantInfoPopup && (
              <PlantInfoPopup
                isVisible={plantInfoPopup.isVisible}
                onClose={() => {
                  lastOtherPopupClosedAtRef.current = Date.now();
                  setPlantInfoPopup(null);
                }}
                plantLevel={plantInfoPopup.level}
                plantName={getPlantData(plantInfoPopup.level).name}
                plantDescription={getPlantData(plantInfoPopup.level).description}
                isUnlocked={plantInfoPopup.level <= highestPlantEver}
                masteryPotUnlocked={plantMastery.unlockedLevels.includes(plantInfoPopup.level)}
                appScale={appScale}
                masteryUnlock={
                  plantInfoPopup.level <= highestPlantEver &&
                  (plantMastery.unlockPending.includes(plantInfoPopup.level) ||
                    plantMastery.unlockedLevels.includes(plantInfoPopup.level))
                    ? {
                        coinCost: getPlantMasteryUnlockCost(plantInfoPopup.level),
                        canAfford: money >= getPlantMasteryUnlockCost(plantInfoPopup.level),
                        isUnlocked: plantMastery.unlockedLevels.includes(plantInfoPopup.level),
                        onPurchase: () => {
                          const level = plantInfoPopup.level;
                          skipNextBarnPendingBounceRef.current = true;
                          purchasePlantMasteryForLevel(level);
                          lastOtherPopupClosedAtRef.current = Date.now();
                          setPlantInfoPopup(null);
                          window.setTimeout(() => {
                            triggerMasteryPurchaseReveal(level);
                          }, 0);
                        },
                      }
                    : undefined
                }
              />
            )}

            {/* Limited Offer Popup */}
            {limitedOfferPopup && (
              <LimitedOfferPopup
                isVisible={limitedOfferPopup.isVisible}
                onClose={() => {
                  const now = Date.now();
                  lastLimitedOfferClosedAtRef.current = now;
                  lastLimitedOfferShownAtRef.current = now; // start 90s cooldown for next offer when timer starts
                  setLimitedOfferPopup(null);
                }}
                closeOnButtonClick={false}
                closeOnBackdropClick={limitedOfferPopup.activeBoostEndTime != null}
                onCloseButtonClick={() => {
                  if (limitedOfferPopup.activeBoostEndTime != null) return;
                  // Open upgrade panel, scroll to offer, flash yellow (popup unmount + cooldown refs run in onClose after fade-out)
                  if (limitedOfferPopup.offerId) {
                    const offerId = limitedOfferPopup.offerId;
                    const offerConfig = getOfferById(offerId);
                    if (offerConfig && !isStorePremiumOnlyOfferId(offerId)) {
                      setRewardedOffers(prev => {
                        if (prev.some(o => o.id === offerId)) return prev;
                        return [...prev, {
                          id: offerConfig.id,
                          name: offerConfig.title,
                          icon: offerConfig.headerIcon,
                          description: offerConfig.description,
                          tab: offerConfig.upgradeTab,
                          timeRemaining: 60,
                        }];
                      });
                      if (ftueUpgradePanelVisible) {
                        setIsExpanded(true);
                        setActiveTab(offerConfig.upgradeTab);
                        setPendingOfferHighlightId(offerId);
                      }
                    }
                    setTimeout(() => setPendingOfferHighlightId(null), 2500);
                  }
                }}
                title={limitedOfferPopup.title}
                imageSrc={limitedOfferPopup.imageSrc}
                imageLevel={limitedOfferPopup.imageLevel}
                imageMastered={
                  typeof limitedOfferPopup.imageLevel === 'number' &&
                  plantMastery.unlockedLevels.includes(limitedOfferPopup.imageLevel)
                }
                subtitle={limitedOfferPopup.subtitle}
                description={limitedOfferPopup.description}
                buttonText={limitedOfferPopup.buttonText}
                appScale={appScale}
                activeBoostEndTime={limitedOfferPopup.activeBoostEndTime}
                durationMinutes={limitedOfferPopup.durationMinutes}
                durationSeconds={limitedOfferPopup.durationSeconds}
                subtitleSettingsStyle={limitedOfferPopup.subtitleSettingsStyle}
                hideOfferDurationBlock={limitedOfferPopup.hideOfferDurationBlock}
                onButtonClick={() => {
                  // Show fake ad; when user taps "Complete ad", grant reward. Close limited offer popup now so it's gone when fake ad closes.
                  const offerId = limitedOfferPopup.offerId;
                  pendingAdSourceRef.current = 'limitedOffer';
                  pendingOfferIdRef.current = offerId ?? null;
                  setLimitedOfferPopup(null);
                  setShowFakeAd(true);
                  setPendingAdComplete(() => () => {
                    if (offerId) {
                      setRewardedOffers(prev => prev.filter(o => o.id !== offerId));
                    }
                    const now = Date.now();
                    lastLimitedOfferClosedAtRef.current = now;
                    lastLimitedOfferShownAtRef.current = now;
                    setLimitedOfferPopup(null);
                    setShowFakeAd(false);
                    // Seed Storm: fire free seeds to all empty unlocked cells, 1 every 200ms, no storage/progress cost
                    if (offerId === 'seed_storm') {
                      const g = gridRef.current;
                      const reservedCells = new Set(activeProjectilesRef.current.map(p => p.targetIdx));
                      const emptyIndices = g
                        .map((cell, idx) => (cell.item === null && !cell.locked && !reservedCells.has(idx) ? idx : null))
                        .filter((idx): idx is number => idx !== null);
                      emptyIndices.forEach((targetIdx, i) => {
                        setTimeout(() => spawnProjectile(targetIdx, seedLevel), 200 * i);
                      });
                    }
                    // Special Delivery: shoot a seed that spawns/upgrades to high-level plant; beam + bounce on impact
                    if (offerId === 'special_delivery') {
                      const plantLevel = Math.max(1, highestPlantEverRef.current - 1);
                      const g = gridRef.current;
                      const reserved = new Set(activeProjectilesRef.current.map(p => p.targetIdx));
                      const emptyIndices = g.map((c, i) => (!c.locked && c.item === null && !reserved.has(i) ? i : -1)).filter((i): i is number => i !== -1);
                      let targetIdx: number;
                      if (emptyIndices.length > 0) {
                        targetIdx = emptyIndices[Math.floor(Math.random() * emptyIndices.length)];
                      } else {
                        const withPlants = g.map((c, i) => (c.item ? { idx: i, level: c.item.level } : null)).filter((x): x is { idx: number; level: number } => x != null);
                        if (withPlants.length === 0) return;
                        withPlants.sort((a, b) => a.level - b.level);
                        targetIdx = withPlants[0].idx;
                      }
                      spawnProjectile(targetIdx, plantLevel, true, true);
                    }
                    // Double Coins from rewarded ad: config has no duration so boost particle path is skipped — grant timed boost here.
                    if (offerId && isCoinMultiplierBoostId(offerId)) {
                      setActiveBoosts((prev) =>
                        applyBoostParticleImpact(prev, {
                          id: `boost-ad-${DOUBLE_COINS_OFFER_ID}-${Date.now()}`,
                          startX: 0,
                          startY: 0,
                          offerId: DOUBLE_COINS_OFFER_ID,
                          durationMs: REWARDED_DOUBLE_COINS_AD_DURATION_MS,
                          icon: DOUBLE_COINS_HEADER_ICON,
                        })
                      );
                    }
                  });
                }}
              />
            )}

            {/* Fake Ad - constrained to game area (same size as game); Complete ad runs pendingAdComplete then closes */}
            <FakeAdPopup
              isVisible={showFakeAd}
              appScale={appScale}
              onActivateRewardClick={(buttonRect) => {
                if (pendingAdSourceRef.current === 'offlineEarnings') return;
                if (pendingAdSourceRef.current === 'coinGoal') return;
                const offerId = pendingOfferIdRef.current;
                const offer = offerId ? getOfferById(offerId) : null;
                const hasDuration = offer && (offer.durationMinutes != null || (offer.durationSeconds != null && offer.durationSeconds > 0));
                if (!hasDuration) return;
                const isFromStore = pendingAdSourceRef.current === 'storeFreeOffer';
                const wrapper = isFromStore ? storeHeaderLeftWrapperRef.current : headerLeftWrapperRef.current;
                if (!wrapper) return;
                const wr = wrapper.getBoundingClientRect();
                const scale = wr.width / wrapper.offsetWidth;
                const targetSlotIndex = predictBoostParticleTargetSlot(activeBoostsRef.current, offer?.id);
                const durationMs = offer?.durationSeconds != null
                  ? offer.durationSeconds * 1000
                  : offer?.durationMinutes != null
                    ? offer.durationMinutes * 60 * 1000
                    : 60000;
                setBoostParticles((prev) => [
                  ...prev,
                  {
                    id: `boost-${Date.now()}`,
                    startX: (buttonRect.left + buttonRect.width / 2 - wr.left) / scale,
                    startY: (buttonRect.top + buttonRect.height / 2 - wr.top) / scale,
                    targetSlotIndex,
                    offerId: offer?.id,
                    durationMs,
                    icon: offer?.headerIcon,
                    sourceScreen: isFromStore ? 'store' as const : 'farm' as const,
                  },
                ]);
              }}
              onComplete={() => {
                lastFakeAdClosedAtRef.current = Date.now();
                const applyReward = pendingAdComplete;
                setPendingAdComplete(null);
                setShowFakeAd(false);
                pendingAdSourceRef.current = null;
                setTimeout(() => applyReward?.(), 250);
              }}
            />

            {/* Pause Menu - opened from settings/gear; Rewarded Ad = gift offer + close, Level Up = +1 goal XP (does not close) */}
            <PauseMenuPopup
              isVisible={pauseMenuOpen}
              onAutoMergeChange={setAutoMergeSetting}
              onClose={() => {
                setPauseMenuOpen(false);
                const plantLevelToDiscover = discoveryLevelAfterPauseCloseRef.current;
                discoveryLevelAfterPauseCloseRef.current = null;
                if (plantLevelToDiscover != null) {
                  setDiscoveryPopup({ isVisible: true, level: plantLevelToDiscover });
                }
                setLevelUpPopupQueue((q) => {
                  if (q.length > 0) {
                    setLevelUpPopup({ isVisible: true, level: q[0] });
                    return q.slice(1);
                  }
                  return q;
                });
              }}
              onRewardedAdClick={() => {
                if (!canOpenLimitedOfferRewardPopup()) return;
                if (LIMITED_OFFERS_AD_POOL.length === 0) return;
                const offer = LIMITED_OFFERS_AD_POOL[nextRewardedAdOfferIndexRef.current % LIMITED_OFFERS_AD_POOL.length];
                nextRewardedAdOfferIndexRef.current = (nextRewardedAdOfferIndexRef.current + 1) % LIMITED_OFFERS_AD_POOL.length;
                const state = buildLimitedOfferPopupState(offer.id, { highestPlantEver });
                if (state) setLimitedOfferPopup(state);
              }}
              onLevelUpClick={() => {
                const nextLevel = playerLevel + 1;
                setPlayerLevel(nextLevel);
                setPlayerLevelProgress(0);
                setPlayerLevelFlashTrigger((t) => t + 1);
                if (nextLevel <= 10) {
                  setLevelUpPopupQueue((q) => [...q, nextLevel]);
                }
              }}
              canUnlockPlant={highestPlantEver < 24}
              onUnlockPlantClick={() => {
                if (highestPlantEver >= 24) return;
                const newLevel = highestPlantEver + 1;
                setHighestPlantEver(newLevel);
                highestPlantEverRef.current = newLevel;
                newGoalsSinceDiscoveryRef.current = 0;
                lastMergeDiscoveryLevelRef.current = newLevel;
                discoveryLevelAfterPauseCloseRef.current = newLevel; // latest only; popup when pause closes
              }}
              onGoldenPotClick={() => {
                completeMasterySegmentCheat();
              }}
              onAddMoney={(amount) => setMoney((prev) => prev + amount)}
              onClearBoosts={() => {
                setBoostParticles([]);
                setActiveBoosts([]);
                setStoreFreeOfferSlots(pickInitialStoreFreeOfferSlots());
                setStoreSlotCooldownEnds([0, 0]);
              }}
              onResetProgress={() => {
                if (!window.confirm('Reset all progress and restart from the beginning? This cannot be undone.')) return;
                suppressGameSaveRef.current = true;
                clearGameSave();
                try {
                  sessionStorage.setItem('pocket-garden-reset-v1', '1');
                } catch {
                  /* ignore */
                }
                window.location.reload();
              }}
              closeOnBackdropClick
              appScale={appScale}
            />

            {offlineEarningsUi?.open ? (
              <OfflineEarningsPopup
                isVisible={offlineEarningsUi.open}
                onClose={() => {}}
                rewardAmount={offlineEarningsUi.amount}
                rewardBounceKey={offlineEarningsUi.rewardBounceKey}
                showDoubleButton={offlineEarningsUi.showDoubleButton}
                onDoubleCoinsClick={() => {
                  setOfflineEarningsUi((prev) => (prev ? { ...prev, showDoubleButton: false } : prev));
                  pendingAdSourceRef.current = 'offlineEarnings';
                  setPendingAdComplete(() => () => {
                    setOfflineEarningsUi((prev) => {
                      if (!prev) return prev;
                      const nextAmount = prev.amount * 2;
                      pendingOfflineEarningsRef.current = nextAmount;
                      return {
                        ...prev,
                        amount: nextAmount,
                        showDoubleButton: false,
                        rewardBounceKey: prev.rewardBounceKey + 1,
                      };
                    });
                  });
                  setShowFakeAd(true);
                }}
                onCollectClick={(startPoint) => {
                  const amt = offlinePopupAmountRef.current;
                  const payout = amt;
                  pendingOfflineEarningsRef.current = 0;
                  setOfflineEarningsUi(null);
                  const layer = discoveryRewardFxLayerRef.current;
                  if (layer) {
                    const lr = layer.getBoundingClientRect();
                    setActiveDiscoveryCoinParticles((prev) => [
                      ...prev,
                      {
                        id: `offline-earnings-${Date.now()}-${Math.random().toString(36).slice(2)}`,
                        startX: startPoint.x - lr.left,
                        startY: startPoint.y - lr.top,
                        value: payout,
                      },
                    ]);
                  }
                }}
                appScale={appScale}
              />
            ) : null}

            {/* Discovery reward coin VFX: viewport space (appScale 1) so spawn aligns with reward icon in modal */}
            <div
              ref={discoveryRewardFxLayerRef}
              className="pointer-events-none overflow-visible"
              style={{ position: 'fixed', inset: 0, zIndex: 230 }}
            >
              {activeDiscoveryCoinParticles.map((p) => (
                <GoalCoinParticle
                  key={p.id}
                  data={p}
                  containerRef={discoveryRewardFxLayerRef}
                  walletRef={walletRef}
                  walletIconRef={walletIconRef}
                  appScale={1}
                  variant="popupReward"
                  popupVisualScale={1.5}
                  activeCount={activeDiscoveryCoinParticles.length}
                  onImpact={(value) => {
                    setMoney((prev) => prev + value);
                    setWalletFlashActive(true);
                    setWalletBounceTrigger((t) => t + 1);
                    if (walletFlashTimeoutRef.current) clearTimeout(walletFlashTimeoutRef.current);
                    walletFlashTimeoutRef.current = setTimeout(() => setWalletFlashActive(false), 120);
                  }}
                  onComplete={() => setActiveDiscoveryCoinParticles((prev) => prev.filter((x) => x.id !== p.id))}
                />
              ))}
            </div>
          </div>,
          document.body
        )}

        <div className="absolute inset-0 pointer-events-none z-[60] overflow-hidden">
          {activeBarnParticles.map((p) => (
            <BarnParticle
              key={p.id}
              data={p}
              containerRef={containerRef}
              barnButtonRef={barnButtonRef}
              appScale={appScale}
              onImpact={() => setBarnNotification(true)}
              onComplete={() => setActiveBarnParticles((prev) => prev.filter((x) => x.id !== p.id))}
            />
          ))}
          {activeProjectiles.map(p => (
            <Projectile 
              key={p.id}
              data={p}
              appScale={appScale}
              onImpact={(targetIdx) => {
                // FTUE 8 starts only from FTUE 7 overlay onFadeOutComplete (no seed-land trigger) so 7→8 transition is instant
                if (p.isSpecialDelivery) {
                  // Special Delivery: spawn on empty cell or upgrade existing plant; then beam + bounce
                  const g = gridRef.current;
                  const cell = g?.[targetIdx];
                  if (cell && cell.item === null) {
                    queueSpawnCropFromProjectile(targetIdx, p.plantLevel);
                  } else {
                    setGrid(prev => {
                      const next = [...prev];
                      const cur = next[targetIdx]?.item;
                      if (next[targetIdx] && cur) next[targetIdx] = { ...next[targetIdx], item: { ...cur, level: p.plantLevel } };
                      return next;
                    });
                    setImpactCellIdx(targetIdx);
                    setTimeout(() => setImpactCellIdx(null), 500);
                    scheduleAutoMergeRecheck(AUTO_MERGE_POST_SETTLE_MS);
                  }
                  const hexEl = document.getElementById(`hex-${targetIdx}`);
                  if (hexEl) {
                    const r = hexEl.getBoundingClientRect();
                    if (!getPerformanceMode()) {
                      setLeafBurstsSmall((prev) => [...prev, { id: `sd-burst-${targetIdx}-${Date.now()}`, x: r.left + r.width / 2, y: r.top + r.height / 2, startTime: Date.now() }]);
                    }
                    setCellHighlightBeams((prev) => [...prev, { id: `special-delivery-${targetIdx}-${Date.now()}`, x: r.left + r.width / 2, y: r.top + r.height / 2, cellWidth: r.width, cellHeight: r.height, startTime: Date.now() }]);
                  }
                  return;
                }
                // Normal seed: spawn plant and optional seed-quality beam
                queueSpawnCropFromProjectile(targetIdx, p.plantLevel);
                const hexEl = document.getElementById(`hex-${targetIdx}`);
                if (hexEl) {
                  const r = hexEl.getBoundingClientRect();
                  if (!getPerformanceMode()) {
                    setLeafBurstsSmall((prev) => [
                      ...prev,
                      {
                        id: Math.random().toString(36).slice(2),
                        x: r.left + r.width / 2,
                        y: r.top + r.height / 2,
                        startTime: Date.now(),
                      },
                    ]);
                  }
                  
                  if (p.plantLevel > seedLevel) {
                    setCellHighlightBeams((prev) => [
                      ...prev,
                      {
                        id: `seed-quality-highlight-${targetIdx}-${Date.now()}`,
                        x: r.left + r.width / 2,
                        y: r.top + r.height / 2,
                        cellWidth: r.width,
                        cellHeight: r.height,
                        startTime: Date.now(),
                      },
                    ]);
                  }
                }
              }}
              onComplete={() => {
                setActiveProjectiles(prev => prev.filter(item => item.id !== p.id));
              }}
            />
          ))}
          {createPortal(
            coinPanelPortalRect ? (
              <div
                className="pointer-events-none overflow-visible"
                style={{
                  position: 'fixed',
                  left: coinPanelPortalRect.left,
                  top: coinPanelPortalRect.top,
                  width: coinPanelPortalRect.width,
                  height: coinPanelPortalRect.height,
                  transform: `scale(${coinPanelPortalRect.scale})`,
                  transformOrigin: 'top left',
                  zIndex: 110,
                  // When on shed/market, still run animations (surplus fires & credits) but hide so user doesn't see particles
                  visibility: activeScreen === 'FARM' ? 'visible' : 'hidden',
                }}
              >
                {activeCoinPanels.map((coin) => (
                  <CoinPanel
                    key={coin.id}
                    data={coin}
                    containerRef={containerRef}
                    walletRef={walletRef}
                    walletIconRef={walletIconRef}
                    appScale={appScale}
                    activePanelCount={activeCoinPanels.length}
                    onImpact={(value) => {
                      pendingCoinImpactRef.current.total += value;
                        if (!pendingCoinImpactRef.current.scheduled) {
                          pendingCoinImpactRef.current.scheduled = true;
                          walletImpactFlushRafRef.current = requestAnimationFrame(() => {
                            const total = pendingCoinImpactRef.current.total;
                            pendingCoinImpactRef.current = { total: 0, scheduled: false };
                            walletImpactFlushRafRef.current = 0;
                            setMoney((prev) => prev + total);
                            setWalletBounceTrigger((t) => t + 1);
                            setWalletFlashActive(true);
                            if (walletFlashTimeoutRef.current) clearTimeout(walletFlashTimeoutRef.current);
                            walletFlashTimeoutRef.current = setTimeout(() => setWalletFlashActive(false), 120);
                          });
                        }
                      }}
                      onComplete={() => setActiveCoinPanels(prev => prev.filter((c) => c.id !== coin.id))}
                    />
                  ))}
                </div>
              ) : (
                <></>
              ),
              document.body
            )}
          {activePlantPanels.map((panel) => (
            <PlantPanel
              key={panel.id}
              data={panel}
              containerRef={containerRef}
              targetRef={goalIconRefs[panel.goalSlotIdx]}
              appScale={appScale}
              onImpact={(goalSlotIdx, amount) => {
                goalInFlightHarvestBySlotRef.current[goalSlotIdx] = Math.max(0, (goalInFlightHarvestBySlotRef.current[goalSlotIdx] ?? 0) - amount);
                goalsPendingCompletionRef.current.delete(goalSlotIdx);
                setGoalBounceSlots((prev) => prev.includes(goalSlotIdx) ? prev : [...prev, goalSlotIdx]);
                setGoalImpactSlots((prev) => prev.includes(goalSlotIdx) ? prev : [...prev, goalSlotIdx]);
                setGoalCounts((c) => {
                  const next = [...c];
                  const prevCount = next[goalSlotIdx] ?? 0;
                  next[goalSlotIdx] = Math.max(0, prevCount - amount);
                  if (next[goalSlotIdx] === 0) {
                    const plantLevel = goalPlantTypes[goalSlotIdx] ?? goalSlotIdx + 1;
                    const plantValue = getCoinValueForLevel(plantLevel);
                    const amountRequired = goalAmountsRequired[goalSlotIdx] ?? 3;
                    const marketMultiplier = getMarketValueMultiplier(harvestState);
                    const rawValue = plantValue * amountRequired * marketMultiplier;
                    const roundedValue = Math.round(rawValue / 5) * 5;
                    setGoalCompletedValues((v) => {
                      const vNext = [...v];
                      vNext[goalSlotIdx] = roundedValue;
                      return vNext;
                    });
                    setGoalSlots((s) => {
                      const sNext = [...s];
                      sNext[goalSlotIdx] = 'completed';
                      return sNext;
                    });
                    if (goalSlotIdx === 0) setActiveFtueStage((stage) => (stage === 'first_harvest' ? 'first_goal_collect' : stage));
                  }
                  return next;
                });
                setTimeout(() => {
                  setGoalBounceSlots((prev) => prev.filter((s) => s !== goalSlotIdx));
                  setGoalImpactSlots((prev) => prev.filter((s) => s !== goalSlotIdx));
                }, 400); // Clear before animation ends so text is #a1b54e by 0% light green
              }}
              onComplete={() => setActivePlantPanels(prev => prev.filter((p) => p.id !== panel.id))}
            />
          ))}
          {walletBursts.map((burst) => (
            <WalletImpactBurst
              key={burst.id}
              trigger={burst.trigger}
              walletIconRef={walletIconRef}
              containerRef={containerRef}
              appScale={appScale}
              onComplete={() => setWalletBursts((prev) => prev.filter((b) => b.id !== burst.id))}
            />
          ))}
          {activeGoalCoinParticles.map((p) => (
            <GoalCoinParticle
              key={p.id}
              data={p}
              containerRef={containerRef}
              walletRef={walletRef}
              walletIconRef={walletIconRef}
              appScale={appScale}
              variant="goal"
              activeCount={activeGoalCoinParticles.length}
              onImpact={(value) => {
                let finalValue = value;
                if (!p.skipHappyCustomerRoll) {
                  const happiestCustomersActive = activeBoosts.some(b => b.offerId === 'happiest_customers');
                  if (!happiestCustomersActive) {
                    const happyChance = getHappyCustomerChance(harvestState);
                    if (happyChance > 0 && Math.random() * 100 < happyChance) finalValue *= 2;
                  }
                }
                setMoney((prev) => prev + finalValue);
                setWalletFlashActive(true);
                setWalletBounceTrigger((t) => t + 1);
                if (walletFlashTimeoutRef.current) clearTimeout(walletFlashTimeoutRef.current);
                walletFlashTimeoutRef.current = setTimeout(() => setWalletFlashActive(false), 120);
              }}
              onComplete={() => setActiveGoalCoinParticles((prev) => prev.filter((x) => x.id !== p.id))}
            />
          ))}

          {/* Boost particles: farm → Farm header; store → Store header (so particle flies to visible boost area) */}
          {headerLeftWrapperRef.current &&
            boostParticles.filter((p) => p.sourceScreen !== 'store').length > 0 &&
            createPortal(
              boostParticles
                .filter((p) => p.sourceScreen !== 'store')
                .map((particle) => (
                  <BoostParticle
                    key={particle.id}
                    data={particle}
                    containerRef={headerLeftWrapperRef}
                    boostAreaRef={activeBoostAreaRef}
                    onImpact={(data) => {
                      const wrapper = headerLeftWrapperRef.current;
                      const el = activeBoostAreaRef.current;
                      if (wrapper && el) {
                        const wr = wrapper.getBoundingClientRect();
                        const scale = wr.width / wrapper.offsetWidth;
                        const slotIndex = data.targetSlotIndex ?? 0;
                        const tx = el.offsetLeft + slotIndex * 28 + 13;
                        const ty = el.offsetTop + 11;
                        setBoostBursts((prev) => [
                          ...prev,
                          {
                            id: `boost-impact-${Date.now()}`,
                            x: wr.left + tx * scale,
                            y: wr.top + ty * scale,
                            startTime: Date.now(),
                          },
                        ]);
                      }
                      setActiveBoosts((prev) => applyBoostParticleImpact(prev, data));
                    }}
                    onComplete={() => setBoostParticles((prev) => prev.filter((p) => p.id !== particle.id))}
                  />
                )),
              headerLeftWrapperRef.current
            )}
          {storeHeaderLeftWrapperRef.current &&
            boostParticles.filter((p) => p.sourceScreen === 'store').length > 0 &&
            createPortal(
              boostParticles
                .filter((p) => p.sourceScreen === 'store')
                .map((particle) => (
                  <BoostParticle
                    key={particle.id}
                    data={particle}
                    containerRef={storeHeaderLeftWrapperRef}
                    boostAreaRef={storeActiveBoostAreaRef}
                    onImpact={(data) => {
                      const wrapper = storeHeaderLeftWrapperRef.current;
                      const el = storeActiveBoostAreaRef.current;
                      if (wrapper && el) {
                        const wr = wrapper.getBoundingClientRect();
                        const scale = wr.width / wrapper.offsetWidth;
                        const slotIndex = data.targetSlotIndex ?? 0;
                        const tx = el.offsetLeft + slotIndex * 28 + 13;
                        const ty = el.offsetTop + 11;
                        setBoostBursts((prev) => [
                          ...prev,
                          {
                            id: `boost-impact-${Date.now()}`,
                            x: wr.left + tx * scale,
                            y: wr.top + ty * scale,
                            startTime: Date.now(),
                          },
                        ]);
                      }
                      setActiveBoosts((prev) => applyBoostParticleImpact(prev, data));
                    }}
                    onComplete={() => setBoostParticles((prev) => prev.filter((p) => p.id !== particle.id))}
                  />
                )),
              storeHeaderLeftWrapperRef.current
            )}

        </div>

      </div>
      </div>
      </div>
      </>
    </ErrorBoundary>
  );
}
