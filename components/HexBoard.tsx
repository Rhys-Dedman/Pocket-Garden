import React, { useRef, useEffect, useCallback, useState } from 'react';
import { flushSync } from 'react-dom';
import { BoardCell, Item, DragState } from '../types';
import { PLANT_CONTAINER_WIDTH, PLANT_CONTAINER_HEIGHT } from '../constants/boardLayout';
import { assetPath } from '../utils/assetPath';
import { PlantWithPot } from './PlantWithPot';

/** Set to false to disable swapping plants (drop on non-match just returns to original cell) */
const ENABLE_SWAP = false;

const LIFT_MS = 120;
const SCALE_UP_MS = 60;
const FLYBACK_SPEED_PX_PER_MS = 1;
const FLYBACK_MIN_MS = 50;
const IMPACT_BOUNCE_MS = 400;
const SWAP_RETURN_MS = 200;

interface SwapReturnState {
  item: Item;
  fromCellIdx: number;
  toCellIdx: number;
  progress: number;
  startTime: number;
}

interface HexBoardProps {
  isActive?: boolean;
  grid: BoardCell[];
  onMerge: (sourceIdx: number, targetIdx: number) => void;
  onSwap: (sourceIdx: number, targetIdx: number) => void;
  impactCellIdx: number | null;
  returnImpactCellIdx: number | null;
  onReturnImpact: (cellIdx: number | null) => void;
  onLandOnNewCell: (targetIdx: number) => void;
  onReleaseFromCell: (cellIdx: number) => void;
  sourceCellFadeOutIdx: number | null;
  newCellImpactIdx: number | null;
  containerRef: React.RefObject<HTMLDivElement | null>;
  dragState: DragState | null;
  setDragState: React.Dispatch<React.SetStateAction<DragState | null>>;
  harvestBounceCellIndices?: number[];
  onMergeImpactStart?: (cellIdx: number, x: number, y: number, mergeResultLevel?: number) => void;
  /** Returns the level increase for a merge (1 normally, 2 for lucky merge). Called when merge starts with current plant level. */
  getMergeLevelIncrease?: (currentPlantLevel: number) => number;
  /** Called when a locked cell is tapped (opens upgrade panel to CROPS) */
  onLockedCellTap?: () => void;
  /** Cell indices currently being unlocked (for unlock animation) */
  unlockingCellIndices?: number[];
  /** Cell indices currently being fertilized (for fertilize animation) */
  fertilizingCellIndices?: number[];
  /** App scale factor for coordinate calculations */
  appScale?: number;
  /** Called when a plant is deleted by dropping outside hex cells */
  onDeletePlant?: (cellIdx: number, x: number, y: number) => void;
  /** FTUE_3: when true, only allow drag from cell 4 to cell 13 (merge). Any other drop returns plant to 4. */
  ftue3OnlyMerge4To13?: boolean;
}

const HEX_SPRITE_EXT = '.png';
const HEXCELL_GREEN = assetPath(`/assets/hex/hexcell_green${HEX_SPRITE_EXT}`);
const HEXCELL_SHADOW = assetPath(`/assets/hex/hexcell_shadow${HEX_SPRITE_EXT}`);
const HEXCELL_WHITE = assetPath(`/assets/hex/hexcell_white${HEX_SPRITE_EXT}`);
const HEXCELL_LOCKED = assetPath(`/assets/hex/hexcell_locked${HEX_SPRITE_EXT}`);
const HEXCELL_FERTILE = assetPath(`/assets/hex/hexcell_fertile${HEX_SPRITE_EXT}`);

export const HexBoard: React.FC<HexBoardProps> = ({
  isActive,
  grid,
  onMerge,
  onSwap,
  impactCellIdx,
  returnImpactCellIdx,
  onReturnImpact,
  onLandOnNewCell,
  onReleaseFromCell,
  sourceCellFadeOutIdx,
  newCellImpactIdx,
  containerRef,
  dragState,
  setDragState,
  harvestBounceCellIndices = [],
  onMergeImpactStart,
  getMergeLevelIncrease,
  onLockedCellTap,
  unlockingCellIndices = [],
  fertilizingCellIndices = [],
  appScale = 1,
  onDeletePlant,
  ftue3OnlyMerge4To13 = false,
}) => {
  const liftStartRef = useRef<number>(0);
  const flyStartRef = useRef<number>(0);
  const rafRef = useRef<number>(0);
  const swapRafRef = useRef<number>(0);
  const [swapReturn, setSwapReturn] = useState<SwapReturnState | null>(null);
  const [swapImpactCellIdx, setSwapImpactCellIdx] = useState<number | null>(null);

  // Logical size for grid positioning
  const hexSize = 34.2;
  // Visual scale: higher = cells closer together
  const visualScale = 0.96;
  // Vertical squash: hex cells 5% shorter (0.95 height)
  const verticalSquash = 0.95;
  // Vertical spacing scaled to match shorter hex for even gaps
  const verticalSpacing = verticalSquash;
  // X-axis spacing between cells
  const horizontalSpacing = 1.0;
  // Bring all cells slightly closer (keeps x/y ratio); slightly higher = tiny bit more space
  const gridSpacing = 0.96;
  // Overall grid 15% larger (was 10%, +5%)
  const gridScale = 1.155;
  const shadowOffsetY = 5;

  const hexWidth = PLANT_CONTAINER_WIDTH;
  const hexHeight = PLANT_CONTAINER_HEIGHT;
  // Hex cells 20% bigger; shadow/green/white all use same size
  const cellScale = 1.2;
  const hexDisplayW = hexWidth * cellScale;
  const hexDisplayH = hexHeight * cellScale;

  const hideBrokenHexImg = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const el = e.currentTarget;
    el.style.opacity = '0';
    el.style.pointerEvents = 'none';
  };

  const getHexCenterInContainer = useCallback((cellIdx: number) => {
    const hexEl = document.getElementById(`hex-${cellIdx}`);
    const container = containerRef.current;
    if (!hexEl || !container) return { x: 0, y: 0 };
    const hexRect = hexEl.getBoundingClientRect();
    const contRect = container.getBoundingClientRect();
    return {
      x: (hexRect.left + hexRect.width / 2 - contRect.left) / appScale,
      y: (hexRect.top + hexRect.height / 2 - contRect.top) / appScale,
    };
  }, [containerRef, appScale]);

  /** Closest hex cell by distance from point (container coords); null if too far (drop = cancel / delete). Uses pointer position so selection matches where the finger/plant is. */
  const getClosestHexIndexToPlantCenter = useCallback(
    (plantCx: number, plantCy: number): number | null => {
      const container = containerRef.current;
      if (!container || grid.length === 0) return null;
      const sampleHex = document.getElementById('hex-0');
      let maxDist = 56;
      if (sampleHex) {
        const r = sampleHex.getBoundingClientRect();
        const w = r.width / appScale;
        const h = r.height / appScale;
        maxDist = Math.max(w, h) * 0.72;
      }
      let bestIdx: number | null = null;
      let bestD2 = Infinity;
      for (let i = 0; i < grid.length; i++) {
        const c = getHexCenterInContainer(i);
        const dx = plantCx - c.x;
        const dy = plantCy - c.y;
        const d2 = dx * dx + dy * dy;
        if (d2 < bestD2) {
          bestD2 = d2;
          bestIdx = i;
        }
      }
      if (bestIdx == null) return null;
      return Math.sqrt(bestD2) <= maxDist ? bestIdx : null;
    },
    [grid.length, getHexCenterInContainer, containerRef, appScale]
  );

  const startDrag = useCallback((cellIdx: number, clientX: number, clientY: number) => {
    const cell = grid[cellIdx];
    if (!cell?.item) return;
    const container = containerRef.current;
    if (!container) return;
    const contRect = container.getBoundingClientRect();
    const origin = getHexCenterInContainer(cellIdx);
    const pointerX = (clientX - contRect.left) / appScale;
    const pointerY = (clientY - contRect.top) / appScale;
    setDragState({
      phase: 'holding',
      cellIdx,
      item: cell.item,
      pointerX,
      pointerY,
      originX: origin.x,
      originY: origin.y,
      grabPointerX: pointerX,
      grabPointerY: pointerY,
      liftProgress: 0,
      scaleProgress: 0,
    });
    liftStartRef.current = Date.now();
  }, [grid, getHexCenterInContainer, containerRef, appScale]);

  const startFlyBack = useCallback((state: DragState, targetIdx?: number, isMerge?: boolean, isSwap?: boolean) => {
    const curX = state.pointerX;
    const curY = state.pointerY;
    let toX: number;
    let toY: number;
    let nextState: DragState;
    if (targetIdx != null) {
      const targetCenter = getHexCenterInContainer(targetIdx);
      toX = targetCenter.x;
      toY = targetCenter.y;
      // Calculate merge result level now (includes lucky merge chance) so animation shows correct level
      const levelIncrease = isMerge ? (getMergeLevelIncrease?.(state.item.level) ?? 1) : 0;
      nextState = {
        ...state,
        targetCellIdx: targetIdx,
        hoveredEmptyCellIdx: null,
        hoveredMatchCellIdx: null,
        hoveredSwapCellIdx: null,
        isMerge: isMerge === true,
        isSwap: isSwap === true,
        mergeResultLevel: isMerge ? state.item.level + levelIncrease : undefined,
      };
    } else {
      toX = state.originX;
      toY = state.originY;
      nextState = { ...state, hoveredEmptyCellIdx: null, hoveredMatchCellIdx: null, hoveredSwapCellIdx: null };
    }
    const distance = Math.hypot(toX - curX, toY - curY);
    const durationMs = Math.max(FLYBACK_MIN_MS, distance / FLYBACK_SPEED_PX_PER_MS);
    flyStartRef.current = Date.now();
    setDragState({
      ...nextState,
      phase: 'flyingBack',
      flyProgress: 0,
      flyBackDurationMs: durationMs,
    });
  }, [getHexCenterInContainer, getMergeLevelIncrease]);

  // Pointer down: start pickup immediately if cell has plant (allowed during impact)
  const handlePointerDown = useCallback((index: number, e: React.PointerEvent) => {
    e.preventDefault();
    const cell = grid[index];
    // If cell is locked, trigger the locked cell tap callback (opens upgrade panel)
    if (cell?.locked) {
      onLockedCellTap?.();
      return;
    }
    // If cell is empty (unlocked), do nothing
    if (!cell?.item) {
      return;
    }
    // FTUE_3: only allow starting a drag from cell 4 (not cell 13)
    if (ftue3OnlyMerge4To13 && index !== 4) return;
    if (dragState && dragState.phase !== 'impact') return;
    startDrag(index, e.clientX, e.clientY);
  }, [grid, dragState, startDrag, onLockedCellTap, ftue3OnlyMerge4To13]);

  // Global pointer move/up/cancel (attach in useEffect)
  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      if (dragState?.phase === 'holding') {
        const container = containerRef.current;
        if (!container) return;
        const contRect = container.getBoundingClientRect();
        const pointerX = (e.clientX - contRect.left) / appScale;
        const pointerY = (e.clientY - contRect.top) / appScale;
        // Use pointer (finger) position as plant center — dragged plant visually follows the finger
        const underIdx = getClosestHexIndexToPlantCenter(dragState.pointerX, dragState.pointerY);
        const targetCell = underIdx != null ? grid[underIdx] : null;
        // Locked cells cannot be hovered as drop targets
        const isLocked = targetCell?.locked === true;
        const hoveredEmptyCellIdx =
          underIdx != null && underIdx !== dragState.cellIdx && !isLocked && grid[underIdx]?.item == null ? underIdx : null;
        const targetItem = underIdx != null && underIdx !== dragState.cellIdx && !isLocked ? grid[underIdx]?.item : null;
        const hoveredMatchCellIdx =
          targetItem != null && underIdx != null && targetItem.level === dragState.item.level && targetItem.type === dragState.item.type ? underIdx : null;
        // Swap: hovering over a non-matching plant (different level)
        const hoveredSwapCellIdx =
          targetItem != null && underIdx != null && hoveredMatchCellIdx == null ? underIdx : null;
        setDragState((prev) => prev ? { ...prev, pointerX, pointerY, hoveredEmptyCellIdx, hoveredMatchCellIdx, hoveredSwapCellIdx } : null);
      }
    };
    const onUp = (e: PointerEvent) => {
      if (dragState?.phase === 'holding') {
        const container = containerRef.current;
        if (!container) return;
        const contRect = container.getBoundingClientRect();
        const dropX = (e.clientX - contRect.left) / appScale;
        const dropY = (e.clientY - contRect.top) / appScale;
        const releaseState = { ...dragState, pointerX: dropX, pointerY: dropY };
        const targetIdx = getClosestHexIndexToPlantCenter(dropX, dropY);
        const inBounds = contRect.left <= e.clientX && e.clientX <= contRect.right && contRect.top <= e.clientY && e.clientY <= contRect.bottom;
        const targetCell = targetIdx != null ? grid[targetIdx] : null;
        // Locked cells cannot be drop targets
        const isLocked = targetCell?.locked === true;
        const isValidMerge = targetIdx != null && targetIdx !== dragState.cellIdx && !isLocked && targetCell?.item && targetCell.item.level === dragState.item.level;
        const isEmptyCell = targetIdx != null && targetIdx !== dragState.cellIdx && !isLocked && targetCell?.item == null;
        const droppedOnSameCell = targetIdx === dragState.cellIdx;
        // Check for swap: dropping on a plant that can't merge (different level)
        const isSwapTarget = targetIdx != null && targetIdx !== dragState.cellIdx && !isLocked && targetCell?.item && targetCell.item.level !== dragState.item.level;

        // FTUE_3: only allow drag from cell 4 to cell 13 (merge). Any other drop returns plant to 4.
        if (ftue3OnlyMerge4To13 && dragState.cellIdx === 4) {
          onReleaseFromCell(dragState.cellIdx);
          if (targetIdx === 13 && isValidMerge) {
            startFlyBack(releaseState, 13, true, false);
          } else {
            startFlyBack(releaseState);
          }
          return;
        }

        if (isValidMerge) {
          onReleaseFromCell(dragState.cellIdx);
          startFlyBack(releaseState, targetIdx!, true, false);
        } else if (inBounds && isEmptyCell) {
          onReleaseFromCell(dragState.cellIdx);
          startFlyBack(releaseState, targetIdx!, false, false);
        } else if (ENABLE_SWAP && inBounds && isSwapTarget) {
          // Swap plants (disabled when ENABLE_SWAP is false)
          onReleaseFromCell(dragState.cellIdx);
          startFlyBack(releaseState, targetIdx!, false, true);
        } else if (inBounds && targetIdx == null && !droppedOnSameCell) {
          // Dropped on background (not on any hex cell) - delete the plant
          onDeletePlant?.(dragState.cellIdx, dropX, dropY);
          setDragState(null);
        } else {
          onReleaseFromCell(dragState.cellIdx);
          startFlyBack(releaseState);
        }
      }
    };
    const onCancel = () => {
      if (dragState?.phase === 'holding') setDragState(null);
    };
    window.addEventListener('pointermove', onMove, { passive: true });
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onCancel);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onCancel);
    };
  }, [dragState, getClosestHexIndexToPlantCenter, grid, startFlyBack, containerRef, ftue3OnlyMerge4To13, appScale]);

  // Lift + scale-up: scale 0→1 over SCALE_UP_MS (fast), lift 0→1 over LIFT_MS
  useEffect(() => {
    if (!dragState || dragState.phase !== 'holding') return;
    const tick = () => {
      const elapsed = Date.now() - liftStartRef.current;
      const liftProgress = Math.min(elapsed / LIFT_MS, 1);
      const scaleProgress = Math.min(elapsed / SCALE_UP_MS, 1);
      setDragState((prev) => prev && prev.phase === 'holding' ? { ...prev, liftProgress, scaleProgress } : null);
      if (liftProgress < 1 || scaleProgress < 1) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [dragState?.phase === 'holding' ? dragState.cellIdx : -1]);

  // Fly-back animation: duration from distance, ease-in (slow start → fast slam)
  useEffect(() => {
    if (!dragState || dragState.phase !== 'flyingBack') return;
    const fromX = dragState.pointerX;
    const fromY = dragState.pointerY;
    const toX =
      dragState.targetCellIdx != null
        ? getHexCenterInContainer(dragState.targetCellIdx).x
        : dragState.originX;
    const toY =
      dragState.targetCellIdx != null
        ? getHexCenterInContainer(dragState.targetCellIdx).y
        : dragState.originY;
    const durationMs = dragState.flyBackDurationMs ?? 300;
    const CUTOVER = 0.85;
    const impactStartT = durationMs <= 120 ? 1 : 0.7;
    const tick = () => {
      const elapsed = Date.now() - flyStartRef.current;
      const t = Math.min(elapsed / durationMs, 1);
      const eased =
        t < CUTOVER
          ? CUTOVER * (2.1 * (t / CUTOVER) ** 2 - 1.1 * (t / CUTOVER) ** 3)
          : CUTOVER + (1 - CUTOVER) * ((t - CUTOVER) / (1 - CUTOVER));
      const x = fromX + (toX - fromX) * eased;
      const y = fromY + (toY - fromY) * eased;
      if (t >= impactStartT) {
        const targetCellIdx = dragState.targetCellIdx;
        const isMerge = dragState.isMerge === true;
        const isSwap = dragState.isSwap === true;
        const sourceIdx = dragState.cellIdx;
        if (targetCellIdx == null) {
          onReturnImpact(dragState.cellIdx);
        }
        if (targetCellIdx != null) {
          if (isSwap) {
            // Capture the target item before swap for the return animation
            const targetItem = grid[targetCellIdx]?.item;
            if (targetItem) {
              setSwapReturn({
                item: targetItem,
                fromCellIdx: targetCellIdx,
                toCellIdx: sourceIdx,
                progress: 0,
                startTime: Date.now(),
              });
            }
            onSwap(sourceIdx, targetCellIdx);
          } else {
            onMerge(sourceIdx, targetCellIdx);
            if (!isMerge) onLandOnNewCell(targetCellIdx);
          }
        }
        if (isMerge && targetCellIdx != null) {
          // Use the pre-calculated mergeResultLevel (includes lucky merge)
          onMergeImpactStart?.(targetCellIdx, toX, toY, dragState.mergeResultLevel);
        }
        flushSync(() => {
          setDragState((prev) =>
            prev && prev.phase === 'flyingBack'
              ? {
                  ...prev,
                  phase: 'impact',
                  impactStartTime: Date.now(),
                  flyProgress: 1,
                  pointerX: toX,
                  pointerY: toY,
                  // Keep the pre-calculated mergeResultLevel from flyingBack phase
                }
              : prev
          );
        });
        setTimeout(() => {
          setDragState((prev) =>
            prev && prev.phase === 'impact' && prev.cellIdx === sourceIdx && prev.targetCellIdx === targetCellIdx
              ? null
              : prev
          );
        }, IMPACT_BOUNCE_MS);
        return;
      }
      setDragState((prev) =>
        prev && prev.phase === 'flyingBack'
          ? { ...prev, flyProgress: t, pointerX: x, pointerY: y }
          : prev
      );
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [dragState?.phase === 'flyingBack' ? dragState.cellIdx : -1, dragState?.targetCellIdx, getHexCenterInContainer, onReturnImpact, onMergeImpactStart, onMerge, onSwap, onLandOnNewCell, grid]);

  // Swap return animation: animate the swapped plant flying to its new cell
  useEffect(() => {
    if (!swapReturn) return;
    const tick = () => {
      const elapsed = Date.now() - swapReturn.startTime;
      const progress = Math.min(elapsed / SWAP_RETURN_MS, 1);
      // Ease-out for smooth deceleration
      const eased = 1 - Math.pow(1 - progress, 2);
      if (progress >= 1) {
        // Trigger impact animation at the destination cell
        setSwapImpactCellIdx(swapReturn.toCellIdx);
        setTimeout(() => setSwapImpactCellIdx(null), IMPACT_BOUNCE_MS);
        setSwapReturn(null);
        return;
      }
      setSwapReturn(prev => prev ? { ...prev, progress: eased } : null);
      swapRafRef.current = requestAnimationFrame(tick);
    };
    swapRafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(swapRafRef.current);
  }, [swapReturn?.startTime]);

  const centerX = '50%';
  const centerY = '48%'; 

  return (
    <>
      <style>{`
        @keyframes impactPulse {
          0% { transform: scale(1); }
          50% { transform: scale(1.1); }
          100% { transform: scale(1); }
        }
        .impact-pulse {
          animation: impactPulse 150ms ease-out;
        }
        @keyframes plantSpawnBounce {
          0% { opacity: 0; transform: scale(0.25); }
          25% { opacity: 1; transform: scale(1.5); }
          50% { transform: scale(0.8); }
          75% { transform: scale(1.1); }
          100% { opacity: 1; transform: scale(1); }
        }
        .plant-spawn-bounce {
          animation: plantSpawnBounce 300ms ease-out forwards;
        }
        @keyframes hexcellWhiteFlash {
          0% { opacity: 0; }
          50% { opacity: 0.5; }
          100% { opacity: 0; }
        }
        .hexcell-white-flash {
          animation: hexcellWhiteFlash 200ms ease-out forwards;
        }
        @keyframes hexcellReturnFlash {
          0% { opacity: 0; }
          50% { opacity: 0.5; }
          100% { opacity: 0; }
        }
        .hexcell-return-flash {
          animation: hexcellReturnFlash 100ms ease-out forwards;
        }
        @keyframes hexcellSourceFadeOut {
          0% { opacity: 0.5; }
          100% { opacity: 0; }
        }
        .hexcell-source-fade-out {
          animation: hexcellSourceFadeOut 150ms ease-out forwards;
        }
        @keyframes hexcellNewLandFlash {
          0% { opacity: 0.5; }
          50% { opacity: 0.75; }
          100% { opacity: 0; }
        }
        .hexcell-new-land-flash {
          animation: hexcellNewLandFlash 300ms ease-out forwards;
        }
        @keyframes plantImpactScale {
          0% { transform: translateY(-5.5px) scale(1); }
          25% { transform: translateY(-5.5px) scale(1.8); }
          50% { transform: translateY(-5.5px) scale(1.3); }
          75% { transform: translateY(-5.5px) scale(1.6); }
          100% { transform: translateY(-5.5px) scale(1.5); }
        }
        .plant-impact-scale {
          animation: plantImpactScale 400ms ease-out forwards;
        }
        @keyframes plantImpactScaleSoft {
          0% { transform: translateY(-5.5px) scale(1.25); }
          50% { transform: translateY(-5.5px) scale(1.65); }
          100% { transform: translateY(-5.5px) scale(1.5); }
        }
        .plant-impact-scale-soft {
          animation: plantImpactScaleSoft 250ms ease-out forwards;
        }
        @keyframes plantHarvestBounce {
          0% { transform: translateY(-5.5px) scale(1.5); }
          33% { transform: translateY(-5.5px) scale(1.8); }
          66% { transform: translateY(-5.5px) scale(1.4); }
          100% { transform: translateY(-5.5px) scale(1.5); }
        }
        .plant-harvest-bounce {
          animation: plantHarvestBounce 200ms ease-out forwards;
        }
        @keyframes hexcellUnlockBounce {
          0% { transform: scale(1); }
          50% { transform: scale(1.3); }
          100% { transform: scale(1); }
        }
        .hexcell-unlock-bounce {
          animation: hexcellUnlockBounce 200ms ease-out forwards;
        }
        .hex-cell-img {
          display: block;
        }
        .hex-cell-img[src=""],
        .hex-cell-img:not([src]) {
          opacity: 0;
          pointer-events: none;
        }
      `}</style>
      <div 
        className="relative w-full h-full flex items-center justify-center pointer-events-none"
        style={{ touchAction: 'none' }}
      >
        <div
          className="relative w-full h-full"
          style={{ transform: `scale(${gridScale})`, transformOrigin: 'center center', touchAction: 'none' }}
        >
        {/* PASS 1: hexcell_shadow — one per cell, always below all green/white (z-0) */}
        {grid.map((cell, i) => {
          const x = hexSize * (3 / 2) * cell.q * horizontalSpacing * gridSpacing;
          const y = hexSize * Math.sqrt(3) * (cell.r + cell.q / 2) * verticalSpacing * gridSpacing;
          return (
            <div
              key={`hex-shadow-${i}`}
              className="absolute pointer-events-none overflow-hidden"
              style={{
                left: centerX,
                top: centerY,
                width: `${hexDisplayW}px`,
                height: `${hexDisplayH}px`,
                transform: `translate(calc(-50% + ${x}px), calc(-50% + ${y + shadowOffsetY}px))`,
                zIndex: 0,
                backgroundImage: `url(${HEXCELL_SHADOW})`,
                backgroundSize: 'contain',
                backgroundPosition: 'center',
                backgroundRepeat: 'no-repeat',
              }}
            />
          );
        })}

        {/* PASS 2: hexcell_green, hexcell_fertile, or hexcell_locked — one sprite per cell (idle) */}
        {grid.map((cell, i) => {
          const x = hexSize * (3 / 2) * cell.q * horizontalSpacing * gridSpacing;
          const y = hexSize * Math.sqrt(3) * (cell.r + cell.q / 2) * verticalSpacing * gridSpacing;
          const isLocked = cell.locked === true;
          const isFertile = cell.fertile === true;
          const isUnlocking = unlockingCellIndices.includes(i);
          const isFertilizing = fertilizingCellIndices.includes(i);

          return (
            <div
              key={`cell-${i}`}
              id={`hex-${i}`}
              onPointerDown={(e) => {
                e.stopPropagation();
                handlePointerDown(i, e);
              }}
              onContextMenu={(e) => e.preventDefault()}
              onTouchStart={(e) => e.preventDefault()}
              onTouchMove={(e) => e.preventDefault()}
              className="absolute pointer-events-auto flex items-center justify-center overflow-hidden"
              style={{
                left: centerX,
                top: centerY,
                width: `${hexDisplayW}px`,
                height: `${hexDisplayH}px`,
                transform: `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))`,
                zIndex: 10,
                touchAction: 'none',
                WebkitTouchCallout: 'none',
                WebkitUserSelect: 'none',
                userSelect: 'none',
              }}
            >
              {/* Locked cell sprite */}
              <img
                src={HEXCELL_LOCKED}
                alt=""
                className={`hex-cell-img w-full h-full object-contain absolute inset-0 transition-opacity duration-200 ${isUnlocking ? 'opacity-0' : ''}`}
                style={{ opacity: isLocked && !isUnlocking ? 1 : 0 }}
                onError={hideBrokenHexImg}
              />
              {/* Green cell sprite (shown when not locked/fertile, or fading in during unlock, or fading out during fertilize) */}
              <img
                src={HEXCELL_GREEN}
                alt=""
                className={`hex-cell-img w-full h-full object-contain absolute inset-0 transition-all duration-200 ${isUnlocking ? 'hexcell-unlock-bounce' : ''}`}
                style={{ opacity: isLocked && !isUnlocking ? 0 : isFertile && !isFertilizing ? 0 : 1 }}
                onError={hideBrokenHexImg}
              />
              {/* Fertile cell sprite (shown when fertile, or fading in during fertilize) */}
              <img
                src={HEXCELL_FERTILE}
                alt=""
                className={`hex-cell-img w-full h-full object-contain absolute inset-0 transition-all duration-200 ${isFertilizing ? 'hexcell-unlock-bounce' : ''}`}
                style={{ opacity: isFertile || isFertilizing ? 1 : 0 }}
                onError={hideBrokenHexImg}
              />
            </div>
          );
        })}

        {/* PASS 3: hexcell_white — drag source 50%, hover empty 25%, hover match 75%, source fade-out, new land 50%→0, spawn/return flash */}
        {grid.map((cell, i) => {
          const x = hexSize * (3 / 2) * cell.q * horizontalSpacing * gridSpacing;
          const y = hexSize * Math.sqrt(3) * (cell.r + cell.q / 2) * verticalSpacing * gridSpacing;
          const isImpacted = impactCellIdx === i;
          const isReturnImpact = returnImpactCellIdx === i;
          const isDragSource = dragState?.phase === 'holding' && dragState.cellIdx === i;
          const isSourceFadeOut = sourceCellFadeOutIdx === i;
          const isHoveredEmpty = dragState?.phase === 'holding' && dragState.hoveredEmptyCellIdx === i;
          const isHoveredMatch = dragState?.phase === 'holding' && dragState.hoveredMatchCellIdx === i;
          const isNewCellImpact = newCellImpactIdx === i;
          const staticOpacity =
            isDragSource ? 0.5 : isHoveredMatch ? 0.75 : isHoveredEmpty ? 0.5 : undefined;
          const animClass = isNewCellImpact
            ? 'hexcell-new-land-flash'
            : isSourceFadeOut
              ? 'hexcell-source-fade-out'
              : isImpacted
                ? 'hexcell-white-flash'
                : isReturnImpact
                  ? 'hexcell-return-flash'
                  : '';

          return (
            <div
              key={`hex-white-${i}`}
              className="absolute pointer-events-none flex items-center justify-center overflow-hidden"
              style={{
                left: centerX,
                top: centerY,
                width: `${hexDisplayW}px`,
                height: `${hexDisplayH}px`,
                transform: `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))`,
                zIndex: 45,
              }}
            >
              <img
                src={HEXCELL_WHITE}
                alt=""
                className={`hex-cell-img w-full h-full object-contain ${animClass}`}
                style={staticOpacity != null ? { opacity: staticOpacity } : !animClass ? { opacity: 0 } : undefined}
                onError={hideBrokenHexImg}
              />
            </div>
          );
        })}

        {/* PASS 4: PLANTS (hide source while dragging; hide target during impact when moved) */}
        {(() => {
          // For swaps, don't treat the source cell as "dragged" during impact - Plant B is there now
          const isSwapImpact = dragState?.phase === 'impact' && dragState?.isSwap === true;
          const draggedCellIdx = isSwapImpact ? -1 : (dragState?.cellIdx ?? -1);
          const hideTargetDuringImpact = dragState?.phase === 'impact' && dragState?.targetCellIdx != null && !isSwapImpact ? dragState.targetCellIdx : -1;
          // Hide the plant at its destination cell during swap return animation
          const hideSwapReturnDest = swapReturn?.toCellIdx ?? -1;
          const baseCells = grid.map((cell, i) => {
            const x = hexSize * (3 / 2) * cell.q * horizontalSpacing * gridSpacing;
            const y = hexSize * Math.sqrt(3) * (cell.r + cell.q / 2) * verticalSpacing * gridSpacing;
            return { i, cell, x, y };
          });
          let cellsWithPlants = baseCells
            .filter(({ cell, i }) => cell.item != null && i !== hideTargetDuringImpact && i !== hideSwapReturnDest)
            .sort((a, b) => a.y - b.y);
          // Add synthetic plant during impact for merges (not swaps - both plants already in grid)
          if (dragState?.phase === 'impact' && dragState.cellIdx != null && !isSwapImpact && !cellsWithPlants.some((c) => c.i === dragState.cellIdx)) {
            const src = baseCells[dragState.cellIdx];
            if (src) {
              const syntheticItem = {
                ...dragState.item,
                level: dragState.mergeResultLevel ?? dragState.item.level,
              };
              cellsWithPlants = [...cellsWithPlants, { ...src, cell: { ...src.cell, item: syntheticItem } }].sort((a, b) => a.y - b.y);
            }
          }

          const isHolding = dragState?.phase === 'holding';
          const isFlying = dragState?.phase === 'flyingBack';
          const isImpact = dragState?.phase === 'impact';
          const liftProgress = dragState?.liftProgress ?? 0;
          const scaleProgress = (dragState?.scaleProgress ?? dragState?.liftProgress) ?? 0;
          const flyProgress = dragState?.flyProgress ?? 0;
          const scaleHolding = 1.5 + 0.2 * Math.min(1, scaleProgress);
          const liftPx = 20 * liftProgress;
          const idleDefaultY = 5.5;
          const liftDuringFly = idleDefaultY + (20 - idleDefaultY) * (1 - flyProgress);
          const scaleFlying = 1.7 - 0.7 * flyProgress;
          const dragScale = isHolding ? scaleHolding : isFlying ? scaleFlying : isImpact ? 1 : 1.5;
          const dragTranslateY = isHolding ? -liftPx : isFlying ? -liftDuringFly : -5.5;
          const dragOffsetX = dragState ? (dragState.pointerX - dragState.originX) / gridScale : 0;
          const dragOffsetY = dragState ? (dragState.pointerY - dragState.originY) / gridScale : 0;

          return (
            <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 50 }}>
              {cellsWithPlants.map(({ i, cell, x, y }) => {
                const isImpacted = impactCellIdx === i;
                const item = cell.item!;
                const isDragged = i === draggedCellIdx;
                const isMergeTargetDuringFly =
                  dragState?.phase === 'flyingBack' &&
                  dragState?.targetCellIdx === i &&
                  dragState?.isMerge === true;
                const mergeScale = 1.5 - 0.5 * (dragState?.flyProgress ?? 0);
                const scale = isDragged ? dragScale : isMergeTargetDuringFly ? mergeScale : 1.5;
                const level = isDragged && dragState?.mergeResultLevel != null ? dragState.mergeResultLevel : item.level;
                const transform = isDragged
                  ? `translate(calc(-50% + ${x}px), calc(-50% + ${y}px)) translate(${dragOffsetX}px, ${dragOffsetY}px)`
                  : `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))`;
                const innerTransform = isDragged && isImpact
                  ? 'translateY(-5.5px)' // keyframes control scale
                  : isDragged
                    ? `translateY(${dragTranslateY}px) scale(${scale})`
                    : `translateY(-5.5px) scale(${scale})`;
                // Don't apply harvest bounce to plants being dragged (would glitch mid-air)
                const isHarvestBounce = !isDragged && harvestBounceCellIndices.includes(i);
                // Check if this cell has a swap impact animation (Plant B landing)
                const isSwapImpactB = swapImpactCellIdx === i;
                // Check if Plant A is landing at swap target during impact
                const isSwapImpactA = isSwapImpact && dragState?.targetCellIdx === i;
                const innerClass = [
                  isDragged && isImpact ? 'plant-impact-scale' : '',
                  isSwapImpactA ? 'plant-impact-scale' : '',
                  isSwapImpactB ? 'plant-impact-scale-soft' : '',
                  isHarvestBounce ? 'plant-harvest-bounce' : '',
                ].filter(Boolean).join(' ');
                const spawnBounceClass = isImpacted && !isDragged ? 'plant-spawn-bounce' : '';

                return (
                  <div
                    key={`plant-${i}`}
                    className="absolute flex items-center justify-center"
                    style={{
                      left: centerX,
                      top: centerY,
                      width: `${hexWidth}px`,
                      height: `${hexHeight}px`,
                      transform,
                      zIndex: 50 + Math.round(y) + (isDragged ? 1000 : 0),
                    }}
                  >
                    <div className="flex flex-col items-center justify-center relative w-full h-full">
                      <div
                        style={{ transform: innerTransform, transformOrigin: '50% 50%' }}
                        className={`flex items-center justify-center w-full h-full ${innerClass}`}
                      >
                        {/* 70% on outer root — same as pre-pot `<img className="w-[70%] h-[70%]">` vs hex inner cell (w-full h-full) */}
                        <PlantWithPot
                          level={level}
                          className="h-[70%] w-[70%] drop-shadow-[0_4px_8px_rgba(0,0,0,0.4)]"
                          wrapperClassName="h-full w-full"
                          potClassName={spawnBounceClass}
                          plantClassName={spawnBounceClass}
                          alt={`Plant ${level}`}
                          draggable={false}
                          onContextMenu={(e) => e.preventDefault()}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* Swap return plant animation */}
              {swapReturn && (() => {
                const { item, fromCellIdx, toCellIdx, progress } = swapReturn;
                const fromCell = grid[fromCellIdx];
                const toCell = grid[toCellIdx];
                if (!fromCell || !toCell) return null;
                
                // Calculate grid positions using the same formula as regular plants
                const fromX = hexSize * (3 / 2) * fromCell.q * horizontalSpacing * gridSpacing;
                const fromY = hexSize * Math.sqrt(3) * (fromCell.r + fromCell.q / 2) * verticalSpacing * gridSpacing;
                const toX = hexSize * (3 / 2) * toCell.q * horizontalSpacing * gridSpacing;
                const toY = hexSize * Math.sqrt(3) * (toCell.r + toCell.q / 2) * verticalSpacing * gridSpacing;
                
                // Interpolate position
                const currentX = fromX + (toX - fromX) * progress;
                const currentY = fromY + (toY - fromY) * progress;
                
                // Keep scale constant at 1.5 (normal plant scale)
                const scale = 1.5;
                // Slight lift during flight
                const liftY = -5.5 - 10 * Math.sin(progress * Math.PI);

                return (
                  <div
                    key="swap-return-plant"
                    className="absolute flex items-center justify-center"
                    style={{
                      left: centerX,
                      top: centerY,
                      width: `${hexWidth}px`,
                      height: `${hexHeight}px`,
                      transform: `translate(calc(-50% + ${currentX}px), calc(-50% + ${currentY}px))`,
                      zIndex: 50 + Math.round(currentY) + 500,
                    }}
                  >
                    <div className="flex flex-col items-center justify-center relative w-full h-full">
                      <div
                        style={{ transform: `translateY(${liftY}px) scale(${scale})`, transformOrigin: '50% 50%' }}
                        className="flex items-center justify-center w-full h-full"
                      >
                        <PlantWithPot
                          level={item.level}
                          className="h-[70%] w-[70%] drop-shadow-[0_4px_8px_rgba(0,0,0,0.4)]"
                          wrapperClassName="h-full w-full"
                          alt={`Plant ${item.level}`}
                          draggable={false}
                        />
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>
          );
        })()}
      </div>
    </div>
    </>
  );
};
