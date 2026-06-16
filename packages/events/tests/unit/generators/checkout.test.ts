// Copyright 2026 Sutyr Inc. SPDX-License-Identifier: Apache-2.0
import { describe, it, expect } from 'vitest';
import { checkoutSessionCompleted, checkoutSessionExpired } from '../../../src/generators/checkout.js';

describe('checkoutSessionCompleted', () => {
  it('returns a checkout.session.completed event', () => {
    const event = checkoutSessionCompleted();
    expect(event.type).toBe('checkout.session.completed');
  });

  it('wraps the session in data.object', () => {
    const event = checkoutSessionCompleted();
    expect(event.data.object.object).toBe('checkout.session');
  });

  it('has status complete and payment_status paid', () => {
    const event = checkoutSessionCompleted();
    expect(event.data.object.status).toBe('complete');
    expect(event.data.object.payment_status).toBe('paid');
  });

  it('defaults mode to payment', () => {
    const event = checkoutSessionCompleted();
    expect(event.data.object.mode).toBe('payment');
  });

  it('generates a session id starting with cs_', () => {
    const event = checkoutSessionCompleted();
    expect(event.data.object.id.startsWith('cs_')).toBe(true);
  });

  it('sets payment_intent for payment mode', () => {
    const event = checkoutSessionCompleted({ mode: 'payment' });
    expect(event.data.object.payment_intent).not.toBeNull();
    expect(event.data.object.payment_intent!.startsWith('pi_')).toBe(true);
    expect(event.data.object.subscription).toBeNull();
  });

  it('sets subscription for subscription mode', () => {
    const event = checkoutSessionCompleted({ mode: 'subscription' });
    expect(event.data.object.subscription).not.toBeNull();
    expect(event.data.object.subscription!.startsWith('sub_')).toBe(true);
    expect(event.data.object.payment_intent).toBeNull();
  });

  it('sets customer id starting with cus_', () => {
    const event = checkoutSessionCompleted();
    expect(event.data.object.customer).not.toBeNull();
    expect(event.data.object.customer!.startsWith('cus_')).toBe(true);
  });

  it('uses custom amount and currency', () => {
    const event = checkoutSessionCompleted({ amount: 5000, currency: 'eur' });
    expect(event.data.object.amount_total).toBe(5000);
    expect(event.data.object.amount_subtotal).toBe(5000);
    expect(event.data.object.currency).toBe('eur');
  });

  it('accepts a custom customerId', () => {
    const event = checkoutSessionCompleted({ customerId: 'cus_custom123' });
    expect(event.data.object.customer).toBe('cus_custom123');
  });

  it('uses custom timestamp', () => {
    const ts = 1700000000;
    const event = checkoutSessionCompleted({ timestamp: ts });
    expect(event.created).toBe(ts);
    expect(event.data.object.created).toBe(ts);
  });

  it('sets success_url and cancel_url', () => {
    const event = checkoutSessionCompleted();
    expect(event.data.object.success_url).toBe('https://example.com/success');
    expect(event.data.object.cancel_url).toBe('https://example.com/cancel');
  });

  it('sets livemode to false', () => {
    const event = checkoutSessionCompleted();
    expect(event.data.object.livemode).toBe(false);
    expect(event.livemode).toBe(false);
  });

  it('defaults metadata to empty object', () => {
    const event = checkoutSessionCompleted();
    expect(event.data.object.metadata).toEqual({});
  });

  it('accepts custom metadata', () => {
    const event = checkoutSessionCompleted({ metadata: { order: '123' } });
    expect(event.data.object.metadata).toEqual({ order: '123' });
  });
});

describe('checkoutSessionExpired', () => {
  it('returns a checkout.session.expired event', () => {
    const event = checkoutSessionExpired();
    expect(event.type).toBe('checkout.session.expired');
  });

  it('has status expired and payment_status unpaid', () => {
    const event = checkoutSessionExpired();
    expect(event.data.object.status).toBe('expired');
    expect(event.data.object.payment_status).toBe('unpaid');
  });

  it('defaults mode to payment', () => {
    const event = checkoutSessionExpired();
    expect(event.data.object.mode).toBe('payment');
  });

  it('accepts subscription mode', () => {
    const event = checkoutSessionExpired({ mode: 'subscription' });
    expect(event.data.object.mode).toBe('subscription');
  });

  it('generates a session id starting with cs_', () => {
    const event = checkoutSessionExpired();
    expect(event.data.object.id.startsWith('cs_')).toBe(true);
  });

  it('sets payment_intent and subscription to null', () => {
    const event = checkoutSessionExpired();
    expect(event.data.object.payment_intent).toBeNull();
    expect(event.data.object.subscription).toBeNull();
  });

  it('sets customer to null', () => {
    const event = checkoutSessionExpired();
    expect(event.data.object.customer).toBeNull();
  });

  it('sets amount fields to null', () => {
    const event = checkoutSessionExpired();
    expect(event.data.object.amount_total).toBeNull();
    expect(event.data.object.amount_subtotal).toBeNull();
    expect(event.data.object.currency).toBeNull();
  });

  it('sets livemode to false', () => {
    const event = checkoutSessionExpired();
    expect(event.data.object.livemode).toBe(false);
  });

  it('generates an event id starting with evt_', () => {
    const event = checkoutSessionExpired();
    expect(event.id.startsWith('evt_')).toBe(true);
  });
});

describe('checkoutSessionCompleted mode variants', () => {
  it('mode: subscription has subscription field non-null and payment_intent null', () => {
    const event = checkoutSessionCompleted({ mode: 'subscription' });
    expect(event.data.object.subscription).not.toBeNull();
    expect(event.data.object.subscription).toMatch(/^sub_/);
    expect(event.data.object.payment_intent).toBeNull();
  });

  it('mode: setup has both payment_intent and subscription null', () => {
    const event = checkoutSessionCompleted({ mode: 'setup' });
    expect(event.data.object.payment_intent).toBeNull();
    expect(event.data.object.subscription).toBeNull();
  });
});
