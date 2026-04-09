/**
 * Goal coin particle: flies from completed goal icon or popup reward to wallet.
 * - `variant="goal"` — classic orders/goals: trough arc + original ease/speed/size (unchanged from pre–popup work).
 * - `variant="popupReward"` — discovery / offline: left-then-up path + punchier end ease + larger VFX.
 */
import React, { useEffect, useRef, useState } from 'react';
import { assetPath } from '../utils/assetPath';
import { getPerformanceMode } from '../utils/performanceMode';

const MOVE_DURATION_MS = 350;
/** Shorter trail = fewer SVG elements when many coins fly at once (e.g. 5+ goals). */
const MAX_TRAIL_POINTS = 8;
const TRAIL_FADE_AFTER_HIT_MS = 280;
const PARTICLE_SIZE = 40; // same as goal icon
const TRAIL_COLOR = '#dfbb38';
const TRAIL_STROKE_WIDTH = 32;
/** When more than this many particles are active, skip trail entirely to keep FPS up. */
const SKIP_TRAIL_WHEN_ACTIVE_ABOVE = 4;

/** Time remap for goal/order coins (legacy — symmetric slow-middle feel). */
function easePathProgressGoal(t: number): number {
  const p = 0.7;
  return t < 0.5 ? 0.5 * Math.pow(t * 2, p) : 1 - 0.5 * Math.pow((1 - t) * 2, p);
}

/**
 * Time remap for popup reward coins — accelerating into the wallet (slow path progress early,
 * steep late so it hits at high speed; no ease-out at the end).
 */
function easePathProgressPopupReward(t: number): number {
  // Shape: fast initial movement, then still accelerating into the wallet.
  // (We intentionally keep the end "no ease-out" behavior.)
  if (t <= 0.14) return (t / 0.14) * 0.10;
  const u = (t - 0.14) / 0.86;
  // Higher exponent = stronger late acceleration (faster end speed).
  return 0.10 + 0.90 * Math.pow(u, 1.7);
}

interface Point {
  x: number;
  y: number;
}

export interface GoalCoinParticleData {
  id: string;
  startX: number;
  startY: number;
  value: number;
  /** Set for rewarded coin-goal ad: value already includes happiest multiplier; skip random happy roll. */
  skipHappyCustomerRoll?: boolean;
  /** Coin-goal ad reward: spawn `value` without shop Double Coins (no visual 2× on this tile). */
  skipDoubleCoinsMultiplier?: boolean;
}

interface GoalCoinParticleProps {
  data: GoalCoinParticleData;
  containerRef: React.RefObject<HTMLDivElement | null>;
  walletRef: React.RefObject<HTMLElement | null>;
  walletIconRef?: React.RefObject<HTMLElement | null>;
  onImpact: (value: number) => void;
  onComplete: () => void;
  appScale?: number;
  /** When > SKIP_TRAIL_WHEN_ACTIVE_ABOVE, trail is disabled to reduce cost (e.g. 5+ coins at once). */
  activeCount?: number;
  /**
   * `goal` — coin goals / plant orders → wallet (classic trough + easing).
   * `popupReward` — discovery & offline earnings (left-up path + punchier easing + scale).
   */
  variant?: 'goal' | 'popupReward';
  /** Only for `popupReward`; default 1.5. Ignored for `goal` (always 1×). */
  popupVisualScale?: number;
}

export const GoalCoinParticle: React.FC<GoalCoinParticleProps> = ({
  data,
  containerRef,
  walletRef,
  walletIconRef,
  onImpact,
  onComplete,
  appScale = 1,
  activeCount = 1,
  variant = 'goal',
  popupVisualScale = 1.5,
}) => {
  const isPopupReward = variant === 'popupReward';
  const durationMul = isPopupReward ? 0.75 : 1; // 25% faster for popup coins only
  const visualMul = isPopupReward ? popupVisualScale : 1;
  const particleSize = PARTICLE_SIZE * visualMul;
  const trailStrokeWidth = TRAIL_STROKE_WIDTH * visualMul;
  const moveDurationMs = MOVE_DURATION_MS * durationMul;
  const trailFadeAfterHitMs = TRAIL_FADE_AFTER_HIT_MS * durationMul;
  const trailLimit = getPerformanceMode() ? 2 : SKIP_TRAIL_WHEN_ACTIVE_ABOVE;
  const useTrail = activeCount <= trailLimit;
  const [frame, setFrame] = useState<{
    phase: 'moving' | 'trailOnly';
    pos: Point;
    scale: number;
    trail: { p: Point; color: string; t: number }[];
    trailOpacity: number;
  }>({
    phase: 'moving',
    pos: { x: data.startX, y: data.startY },
    scale: 1,
    trail: [],
    trailOpacity: 1,
  });
  const startTimeRef = useRef<number>(Date.now());
  const trailRef = useRef<{ p: Point; color: string; t: number }[]>([]);
  const impactFiredRef = useRef(false);
  const trailOnlyStartRef = useRef<number>(0);
  const phaseRef = useRef<'moving' | 'trailOnly'>('moving');
  const rafRef = useRef<number>(0);
  const mountedRef = useRef(true);
  const completeScheduledRef = useRef(false);
  const onImpactRef = useRef(onImpact);
  const onCompleteRef = useRef(onComplete);
  onImpactRef.current = onImpact;
  onCompleteRef.current = onComplete;
  phaseRef.current = frame.phase;

  useEffect(() => {
    startTimeRef.current = Date.now();
    trailRef.current = [{ p: { x: data.startX, y: data.startY }, color: TRAIL_COLOR, t: 0 }];
  }, [data.id, data.startX, data.startY]);

  useEffect(() => {
    mountedRef.current = true;
    completeScheduledRef.current = false;
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

    const finishAndDespawn = () => {
      if (completeScheduledRef.current) return;
      completeScheduledRef.current = true;
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = 0;
      }
      trailRef.current = [];
      onCompleteRef.current();
    };

    const tick = () => {
      if (!mountedRef.current) return;
      const now = Date.now();
      const elapsed = now - startTimeRef.current;

      if (phaseRef.current === 'moving') {
        const t = Math.min(elapsed / moveDurationMs, 1);
        const tt = isPopupReward ? easePathProgressPopupReward(t) : easePathProgressGoal(t);

        const start = { x: data.startX, y: data.startY };
        const target = getWalletPos();
        const dx = target.x - start.x;
        const dy = target.y - start.y;

        let cp1: Point;
        let cp2: Point;
        if (isPopupReward) {
          cp1 = { x: start.x + dx * 0.45, y: start.y };
          cp2 = { x: target.x - dx * 0.05, y: start.y + dy * 0.55 };
        } else {
          const safetyMargin = containerHeight * 0.12;
          const troughDepth = 200;
          const troughY = Math.min(containerHeight - safetyMargin, Math.max(start.y, target.y) + troughDepth);
          const leanFactor = 0.45;
          cp1 = { x: start.x + dx * leanFactor, y: troughY };
          cp2 = { x: target.x - dx * 0.1, y: troughY };
        }

        const x = Math.pow(1 - tt, 3) * start.x +
                 3 * Math.pow(1 - tt, 2) * tt * cp1.x +
                 3 * (1 - tt) * tt * tt * cp2.x +
                 Math.pow(tt, 3) * target.x;
        const y = Math.pow(1 - tt, 3) * start.y +
                 3 * Math.pow(1 - tt, 2) * tt * cp1.y +
                 3 * (1 - tt) * tt * tt * cp2.y +
                 Math.pow(tt, 3) * target.y;

        const coinScale = t <= 0.5 ? 1 - (1 - 0.65) * (t / 0.5) : 0.65;
        if (useTrail) {
          trailRef.current = [{ p: { x, y }, color: TRAIL_COLOR, t }, ...trailRef.current].slice(0, MAX_TRAIL_POINTS);
        }

        if (t >= 1) {
          if (!impactFiredRef.current) {
            impactFiredRef.current = true;
            onImpactRef.current(data.value);
          }
          if (useTrail) {
            trailOnlyStartRef.current = now;
            phaseRef.current = 'trailOnly';
            setFrame({ phase: 'trailOnly', pos: { x, y }, scale: coinScale, trail: [...trailRef.current], trailOpacity: 1 });
          } else {
            finishAndDespawn();
            return;
          }
        } else {
          setFrame({
            phase: 'moving',
            pos: { x, y },
            scale: coinScale,
            trail: useTrail ? [...trailRef.current] : [],
            trailOpacity: 1,
          });
        }
        rafRef.current = requestAnimationFrame(tick);
        return;
      }

      if (phaseRef.current === 'trailOnly') {
        const trailElapsed = now - trailOnlyStartRef.current;
        const fade = Math.max(0, 1 - trailElapsed / trailFadeAfterHitMs);
        if (trailElapsed >= trailFadeAfterHitMs || fade <= 0.001) {
          finishAndDespawn();
          return;
        }
        if (mountedRef.current) {
          setFrame((prev) => ({ ...prev, trailOpacity: fade, trail: [...trailRef.current] }));
        }
        rafRef.current = requestAnimationFrame(tick);
        return;
      }

      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      mountedRef.current = false;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = 0;
      trailRef.current = [];
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, containerRef, walletRef, walletIconRef, appScale, useTrail, isPopupReward, trailFadeAfterHitMs, moveDurationMs]);

  // Safety net: force-complete if animation is stuck (RAF starvation during heavy renders)
  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (!impactFiredRef.current) {
        impactFiredRef.current = true;
        onImpactRef.current(data.value);
      }
      if (!completeScheduledRef.current) {
        completeScheduledRef.current = true;
        if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = 0; }
        onCompleteRef.current();
      }
    }, 5000);
    return () => clearTimeout(timer);
  }, [data.id, data.value]);

  const { phase, pos, scale, trail, trailOpacity } = frame;

  return (
    <div className="absolute inset-0 pointer-events-none overflow-visible" style={{ zIndex: 200 }}>
      {useTrail && trail.length > 1 && (
        <svg className="absolute inset-0 w-full h-full overflow-visible" style={{ pointerEvents: 'none' }}>
          {/* No blur filter to reduce GPU cost when many coins fly */}
          <g>
            {trail.map((seg, i) => {
              if (i === 0) return null;
              const prev = trail[i - 1];
              const curr = seg;
              const headT = prev.t;
              const baseWidthScale = headT <= 0.5 ? 1 - (1 - 0.65) * (headT / 0.5) : 0.65;
              const taperProgress = (i - 1) / Math.max(1, trail.length - 2);
              const widthScale = baseWidthScale * (1 - taperProgress);
              const opacityScale = 1.0 - taperProgress;
              const lineOpacity = Math.max(0, Math.min(1, opacityScale * trailOpacity));
              return (
                <line
                  key={`gcp-${data.id}-${i}`}
                  x1={prev.p.x}
                  y1={prev.p.y}
                  x2={curr.p.x}
                  y2={curr.p.y}
                  stroke={curr.color}
                  strokeWidth={trailStrokeWidth * widthScale}
                  strokeLinecap="round"
                  strokeOpacity={lineOpacity}
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
            width: particleSize,
            height: particleSize,
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
