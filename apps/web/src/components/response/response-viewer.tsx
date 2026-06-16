// Copyright 2026 Sutyr Inc. SPDX-License-Identifier: Apache-2.0
'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { RotateCcw, ChevronDown, ChevronRight, Download, ArrowUpLeft } from 'lucide-react';
import { useLabState, useLabDispatch } from '@/lib/lab-context';
import type { ResponseHistoryEntry } from '@/lib/lab-context';
import { firePrepared } from '@/lib/fire-event';
import { exportAsCurl, exportAsTypeScript, exportAsPython } from '@/lib/export-formats';
import { highlightJson } from '@/lib/syntax-highlight';
import { CopyButton } from '@/components/ui/copy-button';
import { cn } from '@/lib/cn';

// #4: Animated count-up for status code
function AnimatedStatusCode({ code }: { code: number }) {
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    if (code === 0) { setDisplay(0); return; }

    const duration = 300;
    const start = performance.now();
    let frameId: number;

    function tick(now: number) {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(eased * code));

      if (progress < 1) {
        frameId = requestAnimationFrame(tick);
      }
    }

    frameId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameId);
  }, [code]);

  return (
    <span className={cn(
      'font-mono text-[1.25rem] font-medium tabular-nums',
      code >= 200 && code < 300 && 'text-state-success',
      code >= 300 && code < 400 && 'text-state-warning',
      code >= 400 && 'text-state-error',
      code === 0 && 'text-state-error',
    )}>
      {code === 0 ? '---' : display}
    </span>
  );
}

const STATUS_TEXT: Record<number, string> = {
  0: 'Network Error',
  200: 'OK',
  201: 'Created',
  202: 'Accepted',
  204: 'No Content',
  301: 'Moved Permanently',
  302: 'Found',
  304: 'Not Modified',
  400: 'Bad Request',
  401: 'Unauthorized',
  403: 'Forbidden',
  404: 'Not Found',
  405: 'Method Not Allowed',
  408: 'Request Timeout',
  409: 'Conflict',
  422: 'Unprocessable Entity',
  429: 'Too Many Requests',
  500: 'Internal Server Error',
  502: 'Bad Gateway',
  503: 'Service Unavailable',
  504: 'Gateway Timeout',
};

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

export function ResponseViewer() {
  const { response, isLoading, error, payload, targetUrl, signingSecret, responseHistory } =
    useLabState();
  const dispatch = useLabDispatch();
  const [replaying, setReplaying] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const exportRef = useRef<HTMLDivElement>(null);

  // Close export dropdown on outside click
  useEffect(() => {
    if (!exportOpen) return;
    function handleClick(e: MouseEvent) {
      if (exportRef.current && !exportRef.current.contains(e.target as Node)) {
        setExportOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [exportOpen]);

  const handleReplay = useCallback(async () => {
    if (!payload || !targetUrl || replaying) return;
    setReplaying(true);
    dispatch({ type: 'FIRE_START' });
    try {
      const resp = await firePrepared({ payload, targetUrl, signingSecret });
      dispatch({ type: 'FIRE_SUCCESS', response: resp, payload });
    } catch (err: unknown) {
      dispatch({
        type: 'FIRE_ERROR',
        error: err instanceof Error ? err.message : 'Replay failed',
      });
    } finally {
      setReplaying(false);
    }
  }, [payload, targetUrl, signingSecret, replaying, dispatch]);

  // Educational empty state (#4)
  if (!response && !isLoading && !error) {
    return (
      <div className="px-1 py-6">
        <p className="mb-4 font-sans text-[0.81rem] text-text-secondary">
          What to expect
        </p>
        <div className="space-y-0">
          <div className="flex items-baseline gap-3 border-l-2 border-state-success py-1.5 pl-3">
            <span className="w-8 font-mono text-[0.81rem] font-medium text-state-success">200</span>
            <span className="font-sans text-[0.75rem] text-text-secondary">Event processed successfully</span>
          </div>
          <div className="flex items-baseline gap-3 border-l-2 border-state-error py-1.5 pl-3">
            <span className="w-8 font-mono text-[0.81rem] font-medium text-state-error">400</span>
            <span className="font-sans text-[0.75rem] text-text-secondary">Signature verification failed</span>
          </div>
          <div className="flex items-baseline gap-3 border-l-2 border-state-error py-1.5 pl-3">
            <span className="w-8 font-mono text-[0.81rem] font-medium text-state-error">500</span>
            <span className="font-sans text-[0.75rem] text-text-secondary">Handler error — check your logs</span>
          </div>
        </div>
        <div className="mt-4 border-t border-border pt-4 space-y-2">
          <p className="font-sans text-[0.69rem] leading-[1.4] text-text-muted">
            Stripe retries on non-2xx responses. Handlers should respond within 5 seconds to avoid timeouts.
          </p>
          <p className="font-sans text-[0.69rem] leading-[1.4] text-text-tertiary">
            Select an event and enter your webhook URL to get started.
          </p>
        </div>
      </div>
    );
  }

  // Loading state — skeleton matching response shape
  if (isLoading) {
    return (
      <div className="space-y-4 py-2">
        <div>
          <div className="shimmer-line h-5 w-12 rounded" />
          <div className="shimmer-line mt-2 h-3 w-24 rounded" />
          <div className="shimmer-line mt-1 h-3 w-16 rounded" />
        </div>
        <div>
          <div className="shimmer-line h-3 w-20 rounded" />
          <div className="mt-2 rounded-card bg-surface-input p-3">
            <div className="shimmer-line h-3 w-full rounded" />
            <div className="shimmer-line mt-1.5 h-3 w-3/4 rounded" />
            <div className="shimmer-line mt-1.5 h-3 w-5/6 rounded" />
          </div>
        </div>
      </div>
    );
  }

  // Error state (client-side error, not HTTP error)
  if (error && !response) {
    return (
      <div className="rounded-card bg-state-error/10 p-3">
        <p className="font-sans text-[0.81rem] text-state-error">{error}</p>
      </div>
    );
  }

  if (!response) return null;

  const statusText =
    STATUS_TEXT[response.statusCode] ??
    (response.statusCode === 0 ? 'Network Error' : `Status ${response.statusCode}`);

  const sigHeader = response.signatureHeader ?? '';
  const formattedBody = formatBody(response.responseBody);
  let isJsonResponse = false;
  try { JSON.parse(response.responseBody); isJsonResponse = true; } catch {}

  return (
    <div key={response.signatureHeader} className="animate-slide-up space-y-4" aria-live="polite" role="region" aria-label="Webhook response">
      {/* Request method + URL badge (H10) */}
      <div className="flex items-center gap-2 border-b border-border pb-3">
        <span className="rounded-badge bg-surface-input px-1.5 py-0.5 font-mono text-[0.69rem] font-medium text-text-secondary">
          POST
        </span>
        <span className="truncate font-mono text-[0.75rem] text-text-tertiary">
          {response.statusCode === 0 ? 'Target unreachable' : 'Target endpoint'}
        </span>
      </div>

      {/* Status code (#4 count-up) */}
      <div>
        <AnimatedStatusCode code={response.statusCode} />
        <p className="mt-1 font-mono text-[0.69rem] text-text-muted">
          {statusText} · {response.responseTimeMs}ms
        </p>
      </div>

      {/* Response body (#8 copy button) */}
      <div>
        <div className="mb-1 flex items-center justify-between">
          <p className="font-sans text-[0.69rem] font-medium uppercase tracking-[0.12em] text-text-secondary">
            Response Body
          </p>
          <CopyButton text={response.responseBody} />
        </div>
        <pre className="max-h-64 overflow-auto rounded-card bg-surface-input p-3 font-mono text-[0.75rem] leading-[1.4] text-text-primary scroll-shadow">
          {isJsonResponse ? highlightJson(formattedBody) : formattedBody}
        </pre>
      </div>

      {/* Signature header (#8 copy button) */}
      {sigHeader && (
        <div>
          <div className="mb-1 flex items-center justify-between">
            <p className="font-sans text-[0.69rem] font-medium uppercase tracking-[0.12em] text-text-secondary">
              Stripe-Signature
            </p>
            <CopyButton text={sigHeader} />
          </div>
          <p className="break-all font-mono text-[0.75rem] text-text-muted">
            {sigHeader}
          </p>
        </div>
      )}

      {/* Truncation notice (H2) */}
      {response.truncated && (
        <p className="rounded-badge bg-state-warning/10 px-2 py-1 font-sans text-[0.69rem] text-state-warning">
          Response truncated at 1MB. Full response was larger.
        </p>
      )}

      {/* Request ID (H5) */}
      {response.requestId && (
        <div>
          <div className="mb-1 flex items-center justify-between">
            <p className="font-sans text-[0.69rem] font-medium uppercase tracking-[0.12em] text-text-secondary">
              Request ID
            </p>
            <CopyButton text={response.requestId} />
          </div>
          <p className="font-mono text-[0.75rem] text-text-muted">
            {response.requestId}
          </p>
        </div>
      )}

      {/* Export dropdown */}
      {response && payload && targetUrl && (
        <div ref={exportRef} className="relative">
          <button
            type="button"
            onClick={() => setExportOpen(!exportOpen)}
            className="flex w-full items-center justify-center gap-1.5 rounded-input border border-border py-2 font-sans text-[0.75rem] text-text-secondary transition-colors hover:bg-surface-input hover:text-text-primary"
          >
            <Download size={14} strokeWidth={1.75} />
            Export
            <ChevronDown size={12} className={cn('transition-transform', exportOpen && 'rotate-180')} />
          </button>

          {exportOpen && (
            <div className="absolute left-0 right-0 top-full z-50 mt-1 animate-fade-in rounded-card border border-border-medium bg-surface-card py-1 shadow-lg">
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(
                    exportAsCurl({
                      targetUrl,
                      payload,
                      signatureHeader: response.signatureHeader,
                      requestId: response.requestId ?? '',
                    }),
                  );
                  setExportOpen(false);
                }}
                className="w-full px-3 py-2.5 text-left font-sans text-[0.75rem] text-text-secondary transition-colors hover:bg-surface-input md:py-1.5"
              >
                Copy as cURL
              </button>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(
                    exportAsTypeScript({ targetUrl, payload }),
                  );
                  setExportOpen(false);
                }}
                className="w-full px-3 py-2.5 text-left font-sans text-[0.75rem] text-text-secondary transition-colors hover:bg-surface-input md:py-1.5"
              >
                Copy as TypeScript
              </button>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(
                    exportAsPython({ targetUrl, payload }),
                  );
                  setExportOpen(false);
                }}
                className="w-full px-3 py-2.5 text-left font-sans text-[0.75rem] text-text-secondary transition-colors hover:bg-surface-input md:py-1.5"
              >
                Copy as Python
              </button>
            </div>
          )}
        </div>
      )}

      {/* Replay button — re-fires same payload (same event ID) */}
      {payload && targetUrl && (
        <button
          type="button"
          onClick={handleReplay}
          disabled={replaying}
          className="flex w-full items-center justify-center gap-2 rounded-input border border-border py-2 font-sans text-[0.75rem] text-text-secondary transition-colors hover:bg-surface-input hover:text-text-primary disabled:cursor-wait disabled:opacity-50"
        >
          <RotateCcw size={14} strokeWidth={1.75} className={replaying ? 'animate-spin' : ''} />
          {replaying ? 'Replaying...' : 'Replay (same event ID)'}
        </button>
      )}

      {/* Response history */}
      {responseHistory.length > 1 && (
        <div className="border-t border-border pt-3">
          <button
            type="button"
            onClick={() => setHistoryOpen(!historyOpen)}
            className="flex w-full items-center gap-2 font-sans text-[0.69rem] text-text-muted transition-colors hover:text-text-secondary"
          >
            {historyOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
            <span>History ({responseHistory.length})</span>
          </button>
          {historyOpen && (
            <div className="mt-2 space-y-1.5 animate-fade-in">
              {responseHistory.slice(1).map((entry, i) => (
                <HistoryRow key={`${entry.timestamp}-${i}`} entry={entry} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function HistoryRow({ entry }: { entry: ResponseHistoryEntry }) {
  const [expanded, setExpanded] = useState(false);
  const { targetUrl, signingSecret } = useLabState();
  const dispatch = useLabDispatch();
  const [refiring, setRefiring] = useState(false);

  const code = entry.response.statusCode;
  const colorClass = code >= 200 && code < 300 ? 'text-state-success' : 'text-state-error';

  async function handleRefire() {
    if (!targetUrl || refiring) return;
    setRefiring(true);
    dispatch({ type: 'FIRE_START' });
    try {
      const resp = await firePrepared({ payload: entry.payload, targetUrl, signingSecret });
      dispatch({ type: 'FIRE_SUCCESS', response: resp, payload: entry.payload });
    } catch (err: unknown) {
      dispatch({ type: 'FIRE_ERROR', error: err instanceof Error ? err.message : 'Re-fire failed' });
    } finally {
      setRefiring(false);
    }
  }

  let formattedBody: string;
  try {
    formattedBody = JSON.stringify(JSON.parse(entry.response.responseBody), null, 2);
  } catch {
    formattedBody = entry.response.responseBody;
  }

  // Relative time
  const secsAgo = Math.floor(Date.now() / 1000) - entry.timestamp;
  const timeAgo = secsAgo < 60 ? `${secsAgo}s ago` : `${Math.floor(secsAgo / 60)}m ago`;

  // Short URL for display
  const shortUrl = (() => {
    try {
      const u = new URL(entry.targetUrl);
      return u.hostname.replace('www.', '');
    } catch {
      return '';
    }
  })();

  return (
    <div className="rounded-input border border-border">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="w-full px-2 py-1.5 text-left"
      >
        <div className="flex items-center gap-2 font-mono text-[0.69rem]">
          <span className={cn('w-7 shrink-0 font-medium', colorClass)}>{code}</span>
          <span className="flex-1 truncate text-text-tertiary">{entry.eventType}</span>
          <span className="shrink-0 text-text-muted">{entry.response.responseTimeMs}ms</span>
          <span className="shrink-0 text-text-muted">{timeAgo}</span>
          <ChevronRight size={10} className={cn('shrink-0 text-text-muted transition-transform', expanded && 'rotate-90')} />
        </div>
        {entry.configSummary && (
          <div className="mt-0.5 flex items-center gap-2 pl-9 font-mono text-[0.62rem] text-text-muted">
            <span className="truncate">{entry.configSummary}</span>
            {shortUrl && (
              <>
                <span className="shrink-0">→</span>
                <span className="truncate">{shortUrl}</span>
              </>
            )}
          </div>
        )}
      </button>

      {expanded && (
        <div className="space-y-2 border-t border-border px-2 py-2 animate-fade-in">
          {/* Target URL */}
          {entry.targetUrl && (
            <p className="truncate font-mono text-[0.62rem] text-text-muted">
              → {entry.targetUrl}
            </p>
          )}

          {/* Response body */}
          <div>
            <div className="mb-1 flex items-center justify-between">
              <span className="font-sans text-[0.62rem] font-medium uppercase tracking-[0.12em] text-text-muted">
                Response
              </span>
              <CopyButton text={entry.response.responseBody} />
            </div>
            <pre className="max-h-32 overflow-auto rounded-badge bg-surface-input p-2 font-mono text-[0.69rem] leading-[1.4] text-text-secondary">
              {formattedBody}
            </pre>
          </div>

          {/* Signature */}
          {entry.response.signatureHeader && (
            <div>
              <div className="mb-1 flex items-center justify-between">
                <span className="font-sans text-[0.62rem] font-medium uppercase tracking-[0.12em] text-text-muted">
                  Signature
                </span>
                <CopyButton text={entry.response.signatureHeader} />
              </div>
              <p className="break-all font-mono text-[0.62rem] text-text-muted">
                {entry.response.signatureHeader}
              </p>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                dispatch({ type: 'RESTORE_FROM_HISTORY', entry });
                setExpanded(false);
              }}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-badge border border-border py-1.5 font-sans text-[0.69rem] text-text-secondary transition-colors hover:bg-surface-input hover:text-text-primary"
            >
              <ArrowUpLeft size={11} />
              Restore
            </button>
            {targetUrl && (
              <button
                type="button"
                onClick={handleRefire}
                disabled={refiring}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-badge border border-border py-1.5 font-sans text-[0.69rem] text-text-muted transition-colors hover:bg-surface-input hover:text-text-secondary disabled:cursor-wait disabled:opacity-50"
              >
                <RotateCcw size={11} className={refiring ? 'animate-spin' : ''} />
                {refiring ? 'Firing...' : 'Re-fire'}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
