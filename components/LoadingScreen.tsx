import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { assetPath } from '../utils/assetPath';
import { preloadSfxAssets } from '../utils/sfx';

interface LoadingScreenProps {
  onLoadComplete: () => void;
  /** Returning player: skip splash, black screen while preloading then fade out. */
  variant?: 'splash' | 'quick';
  /** Called when quick preload finishes, before black fades (hydrate game under overlay). */
  onQuickResumeHydrate?: () => void;
}

const DESIGN_WIDTH = 448;
const DESIGN_HEIGHT = 796;

const ASSETS_TO_PRELOAD = [
  // Plants (discovery + grid); plant_0 unused — pot-only when undiscovered
  ...Array.from({ length: 24 }, (_, i) => `/assets/plants/plant_${i + 1}.png`),
  '/assets/plants/plant_pot.png',
  // Goal icons (orders/discovery goals – preload all so new goals don’t load images on demand)
  ...Array.from({ length: 24 }, (_, i) => `/assets/icons/icons_goals/icon_goal_${i + 1}.png`),
  // Icons
  '/assets/icons/icon_barn.png',
  '/assets/icons/icon_farm.png',
  '/assets/icons/icon_market.png',
  '/assets/icons/icon_coin.png',
  '/assets/icons/icon_harvest.png',
  '/assets/icons/icon_watchad.png',
  '/assets/icons/icon_watchad_large.png',
  '/assets/icons/icon_coin_watchad.png',
  '/assets/icons/icon_logo.png',
  '/assets/icons/icon_level.png',
  '/assets/icons/icon_lock.png',
  '/assets/icons/icon_seedstorm.png',
  '/assets/icons/icon_seedproduction.png',
  '/assets/icons/icon_seedquality.png',
  '/assets/icons/icon_seedstorage.png',
  '/assets/icons/icon_seedsurplus.png',
  '/assets/icons/icon_luckyseed.png',
  '/assets/icons/icon_cropmerge.png',
  '/assets/icons/icon_plotexpansion.png',
  '/assets/icons/icon_mergeharvest.png',
  '/assets/icons/icon_fetilesoil.png',
  '/assets/icons/icon_luckymerge.png',
  '/assets/icons/icon_harvestspeed.png',
  '/assets/icons/icon_cropvalue.png',
  '/assets/icons/icon_harvestboost.png',
  '/assets/icons/icon_cropsynergy.png',
  '/assets/icons/icon_luckyharvest.png',
  '/assets/icons/icon_limitedoffer_harvestspeed.png',
  '/assets/icons/icon_customerspeed.png',
  '/assets/icons/icon_marketvalue.png',
  '/assets/icons/icon_surplussales.png',
  '/assets/icons/icon_happycustomer.png',
  '/assets/icons/icon_premiumorders.png',
  // Hex cells
  '/assets/hex/hexcell_green.png',
  '/assets/hex/hexcell_locked.png',
  '/assets/hex/hexcell_fertile.png',
  '/assets/hex/hexcell_highlight.png',
  // Backgrounds
  '/assets/background/background_barn.png',
  '/assets/background/background_loading.png',
  '/assets/background/background_grass.png',
  // Top UI
  '/assets/topui/topui_bg.png',
  '/assets/topui/topui_gradient.png',
  // Barn
  '/assets/barn/barn_shelf.png',
  '/assets/barn/barn_roof.png',
  '/assets/barn/barn_tools.png',
  // Goal slot sprites
  '/assets/goals/goal_shadow.png',
  '/assets/goals/goal_loading.png',
  '/assets/goals/goal_green.png',
  '/assets/goals/goal_yellow.png',
  '/assets/goals/goal_lightgreen.png',
  '/assets/goals/goal_cream.png',
  '/assets/goals/goal_white.png',
  // Popups
  '/assets/popups/popup_header.png',
  '/assets/popups/popup_header_yellow.png',
  '/assets/popups/popup_header_blue.png',
  '/assets/popups/popup_divider.png',
  '/assets/popups/popup_divider_yellow.png',
  '/assets/popups/popup_divider_blue.png',
  // VFX (all leaf variants for popups + bursts)
  '/assets/vfx/particle_leaf_1.png',
  '/assets/vfx/particle_leaf_2.png',
  '/assets/vfx/particle_leaf_3.png',
  '/assets/vfx/particle_leaf_4.png',
  '/assets/vfx/particle_leaf_5.png',
  '/assets/vfx/particle_leaf_6.png',
  '/assets/vfx/particle_leaf_7.png',
  '/assets/vfx/particle_leaf_8.png',
];

export const LoadingScreen: React.FC<LoadingScreenProps> = ({
  onLoadComplete,
  variant = 'splash',
  onQuickResumeHydrate,
}) => {
  const [progress, setProgress] = useState(0);
  const [phase, setPhase] = useState<'boot' | 'fadeIn' | 'loading' | 'ready' | 'fadeOut' | 'quickFade' | 'done'>(() =>
    variant === 'quick' ? 'loading' : 'boot'
  );
  const [blackOpacity, setBlackOpacity] = useState(1);
  const [viewportSize, setViewportSize] = useState({ width: window.innerWidth, height: window.innerHeight });

  // Calculate scale to fit 9:16 container in viewport
  const appScale = useMemo(() => {
    const scaleX = viewportSize.width / DESIGN_WIDTH;
    const scaleY = viewportSize.height / DESIGN_HEIGHT;
    return Math.min(scaleX, scaleY);
  }, [viewportSize]);

  // Listen for viewport resize
  useEffect(() => {
    const handleResize = () => {
      setViewportSize({ width: window.innerWidth, height: window.innerHeight });
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const preloadCriticalSplashAssets = useCallback(async () => {
    const critical = [
      '/assets/background/background_loading.png',
      '/assets/icons/icon_logo.png',
    ];
    const loadImage = (src: string): Promise<void> =>
      new Promise((resolve) => {
        const img = new Image();
        img.onload = () => resolve();
        img.onerror = () => resolve();
        img.src = assetPath(src);
      });
    await Promise.all(critical.map(loadImage));
  }, []);

  const preloadAssets = useCallback(async () => {
    const total = ASSETS_TO_PRELOAD.length;
    let loaded = 0;

    const loadImage = (src: string): Promise<void> => {
      return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
          loaded++;
          setProgress(Math.min(99, Math.round((loaded / total) * 100)));
          resolve();
        };
        img.onerror = () => {
          loaded++;
          setProgress(Math.min(99, Math.round((loaded / total) * 100)));
          resolve();
        };
        img.src = assetPath(src);
      });
    };

    await Promise.all([
      Promise.all(ASSETS_TO_PRELOAD.map(loadImage)),
      preloadSfxAssets(),
    ]);
    if (variant === 'quick') {
      setPhase('quickFade');
    } else {
      setProgress(100);
      setPhase('ready');
    }
  }, [variant]);

  useEffect(() => {
    if (variant === 'quick') return;
    if (phase === 'boot') {
      void preloadCriticalSplashAssets().then(() => {
        setPhase('fadeIn');
      });
      return;
    }
    if (phase === 'fadeIn') {
      const fadeInDuration = 500;
      const startTime = Date.now();
      
      const animate = () => {
        const elapsed = Date.now() - startTime;
        const newOpacity = Math.max(0, 1 - elapsed / fadeInDuration);
        setBlackOpacity(newOpacity);
        
        if (elapsed < fadeInDuration) {
          requestAnimationFrame(animate);
        } else {
          setBlackOpacity(0);
          setPhase('loading');
        }
      };
      
      requestAnimationFrame(animate);
    }
  }, [phase, variant, preloadCriticalSplashAssets]);

  const quickFadeStartedRef = useRef(false);
  // Quick resume: fade black out then hand off to App (dismiss loading + fade game in)
  useEffect(() => {
    if (phase !== 'quickFade') return;
    if (quickFadeStartedRef.current) return;
    quickFadeStartedRef.current = true;
    setBlackOpacity(1);
    onQuickResumeHydrate?.();
    const fadeMs = 340;
    const startTime = Date.now();
    const animate = () => {
      const elapsed = Date.now() - startTime;
      const newOpacity = Math.max(0, 1 - elapsed / fadeMs);
      setBlackOpacity(newOpacity);
      if (elapsed < fadeMs) {
        requestAnimationFrame(animate);
      } else {
        setBlackOpacity(0);
        setPhase('done');
        onLoadComplete();
      }
    };
    requestAnimationFrame(animate);
  }, [phase, onLoadComplete, onQuickResumeHydrate]);

  useEffect(() => {
    if (phase === 'loading') {
      preloadAssets();
    }
  }, [phase, preloadAssets]);

  useEffect(() => {
    if (phase === 'fadeOut') {
      const fadeOutDuration = 500;
      const startTime = Date.now();
      
      const animate = () => {
        const elapsed = Date.now() - startTime;
        const newOpacity = Math.min(1, elapsed / fadeOutDuration);
        setBlackOpacity(newOpacity);
        
        if (elapsed < fadeOutDuration) {
          requestAnimationFrame(animate);
        } else {
          setBlackOpacity(1);
          setPhase('done');
          onLoadComplete();
        }
      };
      
      requestAnimationFrame(animate);
    }
  }, [phase, onLoadComplete]);

  const handleTap = () => {
    if (variant === 'quick') return;
    if (phase === 'ready') {
      setPhase('fadeOut');
    }
  };

  if (phase === 'done') return null;

  if (variant === 'quick') {
    return (
      <div
        className="fixed inset-0 z-[1000] flex items-center justify-center bg-[#050608]"
        style={{ cursor: 'default', pointerEvents: 'auto' }}
      >
        <div className="absolute inset-0 bg-black pointer-events-none" style={{ opacity: blackOpacity }} />
      </div>
    );
  }

  return (
    <div 
      className="fixed inset-0 z-[1000] flex items-center justify-center bg-[#050608]"
      onClick={handleTap}
      style={{ cursor: phase === 'ready' ? 'pointer' : 'default' }}
    >
      {/* 9:16 container with scaling */}
      <div
        className="relative overflow-hidden shadow-[0_0_100px_rgba(0,0,0,0.9)]"
        style={{
          width: `${DESIGN_WIDTH}px`,
          height: `${DESIGN_HEIGHT}px`,
          transform: `scale(${appScale})`,
          transformOrigin: 'center center',
        }}
      >
        {/* Background image - 1:1 aspect ratio, height fills container, excess bleeds off sides */}
        <div 
          className="absolute top-0 bg-no-repeat"
          style={{ 
            left: '50%',
            transform: 'translateX(-50%)',
            height: `${DESIGN_HEIGHT}px`,
            width: `${DESIGN_HEIGHT}px`,
            backgroundImage: `url(${assetPath('/assets/background/background_loading.png')})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center center',
          }}
        />

        {/* Logo in top 1/3 of screen */}
        <div className="absolute top-0 left-0 right-0 h-1/3 flex items-center justify-center" style={{ marginTop: '60px' }}>
          <img 
            src={assetPath('/assets/icons/icon_logo.png')}
            alt="Logo"
            className="object-contain"
            style={{ transform: 'scale(0.65)' }}
          />
        </div>

        {/* Content container - positioned at bottom */}
        <div className="absolute bottom-0 left-0 right-0 flex flex-col items-center px-8 pb-16">
          {/* Progress bar outer container with stroke */}
          <div 
            className="relative w-[50%] h-[38px] rounded-full overflow-hidden mb-8"
            style={{
              border: '3px solid rgba(14, 63, 53, 0.5)',
              backgroundColor: 'rgba(0,0,0,0.4)',
              boxShadow: '0 4px 12px rgba(0,0,0,0.25)',
            }}
          >
            {/* Progress bar fill with inner stroke */}
            <div 
              className="h-full transition-all duration-150 ease-out rounded-full"
              style={{ 
                width: `${progress}%`,
                background: 'linear-gradient(to bottom, #fcea3f, #f7911d)',
                boxShadow: 'inset 0 0 0 3px rgba(239, 71, 35, 0.5)',
              }}
            />
            {/* Text centered inside progress bar */}
            <div className="absolute inset-0 flex items-center justify-center">
              {phase === 'loading' && (
                <p 
                  className="text-white text-sm font-bold tracking-wide"
                  style={{ textShadow: '0 2px 4px rgba(0,0,0,0.5)' }}
                >
                  LOADING {progress}%
                </p>
              )}
              {phase === 'ready' && (
                <p 
                  className="text-xs font-bold tracking-wide animate-pulse"
                  style={{ color: '#ce6232' }}
                >
                  TAP TO CONTINUE
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Black overlay for fade transitions - inside the container */}
        <div 
          className="absolute inset-0 bg-black pointer-events-none"
          style={{ opacity: blackOpacity }}
        />
      </div>
    </div>
  );
};
