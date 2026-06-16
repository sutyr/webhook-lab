// Copyright 2026 Sutyr Inc. SPDX-License-Identifier: Apache-2.0
'use client';

import { useState } from 'react';
import { Copy, Check } from 'lucide-react';
import { cn } from '@/lib/cn';

interface CopyButtonProps {
  text: string;
  className?: string;
}

export function CopyButton({ text, className }: CopyButtonProps) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      className={cn(
        'flex items-center justify-center rounded-badge p-2 transition-colors duration-150 md:p-1',
        copied
          ? 'text-state-success'
          : 'text-text-muted hover:bg-surface-input hover:text-text-secondary',
        className,
      )}
      aria-label={copied ? 'Copied' : 'Copy to clipboard'}
    >
      {copied ? (
        <Check size={14} strokeWidth={1.75} className="animate-check-bounce" />
      ) : (
        <Copy size={14} strokeWidth={1.75} />
      )}
    </button>
  );
}
