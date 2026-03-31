/**
 * Non-blocking finger on Garden tab; lives inside Navbar so it tracks the bar when switching screens.
 * Same animation/orientation as FTUE 10 "Garden tab" finger (point down).
 */
import React, { useEffect, useState } from 'react';
import { assetPath } from '../utils/assetPath';
import { FTUE_VISUAL_SCALE } from '../ftue/ftueTextboxStyles';

const FINGER_SIZE = 270 * FTUE_VISUAL_SCALE;
const TAP_DOWN_PX = 18 * FTUE_VISUAL_SCALE;
const FADE_MS = 400;

export interface CollectionGardenNavFingerProps {
  active: boolean;
}

export const CollectionGardenNavFinger: React.FC<CollectionGardenNavFingerProps> = ({ active }) => {
  const [opacity, setOpacity] = useState(0);

  useEffect(() => {
    if (!active) {
      setOpacity(0);
      return;
    }
    setOpacity(0);
    const t = window.setTimeout(() => setOpacity(1), 50);
    return () => clearTimeout(t);
  }, [active]);

  if (!active) return null;

  return (
    <div
      className="absolute pointer-events-none overflow-visible"
      style={{
        left: '50%',
        top: -FINGER_SIZE - 135 * FTUE_VISUAL_SCALE,
        transform: 'translateX(-50%)',
        width: FINGER_SIZE,
        height: FINGER_SIZE,
        zIndex: 120,
        opacity,
        transition: `opacity ${FADE_MS}ms ease-out`,
      }}
    >
      <div
        style={{
          width: '100%',
          height: '100%',
          transformOrigin: 'center bottom',
          animation: 'collectionNavFingerDown 1.2s ease-in-out infinite',
          willChange: 'transform',
          backfaceVisibility: 'hidden',
          WebkitBackfaceVisibility: 'hidden',
        }}
      >
      <style>{`
        @keyframes collectionNavFingerDown {
          0%, 100% { transform: translate3d(0, 0, 0) rotate(180deg); }
          50% { transform: translate3d(0, ${TAP_DOWN_PX}px, 0) rotate(180deg); }
        }
      `}</style>
      <img
        src={assetPath('/assets/icons/icon_finger.png')}
        alt=""
        className="w-full h-full object-contain"
        draggable={false}
        style={{ filter: 'drop-shadow(0 2px 6px rgba(0,0,0,0.3))' }}
      />
      </div>
    </div>
  );
};
