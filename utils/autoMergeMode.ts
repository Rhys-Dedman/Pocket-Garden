/**
 * Auto-merge: when ON, the board can automatically merge the lowest matching pair (after FTUE 11).
 * Default OFF. Persisted in localStorage like Performance mode.
 */

export const AUTO_MERGE_STORAGE_KEY = 'farm-merge-auto-merge';

let autoMergeMode = false;

function readFromStorage(): boolean {
  if (typeof localStorage === 'undefined') return false;
  try {
    return localStorage.getItem(AUTO_MERGE_STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

export function getAutoMergeMode(): boolean {
  return autoMergeMode;
}

export function setAutoMergeMode(on: boolean): void {
  autoMergeMode = on;
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(AUTO_MERGE_STORAGE_KEY, on ? 'true' : 'false');
    }
  } catch {
    // ignore
  }
}

export function initAutoMergeMode(): void {
  autoMergeMode = readFromStorage();
}
