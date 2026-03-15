/**
 * FTUE 7: More orders – textbox above Seeds button (same position as FTUE 2), finger at seeds.
 * Only seeds button tappable; 2 taps then fade out (handled in App).
 */
import React, { useEffect, useState } from 'react';
import { assetPath } from '../utils/assetPath';
import { FTUE_TEXTBOX, FTUE_TEXTBOX_DIVIDER_MARGIN_BOTTOM, FTUE_TEXTBOX_TEXT } from '../ftue/ftueTextboxStyles';

const FADE_IN_MS = 400;
const FADE_OUT_MS = 400;
const FINGER_SIZE = 270;
const FINGER_TAP_RIGHT = 21;
const FINGER_TAP_DOWN = 42;

export interface Ftue7OverlayProps {
  buttonRect: DOMRect | null;
  isActive: boolean;
  isFadingOut: boolean;
  onFadeOutComplete: () => void;
}

export const Ftue7Overlay: React.FC<Ftue7OverlayProps> = ({
  buttonRect,
  isActive,
  isFadingOut,
  onFadeOutComplete,
}) => {
  const [fadeInDone, setFadeInDone] = useState(false);
  const [opacity, setOpacity] = useState(0);

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
    }, 50);
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

  return (
    <div
      className="fixed inset-0 pointer-events-none"
      style={{ zIndex: 99, transition: `opacity ${isFadingOut ? FADE_OUT_MS : FADE_IN_MS}ms ease-out`, opacity: opacityValue }}
    >
      {buttonRect && (
        <div className="fixed inset-0 pointer-events-none" style={{ backgroundColor: 'transparent' }}>
          <div className="absolute left-0 top-0 right-0 pointer-events-auto" style={{ height: buttonRect.top }} />
          <div className="absolute left-0 pointer-events-auto" style={{ top: buttonRect.top, width: buttonRect.left, height: buttonRect.height }} />
          <div className="absolute top-0 bottom-0 pointer-events-auto" style={{ left: buttonRect.right, right: 0 }} />
          <div className="absolute left-0 right-0 bottom-0 pointer-events-auto" style={{ top: buttonRect.bottom }} />
        </div>
      )}

      {buttonRect && showContent && (
        <div
          className="absolute pointer-events-none"
          style={{
            left: buttonRect.left + buttonRect.width / 2 - FINGER_SIZE / 2,
            top: buttonRect.top + buttonRect.height / 2 - FINGER_SIZE / 2,
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

      {buttonRect && showContent && (
        <div
          className="absolute left-1/2 -translate-x-1/2 pointer-events-none"
          style={{
            bottom: `calc(100vh - ${buttonRect.top}px + 16px)`,
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
          <p className="text-center m-0 font-medium italic leading-snug" style={FTUE_TEXTBOX_TEXT}>
            More orders have arrived. Lets plant some more seeds
          </p>
        </div>
      )}
    </div>
  );
};
