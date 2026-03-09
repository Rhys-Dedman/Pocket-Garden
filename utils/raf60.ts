import { getPerformanceMode } from './performanceMode';

/**
 * 60fps cap for game loops. Use so we don't waste work on 90/120Hz displays.
 * One shared constant – change here if you ever want a different cap.
 */
export const TARGET_FPS = 60;
export const TARGET_FRAME_MS = 1000 / TARGET_FPS;

/** 30fps for things that don't need 60 (e.g. progress ring visual updates). */
export const TARGET_FPS_30 = 30;
export const TARGET_FRAME_MS_30 = 1000 / TARGET_FPS_30;

/** 10fps for very slow UI (e.g. boost timer ring that drains over minutes). */
export const TARGET_FPS_10 = 10;
export const TARGET_FRAME_MS_10 = 1000 / TARGET_FPS_10;

/** Max ticks to run per frame when catching up (e.g. after tab was backgrounded). */
const MAX_TICK_CATCH_UP = 5;

/**
 * Returns how many 60fps "ticks" have elapsed since last call (wall-clock).
 * Use for FPS counting and game loops that need a true 60 updates/sec regardless
 * of rAF rate (e.g. 100Hz display would otherwise only give 50 ticks/sec).
 * Ref stores last performance.now() we accounted for; pass same ref each time.
 */
export function getTickCount60(ref: { current: number }): number {
  const now = performance.now();
  const last = ref.current || 0;
  const lastIdx = Math.floor(last / TARGET_FRAME_MS);
  const nowIdx = Math.floor(now / TARGET_FRAME_MS);
  const count = Math.min(Math.max(0, nowIdx - lastIdx), MAX_TICK_CATCH_UP);
  ref.current = now;
  return count;
}

/**
 * Call at the start of your RAF tick. Returns true when at least one
 * 60fps tick has elapsed (wall-clock). Use to cap update rate at 60fps.
 * For loops that must run exactly N times per second, use getTickCount60 and run N times.
 */
export function shouldTick60(lastTickRef: { current: number }): boolean {
  return getTickCount60(lastTickRef) >= 1;
}

/** Same as shouldTick60 but for 30fps (e.g. progress rings). */
export function shouldTick30(lastTickRef: { current: number }): boolean {
  const now = performance.now();
  if (now - lastTickRef.current >= TARGET_FRAME_MS_30) {
    lastTickRef.current = now;
    return true;
  }
  return false;
}

/** Same as shouldTick60 but for 10fps (e.g. slow countdown rings). */
export function shouldTick10(lastTickRef: { current: number }): boolean {
  const now = performance.now();
  if (now - lastTickRef.current >= TARGET_FRAME_MS_10) {
    lastTickRef.current = now;
    return true;
  }
  return false;
}

/**
 * When Performance mode is ON, caps at 30fps; otherwise normal rAF.
 * Use in animation loops: rafRef.current = scheduleNextFrame(tick);
 */
let lastFrame30 = 0;
export function scheduleNextFrame(callback: FrameRequestCallback): number {
  if (!getPerformanceMode()) return requestAnimationFrame(callback);
  return requestAnimationFrame(function frame(now: number) {
    const t = typeof now === 'number' ? now : performance.now();
    if (t - lastFrame30 >= TARGET_FRAME_MS_30) {
      lastFrame30 = t;
      callback(t);
    } else {
      scheduleNextFrame(callback);
    }
  });
}
