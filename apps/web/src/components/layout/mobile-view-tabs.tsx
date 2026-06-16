// Copyright 2026 Sutyr Inc. SPDX-License-Identifier: Apache-2.0
'use client';

import { useLabState, useLabDispatch } from '@/lib/lab-context';
import { cn } from '@/lib/cn';

const TABS: { id: 'editor' | 'response'; label: string }[] = [
  { id: 'editor', label: 'Editor' },
  { id: 'response', label: 'Response' },
];

/**
 * Mobile-only (<md) segmented control swapping the center editor and the
 * response panel, so each gets the full width of a phone screen. Hidden at
 * md+ where both panels show side-by-side. A copper dot marks Response when
 * a result is present.
 */
export function MobileViewTabs() {
  const { mobileView, response, scenarioResults, mode } = useLabState();
  const dispatch = useLabDispatch();

  const hasResult =
    mode === 'scenario'
      ? scenarioResults.some((r) => r.status === 'done' || r.status === 'error')
      : response !== null;

  return (
    <div
      className="flex h-11 flex-shrink-0 border-b border-border-medium bg-surface-card md:hidden"
      role="tablist"
      aria-label="Editor and response views"
    >
      {TABS.map((tab) => {
        const isActive = mobileView === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => dispatch({ type: 'SET_MOBILE_VIEW', view: tab.id })}
            className={cn(
              'flex flex-1 items-center justify-center gap-1.5 font-sans text-[0.81rem] font-medium transition-colors duration-150',
              isActive
                ? 'border-b-2 border-copper-body text-text-primary'
                : 'text-text-tertiary hover:text-text-secondary',
            )}
          >
            {tab.label}
            {tab.id === 'response' && hasResult && (
              <span
                className="h-1.5 w-1.5 flex-shrink-0 rounded-full bg-copper"
                aria-label="New response"
              />
            )}
          </button>
        );
      })}
    </div>
  );
}
