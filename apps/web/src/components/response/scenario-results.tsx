// Copyright 2026 Sutyr Inc. SPDX-License-Identifier: Apache-2.0
'use client';

import { useState } from 'react';
import { useLabState } from '@/lib/lab-context';
import { HealthSummary } from '@/components/response/health-summary';
import { cn } from '@/lib/cn';

function statusColorClass(code: number): string {
  if (code === 0) return 'text-state-error';
  if (code >= 200 && code < 300) return 'text-state-success';
  if (code >= 300 && code < 400) return 'text-state-warning';
  return 'text-state-error';
}

function formatBody(body: string): string {
  try {
    return JSON.stringify(JSON.parse(body), null, 2);
  } catch {
    return body;
  }
}

// ─── Segmented Progress Bar ─────────────────────────────────────────────────

function SegmentedProgress({
  results,
}: {
  results: Array<{ status: string; response: { statusCode: number } | null }>;
}) {
  const completed = results.filter(
    (r) => r.status === 'done' || r.status === 'error',
  ).length;

  return (
    <div className="border-b border-border px-1 pb-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="font-mono text-[0.69rem] font-medium uppercase tracking-[0.12em] text-text-muted">
          Progress
        </span>
        <span className="font-mono text-[0.75rem] text-text-secondary">
          {completed}/{results.length}
        </span>
      </div>
      <div className="flex gap-1">
        {results.map((r, i) => {
          const isSuccess =
            r.status === 'done' &&
            r.response &&
            r.response.statusCode >= 200 &&
            r.response.statusCode < 300;
          const isError =
            r.status === 'error' ||
            (r.status === 'done' &&
              r.response &&
              (r.response.statusCode < 200 || r.response.statusCode >= 300));

          return (
            <div
              key={i}
              className={cn(
                'h-1.5 flex-1 rounded-full transition-colors duration-300',
                isSuccess && 'bg-state-success',
                isError && 'bg-state-error',
                r.status === 'firing' && 'animate-pulse bg-state-info',
                r.status === 'pending' && 'bg-surface-input',
              )}
            />
          );
        })}
      </div>
    </div>
  );
}

// ─── Step Result Card ───────────────────────────────────────────────────────

function StepResultCard({
  stepIndex,
  eventType,
  status,
  response,
}: {
  stepIndex: number;
  eventType: string;
  status: string;
  response: { statusCode: number; responseBody: string; responseTimeMs: number } | null;
}) {
  const [expanded, setExpanded] = useState(false);

  const isDone = status === 'done' || status === 'error';
  const isError =
    status === 'error' || (response && (response.statusCode < 200 || response.statusCode >= 300));

  const isSuccess = response && response.statusCode >= 200 && response.statusCode < 300;

  return (
    <div
      className={cn(
        'rounded-card border border-border',
        isSuccess && 'bg-state-success/5',
        isError && 'bg-state-error/5',
        !isDone && 'bg-surface-input',
      )}
    >
      <button
        type="button"
        onClick={() => isDone && setExpanded(!expanded)}
        className={cn(
          'flex w-full items-center gap-2 px-3 py-2',
          isDone && 'cursor-pointer',
        )}
      >
        <span className="font-mono text-[0.75rem] text-text-secondary">
          {stepIndex + 1}.
        </span>
        <span className="min-w-0 flex-1 truncate text-left font-mono text-[0.75rem] text-text-secondary">
          {eventType}
        </span>
        {response && (
          <span className="flex items-center gap-2">
            <span
              className={cn(
                'rounded-badge px-1.5 py-0.5 font-mono text-[0.69rem] font-medium',
                isSuccess
                  ? 'bg-state-success/10 text-state-success'
                  : 'bg-state-error/10 text-state-error',
              )}
            >
              {response.statusCode}
            </span>
            <span className="font-mono text-[0.69rem] text-text-muted">
              {response.responseTimeMs}ms
            </span>
          </span>
        )}
        {status === 'firing' && (
          <span className="h-2 w-2 flex-shrink-0 animate-pulse rounded-full bg-state-info" />
        )}
        {status === 'pending' && (
          <span className="h-2 w-2 flex-shrink-0 rounded-full bg-text-muted" />
        )}
      </button>

      {expanded && response && (
        <div className="border-t border-border px-3 py-2">
          <pre className="max-h-40 overflow-auto font-mono text-[0.75rem] text-text-primary">
            {formatBody(response.responseBody)}
          </pre>
        </div>
      )}
    </div>
  );
}

// ─── Main Component ─────────────────────────────────────────────────────────

export function ScenarioResults() {
  const { scenarioResults, scenarioSteps } = useLabState();

  // Empty state — no scenario selected
  if (scenarioResults.length === 0 && scenarioSteps.length === 0) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-center font-sans text-[0.81rem] text-text-muted">
          Select a scenario to see the expected sequence
        </p>
      </div>
    );
  }

  // Pre-run state — steps loaded but not yet fired
  if (scenarioResults.length === 0 && scenarioSteps.length > 0) {
    return (
      <div className="space-y-0">
        <div className="border-b border-border px-1 pb-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="font-mono text-[0.69rem] font-medium uppercase tracking-[0.12em] text-text-muted">
              Sequence
            </span>
            <span className="font-mono text-[0.75rem] text-text-muted">
              {scenarioSteps.length} steps
            </span>
          </div>
          <div className="flex gap-1">
            {scenarioSteps.map((_, i) => (
              <div key={i} className="h-1.5 flex-1 rounded-full bg-surface-input" />
            ))}
          </div>
        </div>

        {scenarioSteps.map((step, i) => {
          const eventType = (step.event as { type?: string }).type ?? 'unknown';
          return (
            <div
              key={i}
              className="flex items-start gap-3 border-b border-border px-1 py-2.5 last:border-b-0"
            >
              <span className="w-5 shrink-0 text-right font-mono text-[0.69rem] text-text-muted">
                {i + 1}.
              </span>
              <div className="min-w-0 flex-1">
                <span className="font-mono text-[0.75rem] text-text-secondary">
                  {eventType}
                </span>
                <p className="mt-0.5 font-sans text-[0.69rem] leading-[1.3] text-text-muted">
                  {step.description}
                </p>
              </div>
              <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-surface-input" />
            </div>
          );
        })}

        <div className="px-1 pt-3">
          <p className="font-sans text-[0.69rem] leading-[1.4] text-text-muted">
            A healthy handler returns 200 for all steps. Non-2xx responses are flagged but the sequence continues.
          </p>
        </div>
      </div>
    );
  }

  // Running / completed state
  const completed = scenarioResults.filter(
    (r) => r.status === 'done' || r.status === 'error',
  ).length;
  const total = scenarioResults.length;
  const allComplete = completed === total;

  const failureCount = scenarioResults.filter(
    (r) =>
      r.status === 'error' ||
      (r.status === 'done' &&
        r.response &&
        (r.response.statusCode < 200 || r.response.statusCode >= 300)),
  ).length;
  const allSuccess = allComplete && failureCount === 0;

  // Compute timing stats for post-run summary
  const responseTimes = scenarioResults
    .map((r) => r.response?.responseTimeMs)
    .filter((t): t is number => t !== undefined);
  const avg =
    responseTimes.length > 0
      ? Math.round(responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length)
      : 0;
  const slowestResult = scenarioResults.reduce<typeof scenarioResults[0] | null>(
    (best, r) => {
      if (!r.response) return best;
      if (!best?.response) return r;
      return r.response.responseTimeMs > best.response.responseTimeMs ? r : best;
    },
    null,
  );

  return (
    <div className="space-y-3">
      {/* Health summary — shown when all steps complete */}
      <HealthSummary results={scenarioResults} />

      {/* Segmented progress bar */}
      <SegmentedProgress results={scenarioResults} />

      {/* Per-step cards */}
      <div className="space-y-1.5">
        {scenarioResults.map((result) => (
          <div
            key={result.stepIndex}
            className="animate-slide-up"
            style={{ animationDelay: `${result.stepIndex * 50}ms`, animationFillMode: 'backwards' }}
          >
            <StepResultCard
              stepIndex={result.stepIndex}
              eventType={result.eventType}
              status={result.status}
              response={result.response}
            />
          </div>
        ))}
      </div>

      {/* Post-run inline summary */}
      {allComplete && (
        <div className="border-t border-border px-1 pt-3">
          <p
            className={cn(
              'font-mono text-[0.75rem]',
              allSuccess ? 'text-state-success' : 'text-state-error',
            )}
          >
            {allSuccess
              ? `All ${total} steps returned 2xx`
              : `${failureCount} of ${total} steps returned non-2xx`}
          </p>
          {responseTimes.length > 0 && (
            <p className="mt-1 font-mono text-[0.69rem] text-text-muted">
              Avg: {avg}ms
              {slowestResult?.response &&
                ` · Slowest: ${slowestResult.eventType} (${slowestResult.response.responseTimeMs}ms)`}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
