// Copyright 2026 Sutyr Inc. SPDX-License-Identifier: Apache-2.0
'use client';

import { useLabState } from '@/lib/lab-context';
import { EventCatalog } from '@/components/sidebar/event-catalog';
import { ScenarioList } from '@/components/sidebar/scenario-list';

export function MobileTabContent() {
  const { activeTab } = useLabState();
  return activeTab === 'events' ? <EventCatalog /> : <ScenarioList />;
}
