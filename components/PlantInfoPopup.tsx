/**
 * Plant Info Popup - Shows plant information when tapping on barn shelves.
 * Simplified version of DiscoveryPopup without title or button.
 */
import React, { useCallback, useEffect, useState, useRef } from 'react';
import { assetPath } from '../utils/assetPath';
import { popupCardSurfaceStyle, usePopupPreflightEnter, type PopupAnimWithPreflight } from '../hooks/usePopupPreflightEnter';
import { PopupVectorBackground } from './PopupVectorBackground';
import { PlantWithPot } from './PlantWithPot';
import { formatCompactNumber } from '../utils/formatCompactNumber';

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

interface PlantInfoPopupProps {
  isVisible: boolean;
  onClose: () => void;
  plantLevel: number;
  plantName: string;
  plantDescription: string;
  isUnlocked: boolean;
  masteryPotUnlocked?: boolean;
  appScale?: number;
  /** When set, show purchase row (shed mastery unlock). */
  masteryUnlock?: {
    coinCost: number;
    canAfford: boolean;
    isUnlocked?: boolean;
    onPurchase: () => void;
  };
  /** Collection FTUE: no X, backdrop does not dismiss — player must use Golden Pot button. */
  restrictClose?: boolean;
}

const POPUP_LEAF_COUNT = 30;
const POPUP_LEAF_MIN_LIFETIME_MS = 250;
const POPUP_LEAF_MAX_LIFETIME_MS = 1000;
const POPUP_WIDTH = 280;
const POPUP_HEIGHT = 260;
const POPUP_LEAF_Y_OFFSET = -15;
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
      spawnY = -POPUP_HEIGHT / 2 + POPUP_LEAF_Y_OFFSET;
      outwardAngle = -Math.PI / 2 + (Math.random() - 0.5) * 0.8;
    } else if (pos < POPUP_WIDTH + POPUP_HEIGHT) {
      spawnX = POPUP_WIDTH / 2;
      spawnY = (pos - POPUP_WIDTH) - POPUP_HEIGHT / 2 + POPUP_LEAF_Y_OFFSET;
      outwardAngle = 0 + (Math.random() - 0.5) * 0.8;
    } else if (pos < 2 * POPUP_WIDTH + POPUP_HEIGHT) {
      spawnX = POPUP_WIDTH / 2 - (pos - POPUP_WIDTH - POPUP_HEIGHT);
      spawnY = POPUP_HEIGHT / 2 + POPUP_LEAF_Y_OFFSET;
      outwardAngle = Math.PI / 2 + (Math.random() - 0.5) * 0.8;
    } else {
      spawnX = -POPUP_WIDTH / 2;
      spawnY = POPUP_HEIGHT / 2 - (pos - 2 * POPUP_WIDTH - POPUP_HEIGHT) + POPUP_LEAF_Y_OFFSET;
      outwardAngle = Math.PI + (Math.random() - 0.5) * 0.8;
    }
    
    return {
      id: i,
      sprite: LEAF_SPRITES[i % LEAF_SPRITES.length],
      angle: outwardAngle,
      speed: Math.random() * 400,
      rotationSpeed: (Math.random() - 0.5) * 540,
      initialRotation: Math.random() * 360,
      size: 20 + Math.random() * 10,
      lifetime: POPUP_LEAF_MIN_LIFETIME_MS + Math.random() * (POPUP_LEAF_MAX_LIFETIME_MS - POPUP_LEAF_MIN_LIFETIME_MS),
      delay: 0,
      spawnX,
      spawnY,
    };
  });
}

export const PlantInfoPopup: React.FC<PlantInfoPopupProps> = ({
  isVisible,
  onClose,
  plantLevel,
  plantName,
  plantDescription,
  isUnlocked,
  masteryPotUnlocked = false,
  appScale = 1,
  masteryUnlock,
  restrictClose = false,
}) => {
  const [animState, setAnimState] = useState<PopupAnimWithPreflight>('hidden');
  const [assetsReady, setAssetsReady] = useState(false);
  const [masteryButtonPressed, setMasteryButtonPressed] = useState(false);
  const [leaves, setLeaves] = useState<LeafParticle[]>([]);
  const [leafPositions, setLeafPositions] = useState<{ x: number; y: number; opacity: number; rotation: number; scale: number }[]>([]);
  const [imgFailed, setImgFailed] = useState<Record<number, boolean>>({});
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

  // Leaf animation effect
  useEffect(() => {
    if (leaves.length === 0) return;
    
    const tick = () => {
      const elapsed = Date.now() - leafStartTimeRef.current;
      
      const allDone = leaves.every((leaf) => {
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
        const drag = 0.9;

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

  const handleClose = () => {
    if (animState === 'leaving' || animState === 'preflight') return;
    setAnimState('leaving');
    setTimeout(() => {
      setAnimState('hidden');
      onClose();
    }, POPUP_CLOSE_MS);
  };

  if (animState === 'hidden') return null;

  const isPreflight = animState === 'preflight';
  const isEntering = animState === 'entering';
  const isLeaving = animState === 'leaving';

  const subtitleColor = '#5c4a32';

  return (
    <div 
      className="fixed inset-0 flex items-center justify-center"
      style={{ zIndex: 100, overflow: 'hidden', paddingTop: 'clamp(28px, 5vh, 52px)', pointerEvents: isPreflight ? 'none' : 'auto' }}
      onClick={restrictClose ? undefined : handleClose}
    >
{/* Backdrop - not scaled, covers full screen */}
      <div
        className="absolute"
        style={{
          top: '-10px',
          left: '-10px',
          right: '-10px',
          bottom: '-10px',
          backgroundColor: 'rgba(0, 0, 0, 0.7)',
          opacity: isLeaving || isPreflight ? 0 : 1,
          transition: `opacity ${POPUP_CLOSE_MS}ms ease-out`,
          pointerEvents: restrictClose ? 'none' : 'auto',
        }}
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
        ref={popupCardLayoutRef}
        className="relative flex flex-col items-center"
        style={{ 
          width: '320px',
          zIndex: 102,
          ...popupCardSurfaceStyle(
            animState,
            isEntering,
            isLeaving,
            'plantInfoEnter 250ms ease-out forwards',
            `plantInfoLeave ${POPUP_CLOSE_MS}ms ease-in forwards`
          ),
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <style>{`
          @keyframes plantInfoEnter {
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
          @keyframes plantInfoLeave {
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
          {/* Plant + pot (shared stack, same center) */}
          <div
            className="relative flex items-center justify-center"
            style={{
              width: '94px',
              height: '94px',
              marginTop: '-4px',
              filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.2))',
            }}
          >
            <PlantWithPot level={isUnlocked ? plantLevel : 0} mastered={masteryPotUnlocked} wrapperClassName="h-full w-full" />
          </div>
        </div>

        {/* Background container */}
        <div 
          style={{ 
            position: 'relative',
            marginTop: '36px',
            width: '640px',
            transform: 'scale(0.5)',
            transformOrigin: 'top center',
            marginBottom: '-220px',
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
            {/* Content */}
            <div className="relative z-[2] flex flex-col items-center">
              {/* Subtitle - Plant Name */}
              <h3 
                className="font-black tracking-tight text-center"
                style={{ 
                  color: isUnlocked ? subtitleColor : '#666',
                  fontFamily: 'Inter, sans-serif',
                  marginTop: '-8px',
                  whiteSpace: 'nowrap',
                  width: 'fit-content',
                  maxWidth: '580px',
                  fontSize: `min(4.375rem, ${580 / ((isUnlocked ? plantName : '???').length * 0.6)}px)`,
                }}
              >
                {isUnlocked ? plantName : '???'}
              </h3>

              {/* Divider */}
              <div className="w-full flex items-center justify-center" style={{ marginTop: '8px', marginBottom: '24px' }}>
                <img 
                  src={assetPath('/assets/popups/popup_divider.png')} 
                  alt="" 
                  className="h-auto object-contain"
                  style={{ width: '520px' }}
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
                {isUnlocked ? plantDescription : 'Undiscovered plant. Keep merging to unlock!'}
              </p>

              {/* Spacer */}
              <div className="min-h-[24px]" />

              {masteryUnlock && isUnlocked && (
                <div className="w-full flex justify-center px-6" style={{ marginTop: '8px', marginBottom: '8px' }}>
                  {(() => {
                    const isMasteryUnlocked = masteryUnlock.isUnlocked === true;
                    const canAfford = masteryUnlock.canAfford;
                    const buttonBgColor = isMasteryUnlocked ? '#e3c28c' : (canAfford ? '#cae060' : '#e3c28c');
                    const buttonPressedBg = isMasteryUnlocked ? '#d4b27d' : (canAfford ? '#61882b' : '#d4b27d');
                    const buttonBorderColor = isMasteryUnlocked ? '#c7a36e' : (canAfford ? '#9db546' : '#c7a36e');
                    const buttonTextColor = isMasteryUnlocked ? '#a68e64' : (canAfford ? '#587e26' : '#a68e64');
                    return (
                  <button
                    type="button"
                    onMouseDown={() => canAfford && !isMasteryUnlocked && setMasteryButtonPressed(true)}
                    onMouseUp={() => setMasteryButtonPressed(false)}
                    onMouseLeave={() => setMasteryButtonPressed(false)}
                    onClick={(e) => {
                      e.stopPropagation();
                      setMasteryButtonPressed(false);
                      if (!canAfford || isMasteryUnlocked) return;
                      masteryUnlock.onPurchase();
                    }}
                    className="relative flex select-none items-center justify-center gap-3 rounded-xl font-bold tracking-tight transition-all"
                    style={{
                      minWidth: 460,
                      minHeight: 88,
                      paddingLeft: 36,
                      paddingRight: 36,
                      paddingTop: 14,
                      paddingBottom: 14,
                      boxSizing: 'border-box',
                      backgroundColor: masteryButtonPressed ? buttonPressedBg : buttonBgColor,
                      border: `4px solid ${buttonBorderColor}`,
                      borderRadius: '24px',
                      boxShadow: masteryButtonPressed
                        ? 'inset 0 4px 8px rgba(0,0,0,0.15)'
                        : `0 8px 0 ${buttonBorderColor}, 0 12px 24px rgba(0,0,0,0.15)`,
                      transform: masteryButtonPressed ? 'translateY(4px)' : 'translateY(0)',
                      color: buttonTextColor,
                      fontFamily: 'Inter, sans-serif',
                      fontSize: '2rem',
                      lineHeight: 1.1,
                      textShadow: '0 2px 0 rgba(255,255,255,0.3)',
                      cursor: canAfford && !isMasteryUnlocked ? 'pointer' : 'default',
                      opacity: 1,
                      WebkitTapHighlightColor: 'transparent',
                    }}
                  >
                    {isMasteryUnlocked ? (
                      <span>Golden Pot Aquired</span>
                    ) : (
                      <>
                        <span>Golden Pot</span>
                        <img
                          src={assetPath('/assets/icons/icon_coin.png')}
                          alt=""
                          className="object-contain shrink-0"
                          style={{ width: 40, height: 40 }}
                          draggable={false}
                        />
                        <span>{masteryUnlock.coinCost === 0 ? 'FREE' : formatCompactNumber(masteryUnlock.coinCost)}</span>
                      </>
                    )}
                  </button>
                    );
                  })()}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Close Button - X */}
        {!restrictClose && (
        <button
          onClick={handleClose}
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
