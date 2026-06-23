// Copyright 2026 Sutyr Inc. SPDX-License-Identifier: Apache-2.0
import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Legal & Trust | Webhook Lab',
  description:
    'How Webhook Lab handles your data, plus links to Sutyr’s privacy policy, terms of use, sub-processors, and security.',
};

function SutureMark() {
  return (
    <svg viewBox="0 0 100 100" width={22} height={22} aria-hidden="true">
      <path d="M16 12L84 12L84 59.5L52.5 59.5L52.5 35.5L16 35.5Z" fill="var(--color-mark-dt)" />
      <path d="M84 88L16 88L16 40.5L47.5 40.5L47.5 64.5L84 64.5Z" fill="var(--color-copper)" />
    </svg>
  );
}

const SECTION_LABEL =
  'font-mono text-[0.69rem] font-medium uppercase tracking-[0.14em] text-text-muted';
const EXTERNAL =
  'font-mono text-[0.81rem] text-text-secondary underline decoration-border-strong underline-offset-2 transition-colors hover:text-text-primary';

export default function LegalPage() {
  return (
    <div className="min-h-screen bg-surface-page text-text-primary">
      {/* Top bar */}
      <header className="flex h-[58px] items-center border-b border-border-medium bg-surface-card px-4 pt-[env(safe-area-inset-top)]">
        <Link href="/" className="flex items-center gap-[10px] text-text-primary">
          <SutureMark />
          <span className="font-mono text-[1rem]">Webhook&#8201;Lab</span>
        </Link>
      </header>

      <main className="mx-auto max-w-2xl px-4 py-10 md:px-6 md:py-14">
        <p className={SECTION_LABEL}>Legal &amp; Trust</p>
        <h1 className="mt-2 text-balance break-words font-sans text-[1.25rem] font-medium leading-snug md:text-[1.5rem]">
          How Webhook Lab handles your data
        </h1>

        <div className="mt-5 space-y-4 font-sans text-[0.88rem] leading-[1.55] text-text-secondary">
          <p>
            Webhook Lab proxies the event you fire to the endpoint you specify. To do that it
            processes (in memory, for the duration of the request only) your{' '}
            <span className="text-text-primary">target URL</span>, the{' '}
            <span className="text-text-primary">event payload</span>, the{' '}
            <span className="text-text-primary">signing secret</span>, and your{' '}
            <span className="text-text-primary">IP address</span> (used solely for rate limiting).
          </p>
          <p>
            It does <span className="text-text-primary">not store or log</span> any of these. The
            Lab is <span className="text-text-primary">cookieless</span>: no database, no analytics,
            and no tracking. The only client-side storage is your browser’s{' '}
            <span className="font-mono text-[0.81rem]">localStorage</span> (which is not a cookie),
            holding your theme and last-used preferences and never leaving your device.
          </p>
          <p className="rounded-card border border-border bg-surface-card p-3 text-[0.81rem] text-text-tertiary">
            Use synthetic test data (which the Lab generates for you) rather than real customer or
            personal data in payloads.
          </p>
        </div>

        {/* Documents */}
        <section className="mt-10">
          <p className={SECTION_LABEL}>Documents</p>
          <ul className="mt-3 space-y-2.5">
            <li><a href="https://sutyr.com/legal/privacy" className={EXTERNAL} target="_blank" rel="noopener noreferrer">Privacy Policy</a></li>
            <li><a href="https://sutyr.com/legal/terms" className={EXTERNAL} target="_blank" rel="noopener noreferrer">Terms of Use</a></li>
            <li><a href="https://sutyr.com/legal/subprocessors" className={EXTERNAL} target="_blank" rel="noopener noreferrer">Sub-processor Disclosure</a></li>
            <li><a href="https://sutyr.com/security" className={EXTERNAL} target="_blank" rel="noopener noreferrer">Security</a></li>
          </ul>
          <p className="mt-3 font-sans text-[0.75rem] leading-[1.4] text-text-muted">
            Webhook Lab is covered by Sutyr’s Terms of Use (including the Webhook Lab and acceptable-use
            sections) and the cookieless Privacy Policy linked above.
          </p>
        </section>

        {/* Open source & security */}
        <section className="mt-10">
          <p className={SECTION_LABEL}>Open source &amp; security</p>
          <ul className="mt-3 space-y-2.5">
            <li><a href="https://github.com/sutyr/webhook-lab" className={EXTERNAL} target="_blank" rel="noopener noreferrer">Source code (GitHub, Apache 2.0)</a></li>
            <li><a href="https://github.com/sutyr/webhook-lab/blob/main/SECURITY.md" className={EXTERNAL} target="_blank" rel="noopener noreferrer">Security policy &amp; vulnerability reporting</a></li>
            <li><a href="/.well-known/security.txt" className={EXTERNAL}>security.txt (RFC 9116)</a></li>
            <li><a href="/.well-known/cbom" className={EXTERNAL}>Cryptographic Bill of Materials (CycloneDX)</a></li>
          </ul>
          <p className="mt-3 font-sans text-[0.75rem] leading-[1.4] text-text-muted">
            Report a vulnerability privately to{' '}
            <a href="mailto:security@sutyr.com" className="text-text-tertiary underline hover:text-text-secondary">security@sutyr.com</a>.
          </p>
        </section>

        <div className="mt-12 border-t border-border pt-5 font-mono text-[0.69rem] text-text-muted">
          <p>Effective 19 June 2026 · Sutyr Inc.</p>
          <Link href="/" className="mt-2 inline-block text-text-tertiary underline hover:text-text-secondary">
            ← Back to Webhook Lab
          </Link>
        </div>
      </main>
    </div>
  );
}
