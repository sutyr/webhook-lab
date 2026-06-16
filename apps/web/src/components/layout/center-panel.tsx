// Copyright 2026 Sutyr Inc. SPDX-License-Identifier: Apache-2.0
'use client';

import { EventEditor } from '@/components/editor';

export function CenterPanel() {
  return (
    <main className="min-w-0 flex-1 overflow-y-auto bg-surface-page p-4 md:p-6">
      <EventEditor />
    </main>
  );
}
