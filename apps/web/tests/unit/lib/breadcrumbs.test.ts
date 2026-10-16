// Copyright 2026 Sutyr Inc. SPDX-License-Identifier: Apache-2.0

import { describe, it, expect, vi } from 'vitest';
import { breadcrumbsFor } from '@/lib/use-breadcrumbs';

const actions = () => ({ showTab: vi.fn(), revealGroup: vi.fn() });

describe('breadcrumbsFor', () => {
  it('reads Suite in suite mode', () => {
    const crumbs = breadcrumbsFor(
      { mode: 'suite', selectedEventType: 'invoice.paid', selectedScenarioId: null },
      actions(),
    );
    expect(crumbs.map((c) => c.label)).toEqual(['Suite']);
  });

  it('shows the group and the event in event mode', () => {
    const a = actions();
    const crumbs = breadcrumbsFor(
      { mode: 'event', selectedEventType: 'invoice.payment_failed', selectedScenarioId: null },
      a,
    );
    expect(crumbs.map((c) => c.label)).toEqual(['Events', 'Invoices', 'invoice.payment_failed']);
    crumbs[0].onClick?.();
    expect(a.showTab).toHaveBeenCalledWith('events');
    crumbs[1].onClick?.();
    expect(a.revealGroup).toHaveBeenCalledWith('billing');
    expect(crumbs[2].onClick).toBeUndefined();
  });

  it('uses the new group names', () => {
    const crumbs = breadcrumbsFor(
      { mode: 'event', selectedEventType: 'radar.early_fraud_warning.created', selectedScenarioId: null },
      actions(),
    );
    expect(crumbs[1].label).toBe('Disputes and fraud');
  });

  it('shows the scenario name in scenario mode', () => {
    const a = actions();
    const crumbs = breadcrumbsFor(
      { mode: 'scenario', selectedEventType: 'invoice.paid', selectedScenarioId: 'refund-flow' },
      a,
    );
    expect(crumbs.map((c) => c.label)).toEqual(['Scenarios', 'Refund Flow']);
    crumbs[0].onClick?.();
    expect(a.showTab).toHaveBeenCalledWith('scenarios');
  });
});
