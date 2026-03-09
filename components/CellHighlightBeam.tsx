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
  const [progress, setProgress] = useState(0);
  const [spriteOpacity, setSpriteOpacity] = useState(0);

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

  const frameCountRef = useRef(0);
  useEffect(() => {
    let rafId: number;
    const animate = () => {
      const elapsed = Date.now() - startTime;
      const t = Math.min(1, elapsed / VFX_DURATION_MS);
      const easeOut = 1 - Math.pow(1 - t, 3);
      const opacity =
        elapsed < FADE_IN_DURATION_MS
          ? elapsed / FADE_IN_DURATION_MS
          : Math.max(0, 1 - (elapsed - FADE_IN_DURATION_MS) / (VFX_DURATION_MS - FADE_IN_DURATION_MS));

      frameCountRef.current += 1;
      if (frameCountRef.current % 2 === 0) {
        setProgress(easeOut);
        setSpriteOpacity(opacity);
      }

      if (t >= 1) {
        setProgress(1);
        setSpriteOpacity(0);
        onComplete();
        return;
      }

      rafId = requestAnimationFrame(animate);
    };

    rafId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafId);
  }, [startTime, onComplete]);

  const sparkleMaxHeight = cellHeight * SPARKLE_HEIGHT_MULTIPLIER;
  
  // Spiral radius in pixels
  const spiralRadiusPx = cellWidth * SPIRAL_RADIUS;

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
      {/* Hexcell highlight sprite with additive blending - same size as the cell */}
      <img
        src={HEXCELL_HIGHLIGHT}
        alt=""
        className="w-full h-full object-contain"
        style={{
          position: 'absolute',
          inset: 0,
          opacity: spriteOpacity,
          mixBlendMode: 'screen',
          pointerEvents: 'none',
        }}
      />
      
      {/* Rising sparkles in spiral pattern - staggered so each is at different stage */}
      {sparkles.map((sparkle) => {
        // Calculate sparkle's individual progress (accounting for staggered delay and variable lifetime)
        // Lifetime multiplier makes some particles die earlier (50-100% of full duration)
        const effectiveLifetime = (1 - sparkle.delay) * sparkle.lifetimeMultiplier;
        const rawSparkleProgress = Math.min(1, Math.max(0, progress - sparkle.delay) / effectiveLifetime);
        
        // Apply ease-out to vertical movement (fast start, slows down but keeps moving)
        const easedProgress = easeOutQuart(rawSparkleProgress);
        
        // Vertical position - starts at center, rises up (negative Y goes up)
        const particleY = -easedProgress * sparkleMaxHeight * 0.6 * sparkle.heightSpeed;
        
        // Spiral angle with ease-out (fast rotation at start, slow at end)
        // Each sparkle has its own rotation count (1-2 rotations)
        const spiralAngle = sparkle.startAngle + easedProgress * Math.PI * 2 * sparkle.rotations;
        
        // Spiral radius shrinks slightly as it rises (tighter spiral at top)
        const currentRadius = spiralRadiusPx * sparkle.radiusVariation * (1 - easedProgress * 0.3);
        
        // Add noise to the path for more organic movement (halved for more graceful motion)
        const noiseX = Math.sin(rawSparkleProgress * sparkle.noiseSpeed * Math.PI * 2 + sparkle.noiseOffsetX) * 2;
        const noiseY = Math.cos(rawSparkleProgress * sparkle.noiseSpeed * Math.PI * 2 + sparkle.noiseOffsetY) * 1;
        
        // Calculate X/Y offset from spiral + noise
        const offsetX = Math.cos(spiralAngle) * currentRadius + noiseX;
        const offsetYSpiral = Math.sin(spiralAngle) * currentRadius * 0.3 + noiseY;
        
        // Gradual fade out - each sparkle starts fading at different progress (25%-75%)
        let sparkleOpacity = 0;
        if (rawSparkleProgress > 0) {
          if (rawSparkleProgress < sparkle.fadeStartProgress) {
            sparkleOpacity = 1;
          } else {
            const fadeProgress = (rawSparkleProgress - sparkle.fadeStartProgress) / (1 - sparkle.fadeStartProgress);
            sparkleOpacity = Math.max(0, 1 - fadeProgress);
          }
        }
        
        return (
          <div
            key={sparkle.id}
            style={{
              position: 'absolute',
              top: `calc(50% + ${particleY + offsetYSpiral}px)`,
              left: `calc(50% + ${offsetX}px)`,
              width: sparkle.size,
              height: sparkle.size,
              borderRadius: '50%',
              background: SPARKLE_COLOR,
              boxShadow: `0 0 3px 1px ${SPARKLE_SHADOW}`,
              opacity: sparkleOpacity,
              transform: 'translate(-50%, -50%)',
            }}
          />
        );
      })}
    </div>
  );
};
