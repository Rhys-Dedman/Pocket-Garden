import { useLayoutEffect, useRef, type CSSProperties } from 'react';

/** Min time after first layout paint before starting enter animation (ms). */
export const POPUP_PREFLIGHT_MIN_MS = 100;

export type PopupAnimWithPreflight = 'hidden' | 'preflight' | 'entering' | 'visible' | 'leaving';

/**
 * When `animState === 'preflight'`, waits for layout (2× rAF) + `POPUP_PREFLIGHT_MIN_MS`,
 * then calls `onBeginEnter` once (typically: init leaves + setAnimState('entering')).
 */
export function usePopupPreflightEnter(animState: PopupAnimWithPreflight, onBeginEnter: () => void): void {
  const onBeginEnterRef = useRef(onBeginEnter);
  onBeginEnterRef.current = onBeginEnter;

  useLayoutEffect(() => {
    if (animState !== 'preflight') return;
    let cancelled = false;
    const t0 = Date.now();
    let raf1 = 0;
    let raf2 = 0;
    let timeoutId = 0;
    raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => {
        if (cancelled) return;
        const rest = Math.max(0, POPUP_PREFLIGHT_MIN_MS - (Date.now() - t0));
        timeoutId = window.setTimeout(() => {
          if (!cancelled) onBeginEnterRef.current();
        }, rest);
      });
    });
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
      clearTimeout(timeoutId);
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
