/**
 * Yellow particle: flies from "Activate Reward" button (fake ad) to the active boost area in the top bar.
 */
import React, { useEffect, useRef, useState } from 'react';

const MOVE_DURATION_MS = 500;
const MAX_TRAIL_POINTS = 9;
const TRAIL_FADE_AFTER_HIT_MS = 200;
const PARTICLE_SIZE = 14;
const PARTICLE_COLOR = '#fdd176';
const TRAIL_COLOR = '#fcb215';
const BOOST_SLOT_WIDTH = 28;
const BOOST_CENTER_OFFSET = 13;
const BOOST_AREA_HALF_HEIGHT = 11;

interface Point {
  x: number;
  y: number;
}

export interface BoostParticleData {
  id: string;
  startX: number;
  startY: number;
  /** Slot index where the new boost will appear; particle targets this slot's center */
  targetSlotIndex?: number;
}

interface BoostParticleProps {
  data: BoostParticleData;
  /** Container the particle is rendered inside (e.g. header left wrapper); positions are in container local px */
  containerRef: React.RefObject<HTMLDivElement | null>;
  /** Boost area (sibling in same container); target = boostArea.offsetLeft + slot*28+13, offsetTop+11 */
  boostAreaRef: React.RefObject<HTMLElement | null>;
  onImpact?: () => void;
  onComplete: () => void;
}

export const BoostParticle: React.FC<BoostParticleProps> = ({
  data,
  containerRef,
  boostAreaRef,
  onImpact,
  onComplete,
}) => {
  const [phase, setPhase] = useState<'moving' | 'trailOnly'>('moving');
  const [pos, setPos] = useState<Point>({ x: data.startX, y: data.startY });
  const [trail, setTrail] = useState<Point[]>([]);
  const [trailOpacity, setTrailOpacity] = useState(1);
  const startTimeRef = useRef<number>(Date.now());
  const startPosRef = useRef<Point>({ x: data.startX, y: data.startY });
  const trailRef = useRef<Point[]>([]);
  const impactFiredRef = useRef(false);
  const trailOnlyStartRef = useRef<number>(0);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    startTimeRef.current = Date.now();
    startPosRef.current = { x: data.startX, y: data.startY };
    trailRef.current = [{ x: data.startX, y: data.startY }];
  }, [data.id, data.startX, data.startY]);

  useEffect(() => {
    const container = containerRef.current;
    const boostArea = boostAreaRef.current;
    if (!container || !boostArea) return;

    const getTargetPos = (): Point => {
      const slotIndex = data.targetSlotIndex ?? 0;
      const targetX = boostArea.offsetLeft + slotIndex * BOOST_SLOT_WIDTH + BOOST_CENTER_OFFSET;
      const targetY = boostArea.offsetTop + BOOST_AREA_HALF_HEIGHT;
      return { x: targetX, y: targetY };
    };

    const tick = () => {
      const now = Date.now();
      const elapsed = now - startTimeRef.current;

      if (phase === 'moving') {
        const t = Math.min(elapsed / MOVE_DURATION_MS, 1);
        let eased: number;
        if (t < 0.5) {
          eased = 0.25 * Math.pow(t * 2, 2);
        } else {
          eased = 0.25 + 0.75 * (1 - Math.pow(1 - (t - 0.5) * 2, 5));
        }

        const target = getTargetPos();
        const start = startPosRef.current;

        // Curve from bottom (button) up to top bar: go up then into target
        const cp1x = start.x - 50;
        const cp1y = start.y - 200;
        const cp2x = target.x + 30;
        const cp2y = target.y + 50;

        const oneMinusT = 1 - eased;
        const x = oneMinusT * oneMinusT * oneMinusT * start.x +
                  3 * oneMinusT * oneMinusT * eased * cp1x +
                  3 * oneMinusT * eased * eased * cp2x +
                  eased * eased * eased * target.x;
        const y = oneMinusT * oneMinusT * oneMinusT * start.y +
                  3 * oneMinusT * oneMinusT * eased * cp1y +
                  3 * oneMinusT * eased * eased * cp2y +
                  eased * eased * eased * target.y;

        setPos({ x, y });

        trailRef.current = [{ x, y }, ...trailRef.current].slice(0, MAX_TRAIL_POINTS);
        setTrail([...trailRef.current]);

        if (t >= 1) {
          if (!impactFiredRef.current) {
            impactFiredRef.current = true;
            onImpact?.();
          }
          setPhase('trailOnly');
          trailOnlyStartRef.current = now;
        }
        rafRef.current = requestAnimationFrame(tick);
        return;
      }

      if (phase === 'trailOnly') {
        const trailElapsed = now - trailOnlyStartRef.current;
        const fade = Math.max(0, 1 - trailElapsed / TRAIL_FADE_AFTER_HIT_MS);
        setTrailOpacity(fade);
        setTrail([...trailRef.current]);
        if (fade <= 0) {
          onComplete();
          return;
        }
        rafRef.current = requestAnimationFrame(tick);
        return;
      }

      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [phase, data, containerRef, boostAreaRef, onImpact, onComplete]);

  return (
    <div className="absolute inset-0 pointer-events-none overflow-visible" style={{ zIndex: 200 }}>
      {trail.length > 1 && (
        <svg className="absolute inset-0 w-full h-full overflow-visible" style={{ pointerEvents: 'none' }}>
          <g style={{ opacity: trailOpacity }}>
            {trail.map((point, i) => {
              if (i === 0) return null;
              const prev = trail[i - 1];
              const segmentCount = Math.max(1, trail.length - 1);
              const taperProgress = (i - 1) / Math.max(1, segmentCount - 1);
              const opacityScale = 1.0 - taperProgress;
              return (
                <line
                  key={`bp-${i}`}
                  x1={prev.x}
                  y1={prev.y}
                  x2={point.x}
                  y2={point.y}
                  stroke={TRAIL_COLOR}
                  strokeWidth={PARTICLE_SIZE}
                  strokeLinecap="round"
                  strokeOpacity={opacityScale}
                />
              );
            })}
          </g>
        </svg>
      )}

      {phase === 'moving' && (
        <div
          className="absolute"
          style={{
            left: pos.x,
            top: pos.y,
            width: PARTICLE_SIZE,
            height: PARTICLE_SIZE,
            transform: 'translate(-50%, -50%)',
            backgroundColor: PARTICLE_COLOR,
            borderRadius: '50%',
            border: `2px solid ${TRAIL_COLOR}`,
            boxShadow: `0 2px 4px rgba(0,0,0,0.2)`,
          }}
        />
      )}
    </div>
  );
};
