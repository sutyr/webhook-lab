// Copyright 2026 Sutyr Inc. SPDX-License-Identifier: Apache-2.0
'use client';

import { useEffect } from 'react';
import { useLabState, useLabDispatch, type SidebarTab } from '@/lib/lab-context';
import { cn } from '@/lib/cn';

export const SIDEBAR_TABS: { id: SidebarTab; label: string }[] = [
  { id: 'suite', label: 'Suite' },
  { id: 'scenarios', label: 'Scenarios' },
  { id: 'events', label: 'Events' },
];

export function SidebarTabs() {
  const { activeTab } = useLabState();
  const dispatch = useLabDispatch();

  // Cmd/Ctrl+1, 2, 3 pick the tabs in the order they are shown.
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (!e.metaKey && !e.ctrlKey) return;
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT') return;

      const tab = SIDEBAR_TABS[Number(e.key) - 1];
      if (tab && /^[1-9]$/.test(e.key)) {
        e.preventDefault();
        dispatch({ type: 'SET_TAB', tab: tab.id });
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [dispatch]);

  return (
    <div className="flex h-10 flex-shrink-0 border-b border-border" role="tablist" aria-label="Sidebar navigation">
      {SIDEBAR_TABS.map((tab) => {
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            aria-controls={`tabpanel-${tab.id}`}
            onClick={() => dispatch({ type: 'SET_TAB', tab: tab.id })}
            className={cn(
              'flex-1 font-sans text-[0.75rem] font-medium transition-colors duration-150',
              isActive
                ? 'border-b-2 border-copper-body text-text-primary'
                : 'text-text-tertiary hover:text-text-secondary',
            )}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
