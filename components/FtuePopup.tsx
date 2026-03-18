/**
 * FTUE Popup - Same look as other popups; optional header, title, divider, description, button.
 * Leaf burst is sized to the popup. When blockBackdropClick is true, only the primary button is clickable.
 */
import React, { useEffect, useState, useRef } from 'react';
import { assetPath } from '../utils/assetPath';

const LEAF_SPRITES = [assetPath('/assets/vfx/particle_leaf_1.png'), assetPath('/assets/vfx/particle_leaf_2.png')];

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

const POPUP_LEAF_COUNT = 40;
const POPUP_LEAF_MIN_LIFETIME_MS = 250;
const POPUP_LEAF_MAX_LIFETIME_MS = 1000;

function createPopupLeaves(width: number, height: number): LeafParticle[] {
  const halfW = width / 2;
  const halfH = height / 2;
  const perimeter = 2 * (width + height);
  return Array.from({ length: POPUP_LEAF_COUNT }, (_, i) => {
    const pos = (i / POPUP_LEAF_COUNT) * perimeter + Math.random() * 40;
    let spawnX: number;
    let spawnY: number;
    let outwardAngle: number;
    if (pos < width) {
      spawnX = pos - halfW;
      spawnY = -halfH;
      outwardAngle = -Math.PI / 2 + (Math.random() - 0.5) * 0.8;
    } else if (pos < width + height) {
      spawnX = halfW;
      spawnY = pos - width - halfH;
      outwardAngle = (Math.random() - 0.5) * 0.8;
    } else if (pos < 2 * width + height) {
      spawnX = halfW - (pos - width - height);
      spawnY = halfH;
      outwardAngle = Math.PI / 2 + (Math.random() - 0.5) * 0.8;
    } else {
      spawnX = -halfW;
      spawnY = halfH - (pos - 2 * width - height);
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

export interface FtuePopupProps {
  isVisible: boolean;
  onClose: () => void;
  /** When true, backdrop and rest of screen are not clickable; only the primary button works */
  blockBackdropClick?: boolean;
  /** Header: show circle with icon (e.g. happy customer) */
  header?: { icon: string };
  /** Popup title (e.g. "Welcome Gardener!") */
  title?: string;
  /** Green divider below title */
  showDivider?: boolean;
  /** Description text (shown when descriptionVisibility is 'shown') */
  description?: string;
  /** Primary button; clicking closes popup */
  button?: { text: string };
  /** Leaf burst is sized to this rect so it matches the popup */
  burstWidth?: number;
  burstHeight?: number;
  appScale?: number;
}

/** Match Plant Discovery popup: main title = dark brown (plant name style); description = light beige */
const mainTitleColor = '#5c4a32'; // Dark brown – same as Discovery "plant name"
const descriptionColor = '#c2b280'; // Light beige – same as Discovery description
const buttonBgColor = '#b8d458';
const buttonBorderColor = '#8fb33a';
const buttonTextColor = '#4a6b1e';
const buttonPressedBg = '#9fc044';

/** Same as DiscoveryPopup leaf burst so it matches */
const DEFAULT_BURST_WIDTH = 260;
const DEFAULT_BURST_HEIGHT = 320;

export const FtuePopup: React.FC<FtuePopupProps> = ({
  isVisible,
  onClose,
  blockBackdropClick = true,
  header,
  title,
  showDivider = false,
  description,
  button,
  burstWidth = DEFAULT_BURST_WIDTH,
  burstHeight = DEFAULT_BURST_HEIGHT,
  appScale = 1,
}) => {
  const [animState, setAnimState] = useState<'hidden' | 'entering' | 'visible' | 'leaving'>('hidden');
  const [assetsReady, setAssetsReady] = useState(false);
  const [leaves, setLeaves] = useState<LeafParticle[]>([]);
  const [leafPositions, setLeafPositions] = useState<{ x: number; y: number; opacity: number; rotation: number; scale: number }[]>([]);
  const [imgFailed, setImgFailed] = useState<Record<number, boolean>>({});
  const [buttonPressed, setButtonPressed] = useState(false);
  const leafRafRef = useRef<number>(0);
  const leafStartTimeRef = useRef<number>(0);
  const leafPosRef = useRef<{ x: number; y: number; vx: number; vy: number; opacity: number; rotation: number; scale: number; started: boolean }[]>([]);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!isVisible) {
      setAssetsReady(false);
      return;
    }
    const bgImg = new Image();
    bgImg.src = assetPath('/assets/popups/popup_background.png?v=2');
    if (bgImg.complete) setAssetsReady(true);
    else {
      bgImg.onload = () => setAssetsReady(true);
      bgImg.onerror = () => setAssetsReady(true);
    }
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
      const newLeaves = createPopupLeaves(burstWidth, burstHeight);
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
      }, 150);
    }
  }, [isVisible, assetsReady, animState, onClose, burstWidth, burstHeight]);

  const handleButtonClick = () => {
    setAnimState('leaving');
    setTimeout(() => {
      setAnimState('hidden');
      onClose();
    }, 150);
  };

  if (animState === 'hidden') return null;

  const isEntering = animState === 'entering';
  const isLeaving = animState === 'leaving';

  return (
    <div
      className="absolute inset-0 flex items-center justify-center pointer-events-auto"
      style={{ zIndex: 100, overflow: 'hidden' }}
    >
      <div
        className="absolute transition-opacity duration-300"
        style={{
          top: '-10px',
          left: '-10px',
          right: '-10px',
          bottom: '-10px',
          backgroundColor: 'rgba(0, 0, 0, 0.7)',
          opacity: isLeaving ? 0 : 1,
        }}
        onClick={blockBackdropClick ? undefined : onClose}
      />

      <div
        className="relative flex items-center justify-center"
        style={{ transform: `scale(${appScale})`, transformOrigin: 'center center' }}
      >
        {/* Leaf burst - sized to popup */}
        {(isEntering || animState === 'visible') && leaves.length > 0 && (
          <div
            className="absolute pointer-events-none"
            style={{ left: '50%', top: '50%', width: 1, height: 1, transform: 'translate(-50%, -50%)', zIndex: 101 }}
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
                  <div className="w-full h-full rounded-sm" style={{ background: 'linear-gradient(135deg, #4a7c23 0%, #6b8e23 100%)' }} />
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

        {/* Popup card - same style as DiscoveryPopup */}
        <div
          className="relative flex flex-col items-center"
          style={{
            width: '320px',
            zIndex: 102,
            animation: isEntering ? 'ftuePopupEnter 250ms ease-out forwards' : isLeaving ? 'ftuePopupLeave 150ms ease-in forwards' : 'none',
            transform: animState === 'visible' ? 'scale(1)' : undefined,
            opacity: animState === 'visible' ? 1 : undefined,
          }}
        >
          <style>{`
            @keyframes ftuePopupEnter {
              0% { transform: scale(0.9); opacity: 0; }
              70% { transform: scale(1.05); opacity: 1; }
              100% { transform: scale(1); opacity: 1; }
            }
            @keyframes ftuePopupLeave {
              0% { transform: scale(1); opacity: 1; }
              100% { transform: scale(0.9); opacity: 0; }
            }
          `}</style>

          {/* Header circle – same as Plant Discovery: 120px, icon 94px */}
          {header && (
            <div
              className="absolute left-1/2 -translate-x-1/2 flex items-center justify-center"
              style={{ width: '120px', height: '120px', top: '-20px', zIndex: 104 }}
            >
              <img
                src={assetPath('/assets/popups/popup_header.png')}
                alt=""
                className="absolute inset-0 w-full h-full object-contain"
                style={{ filter: 'drop-shadow(0 4px 12px rgba(0,0,0,0.25))' }}
              />
              <img
                src={header.icon}
                alt=""
                className="relative object-contain"
                style={{
                  width: '80px',
                  height: '80px',
                  filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.2))',
                  marginTop: '-4px',
                }}
              />
            </div>
          )}

          {/* Background container – same layout as DiscoveryPopup: 640px scale 0.5, padding 150/40/60 */}
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
                backgroundImage: `url(${assetPath('/assets/popups/popup_background.png?v=2')})`,
                backgroundSize: '100% 100%',
                backgroundPosition: 'center',
                backgroundRepeat: 'no-repeat',
                filter: 'drop-shadow(0 16px 48px rgba(0,0,0,0.3))',
                padding: header ? '150px 40px 60px 40px' : '80px 40px 60px 40px',
              }}
            >
              <div className="flex flex-col items-center">
                {/* No "New Discovery" line – main title only, in plant-name style (dark brown, large, bold) */}
                {title && (
                  <h3
                    className="font-black tracking-tight text-center whitespace-nowrap"
                    style={{
                      color: mainTitleColor,
                      fontFamily: 'Inter, sans-serif',
                      maxWidth: '580px',
                      fontSize: '3rem',
                    }}
                  >
                    {title}
                  </h3>
                )}

                {/* Divider – same green leaf icon as Discovery */}
                {showDivider && (
                  <div className="w-full flex items-center justify-center" style={{ marginTop: '8px', marginBottom: '24px' }}>
                    <img
                      src={assetPath('/assets/popups/popup_divider.png')}
                      alt=""
                      className="h-auto object-contain"
                      style={{ width: '520px' }}
                    />
                  </div>
                )}

                {/* Description – same as Discovery: light beige, italic, 2rem */}
                {description && (
                  <p
                    className="font-medium text-center leading-relaxed italic w-full"
                    style={{
                      color: descriptionColor,
                      fontFamily: 'Inter, sans-serif',
                      paddingLeft: '24px',
                      paddingRight: '24px',
                      fontSize: '2rem',
                    }}
                  >
                    {description}
                  </p>
                )}

                <div className="flex-grow min-h-[48px]" />

                {/* Action button – same as Discovery: 360x88, green */}
                {button && (
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
                      {button.text}
                    </span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
