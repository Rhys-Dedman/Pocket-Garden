/**
 * Limited offers (watch-ad / boost) config.
 * Used for popup, upgrade panel, and auto-trigger rules.
 */
import type { TabType } from './types';

export type LimitedOfferTriggerType =
  | 'garden_fill_max_50'   // Show when ≤50% of unlocked cells are filled
  | 'wallet_empty'        // Show when player wallet (money) is 0
  | 'anytime'             // Always eligible (random pool after 120s)
  | 'order_speed_not_maxed'  // Eligible if customer_speed upgrade not maxed
  | 'has_goal_available'  // Eligible if player has at least 1 goal slot active (green or loading)
  | string;

export interface LimitedOfferConfig {
  id: string;
  title: string;
  description: string;
  /** Asset path for header (popup + upgrade panel), e.g. '/assets/icons/icon_seedproduction.png' */
  headerIcon: string;
  /** Duration in minutes when active; null = N/A (hide duration in popup) */
  durationMinutes: number | null;
  /** Duration in seconds when active (e.g. 90 for "90s"); shown in popup when set. Overrides durationMinutes for display when both present. */
  durationSeconds?: number | null;
  /** Which upgrade tab shows this offer if player declines */
  upgradeTab: TabType;
  /** Trigger type for auto-show; evaluated in App */
  trigger: LimitedOfferTriggerType;
}

/** Single IAP / boost-bar entry for all coin multiplier packs (time stacks). */
export const DOUBLE_COINS_OFFER_ID = 'double_coins';
export const DOUBLE_COINS_HEADER_ICON = '/assets/icons/icon_coinmultiplier_1.png';

/** Store IAP no-ads row — stacks on boost bar (timer only; ad removal is game feature TBD). */
export const REMOVE_ADS_OFFER_ID = 'remove_ads';
export const REMOVE_ADS_HEADER_ICON = '/assets/icons/icon_noads.png';
/** Bundle main-column art (top of stacked pair). */
export const STARTER_PACK_HEADER_ICON = '/assets/icons/icon_starterpack.png';
export const HARVESTER_PACK_HEADER_ICON = '/assets/icons/icon_harvesterpack.png';
export const STORE_NO_ADS_ROW_BACKGROUND = '/assets/topui/ui_store_noads.png';

/** Old save / particle ids — treated as `double_coins` for stacking + UI. */
export const LEGACY_COIN_MULTIPLIER_OFFER_IDS = ['coin_multiplier_30m', 'coin_multiplier_2h', 'coin_multiplier_24h'] as const;

export function isLegacyCoinMultiplierOfferId(id: string): boolean {
  return (LEGACY_COIN_MULTIPLIER_OFFER_IDS as readonly string[]).includes(id);
}

export function isCoinMultiplierBoostId(id: string): boolean {
  return id === DOUBLE_COINS_OFFER_ID || isLegacyCoinMultiplierOfferId(id);
}

export const LIMITED_OFFERS: LimitedOfferConfig[] = [
  {
    id: 'seed_storm',
    title: 'Seed Storm',
    description: 'Instantly fill your empty cells with plants',
    headerIcon: '/assets/icons/icon_seedstorm.png',
    durationMinutes: null,
    upgradeTab: 'SEEDS',
    trigger: 'garden_fill_max_50',
  },
  {
    id: 'rapid_seeds',
    title: 'Rapid Seeds',
    description: 'Super fast seed production speed',
    headerIcon: '/assets/icons/icon_seedproduction.png',
    durationMinutes: null,
    durationSeconds: 90,
    upgradeTab: 'SEEDS',
    trigger: 'wallet_empty',
  },
  {
    id: 'double_harvest',
    title: 'Double Harvest',
    description: 'Get 2x the crops every harvest',
    headerIcon: '/assets/icons/icon_cropvalue.png',
    durationMinutes: null,
    durationSeconds: 120,
    upgradeTab: 'CROPS',
    trigger: 'anytime',
  },
  {
    id: 'special_delivery',
    title: 'Special Delivery',
    description: 'Instantly generate a high level plant',
    headerIcon: '/assets/plants/plant_1.png',
    durationMinutes: null,
    upgradeTab: 'SEEDS',
    trigger: 'anytime',
  },
  {
    id: 'rapid_harvest',
    title: 'Rapid Harvest',
    description: 'Super fast harvest cycle speed',
    headerIcon: '/assets/icons/icon_harvestspeed.png',
    durationMinutes: null,
    durationSeconds: 60,
    upgradeTab: 'CROPS',
    trigger: 'anytime',
  },
  {
    id: 'rush_orders',
    title: 'Rush Orders',
    description: 'Instantly generate new orders',
    headerIcon: '/assets/icons/icon_customerspeed.png',
    durationMinutes: null,
    durationSeconds: 90,
    upgradeTab: 'HARVEST',
    trigger: 'order_speed_not_maxed',
  },
  {
    id: 'happiest_customers',
    title: 'Happiest Customers',
    description: 'All orders will now give 2x coins',
    headerIcon: '/assets/icons/icon_happycustomer.png',
    durationMinutes: null,
    durationSeconds: 120,
    upgradeTab: 'HARVEST',
    trigger: 'has_goal_available',
  },
  /** IAP coin multiplier — one logical boost; store packs add time onto the same bar slot. */
  {
    id: DOUBLE_COINS_OFFER_ID,
    title: 'Double Coins',
    description: '2x all coins earned',
    headerIcon: DOUBLE_COINS_HEADER_ICON,
    durationMinutes: null,
    durationSeconds: null,
    upgradeTab: 'HARVEST',
    trigger: 'anytime',
  },
  /** Store IAP only — not in rewarded-ad rotation or auto limited-offer flow (`isStorePremiumOnlyOfferId`). */
  {
    id: REMOVE_ADS_OFFER_ID,
    title: 'Remove Ads',
    description: 'Remove all forced ads',
    headerIcon: REMOVE_ADS_HEADER_ICON,
    durationMinutes: null,
    durationSeconds: null,
    upgradeTab: 'HARVEST',
    trigger: 'anytime',
  },
];

export function getOfferById(id: string): LimitedOfferConfig | undefined {
  return LIMITED_OFFERS.find((o) => o.id === id);
}

/**
 * Double Coins is active at a specific moment (for offline sim: `atTimeMs` = wall clock when a surplus fired).
 */
export function hasActiveDoubleCoinsBoostAt(
  activeBoosts: ReadonlyArray<{ offerId?: string; endTime?: number; icon?: string }>,
  atTimeMs: number
): boolean {
  const headerNorm = DOUBLE_COINS_HEADER_ICON.replace(/\\/g, '/').toLowerCase();
  return activeBoosts.some((b) => {
    const endMs = typeof b.endTime === 'number' && Number.isFinite(b.endTime) ? b.endTime : Number(b.endTime);
    if (!Number.isFinite(endMs) || endMs <= atTimeMs) return false;

    const oid = String(b.offerId ?? '').trim();
    if (oid) {
      const oidLower = oid.toLowerCase();
      if (isCoinMultiplierBoostId(oid) || isCoinMultiplierBoostId(oidLower)) return true;
    }

    const icon = String(b.icon ?? '')
      .replace(/\\/g, '/')
      .toLowerCase();
    if (!icon) return false;
    return (
      icon.includes('coinmultiplier') ||
      icon.includes('coin_multiplier') ||
      icon === headerNorm ||
      icon.endsWith('icon_coinmultiplier_1.png') ||
      icon.endsWith('icon_coinmultiplier_2.png') ||
      icon.endsWith('icon_coinmultiplier_3.png')
    );
  });
}

/**
 * Double Coins is active if a non-expired boost matches by `offerId` **or** by coin-multiplier art
 * (some paths historically stored the row without `offerId`, so wallet multipliers never ran).
 */
export function hasActiveDoubleCoinsBoost(
  activeBoosts: ReadonlyArray<{ offerId?: string; endTime?: number; icon?: string }>
): boolean {
  return hasActiveDoubleCoinsBoostAt(activeBoosts, Date.now());
}

/** Wallet / payout multiplier while Double Coins boost is active (IAP / ad-granted bar). */
export function getDoubleCoinsPayoutMultiplier(
  activeBoosts: ReadonlyArray<{ offerId?: string; endTime?: number; icon?: string }>
): 1 | 2 {
  return hasActiveDoubleCoinsBoost(activeBoosts) ? 2 : 1;
}

/**
 * Use for **displayed** coin amounts and flying-coin `value` so players see 2× while Double Coins is on.
 * Wallet impact should add this number as-is (no second multiply).
 */
export function applyDoubleCoinsVisualAmount(
  baseCoins: number,
  activeBoosts: ReadonlyArray<{ offerId?: string; endTime?: number; icon?: string }>
): number {
  const m = getDoubleCoinsPayoutMultiplier(activeBoosts);
  if (m === 1 || !Number.isFinite(baseCoins)) return baseCoins;
  return Math.round(baseCoins * m);
}

/** Exclude IAP-only rows from rewarded-ad offer rotation. */
export const LIMITED_OFFERS_AD_POOL = LIMITED_OFFERS.filter(
  (o) => o.id !== DOUBLE_COINS_OFFER_ID && o.id !== REMOVE_ADS_OFFER_ID
);

const STORE_PREMIUM_ONLY_OFFER_IDS: ReadonlySet<string> = new Set([REMOVE_ADS_OFFER_ID]);

/** Store-only IAP — never auto limited popup, upgrade “decline” rewarded row, or free store rotation. */
export function isStorePremiumOnlyOfferId(id: string): boolean {
  return STORE_PREMIUM_ONLY_OFFER_IDS.has(id);
}

/** Store free-offer pool: only rewarded ads with a timed boost (durationSeconds or durationMinutes). */
export const STORE_DURATION_FREE_OFFER_IDS = [
  'rapid_seeds',
  'double_harvest',
  'rapid_harvest',
  'rush_orders',
  'happiest_customers',
] as const;

export type StoreDurationFreeOfferId = (typeof STORE_DURATION_FREE_OFFER_IDS)[number];

export function isStoreDurationFreeOfferId(id: string): id is StoreDurationFreeOfferId {
  return (STORE_DURATION_FREE_OFFER_IDS as readonly string[]).includes(id);
}

/** Random pick from pool, excluding any id in `exclude` (e.g. this slot’s last offer + other slot’s current). */
export function pickStoreDurationOfferId(exclude: ReadonlySet<string>): string {
  const pool = STORE_DURATION_FREE_OFFER_IDS.filter((oid) => !exclude.has(oid) && !isStorePremiumOnlyOfferId(oid));
  if (pool.length === 0) return STORE_DURATION_FREE_OFFER_IDS[0];
  return pool[Math.floor(Math.random() * pool.length)];
}

/** Two different offers for the two store slots on first load. */
export function pickInitialStoreFreeOfferSlots(): [string, string] {
  const a = pickStoreDurationOfferId(new Set());
  const b = pickStoreDurationOfferId(new Set([a]));
  return [a, b];
}

/** Header icon size (px) on store free (medium) cards. */
export const STORE_FREE_OFFER_HEADER_ICON_PX = 102.6;

/** Coin-offer main art: exactly half of free-offer header icon (draw size). */
export const STORE_COIN_OFFER_HEADER_ICON_PX = STORE_FREE_OFFER_HEADER_ICON_PX * 0.5;

/** Real-money coin boost rows (small store ui). Each row is independent; reorder this list to shuffle. */
export interface StoreCoinOfferConfig {
  id: string;
  title: string;
  /** Product art (same role as free-offer headerIcon), displayed at 50% of free-offer icon size. */
  headerIcon: string;
  /** Reward strip label (e.g. boost effect). */
  offerLineText: string;
  /** Duration shown on reward strip (e.g. `30m`, `2hr`). */
  durationText: string;
  /** e.g. "$9.99" */
  priceLabel: string;
  /** Stacks into one boost-bar slot per logical offer id (e.g. `double_coins`, `remove_ads`). */
  boostOfferId: typeof DOUBLE_COINS_OFFER_ID | typeof REMOVE_ADS_OFFER_ID;
  /** Boost length in ms (Collect applies this duration). */
  durationMs: number;
  /** Row chrome; default `ui_store_small`. */
  rowBackgroundAsset?: string;
  /** Reward strip icon (left of pill); default coin. */
  rewardStripIconPath?: string;
  /** Optional title color (default green from layout constants). */
  titleColor?: string;
}

export const STORE_COIN_OFFERS: StoreCoinOfferConfig[] = [
  {
    id: 'store_coin_boost',
    title: 'Coin Boost',
    headerIcon: '/assets/icons/icon_coinmultiplier_1.png',
    offerLineText: 'Double Coins',
    durationText: '30m',
    priceLabel: '$5.99',
    boostOfferId: DOUBLE_COINS_OFFER_ID,
    durationMs: 30 * 60 * 1000,
  },
  {
    id: 'store_coin_mega_boost',
    title: 'Coin Mega Boost',
    headerIcon: '/assets/icons/icon_coinmultiplier_2.png',
    offerLineText: 'Double Coins',
    durationText: '2hr',
    priceLabel: '$9.99',
    boostOfferId: DOUBLE_COINS_OFFER_ID,
    durationMs: 2 * 60 * 60 * 1000,
  },
  {
    id: 'store_coin_ultra_boost',
    title: 'Coin Ultra Boost',
    headerIcon: '/assets/icons/icon_coinmultiplier_3.png',
    offerLineText: 'Double Coins',
    durationText: '24hr',
    priceLabel: '$79.99',
    boostOfferId: DOUBLE_COINS_OFFER_ID,
    durationMs: 24 * 60 * 60 * 1000,
  },
  {
    id: 'store_no_ads',
    title: 'Remove Ads',
    titleColor: '#bc2b44',
    headerIcon: REMOVE_ADS_HEADER_ICON,
    offerLineText: 'Remove Ads',
    durationText: '7d',
    priceLabel: '$5.99',
    boostOfferId: REMOVE_ADS_OFFER_ID,
    durationMs: 7 * 24 * 60 * 60 * 1000,
    rowBackgroundAsset: STORE_NO_ADS_ROW_BACKGROUND,
    rewardStripIconPath: REMOVE_ADS_HEADER_ICON,
  },
];

/** Bundle cards (`ui_store_large`): coin row fields + optional extra reward lines below the primary strip. */
export interface StoreBundleExtraRewardRow {
  offerLineText: string;
  durationText: string;
  /** Reward strip icon; omit for default coin (e.g. Double Coins). */
  coinIconPath?: string;
  /** Optional scale for strip icon only (e.g. 0.95). */
  coinIconScale?: number;
}

/** One boost bar grant from a bundle IAP — each entry spawns its own Collect → boost particle. */
export interface StoreBundleIapBoostGrant {
  offerId: string;
  durationMs: number;
  icon: string;
}

export interface StoreBundleOfferConfig extends StoreCoinOfferConfig {
  /**
   * When set (top, bottom), main column shows two vertically stacked icons.
   * Keep `headerIcon` equal to `[0]` so purchase success and other `headerIcon` reads stay correct.
   */
  headerIconStack?: readonly [string, string];
  extraRewardRows?: ReadonlyArray<StoreBundleExtraRewardRow>;
  /** When set, overrides single `boostOfferId` for Collect: one particle + stack per grant (order = display rows). */
  iapBoostGrants?: readonly StoreBundleIapBoostGrant[];
  /** Optional “was” price above the purchase button (strikethrough, same typography as button). */
  originalPriceLabel?: string;
  /** Short label above the price stack (e.g. “Best Value”), right-aligned vs. centered prices. */
  valueCalloutText?: string;
  /**
   * With `limitedOfferCountdownDurationMs`, shows a wall-clock countdown **instead of** `originalPriceLabel`.
   * Deadline persisted in `localStorage` under this key; at 0 the line is removed (card + price stay).
   */
  limitedOfferCountdownStorageKey?: string;
  limitedOfferCountdownDurationMs?: number;
}

/** Collect → boost particles: one entry per grant (bundle uses `iapBoostGrants`, else single coin-row boost). */
export function getStorePurchaseBoostGrants(config: StoreCoinOfferConfig): { offerId: string; durationMs: number; icon: string }[] {
  const bundle = config as StoreBundleOfferConfig;
  if (bundle.iapBoostGrants?.length) {
    return bundle.iapBoostGrants.map((g) => ({
      offerId: g.offerId,
      durationMs: g.durationMs,
      icon: g.icon,
    }));
  }
  return [{ offerId: config.boostOfferId, durationMs: config.durationMs, icon: config.headerIcon }];
}

/** localStorage end timestamp for starter-pack 24h UI; removed in `clearGameSave` so reset / fresh FTUE restarts the timer */
export const STORE_STARTER_PACK_COUNTDOWN_END_MS_KEY = 'store_bundle_starter_pack_countdown_end_ms';

export const STORE_BUNDLE_OFFERS: StoreBundleOfferConfig[] = [
  {
    ...STORE_COIN_OFFERS[0],
    id: 'store_bundle_starter_pack',
    title: 'Starter Pack',
    headerIcon: STARTER_PACK_HEADER_ICON,
    headerIconStack: [STARTER_PACK_HEADER_ICON, REMOVE_ADS_HEADER_ICON],
    offerLineText: 'Remove Ads',
    durationText: '24hr',
    rewardStripIconPath: REMOVE_ADS_HEADER_ICON,
    extraRewardRows: [
      { offerLineText: 'Double Coins', durationText: '2hr' },
      {
        offerLineText: 'Rapid Seeds',
        durationText: '30m',
        coinIconPath: '/assets/icons/icon_seedproduction.png',
        coinIconScale: 0.95,
      },
    ],
    iapBoostGrants: [
      { offerId: REMOVE_ADS_OFFER_ID, durationMs: 24 * 60 * 60 * 1000, icon: REMOVE_ADS_HEADER_ICON },
      { offerId: DOUBLE_COINS_OFFER_ID, durationMs: 2 * 60 * 60 * 1000, icon: DOUBLE_COINS_HEADER_ICON },
      {
        offerId: 'rapid_seeds',
        durationMs: 30 * 60 * 1000,
        icon: '/assets/icons/icon_seedproduction.png',
      },
    ],
    priceLabel: '$9.99',
    valueCalloutText: 'Limited Offer',
    limitedOfferCountdownStorageKey: STORE_STARTER_PACK_COUNTDOWN_END_MS_KEY,
    limitedOfferCountdownDurationMs: 24 * 60 * 60 * 1000,
  },
  {
    ...STORE_COIN_OFFERS[1],
    id: 'store_bundle_harvesters_pack',
    title: 'Harvester Pack',
    headerIcon: HARVESTER_PACK_HEADER_ICON,
    headerIconStack: [HARVESTER_PACK_HEADER_ICON, REMOVE_ADS_HEADER_ICON],
    offerLineText: 'Remove Ads',
    durationText: '7d',
    rewardStripIconPath: REMOVE_ADS_HEADER_ICON,
    extraRewardRows: [
      { offerLineText: 'Double Coins', durationText: '24hr' },
      {
        offerLineText: 'Rapid Harvest',
        durationText: '2hr',
        coinIconPath: '/assets/icons/icon_harvestspeed.png',
        coinIconScale: 0.95,
      },
    ],
    iapBoostGrants: [
      { offerId: REMOVE_ADS_OFFER_ID, durationMs: 7 * 24 * 60 * 60 * 1000, icon: REMOVE_ADS_HEADER_ICON },
      { offerId: DOUBLE_COINS_OFFER_ID, durationMs: 24 * 60 * 60 * 1000, icon: DOUBLE_COINS_HEADER_ICON },
      {
        offerId: 'rapid_harvest',
        durationMs: 2 * 60 * 60 * 1000,
        icon: '/assets/icons/icon_harvestspeed.png',
      },
    ],
    priceLabel: '$29.99',
    originalPriceLabel: '$99.99',
    valueCalloutText: 'Best Value',
  },
];
