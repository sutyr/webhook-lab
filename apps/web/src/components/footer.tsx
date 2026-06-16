// Copyright 2026 Sutyr Inc. SPDX-License-Identifier: Apache-2.0

export function Footer() {
  return (
    <footer className="flex flex-shrink-0 items-center justify-between border-t border-border-medium bg-surface-card px-4 py-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] font-mono text-[0.69rem] text-text-muted">
      <span>
        Open source{' '}
        <span className="text-text-muted">|</span>{' '}
        <a
          href="https://github.com/sutyr/webhook-lab/blob/main/LICENSE"
          target="_blank"
          rel="noopener"
          className="underline transition-colors hover:text-text-tertiary"
        >
          Apache 2.0
        </a>
      </span>
      <span>Lab by Sutyr</span>
    </footer>
  );
}
