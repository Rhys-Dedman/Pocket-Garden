/**
 * Fake Ad Popup - "Ad" shown when player taps Watch Ad.
 * Constrained to the game area (same size as game) so it matches splash/game layout.
 */
import React, { useState } from 'react';
import { assetPath } from '../utils/assetPath';

const GAME_DESIGN_WIDTH = 448;
const GAME_DESIGN_HEIGHT = 796;

interface FakeAdPopupProps {
  isVisible: boolean;
  onComplete: () => void;
  /** Called with the Activate Reward button rect (screen coords) when user clicks it; use to spawn particle. */
  onActivateRewardClick?: (buttonRect: DOMRect) => void;
  /** Scale factor so ad matches game area size (same as app scale) */
  appScale?: number;
}

const GRADIENT_TOP = '#ffd554';
const GRADIENT_BOTTOM = '#f17d3e';
const BUTTON_BG = '#ffd856';
const BUTTON_BORDER = '#f59d42';
const BUTTON_TEXT_COLOR = '#e6803a';
const BUTTON_PRESSED_BG = '#f0c840';

export const FakeAdPopup: React.FC<FakeAdPopupProps> = ({ isVisible, onComplete, onActivateRewardClick, appScale = 1 }) => {
  const [buttonPressed, setButtonPressed] = useState(false);

  if (!isVisible) return null;

  const gameWidth = GAME_DESIGN_WIDTH * appScale;
  const gameHeight = GAME_DESIGN_HEIGHT * appScale;

  return (
    <>
      {/* Full-screen overlay: black pillarbox, centered game-sized area */}
      <div
        className="fixed inset-0 flex items-center justify-center pointer-events-auto"
        style={{
          zIndex: 110,
          backgroundColor: '#050608',
        }}
      >
        {/* Ad content constrained to same size as game (splash-style) */}
        <div
          className="flex flex-col items-center justify-between overflow-hidden shadow-[0_0_100px_rgba(0,0,0,0.9)]"
          style={{
            width: gameWidth,
            height: gameHeight,
            background: `linear-gradient(to bottom, ${GRADIENT_TOP} 0%, ${GRADIENT_BOTTOM} 100%)`,
          }}
        >
          {/* Spacer so content is centered vertically with button at bottom */}
          <div className="flex-1 flex flex-col items-center justify-center w-full min-h-0">
            {/* Center: large watch ad icon */}
            <img
              src={assetPath('/assets/icons/icon_watchad_large.png')}
              alt=""
              className="object-contain select-none"
              style={{
                width: 'min(200px, 40%)',
                height: 'min(200px, 40%)',
                maxWidth: '180px',
                maxHeight: '180px',
                filter: 'drop-shadow(0 4px 12px rgba(0,0,0,0.2))',
              }}
            />
            {/* Text under icon */}
            <p
              className="font-semibold text-center mt-6 px-4"
              style={{
                color: '#5c4a32',
                fontFamily: 'Inter, sans-serif',
                fontSize: 'clamp(14px, 4vw, 20px)',
              }}
            >
              You are now watching an ad
            </p>
          </div>

          {/* Bottom: Complete ad button (same style as Accept Offer but no icon) */}
          <div className="w-full flex justify-center px-4 flex-shrink-0" style={{ paddingBottom: '6rem' }}>
            <button
              onMouseDown={() => setButtonPressed(true)}
              onMouseUp={() => setButtonPressed(false)}
              onMouseLeave={() => setButtonPressed(false)}
              onClick={(e) => {
                setButtonPressed(false);
                const rect = e.currentTarget.getBoundingClientRect();
                onActivateRewardClick?.(rect);
                onComplete();
              }}
              className="relative flex items-center justify-center rounded-xl transition-all"
              style={{
                width: 'min(360px, 100%)',
                height: '56px',
                backgroundColor: buttonPressed ? BUTTON_PRESSED_BG : BUTTON_BG,
                border: `4px solid ${BUTTON_BORDER}`,
                borderRadius: '24px',
                boxShadow: buttonPressed
                  ? 'inset 0 4px 8px rgba(0,0,0,0.15)'
                  : `0 8px 0 ${BUTTON_BORDER}, 0 12px 24px rgba(0,0,0,0.15)`,
                transform: buttonPressed ? 'translateY(4px)' : 'translateY(0)',
              }}
            >
              <span
                className="font-bold tracking-tight"
                style={{
                  color: BUTTON_TEXT_COLOR,
                  fontFamily: 'Inter, sans-serif',
                  textShadow: '0 2px 0 rgba(255,255,255,0.3)',
                  fontSize: '1.25rem',
                }}
            >
              Activate Reward
            </span>
            </button>
          </div>
        </div>
      </div>
    </>
  );
};
