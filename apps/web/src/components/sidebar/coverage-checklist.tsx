// Copyright 2026 Sutyr Inc. SPDX-License-Identifier: Apache-2.0
'use client';

import { useEffect } from 'react';
import { EVENT_CATALOG } from '@webhook-lab/events';
import { useLabState, useLabDispatch } from '@/lib/lab-context';
import { cn } from '@/lib/cn';

const STORAGE_KEY = 'webhook-lab-tested-events';

function loadTestedEvents(): Set<string> {
  try {
    const stored = sessionStorage.getItem(STORAGE_KEY);
    if (stored) return new Set(JSON.parse(stored));
  } catch {}
  return new Set();
}

function saveTestedEvents(tested: Set<string>): void {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify([...tested]));
  } catch {}
}

export function CoverageChecklist() {
  const { responseHistory, testedEventTypes } = useLabState();
  const dispatch = useLabDispatch();

  // Hydrate from sessionStorage on mount
  useEffect(() => {
    const stored = loadTestedEvents();
    if (stored.size > 0) {
      dispatch({ type: 'HYDRATE_TESTED_EVENTS', eventTypes: stored });
    }
  }, [dispatch]);

  // Persist to sessionStorage when testedEventTypes changes via FIRE_SUCCESS
  useEffect(() => {
    if (testedEventTypes.size > 0) {
      saveTestedEvents(testedEventTypes);
    }
  }, [testedEventTypes]);

  const total = EVENT_CATALOG.length;
  const testedCount = testedEventTypes.size;
  const percentage = total > 0 ? Math.round((testedCount / total) * 100) : 0;

  return (
    <div className="border-t border-border px-3 py-2">
      <div className="mb-1.5 flex items-center justify-between">
        <span className="font-mono text-[0.69rem] font-medium uppercase tracking-[0.12em] text-text-muted">
          Coverage
        </span>
        <span className="font-mono text-[0.69rem] text-text-muted">
          {testedCount}/{total}
        </span>
      </div>
      <div className="h-1 w-full overflow-hidden rounded-full bg-border">
        <div
          className={cn(
            'h-full rounded-full transition-[width] duration-300',
            percentage === 100 ? 'bg-state-success' : 'bg-copper',
          )}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}
