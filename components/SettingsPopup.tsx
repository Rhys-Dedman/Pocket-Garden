import React, { useCallback, useEffect, useState, useRef } from 'react';
import { assetPath } from '../utils/assetPath';
import { popupCardSurfaceStyle, usePopupPreflightEnter, type PopupAnimWithPreflight } from '../hooks/usePopupPreflightEnter';
import { getPerformanceMode, setPerformanceMode } from '../utils/performanceMode';
import { getAutoMergeMode, setAutoMergeMode } from '../utils/autoMergeMode';

interface SettingsPopupProps {
  isVisible: boolean;
  onClose: () => void;
  onOpenDevTools: () => void;
  onClearBoosts?: () => void;
  onResetProgress?: () => void;
  showAutoMergeSetting?: boolean;
  onAutoMergeChange?: (enabled: boolean) => void;
  closeOnBackdropClick?: boolean;
  appScale?: number;
}

const POPUP_CLOSE_MS = 200;
const BUTTON_HEIGHT_PX = 36; // 30% taller than 28px

const PALETTES = {
  green: {
    bg: '#b8d458',
    border: '#8fb33a',
    text: '#4a6b1e',
    pressedBg: '#9fc044',
    textShadow: '0 1px 0 rgba(255,255,255,0.3)',
  },
  red: {
    bg: '#a84848',
    border: '#6b2a2a',
    text: '#fce8e8',
    pressedBg: '#8b4040',
    textShadow: '0 1px 0 rgba(0,0,0,0.25)',
  },
  blue: {
    bg: '#89c8e1',
    border: '#66a4c6',
    text: '#4580a8',
    pressedBg: '#7ab8d1',
    textShadow: '0 1px 0 rgba(255,255,255,0.3)',
  },
} as const;

function btnStyle(p: (typeof PALETTES)['green'], pressed: boolean): React.CSSProperties {
  return {
    height: `${BUTTON_HEIGHT_PX}px`,
    backgroundColor: pressed ? p.pressedBg : p.bg,
    border: `3px solid ${p.border}`,
    borderRadius: '12px',
    boxShadow: pressed
      ? 'inset 0 2px 4px rgba(0,0,0,0.15)'
      : `0 4px 0 ${p.border}, 0 6px 12px rgba(0,0,0,0.15)`,
    transform: pressed ? 'translateY(2px)' : 'translateY(0)',
  };
}

function labelStyle(p: (typeof PALETTES)['green']): React.CSSProperties {
  return {
    color: p.text,
    fontFamily: 'Inter, sans-serif',
    textShadow: p.textShadow,
    fontSize: '0.875rem',
  };
}

export const SettingsPopup: React.FC<SettingsPopupProps> = ({
  isVisible,
  onClose,
  onOpenDevTools,
  onClearBoosts,
  onResetProgress,
  showAutoMergeSetting = false,
  onAutoMergeChange,
  closeOnBackdropClick = true,
  appScale = 1,
}) => {
  const [animState, setAnimState] = useState<PopupAnimWithPreflight>('hidden');
  const [performanceMode, setPerformanceModeLocal] = useState(false);
  const [autoMergeMode, setAutoMergeModeLocal] = useState(false);
  const [devToolsPressed, setDevToolsPressed] = useState(false);
  const [clearBoostsPressed, setClearBoostsPressed] = useState(false);
  const [resetPressed, setResetPressed] = useState(false);
  const popupCardLayoutRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isVisible) {
      setPerformanceModeLocal(getPerformanceMode());
      setAutoMergeModeLocal(getAutoMergeMode());
    }
  }, [isVisible]);

  const beginEnterAfterPreflight = useCallback(() => {
    setAnimState('entering');
    setTimeout(() => setAnimState('visible'), 250);
  }, []);

  usePopupPreflightEnter(animState, beginEnterAfterPreflight, popupCardLayoutRef);

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

  if (animState === 'hidden') return null;
  const isPreflight = animState === 'preflight';
  const isEntering = animState === 'entering';
  const isLeaving = animState === 'leaving';

  return (
    <div className="fixed inset-0 flex items-center justify-center" style={{ zIndex: 100, overflow: 'hidden', pointerEvents: isPreflight ? 'none' : 'auto' }}>
      <div
        className="absolute transition-opacity duration-200"
        style={{ top: '-10px', left: '-10px', right: '-10px', bottom: '-10px', backgroundColor: 'rgba(0, 0, 0, 0.7)', opacity: isLeaving || isPreflight ? 0 : 1 }}
        onClick={closeOnBackdropClick ? dismissToClose : undefined}
      />
      <div className="relative flex items-center justify-center" style={{ transform: `scale(${appScale})`, transformOrigin: 'center center' }}>
        <div
          ref={popupCardLayoutRef}
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
              padding: '36px 20px 14px',
            }}
          >
            <div className="flex flex-col items-center">
              <h2 className="font-black tracking-tight text-center" style={{ color: '#5c4a32', fontFamily: 'Inter, sans-serif', fontSize: '2.25rem' }}>
                Settings
              </h2>
              <div className="w-full flex items-center justify-center" style={{ marginTop: '8px', marginBottom: '14px' }}>
                <img src={assetPath('/assets/popups/popup_divider.png')} alt="" className="h-auto object-contain" style={{ width: '100%', maxWidth: '220px' }} />
              </div>
              <div className="flex flex-col items-center gap-3 w-full" style={{ maxWidth: '200px' }}>
                <button
                  type="button"
                  onClick={() => {
                    const next = !performanceMode;
                    setPerformanceModeLocal(next);
                    setPerformanceMode(next);
                  }}
                  className="relative flex items-center justify-center rounded-lg transition-all w-full"
                  style={{
                    height: `${BUTTON_HEIGHT_PX}px`,
                    backgroundColor: PALETTES.green.bg,
                    border: `3px solid ${PALETTES.green.border}`,
                    borderRadius: '12px',
                    boxShadow: `0 4px 0 ${PALETTES.green.border}, 0 6px 12px rgba(0,0,0,0.15)`,
                  }}
                >
                  <span className="font-bold tracking-tight" style={labelStyle(PALETTES.green)}>
                    Performance Mode {performanceMode ? 'ON' : 'OFF'}
                  </span>
                </button>
                {showAutoMergeSetting ? (
                  <button
                    type="button"
                    onClick={() => {
                      const next = !autoMergeMode;
                      setAutoMergeModeLocal(next);
                      setAutoMergeMode(next);
                      onAutoMergeChange?.(next);
                    }}
                    className="relative flex items-center justify-center rounded-lg transition-all w-full"
                    style={{
                      height: `${BUTTON_HEIGHT_PX}px`,
                      backgroundColor: PALETTES.green.bg,
                      border: `3px solid ${PALETTES.green.border}`,
                      borderRadius: '12px',
                      boxShadow: `0 4px 0 ${PALETTES.green.border}, 0 6px 12px rgba(0,0,0,0.15)`,
                    }}
                  >
                    <span className="font-bold tracking-tight" style={labelStyle(PALETTES.green)}>
                      Auto Merge {autoMergeMode ? 'ON' : 'OFF'}
                    </span>
                  </button>
                ) : null}

                <button
                  type="button"
                  onMouseDown={() => setDevToolsPressed(true)}
                  onMouseUp={() => setDevToolsPressed(false)}
                  onMouseLeave={() => setDevToolsPressed(false)}
                  onClick={onOpenDevTools}
                  className="relative flex items-center justify-center rounded-lg transition-all w-full"
                  style={btnStyle(PALETTES.green, devToolsPressed)}
                >
                  <span className="font-bold tracking-tight" style={labelStyle(PALETTES.green)}>
                    Dev Tools
                  </span>
                </button>

                {onClearBoosts ? (
                  <button
                    type="button"
                    onMouseDown={() => setClearBoostsPressed(true)}
                    onMouseUp={() => setClearBoostsPressed(false)}
                    onMouseLeave={() => setClearBoostsPressed(false)}
                    onClick={onClearBoosts}
                    className="relative flex items-center justify-center rounded-lg transition-all w-full"
                    style={btnStyle(PALETTES.red, clearBoostsPressed)}
                  >
                    <span className="font-bold tracking-tight" style={labelStyle(PALETTES.red)}>
                      Clear Boosts
                    </span>
                  </button>
                ) : null}

                {onResetProgress ? (
                  <button
                    type="button"
                    onMouseDown={() => setResetPressed(true)}
                    onMouseUp={() => setResetPressed(false)}
                    onMouseLeave={() => setResetPressed(false)}
                    onClick={onResetProgress}
                    className="relative flex items-center justify-center rounded-lg transition-all w-full"
                    style={btnStyle(PALETTES.red, resetPressed)}
                  >
                    <span className="font-bold tracking-tight" style={labelStyle(PALETTES.red)}>
                      Reset Game
                    </span>
                  </button>
                ) : null}
                <div
                  className="text-center"
                  style={{
                    marginTop: '4px',
                    color: '#8d7c5d',
                    fontFamily: 'Inter, sans-serif',
                    fontSize: '0.8rem',
                    fontWeight: 700,
                    letterSpacing: '0.01em',
                  }}
                >
                  v0.04
                </div>
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={dismissToClose}
            className="absolute top-3 right-3 w-7 h-7 flex items-center justify-center transition-all hover:scale-110 active:scale-95"
            style={{ backgroundColor: 'transparent', border: 'none', color: '#c2b280', zIndex: 105 }}
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
