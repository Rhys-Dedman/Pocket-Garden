/** Collection FTUE blocker tint: transparent (blocks input but doesn't dim). */
export const COLLECTION_FTUE_BLOCKER_TINT = 'rgba(0, 0, 0, 0)';

export type CollectionFtuePhase =
  | 'intro_cta'
  | 'point_unlock'
  | 'popup_free'
  | 'wait_reveal'
  | 'point_bonuses'
  | 'point_garden_nav';

const PHASES: CollectionFtuePhase[] = [
  'intro_cta',
  'point_unlock',
  'popup_free',
  'wait_reveal',
  'point_bonuses',
  'point_garden_nav',
];

export function parseCollectionFtuePhase(raw: unknown): CollectionFtuePhase | null {
  if (typeof raw !== 'string') return null;
  return PHASES.includes(raw as CollectionFtuePhase) ? (raw as CollectionFtuePhase) : null;
}
