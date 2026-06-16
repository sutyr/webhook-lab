// Copyright 2026 Sutyr Inc. SPDX-License-Identifier: Apache-2.0
'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Eye, EyeOff, Loader2, Lightbulb } from 'lucide-react';
import { useLabState, useLabDispatch } from '@/lib/lab-context';
import { fireEvent, firePrepared } from '@/lib/fire-event';
import { cn } from '@/lib/cn';

export function FireControls() {
  const {
    targetUrl, signingSecret, selectedEventType, eventOptions,
    isLoading, response, isEditingPayload, editedPayload,
  } = useLabState();
  const dispatch = useLabDispatch();
  const [showSecret, setShowSecret] = useState(false);
  const [ripple, setRipple] = useState<{ x: number; y: number; key: number } | null>(null);
  const [flashState, setFlashState] = useState<'none' | 'success' | 'error'>('none');

  // Flash on response
  useEffect(() => {
    if (response) {
      setFlashState(
        response.statusCode >= 200 && response.statusCode < 300 ? 'success' : 'error',
      );
      const timer = setTimeout(() => setFlashState('none'), 600);
      return () => clearTimeout(timer);
    }
  }, [response]);

  // Check if edited JSON is valid
  const editJsonValid = (() => {
    if (!isEditingPayload || !editedPayload) return true;
    try { JSON.parse(editedPayload); return true; } catch { return false; }
  })();

  function doFire() {
    if (!targetUrl || isLoading) return;
    if (isEditingPayload && !editJsonValid) return;

    dispatch({ type: 'FIRE_START' });

    if (isEditingPayload && editedPayload) {
      let parsed: object;
      try {
        parsed = JSON.parse(editedPayload);
      } catch {
        dispatch({ type: 'FIRE_ERROR', error: 'Invalid JSON in edited payload' });
        return;
      }
      firePrepared({ payload: parsed, targetUrl, signingSecret })
        .then((resp) => {
          dispatch({ type: 'FIRE_SUCCESS', response: resp, payload: parsed });
        })
        .catch((err: unknown) => {
          dispatch({
            type: 'FIRE_ERROR',
            error: err instanceof Error ? err.message : 'Unknown error',
          });
        });
    } else {
      fireEvent({ eventType: selectedEventType, eventOptions, targetUrl, signingSecret })
        .then((result) => {
          const { payload, ...resp } = result;
          dispatch({ type: 'FIRE_SUCCESS', response: resp, payload });
        })
        .catch((err: unknown) => {
          dispatch({
            type: 'FIRE_ERROR',
            error: err instanceof Error ? err.message : 'Unknown error',
          });
        });
    }
  }

  // Cmd/Ctrl+Enter to fire — use ref to avoid re-registering on every render
  const doFireRef = useRef(doFire);
  doFireRef.current = doFire;

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault();
        doFireRef.current();
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  function handleFireClick(e: React.MouseEvent<HTMLButtonElement>) {
    if (!targetUrl || isLoading) return;

    const rect = e.currentTarget.getBoundingClientRect();
    setRipple({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
      key: Date.now(),
    });

    doFire();
  }

  const inputClasses =
    'bg-surface-input border border-border rounded-input px-3 py-2 font-mono text-[0.81rem] text-text-primary w-full input-copper-focus';

  const fireDisabled = isLoading || !targetUrl || (isEditingPayload && !editJsonValid);

  return (
    <div className="space-y-3">
      <div>
        <label htmlFor="fire-target-url" className="mb-1 block font-sans text-[0.75rem] text-text-secondary">
          Target URL
        </label>
        <input
          id="fire-target-url"
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
        {/* Contextual URL helper (#9) */}
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
        <label htmlFor="fire-signing-secret" className="mb-1 block font-sans text-[0.75rem] text-text-secondary">
          Signing Secret
        </label>
        <div className="relative">
          <input
            id="fire-signing-secret"
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

      {/* Fire button with ripple + flash */}
      <button
        type="button"
        onClick={handleFireClick}
        disabled={fireDisabled}
        aria-busy={isLoading}
        className={cn(
          'relative w-full min-h-[44px] overflow-hidden rounded-cta py-2.5 font-sans text-[0.81rem] font-medium text-white transition-all duration-150',
          isLoading
            ? 'cursor-wait bg-copper/80'
            : 'bg-copper hover:bg-copper/90 active:scale-[0.99]',
          fireDisabled && !isLoading && 'cursor-not-allowed opacity-50',
          flashState === 'success' && 'shadow-[0_0_0_3px_rgba(91,184,112,0.4)]',
          flashState === 'error' && 'shadow-[0_0_0_3px_rgba(224,85,64,0.4)]',
        )}
      >
        {isLoading ? (
          <span key="loading" className="flex animate-fade-in items-center justify-center gap-2">
            <Loader2 size={16} className="animate-spin" />
            <span>Firing...</span>
          </span>
        ) : (
          <span key="ready" className="flex animate-fade-in items-center justify-center gap-2">
            Fire Event
            <kbd className="rounded-badge border border-white/10 bg-white/15 px-1.5 py-0.5 font-mono text-[0.6rem] text-white/70">⌘↵</kbd>
          </span>
        )}

        {ripple && (
          <span
            key={ripple.key}
            className="pointer-events-none absolute rounded-full bg-white/20 animate-ripple"
            style={{ left: ripple.x, top: ripple.y }}
            onAnimationEnd={() => setRipple(null)}
          />
        )}
      </button>
    </div>
  );
}
