/**
 * Golden pot bonuses — discovery-style shell without plant subtitle or collect button.
 * Backdrop and X dismiss; shows golden pot count and bonus tier strip.
 */
import React, { useEffect, useState, useRef } from 'react';
import { assetPath } from '../utils/assetPath';
import { PopupVectorBackground } from './PopupVectorBackground';
import { PlantWithPot } from './PlantWithPot';
import {
  REWARD_PILL_HEIGHT_PX,
  REWARD_PILL_STROKE_COLOR,
  REWARD_PILL_STROKE_WIDTH_PX,
} from './Reward';

const LEAF_SPRITES = [assetPath('/assets/vfx/particle_leaf_1.png'), assetPath('/assets/vfx/particle_leaf_2.png')];

const GOLDEN_POT_ICON_PX = Math.round(40 * 1.15) + 2;

interface LeafParticle {
  id: number;
  sprite: string;
  angle: number;
  speed: number;
  rotationSpeed: number;
  initialRotation: number;
  size: number;
  delay: number;
  spawnX?: number;
  spawnY?: number;
  lifetime: number;
}

export interface GoldenPotBonusesPopupProps {
  isVisible: boolean;
  onClose: () => void;
  /** Plants that currently have a golden pot (mastered). */
  goldenPotCount: number;
  maxGoldenPots?: number;
  appScale?: number;
}

const POPUP_LEAF_COUNT = 40;
const POPUP_LEAF_MIN_LIFETIME_MS = 250;
const POPUP_LEAF_MAX_LIFETIME_MS = 1000;
const POPUP_CLOSE_MS = 200;

const POPUP_WIDTH = 260;
const POPUP_HEIGHT = 320;

function createPopupLeaves(): LeafParticle[] {
  return Array.from({ length: POPUP_LEAF_COUNT }, (_, i) => {
    const perimeter = 2 * (POPUP_WIDTH + POPUP_HEIGHT);
    const pos = (i / POPUP_LEAF_COUNT) * perimeter + Math.random() * 40;

    let spawnX: number;
    let spawnY: number;
    let outwardAngle: number;

    if (pos < POPUP_WIDTH) {
      spawnX = pos - POPUP_WIDTH / 2;
      spawnY = -POPUP_HEIGHT / 2;
      outwardAngle = -Math.PI / 2 + (Math.random() - 0.5) * 0.8;
    } else if (pos < POPUP_WIDTH + POPUP_HEIGHT) {
      spawnX = POPUP_WIDTH / 2;
      spawnY = (pos - POPUP_WIDTH) - POPUP_HEIGHT / 2;
      outwardAngle = 0 + (Math.random() - 0.5) * 0.8;
    } else if (pos < 2 * POPUP_WIDTH + POPUP_HEIGHT) {
      spawnX = POPUP_WIDTH / 2 - (pos - POPUP_WIDTH - POPUP_HEIGHT);
      spawnY = POPUP_HEIGHT / 2;
      outwardAngle = Math.PI / 2 + (Math.random() - 0.5) * 0.8;
    } else {
      spawnX = -POPUP_WIDTH / 2;
      spawnY = POPUP_HEIGHT / 2 - (pos - 2 * POPUP_WIDTH - POPUP_HEIGHT);
      outwardAngle = Math.PI + (Math.random() - 0.5) * 0.8;
    }

    return {
      id: i,
      sprite: LEAF_SPRITES[i % LEAF_SPRITES.length],
      angle: outwardAngle,
      speed: Math.random() * 600,
      rotationSpeed: (Math.random() - 0.5) * 540,
      initialRotation: Math.random() * 360,
      size: 20 + Math.random() * 20,
      lifetime: POPUP_LEAF_MIN_LIFETIME_MS + Math.random() * (POPUP_LEAF_MAX_LIFETIME_MS - POPUP_LEAF_MIN_LIFETIME_MS),
      delay: 0,
      spawnX,
      spawnY,
    };
  });
}

const SUBTITLE_COLOR = '#5c4a32';

/** Left column tier number (scaled inner coords). */
const BONUS_TIER_NUMBER_REM = 1.25;

const GOLD_POT_BONUS_TIERS: readonly { potCount: number; description: string }[] = [
  { potCount: 4, description: '2x Offline Earnings' },
  { potCount: 8, description: 'Instant Orders' },
  { potCount: 12, description: '150% Production Speed' },
  { potCount: 16, description: '150% Harvest Speed' },
  { potCount: 20, description: '2x Merge Coins' },
  { potCount: 24, description: 'Auto Merge Enabled' },
];

const BONUS_DISABLED_NUMBER_COLOR = '#dcc999';
const BONUS_DISABLED_DESC_COLOR = '#c7b381';
const BONUS_ENABLED_NUMBER_COLOR = '#9fb744';
const BONUS_ENABLED_DESC_COLOR = '#62873b';

export const GoldenPotBonusesPopup: React.FC<GoldenPotBonusesPopupProps> = ({
  isVisible,
  onClose,
  goldenPotCount,
  maxGoldenPots = 24,
  appScale = 1,
}) => {
  const [animState, setAnimState] = useState<'hidden' | 'entering' | 'visible' | 'leaving'>('hidden');
  const [assetsReady, setAssetsReady] = useState(false);
  const [leaves, setLeaves] = useState<LeafParticle[]>([]);
  const [leafPositions, setLeafPositions] = useState<
    { x: number; y: number; opacity: number; rotation: number; scale: number }[]
  >([]);
  const [imgFailed, setImgFailed] = useState<Record<number, boolean>>({});
  const leafRafRef = useRef<number>(0);
  const leafStartTimeRef = useRef<number>(0);
  const leafPosRef = useRef<
    { x: number; y: number; vx: number; vy: number; opacity: number; rotation: number; scale: number; started: boolean }[]
  >([]);

  const clampedCount = Math.max(0, Math.min(maxGoldenPots, goldenPotCount));
  const countLabel = `${clampedCount}/${maxGoldenPots}`;

  useEffect(() => {
    if (!isVisible) {
      setAssetsReady(false);
      return;
    }
    setAssetsReady(true);
  }, [isVisible]);

  useEffect(() => {
    if (leaves.length === 0) return;

    const tick = () => {
      const elapsed = Date.now() - leafStartTimeRef.current;

      const allDone = leaves.every((leaf, i) => {
        const leafElapsed = elapsed - leaf.delay;
        return leafElapsed > leaf.lifetime + 100;
      });

      if (allDone) {
        setLeaves([]);
        return;
      }

      leafPosRef.current.forEach((p, i) => {
        const leaf = leaves[i];
        if (!leaf) return;
        const leafElapsed = elapsed - leaf.delay;

        if (leafElapsed < 0) return;
        if (leafElapsed > leaf.lifetime) {
          p.opacity = 0;
          return;
        }

        if (!p.started) {
          p.started = true;
          p.vx = Math.cos(leaf.angle) * leaf.speed;
          p.vy = Math.sin(leaf.angle) * leaf.speed;
        }

        const dtSec = 1 / 60;
        const gravity = 60;
        const drag = 0.92;

        p.vy += gravity * dtSec;
        p.vx *= drag;
        p.vy *= drag;
        p.x += p.vx * dtSec;
        p.y += p.vy * dtSec;
        p.rotation = leaf.initialRotation + (leafElapsed / 1000) * leaf.rotationSpeed;

        const fadeStart = leaf.lifetime * 0.5;
        const fadeDuration = leaf.lifetime * 0.5;
        p.opacity = leafElapsed < fadeStart ? 1 : Math.max(0, 1 - (leafElapsed - fadeStart) / fadeDuration);
        p.scale = 1 - 0.2 * Math.min(1, leafElapsed / leaf.lifetime);
      });

      setLeafPositions(leafPosRef.current.map((p) => ({ x: p.x, y: p.y, opacity: p.opacity, rotation: p.rotation, scale: p.scale })));
      leafRafRef.current = requestAnimationFrame(tick);
    };

    leafRafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(leafRafRef.current);
  }, [leaves]);

  useEffect(() => {
    if (isVisible && assetsReady && animState === 'hidden') {
      const newLeaves = createPopupLeaves();
      setLeaves(newLeaves);
      leafStartTimeRef.current = Date.now();
      leafPosRef.current = newLeaves.map((leaf) => ({
        x: leaf.spawnX ?? 0,
        y: leaf.spawnY ?? 0,
        vx: 0,
        vy: 0,
        opacity: 1,
        rotation: 0,
        scale: 1,
        started: false,
      }));
      setLeafPositions(newLeaves.map((leaf) => ({ x: leaf.spawnX ?? 0, y: leaf.spawnY ?? 0, opacity: 1, rotation: 0, scale: 1 })));
      setImgFailed({});
      setAnimState('entering');
      setTimeout(() => setAnimState('visible'), 250);
    } else if (!isVisible && (animState === 'visible' || animState === 'entering')) {
      setAnimState('leaving');
      setTimeout(() => {
        setAnimState('hidden');
        onClose();
      }, POPUP_CLOSE_MS);
    }
  }, [isVisible, assetsReady, animState, onClose]);

  const [isClosing, setIsClosing] = useState(false);

  const dismiss = () => {
    if (isClosing || animState === 'leaving') return;
    setIsClosing(true);
    setAnimState('leaving');
    setTimeout(() => {
      setAnimState('hidden');
      onClose();
    }, POPUP_CLOSE_MS);
  };

  if (animState === 'hidden') return null;

  const isEntering = animState === 'entering';
  const isLeaving = animState === 'leaving';

  return (
    <div
      className="fixed inset-0 flex items-center justify-center pointer-events-auto"
      style={{ zIndex: 100, overflow: 'hidden' }}
    >
      <div
        className="absolute transition-opacity duration-200"
        style={{
          top: '-10px',
          left: '-10px',
          right: '-10px',
          bottom: '-10px',
          backgroundColor: 'rgba(0, 0, 0, 0.7)',
          opacity: isLeaving ? 0 : 1,
        }}
        onClick={dismiss}
      />

      <div
        className="relative flex items-center justify-center"
        style={{
          transform: `translateY(-32px) scale(${appScale})`,
          transformOrigin: 'center center',
        }}
      >
        {(isEntering || animState === 'visible') && leaves.length > 0 && (
          <div
            className="absolute pointer-events-none"
            style={{
              left: '50%',
              top: '50%',
              width: 1,
              height: 1,
              transform: 'translate(-50%, -50%)',
              zIndex: 101,
            }}
          >
            {leaves.map((leaf, i) => (
              <div
                key={leaf.id}
                className="absolute"
                style={{
                  left: leafPositions[i]?.x ?? 0,
                  top: leafPositions[i]?.y ?? 0,
                  width: leaf.size,
                  height: leaf.size,
                  transform: `translate(-50%, -50%) scale(${leafPositions[i]?.scale ?? 1}) rotate(${leafPositions[i]?.rotation ?? 0}deg)`,
                  opacity: leafPositions[i]?.opacity ?? 0,
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
                    style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.4))' }}
                    onError={() => setImgFailed((prev) => ({ ...prev, [i]: true }))}
                  />
                )}
              </div>
            ))}
          </div>
        )}

        <div
          className="relative flex flex-col items-center"
          style={{
            width: '320px',
            zIndex: 102,
            animation: isEntering
              ? 'popupEnter 250ms ease-out forwards'
              : isLeaving
                ? `popupLeave ${POPUP_CLOSE_MS}ms ease-in forwards`
                : 'none',
            transform: animState === 'visible' ? 'scale(1)' : undefined,
            opacity: animState === 'visible' ? 1 : undefined,
          }}
        >
          <style>{`
            @keyframes popupEnter {
              0% { transform: scale(0.9); opacity: 0; }
              70% { transform: scale(1.05); opacity: 1; }
              100% { transform: scale(1); opacity: 1; }
            }
            @keyframes popupLeave {
              0% { transform: scale(1); opacity: 1; }
              100% { transform: scale(0.9); opacity: 0; }
            }
          `}</style>

          <div
            className="absolute left-1/2 -translate-x-1/2 flex items-center justify-center"
            style={{
              width: '120px',
              height: '120px',
              top: '-20px',
              zIndex: 104,
            }}
          >
            <img
              src={assetPath('/assets/popups/popup_header.png')}
              alt=""
              className="absolute inset-0 w-full h-full object-contain"
              style={{ filter: 'drop-shadow(0 4px 12px rgba(0,0,0,0.25))' }}
            />
            <div
              className="relative flex items-center justify-center"
              style={{
                width: '94px',
                height: '94px',
                marginTop: '-4px',
                filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.2))',
              }}
            >
              <PlantWithPot level={1} mastered wrapperClassName="h-full w-full" />
            </div>
          </div>

          <div
            style={{
              position: 'relative',
              marginTop: '36px',
              width: '640px',
              transform: 'scale(0.5)',
              transformOrigin: 'top center',
              marginBottom: '-575px',
            }}
          >
            <div
              style={{
                position: 'relative',
                filter: 'drop-shadow(0 16px 48px rgba(0,0,0,0.3))',
                padding: '150px 40px 63px 40px',
              }}
            >
              <PopupVectorBackground />
              <div className="relative z-[2] flex flex-col items-center">
                <h2
                  className="font-black tracking-tight text-center"
                  style={{
                    color: SUBTITLE_COLOR,
                    fontFamily: 'Inter, sans-serif',
                    fontSize: '4.375rem',
                    lineHeight: 1.05,
                  }}
                >
                  Golden Pots
                </h2>

                <div className="w-full flex items-center justify-center" style={{ marginTop: '8px', marginBottom: '24px' }}>
                  <img
                    src={assetPath('/assets/popups/popup_divider.png')}
                    alt=""
                    className="h-auto object-contain"
                    style={{ width: '520px' }}
                  />
                </div>

                <p
                  className="font-medium text-center leading-relaxed italic w-full"
                  style={{
                    color: '#c2b280',
                    fontFamily: 'Inter, sans-serif',
                    paddingLeft: '24px',
                    paddingRight: '24px',
                    fontSize: '2rem',
                  }}
                >
                  Collect golden pots to unlock powerful bonuses.
                </p>

                <div className="flex items-center justify-center" style={{ marginTop: '20px' }}>
                  <div
                    className="inline-flex items-center justify-center box-border rounded-full"
                    style={{
                      backgroundColor: '#775041',
                      border: `${REWARD_PILL_STROKE_WIDTH_PX * 2}px solid ${REWARD_PILL_STROKE_COLOR}`,
                      minHeight: `${REWARD_PILL_HEIGHT_PX * 2 - 5}px`,
                      paddingTop: 8,
                      paddingBottom: 7,
                      paddingLeft: 20,
                      paddingRight: 31,
                      gap: '10px',
                    }}
                  >
                    <img
                      src={assetPath('/assets/icons/icon_goldenpot.png')}
                      alt=""
                      className="object-contain shrink-0"
                      style={{ width: `${GOLDEN_POT_ICON_PX}px`, height: `${GOLDEN_POT_ICON_PX}px` }}
                    />
                    <span
                      className="font-black tracking-tight"
                      style={{
                        color: '#fcf0c7',
                        fontFamily: 'Inter, sans-serif',
                        fontSize: '2rem',
                        lineHeight: 1,
                      }}
                    >
                      {countLabel}
                    </span>
                  </div>
                </div>

                <div
                  className="flex w-full flex-col"
                  style={{ marginTop: '28px', maxWidth: '520px', gap: '10px' }}
                >
                  {GOLD_POT_BONUS_TIERS.map((tier) => {
                    const enabled = clampedCount >= tier.potCount;
                    const bonusSprite = enabled
                      ? assetPath('/assets/popups/popup_bonuses_enabled.png')
                      : assetPath('/assets/popups/popup_bonuses_disabled.png');
                    const numberColor = enabled ? BONUS_ENABLED_NUMBER_COLOR : BONUS_DISABLED_NUMBER_COLOR;
                    const descColor = enabled ? BONUS_ENABLED_DESC_COLOR : BONUS_DISABLED_DESC_COLOR;
                    return (
                      <div key={tier.potCount} className="relative w-full shrink-0">
                        <img
                          src={bonusSprite}
                          alt=""
                          className="block h-auto w-full object-contain pointer-events-none"
                          draggable={false}
                        />
                        {/* Same %-of-sprite positioning as the original single bonus row */}
                        <div
                          className="pointer-events-none absolute flex items-center justify-center rounded-lg font-black box-border text-center"
                          style={{
                            left: 'calc(2% + 10px)',
                            top: 'calc(22% + 9px)',
                            padding: '10px 13px',
                            width: '3.45rem',
                            maxWidth: '3.45rem',
                            backgroundColor: 'transparent',
                            color: numberColor,
                            fontFamily: 'Inter, sans-serif',
                            fontSize: `${BONUS_TIER_NUMBER_REM}rem`,
                            lineHeight: 1,
                          }}
                        >
                          {tier.potCount}
                        </div>
                        <div
                          className="pointer-events-none absolute flex items-center justify-center rounded-lg font-bold text-center box-border overflow-hidden"
                          style={{
                            top: 'calc(26% - 8px)',
                            right: 'calc(22% - 45px)',
                            maxWidth: '68.64%',
                            width: '68.64%',
                            padding: '10px 16px',
                            backgroundColor: 'transparent',
                            fontFamily: 'Inter, sans-serif',
                            lineHeight: 1.15,
                          }}
                        >
                          <span
                            className="block w-full min-w-0 whitespace-nowrap text-center"
                            style={{ fontSize: '1.75rem', color: descColor }}
                          >
                            {tier.description}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              dismiss();
            }}
            className="absolute top-[56px] right-6 w-8 h-8 flex items-center justify-center transition-all hover:scale-110 active:scale-95"
            style={{
              backgroundColor: 'transparent',
              border: 'none',
              color: '#c2b280',
              zIndex: 105,
            }}
          >
            <svg width="16" height="16" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="M2 2L12 12M12 2L2 12" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
};
