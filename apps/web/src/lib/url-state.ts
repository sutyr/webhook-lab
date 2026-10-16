// Copyright 2026 Sutyr Inc. SPDX-License-Identifier: Apache-2.0

import { SCENARIO_CATALOG } from '@webhook-lab/events';
import type { StripeEventType } from '@webhook-lab/events';
import { isEventType } from '@/lib/event-groups';

export interface UrlParsedState {
  mode: 'suite' | 'event' | 'scenario';
  activeTab: 'suite' | 'events' | 'scenarios';
  selectedEventType?: StripeEventType;
  selectedScenarioId?: string;
  eventOptions?: Record<string, unknown>;
  targetUrl?: string;
}

const PARAM_TO_OPTION: Record<string, string> = {
  amount: 'amount',
  currency: 'currency',
  decline: 'declineCode',
  customerId: 'customerId',
  chargeId: 'chargeId',
  subscriptionId: 'subscriptionId',
  invoiceId: 'invoiceId',
  paymentIntentId: 'paymentIntentId',
  livemode: 'livemode',
  apiVersion: 'apiVersion',
};

function isScenarioId(value: string): boolean {
  return SCENARIO_CATALOG.some((s) => s.id === value);
}

/**
 * Parse URL search params into partial state.
 * Called once on page load. URL params override localStorage.
 * A link with a known event opens it, a known scenario opens that, and
 * anything else opens the suite.
 */
export function parseUrlState(searchParams: URLSearchParams): UrlParsedState {
  const state: UrlParsedState = { mode: 'suite', activeTab: 'suite' };
  const eventOptions: Record<string, unknown> = {};

  const event = searchParams.get('event');
  if (event && isEventType(event)) {
    state.selectedEventType = event;
    state.mode = 'event';
    state.activeTab = 'events';
  }

  const scenario = searchParams.get('scenario');
  if (scenario && isScenarioId(scenario)) {
    state.selectedScenarioId = scenario;
    state.mode = 'scenario';
    state.activeTab = 'scenarios';
  }

  for (const [param, optionKey] of Object.entries(PARAM_TO_OPTION)) {
    const value = searchParams.get(param);
    if (value !== null) {
      if (param === 'amount') {
        const parsed = parseInt(value, 10);
        if (!isNaN(parsed)) eventOptions[optionKey] = parsed;
      } else if (param === 'livemode') {
        eventOptions[optionKey] = value === 'true';
      } else {
        eventOptions[optionKey] = value;
      }
    }
  }

  if (Object.keys(eventOptions).length > 0) {
    state.eventOptions = eventOptions;
  }

  const url = searchParams.get('url');
  if (url) state.targetUrl = url;

  return state;
}

/**
 * Serialize relevant state to URL search params.
 * Called via history.replaceState on state changes.
 * Never includes signing secret. The suite needs no parameter of its own:
 * a link without event or scenario opens it.
 */
export function serializeToUrl(state: {
  mode: string;
  selectedEventType: string;
  selectedScenarioId: string | null;
  eventOptions: Record<string, unknown>;
  targetUrl: string;
}): string {
  const params = new URLSearchParams();

  if (state.mode === 'scenario' && state.selectedScenarioId) {
    params.set('scenario', state.selectedScenarioId);
  } else if (state.mode === 'event' && state.selectedEventType) {
    params.set('event', state.selectedEventType);

    // Options describe the event, so they only travel with an event link.
    const opts = state.eventOptions;
    if (opts.amount !== undefined && opts.amount !== '' && opts.amount !== 2999) {
      params.set('amount', String(opts.amount));
    }
    if (opts.currency && opts.currency !== 'usd') {
      params.set('currency', String(opts.currency));
    }
    if (opts.declineCode) params.set('decline', String(opts.declineCode));
    if (opts.customerId) params.set('customerId', String(opts.customerId));
    if (opts.chargeId) params.set('chargeId', String(opts.chargeId));
    if (opts.subscriptionId) params.set('subscriptionId', String(opts.subscriptionId));
    if (opts.invoiceId) params.set('invoiceId', String(opts.invoiceId));
    if (opts.paymentIntentId) params.set('paymentIntentId', String(opts.paymentIntentId));
    if (opts.livemode === true) params.set('livemode', 'true');
    if (opts.apiVersion) params.set('apiVersion', String(opts.apiVersion));
  }

  if (state.targetUrl) params.set('url', state.targetUrl);

  const qs = params.toString();
  return qs ? `?${qs}` : '';
}
