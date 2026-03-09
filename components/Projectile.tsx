
import React, { useEffect, useState, useRef } from 'react';
import { ProjectileData } from '../App';

interface ProjectileProps {
  data: ProjectileData;
  onImpact: (targetIdx: number) => void;
  onComplete: () => void;
  appScale?: number;
}

interface Point {
  x: number;
  y: number;
}

export const Projectile: React.FC<ProjectileProps> = ({ data, onImpact, onComplete, appScale = 1 }) => {
  const [frame, setFrame] = useState<{
    airPos: Point;
    shadowPos: Point;
    airTrail: Point[];
    shadowTrail: Point[];
    isImpacted: boolean;
  }>({
    airPos: { x: data.startX, y: data.startY },
    shadowPos: { x: data.startX, y: data.startY },
    airTrail: [],
    shadowTrail: [],
    isImpacted: false,
  });

  const frameRef = useRef<number>(0);
  const startTimeRef = useRef<number>(Date.now());
  const airTrailRef = useRef<Point[]>([]);
  const shadowTrailRef = useRef<Point[]>([]);
  const airPosRef = useRef<Point>({ x: data.startX, y: data.startY });
  const shadowPosRef = useRef<Point>({ x: data.startX, y: data.startY });
  const isImpactedRef = useRef(false);
  const [targetCoords, setTargetCoords] = useState<Point | null>(null);
  const [containerHeight, setContainerHeight] = useState(800);

  const particleDiameter = 21;
  /** Shorter trails = fewer SVG elements per projectile; helps when many seeds fly (e.g. seed storm). */
  const maxTrailPoints = 12;
  const maxShadowTrailPoints = Math.floor(maxTrailPoints * 1.5);

  useEffect(() => {
    const el = document.getElementById(`hex-${data.targetIdx}`);
    const container = document.getElementById('game-container');
    if (el && container) {
      const rect = el.getBoundingClientRect();
      const containerRect = container.getBoundingClientRect();
      setContainerHeight(containerRect.height / appScale);
      setTargetCoords({
        x: ((rect.left + rect.width / 2) - containerRect.left) / appScale,
        y: ((rect.top + rect.height / 2) - containerRect.top) / appScale
      });
    }
  }, [data.targetIdx, appScale]);

  useEffect(() => {
    if (!targetCoords) return;

    // Adjusted duration: 610ms
    const DURATION = 610; 
    const dx = targetCoords.x - data.startX;
    const dy = targetCoords.y - data.startY;
    
    const safetyMargin = containerHeight * 0.12;
    const peakY = Math.max(safetyMargin, 50);

    const leanFactor = 0.45;
    const airCp1: Point = {
      x: data.startX + (dx * leanFactor),
      y: peakY 
    };

    const airCp2: Point = {
      x: targetCoords.x - (dx * 0.1),
      y: peakY 
    };

    const shadowCp1: Point = {
      x: data.startX + (dx * 0.4),
      y: data.startY + (dy * 0.3) - 10
    };
    const shadowCp2: Point = {
      x: targetCoords.x - (dx * 0.4),
      y: targetCoords.y - (dy * 0.1) - 5
    };

    const animate = () => {
      const now = Date.now();
      const elapsed = now - startTimeRef.current;
      let t = Math.min(elapsed / DURATION, 1);

      const p = 0.7;
      let tt: number;
      if (t < 0.5) {
        tt = 0.5 * Math.pow(t * 2, p);
      } else {
        tt = 1 - 0.5 * Math.pow((1 - t) * 2, p);
      }

      let newAirPos = airPosRef.current;
      let newShadowPos = shadowPosRef.current;
      let nextAirTrail = airTrailRef.current;
      let nextShadowTrail = shadowTrailRef.current;

      if (t < 1) {
        const ax = Math.pow(1 - tt, 3) * data.startX +
                   3 * Math.pow(1 - tt, 2) * tt * airCp1.x +
                   3 * (1 - tt) * Math.pow(tt, 2) * airCp2.x +
                   Math.pow(tt, 3) * targetCoords.x;
        const ayReal = Math.pow(1 - tt, 3) * data.startY +
                       3 * Math.pow(1 - tt, 2) * tt * airCp1.y +
                       3 * (1 - tt) * Math.pow(tt, 2) * airCp2.y +
                       Math.pow(tt, 3) * targetCoords.y;
        const sx = Math.pow(1 - tt, 3) * data.startX +
                   3 * Math.pow(1 - tt, 2) * tt * shadowCp1.x +
                   3 * (1 - tt) * Math.pow(tt, 2) * shadowCp2.x +
                   Math.pow(tt, 3) * targetCoords.x;
        const sy = Math.pow(1 - tt, 3) * data.startY +
                   3 * Math.pow(1 - tt, 2) * tt * shadowCp1.y +
                   3 * (1 - tt) * Math.pow(tt, 2) * shadowCp2.y +
                   Math.pow(tt, 3) * targetCoords.y;

        newAirPos = { x: ax, y: ayReal };
        newShadowPos = { x: sx, y: sy };
        nextAirTrail = [newAirPos, ...airTrailRef.current].slice(0, maxTrailPoints);
        nextShadowTrail = [newShadowPos, ...shadowTrailRef.current].slice(0, maxShadowTrailPoints);
      } else if (!isImpactedRef.current) {
        isImpactedRef.current = true;
        onImpact(data.targetIdx);
      }

      if (t >= 1) {
        nextAirTrail = nextAirTrail.slice(0, Math.max(0, nextAirTrail.length - 3));
        nextShadowTrail = nextShadowTrail.slice(0, Math.max(0, nextShadowTrail.length - 3));
      }

      airTrailRef.current = nextAirTrail;
      shadowTrailRef.current = nextShadowTrail;
      airPosRef.current = newAirPos;
      shadowPosRef.current = newShadowPos;
      if (t >= 1) isImpactedRef.current = true;

      setFrame({
        airPos: newAirPos,
        shadowPos: newShadowPos,
        airTrail: nextAirTrail,
        shadowTrail: nextShadowTrail,
        isImpacted: isImpactedRef.current,
      });

      if (t >= 1 && nextAirTrail.length === 0 && nextShadowTrail.length === 0) {
        onComplete();
      } else {
        frameRef.current = requestAnimationFrame(animate);
      }
    };

    frameRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frameRef.current);
  }, [targetCoords, data.startX, data.startY, data.targetIdx, containerHeight, onImpact, onComplete]);

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      <svg className="absolute inset-0 w-full h-full overflow-visible">
        {/* Shadow trail: no blur to reduce cost when many seeds fly */}
        <g style={{ opacity: 0.2 }}>
          {frame.shadowTrail.map((p, i) => {
            if (i === 0) return null;
            const prev = frame.shadowTrail[i-1];
            const taperProgress = i / maxShadowTrailPoints;
            const widthScale = 1.0 - (taperProgress * 0.5); // 100% to 50%
            const fadeScale = 1.0 - taperProgress;
            return (
              <line
                key={`shadow-trail-${i}`}
                x1={prev.x}
                y1={prev.y}
                x2={p.x}
                y2={p.y}
                stroke="#000000"
                strokeWidth={particleDiameter * widthScale}
                strokeLinecap="round"
                strokeOpacity={fadeScale}
              />
            );
          })}
        </g>

        {/* Air trail: no blur to reduce cost when many seeds fly */}
        <g>
          {frame.airTrail.map((p, i) => {
            if (i === 0) return null;
            const prev = frame.airTrail[i-1];
            const taperProgress = i / maxTrailPoints;
            const widthScale = 1.0 - (taperProgress * 0.5); // 100% to 50%
            const opacityScale = (1.0 - taperProgress) * 0.75;
            return (
              <line
                key={`air-trail-${i}`}
                x1={prev.x}
                y1={prev.y}
                x2={p.x}
                y2={p.y}
                stroke="#fcf0c6"
                strokeWidth={particleDiameter * widthScale}
                strokeLinecap="round"
                strokeOpacity={opacityScale}
              />
            );
          })}
        </g>
      </svg>

      {!frame.isImpacted && (
        <>
          {/* Shadow Head: black, 20% opacity */}
          <div 
            className="absolute z-[9]" 
            style={{ 
              left: frame.shadowPos.x, 
              top: frame.shadowPos.y, 
              opacity: 0.2,
              transform: 'translate(-50%, -50%)' 
            }}
          >
            <div 
              className="rounded-full"
              style={{
                width: `${particleDiameter}px`,
                height: `${particleDiameter}px`,
                background: '#000000'
              }}
            />
          </div>

          {/* Air Head */}
          <div 
            className="absolute z-10" 
            style={{ 
              left: frame.airPos.x, 
              top: frame.airPos.y, 
              transform: 'translate(-50%, -50%)' 
            }}
          >
            <div 
              className="rounded-full shadow-[0_0_30px_rgba(252,240,198,0.7)] flex items-center justify-center border-2 border-white/60"
              style={{
                width: `${particleDiameter}px`,
                height: `${particleDiameter}px`,
                background: '#fdf9e9'
              }}
            >
              <span className="text-[12px] select-none filter drop-shadow-sm">🌱</span>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
