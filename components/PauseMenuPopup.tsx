/**
 * Settings (Pause) Popup - Debugger menu. Title/divider/description match discovery popup style.
 */
import React, { useState, useEffect, useCallback, type CSSProperties } from 'react';
import { assetPath } from '../utils/assetPath';
import { popupCardSurfaceStyle, usePopupPreflightEnter, type PopupAnimWithPreflight } from '../hooks/usePopupPreflightEnter';

interface PauseMenuPopupProps {
  isVisible: boolean;
  onClose: () => void;
  /** Rewarded Ad: same as gift – opens limited offer. */
  onRewardedAdClick?: () => void;
  /** Level Up: same as + next to player level – 1 goal XP per tap. */
  onLevelUpClick?: () => void;
  /** Dev/cheat: unlock next plant in background; pause stays open. Discovery shows on pause close (latest only). */
  onUnlockPlantClick?: () => void;
  /** Dev/cheat: complete current golden pot progress segment instantly. */
  onGoldenPotClick?: () => void;
  /** Dev/cheat: add coins (e.g. +100k). Does not close pause menu. */
  onAddMoney?: (amount: number) => void;
  /** Reset economy + progression to post–FTUE 11, level 1 (no tutorial replay). */
  onClearProgress?: () => void;
  /** Lock every shed shelf again (no collection unlocks). */
  onClearShed?: () => void;
  /** When false, Unlock Plant button is disabled (all plants unlocked) */
  canUnlockPlant?: boolean;
  closeOnBackdropClick?: boolean;
  appScale?: number;
}

const POPUP_CLOSE_MS = 200;
const SETTINGS_BUTTON_HEIGHT_PX = 28; // 30% shorter than previous 40px

const SETTINGS_PALETTES = {
  green: {
    bg: '#b8d458',
    border: '#8fb33a',
    text: '#4a6b1e',
    pressedBg: '#9fc044',
    textShadow: '0 1px 0 rgba(255,255,255,0.3)',
  },
  blue: {
    bg: '#89c8e1',
    border: '#66a4c6',
    text: '#4580a8',
    pressedBg: '#7ab8d1',
    textShadow: '0 1px 0 rgba(255,255,255,0.3)',
  },
  yellow: {
    bg: '#ffd856',
    border: '#f59d42',
    text: '#e6803a',
    pressedBg: '#f0c840',
    textShadow: '0 1px 0 rgba(255,255,255,0.3)',
  },
  red: {
    bg: '#a84848',
    border: '#6b2a2a',
    text: '#fce8e8',
    pressedBg: '#8b4040',
    textShadow: '0 1px 0 rgba(0,0,0,0.25)',
  },
} as const;

function settingsCheatButtonStyle(
  p: (typeof SETTINGS_PALETTES)['green'],
  pressed: boolean
): CSSProperties {
  return {
    height: `${SETTINGS_BUTTON_HEIGHT_PX}px`,
    backgroundColor: pressed ? p.pressedBg : p.bg,
    border: `3px solid ${p.border}`,
    borderRadius: '12px',
    boxShadow: pressed
      ? 'inset 0 2px 4px rgba(0,0,0,0.15)'
      : `0 4px 0 ${p.border}, 0 6px 12px rgba(0,0,0,0.15)`,
    transform: pressed ? 'translateY(2px)' : 'translateY(0)',
  };
}

function settingsCheatLabelStyle(p: (typeof SETTINGS_PALETTES)['green']): CSSProperties {
  return {
    color: p.text,
    fontFamily: 'Inter, sans-serif',
    textShadow: p.textShadow,
    fontSize: '0.875rem',
  };
}

export const PauseMenuPopup: React.FC<PauseMenuPopupProps> = ({
  isVisible,
  onClose,
  onRewardedAdClick,
  onLevelUpClick,
  onUnlockPlantClick,
  onGoldenPotClick,
  onAddMoney,
  onClearProgress,
  onClearShed,
  canUnlockPlant = true,
  closeOnBackdropClick = true,
  appScale = 1,
}) => {
  const [animState, setAnimState] = useState<PopupAnimWithPreflight>('hidden');
  const [rewardedPressed, setRewardedPressed] = useState(false);
  const [levelUpPressed, setLevelUpPressed] = useState(false);
  const [unlockPlantPressed, setUnlockPlantPressed] = useState(false);
  const [goldenPotPressed, setGoldenPotPressed] = useState(false);
  const [addCoinsPressed, setAddCoinsPressed] = useState(false);
  const [clearProgressPressed, setClearProgressPressed] = useState(false);
  const [clearShedPressed, setClearShedPressed] = useState(false);

  const beginEnterAfterPreflight = useCallback(() => {
    setAnimState('entering');
    setTimeout(() => setAnimState('visible'), 250);
  }, []);

  usePopupPreflightEnter(animState, beginEnterAfterPreflight);

  useEffect(() => {
    if (isVisible && animState === 'hidden') {
      setAnimState('preflight');
    } else if (!isVisible && (animState === 'visible' || animState === 'entering' || animState === 'preflight')) {
      setAnimState('leaving');
      setTimeout(() => {
        setAnimState('hidden');
        onClose();
      }, POPUP_CLOSE_MS);
    }
  }, [isVisible, animState, onClose]);

  const dismissToClose = () => {
    if (animState === 'leaving' || animState === 'hidden' || animState === 'preflight') return;
    setAnimState('leaving');
    setTimeout(() => {
      setAnimState('hidden');
      onClose();
    }, POPUP_CLOSE_MS);
  };

  const handleRewardedAdClick = () => {
    if (animState === 'leaving' || animState === 'preflight') return;
    if (!onRewardedAdClick) return;
    onRewardedAdClick();
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

  return (
    <div
      className="fixed inset-0 flex items-center justify-center"
      style={{ zIndex: 100, overflow: 'hidden', pointerEvents: isPreflight ? 'none' : 'auto' }}
    >
      <div
        className="absolute transition-opacity duration-200"
        style={{
          top: '-10px',
          left: '-10px',
          right: '-10px',
          bottom: '-10px',
          backgroundColor: 'rgba(0, 0, 0, 0.7)',
          opacity: isLeaving || isPreflight ? 0 : 1,
        }}
        onClick={closeOnBackdropClick ? dismissToClose : undefined}
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
            ...popupCardSurfaceStyle(
              animState,
              isEntering,
              isLeaving,
              'pausePopupEnter 250ms ease-out forwards',
              `pausePopupLeave ${POPUP_CLOSE_MS}ms ease-in forwards`
            ),
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
              backgroundColor: '#fcf0c6',
              boxShadow: '0 1px 14px rgba(0,0,0,0.96), inset 0 0 0 1.5px #e9dcaf',
              border: '2px solid rgba(180, 165, 130, 0.4)',
              padding: '36px 20px 32px',
            }}
          >
            <div className="flex flex-col items-center">
              {/* Title - same styling as Discovery "Wild Fern" subtitle: dark brown, extra bold */}
              <h2
                className="font-black tracking-tight text-center"
                style={{
                  color: '#5c4a32',
                  fontFamily: 'Inter, sans-serif',
                  fontSize: '2.25rem',
                }}
              >
                Dev Tools
              </h2>

              {/* Green divider - same as discovery popup */}
              <div className="w-full flex items-center justify-center" style={{ marginTop: '8px', marginBottom: '12px' }}>
                <img
                  src={assetPath('/assets/popups/popup_divider.png')}
                  alt=""
                  className="h-auto object-contain"
                  style={{ width: '100%', maxWidth: '220px' }}
                />
              </div>

              {/* Description - same size/color/italics as discovery popup description */}
              <p
                className="font-medium text-center leading-relaxed italic w-full"
                style={{
                  color: '#c2b280',
                  fontFamily: 'Inter, sans-serif',
                  fontSize: '0.875rem',
                  paddingLeft: '12px',
                  paddingRight: '12px',
                  marginBottom: '16px',
                }}
              >
                This is a debugger menu for Rhys only! Don&apos;t even think about using these cheats...
              </p>

              <div className="flex flex-col items-center gap-3 w-full" style={{ maxWidth: '200px' }}>
                {onRewardedAdClick ? (
                  <button
                    type="button"
                    onMouseDown={() => setRewardedPressed(true)}
                    onMouseUp={() => setRewardedPressed(false)}
                    onMouseLeave={() => setRewardedPressed(false)}
                    onClick={handleRewardedAdClick}
                    className="relative flex items-center justify-center rounded-lg transition-all w-full"
                    style={settingsCheatButtonStyle(SETTINGS_PALETTES.yellow, rewardedPressed)}
                  >
                    <span className="font-bold tracking-tight" style={settingsCheatLabelStyle(SETTINGS_PALETTES.yellow)}>
                      Rewarded Ad
                    </span>
                  </button>
                ) : null}
                {/* 2. +1Mil Coins — blue */}
                {onAddMoney ? (
                  <button
                    type="button"
                    onMouseDown={() => setAddCoinsPressed(true)}
                    onMouseUp={() => setAddCoinsPressed(false)}
                    onMouseLeave={() => setAddCoinsPressed(false)}
                    onClick={() => onAddMoney(1000000)}
                    className="relative flex items-center justify-center rounded-lg transition-all w-full"
                    style={settingsCheatButtonStyle(SETTINGS_PALETTES.blue, addCoinsPressed)}
                  >
                    <span className="font-bold tracking-tight" style={settingsCheatLabelStyle(SETTINGS_PALETTES.blue)}>
                      +1Mil Coins
                    </span>
                  </button>
                ) : null}
                {/* 3. Unlock plant — blue */}
                {onUnlockPlantClick ? (
                  <button
                    type="button"
                    disabled={!canUnlockPlant}
                    onMouseDown={() => canUnlockPlant && setUnlockPlantPressed(true)}
                    onMouseUp={() => setUnlockPlantPressed(false)}
                    onMouseLeave={() => setUnlockPlantPressed(false)}
                    onClick={() => {
                      if (!canUnlockPlant || !onUnlockPlantClick) return;
                      onUnlockPlantClick();
                    }}
                    className="relative flex items-center justify-center rounded-lg transition-all w-full"
                    style={{
                      ...settingsCheatButtonStyle(SETTINGS_PALETTES.blue, unlockPlantPressed && canUnlockPlant),
                      opacity: canUnlockPlant ? 1 : 0.45,
                      cursor: canUnlockPlant ? 'pointer' : 'not-allowed',
                    }}
                  >
                    <span className="font-bold tracking-tight" style={settingsCheatLabelStyle(SETTINGS_PALETTES.blue)}>
                      Unlock plant
                    </span>
                  </button>
                ) : null}
                {/* 4. Golden Pot — blue */}
                {onGoldenPotClick ? (
                  <button
                    type="button"
                    onMouseDown={() => setGoldenPotPressed(true)}
                    onMouseUp={() => setGoldenPotPressed(false)}
                    onMouseLeave={() => setGoldenPotPressed(false)}
                    onClick={() => onGoldenPotClick()}
                    className="relative flex items-center justify-center rounded-lg transition-all w-full"
                    style={settingsCheatButtonStyle(SETTINGS_PALETTES.blue, goldenPotPressed)}
                  >
                    <span className="font-bold tracking-tight" style={settingsCheatLabelStyle(SETTINGS_PALETTES.blue)}>
                      Golden Pot
                    </span>
                  </button>
                ) : null}
                {onLevelUpClick ? (
                  <button
                    type="button"
                    onMouseDown={() => setLevelUpPressed(true)}
                    onMouseUp={() => setLevelUpPressed(false)}
                    onMouseLeave={() => setLevelUpPressed(false)}
                    onClick={onLevelUpClick}
                    className="relative flex items-center justify-center rounded-lg transition-all w-full"
                    style={settingsCheatButtonStyle(SETTINGS_PALETTES.blue, levelUpPressed)}
                  >
                    <span className="font-bold tracking-tight" style={settingsCheatLabelStyle(SETTINGS_PALETTES.blue)}>
                      Level Up
                    </span>
                  </button>
                ) : null}
                {/* 6. Rewarded Ad — yellow */}
                {/* 7. Clear Shed — red */}
                {onClearShed ? (
                  <button
                    type="button"
                    onMouseDown={() => setClearShedPressed(true)}
                    onMouseUp={() => setClearShedPressed(false)}
                    onMouseLeave={() => setClearShedPressed(false)}
                    onClick={() => onClearShed()}
                    className="relative flex items-center justify-center rounded-lg transition-all w-full"
                    style={settingsCheatButtonStyle(SETTINGS_PALETTES.red, clearShedPressed)}
                  >
                    <span className="font-bold tracking-tight" style={settingsCheatLabelStyle(SETTINGS_PALETTES.red)}>
                      Clear Shed
                    </span>
                  </button>
                ) : null}
                {onClearProgress ? (
                  <button
                    type="button"
                    onMouseDown={() => setClearProgressPressed(true)}
                    onMouseUp={() => setClearProgressPressed(false)}
                    onMouseLeave={() => setClearProgressPressed(false)}
                    onClick={() => onClearProgress()}
                    className="relative flex items-center justify-center rounded-lg transition-all w-full"
                    style={settingsCheatButtonStyle(SETTINGS_PALETTES.red, clearProgressPressed)}
                  >
                    <span className="font-bold tracking-tight" style={settingsCheatLabelStyle(SETTINGS_PALETTES.red)}>
                      Clear Progress
                    </span>
                  </button>
                ) : null}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={dismissToClose}
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
