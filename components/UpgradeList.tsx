
import React, { useState, useRef, useEffect } from 'react';
import { TabType } from '../types';
import { assetPath } from '../utils/assetPath';

export interface UpgradeState {
  level: number;
  progress: number;
}

export type SeedsState = Record<string, UpgradeState> & {
  /** Base plant tier for seed shooting (starts at 1, increases when quality hits 100%) */
  seedBaseTier?: number;
};

/** Get the current seed quality percentage (0-100) within the current tier */
export const getSeedQualityPercent = (seedsState: SeedsState): number => {
  const qualityLevel = seedsState.seed_quality?.level ?? 0;
  return (qualityLevel % 10) * 10; // 0-90% in increments of 10
};

/** Get the base plant tier (what level plant is shot normally) */
export const getSeedBaseTier = (seedsState: SeedsState): number => {
  return seedsState.seedBaseTier ?? 1;
};

/** Get the target tier shown in description (base tier + 1) */
export const getSeedTargetTier = (seedsState: SeedsState): number => {
  return getSeedBaseTier(seedsState) + 1;
};

/** Get the bonus seed chance percentage (0-50%, 5% per level, max level 10) */
export const getBonusSeedChance = (seedsState: SeedsState): number => {
  const level = seedsState.bonus_seeds?.level ?? 0;
  return Math.min(level * 5, 50); // Cap at 50%
};

/** Check if bonus_seeds upgrade is at max level */
export const isBonusSeedMaxed = (seedsState: SeedsState): boolean => {
  const level = seedsState.bonus_seeds?.level ?? 0;
  return level >= 10; // Max at level 10 (50%)
};

/** Check if seed_quality upgrade is maxed (target tier would exceed highest plant ever) */
export const isSeedQualityMaxed = (seedsState: SeedsState, highestPlantEver: number): boolean => {
  const targetTier = getSeedTargetTier(seedsState);
  return targetTier > highestPlantEver;
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

/** Get the seed surplus coin value (0 if level 0, then 10/20/40/80...) */
export const getSeedSurplusValue = (seedsState: SeedsState): number => {
  const level = seedsState.seed_surplus?.level ?? 0;
  if (level === 0) return 0;
  return 10 * Math.pow(2, level - 1);
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
  /** Highest plant level ever achieved by the player (for seed_quality max check) */
  highestPlantEver?: number;
  /** Rewarded offers to display at top of relevant tabs */
  rewardedOffers?: RewardedOffer[];
  /** Called when a rewarded offer button is clicked */
  onRewardedOfferClick?: (offerId: string) => void;
  /** Player level (for Seeds tab upgrade locking) */
  playerLevel?: number;
  /** When set, scroll to this upgrade and flash it blue (from level-up Unlock Now) */
  pendingUnlockUpgradeId?: string | null;
  /** When true, panel is expanded (use stronger ease-out for opening) */
  isExpanded?: boolean;
}

interface UpgradeDef {
  id: string;
  name: string;
  icon: string;
  description?: string;
}

/** Upgrade cost configuration: base cost and growth rate per level */
interface UpgradeCostConfig {
  baseCost: number;
  growth: number;
  /** For stage-based pricing (seed_quality), costs per stage */
  stageCosts?: number[];
}

const UPGRADE_COSTS: Record<string, UpgradeCostConfig> = {
  // SEEDS
  seed_production: { baseCost: 75, growth: 1.18 },
  seed_storage: { baseCost: 40, growth: 1.16 },
  seed_surplus: { baseCost: 120, growth: 1.22 },
  bonus_seeds: { baseCost: 300, growth: 1.28 }, // Seed Luck
  seed_quality: { baseCost: 250, growth: 1, stageCosts: [250, 900, 3000, 10000] }, // Stage-based pricing
  
  // CROPS (Garden)
  harvest_speed: { baseCost: 90, growth: 1.18 },
  plot_expansion: { baseCost: 150, growth: 1.35 },
  crop_value: { baseCost: 250, growth: 1.23 },
  fertile_soil: { baseCost: 500, growth: 1.33 },
  merge_harvest: { baseCost: 350, growth: 1.27 },

  // HARVEST (Orders)
  customer_speed: { baseCost: 100, growth: 1.20 },
  market_value: { baseCost: 200, growth: 1.25 },
  premium_orders: { baseCost: 150, growth: 1.22 },
  surplus_sales: { baseCost: 120, growth: 1.18 },
  happy_customer: { baseCost: 250, growth: 1.28 },
};

/** Calculate upgrade cost for a given level, rounded to nearest 5 */
const calculateUpgradeCost = (upgradeId: string, currentLevel: number): number => {
  const config = UPGRADE_COSTS[upgradeId];
  if (!config) return 0;
  
  // Special handling for seed_quality: stage-based pricing
  if (upgradeId === 'seed_quality' && config.stageCosts) {
    const stage = Math.floor(currentLevel / 10); // 0-9 = stage 0, 10-19 = stage 1, etc.
    const stageCost = config.stageCosts[Math.min(stage, config.stageCosts.length - 1)];
    return Math.round(stageCost / 5) * 5;
  }
  
  // Normal exponential scaling: cost = base * (growth^level)
  const rawCost = config.baseCost * Math.pow(config.growth, currentLevel);
  return Math.round(rawCost / 5) * 5;
};

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

const SEEDS_UPGRADES: UpgradeDef[] = [
  { id: 'seed_production', name: 'Production Speed', icon: assetPath('/assets/icons/icon_seedproduction.png'), description: 'Increase how fast seeds are produced' },
  { id: 'seed_storage', name: 'Storage Capacity', icon: assetPath('/assets/icons/icon_seedstorage.png'), description: 'Increase the amount of seeds you can store' },
  { id: 'seed_quality', name: 'Seed Quality', icon: assetPath('/assets/icons/icon_seedquality.png') }, // Description is dynamic, rendered inline
  { id: 'seed_surplus', name: 'Surplus Seeds', icon: assetPath('/assets/icons/icon_seedsurplus.png'), description: 'Extra seeds become coins when storage is full' },
  { id: 'bonus_seeds', name: 'Lucky Seed', icon: assetPath('/assets/icons/icon_luckyseed.png'), description: 'Increase the chance for seeds to grow an extra plant' },
];

const SEEDS_UNLOCK_LEVELS: Record<string, number> = {
  seed_production: 1,
  seed_storage: 2,
  seed_quality: 6,
  seed_surplus: 10,
  bonus_seeds: 13,
};

const CROPS_UNLOCK_LEVELS: Record<string, number> = {
  harvest_speed: 1,
  plot_expansion: 3,
  crop_value: 7,
  fertile_soil: 11,
  merge_harvest: 14,
};

const HARVEST_UNLOCK_LEVELS: Record<string, number> = {
  customer_speed: 1,
  market_value: 4,
  premium_orders: 8,
  surplus_sales: 12,
  happy_customer: 15,
};

/** Get level unlock info for level-up popup. Returns title, description, icon, and optionally upgradeId/tab for Unlock Now behavior. */
export const getLevelUnlockInfo = (level: number): { title: string; description: string; icon: string; upgradeId?: string; tab?: TabType } => {
  const allUnlocks: { level: number; upgradeId: string; tab: TabType; name: string; description: string; icon: string; popupDescription?: string }[] = [
    { level: 2, upgradeId: 'seed_storage', tab: 'SEEDS', name: 'Storage Capacity', description: 'Increase the amount of seeds you can store', icon: 'icon_seedstorage.png' },
    { level: 3, upgradeId: 'plot_expansion', tab: 'CROPS', name: 'Garden Expansion', description: 'Unlock additional plots in the garden', icon: 'icon_plotexpansion.png' },
    { level: 4, upgradeId: 'market_value', tab: 'HARVEST', name: 'Market Value', description: 'Increase the coins earned when completing orders', icon: 'icon_marketvalue.png' },
    { level: 5, upgradeId: '', tab: 'HARVEST', name: 'Extra Orders', description: 'You can now hold +1 extra order at a time', icon: 'icon_extracustomer.png' },
    { level: 6, upgradeId: 'seed_quality', tab: 'SEEDS', name: 'Seed Quality', description: 'Increase the chance to produce higher level plants', icon: 'icon_seedquality.png' },
    { level: 7, upgradeId: 'crop_value', tab: 'CROPS', name: 'Crop Yield', description: 'harvest more crops from each plant', icon: 'icon_cropvalue.png', popupDescription: 'You can now increase the number of crops harvested from each plant' },
    { level: 8, upgradeId: 'premium_orders', tab: 'HARVEST', name: 'Premium Orders', description: 'More likely to get orders for crops above your current level', icon: 'icon_premiumorders.png', popupDescription: 'You can now upgrade orders to request higher-level crops' },
    { level: 9, upgradeId: '', tab: 'HARVEST', name: 'Extra Orders', description: 'You can now hold +1 extra order at a time', icon: 'icon_extracustomer.png' },
    { level: 10, upgradeId: 'seed_surplus', tab: 'SEEDS', name: 'Surplus Seeds', description: 'Extra seeds become coins when storage is full', icon: 'icon_seedsurplus.png', popupDescription: 'Extra seeds will now become coins when your storage is full' },
    { level: 11, upgradeId: 'fertile_soil', tab: 'CROPS', name: 'Fertile Soil', description: 'Fertile plots yield double crops when harvested', icon: 'icon_fetilesoil.png', popupDescription: 'You can now create fertile soil to yield double crops when harvested' },
    { level: 12, upgradeId: 'surplus_sales', tab: 'HARVEST', name: 'Surplus Sales', description: 'Increase the coins earned from surplus plants', icon: 'icon_surplussales.png', popupDescription: 'Plants without matching orders can now be harvested for coins' },
    { level: 13, upgradeId: 'bonus_seeds', tab: 'SEEDS', name: 'Lucky Seed', description: 'Increase the chance for seeds to grow an extra plant', icon: 'icon_luckyseed.png' },
    { level: 14, upgradeId: 'merge_harvest', tab: 'CROPS', name: 'Chain Harvest', description: 'Increase chance for merges to harvest nearby plants', icon: 'icon_mergeharvest.png', popupDescription: 'Merging now has a chance to instantly harvest nearby plants' },
    { level: 15, upgradeId: 'happy_customer', tab: 'HARVEST', name: 'Happy Customer', description: 'Increase chance that customers pay double for orders', icon: 'icon_happycustomer.png', popupDescription: 'You can now increase the chance for customers to pay double coins for orders' },
  ];
  const match = allUnlocks.find(u => u.level === level);
  if (match) {
    const desc = match.popupDescription
      ?? (match.upgradeId ? `You can now ${match.description.toLowerCase()}` : match.description);
    return {
      title: match.name,
      description: desc,
      icon: assetPath(`/assets/icons/${match.icon}`),
      upgradeId: match.upgradeId || undefined,
      tab: match.upgradeId ? match.tab : match.tab,
    };
  }
  return { title: `Level ${level}`, description: "You've reached a new level!", icon: assetPath('/assets/icons/icon_level.png'), upgradeId: undefined, tab: undefined };
};

const ICON_LOCK = assetPath('/assets/icons/icon_lock.png');

const CROPS_UPGRADES: UpgradeDef[] = [
  { id: 'harvest_speed', name: 'Harvest Speed', icon: assetPath('/assets/icons/icon_harvestspeed.png'), description: 'Increase automatic harvest cycle speed' },
  { id: 'plot_expansion', name: 'Garden Expansion', icon: assetPath('/assets/icons/icon_plotexpansion.png'), description: 'Unlock additional plots in the garden' },
  { id: 'crop_value', name: 'Crop Yield', icon: assetPath('/assets/icons/icon_cropvalue.png'), description: 'Plants produce more crops per harvest' },
  { id: 'fertile_soil', name: 'Fertile Soil', icon: assetPath('/assets/icons/icon_fetilesoil.png'), description: 'Fertile plots yield double crops when harvested' },
  { id: 'merge_harvest', name: 'Chain Harvest', icon: assetPath('/assets/icons/icon_mergeharvest.png'), description: 'Increase chance for merges to harvest nearby plants' },
];

const HARVEST_UPGRADES: UpgradeDef[] = [
  { id: 'customer_speed', name: 'Order Speed', icon: assetPath('/assets/icons/icon_customerspeed.png'), description: 'Reduce the time it takes for new orders to appear' },
  { id: 'market_value', name: 'Market Value', icon: assetPath('/assets/icons/icon_marketvalue.png'), description: 'Increase the coins earned when completing orders' },
  { id: 'premium_orders', name: 'Premium Orders', icon: assetPath('/assets/icons/icon_premiumorders.png'), description: 'More likely to get orders above level' },
  { id: 'surplus_sales', name: 'Surplus Sales', icon: assetPath('/assets/icons/icon_surplussales.png'), description: 'Increase the coins earned from surplus plants' },
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
      return `${Math.min(10, 3 + level)}/min`;
    case 'seed_quality':
      // Display quality % within current tier (0-90%)
      const qualityPercent = seedsState ? getSeedQualityPercent(seedsState) : (level % 10) * 10;
      return `${qualityPercent}%`;
    case 'seed_storage':
      return `${1 + level}`; // +1 storage per upgrade
    case 'bonus_seeds':
      return `${level * 5}%`;
    case 'seed_surplus':
      return level === 0 ? '0' : `${10 * Math.pow(2, level - 1)}`;
    default:
      return null;
  }
};

/** Current value display for Crops (Garden) upgrades; null = show LV. */
const getCropsUpgradeValue = (upgradeId: string, level: number): string | null => {
  switch (upgradeId) {
    case 'harvest_speed':
      return `${Math.min(10, 3 + level)}/min`;
    case 'plot_expansion':
      return `+1`;
    case 'crop_value':
      return `${Math.min(10, 1 + level)}`;
    case 'fertile_soil':
      return `+1`;
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
      return `${Math.max(0, 30 - 5 * level)}s`;
    case 'market_value':
      return `${(1 + 0.5 * level).toFixed(1)}x`;
    case 'premium_orders':
      return `${1 + level}`;
    case 'surplus_sales':
      return `${(1 + 0.2 * level).toFixed(1)}x`;
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

/** Order Speed: goal loading time in seconds (30 base - 5 per level, min 0). Max at level 6. */
export const getGoalLoadingSeconds = (harvestState: HarvestState): number => {
  const level = harvestState?.customer_speed?.level ?? 0;
  return Math.max(0, 30 - 5 * level);
};

export const isCustomerSpeedMaxed = (harvestState: Record<string, UpgradeState>): boolean => {
  const level = harvestState?.customer_speed?.level ?? 0;
  return level >= 6; // 30 - 30 = 0s
};

/** Market Value: multiplier for goal completion coins (1.0 + 0.5 per level) */
export const getMarketValueMultiplier = (harvestState: HarvestState): number => {
  const level = harvestState?.market_value?.level ?? 0;
  return 1 + 0.5 * level;
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
  const level = harvestState?.surplus_sales?.level ?? 0;
  return 1 + 0.2 * level;
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

/** Initial seeds state: seed_production, seed_storage, seed_quality, and bonus_seeds start at level 0.
 * seed_quality starts at 0% chance with baseTier 1 (shooting plant_1).
 * bonus_seeds starts at 0% chance (max 50% at level 10).
 */
export const createInitialSeedsState = (): SeedsState => ({
  ...createInitialState(SEEDS_UPGRADES),
  seed_production: { level: 0, progress: 0 },
  seed_storage: { level: 0, progress: 0 },
  seed_quality: { level: 0, progress: 0 },
  bonus_seeds: { level: 0, progress: 0 },
  seed_surplus: { level: 0, progress: 0 },
});

/** Initial crops state: all upgrades start at level 0 */
export const createInitialCropsState = (): Record<string, UpgradeState> => ({
  harvest_speed: { level: 0, progress: 0 },
  plot_expansion: { level: 1, progress: 0 },
  crop_value: { level: 0, progress: 0 },
  fertile_soil: { level: 0, progress: 0 },
  merge_harvest: { level: 0, progress: 0 },
});

/** Initial harvest (Orders) state: all upgrades start at level 0 */
export const createInitialHarvestState = (): Record<string, UpgradeState> => ({
  customer_speed: { level: 0, progress: 0 },
  market_value: { level: 0, progress: 0 },
  premium_orders: { level: 0, progress: 0 },
  surplus_sales: { level: 0, progress: 0 },
  happy_customer: { level: 0, progress: 0 },
});

export const UpgradeList: React.FC<UpgradeListProps> = ({ activeTab, onTabChange, money, setMoney, seedsState: propsSeedsState, setSeedsState: propsSetSeedsState, harvestState: propsHarvestState, setHarvestState: propsSetHarvestState, cropsState: propsCropsState, setCropsState: propsSetCropsState, lockedCellCount = 0, onUnlockCell, fertilizableCellCount = 0, onFertilizeCell, highestPlantEver = 1, rewardedOffers = [], onRewardedOfferClick, playerLevel = 1, pendingUnlockUpgradeId = null, isExpanded = false }) => {
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
        const offsetTop = elRect.top - containerRect.top + scrollContainer.scrollTop;
        const elHeight = elRect.height;
        const containerHeight = scrollContainer.clientHeight;
        const maxScroll = scrollContainer.scrollHeight - containerHeight;
        // Center the upgrade in the viewport so it's fully visible (was scrolling past and cutting off top)
        const centerTarget = offsetTop - (containerHeight / 2) + (elHeight / 2);
        const scrollTarget = Math.max(0, Math.min(maxScroll, centerTarget));
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
    };
  }, [pendingUnlockUpgradeId, activeTab]);

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
        // Don't capture when tapping buttons - allows upgrade/rewarded-offer clicks to work
        if ((e.target as Element).closest?.('button')) return;
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

    // Special handling for fertile_soil: trigger cell fertilization
    if (id === 'fertile_soil') {
      onFertilizeCell?.();
    }

    const setter = category === 'SEEDS' ? setSeedsState : category === 'CROPS' ? setCropsState : setHarvestState;
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
      
      // Special handling for seed_quality: when reaching 100% (level multiple of 10), increase base tier
      if (id === 'seed_quality' && newLevel > 0 && newLevel % 10 === 0) {
        const currentBaseTier = prev.seedBaseTier ?? 1;
        return { 
          ...prev, 
          [id]: { level: newLevel, progress: 0 },
          seedBaseTier: currentBaseTier + 1
        };
      }
      
      return { ...prev, [id]: { level: newLevel, progress: 0 } };
    });
  };

  const renderRewardedOfferItem = (offer: RewardedOffer) => {
    const formatTime = (seconds: number) => {
      const mins = Math.floor(seconds / 60);
      const secs = seconds % 60;
      return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    return (
      <div 
        key={offer.id} 
        className="relative flex flex-col transition-all duration-300 border-2 bg-[#fde8a1] shadow-[0_2px_10px_rgba(0,0,0,0.03)] border-[#fbc682] rounded-[11px]"
      >
        <div className="flex items-center p-1.5 px-3">
          {/* Square Icon Box */}
          <div className="w-[38px] h-[38px] shrink-0 flex items-center justify-center bg-[#764f40] rounded-[8px] shadow-sm">
            <span className="text-[22px] leading-none select-none">{offer.icon}</span>
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

          {/* Watch Ad Button with timer - 1.2x wider than normal buttons */}
          <button 
            onClick={() => onRewardedOfferClick?.(offer.id)}
            className="relative flex items-center min-w-[84px] h-8 transition-all border outline outline-1 active:translate-y-[2px] active:border-b-0 active:mb-[4px] rounded-[8px] shadow-[inset_0_1px_1px_rgba(255,255,255,0.4)]"
            style={{
              backgroundColor: '#ffd856',
              borderColor: '#f59d42',
              borderBottomWidth: '4px',
              outlineColor: '#f59d42',
              paddingLeft: '6px',
              paddingRight: '6px',
            }}
          >
            {/* Watch Ad Icon - 1.2x scale (base 18px * 1.2 = ~22px) */}
            <img
              src={assetPath('/assets/icons/icon_watchad.png')}
              alt=""
              style={{
                width: '22px',
                height: '22px',
                objectFit: 'contain',
                filter: 'brightness(0) saturate(100%) invert(56%) sepia(67%) saturate(1000%) hue-rotate(346deg) brightness(97%) contrast(88%)',
                flexShrink: 0,
              }}
            />
            {/* Timer with fixed width to prevent layout shift */}
            {offer.timeRemaining !== undefined && (
              <span 
                className="text-[13px] font-black tracking-tighter text-right"
                style={{ 
                  color: '#e6803a',
                  width: '38px',
                  flexShrink: 0,
                  marginRight: '2px',
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
    <div ref={(scrollRefs as any)[category]} className="flex-1 min-h-0 overflow-y-auto no-scrollbar px-3 pt-3 space-y-2.5 overscroll-contain cursor-grab active:cursor-grabbing select-none" style={{ paddingBottom: 75 }}>
      {/* Rewarded offers at top */}
      {categoryOffers.map(offer => renderRewardedOfferItem(offer))}
      {upgrades.map((upgrade) => {
        const state = stateMap[upgrade.id];
        const currentCost = getUpgradeCostValue(upgrade.id, state.level);
        const currentCostDisplay = getUpgradeCost(upgrade.id, state.level);
        const canAfford = money >= currentCost;
        const isFlashing = flashingIds.has(upgrade.id);
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
          (upgrade.id === 'seed_production' && state.level >= 7) || // 3+7=10/min max
          (upgrade.id === 'harvest_speed' && state.level >= 7) || // 3+7=10/min max
          (upgrade.id === 'seed_quality' && isSeedQualityMaxed(stateMap as SeedsState, highestPlantEver)) ||
          (upgrade.id === 'bonus_seeds' && isBonusSeedMaxed(stateMap as SeedsState)) ||
          (upgrade.id === 'plot_expansion' && isPlotExpansionMaxed(lockedCellCount)) ||
          (upgrade.id === 'fertile_soil' && isFertileSoilMaxed(fertilizableCellCount)) ||
          (upgrade.id === 'crop_value' && isCropYieldMaxed(stateMap)) ||
          (upgrade.id === 'merge_harvest' && isMergeHarvestMaxed(stateMap)) ||
          (upgrade.id === 'customer_speed' && isCustomerSpeedMaxed(stateMap)) ||
          (upgrade.id === 'premium_orders' && isPremiumOrdersMaxed(stateMap)) ||
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
        const displayValue = seedsValue ?? cropsValue ?? harvestValue;
        
        // For seed_quality, calculate the target tier (base tier + 1)
        const seedQualityTargetTier = upgrade.id === 'seed_quality'
          ? getSeedTargetTier(stateMap as SeedsState)
          : null;
        // For premium_orders, the min level for "above" (1 + level)
        const premiumOrdersMinLevel = upgrade.id === 'premium_orders'
          ? getPremiumOrdersMinLevel(stateMap as HarvestState)
          : null;

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
                {/* Description - seed_quality has dynamic description, others use static or generic yield */}
                <div
                  className={`text-[11px] font-semibold mt-0.5 tracking-tight ${(upgrade.description || upgrade.id === 'seed_quality' || upgrade.id === 'premium_orders') ? '' : 'uppercase'} ${isFlashing && !isUnlockFlashing ? 'text-[#386641]/50' : ''}`}
                  style={{ color: isUnlockFlashing ? '#7497b0' : isFlashing ? undefined : descTextColor }}
                >
                  {upgrade.id === 'seed_quality' ? (
                    <>
                      Increase the chance to produce level <span style={{ color: SEEDS_VALUE_GREEN, fontWeight: 700 }}>{seedQualityTargetTier}</span> plants
                    </>
                  ) : upgrade.id === 'premium_orders' && premiumOrdersMinLevel != null ? (
                    <>
                      More likely to get orders for crops above level <span style={{ color: SEEDS_VALUE_GREEN, fontWeight: 700 }}>{premiumOrdersMinLevel}</span>
                    </>
                  ) : (
                    upgrade.description ?? `YIELD: +${(state.level * 30).toFixed(0)}%`
                  )}
                </div>
              </div>

              {/* Price Button */}
              <button 
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
                  <span 
                    className="text-[13px] font-black tracking-tighter"
                    style={{ 
                      color: isPressed ? buttonActiveFontColor : (isMaxed || !canAfford ? buttonDisabledFontColor : buttonFontColor)
                    }}
                  >
                    {isMaxed ? 'MAX' : currentCostDisplay}
                  </span>
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
