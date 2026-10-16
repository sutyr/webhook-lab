// Copyright 2026 Sutyr Inc. SPDX-License-Identifier: Apache-2.0
'use client';

import { useLabState, useLabDispatch } from '@/lib/lab-context';
import { cn } from '@/lib/cn';

const VIEWS = ['editor', 'response'] as const;

const LABELS: Record<'suite' | 'other', Record<(typeof VIEWS)[number], string>> = {
  suite: { editor: 'Checks', response: 'Results' },
  other: { editor: 'Editor', response: 'Response' },
};

/**
 * Mobile-only (<md) segmented control swapping the center editor and the
 * response panel, so each gets the full width of a phone screen. Hidden at
 * md+ where both panels show side-by-side. A copper dot marks Response when
 * a result is present. The suite calls the two views Checks and Results.
 */
export function MobileViewTabs() {
  const { mobileView, response, scenarioResults, mode, suiteReport, suiteError } = useLabState();
  const dispatch = useLabDispatch();

  const hasResult =
    mode === 'suite'
      ? suiteReport !== null || suiteError !== null
      : mode === 'scenario'
        ? scenarioResults.some((r) => r.status === 'done' || r.status === 'error')
        : response !== null;
  const labels = LABELS[mode === 'suite' ? 'suite' : 'other'];

  return (
    <div
      className="flex h-11 flex-shrink-0 border-b border-border-medium bg-surface-card md:hidden"
      role="tablist"
      aria-label="Editor and response views"
    >
      {VIEWS.map((view) => {
        const isActive = mobileView === view;
        return (
          <button
            key={view}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => dispatch({ type: 'SET_MOBILE_VIEW', view })}
            className={cn(
              'flex flex-1 items-center justify-center gap-1.5 font-sans text-[0.81rem] font-medium transition-colors duration-150',
              isActive
                ? 'border-b-2 border-copper-body text-text-primary'
                : 'text-text-tertiary hover:text-text-secondary',
            )}
          >
            {labels[view]}
            {view === 'response' && hasResult && (
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
