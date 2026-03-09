/**
 * Top bar (coin wallet, level, active boosts, settings).
 * Reference UI: size/position locked — see docs/UI-REFERENCE-TOP-BAR.md.
 */
import React, { useEffect, useRef, useState } from 'react';
import { assetPath } from '../utils/assetPath';
import { getTickCount60 } from '../utils/raf60';
import { getPerformanceMode } from '../utils/performanceMode';

/** Slightly under 33.33ms so we reliably get 30 counts/sec (avoids 25 due to timing). */
const FPS_COUNT_INTERVAL_30_MS = 32;
import { ActiveBoostIndicator, ActiveBoostData, ACTIVE_BOOST_INDICATOR_SIZE_PX } from './ActiveBoostIndicator';

const BOOST_GAP_PX = 2;
const BOOST_SLOT_WIDTH = ACTIVE_BOOST_INDICATOR_SIZE_PX + BOOST_GAP_PX;

interface PageHeaderProps {
  money: number;
  walletRef?: React.RefObject<HTMLButtonElement | null>;
  walletIconRef?: React.RefObject<HTMLElement | null>;
  walletFlashActive?: boolean;
  /** When this increments, triggers coin bounce animation */
  walletBurstCount?: number;
  onWalletClick?: () => void;
  /** If set, shows plant wallet instead of coin wallet */
  plantWallet?: {
    unlockedCount: number;
    totalCount: number;
  };
  /** When set, shows gift button to the right of coin panel */
  onGiftClick?: () => void;
  /** Player level progress (0 to goalsRequired) */
  playerLevel?: number;
  playerLevelProgress?: number;
  /** Goals required to level up from current level (e.g. 2 for level 1, 4 for level 2) */
  playerLevelGoalsRequired?: number;
  /** When this increments, triggers progress bar flash */
  playerLevelFlashTrigger?: number;
  /** If true, hide the top bar background (e.g. for shed screen - keeps plant wallet + settings only) */
  hideTopBarBg?: boolean;
  /** When provided, shows a + button that grants 1 goal worth of XP on tap */
  onXpBoostClick?: () => void;
  /** When provided, settings (gear) button opens pause menu */
  onPauseClick?: () => void;
  /** Active rewarded-ad boosts (max 5); shown left of level as circles with radial progress */
  activeBoosts?: ActiveBoostData[];
  /** Ref for the boost area (used as particle target when activating a reward) */
  activeBoostAreaRef?: React.RefObject<HTMLDivElement | null>;
  /** Min width of boost area when empty so particle target (first boost center) is stable */
  activeBoostMinWidthPx?: number;
  /** When a boost's timer hits 0; (id, rect) so caller can play burst at position */
  onBoostComplete?: (id: string, rect?: DOMRect) => void;
  /** When user taps a boost: open the matching limited offer popup in "active" view (countdown, brown button) */
  onBoostClick?: (boost: ActiveBoostData) => void;
  /** Ref for the left section wrapper (scale 0.88); used so boost particle can render inside it and hit the correct slot */
  headerLeftWrapperRef?: React.RefObject<HTMLDivElement | null>;
}

const formatMoney = (amount: number): string => {
  if (amount >= 1000000) return (amount / 1000000).toFixed(1) + 'M';
  if (amount >= 1000) return (amount / 1000).toFixed(1) + 'K';
  return amount.toString();
};

export const PageHeader: React.FC<PageHeaderProps> = ({ 
  money, 
  walletRef, 
  walletIconRef, 
  walletFlashActive = false,
  walletBurstCount = 0,
  onWalletClick,
  plantWallet,
  onGiftClick,
  playerLevel = 1,
  playerLevelProgress = 0,
  playerLevelFlashTrigger = 0,
  playerLevelGoalsRequired = 2,
  hideTopBarBg = false,
  onXpBoostClick,
  onPauseClick,
  activeBoosts = [],
  activeBoostAreaRef,
  activeBoostMinWidthPx,
  onBoostComplete,
  onBoostClick,
  headerLeftWrapperRef,
}) => {
  const isInteractive = !!walletRef;
  const boostRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const prevBurstRef = useRef(walletBurstCount);
  const prevFlashRef = useRef(playerLevelFlashTrigger);
  const [bounceKey, setBounceKey] = useState(0);
  const [progressBarFlash, setProgressBarFlash] = useState(false);
  const [fps, setFps] = useState(0);
  const rafCountRef = useRef(0);
  const gameTickCountRef = useRef(0);
  const gameTickRef = useRef(0);
  const lastFpsUpdateRef = useRef(performance.now());
  const lastCountTimeRef = useRef(performance.now());
  useEffect(() => {
    let rafId: number;
    const tick = () => {
      const now = performance.now();
      const perfMode = getPerformanceMode();
      if (perfMode) {
        if (now - lastCountTimeRef.current >= FPS_COUNT_INTERVAL_30_MS) {
          lastCountTimeRef.current = now;
          rafCountRef.current += 1;
        }
      } else {
        rafCountRef.current += 1;
      }
      gameTickCountRef.current += getTickCount60(gameTickRef);
      if (now - lastFpsUpdateRef.current >= 1000) {
        const rafPerSec = rafCountRef.current;
        const ticksDelivered = gameTickCountRef.current;
        const maxFps = perfMode ? 30 : 60;
        // In perf mode, 25–30 counts is "30fps target"; show 30 so it doesn't snap down to 25
        const raw = Math.min(maxFps, rafPerSec, ticksDelivered);
        const displayFps = perfMode && raw >= 24 ? 30 : raw;
        setFps(displayFps);
        rafCountRef.current = 0;
        gameTickCountRef.current = 0;
        lastFpsUpdateRef.current = now;
        lastCountTimeRef.current = now;
      }
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, []);
  useEffect(() => {
    if (walletBurstCount > prevBurstRef.current) {
      setBounceKey((k) => k + 1);
    }
    prevBurstRef.current = walletBurstCount;
  }, [walletBurstCount]);
  useEffect(() => {
    if (playerLevelFlashTrigger > prevFlashRef.current) {
      setProgressBarFlash(true);
      prevFlashRef.current = playerLevelFlashTrigger;
      const t = setTimeout(() => setProgressBarFlash(false), 320);
      return () => clearTimeout(t);
    }
  }, [playerLevelFlashTrigger]);

  const bgUrl = assetPath('/assets/topui/topui_bg.png');

  // Sprite: 600×180
  // Left cap: 0–184px (184px wide)
  // Middle: 184–416px (232px wide) – stretch
  // Right cap: 416–600px (184px wide)
  const SPRITE_W = 600;
  const SPRITE_H = 180;
  const LEFT_CAP_PX = 184;
  const RIGHT_CAP_START_PX = 416;
  const MIDDLE_PX = RIGHT_CAP_START_PX - LEFT_CAP_PX; // 232

  // Left/right cap width when scaled to fit height 44px (184 * 44/180 ≈ 45px)
  const capWidthPx = Math.round((LEFT_CAP_PX * 44) / SPRITE_H);

  return (
    <header className="z-10 shrink-0 px-2 pt-4 pb-2">
      {/* Top UI background - 3-slice: left cap (fixed), center (stretch), right cap (fixed) */}
      <div className="relative flex min-h-[44px]">
        {/* 3-slice background layer - hidden when hideTopBarBg (e.g. shed screen) */}
        {!hideTopBarBg && (
        <div className="absolute inset-0 flex w-full pointer-events-none">
          {/* Left cap - 0–184px of sprite, no stretch */}
          <div
            className="flex-shrink-0"
            style={{
              width: `${capWidthPx}px`,
              backgroundImage: `url(${bgUrl})`,
              backgroundSize: 'auto 100%',
              backgroundRepeat: 'no-repeat',
              backgroundPosition: 'left center',
            }}
          />
          {/* Center - middle 232px stretched to fill (184-416px of sprite). -1px overlap hides sub-pixel gaps at scale. */}
          <div
            className="flex-1 min-w-[20px]"
            style={{
              marginLeft: -1,
              marginRight: -1,
              backgroundImage: `url(${bgUrl})`,
              backgroundSize: '258.6% 100%',
              backgroundRepeat: 'no-repeat',
              backgroundPosition: '50% center',
            }}
          />
          {/* Right cap - 416–600px of sprite, no stretch */}
          <div
            className="flex-shrink-0"
            style={{
              width: `${capWidthPx}px`,
              backgroundImage: `url(${bgUrl})`,
              backgroundSize: 'auto 100%',
              backgroundRepeat: 'no-repeat',
              backgroundPosition: 'right center',
            }}
          />
        </div>
        )}
        {/* Content on top */}
        <div className="relative z-10 flex justify-between items-center w-full min-h-[44px] px-3 py-2">
      <div
        ref={headerLeftWrapperRef}
        className="relative flex items-center min-w-0 flex-shrink-0 overflow-visible"
        style={{
          marginLeft: 10,
          gap: 18,
          transform: 'scale(0.88)',
          transformOrigin: 'left center',
        }}
      >
        {isInteractive ? (
          <>
            <button
              ref={walletRef}
              onClick={onWalletClick}
              className="relative inline-flex items-center justify-center rounded-full border outline-none shadow-2xl hover:opacity-90 active:scale-95 transition-all overflow-visible flex-shrink-0"
              style={{
                width: 85,
                minWidth: 85,
                maxWidth: 85,
                height: 22,
                backgroundColor: '#775041',
                borderWidth: 1,
                borderColor: '#e9dcaf',
              }}
            >
              <div
                className="absolute inset-0 rounded-full pointer-events-none transition-opacity duration-75 ease-out"
                style={{
                  background: '#d2af7b',
                  opacity: walletFlashActive ? 1 : 0,
                }}
                aria-hidden
              />
              {/* Icon: fixed left, does not affect width */}
              <span
                ref={walletIconRef}
                className="absolute left-0 top-1/2 -translate-y-1/2 flex items-center justify-center leading-none -ml-3 pointer-events-none"
                aria-hidden
              >
                <img key={bounceKey} src={assetPath('/assets/icons/icon_coin.png')} alt="" className={`w-[30px] h-[30px] object-contain object-left outline-none border-0 ${bounceKey > 0 ? 'coin-bounce' : ''}`} style={{ outline: 'none', border: 'none' }} />
              </span>
              {/* Text centered in fixed 85px width */}
              <span className="relative font-black text-xs tracking-tight text-[#fcf0c7] whitespace-nowrap truncate pl-[12px] pr-2 py-1 max-w-full">
                {formatMoney(money)}
              </span>
            </button>
            {/* Player level: 155px wide, icon + progress bar (overflow-visible so icon isn't masked) - fixed size */}
            <div
              className="relative inline-flex items-center rounded-full border flex-shrink-0 overflow-visible"
              style={{
                width: 155,
                minWidth: 155,
                maxWidth: 155,
                height: 22,
                backgroundColor: '#775041',
                borderWidth: 1,
                borderColor: '#e9dcaf',
              }}
            >
              <span className="absolute left-0 top-1/2 -translate-y-1/2 flex items-center justify-center leading-none -ml-3 pointer-events-none z-10 w-[30px] h-[30px]">
                <img src={assetPath('/assets/icons/icon_level.png')} alt="" className="w-[30px] h-[30px] object-contain object-left" />
                <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center justify-center font-black leading-none" style={{ color: '#c8e9eb', fontSize: 12, WebkitTextStroke: '1px rgba(0,0,0,0.5)', paintOrder: 'stroke fill' }}>{playerLevel}</span>
              </span>
              {/* Progress bar: 1px padding top/right/bottom, 4px left; track #775041; fill has 1px inner stroke */}
              <div className="flex-1 h-full flex items-stretch relative" style={{ paddingTop: 1, paddingRight: 1, paddingBottom: 1, paddingLeft: 10 }}>
                {/* Goals count: fixed center of bar, above progress fill; cream text, black stroke 50%; same size as coin panel (text-xs) */}
                <span
                  className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none font-black text-xs leading-none z-10"
                  style={{
                    color: '#fcf0c7',
                    WebkitTextStroke: '1px rgba(0,0,0,0.5)',
                    paintOrder: 'stroke fill',
                  }}
                >
                  {playerLevelProgress}/{playerLevelGoalsRequired}
                </span>
                <div className="w-full h-full overflow-hidden bg-[#775041]" style={{ borderRadius: '0 9999px 9999px 0' }}>
                  {/* Progress completed: 2px padding, inner 2px stroke (gradient) on top of fill */}
                  <div
                    className="relative h-full transition-all duration-300 overflow-hidden"
                    style={{ width: `${playerLevelGoalsRequired > 0 ? (playerLevelProgress / playerLevelGoalsRequired) * 100 : 0}%`, borderRadius: '0 9999px 9999px 0' }}
                  >
                    <div
                      className="w-full h-full overflow-hidden relative"
                      style={{
                        padding: 1,
                        background: 'linear-gradient(180deg, #c2e3f6 0%, #2d77b5 100%)',
                        borderRadius: '0 9999px 9999px 0',
                      }}
                    >
                      <div
                        className="w-full h-full"
                        style={{
                          background: 'linear-gradient(180deg, #7fc8eb 0%, #559dcf 100%)',
                          borderRadius: '0 9999px 9999px 0',
                        }}
                      />
                      {/* Flash overlay: only over progress completed, below icon, fades out with bar animation */}
                      {progressBarFlash && (
                        <div
                          className="absolute inset-0 pointer-events-none progress-bar-flash"
                          style={{ backgroundColor: 'rgba(255,255,255,0.5)', borderRadius: '0 9999px 9999px 0' }}
                        />
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
            {/* Active boosts: tight to player level (overlap -10px); fixed height so adding/removing boost doesn't shift wallet/level; absolute positioning so removal slides */}
            <div
              ref={activeBoostAreaRef}
              className="relative flex items-center flex-shrink-0 overflow-visible boost-slide-container"
              style={{
                marginLeft: -10,
                height: 22,
                minHeight: 22,
                width: activeBoosts.length > 0 ? activeBoosts.length * ACTIVE_BOOST_INDICATOR_SIZE_PX + (activeBoosts.length - 1) * BOOST_GAP_PX : (activeBoostMinWidthPx ?? ACTIVE_BOOST_INDICATOR_SIZE_PX),
                ...(activeBoostMinWidthPx != null && activeBoosts.length === 0 && { minWidth: activeBoostMinWidthPx }),
              }}
            >
              {activeBoosts.map((boost, index) => (
                <div
                  key={boost.id}
                  ref={(el) => { boostRefs.current[boost.id] = el; }}
                  role="button"
                  tabIndex={0}
                  onClick={() => onBoostClick?.(boost)}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onBoostClick?.(boost); } }}
                  className="absolute flex items-center justify-center boost-slide cursor-pointer"
                  style={{
                    left: index * BOOST_SLOT_WIDTH,
                    top: 0,
                    width: ACTIVE_BOOST_INDICATOR_SIZE_PX,
                    height: 22,
                    transform: 'translateZ(0)',
                  }}
                >
                  <ActiveBoostIndicator
                    data={boost}
                    onComplete={(id) => {
                      const rect = boostRefs.current[id]?.getBoundingClientRect?.();
                      onBoostComplete?.(id, rect);
                    }}
                  />
                </div>
              ))}
            </div>
          </>
        ) : plantWallet ? (
          <div className="relative flex items-center gap-1 bg-black/50 backdrop-blur-md pl-1 pr-2 py-1 rounded-full border-0 shadow-2xl overflow-hidden -ml-4">
            <span
              className="relative flex items-center justify-center text-sm leading-none text-white"
              aria-hidden
            >
              🌱
            </span>
            <span className="relative font-black text-xs tracking-tight text-white">
              {plantWallet.unlockedCount} / {plantWallet.totalCount}
            </span>
          </div>
        ) : (
          <div
            className="relative inline-flex items-center h-[22px] rounded-full border shadow-2xl overflow-visible w-fit min-w-0"
            style={{
              backgroundColor: '#775041',
              borderWidth: 1,
              borderColor: '#e9dcaf',
            }}
          >
            <div
              className="absolute inset-0 rounded-full pointer-events-none transition-opacity duration-75 ease-out"
              style={{
                background: '#d2af7b',
                opacity: walletFlashActive ? 1 : 0,
              }}
              aria-hidden
            />
            <span
              className="absolute left-0 top-1/2 -translate-y-1/2 flex items-center justify-center leading-none -ml-3 pointer-events-none"
              aria-hidden
            >
              <img key={bounceKey} src={assetPath('/assets/icons/icon_coin.png')} alt="" className={`w-[30px] h-[30px] object-contain object-left outline-none border-0 ${bounceKey > 0 ? 'coin-bounce' : ''}`} style={{ outline: 'none', border: 'none' }} />
            </span>
            <span className="relative font-black text-xs tracking-tight text-[#fcf0c7] whitespace-nowrap pl-[20px] pr-3 py-1">
              {formatMoney(money)}
            </span>
          </div>
        )}
      </div>

      <div className="flex items-center gap-2 flex-shrink-0">
        <button
          type="button"
          className="tabular-nums text-[10px] font-semibold select-none cursor-pointer hover:underline focus:outline-none"
          style={{ color: '#c4a574', background: 'none', border: 'none', padding: 0 }}
          aria-label={`${fps} FPS (click to simulate hitch)`}
          title="Click to simulate a hitch — FPS should drop briefly if the counter is working"
          onClick={() => {
            const end = performance.now() + 250;
            while (performance.now() < end) {}
          }}
        >
          {fps} FPS
        </button>
        <button
          onClick={onPauseClick}
          className="flex items-center justify-center rounded-full transition-all active:scale-95 flex-shrink-0"
          style={{
            width: '22px',
            height: '22px',
            backgroundColor: '#775041',
            borderWidth: 1,
            borderColor: '#e9dcaf',
          }}
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="#fcf0c7" className="w-3.5 h-3.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </button>
      </div>
        </div>
      </div>
    </header>
  );
};
