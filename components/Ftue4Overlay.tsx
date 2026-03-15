/**
 * FTUE 4: First goal – textbox next to goal slot 0 with "Lets Harvest!" button.
 * Blocking overlay so only the button is tappable. Fades out when button is clicked.
 */
import React, { useEffect, useState, useCallback } from 'react';
import { assetPath } from '../utils/assetPath';
import { FTUE_TEXTBOX, FTUE_TEXTBOX_DIVIDER_MARGIN_BOTTOM, FTUE_TEXTBOX_TEXT } from '../ftue/ftueTextboxStyles';

const FADE_OUT_MS = 400;
const GOAL_SLOT_0_ID = 'goal-slot-0';

const buttonBgColor = '#b8d458';
const buttonBorderColor = '#8fb33a';
const buttonTextColor = '#4a6b1e';
const buttonPressedBg = '#9fc044';

export interface Ftue4OverlayProps {
  isActive: boolean;
  isFadingOut: boolean;
  onLetsHarvest: () => void;
  onFadeOutComplete: () => void;
}

export const Ftue4Overlay: React.FC<Ftue4OverlayProps> = ({
  isActive,
  isFadingOut,
  onLetsHarvest,
  onFadeOutComplete,
}) => {
  const [buttonPressed, setButtonPressed] = useState(false);
  const [textboxStyle, setTextboxStyle] = useState<React.CSSProperties>({ opacity: 0 });
  const [overlayOpacity, setOverlayOpacity] = useState(0);

  const measure = useCallback(() => {
    const el = document.getElementById(GOAL_SLOT_0_ID);
    if (!el) return;
    const r = el.getBoundingClientRect();
    setTextboxStyle({
      position: 'fixed',
      left: r.right + 0,
      top: r.top + r.height / 2 - 120,
      opacity: 1,
      zIndex: 100,
    });
  }, []);

  useEffect(() => {
    if (!isActive && !isFadingOut) return;
    measure();
    const t = setTimeout(measure, 50);
    const resize = () => measure();
    window.addEventListener('resize', resize);
    return () => {
      clearTimeout(t);
      window.removeEventListener('resize', resize);
    };
  }, [isActive, isFadingOut, measure]);

  useEffect(() => {
    if (isActive && !isFadingOut) {
      setOverlayOpacity(0);
      const t = setTimeout(() => setOverlayOpacity(1), 50);
      return () => clearTimeout(t);
    }
  }, [isActive, isFadingOut]);

  useEffect(() => {
    if (!isFadingOut) return;
    setOverlayOpacity(0);
    const t = setTimeout(onFadeOutComplete, FADE_OUT_MS);
    return () => clearTimeout(t);
  }, [isFadingOut, onFadeOutComplete]);

  if (!isActive && !isFadingOut) return null;

  return (
    <div
      className="fixed inset-0"
      style={{
        zIndex: 99,
        pointerEvents: isFadingOut ? 'none' : 'auto',
        transition: `opacity ${FADE_OUT_MS}ms ease-out`,
        opacity: overlayOpacity,
      }}
    >
      {/* Blocking layer: only the textbox button is tappable (textbox rendered on top with pointer-events-auto) */}
      <div className="absolute inset-0" style={{ pointerEvents: 'auto' }} aria-hidden />

      {/* Textbox: next to goal slot 0, with "Lets Harvest!" button */}
      <div
        className="pointer-events-auto"
        style={{
          ...FTUE_TEXTBOX,
          ...textboxStyle,
          width: '440px',
          transition: `opacity ${FADE_OUT_MS}ms ease-out`,
          opacity: isFadingOut ? 0 : textboxStyle.opacity ?? 1,
        }}
      >
        <div className="w-full flex items-center justify-center" style={{ marginBottom: FTUE_TEXTBOX_DIVIDER_MARGIN_BOTTOM }}>
          <img
            src={assetPath('/assets/popups/popup_divider.png')}
            alt=""
            className="h-auto object-contain"
            style={{ width: '100%' }}
          />
        </div>
        <p className="text-center m-0 font-medium italic leading-snug mb-4" style={{ ...FTUE_TEXTBOX_TEXT, paddingLeft: '24px', paddingRight: '24px' }}>
          Looks like we've got an order! Time to start harvesting.
        </p>
        <button
          type="button"
          onMouseDown={() => setButtonPressed(true)}
          onMouseUp={() => setButtonPressed(false)}
          onMouseLeave={() => setButtonPressed(false)}
          onClick={() => {
            onLetsHarvest();
          }}
          className="flex items-center justify-center rounded-xl transition-all border-0 cursor-pointer mx-auto"
          style={{
            height: '56px',
            minWidth: '180px',
            maxWidth: '220px',
            backgroundColor: buttonPressed ? buttonPressedBg : buttonBgColor,
            border: `4px solid ${buttonBorderColor}`,
            borderRadius: '16px',
            boxShadow: buttonPressed
              ? 'inset 0 4px 8px rgba(0,0,0,0.15)'
              : `0 6px 0 ${buttonBorderColor}, 0 8px 16px rgba(0,0,0,0.12)`,
            transform: buttonPressed ? 'translateY(2px)' : 'translateY(0)',
          }}
        >
          <span
            className="font-bold tracking-tight"
            style={{
              color: buttonTextColor,
              fontFamily: 'Inter, sans-serif',
              fontSize: '1.35rem',
            }}
          >
            Lets Harvest!
          </span>
        </button>
      </div>
    </div>
  );
};
