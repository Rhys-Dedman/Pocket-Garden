
import React, { useRef, useImperativeHandle, forwardRef } from 'react';
import { TabType } from '../types';

interface UpgradeTabsProps {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
  /** Tabs that currently have limited offers */
  tabsWithOffers?: Set<TabType>;
  /** When true, panel is expanded (use stronger ease-out for opening) */
  isExpanded?: boolean;
}

export interface UpgradeTabsRef {
  getTabRef: (tab: TabType) => HTMLSpanElement | null;
}

const TAB_ICONS: Record<TabType, string> = {
  SEEDS: '🌱',
  CROPS: '🌻',
  HARVEST: '🪙',
};

const TAB_LABELS: Record<TabType, string> = {
  SEEDS: 'SEEDS',
  CROPS: 'GARDEN',
  HARVEST: 'ORDERS',
};

const NOTIFICATION_COLOR = '#e6803a';
const NOTIFICATION_UNDERLINE_COLOR = '#f59d42';
const NORMAL_UNDERLINE_COLOR = '#a7c957';

export const UpgradeTabs = forwardRef<UpgradeTabsRef, UpgradeTabsProps>(({ activeTab, onTabChange, tabsWithOffers = new Set(), isExpanded = false }, ref) => {
  const tabs: TabType[] = ['SEEDS', 'CROPS', 'HARVEST'];
  
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
          // Active tab with offer = yellow
          if (isActive && hasOffer) return NOTIFICATION_COLOR;
          // Active tab without offer = green
          if (isActive) return '#6a994e';
          // Inactive tab with offers = yellow notification
          if (hasOffer) return NOTIFICATION_COLOR;
          // Inactive tab without offers = brown/tan
          return '#c2b280';
        };

        return (
          <button
            key={tab}
            id={tab === 'HARVEST' ? 'ftue10-tab-orders' : tab === 'SEEDS' ? 'ftue10-tab-seeds' : undefined}
            onClick={() => onTabChange(tab)}
            className={`flex-1 flex flex-row items-center justify-center space-x-1.5 transition-all duration-300 active:scale-95 h-full relative z-10`}
            style={{ touchAction: 'manipulation' }}
          >
            <span className={`text-[9px] filter saturate-[0.8] ${isActive ? 'opacity-100' : 'opacity-40 grayscale'}`}>
              {TAB_ICONS[tab]}
            </span>
            <span 
              ref={(el) => { tabRefs.current[tab] = el; }}
              className="text-[11px] font-black tracking-[0.1em] transition-colors duration-300"
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
        }}
        style={{
          width: '28%',
          left: activeTab === 'SEEDS' ? '4%' : activeTab === 'CROPS' ? '36%' : '68%',
          backgroundColor: underlineColor,
        }}
      >
        <div 
          className="absolute top-[-4px] left-1/2 -translate-x-1/2 transition-colors duration-300"
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
