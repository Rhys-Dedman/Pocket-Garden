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
  plantWallet
}) => {
  const isInteractive = !!walletRef;
  const prevBurstRef = useRef(walletBurstCount);
  const [bounceKey, setBounceKey] = useState(0);
  useEffect(() => {
    if (walletBurstCount > prevBurstRef.current) {
      setBounceKey((k) => k + 1);
    }
    prevBurstRef.current = walletBurstCount;
  }, [walletBurstCount]);

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
        {/* 3-slice background layer */}
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
          {/* Center - middle 232px stretched to fill (184-416px of sprite) */}
          <div
            className="flex-1 min-w-[20px]"
            style={{
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
        {/* Content on top */}
        <div className="relative z-10 flex justify-between items-center w-full min-h-[44px] px-3 py-2">
      <div className="flex space-x-2 ml-[13px]">
        {isInteractive ? (
          <button
            ref={walletRef}
            onClick={onWalletClick}
            className="relative flex items-center w-[60px] h-[22px] rounded-full border outline-none shadow-2xl hover:opacity-90 active:scale-95 transition-all overflow-visible"
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
              ref={walletIconRef}
              className="relative flex items-center justify-center leading-none flex-shrink-0 -ml-3"
              aria-hidden
            >
              <img key={bounceKey} src={assetPath('/assets/icons/icon_coin.png')} alt="" className={`w-[30px] h-[30px] object-contain object-left outline-none border-0 ${bounceKey > 0 ? 'coin-bounce' : ''}`} style={{ outline: 'none', border: 'none' }} />
            </span>
            <span
              className="relative font-black text-xs tracking-tight text-[#fcf0c7] overflow-hidden truncate flex-1 min-w-0 -ml-[6px]"
            >
              {formatMoney(money)}
            </span>
          </button>
        ) : plantWallet ? (
          <div
            className="relative flex items-center w-[60px] h-[22px] rounded-full border shadow-2xl overflow-visible"
            style={{
              backgroundColor: '#775041',
              borderWidth: 1,
              borderColor: '#e9dcaf',
            }}
          >
            <span
              className="relative flex items-center justify-center text-sm leading-none flex-shrink-0"
              aria-hidden
            >
              🌱
            </span>
            <span className="relative font-black text-xs tracking-tight text-[#fcf0c7] overflow-hidden truncate flex-1 min-w-0 -ml-[6px]">
              {plantWallet.unlockedCount} / {plantWallet.totalCount}
            </span>
          </div>
        ) : (
          <div
            className="relative flex items-center w-[60px] h-[22px] rounded-full border shadow-2xl overflow-visible"
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
              className="relative flex items-center justify-center leading-none flex-shrink-0 -ml-3"
              aria-hidden
            >
              <img key={bounceKey} src={assetPath('/assets/icons/icon_coin.png')} alt="" className={`w-[30px] h-[30px] object-contain object-left outline-none border-0 ${bounceKey > 0 ? 'coin-bounce' : ''}`} style={{ outline: 'none', border: 'none' }} />
            </span>
            <span className="relative font-black text-xs tracking-tight text-[#fcf0c7] overflow-hidden truncate flex-1 min-w-0 -ml-[6px]">
              {formatMoney(money)}
            </span>
          </div>
        )}
      </div>

      <button className="w-9 h-9 flex items-center justify-center bg-black/50 backdrop-blur-md hover:bg-black/60 rounded-full transition-all border border-white/5 shadow-2xl">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-5 h-5 text-white/80">
          <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      </button>
        </div>
      </div>
    </header>
  );
};
