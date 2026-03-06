import React, { useEffect, useRef, useState } from 'react';
import { assetPath } from '../utils/assetPath';

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
}) => {
  const isInteractive = !!walletRef;
  const prevBurstRef = useRef(walletBurstCount);
  const prevFlashRef = useRef(playerLevelFlashTrigger);
  const [bounceKey, setBounceKey] = useState(0);
  const [progressBarFlash, setProgressBarFlash] = useState(false);
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
      <div className="flex items-center gap-4 ml-[13px]">
        {isInteractive ? (
          <>
            <button
              ref={walletRef}
              onClick={onWalletClick}
              className="relative inline-flex items-center justify-center h-[22px] rounded-full border outline-none shadow-2xl hover:opacity-90 active:scale-95 transition-all overflow-visible flex-shrink-0"
              style={{
                width: '75px',
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
              {/* Text centered in fixed 75px width */}
              <span className="relative font-black text-xs tracking-tight text-[#fcf0c7] whitespace-nowrap truncate pl-[20px] pr-2 py-1 max-w-full">
                {formatMoney(money)}
              </span>
            </button>
            {/* Player level: 100px wide, icon + progress bar (overflow-visible so icon isn't masked) */}
            <div
              className="relative inline-flex items-center h-[22px] rounded-full border flex-shrink-0 overflow-visible"
              style={{
                width: '100px',
                backgroundColor: '#775041',
                borderWidth: 1,
                borderColor: '#e9dcaf',
              }}
            >
              <span className="absolute left-0 top-1/2 -translate-y-1/2 flex items-center justify-center leading-none -ml-3 pointer-events-none z-10 w-[30px] h-[30px]">
                <img src={assetPath('/assets/icons/icon_level.png')} alt="" className="w-[30px] h-[30px] object-contain object-left" />
                <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-[calc(50%+0.5px)] font-black leading-none" style={{ color: '#c8e9eb', fontSize: 10, WebkitTextStroke: '1px rgba(0,0,0,0.5)', paintOrder: 'stroke fill' }}>{playerLevel}</span>
              </span>
              {/* Progress bar: 1px padding top/right/bottom, 4px left; track #775041; fill has 1px inner stroke */}
              <div className="flex-1 h-full flex items-stretch" style={{ paddingTop: 1, paddingRight: 1, paddingBottom: 1, paddingLeft: 10 }}>
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

      <div className="flex items-center gap-2">
        {onGiftClick && (
          <button
            onClick={onGiftClick}
            className="flex items-center justify-center transition-all active:scale-95 rounded-lg flex-shrink-0"
            style={{
              width: '18px',
              height: '18px',
              background: 'linear-gradient(180deg, #FFB347 0%, #FF9500 100%)',
              border: '1px solid #E88A00',
              boxShadow: '0 1px 2px rgba(0, 0, 0, 0.2)',
            }}
          >
            <span style={{ fontSize: '9px' }}>🎁</span>
          </button>
        )}
        <button className="w-9 h-9 flex items-center justify-center bg-black/50 backdrop-blur-md hover:bg-black/60 rounded-full transition-all border border-white/5 shadow-2xl">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-5 h-5 text-white/80">
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
