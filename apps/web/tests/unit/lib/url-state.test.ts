// Copyright 2026 Sutyr Inc. SPDX-License-Identifier: Apache-2.0

import { describe, it, expect } from 'vitest';
import { EVENT_CATALOG, SCENARIO_CATALOG } from '@webhook-lab/events';
import { parseUrlState, serializeToUrl } from '@/lib/url-state';

describe('parseUrlState', () => {
  it('event param sets selectedEventType, mode, activeTab', () => {
    const params = new URLSearchParams('event=invoice.payment_failed');
    const state = parseUrlState(params);
    expect(state.selectedEventType).toBe('invoice.payment_failed');
    expect(state.mode).toBe('event');
    expect(state.activeTab).toBe('events');
  });

  it('no event or scenario opens the suite', () => {
    const state = parseUrlState(new URLSearchParams(''));
    expect(state.mode).toBe('suite');
    expect(state.activeTab).toBe('suite');
  });

  it('a url alone opens the suite aimed at it', () => {
    const state = parseUrlState(new URLSearchParams('url=https://staging.example.com/hook'));
    expect(state.mode).toBe('suite');
    expect(state.targetUrl).toBe('https://staging.example.com/hook');
  });

  it('every catalog event type opens from an event link', () => {
    expect(EVENT_CATALOG).toHaveLength(39);
    for (const entry of EVENT_CATALOG) {
      const state = parseUrlState(new URLSearchParams({ event: entry.type }));
      expect(state.selectedEventType).toBe(entry.type);
      expect(state.mode).toBe('event');
    }
  });

  it('every catalog scenario opens from a scenario link', () => {
    for (const scenario of SCENARIO_CATALOG) {
      const state = parseUrlState(new URLSearchParams({ scenario: scenario.id }));
      expect(state.selectedScenarioId).toBe(scenario.id);
      expect(state.mode).toBe('scenario');
      expect(state.activeTab).toBe('scenarios');
    }
  });

  it('an unknown scenario id falls back to the suite', () => {
    const state = parseUrlState(new URLSearchParams('scenario=not-a-scenario'));
    expect(state.selectedScenarioId).toBeUndefined();
    expect(state.mode).toBe('suite');
  });

  it('scenario wins when a link carries both, as before', () => {
    const state = parseUrlState(new URLSearchParams('event=invoice.paid&scenario=refund-flow'));
    expect(state.mode).toBe('scenario');
    expect(state.selectedScenarioId).toBe('refund-flow');
    expect(state.selectedEventType).toBe('invoice.paid');
  });

  it('scenario param sets selectedScenarioId, mode, activeTab', () => {
    const params = new URLSearchParams('scenario=subscription-happy-path');
    const state = parseUrlState(params);
    expect(state.selectedScenarioId).toBe('subscription-happy-path');
    expect(state.mode).toBe('scenario');
    expect(state.activeTab).toBe('scenarios');
  });

  it('amount param parsed as integer', () => {
    const params = new URLSearchParams('event=charge.succeeded&amount=5000');
    const state = parseUrlState(params);
    expect(state.eventOptions?.amount).toBe(5000);
  });

  it('livemode param parsed as boolean', () => {
    const params = new URLSearchParams('event=charge.succeeded&livemode=true');
    const state = parseUrlState(params);
    expect(state.eventOptions?.livemode).toBe(true);
  });

  it('livemode=false parsed as boolean false', () => {
    const params = new URLSearchParams('event=charge.succeeded&livemode=false');
    const state = parseUrlState(params);
    expect(state.eventOptions?.livemode).toBe(false);
  });

  it('unknown event type ignored, and the suite opens instead', () => {
    const params = new URLSearchParams('event=totally.fake.event');
    const state = parseUrlState(params);
    expect(state.selectedEventType).toBeUndefined();
    expect(state.mode).toBe('suite');
  });

  it('prototype names are not event types', () => {
    const state = parseUrlState(new URLSearchParams('event=constructor'));
    expect(state.selectedEventType).toBeUndefined();
  });

  it('url param sets targetUrl', () => {
    const params = new URLSearchParams('event=charge.succeeded&url=https://example.com/hook');
    const state = parseUrlState(params);
    expect(state.targetUrl).toBe('https://example.com/hook');
  });

  it('empty search string returns empty state', () => {
    const params = new URLSearchParams('');
    const state = parseUrlState(params);
    expect(state.selectedEventType).toBeUndefined();
    expect(state.selectedScenarioId).toBeUndefined();
    expect(state.eventOptions).toBeUndefined();
    expect(state.targetUrl).toBeUndefined();
  });

  it('entity ID params map to eventOptions', () => {
    const params = new URLSearchParams('event=charge.succeeded&customerId=cus_abc&chargeId=ch_xyz');
    const state = parseUrlState(params);
    expect(state.eventOptions?.customerId).toBe('cus_abc');
    expect(state.eventOptions?.chargeId).toBe('ch_xyz');
  });

  it('invalid amount (NaN) is not included', () => {
    const params = new URLSearchParams('event=charge.succeeded&amount=notanumber');
    const state = parseUrlState(params);
    expect(state.eventOptions?.amount).toBeUndefined();
  });
});

describe('serializeToUrl', () => {
  const baseState = {
    mode: 'event' as const,
    selectedEventType: 'payment_intent.succeeded',
    selectedScenarioId: null,
    eventOptions: {} as Record<string, unknown>,
    targetUrl: '',
  };

  it('includes event type', () => {
    const qs = serializeToUrl(baseState);
    expect(qs).toContain('event=payment_intent.succeeded');
  });

  it('omits default values (amount 2999, currency usd)', () => {
    const qs = serializeToUrl({
      ...baseState,
      eventOptions: { amount: 2999, currency: 'usd' },
    });
    expect(qs).not.toContain('amount=');
    expect(qs).not.toContain('currency=');
  });

  it('includes non-default options', () => {
    const qs = serializeToUrl({
      ...baseState,
      eventOptions: { amount: 5000, currency: 'eur' },
    });
    expect(qs).toContain('amount=5000');
    expect(qs).toContain('currency=eur');
  });

  it('scenario mode serializes scenario ID', () => {
    const qs = serializeToUrl({
      ...baseState,
      mode: 'scenario',
      selectedScenarioId: 'checkout-flow',
    });
    expect(qs).toContain('scenario=checkout-flow');
    expect(qs).not.toContain('event=');
  });

  it('never includes signing secret', () => {
    const qs = serializeToUrl({
      ...baseState,
      eventOptions: { signingSecret: 'whsec_super_secret' },
    } as typeof baseState);
    expect(qs).not.toContain('secret');
    expect(qs).not.toContain('whsec_');
  });

  it('empty state returns query string with just event type', () => {
    const qs = serializeToUrl(baseState);
    expect(qs).toBe('?event=payment_intent.succeeded');
  });

  it('suite mode with no URL serializes to a clean address', () => {
    expect(serializeToUrl({ ...baseState, mode: 'suite' })).toBe('');
  });

  it('suite mode keeps only the target URL, never event options', () => {
    const qs = serializeToUrl({
      ...baseState,
      mode: 'suite',
      eventOptions: { amount: 5000, currency: 'eur' },
      targetUrl: 'https://example.com/hook',
    });
    expect(qs).toBe('?url=https%3A%2F%2Fexample.com%2Fhook');
  });

  it('scenario mode leaves event options out', () => {
    const qs = serializeToUrl({
      ...baseState,
      mode: 'scenario',
      selectedScenarioId: 'checkout-flow',
      eventOptions: { amount: 5000, declineCode: 'insufficient_funds' },
    });
    expect(qs).toBe('?scenario=checkout-flow');
  });

  it('round-trips event links: parse, then serialize, gives the same address', () => {
    const link = '?event=invoice.payment_failed&amount=4999&currency=eur&decline=insufficient_funds&url=https%3A%2F%2Fexample.com%2Fhook';
    const parsed = parseUrlState(new URLSearchParams(link));
    const qs = serializeToUrl({
      mode: parsed.mode,
      selectedEventType: parsed.selectedEventType ?? '',
      selectedScenarioId: parsed.selectedScenarioId ?? null,
      eventOptions: parsed.eventOptions ?? {},
      targetUrl: parsed.targetUrl ?? '',
    });
    expect(qs).toBe(link);
  });

  it('round-trips suite links', () => {
    const link = '?url=https%3A%2F%2Fexample.com%2Fhook';
    const parsed = parseUrlState(new URLSearchParams(link));
    const qs = serializeToUrl({
      mode: parsed.mode,
      selectedEventType: 'payment_intent.succeeded',
      selectedScenarioId: null,
      eventOptions: parsed.eventOptions ?? {},
      targetUrl: parsed.targetUrl ?? '',
    });
    expect(qs).toBe(link);
  });

  it('includes target URL', () => {
    const qs = serializeToUrl({
      ...baseState,
      targetUrl: 'https://example.com/webhook',
    });
    expect(qs).toContain('url=');
    expect(qs).toContain('example.com');
  });
});

describe('parseUrlState edge cases', () => {
  it('URL-encoded special chars are decoded correctly', () => {
    const params = new URLSearchParams('event=charge.succeeded&url=https%3A%2F%2Fexample.com%2Fhook');
    const state = parseUrlState(params);
    expect(state.targetUrl).toBe('https://example.com/hook');
  });

  it('XSS attempt in event param is ignored (not a valid event type)', () => {
    const params = new URLSearchParams('event=<script>alert(1)</script>');
    const state = parseUrlState(params);
    expect(state.selectedEventType).toBeUndefined();
  });

  it('multiple same params: first value wins (URLSearchParams.get behavior)', () => {
    const params = new URLSearchParams('event=charge.succeeded&event=invoice.paid');
    const state = parseUrlState(params);
    expect(state.selectedEventType).toBe('charge.succeeded');
  });

  it('livemode=True (capital T) is false (strict equality)', () => {
    const params = new URLSearchParams('event=charge.succeeded&livemode=True');
    const state = parseUrlState(params);
    expect(state.eventOptions?.livemode).toBe(false);
  });

  it('livemode=1 is false (strict equality, not truthy)', () => {
    const params = new URLSearchParams('event=charge.succeeded&livemode=1');
    const state = parseUrlState(params);
    expect(state.eventOptions?.livemode).toBe(false);
  });
});

describe('serializeToUrl/parseUrlState robustness', () => {
  it('metadata is NOT included in serialized URL', () => {
    const qs = serializeToUrl({
      mode: 'event',
      selectedEventType: 'charge.succeeded',
      selectedScenarioId: null,
      eventOptions: { metadata: { order_id: 'secret_123' } },
      targetUrl: '',
    });
    expect(qs).not.toContain('metadata');
    expect(qs).not.toContain('order_id');
    expect(qs).not.toContain('secret_123');
  });

  it('entity IDs with + char encode/decode correctly', () => {
    const params = new URLSearchParams('event=charge.succeeded&customerId=cus_abc%2Bdef');
    const state = parseUrlState(params);
    expect(state.eventOptions?.customerId).toBe('cus_abc+def');
  });
});
