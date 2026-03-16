/**
 * FTUE 10: Manual – (1) Fade in panel closed, finger down at Orders tab, only Orders tappable.
 * (2) Tap Orders → finger fades out, panel opens, finger down at Seeds tab + textbox, only Seeds tappable.
 * (3) Tap Seeds → navigate to Seeds, finger at purchase button, flash green; only purchase tappable. Buy closes FTUE.
 */
import React, { useEffect, useState } from 'react';
import { assetPath } from '../utils/assetPath';
import { FTUE_TEXTBOX, FTUE_TEXTBOX_DIVIDER_MARGIN_BOTTOM, FTUE_TEXTBOX_TEXT } from '../ftue/ftueTextboxStyles';

const FADE_IN_MS = 400;
const FADE_OUT_MS = 400;
const TEXTBOX_FADE_IN_MS = 350;
/** Finger 2 + textbox: wait for panel open to finish (700ms) then fade in over this duration */
const FINGER2_FADE_MS = 700;
const PANEL_OPEN_MS = 700;
/** Wait for Orders→Seeds tab slide to finish (same as UpgradeList when expanded: 700ms) before showing finger 3 */
const FINGER3_DELAY_MS = 700;
const FINGER_SIZE = 270;
const FINGER_TAP_OFFSET_X = -14.14;
const FINGER_TAP_OFFSET_Y = 14.14;
const FINGER_TAP_DOWN_PX = 18;
/** Expand hole so the tab/button is fully inside the tappable cutout (avoids blocking from rect drift). */
const HOLE_PADDING_PX = 12;
/** Set true to show finger-3 blocker as semi-transparent red for debugging alignment */
const DEBUG_FINGER3_BLOCKER_VISIBLE = false;
const FTUE10_TAB_ORDERS_ID = 'ftue10-tab-orders';
const FTUE10_TAB_SEEDS_ID = 'ftue10-tab-seeds';

function expandRect(r: DOMRect, padding: number): DOMRect {
  return new DOMRect(
    r.left - padding,
    r.top - padding,
    r.width + padding * 2,
    r.height + padding * 2
  );
}

export type Ftue10Phase = 'point_orders' | 'panel_open_orders' | 'finger';

export interface Ftue10OverlayProps {
  harvestButtonRect: DOMRect | null;
  phase: Ftue10Phase | null;
  /** Purchase button rect (measured in App like harvest/seed) so finger uses correct viewport coords */
  purchaseButtonRect?: DOMRect | null;
  isFadingOut?: boolean;
  onFadeOutComplete?: () => void;
}

export const Ftue10Overlay: React.FC<Ftue10OverlayProps> = ({
  harvestButtonRect,
  phase,
  purchaseButtonRect: purchaseButtonRectProp = null,
  isFadingOut = false,
  onFadeOutComplete,
}) => {
  const [opacity, setOpacity] = useState(0);
  const [fadeOutOpacity, setFadeOutOpacity] = useState(1);
  const [textboxOpacity, setTextboxOpacity] = useState(0);
  const [showPanelOpenContent, setShowPanelOpenContent] = useState(false);
  const [finger2Opacity, setFinger2Opacity] = useState(0);
  const [showFinger3, setShowFinger3] = useState(false);
  const [ordersTabRect, setOrdersTabRect] = useState<DOMRect | null>(null);
  const [seedsTabRect, setSeedsTabRect] = useState<DOMRect | null>(null);
  const [frozenPurchaseRect, setFrozenPurchaseRect] = useState<DOMRect | null>(null);

  const measure = () => {
    const o = document.getElementById(FTUE10_TAB_ORDERS_ID);
    const s = document.getElementById(FTUE10_TAB_SEEDS_ID);
    if (o) setOrdersTabRect(o.getBoundingClientRect());
    else setOrdersTabRect(null);
    if (s) setSeedsTabRect(s.getBoundingClientRect());
    else setSeedsTabRect(null);
  };

  useEffect(() => {
    setOpacity(0);
    const t = setTimeout(() => setOpacity(1), 50);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!phase && !isFadingOut) return;
    measure();
    const t = setTimeout(measure, 100);
    const raf = requestAnimationFrame(measure);
    const resize = () => measure();
    window.addEventListener('resize', resize);
    // Re-measure after panel open so Seeds tab hole is correct (panel_open_orders)
    const t2 = phase === 'panel_open_orders' ? setTimeout(measure, 400) : undefined;
    const t3 = phase === 'panel_open_orders' ? setTimeout(measure, 680) : undefined;
    return () => {
      clearTimeout(t);
      if (t2) clearTimeout(t2);
      if (t3) clearTimeout(t3);
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
    };
  }, [phase, isFadingOut]);

  useEffect(() => {
    if (!isFadingOut || !onFadeOutComplete) return;
    setFadeOutOpacity(0);
    const t = setTimeout(onFadeOutComplete, FADE_OUT_MS);
    return () => clearTimeout(t);
  }, [isFadingOut, onFadeOutComplete]);

  // Finger 2: show only after panel is fully open (700ms) so position is final, then fade in
  useEffect(() => {
    if (phase !== 'panel_open_orders') {
      setShowPanelOpenContent(false);
      setFinger2Opacity(0);
      return;
    }
    setShowPanelOpenContent(false);
    setFinger2Opacity(0);
    const t = setTimeout(() => {
      setShowPanelOpenContent(true);
      requestAnimationFrame(() => setFinger2Opacity(1));
    }, PANEL_OPEN_MS);
    return () => clearTimeout(t);
  }, [phase]);

  // Finger 3: show only after Seeds tab transition has finished (250ms); freeze rect so no snap
  useEffect(() => {
    if (phase !== 'finger') {
      setShowFinger3(false);
      setFrozenPurchaseRect(null);
      return;
    }
    setShowFinger3(false);
    setFrozenPurchaseRect(null);
    const t = setTimeout(() => setShowFinger3(true), FINGER3_DELAY_MS);
    return () => clearTimeout(t);
  }, [phase]);

  // Freeze purchase button rect when finger 3 first appears so position doesn't jump
  useEffect(() => {
    if (phase === 'finger' && showFinger3 && purchaseButtonRectProp) {
      const r = purchaseButtonRectProp;
      setFrozenPurchaseRect((prev) => prev ?? new DOMRect(r.left, r.top, r.width, r.height));
    }
  }, [phase, showFinger3, purchaseButtonRectProp]);

  useEffect(() => {
    const show = (phase === 'panel_open_orders' && showPanelOpenContent) || phase === 'finger';
    if (show) {
      setTextboxOpacity(0);
      const t = setTimeout(() => setTextboxOpacity(1), 50);
      return () => clearTimeout(t);
    } else {
      setTextboxOpacity(0);
    }
  }, [phase, showPanelOpenContent]);

  const showTextbox = ((phase === 'panel_open_orders' && showPanelOpenContent) || phase === 'finger') && harvestButtonRect && opacity > 0 && fadeOutOpacity > 0;
  const effectiveOpacity = isFadingOut ? fadeOutOpacity : opacity;

  const isFingerPhase = phase === 'finger';
  const purchaseButtonRect = (isFingerPhase && frozenPurchaseRect) ? frozenPurchaseRect : (purchaseButtonRectProp ?? null);
  const holeRect = phase === 'point_orders' ? ordersTabRect : phase === 'panel_open_orders' ? seedsTabRect : isFingerPhase ? purchaseButtonRect : null;

  return (
    <div
      className="fixed inset-0 pointer-events-none"
      style={{
        zIndex: 99,
        transition: `opacity ${isFadingOut ? FADE_OUT_MS : FADE_IN_MS}ms ease-out`,
        opacity: effectiveOpacity,
      }}
    >
      {/* Blocking: point_orders → hole over Orders; panel_open_orders → hole over Seeds; finger → hole over purchase; holes slightly expanded so target stays tappable */}
      {!isFadingOut && phase && (
        phase === 'point_orders' && ordersTabRect ? (
          (() => {
            const h = expandRect(ordersTabRect, HOLE_PADDING_PX);
            return (
              <div className="fixed inset-0 pointer-events-none">
                <div className="absolute left-0 top-0 right-0 pointer-events-auto" style={{ height: h.top }} />
                <div className="absolute left-0 pointer-events-auto" style={{ top: h.top, width: h.left, height: h.height }} />
                <div className="absolute top-0 bottom-0 pointer-events-auto" style={{ left: h.right, right: 0 }} />
                <div className="absolute left-0 right-0 bottom-0 pointer-events-auto" style={{ top: h.bottom }} />
              </div>
            );
          })()
        ) : phase === 'panel_open_orders' && seedsTabRect ? (
          (() => {
            const h = expandRect(seedsTabRect, HOLE_PADDING_PX);
            return (
              <div className="fixed inset-0 pointer-events-none">
                <div className="absolute left-0 top-0 right-0 pointer-events-auto" style={{ height: h.top }} />
                <div className="absolute left-0 pointer-events-auto" style={{ top: h.top, width: h.left, height: h.height }} />
                <div className="absolute top-0 bottom-0 pointer-events-auto" style={{ left: h.right, right: 0 }} />
                <div className="absolute left-0 right-0 bottom-0 pointer-events-auto" style={{ top: h.bottom }} />
              </div>
            );
          })()
        ) : isFingerPhase && showFinger3 && purchaseButtonRect ? (
          (() => {
            const h = purchaseButtonRect;
            const rightBlockerStart = h.right + 160;
            const leftBlockerWidth = h.left + 170;
            const blockStyle = DEBUG_FINGER3_BLOCKER_VISIBLE ? { backgroundColor: 'rgba(255, 0, 0, 0.45)' as const } : {};
            return (
              <div className="fixed inset-0 pointer-events-none">
                <div className="absolute left-0 top-0 right-0 pointer-events-auto" style={{ height: h.top, ...blockStyle }} />
                <div className="absolute left-0 pointer-events-auto" style={{ top: h.top, width: leftBlockerWidth, height: h.height, ...blockStyle }} />
                <div className="absolute top-0 bottom-0 pointer-events-auto" style={{ left: rightBlockerStart, right: 0, ...blockStyle }} />
                <div className="absolute left-0 right-0 bottom-0 pointer-events-auto" style={{ top: h.bottom, ...blockStyle }} />
              </div>
            );
          })()
        ) : (
          <div className="fixed inset-0 pointer-events-auto" aria-hidden />
        )
      )}

      {/* Finger pointing straight down at Orders tab */}
      {phase === 'point_orders' && ordersTabRect && opacity > 0 && !isFadingOut && (
        <div
          className="absolute pointer-events-none"
          style={{
            left: ordersTabRect.left + ordersTabRect.width / 2 - FINGER_SIZE / 2 - 40,
            top: ordersTabRect.top - FINGER_SIZE - 130,
            width: FINGER_SIZE,
            height: FINGER_SIZE,
            transformOrigin: 'center bottom',
            animation: 'ftue10FingerDown 1.2s ease-in-out infinite',
          }}
        >
          <style>{`
            @keyframes ftue10FingerDown {
              0%, 100% { transform: translateY(0) rotate(180deg); }
              50% { transform: translateY(${FINGER_TAP_DOWN_PX}px) rotate(180deg); }
            }
          `}</style>
          <img
            src={assetPath('/assets/icons/icon_finger.png')}
            alt=""
            className="w-full h-full object-contain"
            style={{ filter: 'drop-shadow(0 2px 6px rgba(0,0,0,0.3))' }}
          />
        </div>
      )}

      {/* Finger pointing straight down at Seeds tab (0s delay, fade in over FINGER2_FADE_MS) */}
      {phase === 'panel_open_orders' && showPanelOpenContent && seedsTabRect && opacity > 0 && !isFadingOut && (
        <div
          className="absolute pointer-events-none"
          style={{
            left: seedsTabRect.left + seedsTabRect.width / 2 - FINGER_SIZE / 2 - 40,
            top: seedsTabRect.top - FINGER_SIZE - 135,
            width: FINGER_SIZE,
            height: FINGER_SIZE,
            transformOrigin: 'center bottom',
            animation: 'ftue10FingerDown 1.2s ease-in-out infinite',
            opacity: finger2Opacity,
            transition: `opacity ${FINGER2_FADE_MS}ms ease-out`,
          }}
        >
          <style>{`
            @keyframes ftue10FingerDown {
              0%, 100% { transform: translateY(0) rotate(180deg); }
              50% { transform: translateY(${FINGER_TAP_DOWN_PX}px) rotate(180deg); }
            }
          `}</style>
          <img
            src={assetPath('/assets/icons/icon_finger.png')}
            alt=""
            className="w-full h-full object-contain"
            style={{ filter: 'drop-shadow(0 2px 6px rgba(0,0,0,0.3))' }}
          />
        </div>
      )}

      {/* Finger at purchase button (FTUE 5 style); show only after Seeds tab transition finished */}
      {isFingerPhase && showFinger3 && purchaseButtonRect && opacity > 0 && !isFadingOut && (
        <div
          className="absolute pointer-events-none"
          style={{
            left: purchaseButtonRect.left + purchaseButtonRect.width / 2 - FINGER_SIZE / 2 + 150,
            top: purchaseButtonRect.top + purchaseButtonRect.height / 2 - FINGER_SIZE / 2 + 5,
            width: FINGER_SIZE,
            height: FINGER_SIZE,
            transformOrigin: 'center center',
            animation: 'ftue5FingerPoint 1.2s ease-in-out infinite',
          }}
        >
          <style>{`
            @keyframes ftue5FingerPoint {
              0%, 100% { transform: translate(0, 0) scaleX(-1) rotate(-45deg); }
              50% { transform: translate(${FINGER_TAP_OFFSET_X}px, ${FINGER_TAP_OFFSET_Y}px) scaleX(-1) rotate(-45deg); }
            }
          `}</style>
          <img
            src={assetPath('/assets/icons/icon_finger.png')}
            alt=""
            className="w-full h-full object-contain"
            style={{ filter: 'drop-shadow(0 2px 6px rgba(0,0,0,0.3))' }}
          />
        </div>
      )}

      {/* Textbox: from panel_open_orders and finger phase */}
      {harvestButtonRect && showTextbox && (
        <div
          className="absolute pointer-events-none"
          style={{
            right: `calc(100vw - ${harvestButtonRect.right}px)`,
            bottom: `calc(100vh - ${harvestButtonRect.top}px + 110px)`,
            ...FTUE_TEXTBOX,
            width: Math.min(380, harvestButtonRect.right - 16),
            maxWidth: 'calc(100vw - 32px)',
            opacity: textboxOpacity,
            transition: `opacity ${(phase === 'panel_open_orders' && showPanelOpenContent) ? FINGER2_FADE_MS : TEXTBOX_FADE_IN_MS}ms ease-out`,
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
          <p className="text-right m-0 font-medium italic leading-snug" style={{ ...FTUE_TEXTBOX_TEXT, paddingLeft: '20px', paddingRight: '20px' }}>
            Use your coins to upgrade your garden
          </p>
        </div>
      )}
    </div>
  );
};
