/**
 * Default FTUE textbox styles – use for all FTUE textboxes (with or without button).
 * Keep these locked in for consistency across welcome, seed_tap, and future steps.
 */

/**
 * FTUE visual scale:
 * - FTUE overlays are rendered in the same scaled coordinate space as the game (appScale).
 * - We keep FTUE copy/finger a bit smaller so it matches the original look,
 *   while still scaling at the exact same rate as the rest of the UI on resize.
 */
export const FTUE_VISUAL_SCALE = 0.7;
/** Debug: tint for FTUE blocker/backdrop areas (hole remains clear). */
export const FTUE_BLOCKER_TINT = 'rgba(0, 0, 0, 0)';

export const FTUE_TEXTBOX = {
  width: `${480 * FTUE_VISUAL_SCALE}px`,
  padding: `${18 * FTUE_VISUAL_SCALE}px ${10 * FTUE_VISUAL_SCALE}px`,
  backgroundColor: '#fcf0c6',
  borderRadius: `${24 * FTUE_VISUAL_SCALE}px`,
  boxShadow: '0 1px 14px rgba(0,0,0,0.96), inset 0 0 0 1.5px #e9dcaf',
  border: '2px solid rgba(180, 165, 130, 0.4)',
} as const;

export const FTUE_TEXTBOX_DIVIDER_MARGIN_BOTTOM = `${14 * FTUE_VISUAL_SCALE}px`;

export const FTUE_TEXTBOX_TEXT = {
  color: '#775041',
  fontFamily: 'Inter, sans-serif',
  fontSize: `${24 * FTUE_VISUAL_SCALE}px`,
  textAlign: 'center' as const,
} as const;
