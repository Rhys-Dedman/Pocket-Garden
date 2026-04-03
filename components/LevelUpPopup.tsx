/**
 * Level Up Popup - Shown when player levels up.
 * Same layout as Discovery popup but with blue theme and particle_leaf_5/6.
 */
import React, { useCallback, useEffect, useState, useRef } from 'react';
import { assetPath } from '../utils/assetPath';
import { popupCardSurfaceStyle, usePopupPreflightEnter, type PopupAnimWithPreflight } from '../hooks/usePopupPreflightEnter';
import { PopupVectorBackground } from './PopupVectorBackground';

const LEAF_SPRITES = [assetPath('/assets/vfx/particle_leaf_5.png'), assetPath('/assets/vfx/particle_leaf_6.png')];

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

interface LevelUpPopupProps {
  isVisible: boolean;
  onClose: () => void;
  level?: number;
  /** Dynamic title based on what's being unlocked (e.g. "Storage Capacity") */
  title: string;
  /** Dynamic description (e.g. "You can now increase the amount of seeds you can store") */
  description: string;
  /** Icon path for header (matches the upgrade being unlocked) */
  icon: string;
  /** When set, shown inside the blue header circle instead of `icon` (e.g. PlantWithPot). */
  headerIcon?: React.ReactNode;
  onUnlockNow?: () => void;
  appScale?: number;
  /** When provided, show smaller text above title (e.g. "New Feature") */
  subtitle?: string;
  /** Button text (default "Unlock Now!") */
  buttonText?: string;
  /** Icon scale in header (default 1, use 0.8 for 80%) */
  iconScale?: number;
  /** When true, hide "Level X" (for info-style popups) */
  hideLevel?: boolean;
}

const POPUP_LEAF_COUNT = 40;
const POPUP_LEAF_MIN_LIFETIME_MS = 250;
const POPUP_LEAF_MAX_LIFETIME_MS = 1000;
const POPUP_WIDTH = 260;
const POPUP_HEIGHT = 320;
const POPUP_CLOSE_MS = 200;

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

export const LevelUpPopup: React.FC<LevelUpPopupProps> = ({
  isVisible,
  onClose,
  level = 1,
  title,
  description,
  icon,
  headerIcon,
  onUnlockNow,
  appScale = 1,
  subtitle,
  buttonText = 'Unlock Now!',
  iconScale = 1,
  hideLevel = false,
}) => {
  const [animState, setAnimState] = useState<PopupAnimWithPreflight>('hidden');
  const [assetsReady, setAssetsReady] = useState(false);
  const [leaves, setLeaves] = useState<LeafParticle[]>([]);
  const [leafPositions, setLeafPositions] = useState<{ x: number; y: number; opacity: number; rotation: number; scale: number }[]>([]);
  const [imgFailed, setImgFailed] = useState<Record<number, boolean>>({});
  const [buttonPressed, setButtonPressed] = useState(false);
  const leafRafRef = useRef<number>(0);
  const leafStartTimeRef = useRef<number>(0);
  const leafPosRef = useRef<{ x: number; y: number; vx: number; vy: number; opacity: number; rotation: number; scale: number; started: boolean }[]>([]);
  const popupCardLayoutRef = useRef<HTMLDivElement>(null);

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

      setLeafPositions(leafPosRef.current.map(p => ({ x: p.x, y: p.y, opacity: p.opacity, rotation: p.rotation, scale: p.scale })));
      leafRafRef.current = requestAnimationFrame(tick);
    };

    leafRafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(leafRafRef.current);
  }, [leaves]);

  const beginEnterAfterPreflight = useCallback(() => {
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
  }, []);

  usePopupPreflightEnter(animState, beginEnterAfterPreflight, popupCardLayoutRef);

  useEffect(() => {
    if (isVisible && assetsReady && animState === 'hidden') {
      setAnimState('preflight');
    } else if (!isVisible && (animState === 'visible' || animState === 'entering' || animState === 'preflight')) {
      setAnimState('leaving');
      setTimeout(() => {
        setAnimState('hidden');
        onClose();
      }, POPUP_CLOSE_MS);
    }
  }, [isVisible, assetsReady, animState, onClose]);

  const buttonRef = useRef<HTMLButtonElement>(null);

  const handleButtonClick = () => {
    if (animState === 'preflight') return;
    setAnimState('leaving');
    setTimeout(() => {
      setAnimState('hidden');
      onUnlockNow?.();
      onClose();
    }, POPUP_CLOSE_MS);
  };

  if (animState === 'hidden') return null;

  const isPreflight = animState === 'preflight';
  const isEntering = animState === 'entering';
  const isLeaving = animState === 'leaving';

  const buttonBgColor = '#89c8e1';
  const buttonBorderColor = '#66a4c6';
  const buttonTextColor = '#4580a8';
  const buttonPressedBg = '#7ab8d1';

  return (
    <div
      className="fixed inset-0 flex items-center justify-center"
      style={{ zIndex: 100, overflow: 'hidden', pointerEvents: isPreflight ? 'none' : 'auto' }}
    >
      {/* Backdrop - tapping outside does NOT close */}
      <div
        className="absolute"
        style={{
          top: '-10px',
          left: '-10px',
          right: '-10px',
          bottom: '-10px',
          backgroundColor: 'rgba(0, 0, 0, 0.7)',
          opacity: isLeaving || isPreflight ? 0 : 1,
          transition: 'opacity 0.2s',
        }}
      />

      <div
        className="relative flex items-center justify-center"
        style={{
          transform: `scale(${appScale})`,
          transformOrigin: 'center center',
        }}
      >
        {/* Leaf Burst VFX - particle_leaf_5 & 6 */}
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
                      background: 'linear-gradient(135deg, #559dcf 0%, #89c8e1 100%)',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
                    }}
                  />
                ) : (
                  <img
                    src={leaf.sprite}
                    alt=""
                    className="w-full h-full object-contain"
                    style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.4))' }}
                    onError={() => setImgFailed(prev => ({ ...prev, [i]: true }))}
                  />
                )}
              </div>
            ))}
          </div>
        )}

        {/* Popup Container */}
        <div
          ref={popupCardLayoutRef}
          className="relative flex flex-col items-center"
          style={{
            width: '320px',
            zIndex: 102,
            ...popupCardSurfaceStyle(
              animState,
              isEntering,
              isLeaving,
              'popupEnter 250ms ease-out forwards',
              `popupLeave ${POPUP_CLOSE_MS}ms ease-in forwards`
            ),
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

          {/* Header Circle - popup_header_blue */}
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
              src={assetPath('/assets/popups/popup_header_blue.png')}
              alt=""
              className="absolute inset-0 w-full h-full object-contain"
              style={{ filter: 'drop-shadow(0 4px 12px rgba(0,0,0,0.25))' }}
            />
            {headerIcon != null ? (
              <div
                className="relative flex items-center justify-center"
                style={{
                  width: `${75 * iconScale}px`,
                  height: `${75 * iconScale}px`,
                  marginTop: '-4px',
                }}
              >
                {headerIcon}
              </div>
            ) : (
              <img
                src={icon}
                alt=""
                className="relative object-contain"
                style={{
                  width: `${75 * iconScale}px`,
                  height: `${75 * iconScale}px`,
                  filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.2))',
                  marginTop: '-4px',
                }}
              />
            )}
          </div>

          {/* Background container */}
          <div
            style={{
              position: 'relative',
              marginTop: '36px',
              width: '640px',
              transform: 'scale(0.5)',
              transformOrigin: 'top center',
              marginBottom: '-290px',
            }}
          >
            <div
              style={{
                position: 'relative',
                filter: 'drop-shadow(0 16px 48px rgba(0,0,0,0.3))',
                padding: '150px 40px 60px 40px',
              }}
            >
              <PopupVectorBackground />
              <div className="relative z-[2] flex flex-col items-center">
                {/* Title - "Level X" (hidden when hideLevel) */}
                {!hideLevel && (
                  <h2
                    className="font-normal text-center"
                    style={{
                      color: '#c2b280',
                      fontFamily: 'Inter, sans-serif',
                      letterSpacing: '-0.02em',
                      fontSize: '2.25rem',
                    }}
                  >
                    Level {level}
                  </h2>
                )}

                {/* Subtitle - smaller text above main title (e.g. "New Feature") */}
                {subtitle && (
                  <h2
                    className="font-normal text-center"
                    style={{
                      color: '#76a0b7',
                      fontFamily: 'Inter, sans-serif',
                      letterSpacing: '-0.02em',
                      fontSize: '2rem',
                      marginTop: hideLevel ? '0' : '-8px',
                    }}
                  >
                    {subtitle}
                  </h2>
                )}

                {/* Main title - dynamic (e.g. "Storage Capacity" or "Seeds Evolve!") */}
                <h3
                  className="font-black tracking-tight text-center"
                  style={{
                    color: '#5c4a32',
                    fontFamily: 'Inter, sans-serif',
                    marginTop: subtitle ? '4px' : '-8px',
                    fontSize: '3.5rem',
                  }}
                >
                  {title}
                </h3>

                {/* Divider - popup_divider_Blue */}
                <div className="w-full flex items-center justify-center" style={{ marginTop: '8px', marginBottom: '24px' }}>
                  <img
                    src={assetPath('/assets/popups/popup_divider_blue.png')}
                    alt=""
                    className="h-auto object-contain"
                    style={{ width: '520px' }}
                  />
                </div>

                {/* Description - dynamic (e.g. "You can now increase the amount of seeds you can store") */}
                <p
                  className="font-medium text-center leading-relaxed italic w-full"
                  style={{
                    color: '#76a0b7',
                    fontFamily: 'Inter, sans-serif',
                    paddingLeft: '24px',
                    paddingRight: '24px',
                    fontSize: '2rem',
                  }}
                >
                  {description}
                </p>

                <div className="flex-grow min-h-[48px]" />

                {/* Unlock Now Button - blue */}
                <button
                  ref={buttonRef}
                  onMouseDown={() => setButtonPressed(true)}
                  onMouseUp={() => setButtonPressed(false)}
                  onMouseLeave={() => setButtonPressed(false)}
                  onClick={handleButtonClick}
                  className="relative flex items-center justify-center rounded-xl transition-all"
                  style={{
                    width: '360px',
                    height: '88px',
                    marginBottom: '0px',
                    backgroundColor: buttonPressed ? buttonPressedBg : buttonBgColor,
                    border: `4px solid ${buttonBorderColor}`,
                    borderRadius: '24px',
                    boxShadow: buttonPressed
                      ? 'inset 0 4px 8px rgba(0,0,0,0.15)'
                      : `0 8px 0 ${buttonBorderColor}, 0 12px 24px rgba(0,0,0,0.15)`,
                    transform: buttonPressed ? 'translateY(4px)' : 'translateY(0)',
                  }}
                >
                  <span
                    className="font-bold tracking-tight"
                    style={{
                      color: buttonTextColor,
                      fontFamily: 'Inter, sans-serif',
                      textShadow: '0 2px 0 rgba(255,255,255,0.3)',
                      fontSize: '2rem',
                    }}
                  >
                    {buttonText}
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
