// Copyright 2026 Sutyr Inc. SPDX-License-Identifier: Apache-2.0
'use client';

import { EVENT_CATALOG } from '@webhook-lab/events';
import { useLabState } from '@/lib/lab-context';

export function EventHeader() {
  const { selectedEventType } = useLabState();
  const entry = EVENT_CATALOG.find((e) => e.type === selectedEventType);

  if (!entry) return null;

  return (
    <div>
      <p className="font-mono text-[0.875rem] text-text-primary">{entry.type}</p>
      <p className="mt-0.5 font-sans text-[0.81rem] font-light text-text-secondary">
        {entry.description}
      </p>
    </div>
  );
}
