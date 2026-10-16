// Copyright 2026 Sutyr Inc. SPDX-License-Identifier: Apache-2.0
'use client';

import { SCENARIO_CATALOG } from '@webhook-lab/events';
import { useLabState, useLabDispatch, type LabState } from '@/lib/lab-context';
import { categoryOf, GROUP_LABELS } from '@/lib/event-groups';
import type { EventCategory } from '@webhook-lab/events';

export interface Breadcrumb {
  label: string;
  onClick?: () => void;
}

export interface BreadcrumbActions {
  showTab: (tab: 'events' | 'scenarios') => void;
  revealGroup: (category: EventCategory) => void;
}

/**
 * The trail for what the center panel shows, which is not always the open
 * sidebar tab: browsing Events while the suite is on screen still reads Suite.
 */
export function breadcrumbsFor(
  state: Pick<LabState, 'mode' | 'selectedEventType' | 'selectedScenarioId'>,
  actions: BreadcrumbActions,
): Breadcrumb[] {
  if (state.mode === 'suite') return [{ label: 'Suite' }];

  if (state.mode === 'scenario') {
    const crumbs: Breadcrumb[] = [{ label: 'Scenarios', onClick: () => actions.showTab('scenarios') }];
    const scenario = SCENARIO_CATALOG.find((s) => s.id === state.selectedScenarioId);
    if (scenario) crumbs.push({ label: scenario.name });
    return crumbs;
  }

  const crumbs: Breadcrumb[] = [{ label: 'Events', onClick: () => actions.showTab('events') }];
  const category = categoryOf(state.selectedEventType);
  if (category) {
    crumbs.push({ label: GROUP_LABELS[category], onClick: () => actions.revealGroup(category) });
    crumbs.push({ label: state.selectedEventType });
  }
  return crumbs;
}

export function useBreadcrumbs(): Breadcrumb[] {
  const state = useLabState();
  const dispatch = useLabDispatch();

  return breadcrumbsFor(state, {
    showTab: (tab) => dispatch({ type: 'SET_TAB', tab }),
    revealGroup: (category) => {
      dispatch({ type: 'SET_TAB', tab: 'events' });
      dispatch({ type: 'SET_GROUP_OPEN', category, open: true });
      scrollGroupIntoView(category);
    },
  });
}

/** Bring an event group's header into view once the sidebar has rendered it. */
export function scrollGroupIntoView(category: EventCategory): void {
  if (typeof window === 'undefined') return;
  window.setTimeout(() => {
    document
      .querySelector<HTMLElement>(`[data-group-header="${category}"]`)
      ?.scrollIntoView({ block: 'nearest' });
  }, 0);
}
