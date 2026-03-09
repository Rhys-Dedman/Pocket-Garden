/**
 * Limited offers (watch-ad / boost) config.
 * Used for popup, upgrade panel, and auto-trigger rules.
 */
import type { TabType } from './types';

export type LimitedOfferTriggerType =
  | 'garden_fill_max_50'  // Show when ≤50% of unlocked cells are filled
  | 'wallet_empty'        // Show when player wallet (money) is 0
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

export const LIMITED_OFFERS: LimitedOfferConfig[] = [
  {
    id: 'seed_storm',
    title: 'Seed Storm',
    description: 'Instantly fill your empty cells with plants',
    headerIcon: '/assets/plants/plant_2.png',
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
];

export function getOfferById(id: string): LimitedOfferConfig | undefined {
  return LIMITED_OFFERS.find((o) => o.id === id);
}
