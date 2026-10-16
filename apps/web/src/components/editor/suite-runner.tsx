// Copyright 2026 Sutyr Inc. SPDX-License-Identifier: Apache-2.0
'use client';

import { useEffect, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import type { CheckId } from '@webhook-lab/conformance';
import { useLabState, useLabDispatch } from '@/lib/lab-context';
import { runChecks } from '@/lib/fire-event';
import { cliTestCommand } from '@/lib/cli-command';
import { SUITE_CHECKS, SUITE_DELIVERY_COUNT } from '@/lib/suite-checks';
import { cn } from '@/lib/cn';
import { TargetFields } from './target-fields';
import { PrimaryActionButton, useOutcomeFlash, useRunShortcut } from './primary-action-button';

/**
 * Suite mode's editor: what the suite checks, where to send it and the
 * button that runs it. Results land in the response panel.
 */
export function SuiteRunner() {
  const { targetUrl, signingSecret, suiteRunning, suiteReport, focusedCheck, focusNonce } =
    useLabState();
  const dispatch = useLabDispatch();
  const [expanded, setExpanded] = useState<ReadonlySet<CheckId>>(new Set());

  const flash = useOutcomeFlash(
    suiteReport,
    (r) => r.summary.fail === 0 && r.summary.error === 0,
  );

  const canRun = targetUrl.trim() !== '' && signingSecret !== '';

  function doRun() {
    if (!canRun || suiteRunning) return;
    dispatch({ type: 'SUITE_START', startedAt: Date.now() });
    runChecks({ targetUrl: targetUrl.trim(), signingSecret })
      .then((report) => dispatch({ type: 'SUITE_SUCCESS', report }))
      .catch((err: unknown) =>
        dispatch({
          type: 'SUITE_ERROR',
          error: err instanceof Error ? err.message : 'The checks could not run.',
        }),
      );
  }

  useRunShortcut(doRun);

  // A check picked in the sidebar before any run opens here; once there are
  // results, the response panel shows it instead.
  useEffect(() => {
    if (!focusedCheck || suiteReport) return;
    setExpanded((prev) => new Set(prev).add(focusedCheck));
    document
      .getElementById(`suite-check-${focusedCheck}`)
      ?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [focusedCheck, focusNonce, suiteReport]);

  function toggle(id: CheckId) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-sans text-[0.94rem] font-medium leading-[1.3] text-text-primary">
          Test your webhook handler
        </h1>
        <p className="mt-1 max-w-[60ch] font-sans text-[0.81rem] font-light leading-[1.4] text-text-secondary">
          Sends correctly signed, forged, stale, duplicate and out-of-order events to your endpoint and
          checks how it responds.
        </p>
      </div>

      <div className="space-y-3">
        <TargetFields
          idPrefix="suite"
          cliCommand={cliTestCommand}
          emptyHint="Your handler's public URL. For a handler on localhost, run the checks from your machine with the CLI."
          secretHint="Use the secret your handler verifies with. With any other secret, the signature checks prove nothing."
        />
        <PrimaryActionButton
          label="Run checks"
          busyLabel="Running checks"
          busy={suiteRunning}
          disabled={!canRun}
          onRun={doRun}
          flash={flash}
        />
      </div>

      <section className="border-t border-border pt-4" aria-labelledby="suite-checklist-label">
        <div className="mb-1 flex items-baseline justify-between gap-3">
          <h2 id="suite-checklist-label" className="label-section">
            What gets checked
          </h2>
          <span className="font-sans text-[0.69rem] text-text-muted">
            {SUITE_CHECKS.length} checks, {SUITE_DELIVERY_COUNT} deliveries
          </span>
        </div>
        <ol>
          {SUITE_CHECKS.map((check, i) => {
            const isOpen = expanded.has(check.id);
            const panelId = `suite-check-${check.id}-why`;
            return (
              <li
                key={check.id}
                id={`suite-check-${check.id}`}
                className="scroll-mt-4 border-b border-border last:border-b-0"
              >
                <button
                  type="button"
                  aria-expanded={isOpen}
                  aria-controls={panelId}
                  onClick={() => toggle(check.id)}
                  className="group flex w-full items-center gap-3 py-2.5 text-left"
                >
                  <span className="w-4 flex-shrink-0 text-right font-sans text-[0.69rem] tabular-nums text-text-muted">
                    {i + 1}
                  </span>
                  <span
                    className={cn(
                      'min-w-0 flex-1 font-sans text-[0.81rem] leading-[1.3] transition-colors',
                      isOpen ? 'text-text-primary' : 'text-text-secondary group-hover:text-text-primary',
                    )}
                  >
                    {check.title}
                  </span>
                  <ChevronDown
                    size={14}
                    strokeWidth={1.75}
                    className={cn(
                      'flex-shrink-0 text-text-muted transition-transform duration-200',
                      isOpen && 'rotate-180',
                    )}
                  />
                </button>
                {isOpen && (
                  <div id={panelId} className="animate-fade-in pb-3 pl-7 pr-6">
                    <p className="font-sans text-[0.75rem] font-light leading-[1.45] text-text-secondary">
                      {check.why}
                    </p>
                    <p className="mt-1.5 font-sans text-[0.69rem] leading-[1.4] text-text-muted">
                      To run only this check from the CLI, add{' '}
                      <code className="font-mono text-text-tertiary">--only {check.id}</code>
                    </p>
                  </div>
                )}
              </li>
            );
          })}
        </ol>
      </section>
    </div>
  );
}
