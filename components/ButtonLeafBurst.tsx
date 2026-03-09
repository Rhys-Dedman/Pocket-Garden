/**
 * Button leaf burst particle system.
 * Perfect circle burst for seed/harvest button activation.
 */
import React, { useEffect, useRef, useState } from 'react';
import { assetPath } from '../utils/assetPath';
import { shouldTick60 } from '../utils/raf60';

const LEAF_SPRITES = [assetPath('/assets/vfx/particle_leaf_1.png'), assetPath('/assets/vfx/particle_leaf_2.png')];
const PARTICLE_COUNT = 20;
const SPAWN_RADIUS = 45; // particles spawn on this ring
const BURST_RADIUS = 80; // particles travel out to this radius
const GRAVITY_PX_PER_S = 0;
const LEAF_LIFETIME_MS_MIN = 200;
const LEAF_LIFETIME_MS_MAX = 1000;

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

interface ButtonLeafBurstProps {
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
    angle: (Math.PI * 2 * i) / count + Math.random() * 0.5,
    initialSpeed: 25 + Math.random() * 225,
    initialRotationRad: Math.random() * Math.PI * 2,
    phase1RotationDeg: 60 + Math.random() * 60,
    phase2RotationDeg: 20 + Math.random() * 15,
    size: 12 + Math.random() * 8,
    lifetimeMs: LEAF_LIFETIME_MS_MIN + Math.random() * (LEAF_LIFETIME_MS_MAX - LEAF_LIFETIME_MS_MIN),
  }));
}

export const ButtonLeafBurst: React.FC<ButtonLeafBurstProps> = ({ x, y, startTime, onComplete, appScale = 1 }) => {
  const [leaves] = useState<LeafParticle[]>(() => createLeaves(PARTICLE_COUNT));
  const [positions, setPositions] = useState<{ x: number; y: number; opacity: number; rotation: number; scale: number }[]>(
    () => leaves.map((l) => ({ 
      x: Math.cos(l.angle) * SPAWN_RADIUS, 
      y: Math.sin(l.angle) * SPAWN_RADIUS, 
      opacity: 1, 
      rotation: 0, 
      scale: 1 
    }))
  );
  const [imgFailed, setImgFailed] = useState<Record<number, boolean>>({});
  const posRef = useRef<
    { x: number; y: number; vx: number; vy: number; opacity: number; rotation: number; scale: number; falling: boolean; fallStartTime: number }[]
  >(leaves.map((l) => ({ 
    x: Math.cos(l.angle) * SPAWN_RADIUS, 
    y: Math.sin(l.angle) * SPAWN_RADIUS, 
    vx: 0, vy: 0, opacity: 1, rotation: 0, scale: 1, falling: false, fallStartTime: 0 
  })));
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
      // Spawn on the ring at SPAWN_RADIUS, shoot outward
      p.x = Math.cos(l.angle) * SPAWN_RADIUS;
      p.y = Math.sin(l.angle) * SPAWN_RADIUS;
      p.vx = Math.cos(l.angle) * l.initialSpeed;
      p.vy = Math.sin(l.angle) * l.initialSpeed;
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
        
        // Heavy drag - velocity decays quickly over time
        const drag = 0.85; // strong deceleration each frame
        p.vx *= drag;
        p.vy *= drag;
        
        p.vy += GRAVITY_PX_PER_S * dtSec;
        
        if (p.falling) {
          p.x += p.vx * dtSec;
          p.y += p.vy * dtSec;
        } else {
          // Perfect circle constraint
          const dist = Math.sqrt(p.x * p.x + p.y * p.y);
          if (dist >= BURST_RADIUS) {
            p.falling = true;
            p.fallStartTime = elapsed;
            p.vx *= 0.05;
            p.vy *= 0.05;
          } else {
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
        p.scale = 1 - 0.4 * lifeProgress;
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
        top: y,
        width: 1,
        height: 1,
        transform: `translate(-50%, -50%) scale(${appScale})`,
        transformOrigin: 'center center',
        zIndex: 100,
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
