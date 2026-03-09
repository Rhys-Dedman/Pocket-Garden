/**
 * Yellow particle burst from wallet icon on coin impact. Mobile-game style feedback.
 */
import React, { useEffect, useRef, useState } from 'react';

const PARTICLE_COUNT = 12;
const DURATION_MS = 380;
const MAX_RADIUS_PX = 28;
const COLORS = ['#dfbb38', '#f5d547', '#e8c435'];

interface Particle {
  id: number;
  angle: number;
  size: number;
  color: string;
}

interface WalletImpactBurstProps {
  trigger: number;
  walletIconRef: React.RefObject<HTMLElement | null>;
  containerRef: React.RefObject<HTMLDivElement | null>;
  onComplete?: () => void;
  appScale?: number;
}

export const WalletImpactBurst: React.FC<WalletImpactBurstProps> = ({
  trigger,
  walletIconRef,
  containerRef,
  onComplete,
  appScale = 1,
}) => {
  const [particles, setParticles] = useState<Array<Particle & { x: number; y: number; opacity: number; scale: number }>>([]);
  const [isDone, setIsDone] = useState(false);
  const startTimeRef = useRef(0);
  const originRef = useRef({ x: 0, y: 0 });
  const rafRef = useRef(0);
  const prevTriggerRef = useRef(0);
  const completedRef = useRef(false);
  const onCompleteRef = useRef(onComplete);
  const particleContainerRef = useRef<HTMLDivElement>(null);
  const particlesRef = useRef<Array<Particle & { x: number; y: number; opacity: number; scale: number }>>([]);
  particlesRef.current = particles;
  onCompleteRef.current = onComplete;

  useEffect(() => {
    if (trigger === 0 || trigger === prevTriggerRef.current) return;
    prevTriggerRef.current = trigger;

    const icon = walletIconRef.current;
    const container = containerRef.current;
    if (!icon || !container) return;

    const rect = icon.getBoundingClientRect();
    const contRect = container.getBoundingClientRect();
    const ox = (rect.left + rect.width / 2 - contRect.left) / appScale;
    const oy = (rect.top + rect.height / 2 - contRect.top) / appScale;
    originRef.current = { x: ox, y: oy };

    const newParticles: Array<Particle & { x: number; y: number; opacity: number; scale: number }> = Array.from(
      { length: PARTICLE_COUNT },
      (_, i) => ({
        id: i,
        angle: (Math.PI * 2 * i) / PARTICLE_COUNT + Math.random() * 0.5,
        size: 4 + Math.random() * 5,
        color: COLORS[i % COLORS.length],
        x: ox,
        y: oy,
        opacity: 1,
        scale: 1,
      })
    );
    setParticles(newParticles);
    setIsDone(false);
    startTimeRef.current = Date.now();
    completedRef.current = false;
  }, [trigger, walletIconRef, containerRef]);

  useEffect(() => {
    if (trigger === 0) return;
    const origin = originRef.current;

    const tick = () => {
      const elapsed = Date.now() - startTimeRef.current;
      const t = Math.min(elapsed / DURATION_MS, 1);
      const eased = 1 - Math.pow(1 - t, 1.5); // ease-out

      const radius = MAX_RADIUS_PX * eased;
      const opacity = Math.max(0, 1 - t * 1.2);
      const scale = Math.max(0, 1 - t);

      const container = particleContainerRef.current;
      const list = particlesRef.current;
      if (container && list.length > 0) {
        for (let i = 0; i < container.children.length; i++) {
          const p = list[i];
          if (!p) break;
          const el = container.children[i] as HTMLElement;
          const x = origin.x + Math.cos(p.angle) * radius;
          const y = origin.y + Math.sin(p.angle) * radius;
          el.style.left = `${x}px`;
          el.style.top = `${y}px`;
          el.style.opacity = String(opacity);
          el.style.transform = `translate(-50%, -50%) scale(${scale})`;
        }
      }

      if (t >= 1 && !completedRef.current) {
        completedRef.current = true;
        setParticles([]);
        setIsDone(true);
        onCompleteRef.current?.();
      }
      if (t < 1) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [trigger]);

  if (isDone || particles.length === 0) return null;

  return (
    <div className="absolute inset-0 pointer-events-none overflow-visible" style={{ zIndex: 66 }}>
      <div ref={particleContainerRef} className="absolute inset-0">
        {particles.map((p) => (
        <div
          key={p.id}
          className="absolute rounded-full"
          style={{
            left: p.x,
            top: p.y,
            width: p.size,
            height: p.size,
            transform: `translate(-50%, -50%) scale(${p.scale})`,
            background: p.color,
            opacity: p.opacity,
            boxShadow: `0 0 6px ${p.color}`,
          }}
        />
        ))}
      </div>
    </div>
  );
};
