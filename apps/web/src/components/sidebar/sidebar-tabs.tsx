// Copyright 2026 Sutyr Inc. SPDX-License-Identifier: Apache-2.0
'use client';

import { useEffect } from 'react';
import { useLabState, useLabDispatch, type SidebarTab } from '@/lib/lab-context';
import { cn } from '@/lib/cn';

const TABS: { id: SidebarTab; label: string; shortcut: string }[] = [
  { id: 'events', label: 'Events', shortcut: '1' },
  { id: 'scenarios', label: 'Scenarios', shortcut: '2' },
];

export function SidebarTabs() {
  const { activeTab } = useLabState();
  const dispatch = useLabDispatch();

  // Keyboard shortcut: Cmd/Ctrl+1 → Events, Cmd/Ctrl+2 → Scenarios
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (!e.metaKey && !e.ctrlKey) return;
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT') return;

      if (e.key === '1') {
        e.preventDefault();
        dispatch({ type: 'SET_TAB', tab: 'events' });
      } else if (e.key === '2') {
        e.preventDefault();
        dispatch({ type: 'SET_TAB', tab: 'scenarios' });
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [dispatch]);

  return (
    <div className="flex h-10 border-b border-border" role="tablist" aria-label="Sidebar navigation">
      {TABS.map((tab) => {
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
