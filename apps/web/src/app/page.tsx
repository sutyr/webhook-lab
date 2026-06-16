// Copyright 2026 Sutyr Inc. SPDX-License-Identifier: Apache-2.0
'use client';

import { useState, useEffect, useRef } from 'react';
import { Header } from '@/components/header';
import { Footer } from '@/components/footer';
import { Sidebar } from '@/components/layout/sidebar';
import { CenterPanel } from '@/components/layout/center-panel';
import { ResponsePanel } from '@/components/layout/response-panel';
import { SidebarDrawer } from '@/components/sidebar/sidebar-drawer';
import { SidebarTabs } from '@/components/sidebar/sidebar-tabs';
import { MobileTabContent } from '@/components/sidebar/mobile-tab-content';
import { MobileViewTabs } from '@/components/layout/mobile-view-tabs';
import { ErrorBoundary } from '@/components/error-boundary';
import { useLabState } from '@/lib/lab-context';
import { cn } from '@/lib/cn';

export default function HomePage() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);
  const { mobileView, selectedEventType, selectedScenarioId, mode } = useLabState();

  useEffect(() => {
    setHasLoaded(true);
  }, []);

  // Auto-close the mobile drawer once a selection is made, so the editor the
  // user just configured isn't left hidden behind the drawer. Skip the first
  // run so hydration / URL-restore doesn't trigger a spurious close.
  const selectionInitialized = useRef(false);
  useEffect(() => {
    if (!selectionInitialized.current) {
      selectionInitialized.current = true;
      return;
    }
    setDrawerOpen(false);
  }, [selectedEventType, selectedScenarioId, mode]);

  return (
    <ErrorBoundary>
      <div className="flex h-screen flex-col">
        <Header onMenuClick={() => setDrawerOpen(true)} />

        {/* Mobile-only Editor | Response segmented control */}
        <MobileViewTabs />

        <div className="flex flex-1 overflow-hidden">
          {/* Sidebar: visible on lg+ (#13 panel entry) */}
          <div
            className={cn(
              'panel-animated hidden lg:block',
              !hasLoaded && 'opacity-0',
              hasLoaded && 'animate-[panelEnterLeft_250ms_ease-out_0ms_forwards]',
            )}
          >
            <Sidebar />
          </div>

          {/* Mobile drawer: rendered on < lg */}
          <SidebarDrawer isOpen={drawerOpen} onClose={() => setDrawerOpen(false)}>
            <SidebarTabs />
            <MobileTabContent />
          </SidebarDrawer>

          {/* Center + Response (#13 staggered entry).
              Below md, the segmented control swaps which panel is shown; at md+
              both are always visible side-by-side regardless of mobileView. */}
          <div className="flex flex-1 flex-col overflow-hidden md:flex-row">
            <div
              className={cn(
                'panel-animated min-w-0 flex-1 flex-col overflow-hidden',
                mobileView === 'response' ? 'hidden md:flex' : 'flex',
                !hasLoaded && 'opacity-0',
                hasLoaded && 'animate-[panelEnterUp_250ms_ease-out_100ms_forwards]',
              )}
            >
              <CenterPanel />
            </div>
            <div
              className={cn(
                'panel-animated min-h-0 flex-1 flex-col overflow-hidden md:flex-none',
                mobileView === 'editor' ? 'hidden md:flex' : 'flex',
                !hasLoaded && 'opacity-0',
                hasLoaded && 'animate-[panelEnterRight_250ms_ease-out_200ms_forwards]',
              )}
            >
              <ResponsePanel />
            </div>
          </div>
        </div>
        <Footer />
      </div>
    </ErrorBoundary>
  );
}
