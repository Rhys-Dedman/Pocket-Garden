/**
 * Unlock burst particle system - used when unlocking a locked cell.
 * Similar to LeafBurst but with:
 * - Zero vertical offset (spawns at direct center of cell)
 * - More circular spread (less ellipse)
 * - 3x the particle count
 */
import React, { useEffect, useRef, useState } from 'react';
import { PLANT_CONTAINER_WIDTH } from '../constants/boardLayout';
import { assetPath } from '../utils/assetPath';
import { shouldTick60 } from '../utils/raf60';

const LEAF_SPRITES = [assetPath('/assets/vfx/particle_leaf_1.png'), assetPath('/assets/vfx/particle_leaf_2.png')];
const CELL_SCALE = 1.2;
const HEX_RADIUS_PX = 0.6 * PLANT_CONTAINER_WIDTH * CELL_SCALE;
const MAX_RADIUS_HEX = 1;
// More circular spread: ellipse ratio closer to 1 (was 1.0/1.5 = 0.67, now 1.0/1.15 = 0.87)
const ELLIPSE_A = HEX_RADIUS_PX * MAX_RADIUS_HEX;
const ELLIPSE_B = HEX_RADIUS_PX * MAX_RADIUS_HEX * (1.0 / 1.15);
const GRAVITY_PX_PER_S = 95;
const LEAF_LIFETIME_MS_MIN = 300;
const LEAF_LIFETIME_MS_MAX = 700;
/** Particle count for unlock burst: 3x the baseline leaf burst (18 * 3 = 54) */
export const UNLOCK_BURST_COUNT = 27;

interface LeafParticle {
  id: number;
  sprite: string;
  angle: number;
  initialSpeed: number;
  initialRotationRad: number;
  phase1RotationDeg: number;
  phase2RotationDeg: number;
  size: number;
  lifetimeMs: number;
}

interface UnlockBurstProps {
  x: number;
  y: number;
  startTime: number;
  onComplete: () => void;
  appScale?: number;
}

function createLeaves(count: number): LeafParticle[] {
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    sprite: LEAF_SPRITES[i % LEAF_SPRITES.length],
    angle: (Math.PI * 2 * i) / count + Math.random() * 0.8,
    initialSpeed: 25 + Math.random() * 475,
    initialRotationRad: Math.random() * Math.PI * 2,
    phase1RotationDeg: 90 + Math.random() * 90,
    phase2RotationDeg: 25 + Math.random() * 20,
    size: 15 + Math.random() * 10,
    lifetimeMs: LEAF_LIFETIME_MS_MIN + Math.random() * (LEAF_LIFETIME_MS_MAX - LEAF_LIFETIME_MS_MIN),
  }));
}

export const UnlockBurst: React.FC<UnlockBurstProps> = ({ x, y, startTime, onComplete, appScale = 1 }) => {
  const [leaves] = useState<LeafParticle[]>(() => createLeaves(UNLOCK_BURST_COUNT));
  const [positions, setPositions] = useState<{ x: number; y: number; opacity: number; rotation: number; scale: number }[]>(
    () => leaves.map(() => ({ x: 0, y: 0, opacity: 1, rotation: 0, scale: 1 }))
  );
  const [imgFailed, setImgFailed] = useState<Record<number, boolean>>({});
  const posRef = useRef<
    { x: number; y: number; vx: number; vy: number; opacity: number; rotation: number; scale: number; falling: boolean; fallStartTime: number }[]
  >(leaves.map(() => ({ x: 0, y: 0, vx: 0, vy: 0, opacity: 1, rotation: 0, scale: 1, falling: false, fallStartTime: 0 })));
  const rafRef = useRef<number>(0);
  const completedRef = useRef(false);
  const onCompleteRef = useRef(onComplete);
  const raf60LastTickRef = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);
  onCompleteRef.current = onComplete;

  useEffect(() => {
    const start = startTime;
    const totalDurationMs = Math.max(...leaves.map((l) => l.lifetimeMs)) + 80;
    leaves.forEach((l, i) => {
      const p = posRef.current[i];
      p.vx = Math.cos(l.angle) * l.initialSpeed;
      p.vy = Math.sin(l.angle) * l.initialSpeed;
      p.x = 0;
      p.y = 0;
      p.rotation = l.initialRotationRad;
      p.opacity = 1;
      p.scale = 1;
      p.falling = false;
      p.fallStartTime = 0;
    });

    const tick = () => {
      const elapsed = Date.now() - start;
      if (elapsed >= totalDurationMs) {
        if (!completedRef.current) {
          completedRef.current = true;
          onCompleteRef.current();
        }
        return;
      }
      if (!shouldTick60(raf60LastTickRef)) {
        rafRef.current = requestAnimationFrame(tick);
        return;
      }
      const dtSec = 1 / 60;

      posRef.current.forEach((p, i) => {
        const leaf = leaves[i];
        const fadeStartMs = leaf.lifetimeMs * 0.5;
        const fadeDurationMs = leaf.lifetimeMs * 0.5;
        p.vy += GRAVITY_PX_PER_S * dtSec;
        if (p.falling) {
          p.x += p.vx * dtSec;
          p.y += p.vy * dtSec;
        } else {
          const ellipseDist = Math.sqrt((p.x / ELLIPSE_A) ** 2 + (p.y / ELLIPSE_B) ** 2);
          if (ellipseDist >= 1) {
            p.falling = true;
            p.fallStartTime = elapsed;
            p.vx *= 0.05;
            p.vy *= 0.05;
          } else {
            const maxSpeed = leaf.initialSpeed * Math.max(0, 1 - ellipseDist);
            const speed = Math.hypot(p.vx, p.vy) || 1;
            if (speed > maxSpeed) {
              const scale = maxSpeed / speed;
              p.vx *= scale;
              p.vy *= scale;
            }
            p.x += p.vx * dtSec;
            p.y += p.vy * dtSec;
          }
        }
        const halfLife = leaf.lifetimeMs * 0.5;
        let rotationDeg: number;
        if (elapsed < halfLife) {
          rotationDeg = (elapsed / halfLife) * leaf.phase1RotationDeg;
        } else {
          const phase2Progress = (elapsed - halfLife) / halfLife;
          rotationDeg = leaf.phase1RotationDeg + phase2Progress * leaf.phase2RotationDeg;
        }
        p.rotation = leaf.initialRotationRad + (rotationDeg * Math.PI) / 180;
        p.opacity =
          elapsed >= leaf.lifetimeMs
            ? 0
            : elapsed < fadeStartMs
              ? 1
              : Math.max(0, 1 - (elapsed - fadeStartMs) / fadeDurationMs);
        const lifeProgress = Math.min(1, elapsed / leaf.lifetimeMs);
        p.scale = 1 - 0.5 * lifeProgress;
      });

      const container = containerRef.current;
      if (container) {
        posRef.current.forEach((p, i) => {
          const el = container.children[i] as HTMLElement;
          if (!el) return;
          const leaf = leaves[i];
          el.style.left = `${p.x}px`;
          el.style.top = `${p.y}px`;
          el.style.opacity = String(p.opacity);
          el.style.width = `${leaf.size}px`;
          el.style.height = `${leaf.size}px`;
          el.style.transform = `translate(-50%, -50%) scale(${p.scale}) rotate(${p.rotation}rad)`;
        });
      }
      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [startTime, leaves]);

  return (
    <div
      className="pointer-events-none"
      style={{
        position: 'fixed',
        left: x,
        top: y, // No vertical offset - spawn at direct center
        width: 1,
        height: 1,
        transform: `translate(-50%, -50%) scale(${appScale})`,
        transformOrigin: 'center center',
        zIndex: 70,
      }}
    >
      <div ref={containerRef} className="absolute" style={{ left: 0, top: 0 }}>
        {leaves.map((leaf, i) => (
          <div
            key={leaf.id}
            className="absolute"
            style={{
              left: positions[i].x,
              top: positions[i].y,
              width: leaf.size,
              height: leaf.size,
              transform: `translate(-50%, -50%) scale(${positions[i].scale}) rotate(${positions[i].rotation}rad)`,
              opacity: positions[i].opacity,
            }}
          >
            {imgFailed[i] ? (
            <div
              className="w-full h-full rounded-sm"
              style={{
                background: 'linear-gradient(135deg, #4a7c23 0%, #6b8e23 100%)',
                boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
              }}
            />
          ) : (
            <img
              src={leaf.sprite}
              alt=""
              className="w-full h-full object-contain"
              style={{ filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.3))' }}
              onError={() => setImgFailed((prev) => ({ ...prev, [i]: true }))}
            />
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
