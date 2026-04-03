
import React, { useState, useRef, useEffect } from 'react';
import { TabType } from '../types';
import { assetPath } from '../utils/assetPath';
import { getPlantCoinValue } from '../utils/plantValue';
import {
  getWildGrowthDisplaySecForLevel,
  isWildGrowthMaxLevel,
  WILD_GROWTH_UNLOCK_PLAYER_LEVEL,
} from '../utils/wildGrowth';
import { PlantWithPot } from './PlantWithPot';
import { hasGoldenPotHarvest150, hasGoldenPotProduction150 } from '../constants/goldenPotBonuses';

export interface UpgradeState {
  level: number;
  progress: number;
}

export type SeedsState = Record<string, UpgradeState>;

/**
 * Seed level from highest plant discovered (custom curve).
 * Start at 1, then:
 * - Plant 4  → seed 2
 * - Plant 7  → seed 3
 * - Plant 10 → seed 4
 * - Plant 13 → seed 5
 * - Plant 16 → seed 6
 * - Plant 19 → seed 7
 * - Plant 22 → seed 8
 * - Plant 24 → seed 9
 */
export const getSeedLevelFromHighestPlant = (highestPlant: number): number => {
  const hp = Math.max(1, Math.floor(highestPlant));
  if (hp >= 24) return 9;
  if (hp >= 22) return 8;
  if (hp >= 19) return 7;
  if (hp >= 16) return 6;
  if (hp >= 13) return 5;
  if (hp >= 10) return 4;
  if (hp >= 7) return 3;
  if (hp >= 4) return 2;
  return 1;
};

/** Lucky Seed (bonus_seeds) proc chance percentage (0-100%, 10% per level, max level 10). */
export const getBonusSeedChance = (seedsState: SeedsState): number => {
  const level = seedsState.bonus_seeds?.level ?? 0;
  return Math.min(level * 10, 100); // Cap at 100%
};

/** Check if bonus_seeds upgrade is at max level */
export const isBonusSeedMaxed = (seedsState: SeedsState): boolean => {
  const level = seedsState.bonus_seeds?.level ?? 0;
  return level >= 10; // Max at level 10 (100%)
};

/** Check if double_seeds upgrade is at max level (max level 10 = 100%). */
export const isDoubleSeedsMaxed = (seedsState: SeedsState): boolean => {
  const level = seedsState.double_seeds?.level ?? 0;
  return level >= 10;
};

/** Storage Capacity: base 5 + level, max 15 (levels 0–10). */
export const SEED_STORAGE_BASE = 5;
export const SEED_STORAGE_MAX_CAP = 15;

export const getSeedStorageMax = (seedsState: SeedsState): number => {
  const level = seedsState?.seed_storage?.level ?? 0;
  return Math.min(SEED_STORAGE_MAX_CAP, SEED_STORAGE_BASE + level);
};

export const isSeedStorageMaxed = (seedsState: SeedsState): boolean => {
  const level = seedsState?.seed_storage?.level ?? 0;
  return SEED_STORAGE_BASE + level >= SEED_STORAGE_MAX_CAP;
};

/** Get the merge harvest chance percentage (5% per level, chance to harvest adjacent crops on merge) */
export const getMergeHarvestChance = (cropsState: Record<string, UpgradeState>): number => {
  const level = cropsState.merge_harvest?.level ?? 0;
  return level * 5;
};

/** Check if merge_harvest upgrade is at max level (50%) */
export const isMergeHarvestMaxed = (cropsState: Record<string, UpgradeState>): boolean => {
  const level = cropsState.merge_harvest?.level ?? 0;
  return level >= 10; // Max at level 10 (50%)
};

/** Get harvest speed level (now in Garden tab) */
export const getHarvestSpeedLevel = (cropsState: Record<string, UpgradeState>): number => {
  return cropsState?.harvest_speed?.level ?? 0;
};

/** Check if plot_expansion is maxed (no more locked cells to unlock) */
export const isPlotExpansionMaxed = (lockedCellCount: number): boolean => {
  return lockedCellCount <= 0;
};

/** Check if fertile_soil is maxed (all unlocked cells are already fertile) */
export const isFertileSoilMaxed = (fertilizableCellCount: number): boolean => {
  return fertilizableCellCount <= 0;
};

/** Coin value for a plant goal tier — matches economy plant values. */
export const getCoinValueForPlantLevel = (plantLevel: number): number => {
  return getPlantCoinValue(plantLevel);
};

/**
 * Surplus Recharges upgrade multiplier.
 * - Level 0 => 0 (no surplus coins from overflow)
 * - Level 1 => 1.0x, each extra level +0.5x, max 5.0x (caps at level 9)
 */
export const getSurplusRechargesMultiplier = (seedsState: SeedsState): number => {
  const level = seedsState.seed_surplus?.level ?? 0;
  if (level <= 0) return 0;
  return Math.min(5, 1 + 0.5 * (level - 1));
};

export const isSurplusRechargesMaxed = (seedsState: SeedsState): boolean => {
  return (seedsState.seed_surplus?.level ?? 0) >= 9;
};

/** Base coin per surplus event from seed tier (auto-scales with plant discoveries every 3 highest plants). */
export const getSurplusRechargeBaseFromHighestPlant = (highestPlantEver: number): number => {
  const tier = getSeedLevelFromHighestPlant(highestPlantEver);
  return getCoinValueForPlantLevel(tier);
};

/**
 * Coins per seed/harvest surplus event (seed storage overflow or harvest charge overflow).
 * = (coin value for current seed tier) × (Surplus Recharges multiplier)
 */
export const getSeedSurplusValue = (seedsState: SeedsState, highestPlantEver: number): number => {
  const mult = getSurplusRechargesMultiplier(seedsState);
  if (mult <= 0) return 0;
  const base = getSurplusRechargeBaseFromHighestPlant(highestPlantEver);
  const raw = base * mult;
  /** Always round up to nearest 5 (e.g. 7 → 10). */
  return Math.ceil(raw / 5) * 5;
};

export type HarvestState = Record<string, UpgradeState>;

/** Rewarded offer item that appears at top of upgrade list */
export interface RewardedOffer {
  id: string;
  name: string;
  icon: string;
  description: string;
  /** Which tab this offer appears in */
  tab: TabType;
  /** Time remaining in seconds (optional, for countdown display) */
  timeRemaining?: number;
}

interface UpgradeListProps {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
  money: number;
  setMoney: React.Dispatch<React.SetStateAction<number>>;
  /** When provided, SEEDS tab uses this state (enables Seed Production to drive auto progress in App). */
  seedsState?: SeedsState;
  setSeedsState?: React.Dispatch<React.SetStateAction<SeedsState>>;
  /** When provided, HARVEST tab uses this state (enables Harvest Speed to drive auto progress in App). */
  harvestState?: HarvestState;
  setHarvestState?: React.Dispatch<React.SetStateAction<HarvestState>>;
  /** When provided, CROPS tab uses this state (enables Crop Merging multiplier in App). */
  cropsState?: Record<string, UpgradeState>;
  setCropsState?: React.Dispatch<React.SetStateAction<Record<string, UpgradeState>>>;
  /** Number of locked cells remaining (for plot_expansion max check) */
  lockedCellCount?: number;
  /** Called when plot_expansion is upgraded to unlock a cell */
  onUnlockCell?: () => void;
  /** Number of unlocked non-fertile cells remaining (for fertile_soil max check) */
  fertilizableCellCount?: number;
  /** Called when fertile_soil is upgraded to make a cell fertile */
  onFertilizeCell?: () => void;
  /** Highest plant level ever achieved by the player */
  highestPlantEver?: number;
  /** Plant levels that have a mastered (golden) pot unlocked. */
  masteredPlantLevels?: number[];
  /** Rewarded offers to display at top of relevant tabs */
  rewardedOffers?: RewardedOffer[];
  /** Called when the rewarded offer panel (not the button) is clicked - e.g. reopen limited offer popup */
  onRewardedOfferPanelClick?: (offerId: string) => void;
  /** Called when the Watch Ad button is clicked - e.g. open fake ad directly (skip popup) */
  onRewardedOfferClick?: (offerId: string) => void;
  /** Player level (for Seeds tab upgrade locking) */
  playerLevel?: number;
  /** When set, scroll to this upgrade and flash it blue (from level-up Unlock Now) */
  pendingUnlockUpgradeId?: string | null;
  /** When set (e.g. after declining limited offer), scroll to this offer and flash yellow, then return to light yellow */
  pendingOfferHighlightId?: string | null;
  /** When true, panel is expanded (use stronger ease-out for opening) */
  isExpanded?: boolean;
  /** Offer id whose popup is currently open; don't remove that offer from the list when timer hits 0 until popup is closed */
  protectedOfferId?: string | null;
  /** FTUE 10: when set (e.g. 'seed_production'), flash this upgrade row green and add id to purchase button for finger overlay */
  ftue10GreenFlashUpgradeId?: string | null;
  /** FTUE 10: ref for the purchase button that gets the green flash (so App can measure rect for overlay) */
  ftue10PurchaseButtonRef?: React.MutableRefObject<HTMLButtonElement | null>;
  /** FTUE 10: when true, disable scroll so only the purchase button can be interacted with */
  ftue10LockScroll?: boolean;
  /** Called after an upgrade is purchased (for FTUE 10 completion) */
  onUpgradePurchase?: (upgradeId: string) => void;
  /** Golden pots unlocked — some tiers supersede upgrade visuals and caps. */
  goldenPotCount?: number;
}

interface UpgradeDef {
  id: string;
  name: string;
  icon: string;
  description?: string;
}

/** Format cost for display (e.g., 1500 -> "1.5K", 2500000 -> "2.5M") */
const formatCost = (cost: number): string => {
  if (cost >= 1000000) {
    const millions = cost / 1000000;
    return millions % 1 === 0 ? `${millions}M` : `${millions.toFixed(1)}M`;
  }
  if (cost >= 1000) {
    const thousands = cost / 1000;
    return thousands % 1 === 0 ? `${thousands}K` : `${thousands.toFixed(1)}K`;
  }
  return cost.toString();
};

/** Seeds tab list order (must match SEEDS_UNLOCK_LEVELS + level-up rows for that tab). */
const SEEDS_UPGRADES: UpgradeDef[] = [
  { id: 'seed_production', name: 'Production Speed', icon: assetPath('/assets/icons/icon_seedproduction.png'), description: 'Increase how fast seeds are produced' },
  { id: 'double_seeds', name: 'DOUBLE SEEDS', icon: assetPath('/assets/icons/icon_seedquality.png'), description: 'Increase chance to spawn 2 seeds at a time' },
  { id: 'bonus_seeds', name: 'Lucky Seed', icon: assetPath('/assets/icons/icon_luckyseed.png'), description: 'Increase chance to produce a bonus higher level seed' },
];

const SEEDS_UNLOCK_LEVELS: Record<string, number> = {
  seed_production: 1,
  seed_storage: 2, // Storage Capacity: unlocks at level 2
  double_seeds: 4,
  bonus_seeds: 8,
};

const CROPS_UNLOCK_LEVELS: Record<string, number> = {
  harvest_speed: 1,
  plot_expansion: 2,
  wild_growth: WILD_GROWTH_UNLOCK_PLAYER_LEVEL,
  crop_value: 9,
  merge_harvest: 10,
};

const HARVEST_UNLOCK_LEVELS: Record<string, number> = {
  customer_speed: 1,
  market_value: 3,
  seed_surplus: 7,
  happy_customer: 10,
};

/** Pricing tier: controls per-purchase scaling multiplier. */
export type UpgradeCostTier = 'normal' | 'medium' | 'high';

/** Scaling multipliers per tier (used after first purchase). */
export const UPGRADE_COST_STRENGTH: Record<UpgradeCostTier, number> = {
  normal: 1.8,
  medium: 2.0,
  high: 2.2,
};

/**
 * Which scaling tier each upgrade uses. Unlisted ids default to `normal`.
 * Current design: universal normal scaling for all upgrades.
 * Note: Garden Expansion (`plot_expansion`) ignores tiers and always uses
 * its dedicated special-case cost curve in `calculateUpgradeCost`.
 */
export const UPGRADE_COST_TIER_BY_ID: Record<string, UpgradeCostTier> = {
  seed_production: 'normal',
  seed_storage: 'normal',
  harvest_speed: 'normal',
  customer_speed: 'normal',
  double_seeds: 'normal',
  bonus_seeds: 'normal',
  wild_growth: 'normal',
  seed_surplus: 'normal',
  merge_harvest: 'normal',
  surplus_sales: 'normal',
  premium_orders: 'normal',
  fertile_soil: 'normal',
  crop_value: 'normal',
  happy_customer: 'normal',
  plot_expansion: 'normal',
  market_value: 'normal',
};

/**
 * Initial cost formula:
 * - first = 150 × max(1, unlockLevel × 0.7)
 *
 * Scaling formula:
 * - next = previous × tierScale (normal/medium/high)
 *
 * Final rounding:
 * - < 100 -> nearest 10
 * - < 1,000 -> nearest 25
 * - < 10,000 -> nearest 100
 * - < 100,000 -> nearest 1,000
 * - >= 100,000 -> nearest 1,000
 *
 * Every purchasable upgrade uses `calculateUpgradeCost` → `roundUpgradeCost` (panel + `handleUpgrade` only).
 */
const INITIAL_COST_BASE = 150;
const PLOT_EXPANSION_INITIAL_COST_BASE = 1000;
const PLOT_EXPANSION_SCALE = 1.3;
const INITIAL_COST_UNLOCK_MULTIPLIER = 0.7;
const INITIAL_COST_MIN_UNLOCK_FACTOR = 1;

/** Single rounding path for all upgrade prices (export for tests / tooling). */
export function roundUpgradeCost(value: number): number {
  if (value < 100) return Math.round(value / 10) * 10;
  if (value < 1000) return Math.round(value / 25) * 25;
  if (value < 10000) return Math.round(value / 100) * 100;
  if (value < 100000) return Math.round(value / 1000) * 1000;
  return Math.round(value / 1000) * 1000;
}

const getUpgradeUnlockLevel = (upgradeId: string): number =>
  SEEDS_UNLOCK_LEVELS[upgradeId] ?? CROPS_UNLOCK_LEVELS[upgradeId] ?? HARVEST_UNLOCK_LEVELS[upgradeId] ?? 1;

const getUpgradeCostStrength = (upgradeId: string): number => {
  const tier = UPGRADE_COST_TIER_BY_ID[upgradeId] ?? 'normal';
  return UPGRADE_COST_STRENGTH[tier];
};

/** Next purchase cost (currentLevel = level before buying). Single source for all upgrades. */
export function calculateUpgradeCost(upgradeId: string, currentLevel: number): number {
  if (currentLevel < 0) return 0;

  // Garden Expansion uses a fixed special-case curve:
  // initial = 1000, then previous x 1.3 (same rounding buckets).
  if (upgradeId === 'plot_expansion') {
    let cost = roundUpgradeCost(PLOT_EXPANSION_INITIAL_COST_BASE);
    for (let i = 0; i < currentLevel; i++) {
      cost = roundUpgradeCost(cost * PLOT_EXPANSION_SCALE);
    }
    return cost;
  }

  const tierScale = getUpgradeCostStrength(upgradeId);
  const unlockLevel = getUpgradeUnlockLevel(upgradeId);
  const unlockFactor = Math.max(INITIAL_COST_MIN_UNLOCK_FACTOR, unlockLevel * INITIAL_COST_UNLOCK_MULTIPLIER);
  let cost = roundUpgradeCost(INITIAL_COST_BASE * unlockFactor);

  for (let i = 0; i < currentLevel; i++) {
    cost = roundUpgradeCost(cost * tierScale);
  }
  return cost;
}

/** Highest player level that shows a scripted unlock popup (Plant Collection at 5 … Happy Customers at 11). */
export const MAX_LEVEL_WITH_CUSTOM_UNLOCK_POPUP = 10;

export type LevelUnlockInfo = {
  title: string;
  description: string;
  icon: string;
  upgradeId?: string;
  tab?: TabType;
  /** Level-up header: plant 1 + golden pot instead of icon image */
  plantCollectionHeader?: boolean;
  /** After confirm: go to Collection (barn) */
  navigateToBarnOnUnlock?: boolean;
  /** Primary button label (default Unlock Now! in LevelUpPopup) */
  levelUpButtonText?: string;
};

/** Get level unlock info for level-up popup. Returns title, description, icon, and optionally upgradeId/tab for Unlock Now behavior. */
export const getLevelUnlockInfo = (level: number): LevelUnlockInfo => {
  type Row = {
    level: number;
    upgradeId: string;
    tab: TabType;
    name: string;
    description: string;
    icon: string;
    popupDescription?: string;
    plantCollectionHeader?: boolean;
    navigateToBarnOnUnlock?: boolean;
    buttonText?: string;
  };
  const allUnlocks: Row[] = [
    { level: 2, upgradeId: 'plot_expansion', tab: 'CROPS', name: 'Garden Expansion', description: 'Unlock additional plots in the garden', icon: 'icon_plotexpansion.png', popupDescription: 'You can now unlock additional plots in the garden' },
    { level: 3, upgradeId: 'market_value', tab: 'HARVEST', name: 'Market Value', description: 'Increase the coins earned when completing orders', icon: 'icon_marketvalue.png', popupDescription: 'You can now increase the coins earned when completing orders' },
    { level: 4, upgradeId: 'double_seeds', tab: 'SEEDS', name: 'Double Seeds', description: 'Increase chance to spawn 2 seeds at a time', icon: 'icon_seedquality.png', popupDescription: 'Increase chance to spawn 2 seeds at a time' },
    {
      level: 5,
      upgradeId: '',
      tab: 'CROPS',
      name: 'Plant Collection',
      description: 'Collect and upgrade your plants for bonuses.',
      icon: 'icon_plantmastery.png',
      popupDescription: 'Collect and upgrade your plants for bonuses.',
      plantCollectionHeader: true,
      navigateToBarnOnUnlock: true,
      buttonText: 'View Collection',
    },
    { level: 6, upgradeId: 'wild_growth', tab: 'CROPS', name: 'Wild Growth', description: 'Plants automatically duplicate over time', icon: 'icon_luckymerge.png', popupDescription: 'Plants in your garden will now automatically duplicate over time' },
    { level: 7, upgradeId: 'seed_surplus', tab: 'HARVEST', name: 'Surplus Recharges', description: 'Increase coins gained from extra seed and harvest recharges', icon: 'icon_seedsurplus.png', popupDescription: 'Increase coins gained from extra seed and harvest recharges' },
    { level: 8, upgradeId: 'bonus_seeds', tab: 'SEEDS', name: 'Lucky Seed', description: 'Increase chance to produce a bonus higher level seed', icon: 'icon_luckyseed.png', popupDescription: 'Seeds now have a chance to produce an extra higher level plant' },
    { level: 9, upgradeId: 'crop_value', tab: 'CROPS', name: 'Crop Yield', description: 'Increase how many crops your plants produce when harvesting', icon: 'icon_cropvalue.png', popupDescription: 'You can now increase how many crops your plants produce when harvesting' },
    { level: 10, upgradeId: 'happy_customer', tab: 'HARVEST', name: 'Happy Customers', description: 'Increase chance that customers pay double for orders', icon: 'icon_happycustomer.png', popupDescription: 'You can now increase the chance for customers to pay double coins for orders' },
  ];
  const match = allUnlocks.find((u) => u.level === level);
  if (match) {
    const desc =
      match.popupDescription ?? (match.upgradeId ? `You can now ${match.description.toLowerCase()}` : match.description);
    return {
      title: match.name,
      description: desc,
      icon: assetPath(`/assets/icons/${match.icon}`),
      upgradeId: match.upgradeId || undefined,
      tab: match.upgradeId ? match.tab : undefined,
      plantCollectionHeader: match.plantCollectionHeader,
      navigateToBarnOnUnlock: match.navigateToBarnOnUnlock,
      levelUpButtonText: match.buttonText,
    };
  }
  return {
    title: `Level ${level}`,
    description: "You've reached a new level!",
    icon: assetPath('/assets/icons/icon_level.png'),
    upgradeId: undefined,
    tab: undefined,
  };
};

const ICON_LOCK = assetPath('/assets/icons/icon_lock.png');
const ICON_COIN_SMALL = assetPath('/assets/icons/icon_coin_small.png');

/** Crops tab list order (must match CROPS_UNLOCK_LEVELS + level-up rows for that tab). */
const CROPS_UPGRADES: UpgradeDef[] = [
  { id: 'harvest_speed', name: 'Harvest Speed', icon: assetPath('/assets/icons/icon_harvestspeed.png'), description: 'Increase automatic harvest cycle speed' },
  { id: 'plot_expansion', name: 'Garden Expansion', icon: assetPath('/assets/icons/icon_plotexpansion.png'), description: 'Unlock additional plots in the garden' },
  { id: 'wild_growth', name: 'Wild Growth', icon: assetPath('/assets/icons/icon_luckymerge.png'), description: 'Plants automatically duplicate over time' },
  { id: 'crop_value', name: 'Crop Yield', icon: assetPath('/assets/icons/icon_cropvalue.png'), description: 'Plants produce more crops per harvest' },
];

/** Harvest tab order = vertical list order. Unlock scroll uses `upgradeRowRefs[upgrade.id]` — keep in sync with HARVEST_UNLOCK_LEVELS / getLevelUnlockInfo. */
const HARVEST_UPGRADES: UpgradeDef[] = [
  { id: 'customer_speed', name: 'Order Speed', icon: assetPath('/assets/icons/icon_customerspeed.png'), description: 'Reduce the time it takes for new orders to appear' },
  { id: 'market_value', name: 'Market Value', icon: assetPath('/assets/icons/icon_marketvalue.png'), description: 'Increase the coins earned when completing orders' },
  { id: 'seed_surplus', name: 'SURPLUS RECHARGES', icon: assetPath('/assets/icons/icon_seedsurplus.png'), description: 'Extra Harvest & Seed recharges sell for more coins' },
  { id: 'happy_customer', name: 'Happy Customer', icon: assetPath('/assets/icons/icon_happycustomer.png'), description: 'Increase chance that customers pay double for orders' },
];

const getUpgradesForTab = (tab: TabType): UpgradeDef[] => {
  if (tab === 'SEEDS') return SEEDS_UPGRADES;
  if (tab === 'CROPS') return CROPS_UPGRADES;
  return HARVEST_UPGRADES;
};

/** Seeds tab green (matches "SEEDS" tab label) */
const SEEDS_VALUE_GREEN = '#6a994e';

/** Current value display for Seeds upgrades only; null = show LV. */
const getSeedsUpgradeValue = (upgradeId: string, level: number, seedsState?: SeedsState): string | null => {
  switch (upgradeId) {
    case 'seed_production':
      return `${Math.min(100, 10 + level * 10)}%`;
    case 'seed_storage':
      return `${Math.min(SEED_STORAGE_MAX_CAP, SEED_STORAGE_BASE + level)}`;
    case 'double_seeds':
      return `${Math.min(100, level * 10)}%`;
    case 'bonus_seeds':
      return `${Math.min(100, level * 10)}%`;
    case 'seed_surplus':
      return level <= 0 ? '1.0x' : `${Math.min(5, 1 + 0.5 * (level - 1)).toFixed(1)}x`;
    default:
      return null;
  }
};

/** Current value display for Crops (Garden) upgrades; null = show LV. */
const getCropsUpgradeValue = (upgradeId: string, level: number): string | null => {
  switch (upgradeId) {
    case 'harvest_speed':
      return `${Math.min(100, 10 + level * 10)}%`;
    case 'plot_expansion':
      return `+1`;
    case 'crop_value':
      return `${Math.min(10, 1 + level)}`;
    case 'wild_growth':
      return `${getWildGrowthDisplaySecForLevel(level)}s`;
    case 'merge_harvest':
      return `${level * 5}%`;
    default:
      return null;
  }
};

/** Current value display for Harvest (Orders) upgrades; null = show LV. */
const getHarvestUpgradeValue = (upgradeId: string, level: number): string | null => {
  switch (upgradeId) {
    case 'customer_speed':
      return `${Math.max(0, 10 - 1 * level)}s`;
    case 'market_value':
      return `${Math.min(3, 1 + 0.2 * level).toFixed(1)}x`;
    case 'seed_surplus':
      return level <= 0 ? '1.0x' : `${Math.min(5, 1 + 0.5 * (level - 1)).toFixed(1)}x`;
    case 'happy_customer':
      return `${Math.min(50, level * 5)}%`;
    default:
      return null;
  }
};

/** Crop Yield: resources per plant harvest (1 base + 1 per level, max 10). Affects goal progress, not coins. */
export const getCropYieldPerHarvest = (cropsState: Record<string, UpgradeState>): number => {
  const level = cropsState?.crop_value?.level ?? 0;
  return Math.min(10, 1 + level);
};

/** Check if crop_value (Crop Yield) is at max level (10 resources per harvest) */
export const isCropYieldMaxed = (cropsState: Record<string, UpgradeState>): boolean => {
  const level = cropsState?.crop_value?.level ?? 0;
  return level >= 9; // 1 + 9 = 10 max
};

/** Order Speed: goal loading time in seconds (10 base - 1 per level, min 0). */
export const getGoalLoadingSeconds = (harvestState: HarvestState, _goldenPotCount = 0): number => {
  const level = harvestState?.customer_speed?.level ?? 0;
  return Math.max(0, 10 - 1 * level);
};

export const isCustomerSpeedMaxed = (harvestState: Record<string, UpgradeState>, _goldenPotCount = 0): boolean => {
  const level = harvestState?.customer_speed?.level ?? 0;
  return level >= 10; // 10 - 1*10 = 0s
};

/** Market Value: +0.2× per purchase, max 3.0× (reached at level 10). */
export const getMarketValueMultiplier = (harvestState: HarvestState): number => {
  const level = harvestState?.market_value?.level ?? 0;
  return Math.min(3, 1 + 0.2 * level);
};

export const isMarketValueMaxed = (harvestState: Record<string, UpgradeState>): boolean => {
  const level = harvestState?.market_value?.level ?? 0;
  return level >= 10;
};

/** Premium Orders: minimum level for 50% above chance (1 + level). When creating order, 50% chance plant is above this. */
export const getPremiumOrdersMinLevel = (harvestState: HarvestState): number => {
  const level = harvestState?.premium_orders?.level ?? 0;
  return 1 + level;
};

export const isPremiumOrdersMaxed = (harvestState: Record<string, UpgradeState>): boolean => {
  const level = harvestState?.premium_orders?.level ?? 0;
  return level >= 4; // Max at 5 (50% above level 5 = always 5)
};

/** Surplus Sales: multiplier for coin harvest (1.0 + 0.2 per level) */
export const getSurplusSalesMultiplier = (harvestState: HarvestState): number => {
  // Temporarily disabled: "Surplus Sales" mechanic is not active.
  return 1;
};

/** Player level at which Surplus Sales unlocks (coin harvest for plants without goals). */
export const SURPLUS_SALES_UNLOCK_PLAYER_LEVEL = 9;

/** Whether Surplus Sales is unlocked (plants without goals can be harvested for coins). Active as soon as player reaches level 8, at 1.0x multiplier; upgrade points increase multiplier. */
export const isSurplusSalesUnlocked = (harvestState: HarvestState, playerLevel: number): boolean => {
  // Temporarily disabled: "Surplus Sales" mechanic is not active.
  return false;
};

/** Happy Customer: chance to double order payment (0-50%, 5% per level) */
export const getHappyCustomerChance = (harvestState: HarvestState): number => {
  const level = harvestState?.happy_customer?.level ?? 0;
  return Math.min(50, level * 5);
};

export const isHappyCustomerMaxed = (harvestState: Record<string, UpgradeState>): boolean => {
  const level = harvestState?.happy_customer?.level ?? 0;
  return level >= 10; // 50%
};

const TABS: TabType[] = ['SEEDS', 'CROPS', 'HARVEST'];

const parseCost = (cost: string): number => {
  const num = parseFloat(cost.replace(/[^0-9.]/g, ''));
  if (cost.includes('K')) return num * 1000;
  if (cost.includes('M')) return num * 1000000;
  return num;
};

/** Get the display cost string for an upgrade based on its current level */
const getUpgradeCost = (upgradeId: string, currentLevel: number): string => {
  const cost = calculateUpgradeCost(upgradeId, currentLevel);
  return formatCost(cost);
};

/** Get the numeric cost for an upgrade based on its current level */
const getUpgradeCostValue = (upgradeId: string, currentLevel: number): number => {
  return calculateUpgradeCost(upgradeId, currentLevel);
};

const createInitialState = (upgrades: UpgradeDef[]) =>
  upgrades.reduce((acc, curr) => ({ ...acc, [curr.id]: { level: 1, progress: 0 } }), {} as Record<string, UpgradeState>);

/** Initial seeds state: seed_production, seed_storage, bonus_seeds, seed_surplus start at level 0.
 * Lucky Seed (bonus_seeds) starts at 0% chance (max 100% at level 10).
 */
export const createInitialSeedsState = (): SeedsState => ({
  ...createInitialState(SEEDS_UPGRADES),
  seed_production: { level: 0, progress: 0 },
  seed_storage: { level: 0, progress: 0 },
  double_seeds: { level: 0, progress: 0 },
  bonus_seeds: { level: 0, progress: 0 },
  seed_surplus: { level: 0, progress: 0 },
});

/** Initial crops state: all upgrades start at level 0 */
export const createInitialCropsState = (): Record<string, UpgradeState> => ({
  harvest_speed: { level: 0, progress: 0 },
  plot_expansion: { level: 0, progress: 0 },
  crop_value: { level: 0, progress: 0 },
  fertile_soil: { level: 0, progress: 0 },
  wild_growth: { level: 0, progress: 0 },
  merge_harvest: { level: 0, progress: 0 },
});

/** Initial harvest (Orders) state: all upgrades start at level 0 */
export const createInitialHarvestState = (): Record<string, UpgradeState> => ({
  customer_speed: { level: 0, progress: 0 },
  market_value: { level: 0, progress: 0 },
  surplus_sales: { level: 0, progress: 0 },
  happy_customer: { level: 0, progress: 0 },
});

export const UpgradeList: React.FC<UpgradeListProps> = ({ activeTab, onTabChange, money, setMoney, seedsState: propsSeedsState, setSeedsState: propsSetSeedsState, harvestState: propsHarvestState, setHarvestState: propsSetHarvestState, cropsState: propsCropsState, setCropsState: propsSetCropsState, lockedCellCount = 0, onUnlockCell, fertilizableCellCount = 0, onFertilizeCell, highestPlantEver = 1, masteredPlantLevels = [], rewardedOffers = [], onRewardedOfferPanelClick, onRewardedOfferClick, playerLevel = 1, pendingUnlockUpgradeId = null, pendingOfferHighlightId = null, isExpanded = false, protectedOfferId = null, ftue10GreenFlashUpgradeId = null, ftue10PurchaseButtonRef, ftue10LockScroll = false, onUpgradePurchase, goldenPotCount = 0 }) => {
  const [internalSeedsState, setInternalSeedsState] = useState<Record<string, UpgradeState>>(createInitialSeedsState);
  const seedsState = propsSeedsState ?? internalSeedsState;
  const setSeedsState = propsSetSeedsState ?? setInternalSeedsState;
  const [internalCropsState, setInternalCropsState] = useState<Record<string, UpgradeState>>(createInitialCropsState);
  const cropsState = propsCropsState ?? internalCropsState;
  const setCropsState = propsSetCropsState ?? setInternalCropsState;
  const [internalHarvestState, setInternalHarvestState] = useState<Record<string, UpgradeState>>(createInitialHarvestState);
  const harvestState = propsHarvestState ?? internalHarvestState;
  const setHarvestState = propsSetHarvestState ?? setInternalHarvestState;
  const [flashingIds, setFlashingIds] = useState<Set<string>>(new Set());
  const [pressedId, setPressedId] = useState<string | null>(null);
  const [unlockFlashIds, setUnlockFlashIds] = useState<Set<string>>(new Set());
  const [completedUnlockFlashIds, setCompletedUnlockFlashIds] = useState<Set<string>>(new Set());
  const upgradeRowRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const offerRowRefs = useRef<Record<string, HTMLDivElement | null>>({});
  /** Temporary yellow flash for offer card when scroll lands (then returns to light yellow) */
  const [offerFlashIds, setOfferFlashIds] = useState<Set<string>>(new Set());

  const scrollRefs = {
    SEEDS: useRef<HTMLDivElement>(null),
    CROPS: useRef<HTMLDivElement>(null),
    HARVEST: useRef<HTMLDivElement>(null),
  };

  const onTabChangeRef = useRef(onTabChange);
  const activeTabRef = useRef(activeTab);
  onTabChangeRef.current = onTabChange;
  activeTabRef.current = activeTab;

  const [dragOffset, setDragOffset] = useState(0);
  const [isHorizontalDragging, setIsHorizontalDragging] = useState(false);

  useEffect(() => {
    const el = (scrollRefs as any)[activeTab].current;
    if (el) el.scrollTo({ top: 0, behavior: 'auto' });
  }, [activeTab]);

  useEffect(() => {
    if (pendingUnlockUpgradeId) {
      setCompletedUnlockFlashIds(prev => { const n = new Set(prev); n.delete(pendingUnlockUpgradeId!); return n; });
    } else {
      setCompletedUnlockFlashIds(new Set());
    }
  }, [pendingUnlockUpgradeId]);

  useEffect(() => {
    if (!pendingUnlockUpgradeId) return;
    if (!isExpanded) {
      setUnlockFlashIds(prev => { const n = new Set(prev); n.delete(pendingUnlockUpgradeId!); return n; });
      setCompletedUnlockFlashIds(prev => new Set(prev).add(pendingUnlockUpgradeId!));
      return;
    }

    const TAB_SLIDE_MS = 700;
    const SCROLL_DURATION_MS = 800;
    const FLASH_DURATION_MS = 600;
    let scrollRafId: number | null = null;

    const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

    const scrollT = setTimeout(() => {
      const el = upgradeRowRefs.current[pendingUnlockUpgradeId];
      const scrollContainer = (scrollRefs as Record<string, React.RefObject<HTMLDivElement | null>>)[activeTab]?.current;
      if (el && scrollContainer) {
        const containerRect = scrollContainer.getBoundingClientRect();
        const elRect = el.getBoundingClientRect();
        const elTopInContent = elRect.top - containerRect.top + scrollContainer.scrollTop;
        const elBottomInContent = elTopInContent + elRect.height;
        const containerHeight = scrollContainer.clientHeight;
        const maxScroll = scrollContainer.scrollHeight - containerHeight;
        const scrollTop = scrollContainer.scrollTop;
        const padTop = 12;
        const padBottom = 12;
        // Minimal scroll so the row is fully visible — avoids over-scrolling past the target (e.g. Market Value).
        let scrollTarget = scrollTop;
        if (elTopInContent < scrollTop + padTop) {
          scrollTarget = elTopInContent - padTop;
        } else if (elBottomInContent > scrollTop + containerHeight - padBottom) {
          scrollTarget = elBottomInContent - containerHeight + padBottom;
        }
        scrollTarget = Math.max(0, Math.min(maxScroll, scrollTarget));
        const startTop = scrollContainer.scrollTop;
        const distance = scrollTarget - startTop;
        const startTime = Date.now();

        const animate = () => {
          const elapsed = Date.now() - startTime;
          const progress = Math.min(1, elapsed / SCROLL_DURATION_MS);
          const eased = easeOutCubic(progress);
          scrollContainer.scrollTop = startTop + distance * eased;
          if (progress < 1) {
            scrollRafId = requestAnimationFrame(animate);
          } else {
            setUnlockFlashIds(prev => new Set(prev).add(pendingUnlockUpgradeId));
          }
        };
        if (Math.abs(distance) > 2) {
          scrollRafId = requestAnimationFrame(animate);
        } else {
          setUnlockFlashIds(prev => new Set(prev).add(pendingUnlockUpgradeId));
        }
      } else {
        setUnlockFlashIds(prev => new Set(prev).add(pendingUnlockUpgradeId));
      }
    }, TAB_SLIDE_MS);

    const clearT = setTimeout(() => {
      setUnlockFlashIds(prev => {
        const next = new Set(prev);
        next.delete(pendingUnlockUpgradeId);
        return next;
      });
      setCompletedUnlockFlashIds(prev => new Set(prev).add(pendingUnlockUpgradeId));
    }, TAB_SLIDE_MS + SCROLL_DURATION_MS + FLASH_DURATION_MS);

    return () => {
      clearTimeout(scrollT);
      clearTimeout(clearT);
      if (scrollRafId) cancelAnimationFrame(scrollRafId);
      // Clear flash immediately when effect tears down (panel closed, tab switched, etc.) so it never gets stuck
      setUnlockFlashIds(prev => {
        const next = new Set(prev);
        next.delete(pendingUnlockUpgradeId);
        return next;
      });
      setCompletedUnlockFlashIds(prev => new Set(prev).add(pendingUnlockUpgradeId));
    };
  }, [pendingUnlockUpgradeId, activeTab, isExpanded]);

  // Scroll to offered card when user closed limited offer (X) - same timing as unlock; flash yellow when scroll lands, then return to light yellow
  const OFFER_FLASH_DURATION_MS = 600;
  useEffect(() => {
    if (!pendingOfferHighlightId || !isExpanded) return;

    const TAB_SLIDE_MS = 700;
    const SCROLL_DURATION_MS = 800;
    let scrollRafId: number | null = null;
    let flashTimeoutId: ReturnType<typeof setTimeout> | null = null;
    const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);
    const offerId = pendingOfferHighlightId;

    const scrollT = setTimeout(() => {
      const el = offerRowRefs.current[offerId];
      const scrollContainer = (scrollRefs as Record<string, React.RefObject<HTMLDivElement | null>>)[activeTab]?.current;
      if (el && scrollContainer) {
        const containerRect = scrollContainer.getBoundingClientRect();
        const elRect = el.getBoundingClientRect();
        const elTopInContent = elRect.top - containerRect.top + scrollContainer.scrollTop;
        const elBottomInContent = elTopInContent + elRect.height;
        const containerHeight = scrollContainer.clientHeight;
        const maxScroll = scrollContainer.scrollHeight - containerHeight;
        const scrollTop = scrollContainer.scrollTop;
        const padTop = 12;
        const padBottom = 12;
        let scrollTarget = scrollTop;
        if (elTopInContent < scrollTop + padTop) {
          scrollTarget = elTopInContent - padTop;
        } else if (elBottomInContent > scrollTop + containerHeight - padBottom) {
          scrollTarget = elBottomInContent - containerHeight + padBottom;
        }
        scrollTarget = Math.max(0, Math.min(maxScroll, scrollTarget));
        const startTop = scrollContainer.scrollTop;
        const distance = scrollTarget - startTop;
        const startTime = Date.now();

        const animate = () => {
          const elapsed = Date.now() - startTime;
          const progress = Math.min(1, elapsed / SCROLL_DURATION_MS);
          const eased = easeOutCubic(progress);
          scrollContainer.scrollTop = startTop + distance * eased;
          if (progress < 1) {
            scrollRafId = requestAnimationFrame(animate);
          } else {
            // Scroll complete: flash yellow, then clear after duration (return to light yellow)
            setOfferFlashIds(prev => new Set(prev).add(offerId));
            flashTimeoutId = setTimeout(() => {
              setOfferFlashIds(prev => {
                const next = new Set(prev);
                next.delete(offerId);
                return next;
              });
            }, OFFER_FLASH_DURATION_MS);
          }
        };
        if (Math.abs(distance) > 2) {
          scrollRafId = requestAnimationFrame(animate);
        } else {
          setOfferFlashIds(prev => new Set(prev).add(offerId));
          flashTimeoutId = setTimeout(() => {
            setOfferFlashIds(prev => {
              const next = new Set(prev);
              next.delete(offerId);
              return next;
            });
          }, OFFER_FLASH_DURATION_MS);
        }
      }
    }, TAB_SLIDE_MS);

    return () => {
      clearTimeout(scrollT);
      if (flashTimeoutId) clearTimeout(flashTimeoutId);
      if (scrollRafId) cancelAnimationFrame(scrollRafId);
    };
  }, [pendingOfferHighlightId, activeTab, isExpanded]);

  useEffect(() => {
    const cleanups: (() => void)[] = [];
    TABS.forEach((cat) => {
      const el = (scrollRefs as any)[cat].current;
      if (!el) return;
      let isDown = false;
      let directionLocked: 'none' | 'vertical' | 'horizontal' = 'none';
      let startX = 0;
      let startY = 0;
      let scrollTop = 0;
      let velocityV = 0;
      let lastY = 0;
      let lastTime = 0;
      let rafId: number;
      let scrollRafId: number;
      let liveDeltaY = 0;
      let liveDeltaX = 0;

      const momentumLoop = () => {
        if (!isDown && Math.abs(velocityV) > 0.1) {
          const maxScroll = el.scrollHeight - el.clientHeight;
          const nextScroll = el.scrollTop - velocityV;
          el.scrollTop = Math.max(0, Math.min(nextScroll, maxScroll));
          velocityV *= 0.94;
          rafId = requestAnimationFrame(momentumLoop);
        }
      };

      const scrollUpdateLoop = () => {
        if (!isDown) return;
        if (directionLocked === 'vertical') {
          const maxScroll = el.scrollHeight - el.clientHeight;
          el.scrollTop = Math.max(0, Math.min(scrollTop - liveDeltaY, maxScroll));
        } else if (directionLocked === 'horizontal') {
          setDragOffset(liveDeltaX);
        }
        scrollRafId = requestAnimationFrame(scrollUpdateLoop);
      };

      const handlePointerMove = (e: PointerEvent) => {
        if (!isDown) return;
        const dx = e.pageX - startX;
        const dy = e.pageY - startY;
        liveDeltaX = dx;
        liveDeltaY = dy;
        if (directionLocked === 'none') {
          if (Math.abs(dx) > 10 || Math.abs(dy) > 10) {
            directionLocked = Math.abs(dx) > Math.abs(dy) ? 'horizontal' : 'vertical';
            if (directionLocked === 'horizontal') setIsHorizontalDragging(true);
            scrollRafId = requestAnimationFrame(scrollUpdateLoop);
          }
          return;
        }
        if (directionLocked === 'horizontal') {
          e.preventDefault();
        } else if (directionLocked === 'vertical') {
          const now = Date.now();
          if (now - lastTime > 0) velocityV = velocityV * 0.2 + (e.pageY - lastY) * 0.8;
          lastY = e.pageY;
          lastTime = now;
        }
      };

      const handlePointerUp = (e: PointerEvent) => {
        if (!isDown) return;
        isDown = false;
        cancelAnimationFrame(scrollRafId);
        el.releasePointerCapture(e.pointerId);
        window.removeEventListener('pointermove', handlePointerMove);
        window.removeEventListener('pointerup', handlePointerUp);
        window.removeEventListener('pointercancel', handlePointerUp);
        const finalDx = e.pageX - startX;
        if (directionLocked === 'horizontal') {
          setIsHorizontalDragging(false);
          setDragOffset(0);
          const currentIndex = TABS.indexOf(activeTabRef.current);
          if (finalDx > 100 && currentIndex > 0) onTabChangeRef.current(TABS[currentIndex - 1]);
          else if (finalDx < -100 && currentIndex < TABS.length - 1) onTabChangeRef.current(TABS[currentIndex + 1]);
        } else if (directionLocked === 'vertical' && Math.abs(velocityV) > 1) {
          rafId = requestAnimationFrame(momentumLoop);
        }
      };

      const handlePointerDown = (e: PointerEvent) => {
        if (e.button !== 0 && e.pointerType === 'mouse') return;
        // Don't capture when tapping buttons or the rewarded-offer panel (so panel click opens popup)
        if ((e.target as Element).closest?.('button')) return;
        if ((e.target as Element).closest?.('[data-rewarded-offer-panel]')) return;
        isDown = true;
        directionLocked = 'none';
        velocityV = 0;
        liveDeltaY = 0;
        liveDeltaX = 0;
        cancelAnimationFrame(rafId);
        cancelAnimationFrame(scrollRafId);
        startX = e.pageX;
        startY = e.pageY;
        scrollTop = el.scrollTop;
        lastY = e.pageY;
        lastTime = Date.now();
        el.setPointerCapture(e.pointerId);
        window.addEventListener('pointermove', handlePointerMove, { passive: false });
        window.addEventListener('pointerup', handlePointerUp);
        window.addEventListener('pointercancel', handlePointerUp);
      };

      el.addEventListener('pointerdown', handlePointerDown);

      cleanups.push(() => {
        el.removeEventListener('pointerdown', handlePointerDown);
        window.removeEventListener('pointermove', handlePointerMove);
        window.removeEventListener('pointerup', handlePointerUp);
        window.removeEventListener('pointercancel', handlePointerUp);
        cancelAnimationFrame(rafId);
        cancelAnimationFrame(scrollRafId);
      });
    });
    return () => cleanups.forEach(c => c());
  }, []);

  const handleUpgrade = (id: string, category: TabType, currentLevel: number) => {
    const cost = getUpgradeCostValue(id, currentLevel);
    if (money < cost) return;
    setMoney(prev => prev - cost);

    // Special handling for plot_expansion: trigger cell unlock
    if (id === 'plot_expansion') {
      onUnlockCell?.();
    }

    const setter =
      category === 'SEEDS'
        ? setSeedsState
        : category === 'CROPS'
          ? setCropsState
          : id === 'seed_surplus'
            ? setSeedsState
            : setHarvestState;
    setter((prev: any) => {
      const current = prev[id];
      setFlashingIds(prevSet => new Set(prevSet).add(id));
      setTimeout(() => {
        setFlashingIds(prevSet => {
          const nextSet = new Set(prevSet);
          nextSet.delete(id);
          return nextSet;
        });
      }, 350);
      
      // One purchase = one level up (no 10-step progress)
      const newLevel = current.level + 1;
      
      return { ...prev, [id]: { level: newLevel, progress: 0 } };
    });
    onUpgradePurchase?.(id);
  };

  const renderRewardedOfferItem = (offer: RewardedOffer) => {
    const formatTime = (seconds: number) => {
      const s = Math.max(0, seconds);
      return `${s}s`;
    };

    // Light yellow default (#fde8a1); full yellow only during temporary flash when scroll lands
    const isFlashingYellow = offerFlashIds.has(offer.id);

    return (
      <div 
        key={offer.id}
        ref={(el) => { offerRowRefs.current[offer.id] = el; }}
        data-rewarded-offer-panel
        role="button"
        tabIndex={0}
        onClick={() => onRewardedOfferPanelClick?.(offer.id)}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onRewardedOfferPanelClick?.(offer.id); } }}
        className="relative flex flex-col transition-all duration-300 border-2 shadow-[0_2px_10px_rgba(0,0,0,0.03)] rounded-[11px] cursor-pointer active:opacity-95"
        style={{
          backgroundColor: isFlashingYellow ? '#ffd54f' : '#fde8a1',
          borderColor: isFlashingYellow ? '#f9a825' : '#fbc682',
        }}
      >
        <div className="flex items-center p-1.5 px-3">
          {/* Square Icon Box - same size as standard upgrade icon (30px); emoji or image */}
          <div className="w-[38px] h-[38px] shrink-0 flex items-center justify-center bg-[#764f40] rounded-[8px] shadow-sm overflow-hidden">
            {offer.id === 'special_delivery' ? (
              <div className="relative" style={{ width: 30, height: 34, marginTop: 2 }}>
                <PlantWithPot
                  level={Math.max(1, Math.min(24, highestPlantEver - 1))}
                  mastered={masteredPlantLevels.includes(Math.max(1, Math.min(24, highestPlantEver - 1)))}
                  wrapperClassName="h-full w-full"
                />
              </div>
            ) : offer.icon.startsWith('/') || offer.icon.includes('.png') ? (
              <img src={assetPath(offer.icon)} alt="" className="w-[30px] h-[30px] object-contain" />
            ) : (
              <span className="text-[22px] leading-none select-none">{offer.icon}</span>
            )}
          </div>
          
          {/* Text Content */}
          <div className="flex-grow px-3">
            <div className="flex items-baseline space-x-1.5">
              <h3 className="text-[13px] font-black tracking-tight uppercase leading-none text-[#583c1f]">
                {offer.name}
              </h3>
            </div>
            <div 
              className="text-[11px] font-semibold mt-0.5 tracking-tight"
              style={{ color: '#f69d42' }}
            >
              {offer.description}
            </div>
          </div>

          {/* Watch Ad Button - opens fake ad directly (stopPropagation so panel click doesn't fire); fixed width to match normal upgrade button */}
          <button 
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onRewardedOfferClick?.(offer.id);
            }}
            className="relative flex items-center w-[70px] h-8 transition-all border outline outline-1 active:translate-y-[2px] active:border-b-0 active:mb-[4px] rounded-[8px] shadow-[inset_0_1px_1px_rgba(255,255,255,0.4)]"
            style={{
              backgroundColor: '#ffd856',
              borderColor: '#f59d42',
              borderBottomWidth: '4px',
              outlineColor: '#f59d42',
              paddingLeft: '8px',
              paddingRight: '4px',
            }}
          >
            {/* Watch Ad Icon - 1.2x scale (base 18px * 1.2 = ~22px); 3px gap before timer */}
            <img
              src={assetPath('/assets/icons/icon_watchad.png')}
              alt=""
              style={{
                width: '22px',
                height: '22px',
                objectFit: 'contain',
                filter: 'brightness(0) saturate(100%) invert(56%) sepia(67%) saturate(1000%) hue-rotate(346deg) brightness(97%) contrast(88%)',
                flexShrink: 0,
                marginRight: '3px',
              }}
            />
            {/* Timer - sits next to icon, no fixed width */}
            {offer.timeRemaining !== undefined && (
              <span 
                className="text-[13px] font-black tracking-tighter"
                style={{ 
                  color: '#e6803a',
                  flexShrink: 0,
                }}
              >
                {formatTime(offer.timeRemaining)}
              </span>
            )}
          </button>
        </div>

        {/* Progress Bar - orange themed */}
        <div className="flex w-full h-[10px] px-3 pb-2">
          <div className="w-full h-[6px] bg-[#fcc371] rounded-full overflow-hidden relative" style={{ minHeight: '6px' }}>
            <div 
              className="absolute left-0 top-0 h-full bg-[#f59d42]"
              style={{ 
                width: '100%',
              }}
            />
          </div>
        </div>
      </div>
    );
  };

  const renderUpgradeItems = (category: TabType, stateMap: Record<string, UpgradeState>) => {
    const upgrades = getUpgradesForTab(category);
    const categoryOffers = rewardedOffers.filter(o => o.tab === category);
    return (
    <div ref={(scrollRefs as any)[category]} className={`flex-1 min-h-0 no-scrollbar px-3 pt-3 space-y-2.5 overscroll-contain select-none ${ftue10LockScroll && category === activeTab ? '' : 'cursor-grab active:cursor-grabbing'}`} style={{ paddingBottom: 75, overflow: ftue10LockScroll && category === activeTab ? 'hidden' : 'auto', touchAction: ftue10LockScroll && category === activeTab ? 'none' : 'auto' }}>
      {/* Rewarded offers at top */}
      {categoryOffers.map(offer => renderRewardedOfferItem(offer))}
      {upgrades.map((upgrade) => {
        const state =
          category === 'HARVEST' && upgrade.id === 'seed_surplus'
            ? (seedsState as any)[upgrade.id] ?? { level: 0, progress: 0 }
            : stateMap[upgrade.id] ?? { level: 0, progress: 0 };
        const currentCost = getUpgradeCostValue(upgrade.id, state.level);
        const currentCostDisplay = getUpgradeCost(upgrade.id, state.level);
        const canAfford = money >= currentCost;
        const isFlashing = flashingIds.has(upgrade.id) || ftue10GreenFlashUpgradeId === upgrade.id;
        const isUnlockFlashing = unlockFlashIds.has(upgrade.id);
        const isPressed = pressedId === upgrade.id;

        // Check if upgrade is locked by player level (unlocks only when "Unlock Now" tapped on level-up popup)
        const unlockLevel =
          category === 'SEEDS' ? (SEEDS_UNLOCK_LEVELS[upgrade.id] ?? 1) :
          category === 'CROPS' ? (CROPS_UNLOCK_LEVELS[upgrade.id] ?? 1) :
          category === 'HARVEST' ? (HARVEST_UNLOCK_LEVELS[upgrade.id] ?? 1) : 1;
        // Keep showing locked until flash fades out (button switches to green when blue fade-out starts)
        const isPendingUntilFadeOut = pendingUnlockUpgradeId === upgrade.id && !completedUnlockFlashIds.has(upgrade.id);
        const isLocked = playerLevel < unlockLevel || isPendingUntilFadeOut;
        
        // Check if this upgrade is maxed
        const isMaxed = 
          (upgrade.id === 'seed_production' && (state.level >= 9 || hasGoldenPotProduction150(goldenPotCount))) ||
          (upgrade.id === 'seed_surplus' && isSurplusRechargesMaxed(seedsState as SeedsState)) ||
          (upgrade.id === 'seed_storage' && isSeedStorageMaxed(stateMap as SeedsState)) ||
          (upgrade.id === 'double_seeds' && isDoubleSeedsMaxed(stateMap as SeedsState)) ||
          (upgrade.id === 'harvest_speed' && (state.level >= 9 || hasGoldenPotHarvest150(goldenPotCount))) ||
          (upgrade.id === 'bonus_seeds' && isBonusSeedMaxed(stateMap as SeedsState)) ||
          (upgrade.id === 'plot_expansion' && isPlotExpansionMaxed(lockedCellCount)) ||
          (upgrade.id === 'wild_growth' && isWildGrowthMaxLevel(state.level)) ||
          (upgrade.id === 'crop_value' && isCropYieldMaxed(stateMap)) ||
          (upgrade.id === 'merge_harvest' && isMergeHarvestMaxed(stateMap)) ||
          (upgrade.id === 'customer_speed' && isCustomerSpeedMaxed(stateMap, goldenPotCount)) ||
          (upgrade.id === 'market_value' && isMarketValueMaxed(stateMap)) ||
          (upgrade.id === 'happy_customer' && isHappyCustomerMaxed(stateMap));
        
        const descTextColor = '#c2b180';
        // Locked (Seeds): blue theme
        const LOCKED_MAIN = '#9cbed0';
        const LOCKED_DEPTH = '#7497b0';
        const LOCKED_FONT = '#507493';
        // Normal: green/brown
        const buttonColor = isLocked ? LOCKED_MAIN : '#cae060';
        const buttonActiveColor = isLocked ? LOCKED_MAIN : '#61882b';
        const buttonDisabledColor = isLocked ? LOCKED_MAIN : '#e3c28c';
        
        const buttonDepthColor = isLocked ? LOCKED_DEPTH : '#9db546';
        const buttonActiveDepthColor = isLocked ? LOCKED_DEPTH : '#61882b';
        const buttonDisabledDepthColor = isLocked ? LOCKED_DEPTH : '#c7a36e';
        
        const buttonFontColor = isLocked ? LOCKED_FONT : '#587e26';
        const buttonActiveFontColor = isLocked ? LOCKED_FONT : '#cbe05d';
        const buttonDisabledFontColor = isLocked ? LOCKED_FONT : '#a68e64';

        const displayProgress = isFlashing ? 10 : state.progress;
        const progressPercent = displayProgress * 10;
        const seedsValue = category === 'SEEDS' ? getSeedsUpgradeValue(upgrade.id, state.level, stateMap as SeedsState) : null;
        const cropsValue = category === 'CROPS' ? getCropsUpgradeValue(upgrade.id, state.level) : null;
        const harvestValue = category === 'HARVEST' ? getHarvestUpgradeValue(upgrade.id, state.level) : null;
        let displayValue = seedsValue ?? cropsValue ?? harvestValue;
        if (upgrade.id === 'seed_production' && hasGoldenPotProduction150(goldenPotCount)) displayValue = '150%';
        if (upgrade.id === 'harvest_speed' && hasGoldenPotHarvest150(goldenPotCount)) displayValue = '150%';
        
        const UNLOCK_FLASH_BLUE = '#89c8e1';
        return (
          <div 
            key={upgrade.id}
            ref={(el) => { upgradeRowRefs.current[upgrade.id] = el; }}
            className={`relative flex flex-col transition-all duration-300 border-2 ${
              isUnlockFlashing
                ? 'scale-[1.02] shadow-lg z-10 border-[#66a4c6] rounded-[11px]'
                : isFlashing 
                  ? 'bg-[#a7c957] scale-[1.01] shadow-lg z-10 border-[#c2b180] rounded-[11px]' 
                  : 'bg-[#fcf0c6] shadow-[0_2px_10px_rgba(0,0,0,0.03)] border-[#ebdbaf] rounded-[11px]'
            }`}
            style={isUnlockFlashing ? { backgroundColor: UNLOCK_FLASH_BLUE } : undefined}
          >
            <div className="flex items-center p-1.5 px-3">
              {/* Square Icon Box */}
              <div className="w-[38px] h-[38px] shrink-0 flex items-center justify-center bg-[#764f40] rounded-[8px] shadow-sm">
                {upgrade.icon.includes('.png') ? (
                  <img src={upgrade.icon} alt="" className="w-[30px] h-[30px] object-contain select-none" />
                ) : (
                  <span className="text-[22px] leading-none select-none">{upgrade.icon}</span>
                )}
              </div>
              
              {/* Text Content */}
              <div className="flex-grow px-3">
                <div className="flex items-baseline space-x-1.5">
                  {/* Updated title font size to 13px (from 14px) as requested */}
                  <h3
                    className="text-[13px] font-black tracking-tight uppercase leading-none"
                    style={{ color: isUnlockFlashing ? '#507493' : isFlashing ? '#386641' : '#583c1f' }}
                  >
                    {upgrade.name}
                  </h3>
                  {/* Current value (Seeds/Harvest: formatted value in green; others: LV) */}
                  {displayValue !== null ? (
                    <span className="text-[11px] font-bold" style={{ color: SEEDS_VALUE_GREEN }}>
                      {displayValue}
                    </span>
                  ) : (
                    <span className={`text-[9px] font-black uppercase ${isFlashing ? 'text-[#386641]/60' : 'text-[#a6a38a]'}`}>
                      LV {state.level}
                    </span>
                  )}
                </div>
                {/* Description */}
                <div
                  className={`text-[11px] font-semibold mt-0.5 tracking-tight ${upgrade.description ? '' : 'uppercase'} ${isFlashing && !isUnlockFlashing ? 'text-[#386641]/50' : ''}`}
                  style={{ color: isUnlockFlashing ? '#7497b0' : isFlashing ? undefined : descTextColor }}
                >
                  {upgrade.description ?? `YIELD: +${(state.level * 30).toFixed(0)}%`}
                </div>
              </div>

              {/* Price Button */}
              <button
                ref={ftue10GreenFlashUpgradeId === upgrade.id && ftue10PurchaseButtonRef ? (el) => { ftue10PurchaseButtonRef.current = el; } : undefined}
                id={ftue10GreenFlashUpgradeId === upgrade.id ? `ftue10-purchase-${upgrade.id}` : undefined}
                onMouseDown={() => !isLocked && !isMaxed && canAfford && setPressedId(upgrade.id)}
                onMouseUp={() => setPressedId(null)}
                onMouseLeave={() => setPressedId(null)}
                onClick={() => !isLocked && !isMaxed && handleUpgrade(upgrade.id, category, state.level)} 
                className={`relative flex items-center justify-center gap-1 min-w-[70px] h-8 transition-all border outline outline-1 ${
                  !isLocked && !isMaxed && canAfford 
                    ? 'active:translate-y-[2px] active:border-b-0 active:mb-[4px]' 
                    : ''
                } rounded-[8px] shadow-[inset_0_1px_1px_rgba(255,255,255,0.4)]`}
                style={{
                  backgroundColor: isLocked ? LOCKED_MAIN : (isPressed ? buttonActiveColor : (isMaxed || !canAfford ? buttonDisabledColor : buttonColor)),
                  borderColor: isLocked ? LOCKED_DEPTH : (isPressed ? buttonActiveDepthColor : (isMaxed || !canAfford ? buttonDisabledDepthColor : buttonDepthColor)),
                  borderBottomWidth: isLocked ? '4px' : (isPressed ? '0px' : '4px'),
                  marginBottom: isLocked ? '0px' : (isPressed ? '4px' : '0px'),
                  outlineColor: isLocked ? LOCKED_DEPTH : (isPressed ? buttonActiveDepthColor : (isMaxed || !canAfford ? buttonDisabledDepthColor : buttonDepthColor)),
                  cursor: isLocked || isMaxed ? 'default' : undefined,
                }}
              >
                {isLocked ? (
                  <span className="flex items-center gap-0.5 -translate-x-1">
                    <div
                      className="w-4 h-4 shrink-0"
                      style={{
                        backgroundColor: LOCKED_FONT,
                        maskImage: `url(${ICON_LOCK})`,
                        maskSize: 'contain',
                        maskRepeat: 'no-repeat',
                        maskPosition: 'center',
                        WebkitMaskImage: `url(${ICON_LOCK})`,
                        WebkitMaskSize: 'contain',
                        WebkitMaskRepeat: 'no-repeat',
                        WebkitMaskPosition: 'center',
                      }}
                    />
                    <span className="text-[13px] font-black tracking-tighter" style={{ color: LOCKED_FONT }}>
                      lvl {unlockLevel}
                    </span>
                  </span>
                ) : (
                  <>
                    {isMaxed ? (
                      <span
                        className="text-[13px] font-black tracking-tighter"
                        style={{
                          color: buttonDisabledFontColor,
                          display: 'inline-block',
                          textAlign: 'center',
                        }}
                      >
                        MAX
                      </span>
                    ) : (
                      <span className="flex items-center gap-[1px] -translate-x-1 relative shrink-0">
                        <img
                          src={ICON_COIN_SMALL}
                          alt=""
                          className="shrink-0 object-contain"
                          style={{ width: 16, height: 16, minWidth: 16, maxWidth: 16, minHeight: 16, maxHeight: 16, display: 'block', position: 'relative', zIndex: 1, flexShrink: 0 }}
                        />
                        <span
                          className="text-[13px] font-black tracking-tighter"
                          style={{
                            color: isPressed ? buttonActiveFontColor : (!canAfford ? buttonDisabledFontColor : buttonFontColor),
                          }}
                        >
                          {currentCostDisplay}
                        </span>
                      </span>
                    )}
                  </>
                )}
              </button>
            </div>

            {/* Thicker Progress Bar - Increased to 6px height (20% more than 5px) */}
            <div className="flex w-full h-[10px] px-3 pb-2">
              <div className="w-full h-[6px] bg-[#9d8a57]/20 rounded-full overflow-hidden relative" style={{ minHeight: '6px' }}>
                <div 
                  className="absolute left-0 top-0 h-full"
                  style={{
                    backgroundColor: isUnlockFlashing ? '#507493' : isFlashing ? '#386641' : '#a7c957',
                    width: `${progressPercent}%`,
                    transition: (progressPercent === 0 && !isFlashing) 
                      ? 'none' 
                      : 'width 0.25s cubic-bezier(0.25, 1, 0.5, 1), background-color 0.3s ease',
                  }}
                />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
  };

  const getTabIndex = () => TABS.indexOf(activeTab);
  const translateX = `calc(-${getTabIndex() * (100 / 3)}% + ${dragOffset}px)`;
  return (
    <div className="flex-1 min-h-0 relative overflow-hidden flex flex-col">
      <div 
        className={`tab-content-container h-full min-h-0 flex flex-1 ${isHorizontalDragging ? 'transition-none' : 'transition-transform'}`} 
        style={{ 
          transform: `translateX(${translateX})`,
          transitionDuration: isExpanded ? '700ms' : '250ms',
          transitionTimingFunction: isExpanded ? 'cubic-bezier(0.05, 0, 0, 1)' : 'cubic-bezier(0.22, 0, 0.12, 1)',
        }}
      >
        <div className="tab-pane h-full min-h-0 flex flex-col">{renderUpgradeItems('SEEDS', seedsState)}</div>
        <div className="tab-pane h-full min-h-0 flex flex-col">{renderUpgradeItems('CROPS', cropsState)}</div>
        <div className="tab-pane h-full min-h-0 flex flex-col">{renderUpgradeItems('HARVEST', harvestState)}</div>
      </div>
    </div>
  );
};
