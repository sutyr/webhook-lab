// Copyright 2026 Sutyr Inc. SPDX-License-Identifier: Apache-2.0
'use client';

import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/cn';

export type Flash = 'none' | 'success' | 'error';

/**
 * A 600ms green or red glow on the action button when a new outcome arrives.
 * `outcome` is null until there is one; a new object means a new outcome.
 */
export function useOutcomeFlash<T>(outcome: T | null, isSuccess: (value: T) => boolean): Flash {
  const [flash, setFlash] = useState<Flash>('none');
  const judge = useRef(isSuccess);
  judge.current = isSuccess;

  useEffect(() => {
    if (outcome === null) return;
    setFlash(judge.current(outcome) ? 'success' : 'error');
    const timer = setTimeout(() => setFlash('none'), 600);
    return () => clearTimeout(timer);
  }, [outcome]);

  return flash;
}

/**
 * Run `action` on Cmd/Ctrl+Enter anywhere on the page. Only one editor is
 * mounted at a time, so only the visible mode's action answers.
 */
export function useRunShortcut(action: () => void): void {
  const ref = useRef(action);
  ref.current = action;

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault();
        ref.current();
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);
}

interface PrimaryActionButtonProps {
  label: string;
  busyLabel: string;
  busy: boolean;
  disabled: boolean;
  onRun: () => void;
  flash?: Flash;
  /** Show the Cmd/Ctrl+Enter hint. */
  shortcut?: boolean;
}

/**
 * The copper call to action of each mode (Fire event, Run scenario, Run
 * checks). A ripple confirms the click; the response panel carries the
 * loading state as skeletons, so the button only changes its label.
 */
export function PrimaryActionButton({
  label,
  busyLabel,
  busy,
  disabled,
  onRun,
  flash = 'none',
  shortcut = true,
}: PrimaryActionButtonProps) {
  const [ripple, setRipple] = useState<{ x: number; y: number; key: number } | null>(null);
  const isDisabled = busy || disabled;

  function handleClick(e: React.MouseEvent<HTMLButtonElement>) {
    if (isDisabled) return;
    const rect = e.currentTarget.getBoundingClientRect();
    setRipple({ x: e.clientX - rect.left, y: e.clientY - rect.top, key: Date.now() });
    onRun();
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isDisabled}
      aria-busy={busy}
      className={cn(
        'relative w-full min-h-[44px] overflow-hidden rounded-cta py-2.5 font-sans text-[0.81rem] font-medium transition-all duration-150',
        busy
          ? 'cursor-wait bg-copper-80 text-white'
          : disabled
            ? 'cursor-not-allowed border border-border-medium bg-surface-input text-text-muted'
            : 'bg-copper text-white hover:bg-copper-90 active:scale-[0.99]',
        flash === 'success' && 'shadow-[0_0_0_3px_rgba(91,184,112,0.4)]',
        flash === 'error' && 'shadow-[0_0_0_3px_rgba(224,85,64,0.4)]',
      )}
    >
      {busy ? (
        <span key="busy" className="flex animate-fade-in items-center justify-center">
          {busyLabel}
        </span>
      ) : (
        <span key="ready" className="flex animate-fade-in items-center justify-center gap-2">
          {label}
          {shortcut && (
            <kbd
              className={cn(
                // Phones have no Cmd/Ctrl+Enter to advertise.
                'hidden rounded-badge border px-1.5 py-0.5 font-mono text-[0.6rem] md:inline',
                disabled
                  ? 'border-border-medium text-text-muted'
                  : 'border-white/10 bg-white/15 text-white/70',
              )}
            >
              ⌘↵
            </kbd>
          )}
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
  );
}
