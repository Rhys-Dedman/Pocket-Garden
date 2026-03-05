/**
 * Plant panel: reveal above plant → hold → move to goal icon with green trail; on impact decrement goal count.
 */
import React, { useEffect, useRef, useState } from 'react';

const REVEAL_MS = 220;
const HOLD_MS = 250;
const MOVE_TO_TARGET_MS = 250;
const CIRCLE_SHRINK_PHASE = 0.2;
const PANEL_BG = '#fcf0c6';
const CIRCLE_BG = '#90c978'; // light green trail
const MAX_TRAIL_POINTS = 9;
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
const ARC_HEIGHT_PX = 18;
const SIZE_SCALE = 0.6;

interface Point {
  x: number;
  y: number;
}

export interface PlantPanelData {
  id: string;
  goalSlotIdx: number;
  iconSrc: string;
  startX: number;
  startY: number;
  hoverX: number;
  hoverY: number;
  moveToTargetDelayMs: number;
}

interface PlantPanelProps {
  data: PlantPanelData;
  containerRef: React.RefObject<HTMLDivElement | null>;
  targetRef: React.RefObject<HTMLElement | null>;
  onImpact: (goalSlotIdx: number) => void;
  onComplete: () => void;
  appScale?: number;
}

export const PlantPanel: React.FC<PlantPanelProps> = ({
  data,
  containerRef,
  targetRef,
  appScale = 1,
  onImpact,
  onComplete,
}) => {
  const [phase, setPhase] = useState<'reveal' | 'hold' | 'moveToTarget' | 'trailOnly'>('reveal');
  const [pos, setPos] = useState<Point>({ x: data.startX, y: data.startY });
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
  const moveTargetPosRef = useRef<Point | null>(null); // Captured once at move start - never changes
  const trailRef = useRef<{ p: Point; color: string }[]>([]);
  const impactFiredRef = useRef(false);
  const trailOnlyStartRef = useRef<number>(0);
  const rafRef = useRef<number>(0);

  const panelHeight = 28 * SIZE_SCALE;
  const panelMinWidth = 56 * SIZE_SCALE;
  const panelWidth = Math.max(panelMinWidth, (44 + 10) * SIZE_SCALE); // value always 1
  const sizeW = sizeScale.w * panelWidth;
  const sizeH = sizeScale.h * panelHeight;

  useEffect(() => {
    startTimeRef.current = Date.now();
  }, [data.id]);

  useEffect(() => {
    const container = containerRef.current;
    const target = targetRef.current;
    if (!container || !target) return;

    const getTargetPoint = (): Point => {
      const tr = target.getBoundingClientRect();
      const cr = container.getBoundingClientRect();
      return {
        x: (tr.left + tr.width / 2 - cr.left) / appScale,
        y: (tr.top + tr.height / 2 - cr.top) / appScale,
      };
    };

    const tick = () => {
      const now = Date.now();
      const elapsed = now - startTimeRef.current;

      if (phase === 'reveal') {
        const t = Math.min(elapsed / REVEAL_MS, 1);
        const eased = 1 - Math.pow(1 - t, 1.8);
        const x = data.startX + (data.hoverX - data.startX) * eased;
        const y = data.startY + (data.hoverY - data.startY) * eased;
        setPos({ x, y });
        setSizeScale({ w: eased, h: 0.5 + eased * 0.5 });
        setContentScale(eased);
        setContentOpacity(eased);
        if (t >= 1) setPhase('hold');
        rafRef.current = requestAnimationFrame(tick);
        return;
      }

      if (phase === 'hold') {
        const holdPhaseElapsed = elapsed - REVEAL_MS;
        const driftY = holdPhaseElapsed * DRIFT_PX_PER_MS;
        const currentX = data.hoverX;
        const currentY = data.hoverY - driftY;
        setPos({ x: currentX, y: currentY });

        const holdEnd = REVEAL_MS + HOLD_MS + data.moveToTargetDelayMs;
        if (elapsed >= holdEnd) {
          setPhase('moveToTarget');
          moveStartRef.current = now;
          moveStartPosRef.current = { x: currentX, y: currentY };
          trailRef.current = [{ p: { x: currentX, y: currentY }, color: PANEL_BG }];
          // Capture target position once - goal UI may change on impact (e.g. completed state), so never re-query
          moveTargetPosRef.current = getTargetPoint();
        }
        setSizeScale({ w: 1, h: 1 });
        setContentScale(1);
        setContentOpacity(1);
        rafRef.current = requestAnimationFrame(tick);
        return;
      }

      if (phase === 'moveToTarget') {
        const targetPt = moveTargetPosRef.current;
        if (!targetPt) {
          rafRef.current = requestAnimationFrame(tick);
          return;
        }
        const moveElapsed = now - moveStartRef.current;
        const t = Math.min(moveElapsed / MOVE_TO_TARGET_MS, 1);
        const eased = t * t * t * t;
        const start = moveStartPosRef.current;
        const midX = start.x + (targetPt.x - start.x) * 0.5;
        const controlY = Math.min(start.y, targetPt.y) - ARC_HEIGHT_PX;
        const x = (1 - eased) * (1 - eased) * start.x + 2 * (1 - eased) * eased * midX + eased * eased * targetPt.x;
        const y = (1 - eased) * (1 - eased) * start.y + 2 * (1 - eased) * eased * controlY + eased * eased * targetPt.y;
        setPos({ x, y });

        const currentColor = lerpHex(PANEL_BG, CIRCLE_BG, t);
        setBgColor(currentColor);

        const shrinkT = Math.min(t / CIRCLE_SHRINK_PHASE, 1);
        const circleDiameter = panelHeight;
        const currentW = (panelWidth + (circleDiameter - panelWidth) * shrinkT) / panelWidth;
        const currentH = 1;
        setSizeScale({ w: currentW, h: currentH });
        setIsCircle(shrinkT >= 1);
        setContentOpacity(1 - shrinkT);

        trailRef.current = [{ p: { x, y }, color: currentColor }, ...trailRef.current].slice(0, MAX_TRAIL_POINTS);
        setTrail([...trailRef.current]);

        if (t >= 1) {
          if (!impactFiredRef.current) {
            impactFiredRef.current = true;
            onImpact(data.goalSlotIdx);
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
  }, [phase, data, containerRef, targetRef, appScale, onImpact, onComplete]);

  const showPanel = phase === 'reveal' || phase === 'hold' || (phase === 'moveToTarget' && !isCircle);
  const showCircle = phase === 'moveToTarget' && isCircle;
  const circleDiameter = panelHeight;

  return (
    <div className="absolute inset-0 pointer-events-none overflow-visible" style={{ zIndex: 75 }}>
      {trail.length > 1 && (
        <svg className="absolute inset-0 w-full h-full overflow-visible" style={{ pointerEvents: 'none' }}>
          <defs>
            <filter id={`plant-trail-glow-${data.id}`}>
              <feGaussianBlur in="SourceGraphic" stdDeviation="0.6" />
            </filter>
          </defs>
          <g filter={`url(#plant-trail-glow-${data.id})`} style={{ opacity: trailOpacity }}>
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
                  key={`pt-${i}`}
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
            <img src={data.iconSrc} alt="" className="w-[15px] h-[15px] shrink-0 object-contain" aria-hidden />
            <span
              className="font-black tabular-nums leading-none"
              style={{ color: '#583c1f', letterSpacing: '-0.04em', fontSize: '11px' }}
            >
              1
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
