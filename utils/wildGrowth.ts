import type { BoardCell } from '../types';

export const WILD_GROWTH_BASE_SEC = 120;
export const WILD_GROWTH_MIN_SEC = 30;
export const WILD_GROWTH_STEP_SEC = 10;
/** Player level at which Wild Growth starts (same as CROPS unlock row for `wild_growth`). */
export const WILD_GROWTH_UNLOCK_PLAYER_LEVEL = 6;
/**
 * Max `wild_growth` upgrade count: at level 9, interval is 30s (0 = 120s auto baseline, no purchases yet).
 */
export const WILD_GROWTH_MAX_LEVEL = 9;

/** Interval from **upgrade count** `wild_growth.level` (0 = 120s at unlock). */
export function getWildGrowthIntervalSecForLevel(upgradeLevel: number): number {
  const n = Math.max(0, Math.floor(upgradeLevel));
  return Math.max(WILD_GROWTH_MIN_SEC, WILD_GROWTH_BASE_SEC - WILD_GROWTH_STEP_SEC * n);
}

export function getWildGrowthIntervalMsForLevel(upgradeLevel: number): number {
  return getWildGrowthIntervalSecForLevel(upgradeLevel) * 1000;
}

/** Seconds shown in upgrade row (120s at level 0). */
export function getWildGrowthDisplaySecForLevel(upgradeLevel: number): number {
  return getWildGrowthIntervalSecForLevel(Math.max(0, Math.floor(upgradeLevel)));
}

export function isWildGrowthMaxLevel(upgradeLevel: number): boolean {
  return Math.max(0, Math.floor(upgradeLevel)) >= WILD_GROWTH_MAX_LEVEL;
}

function getHexNeighborCoords(q: number, r: number): [number, number][] {
  return [
    [q + 1, r],
    [q - 1, r],
    [q, r + 1],
    [q, r - 1],
    [q + 1, r - 1],
    [q - 1, r + 1],
  ];
}

function getAdjacentCellIndices(cellIdx: number, grid: BoardCell[]): number[] {
  const cell = grid[cellIdx];
  if (!cell) return [];
  const neighbors = getHexNeighborCoords(cell.q, cell.r);
  const out: number[] = [];
  grid.forEach((other, otherIdx) => {
    if (otherIdx === cellIdx) return;
    if (neighbors.some(([nq, nr]) => other.q === nq && other.r === nr)) {
      out.push(otherIdx);
    }
  });
  return out;
}

/**
 * Picks an empty unlocked cell for Wild Growth: duplicates the current lowest plant level on the board.
 * Prefers cells adjacent to a lowest-level plant (merge adjacency).
 */
export function pickWildGrowthSpawn(
  grid: BoardCell[],
  reserved: Set<number>
): { targetIdx: number; plantLevel: number } | null {
  const plantCells = grid
    .map((c, i) => (!c.locked && c.item != null ? { i, level: c.item.level } : null))
    .filter((x): x is { i: number; level: number } => x != null);
  if (plantCells.length === 0) return null;

  const minLevel = Math.min(...plantCells.map((p) => p.level));
  const sourceIndices = plantCells.filter((p) => p.level === minLevel).map((p) => p.i);

  const emptyIndices = grid
    .map((c, i) => (!c.locked && c.item === null && !reserved.has(i) ? i : -1))
    .filter((i): i is number => i >= 0);
  if (emptyIndices.length === 0) return null;

  const preferred: number[] = [];
  for (const si of sourceIndices) {
    for (const j of getAdjacentCellIndices(si, grid)) {
      if (emptyIndices.includes(j)) preferred.push(j);
    }
  }

  const pool = preferred.length > 0 ? preferred : emptyIndices;
  const targetIdx = pool[Math.floor(Math.random() * pool.length)];
  return { targetIdx, plantLevel: minLevel };
}

export function spawnWildGrowthPlantOnGrid(grid: BoardCell[], pick: { targetIdx: number; plantLevel: number }): BoardCell[] {
  return grid.map((c, i) => {
    if (i !== pick.targetIdx) return c;
    if (c.locked || c.item !== null) return c;
    return {
      ...c,
      item: {
        id: Math.random().toString(36).slice(2, 11),
        level: pick.plantLevel,
        type: 'CROP',
      },
    };
  });
}
