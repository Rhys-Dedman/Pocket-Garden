/**
 * FTUE 8: Harvest multiple – same as FTUE 5 (textbox + finger at harvest button).
 * Text: "You can harvest multiple plants at the same time".
 * Fade out when both goals are completed (handled in App).
 */
import React, { useEffect, useState } from 'react';
import { assetPath } from '../utils/assetPath';
import { FTUE_BLOCKER_TINT, FTUE_TEXTBOX, FTUE_TEXTBOX_DIVIDER_MARGIN_BOTTOM, FTUE_TEXTBOX_TEXT, FTUE_VISUAL_SCALE } from '../ftue/ftueTextboxStyles';

const FADE_IN_MS = 400;
const FADE_OUT_MS = 400;
const FINGER_SIZE = 270 * FTUE_VISUAL_SCALE;
const FINGER_TAP_OFFSET_X = -14.14 * FTUE_VISUAL_SCALE;
const FINGER_TAP_OFFSET_Y = 14.14 * FTUE_VISUAL_SCALE;

export interface Ftue8OverlayProps {
  /** Harvest button rect in game-container coordinates (448×796 space). */
  buttonRect: { left: number; top: number; width: number; height: number } | null;
  isActive: boolean;
  isFadingOut: boolean;
  onFadeOutComplete: () => void;
}

export const Ftue8Overlay: React.FC<Ftue8OverlayProps> = ({
  buttonRect,
  isActive,
  isFadingOut,
  onFadeOutComplete,
}) => {
  const [opacity, setOpacity] = useState(0);
  const [fadeInDone, setFadeInDone] = useState(false);

  useEffect(() => {
    if (!isActive || !buttonRect) {
      setOpacity(0);
      setFadeInDone(false);
      return;
    }
    setOpacity(0);
    const t = setTimeout(() => {
      setOpacity(1);
      setFadeInDone(true);
    }, 0); // no delay: FTUE 8 appears immediately after FTUE 7 ends
    return () => clearTimeout(t);
  }, [isActive, buttonRect]);

  useEffect(() => {
    if (!isFadingOut) return;
    setOpacity(0);
    const t = setTimeout(onFadeOutComplete, FADE_OUT_MS);
    return () => clearTimeout(t);
  }, [isFadingOut, onFadeOutComplete]);

  if (!isActive && !isFadingOut) return null;

  const showContent = (isActive && fadeInDone) || isFadingOut;
  const opacityValue = isFadingOut ? 0 : opacity;
  const buttonRight = buttonRect ? buttonRect.left + buttonRect.width : 0;
  const buttonBottom = buttonRect ? buttonRect.top + buttonRect.height : 0;
  const fingerSize = FINGER_SIZE;
  const tapX = FINGER_TAP_OFFSET_X;
  const tapY = FINGER_TAP_OFFSET_Y;

  return (
    <div
      className="absolute inset-0 pointer-events-none"
      style={{ zIndex: 99, transition: `opacity ${isFadingOut ? FADE_OUT_MS : FADE_IN_MS}ms ease-out`, opacity: opacityValue }}
    >
      {buttonRect && isActive && !isFadingOut && (
        <div className="absolute inset-0 pointer-events-none" style={{ backgroundColor: 'transparent' }}>
          <div className="absolute left-0 top-0 right-0 pointer-events-auto" style={{ height: buttonRect.top, backgroundColor: FTUE_BLOCKER_TINT }} />
          <div className="absolute left-0 pointer-events-auto" style={{ top: buttonRect.top, width: buttonRect.left, height: buttonRect.height, backgroundColor: FTUE_BLOCKER_TINT }} />
          <div className="absolute top-0 bottom-0 pointer-events-auto" style={{ left: buttonRight, right: 0, backgroundColor: FTUE_BLOCKER_TINT }} />
          <div className="absolute left-0 right-0 bottom-0 pointer-events-auto" style={{ top: buttonBottom, backgroundColor: FTUE_BLOCKER_TINT }} />
        </div>
      )}

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
            You can harvest multiple plants at the same time
          </p>
        </div>
      )}
    </div>
  );
};
