
import React, { useState, useCallback, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { HexBoard } from './components/HexBoard';
import { UpgradeTabs } from './components/UpgradeTabs';
import { UpgradeList, createInitialSeedsState, createInitialHarvestState, createInitialCropsState, getSeedQualityPercent, getSeedBaseTier, getBonusSeedChance, getSeedSurplusValue, getCropYieldPerHarvest, getHarvestSpeedLevel, getMergeHarvestChance, getGoalLoadingSeconds, getMarketValueMultiplier, getPremiumOrdersMinLevel, getSurplusSalesMultiplier, getHappyCustomerChance, HarvestState, UpgradeState, RewardedOffer } from './components/UpgradeList';
import { Navbar } from './components/Navbar';
import { StoreScreen } from './components/StoreScreen';
import { SideAction } from './components/SideAction';
import { Projectile } from './components/Projectile';
import { LeafBurst, LEAF_BURST_BASELINE_COUNT, LEAF_BURST_SMALL_COUNT } from './components/LeafBurst';
import { UnlockBurst } from './components/UnlockBurst';
import { CellHighlightBeam } from './components/CellHighlightBeam';
import { CoinPanel, CoinPanelData } from './components/CoinPanel';
import { PlantPanel, PlantPanelData } from './components/PlantPanel';
import { GoalCoinParticle, GoalCoinParticleData } from './components/GoalCoinParticle';
import { WalletImpactBurst } from './components/WalletImpactBurst';
import { PageHeader } from './components/PageHeader';
import { DiscoveryPopup } from './components/DiscoveryPopup';
import { LevelUpPopup } from './components/LevelUpPopup';
import { PlantInfoPopup } from './components/PlantInfoPopup';
import { LimitedOfferPopup } from './components/LimitedOfferPopup';
import { BarnParticle, BarnParticleData } from './components/BarnParticle';
import { OfferParticle, OfferParticleData } from './components/OfferParticle';
import { UpgradeTabsRef } from './components/UpgradeTabs';
import { ButtonLeafBurst } from './components/ButtonLeafBurst';
import { LoadingScreen } from './components/LoadingScreen';
import { TabType, ScreenType, BoardCell, Item, DragState } from './types';
import { assetPath } from './utils/assetPath';

/** Coin per plant level: level 1 = 5, level 2 = 10, level 3 = 20, ... */
export function getCoinValueForLevel(level: number): number {
  return 5 * Math.pow(2, level - 1);
}

/** Goals required to level up. Start at 3 for level 1→2; each level = round(previous × 1.25) */
const getGoalsRequiredForLevel = (level: number): number => {
  if (level <= 1) return 3;
  let prev = 3;
  for (let i = 2; i <= level; i++) {
    prev = Math.round(prev * 1.25);
  }
  return prev;
};

/** Goal difficulty scaling: 0.9 = easier, 1.0 = normal, 1.1 = harder, 1.2 = much harder */
const GOAL_DIFFICULTY_SCALING = 1.0;

/** Crops required for goal order. Scales with player level, crop yield, and has random variation. */
const getGoalCropRequired = (
  playerLevel: number,
  cropYieldLevel: number,
  goalDifficultyScaling: number = GOAL_DIFFICULTY_SCALING
): number => {
  const baseGoal = 5 + Math.floor(playerLevel / 3) + Math.floor(cropYieldLevel * 0.5);
  const variationRange = 1 + Math.floor(playerLevel / 10);
  const randomOffset = Math.floor(Math.random() * (2 * variationRange + 1)) - variationRange;
  const variedGoal = baseGoal + randomOffset;
  const scaledGoal = Math.round(variedGoal * goalDifficultyScaling);
  return Math.max(5, scaledGoal);
};
import { ErrorBoundary } from './components/ErrorBoundary';

// Preload popup assets on module load to prevent flash of unstyled content
const POPUP_ASSETS_TO_PRELOAD = [
  assetPath('/assets/popups/popup_background.png?v=2'),
  assetPath('/assets/popups/popup_header.png'),
  assetPath('/assets/popups/popup_divider.png'),
  assetPath('/assets/vfx/particle_leaf_1.png'),
  assetPath('/assets/vfx/particle_leaf_2.png'),
  ...([1, 2, 3, 4, 5].map((n) => assetPath(`/assets/icons/icons_goals/icon_goal_${n}.png`))),
];

POPUP_ASSETS_TO_PRELOAD.forEach((src) => {
  const img = new Image();
  img.src = src;
});

/** Goal icon for plant level: plant_N uses icon_goal_N.png (plants 1-5 for now) */
const getGoalIconForPlantLevel = (plantLevel: number): string =>
  assetPath(`/assets/icons/icons_goals/icon_goal_${Math.max(1, Math.min(5, plantLevel))}.png`);

/** Plant names and descriptions for discovery popups */
const PLANT_DATA: Record<number, { name: string; description: string }> = {
  1: { name: 'Tiny Sprout', description: 'A tiny green shoot just starting out, doing its best to look important.' },
  2: { name: 'Young Sapling', description: 'A small tree in the making that already seems quite proud of itself.' },
  3: { name: 'Wild Fern', description: 'A cheerful tangle of leaves growing in whatever direction feels right today.' },
  4: { name: 'Rosette Succulent', description: 'A neat spiral of sturdy leaves best admired from a respectful distance.' },
  5: { name: 'Little Daisy', description: 'A simple little flower with an open face that\'s always happy to be included.' },
  6: { name: 'Spring Daffodil', description: 'Shows up early every year and behaves like it deserves the credit.' },
  7: { name: 'Pink Tulip', description: 'A tidy upright bloom that looks like it prefers things done properly.' },
  8: { name: 'Chrysanthemum', description: 'An impressive number of petals with no clear signs of stopping.' },
  9: { name: 'Fresh Lavender', description: 'Soft little flowers with a gentle scent that quietly spreads whether invited or not.' },
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
}

export default function App() {
  // Loading screen state
  const [isLoading, setIsLoading] = useState(true);
  const [gameOpacity, setGameOpacity] = useState(0);
  
  const [activeTab, setActiveTab] = useState<TabType>('SEEDS');
  const [activeScreen, setActiveScreen] = useState<ScreenType>('FARM');
  const [isExpanded, setIsExpanded] = useState(false);
  const [money, setMoney] = useState(0);

  const [grid, setGrid] = useState<BoardCell[]>(generateInitialGrid());
  const [seedProgress, setSeedProgress] = useState(0);
  const [harvestProgress, setHarvestProgress] = useState(0);
  const [isSeedFlashing, setIsSeedFlashing] = useState(false);
  const [isHarvestFlashing, setIsHarvestFlashing] = useState(false);
  const [seedsState, setSeedsState] = useState(createInitialSeedsState);
  const [harvestState, setHarvestState] = useState<HarvestState>(createInitialHarvestState);
  const [cropsState, setCropsState] = useState<Record<string, UpgradeState>>(createInitialCropsState);
  const [highestPlantEver, setHighestPlantEver] = useState(1); // Track highest plant level ever created
  const [seedsInStorage, setSeedsInStorage] = useState(0);
  
  // Discovery popup state
  const [discoveryPopup, setDiscoveryPopup] = useState<{ isVisible: boolean; level: number } | null>(null);
  // Plant info popup state (for barn)
  const [plantInfoPopup, setPlantInfoPopup] = useState<{ isVisible: boolean; level: number } | null>(null);
  // Limited offer popup state
  const [limitedOfferPopup, setLimitedOfferPopup] = useState<{ isVisible: boolean; title?: string; imageSrc: string; subtitle: string; description: string; buttonText: string; offerId?: string } | null>(null);
  // Rewarded offers shown in upgrade list (when player declines popup)
  const [rewardedOffers, setRewardedOffers] = useState<RewardedOffer[]>([]);
  // Barn particles for "Add to Barn" button
  const [barnParticles, setBarnParticles] = useState<BarnParticleData[]>([]);
  // Offer particles for limited offer decline (fly to tab)
  const [offerParticles, setOfferParticles] = useState<(OfferParticleData & { tab: TabType; offerData: { id: string; name: string; description: string } })[]>([]);
  // Ref for upgrade tabs to get tab element positions
  const upgradeTabsRef = useRef<UpgradeTabsRef>(null);
  // Barn notification state - shows when a new plant is added to barn
  const [barnNotification, setBarnNotification] = useState(false);
  const [unlockingCellIndices, setUnlockingCellIndices] = useState<number[]>([]); // Cells currently playing unlock animation
  // Goals: slot 1-5, each is 'empty' | 'loading' | 'green' | 'completed'. Only 1 loading at a time.
  const [goalSlots, setGoalSlots] = useState<('empty' | 'loading' | 'green' | 'completed')[]>(['green', 'green', 'green', 'green', 'green']);
  const [goalPlantTypes, setGoalPlantTypes] = useState<number[]>([1, 2, 3, 4, 5]); // plant level 1-5 per slot when green
  const [goalLoadingSeconds, setGoalLoadingSeconds] = useState(30); // countdown 30->0 (Order Speed)
  const [goalTransitionSlot, setGoalTransitionSlot] = useState<number | null>(null); // slot transitioning loading->green (for fade)
  const [goalTransitionFade, setGoalTransitionFade] = useState(false); // triggers fade: loading out, green in
  const [goalSlotFadeInSlot, setGoalSlotFadeInSlot] = useState<number | null>(null); // slot fading in 0→100% over 500ms; countdown waits until done
  const [goalCounts, setGoalCounts] = useState<number[]>([5, 5, 5, 5, 5]); // remaining count per slot when green (e.g. 5→4→3)
  const [goalAmountsRequired, setGoalAmountsRequired] = useState<number[]>([5, 5, 5, 5, 5]); // crops required when goal was created (for reward calc)
  const [goalCompletedValues, setGoalCompletedValues] = useState<number[]>([0, 0, 0, 0, 0]); // coin value when completed (plantValue × amountRequired × 2)
  const [goalImpactSlots, setGoalImpactSlots] = useState<number[]>([]); // slots currently playing impact (white flash + icon scale)
  const [goalBounceSlots, setGoalBounceSlots] = useState<number[]>([]); // slots currently bouncing (panel down)
  const [goalSlidingUpSlots, setGoalSlidingUpSlots] = useState<Set<number>>(new Set()); // slots currently playing slide-up animation
  const [goalCompactionStagger, setGoalCompactionStagger] = useState<{ completedSlotIdx: number; completedPosition: number; oldDisplayIndices: number[]; isOverlapping?: boolean } | null>(null);
  const [goalDisplayOrder, setGoalDisplayOrder] = useState<number[]>([0, 1, 2, 3, 4]); // Fixed left-to-right order; never reshuffle by plant type
  const [activeGoalCoinParticles, setActiveGoalCoinParticles] = useState<GoalCoinParticleData[]>([]);
  const goalIconRef0 = useRef<HTMLImageElement>(null);
  const goalIconRef1 = useRef<HTMLImageElement>(null);
  const goalIconRef2 = useRef<HTMLImageElement>(null);
  const goalIconRef3 = useRef<HTMLImageElement>(null);
  const goalIconRef4 = useRef<HTMLImageElement>(null);
  const goalIconRefs = [goalIconRef0, goalIconRef1, goalIconRef2, goalIconRef3, goalIconRef4];
  const [activePlantPanels, setActivePlantPanels] = useState<PlantPanelData[]>([]);
  const [fertilizingCellIndices, setFertilizingCellIndices] = useState<number[]>([]); // Cells currently playing fertilize animation

  // Calculate locked cell count from grid
  const lockedCellCount = grid.filter(cell => cell.locked).length;
  // Calculate fertilizable cell count (unlocked and not already fertile)
  const fertilizableCellCount = grid.filter(cell => !cell.locked && !cell.fertile).length;
  const [seedBounceTrigger, setSeedBounceTrigger] = useState(0); // increment each 100% so bounce animation re-runs
  const [harvestBounceTrigger, setHarvestBounceTrigger] = useState(0); // increment each harvest so bounce animation re-runs

  const seedStorageLevel = seedsState?.seed_storage?.level ?? 0;
  const seedStorageMax = 1 + seedStorageLevel; // +1 storage per upgrade
  const seedBaseTier = getSeedBaseTier(seedsState); // Current base tier for plant icon
  
  const [activeProjectiles, setActiveProjectiles] = useState<ProjectileData[]>([]);
  const [impactCellIdx, setImpactCellIdx] = useState<number | null>(null);
  const [returnImpactCellIdx, setReturnImpactCellIdx] = useState<number | null>(null);
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [sourceCellFadeOutIdx, setSourceCellFadeOutIdx] = useState<number | null>(null);
  const [newCellImpactIdx, setNewCellImpactIdx] = useState<number | null>(null);
  const [leafBursts, setLeafBursts] = useState<{ id: string; x: number; y: number; startTime: number }[]>([]);
  const [leafBurstsSmall, setLeafBurstsSmall] = useState<{ id: string; x: number; y: number; startTime: number; particleCount?: number; useCircle?: boolean }[]>([]);
  const [unlockBursts, setUnlockBursts] = useState<{ id: string; x: number; y: number; startTime: number }[]>([]);
  const [buttonLeafBursts, setButtonLeafBursts] = useState<{ id: string; x: number; y: number; startTime: number }[]>([]);
  const [goalCoinLeafBursts, setGoalCoinLeafBursts] = useState<{ id: string; x: number; y: number; startTime: number }[]>([]);
  const [cellHighlightBeams, setCellHighlightBeams] = useState<{ id: string; x: number; y: number; cellWidth: number; cellHeight: number; startTime: number }[]>([]);
  const [activeCoinPanels, setActiveCoinPanels] = useState<CoinPanelData[]>([]);
  const [harvestBounceCellIndices, setHarvestBounceCellIndices] = useState<number[]>([]);
  const [walletFlashActive, setWalletFlashActive] = useState(false);
  const [walletBursts, setWalletBursts] = useState<{ id: number; trigger: number }[]>([]);
  const [playerLevel, setPlayerLevel] = useState(1);
  const [playerLevelProgress, setPlayerLevelProgress] = useState(0); // 0-5, 5 goals to level up
  const [playerLevelFlashTrigger, setPlayerLevelFlashTrigger] = useState(0);
  const [levelUpPopup, setLevelUpPopup] = useState<{ isVisible: boolean; level: number } | null>(null);
  const nextWalletBurstIdRef = useRef(0);
  const nextGoalCoinBurstIdRef = useRef(0);
  const levelUpGuardRef = useRef(false);
  const walletFlashTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingMergeLevelIncreaseRef = useRef<number>(1);
  const plantButtonRef = useRef<HTMLDivElement>(null);
  const harvestButtonRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const farmColumnRef = useRef<HTMLDivElement>(null);
  const hexAreaRef = useRef<HTMLDivElement>(null);
  const walletRef = useRef<HTMLButtonElement>(null);
  const walletIconRef = useRef<HTMLSpanElement>(null);
  const barnButtonRef = useRef<HTMLButtonElement>(null);
  const barnScrollRef = useRef<HTMLDivElement>(null);
  const barnScrollYRef = useRef(0);

  const [spriteCenter, setSpriteCenter] = useState({ x: 50, y: 50 }); // % relative to column, for sprite center

  // Track viewport dimensions for responsive scaling
  const [viewportWidth, setViewportWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 420);
  const [viewportHeight, setViewportHeight] = useState(typeof window !== 'undefined' ? window.innerHeight : 800);
  
  useEffect(() => {
    const handleResize = () => {
      setViewportWidth(window.innerWidth);
      setViewportHeight(window.innerHeight);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

// Countdown timer for rewarded offers (1 second tick)
  useEffect(() => {
    if (rewardedOffers.length === 0) return;

    const interval = setInterval(() => {
      setRewardedOffers(prev => {
        const updated = prev.map(offer => ({
          ...offer,
          timeRemaining: offer.timeRemaining !== undefined ? offer.timeRemaining - 1 : undefined
        }));

        // Filter out expired offers (timer reached 0)
        return updated.filter(o => o.timeRemaining === undefined || o.timeRemaining > 0);
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [rewardedOffers.length > 0]);
  
  // Derive which tabs have offers (for tab notification coloring)
  const tabsWithOffers = new Set(rewardedOffers.map(o => o.tab));
  
  // Calculate scale to fit 9:16 app into viewport
  // Base dimensions match the original max-w-md (448px) with 9:16 aspect
  const baseWidth = 448;
  const baseHeight = 796; // 448 * 16/9
  const scaleX = viewportWidth / baseWidth;
  const scaleY = viewportHeight / baseHeight;
  const appScale = Math.min(scaleX, scaleY);
  const appScaleRef = useRef(appScale);
  appScaleRef.current = appScale;
  
  // Calculate barn scale: only apply on narrow mobile screens (below 500px)
  // On wider screens, use scale 1 (no scaling)
  const mobileBreakpoint = 500;
  const barnDesignWidth = 470;
  const barnPadding = 20;
  const barnScale = viewportWidth >= mobileBreakpoint 
    ? 1 
    : Math.min(1, (viewportWidth - barnPadding) / barnDesignWidth);

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

  // When panel opens/closes, drive sprite position every frame for 500ms to match upgrade panel transition
  useEffect(() => {
    let rafId: number;
    let endAt = 0;
    const tick = () => {
      if (Date.now() < endAt) {
        updateSpriteCenter();
        rafId = requestAnimationFrame(tick);
      }
    };
    endAt = Date.now() + 500;
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
      return Math.max(0, shelvesBottom - viewportHeight + 20);
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

  // Get cells that have projectiles in flight (reserved)
  const reservedCellsSet = new Set(activeProjectiles.map(p => p.targetIdx));
  
  // Grid is "full" when all unlocked cells have items OR have incoming projectiles
  const isGridFull = grid.every((cell, idx) => cell.locked || cell.item !== null || reservedCellsSet.has(idx));

  const spawnProjectile = useCallback((targetIdx: number, plantLevel: number) => {
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
        plantLevel
      };
      setActiveProjectiles(prev => [...prev, newProj]);
    }
  }, []);

  // Seed Production upgrade: auto-increase progress when level >= 1. Rate = level completions per minute (+1/min per upgrade).
  const seedProductionLevel = seedsState?.seed_production?.level ?? 0;
  const lastSeedProgressTimeRef = useRef<number>(0);
  const seedProgressRef = useRef<number>(0);
  const tapZoomRef = useRef<{ start: number; end: number; startTime: number; duration: number } | null>(null);
  const [tapZoomTrigger, setTapZoomTrigger] = useState(0);

  // Tap zoom: animate +20% over a very short duration (fast smooth zoom)
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
    
    // Auto-progress starts at 3/min even at level 0
    lastSeedProgressTimeRef.current = Date.now();
    let rafId: number;
    const perMinute = Math.min(10, 3 + seedProductionLevel); // starts at 3/min (level 0), +1 per upgrade, max 10/min
    const percentPerMs = (perMinute * 100) / (60 * 1000); // % progress per millisecond
    const tick = () => {
      if (tapZoomRef.current) {
        lastSeedProgressTimeRef.current = Date.now();
        rafId = requestAnimationFrame(tick);
        return;
      }
      const now = Date.now();
      let deltaMs = now - lastSeedProgressTimeRef.current;
      lastSeedProgressTimeRef.current = now;
      deltaMs = Math.min(deltaMs, 50); // cap for tab backgrounding
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
  }, [seedProductionLevel, isLoading]);

  // Goal loading countdown: Order Speed (30s base - 5s per level, min 0). Don't start until slot is 100% faded in.
  const goalIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    if (isLoading) return;
    const loadingIdx = goalSlots.findIndex((s) => s === 'loading');
    if (loadingIdx < 0) return;
    // Don't run countdown while slot is fading in (0→100% over 500ms)
    if (loadingIdx === goalSlotFadeInSlot) return;
    if (goalIntervalRef.current) clearInterval(goalIntervalRef.current);
    const loadingSeconds = getGoalLoadingSeconds(harvestState);
    if (loadingSeconds <= 0) {
      // Instant: complete immediately
      setGoalBounceSlots((prev) => prev.includes(loadingIdx) ? prev : [...prev, loadingIdx]);
      setGoalTransitionSlot(loadingIdx);
      setGoalTransitionFade(false);
      const minLevel = getPremiumOrdersMinLevel(harvestState);
      const aboveMin = Math.random() < 0.5;
      const plantLevel = aboveMin
        ? (minLevel >= 5 ? 5 : minLevel + 1 + Math.floor(Math.random() * (5 - minLevel)))
        : 1 + Math.floor(Math.random() * minLevel);
      setGoalPlantTypes((p) => { const n = [...p]; n[loadingIdx] = plantLevel; return n; });
      const cropYieldLevel = cropsState?.crop_value?.level ?? 0;
      const goalRequired = getGoalCropRequired(playerLevel, cropYieldLevel);
      setGoalCounts((c) => { const next = [...c]; next[loadingIdx] = goalRequired; return next; });
      setGoalAmountsRequired((a) => { const next = [...a]; next[loadingIdx] = goalRequired; return next; });
      requestAnimationFrame(() => requestAnimationFrame(() => setGoalTransitionFade(true)));
      setTimeout(() => {
        const firstEmptyIdx = goalSlots.findIndex((s) => s === 'empty');
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
          setGoalLoadingSeconds(getGoalLoadingSeconds(harvestState));
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
          setGoalBounceSlots((prev) => prev.includes(loadingIdx) ? prev : [...prev, loadingIdx]);
          setGoalTransitionSlot(loadingIdx);
          setGoalTransitionFade(false);
          const minLevel = getPremiumOrdersMinLevel(harvestState);
          const aboveMin = Math.random() < 0.5;
          const plantLevel = aboveMin
            ? (minLevel >= 5 ? 5 : minLevel + 1 + Math.floor(Math.random() * (5 - minLevel)))
            : 1 + Math.floor(Math.random() * minLevel);
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
            const firstEmptyIdx = goalSlots.findIndex((s) => s === 'empty');
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
              setGoalLoadingSeconds(getGoalLoadingSeconds(harvestState));
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
  }, [isLoading, goalSlots, goalSlotFadeInSlot, harvestState, playerLevel, cropsState]);

  /**
   * At 100% seed progress: add one seed to storage (if room), reset to 0% immediately.
   * If storage is full and seed_surplus is upgraded, spawn a coin panel instead.
   */
  useEffect(() => {
    if (seedProgress !== 100 || !isSeedFlashing) return;
    seedProgressRef.current = 0;
    setSeedProgress(0);
    setTimeout(() => setIsSeedFlashing(false), 300);
    
    // Check if storage is full BEFORE we would add
    const isStorageFull = seedsInStorage >= seedStorageMax;
    const surplusValue = getSeedSurplusValue(seedsState);
    
    if (isStorageFull && surplusValue > 0) {
      // Storage full with seed surplus upgrade: spawn coin panel
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
        
        setActiveCoinPanels((prev) => [
          ...prev,
          {
            id: `seed-surplus-${Date.now()}-${Math.random().toString(36).slice(2)}`,
            value: surplusValue,
            startX,
            startY,
            hoverX,
            hoverY,
            moveToWalletDelayMs: 0,
          },
        ]);
      }
    } else {
      // Normal case: add seed to storage
      setSeedsInStorage((prev) => Math.min(seedStorageMax, prev + 1));
    }
  }, [seedProgress, isSeedFlashing, seedStorageMax, seedsInStorage, seedsState]);

  // Harvest Speed upgrade: auto-increase progress when level >= 1. Rate = level completions per minute (+1/min per upgrade).
  const harvestSpeedLevel = getHarvestSpeedLevel(cropsState);
  const lastHarvestProgressTimeRef = useRef<number>(0);
  const harvestProgressRef = useRef<number>(0);
  const harvestTapZoomRef = useRef<{ start: number; end: number; startTime: number; duration: number } | null>(null);
  const [harvestTapZoomTrigger, setHarvestTapZoomTrigger] = useState(0);

  // Harvest tap zoom: animate +20% over a very short duration (fast smooth zoom)
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
          setHarvestProgress(100);
          setIsHarvestFlashing(true);
        }
        return;
      }
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [harvestTapZoomTrigger]);

  // Harvest auto-progress: driven at 60fps via harvestProgressRef for smooth updates
  useEffect(() => {
    // Don't start progress until loading is complete
    if (isLoading) return;
    
    // Auto-progress starts at 3/min even at level 0
    lastHarvestProgressTimeRef.current = Date.now();
    let rafId: number;
    const perMinute = Math.min(10, 3 + harvestSpeedLevel); // starts at 3/min (level 0), +1 per upgrade, max 10/min
    const percentPerMs = (perMinute * 100) / (60 * 1000); // % progress per millisecond
    const tick = () => {
      if (harvestTapZoomRef.current) {
        lastHarvestProgressTimeRef.current = Date.now();
        rafId = requestAnimationFrame(tick);
        return;
      }
      const now = Date.now();
      let deltaMs = now - lastHarvestProgressTimeRef.current;
      lastHarvestProgressTimeRef.current = now;
      deltaMs = Math.min(deltaMs, 50); // cap for tab backgrounding
      const added = deltaMs * percentPerMs;
      const next = Math.min(100, harvestProgressRef.current + added);
      harvestProgressRef.current = next;
      if (next >= 100) {
        setHarvestProgress(100);
        setIsHarvestFlashing(true);
      }
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [harvestSpeedLevel, isLoading]);

  // Track previous value to detect when harvest button turns white
  const prevIsHarvestFlashingRef = useRef(isHarvestFlashing);

  // Trigger leaf burst when harvest button turns white (isHarvestFlashing becomes true)
  useEffect(() => {
    const wasNotFlashing = !prevIsHarvestFlashingRef.current;
    const nowFlashing = isHarvestFlashing;
    prevIsHarvestFlashingRef.current = isHarvestFlashing;
    
    if (wasNotFlashing && nowFlashing && harvestButtonRef.current) {
      const rect = harvestButtonRef.current.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      setButtonLeafBursts(prev => [...prev, {
        id: `harvest-${Date.now()}`,
        x: centerX,
        y: centerY,
        startTime: Date.now()
      }]);
    }
  }, [isHarvestFlashing]);

  // Helper function to trigger seed button leaf burst (called when shooting a seed)
  const triggerSeedButtonLeafBurst = useCallback(() => {
    if (plantButtonRef.current) {
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

  const spawnCropAt = useCallback((index: number, plantLevel: number = 1) => {
    setGrid(prev => {
      const newGrid = [...prev];
      if (newGrid[index] && newGrid[index].item === null) {
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

  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab);
    setIsExpanded(true);
  };

  // Handle tap on locked cell: open CROPS tab (opens the upgrade panel)
  const handleLockedCellTap = useCallback(() => {
    setActiveTab('CROPS');
    setIsExpanded(true);
  }, []);

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

  /** Calculate the plant level to spawn based on seed quality */
  const calculatePlantLevel = useCallback((): number => {
    const baseTier = getSeedBaseTier(seedsState);
    const qualityPercent = getSeedQualityPercent(seedsState);
    
    // Roll for quality upgrade: qualityPercent% chance to spawn baseTier+1 instead of baseTier
    if (qualityPercent > 0 && Math.random() * 100 < qualityPercent) {
      return baseTier + 1;
    }
    return baseTier;
  }, [seedsState]);

  const handlePlantClick = (e: React.MouseEvent) => {
    e.stopPropagation();

    // When white (seeds in storage): only fire seed, no progress
    if (seedsInStorage > 0) {
      // Get cells that have projectiles in flight (reserved)
      const reservedCells = new Set(activeProjectiles.map(p => p.targetIdx));
      
      // Only target unlocked empty cells that don't have incoming projectiles
      const emptyIndices = grid
        .map((cell, idx) => (cell.item === null && !cell.locked && !reservedCells.has(idx) ? idx : null))
        .filter((idx): idx is number => idx !== null);
      if (emptyIndices.length > 0) {
        const targetIdx = emptyIndices[Math.floor(Math.random() * emptyIndices.length)];
        // Calculate plant level at the moment of shooting (quality chance is determined on tap)
        const plantLevel = calculatePlantLevel();
        spawnProjectile(targetIdx, plantLevel);
        setSeedsInStorage((prev) => Math.max(0, prev - 1));
        triggerSeedButtonLeafBurst();
        
        // Bonus Seed: chance to fire a second seed
        const bonusChance = getBonusSeedChance(seedsState);
        if (bonusChance > 0 && Math.random() * 100 < bonusChance) {
          // Get remaining empty unlocked cells (excluding the first target)
          const remainingEmptyIndices = emptyIndices.filter(idx => idx !== targetIdx);
          
          // Pick a target for the second seed
          let secondTargetIdx: number;
          if (remainingEmptyIndices.length > 0) {
            // Fire to a different empty cell
            secondTargetIdx = remainingEmptyIndices[Math.floor(Math.random() * remainingEmptyIndices.length)];
          } else {
            // No other empty cell - fire to the same cell (seed will be "wasted")
            // We still spawn the projectile for visual effect, but spawnCropAt won't place anything
            // since the cell will already have an item
            secondTargetIdx = targetIdx;
          }
          
          const secondPlantLevel = calculatePlantLevel();
          // Slight delay so the two seeds don't overlap visually
          setTimeout(() => {
            spawnProjectile(secondTargetIdx, secondPlantLevel);
          }, 50);
        }
      }
      return;
    }

    if (isSeedFlashing) return;

    // Add +15% progress when button is green (no seeds in storage)
    const start = Math.max(0, seedProgressRef.current);
    const totalAfterTap = start + 15;
    
    if (totalAfterTap > 100) {
      // Tap goes past 100%: add to storage, reset to 0%, then continue with remainder
      const remainder = totalAfterTap - 100;
      setSeedsInStorage((prev) => Math.min(seedStorageMax, prev + 1));
      seedProgressRef.current = 0;
      setSeedProgress(0);
      setIsSeedFlashing(false);
      setSeedBounceTrigger((t) => t + 1);
      // Zoom from 0% to remainder (e.g. 5%)
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
    if (isHarvestFlashing) return;

    // Add +15 progress per tap (animated via harvestTapZoomRef)
    const current = harvestProgressRef.current;
    const next = Math.min(100, current + 15);
    harvestTapZoomRef.current = { start: current, end: next, startTime: Date.now(), duration: 100 };
    setHarvestTapZoomTrigger((t) => t + 1);

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
      grid.forEach((cell, cellIdx) => {
        if (!cell.item) return;
        harvestCellIndices.push(cellIdx);
        const level = cell.item.level;
        const slotIdx = level >= 1 && level <= 5
          ? goalPlantTypes.findIndex((pt, i) => pt === level && goalSlots[i] === 'green' && goalCounts[i] > 0)
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
          const goalCenter = getGoalIconCenter(slotIdx);
          const dist = goalCenter ? Math.hypot(hoverX - goalCenter.x, hoverY - goalCenter.y) : 0;
          const plantLevel = goalPlantTypes[slotIdx] ?? slotIdx + 1;
          plantPanelsWithDist.push({
            dist,
            panel: {
              id: `plant-${cellIdx}-${Date.now()}-${Math.random().toString(36).slice(2)}${idSuffix}`,
              goalSlotIdx: slotIdx,
              iconSrc: getGoalIconForPlantLevel(plantLevel),
              harvestAmount: cropYieldPerHarvest,
              startX,
              startY,
              hoverX,
              hoverY,
              moveToTargetDelayMs: delayMs,
            },
          });
        } else {
          const baseValue = getCoinValueForLevel(level);
          let value = baseValue;
          if (cell.fertile) value *= 2;
          value = Math.floor(value * surplusMultiplier);
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

        harvestCellIndices.forEach((cellIdx) => {
          const hexEl = document.getElementById(`hex-${cellIdx}`);
          if (hexEl) {
            const r = hexEl.getBoundingClientRect();
            setLeafBurstsSmall((prev) => [
              ...prev,
              {
                id: `harvest-${cellIdx}-${Date.now()}-${Math.random().toString(36).slice(2)}${idSuffix}`,
                x: r.left + r.width / 2,
                y: r.top + r.height / 2,
                startTime: Date.now(),
              },
            ]);
          }
        });

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
  }, [grid, cropsState, goalSlots, goalCounts, goalPlantTypes, harvestState]);

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
    const cropYieldPerHarvest = getCropYieldPerHarvest(cropsState);
    const surplusMultiplier = getSurplusSalesMultiplier(harvestState);

    const getGoalIconCenter = (slotIdx: number): { x: number; y: number } | null => {
      const iconEl = goalIconRefs[slotIdx]?.current;
      if (!iconEl) return null;
      const r = iconEl.getBoundingClientRect();
      return {
        x: (r.left + r.width / 2 - containerRect.left) / scale,
        y: (r.top + r.height / 2 - containerRect.top) / scale,
      };
    };

    triggeredCells.forEach((cellIdx) => {
      const cell = grid[cellIdx];
      if (!cell.item) return;

      const level = cell.item.level;
      const slotIdx = level >= 1 && level <= 5
        ? goalPlantTypes.findIndex((pt, i) => pt === level && goalSlots[i] === 'green' && goalCounts[i] > 0)
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
        const goalCenter = getGoalIconCenter(slotIdx);
        const dist = goalCenter ? Math.hypot(hoverX - goalCenter.x, hoverY - goalCenter.y) : 0;
        const plantLevel = goalPlantTypes[slotIdx] ?? slotIdx + 1;
        plantPanelsWithDist.push({
          dist,
          panel: {
            id: `merge-plant-${cellIdx}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
            goalSlotIdx: slotIdx,
            iconSrc: getGoalIconForPlantLevel(plantLevel),
            harvestAmount: cropYieldPerHarvest,
            startX,
            startY,
            hoverX,
            hoverY,
            moveToTargetDelayMs: 0,
          },
        });
      } else {
        const baseValue = getCoinValueForLevel(level);
        let value = baseValue;
        if (cell.fertile) value *= 2;
        value = Math.floor(value * surplusMultiplier);
        const dist = Math.hypot(hoverX - walletCenterX, hoverY - walletCenterY);
        coinPanelsWithDist.push({
          dist,
          panel: {
            id: `merge-harvest-${cellIdx}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
            value,
            startX,
            startY,
            hoverX,
            hoverY,
            moveToWalletDelayMs: 0,
          },
        });
      }

      // Spawn leaf burst for harvested cell
      setLeafBurstsSmall((prev) => [
        ...prev,
        {
          id: `merge-harvest-burst-${cellIdx}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
          x: hexRect.left + hexRect.width / 2,
          y: hexRect.top + hexRect.height / 2,
          startTime: Date.now(),
        },
      ]);
      
      // Spawn highlight VFX for merge harvest bonus
      setCellHighlightBeams((prev) => [
        ...prev,
        {
          id: `merge-harvest-highlight-${cellIdx}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
          x: hexRect.left + hexRect.width / 2,
          y: hexRect.top + hexRect.height / 2,
          cellWidth: hexRect.width,
          cellHeight: hexRect.height,
          startTime: Date.now(),
        },
      ]);
    });

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
  }, [grid, cropsState, goalSlots, goalCounts, goalPlantTypes, harvestState]);

  /**
   * At 100% harvest progress: perform harvest (spawn coin panels, leaf bursts), flash white, reset to 0%.
   */
  useEffect(() => {
    if (harvestProgress !== 100 || !isHarvestFlashing) return;
    
    // Perform harvest and trigger bounce
    performHarvest(0, '');
    setHarvestBounceTrigger((t) => t + 1);

    // Reset to 0% and continue auto-progress
    harvestProgressRef.current = 0;
    setHarvestProgress(0);
    setTimeout(() => setIsHarvestFlashing(false), 300);
  }, [harvestProgress, isHarvestFlashing, performHarvest]);

  // Called by HexBoard when starting a merge to calculate level increase
  const getMergeLevelIncrease = useCallback((_currentPlantLevel: number) => {
    pendingMergeLevelIncreaseRef.current = 1;
    return 1;
  }, []);

  const handleMerge = (sourceIdx: number, targetIdx: number) => {
    // Check if this will be a merge before updating state
    const source = grid[sourceIdx];
    const target = grid[targetIdx];
    const willMerge = source.item && target.item && target.item.level === source.item.level;
    
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
    
    // Update highest plant ever if we created a new record and show discovery popup
    if (newLevel != null && newLevel > highestPlantEver) {
      setHighestPlantEver(newLevel);
      // Show discovery popup immediately when merge starts (feels more responsive)
      setDiscoveryPopup({ isVisible: true, level: newLevel });
    }
    
    // Chain Harvest: per-cell chance to instantly harvest adjacent crops (without removing them)
    if (willMerge) {
      const mergeHarvestChance = getMergeHarvestChance(cropsState);
      if (mergeHarvestChance > 0) {
        performMergeHarvest(targetIdx, mergeHarvestChance, sourceIdx);
      }
    }
  };

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

  // Handle loading complete - fade in the game
  const handleLoadComplete = useCallback(() => {
    setIsLoading(false);
    // Animate game opacity from 0 to 1
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
  }, []);

  return (
    <ErrorBoundary>
      {/* Loading Screen */}
      {isLoading && (
        <LoadingScreen onLoadComplete={handleLoadComplete} />
      )}
<div className="flex items-center justify-center bg-[#050608] w-screen h-screen" style={{ opacity: gameOpacity }}>
      <div
        ref={containerRef}
        id="game-container"
        className="relative shadow-[0_0_100px_rgba(0,0,0,0.9)] overflow-hidden flex flex-col select-none font-['Inter'] bg-[#0c0d12]"
        style={{
          width: '448px',
          height: '796px',
          transform: `scale(${appScale})`,
          transformOrigin: 'center center',
        }}
      >
        <div className="flex-grow relative overflow-hidden min-h-0" style={{ zIndex: 10 }}>
          <div 
            className="absolute inset-0 flex transition-transform duration-700 ease-[cubic-bezier(0.16,1,0.3,1)]"
            style={{ transform: screenTranslateX, width: '300%' }}
          >
            <div className="w-1/3 h-full bg-[#0c0d12]">
              <StoreScreen money={money} walletFlashActive={walletFlashActive} onAddMoney={(amt) => setMoney(prev => prev + amt)} />
            </div>

            <div ref={farmColumnRef} className="w-1/3 h-full flex flex-col relative overflow-hidden grass-texture">
              {/* Grass Detail Overlay */}
              <div className="absolute inset-0 pointer-events-none grass-blades opacity-40 z-[1]"></div>
              {/* 1. Bleed: flat #3d8f38, full column, behind sprite (visible behind upgrade curve) */}
              <div
                className="absolute inset-0 pointer-events-none z-0"
                style={{ background: '#3d8f38' }}
              />
              {/* 2. Background sprite: primary, on top of bleed; center pinned to hex grid; transition matches upgrade panel (500ms, cubic-bezier) */}
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
                  walletBurstCount={walletBursts.length}
                  onWalletClick={() => setActiveScreen('STORE')}
                  playerLevel={playerLevel}
                  playerLevelProgress={playerLevelProgress}
                  playerLevelFlashTrigger={playerLevelFlashTrigger}
                  playerLevelGoalsRequired={getGoalsRequiredForLevel(playerLevel)}
                  onGiftClick={() => setLimitedOfferPopup({
                    isVisible: true,
                    offerId: 'super_seed_offer',
                    imageSrc: assetPath('/assets/plants/plant_2.png'),
                    subtitle: 'SUPER SEED',
                    description: 'Spawn 10 seeds instantly onto the board',
                    buttonText: 'Accept Offer',
                  })}
                />
              </div>

              {/* Goals Area - 5 goals, overlapping, left justified; compact when one completes (slide-over) */}
              <div 
                className="relative w-full z-20 flex-shrink-0 pointer-events-none"
                style={{ height: '85px', marginLeft: 20 }}
              >
                <div 
                  className="absolute left-0 right-0 overflow-hidden"
                  style={{ top: -55, height: 140, paddingTop: 55 }}
                >
                {[0, 1, 2, 3, 4].map((slotIdx) => {
                  const visibleOrder = goalDisplayOrder.filter((i) => goalSlots[i] !== 'empty');
                  const goalDisplayIndex = visibleOrder.indexOf(slotIdx);
                  const state = goalSlots[slotIdx];
                  const isBouncing = goalBounceSlots.includes(slotIdx);
                  const isTransitioning = goalTransitionSlot === slotIdx;
                  const isLoadingState = state === 'loading';
                  const isGreenState = state === 'green';
                  const isCompletedState = state === 'completed';
                  const isEmpty = state === 'empty';
                  const isFadingIn = slotIdx === goalSlotFadeInSlot;
                  const isSlidingUp = goalSlidingUpSlots.has(slotIdx);
                  const showSlot = !isEmpty || isTransitioning || isCompletedState;
                  const loadingOpacity = isLoadingState ? (goalTransitionFade ? 0 : 1) : isTransitioning ? (goalTransitionFade ? 0 : 1) : 0;
                  const greenOpacity = isGreenState ? 1 : isTransitioning ? (goalTransitionFade ? 1 : 0) : 0;
                  const showGreenContent = isGreenState || (isTransitioning && goalTransitionFade);
                  const showCompletedContent = isCompletedState;
                  const showLoadingText = isLoadingState && !goalTransitionFade;
                  const handleCompletedTap = () => {
                    if (!isCompletedState || isSlidingUp) return;
                    setGoalSlidingUpSlots((prev) => new Set(prev).add(slotIdx));
                    const iconEl = goalIconRefs[slotIdx]?.current;
                    const container = containerRef.current;
                    if (iconEl && container) {
                      const r = iconEl.getBoundingClientRect();
                      const cr = container.getBoundingClientRect();
                      const startX = (r.left + r.width / 2 - cr.left) / appScale;
                      const startY = (r.top + r.height / 2 - cr.top) / appScale;
                      const value = goalCompletedValues[slotIdx] ?? 0;
                      setActiveGoalCoinParticles((prev) => [...prev, { id: `goal-coin-${slotIdx}-${Date.now()}`, startX, startY, value }]);
                      // Player level: +1 progress on tap (not when coins hit wallet). Goals required = 2^level (2, 4, 8, ...)
                      setPlayerLevelProgress((prev) => {
                        const next = prev + 1;
                        const goalsRequired = getGoalsRequiredForLevel(playerLevel);
                        if (next >= goalsRequired) {
                          if (!levelUpGuardRef.current) {
                            levelUpGuardRef.current = true;
                            setLevelUpPopup({ isVisible: true, level: (playerLevel + 1) });
                            setTimeout(() => { levelUpGuardRef.current = false; }, 0);
                          }
                          return goalsRequired; // Stay at 100% until Unlock Now clicked
                        }
                        return next;
                      });
                      setPlayerLevelFlashTrigger((t) => t + 1);
                      // Leaf burst at tap (leaf 3 & 4, same stats as normal merge burst)
                      setGoalCoinLeafBursts((prev) => [...prev, {
                        id: `goal-coin-lb-${nextGoalCoinBurstIdRef.current++}`,
                        x: r.left + r.width / 2,
                        y: r.top + r.height / 2 + 30,
                        startTime: Date.now(),
                      }]);
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
                        setGoalSlots((s) => {
                          const hasLoading = s.some((state) => state === 'loading');
                          if (hasLoading) return s;
                          const n = [...s];
                          if (n[slotIdx] === 'empty') {
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
                      className={`absolute ${isFadingIn ? 'goal-no-transition' : 'goal-slide-over'} ${isBouncing ? 'goal-bounce' : ''} ${isFadingIn ? 'goal-slot-fade-in' : ''} ${isSlidingUp ? 'goal-slide-up' : ''} ${showCompletedContent ? 'pointer-events-auto cursor-pointer' : 'pointer-events-none'}`}
                      style={{
                        width: '105px',
                        height: '210px',
                        marginRight: '-30px',
                        marginTop: '-25px',
                        left: goalDisplayIndex >= 0 ? goalDisplayIndex * SLOT_STEP_PX : -9999,
                        opacity: isFadingIn ? undefined : (showSlot ? 1 : 0),
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
                              <img ref={goalIconRefs[slotIdx]} src={getGoalIconForPlantLevel(goalPlantTypes[slotIdx] ?? slotIdx + 1)} alt="" className={`absolute left-1/2 object-contain pointer-events-none transition-opacity duration-100 ${goalImpactSlots.includes(slotIdx) ? 'goal-icon-bounce' : ''}`} style={{ zIndex: 6, bottom: '71%', width: 40, height: 40, opacity: greenOpacity, transform: 'translate(-50%, -2px)' }} />
                              <span className="absolute left-1/2 font-bold pointer-events-none transition-opacity duration-100" style={{ zIndex: 6, bottom: '62%', color: goalImpactSlots.includes(slotIdx) ? '#537b38' : '#a1b54e', fontSize: '15px', opacity: greenOpacity, transform: 'translate(-50%, -1px)' }}>{goalCounts[slotIdx]}</span>
                            </>
                          )}
                          {showCompletedContent && (
                            <>
                              <img ref={goalIconRefs[slotIdx]} src={assetPath('/assets/icons/icon_coin.png')} alt="" className={`absolute left-1/2 object-contain pointer-events-none ${isBouncing ? 'goal-icon-bounce' : ''}`} style={{ zIndex: 6, bottom: '71%', width: 40, height: 40, transform: 'translate(-50%, -2px)' }} />
                              <span className="absolute left-1/2 font-bold pointer-events-none" style={{ zIndex: 6, bottom: '62%', color: '#c99959', fontSize: '15px', transform: 'translate(-50%, -1px)' }}>{goalCompletedValues[slotIdx]}</span>
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
                </div>
              </div>

              <div 
                ref={hexAreaRef}
                className="relative flex-grow flex flex-col items-center justify-center overflow-visible z-10"
              >
                {/* Only tapping this backdrop (background) closes the panel; hex cells and plants do not */}
                <div
                  className="absolute inset-0 z-0 cursor-pointer"
                  onClick={() => setIsExpanded(false)}
                  aria-label="Close upgrade panel"
                />
                <div className="absolute bottom-4 w-full px-3 flex justify-between items-end z-20 pointer-events-none transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]">
                   <div className="pointer-events-auto flex items-center justify-center" ref={plantButtonRef} style={{ transform: 'scale(0.9)', transformOrigin: 'center center' }} onClick={(e) => e.stopPropagation()}>
<SideAction
                        label="Plant"
                        icon={assetPath(`/assets/plants/plant_${seedBaseTier}.png`)}
                        iconScale={1.35}
                        iconOffsetY={-1}
                        progress={Math.max(0, Math.min(1, seedProgress / 100))}
                        progressRef={seedProgressRef} 
                        color="#a7c957"
                        isActive={activeTab === 'SEEDS' && isExpanded}
                        isFlashing={seedsInStorage > 0}
                        shouldAnimate={!isGridFull}
                        isBoardFull={isGridFull}
                        storageCount={seedsInStorage}
                        storageMax={seedStorageMax}
                        bounceTrigger={seedBounceTrigger}
                        onClick={handlePlantClick}
                      />
                   </div>
                   <div className="pointer-events-auto flex items-center justify-center" ref={harvestButtonRef} style={{ transform: 'scale(0.9)', transformOrigin: 'center center' }} onClick={(e) => e.stopPropagation()}>
                     <SideAction 
                        label="Harvest" 
                        icon={assetPath('/assets/icons/icon_harvest.png')} 
                        progress={harvestProgress / 100}
                        progressRef={harvestProgressRef}
                        color="#a7c957"
                        isActive={activeTab === 'HARVEST' && isExpanded}
                        isFlashing={isHarvestFlashing}
                        shouldAnimate={true}
                        isBoardFull={false}
                        noRotateOnFlash={true}
                        bounceTrigger={harvestBounceTrigger}
                        iconScale={1.5}
                        onClick={handleHarvestClick}
                      />
                   </div>
                </div>

                {/* Reduced height from 340px to 323px (5% smaller); pointer-events-none so taps on background close upgrade panel */}
                <div className="relative w-full flex items-center justify-center h-[323px] overflow-visible pointer-events-none" style={{ marginBottom: '35px' }}>
                  <HexBoard
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
                    onLockedCellTap={handleLockedCellTap}
                    unlockingCellIndices={unlockingCellIndices}
                    fertilizingCellIndices={fertilizingCellIndices}
                    appScale={appScale}
                    onMergeImpactStart={(cellIdx, px, py, mergeResultLevel) => {
                      const container = containerRef.current;
                      if (!container) return;
                      const scale = appScaleRef.current;
                      const rect = container.getBoundingClientRect();
                      setLeafBursts((prev) => [
                        ...prev,
                        {
                          id: Math.random().toString(36).slice(2),
                          x: rect.left + px * scale,
                          y: rect.top + py * scale,
                          startTime: Date.now(),
                        },
                      ]);
                      if (mergeResultLevel != null) {
                        const slotIdx = mergeResultLevel >= 1 && mergeResultLevel <= 5
                          ? goalPlantTypes.findIndex((pt, i) => pt === mergeResultLevel && goalSlots[i] === 'green' && goalCounts[i] > 0)
                          : -1;
                        const hasGoalForPlant = slotIdx >= 0;
                        const hexEl = document.getElementById(`hex-${cellIdx}`);
                        const panelHeightPx = 14;
                        const offsetUp = (panelHeightPx / 2 + 4) * 0.4;
                        const hoverX = px;
                        const hoverY = hexEl
                          ? ((hexEl.getBoundingClientRect().top - rect.top) / scale) - offsetUp
                          : py - offsetUp;
                        if (hasGoalForPlant) {
                          const plantLevel = goalPlantTypes[slotIdx] ?? slotIdx + 1;
                          setActivePlantPanels((prev) => [
                            ...prev,
                            {
                              id: `merge-plant-${cellIdx}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
                              goalSlotIdx: slotIdx,
                              iconSrc: getGoalIconForPlantLevel(plantLevel),
                              harvestAmount: getCropYieldPerHarvest(cropsState),
                              startX: px,
                              startY: py,
                              hoverX,
                              hoverY,
                              moveToTargetDelayMs: 0,
                            },
                          ]);
                        } else {
                          const baseValue = getCoinValueForLevel(mergeResultLevel);
                          const surplusMultiplier = getSurplusSalesMultiplier(harvestState);
                          const value = Math.floor(baseValue * surplusMultiplier);
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
                      // Spawn leaf burst at drop location (30 particles, circular spread)
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
                className="flex flex-col overflow-hidden relative z-30 flex-shrink-0 shadow-[0_-15px_50px_rgba(0,0,0,0.15)] rounded-t-[32px] transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]"
                style={{
                  flex: isExpanded ? '0 0 279px' : '0 0 50px',
                  background: '#fcf0c6',
                  borderTop: '1px solid #ebdbaf'
                }}
              >
                <UpgradeTabs 
                  ref={upgradeTabsRef}
                  activeTab={activeTab} 
                  onTabChange={handleTabChange}
                  tabsWithOffers={tabsWithOffers}
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
                    rewardedOffers={rewardedOffers}
                    playerLevel={playerLevel}
                    onRewardedOfferClick={(offerId) => {
                      // Find the offer and show the popup
                      const offer = rewardedOffers.find(o => o.id === offerId);
                      if (offer) {
                        setLimitedOfferPopup({
                          isVisible: true,
                          offerId: offer.id,
                          imageSrc: assetPath('/assets/plants/plant_2.png'),
                          subtitle: offer.name,
                          description: offer.description,
                          buttonText: 'Watch Ad',
                        });
                      }
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

                  {/* Barn tools - fixed pixel size, centered */}
                  <div className="relative pointer-events-none" style={{ zIndex: 1, marginTop: -10, overflow: 'visible' }}>
                    <img
                      src={assetPath('/assets/barn/barn_tools.png')}
                      alt="Barn Tools"
                      style={{
                        width: '400px',
                        height: 'auto',
                        maxWidth: 'none',
                        position: 'relative',
                        left: '50%',
                        transform: 'translateX(-50%)',
                      }}
                    />
                  </div>

                  {/* Shelves and plants wrapper - each shelf with its plants in one container */}
                  <div className="relative flex flex-col items-center" style={{ marginTop: -30 }} data-barn-shelves>
                    {[0, 1, 2, 3, 4, 5].map((shelfIndex) => {
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
                          {/* Shelf image */}
                          <img
                            src={assetPath('/assets/barn/barn_shelf.png')}
                            alt={`Shelf ${shelfIndex + 1}`}
                            className="pointer-events-none"
                            style={{ width: '100%', height: 'auto' }}
                          />
                          {/* Plants on this shelf */}
                          <div 
                            className="absolute flex justify-center pointer-events-none"
                            style={{
                              left: '50%',
                              transform: 'translateX(-50%)',
                              bottom: '125px',
                              gap: '-10px',
                              zIndex: 10,
                            }}
                          >
                            {[0, 1, 2, 3].map((plantOffset) => {
                              const plantLevel = startPlant + plantOffset;
                              const isUnlocked = plantLevel <= highestPlantEver;
                              return (
                                <img
                                  key={plantOffset}
                                  src={assetPath(`/assets/plants/plant_${isUnlocked ? plantLevel : 0}.png`)}
                                  alt={`Plant ${plantLevel}`}
                                  className={`object-contain ${isUnlocked ? 'cursor-pointer pointer-events-auto active:scale-95' : 'pointer-events-none'}`}
                                  style={{
                                    width: '95px',
                                    height: '95px',
                                  }}
                                  onClick={isUnlocked ? (e) => {
                                    e.stopPropagation();
                                    setPlantInfoPopup({ isVisible: true, level: plantLevel });
                                  } : undefined}
                                />
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
                  <PageHeader money={money} walletFlashActive={walletFlashActive} plantWallet={{ unlockedCount: highestPlantEver, totalCount: 24 }} hideTopBarBg />
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
        {/* Only render when on FARM screen to prevent VFX showing on other screens */}
        {activeScreen === 'FARM' && createPortal(
          <div className="fixed inset-0 pointer-events-none overflow-visible" style={{ zIndex: 55 }}>
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
            {cellHighlightBeams.map((b) => (
              <CellHighlightBeam
                key={b.id}
                x={b.x}
                y={b.y}
                cellWidth={b.cellWidth}
                cellHeight={b.cellHeight}
                startTime={b.startTime}
                appScale={appScale}
                onComplete={() => setCellHighlightBeams((prev) => prev.filter((x) => x.id !== b.id))}
              />
            ))}
          </div>,
          document.body
        )}

        {/* Popups: portal to body with higher z-index than particles */}
        {createPortal(
          <div className="fixed inset-0 pointer-events-none" style={{ zIndex: 100 }}>
            {/* Level Up Popup */}
            {levelUpPopup && (
              <LevelUpPopup
                isVisible={levelUpPopup.isVisible}
                onClose={() => setLevelUpPopup(null)}
                level={levelUpPopup.level}
                onUnlockNow={() => {
                  setPlayerLevel((l) => l + 1);
                  setPlayerLevelProgress(0);
                }}
                appScale={appScale}
              />
            )}

            {/* Discovery Popup */}
            {discoveryPopup && (
              <DiscoveryPopup
                isVisible={discoveryPopup.isVisible}
                onClose={() => setDiscoveryPopup(null)}
                title="New Discovery"
                imageSrc={assetPath(`/assets/plants/plant_${Math.min(discoveryPopup.level, 14)}.png`)}
                imageLevel={discoveryPopup.level}
                subtitle={getPlantData(discoveryPopup.level).name}
                description={getPlantData(discoveryPopup.level).description}
                buttonText="Add to Shed"
                showCloseButton={false}
                closeOnBackdropClick={false}
                appScale={appScale}
                onButtonClick={(buttonRect) => {
                  const container = containerRef.current;
                  if (!container) return;
                  const scale = appScaleRef.current;
                  const containerRect = container.getBoundingClientRect();
                  setBarnParticles(prev => [...prev, {
                    id: `barn-${Date.now()}`,
                    startX: (buttonRect.left + buttonRect.width / 2 - containerRect.left) / scale,
                    startY: (buttonRect.top + buttonRect.height / 2 - containerRect.top) / scale,
                  }]);
                }}
              />
            )}

            {/* Plant Info Popup (Barn) */}
            {plantInfoPopup && (
              <PlantInfoPopup
                isVisible={plantInfoPopup.isVisible}
                onClose={() => setPlantInfoPopup(null)}
                plantLevel={plantInfoPopup.level}
                plantName={getPlantData(plantInfoPopup.level).name}
                plantDescription={getPlantData(plantInfoPopup.level).description}
                isUnlocked={plantInfoPopup.level <= highestPlantEver}
                appScale={appScale}
              />
            )}

            {/* Limited Offer Popup */}
            {limitedOfferPopup && (
              <LimitedOfferPopup
                isVisible={limitedOfferPopup.isVisible}
                onClose={() => {
                  setLimitedOfferPopup(null);
                }}
                onCloseButtonClick={() => {
                  // Fire particle from above the tab, falling down to it
                  if (limitedOfferPopup.offerId) {
                    const container = containerRef.current;
                    const offerTab: TabType = 'SEEDS';
                    const tabEl = upgradeTabsRef.current?.getTabRef(offerTab);
                    if (container && tabEl) {
                      const scale = appScaleRef.current;
                      const containerRect = container.getBoundingClientRect();
                      const tabRect = tabEl.getBoundingClientRect();
                      // Spawn above the tab text
                      const startX = (tabRect.left + tabRect.width / 2 - containerRect.left) / scale;
                      const startY = (tabRect.top - 80 - containerRect.top) / scale;
                      setOfferParticles(prev => [...prev, {
                        id: `offer-${Date.now()}`,
                        startX,
                        startY,
                        tab: offerTab,
                        offerData: {
                          id: limitedOfferPopup.offerId!,
                          name: limitedOfferPopup.subtitle,
                          description: limitedOfferPopup.description,
                        },
                      }]);
                    }
                  }
                }}
                title={limitedOfferPopup.title}
                imageSrc={limitedOfferPopup.imageSrc}
                subtitle={limitedOfferPopup.subtitle}
                description={limitedOfferPopup.description}
                buttonText={limitedOfferPopup.buttonText}
                appScale={appScale}
                onButtonClick={() => {
                  console.log('Limited offer accepted!');
                  // Remove from rewarded offers if it was there
                  if (limitedOfferPopup.offerId) {
                    setRewardedOffers(prev => prev.filter(o => o.id !== limitedOfferPopup.offerId));
                  }
                  setLimitedOfferPopup(null);
                }}
              />
            )}
          </div>,
          document.body
        )}

        <div className="absolute inset-0 pointer-events-none z-[60] overflow-hidden">
          {activeProjectiles.map(p => (
            <Projectile 
              key={p.id}
              data={p}
              appScale={appScale}
              onImpact={(targetIdx) => {
                // Use the plantLevel that was determined when the seed was shot
                spawnCropAt(targetIdx, p.plantLevel);
                const hexEl = document.getElementById(`hex-${targetIdx}`);
                if (hexEl) {
                  const r = hexEl.getBoundingClientRect();
                  setLeafBurstsSmall((prev) => [
                    ...prev,
                    {
                      id: Math.random().toString(36).slice(2),
                      x: r.left + r.width / 2,
                      y: r.top + r.height / 2,
                      startTime: Date.now(),
                    },
                  ]);
                  
                  // Seed Quality bonus: play highlight VFX if plant spawned at higher level than base tier
                  if (p.plantLevel > seedBaseTier) {
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
          {activeCoinPanels.map((coin) => (
            <CoinPanel
              key={coin.id}
              data={coin}
              containerRef={containerRef}
              walletRef={walletRef}
              walletIconRef={walletIconRef}
              appScale={appScale}
              onImpact={(value) => {
                setMoney(prev => prev + value);
                setWalletFlashActive(true);
                setWalletBursts((prev) => [...prev, { id: nextWalletBurstIdRef.current++, trigger: Date.now() }]);
                if (walletFlashTimeoutRef.current) clearTimeout(walletFlashTimeoutRef.current);
                walletFlashTimeoutRef.current = setTimeout(() => setWalletFlashActive(false), 120);
              }}
              onComplete={() => setActiveCoinPanels(prev => prev.filter((c) => c.id !== coin.id))}
            />
          ))}
          {activePlantPanels.map((panel) => (
            <PlantPanel
              key={panel.id}
              data={panel}
              containerRef={containerRef}
              targetRef={goalIconRefs[panel.goalSlotIdx]}
              appScale={appScale}
              onImpact={(goalSlotIdx, amount) => {
                setGoalBounceSlots((prev) => prev.includes(goalSlotIdx) ? prev : [...prev, goalSlotIdx]);
                setGoalImpactSlots((prev) => prev.includes(goalSlotIdx) ? prev : [...prev, goalSlotIdx]);
                setGoalCounts((c) => {
                  const next = [...c];
                  const prevCount = next[goalSlotIdx] ?? 0;
                  next[goalSlotIdx] = Math.max(0, prevCount - amount);
                  if (next[goalSlotIdx] === 0) {
                    const plantLevel = goalPlantTypes[goalSlotIdx] ?? goalSlotIdx + 1;
                    const plantValue = getCoinValueForLevel(plantLevel);
                    const amountRequired = goalAmountsRequired[goalSlotIdx] ?? 5;
                    const marketMultiplier = getMarketValueMultiplier(harvestState);
                    const rawValue = plantValue * amountRequired * 2 * marketMultiplier;
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
              onImpact={(value) => {
                let finalValue = value;
                const happyChance = getHappyCustomerChance(harvestState);
                if (happyChance > 0 && Math.random() * 100 < happyChance) {
                  finalValue *= 2;
                }
                setMoney((prev) => prev + finalValue);
                setWalletFlashActive(true);
                setWalletBursts((prev) => [...prev, { id: nextWalletBurstIdRef.current++, trigger: Date.now() }]);
                if (walletFlashTimeoutRef.current) clearTimeout(walletFlashTimeoutRef.current);
                walletFlashTimeoutRef.current = setTimeout(() => setWalletFlashActive(false), 120);
              }}
              onComplete={() => setActiveGoalCoinParticles((prev) => prev.filter((x) => x.id !== p.id))}
            />
          ))}
          
          {/* Barn Particles */}
          {barnParticles.map((particle) => (
            <BarnParticle
              key={particle.id}
              data={particle}
              containerRef={containerRef}
              barnButtonRef={barnButtonRef}
              appScale={appScale}
              onImpact={() => setBarnNotification(true)}
              onComplete={() => setBarnParticles(prev => prev.filter(p => p.id !== particle.id))}
            />
          ))}

          {/* Offer Particles (fall down to upgrade tab) */}
          {offerParticles.map((particle) => {
            const tabRef = { current: upgradeTabsRef.current?.getTabRef(particle.tab) ?? null };
            return (
              <OfferParticle
                key={particle.id}
                data={particle}
                containerRef={containerRef}
                targetRef={tabRef}
                appScale={appScale}
                onImpact={() => {
                  // Add to rewarded offers on particle impact
                  setRewardedOffers(prev => {
                    if (prev.some(o => o.id === particle.offerData.id)) return prev;
                    return [...prev, {
                      id: particle.offerData.id,
                      name: particle.offerData.name,
                      icon: '📦',
                      description: particle.offerData.description,
                      tab: particle.tab,
                      timeRemaining: 60,
                    }];
                  });
                }}
                onComplete={() => setOfferParticles(prev => prev.filter(p => p.id !== particle.id))}
              />
            );
          })}
        </div>

      </div>
    </div>
    </ErrorBoundary>
  );
}
