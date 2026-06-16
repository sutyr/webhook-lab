// Copyright 2026 Sutyr Inc. SPDX-License-Identifier: Apache-2.0
'use client';

import { useLabState } from '@/lib/lab-context';
import { ResponseViewer } from '@/components/response/response-viewer';
import { ScenarioResults } from '@/components/response/scenario-results';

export function ResponsePanel() {
  const { mode } = useLabState();

  return (
    <aside className="h-full w-full flex-shrink-0 overflow-y-auto border-t border-border-medium bg-surface-card p-4 md:w-80 md:border-l md:border-t-0">
      {mode === 'scenario' ? <ScenarioResults /> : <ResponseViewer />}
    </aside>
  );
}
