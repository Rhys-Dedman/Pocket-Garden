/**
 * Performance mode: when ON, caps FPS at 30 and reduces particles/trails for low-end devices.
 * Persisted in localStorage so it survives refresh.
 */

const STORAGE_KEY = 'farm-merge-performance-mode';

let performanceMode = false;

function readFromStorage(): boolean {
  if (typeof localStorage === 'undefined') return false;
  try {
    return localStorage.getItem(STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

/** Current value (read by animation code and harvest logic). */
export function getPerformanceMode(): boolean {
  return performanceMode;
}

/** Set and persist. Call when user toggles in settings. */
export function setPerformanceMode(on: boolean): void {
  performanceMode = on;
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, on ? 'true' : 'false');
    }
  } catch {
    // ignore
  }
}

/** Call once at app init to load from localStorage. */
export function initPerformanceMode(): void {
  performanceMode = readFromStorage();
}
