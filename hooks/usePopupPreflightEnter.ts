import { useLayoutEffect, useRef, type CSSProperties, type RefObject } from 'react';

/** Min time after first layout paint before starting enter animation (ms). */
export const POPUP_PREFLIGHT_MIN_MS = 80;
/** Safety cap: still open if images/fonts never stop loading. */
export const POPUP_PREFLIGHT_LAYOUT_SETTLE_MAX_MS = 2000;

/**
 * Consecutive rAF ticks (after min delay) where height is unchanged AND
 * all <img> descendants are decoded → layout settled.
 */
const STABLE_READS_REQUIRED = 3;

function quantizeHeight(h: number): number {
  return Math.round(h * 4) / 4;
}

/** Returns true when every `<img>` inside `el` has finished loading (or errored). */
function allImagesComplete(el: HTMLElement): boolean {
  const imgs = el.querySelectorAll('img');
  for (let i = 0; i < imgs.length; i++) {
    if (!imgs[i].complete) return false;
  }
  return true;
}

export type PopupAnimWithPreflight = 'hidden' | 'preflight' | 'entering' | 'visible' | 'leaving';

/**
 * When `animState === 'preflight'`, waits for the popup card's layout to fully
 * settle (images decoded, height stable) then calls `onBeginEnter` once.
 *
 * With `layoutRootRef`: ResizeObserver + height stability + image-complete gate.
 * Without it: legacy 2× rAF + min delay only.
 */
export function usePopupPreflightEnter(
  animState: PopupAnimWithPreflight,
  onBeginEnter: () => void,
  layoutRootRef?: RefObject<HTMLElement | null>
): void {
  const onBeginEnterRef = useRef(onBeginEnter);
  onBeginEnterRef.current = onBeginEnter;
  const layoutRootRefLatest = useRef(layoutRootRef);
  layoutRootRefLatest.current = layoutRootRef;

  useLayoutEffect(() => {
    if (animState !== 'preflight') return;
    let cancelled = false;
    const t0 = Date.now();
    let bootRaf1 = 0;
    let bootRaf2 = 0;
    let loopRaf = 0;
    let legacyTimeout = 0;
    let ro: ResizeObserver | null = null;
    let debounceRaf = 0;
    const imgLoadListeners: Array<{ img: HTMLImageElement; handler: () => void }> = [];

    const finish = () => {
      if (!cancelled) onBeginEnterRef.current();
    };

    let lastQuantized: number | undefined;
    let stableCount = 0;

    const tick = () => {
      if (cancelled) return;
      loopRaf = 0;
      const elapsed = Date.now() - t0;
      const refObj = layoutRootRefLatest.current;

      if (elapsed >= POPUP_PREFLIGHT_LAYOUT_SETTLE_MAX_MS) {
        finish();
        return;
      }

      // No layout ref → fall back to legacy timer-only path
      if (refObj === undefined) {
        const rest = Math.max(0, POPUP_PREFLIGHT_MIN_MS - elapsed);
        legacyTimeout = window.setTimeout(finish, rest);
        return;
      }

      const el = refObj.current;
      if (!el) {
        loopRaf = requestAnimationFrame(tick);
        return;
      }

      // Gate: all <img> elements must be decoded before we consider height "stable"
      if (!allImagesComplete(el)) {
        stableCount = 0;
        loopRaf = requestAnimationFrame(tick);
        return;
      }

      const h = quantizeHeight(el.getBoundingClientRect().height);

      // Enforce minimum wait before accepting stability
      if (elapsed < POPUP_PREFLIGHT_MIN_MS) {
        lastQuantized = h;
        stableCount = 0;
        loopRaf = requestAnimationFrame(tick);
        return;
      }

      if (lastQuantized === undefined || h !== lastQuantized) {
        lastQuantized = h;
        stableCount = 0;
      } else {
        stableCount += 1;
      }

      if (stableCount >= STABLE_READS_REQUIRED) {
        finish();
        return;
      }

      loopRaf = requestAnimationFrame(tick);
    };

    const scheduleTick = () => {
      if (cancelled) return;
      if (loopRaf) cancelAnimationFrame(loopRaf);
      loopRaf = requestAnimationFrame(tick);
    };

    bootRaf1 = requestAnimationFrame(() => {
      bootRaf2 = requestAnimationFrame(() => {
        if (cancelled) return;
        const refObj = layoutRootRefLatest.current;
        const el = refObj !== undefined ? refObj.current : null;

        if (el) {
          // Watch for size changes from late image loads / font swap
          ro = new ResizeObserver(() => {
            if (cancelled) return;
            lastQuantized = undefined;
            stableCount = 0;
            if (debounceRaf) cancelAnimationFrame(debounceRaf);
            debounceRaf = requestAnimationFrame(() => {
              debounceRaf = 0;
              scheduleTick();
            });
          });
          ro.observe(el);

          // Listen for image load/error on any incomplete <img> so we re-check immediately
          const imgs = el.querySelectorAll('img');
          for (let i = 0; i < imgs.length; i++) {
            const img = imgs[i];
            if (!img.complete) {
              const handler = () => {
                stableCount = 0;
                lastQuantized = undefined;
                scheduleTick();
              };
              img.addEventListener('load', handler);
              img.addEventListener('error', handler);
              imgLoadListeners.push({ img, handler });
            }
          }
        }

        scheduleTick();
      });
    });

    return () => {
      cancelled = true;
      cancelAnimationFrame(bootRaf1);
      cancelAnimationFrame(bootRaf2);
      if (loopRaf) cancelAnimationFrame(loopRaf);
      if (debounceRaf) cancelAnimationFrame(debounceRaf);
      clearTimeout(legacyTimeout);
      ro?.disconnect();
      for (const { img, handler } of imgLoadListeners) {
        img.removeEventListener('load', handler);
        img.removeEventListener('error', handler);
      }
    };
  }, [animState]);
}

/** Styles for the main popup card during preflight (laid out but invisible). */
export function popupCardSurfaceStyle(
  animState: PopupAnimWithPreflight,
  isEntering: boolean,
  isLeaving: boolean,
  enterAnimation: string,
  leaveAnimation: string
): CSSProperties {
  const isPreflight = animState === 'preflight';
  if (isPreflight) {
    return {
      animation: 'none',
      opacity: 0,
      visibility: 'hidden',
      transform: 'scale(1)',
    };
  }
  return {
    animation: isEntering
      ? enterAnimation
      : isLeaving
        ? leaveAnimation
        : 'none',
    transform: animState === 'visible' ? 'scale(1)' : undefined,
    opacity: animState === 'visible' ? 1 : undefined,
  };
}
