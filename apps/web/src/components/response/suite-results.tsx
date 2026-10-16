// Copyright 2026 Sutyr Inc. SPDX-License-Identifier: Apache-2.0
'use client';

import { useEffect, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import type { CheckId, CheckResult, Delivery, SuiteSummary } from '@webhook-lab/conformance';
import { useLabState } from '@/lib/lab-context';
import { cliTestCommand } from '@/lib/cli-command';
import {
  CHECK_STATUS_META,
  CHECK_STATUS_ORDER,
  SUITE_CHECKS,
  SUITE_DELIVERY_COUNT,
} from '@/lib/suite-checks';
import { CheckStatusBadge, CheckStatusBadgeSkeleton } from '@/components/response/check-status-badge';
import { CommandBlock } from '@/components/ui/command-block';
import { CopyButton } from '@/components/ui/copy-button';
import { cn } from '@/lib/cn';

// ─── Summary ─────────────────────────────────────────────────────────────────

const COUNT_WORDS: Record<keyof SuiteSummary, [string, string]> = {
  pass: ['passed', 'passed'],
  fail: ['failed', 'failed'],
  warn: ['warning', 'warnings'],
  error: ['error', 'errors'],
};

/** Green when nothing failed, amber when only warnings, red otherwise. */
function overallTone(summary: SuiteSummary): string {
  if (summary.fail > 0 || summary.error > 0) return 'text-state-error';
  if (summary.warn > 0) return 'text-state-warning';
  return 'text-state-success';
}

function SummaryCounts({ summary }: { summary: SuiteSummary }) {
  return (
    <ul className="flex flex-wrap gap-x-3 gap-y-1">
      {CHECK_STATUS_ORDER.map((status) => {
        const n = summary[status];
        const [one, many] = COUNT_WORDS[status];
        return (
          <li
            key={status}
            className={cn(
              'flex items-center gap-1.5 font-sans text-[0.75rem]',
              n > 0 ? CHECK_STATUS_META[status].text : 'text-text-muted',
            )}
          >
            <span
              className={cn('h-1.5 w-1.5 rounded-full', n > 0 ? CHECK_STATUS_META[status].dot : 'bg-border-strong')}
              aria-hidden="true"
            />
            <span className="tabular-nums">
              {n} {n === 1 ? one : many}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

// ─── Rows ────────────────────────────────────────────────────────────────────

function formatBody(body: string): string {
  try {
    return JSON.stringify(JSON.parse(body), null, 2);
  } catch {
    return body;
  }
}

function DeliveryRow({ delivery }: { delivery: Delivery }) {
  const ok = delivery.status >= 200 && delivery.status < 300;
  return (
    <div className="rounded-input bg-surface-input px-2.5 py-2">
      <div className="flex items-baseline gap-2">
        <span className="min-w-0 flex-1 font-sans text-[0.72rem] leading-[1.3] text-text-secondary">
          {delivery.label}
        </span>
        <span
          className={cn(
            'flex-shrink-0 font-mono text-[0.69rem] font-medium',
            delivery.status === 0 ? 'text-state-error' : ok ? 'text-state-success' : 'text-state-error',
          )}
        >
          {delivery.status === 0 ? 'No response' : delivery.status}
        </span>
        <span className="flex-shrink-0 font-mono text-[0.69rem] tabular-nums text-text-muted">
          {delivery.durationMs} ms
        </span>
      </div>
      <p className="mt-0.5 truncate font-mono text-[0.69rem] text-text-tertiary" title={delivery.eventType}>
        {delivery.eventType}
      </p>
      <div className="mt-0.5 flex items-center gap-1">
        <span className="flex-shrink-0 font-sans text-[0.66rem] text-text-muted">Request ID</span>
        <span className="min-w-0 truncate font-mono text-[0.66rem] text-text-muted" title={delivery.requestId}>
          {delivery.requestId}
        </span>
        <CopyButton text={delivery.requestId} className="ml-auto flex-shrink-0" />
      </div>
      {delivery.error && (
        <p className="mt-1 font-sans text-[0.69rem] leading-[1.4] text-state-error [overflow-wrap:anywhere]">
          {delivery.error}
        </p>
      )}
      {delivery.responseBody && (
        <pre className="mt-1.5 max-h-24 overflow-auto whitespace-pre-wrap break-all rounded-badge bg-surface-page p-2 font-mono text-[0.66rem] leading-[1.4] text-text-tertiary">
          {formatBody(delivery.responseBody)}
        </pre>
      )}
    </div>
  );
}

function CheckResultRow({
  result,
  index,
  isOpen,
  onToggle,
}: {
  result: CheckResult;
  index: number;
  isOpen: boolean;
  onToggle: () => void;
}) {
  const panelId = `suite-result-${result.id}-detail`;
  return (
    <li
      id={`suite-result-${result.id}`}
      className="animate-slide-up scroll-mt-4 rounded-card border border-border"
      style={{ animationDelay: `${index * 50}ms`, animationFillMode: 'backwards' }}
    >
      <button
        type="button"
        aria-expanded={isOpen}
        aria-controls={panelId}
        onClick={onToggle}
        className="group block w-full px-3 py-2.5 text-left"
      >
        <span className="flex items-center gap-2">
          <CheckStatusBadge status={result.status} />
          <span className="ml-auto font-mono text-[0.69rem] tabular-nums text-text-muted">
            {result.durationMs} ms
          </span>
          <ChevronDown
            size={14}
            strokeWidth={1.75}
            className={cn(
              'flex-shrink-0 text-text-muted transition-transform duration-200 group-hover:text-text-secondary',
              isOpen && 'rotate-180',
            )}
          />
        </span>
        <span className="mt-1.5 block font-sans text-[0.81rem] leading-[1.3] text-text-primary">
          {result.title}
        </span>
        <span className="mt-1 grid grid-cols-[max-content_minmax(0,1fr)] gap-x-2 gap-y-0.5 font-sans text-[0.72rem] leading-[1.4]">
          <span className="text-text-muted">Expected</span>
          <span className="min-w-0 text-text-secondary [overflow-wrap:anywhere]">{result.expected}</span>
          <span className="text-text-muted">Observed</span>
          {/* Transport errors can be long unbroken strings; keep them inside the card. */}
          <span className="min-w-0 text-text-secondary [overflow-wrap:anywhere]">{result.observed}</span>
        </span>
      </button>

      {isOpen && (
        <div id={panelId} className="animate-fade-in space-y-3 border-t border-border px-3 py-2.5">
          <div>
            <p className="label-section mb-1">Why it matters</p>
            <p className="font-sans text-[0.75rem] font-light leading-[1.45] text-text-secondary">
              {result.why}
            </p>
          </div>
          {result.deliveries.length > 0 && (
            <div>
              <p className="label-section mb-1">
                {result.deliveries.length === 1 ? 'Delivery' : `${result.deliveries.length} deliveries`}
              </p>
              <div className="space-y-1.5">
                {result.deliveries.map((d) => (
                  <DeliveryRow key={d.requestId} delivery={d} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </li>
  );
}

// ─── States ──────────────────────────────────────────────────────────────────

function CiBlock({ url }: { url: string }) {
  return (
    <section className="border-t border-border pt-4" aria-labelledby="suite-ci-label">
      <h2 id="suite-ci-label" className="label-section">
        Run this in CI
      </h2>
      <p className="mt-0.5 font-sans text-[0.69rem] leading-[1.4] text-text-muted">
        Exits with code 1 when a check fails or errors, so the job fails with it.
      </p>
      <CommandBlock command={cliTestCommand(url)} className="mt-2" />
    </section>
  );
}

function EmptyState() {
  return (
    <div className="px-1 py-2">
      <p className="mb-3 font-sans text-[0.81rem] text-text-secondary">What the results mean</p>
      <div>
        {CHECK_STATUS_ORDER.map((status) => (
          <div key={status} className="flex items-start gap-3 py-1.5">
            <span className="w-[68px] flex-shrink-0">
              <CheckStatusBadge status={status} />
            </span>
            <span className="pt-[3px] font-sans text-[0.75rem] leading-[1.35] text-text-secondary">
              {CHECK_STATUS_META[status].meaning}
            </span>
          </div>
        ))}
      </div>
      <p className="mt-3 font-sans text-[0.69rem] leading-[1.4] text-text-muted">
        The Lab judges status codes and response times only. It cannot see what your handler does
        with an event.
      </p>
    </div>
  );
}

function useElapsedSeconds(startedAt: number | null): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (startedAt === null) return;
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [startedAt]);
  return startedAt === null ? 0 : Math.max(0, Math.floor((now - startedAt) / 1000));
}

function RunningState({ startedAt }: { startedAt: number | null }) {
  const elapsed = useElapsedSeconds(startedAt);
  return (
    <div className="space-y-3" aria-busy="true">
      <div>
        <span className="shimmer-line !block !h-5 w-32 rounded" aria-hidden="true" />
        <p className="mt-2 font-sans text-[0.72rem] leading-[1.4] text-text-muted">
          Sending {SUITE_DELIVERY_COUNT} deliveries, one at a time.{' '}
          <span className="font-mono tabular-nums">{elapsed} s</span>
        </p>
        <p className="font-sans text-[0.69rem] leading-[1.4] text-text-muted">
          A slow handler can take up to a minute.
        </p>
      </div>
      <ol className="space-y-1.5">
        {SUITE_CHECKS.map((check) => (
          <li key={check.id} className="rounded-card border border-border px-3 py-2.5">
            <span className="flex items-center gap-2">
              <CheckStatusBadgeSkeleton />
              <span className="shimmer-line ml-auto !block !h-3 w-10 rounded" aria-hidden="true" />
            </span>
            <span className="mt-1.5 block font-sans text-[0.81rem] leading-[1.3] text-text-tertiary">
              {check.title}
            </span>
            <span className="shimmer-line mt-1.5 !block !h-3 w-3/4 rounded" aria-hidden="true" />
          </li>
        ))}
      </ol>
    </div>
  );
}

/** The API error message, with a trailing CLI command split out to copy. */
function ErrorState({ message }: { message: string }) {
  const match = /^([\s\S]*?)\s*(npx @sutyr\/webhook-lab \S[\s\S]*)$/.exec(message);
  const text = match ? match[1] : message;
  const command = match?.[2];
  return (
    <div className="rounded-card bg-error-10 p-3">
      <p className="font-sans text-[0.81rem] leading-[1.4] text-state-error [overflow-wrap:anywhere]">{text}</p>
      {command && <CommandBlock command={command} className="mt-2" />}
    </div>
  );
}

// ─── Main ────────────────────────────────────────────────────────────────────

export function SuiteResults() {
  const {
    targetUrl, suiteReport, suiteRunning, suiteStartedAt, suiteError, focusedCheck, focusNonce,
  } = useLabState();
  const [expanded, setExpanded] = useState<ReadonlySet<CheckId>>(new Set());

  // A new report starts with every row closed.
  useEffect(() => {
    setExpanded(new Set());
  }, [suiteReport]);

  // A check picked in the sidebar opens here once there are results.
  useEffect(() => {
    if (!focusedCheck || !suiteReport) return;
    setExpanded((prev) => new Set(prev).add(focusedCheck));
    document
      .getElementById(`suite-result-${focusedCheck}`)
      ?.scrollIntoView({ block: 'start', behavior: 'smooth' });
  }, [focusedCheck, focusNonce, suiteReport]);

  function toggle(id: CheckId) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  let body: React.ReactNode;
  if (suiteRunning) {
    body = <RunningState startedAt={suiteStartedAt} />;
  } else if (suiteError) {
    body = <ErrorState message={suiteError} />;
  } else if (suiteReport) {
    const { summary } = suiteReport;
    const total = suiteReport.results.length;
    body = (
      <div className="space-y-3" role="region" aria-label="Check results">
        <div className="animate-slide-up">
          <p className={cn('flex items-baseline gap-1.5', overallTone(summary))}>
            <span className="font-mono text-[1.25rem] font-medium tabular-nums">
              {summary.pass}/{total}
            </span>
            <span className="font-sans text-[0.81rem] font-medium">passed</span>
          </p>
          <p
            className="mt-0.5 truncate font-mono text-[0.69rem] text-text-muted"
            title={suiteReport.target}
          >
            {suiteReport.target}
          </p>
          <p className="font-sans text-[0.69rem] text-text-muted">
            Stripe API <span className="font-mono">{suiteReport.apiVersion}</span>
          </p>
        </div>
        <SummaryCounts summary={summary} />
        <ol className="space-y-1.5">
          {suiteReport.results.map((result, i) => (
            <CheckResultRow
              key={result.id}
              result={result}
              index={i}
              isOpen={expanded.has(result.id)}
              onToggle={() => toggle(result.id)}
            />
          ))}
        </ol>
      </div>
    );
  } else {
    body = <EmptyState />;
  }

  // One live region that stays mounted, so screen readers hear the outcome
  // once instead of the whole report.
  const announcement = suiteRunning
    ? 'Running checks'
    : suiteError
      ? `The checks could not run. ${suiteError}`
      : suiteReport
        ? `${suiteReport.summary.pass} of ${suiteReport.results.length} checks passed`
        : '';

  return (
    <div className="space-y-4">
      <p className="sr-only" role="status">
        {announcement}
      </p>
      {body}
      <CiBlock url={targetUrl} />
    </div>
  );
}
