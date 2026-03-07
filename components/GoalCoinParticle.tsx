/**
 * Goal coin particle: flies from completed goal icon to wallet.
 * Same timing/curve as seed particle (Projectile) but inverted: down → left → up.
 * Fast start, slow middle, fast impact.
 */
import React, { useEffect, useRef, useState } from 'react';
import { assetPath } from '../utils/assetPath';

const MOVE_DURATION_MS = 350;
const MAX_TRAIL_POINTS = 19; // 25% shorter (was 25)
const TRAIL_FADE_AFTER_HIT_MS = 220;
const PARTICLE_SIZE = 40; // same as goal icon
const TRAIL_COLOR = '#dfbb38';
const TRAIL_STROKE_WIDTH = 32; // 1.5x thicker (was 21)

interface Point {
  x: number;
  y: number;
}

export interface GoalCoinParticleData {
  id: string;
  startX: number;
  startY: number;
  value: number;
}

interface GoalCoinParticleProps {
  data: GoalCoinParticleData;
  containerRef: React.RefObject<HTMLDivElement | null>;
  walletRef: React.RefObject<HTMLElement | null>;
  walletIconRef?: React.RefObject<HTMLElement | null>;
  onImpact: (value: number) => void;
  onComplete: () => void;
  appScale?: number;
}

export const GoalCoinParticle: React.FC<GoalCoinParticleProps> = ({
  data,
  containerRef,
  walletRef,
  walletIconRef,
  onImpact,
  onComplete,
  appScale = 1,
}) => {
  const [phase, setPhase] = useState<'moving' | 'trailOnly'>('moving');
  const [pos, setPos] = useState<Point>({ x: data.startX, y: data.startY });
  const [scale, setScale] = useState(1);
  const [trail, setTrail] = useState<{ p: Point; color: string; t: number }[]>([]);
  const [trailOpacity, setTrailOpacity] = useState(1);
  const startTimeRef = useRef<number>(Date.now());
  const trailRef = useRef<{ p: Point; color: string; t: number }[]>([]);
  const impactFiredRef = useRef(false);
  const trailOnlyStartRef = useRef<number>(0);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    startTimeRef.current = Date.now();
    trailRef.current = [{ p: { x: data.startX, y: data.startY }, color: TRAIL_COLOR, t: 0 }];
  }, [data.id, data.startX, data.startY]);

  useEffect(() => {
    const container = containerRef.current;
    const walletEl = walletIconRef?.current ?? walletRef.current;
    if (!container || !walletEl) return;

    const cr = container.getBoundingClientRect();
    const containerHeight = cr.height / appScale;

    const getWalletPos = (): Point => {
      const br = walletEl.getBoundingClientRect();
      return {
        x: (br.left + br.width / 2 - cr.left) / appScale,
        y: (br.top + br.height / 2 - cr.top) / appScale,
      };
    };

    const tick = () => {
      const now = Date.now();
      const elapsed = now - startTimeRef.current;

      if (phase === 'moving') {
        const t = Math.min(elapsed / MOVE_DURATION_MS, 1);
        // Same easing as seed particle: fast start, slow middle, fast impact (power curve 0.7)
        const p = 0.7;
        const tt = t < 0.5
          ? 0.5 * Math.pow(t * 2, p)
          : 1 - 0.5 * Math.pow((1 - t) * 2, p);

        const start = { x: data.startX, y: data.startY };
        const target = getWalletPos();
        const dx = target.x - start.x;
        const dy = target.y - start.y;

        // Inverted seed path: down → left → up (trough at bottom). Deeper trough = more velocity on click
        const safetyMargin = containerHeight * 0.12;
        const troughDepth = 200; // How far down before zooming up
        const troughY = Math.min(containerHeight - safetyMargin, Math.max(start.y, target.y) + troughDepth);
        const leanFactor = 0.45;
        const cp1 = { x: start.x + dx * leanFactor, y: troughY };
        const cp2 = { x: target.x - dx * 0.1, y: troughY };

        const x = Math.pow(1 - tt, 3) * start.x +
                 3 * Math.pow(1 - tt, 2) * tt * cp1.x +
                 3 * (1 - tt) * tt * tt * cp2.x +
                 Math.pow(tt, 3) * target.x;
        const y = Math.pow(1 - tt, 3) * start.y +
                 3 * Math.pow(1 - tt, 2) * tt * cp1.y +
                 3 * (1 - tt) * tt * tt * cp2.y +
                 Math.pow(tt, 3) * target.y;

        setPos({ x, y });
        // Scale: 100% at start → 65% by 50% of animation, then hold
        const coinScale = t <= 0.5 ? 1 - (1 - 0.65) * (t / 0.5) : 0.65;
        setScale(coinScale);
        trailRef.current = [{ p: { x, y }, color: TRAIL_COLOR, t }, ...trailRef.current].slice(0, MAX_TRAIL_POINTS);
        setTrail([...trailRef.current]);

        if (t >= 1) {
          if (!impactFiredRef.current) {
            impactFiredRef.current = true;
            onImpact(data.value);
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
  }, [phase, data, containerRef, walletRef, walletIconRef, appScale, onImpact, onComplete]);

  return (
    <div className="absolute inset-0 pointer-events-none overflow-visible" style={{ zIndex: 200 }}>
      {trail.length > 1 && (
        <svg className="absolute inset-0 w-full h-full overflow-visible" style={{ pointerEvents: 'none' }}>
          <defs>
            <filter id={`goal-coin-trail-${data.id}`}>
              <feGaussianBlur in="SourceGraphic" stdDeviation="0.6" />
            </filter>
          </defs>
          <g filter={`url(#goal-coin-trail-${data.id})`} style={{ opacity: trailOpacity }}>
            {trail.map((seg, i) => {
              if (i === 0) return null;
              const prev = trail[i - 1];
              const curr = seg;
              // Trail width: 100% at t=0 → 65% at t=0.5, then hold. Taper to 0% at tail (point)
              const headT = prev.t;
              const baseWidthScale = headT <= 0.5 ? 1 - (1 - 0.65) * (headT / 0.5) : 0.65;
              const taperProgress = (i - 1) / Math.max(1, trail.length - 2);
              const widthScale = baseWidthScale * (1 - taperProgress); // Taper to 0% at tail
              const opacityScale = 1.0 - taperProgress; // Taper to 0% opacity at tail
              return (
                <line
                  key={`gcp-${i}`}
                  x1={prev.p.x}
                  y1={prev.p.y}
                  x2={curr.p.x}
                  y2={curr.p.y}
                  stroke={curr.color}
                  strokeWidth={TRAIL_STROKE_WIDTH * widthScale}
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
          className="absolute flex items-center justify-center"
          style={{
            left: pos.x,
            top: pos.y,
            width: PARTICLE_SIZE,
            height: PARTICLE_SIZE,
            transform: `translate(-50%, -50%) scale(${scale})`,
          }}
        >
          <img
            src={assetPath('/assets/icons/icon_coin.png')}
            alt=""
            className="w-full h-full object-contain"
            aria-hidden
          />
        </div>
      )}
    </div>
  );
};
