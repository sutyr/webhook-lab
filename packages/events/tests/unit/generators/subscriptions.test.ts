// Copyright 2026 Sutyr Inc. SPDX-License-Identifier: Apache-2.0
import { describe, it, expect } from 'vitest';
import {
  subscriptionCreated,
  subscriptionUpdated,
  subscriptionDeleted,
} from '../../../src/generators/subscriptions.js';

describe('subscriptionCreated', () => {
  it('produces a customer.subscription.created event', () => {
    const event = subscriptionCreated();
    expect(event.type).toBe('customer.subscription.created');
    expect(event.object).toBe('event');
    expect(event.id).toMatch(/^evt_/);
  });

  it('has a subscription object with correct shape', () => {
    const sub = subscriptionCreated().data.object;
    expect(sub.object).toBe('subscription');
    expect(sub.id).toMatch(/^sub_/);
    expect(sub.customer).toMatch(/^cus_/);
    expect(sub.status).toBe('active');
  });

  it('items.data is non-empty with Stripe List wrapper', () => {
    const sub = subscriptionCreated().data.object;
    expect(sub.items.object).toBe('list');
    expect(sub.items.data.length).toBeGreaterThan(0);
    expect(sub.items.has_more).toBe(false);
    expect(sub.items.total_count).toBe(1);
    expect(sub.items.url).toMatch(/^\/v1\/subscriptions\/sub_.*\/items$/);
  });

  it('each item has price.recurring with interval, interval_count, unit_amount', () => {
    const item = subscriptionCreated().data.object.items.data[0]!;
    expect(item.object).toBe('subscription_item');
    expect(item.id).toMatch(/^si_/);
    expect(item.price.object).toBe('price');
    expect(item.price.recurring).not.toBeNull();
    expect(item.price.recurring!.interval).toBe('month');
    expect(item.price.recurring!.interval_count).toBe(1);
    expect(item.price.unit_amount).toBe(2000);
  });

  it('current_period_end > current_period_start', () => {
    const sub = subscriptionCreated().data.object;
    expect(sub.current_period_end).toBeGreaterThan(sub.current_period_start);
  });

  it('has correct default cancellation and trial fields', () => {
    const sub = subscriptionCreated().data.object;
    expect(sub.cancel_at_period_end).toBe(false);
    expect(sub.cancel_at).toBeNull();
    expect(sub.canceled_at).toBeNull();
    expect(sub.ended_at).toBeNull();
    expect(sub.trial_start).toBeNull();
    expect(sub.trial_end).toBeNull();
  });

  it('billing_cycle_anchor equals current_period_start', () => {
    const sub = subscriptionCreated().data.object;
    expect(sub.billing_cycle_anchor).toBe(sub.current_period_start);
  });

  it('has collection_method: charge_automatically by default', () => {
    const sub = subscriptionCreated().data.object;
    expect(sub.collection_method).toBe('charge_automatically');
  });

  it('accepts collectionMethod: send_invoice option', () => {
    const sub = subscriptionCreated({ collectionMethod: 'send_invoice' }).data.object;
    expect(sub.collection_method).toBe('send_invoice');
  });

  it('has currency: usd by default', () => {
    const sub = subscriptionCreated().data.object;
    expect(sub.currency).toBe('usd');
  });

  it('accepts currency option', () => {
    const sub = subscriptionCreated({ currency: 'eur' }).data.object;
    expect(sub.currency).toBe('eur');
  });

  it('respects custom options', () => {
    const event = subscriptionCreated({
      status: 'trialing',
      priceAmount: 5000,
      currency: 'eur',
      interval: 'year',
      customerId: 'cus_custom123',
    });
    const sub = event.data.object;
    expect(sub.status).toBe('trialing');
    expect(sub.customer).toBe('cus_custom123');
    expect(sub.items.data[0]!.price.unit_amount).toBe(5000);
    expect(sub.items.data[0]!.price.currency).toBe('eur');
    expect(sub.items.data[0]!.price.recurring!.interval).toBe('year');
  });
});

describe('subscriptionUpdated', () => {
  it('produces a customer.subscription.updated event', () => {
    const event = subscriptionUpdated();
    expect(event.type).toBe('customer.subscription.updated');
    expect(event.object).toBe('event');
  });

  it('has previous_attributes in data', () => {
    const event = subscriptionUpdated();
    expect(event.data.previous_attributes).toBeDefined();
    expect(event.data.previous_attributes!.status).toBe('active');
  });

  it('subscription object has the new status', () => {
    const sub = subscriptionUpdated().data.object;
    expect(sub.status).toBe('past_due');
  });

  it('respects custom status and previousStatus', () => {
    const event = subscriptionUpdated({
      status: 'canceled',
      previousStatus: 'past_due',
    });
    expect(event.data.object.status).toBe('canceled');
    expect(event.data.previous_attributes!.status).toBe('past_due');
  });

  it('has valid subscription structure', () => {
    const sub = subscriptionUpdated().data.object;
    expect(sub.object).toBe('subscription');
    expect(sub.id).toMatch(/^sub_/);
    expect(sub.items.object).toBe('list');
    expect(sub.items.data.length).toBeGreaterThan(0);
    expect(sub.current_period_end).toBeGreaterThan(sub.current_period_start);
  });
});

describe('subscriptionDeleted', () => {
  it('produces a customer.subscription.deleted event', () => {
    const event = subscriptionDeleted();
    expect(event.type).toBe('customer.subscription.deleted');
    expect(event.object).toBe('event');
  });

  it('status is canceled', () => {
    const sub = subscriptionDeleted().data.object;
    expect(sub.status).toBe('canceled');
  });

  it('canceled_at is a number', () => {
    const sub = subscriptionDeleted().data.object;
    expect(typeof sub.canceled_at).toBe('number');
    expect(sub.canceled_at).toBeGreaterThan(0);
  });

  it('ended_at is a number', () => {
    const sub = subscriptionDeleted().data.object;
    expect(typeof sub.ended_at).toBe('number');
    expect(sub.ended_at).toBeGreaterThan(0);
  });

  it('has valid subscription structure', () => {
    const sub = subscriptionDeleted().data.object;
    expect(sub.object).toBe('subscription');
    expect(sub.id).toMatch(/^sub_/);
    expect(sub.items.object).toBe('list');
    expect(sub.items.data.length).toBeGreaterThan(0);
    expect(sub.items.data[0]!.price.recurring).not.toBeNull();
  });

  it('respects custom customerId', () => {
    const sub = subscriptionDeleted({ customerId: 'cus_test456' }).data.object;
    expect(sub.customer).toBe('cus_test456');
  });
});

describe('subscriptionCreated edge cases', () => {
  it('accepts status: trialing', () => {
    const sub = subscriptionCreated({ status: 'trialing' }).data.object;
    expect(sub.status).toBe('trialing');
  });

  it('accepts collectionMethod: send_invoice', () => {
    const sub = subscriptionCreated({ collectionMethod: 'send_invoice' }).data.object;
    expect(sub.collection_method).toBe('send_invoice');
  });

  it('accepts empty string customerId', () => {
    const sub = subscriptionCreated({ customerId: '' }).data.object;
    expect(sub.customer).toBe('');
  });
});
