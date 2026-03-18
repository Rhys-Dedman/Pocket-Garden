/**
 * FTUE 5: First harvest – textbox above harvest button (same position as FTUE 2), finger from the other side.
 * Only the harvest button is tappable. No green button. Ends when goal slot 0 is completed (handled in App).
 */
import React, { useEffect, useState } from 'react';
import { assetPath } from '../utils/assetPath';
import { FTUE_BLOCKER_TINT, FTUE_TEXTBOX, FTUE_TEXTBOX_DIVIDER_MARGIN_BOTTOM, FTUE_TEXTBOX_TEXT, FTUE_VISUAL_SCALE } from '../ftue/ftueTextboxStyles';

const FINGER_SIZE = 270 * FTUE_VISUAL_SCALE;
/** Animation: left 30%, down 60% (of FTUE 2’s 21px / 42px) */
/** 45° down-left, 20px total: left = -14.14, down = 14.14 (20/sqrt(2)) */
const FINGER_TAP_OFFSET_X = -14.14 * FTUE_VISUAL_SCALE;  // left
const FINGER_TAP_OFFSET_Y = 14.14 * FTUE_VISUAL_SCALE;   // down

export interface Ftue5OverlayProps {
  /** Harvest button rect in game-container coordinates (448×796 space). */
  buttonRect: { left: number; top: number; width: number; height: number } | null;
  isActive: boolean;
}

export const Ftue5Overlay: React.FC<Ftue5OverlayProps> = ({ buttonRect, isActive }) => {
  const [opacity, setOpacity] = useState(0);

  useEffect(() => {
    if (!isActive || !buttonRect) {
      setOpacity(0);
      return;
    }
    setOpacity(0);
    const t = setTimeout(() => setOpacity(1), 50);
    return () => clearTimeout(t);
  }, [isActive, buttonRect]);

  if (!isActive) return null;

  const showContent = isActive && opacity > 0;
  const buttonRight = buttonRect ? buttonRect.left + buttonRect.width : 0;
  const buttonBottom = buttonRect ? buttonRect.top + buttonRect.height : 0;
  const fingerSize = FINGER_SIZE;
  const tapX = FINGER_TAP_OFFSET_X;
  const tapY = FINGER_TAP_OFFSET_Y;

  return (
    <div
      className="absolute inset-0 pointer-events-none"
      style={{ zIndex: 99, transition: 'opacity 400ms ease-out', opacity }}
    >
      {/* Blocking overlay: only the harvest button is tappable (hole over button) */}
      {buttonRect && (
        <div className="absolute inset-0 pointer-events-none" style={{ backgroundColor: 'transparent' }}>
          <div className="absolute left-0 top-0 right-0 pointer-events-auto" style={{ height: buttonRect.top, backgroundColor: FTUE_BLOCKER_TINT }} />
          <div className="absolute left-0 pointer-events-auto" style={{ top: buttonRect.top, width: buttonRect.left, height: buttonRect.height, backgroundColor: FTUE_BLOCKER_TINT }} />
          <div className="absolute top-0 bottom-0 pointer-events-auto" style={{ left: buttonRight, right: 0, backgroundColor: FTUE_BLOCKER_TINT }} />
          <div className="absolute left-0 right-0 bottom-0 pointer-events-auto" style={{ top: buttonBottom, backgroundColor: FTUE_BLOCKER_TINT }} />
        </div>
      )}

      {/* Finger: centered on harvest button, scaleX(-1) so points from other side; animate left + down; -30° rotation */}
      {buttonRect && showContent && (
        <div
          className="absolute pointer-events-none"
          style={{
            left: buttonRect.left + buttonRect.width / 2 - fingerSize / 2,
            top: buttonRect.top + buttonRect.height / 2 - fingerSize / 2,
            width: fingerSize,
            height: fingerSize,
            transformOrigin: 'center center',
            animation: 'ftue5FingerPoint 1.2s ease-in-out infinite',
          }}
        >
          <style>{`
            @keyframes ftue5FingerPoint {
              /* translate first in list = applied last = movement in screen space (down-left) */
              0%, 100% { transform: translate(0, 0) scaleX(-1) rotate(-45deg); }
              50% { transform: translate(${tapX}px, ${tapY}px) scaleX(-1) rotate(-45deg); }
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

      {/* Textbox: same position as FTUE 2 (above button) */}
      {buttonRect && showContent && (
        <div
          className="absolute pointer-events-none"
          style={{
            left: '50%',
            top: Math.max(0, buttonRect.top - 16),
            transform: 'translate(-50%, -100%)',
            ...FTUE_TEXTBOX,
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
          <p className="text-center m-0 font-medium italic leading-snug" style={{ ...FTUE_TEXTBOX_TEXT, paddingLeft: '20px', paddingRight: '20px' }}>
            Tap the Harvest button until the order is completed
          </p>
        </div>
      )}
    </div>
  );
};
