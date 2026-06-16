// Copyright 2026 Sutyr Inc. SPDX-License-Identifier: Apache-2.0
'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { Eye, EyeOff, Loader2, Lightbulb, ChevronDown } from 'lucide-react';
import { useLabState, useLabDispatch } from '@/lib/lab-context';
import { loadScenarioSteps, firePrepared } from '@/lib/fire-event';
import { cn } from '@/lib/cn';
import { SCENARIO_CATALOG } from '@webhook-lab/events';

// ─── Delay Presets (#5) ──────────────────────────────────────────────────────

type DelayPreset = 'instant' | 'fast' | 'realistic' | 'slow';

const DELAY_PRESETS: Record<DelayPreset, number> = {
  instant: 0,
  fast: 500,
  realistic: 1000,
  slow: 3000,
};

const DELAY_OPTIONS: { value: DelayPreset; label: string }[] = [
  { value: 'instant', label: 'Instant (no delay)' },
  { value: 'fast', label: 'Fast (500ms between events)' },
  { value: 'realistic', label: 'Realistic (1s between events)' },
  { value: 'slow', label: 'Slow (3s between events)' },
];

// ─── Step Status Dot ─────────────────────────────────────────────────────────

function StepDot({ status, statusCode }: { status: string; statusCode?: number }) {
  switch (status) {
    case 'pending':
      return <span className="h-2 w-2 flex-shrink-0 rounded-full bg-border-strong" />;
    case 'firing':
      return <span className="h-2 w-2 flex-shrink-0 animate-pulse rounded-full bg-state-info" />;
    case 'done': {
      const isSuccess = statusCode !== undefined && statusCode >= 200 && statusCode < 300;
      return (
        <span
          className={cn(
            'h-2 w-2 flex-shrink-0 rounded-full',
            isSuccess ? 'bg-state-success' : 'bg-state-error',
          )}
        />
      );
    }
    case 'error':
      return <span className="h-2 w-2 flex-shrink-0 rounded-full bg-state-error" />;
    default:
      return null;
  }
}

// ─── Component ───────────────────────────────────────────────────────────────

export function ScenarioRunner() {
  const {
    selectedScenarioId,
    targetUrl,
    signingSecret,
    scenarioSteps,
    scenarioResults,
  } = useLabState();
  const dispatch = useLabDispatch();

  const [showSecret, setShowSecret] = useState(false);
  const [delayPreset, setDelayPreset] = useState<DelayPreset>('realistic');
  const cancelledRef = useRef(false);
  const [isRunning, setIsRunning] = useState(false);
  const [expandedStep, setExpandedStep] = useState<number | null>(null);

  const scenario = SCENARIO_CATALOG.find((s) => s.id === selectedScenarioId);

  // ─── Load steps on scenario selection (#1) ─────────────────────────────────

  useEffect(() => {
    if (!selectedScenarioId) return;
    loadScenarioSteps(selectedScenarioId)
      .then((steps) => {
        dispatch({
          type: 'SET_SCENARIO_STEPS',
          steps,
          eventTypes: steps.map((s) => {
            const evt = s.event as { type?: string };
            return evt.type ?? 'unknown';
          }),
        });
      })
      .catch(() => {});
  }, [selectedScenarioId, dispatch]);

  // ─── Run handler (uses already-loaded steps) ──────────────────────────────

  const handleRun = useCallback(async () => {
    if (!targetUrl || isRunning || scenarioSteps.length === 0) return;

    cancelledRef.current = false;
    setIsRunning(true);
    setExpandedStep(null);

    // Reset all steps to pending
    dispatch({
      type: 'SET_SCENARIO_STEPS',
      steps: scenarioSteps,
      eventTypes: scenarioResults.map((r) => r.eventType),
    });

    const delay = DELAY_PRESETS[delayPreset];

    for (let i = 0; i < scenarioSteps.length; i++) {
      if (cancelledRef.current) break;

      if (i > 0 && delay > 0) {
        await new Promise<void>((resolve) => {
          const timer = setTimeout(resolve, delay);
          const check = setInterval(() => {
            if (cancelledRef.current) {
              clearTimeout(timer);
              clearInterval(check);
              resolve();
            }
          }, 100);
          setTimeout(() => clearInterval(check), delay + 10);
        });
      }

      if (cancelledRef.current) break;

      dispatch({ type: 'SCENARIO_STEP_START', stepIndex: i });

      try {
        const response = await firePrepared({
          payload: scenarioSteps[i].event,
          targetUrl,
          signingSecret,
        });
        dispatch({ type: 'SCENARIO_STEP_DONE', stepIndex: i, response });
      } catch {
        dispatch({ type: 'SCENARIO_STEP_ERROR', stepIndex: i });
      }
    }

    setIsRunning(false);
  }, [targetUrl, signingSecret, delayPreset, isRunning, scenarioSteps, scenarioResults, dispatch]);

  const handleCancel = useCallback(() => {
    cancelledRef.current = true;
  }, []);

  const inputClasses =
    'bg-surface-input border border-border rounded-input px-3 py-2 font-mono text-[0.81rem] text-text-primary w-full input-copper-focus';

  const hasSteps = scenarioSteps.length > 0;
  const stepCount = hasSteps ? scenarioSteps.length : scenario?.stepCount ?? 0;

  return (
    <div className="space-y-5">
      {/* Scenario header */}
      {scenario && (
        <div>
          <h2 className="font-sans text-[0.81rem] font-medium text-text-primary">
            {scenario.name}
          </h2>
          <p className="mt-0.5 font-sans text-[0.81rem] font-light text-text-tertiary">
            {scenario.description}
          </p>
        </div>
      )}

      {/* Step list (#1 visual states, #3 quiet label) */}
      <div className="space-y-2">
        <p className="font-mono text-[0.69rem] font-medium uppercase tracking-[0.12em] text-text-muted">
          Sequence · {stepCount} events
        </p>
        {/* Step progress bar — visible during/after run */}
        {hasSteps && scenarioResults.some((r) => r.status !== 'pending') && (
          <div className="h-0.5 overflow-hidden rounded-full bg-surface-input">
            <div
              className="h-full rounded-full bg-copper transition-[width] duration-300 ease-out"
              style={{
                width: `${(scenarioResults.filter((r) => r.status === 'done' || r.status === 'error').length / scenarioResults.length) * 100}%`,
              }}
            />
          </div>
        )}
        <div className="space-y-1.5">
          {hasSteps
            ? scenarioResults.map((result, i) => {
                const step = scenarioSteps[i];
                const isDone = result.status === 'done' || result.status === 'error';
                const isExpanded = expandedStep === i;

                return (
                  <div
                    key={i}
                    className={cn(
                      'rounded-card bg-surface-input transition-all duration-200',
                      result.status === 'firing' && 'ring-1 ring-copper/20',
                    )}
                    style={{ transitionDelay: `${i * 50}ms` }}
                  >
                    <button
                      type="button"
                      onClick={() => isDone && setExpandedStep(isExpanded ? null : i)}
                      className={cn(
                        'flex w-full items-center gap-3 px-4 py-3.5 md:py-3',
                        isDone && 'cursor-pointer',
                      )}
                    >
                      <span
                        className={cn(
                          'flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-badge font-mono text-[0.75rem]',
                          result.status === 'firing'
                            ? 'bg-copper/10 text-text-primary'
                            : 'bg-surface-page text-text-secondary',
                        )}
                      >
                        {i + 1}
                      </span>
                      <div className="min-w-0 flex-1 text-left">
                        <p className="truncate font-mono text-[0.75rem] text-text-secondary">
                          {result.eventType}
                        </p>
                        {isDone && result.response ? (
                          <p
                            className={cn(
                              'mt-0.5 font-mono text-[0.69rem]',
                              result.response.statusCode >= 200 && result.response.statusCode < 300
                                ? 'text-state-success'
                                : 'text-state-error',
                            )}
                          >
                            {result.response.statusCode} · {result.response.responseTimeMs}ms
                          </p>
                        ) : (
                          step && (
                            <p className="mt-0.5 truncate font-sans text-[0.69rem] text-text-muted">
                              {step.description}
                            </p>
                          )
                        )}
                      </div>
                      <StepDot status={result.status} statusCode={result.response?.statusCode} />
                    </button>

                    {/* Expanded response body (#11) */}
                    {isExpanded && result.response && (
                      <div className="border-t border-border px-4 pb-3 pt-2">
                        <p className="mb-1.5 font-mono text-[0.69rem] text-text-muted">
                          Response body
                        </p>
                        <pre className="max-h-32 overflow-auto rounded-input bg-surface-page p-3 font-mono text-[0.69rem] leading-[1.4] text-text-tertiary">
                          {(() => {
                            try {
                              return JSON.stringify(JSON.parse(result.response!.responseBody), null, 2);
                            } catch {
                              return result.response!.responseBody;
                            }
                          })()}
                        </pre>
                      </div>
                    )}
                  </div>
                );
              })
            : scenario &&
              Array.from({ length: scenario.stepCount }, (_, i) => (
                <div
                  key={i}
                  className="flex items-center gap-3 rounded-card bg-surface-input px-4 py-3"
                >
                  <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-badge bg-surface-page font-mono text-[0.75rem] text-text-secondary">
                    {i + 1}
                  </span>
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <div className="shimmer-line h-3 w-3/4 rounded" />
                    <div className="shimmer-line h-2.5 w-1/2 rounded" />
                  </div>
                  <span className="h-2 w-2 flex-shrink-0 rounded-full bg-border-strong" />
                </div>
              ))}
        </div>
      </div>

      {/* Delay presets (#5) */}
      <div>
        <label className="mb-1 block font-sans text-[0.75rem] text-text-secondary">
          Event spacing
        </label>
        <div className="relative">
          <select
            value={delayPreset}
            onChange={(e) => setDelayPreset(e.target.value as DelayPreset)}
            className={cn(inputClasses, 'appearance-none pr-8 font-sans')}
          >
            {DELAY_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
        </div>
      </div>

      {/* Controls */}
      <div className="space-y-3">
        <div>
          <label htmlFor="scenario-target-url" className="mb-1 block font-sans text-[0.75rem] text-text-secondary">
            Target URL
          </label>
          <input
            id="scenario-target-url"
            type="url"
            value={targetUrl}
            onChange={(e) =>
              dispatch({ type: 'SET_TARGET_URL', url: e.target.value })
            }
            placeholder="https://your-server.com/webhook"
            autoComplete="off"
            data-1p-ignore
            data-lpignore="true"
            className={inputClasses}
          />
          {/* Contextual URL helper */}
          {!targetUrl && (
            <div className="mt-1 flex items-center gap-1.5">
              <Lightbulb size={12} strokeWidth={1.75} className="flex-shrink-0 text-text-muted" />
              <p className="font-sans text-[0.69rem] leading-[1.3] text-text-muted">
                No endpoint?{' '}
                <a
                  href="https://webhook.site"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-text-tertiary underline hover:text-text-secondary"
                >
                  webhook.site
                </a>
                {' '}gives you a free temporary URL.
              </p>
            </div>
          )}
          {targetUrl.includes('webhook.site') && (
            <div className="mt-1 flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 flex-shrink-0 rounded-full bg-state-success" />
              <p className="font-sans text-[0.69rem] leading-[1.3] text-state-success">
                webhook.site endpoint detected
              </p>
            </div>
          )}
        </div>

        <div>
          <label htmlFor="scenario-signing-secret" className="mb-1 block font-sans text-[0.75rem] text-text-secondary">
            Signing Secret
          </label>
          <div className="relative">
            <input
              id="scenario-signing-secret"
              type={showSecret ? 'text' : 'password'}
              value={signingSecret}
              onChange={(e) =>
                dispatch({ type: 'SET_SIGNING_SECRET', secret: e.target.value })
              }
              autoComplete="off"
              data-1p-ignore
              data-lpignore="true"
              className={cn(inputClasses, 'pr-10')}
            />
            <button
              type="button"
              onClick={() => setShowSecret(!showSecret)}
              aria-label={showSecret ? 'Hide signing secret' : 'Show signing secret'}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-badge p-2 text-text-muted transition-colors hover:bg-surface-hover hover:text-text-secondary md:p-1"
            >
              {showSecret ? (
                <EyeOff key="off" className="h-4 w-4 animate-fade-in" />
              ) : (
                <Eye key="on" className="h-4 w-4 animate-fade-in" />
              )}
            </button>
          </div>
          {signingSecret && !signingSecret.startsWith('whsec_') && (
            <p className="mt-1 rounded-badge bg-state-warning/10 px-2 py-1 font-sans text-[0.69rem] text-state-warning">
              Stripe signing secrets typically start with whsec_
            </p>
          )}
        </div>

        {/* Run button (#9 loading spinner) */}
        <button
          type="button"
          onClick={handleRun}
          disabled={isRunning || !targetUrl || !hasSteps}
          className={cn(
            'w-full min-h-[44px] rounded-cta py-2.5 font-sans text-[0.81rem] font-medium text-white transition-all duration-150',
            isRunning
              ? 'cursor-wait bg-copper/80'
              : 'bg-copper hover:bg-copper/90 active:scale-[0.99]',
            (!targetUrl || !hasSteps) && !isRunning && 'cursor-not-allowed opacity-50',
          )}
        >
          {isRunning ? (
            <span className="flex items-center justify-center gap-2">
              <Loader2 size={16} className="animate-spin" />
              <span>Running...</span>
            </span>
          ) : (
            'Run Scenario'
          )}
        </button>

        {isRunning && (
          <button
            type="button"
            onClick={handleCancel}
            className="w-full animate-slide-up font-sans text-[0.81rem] text-state-error transition-colors hover:underline"
          >
            Cancel
          </button>
        )}
      </div>
    </div>
  );
}
