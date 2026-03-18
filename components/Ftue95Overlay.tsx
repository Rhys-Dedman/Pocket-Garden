import React, { useEffect, useState } from 'react';
import { FTUE_BLOCKER_TINT, FTUE_TEXTBOX, FTUE_TEXTBOX_DIVIDER_MARGIN_BOTTOM, FTUE_TEXTBOX_TEXT, FTUE_VISUAL_SCALE } from '../ftue/ftueTextboxStyles';
import { assetPath } from '../utils/assetPath';

interface Ftue95OverlayProps {
  seedButtonRect: { left: number; top: number; width: number; height: number } | null;
  harvestButtonRect: { left: number; top: number; width: number; height: number } | null;
  isVisible: boolean;
  isFadingOut: boolean;
  onConfirm: () => void;
  onFadeOutComplete: () => void;
}

const FADE_IN_MS = 700;
const FADE_OUT_MS = 400;

export const Ftue95Overlay: React.FC<Ftue95OverlayProps> = ({
  seedButtonRect,
  harvestButtonRect,
  isVisible,
  isFadingOut,
  onConfirm,
  onFadeOutComplete,
}) => {
  const [opacity, setOpacity] = useState(0);
  const [buttonPressed, setButtonPressed] = useState(false);

  useEffect(() => {
    if (!isVisible || isFadingOut) return;
    setOpacity(0);
    const raf = requestAnimationFrame(() => setOpacity(1));
    return () => cancelAnimationFrame(raf);
  }, [isVisible, isFadingOut]);

  useEffect(() => {
    if (!isFadingOut) return;
    setOpacity(0);
    const t = setTimeout(onFadeOutComplete, FADE_OUT_MS);
    return () => clearTimeout(t);
  }, [isFadingOut, onFadeOutComplete]);

  if (!isVisible && !isFadingOut) return null;

  // Center horizontally between seed and harvest buttons if possible; otherwise screen center.
  let centerX = '50%';
  let bottom: string | undefined = undefined;
  let top: string | undefined = '45%';
  let transform = 'translate(-50%, -50%)';

  if (seedButtonRect && harvestButtonRect) {
    const cx =
      (seedButtonRect.left + (seedButtonRect.left + seedButtonRect.width) + harvestButtonRect.left + (harvestButtonRect.left + harvestButtonRect.width)) / 4;
    centerX = `${cx}px`;
    top = undefined;
    bottom = `${330 * FTUE_VISUAL_SCALE}px`;
    transform = 'translate(-50%, 0)';
  }

  return (
    <div className="absolute inset-0 z-[101] pointer-events-auto flex items-center justify-center">
      <div className="absolute inset-0" aria-hidden style={{ backgroundColor: FTUE_BLOCKER_TINT }} />

      <div
        className="absolute"
        style={{
          left: centerX,
          top,
          bottom,
          transform,
          ...FTUE_TEXTBOX,
          width: 550 * FTUE_VISUAL_SCALE,
          maxWidth: 'calc(100% - 16px)',
          opacity,
          transition: `opacity ${isFadingOut ? FADE_OUT_MS : FADE_IN_MS}ms ease`,
        }}
      >
        <div
          className="w-full flex items-center justify-center"
          style={{ marginBottom: FTUE_TEXTBOX_DIVIDER_MARGIN_BOTTOM }}
        >
          <img
            src={assetPath('/assets/popups/popup_divider.png')}
            alt=""
            className="h-auto object-contain"
            style={{ width: '100%' }}
          />
        </div>
        <p className="text-center m-0 italic leading-snug" style={{ ...FTUE_TEXTBOX_TEXT, paddingLeft: '4px', paddingRight: '4px' }}>
          <span className="font-medium">Seeds &amp; Harvests now recharge over time.</span>
          <br />
          <span className="font-medium">Extra charges are turned into coins</span>
        </p>
        <div className="mt-4 flex justify-center">
          <button
            type="button"
            onPointerDown={() => setButtonPressed(true)}
            onPointerUp={() => setButtonPressed(false)}
            onPointerCancel={() => setButtonPressed(false)}
            onPointerLeave={() => setButtonPressed(false)}
            onClick={onConfirm}
            className="flex items-center justify-center rounded-xl transition-all border-0 cursor-pointer mx-auto"
            style={{
              height: 56 * FTUE_VISUAL_SCALE,
              minWidth: 260 * FTUE_VISUAL_SCALE,
              maxWidth: 300 * FTUE_VISUAL_SCALE,
              backgroundColor: buttonPressed ? '#9fc044' : '#b8d458',
              border: `${4 * FTUE_VISUAL_SCALE}px solid #8fb33a`,
              borderRadius: 16 * FTUE_VISUAL_SCALE,
              boxShadow: buttonPressed
                ? 'inset 0 4px 8px rgba(0,0,0,0.15)'
                : `0 6px 0 #8fb33a, 0 8px 16px rgba(0,0,0,0.12)`,
              transform: buttonPressed ? `translateY(${2 * FTUE_VISUAL_SCALE}px)` : 'translateY(0)',
            }}
          >
            <span
              className="font-bold tracking-tight"
              style={{
                color: '#4a6b1e',
                fontFamily: 'Inter, sans-serif',
                fontSize: `${1.35 * FTUE_VISUAL_SCALE}rem`,
              }}
            >
              Lets Upgrade Them
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};

