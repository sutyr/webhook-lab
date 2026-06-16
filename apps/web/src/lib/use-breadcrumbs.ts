// Copyright 2026 Sutyr Inc. SPDX-License-Identifier: Apache-2.0
'use client';

import { EVENT_CATALOG, SCENARIO_CATALOG } from '@webhook-lab/events';
import { useLabState, useLabDispatch } from '@/lib/lab-context';

export interface Breadcrumb {
  label: string;
  onClick?: () => void;
}

const CATEGORY_LABELS: Record<string, string> = {
  payments: 'Payments',
  billing: 'Billing',
  subscriptions: 'Subscriptions',
  checkout: 'Checkout',
  customers: 'Customers',
  disputes: 'Disputes',
};

export function useBreadcrumbs(): Breadcrumb[] {
  const state = useLabState();
  const dispatch = useLabDispatch();

  if (state.activeTab === 'scenarios') {
    const crumbs: Breadcrumb[] = [
      { label: 'Scenarios', onClick: () => dispatch({ type: 'SET_TAB', tab: 'scenarios' }) },
    ];
    if (state.selectedScenarioId) {
      const scenario = SCENARIO_CATALOG.find((s) => s.id === state.selectedScenarioId);
      if (scenario) crumbs.push({ label: scenario.name });
    }
    return crumbs;
  }

  const crumbs: Breadcrumb[] = [
    { label: 'Events', onClick: () => dispatch({ type: 'DRILL_OUT' }) },
  ];

  if (state.drillCategory) {
    const catLabel = CATEGORY_LABELS[state.drillCategory] ?? state.drillCategory;
    crumbs.push({
      label: catLabel,
      onClick: () => dispatch({ type: 'DRILL_INTO_CATEGORY', id: state.drillCategory! }),
    });

    if (state.mode === 'event' && state.selectedEventType) {
      const entry = EVENT_CATALOG.find((e) => e.type === state.selectedEventType);
      if (entry && entry.category === state.drillCategory) {
        crumbs.push({ label: state.selectedEventType });
      }
    }
  }

  return crumbs;
}
