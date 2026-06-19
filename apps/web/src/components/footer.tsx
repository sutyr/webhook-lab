// Copyright 2026 Sutyr Inc. SPDX-License-Identifier: Apache-2.0

const SEP = <span className="px-2 text-border-strong">|</span>;
const LINK =
  'transition-colors hover:text-text-tertiary';

export function Footer() {
  return (
    <footer className="flex flex-shrink-0 flex-wrap items-center justify-between gap-x-1 gap-y-1 border-t border-border-medium bg-surface-card px-4 py-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] font-mono text-[0.69rem] text-text-muted">
      <span>
        Open source
        {SEP}
        <a
          href="https://github.com/sutyr/webhook-lab/blob/main/LICENSE"
          target="_blank"
          rel="noopener"
          className={LINK}
        >
          Apache 2.0
        </a>
        {SEP}
        <a
          href="https://github.com/sutyr/webhook-lab"
          target="_blank"
          rel="noopener"
          className={LINK}
        >
          GitHub
        </a>
      </span>
      <span>
        <a href="/legal" className={LINK}>
          Legal
        </a>
        {SEP}
        <a
          href="https://sutyr.com/security"
          target="_blank"
          rel="noopener"
          className={LINK}
        >
          Security
        </a>
        {SEP}
        <span>Lab by Sutyr</span>
      </span>
    </footer>
  );
}
