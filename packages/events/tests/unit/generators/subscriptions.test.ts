// Copyright 2026 Sutyr Inc. SPDX-License-Identifier: Apache-2.0
import { describe, it, expect } from 'vitest';
import {
  subscriptionCreated,
  subscriptionUpdated,
  subscriptionDeleted,
  subscriptionTrialWillEnd,
  subscriptionPaused,
  subscriptionResumed,
} from '../../../src/generators/subscriptions.js';
import { STRIPE_API_VERSION } from '../../../src/generators/envelope.js';

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
    expect(sub.items.url).toBe(`/v1/subscription_items?subscription=${sub.id}`);
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

  it('items carry current_period_start/end (moved off Subscription in 2025-03-31.basil)', () => {
    const sub = subscriptionCreated().data.object;
    const item = sub.items.data[0]!;
    expect(sub).not.toHaveProperty('current_period_start');
    expect(sub).not.toHaveProperty('current_period_end');
    expect(item.current_period_end).toBeGreaterThan(item.current_period_start);
  });

  it('start_date equals created', () => {
    const sub = subscriptionCreated({ timestamp: 1700000000 }).data.object;
    expect(sub.start_date).toBe(1700000000);
    expect(sub.created).toBe(1700000000);
  });

  it('has correct default cancellation and trial fields', () => {
    const sub = subscriptionCreated().data.object;
    expect(sub.cancel_at_period_end).toBe(false);
    expect(sub.cancel_at).toBeNull();
    expect(sub.canceled_at).toBeNull();
    expect(sub.ended_at).toBeNull();
    expect(sub.trial_start).toBeNull();
    expect(sub.trial_end).toBeNull();
    expect(sub.cancellation_details).toEqual({ comment: null, feedback: null, reason: null });
  });

  it('billing_cycle_anchor equals the item current_period_start', () => {
    const sub = subscriptionCreated().data.object;
    expect(sub.billing_cycle_anchor).toBe(sub.items.data[0]!.current_period_start);
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
    const item = sub.items.data[0]!;
    expect(item.current_period_end).toBeGreaterThan(item.current_period_start);
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

  it('cancellation_details.reason defaults to cancellation_requested', () => {
    const sub = subscriptionDeleted().data.object;
    expect(sub.cancellation_details!.reason).toBe('cancellation_requested');
  });

  it('accepts cancellationReason option', () => {
    const sub = subscriptionDeleted({ cancellationReason: 'payment_failed' }).data.object;
    expect(sub.cancellation_details!.reason).toBe('payment_failed');
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

// ─── Trial and pause lifecycle ───────────────────────────────────────────────

const DAY = 86400;
const TS = 1_760_000_000;

describe('subscriptionTrialWillEnd', () => {
  it('produces a customer.subscription.trial_will_end event at the pinned API version', () => {
    const event = subscriptionTrialWillEnd();
    expect(event.type).toBe('customer.subscription.trial_will_end');
    expect(event.object).toBe('event');
    expect(event.id).toMatch(/^evt_/);
    expect(event.api_version).toBe(STRIPE_API_VERSION);
    expect(event.api_version).toBe('2026-09-30.endive');
    expect(event.livemode).toBe(false);
  });

  it('carries a trialing subscription with correct ID prefixes', () => {
    const sub = subscriptionTrialWillEnd().data.object;
    expect(sub.object).toBe('subscription');
    expect(sub.status).toBe('trialing');
    expect(sub.id).toMatch(/^sub_/);
    expect(sub.customer).toMatch(/^cus_/);
    expect(sub.latest_invoice).toMatch(/^in_/);
    expect(sub.items.data[0]!.id).toMatch(/^si_/);
    expect(sub.items.data[0]!.price.id).toMatch(/^price_/);
    expect(sub.items.data[0]!.price.product).toMatch(/^prod_/);
  });

  it('trial_end is three days after the event', () => {
    const event = subscriptionTrialWillEnd({ timestamp: TS });
    expect(event.created).toBe(TS);
    expect(event.data.object.trial_end).toBe(TS + 3 * DAY);
  });

  it('trial_start precedes trial_end by the trial length and matches created and start_date', () => {
    const sub = subscriptionTrialWillEnd({ timestamp: TS }).data.object;
    expect(sub.trial_start).toBe(TS + 3 * DAY - 14 * DAY);
    expect(sub.created).toBe(sub.trial_start);
    expect(sub.start_date).toBe(sub.trial_start);
  });

  it('the item period spans the trial and the billing cycle anchors at trial_end', () => {
    const sub = subscriptionTrialWillEnd({ timestamp: TS }).data.object;
    const item = sub.items.data[0]!;
    expect(item.current_period_start).toBe(sub.trial_start);
    expect(item.current_period_end).toBe(sub.trial_end);
    expect(sub.billing_cycle_anchor).toBe(sub.trial_end);
  });

  it('has no payment method by default and the default trial end behavior', () => {
    const sub = subscriptionTrialWillEnd().data.object;
    expect(sub.default_payment_method).toBeNull();
    expect(sub.trial_settings).toEqual({
      end_behavior: { billing_cycle_anchor: 'now', missing_payment_method: 'create_invoice' },
    });
  });

  it('pause_collection is null and status_details is absent', () => {
    const sub = subscriptionTrialWillEnd().data.object;
    expect(sub.pause_collection).toBeNull();
    expect(sub).not.toHaveProperty('status_details');
  });

  it('keeps cancellation fields null', () => {
    const sub = subscriptionTrialWillEnd().data.object;
    expect(sub.cancel_at_period_end).toBe(false);
    expect(sub.cancel_at).toBeNull();
    expect(sub.canceled_at).toBeNull();
    expect(sub.ended_at).toBeNull();
    expect(sub.cancellation_details).toEqual({
      comment: null,
      feedback: null,
      feedback_option: null,
      reason: null,
    });
  });

  it('does not include previous_attributes', () => {
    expect(subscriptionTrialWillEnd().data).not.toHaveProperty('previous_attributes');
  });

  it('does not put period or pre-basil fields on the subscription', () => {
    const sub = subscriptionTrialWillEnd().data.object;
    expect(sub).not.toHaveProperty('current_period_start');
    expect(sub).not.toHaveProperty('current_period_end');
    expect(sub).not.toHaveProperty('plan');
    expect(sub).not.toHaveProperty('deleted');
  });

  it('propagates IDs, amounts and trial options', () => {
    const event = subscriptionTrialWillEnd({
      timestamp: TS,
      customerId: 'cus_trial123',
      subscriptionId: 'sub_trial123',
      invoiceId: 'in_trial123',
      paymentMethodId: 'pm_trial123',
      priceAmount: 4900,
      currency: 'eur',
      interval: 'year',
      trialEnd: TS + 3600,
      trialPeriodDays: 30,
      missingPaymentMethod: 'pause',
      metadata: { plan: 'pro' },
    });
    const sub = event.data.object;
    const item = sub.items.data[0]!;
    expect(sub.id).toBe('sub_trial123');
    expect(sub.customer).toBe('cus_trial123');
    expect(sub.latest_invoice).toBe('in_trial123');
    expect(sub.default_payment_method).toBe('pm_trial123');
    expect(sub.currency).toBe('eur');
    expect(item.price.unit_amount).toBe(4900);
    expect(item.price.currency).toBe('eur');
    expect(item.price.recurring!.interval).toBe('year');
    expect(item.subscription).toBe('sub_trial123');
    expect(sub.items.url).toBe('/v1/subscription_items?subscription=sub_trial123');
    expect(sub.trial_end).toBe(TS + 3600);
    expect(sub.trial_start).toBe(TS + 3600 - 30 * DAY);
    expect(sub.trial_settings!.end_behavior.missing_payment_method).toBe('pause');
    expect(sub.metadata).toEqual({ plan: 'pro' });
  });
});

describe('subscriptionPaused', () => {
  it('produces a customer.subscription.paused event at the pinned API version', () => {
    const event = subscriptionPaused();
    expect(event.type).toBe('customer.subscription.paused');
    expect(event.object).toBe('event');
    expect(event.id).toMatch(/^evt_/);
    expect(event.api_version).toBe('2026-09-30.endive');
  });

  it('the subscription status is paused, not a pause of collection', () => {
    const sub = subscriptionPaused().data.object;
    expect(sub.object).toBe('subscription');
    expect(sub.id).toMatch(/^sub_/);
    expect(sub.customer).toMatch(/^cus_/);
    expect(sub.latest_invoice).toMatch(/^in_/);
    expect(sub.status).toBe('paused');
    expect(sub.pause_collection).toBeNull();
    expect(sub.collection_method).toBe('charge_automatically');
  });

  it('defaults to a trial that ended without a payment method', () => {
    const sub = subscriptionPaused({ timestamp: TS }).data.object;
    expect(sub.status_details).toEqual({
      paused: {
        subscription: { type: 'trial_end_without_payment_method' },
        transitioned_at: TS,
        type: 'subscription',
      },
    });
    expect(sub.default_payment_method).toBeNull();
    expect(sub.trial_end).toBe(TS);
    expect(sub.trial_start).toBe(TS - 14 * DAY);
    expect(sub.trial_settings!.end_behavior.missing_payment_method).toBe('pause');
  });

  it('a trial-end pause closes the trial period on the item', () => {
    const sub = subscriptionPaused({ timestamp: TS }).data.object;
    const item = sub.items.data[0]!;
    expect(item.current_period_start).toBe(sub.trial_start);
    expect(item.current_period_end).toBe(TS);
    expect(sub.billing_cycle_anchor).toBe(TS);
    expect(sub.created).toBe(sub.trial_start);
    expect(sub.start_date).toBe(sub.trial_start);
  });

  it('a requested pause has no trial, keeps the payment method and truncates the period', () => {
    const sub = subscriptionPaused({ timestamp: TS, pauseReason: 'pause_requested' }).data.object;
    const item = sub.items.data[0]!;
    expect(sub.status).toBe('paused');
    expect(sub.status_details!.paused.subscription.type).toBe('pause_requested');
    expect(sub.status_details!.paused.transitioned_at).toBe(TS);
    expect(sub.trial_start).toBeNull();
    expect(sub.trial_end).toBeNull();
    expect(sub.default_payment_method).toMatch(/^pm_/);
    expect(sub.trial_settings!.end_behavior.missing_payment_method).toBe('create_invoice');
    expect(item.current_period_end).toBe(TS);
    expect(item.current_period_start).toBeLessThan(TS);
  });

  it('accepts every pause reason Stripe defines', () => {
    for (const reason of [
      'final_payment_failure',
      'first_payment_failure',
      'pause_requested',
      'system',
      'trial_end_without_payment_method',
    ] as const) {
      const sub = subscriptionPaused({ pauseReason: reason }).data.object;
      expect(sub.status_details!.paused.subscription.type).toBe(reason);
      expect(sub.status_details!.paused.type).toBe('subscription');
    }
  });

  it('does not include previous_attributes', () => {
    expect(subscriptionPaused().data).not.toHaveProperty('previous_attributes');
  });

  it('keeps cancellation fields null', () => {
    const sub = subscriptionPaused().data.object;
    expect(sub.canceled_at).toBeNull();
    expect(sub.ended_at).toBeNull();
    expect(sub.cancel_at).toBeNull();
  });

  it('propagates IDs, amounts and options', () => {
    const sub = subscriptionPaused({
      customerId: 'cus_paused123',
      subscriptionId: 'sub_paused123',
      invoiceId: 'in_paused123',
      paymentMethodId: 'pm_paused123',
      priceAmount: 1500,
      currency: 'gbp',
      interval: 'week',
      trialPeriodDays: 7,
      timestamp: TS,
      metadata: { source: 'test' },
    }).data.object;
    expect(sub.id).toBe('sub_paused123');
    expect(sub.customer).toBe('cus_paused123');
    expect(sub.latest_invoice).toBe('in_paused123');
    expect(sub.default_payment_method).toBe('pm_paused123');
    expect(sub.currency).toBe('gbp');
    expect(sub.items.data[0]!.price.unit_amount).toBe(1500);
    expect(sub.items.data[0]!.price.currency).toBe('gbp');
    expect(sub.items.data[0]!.price.recurring!.interval).toBe('week');
    expect(sub.items.data[0]!.subscription).toBe('sub_paused123');
    expect(sub.trial_start).toBe(TS - 7 * DAY);
    expect(sub.metadata).toEqual({ source: 'test' });
  });

  it('accepts an explicit null payment method on a requested pause', () => {
    const sub = subscriptionPaused({ pauseReason: 'pause_requested', paymentMethodId: null }).data.object;
    expect(sub.default_payment_method).toBeNull();
  });
});

describe('subscriptionResumed', () => {
  it('produces a customer.subscription.resumed event at the pinned API version', () => {
    const event = subscriptionResumed();
    expect(event.type).toBe('customer.subscription.resumed');
    expect(event.object).toBe('event');
    expect(event.id).toMatch(/^evt_/);
    expect(event.api_version).toBe('2026-09-30.endive');
  });

  it('the subscription is active again with a payment method and a resumption invoice', () => {
    const sub = subscriptionResumed().data.object;
    expect(sub.object).toBe('subscription');
    expect(sub.id).toMatch(/^sub_/);
    expect(sub.customer).toMatch(/^cus_/);
    expect(sub.status).toBe('active');
    expect(sub.pause_collection).toBeNull();
    expect(sub.default_payment_method).toMatch(/^pm_/);
    expect(sub.latest_invoice).toMatch(/^in_/);
    expect(sub.collection_method).toBe('charge_automatically');
  });

  it('starts a new period at the resume time (billing_cycle_anchor=now)', () => {
    const sub = subscriptionResumed({ timestamp: TS }).data.object;
    const item = sub.items.data[0]!;
    expect(sub.billing_cycle_anchor).toBe(TS);
    expect(item.current_period_start).toBe(TS);
    expect(item.current_period_end).toBe(TS + 30 * DAY);
  });

  it('a yearly price gets a year-long period', () => {
    const item = subscriptionResumed({ timestamp: TS, interval: 'year' }).data.object.items.data[0]!;
    expect(item.current_period_end - item.current_period_start).toBe(365 * DAY);
  });

  it('status_details records the last pause', () => {
    const sub = subscriptionResumed({ timestamp: TS, pausedAt: TS - 2 * DAY }).data.object;
    expect(sub.status_details).toEqual({
      paused: {
        subscription: { type: 'trial_end_without_payment_method' },
        transitioned_at: TS - 2 * DAY,
        type: 'subscription',
      },
    });
  });

  it('after a trial-end pause, the past trial stays on the subscription', () => {
    const sub = subscriptionResumed({ timestamp: TS, pausedAt: TS - 7 * DAY }).data.object;
    expect(sub.trial_end).toBe(TS - 7 * DAY);
    expect(sub.trial_start).toBe(TS - 7 * DAY - 14 * DAY);
    expect(sub.created).toBe(sub.trial_start);
    expect(sub.start_date).toBe(sub.trial_start);
    expect(sub.items.data[0]!.created).toBe(sub.created);
    expect(sub.trial_settings!.end_behavior.missing_payment_method).toBe('pause');
  });

  it('after a requested pause, there is no trial', () => {
    const sub = subscriptionResumed({ pauseReason: 'pause_requested' }).data.object;
    expect(sub.trial_start).toBeNull();
    expect(sub.trial_end).toBeNull();
    expect(sub.status_details!.paused.subscription.type).toBe('pause_requested');
    expect(sub.trial_settings!.end_behavior.missing_payment_method).toBe('create_invoice');
    expect(sub.created).toBeLessThan(sub.status_details!.paused.transitioned_at);
  });

  it('does not include previous_attributes', () => {
    expect(subscriptionResumed().data).not.toHaveProperty('previous_attributes');
  });

  it('propagates IDs, amounts and options', () => {
    const sub = subscriptionResumed({
      customerId: 'cus_resumed123',
      subscriptionId: 'sub_resumed123',
      invoiceId: 'in_resumed123',
      paymentMethodId: 'pm_resumed123',
      priceAmount: 9900,
      currency: 'jpy',
      metadata: { tier: 'gold' },
    }).data.object;
    expect(sub.id).toBe('sub_resumed123');
    expect(sub.customer).toBe('cus_resumed123');
    expect(sub.latest_invoice).toBe('in_resumed123');
    expect(sub.default_payment_method).toBe('pm_resumed123');
    expect(sub.currency).toBe('jpy');
    expect(sub.items.data[0]!.price.unit_amount).toBe(9900);
    expect(sub.items.data[0]!.price.currency).toBe('jpy');
    expect(sub.items.data[0]!.subscription).toBe('sub_resumed123');
    expect(sub.metadata).toEqual({ tier: 'gold' });
  });
});

describe('trial and pause events share IDs across a lifecycle', () => {
  it('the same customer and subscription flow through trial_will_end, paused and resumed', () => {
    const ids = { customerId: 'cus_flow123', subscriptionId: 'sub_flow123' };
    const events = [
      subscriptionTrialWillEnd(ids),
      subscriptionPaused(ids),
      subscriptionResumed(ids),
    ];
    for (const event of events) {
      expect(event.data.object.id).toBe('sub_flow123');
      expect(event.data.object.customer).toBe('cus_flow123');
    }
    expect(events.map((e) => e.data.object.status)).toEqual(['trialing', 'paused', 'active']);
  });
});

// ─── Full default shape at 2026-09-30.endive ─────────────────────────────────

const PAUSE_REASONS = [
  'final_payment_failure',
  'first_payment_failure',
  'pause_requested',
  'system',
  'trial_end_without_payment_method',
] as const;

const lifecycleEvents = () => [
  subscriptionTrialWillEnd({ timestamp: TS }),
  subscriptionPaused({ timestamp: TS }),
  subscriptionPaused({ timestamp: TS, pauseReason: 'pause_requested' }),
  subscriptionResumed({ timestamp: TS }),
];

describe('trial and pause events carry the full default Subscription', () => {
  it('every default subscription field is present', () => {
    const fields = [
      'application', 'application_fee_percent', 'automatic_tax', 'billing_cycle_anchor',
      'billing_cycle_anchor_config', 'billing_mode', 'billing_schedules', 'billing_thresholds',
      'cancel_at', 'cancel_at_period_end', 'canceled_at', 'cancellation_details',
      'collection_method', 'created', 'currency', 'customer', 'customer_account',
      'days_until_due', 'default_payment_method', 'default_source', 'default_tax_rates',
      'description', 'discounts', 'ended_at', 'invoice_settings', 'items', 'latest_invoice',
      'livemode', 'managed_payments', 'metadata', 'next_pending_invoice_item_invoice',
      'on_behalf_of', 'pause_collection', 'payment_settings', 'pending_invoice_item_interval',
      'pending_setup_intent', 'pending_update', 'schedule', 'start_date', 'status',
      'test_clock', 'transfer_data', 'trial_end', 'trial_settings', 'trial_start',
    ];
    for (const event of lifecycleEvents()) {
      for (const field of fields) {
        expect(event.data.object, `${event.type} ${field}`).toHaveProperty(field);
      }
    }
  });

  it('default nested objects match what Stripe returns for an unconfigured subscription', () => {
    const sub = subscriptionPaused({ pauseReason: 'pause_requested' }).data.object;
    expect(sub.automatic_tax).toEqual({ disabled_reason: null, enabled: false, liability: null });
    expect(sub.invoice_settings).toEqual({
      account_tax_ids: null,
      custom_fields: null,
      description: null,
      footer: null,
      issuer: { type: 'self' },
    });
    expect(sub.payment_settings).toEqual({
      payment_method_options: null,
      payment_method_types: null,
      save_default_payment_method: 'off',
    });
    expect(sub.cancellation_details).toEqual({
      comment: null,
      feedback: null,
      feedback_option: null,
      reason: null,
    });
    expect(sub.discounts).toEqual([]);
    expect(sub.billing_schedules).toEqual([]);
    expect(sub.days_until_due).toBeNull();
    expect(sub.customer_account).toBeNull();
  });

  it('uses flexible billing mode, which the pause endpoint requires', () => {
    for (const event of lifecycleEvents()) {
      const sub = event.data.object;
      expect(sub.billing_mode.type).toBe('flexible');
      expect(sub.billing_mode.flexible).toEqual({ proration_discounts: 'included' });
      expect(sub.billing_mode.updated_at).toBe(sub.created);
    }
  });

  it('items and prices carry their default fields; includable ones stay absent', () => {
    for (const event of lifecycleEvents()) {
      const item = event.data.object.items.data[0]!;
      expect(item.billing_thresholds).toBeNull();
      expect(item.current_trial).toBeNull();
      expect(item.discounts).toEqual([]);
      expect(item.tax_rates).toEqual([]);
      expect(item).not.toHaveProperty('billed_until');
      expect(item).not.toHaveProperty('plan');
      const price = item.price;
      expect(price.billing_scheme).toBe('per_unit');
      expect(price.unit_amount_decimal).toBe(String(price.unit_amount));
      expect(price.tax_behavior).toBe('unspecified');
      expect(price.recurring!.meter).toBeNull();
      expect(price.metadata).toEqual({});
      expect(price.lookup_key).toBeNull();
      expect(price.nickname).toBeNull();
      expect(price.custom_unit_amount).toBeNull();
      expect(price.tiers_mode).toBeNull();
      expect(price.transform_quantity).toBeNull();
      expect(price).not.toHaveProperty('tiers');
      expect(price).not.toHaveProperty('currency_options');
    }
  });

  it('presentment_details is absent without Adaptive Pricing', () => {
    for (const event of lifecycleEvents()) {
      expect(event.data.object).not.toHaveProperty('presentment_details');
    }
  });

  it('items.url points at the subscription_items list', () => {
    for (const event of lifecycleEvents()) {
      const sub = event.data.object;
      expect(sub.items.url).toBe(`/v1/subscription_items?subscription=${sub.id}`);
    }
  });

  it('the price and item exist no later than the subscription, even with a past timestamp', () => {
    for (const event of lifecycleEvents()) {
      const sub = event.data.object;
      const item = sub.items.data[0]!;
      expect(item.price.created).toBeLessThanOrEqual(sub.created);
      expect(item.created).toBe(sub.created);
      expect(sub.created).toBeLessThan(event.created);
    }
  });
});

describe('request.id reflects what triggered the event', () => {
  it('automatic transitions have no request', () => {
    expect(subscriptionTrialWillEnd().request.id).toBeNull();
    for (const reason of ['trial_end_without_payment_method', 'system', 'first_payment_failure', 'final_payment_failure'] as const) {
      expect(subscriptionPaused({ pauseReason: reason }).request.id).toBeNull();
    }
  });

  it('a requested pause and a resume carry the request ID', () => {
    expect(subscriptionPaused({ pauseReason: 'pause_requested' }).request.id).toMatch(/^req_[A-Za-z0-9]{14}$/);
    expect(subscriptionResumed().request.id).toMatch(/^req_[A-Za-z0-9]{14}$/);
  });
});

describe('pause timelines by reason', () => {
  it('every pause ends the item period at the pause time and records it', () => {
    for (const reason of PAUSE_REASONS) {
      const sub = subscriptionPaused({ timestamp: TS, pauseReason: reason }).data.object;
      const item = sub.items.data[0]!;
      expect(item.current_period_end).toBe(TS);
      expect(item.current_period_start).toBeLessThan(TS);
      expect(sub.status_details!.paused.transitioned_at).toBe(TS);
      expect(sub.start_date).toBe(sub.created);
    }
  });

  it('a first payment failure pause lands about an hour into a renewal period', () => {
    const sub = subscriptionPaused({ timestamp: TS, pauseReason: 'first_payment_failure' }).data.object;
    const item = sub.items.data[0]!;
    expect(item.current_period_start).toBe(TS - 3600);
    // A renewal implies a full period before this one, aligned to the anchor.
    expect(sub.created).toBe(item.current_period_start - 30 * DAY);
    expect(sub.billing_cycle_anchor).toBe(sub.created);
    expect(sub.default_payment_method).toMatch(/^pm_/);
    expect(sub.trial_start).toBeNull();
  });

  it('a final payment failure pause follows at least one completed period', () => {
    const sub = subscriptionPaused({ timestamp: TS, pauseReason: 'final_payment_failure', interval: 'week' }).data.object;
    const item = sub.items.data[0]!;
    expect(item.current_period_start).toBeLessThan(TS);
    expect(sub.created).toBe(item.current_period_start - 7 * DAY);
  });

  it('resumed rebuilds the same pre-pause history as paused', () => {
    for (const reason of PAUSE_REASONS) {
      const pausedAt = TS - 5 * DAY;
      const paused = subscriptionPaused({ timestamp: pausedAt, pauseReason: reason }).data.object;
      const resumed = subscriptionResumed({ timestamp: TS, pausedAt, pauseReason: reason }).data.object;
      expect(resumed.created).toBe(paused.created);
      expect(resumed.trial_start).toBe(paused.trial_start);
      expect(resumed.trial_end).toBe(paused.trial_end);
      expect(resumed.status_details).toEqual(paused.status_details);
    }
  });

  it('resumed accepts an explicit null payment method', () => {
    const sub = subscriptionResumed({ paymentMethodId: null }).data.object;
    expect(sub.default_payment_method).toBeNull();
  });
});

describe('pause events with an unknown pause reason', () => {
  it('throws a named error instead of a TypeError', () => {
    for (const fn of [subscriptionPaused, subscriptionResumed]) {
      // Options often come from user input (CLI --set, request bodies).
      const bogus = { pauseReason: 'vacation' } as unknown as Parameters<typeof fn>[0];
      expect(() => fn(bogus)).toThrow('Unknown pause reason: vacation');
    }
  });
});
