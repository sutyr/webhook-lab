// Copyright 2026 Sutyr Inc. SPDX-License-Identifier: Apache-2.0
'use client';

import { useLabState } from '@/lib/lab-context';
import { EventHeader } from './event-header';
import { EventFields } from './event-fields';
import { JsonPreview } from './json-preview';
import { FireControls } from './fire-controls';
import { ScenarioRunner } from './scenario-runner';

export function EventEditor() {
  const { mode } = useLabState();

  if (mode === 'scenario') {
    return <ScenarioRunner />;
  }

  return (
    <div className="space-y-5">
      <EventHeader />
      <EventFields />
      <FireControls />
      <div className="border-t border-border pt-4">
        <p className="mb-2 font-mono text-[0.69rem] font-medium uppercase tracking-[0.12em] text-text-muted">
          Payload
        </p>
        <JsonPreview />
      </div>
    </div>
  );
}
