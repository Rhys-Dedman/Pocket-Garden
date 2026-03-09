/**
 * Barn particle: flies from "Add to Barn" button to the Barn nav button with a green trail.
 */
import React, { useEffect, useRef, useState } from 'react';

const MOVE_DURATION_MS = 475;
const MAX_TRAIL_POINTS = 9;
const TRAIL_FADE_AFTER_HIT_MS = 200;
const PARTICLE_SIZE = 16;
const PARTICLE_COLOR = '#b8d458';
const TRAIL_COLOR = '#8fb33a';

interface Point {
  x: number;
  y: number;
}

export interface BarnParticleData {
  id: string;
  startX: number;
  startY: number;
}

interface BarnParticleProps {
  data: BarnParticleData;
  containerRef: React.RefObject<HTMLDivElement | null>;
  barnButtonRef: React.RefObject<HTMLElement | null>;
  onImpact?: () => void;
  onComplete: () => void;
  appScale?: number;
}

export const BarnParticle: React.FC<BarnParticleProps> = ({
  data,
  containerRef,
  barnButtonRef,
  onImpact,
  onComplete,
  appScale = 1,
}) => {
  const [frame, setFrame] = useState<{ phase: 'moving' | 'trailOnly'; pos: Point; trail: Point[]; trailOpacity: number }>({
    phase: 'moving',
    pos: { x: data.startX, y: data.startY },
    trail: [],
    trailOpacity: 1,
  });
  const startTimeRef = useRef<number>(Date.now());
  const startPosRef = useRef<Point>({ x: data.startX, y: data.startY });
  const trailRef = useRef<Point[]>([]);
  const impactFiredRef = useRef(false);
  const trailOnlyStartRef = useRef<number>(0);
  const phaseRef = useRef<'moving' | 'trailOnly'>('moving');
  const rafRef = useRef<number>(0);
  phaseRef.current = frame.phase;

  useEffect(() => {
    startTimeRef.current = Date.now();
    startPosRef.current = { x: data.startX, y: data.startY };
    trailRef.current = [{ x: data.startX, y: data.startY }];
  }, [data.id, data.startX, data.startY]);

  useEffect(() => {
    const container = containerRef.current;
    const barnButton = barnButtonRef.current;
    if (!container || !barnButton) return;

    const getTargetPos = (): Point => {
      const br = barnButton.getBoundingClientRect();
      const cr = container.getBoundingClientRect();
      return {
        x: (br.left + br.width / 2 - cr.left) / appScale,
        y: (br.top + br.height / 2 - cr.top) / appScale,
      };
    };

    const tick = () => {
      const now = Date.now();
      const elapsed = now - startTimeRef.current;

      if (phaseRef.current === 'moving') {
        const t = Math.min(elapsed / MOVE_DURATION_MS, 1);
        let eased: number;
        if (t < 0.5) {
          eased = 0.25 * Math.pow(t * 2, 2);
        } else {
          eased = 0.25 + 0.75 * (1 - Math.pow(1 - (t - 0.5) * 2, 5));
        }

        const target = getTargetPos();
        const start = startPosRef.current;

        const cp1x = start.x + 120;
        const cp1y = start.y - 30;
        const cp2x = target.x + 40;
        const cp2y = target.y - 80;

        const oneMinusT = 1 - eased;
        const x = oneMinusT * oneMinusT * oneMinusT * start.x +
                  3 * oneMinusT * oneMinusT * eased * cp1x +
                  3 * oneMinusT * eased * eased * cp2x +
                  eased * eased * eased * target.x;
        const y = oneMinusT * oneMinusT * oneMinusT * start.y +
                  3 * oneMinusT * oneMinusT * eased * cp1y +
                  3 * oneMinusT * eased * eased * cp2y +
                  eased * eased * eased * target.y;

        trailRef.current = [{ x, y }, ...trailRef.current].slice(0, MAX_TRAIL_POINTS);

        if (t >= 1) {
          if (!impactFiredRef.current) {
            impactFiredRef.current = true;
            onImpact?.();
          }
          phaseRef.current = 'trailOnly';
          trailOnlyStartRef.current = now;
          setFrame({ phase: 'trailOnly', pos: { x, y }, trail: [...trailRef.current], trailOpacity: 1 });
        } else {
          setFrame({ phase: 'moving', pos: { x, y }, trail: [...trailRef.current], trailOpacity: 1 });
        }
        rafRef.current = requestAnimationFrame(tick);
        return;
      }

      if (phaseRef.current === 'trailOnly') {
        const trailElapsed = now - trailOnlyStartRef.current;
        const fade = Math.max(0, 1 - trailElapsed / TRAIL_FADE_AFTER_HIT_MS);
        if (fade <= 0) {
          onComplete();
          return;
        }
        setFrame((prev) => ({ ...prev, trailOpacity: fade, trail: [...trailRef.current] }));
        rafRef.current = requestAnimationFrame(tick);
        return;
      }

      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [data, containerRef, barnButtonRef, onImpact, onComplete]);

  const { phase, pos, trail, trailOpacity } = frame;

  return (
    <div className="absolute inset-0 pointer-events-none overflow-visible" style={{ zIndex: 200 }}>
      {trail.length > 1 && (
        <svg className="absolute inset-0 w-full h-full overflow-visible" style={{ pointerEvents: 'none' }}>
          <g style={{ opacity: trailOpacity }}>
            {trail.map((point, i) => {
              if (i === 0) return null;
              const prev = trail[i - 1];
              const segmentCount = Math.max(1, trail.length - 1);
              // Opacity: 100% at head (i=1) fading to 0% at tail
              const taperProgress = (i - 1) / Math.max(1, segmentCount - 1);
              const opacityScale = 1.0 - taperProgress;
              return (
                <line
                  key={`bt-${i}`}
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

      {/* Main particle - crisp circle */}
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
