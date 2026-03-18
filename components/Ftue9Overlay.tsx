/**
 * FTUE 9: Finger tap on goal slot 1 (same as FTUE 6). Block everything except the 2 goals.
 * No textbox. Fade out after both goals have been tapped/collected (handled in App).
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { assetPath } from '../utils/assetPath';
import { FTUE_BLOCKER_TINT, FTUE_VISUAL_SCALE } from '../ftue/ftueTextboxStyles';

const FADE_IN_MS = 400;
const FADE_OUT_MS = 400;
const GOAL_SLOT_0_ID = 'goal-slot-0';
const GOAL_SLOT_1_ID = 'goal-slot-1';
const FINGER_SIZE = 270 * FTUE_VISUAL_SCALE;
const FINGER_TAP_RIGHT = 21 * FTUE_VISUAL_SCALE;
const FINGER_TAP_DOWN = 42 * FTUE_VISUAL_SCALE;
const FINGER_OFFSET_UP_PX = 70 * FTUE_VISUAL_SCALE;
/** Blocker hole tuning (scaled) */
const HOLE_PAD_TOP_PX = 14 * FTUE_VISUAL_SCALE; // move top blocker down (hole starts lower)
const HOLE_PAD_BOTTOM_PX = 0 * FTUE_VISUAL_SCALE;

export interface Ftue9OverlayProps {
  isActive: boolean;
  isFadingOut: boolean;
  appScale: number;
  onFadeOutComplete: () => void;
}

export const Ftue9Overlay: React.FC<Ftue9OverlayProps> = ({
  isActive,
  isFadingOut,
  appScale,
  onFadeOutComplete,
}) => {
  const [opacity, setOpacity] = useState(0);
  const [goalRect0, setGoalRect0] = useState<{ left: number; top: number; width: number; height: number } | null>(null);
  const [goalRect1, setGoalRect1] = useState<{ left: number; top: number; width: number; height: number } | null>(null);
  /** Frozen finger position so it doesn't snap when goal DOM updates on final collect */
  const fingerPositionRef = useRef<{ left: number; top: number } | null>(null);

  const measure = useCallback(() => {
    const container = document.getElementById('game-container');
    if (!container) return;
    const cr = container.getBoundingClientRect();
    const el0 = document.getElementById(GOAL_SLOT_0_ID);
    const el1 = document.getElementById(GOAL_SLOT_1_ID);
    if (el0) {
      const r = el0.getBoundingClientRect();
      setGoalRect0({ left: (r.left - cr.left) / appScale, top: (r.top - cr.top) / appScale, width: r.width / appScale, height: r.height / appScale });
    }
    if (el1) {
      const r = el1.getBoundingClientRect();
      setGoalRect1({ left: (r.left - cr.left) / appScale, top: (r.top - cr.top) / appScale, width: r.width / appScale, height: r.height / appScale });
    }
  }, [appScale]);

  useEffect(() => {
    if (!isActive && !isFadingOut) {
      setOpacity(0);
      setGoalRect0(null);
      setGoalRect1(null);
      fingerPositionRef.current = null;
      return;
    }
    setOpacity(0);
    measure();
    const t = setTimeout(measure, 50);
    const resize = () => measure();
    window.addEventListener('resize', resize);
    const raf = requestAnimationFrame(measure);
    const fadeT = setTimeout(() => setOpacity(1), 50);
    return () => {
      clearTimeout(t);
      clearTimeout(fadeT);
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(raf);
    };
  }, [isActive, isFadingOut, measure]);

  useEffect(() => {
    if (!isFadingOut) return;
    setOpacity(0);
    const t = setTimeout(onFadeOutComplete, FADE_OUT_MS);
    return () => clearTimeout(t);
  }, [isFadingOut, onFadeOutComplete]);

  if (!isActive && !isFadingOut) return null;

  const fingerSize = FINGER_SIZE;
  const tapRight = FINGER_TAP_RIGHT;
  const tapDown = FINGER_TAP_DOWN;
  const offsetUp = FINGER_OFFSET_UP_PX;

  const hasBothRects = goalRect0 != null && goalRect1 != null;
  const showContent = (isActive && hasBothRects && opacity > 0) || isFadingOut;
  const opacityValue = isFadingOut ? 0 : opacity;

  // Compute finger position; freeze it when fading out so finger doesn't snap
  const fingerLeft = goalRect0
    ? goalRect0.left + goalRect0.width / 2 - fingerSize / 2
    : fingerPositionRef.current?.left ?? 0;
  const fingerTop = goalRect0
    ? goalRect0.top + goalRect0.height / 2 - fingerSize / 2 - offsetUp
    : fingerPositionRef.current?.top ?? 0;
  if (goalRect0 && isActive && !isFadingOut) {
    fingerPositionRef.current = { left: fingerLeft, top: fingerTop };
  }
  const useFrozenPosition = isFadingOut && fingerPositionRef.current != null;
  const displayLeft = useFrozenPosition ? fingerPositionRef.current!.left : fingerLeft;
  const displayTop = useFrozenPosition ? fingerPositionRef.current!.top : fingerTop;

  // Only compute layout when both rects are measured (avoids null .top access on first render)
  const rect0Right = goalRect0 ? goalRect0.left + goalRect0.width : 0;
  const rect0Bottom = goalRect0 ? goalRect0.top + goalRect0.height : 0;
  const rect1Right = goalRect1 ? goalRect1.left + goalRect1.width : 0;
  const rect1Bottom = goalRect1 ? goalRect1.top + goalRect1.height : 0;
  const minTop = hasBothRects ? Math.min(goalRect0!.top, goalRect1!.top) : 0;
  const maxBottom = hasBothRects ? Math.max(rect0Bottom, rect1Bottom) : 0;
  const minLeft = hasBothRects ? Math.min(goalRect0!.left, goalRect1!.left) : 0;
  const maxRight = hasBothRects ? Math.max(rect0Right, rect1Right) : 0;
  const holeTop = minTop + Math.min(HOLE_PAD_TOP_PX, Math.max(0, (maxBottom - minTop) - 8));
  const holeBottom = maxBottom - Math.min(HOLE_PAD_BOTTOM_PX, Math.max(0, (maxBottom - minTop) - 8));
  const blockHeight = Math.max(8, holeBottom - holeTop);

  return (
    <div
      className="absolute inset-0 pointer-events-none"
      style={{ zIndex: 99, transition: `opacity ${isFadingOut ? FADE_OUT_MS : FADE_IN_MS}ms ease-out`, opacity: opacityValue }}
    >
      {/* Blocking overlay: only goal slot 0 and slot 1 are tappable (two holes) */}
      {hasBothRects && isActive && !isFadingOut && (
        <div className="absolute inset-0 pointer-events-none" style={{ backgroundColor: 'transparent' }}>
          <div className="absolute pointer-events-auto" style={{ left: 0, top: 0, right: 0, height: holeTop, backgroundColor: FTUE_BLOCKER_TINT }} />
          <div className="absolute pointer-events-auto" style={{ left: 0, top: holeBottom, right: 0, bottom: 0, backgroundColor: FTUE_BLOCKER_TINT }} />
          <div className="absolute pointer-events-auto" style={{ left: 0, top: holeTop, width: minLeft, height: blockHeight, backgroundColor: FTUE_BLOCKER_TINT }} />
          <div className="absolute pointer-events-auto" style={{ left: maxRight, top: holeTop, right: 0, height: blockHeight, backgroundColor: FTUE_BLOCKER_TINT }} />
          {rect0Right <= goalRect1!.left && (
            <div className="absolute pointer-events-auto" style={{ left: rect0Right, top: holeTop, width: goalRect1!.left - rect0Right, height: blockHeight, backgroundColor: FTUE_BLOCKER_TINT }} />
          )}
        </div>
      )}

      {/* Finger: same as FTUE 6 – point at first goal (slot 1 / goal-slot-0); frozen position when fading out */}
      {(goalRect0 || (isFadingOut && fingerPositionRef.current)) && showContent && (
        <div
          className="absolute pointer-events-none"
          style={{
            left: displayLeft,
            top: displayTop,
            width: fingerSize,
            height: fingerSize,
            transformOrigin: 'center center',
            animation: 'ftue2FingerPoint 1.2s ease-in-out infinite',
          }}
        >
          <style>{`
            @keyframes ftue2FingerPoint {
              0%, 100% { transform: translate(0, 0) rotate(-30deg); }
              50% { transform: translate(${tapRight}px, ${tapDown}px) rotate(-30deg); }
            }
          `}</style>
          <img
            src={assetPath('/assets/icons/icon_finger.png')}
            alt=""
            className="w-full h-full object-contain"
            style={{ filter: 'drop-shadow(0 2px 6px rgba(0,0,0,0.3))' }}
          />
        </div>
      )}
    </div>
  );
};
