// Copyright 2026 Sutyr Inc. SPDX-License-Identifier: Apache-2.0

import { describe, it, expect } from 'vitest';
import { POST } from '@/app/api/preview/route';

function makeRequest(body: unknown): Request {
  return new Request('http://localhost/api/preview', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/preview', () => {
  it('returns a generated payload with correct event envelope for a valid eventType', async () => {
    const request = makeRequest({ eventType: 'payment_intent.succeeded', eventOptions: {} });
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.id).toMatch(/^evt_/);
    expect(data.object).toBe('event');
    expect(data.type).toBe('payment_intent.succeeded');
    expect(data.data).toBeDefined();
    expect(data.data.object).toBeDefined();
  });

  it('returns 400 with error message for unknown eventType', async () => {
    const request = makeRequest({ eventType: 'totally.made.up', eventOptions: {} });
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error.code).toBe('UNKNOWN_EVENT_TYPE');
    expect(data.error.message).toBe('Unknown event type');
  });

  it('returns 400 when eventType is missing', async () => {
    const request = makeRequest({ eventOptions: {} });
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error.code).toBe('UNKNOWN_EVENT_TYPE');
  });

  it('returns correct event type in data.object for payment_intent.succeeded', async () => {
    const request = makeRequest({ eventType: 'payment_intent.succeeded', eventOptions: {} });
    const response = await POST(request);
    const data = await response.json();

    expect(data.type).toBe('payment_intent.succeeded');
    expect(data.data.object).toBeDefined();
    // The data.object inside the event should be a payment_intent
    expect(data.data.object.object).toBe('payment_intent');
  });

  it('passes eventOptions through (e.g. amount: 5000)', async () => {
    const request = makeRequest({
      eventType: 'payment_intent.succeeded',
      eventOptions: { amount: 5000 },
    });
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.data.object.amount).toBe(5000);
  });

  // ─── Livemode override ──────────────────────────────────────────────────────

  it('defaults livemode to false on envelope and inner object', async () => {
    const request = makeRequest({
      eventType: 'payment_intent.succeeded',
      eventOptions: {},
    });
    const response = await POST(request);
    const data = await response.json();

    expect(data.livemode).toBe(false);
    expect(data.data.object.livemode).toBe(false);
  });

  it('livemode: true propagates to both envelope and inner object', async () => {
    const request = makeRequest({
      eventType: 'payment_intent.succeeded',
      eventOptions: { livemode: true },
    });
    const response = await POST(request);
    const data = await response.json();

    expect(data.livemode).toBe(true);
    expect(data.data.object.livemode).toBe(true);
  });

  // ─── API version override ──────────────────────────────────────────────────

  it('defaults api_version to STRIPE_API_VERSION constant', async () => {
    const request = makeRequest({
      eventType: 'payment_intent.succeeded',
      eventOptions: {},
    });
    const response = await POST(request);
    const data = await response.json();

    expect(data.api_version).toBe('2025-10-29.clover');
  });

  it('custom apiVersion overrides api_version on envelope', async () => {
    const request = makeRequest({
      eventType: 'payment_intent.succeeded',
      eventOptions: { apiVersion: '2023-10-16' },
    });
    const response = await POST(request);
    const data = await response.json();

    expect(data.api_version).toBe('2023-10-16');
    // Inner object should NOT have api_version (Stripe doesn't set it there)
    expect(data.data.object.api_version).toBeUndefined();
  });

  it('empty apiVersion string falls back to default', async () => {
    const request = makeRequest({
      eventType: 'payment_intent.succeeded',
      eventOptions: { apiVersion: '' },
    });
    const response = await POST(request);
    const data = await response.json();

    expect(data.api_version).toBe('2025-10-29.clover');
  });

  // ─── All 18 event types ──────────────────────────────────────────────────

  const EVENT_TYPE_TO_OBJECT: Record<string, string> = {
    'payment_intent.succeeded': 'payment_intent',
    'payment_intent.payment_failed': 'payment_intent',
    'charge.succeeded': 'charge',
    'charge.refunded': 'charge',
    'invoice.created': 'invoice',
    'invoice.paid': 'invoice',
    'invoice.payment_failed': 'invoice',
    'invoice.payment_succeeded': 'invoice',
    'customer.subscription.created': 'subscription',
    'customer.subscription.updated': 'subscription',
    'customer.subscription.deleted': 'subscription',
    'checkout.session.completed': 'checkout.session',
    'checkout.session.expired': 'checkout.session',
    'customer.created': 'customer',
    'customer.updated': 'customer',
    'charge.dispute.created': 'dispute',
    'charge.dispute.updated': 'dispute',
    'charge.dispute.closed': 'dispute',
  };

  it.each(Object.entries(EVENT_TYPE_TO_OBJECT))(
    'generates valid event for %s with data.object.object = %s',
    async (eventType, objectType) => {
      const request = makeRequest({ eventType, eventOptions: {} });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.type).toBe(eventType);
      expect(data.id).toMatch(/^evt_/);
      expect(data.object).toBe('event');
      expect(data.data.object.object).toBe(objectType);
    },
  );
});
