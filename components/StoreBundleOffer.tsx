/**
 * Store bundle row (`ui_store_large`) — same overlay layout as coin boosters, from top of sprite.
 */
import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { assetPath } from '../utils/assetPath';
import type { StoreBundleOfferConfig } from '../offers';
import { Reward, REWARD_DURATION_TEXT_COLOR } from './Reward';
import {
  STORE_BUNDLE_CARD_ICON_WRAP,
  STORE_BUNDLE_CARD_PURCHASE_ANCHOR,
  STORE_BUNDLE_CARD_TITLE_STYLE,
  STORE_BUNDLE_OFFER_ROW_SCALE,
  STORE_BUNDLE_CARD_REWARD_STRIP_TRANSLATE_Y_PX,
  STORE_BUNDLE_REWARD_FIRST_ROW_HEIGHT_PX,
  STORE_BUNDLE_REWARD_FOLLOWING_ROW_HEIGHT_PX,
  STORE_BUNDLE_REWARD_PILL_GAP_PX,
  STORE_BUNDLE_REWARD_SECOND_ROW_MARGIN_TOP_PX,
  storeBundleRewardOverlayHeightPx,
  STORE_OFFER_CARD_HEADER_ICON_PX,
  STORE_BUNDLE_STACKED_HEADER_ICON_PX,
  STORE_BUNDLE_STACKED_ICON_GAP_PX,
  STORE_BUNDLE_STACKED_TOP_ICON_TRANSLATE_Y_PX,
  STORE_BUNDLE_STACKED_BOTTOM_ICON_TRANSLATE_Y_PX,
  STORE_OFFER_CARD_PURCHASE_BG,
  STORE_OFFER_CARD_PURCHASE_BORDER,
  STORE_OFFER_CARD_PURCHASE_PRESSED_BG,
  STORE_OFFER_CARD_PURCHASE_TEXT,
  STORE_OFFER_CARD_TITLE_BAND,
  STORE_OFFER_CARD_TITLE_TRANSLATE_Y_PX,
} from '../constants/storeOfferCardLayout';

const CARD_WIDTH_PX = 440;

/** Fixed slot above the purchase button so removing the countdown does not shift `valueCalloutText` (e.g. “Limited Offer”). Matches `text-[15px]` + `leading-none` row. */
const STORE_BUNDLE_COUNTDOWN_ROW_MIN_HEIGHT_PX = 15;

/** Cream label (same as blue-pill era); background left transparent. */
const STORE_BUNDLE_VALUE_CALLOUT_COLOR = '#fcf0c7';

/** `self-end` pins the right edge — width sets horizontal slot above the price. */
const STORE_BUNDLE_VALUE_CALLOUT_WIDTH_PX = 95;
const STORE_BUNDLE_VALUE_CALLOUT_HEIGHT_PX = 30;
const STORE_BUNDLE_VALUE_CALLOUT_PAD_X_PX = 4;
const STORE_BUNDLE_VALUE_CALLOUT_TRANSLATE_X_PX = 8;
const STORE_BUNDLE_VALUE_CALLOUT_TRANSLATE_Y_PX = -18;

function StoreBundleValueCallout({ text, boxWidthPx }: { text: string; boxWidthPx: number }) {
  const boxRef = useRef<HTMLDivElement>(null);
  const spanRef = useRef<HTMLSpanElement>(null);
  const [scale, setScale] = useState(1);

  useLayoutEffect(() => {
    const box = boxRef.current;
    const span = spanRef.current;
    if (!box || !span) return;

    const measure = () => {
      const pad = STORE_BUNDLE_VALUE_CALLOUT_PAD_X_PX * 2;
      const maxW = boxWidthPx - pad;
      span.style.transform = 'scale(1)';
      const w = span.scrollWidth;
      if (w <= maxW || maxW <= 0) {
        setScale(1);
      } else {
        setScale(Math.max(0.35, Math.min(1, maxW / w)));
      }
    };

    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(box);
    return () => ro.disconnect();
  }, [text, boxWidthPx]);

  return (
    <div
      ref={boxRef}
      className="pointer-events-none mb-[4px] flex shrink-0 flex-col items-center justify-center self-end overflow-hidden rounded-[8px] border border-solid text-center box-border"
      style={{
        width: boxWidthPx,
        height: STORE_BUNDLE_VALUE_CALLOUT_HEIGHT_PX,
        paddingLeft: STORE_BUNDLE_VALUE_CALLOUT_PAD_X_PX,
        paddingRight: STORE_BUNDLE_VALUE_CALLOUT_PAD_X_PX,
        backgroundColor: 'transparent',
        borderColor: 'transparent',
        transform: `translate(${STORE_BUNDLE_VALUE_CALLOUT_TRANSLATE_X_PX}px, ${STORE_BUNDLE_VALUE_CALLOUT_TRANSLATE_Y_PX}px)`,
      }}
    >
      <span
        ref={spanRef}
        className="inline-block shrink-0 text-[13px] font-black leading-none tracking-tight whitespace-nowrap"
        style={{
          color: STORE_BUNDLE_VALUE_CALLOUT_COLOR,
          transform: `scale(${scale})`,
          transformOrigin: 'center center',
        }}
      >
        {text}
      </span>
    </div>
  );
}

function formatBundleLimitedCountdown(remainingMs: number): string {
  const totalSec = Math.max(0, Math.floor(remainingMs / 1000));
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const sec = totalSec % 60;

  if (h > 0) {
    return `${h}h ${m}m`;
  }
  if (m > 0) {
    return `${m}m ${sec}s`;
  }
  return `${sec}s`;
}

export interface StoreBundleOfferProps {
  config: StoreBundleOfferConfig;
  onPurchase?: (id: string) => void;
  className?: string;
}

export const StoreBundleOffer: React.FC<StoreBundleOfferProps> = ({ config, onPurchase, className = '' }) => {
  const [pressed, setPressed] = useState(false);
  const [bundleCountdownRemainingMs, setBundleCountdownRemainingMs] = useState(0);
  const {
    id,
    title,
    headerIcon,
    headerIconStack,
    offerLineText,
    durationText,
    priceLabel,
    originalPriceLabel,
    valueCalloutText,
    limitedOfferCountdownStorageKey,
    limitedOfferCountdownDurationMs,
    extraRewardRows = [],
    rewardStripIconPath,
  } = config;

  useEffect(() => {
    if (!limitedOfferCountdownStorageKey || !limitedOfferCountdownDurationMs) {
      setBundleCountdownRemainingMs(0);
      return;
    }
    const key = limitedOfferCountdownStorageKey;
    const duration = limitedOfferCountdownDurationMs;
    let endMs: number;
    try {
      const raw = localStorage.getItem(key);
      if (raw == null) {
        endMs = Date.now() + duration;
        localStorage.setItem(key, String(endMs));
      } else {
        endMs = parseInt(raw, 10);
        if (!Number.isFinite(endMs)) {
          endMs = Date.now() + duration;
          localStorage.setItem(key, String(endMs));
        }
      }
    } catch {
      endMs = Date.now() + duration;
    }

    const tick = () => setBundleCountdownRemainingMs(Math.max(0, endMs - Date.now()));
    tick();
    const intervalId = window.setInterval(tick, 1000);
    return () => window.clearInterval(intervalId);
  }, [limitedOfferCountdownStorageKey, limitedOfferCountdownDurationMs]);

  const showLimitedCountdown =
    Boolean(limitedOfferCountdownStorageKey && limitedOfferCountdownDurationMs && bundleCountdownRemainingMs > 0);

  const rewardRows = [
    { offerLineText, durationText, coinIconPath: rewardStripIconPath },
    ...extraRewardRows.map((r) => ({
      offerLineText: r.offerLineText,
      durationText: r.durationText,
      coinIconPath: r.coinIconPath,
      coinIconScale: r.coinIconScale,
    })),
  ];
  const rewardOverlayHeightPx = storeBundleRewardOverlayHeightPx(rewardRows.length);

  const valueCalloutBoxWidthPx = STORE_BUNDLE_VALUE_CALLOUT_WIDTH_PX;

  return (
    <div className={`flex w-full justify-center flex-shrink-0 ${className}`}>
      <div
        style={{
          width: CARD_WIDTH_PX,
          transform: `scale(${STORE_BUNDLE_OFFER_ROW_SCALE})`,
          transformOrigin: 'top center',
        }}
      >
        <div className="relative max-w-full flex-shrink-0" style={{ width: CARD_WIDTH_PX, overflow: 'visible' }}>
        <img
          src={assetPath('/assets/topui/ui_store_large.png')}
          alt=""
          className="w-full h-auto block pointer-events-none select-none"
        />
        <div
          className="absolute inset-0 flex flex-col pointer-events-none select-none"
          style={{ overflow: 'visible' }}
        >
          <div
            className="shrink-0 w-full flex items-start justify-start box-border"
            style={{ ...STORE_OFFER_CARD_TITLE_BAND }}
          >
            <h2
              className="text-left leading-tight"
              style={{
                ...STORE_BUNDLE_CARD_TITLE_STYLE,
                transform: `translateY(${STORE_OFFER_CARD_TITLE_TRANSLATE_Y_PX}px)`,
              }}
            >
              {title}
            </h2>
          </div>

          <div
            className="flex-1 min-h-0 w-full relative flex flex-row items-start overflow-visible"
          >
            <div
              className="relative z-[2] flex shrink-0 self-start items-center justify-center box-border overflow-visible"
              style={{ ...STORE_BUNDLE_CARD_ICON_WRAP }}
            >
              {headerIconStack ? (
                <div
                  className="flex shrink-0 flex-col items-center justify-center"
                  style={{ gap: STORE_BUNDLE_STACKED_ICON_GAP_PX }}
                >
                  {headerIconStack.map((iconPath, idx) => (
                    <img
                      key={idx}
                      src={assetPath(iconPath)}
                      alt=""
                      className="object-contain block max-w-none max-h-none shrink-0"
                      style={{
                        width: STORE_BUNDLE_STACKED_HEADER_ICON_PX,
                        height: STORE_BUNDLE_STACKED_HEADER_ICON_PX,
                        transform: `translateY(${
                          idx === 0
                            ? STORE_BUNDLE_STACKED_TOP_ICON_TRANSLATE_Y_PX
                            : STORE_BUNDLE_STACKED_BOTTOM_ICON_TRANSLATE_Y_PX
                        }px)`,
                      }}
                    />
                  ))}
                </div>
              ) : (
                <div
                  className="flex items-center justify-center shrink-0"
                  style={{ width: STORE_OFFER_CARD_HEADER_ICON_PX, height: STORE_OFFER_CARD_HEADER_ICON_PX }}
                >
                  <img
                    src={assetPath(headerIcon)}
                    alt=""
                    className="object-contain block max-w-none max-h-none"
                    style={{ width: STORE_OFFER_CARD_HEADER_ICON_PX, height: STORE_OFFER_CARD_HEADER_ICON_PX }}
                  />
                </div>
              )}
            </div>

            <div
              className="pointer-events-none absolute left-0 right-0 top-0 z-[1] overflow-visible flex flex-col"
              style={{
                height: rewardOverlayHeightPx,
                transform: `translateY(${STORE_BUNDLE_CARD_REWARD_STRIP_TRANSLATE_Y_PX}px)`,
              }}
            >
              {rewardRows.map((row, idx) => (
                <div
                  key={idx}
                  className="relative w-full shrink-0 overflow-visible"
                  style={{
                    height: idx === 0 ? STORE_BUNDLE_REWARD_FIRST_ROW_HEIGHT_PX : STORE_BUNDLE_REWARD_FOLLOWING_ROW_HEIGHT_PX,
                    marginTop:
                      idx === 0
                        ? 0
                        : idx === 1
                          ? STORE_BUNDLE_REWARD_SECOND_ROW_MARGIN_TOP_PX
                          : STORE_BUNDLE_REWARD_PILL_GAP_PX,
                  }}
                >
                  <Reward
                    offerLineText={row.offerLineText}
                    durationText={row.durationText}
                    coinIconPath={row.coinIconPath}
                    coinIconScale={row.coinIconScale}
                  />
                </div>
              ))}
            </div>
          </div>

          <div
            className="absolute z-[2] pointer-events-none flex flex-col items-end"
            style={{
              bottom: STORE_BUNDLE_CARD_PURCHASE_ANCHOR.bottom,
              right: STORE_BUNDLE_CARD_PURCHASE_ANCHOR.right,
            }}
          >
            {valueCalloutText ? (
              <StoreBundleValueCallout text={valueCalloutText} boxWidthPx={valueCalloutBoxWidthPx} />
            ) : null}
            {/* Column width = button width; strikethrough centered same as price inside button */}
            <div className="inline-flex flex-col items-stretch gap-[4px]">
              {/* Always reserve one line so countdown unmount does not shrink the column and move the callout above */}
              <div
                className="pointer-events-none flex shrink-0 items-center justify-center self-stretch text-center"
                style={{ minHeight: STORE_BUNDLE_COUNTDOWN_ROW_MIN_HEIGHT_PX }}
                aria-hidden={!showLimitedCountdown && !originalPriceLabel}
              >
                {showLimitedCountdown ? (
                  <span
                    className="text-[15px] font-black tracking-tight leading-none"
                    style={{ color: REWARD_DURATION_TEXT_COLOR }}
                  >
                    {formatBundleLimitedCountdown(bundleCountdownRemainingMs)}
                  </span>
                ) : originalPriceLabel ? (
                  <span
                    className="text-[15px] font-black tracking-tight leading-none line-through"
                    style={{ color: REWARD_DURATION_TEXT_COLOR }}
                  >
                    {originalPriceLabel}
                  </span>
                ) : null}
              </div>
              <button
                type="button"
                className="pointer-events-auto flex items-center justify-center px-[8px] rounded-[9px] transition-all border outline outline-1"
                style={{
                  height: 36,
                  backgroundColor: pressed ? STORE_OFFER_CARD_PURCHASE_PRESSED_BG : STORE_OFFER_CARD_PURCHASE_BG,
                  borderColor: STORE_OFFER_CARD_PURCHASE_BORDER,
                  borderBottomWidth: pressed ? 0 : 4,
                  marginBottom: pressed ? 4 : 0,
                  outlineColor: STORE_OFFER_CARD_PURCHASE_BORDER,
                  minWidth: '86px',
                  transform: pressed ? 'translateY(2px)' : 'translateY(0)',
                  boxShadow: pressed
                    ? 'inset 0 2px 4px rgba(0,0,0,0.15)'
                    : 'inset 0 1px 1px rgba(255,255,255,0.4)',
                  cursor: 'pointer',
                }}
                onPointerDown={(e) => {
                  e.stopPropagation();
                  setPressed(true);
                }}
                onPointerUp={() => setPressed(false)}
                onPointerLeave={() => setPressed(false)}
                onClick={(e) => {
                  e.stopPropagation();
                  onPurchase?.(id);
                }}
              >
                <span className="text-[15px] font-black tracking-tight leading-none" style={{ color: STORE_OFFER_CARD_PURCHASE_TEXT }}>
                  {priceLabel}
                </span>
              </button>
            </div>
          </div>
        </div>
        </div>
      </div>
    </div>
  );
};
