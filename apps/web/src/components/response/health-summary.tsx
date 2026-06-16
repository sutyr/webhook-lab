// Copyright 2026 Sutyr Inc. SPDX-License-Identifier: Apache-2.0
'use client';

import type { ScenarioStepResult } from '@/lib/lab-context';
import { cn } from '@/lib/cn';

interface HealthSummaryProps {
  results: ScenarioStepResult[];
}

export function HealthSummary({ results }: HealthSummaryProps) {
  const completed = results.filter((r) => r.status === 'done' || r.status === 'error');
  if (completed.length < results.length) return null;

  const successes = completed.filter(
    (r) => r.response && r.response.statusCode >= 200 && r.response.statusCode < 300,
  );
  const failures = completed.filter(
    (r) =>
      r.status === 'error' ||
      (r.response && (r.response.statusCode < 200 || r.response.statusCode >= 300)),
  );

  const responseTimes = completed
    .map((r) => r.response?.responseTimeMs)
    .filter((t): t is number => t !== undefined);

  const avg = responseTimes.length > 0
    ? Math.round(responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length)
    : 0;

  const slowest = responseTimes.length > 0
    ? completed.reduce<ScenarioStepResult | null>((best, r) => {
        if (!r.response) return best;
        if (!best?.response) return r;
        return r.response.responseTimeMs > best.response.responseTimeMs ? r : best;
      }, null)
    : null;

  const fastest = responseTimes.length > 0
    ? completed.reduce<ScenarioStepResult | null>((best, r) => {
        if (!r.response) return best;
        if (!best?.response) return r;
        return r.response.responseTimeMs < best.response.responseTimeMs ? r : best;
      }, null)
    : null;

  return (
    <div className="animate-slide-down rounded-card border border-border bg-surface-card p-3 space-y-2">
      <p className="font-sans text-[0.69rem] font-medium uppercase tracking-[0.12em] text-text-secondary">
        Endpoint Health
      </p>

      <div className="space-y-1">
        <p className="font-mono text-[0.75rem] text-text-secondary">
          {results.length} events fired
        </p>

        <div className="flex items-center gap-2">
          <span className="font-mono text-[0.75rem] text-text-secondary">
            {successes.length} returned 2xx
          </span>
          <div className="flex gap-0.5">
            {completed.map((r, i) => (
              <span
                key={i}
                className={cn(
                  'inline-block h-2 w-2 rounded-full',
                  r.response && r.response.statusCode >= 200 && r.response.statusCode < 300
                    ? 'bg-state-success'
                    : 'bg-state-error',
                )}
              />
            ))}
          </div>
        </div>

        {failures.length > 0 && (
          <p className="font-mono text-[0.75rem] text-state-error">
            {failures.length} failed:{' '}
            {failures.map((f) => f.eventType).join(', ')}
          </p>
        )}
      </div>

      {responseTimes.length > 0 && (
        <div className="space-y-0.5 border-t border-border pt-2">
          <p className="font-mono text-[0.75rem] text-text-secondary">
            Avg response: {avg}ms
          </p>
          {slowest?.response && (
            <p className="font-mono text-[0.75rem] text-text-muted">
              Slowest: {slowest.response.responseTimeMs}ms ({slowest.eventType})
            </p>
          )}
          {fastest?.response && (
            <p className="font-mono text-[0.75rem] text-text-muted">
              Fastest: {fastest.response.responseTimeMs}ms ({fastest.eventType})
            </p>
          )}
        </div>
      )}
    </div>
  );
}
