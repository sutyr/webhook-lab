// Copyright 2026 Sutyr Inc. SPDX-License-Identifier: Apache-2.0

import type { CheckStatus } from '@webhook-lab/conformance';
import { CHECK_STATUS_META } from '@/lib/suite-checks';
import { cn } from '@/lib/cn';

/** One badge per check status, identical wherever it appears. */
export function CheckStatusBadge({ status }: { status: CheckStatus }) {
  const meta = CHECK_STATUS_META[status];
  return (
    <span
      className={cn(
        'inline-flex h-5 flex-shrink-0 items-center gap-1.5 rounded-badge px-1.5 font-sans text-[0.69rem] font-medium leading-none',
        meta.badge,
      )}
    >
      <span className={cn('h-1.5 w-1.5 flex-shrink-0 rounded-full', meta.dot)} aria-hidden="true" />
      {meta.label}
    </span>
  );
}

/** Same footprint as the badge, for loading rows. */
export function CheckStatusBadgeSkeleton() {
  return <span className="shimmer-line !block !h-5 w-14 flex-shrink-0 rounded-badge" aria-hidden="true" />;
}
