import React, { useRef, useEffect, useState } from 'react';
import { shouldTick30 } from '../utils/raf60';

interface TapRipple {
  id: number;
  startTime: number;
}

interface SideActionProps {
  label: string;
  icon: string;
  progress: number;
  color: string;
  isActive?: boolean;
  isFlashing?: boolean;
  shouldAnimate?: boolean;
  isBoardFull?: boolean;
  iconScale?: number;
  iconOffsetY?: number;
  /** When set, progress bar is driven at 60fps from this ref (0–100) for smooth updates without React re-renders. */
  progressRef?: React.MutableRefObject<number>;
  /** Seed storage: show "X/Y" badge (e.g. 0/1, 3/10); background width fits content. */
  storageCount?: number;
  storageMax?: number;
  /** When true: progress stays 0%, badge shows "FREE", tap still works but doesn't consume charges/capacity. */
  freeMode?: boolean;
  /** Incremented each time we should bounce (e.g. seed progress hits 100%); key forces animation to re-run. */
  bounceTrigger?: number;
  /** If true, disable the rotate animation when flashing (default: false) */
  noRotateOnFlash?: boolean;
  onClick?: (e: React.MouseEvent) => void;
}

export const SideAction: React.FC<SideActionProps> = ({ 
  label, 
  icon, 
  progress, 
  color, 
  isActive, 
  isFlashing, 
  shouldAnimate = true,
  isBoardFull = false,
  iconScale = 1,
  iconOffsetY = 0,
  progressRef,
  storageCount,
  storageMax,
  freeMode = false,
  bounceTrigger = 0,
  noRotateOnFlash = false,
  onClick 
}) => {
  // Base Radius and Expanded Radius (only for body/decoration when flashing)
  const baseRadius = 38;
  const expandedRadius = baseRadius * 1.1; // 10% increase = 41.8
  // Progress ring always uses baseRadius so it doesn't scale/transition during pulse (avoids -10% visual bug)
  // Green-button version: make progress rings slightly narrower (inset a few px).
  const progressRadius = isFlashing ? baseRadius : (baseRadius - 1);
  const circumference = 2 * Math.PI * progressRadius;
  const progressCircleRef = useRef<SVGCircleElement>(null);
  const whiteHeadCircleRef = useRef<SVGCircleElement>(null);
  // White progress bar radius: on the inner edge of the white body circle (r=43)
  const whiteProgressRadius = 38;
  const whiteCircumference = 2 * Math.PI * whiteProgressRadius;
  const whiteProgressCircleRef = useRef<SVGCircleElement>(null);
  const isFlashingRef = useRef(isFlashing);
  const raf30LastTickRef = useRef(0);
  isFlashingRef.current = isFlashing;

  // When progressRef is provided and not in free mode, drive both progress rings at 30fps (smooth enough, less work than 60fps)
  useEffect(() => {
    if (!progressRef || freeMode) return;
    let rafId: number;
    const tick = () => {
      if (!shouldTick30(raf30LastTickRef)) {
        rafId = requestAnimationFrame(tick);
        return;
      }
      const raw = progressRef.current;
      const pct = Math.max(0, Math.min(100, raw));
      // Green progress bar: always show actual progress (hide only at 100%)
      const greenShow = pct >= 100 ? 0 : pct / 100;
      const whiteHeadLead = 0.02;
      const whiteHeadShow = greenShow > 0 ? Math.min(1, greenShow + whiteHeadLead) : 0;
      // White progress bar always tracks actual progress (visibility controlled by opacity)
      const whiteShow = pct / 100;
      
      // Main progress ring (green version)
      if (progressCircleRef.current) {
        const offset = circumference - (greenShow * circumference);
        progressCircleRef.current.style.strokeDashoffset = String(offset);
        progressCircleRef.current.style.transition = 'none';
      }

      // White "head" ring (slightly ahead of the green completed ring)
      if (whiteHeadCircleRef.current) {
        const headOffset = circumference - (whiteHeadShow * circumference);
        whiteHeadCircleRef.current.style.strokeDashoffset = String(headOffset);
        whiteHeadCircleRef.current.style.transition = 'none';
      }
      
      // White version progress ring (always update, visibility via opacity)
      if (whiteProgressCircleRef.current) {
        const whiteOffset = whiteCircumference - (whiteShow * whiteCircumference);
        whiteProgressCircleRef.current.style.strokeDashoffset = String(whiteOffset);
        whiteProgressCircleRef.current.style.transition = 'none';
      }
      
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [progressRef, circumference, whiteCircumference, freeMode]);

  // Clamp progress to 0–1 so the ring never shows negative or >100%; in free mode always show 0
  const clampedProgress = freeMode ? 0 : Math.max(0, Math.min(1, progress));
  const displayProgress = clampedProgress >= 1 ? 0 : clampedProgress;
  const whiteHeadLead = 0.02;
  const whiteHeadProgress = displayProgress > 0 ? Math.min(1, displayProgress + whiteHeadLead) : 0;
  const strokeDashoffset = circumference - (displayProgress * circumference);
  const whiteHeadStrokeDashoffset = circumference - (whiteHeadProgress * circumference);
  const whiteStrokeDashoffset = whiteCircumference - (displayProgress * whiteCircumference);

  const isImageIcon = icon.startsWith('http') || icon.startsWith('/');

  // Tap ripple state - stores active ripples that expand outward on each tap
  const [tapRipples, setTapRipples] = useState<TapRipple[]>([]);
  const rippleIdRef = useRef(0);

  // Clean up finished ripples after 300ms
  useEffect(() => {
    if (tapRipples.length === 0) return;
    const timer = setTimeout(() => {
      const now = Date.now();
      setTapRipples(prev => prev.filter(r => now - r.startTime < 300));
    }, 310);
    return () => clearTimeout(timer);
  }, [tapRipples]);

  // Handler to spawn a new ripple on click
  const handleClick = (e: React.MouseEvent) => {
    // Spawn new ripple
    rippleIdRef.current += 1;
    setTapRipples(prev => [...prev, { id: rippleIdRef.current, startTime: Date.now() }]);
    // Call original onClick
    onClick?.(e);
  };

  const transitionStyle = (isFlashing || displayProgress === 0)
    ? 'none'
    : 'stroke-dashoffset 0.08s cubic-bezier(0.25, 0.1, 0.25, 1)';

  const progressBgColor = isFlashing ? '#475c3b' : '#394a28';
  const completedProgressColor = '#80aa16';
  // White version progress bar colors: upgrade button green for completed, storage text dark green for incomplete
  const whiteProgressCompletedColor = '#9db546'; // light green for completed progress
  const whiteProgressIncompleteColor = '#475c3b'; // storage text dark green
  const useRefDrive = progressRef != null && !freeMode;
  // Green bar: hides progress when flashing
  const greenPct = useRefDrive ? Math.max(0, Math.min(1, (progressRef?.current ?? 0) / 100)) : 0;
  const refDriveOffset = useRefDrive
    ? circumference - (greenPct * circumference)
    : (freeMode ? circumference : undefined);
  const whiteHeadRefDriveOffset = useRefDrive
    ? circumference - (Math.min(1, greenPct + whiteHeadLead) * circumference)
    : (freeMode ? circumference : undefined);
  // White bar: always shows actual progress
  const whiteRefDriveOffset = useRefDrive
    ? whiteCircumference - (greenPct * whiteCircumference)
    : (freeMode ? whiteCircumference : undefined);

  return (
    <div className="relative overflow-visible">
      <style>{`
        @keyframes seed-bounce {
          0% { transform: scale(1); }
          35% { transform: scale(1.18); }
          70% { transform: scale(0.96); }
          100% { transform: scale(1); }
        }
        .side-action-bounce {
          animation: seed-bounce 0.4s ease-out;
        }
        @keyframes tap-ripple {
          0% {
            transform: scale(1);
            opacity: 1;
            stroke-width: 5;
          }
          100% {
            transform: scale(1.4);
            opacity: 0;
            stroke-width: 2;
          }
        }
        .tap-ripple-ring {
          animation: tap-ripple 1000ms cubic-bezier(0.1, 0.8, 0.2, 1) forwards;
        }
      `}</style>
      {/* Tap Ripple Rings - positioned outside bounce container so they're not affected by bounce animation */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none overflow-visible" style={{ zIndex: 0 }}>
        <svg className="w-24 h-24 overflow-visible" viewBox="0 0 100 100" style={{ overflow: 'visible' }}>
          {tapRipples.map((ripple) => (
            <circle
              key={ripple.id}
              cx="50"
              cy="50"
              r="50"
              fill="none"
              stroke="#588c30"
              strokeWidth="5"
              className="tap-ripple-ring"
              style={{ transformOrigin: '50% 50%' }}
            />
          ))}
        </svg>
      </div>
      <div
        key={bounceTrigger}
        className={`flex flex-col items-center select-none group ${bounceTrigger > 0 ? 'side-action-bounce' : ''}`}
        onClick={handleClick}
      >
        <div className={`relative w-24 h-24 flex items-center justify-center cursor-pointer active:scale-95 transition-all duration-200 ${isFlashing && shouldAnimate ? 'scale-110' : ''}`}>
        
        {/* SVG Circular Progress & Decoration */}
        <svg className="absolute inset-0 w-full h-full drop-shadow-[0_1px_6px_rgba(0,0,0,0.8)]" viewBox="0 0 100 100">
          <defs>
            {/* Standard Green Gradient for the button body */}
            <linearGradient id={`btn-grad-${label}`} x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#577741" />
              <stop offset="100%" stopColor="#39502e" />
            </linearGradient>

            {/* Light Rim/Flash Gradient (Top #fcf0c6, Bottom #cad870) */}
            <linearGradient id={`light-grad-${label}`} x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#fcf0c6" />
              <stop offset="100%" stopColor="#cad870" />
            </linearGradient>
          </defs>

          {/* Light Outer Border Ring - Now uses the vertical gradient */}
          {/* Green version: r=48, White version: r=46 */}
          <circle
            cx="50"
            cy="50"
            r={isFlashing ? 44 : 48}
            fill={`url(#light-grad-${label})`}
            className="transition-all duration-300"
            style={{
              filter: 'none'
            }}
          />
          
          {/* Inner Gradient Body - Radius 43 */}
          {/* Uses light-grad when flashing, else standard green grad */}
          <circle
            cx="50"
            cy="50"
            r="43"
            fill={isFlashing ? `url(#light-grad-${label})` : `url(#btn-grad-${label})`}
            stroke="rgba(255,255,255,0.15)"
            strokeWidth="1.5"
            className="transition-colors duration-300"
          />

          {/* Incomplete Progress Track (Background) - fixed radius so pulse doesn't affect progress */}
          <circle
            cx="50"
            cy="50"
            r={progressRadius}
            fill="transparent"
            stroke={progressBgColor}
            strokeWidth="3"
            style={{ transition: 'none' }}
          />

          {/* White "head" progress ring: sits above track but below green ring */}
          <circle
            ref={progressRef ? whiteHeadCircleRef : undefined}
            cx="50"
            cy="50"
            r={progressRadius}
            fill="transparent"
            stroke="#f8edcb"
            strokeWidth={isFlashing ? 3 : 2.5}
            strokeLinecap="butt"
            strokeDasharray={circumference}
            style={{
              strokeDashoffset: useRefDrive ? whiteHeadRefDriveOffset : whiteHeadStrokeDashoffset,
              transition: useRefDrive ? 'none' : transitionStyle,
              transform: 'rotate(90deg)',
              transformOrigin: '50% 50%',
              opacity: clampedProgress >= 1 ? 0 : 1
            }}
          />

          {/* Progress Bar Ring - When progressRef is set, strokeDashoffset is driven at 60fps in useEffect */}
          <circle
            ref={progressRef ? progressCircleRef : undefined}
            cx="50"
            cy="50"
            r={progressRadius}
            fill="transparent"
            stroke={completedProgressColor}
            strokeWidth={isFlashing ? 4 : 3}
            strokeLinecap="butt"
            strokeDasharray={circumference}
            style={{ 
              strokeDashoffset: useRefDrive ? refDriveOffset : strokeDashoffset,
              transition: useRefDrive ? 'stroke 0.3s ease' : `${transitionStyle}, stroke 0.3s ease`,
              transform: 'rotate(90deg)',
              transformOrigin: '50% 50%',
              opacity: (clampedProgress >= 1 && !isFlashing) ? 0 : 1
            }}
          />

          {/* White Version Progress Bar - Only visible when flashing (white state), fades in/out with white */}
          {/* Track (dark green background - incomplete portion) */}
          <circle
            cx="50"
            cy="50"
            r={whiteProgressRadius}
            fill="transparent"
            stroke={whiteProgressIncompleteColor}
            strokeWidth="4"
            style={{ 
              transition: 'opacity 0.3s ease',
              opacity: 0
            }}
          />
          {/* Progress Fill (light green - completed portion) */}
          <circle
            ref={progressRef ? whiteProgressCircleRef : undefined}
            cx="50"
            cy="50"
            r={whiteProgressRadius}
            fill="transparent"
            stroke={whiteProgressCompletedColor}
            strokeWidth="5"
            strokeDasharray={whiteCircumference}
            style={{ 
              strokeDashoffset: useRefDrive ? whiteRefDriveOffset : (isFlashing ? whiteStrokeDashoffset : whiteCircumference),
              transition: useRefDrive ? 'opacity 0.3s ease' : `opacity 0.3s ease, stroke-dashoffset 0.08s cubic-bezier(0.25, 0.1, 0.25, 1)`,
              transform: 'rotate(90deg)',
              transformOrigin: '50% 50%',
              opacity: 0
            }}
          />
        </svg>

        {/* Content Icon - no rotate when seed storage badge or noRotateOnFlash is set */}
        <div 
          className={`relative z-10 w-16 h-16 rounded-full flex items-center justify-center overflow-hidden transition-all duration-300 ${
            isFlashing && shouldAnimate
              ? (storageCount !== undefined || noRotateOnFlash)
                ? 'scale-110'
                : 'scale-110 rotate-12'
              : isActive
                ? 'scale-105'
                : 'scale-100'
          }`}
        >
          {isImageIcon ? (
            <img 
              src={icon} 
              alt={label} 
              className="object-contain drop-shadow-[0_2px_4px_rgba(0,0,0,0.4)]" 
              style={{ width: 40 * iconScale, height: 40 * iconScale, transform: iconOffsetY ? `translateY(${iconOffsetY}px)` : undefined }}
            />
          ) : (
            <span className="text-4xl drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)] select-none">
              {icon}
            </span>
          )}
          {/* Subtle Shine Overlay */}
          <div className="absolute inset-0 bg-gradient-to-tr from-white/10 to-transparent pointer-events-none"></div>
        </div>

        {/* Storage badge: FREE (free mode), X/Y (fits content width), or FULL when board full and ready */}
        {freeMode && (storageCount !== undefined || storageMax !== undefined) ? (
          <div 
            className="absolute bottom-[-6px] py-[3px] shadow-md border-2 z-20 flex items-center justify-center transition-all duration-200"
            style={{ 
              backgroundImage: 'linear-gradient(to bottom, #fcf0c6, #d0df6f)',
              borderColor: '#7c8741',
              borderRadius: '999px',
              paddingLeft: '8px',
              paddingRight: '8px',
              minWidth: '2ch'
            }}
          >
            <span 
              className="text-[11.25px] font-black uppercase tracking-widest leading-none whitespace-nowrap"
              style={{ color: '#475c3b' }}
            >
              FREE
            </span>
          </div>
        ) : storageCount !== undefined && storageMax !== undefined ? (
          <div 
            className="absolute bottom-[-6px] py-[3px] shadow-md border-2 z-20 flex items-center justify-center transition-all duration-200"
            style={{ 
              backgroundImage: 'linear-gradient(to bottom, #fcf0c6, #d0df6f)',
              borderColor: '#7c8741',
              borderRadius: '999px',
              paddingLeft: '8px',
              paddingRight: '8px',
              minWidth: '2ch'
            }}
          >
            <span 
              className="text-[11.25px] font-black tabular-nums leading-none whitespace-nowrap"
              style={{ color: '#475c3b' }}
            >
              {storageCount}/{storageMax}
            </span>
          </div>
        ) : isFlashing && isBoardFull ? (
          <div 
            className="absolute bottom-[-6px] px-[12px] py-[3px] shadow-md border-2 z-20 flex items-center justify-center animate-in fade-in slide-in-from-bottom-2 duration-300"
            style={{ 
              backgroundImage: 'linear-gradient(to bottom, #fcf0c6, #d0df6f)',
              borderColor: '#7c8741',
              borderRadius: '999px'
            }}
          >
            <span 
              className="text-[11.25px] font-black uppercase tracking-widest leading-none"
              style={{ color: '#475c3b' }}
            >
              FULL
            </span>
          </div>
        ) : null}
        </div>
      </div>
    </div>
  );
};
