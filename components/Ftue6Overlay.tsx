/**
 * FTUE 6: When goal slot 0 is in coin state – textbox (same position as FTUE 4), finger on goal like FTUE 2.
 * Only the goal slot 0 is tappable. Tap goal to collect coins and end FTUE 6.
 */
import React, { useEffect, useState } from 'react';
import { assetPath } from '../utils/assetPath';
import { FTUE_TEXTBOX, FTUE_TEXTBOX_DIVIDER_MARGIN_BOTTOM, FTUE_TEXTBOX_TEXT } from '../ftue/ftueTextboxStyles';

const FADE_IN_MS = 400;
const GOAL_SLOT_0_ID = 'goal-slot-0';
const FINGER_SIZE = 270;
const FINGER_TAP_RIGHT = 21;
const FINGER_TAP_DOWN = 42;
/** Offset finger up from center of goal (smaller top = higher) */
const FINGER_OFFSET_UP_PX = 70;

export interface Ftue6OverlayProps {
  isActive: boolean;
}

export const Ftue6Overlay: React.FC<Ftue6OverlayProps> = ({ isActive }) => {
  const [opacity, setOpacity] = useState(0);
  const [goalRect, setGoalRect] = useState<DOMRect | null>(null);
  const [textboxStyle, setTextboxStyle] = useState<React.CSSProperties>({ opacity: 0 });

  const measure = () => {
    const el = document.getElementById(GOAL_SLOT_0_ID);
    if (!el) return;
    const r = el.getBoundingClientRect();
    setGoalRect(r);
    setTextboxStyle({
      position: 'fixed',
      left: r.right + 34,
      top: r.top + r.height / 2 - 130,
      opacity: 1,
      zIndex: 100,
    });
  };

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
  }, [isActive]);

  if (!isActive) return null;

  const showContent = isActive && goalRect && opacity > 0;

  return (
    <div
      className="fixed inset-0 pointer-events-none"
      style={{ zIndex: 99, transition: `opacity ${FADE_IN_MS}ms ease-out`, opacity }}
    >
      {/* Blocking overlay: only goal slot 0 is tappable */}
      {goalRect && (
        <div className="fixed inset-0 pointer-events-none" style={{ backgroundColor: 'transparent' }}>
          <div className="absolute left-0 top-0 right-0 pointer-events-auto" style={{ height: goalRect.top }} />
          <div className="absolute left-0 pointer-events-auto" style={{ top: goalRect.top, width: goalRect.left, height: goalRect.height }} />
          <div className="absolute top-0 bottom-0 pointer-events-auto" style={{ left: goalRect.right, right: 0 }} />
          <div className="absolute left-0 right-0 bottom-0 pointer-events-auto" style={{ top: goalRect.bottom }} />
        </div>
      )}

      {/* Finger: same orientation & animation as FTUE 2, centered on goal slot 0 */}
      {goalRect && showContent && (
        <div
          className="absolute pointer-events-none"
          style={{
            left: goalRect.left + goalRect.width / 2 - FINGER_SIZE / 2,
            top: goalRect.top + goalRect.height / 2 - FINGER_SIZE / 2 - FINGER_OFFSET_UP_PX,
            width: FINGER_SIZE,
            height: FINGER_SIZE,
            transformOrigin: 'center center',
            animation: 'ftue2FingerPoint 1.2s ease-in-out infinite',
          }}
        >
          <style>{`
            @keyframes ftue2FingerPoint {
              0%, 100% { transform: translate(0, 0) rotate(-30deg); }
              50% { transform: translate(${FINGER_TAP_RIGHT}px, ${FINGER_TAP_DOWN}px) rotate(-30deg); }
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
            width: '380px',
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
