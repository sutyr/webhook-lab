// Copyright 2026 Sutyr Inc. SPDX-License-Identifier: Apache-2.0
'use client';

import { SCENARIO_CATALOG } from '@webhook-lab/events';
import { useLabState, useLabDispatch } from '@/lib/lab-context';
import { scenarioIcon } from '@/components/sidebar/catalog-icons';
import { cn } from '@/lib/cn';

const SCENARIO_ACCENTS: Record<string, string> = {
  'subscription-happy-path': 'border-l-state-success',
  'subscription-failure': 'border-l-state-error',
  'checkout-flow': 'border-l-state-info',
  'dispute-lifecycle': 'border-l-state-warning',
  'refund-flow': 'border-l-state-info',
  'trial-conversion': 'border-l-state-success',
  '3d-secure': 'border-l-state-warning',
  'early-fraud-warning': 'border-l-state-warning',
};

export function ScenarioList() {
  const state = useLabState();
  const dispatch = useLabDispatch();

  return (
    <div className="py-1" id="tabpanel-scenarios" role="tabpanel" aria-label="Scenarios">
      {SCENARIO_CATALOG.map((scenario) => {
        const isSelected =
          state.mode === 'scenario' &&
          state.selectedScenarioId === scenario.id;
        const Icon = scenarioIcon(scenario.id);
        const accent = SCENARIO_ACCENTS[scenario.id] ?? 'border-l-transparent';

        return (
          <button
            key={scenario.id}
            type="button"
            onClick={() =>
              dispatch({ type: 'SELECT_SCENARIO', scenarioId: scenario.id })
            }
            className={cn(
              'flex w-full items-center gap-2 border-l-[3px] px-3 py-2.5 text-left transition-colors duration-150',
              accent,
              isSelected
                ? 'bg-surface-input text-text-primary'
                : 'hover:bg-surface-input',
            )}
          >
            <Icon
              size={16}
              strokeWidth={1.75}
              className="flex-shrink-0 text-text-tertiary"
            />
            <span className="flex-1 font-sans text-[0.75rem] leading-[1.3] text-text-secondary">
              {scenario.name}
            </span>
            <span className="flex-shrink-0 font-mono text-[0.69rem] text-text-muted">
              {scenario.stepCount}
            </span>
          </button>
        );
      })}
    </div>
  );
}
