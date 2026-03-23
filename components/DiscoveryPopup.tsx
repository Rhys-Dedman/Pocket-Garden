/**
 * Discovery Popup - Reusable popup component for plant discoveries and other announcements.
 * Features mobile game style show/hide animations with leaf burst VFX.
 * Uses 9-slice sprite scaling for the background.
 */
import React, { useEffect, useState, useRef } from 'react';
import { assetPath } from '../utils/assetPath';
import { PopupVectorBackground } from './PopupVectorBackground';
import { PlantWithPot } from './PlantWithPot';
import {
  REWARD_OFFER_LINE_TEXT_COLOR,
  REWARD_PILL_FILL_COLOR,
  REWARD_PILL_HEIGHT_PX,
  REWARD_PILL_STROKE_COLOR,
  REWARD_PILL_STROKE_WIDTH_PX,
} from './Reward';

const LEAF_SPRITES = [assetPath('/assets/vfx/particle_leaf_1.png'), assetPath('/assets/vfx/particle_leaf_2.png')];

/** Coin icon in scaled panel — 15% larger than prior 40px (pre-scale coords). */
const DISCOVERY_COIN_REWARD_ICON_PX = Math.round(40 * 1.15);

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

interface DiscoveryPopupProps {
  isVisible: boolean;
  onClose: () => void;
  title: string;
  imageSrc: string;
  subtitle: string;
  description: string;
  buttonText: string;
  rewardAmount?: number;
  onButtonClick?: (startPoint: { x: number; y: number }) => void;
  showCloseButton?: boolean;
  imageLevel?: number;
  closeOnBackdropClick?: boolean;
  appScale?: number;
}

const POPUP_LEAF_COUNT = 40;
const POPUP_LEAF_MIN_LIFETIME_MS = 250;
const POPUP_LEAF_MAX_LIFETIME_MS = 1000;
const POPUP_CLOSE_MS = 200;

// Popup dimensions for spawning leaves around the edge (slightly smaller than BG sprite so leaves start behind it)
const POPUP_WIDTH = 260;
const POPUP_HEIGHT = 320;

function createPopupLeaves(): LeafParticle[] {
  return Array.from({ length: POPUP_LEAF_COUNT }, (_, i) => {
    // Spawn leaves around the rectangle edge of the popup
    const perimeter = 2 * (POPUP_WIDTH + POPUP_HEIGHT);
    const pos = (i / POPUP_LEAF_COUNT) * perimeter + Math.random() * 40;
    
    let spawnX: number;
    let spawnY: number;
    let outwardAngle: number;
    
    if (pos < POPUP_WIDTH) {
      // Top edge
      spawnX = pos - POPUP_WIDTH / 2;
      spawnY = -POPUP_HEIGHT / 2;
      outwardAngle = -Math.PI / 2 + (Math.random() - 0.5) * 0.8; // Upward
    } else if (pos < POPUP_WIDTH + POPUP_HEIGHT) {
      // Right edge
      spawnX = POPUP_WIDTH / 2;
      spawnY = (pos - POPUP_WIDTH) - POPUP_HEIGHT / 2;
      outwardAngle = 0 + (Math.random() - 0.5) * 0.8; // Rightward
    } else if (pos < 2 * POPUP_WIDTH + POPUP_HEIGHT) {
      // Bottom edge
      spawnX = POPUP_WIDTH / 2 - (pos - POPUP_WIDTH - POPUP_HEIGHT);
      spawnY = POPUP_HEIGHT / 2;
      outwardAngle = Math.PI / 2 + (Math.random() - 0.5) * 0.8; // Downward
    } else {
      // Left edge
      spawnX = -POPUP_WIDTH / 2;
      spawnY = POPUP_HEIGHT / 2 - (pos - 2 * POPUP_WIDTH - POPUP_HEIGHT);
      outwardAngle = Math.PI + (Math.random() - 0.5) * 0.8; // Leftward
    }
    
    return {
      id: i,
      sprite: LEAF_SPRITES[i % LEAF_SPRITES.length],
      angle: outwardAngle,
      speed: Math.random() * 600, // 0 to 600 - wide variety of speeds
      rotationSpeed: (Math.random() - 0.5) * 540,
      initialRotation: Math.random() * 360,
      size: 20 + Math.random() * 20, // 20-40px
      lifetime: POPUP_LEAF_MIN_LIFETIME_MS + Math.random() * (POPUP_LEAF_MAX_LIFETIME_MS - POPUP_LEAF_MIN_LIFETIME_MS),
      delay: 0, // All leaves shoot out at the same time
      spawnX,
      spawnY,
    };
  });
}

/**
 * PopupBackground component - renders a popup background sprite stretched to fit
 */
interface NineSliceProps {
  src: string;
  children?: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

const NineSlice: React.FC<NineSliceProps> = ({ 
  src, 
  children, 
  className, 
  style,
}) => {
  return (
    <div 
      className={className}
      style={{
        position: 'relative',
        ...style,
      }}
    >
      {/* Background sprite - scaled to match mockup proportions */}
      <img 
        src={src}
        alt=""
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: '340px',
          height: '340px',
          zIndex: -1,
          pointerEvents: 'none',
        }}
      />
      {children}
    </div>
  );
};

export const DiscoveryPopup: React.FC<DiscoveryPopupProps> = ({
  isVisible,
  onClose,
  title,
  imageSrc,
  subtitle,
  description,
  buttonText,
  rewardAmount = 1000,
  onButtonClick,
  showCloseButton = true,
  imageLevel,
  closeOnBackdropClick = true,
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

  useEffect(() => {
    if (!isVisible) {
      setAssetsReady(false);
      return;
    }
    setAssetsReady(true);
  }, [isVisible]);

  // Separate effect for leaf animation - runs independently of popup state
  useEffect(() => {
    if (leaves.length === 0) return;
    
    const tick = () => {
      const elapsed = Date.now() - leafStartTimeRef.current;
      
      // Check if all leaves are done
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
        const drag = 0.92; // Higher drag - slows down hard after initial burst

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

  // Popup visibility effect - waits for assets to be ready
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
        started: false 
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
  const buttonRef = useRef<HTMLButtonElement>(null);
  const rewardCoinRef = useRef<HTMLImageElement>(null);

  const dismissWithoutCollect = () => {
    if (isClosing || animState === 'leaving') return;
    setIsClosing(true);
    setAnimState('leaving');
    setTimeout(() => {
      setAnimState('hidden');
      onClose();
    }, POPUP_CLOSE_MS);
  };

  const handleButtonClick = () => {
    if (isClosing) return;
    setIsClosing(true);
    if (onButtonClick) {
      if (rewardCoinRef.current) {
        const r = rewardCoinRef.current.getBoundingClientRect();
        onButtonClick({ x: r.left + r.width / 2, y: r.top + r.height / 2 });
      } else if (buttonRef.current) {
        const r = buttonRef.current.getBoundingClientRect();
        onButtonClick({ x: r.left + r.width / 2, y: r.top + r.height / 2 });
      }
    }
    setAnimState('leaving');
    setTimeout(() => {
      setAnimState('hidden');
      onClose();
    }, POPUP_CLOSE_MS);
  };

  if (animState === 'hidden') return null;

  const isEntering = animState === 'entering';
  const isLeaving = animState === 'leaving';

  // Colors from reference
  const titleColor = '#7a7a6a'; // Muted gray-brown for "New Discovery"
  const subtitleColor = '#5c4a32'; // Dark brown for plant name
  const descTextColor = '#9a9a88'; // Light gray-brown for description
  const buttonBgColor = '#b8d458'; // Bright lime green
  const buttonBorderColor = '#8fb33a'; // Darker green border
  const buttonTextColor = '#4a6b1e'; // Dark green text
  const buttonPressedBg = '#9fc044';

  return (
    <div 
      className="fixed inset-0 flex items-center justify-center pointer-events-auto"
      style={{ zIndex: 100, overflow: 'hidden', paddingTop: 'clamp(28px, 5vh, 52px)' }}
    >
{/* Backdrop - not scaled, covers full screen */}
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
        onClick={closeOnBackdropClick ? dismissWithoutCollect : undefined}
      />

      {/* Scaled content wrapper */}
      <div
        className="relative flex items-center justify-center"
        style={{
          transform: `scale(${appScale})`,
          transformOrigin: 'center center',
        }}
      >

      {/* Leaf Burst VFX */}
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
                  onError={() => setImgFailed(prev => ({ ...prev, [i]: true }))}
                />
              )}
            </div>
          ))}
        </div>
      )}

      {/* Popup Container - centered on screen with fixed dimensions */}
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
            0% {
              transform: scale(0.9);
              opacity: 0;
            }
            70% {
              transform: scale(1.05);
              opacity: 1;
            }
            100% {
              transform: scale(1);
              opacity: 1;
            }
          }
          @keyframes popupLeave {
            0% {
              transform: scale(1);
              opacity: 1;
            }
            100% {
              transform: scale(0.9);
              opacity: 0;
            }
          }
        `}</style>
        {/* Header Circle - positioned to overlap top of popup */}
        <div 
          className="absolute left-1/2 -translate-x-1/2 flex items-center justify-center"
          style={{ 
            width: '120px',
            height: '120px',
            top: '-20px',
            zIndex: 104,
          }}
        >
          {/* Header background sprite */}
          <img 
            src={assetPath('/assets/popups/popup_header.png')} 
            alt="" 
            className="absolute inset-0 w-full h-full object-contain"
            style={{ filter: 'drop-shadow(0 4px 12px rgba(0,0,0,0.25))' }}
          />
          {/* Plant discovery art: pot + plant when level known; else legacy single image */}
          {imageLevel != null ? (
            <div
              className="relative flex items-center justify-center"
              style={{
                width: '94px',
                height: '94px',
                marginTop: '-4px',
                filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.2))',
              }}
            >
              <PlantWithPot
                level={Math.max(1, Math.min(24, imageLevel))}
                wrapperClassName="h-full w-full"
              />
            </div>
          ) : (
            <img
              src={imageSrc}
              alt=""
              className="relative object-contain"
              style={{
                width: '94px',
                height: '94px',
                filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.2))',
                marginTop: '-4px',
              }}
            />
          )}
        </div>

        {/* Background container - uses transform scale trick for sharper rendering */}
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
            {/* Content - doubled sizes since container is scaled 0.5x */}
            <div
              className="relative z-[2] flex flex-col items-center"
            >
          {/* Title - "New Discovery" */}
          <h2 
            className="font-normal text-center"
            style={{ 
              color: '#c2b280',
              fontFamily: 'Inter, sans-serif',
              letterSpacing: '-0.02em',
              fontSize: '2.25rem',
            }}
          >
            {title}
          </h2>

          {/* Subtitle - Plant Name - auto-scales to fit on one line */}
          <h3 
            className="font-black tracking-tight text-center"
            style={{ 
              color: subtitleColor,
              fontFamily: 'Inter, sans-serif',
              marginTop: '-8px',
              whiteSpace: 'nowrap',
              width: 'fit-content',
              maxWidth: '580px',
              fontSize: `min(4.375rem, ${580 / (subtitle.length * 0.6)}px)`,
            }}
          >
            {subtitle}
          </h3>

          {/* Divider */}
          <div className="w-full flex items-center justify-center" style={{ marginTop: '8px', marginBottom: '24px' }}>
            <img 
              src={assetPath('/assets/popups/popup_divider.png')} 
              alt="" 
              className="h-auto object-contain"
              style={{ 
                width: '520px',
              }}
            />
          </div>

          {/* Description */}
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
            {description}
          </p>

          {/* Discovery coin cost row */}
          <div
            className="flex items-center justify-center"
            style={{ marginTop: '20px' }}
          >
            <div
              className="inline-flex items-center justify-center box-border rounded-full"
              style={{
                backgroundColor: REWARD_PILL_FILL_COLOR,
                border: `${REWARD_PILL_STROKE_WIDTH_PX * 2}px solid ${REWARD_PILL_STROKE_COLOR}`,
                minHeight: `${REWARD_PILL_HEIGHT_PX * 2}px`,
                paddingTop: 12,
                paddingBottom: 12,
                paddingLeft: 20,
                paddingRight: 31,
                gap: '10px',
              }}
            >
              <img
                ref={rewardCoinRef}
                src={assetPath('/assets/icons/icon_coin_small.png')}
                alt=""
                className="object-contain shrink-0"
                style={{ width: `${DISCOVERY_COIN_REWARD_ICON_PX}px`, height: `${DISCOVERY_COIN_REWARD_ICON_PX}px` }}
              />
              <span
                className="font-black tracking-tight"
                style={{
                  color: REWARD_OFFER_LINE_TEXT_COLOR,
                  fontFamily: 'Inter, sans-serif',
                  fontSize: '2rem',
                  lineHeight: 1,
                }}
              >
                {rewardAmount}
              </span>
            </div>
          </div>

          {/* Spacer */}
          <div className="flex-grow min-h-[40px]" />

          {/* Action Button */}
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
                : '0 8px 0 ' + buttonBorderColor + ', 0 12px 24px rgba(0,0,0,0.15)',
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

        {/* Close Button */}
        {showCloseButton && (
          <button
            onClick={dismissWithoutCollect}
            className="absolute top-[44px] right-3 w-8 h-8 flex items-center justify-center transition-all hover:scale-110 active:scale-95"
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
        )}
      </div>
      </div>
    </div>
  );
};
