/**
 * FTUE 3: Finger slides from cell 4 to cell 13 (merge hint). Textbox: "Merge these two plants together."
 * Loop: fade in at 4 → slide to 13 → fade out → repeat. Fade out finger + textbox on successful merge.
 */
import React, { useEffect, useState, useCallback } from 'react';
import { assetPath } from '../utils/assetPath';
import { FTUE_BLOCKER_TINT, FTUE_TEXTBOX, FTUE_TEXTBOX_DIVIDER_MARGIN_BOTTOM, FTUE_TEXTBOX_TEXT, FTUE_VISUAL_SCALE } from '../ftue/ftueTextboxStyles';

const FADE_IN_MS = 250;
const FADE_OUT_MS = 250;
const HOLD_AT_4_MS = 180;
const SLIDE_MS = 750;
const FINGER_SIZE = 270 * FTUE_VISUAL_SCALE;
const FINGER_ANGLE_DEG = -30;
const TEXTBOX_OFFSET_UP_PX = 280; // base (pre-scale) px; multiplied by FTUE_VISUAL_SCALE

const CELL_4_ID = 'hex-4';
const CELL_13_ID = 'hex-13';

function getCellCenterInContainer(id: string, appScale: number): { x: number; y: number } | null {
  const container = document.getElementById('game-container');
  if (!container) return null;
  const cr = container.getBoundingClientRect();
  const el = document.getElementById(id);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return {
    x: (r.left + r.width / 2 - cr.left) / appScale,
    y: (r.top + r.height / 2 - cr.top) / appScale,
  };
}

function getFingerStyle(center: { x: number; y: number }, fingerSize: number): React.CSSProperties {
  return {
    left: center.x - fingerSize / 2,
    top: center.y - fingerSize / 2,
    width: fingerSize,
    height: fingerSize,
    transform: `rotate(${FINGER_ANGLE_DEG}deg)`,
    transformOrigin: 'center center',
  };
}

export interface Ftue3OverlayProps {
  isActive: boolean;
  isFadingOut: boolean;
  /** Current app scale (used to convert DOM rects to game-container coordinates) */
  appScale: number;
  onFadeOutComplete: () => void;
}

type Phase = 'fadeIn' | 'holdAt4' | 'slide' | 'fadeOut';

export const Ftue3Overlay: React.FC<Ftue3OverlayProps> = ({
  isActive,
  isFadingOut,
  appScale,
  onFadeOutComplete,
}) => {
  const [pos4, setPos4] = useState<{ x: number; y: number } | null>(null);
  const [pos13, setPos13] = useState<{ x: number; y: number } | null>(null);
  const [textboxTop, setTextboxTop] = useState<number>(0);
  const [phase, setPhase] = useState<Phase>('fadeIn');
  const [fingerOpacity, setFingerOpacity] = useState(0);
  const [fingerPos, setFingerPos] = useState<{ x: number; y: number } | null>(null);

  const measure = useCallback(() => {
    const p4 = getCellCenterInContainer(CELL_4_ID, appScale);
    const p13 = getCellCenterInContainer(CELL_13_ID, appScale);
    setPos4(p4);
    setPos13(p13);
    if (p4 && p13) {
      const midY = (p4.y + p13.y) / 2;
      // Keep the same visual spacing now that the textbox is scaled down.
      setTextboxTop(midY - TEXTBOX_OFFSET_UP_PX * FTUE_VISUAL_SCALE);
    }
  }, [appScale]);

  useEffect(() => {
    if (!isActive && !isFadingOut) return;
    measure();
    const id = requestAnimationFrame(() => measure());
    const t = setTimeout(measure, 100);
    const resize = () => measure();
    window.addEventListener('resize', resize);
    return () => {
      cancelAnimationFrame(id);
      clearTimeout(t);
      window.removeEventListener('resize', resize);
    };
  }, [isActive, isFadingOut, measure]);

  // Phase timeline: fadeIn -> holdAt4 -> slide -> fadeOut -> (loop)
  useEffect(() => {
    if (!isActive || isFadingOut || !pos4 || !pos13) return;
    if (phase === 'fadeIn') {
      setFingerPos(pos4);
      setFingerOpacity(0);
      const startFade = requestAnimationFrame(() => {
        setFingerOpacity(1);
      });
      const t = setTimeout(() => setPhase('holdAt4'), FADE_IN_MS);
      return () => {
        cancelAnimationFrame(startFade);
        clearTimeout(t);
      };
    }
    if (phase === 'holdAt4') {
      const t = setTimeout(() => setPhase('slide'), HOLD_AT_4_MS);
      return () => clearTimeout(t);
    }
    if (phase === 'slide') {
      setFingerPos(pos13);
      const t = setTimeout(() => setPhase('fadeOut'), SLIDE_MS);
      return () => clearTimeout(t);
    }
    if (phase === 'fadeOut') {
      setFingerOpacity(0);
      const t = setTimeout(() => {
        setPhase('fadeIn');
      }, FADE_OUT_MS);
      return () => clearTimeout(t);
    }
  }, [isActive, isFadingOut, phase, pos4, pos13]);

  // Fade out overlay when isFadingOut
  useEffect(() => {
    if (!isFadingOut) return;
    const t = setTimeout(onFadeOutComplete, FADE_OUT_MS);
    return () => clearTimeout(t);
  }, [isFadingOut, onFadeOutComplete]);

  if (!isActive && !isFadingOut) return null;

  const fingerSize = FINGER_SIZE;

  const showContent = isActive && pos4 && pos13;
  const overlayOpacity = isFadingOut ? 0 : 1;

  return (
    <div
      className="absolute inset-0 pointer-events-none"
      style={{
        zIndex: 99,
        transition: `opacity ${FADE_OUT_MS}ms ease-out`,
        opacity: overlayOpacity,
      }}
    >
      {/* Debug blocker tint (FTUE 3 doesn't use a hole blocker) */}
      {showContent && (
        <div className="absolute inset-0" style={{ backgroundColor: FTUE_BLOCKER_TINT, opacity: 1 }} aria-hidden />
      )}
      {/* Finger: fades in at cell 4, slides to cell 13, fades out; loops */}
      {showContent && fingerPos && (
        <div
          className="absolute pointer-events-none"
          style={{
            ...getFingerStyle(fingerPos, fingerSize),
            opacity: fingerOpacity,
            transition:
              phase === 'fadeIn'
                ? `opacity ${FADE_IN_MS}ms ease-out`
                : phase === 'slide'
                  ? `left ${SLIDE_MS}ms ease-in-out, top ${SLIDE_MS}ms ease-in-out`
                  : phase === 'fadeOut'
                    ? `opacity ${FADE_OUT_MS}ms ease-out`
                    : 'none',
          }}
        >
          <img
            src={assetPath('/assets/icons/icon_finger.png')}
            alt=""
            className="w-full h-full object-contain"
            style={{ filter: 'drop-shadow(0 2px 6px rgba(0,0,0,0.3))' }}
          />
        </div>
      )}

      {/* Textbox: above the two plants; same style as FTUE_2; fades out with overlay */}
      {showContent && (
        <div
          className="absolute left-1/2 pointer-events-none"
          style={{
            top: textboxTop,
            ...FTUE_TEXTBOX,
            transform: 'translateX(-50%)',
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
            Merge these two plants together
          </p>
        </div>
      )}
    </div>
  );
};
