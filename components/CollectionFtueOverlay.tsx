/**
 * Collection screen FTUE: dim + hole (optional) + finger, in #game-container coordinates
 * (render inside coin panel portal like other FTUE overlays).
 */
import React, { useEffect, useState } from 'react';
import { assetPath } from '../utils/assetPath';
import { COLLECTION_FTUE_BLOCKER_TINT } from '../constants/collectionFtue';
import { FTUE_VISUAL_SCALE } from '../ftue/ftueTextboxStyles';

export type CollectionFtueFingerStyle = 'seed' | 'point_down' | 'point_right';

const FADE_IN_MS = 400;
const FINGER_SIZE = 270 * FTUE_VISUAL_SCALE;
/** FTUE 7 seed-style */
const FINGER_TAP_RIGHT = 21 * FTUE_VISUAL_SCALE;
const FINGER_TAP_DOWN = 42 * FTUE_VISUAL_SCALE;
/** FTUE 10 garden-tab style */
const POINT_DOWN_TAP_PX = 18 * FTUE_VISUAL_SCALE;
/** Point-right tap (bonus button) */
const POINT_RIGHT_TAP_PX = 18 * FTUE_VISUAL_SCALE;

export type GameRect = { left: number; top: number; width: number; height: number };

const rectRight = (r: GameRect) => r.left + r.width;
const rectBottom = (r: GameRect) => r.top + r.height;

function expandRect(r: GameRect, padding: number): GameRect {
  return {
    left: r.left - padding,
    top: r.top - padding,
    width: r.width + padding * 2,
    height: r.height + padding * 2,
  };
}

export interface CollectionFtueOverlayProps {
  /** Clear hole for the only tappable control; ignored when fullBlock */
  holeRect: GameRect | null;
  fingerStyle: CollectionFtueFingerStyle;
  /** Block entire area (e.g. post-purchase reveal) */
  fullBlock?: boolean;
  active: boolean;
  /** Dim around hole / full block */
  blockerTint?: string;
  /** Extra padding around the hole (smaller = tighter blocker). */
  holePaddingPx?: number;
}

export const CollectionFtueOverlay: React.FC<CollectionFtueOverlayProps> = ({
  holeRect,
  fingerStyle,
  fullBlock = false,
  active,
  blockerTint = COLLECTION_FTUE_BLOCKER_TINT,
  holePaddingPx = 8,
}) => {
  const [opacity, setOpacity] = useState(0);

  useEffect(() => {
    if (!active) {
      setOpacity(0);
      return;
    }
    setOpacity(0);
    const t = setTimeout(() => setOpacity(1), 50);
    return () => clearTimeout(t);
  }, [active, holeRect, fullBlock, blockerTint, holePaddingPx]);

  if (!active) return null;

  const h = holeRect ? expandRect(holeRect, Math.max(0, holePaddingPx)) : null;
  const fingerSize = FINGER_SIZE;

  return (
    <div
      className="absolute inset-0 pointer-events-none"
      style={{
        zIndex: 99,
        transition: `opacity ${FADE_IN_MS}ms ease-out`,
        opacity,
      }}
    >
      {fullBlock ? (
        <div className="absolute inset-0 pointer-events-auto" style={{ backgroundColor: blockerTint }} aria-hidden />
      ) : h ? (
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute left-0 top-0 right-0 pointer-events-auto" style={{ height: h.top, backgroundColor: blockerTint }} />
          <div className="absolute left-0 pointer-events-auto" style={{ top: h.top, width: h.left, height: h.height, backgroundColor: blockerTint }} />
          <div className="absolute top-0 bottom-0 pointer-events-auto" style={{ left: rectRight(h), right: 0, backgroundColor: blockerTint }} />
          <div className="absolute left-0 right-0 bottom-0 pointer-events-auto" style={{ top: rectBottom(h), backgroundColor: blockerTint }} />
        </div>
      ) : (
        <div className="absolute inset-0 pointer-events-auto" style={{ backgroundColor: blockerTint }} aria-hidden />
      )}

      {!fullBlock && h && fingerStyle === 'seed' && (
        <div
          className="absolute pointer-events-none"
          style={{
            left: h.left + h.width / 2 - fingerSize / 2,
            top: h.top + h.height / 2 - fingerSize / 2,
            width: fingerSize,
            height: fingerSize,
            transformOrigin: 'center center',
            animation: 'collectionFtueFingerSeed 1.2s ease-in-out infinite',
          }}
        >
          <style>{`
            @keyframes collectionFtueFingerSeed {
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

      {!fullBlock && h && fingerStyle === 'point_down' && (
        <div
          className="absolute pointer-events-none"
          style={{
            left: h.left + h.width / 2 - fingerSize / 2 - 40 * FTUE_VISUAL_SCALE,
            top: h.top - fingerSize - 135 * FTUE_VISUAL_SCALE,
            width: fingerSize,
            height: fingerSize,
            transformOrigin: 'center bottom',
            animation: 'collectionFtueFingerDown 1.2s ease-in-out infinite',
          }}
        >
          <style>{`
            @keyframes collectionFtueFingerDown {
              0%, 100% { transform: translateY(0) rotate(180deg); }
              50% { transform: translateY(${POINT_DOWN_TAP_PX}px) rotate(180deg); }
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

      {!fullBlock && h && fingerStyle === 'point_right' && (
        <div
          className="absolute pointer-events-none"
          style={{
            // Center of finger sprite sits on the button's left edge.
            left: h.left - fingerSize / 2,
            top: h.top + h.height / 2 - fingerSize / 2,
            width: fingerSize,
            height: fingerSize,
            transformOrigin: 'center center',
            animation: 'collectionFtueFingerRight 1.2s ease-in-out infinite',
          }}
        >
          <style>{`
            @keyframes collectionFtueFingerRight {
              0%, 100% { transform: translateX(0) rotate(90deg); }
              50% { transform: translateX(${POINT_RIGHT_TAP_PX}px) rotate(90deg); }
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
