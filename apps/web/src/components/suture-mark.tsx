// Copyright 2026 Sutyr Inc. SPDX-License-Identifier: Apache-2.0
// Sutyr suture mark. Exact paths per the design system; do not modify.
export function SutureMark({ size = 22 }: { size?: number }) {
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} aria-hidden="true">
      <path d="M16 12L84 12L84 59.5L52.5 59.5L52.5 35.5L16 35.5Z" fill="var(--color-mark-dt)" />
      <path d="M84 88L16 88L16 40.5L47.5 40.5L47.5 64.5L84 64.5Z" fill="var(--color-copper)" />
    </svg>
  );
}
