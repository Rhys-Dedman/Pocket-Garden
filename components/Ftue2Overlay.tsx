/**
 * FTUE 2: Overlay with hole over Seeds button, finger pointing at it, and small text above.
 * Fade in 1s after FTUE_1 closes; fade out when 2 seeds generated.
 * Uses shared FTUE textbox styles (ftueTextboxStyles) – default look for all FTUE textboxes.
 */
import React, { useEffect, useState } from 'react';
import { assetPath } from '../utils/assetPath';
import { FTUE_BLOCKER_TINT, FTUE_TEXTBOX, FTUE_TEXTBOX_DIVIDER_MARGIN_BOTTOM, FTUE_TEXTBOX_TEXT, FTUE_VISUAL_SCALE } from '../ftue/ftueTextboxStyles';

const FADE_IN_MS = 400;
const FADE_OUT_MS = 400;
const FINGER_SIZE = 270 * FTUE_VISUAL_SCALE; // visually smaller, but still scales 1:1 with appScale

/** Tap animation: finger moves down/right (then back) – ~30% less distance than before */
const FINGER_TAP_RIGHT = 21 * FTUE_VISUAL_SCALE;
const FINGER_TAP_DOWN = 42 * FTUE_VISUAL_SCALE;

const TEXT_FADE_MS = 200;

export interface Ftue2OverlayProps {
  /** Seeds button rect in game-container coordinates (448×796 space). */
  buttonRect: { left: number; top: number; width: number; height: number } | null;
  /** true when FTUE_2 is active (overlay + finger + text visible after fade-in) */
  isActive: boolean;
  /** true when we're fading out (e.g. after 2 seeds); then call onFadeOutComplete */
  isFadingOut: boolean;
  /** After 1st seed, text quickly fades to "Let's plant another one!" */
  seedFireCount: number;
  onFadeOutComplete: () => void;
}

export const Ftue2Overlay: React.FC<Ftue2OverlayProps> = ({
  buttonRect,
  isActive,
  isFadingOut,
  seedFireCount,
  onFadeOutComplete,
}) => {
  const [fadeInDone, setFadeInDone] = useState(false);
  const [opacity, setOpacity] = useState(0);

  // Fade in when overlay mounts (App already delayed 1s after FTUE_1 close before showing this)
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

  // Fade out when isFadingOut
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
  const tapRight = FINGER_TAP_RIGHT;
  const tapDown = FINGER_TAP_DOWN;

  return (
    <div
      className="absolute inset-0 pointer-events-none"
      style={{ zIndex: 99, transition: `opacity ${isFadingOut ? FADE_OUT_MS : FADE_IN_MS}ms ease-out`, opacity: opacityValue }}
    >
      {/* Blocking overlay: four panels leave a hole over the seeds button. When seedFireCount >= 2, also cover the button so no more taps. When fading out, stop blocking so FTUE 3 drag is not delayed. */}
      {buttonRect && isActive && !isFadingOut && (
        <div className="absolute inset-0 pointer-events-none" style={{ backgroundColor: 'transparent' }}>
          <div className="absolute left-0 top-0 right-0 pointer-events-auto" style={{ height: buttonRect.top, backgroundColor: FTUE_BLOCKER_TINT }} />
          <div className="absolute left-0 pointer-events-auto" style={{ top: buttonRect.top, width: buttonRect.left, height: buttonRect.height, backgroundColor: FTUE_BLOCKER_TINT }} />
          <div className="absolute top-0 bottom-0 pointer-events-auto" style={{ left: buttonRight, right: 0, backgroundColor: FTUE_BLOCKER_TINT }} />
          <div className="absolute left-0 right-0 bottom-0 pointer-events-auto" style={{ top: buttonBottom, backgroundColor: FTUE_BLOCKER_TINT }} />
          {seedFireCount >= 2 && (
            <div className="absolute pointer-events-auto" style={{ left: buttonRect.left, top: buttonRect.top, width: buttonRect.width, height: buttonRect.height, backgroundColor: FTUE_BLOCKER_TINT }} />
          )}
        </div>
      )}

      {/* Finger: sprite tip is at center – position so tip is on button center; animate down 60% / right 30% for tap */}
      {buttonRect && showContent && (
        <div
          className="absolute pointer-events-none"
          style={{
            left: buttonRect.left + buttonRect.width / 2 - fingerSize / 2,
            top: buttonRect.top + buttonRect.height / 2 - fingerSize / 2,
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

      {/* Text box: shared FTUE textbox styles (see ftueTextboxStyles.ts); after 1st seed, text quickly fades to second message */}
      {buttonRect && showContent && (
        <div
          className="absolute left-1/2 pointer-events-none"
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
          <div className="relative">
            <p
              className="text-center m-0 font-medium italic leading-snug absolute inset-0"
              style={{
                ...FTUE_TEXTBOX_TEXT,
                opacity: seedFireCount >= 1 ? 0 : 1,
                transition: `opacity ${TEXT_FADE_MS}ms ease-out`,
              }}
            >
              Tap the Seeds button to plant seeds
            </p>
            <p
              className="text-center m-0 font-medium italic leading-snug"
              style={{
                ...FTUE_TEXTBOX_TEXT,
                opacity: seedFireCount >= 1 ? 1 : 0,
                transition: `opacity ${TEXT_FADE_MS}ms ease-out`,
              }}
            >
              Let's plant another one!
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
