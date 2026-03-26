/**
 * Limited Offer Popup - Reusable popup component for rewarded ads and limited time offers.
 * Exact copy of DiscoveryPopup with different default title.
 * Features mobile game style show/hide animations with leaf burst VFX.
 * Uses 9-slice sprite scaling for the background.
 */
import React, { useEffect, useState, useRef } from 'react';
import { assetPath } from '../utils/assetPath';
import { PopupVectorBackground } from './PopupVectorBackground';
import { PlantWithPot } from './PlantWithPot';
import {
  REWARD_PILL_FILL_COLOR,
  REWARD_PILL_HEIGHT_PX,
  REWARD_PILL_STROKE_COLOR,
  REWARD_PILL_STROKE_WIDTH_PX,
} from './Reward';

const LEAF_SPRITES = [assetPath('/assets/vfx/particle_leaf_3.png'), assetPath('/assets/vfx/particle_leaf_4.png')];

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

interface LimitedOfferPopupProps {
  isVisible: boolean;
  onClose: () => void;
  title?: string;
  imageSrc: string;
  subtitle: string;
  description: string;
  buttonText: string;
  onButtonClick?: (buttonRect: DOMRect) => void;
  /** If false, button click only calls onButtonClick and does not close the popup (e.g. parent shows fake ad then closes) */
  closeOnButtonClick?: boolean;
  /** Called when X close button is clicked, with the accept button rect for particle origin */
  onCloseButtonClick?: (acceptButtonRect: DOMRect) => void;
  showCloseButton?: boolean;
  imageLevel?: number;
  /** When `imageLevel` is set, use mastered pot art variant. */
  imageMastered?: boolean;
  closeOnBackdropClick?: boolean;
  appScale?: number;
  /** When set, show "active boost" view: brown disabled-style button with "Active: XXs" countdown; button does nothing */
  activeBoostEndTime?: number;
  /** When set (and not null), show "Duration: X min" below description, above button. Null = hide duration section. */
  durationMinutes?: number | null;
  /** When set (and not null), show "Duration: Xs" (e.g. "90s"). Takes precedence over durationMinutes for display. */
  durationSeconds?: number | null;
  /** Double Coins: subtitle uses Settings popup title style (dark brown, 2.25rem black). */
  subtitleSettingsStyle?: boolean;
  /** Hide "Duration: …" block (e.g. Double Coins IAP). */
  hideOfferDurationBlock?: boolean;
}

/**
 * Active boost button countdown — at most two units:
 * ≥24h → day + hour; ≥1h → hour + min; ≥1m → min + sec; else seconds.
 */
function formatBoostTimeRemaining(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  if (s <= 0) return '0s';
  const DAY = 86400;
  const HOUR = 3600;
  const MIN = 60;
  if (s >= DAY) {
    const d = Math.floor(s / DAY);
    const h = Math.floor((s % DAY) / HOUR);
    return `${d}d ${h}h`;
  }
  if (s >= HOUR) {
    const h = Math.floor(s / HOUR);
    const m = Math.floor((s % HOUR) / MIN);
    return `${h}h ${m}m`;
  }
  if (s >= MIN) {
    const m = Math.floor(s / MIN);
    const sec = s % MIN;
    return `${m}m ${sec}s`;
  }
  return `${s}s`;
}

const POPUP_LEAF_COUNT = 40;
const POPUP_LEAF_MIN_LIFETIME_MS = 250;
const POPUP_LEAF_MAX_LIFETIME_MS = 1000;

// Popup dimensions for spawning leaves around the edge (slightly smaller than BG sprite so leaves start behind it)
const POPUP_WIDTH = 260;
const POPUP_HEIGHT = 320;

/** Panel + backdrop fade/shrink; keep in sync with CSS `popupLeave` duration and backdrop transition */
const POPUP_CLOSE_MS = 200;

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

export const LimitedOfferPopup: React.FC<LimitedOfferPopupProps> = ({
  isVisible,
  onClose,
  title = 'Limited Offer',
  imageSrc,
  subtitle,
  description,
  buttonText,
  onButtonClick,
  closeOnButtonClick = true,
  onCloseButtonClick,
  showCloseButton = true,
  imageLevel,
  imageMastered = false,
  closeOnBackdropClick = true,
  appScale = 1,
  activeBoostEndTime,
  durationMinutes,
  durationSeconds,
  subtitleSettingsStyle = false,
  hideOfferDurationBlock = false,
}) => {
  const [animState, setAnimState] = useState<'hidden' | 'entering' | 'visible' | 'leaving'>('hidden');
  const [assetsReady, setAssetsReady] = useState(false);
  const [leaves, setLeaves] = useState<LeafParticle[]>([]);
  const [leafPositions, setLeafPositions] = useState<{ x: number; y: number; opacity: number; rotation: number; scale: number }[]>([]);
  const [imgFailed, setImgFailed] = useState<Record<number, boolean>>({});
  const [buttonPressed, setButtonPressed] = useState(false);
  const [activeSecondsLeft, setActiveSecondsLeft] = useState<number>(0);
  const isActiveBoostView = activeBoostEndTime != null;

  // Countdown for active boost view (same as radial progress)
  useEffect(() => {
    if (!isActiveBoostView || !isVisible) return;
    const tick = () => {
      const remaining = Math.max(0, Math.ceil((activeBoostEndTime - Date.now()) / 1000));
      setActiveSecondsLeft(remaining);
    };
    tick();
    const id = setInterval(tick, 500);
    return () => clearInterval(id);
  }, [isActiveBoostView, isVisible, activeBoostEndTime]);
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

  const beginDismiss = (beforeLeave?: () => void) => {
    if (isClosing || animState === 'leaving') return;
    setIsClosing(true);
    beforeLeave?.();
    setAnimState('leaving');
    setTimeout(() => {
      setAnimState('hidden');
      onClose();
    }, POPUP_CLOSE_MS);
  };

  const handleButtonClick = () => {
    if (isActiveBoostView) return; // Active boost view: button does nothing
    if (onButtonClick && buttonRef.current) {
      onButtonClick(buttonRef.current.getBoundingClientRect());
    }
    if (closeOnButtonClick) {
      beginDismiss();
    }
  };

  if (animState === 'hidden') return null;

  const isEntering = animState === 'entering';
  const isLeaving = animState === 'leaving';

  // Colors for Limited Offer theme (orange/yellow)
  const subtitleColor = '#5c4a32'; // Dark brown for subtitle
  const descriptionColor = '#f59d42'; // Orange for description
  const buttonBgColor = isActiveBoostView ? '#e3c28c' : '#ffd856'; // Brown when active (same as upgrade "can't afford")
  const buttonBorderColor = isActiveBoostView ? '#c4a574' : '#f59d42';
  const buttonTextColor = isActiveBoostView ? '#a58854' : '#e6803a';
  const buttonPressedBg = isActiveBoostView ? '#e3c28c' : '#f0c840';
  // Header circle gradient: top #ffd856, bottom #f17d3f, outline #bd792c

  const showDurationPill =
    !isActiveBoostView &&
    !hideOfferDurationBlock &&
    ((durationSeconds != null && durationSeconds > 0) ||
      ((durationSeconds == null || durationSeconds <= 0) && durationMinutes != null && durationMinutes > 0));
  const durationPillLabel =
    durationSeconds != null && durationSeconds > 0
      ? `Duration: ${durationSeconds}s`
      : `Duration: ${durationMinutes} min`;

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
        onClick={closeOnBackdropClick ? () => {
          beginDismiss(() => {
            if (onCloseButtonClick && buttonRef.current) {
              onCloseButtonClick(buttonRef.current.getBoundingClientRect());
            }
          });
        } : undefined}
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
            src={assetPath('/assets/popups/popup_header_yellow.png')}
            alt=""
            className="absolute inset-0 w-full h-full object-contain"
            style={{ filter: 'drop-shadow(0 4px 12px rgba(0,0,0,0.25))' }}
          />
          {/* Plant / offer icon — if this is a plant offer, render PlantWithPot so pot is shown too. */}
          {typeof imageLevel === 'number' && imageLevel > 0 ? (
            <div
              className="relative"
              style={{
                width: subtitleSettingsStyle ? 88 : 78,
                height: subtitleSettingsStyle ? 98 : 88,
                marginTop: -6,
                filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.2))',
              }}
            >
              <PlantWithPot level={imageLevel} mastered={imageMastered} wrapperClassName="h-full w-full" />
            </div>
          ) : (
            <img
              src={imageSrc}
              alt=""
              className="relative object-contain"
              style={{
                width: subtitleSettingsStyle ? `${75 * 1.15}px` : '75px',
                height: subtitleSettingsStyle ? `${75 * 1.15}px` : '75px',
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
          {/* Title - "Limited Offer" */}
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

          {/* Subtitle — plant / offer name (Double Coins uses Settings title styling when flagged) */}
          {subtitle.trim().length > 0 && (
            <h3
              className="font-black tracking-tight text-center"
              style={
                subtitleSettingsStyle
                  ? {
                      color: '#5c4a32',
                      fontFamily: 'Inter, sans-serif',
                      marginTop: '-10px',
                      /* Inner panel uses scale(0.5); 4.5rem × 0.5 = Settings’ 2.25rem visually */
                      fontSize: '4.5rem',
                    }
                  : {
                      color: subtitleColor,
                      fontFamily: 'Inter, sans-serif',
                      marginTop: '-8px',
                      whiteSpace: 'nowrap',
                      width: 'fit-content',
                      maxWidth: '580px',
                      fontSize: `min(4.375rem, ${580 / Math.max(1, subtitle.length * 0.6)}px)`,
                    }
              }
            >
              {subtitle}
            </h3>
          )}

{/* Divider */}
          <div className="w-full flex items-center justify-center" style={{ marginTop: '8px', marginBottom: '24px' }}>
            <img
              src={assetPath('/assets/popups/popup_divider_yellow.png')}
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
              color: descriptionColor,
              fontFamily: 'Inter, sans-serif',
              paddingLeft: '24px',
              paddingRight: '24px',
              fontSize: '2rem',
            }}
          >
            {description}
          </p>

          {/* Duration — discovery coin-reward pill shape, no icon (brown text = reward line color). */}
          {showDurationPill && (
            <div className="flex items-center justify-center w-full" style={{ marginTop: '20px' }}>
              <div
                className="inline-flex items-center justify-center box-border rounded-full"
                style={{
                  backgroundColor: REWARD_PILL_FILL_COLOR,
                  border: `${REWARD_PILL_STROKE_WIDTH_PX * 2}px solid ${REWARD_PILL_STROKE_COLOR}`,
                  minHeight: `${REWARD_PILL_HEIGHT_PX * 2}px`,
                  paddingTop: 12,
                  paddingBottom: 12,
                  paddingLeft: 24,
                  paddingRight: 24,
                }}
              >
                <span
                  className="font-semibold tracking-tight text-center"
                  style={{
                    color: '#a28267',
                    fontFamily: 'Inter, sans-serif',
                    fontSize: '2rem',
                    lineHeight: 1,
                  }}
                >
                  {durationPillLabel}
                </span>
              </div>
            </div>
          )}

          {/* Spacer */}
          <div className="flex-grow min-h-[48px]" />

{/* Action Button - normal "Watch Ad" or active boost "Active: XXs" (non-clickable) */}
          <button
            ref={buttonRef}
            type="button"
            onMouseDown={() => !isActiveBoostView && setButtonPressed(true)}
            onMouseUp={() => setButtonPressed(false)}
            onMouseLeave={() => setButtonPressed(false)}
            onClick={handleButtonClick}
            className="relative flex items-center justify-center gap-3 rounded-xl transition-all"
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
              cursor: isActiveBoostView ? 'default' : 'pointer',
            }}
          >
            {!isActiveBoostView && (
              <img
                src={assetPath('/assets/icons/icon_watchad.png')}
                alt=""
                style={{
                  width: '60px',
                  height: '60px',
                  objectFit: 'contain',
                  marginLeft: '-8px',
                  filter: 'brightness(0) saturate(100%) invert(56%) sepia(67%) saturate(1000%) hue-rotate(346deg) brightness(97%) contrast(88%)',
                }}
              />
            )}
            <span
              className="font-bold tracking-tight"
              style={{
                color: buttonTextColor,
                fontFamily: 'Inter, sans-serif',
                textShadow: isActiveBoostView ? 'none' : '0 2px 0 rgba(255,255,255,0.3)',
                fontSize: '2rem',
              }}
            >
              {isActiveBoostView ? `Active: ${formatBoostTimeRemaining(activeSecondsLeft)}` : buttonText}
            </span>
          </button>
            </div>
          </div>
        </div>

{/* Close Button */}
        {showCloseButton && (
          <button
            onClick={() => {
              beginDismiss(() => {
                if (onCloseButtonClick && buttonRef.current) {
                  onCloseButtonClick(buttonRef.current.getBoundingClientRect());
                }
              });
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
        )}
      </div>
      </div>
    </div>
  );
};
