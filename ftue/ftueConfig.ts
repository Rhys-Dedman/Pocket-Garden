/**
 * FTUE (First Time User Experience) config.
 * Each stage has: name, description (shown/hidden to player), behaviour, trigger.
 */

export type FtueStageId =
  | 'welcome'
  | 'seed_tap'
  | 'merge_drag'
  | 'first_goal'
  | 'first_harvest'
  | 'first_goal_collect'
  | 'first_more_orders'
  | 'first_harvest_multi'
  | 'first_collect_both'
  | 'first_upgrade'
  | 'recharge_intro';

export type FtueDescriptionVisibility = 'shown' | 'hidden';

export interface FtueStageDef {
  id: FtueStageId;
  name: string;
  /** Whether description is shown in a textbox or hidden */
  descriptionVisibility: FtueDescriptionVisibility;
  /** Trigger that causes this stage to show (e.g. 'after_splash') */
  trigger: string;
}

/** FTUE_1: Welcome Message – shown after splash/loading. */
export const FTUE_1: FtueStageDef = {
  id: 'welcome',
  name: 'Welcome Message',
  descriptionVisibility: 'shown',
  trigger: 'after_splash',
};

/** FTUE_2: Tap Seeds – text + finger above seed button; must tap 2x to plant 2 seeds. */
export const FTUE_2: FtueStageDef = {
  id: 'seed_tap',
  name: 'Tap Seeds',
  descriptionVisibility: 'shown',
  trigger: 'after_ftue1_close',
};

/** FTUE_3: Merge drag – finger slides from cell 4 to 13; only valid move is drag plant from 4 to 13. */
export const FTUE_3: FtueStageDef = {
  id: 'merge_drag',
  name: 'Merge Drag',
  descriptionVisibility: 'shown',
  trigger: 'after_ftue2_close',
};

/** FTUE_4: First goal – one order (plant 2, 5 crops) in slot 0, bouncing; textbox + "Lets Harvest!" button. */
export const FTUE_4: FtueStageDef = {
  id: 'first_goal',
  name: 'First Goal',
  descriptionVisibility: 'shown',
  trigger: 'after_ftue3_close',
};

/** FTUE_5: First harvest – harvest button visible (free mode); tap until goal slot 0 is completed. */
export const FTUE_5: FtueStageDef = {
  id: 'first_harvest',
  name: 'First Harvest',
  descriptionVisibility: 'shown',
  trigger: 'after_ftue4_close',
};

/** FTUE_6: Collect coins – textbox "Great job! Collect your coins", finger on goal slot 0; tap goal to collect and end. */
export const FTUE_6: FtueStageDef = {
  id: 'first_goal_collect',
  name: 'First Goal Collect',
  descriptionVisibility: 'shown',
  trigger: 'when_goal_slot_0_becomes_coin',
};

/** FTUE_7: More orders – 2 new goals spawn; textbox + finger at seeds; tap seeds 2x then fade out. */
export const FTUE_7: FtueStageDef = {
  id: 'first_more_orders',
  name: 'First More Orders',
  descriptionVisibility: 'shown',
  trigger: 'after_ftue6_collect',
};

/** FTUE_8: Harvest multiple – same as FTUE 5 (textbox + finger at harvest); "You can harvest multiple plants at the same time". White harvest button until both goals done, then green + fade out. */
export const FTUE_8: FtueStageDef = {
  id: 'first_harvest_multi',
  name: 'First Harvest Multi',
  descriptionVisibility: 'shown',
  trigger: 'after_ftue7_second_seed_lands',
};

/** FTUE_9: Finger on goal slot 1; block everything except the 2 goals. Fade out after both goals collected. */
export const FTUE_9: FtueStageDef = {
  id: 'first_collect_both',
  name: 'First Collect Both',
  descriptionVisibility: 'hidden',
  trigger: 'after_ftue8_close',
};

/** FTUE_10: After last goal coin collected – upgrade panel visible (closed), auto-open, swipe to Garden then Seeds, textbox "Use your coins to upgrade your garden", finger on first seeds upgrade purchase; on purchase set seeds/harvest to 100%. */
export const FTUE_10: FtueStageDef = {
  id: 'first_upgrade',
  name: 'First Upgrade',
  descriptionVisibility: 'shown',
  trigger: 'after_ftue9_close',
};

/** FTUE_11: Recharge intro – popup explaining seeds/harvest recharge over time, plus 3 starter goals. */
export const FTUE_11: FtueStageDef = {
  id: 'recharge_intro',
  name: 'Recharge Intro',
  descriptionVisibility: 'shown',
  trigger: 'after_ftue10_close',
};

export const FTUE_STAGES: Record<FtueStageId, FtueStageDef> = {
  welcome: FTUE_1,
  seed_tap: FTUE_2,
  merge_drag: FTUE_3,
  first_goal: FTUE_4,
  first_harvest: FTUE_5,
  first_goal_collect: FTUE_6,
  first_more_orders: FTUE_7,
  first_harvest_multi: FTUE_8,
  first_collect_both: FTUE_9,
  first_upgrade: FTUE_10,
  recharge_intro: FTUE_11,
};
