// Copyright 2026 Sutyr Inc. SPDX-License-Identifier: Apache-2.0

import { describe, it, expect } from 'vitest';
import { parseUrlState, serializeToUrl } from '@/lib/url-state';

describe('parseUrlState', () => {
  it('event param sets selectedEventType, mode, activeTab, drillCategory', () => {
    const params = new URLSearchParams('event=invoice.payment_failed');
    const state = parseUrlState(params);
    expect(state.selectedEventType).toBe('invoice.payment_failed');
    expect(state.mode).toBe('event');
    expect(state.activeTab).toBe('events');
    expect(state.drillCategory).toBe('billing');
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

  it('unknown event type ignored', () => {
    const params = new URLSearchParams('event=totally.fake.event');
    const state = parseUrlState(params);
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
