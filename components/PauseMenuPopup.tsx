/**
 * Pause Menu Popup - Same look as discovery popup but no header, no leaf burst.
 * Title, stacked buttons. X and backdrop to close.
 */
import React, { useState, useEffect } from 'react';
import { getPerformanceMode, setPerformanceMode } from '../utils/performanceMode';

interface PauseMenuPopupProps {
  isVisible: boolean;
  onClose: () => void;
  /** Rewarded Ad: same as gift – opens limited offer. Closes pause menu when tapped. */
  onRewardedAdClick: () => void;
  /** Level Up: same as + next to player level – 1 goal XP per tap. Does not close pause menu. */
  onLevelUpClick: () => void;
  closeOnBackdropClick?: boolean;
  appScale?: number;
}

const titleColor = '#c2b280';
const buttonBgColor = '#b8d458';
const buttonBorderColor = '#8fb33a';
const buttonTextColor = '#4a6b1e';
const buttonPressedBg = '#9fc044';

export const PauseMenuPopup: React.FC<PauseMenuPopupProps> = ({
  isVisible,
  onClose,
  onRewardedAdClick,
  onLevelUpClick,
  closeOnBackdropClick = true,
  appScale = 1,
}) => {
  const [animState, setAnimState] = useState<'hidden' | 'entering' | 'visible' | 'leaving'>('hidden');
  const [rewardedPressed, setRewardedPressed] = useState(false);
  const [levelUpPressed, setLevelUpPressed] = useState(false);
  const [performanceMode, setPerformanceModeLocal] = useState(false);

  useEffect(() => {
    if (isVisible) setPerformanceModeLocal(getPerformanceMode());
  }, [isVisible]);

  useEffect(() => {
    if (isVisible && animState === 'hidden') {
      setAnimState('entering');
      setTimeout(() => setAnimState('visible'), 250);
    } else if (!isVisible && (animState === 'visible' || animState === 'entering')) {
      setAnimState('leaving');
      setTimeout(() => {
        setAnimState('hidden');
        onClose();
      }, 150);
    }
  }, [isVisible, animState, onClose]);

  const handleRewardedAdClick = () => {
    onRewardedAdClick();
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
      className="fixed inset-0 flex items-center justify-center pointer-events-auto"
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
        onClick={closeOnBackdropClick ? onClose : undefined}
      />
      <div
        className="relative flex items-center justify-center"
        style={{
          transform: `scale(${appScale})`,
          transformOrigin: 'center center',
        }}
      >
        <div
          className="relative flex flex-col items-center"
          style={{
            width: '260px',
            zIndex: 102,
            animation: isEntering
              ? 'pausePopupEnter 250ms ease-out forwards'
              : isLeaving
                ? 'pausePopupLeave 150ms ease-in forwards'
                : 'none',
            transform: animState === 'visible' ? 'scale(1)' : undefined,
            opacity: animState === 'visible' ? 1 : undefined,
          }}
        >
          <style>{`
            @keyframes pausePopupEnter {
              0% { transform: scale(0.9); opacity: 0; }
              70% { transform: scale(1.05); opacity: 1; }
              100% { transform: scale(1); opacity: 1; }
            }
            @keyframes pausePopupLeave {
              0% { transform: scale(1); opacity: 1; }
              100% { transform: scale(0.9); opacity: 0; }
            }
          `}</style>
          <div
            style={{
              position: 'relative',
              width: '260px',
              borderRadius: '24px',
              background: 'linear-gradient(180deg, #f8f2e4 0%, #f0e8d8 100%)',
              boxShadow: '0 16px 48px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.5)',
              border: '2px solid rgba(180, 165, 130, 0.4)',
              padding: '36px 20px 32px',
            }}
          >
            <div className="flex flex-col items-center">
              <h2
                className="font-normal text-center"
                style={{
                  color: titleColor,
                  fontFamily: 'Inter, sans-serif',
                  letterSpacing: '-0.02em',
                  fontSize: '2rem',
                }}
              >
                Pause
              </h2>

              {/* Performance mode toggle */}
              <div
                className="flex items-center justify-between w-full mt-4 px-1"
                style={{ maxWidth: '200px' }}
              >
                <span
                  className="font-semibold"
                  style={{
                    color: titleColor,
                    fontFamily: 'Inter, sans-serif',
                    fontSize: '0.875rem',
                  }}
                >
                  Performance mode
                </span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={performanceMode}
                  onClick={() => {
                    const next = !performanceMode;
                    setPerformanceModeLocal(next);
                    setPerformanceMode(next);
                  }}
                  className="relative rounded-full transition-colors shrink-0"
                  style={{
                    width: '44px',
                    height: '24px',
                    backgroundColor: performanceMode ? buttonBorderColor : 'rgba(0,0,0,0.2)',
                    border: 'none',
                  }}
                >
                  <span
                    className="absolute top-1 rounded-full bg-white shadow transition-transform"
                    style={{
                      left: performanceMode ? '22px' : '4px',
                      width: '18px',
                      height: '18px',
                      transform: 'translateY(-50%)',
                      top: '50%',
                    }}
                  />
                </button>
              </div>

              <div className="flex flex-col items-center gap-3 w-full mt-6" style={{ maxWidth: '200px' }}>
                <button
                  type="button"
                  onMouseDown={() => setRewardedPressed(true)}
                  onMouseUp={() => setRewardedPressed(false)}
                  onMouseLeave={() => setRewardedPressed(false)}
                  onClick={handleRewardedAdClick}
                  className="relative flex items-center justify-center rounded-lg transition-all w-full"
                  style={{
                    height: '40px',
                    backgroundColor: rewardedPressed ? buttonPressedBg : buttonBgColor,
                    border: `3px solid ${buttonBorderColor}`,
                    borderRadius: '16px',
                    boxShadow: rewardedPressed
                      ? 'inset 0 3px 6px rgba(0,0,0,0.15)'
                      : `0 6px 0 ${buttonBorderColor}, 0 8px 16px rgba(0,0,0,0.15)`,
                    transform: rewardedPressed ? 'translateY(3px)' : 'translateY(0)',
                  }}
                >
                  <span
                    className="font-bold tracking-tight"
                    style={{
                      color: buttonTextColor,
                      fontFamily: 'Inter, sans-serif',
                      textShadow: '0 1px 0 rgba(255,255,255,0.3)',
                      fontSize: '0.875rem',
                    }}
                  >
                    Rewarded Ad
                  </span>
                </button>
                <button
                  type="button"
                  onMouseDown={() => setLevelUpPressed(true)}
                  onMouseUp={() => setLevelUpPressed(false)}
                  onMouseLeave={() => setLevelUpPressed(false)}
                  onClick={onLevelUpClick}
                  className="relative flex items-center justify-center rounded-lg transition-all w-full"
                  style={{
                    height: '40px',
                    backgroundColor: levelUpPressed ? buttonPressedBg : buttonBgColor,
                    border: `3px solid ${buttonBorderColor}`,
                    borderRadius: '16px',
                    boxShadow: levelUpPressed
                      ? 'inset 0 3px 6px rgba(0,0,0,0.15)'
                      : `0 6px 0 ${buttonBorderColor}, 0 8px 16px rgba(0,0,0,0.15)`,
                    transform: levelUpPressed ? 'translateY(3px)' : 'translateY(0)',
                  }}
                >
                  <span
                    className="font-bold tracking-tight"
                    style={{
                      color: buttonTextColor,
                      fontFamily: 'Inter, sans-serif',
                      textShadow: '0 1px 0 rgba(255,255,255,0.3)',
                      fontSize: '0.875rem',
                    }}
                  >
                    Level Up
                  </span>
                </button>
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="absolute top-3 right-3 w-7 h-7 flex items-center justify-center transition-all hover:scale-110 active:scale-95"
            style={{
              backgroundColor: 'transparent',
              border: 'none',
              color: '#c2b280',
              zIndex: 105,
            }}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="M2 2L12 12M12 2L2 12" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
};
