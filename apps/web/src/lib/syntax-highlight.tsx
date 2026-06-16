// Copyright 2026 Sutyr Inc. SPDX-License-Identifier: Apache-2.0

import type { JSX } from 'react';

/**
 * Syntax-highlight a JSON string into colored React elements.
 * Keys = tertiary, strings/numbers/bools = secondary, null = muted, punctuation = muted.
 */
export function highlightJson(json: string): JSX.Element[] {
  const lines = json.split('\n');
  return lines.map((line, i) => {
    const tokens: JSX.Element[] = [];
    let remaining = line;
    let tokenIndex = 0;

    while (remaining.length > 0) {
      const wsMatch = remaining.match(/^(\s+)/);
      if (wsMatch) {
        tokens.push(<span key={`${i}-${tokenIndex++}`}>{wsMatch[1]}</span>);
        remaining = remaining.slice(wsMatch[1].length);
        continue;
      }

      const keyMatch = remaining.match(/^("(?:[^"\\]|\\.)*")(\s*:)/);
      if (keyMatch) {
        tokens.push(
          <span key={`${i}-${tokenIndex++}`} className="text-text-tertiary">{keyMatch[1]}</span>,
        );
        tokens.push(<span key={`${i}-${tokenIndex++}`}>{keyMatch[2]}</span>);
        remaining = remaining.slice(keyMatch[0].length);
        continue;
      }

      const nullMatch = remaining.match(/^(null)/);
      if (nullMatch) {
        tokens.push(
          <span key={`${i}-${tokenIndex++}`} className="text-text-muted">{nullMatch[1]}</span>,
        );
        remaining = remaining.slice(nullMatch[1].length);
        continue;
      }

      const boolMatch = remaining.match(/^(true|false)/);
      if (boolMatch) {
        tokens.push(
          <span key={`${i}-${tokenIndex++}`} className="text-text-secondary">{boolMatch[1]}</span>,
        );
        remaining = remaining.slice(boolMatch[1].length);
        continue;
      }

      const numMatch = remaining.match(/^(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)/);
      if (numMatch) {
        tokens.push(
          <span key={`${i}-${tokenIndex++}`} className="text-text-secondary">{numMatch[1]}</span>,
        );
        remaining = remaining.slice(numMatch[1].length);
        continue;
      }

      const strMatch = remaining.match(/^("(?:[^"\\]|\\.)*")/);
      if (strMatch) {
        tokens.push(
          <span key={`${i}-${tokenIndex++}`} className="text-text-secondary">{strMatch[1]}</span>,
        );
        remaining = remaining.slice(strMatch[1].length);
        continue;
      }

      tokens.push(
        <span key={`${i}-${tokenIndex++}`} className="text-text-muted">{remaining[0]}</span>,
      );
      remaining = remaining.slice(1);
    }

    return (
      <div key={i} className="whitespace-pre leading-5">
        {tokens}
      </div>
    );
  });
}
