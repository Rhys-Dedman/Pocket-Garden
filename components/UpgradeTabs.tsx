import React, { useRef, useImperativeHandle, forwardRef, useLayoutEffect, useState } from 'react';
import { TabType } from '../types';
import { assetPath } from '../utils/assetPath';

/** FTUE 10: flat chip — same greens as UpgradeList affordable purchase button (not the row flash). */
const FTUE10_GARDEN_HIGHLIGHT_FILL = '#cae060'; // buttonColor
const FTUE10_GARDEN_HIGHLIGHT_BORDER = '#9db546'; // buttonDepthColor / border
const FTUE10_GARDEN_TAB_TEXT = '#587e26'; // buttonFontColor (price text on green purchase)
const FTUE10_GARDEN_HIGHLIGHT_FADE_MS = 280;

interface UpgradeTabsProps {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
  /** Tabs that currently have limited offers */
  tabsWithOffers?: Set<TabType>;
  /** When true, panel is expanded (use stronger ease-out for opening) */
  isExpanded?: boolean;
  /**
   * FTUE 10: while Garden must be tapped (panel_open_orders), show flat green rounded rect + full-color icon + purchase-style text.
   * Fades out when the player taps Garden (prop goes false).
   */
  ftue10EmphasizeGardenTab?: boolean;
}

export interface UpgradeTabsRef {
  getTabRef: (tab: TabType) => HTMLSpanElement | null;
}

const TAB_ICONS: Record<TabType, string> = {
  SEEDS: assetPath('/assets/icons/emoji_seed.png'),
  CROPS: assetPath('/assets/icons/emoji_sunflower.png'),
  HARVEST: assetPath('/assets/icons/emoji_coin.png'),
};

const TAB_LABELS: Record<TabType, string> = {
  SEEDS: 'SEEDS',
  CROPS: 'GARDEN',
  HARVEST: 'MARKET',
};

const NOTIFICATION_COLOR = '#e6803a';
const NOTIFICATION_UNDERLINE_COLOR = '#f59d42';
const NORMAL_UNDERLINE_COLOR = '#a7c957';

export const UpgradeTabs = forwardRef<UpgradeTabsRef, UpgradeTabsProps>(
  ({ activeTab, onTabChange, tabsWithOffers = new Set(), isExpanded = false, ftue10EmphasizeGardenTab = false }, ref) => {
  const tabs: TabType[] = ['SEEDS', 'CROPS', 'HARVEST'];

  const [gardenHiMounted, setGardenHiMounted] = useState(false);
  const [gardenHiOpaque, setGardenHiOpaque] = useState(true);

  const emphasizeGardenRef = useRef(ftue10EmphasizeGardenTab);
  emphasizeGardenRef.current = ftue10EmphasizeGardenTab;

  useLayoutEffect(() => {
    if (ftue10EmphasizeGardenTab) {
      setGardenHiMounted(true);
      setGardenHiOpaque(true);
      return;
    }
    if (!gardenHiMounted) return;
    setGardenHiOpaque(false);
  }, [ftue10EmphasizeGardenTab, gardenHiMounted]);
  
  const tabRefs = useRef<Record<TabType, HTMLSpanElement | null>>({
    SEEDS: null,
    CROPS: null,
    HARVEST: null,
  });

  useImperativeHandle(ref, () => ({
    getTabRef: (tab: TabType) => tabRefs.current[tab],
  }));
  
  // Check if active tab has an offer (for underline/arrow color)
  const activeTabHasOffer = tabsWithOffers.has(activeTab);
  const underlineColor = activeTabHasOffer ? NOTIFICATION_UNDERLINE_COLOR : NORMAL_UNDERLINE_COLOR;

  return (
    <div className="flex w-full bg-[#fcf0c6] relative h-[43px] shrink-0 items-center px-4">
      {/* Background Underline - Spans full width, matches thickness of the active indicator */}
      <div className="absolute bottom-0 left-0 w-full h-[2px] bg-black/5 pointer-events-none"></div>

      {tabs.map((tab) => {
        const isActive = activeTab === tab;
        const hasOffer = tabsWithOffers.has(tab);
        
        const getTextColor = () => {
          // FTUE 10: Garden tab not yet selected — match purchase button text (full-color icon forced below)
          if (tab === 'CROPS' && ftue10EmphasizeGardenTab && !isActive) {
            return FTUE10_GARDEN_TAB_TEXT;
          }
          // Active tab with offer = yellow
          if (isActive && hasOffer) return NOTIFICATION_COLOR;
          // Active tab without offer = green
          if (isActive) return '#6a994e';
          // Inactive tab with offers = yellow notification
          if (hasOffer) return NOTIFICATION_COLOR;
          // Inactive tab without offers = brown/tan
          return '#c2b280';
        };

        const ftueGardenVisual =
          tab === 'CROPS' && ftue10EmphasizeGardenTab && !isActive;
        const showGardenHighlight = tab === 'CROPS' && gardenHiMounted;

        return (
          <button
            key={tab}
            id={
              tab === 'HARVEST'
                ? 'ftue10-tab-orders'
                : tab === 'CROPS'
                ? 'ftue10-tab-garden'
                : tab === 'SEEDS'
                ? 'ftue10-tab-seeds'
                : undefined
            }
            onClick={() => onTabChange(tab)}
            className={`flex-1 flex flex-row items-center justify-center space-x-1.5 transition-all duration-300 active:scale-95 h-full relative z-10 overflow-visible`}
            style={{ touchAction: 'manipulation' }}
          >
            {showGardenHighlight && (
              <div
                className="absolute pointer-events-none rounded-[10px] z-0"
                style={{
                  left: 5,
                  right: 5,
                  top: 5,
                  bottom: 5,
                  backgroundColor: FTUE10_GARDEN_HIGHLIGHT_FILL,
                  border: `2px solid ${FTUE10_GARDEN_HIGHLIGHT_BORDER}`,
                  boxShadow: 'none',
                  opacity: gardenHiOpaque ? 1 : 0,
                  transition: `opacity ${FTUE10_GARDEN_HIGHLIGHT_FADE_MS}ms ease-out`,
                }}
                onTransitionEnd={(e) => {
                  if (e.target !== e.currentTarget) return;
                  if (e.propertyName !== 'opacity') return;
                  if (!emphasizeGardenRef.current) setGardenHiMounted(false);
                }}
              />
            )}
            <img
              src={TAB_ICONS[tab]}
              alt=""
              className={`relative z-[1] w-[12px] h-[12px] object-contain flex-shrink-0 filter saturate-[0.8] transition-all duration-300 -mt-[1px] ${
                ftueGardenVisual || isActive ? 'opacity-100' : 'opacity-40 grayscale'
              }`}
            />
            <span 
              ref={(el) => { tabRefs.current[tab] = el; }}
              className="relative z-[1] text-[11px] font-black tracking-[0.1em] transition-colors duration-300"
              style={{ color: getTextColor() }}
            >
              {TAB_LABELS[tab]}
            </span>
          </button>
        );
      })}
      
      {/* Active Tab Indicator - underline + triangle tip */}
      <div 
        className="absolute bottom-0 h-[2px] transition-all rounded-full z-20"
        style={{ 
          transitionDuration: isExpanded ? '700ms' : '250ms',
          transitionTimingFunction: isExpanded ? 'cubic-bezier(0.05, 0, 0, 1)' : 'cubic-bezier(0.22, 0, 0.12, 1)',
          width: '28%',
          left: activeTab === 'SEEDS' ? '4%' : activeTab === 'CROPS' ? '36%' : '68%',
          backgroundColor: underlineColor,
        }}
      >
        <div 
          className="absolute top-[-3px] left-1/2 -translate-x-1/2 transition-colors duration-300"
          style={{
            width: 0,
            height: 0,
            borderLeft: '4px solid transparent',
            borderRight: '4px solid transparent',
            borderBottom: `4px solid ${underlineColor}`,
          }}
        ></div>
      </div>
    </div>
  );
});
