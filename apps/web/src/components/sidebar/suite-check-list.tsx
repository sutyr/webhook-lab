// Copyright 2026 Sutyr Inc. SPDX-License-Identifier: Apache-2.0
'use client';

import { useLabState, useLabDispatch } from '@/lib/lab-context';
import { CHECK_STATUS_META, SUITE_CHECKS } from '@/lib/suite-checks';
import { cn } from '@/lib/cn';

/**
 * The Suite tab: each check with the status from the last run. Picking one
 * opens it in the results, or in the checklist before the first run.
 */
export function SuiteCheckList() {
  const { mode, suiteReport, suiteRunning, focusedCheck } = useLabState();
  const dispatch = useLabDispatch();

  return (
    <div id="tabpanel-suite" role="tabpanel" aria-label="Suite" className="py-1">
      <div className="flex items-baseline justify-between px-3 pb-1 pt-2">
        <span className="label-section">Checks</span>
        {suiteReport ? (
          <span className="font-mono text-[0.69rem] text-text-muted">
            {suiteReport.summary.pass}/{suiteReport.results.length}
          </span>
        ) : (
          <span className="font-mono text-[0.69rem] text-text-muted">{SUITE_CHECKS.length}</span>
        )}
      </div>
      <ul>
        {SUITE_CHECKS.map((check) => {
          const result = suiteReport?.results.find((r) => r.id === check.id);
          const isFocused = mode === 'suite' && focusedCheck === check.id;
          return (
            <li key={check.id}>
              <button
                type="button"
                onClick={() => dispatch({ type: 'FOCUS_CHECK', id: check.id })}
                className={cn(
                  'flex w-full items-start gap-2.5 border-l-[3px] py-2 pl-3 pr-2 text-left transition-colors duration-150',
                  isFocused
                    ? 'border-text-primary bg-surface-input text-text-primary'
                    : 'border-transparent text-text-secondary hover:bg-surface-input hover:text-text-primary',
                )}
              >
                <span
                  className={cn(
                    'mt-[5px] h-1.5 w-1.5 flex-shrink-0 rounded-full',
                    suiteRunning
                      ? 'animate-pulse bg-state-info'
                      : result
                        ? CHECK_STATUS_META[result.status].dot
                        : 'bg-border-strong',
                  )}
                  aria-hidden="true"
                />
                <span className="min-w-0 flex-1 font-sans text-[0.75rem] leading-[1.35]">
                  {check.title}
                  {result && <span className="sr-only">, {CHECK_STATUS_META[result.status].label}</span>}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
