// Copyright 2026 Sutyr Inc. SPDX-License-Identifier: Apache-2.0
'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { SutureMark } from '@/components/suture-mark';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Surface to the browser console only. No telemetry, no external logging.
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-dvh flex-col bg-surface-page text-text-primary">
      <header className="flex h-[58px] flex-shrink-0 items-center border-b border-border-medium bg-surface-card px-4 pt-[env(safe-area-inset-top)]">
        <Link href="/" className="flex items-center gap-[10px] text-text-primary">
          <SutureMark />
          <span className="font-mono text-[1rem]">Webhook&#8201;Lab</span>
        </Link>
      </header>

      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center px-4 py-10 md:px-6">
        <p className="font-mono text-[0.69rem] font-medium uppercase tracking-[0.14em] text-state-error">
          500
        </p>
        <h1 className="mt-2 text-balance font-sans text-[1.5rem] font-medium leading-snug">
          Something went wrong
        </h1>
        <p className="mt-4 max-w-md font-sans text-[0.88rem] leading-[1.55] text-text-secondary">
          An unexpected error occurred on our side. Try again, and if it keeps
          happening, the issue is ours, not your request.
        </p>
        {error.digest && (
          <p className="mt-4 font-mono text-[0.75rem] text-text-muted">
            Reference: <span className="text-text-tertiary">{error.digest}</span>
          </p>
        )}
        <div className="mt-6 flex items-center gap-4">
          <button
            type="button"
            onClick={reset}
            className="inline-flex min-h-[44px] items-center rounded-cta bg-copper px-4 py-2.5 font-sans text-[0.81rem] font-medium text-white transition-all duration-150 hover:bg-copper/90"
          >
            Try again
          </button>
          <Link
            href="/"
            className="font-sans text-[0.81rem] text-text-tertiary underline decoration-border-strong underline-offset-2 transition-colors hover:text-text-primary"
          >
            Back to Webhook Lab
          </Link>
        </div>
      </main>
    </div>
  );
}
