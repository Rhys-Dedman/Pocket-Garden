
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

/** Check if crop_merging upgrade is at max level (2.0x) */
export const isCropMergingMaxed = (cropsState: Record<string, UpgradeState>): boolean => {
  const level = cropsState.crop_merging?.level ?? 0;
  return level >= 10; // Max at level 10 (2.0x)
};

/** Get the crop merging multiplier (1.0x base + 0.1x per level) */
export const getCropMergingMultiplier = (cropsState: Record<string, UpgradeState>): number => {
  const level = cropsState.crop_merging?.level ?? 0;
  return 1.0 + 0.1 * level;
};

/** Get the lucky merge chance percentage (5% per level, chance for +2 level upgrade on merge) */
export const getLuckyMergeChance = (cropsState: Record<string, UpgradeState>): number => {
  const level = cropsState.lucky_merge?.level ?? 0;
  return level * 5;
};

/** Check if lucky_merge upgrade is at max level (50%) */
export const isLuckyMergeMaxed = (cropsState: Record<string, UpgradeState>): boolean => {
  const level = cropsState.lucky_merge?.level ?? 0;
  return level >= 10; // Max at level 10 (50%)
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
  
  // CROPS (Plots)
  plot_expansion: { baseCost: 150, growth: 1.35 },
  crop_merging: { baseCost: 200, growth: 1.20 },
  merge_harvest: { baseCost: 350, growth: 1.27 },
  lucky_merge: { baseCost: 600, growth: 1.30 },
  fertile_soil: { baseCost: 500, growth: 1.33 },
  
  // HARVEST
  harvest_speed: { baseCost: 90, growth: 1.18 },
  crop_value: { baseCost: 250, growth: 1.23 },
  crop_synergy: { baseCost: 300, growth: 1.24 },
  harvest_boost: { baseCost: 180, growth: 1.22 },
  lucky_harvest: { baseCost: 450, growth: 1.27 },
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
  { id: 'seed_production', name: 'Seed Production', icon: assetPath('/assets/icons/icon_seedproduction.png'), description: 'Increase automatic seed production speed' },
  { id: 'seed_quality', name: 'Seed Quality', icon: assetPath('/assets/icons/icon_seedquality.png') }, // Description is dynamic, rendered inline
  { id: 'seed_storage', name: 'Seed Storage', icon: assetPath('/assets/icons/icon_seedstorage.png'), description: 'Increase the amount of seeds you can store' },
  { id: 'seed_surplus', name: 'Seed Surplus', icon: assetPath('/assets/icons/icon_seedsurplus.png'), description: 'Extra seeds become coins when storage is full' },
  { id: 'bonus_seeds', name: 'Seed Luck', icon: assetPath('/assets/icons/icon_luckyseed.png'), description: 'Increase the chance to produce a bonus plant' },
];

const CROPS_UPGRADES: UpgradeDef[] = [
  { id: 'plot_expansion', name: 'Plot Expansion', icon: assetPath('/assets/icons/icon_plotexpansion.png'), description: 'Unlock additional plots for planting crops' },
  { id: 'crop_merging', name: 'Crop Merging', icon: assetPath('/assets/icons/icon_cropmerge.png'), description: 'Multiply coins earned from merging crops' },
  { id: 'merge_harvest', name: 'Merge Harvest', icon: assetPath('/assets/icons/icon_mergeharvest.png'), description: 'Merges have a chance to instantly harvest adjacent crops' },
  { id: 'fertile_soil', name: 'Fertile Soil', icon: assetPath('/assets/icons/icon_fetilesoil.png'), description: 'Fertile plots double the value of crops when harvested' },
  { id: 'lucky_merge', name: 'Lucky Merge', icon: assetPath('/assets/icons/icon_luckymerge.png'), description: 'Increase chance for merges to upgrade crops by +2 levels' },
];

const HARVEST_UPGRADES: UpgradeDef[] = [
  { id: 'harvest_speed', name: 'Harvest Speed', icon: assetPath('/assets/icons/icon_harvestspeed.png'), description: 'Increase automatic harvest cycle speed' },
  { id: 'crop_value', name: 'Crop Value', icon: assetPath('/assets/icons/icon_cropvalue.png'), description: 'Increase coin value of harvested crops' },
  { id: 'harvest_boost', name: 'Harvest Boost', icon: assetPath('/assets/icons/icon_harvestboost.png'), description: 'Merging crops increases the crop cycle progress' },
  { id: 'crop_synergy', name: 'Crop Synergy', icon: assetPath('/assets/icons/icon_cropsynergy.png'), description: 'Increase coin value from adjacent matching crops' },
  { id: 'lucky_harvest', name: 'Lucky Harvest', icon: assetPath('/assets/icons/icon_luckyharvest.png'), description: 'Increase the chance for a double harvest' },
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
      return `${3 + level}/min`;
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

/** Current value display for Crops upgrades; null = show LV. */
const getCropsUpgradeValue = (upgradeId: string, level: number): string | null => {
  switch (upgradeId) {
    case 'crop_merging':
      return `${(1.0 + 0.1 * level).toFixed(1)}x`;
    case 'plot_expansion':
      return `+1`;
    case 'merge_harvest':
      return `${level * 5}%`;
    case 'fertile_soil':
      return `+1`;
    case 'lucky_merge':
      return `${level * 5}%`;
    default:
      return null;
  }
};

/** Current value display for Harvest upgrades; null = show LV. */
const getHarvestUpgradeValue = (upgradeId: string, level: number): string | null => {
  switch (upgradeId) {
    case 'harvest_speed':
      return `${3 + level}/min`;
    case 'crop_value':
      return `${(1.0 + 0.1 * level).toFixed(1)}x`;
    case 'harvest_boost':
      return `${level * 2}%`;
    case 'crop_synergy':
      return `${(1.0 + 0.1 * level).toFixed(1)}x`;
    case 'lucky_harvest':
      return `${level * 5}%`;
    default:
      return null;
  }
};

/** Get the crop value multiplier (1.0x base + 0.1x per level) */
export const getCropValueMultiplier = (harvestState: HarvestState): number => {
  const level = harvestState?.crop_value?.level ?? 0;
  return 1.0 + 0.1 * level;
};

/** Get the harvest boost percentage (2% per level) */
export const getHarvestBoostPercent = (harvestState: HarvestState): number => {
  const level = harvestState?.harvest_boost?.level ?? 0;
  return level * 2;
};

/** Get the crop synergy multiplier (1.0x base + 0.1x per level) */
export const getCropSynergyMultiplier = (harvestState: HarvestState): number => {
  const level = harvestState?.crop_synergy?.level ?? 0;
  return 1.0 + 0.1 * level;
};

/** Get the lucky harvest chance percentage (5% per level) */
export const getLuckyHarvestChance = (harvestState: HarvestState): number => {
  const level = harvestState?.lucky_harvest?.level ?? 0;
  return level * 5;
};

/** Check if lucky_harvest upgrade is at max level (50%) */
export const isLuckyHarvestMaxed = (harvestState: Record<string, UpgradeState>): boolean => {
  const level = harvestState.lucky_harvest?.level ?? 0;
  return level >= 10; // Max at level 10 (50%)
};

/** Check if harvest_boost upgrade is at max level (20%) */
export const isHarvestBoostMaxed = (harvestState: Record<string, UpgradeState>): boolean => {
  const level = harvestState.harvest_boost?.level ?? 0;
  return level >= 10; // Max at level 10 (20%)
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
  crop_merging: { level: 0, progress: 0 },
  plot_expansion: { level: 1, progress: 0 },
  merge_harvest: { level: 0, progress: 0 },
  fertile_soil: { level: 0, progress: 0 },
  lucky_merge: { level: 0, progress: 0 },
});

/** Initial harvest state: all upgrades start at level 0 */
export const createInitialHarvestState = (): Record<string, UpgradeState> => ({
  harvest_speed: { level: 0, progress: 0 },
  crop_value: { level: 0, progress: 0 },
  harvest_boost: { level: 0, progress: 0 },
  crop_synergy: { level: 0, progress: 0 },
  lucky_harvest: { level: 0, progress: 0 },
});

export const UpgradeList: React.FC<UpgradeListProps> = ({ activeTab, onTabChange, money, setMoney, seedsState: propsSeedsState, setSeedsState: propsSetSeedsState, harvestState: propsHarvestState, setHarvestState: propsSetHarvestState, cropsState: propsCropsState, setCropsState: propsSetCropsState, lockedCellCount = 0, onUnlockCell, fertilizableCellCount = 0, onFertilizeCell, highestPlantEver = 1, rewardedOffers = [], onRewardedOfferClick }) => {
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

  const scrollRefs = {
    SEEDS: useRef<HTMLDivElement>(null),
    CROPS: useRef<HTMLDivElement>(null),
    HARVEST: useRef<HTMLDivElement>(null),
  };

  const [dragOffset, setDragOffset] = useState(0);
  const [isHorizontalDragging, setIsHorizontalDragging] = useState(false);

  useEffect(() => {
    const el = (scrollRefs as any)[activeTab].current;
    if (el) el.scrollTo({ top: 0, behavior: 'auto' });
  }, [activeTab]);

  useEffect(() => {
    const cleanups: (() => void)[] = [];
    TABS.forEach((cat) => {
      const el = (scrollRefs as any)[cat].current;
      if (!el) return;
      let isDown = false;
      let directionLocked: 'none' | 'vertical' | 'horizontal' = 'none';
      let startX: number;
      let startY: number;
      let scrollTop: number;
      let velocityV = 0;
      let lastY = 0;
      let lastTime = 0;
      let rafId: number;

      const momentumLoop = () => {
        if (!isDown && Math.abs(velocityV) > 0.1) {
          const maxScroll = el.scrollHeight - el.clientHeight;
          const nextScroll = el.scrollTop - velocityV;
          el.scrollTop = Math.max(0, Math.min(nextScroll, maxScroll));
          velocityV *= 0.94; 
          rafId = requestAnimationFrame(momentumLoop);
        }
      };

      const handleMouseDown = (e: MouseEvent) => {
        isDown = true;
        directionLocked = 'none';
        velocityV = 0;
        cancelAnimationFrame(rafId);
        startX = e.pageX;
        startY = e.pageY;
        scrollTop = el.scrollTop;
        lastY = e.pageY;
        lastTime = Date.now();
        window.addEventListener('mousemove', handleMouseMoveGlobal);
        window.addEventListener('mouseup', handleMouseUpGlobal);
      };

      const handleMouseMoveGlobal = (e: MouseEvent) => {
        if (!isDown) return;
        const dx = e.pageX - startX;
        const dy = e.pageY - startY;
        if (directionLocked === 'none') {
          if (Math.abs(dx) > 10 || Math.abs(dy) > 10) {
            directionLocked = Math.abs(dx) > Math.abs(dy) ? 'horizontal' : 'vertical';
            if (directionLocked === 'horizontal') setIsHorizontalDragging(true);
          }
          return;
        }
        if (directionLocked === 'horizontal') setDragOffset(dx);
        else if (directionLocked === 'vertical') {
          const now = Date.now();
          if (now - lastTime > 0) velocityV = velocityV * 0.2 + (e.pageY - lastY) * 0.8;
          el.scrollTop = Math.max(0, Math.min(scrollTop - dy, el.scrollHeight - el.clientHeight));
          lastY = e.pageY;
          lastTime = now;
        }
      };

      const handleMouseUpGlobal = (e: MouseEvent) => {
        if (!isDown) return;
        isDown = false;
        const finalDx = e.pageX - startX;
        window.removeEventListener('mousemove', handleMouseMoveGlobal);
        window.removeEventListener('mouseup', handleMouseUpGlobal);
        if (directionLocked === 'horizontal') {
          setIsHorizontalDragging(false);
          setDragOffset(0);
          const currentIndex = TABS.indexOf(activeTab);
          if (finalDx > 100 && currentIndex > 0) onTabChange(TABS[currentIndex - 1]);
          else if (finalDx < -100 && currentIndex < TABS.length - 1) onTabChange(TABS[currentIndex + 1]);
        } else if (directionLocked === 'vertical' && Math.abs(velocityV) > 1) {
          rafId = requestAnimationFrame(momentumLoop);
        }
      };

      // Touch event handlers (mirror mouse handlers for mobile support)
      const handleTouchStart = (e: TouchEvent) => {
        if (e.touches.length !== 1) return;
        isDown = true;
        directionLocked = 'none';
        velocityV = 0;
        cancelAnimationFrame(rafId);
        startX = e.touches[0].pageX;
        startY = e.touches[0].pageY;
        scrollTop = el.scrollTop;
        lastY = e.touches[0].pageY;
        lastTime = Date.now();
      };

      const handleTouchMove = (e: TouchEvent) => {
        if (!isDown || e.touches.length !== 1) return;
        const dx = e.touches[0].pageX - startX;
        const dy = e.touches[0].pageY - startY;
        if (directionLocked === 'none') {
          if (Math.abs(dx) > 10 || Math.abs(dy) > 10) {
            directionLocked = Math.abs(dx) > Math.abs(dy) ? 'horizontal' : 'vertical';
            if (directionLocked === 'horizontal') setIsHorizontalDragging(true);
          }
          return;
        }
        if (directionLocked === 'horizontal') {
          e.preventDefault();
          setDragOffset(dx);
        } else if (directionLocked === 'vertical') {
          const now = Date.now();
          if (now - lastTime > 0) velocityV = velocityV * 0.2 + (e.touches[0].pageY - lastY) * 0.8;
          el.scrollTop = Math.max(0, Math.min(scrollTop - dy, el.scrollHeight - el.clientHeight));
          lastY = e.touches[0].pageY;
          lastTime = now;
        }
      };

      const handleTouchEnd = (e: TouchEvent) => {
        if (!isDown) return;
        isDown = false;
        const touch = e.changedTouches[0];
        const finalDx = touch.pageX - startX;
        if (directionLocked === 'horizontal') {
          setIsHorizontalDragging(false);
          setDragOffset(0);
          const currentIndex = TABS.indexOf(activeTab);
          if (finalDx > 100 && currentIndex > 0) onTabChange(TABS[currentIndex - 1]);
          else if (finalDx < -100 && currentIndex < TABS.length - 1) onTabChange(TABS[currentIndex + 1]);
        } else if (directionLocked === 'vertical' && Math.abs(velocityV) > 1) {
          rafId = requestAnimationFrame(momentumLoop);
        }
      };

      el.addEventListener('mousedown', handleMouseDown);
      el.addEventListener('touchstart', handleTouchStart, { passive: true });
      el.addEventListener('touchmove', handleTouchMove, { passive: false });
      el.addEventListener('touchend', handleTouchEnd);
      el.addEventListener('touchcancel', handleTouchEnd);
      
      cleanups.push(() => {
        el.removeEventListener('mousedown', handleMouseDown);
        window.removeEventListener('mousemove', handleMouseMoveGlobal);
        window.removeEventListener('mouseup', handleMouseUpGlobal);
        el.removeEventListener('touchstart', handleTouchStart);
        el.removeEventListener('touchmove', handleTouchMove);
        el.removeEventListener('touchend', handleTouchEnd);
        el.removeEventListener('touchcancel', handleTouchEnd);
        cancelAnimationFrame(rafId);
      });
    });
    return () => cleanups.forEach(c => c());
  }, [activeTab, onTabChange]);

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
        const isPressed = pressedId === upgrade.id;
        
        // Check if this upgrade is maxed
        const isMaxed = 
          (upgrade.id === 'seed_quality' && isSeedQualityMaxed(stateMap as SeedsState, highestPlantEver)) ||
          (upgrade.id === 'bonus_seeds' && isBonusSeedMaxed(stateMap as SeedsState)) ||
          (upgrade.id === 'crop_merging' && isCropMergingMaxed(stateMap)) ||
          (upgrade.id === 'plot_expansion' && isPlotExpansionMaxed(lockedCellCount)) ||
          (upgrade.id === 'fertile_soil' && isFertileSoilMaxed(fertilizableCellCount)) ||
          (upgrade.id === 'lucky_merge' && isLuckyMergeMaxed(stateMap)) ||
          (upgrade.id === 'merge_harvest' && isMergeHarvestMaxed(stateMap)) ||
          (upgrade.id === 'lucky_harvest' && isLuckyHarvestMaxed(stateMap)) ||
          (upgrade.id === 'harvest_boost' && isHarvestBoostMaxed(stateMap));
        
        const descTextColor = '#c2b180';
        const buttonColor = '#cae060';
        const buttonActiveColor = '#61882b';
        const buttonDisabledColor = '#e3c28c';
        
        const buttonDepthColor = '#9db546';
        const buttonActiveDepthColor = '#61882b';
        const buttonDisabledDepthColor = '#c7a36e';
        
        const buttonFontColor = '#587e26';
        const buttonActiveFontColor = '#cbe05d';
        const buttonDisabledFontColor = '#a68e64';

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

        return (
          <div 
            key={upgrade.id} 
            className={`relative flex flex-col transition-all duration-300 border-2 ${
              isFlashing 
                ? 'bg-[#a7c957] scale-[1.01] shadow-lg z-10 border-[#c2b180] rounded-[11px]' 
                : 'bg-[#fcf0c6] shadow-[0_2px_10px_rgba(0,0,0,0.03)] border-[#ebdbaf] rounded-[11px]'
            }`}
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
                  <h3 className={`text-[13px] font-black tracking-tight uppercase leading-none ${isFlashing ? 'text-[#386641]' : 'text-[#583c1f]'}`}>
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
                <div className={`text-[11px] font-semibold mt-0.5 tracking-tight ${(upgrade.description || upgrade.id === 'seed_quality') ? '' : 'uppercase'} ${isFlashing ? 'text-[#386641]/50' : ''}`} style={{ color: isFlashing ? undefined : descTextColor }}>
                  {upgrade.id === 'seed_quality' ? (
                    <>
                      Increase the chance to produce level <span style={{ color: SEEDS_VALUE_GREEN, fontWeight: 700 }}>{seedQualityTargetTier}</span> plants
                    </>
                  ) : (
                    upgrade.description ?? `YIELD: +${(state.level * 30).toFixed(0)}%`
                  )}
                </div>
              </div>

              {/* Price Button */}
              <button 
                onMouseDown={() => !isMaxed && canAfford && setPressedId(upgrade.id)}
                onMouseUp={() => setPressedId(null)}
                onMouseLeave={() => setPressedId(null)}
                onClick={() => !isMaxed && handleUpgrade(upgrade.id, category, state.level)} 
                className={`relative flex items-center justify-center min-w-[70px] h-8 transition-all border outline outline-1 ${
                  !isMaxed && canAfford 
                    ? 'active:translate-y-[2px] active:border-b-0 active:mb-[4px]' 
                    : ''
                } rounded-[8px] shadow-[inset_0_1px_1px_rgba(255,255,255,0.4)]`}
                style={{
                  backgroundColor: isPressed ? buttonActiveColor : (isMaxed || !canAfford ? buttonDisabledColor : buttonColor),
                  borderColor: isPressed ? buttonActiveDepthColor : (isMaxed || !canAfford ? buttonDisabledDepthColor : buttonDepthColor),
                  borderBottomWidth: isPressed ? '0px' : '4px',
                  marginBottom: isPressed ? '4px' : '0px',
                  outlineColor: isPressed ? buttonActiveDepthColor : (isMaxed || !canAfford ? buttonDisabledDepthColor : buttonDepthColor),
                  cursor: isMaxed ? 'default' : undefined,
                }}
              >
                <span 
                  className="text-[13px] font-black tracking-tighter transition-colors"
                  style={{ 
                    color: isPressed ? buttonActiveFontColor : (isMaxed || !canAfford ? buttonDisabledFontColor : buttonFontColor)
                  }}
                >
                  {isMaxed ? 'MAX' : currentCostDisplay}
                </span>
              </button>
            </div>

            {/* Thicker Progress Bar - Increased to 6px height (20% more than 5px) */}
            <div className="flex w-full h-[10px] px-3 pb-2">
              <div className="w-full h-[6px] bg-[#9d8a57]/20 rounded-full overflow-hidden relative" style={{ minHeight: '6px' }}>
                <div 
                  className={`absolute left-0 top-0 h-full ${
                    isFlashing ? 'bg-[#386641]' : 'bg-[#a7c957]'
                  }`}
                  style={{ 
                    width: `${progressPercent}%`,
                    transition: (progressPercent === 0 && !isFlashing) 
                      ? 'none' 
                      : 'width 0.25s cubic-bezier(0.25, 1, 0.5, 1), background-color 0.3s ease'
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
      <div className={`tab-content-container h-full min-h-0 flex flex-1 ${isHorizontalDragging ? 'transition-none' : 'transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]'}`} style={{ transform: `translateX(${translateX})` }}>
        <div className="tab-pane h-full min-h-0 flex flex-col">{renderUpgradeItems('SEEDS', seedsState)}</div>
        <div className="tab-pane h-full min-h-0 flex flex-col">{renderUpgradeItems('CROPS', cropsState)}</div>
        <div className="tab-pane h-full min-h-0 flex flex-col">{renderUpgradeItems('HARVEST', harvestState)}</div>
      </div>
    </div>
  );
};
