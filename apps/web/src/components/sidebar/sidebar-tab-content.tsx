// Copyright 2026 Sutyr Inc. SPDX-License-Identifier: Apache-2.0
'use client';

import { useLabState } from '@/lib/lab-context';
import { EventCatalog } from '@/components/sidebar/event-catalog';
import { ScenarioList } from '@/components/sidebar/scenario-list';
import { SuiteCheckList } from '@/components/sidebar/suite-check-list';

/** The open sidebar tab's content. Shared by the desktop sidebar and the mobile drawer. */
export function SidebarTabContent() {
  const { activeTab } = useLabState();
  if (activeTab === 'suite') return <SuiteCheckList />;
  if (activeTab === 'scenarios') return <ScenarioList />;
  return <EventCatalog />;
}
