// Copyright 2026 Sutyr Inc. SPDX-License-Identifier: Apache-2.0
'use client';

import { useState, useEffect } from 'react';
import { PanelLeftOpen, PanelLeftClose } from 'lucide-react';
import { useLabState } from '@/lib/lab-context';
import { SidebarTabs } from '@/components/sidebar/sidebar-tabs';
import { EventCatalog } from '@/components/sidebar/event-catalog';
import { ScenarioList } from '@/components/sidebar/scenario-list';
import { CollapsedSidebar } from '@/components/sidebar/collapsed-sidebar';
import { CoverageChecklist } from '@/components/sidebar/coverage-checklist';
import { cn } from '@/lib/cn';

const COLLAPSED_KEY = 'webhook-lab-sidebar-collapsed';

export function Sidebar() {
  const { activeTab } = useLabState();
  const [isCollapsed, setIsCollapsed] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(COLLAPSED_KEY);
      if (stored === 'true') setIsCollapsed(true);
    } catch {}
  }, []);

  function toggleCollapsed() {
    setIsCollapsed((prev) => {
      const next = !prev;
      try { localStorage.setItem(COLLAPSED_KEY, String(next)); } catch {}
      return next;
    });
  }

  return (
    <aside
      className={cn(
        'flex flex-shrink-0 flex-col overflow-hidden border-r border-border-medium bg-surface-card transition-[width] duration-[260ms] [transition-timing-function:cubic-bezier(0.4,0,0.2,1)]',
        isCollapsed ? 'w-12' : 'w-[220px]',
      )}
    >
      {isCollapsed ? (
        <CollapsedSidebar onExpand={() => {
          setIsCollapsed(false);
          try { localStorage.setItem(COLLAPSED_KEY, 'false'); } catch {}
        }} />
      ) : (
        <>
          <SidebarTabs />
          <div className="flex-1 overflow-y-auto scroll-shadow">
            <div key={activeTab} className="animate-fade-in">
              {activeTab === 'events' ? <EventCatalog /> : <ScenarioList />}
            </div>
          </div>
        </>
      )}

      {/* Pinned to bottom — coverage bar + collapse toggle */}
      {!isCollapsed && <CoverageChecklist />}
      <div className="flex flex-col items-center border-t border-border py-2">
        {isCollapsed && <div className="mb-2 w-6 border-t border-border-medium" />}
        <button
          type="button"
          onClick={toggleCollapsed}
          className="rounded-input p-2 text-text-muted transition-colors hover:bg-surface-input hover:text-text-secondary"
          aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {isCollapsed ? (
            <PanelLeftOpen size={16} strokeWidth={1.75} />
          ) : (
            <PanelLeftClose size={16} strokeWidth={1.75} />
          )}
        </button>
      </div>
    </aside>
  );
}
