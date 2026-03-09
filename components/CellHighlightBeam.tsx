/**
 * CellHighlightBeam VFX - A highlight effect for cell upgrades.
 * Used for fertile soil or plot unlock.
 * 
 * The effect:
 * - Displays hexcell_highlight sprite with additive blending
 * - Fades in quickly, then slowly fades out
 * - Sparkles rise in a spiral pattern with eased velocity (fast then slow)
 */
import React, { useEffect, useState, useMemo, useRef } from 'react';
import { assetPath } from '../utils/assetPath';
import { shouldTick60 } from '../utils/raf60';

interface CellHighlightBeamProps {
  x: number;
  y: number;
  cellWidth: number;
  cellHeight: number;
  startTime: number;
  onComplete: () => void;
}

const VFX_DURATION_MS = 1200;
const FADE_IN_DURATION_MS = 80;
const SPARKLE_COUNT = 10;
const SPIRAL_RADIUS = 0.336;
const SPARKLE_HEIGHT_MULTIPLIER = 1.2;

const SPARKLE_COLOR = '#fff0b3';
const SPARKLE_SHADOW = 'rgba(255, 240, 179, 0.5)';

const HEXCELL_HIGHLIGHT = assetPath('/assets/hex/hexcell_highlight.png');

interface Sparkle {
  id: number;
  delay: number;
  size: number;
  fadeSpeed: number;
  fadeStartProgress: number;
  lifetimeMultiplier: number;
  radiusVariation: number;
  noiseOffsetX: number;
  noiseOffsetY: number;
  noiseSpeed: number;
  startAngle: number;
  heightSpeed: number;
  rotations: number;
}

function easeOutQuart(t: number): number {
  return 1 - Math.pow(1 - t, 4);
}

export const CellHighlightBeam: React.FC<CellHighlightBeamProps> = ({
  x,
  y,
  cellWidth,
  cellHeight,
  startTime,
  onComplete,
}) => {
  const raf60LastTickRef = useRef(0);
  const spriteRef = useRef<HTMLImageElement>(null);
  const sparkleContainerRef = useRef<HTMLDivElement>(null);

  const sparkles = useMemo<Sparkle[]>(() => {
    return Array.from({ length: SPARKLE_COUNT }, (_, i) => ({
      id: i,
      delay: (i / SPARKLE_COUNT) * 0.5 + Math.random() * 0.1,
      size: 2 + Math.random() * 2,
      fadeSpeed: 0.5 + Math.random() * 0.3,
      fadeStartProgress: 0.25 + Math.random() * 0.5,
      lifetimeMultiplier: 0.5 + Math.random() * 0.5,
      radiusVariation: 0.85 + Math.random() * 0.3,
      noiseOffsetX: Math.random() * 1000,
      noiseOffsetY: Math.random() * 1000,
      noiseSpeed: 0.3 + Math.random() * 0.4,
      startAngle: (i / SPARKLE_COUNT) * Math.PI * 2 + Math.random() * 0.5,
      heightSpeed: 0.4 + Math.random() * 1.0,
      rotations: 0.5 + Math.random() * 0.5,
    }));
  }, []);

  useEffect(() => {
    let rafId: number;
    const sparkleMaxHeight = cellHeight * SPARKLE_HEIGHT_MULTIPLIER;
    const spiralRadiusPx = cellWidth * SPIRAL_RADIUS;

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const t = Math.min(1, elapsed / VFX_DURATION_MS);

      if (t >= 1) {
        onComplete();
        return;
      }

      if (!shouldTick60(raf60LastTickRef)) {
        rafId = requestAnimationFrame(animate);
        return;
      }

      const progress = 1 - Math.pow(1 - t, 3);
      const spriteOpacity =
        elapsed < FADE_IN_DURATION_MS
          ? elapsed / FADE_IN_DURATION_MS
          : Math.max(0, 1 - (elapsed - FADE_IN_DURATION_MS) / (VFX_DURATION_MS - FADE_IN_DURATION_MS));

      if (spriteRef.current) spriteRef.current.style.opacity = String(spriteOpacity);

      const container = sparkleContainerRef.current;
      if (container) {
        sparkles.forEach((sparkle, i) => {
          const effectiveLifetime = (1 - sparkle.delay) * sparkle.lifetimeMultiplier;
          const rawSparkleProgress = Math.min(1, Math.max(0, progress - sparkle.delay) / effectiveLifetime);
          const easedProgress = easeOutQuart(rawSparkleProgress);
          const particleY = -easedProgress * sparkleMaxHeight * 0.6 * sparkle.heightSpeed;
          const spiralAngle = sparkle.startAngle + easedProgress * Math.PI * 2 * sparkle.rotations;
          const currentRadius = spiralRadiusPx * sparkle.radiusVariation * (1 - easedProgress * 0.3);
          const noiseX = Math.sin(rawSparkleProgress * sparkle.noiseSpeed * Math.PI * 2 + sparkle.noiseOffsetX) * 2;
          const noiseY = Math.cos(rawSparkleProgress * sparkle.noiseSpeed * Math.PI * 2 + sparkle.noiseOffsetY) * 1;
          const offsetX = Math.cos(spiralAngle) * currentRadius + noiseX;
          const offsetYSpiral = Math.sin(spiralAngle) * currentRadius * 0.3 + noiseY;
          let sparkleOpacity = 0;
          if (rawSparkleProgress > 0) {
            if (rawSparkleProgress < sparkle.fadeStartProgress) sparkleOpacity = 1;
            else sparkleOpacity = Math.max(0, 1 - (rawSparkleProgress - sparkle.fadeStartProgress) / (1 - sparkle.fadeStartProgress));
          }
          const el = container.children[i] as HTMLElement;
          if (el) {
            el.style.top = `calc(50% + ${particleY + offsetYSpiral}px)`;
            el.style.left = `calc(50% + ${offsetX}px)`;
            el.style.opacity = String(sparkleOpacity);
          }
        });
      }

      rafId = requestAnimationFrame(animate);
    };

    rafId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafId);
  }, [startTime, onComplete, cellWidth, cellHeight, sparkles]);

  return (
    <div
      className="pointer-events-none"
      style={{
        position: 'fixed',
        left: x,
        top: y,
        width: cellWidth,
        height: cellHeight,
        transform: 'translate(-50%, -50%)',
        transformOrigin: 'center center',
        zIndex: 60,
      }}
    >
      {/* Hexcell highlight sprite - opacity updated in rAF */}
      <img
        ref={spriteRef}
        src={HEXCELL_HIGHLIGHT}
        alt=""
        className="w-full h-full object-contain"
        style={{
          position: 'absolute',
          inset: 0,
          opacity: 0,
          mixBlendMode: 'screen',
          pointerEvents: 'none',
        }}
      />
      {/* Sparkles - positions/opacity updated in rAF */}
      <div ref={sparkleContainerRef} className="absolute inset-0">
        {sparkles.map((sparkle) => (
          <div
            key={sparkle.id}
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              width: sparkle.size,
              height: sparkle.size,
              borderRadius: '50%',
              background: SPARKLE_COLOR,
              boxShadow: `0 0 3px 1px ${SPARKLE_SHADOW}`,
              opacity: 0,
              transform: 'translate(-50%, -50%)',
            }}
          />
        ))}
      </div>
    </div>
  );
};
