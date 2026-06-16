// Copyright 2026 Sutyr Inc. SPDX-License-Identifier: Apache-2.0
import { describe, it, expect } from 'vitest';
import { wrapInEvent, STRIPE_API_VERSION } from '../../../src/generators/envelope.js';

describe('STRIPE_API_VERSION', () => {
  it('is a non-empty string', () => {
    expect(typeof STRIPE_API_VERSION).toBe('string');
    expect(STRIPE_API_VERSION.length).toBeGreaterThan(0);
  });

  it('matches current Stripe API version', () => {
    expect(STRIPE_API_VERSION).toBe('2025-10-29.clover');
  });
});

describe('wrapInEvent', () => {
  const mockObject = {
    id: 'cus_test123',
    object: 'customer' as const,
    email: 'test@example.com',
  };

  it('returns an object with object: "event"', () => {
    const event = wrapInEvent('customer.created', mockObject);
    expect(event.object).toBe('event');
  });

  it('sets the correct api_version', () => {
    const event = wrapInEvent('customer.created', mockObject);
    expect(event.api_version).toBe(STRIPE_API_VERSION);
  });

  it('generates an id starting with evt_', () => {
    const event = wrapInEvent('customer.created', mockObject);
    expect(event.id.startsWith('evt_')).toBe(true);
  });

  it('sets the type to the passed string', () => {
    const event = wrapInEvent('customer.created', mockObject);
    expect(event.type).toBe('customer.created');
  });

  it('wraps the object in data.object', () => {
    const event = wrapInEvent('customer.created', mockObject);
    expect(event.data.object).toBe(mockObject);
  });

  it('sets livemode to false', () => {
    const event = wrapInEvent('customer.created', mockObject);
    expect(event.livemode).toBe(false);
  });

  it('sets pending_webhooks to 1', () => {
    const event = wrapInEvent('customer.created', mockObject);
    expect(event.pending_webhooks).toBe(1);
  });

  it('sets request.id and request.idempotency_key to null by default', () => {
    const event = wrapInEvent('customer.created', mockObject);
    expect(event.request.id).toBeNull();
    expect(event.request.idempotency_key).toBeNull();
  });

  it('does not include previous_attributes when not provided', () => {
    const event = wrapInEvent('customer.created', mockObject);
    expect(event.data.previous_attributes).toBeUndefined();
  });

  it('includes previous_attributes when provided', () => {
    const prev = { email: 'old@example.com' };
    const event = wrapInEvent('customer.updated', mockObject, {
      previousAttributes: prev,
    });
    expect(event.data.previous_attributes).toEqual(prev);
  });

  it('uses custom timestamp when provided', () => {
    const ts = 1700000000;
    const event = wrapInEvent('customer.created', mockObject, { timestamp: ts });
    expect(event.created).toBe(ts);
  });

  it('uses current time when timestamp is not provided', () => {
    const before = Math.floor(Date.now() / 1000);
    const event = wrapInEvent('customer.created', mockObject);
    const after = Math.floor(Date.now() / 1000);
    expect(event.created).toBeGreaterThanOrEqual(before);
    expect(event.created).toBeLessThanOrEqual(after);
  });

  it('allows custom requestId and idempotencyKey', () => {
    const event = wrapInEvent('customer.created', mockObject, {
      requestId: 'req_test',
      idempotencyKey: 'idem_test',
    });
    expect(event.request.id).toBe('req_test');
    expect(event.request.idempotency_key).toBe('idem_test');
  });
});
