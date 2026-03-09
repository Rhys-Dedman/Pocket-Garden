/**
 * Coin panel: reveal above plant → hold → move to wallet with trail; on impact add value to wallet.
 */
import React, { useEffect, useRef, useState } from 'react';
import { assetPath } from '../utils/assetPath';
import { getPerformanceMode } from '../utils/performanceMode';

const REVEAL_MS = 220;
const HOLD_MS = 250; // 0.25s at top before stagger
const MOVE_TO_WALLET_MS = 250; // 2x faster (was 500)
const CIRCLE_SHRINK_PHASE = 0.2; // first 20% of move: shrink to circle + fade text
const PANEL_BG = '#fcf0c6';
const CIRCLE_BG = '#dfbb38';
const MAX_TRAIL_POINTS = 9; // 25% longer than 7
const DRIFT_PX_PER_MS = 0.01;

function lerpHex(hex1: string, hex2: string, t: number): string {
  const parse = (h: string) => {
    const n = parseInt(h.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  };
  const [r1, g1, b1] = parse(hex1);
  const [r2, g2, b2] = parse(hex2);
  const r = Math.round(r1 + (r2 - r1) * t);
  const g = Math.round(g1 + (g2 - g1) * t);
  const b = Math.round(b1 + (b2 - b1) * t);
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}

const TRAIL_FADE_AFTER_HIT_MS = 280;
const ARC_HEIGHT_PX = 18; // upward arc when moving to wallet
const SIZE_SCALE = 0.6; // coin panel size scale (affects panel + circle + trail)
/** When more than this many panels are active, skip trail + blur to keep FPS (e.g. 19 surplus harvests). */
const SKIP_TRAIL_WHEN_PANELS_ABOVE = 8;

interface Point {
  x: number;
  y: number;
}

export interface CoinPanelData {
  id: string;
  value: number;
  startX: number;
  startY: number;
  hoverX: number;
  hoverY: number;
  moveToWalletDelayMs: number;
}

interface CoinPanelProps {
  data: CoinPanelData;
  containerRef: React.RefObject<HTMLDivElement | null>;
  walletRef: React.RefObject<HTMLElement | null>;
  walletIconRef?: React.RefObject<HTMLElement | null>;
  onImpact: (value: number) => void;
  onComplete: () => void;
  appScale?: number;
  /** When > SKIP_TRAIL_WHEN_PANELS_ABOVE, trail and blur are disabled for FPS (many harvests). */
  activePanelCount?: number;
}

export const CoinPanel: React.FC<CoinPanelProps> = ({
  data,
  containerRef,
  walletRef,
  walletIconRef,
  appScale = 1,
  onImpact,
  onComplete,
  activePanelCount = 1,
}) => {
  // Freeze at spawn: if we ever had "many" panels for current threshold, never show trail (avoids mid-flight switch)
  const skipTrailLifetimeRef = useRef(false);
  const trailThreshold = getPerformanceMode() ? 4 : SKIP_TRAIL_WHEN_PANELS_ABOVE;
  if (activePanelCount > trailThreshold) skipTrailLifetimeRef.current = true;
  const useTrail = activePanelCount <= trailThreshold && !skipTrailLifetimeRef.current;

  const [phase, setPhase] = useState<'reveal' | 'hold' | 'moveToWallet' | 'trailOnly'>('reveal');
  const [pos, setPos] = useState<Point>({ x: data.startX, y: data.startY });
  // size as scale: start 0 width, 0.5 height → end 1, 1
  const [sizeScale, setSizeScale] = useState({ w: 0, h: 0.5 });
  const [contentScale, setContentScale] = useState(0);
  const [contentOpacity, setContentOpacity] = useState(0);
  const [bgColor, setBgColor] = useState(PANEL_BG);
  const [isCircle, setIsCircle] = useState(false);
  const [trail, setTrail] = useState<{ p: Point; color: string }[]>([]);
  const [trailOpacity, setTrailOpacity] = useState(1);
  const startTimeRef = useRef<number>(Date.now());
  const moveStartRef = useRef<number>(0);
  const moveStartPosRef = useRef<Point>({ x: 0, y: 0 });
  const trailRef = useRef<{ p: Point; color: string }[]>([]);
  const impactFiredRef = useRef(false);
  const trailOnlyStartRef = useRef<number>(0);
  const rafRef = useRef<number>(0);

  // Panel full size (flexible width by content); 50% smaller overall
  const panelHeight = 28 * SIZE_SCALE;
  const panelMinWidth = 56 * SIZE_SCALE;
  const panelWidth = Math.max(panelMinWidth, (44 + String(data.value).length * 10) * SIZE_SCALE); // slightly bigger panel
  const sizeW = sizeScale.w * panelWidth;
  const sizeH = sizeScale.h * panelHeight;

  useEffect(() => {
    startTimeRef.current = Date.now();
  }, [data.id]);

  useEffect(() => {
    const container = containerRef.current;
    const wallet = walletRef.current;
    const iconEl = walletIconRef?.current ?? wallet;
    if (!container || !wallet) return;

    const getWalletTarget = (): Point => {
      const el = iconEl || wallet;
      const wr = el.getBoundingClientRect();
      const cr = container.getBoundingClientRect();
      return {
        x: (wr.left + wr.width / 2 - cr.left) / appScale,
        y: (wr.top + wr.height / 2 - cr.top) / appScale,
      };
    };

    const tick = () => {
      const now = Date.now();
      const elapsed = now - startTimeRef.current;

      if (phase === 'reveal') {
        const t = Math.min(elapsed / REVEAL_MS, 1);
        // Ease-out: fast start, ease into full stop
        const eased = 1 - Math.pow(1 - t, 1.8);
        const x = data.startX + (data.hoverX - data.startX) * eased;
        const y = data.startY + (data.hoverY - data.startY) * eased;
        setPos({ x, y });
        setSizeScale({ w: eased, h: 0.5 + eased * 0.5 });
        setContentScale(eased);
        setContentOpacity(eased);
        if (t >= 1) {
          setPhase('hold');
        }
        rafRef.current = requestAnimationFrame(tick);
        return;
      }

      if (phase === 'hold') {
        const holdPhaseElapsed = elapsed - REVEAL_MS;
        const driftY = holdPhaseElapsed * DRIFT_PX_PER_MS;
        const currentX = data.hoverX;
        const currentY = data.hoverY - driftY;
        setPos({ x: currentX, y: currentY });

        const holdEnd = REVEAL_MS + HOLD_MS + data.moveToWalletDelayMs;
        if (elapsed >= holdEnd) {
          setPhase('moveToWallet');
          moveStartRef.current = now;
          moveStartPosRef.current = { x: currentX, y: currentY };
          trailRef.current = [{ p: { x: currentX, y: currentY }, color: PANEL_BG }];
        }
        setSizeScale({ w: 1, h: 1 });
        setContentScale(1);
        setContentOpacity(1);
        rafRef.current = requestAnimationFrame(tick);
        return;
      }

      if (phase === 'moveToWallet') {
        const moveElapsed = now - moveStartRef.current;
        const t = Math.min(moveElapsed / MOVE_TO_WALLET_MS, 1);
        const eased = t * t * t * t;
        const target = getWalletTarget();
        const start = moveStartPosRef.current;
        const midX = start.x + (target.x - start.x) * 0.5;
        const controlY = Math.min(start.y, target.y) - ARC_HEIGHT_PX;
        const x = (1 - eased) * (1 - eased) * start.x + 2 * (1 - eased) * eased * midX + eased * eased * target.x;
        const y = (1 - eased) * (1 - eased) * start.y + 2 * (1 - eased) * eased * controlY + eased * eased * target.y;
        setPos({ x, y });

        // Color: fade from panel (white) to yellow over full 100% of travel
        const currentColor = lerpHex(PANEL_BG, CIRCLE_BG, t);
        setBgColor(currentColor);

        // First 20%: shrink to circle, fade content
        const shrinkT = Math.min(t / CIRCLE_SHRINK_PHASE, 1);
        const circleDiameter = panelHeight;
        const currentW = (panelWidth + (circleDiameter - panelWidth) * shrinkT) / panelWidth;
        const currentH = 1;
        setSizeScale({ w: currentW, h: currentH });
        setIsCircle(shrinkT >= 1);
        setContentOpacity(1 - shrinkT);

        if (useTrail) {
          trailRef.current = [{ p: { x, y }, color: currentColor }, ...trailRef.current].slice(0, MAX_TRAIL_POINTS);
          setTrail([...trailRef.current]);
        }

        if (t >= 1) {
          if (!impactFiredRef.current) {
            impactFiredRef.current = true;
            onImpact(data.value);
          }
          if (useTrail) {
            setPhase('trailOnly');
            trailOnlyStartRef.current = now;
          } else {
            onComplete();
            return;
          }
        }
        rafRef.current = requestAnimationFrame(tick);
        return;
      }

      if (phase === 'trailOnly') {
        const trailElapsed = now - trailOnlyStartRef.current;
        const fade = Math.max(0, 1 - trailElapsed / TRAIL_FADE_AFTER_HIT_MS);
        setTrailOpacity(fade);
        if (useTrail) setTrail([...trailRef.current]);
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
  }, [phase, data, containerRef, walletRef, walletIconRef, onImpact, onComplete, useTrail]);

  const showPanel = phase === 'reveal' || phase === 'hold' || (phase === 'moveToWallet' && !isCircle);
  const showCircle = phase === 'moveToWallet' && isCircle;
  const circleDiameter = panelHeight;

  return (
    <div className="absolute inset-0 pointer-events-none overflow-visible" style={{ zIndex: 75 }}>
      {/* Trail (like seed particle trail); skipped when many panels for FPS */}
      {useTrail && trail.length > 1 && (
        <svg className="absolute inset-0 w-full h-full overflow-visible" style={{ pointerEvents: 'none' }}>
          <defs>
            <filter id="coin-trail-glow">
              <feGaussianBlur in="SourceGraphic" stdDeviation="0.6" />
            </filter>
          </defs>
          <g filter="url(#coin-trail-glow)" style={{ opacity: trailOpacity }}>
            {trail.map((seg, i) => {
              if (i === 0) return null;
              const prev = trail[i - 1].p;
              const curr = seg.p;
              const segmentCount = Math.max(1, trail.length - 1);
              const taperProgress = (i - 1) / Math.max(1, segmentCount - 1);
              const widthScale = 1.0 - taperProgress * 0.5;
              const opacityScale = 1.0 - taperProgress;
              return (
                <line
                  key={`ct-${i}`}
                  x1={prev.x}
                  y1={prev.y}
                  x2={curr.x}
                  y2={curr.y}
                  stroke={seg.color}
                  strokeWidth={circleDiameter * widthScale}
                  strokeLinecap="round"
                  strokeOpacity={opacityScale}
                />
              );
            })}
          </g>
        </svg>
      )}

      {/* Coin panel (rectangle) or circle */}
      {(showPanel || showCircle) && (
        <div
          className="absolute flex items-center justify-center"
          style={{
            left: pos.x,
            top: pos.y,
            width: sizeW,
            height: sizeH,
            minWidth: sizeW,
            minHeight: sizeH,
            transform: 'translate(-50%, -50%)',
            background: bgColor,
            borderRadius: isCircle ? '50%' : sizeH / 2,
            boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
            opacity: phase === 'trailOnly' ? 0 : 1,
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 3,
              paddingTop: 4,
              paddingBottom: 4,
              paddingLeft: 2,
              paddingRight: 6,
              transform: `scale(${contentScale * 0.88})`,
              opacity: contentOpacity,
            }}
          >
            <img src={assetPath('/assets/icons/icon_coin.png')} alt="" className="w-[15px] h-[15px] shrink-0 object-contain" aria-hidden />
            <span
              className="font-black tabular-nums leading-none"
              style={{ color: '#583c1f', letterSpacing: '-0.04em', fontSize: '11px' }}
            >
              {data.value}
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
