import React from 'react';
import { FTUE_TEXTBOX, FTUE_TEXTBOX_DIVIDER_MARGIN_BOTTOM, FTUE_TEXTBOX_TEXT } from '../ftue/ftueTextboxStyles';
import { assetPath } from '../utils/assetPath';

interface Ftue11OverlayProps {
  seedButtonRect: DOMRect | null;
  harvestButtonRect: DOMRect | null;
  onConfirm: () => void;
}

export const Ftue11Overlay: React.FC<Ftue11OverlayProps> = ({
  seedButtonRect,
  harvestButtonRect,
  onConfirm,
}) => {
  // Center horizontally between seed and harvest buttons if possible; otherwise screen center.
  let centerX = '50%';
  let top = '45%';
  let transform = 'translate(-50%, -50%)';

  if (seedButtonRect && harvestButtonRect) {
    const cx =
      (seedButtonRect.left + seedButtonRect.right + harvestButtonRect.left + harvestButtonRect.right) / 4;
    const cy = Math.min(seedButtonRect.top, harvestButtonRect.top) - 20;
    centerX = `${cx}px`;
    top = `${cy}px`;
    transform = 'translate(-50%, -100%)';
  }

  return (
    <div className="fixed inset-0 z-[101] pointer-events-auto flex items-center justify-center">
      {/* Transparent backdrop that blocks everything except the FTUE textbox/button */}
      <div className="absolute inset-0" aria-hidden />

      <div
        className="absolute"
        style={{
          left: centerX,
          top,
          transform,
          ...FTUE_TEXTBOX,
          width: 520,
          maxWidth: 'calc(100vw - 16px)',
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
        <p
          className="text-center m-0 font-medium italic leading-snug"
          style={{ ...FTUE_TEXTBOX_TEXT, paddingLeft: '12px', paddingRight: '12px' }}
        >
          Seeds and Harvests recharge over time. Extra recharges give coins
        </p>
        <div className="mt-4 flex justify-center">
          <button
            type="button"
            onClick={onConfirm}
            className="flex items-center justify-center rounded-xl transition-all border-0 cursor-pointer mx-auto"
            style={{
              height: 56,
              minWidth: 260,
              maxWidth: 300,
              backgroundColor: '#b8d458',
              border: '4px solid #8fb33a',
              borderRadius: 16,
              boxShadow: `0 6px 0 #8fb33a, 0 8px 16px rgba(0,0,0,0.12)`,
            }}
          >
            <span
              className="font-bold tracking-tight"
              style={{
                color: '#4a6b1e',
                fontFamily: 'Inter, sans-serif',
                fontSize: '1.35rem',
              }}
            >
              Lets Get Gardening!
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};

