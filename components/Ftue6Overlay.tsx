/**
 * FTUE 6: When goal slot 0 is in coin state – textbox (same position as FTUE 4), finger on goal like FTUE 2.
 * Only the goal slot 0 is tappable. Tap goal to collect coins and end FTUE 6.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { assetPath } from '../utils/assetPath';
import { FTUE_BLOCKER_TINT, FTUE_TEXTBOX, FTUE_TEXTBOX_DIVIDER_MARGIN_BOTTOM, FTUE_TEXTBOX_TEXT, FTUE_VISUAL_SCALE } from '../ftue/ftueTextboxStyles';

const FADE_IN_MS = 400;
const GOAL_SLOT_0_ID = 'goal-slot-0';
const FINGER_SIZE = 270 * FTUE_VISUAL_SCALE;
const FINGER_TAP_RIGHT = 21 * FTUE_VISUAL_SCALE;
const FINGER_TAP_DOWN = 42 * FTUE_VISUAL_SCALE;
/** Offset finger up from center of goal (smaller top = higher) */
const FINGER_OFFSET_UP_PX = 70 * FTUE_VISUAL_SCALE;
/** Textbox vertical offset from goal center (scaled). Increase to move textbox down. */
const TEXTBOX_OFFSET_UP_PX = 110 * FTUE_VISUAL_SCALE;
/** Blocker hole tuning (scaled): shrink tappable hole vs goal rect */
const HOLE_PAD_X_PX = 10 * FTUE_VISUAL_SCALE; // move left/right blockers inward
const HOLE_PAD_TOP_PX = 14 * FTUE_VISUAL_SCALE; // move top blocker down (hole starts lower)
const HOLE_PAD_BOTTOM_PX = 60 * FTUE_VISUAL_SCALE; // raise bottom blocker (much smaller hole height)

export interface Ftue6OverlayProps {
  isActive: boolean;
  /** Current app scale (used to convert DOM rects to game-container coordinates) */
  appScale: number;
}

export const Ftue6Overlay: React.FC<Ftue6OverlayProps> = ({ isActive, appScale }) => {
  const [opacity, setOpacity] = useState(0);
  const [goalRect, setGoalRect] = useState<{ left: number; top: number; width: number; height: number } | null>(null);
  const [textboxStyle, setTextboxStyle] = useState<React.CSSProperties>({ opacity: 0 });
  const fingerSize = FINGER_SIZE;
  const tapRight = FINGER_TAP_RIGHT;
  const tapDown = FINGER_TAP_DOWN;
  const offsetUp = FINGER_OFFSET_UP_PX;

  const measure = useCallback(() => {
    const container = document.getElementById('game-container');
    if (!container) return;
    const cr = container.getBoundingClientRect();
    const el = document.getElementById(GOAL_SLOT_0_ID);
    if (!el) return;
    const r = el.getBoundingClientRect();
    const gr = { left: (r.left - cr.left) / appScale, top: (r.top - cr.top) / appScale, width: r.width / appScale, height: r.height / appScale };
    setGoalRect(gr);
    setTextboxStyle({
      position: 'absolute',
      left: gr.left + gr.width + 34,
      top: gr.top + gr.height / 2 - TEXTBOX_OFFSET_UP_PX,
      opacity: 1,
      zIndex: 100,
    });
  }, [appScale]);

  useEffect(() => {
    if (!isActive) {
      setOpacity(0);
      setGoalRect(null);
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
  }, [isActive, measure]);

  if (!isActive) return null;

  const showContent = isActive && goalRect && opacity > 0;

  return (
    <div
      className="absolute inset-0 pointer-events-none"
      style={{ zIndex: 99, transition: `opacity ${FADE_IN_MS}ms ease-out`, opacity }}
    >
      {/* Blocking overlay: only goal slot 0 is tappable */}
      {goalRect && (
        <div className="absolute inset-0 pointer-events-none" style={{ backgroundColor: 'transparent' }}>
          {(() => {
            const padX = Math.min(HOLE_PAD_X_PX, Math.max(0, goalRect.width / 2 - 4));
            const padTop = Math.min(HOLE_PAD_TOP_PX, Math.max(0, goalRect.height - 8));
            const padBottom = Math.min(HOLE_PAD_BOTTOM_PX, Math.max(0, goalRect.height - 8));
            const holeLeft = goalRect.left + padX;
            const holeTop = goalRect.top + padTop;
            const holeWidth = Math.max(8, goalRect.width - padX * 2);
            const holeHeight = Math.max(8, goalRect.height - padTop - padBottom);
            const holeRight = holeLeft + holeWidth;
            const holeBottom = holeTop + holeHeight;

            return (
              <>
                <div className="absolute left-0 top-0 right-0 pointer-events-auto" style={{ height: holeTop, backgroundColor: FTUE_BLOCKER_TINT }} />
                <div className="absolute left-0 pointer-events-auto" style={{ top: holeTop, width: holeLeft, height: holeHeight, backgroundColor: FTUE_BLOCKER_TINT }} />
                <div className="absolute top-0 bottom-0 pointer-events-auto" style={{ left: holeRight, right: 0, backgroundColor: FTUE_BLOCKER_TINT }} />
                <div className="absolute left-0 right-0 bottom-0 pointer-events-auto" style={{ top: holeBottom, backgroundColor: FTUE_BLOCKER_TINT }} />
              </>
            );
          })()}
        </div>
      )}

      {/* Finger: same orientation & animation as FTUE 2, centered on goal slot 0 */}
      {goalRect && showContent && (
        <div
          className="absolute pointer-events-none"
          style={{
            left: goalRect.left + goalRect.width / 2 - fingerSize / 2,
            top: goalRect.top + goalRect.height / 2 - fingerSize / 2 - offsetUp,
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

      {/* Textbox: same position as FTUE 4, no green button */}
      {showContent && (
        <div
          className="pointer-events-none"
          style={{
            ...FTUE_TEXTBOX,
            ...textboxStyle,
            width: `${380 * FTUE_VISUAL_SCALE}px`,
          }}
        >
          <div className="w-full flex items-center justify-center" style={{ marginBottom: FTUE_TEXTBOX_DIVIDER_MARGIN_BOTTOM }}>
            <img
              src={assetPath('/assets/popups/popup_divider.png')}
              alt=""
              className="h-auto object-contain"
              style={{ width: '100%' }}
            />
          </div>
          <p className="text-center m-0 font-medium italic leading-snug" style={FTUE_TEXTBOX_TEXT}>
            Great job! Collect your coins
          </p>
        </div>
      )}
    </div>
  );
};
