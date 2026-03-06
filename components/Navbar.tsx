import React, { useState, useEffect } from 'react';
import { ScreenType } from '../types';
import { assetPath } from '../utils/assetPath';

interface NavbarProps {
  activeScreen: ScreenType;
  onScreenChange: (screen: ScreenType) => void;
  barnButtonRef?: React.RefObject<HTMLButtonElement | null>;
  notifications?: {
    STORE?: boolean;
    FARM?: boolean;
    BARN?: boolean;
  };
}

export const Navbar: React.FC<NavbarProps> = ({ activeScreen, onScreenChange, barnButtonRef, notifications = {} }) => {
  // Track viewport width for responsive scaling
  const [viewportWidth, setViewportWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 420);
  
  useEffect(() => {
    const handleResize = () => setViewportWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  
  // Navbar design width: 3 buttons at 135px each = 405px
  // Only apply scaling on narrow mobile screens
  const mobileBreakpoint = 500;
  const navDesignWidth = 405;
  const navScale = viewportWidth >= mobileBreakpoint 
    ? 1 
    : Math.min(1, viewportWidth / navDesignWidth);
  const items: { id: ScreenType; label: string; icon: string }[] = [
    { id: 'STORE', label: 'MARKET', icon: assetPath('/assets/icons/icon_market.png') },
    { id: 'FARM', label: 'GARDEN', icon: assetPath('/assets/icons/icon_farm.png') },
    { id: 'BARN', label: 'SHED', icon: assetPath('/assets/icons/icon_barn.png') },
  ];

  return (
    <div className="relative shrink-0 overflow-visible z-50" style={{ height: '60px' }}>
      <nav 
        className="absolute inset-0 flex items-start justify-center overflow-visible"
        style={{ 
          backgroundColor: '#282020',
          marginLeft: '-4px',
          marginRight: '-4px',
          marginBottom: '-20px',
          paddingLeft: '4px',
          paddingRight: '4px',
          paddingBottom: '20px',
        }}
      >
      
      {/* Scalable button container */}
      <div
        className="flex items-start justify-center"
        style={{
          transform: `scale(${navScale})`,
          transformOrigin: 'top center',
        }}
      >
      {items.map((item) => {
        const isActive = activeScreen === item.id;
        const hasNotification = notifications[item.id] && !isActive;
        return (
          <div 
            key={item.id}
            className="relative flex items-start justify-center"
            style={{ width: '135px', height: '100%' }}
          >
            {/* Notification triangle - shows when tab has notification and is not active */}
            {hasNotification && (
              <div
                className="absolute z-20 pointer-events-none"
                style={{
                  top: '2px',
                  left: '50%',
                  transform: 'translateX(-50%)',
                }}
              >
                {/* Using SVG for curved tip */}
                <svg width="21" height="12" viewBox="0 0 21 12" style={{ display: 'block' }}>
                  {/* Green fill with stroke 1 outline */}
                  <path
                    d="M2,1 L19,1 L11.5,9.5 Q10.5,11 9.5,9.5 L2,1 Z"
                    fill="#cae060"
                    stroke="#443936"
                    strokeWidth="2"
                  />
                </svg>
              </div>
            )}
            {/* Shadow on left side of tab */}
            <div
              className="absolute pointer-events-none transition-opacity duration-200 ease-out"
              style={{
                top: '0px',
                right: '50%',
                marginRight: '67.5px',
                width: '40px',
                height: '120%',
                background: 'linear-gradient(to left, rgba(0,0,0,0.2) 0%, transparent 100%)',
                opacity: isActive ? 1 : 0,
              }}
            />
            {/* Shadow on right side of tab */}
            <div
              className="absolute pointer-events-none transition-opacity duration-200 ease-out"
              style={{
                top: '0px',
                left: '50%',
                marginLeft: '67.5px',
                width: '40px',
                height: '120%',
                background: 'linear-gradient(to right, rgba(0,0,0,0.2) 0%, transparent 100%)',
                opacity: isActive ? 1 : 0,
              }}
            />

            {/* Top stroke layers - render on middle tab only to avoid duplicates */}
            {item.id === 'FARM' && (
              <>
                {/* Stroke 1 (top/darker) */}
                <div 
                  className="absolute pointer-events-none"
                  style={{
                    top: '0px',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    width: '200vw',
                    height: '2px',
                    backgroundColor: '#171515',
                    zIndex: 4,
                  }}
                />
                {/* Stroke 2 (bottom/lighter) */}
                <div 
                  className="absolute pointer-events-none"
                  style={{
                    top: '2px',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    width: '200vw',
                    height: '2px',
                    backgroundColor: '#443936',
                    zIndex: 4,
                  }}
                />
              </>
            )}
            
            {/* Active tab background - slides up/down */}
            <div
              className="absolute"
              style={{
                top: isActive ? '-10px' : '0px',
                left: '50%',
                transform: 'translateX(-50%)',
                width: '135px',
                height: '110px',
                backgroundColor: '#302626',
                borderRadius: '14px 14px 0 0',
                opacity: isActive ? 1 : 0,
                zIndex: 5,
                transition: isActive 
                  ? 'top 0.25s cubic-bezier(0.34, 1.4, 0.64, 1), opacity 0.1s ease-out'
                  : 'top 0.1s ease-in, opacity 0.1s ease-in',
              }}
            >
              {/* Stroke 1 (inner) - #443936 */}
              <div 
                className="absolute pointer-events-none"
                style={{
                  top: '0px',
                  left: '0px',
                  right: '0px',
                  bottom: '0px',
                  borderRadius: '14px 14px 0 0',
                  border: '2px solid #443936',
                  borderBottom: 'none',
                }}
              />
              {/* Stroke 2 (outer) - #171515, snug against inner stroke (1px offset) */}
              <div 
                className="absolute pointer-events-none"
                style={{
                  top: '-1px',
                  left: '-1px',
                  right: '-1px',
                  bottom: '0px',
                  borderRadius: '15px 15px 0 0',
                  border: '2px solid #171515',
                  borderBottom: 'none',
                }}
              />
            </div>
            
            <button 
              ref={item.id === 'BARN' ? barnButtonRef : undefined}
              onClick={() => onScreenChange(item.id)} 
              className="relative flex flex-col items-center z-10"
              style={{
                width: '135px',
                height: '100%',
                backgroundColor: 'transparent',
                justifyContent: 'flex-start',
              }}
            >
              <div 
                className="flex flex-col items-center justify-center"
                style={{
                  marginTop: isActive ? '2px' : '14px',
                  transition: isActive 
                    ? 'margin-top 0.25s cubic-bezier(0.0, 1.2, 0.3, 1.3)'
                    : 'margin-top 0.1s ease-in',
                }}
              >
                <img 
                  src={item.icon} 
                  alt={item.label}
                  className="transition-all duration-200 ease-out"
                  style={{
                    width: isActive ? '30px' : '28px',
                    height: isActive ? '30px' : '28px',
                    filter: isActive 
                      ? 'brightness(0) saturate(100%) invert(50%) sepia(6%) saturate(500%) hue-rotate(350deg) brightness(92%) contrast(88%)'
                      : 'brightness(0) saturate(100%) invert(22%) sepia(8%) saturate(500%) hue-rotate(340deg) brightness(97%) contrast(90%)',
                  }}
                />
                {isActive && (
                  <span 
                    className="font-bold tracking-wider uppercase transition-opacity duration-300"
                    style={{
                      fontSize: '9px',
                      color: '#7f7265',
                      marginTop: '4px',
                      letterSpacing: '0.1em',
                    }}
                  >
                    {item.label}
                  </span>
                )}
              </div>
            </button>
          </div>
        );
      })}
      </div>
      </nav>
    </div>
  );
};
