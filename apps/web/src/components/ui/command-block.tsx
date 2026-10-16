// Copyright 2026 Sutyr Inc. SPDX-License-Identifier: Apache-2.0
'use client';

import { Fragment } from 'react';
import { CopyButton } from '@/components/ui/copy-button';
import { cn } from '@/lib/cn';

interface CommandBlockProps {
  command: string;
  className?: string;
}

/**
 * A shell command to copy. Long URLs wrap instead of scrolling sideways, but
 * flags such as --secret stay whole, so the wrapped text still reads as the
 * command it copies.
 */
export function CommandBlock({ command, className }: CommandBlockProps) {
  const tokens = command.split(' ');
  return (
    <div
      className={cn(
        'flex items-start gap-1 rounded-input border border-border bg-surface-input py-1.5 pl-3 pr-1',
        className,
      )}
    >
      <code className="min-w-0 flex-1 py-0.5 font-mono text-[0.72rem] leading-[1.45] text-text-primary [overflow-wrap:anywhere]">
        {tokens.map((token, i) => (
          <Fragment key={i}>
            {i > 0 && ' '}
            {token.startsWith('-') ? <span className="whitespace-nowrap">{token}</span> : token}
          </Fragment>
        ))}
      </code>
      <CopyButton text={command} className="flex-shrink-0" />
    </div>
  );
}
