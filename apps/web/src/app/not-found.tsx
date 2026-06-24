// Copyright 2026 Sutyr Inc. SPDX-License-Identifier: Apache-2.0
import type { Metadata } from 'next';
import Link from 'next/link';
import { SutureMark } from '@/components/suture-mark';

export const metadata: Metadata = {
  title: 'Page not found | Webhook Lab',
};

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col bg-surface-page text-text-primary">
      <header className="flex h-[58px] flex-shrink-0 items-center border-b border-border-medium bg-surface-card px-4 pt-[env(safe-area-inset-top)]">
        <Link href="/" className="flex items-center gap-[10px] text-text-primary">
          <SutureMark />
          <span className="font-mono text-[1rem]">Webhook&#8201;Lab</span>
        </Link>
      </header>

      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center px-4 py-10 md:px-6">
        <p className="font-mono text-[0.69rem] font-medium uppercase tracking-[0.14em] text-text-muted">
          404
        </p>
        <h1 className="mt-2 text-balance font-sans text-[1.5rem] font-medium leading-snug">
          This page does not exist
        </h1>
        <p className="mt-4 max-w-md font-sans text-[0.88rem] leading-[1.55] text-text-secondary">
          The page you are looking for is not here. Head back to the Lab to pick a
          Stripe event, sign it, and fire it at your endpoint.
        </p>
        <div className="mt-6">
          <Link
            href="/"
            className="inline-flex items-center rounded-cta bg-copper px-4 py-2.5 font-sans text-[0.81rem] font-medium text-white transition-all duration-150 hover:bg-copper/90"
          >
            Back to Webhook Lab
          </Link>
        </div>
      </main>
    </div>
  );
}
