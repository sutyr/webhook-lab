// Copyright 2026 Sutyr Inc. SPDX-License-Identifier: Apache-2.0
'use client';

import type { EventCategory } from '@webhook-lab/events';
import { SCENARIO_CATALOG } from '@webhook-lab/events';
import { useLabState, useLabDispatch } from '@/lib/lab-context';
import { categoryOf, EVENT_GROUPS } from '@/lib/event-groups';
import { CHECK_STATUS_META, SUITE_CHECKS } from '@/lib/suite-checks';
import { scrollGroupIntoView } from '@/lib/use-breadcrumbs';
import { CATEGORY_ICONS, TAB_ICONS, scenarioIcon } from '@/components/sidebar/catalog-icons';
import { SIDEBAR_TABS } from '@/components/sidebar/sidebar-tabs';
import { cn } from '@/lib/cn';

interface CollapsedSidebarProps {
  onExpand: () => void;
}

const ITEM =
  'flex h-8 w-8 items-center justify-center rounded-input transition-all duration-150 hover:scale-110';
const ITEM_ACTIVE = 'bg-surface-input text-text-primary';
const ITEM_IDLE = 'text-text-tertiary hover:bg-surface-input hover:text-text-secondary';

/**
 * The 48px rail. Tab icons switch tabs without expanding; the icons below
 * them are the open tab's groups, scenarios or checks, and expand the
 * sidebar onto the one picked.
 */
export function CollapsedSidebar({ onExpand }: CollapsedSidebarProps) {
  const { activeTab, mode, selectedEventType, selectedScenarioId, suiteReport, focusedCheck } =
    useLabState();
  const dispatch = useLabDispatch();
  const currentCategory = categoryOf(selectedEventType);

  function openGroup(category: EventCategory) {
    dispatch({ type: 'SET_GROUP_OPEN', category, open: true });
    onExpand();
    scrollGroupIntoView(category);
  }

  return (
    <nav className="flex flex-col items-center gap-1 py-3" aria-label="Sidebar navigation">
      {SIDEBAR_TABS.map((tab) => {
        const Icon = TAB_ICONS[tab.id];
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => dispatch({ type: 'SET_TAB', tab: tab.id })}
            title={tab.label}
            aria-label={tab.label}
            aria-pressed={isActive}
            className={cn(ITEM, isActive ? ITEM_ACTIVE : ITEM_IDLE)}
          >
            <Icon size={18} strokeWidth={1.75} />
          </button>
        );
      })}

      <div className="my-1.5 w-6 border-t border-border-medium" />

      {activeTab === 'events' &&
        EVENT_GROUPS.map((group) => {
          const Icon = CATEGORY_ICONS[group.category];
          const isActive = mode === 'event' && currentCategory === group.category;
          return (
            <button
              key={group.category}
              type="button"
              onClick={() => openGroup(group.category)}
              title={group.label}
              aria-label={group.label}
              className={cn(ITEM, isActive ? ITEM_ACTIVE : ITEM_IDLE)}
            >
              <Icon size={18} strokeWidth={1.75} />
            </button>
          );
        })}

      {activeTab === 'scenarios' &&
        SCENARIO_CATALOG.map((scenario) => {
          const Icon = scenarioIcon(scenario.id);
          const isActive = mode === 'scenario' && selectedScenarioId === scenario.id;
          return (
            <button
              key={scenario.id}
              type="button"
              onClick={() => {
                dispatch({ type: 'SELECT_SCENARIO', scenarioId: scenario.id });
                onExpand();
              }}
              title={scenario.name}
              aria-label={scenario.name}
              className={cn(ITEM, isActive ? ITEM_ACTIVE : ITEM_IDLE)}
            >
              <Icon size={18} strokeWidth={1.75} />
            </button>
          );
        })}

      {activeTab === 'suite' &&
        SUITE_CHECKS.map((check) => {
          const result = suiteReport?.results.find((r) => r.id === check.id);
          const isActive = mode === 'suite' && focusedCheck === check.id;
          return (
            <button
              key={check.id}
              type="button"
              onClick={() => dispatch({ type: 'FOCUS_CHECK', id: check.id })}
              title={result ? `${check.title}: ${CHECK_STATUS_META[result.status].label}` : check.title}
              aria-label={result ? `${check.title}, ${CHECK_STATUS_META[result.status].label}` : check.title}
              className={cn(ITEM, 'h-6', isActive ? ITEM_ACTIVE : ITEM_IDLE)}
            >
              <span
                className={cn(
                  'h-1.5 w-1.5 rounded-full',
                  result ? CHECK_STATUS_META[result.status].dot : 'bg-border-strong',
                )}
              />
            </button>
          );
        })}
    </nav>
  );
}
