// Copyright 2026 Sutyr Inc. SPDX-License-Identifier: Apache-2.0
'use client';

import { useState, type ReactNode } from 'react';
import { Eye, EyeOff, Info, Lightbulb } from 'lucide-react';
import { useLabState, useLabDispatch } from '@/lib/lab-context';
import { localTarget } from '@/lib/local-target';
import { CommandBlock } from '@/components/ui/command-block';
import { cn } from '@/lib/cn';

export const INPUT_CLASSES =
  'bg-surface-input border border-border rounded-input px-3 py-2 font-mono text-[0.81rem] text-text-primary w-full input-copper-focus';

interface TargetFieldsProps {
  /** Prefix for the input ids, unique per mode. */
  idPrefix: 'fire' | 'suite' | 'scenario';
  /** The CLI command for this mode, aimed at `url`. */
  cliCommand: (url: string) => string;
  /** Shown under an empty URL field. Defaults to the webhook.site tip. */
  emptyHint?: ReactNode;
  /** Shown under the signing secret, for modes that depend on it. */
  secretHint?: ReactNode;
}

function WebhookSiteTip() {
  return (
    <>
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
    </>
  );
}

/**
 * Target URL and signing secret. Every mode edits the same two values, so a
 * URL typed for the suite is still there when firing a single event.
 */
export function TargetFields({ idPrefix, cliCommand, emptyHint, secretHint }: TargetFieldsProps) {
  const { targetUrl, signingSecret } = useLabState();
  const dispatch = useLabDispatch();
  const [showSecret, setShowSecret] = useState(false);
  const local = localTarget(targetUrl);
  const urlId = `${idPrefix}-target-url`;
  const secretId = `${idPrefix}-signing-secret`;
  const noteId = `${idPrefix}-local-note`;

  return (
    <div className="space-y-3">
      <div>
        <label htmlFor={urlId} className="mb-1 block font-sans text-[0.75rem] text-text-secondary">
          Target URL
        </label>
        <input
          id={urlId}
          type="url"
          value={targetUrl}
          onChange={(e) => dispatch({ type: 'SET_TARGET_URL', url: e.target.value })}
          placeholder="https://your-server.com/webhook"
          autoComplete="off"
          spellCheck={false}
          data-1p-ignore
          data-lpignore="true"
          aria-describedby={local ? noteId : undefined}
          className={INPUT_CLASSES}
        />
        {!targetUrl && (
          <div className="mt-1 flex items-start gap-1.5">
            <Lightbulb size={12} strokeWidth={1.75} className="mt-[1px] flex-shrink-0 text-text-muted" />
            <p className="font-sans text-[0.69rem] leading-[1.3] text-text-muted">
              {emptyHint ?? <WebhookSiteTip />}
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
        {local && (
          <div
            id={noteId}
            className="mt-2 animate-fade-in rounded-input border border-border bg-surface-card p-2.5"
          >
            <div className="flex items-start gap-1.5">
              <Info size={13} strokeWidth={1.75} className="mt-[1px] flex-shrink-0 text-state-info" />
              <p className="font-sans text-[0.72rem] leading-[1.4] text-text-secondary">
                The hosted Lab only sends to public URLs, so it cannot reach{' '}
                <span className="font-mono text-[0.69rem] text-text-primary">{local.hostname}</span>.
                Run this on your machine instead:
              </p>
            </div>
            <CommandBlock command={cliCommand(local.url)} className="mt-2" />
          </div>
        )}
      </div>

      <div>
        <label htmlFor={secretId} className="mb-1 block font-sans text-[0.75rem] text-text-secondary">
          Signing secret
        </label>
        <div className="relative">
          <input
            id={secretId}
            type={showSecret ? 'text' : 'password'}
            value={signingSecret}
            onChange={(e) => dispatch({ type: 'SET_SIGNING_SECRET', secret: e.target.value })}
            autoComplete="off"
            spellCheck={false}
            data-1p-ignore
            data-lpignore="true"
            className={cn(INPUT_CLASSES, 'pr-10')}
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
          <p className="mt-1 rounded-badge bg-warning-10 px-2 py-1 font-sans text-[0.69rem] text-state-warning">
            Stripe signing secrets typically start with whsec_
          </p>
        )}
        {secretHint && (
          <p className="mt-1 font-sans text-[0.69rem] leading-[1.3] text-text-muted">{secretHint}</p>
        )}
      </div>
    </div>
  );
}
