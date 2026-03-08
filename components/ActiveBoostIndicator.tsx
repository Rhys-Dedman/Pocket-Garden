/**
 * Single active reward/boost indicator: circle with icon and radial progress (time left 100% → 0%).
 * Progress updates at 60fps; on 0% calls onComplete.
 */
import React, { useEffect, useRef } from 'react';
import { assetPath } from '../utils/assetPath';

const INNER_RADIUS = 9;
const STROKE_PX = 2; // outer stroke around brown circle
const RING_RADIUS = INNER_RADIUS + STROKE_PX; // radial progress sits just outside inner circle
const RING_STROKE = 2;
const SIZE_PX = (RING_RADIUS + RING_STROKE) * 2;

/** Exported so particle target can use center of first boost (SIZE_PX/2). */
export const ACTIVE_BOOST_INDICATOR_SIZE_PX = SIZE_PX;

const BG = '#765041';
const STROKE_COLOR = '#e9dcaf';
const RING_TRACK = '#d4c8a0'; // incomplete / track area
const RING_FILL = '#775041'; // yellow radial bar (time left fill)

export interface ActiveBoostData {
  id: string;
  endTime: number;
  durationMs: number;
  icon: string;
  /** Links to the limited offer (e.g. 'super_seed_offer'); used when tapping boost to open the right popup */
  offerId?: string;
}

interface ActiveBoostIndicatorProps {
  data: ActiveBoostData;
  onComplete: (id: string) => void;
}

export const ActiveBoostIndicator: React.FC<ActiveBoostIndicatorProps> = ({ data, onComplete }) => {
  const progressCircleRef = useRef<SVGCircleElement>(null);
  const completedRef = useRef(false);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  const circumference = 2 * Math.PI * RING_RADIUS;

  useEffect(() => {
    let rafId: number;
    const tick = () => {
      const now = Date.now();
      const remaining = Math.max(0, data.endTime - now);
      const pct = data.durationMs > 0 ? (remaining / data.durationMs) * 100 : 0;

      if (progressCircleRef.current) {
        const offset = circumference - (pct / 100) * circumference;
        progressCircleRef.current.style.strokeDashoffset = String(offset);
        progressCircleRef.current.style.transition = 'none';
      }

      if (pct <= 0 && !completedRef.current) {
        completedRef.current = true;
        onCompleteRef.current(data.id);
        return;
      }
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [data.id, data.endTime, data.durationMs, circumference]);

  const iconSrc = data.icon.startsWith('/') || data.icon.startsWith('http')
    ? data.icon
    : assetPath(`/assets/icons/${data.icon}.png`);

  const centerPx = SIZE_PX / 2; // 13
  const innerCircleTotalPx = INNER_RADIUS * 2 + STROKE_PX * 2; // 22
  const innerCircleOffsetPx = (SIZE_PX - innerCircleTotalPx) / 2; // 2 — strict pixel alignment, no %

  return (
    <div
      className="relative flex-shrink-0"
      style={{ width: SIZE_PX, height: SIZE_PX }}
      data-active-boost-id={data.id}
    >
      <svg
        width={SIZE_PX}
        height={SIZE_PX}
        viewBox={`0 0 ${SIZE_PX} ${SIZE_PX}`}
        className="absolute block"
        style={{ left: 0, top: 0, width: SIZE_PX, height: SIZE_PX, overflow: 'visible' }}
      >
        <g transform={`translate(${centerPx}, ${centerPx})`}>
          {/* Radial progress track (incomplete area) - centered */}
          <circle
            cx={0}
            cy={0}
            r={RING_RADIUS}
            fill="transparent"
            stroke={RING_TRACK}
            strokeWidth={RING_STROKE}
            style={{ transition: 'none' }}
          />
          {/* Radial progress fill - time left */}
          <circle
            ref={progressCircleRef}
            cx={0}
            cy={0}
            r={RING_RADIUS}
            fill="transparent"
            stroke={RING_FILL}
            strokeWidth={RING_STROKE}
            strokeLinecap="round"
            strokeDasharray={circumference}
            style={{
              strokeDashoffset: circumference,
              transition: 'none',
              transform: 'rotate(-90deg)',
              transformOrigin: '0 0',
            }}
          />
        </g>
      </svg>
      {/* Inner circle: brown + stroke + icon; strict pixel center (no %/translate) so all boosts align */}
      <div
        className="absolute rounded-full flex items-center justify-center overflow-hidden"
        style={{
          left: innerCircleOffsetPx,
          top: innerCircleOffsetPx,
          width: INNER_RADIUS * 2,
          height: INNER_RADIUS * 2,
          backgroundColor: BG,
          border: `${STROKE_PX}px solid ${STROKE_COLOR}`,
          boxSizing: 'content-box',
        }}
      >
        <img
          src={iconSrc}
          alt=""
          className="object-contain"
          style={{ width: 12, height: 12 }}
        />
      </div>
    </div>
  );
};
