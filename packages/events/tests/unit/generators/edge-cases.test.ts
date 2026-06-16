// Copyright 2026 Sutyr Inc. SPDX-License-Identifier: Apache-2.0

import { describe, it, expect } from 'vitest';
import {
  paymentIntentSucceeded,
  chargeSucceeded,
  invoiceCreated,
  invoicePaid,
  subscriptionCreated,
  checkoutSessionCompleted,
  customerCreated,
} from '../../../src/generators/index.js';

describe('generator edge cases: amount boundaries', () => {
  it('accepts amount = 0 (valid for trial invoices)', () => {
    const event = invoiceCreated({ amount: 0 });
    const obj = event.data.object as unknown as Record<string, unknown>;
    expect(obj.amount_due).toBe(0);
    const json = JSON.stringify(event);
    expect(() => JSON.parse(json)).not.toThrow();
  });

  it('accepts very large amounts without overflow', () => {
    const event = paymentIntentSucceeded({ amount: 99999999 });
    const obj = event.data.object as unknown as Record<string, unknown>;
    expect(obj.amount).toBe(99999999);
    const json = JSON.stringify(event);
    expect(json).toContain('99999999');
  });

  it('accepts amount = 1 (minimum non-zero)', () => {
    const event = chargeSucceeded({ amount: 1 });
    const obj = event.data.object as unknown as Record<string, unknown>;
    expect(obj.amount).toBe(1);
  });
});

describe('generator edge cases: currency handling', () => {
  it('passes through any currency string without validation', () => {
    // Generators are payload factories, not validators.
    // Users may want to test their handlers with unusual currencies.
    const event = paymentIntentSucceeded({ currency: 'xyz' });
    const obj = event.data.object as unknown as Record<string, unknown>;
    expect(obj.currency).toBe('xyz');
  });

  it('defaults to usd when no currency specified', () => {
    const event = paymentIntentSucceeded();
    const obj = event.data.object as unknown as Record<string, unknown>;
    expect(obj.currency).toBe('usd');
  });
});

describe('generator edge cases: JSON serialization safety', () => {
  it('all generators produce valid JSON with no undefined values', () => {
    const generators = [
      () => paymentIntentSucceeded(),
      () => chargeSucceeded(),
      () => invoiceCreated(),
      () => invoicePaid(),
      () => subscriptionCreated(),
      () => checkoutSessionCompleted(),
      () => customerCreated(),
    ];

    for (const gen of generators) {
      const event = gen();
      const json = JSON.stringify(event);

      // JSON.stringify drops undefined, so round-tripping should be lossless
      const parsed = JSON.parse(json);
      expect(JSON.stringify(parsed)).toBe(json);

      // No "undefined" strings in the output
      expect(json).not.toContain(':undefined');
      expect(json).not.toContain('"undefined"');
    }
  });

  it('event envelope always has required top-level fields', () => {
    const event = paymentIntentSucceeded();
    expect(event).toHaveProperty('id');
    expect(event).toHaveProperty('object', 'event');
    expect(event).toHaveProperty('type');
    expect(event).toHaveProperty('created');
    expect(event).toHaveProperty('livemode', false);
    expect(event).toHaveProperty('data');
    expect(event).toHaveProperty('data.object');
  });
});

describe('generator edge cases: custom options passthrough', () => {
  it('custom metadata is preserved on customer', () => {
    const event = customerCreated({ metadata: { plan: 'enterprise' } });
    const obj = event.data.object as unknown as Record<string, unknown>;
    const meta = obj.metadata as Record<string, string>;
    expect(meta.plan).toBe('enterprise');
  });

  it('custom timestamp is used in event envelope', () => {
    const ts = 1700000000;
    const event = paymentIntentSucceeded({ timestamp: ts });
    expect(event.created).toBe(ts);
  });
});

describe('generator edge cases: negative and extreme amounts', () => {
  it('accepts negative amount (generators are factories, not validators)', () => {
    const event = paymentIntentSucceeded({ amount: -1 });
    const obj = event.data.object as unknown as Record<string, unknown>;
    expect(obj.amount).toBe(-1);
    expect(() => JSON.stringify(event)).not.toThrow();
  });

  it('accepts Number.MAX_SAFE_INTEGER without precision loss', () => {
    const event = paymentIntentSucceeded({ amount: Number.MAX_SAFE_INTEGER });
    const obj = event.data.object as unknown as Record<string, unknown>;
    expect(obj.amount).toBe(Number.MAX_SAFE_INTEGER);
  });

  it('accepts empty string currency', () => {
    const event = paymentIntentSucceeded({ currency: '' });
    const obj = event.data.object as unknown as Record<string, unknown>;
    expect(obj.currency).toBe('');
  });

  it('accepts empty metadata object', () => {
    const event = customerCreated({ metadata: {} });
    const obj = event.data.object as unknown as Record<string, unknown>;
    expect(obj.metadata).toEqual({});
  });

  it('accepts empty cardBrand and cardLast4', () => {
    const event = chargeSucceeded({ cardBrand: '', cardLast4: '' });
    const obj = event.data.object as unknown as Record<string, unknown>;
    const details = obj.payment_method_details as Record<string, unknown>;
    const card = details.card as Record<string, unknown>;
    expect(card.brand).toBe('');
    expect(card.last4).toBe('');
  });

  it('chargeSucceeded with captured: false has correct fields', () => {
    const event = chargeSucceeded({ captured: false });
    const obj = event.data.object as unknown as Record<string, unknown>;
    expect(obj.captured).toBe(false);
  });
});
