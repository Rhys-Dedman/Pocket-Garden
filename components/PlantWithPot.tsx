/**
 * Plant sprite + shared pot underneath (same center, pot z below). Use anywhere the board plant
 * art appears so scale / drag / bounce animations apply to both layers together.
 */
import React from 'react';
import { assetPath } from '../utils/assetPath';

/** Matches `HexBoard` merge art cap (plant_N.png files on disk). */
export const MAX_PLANT_SPRITE_LEVEL = 14;

export function getPlantSpritePath(level: number): string {
  const spriteLevel = Math.min(Math.max(0, level), MAX_PLANT_SPRITE_LEVEL);
  return assetPath(`/assets/plants/plant_${spriteLevel}.png`);
}

export const PLANT_POT_SRC = assetPath('/assets/plants/plant_pot.png');

export interface PlantWithPotProps {
  level: number;
  /**
   * Outer wrapper — put percentage sizes here (e.g. `w-[70%] h-[70%]` on hex board) so they resolve
   * against the same parent as a lone `<img>` would; inner stack uses `wrapperClassName` to fill this box.
   */
  className?: string;
  /** Inner box that both images fill (default `h-full w-full` of outer). */
  wrapperClassName?: string;
  potClassName?: string;
  plantClassName?: string;
  style?: React.CSSProperties;
  /** Applied to both <img> (plus defaults for touch/select). */
  imageStyle?: React.CSSProperties;
  alt?: string;
  draggable?: boolean;
  onContextMenu?: React.MouseEventHandler<HTMLImageElement>;
}

export const PlantWithPot: React.FC<PlantWithPotProps> = ({
  level,
  className = '',
  wrapperClassName = 'h-full w-full',
  potClassName = '',
  plantClassName = '',
  style,
  imageStyle,
  alt = '',
  draggable = false,
  onContextMenu,
}) => {
  const baseImgStyle: React.CSSProperties = {
    WebkitTouchCallout: 'none',
    WebkitUserSelect: 'none',
    userSelect: 'none',
    pointerEvents: 'none',
    ...imageStyle,
  };

  return (
    <div className={`relative flex items-center justify-center ${className}`.trim()} style={style}>
      <div className={`relative flex items-center justify-center ${wrapperClassName}`.trim()}>
        <img
          src={PLANT_POT_SRC}
          alt=""
          draggable={false}
          className={`absolute inset-0 z-0 h-full w-full object-contain ${potClassName}`.trim()}
          style={baseImgStyle}
        />
        <img
          src={getPlantSpritePath(level)}
          alt={alt}
          draggable={draggable}
          onContextMenu={onContextMenu}
          className={`relative z-[1] h-full w-full object-contain ${plantClassName}`.trim()}
          style={{
            ...baseImgStyle,
            pointerEvents: draggable ? 'auto' : 'none',
          }}
        />
      </div>
    </div>
  );
};
