// Copyright 2026 Sutyr Inc. SPDX-License-Identifier: Apache-2.0

const LINK = 'transition-colors hover:text-text-secondary';

export function Footer() {
  return (
    <footer className="flex flex-shrink-0 flex-wrap items-center justify-between gap-x-4 gap-y-1 border-t border-border-medium bg-surface-card px-4 py-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] font-sans text-[0.72rem] text-text-muted">
      <span className="flex items-center gap-4">
        <span>
          Open source under{' '}
          <a
            href="https://github.com/sutyr/webhook-lab/blob/main/LICENSE"
            target="_blank"
            rel="noopener"
            className={LINK}
          >
            Apache 2.0
          </a>
        </span>
        <a
          href="https://github.com/sutyr/webhook-lab"
          target="_blank"
          rel="noopener"
          className={LINK}
        >
          GitHub
        </a>
      </span>
      <span className="flex items-center gap-4">
        <a href="/legal" className={LINK}>
          Legal
        </a>
        <a
          href="https://sutyr.com/security"
          target="_blank"
          rel="noopener"
          className={LINK}
        >
          Security
        </a>
        <a href="https://sutyr.com" target="_blank" rel="noopener" className={LINK}>
          A Sutyr lab
        </a>
      </span>
    </footer>
  );
}
