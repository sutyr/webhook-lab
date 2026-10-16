// Copyright 2026 Sutyr Inc. SPDX-License-Identifier: Apache-2.0
import type {
  StripeEvent,
  StripeSubscription,
  StripeSubscriptionItem,
  StripePrice,
  StripeList,
  SubscriptionCreatedOptions,
  SubscriptionUpdatedOptions,
  SubscriptionDeletedOptions,
} from '../types/index.js';
import { wrapInEvent } from './envelope.js';
import {
  subscriptionId,
  customerId,
  subscriptionItemId,
  priceId,
  productId,
  paymentMethodId,
  invoiceId,
} from '../utils/ids.js';
import { now } from '../utils/timestamps.js';

// ─── Helpers ────────────────────────────────────────────────────────────────

function buildPrice(options?: {
  amount?: number;
  currency?: string;
  interval?: 'day' | 'week' | 'month' | 'year';
}): StripePrice {
  const timestamp = now();
  return {
    id: priceId(),
    object: 'price',
    product: productId(),
    unit_amount: options?.amount ?? 2000,
    currency: options?.currency ?? 'usd',
    recurring: {
      interval: options?.interval ?? 'month',
      interval_count: 1,
      usage_type: 'licensed',
    },
    type: 'recurring',
    active: true,
    created: timestamp,
    livemode: false,
  };
}

// Since 2025-03-31.basil, current_period_start/end live on each subscription
// item, not on the Subscription itself.
function buildSubscriptionItem(
  subId: string,
  price: StripePrice,
  periodStart: number,
): StripeSubscriptionItem {
  return {
    id: subscriptionItemId(),
    object: 'subscription_item',
    created: periodStart,
    current_period_start: periodStart,
    current_period_end: periodStart + 30 * 86400,
    metadata: {},
    price,
    quantity: 1,
    subscription: subId,
  };
}

function buildItemsList(
  subId: string,
  price: StripePrice,
  periodStart: number = now(),
): StripeList<StripeSubscriptionItem> {
  const item = buildSubscriptionItem(subId, price, periodStart);
  return {
    object: 'list',
    data: [item],
    has_more: false,
    total_count: 1,
    url: `/v1/subscriptions/${subId}/items`,
  };
}

function buildSubscription(
  overrides: Partial<StripeSubscription> & { items: StripeList<StripeSubscriptionItem> },
): StripeSubscription {
  const timestamp = now();
  const subId = overrides.id ?? subscriptionId();
  const { items, ...rest } = overrides;
  return {
    id: subId,
    object: 'subscription',
    collection_method: 'charge_automatically',
    currency: 'usd',
    status: 'active',
    customer: customerId(),
    items,
    billing_cycle_anchor: timestamp,
    latest_invoice: invoiceId(),
    default_payment_method: paymentMethodId(),
    cancel_at_period_end: false,
    cancel_at: null,
    canceled_at: null,
    cancellation_details: { comment: null, feedback: null, reason: null },
    ended_at: null,
    start_date: overrides.created ?? timestamp,
    trial_start: null,
    trial_end: null,
    metadata: {},
    created: timestamp,
    livemode: false,
    ...rest,
  };
}

// ─── Generators ─────────────────────────────────────────────────────────────

export function subscriptionCreated(
  options?: SubscriptionCreatedOptions,
): StripeEvent<StripeSubscription> {
  const subId = options?.subscriptionId ?? subscriptionId();
  const timestamp = options?.timestamp ?? now();
  const price = buildPrice({
    amount: options?.priceAmount,
    currency: options?.currency,
    interval: options?.interval,
  });
  const items = buildItemsList(subId, price, timestamp);

  const subscription = buildSubscription({
    id: subId,
    collection_method: options?.collectionMethod ?? 'charge_automatically',
    currency: options?.currency ?? 'usd',
    status: options?.status ?? 'active',
    customer: options?.customerId ?? customerId(),
    items,
    billing_cycle_anchor: timestamp,
    metadata: options?.metadata ?? {},
    created: timestamp,
  });

  return wrapInEvent('customer.subscription.created', subscription, {
    timestamp,
  });
}

export function subscriptionUpdated(
  options?: SubscriptionUpdatedOptions,
): StripeEvent<StripeSubscription> {
  const subId = options?.subscriptionId ?? subscriptionId();
  const timestamp = options?.timestamp ?? now();
  const price = buildPrice();
  const items = buildItemsList(subId, price, timestamp);

  const newStatus = options?.status ?? 'past_due';
  const previousStatus = options?.previousStatus ?? 'active';

  const subscription = buildSubscription({
    id: subId,
    collection_method: options?.collectionMethod ?? 'charge_automatically',
    currency: options?.currency ?? 'usd',
    status: newStatus,
    customer: options?.customerId ?? customerId(),
    items,
    cancel_at_period_end: options?.cancelAtPeriodEnd ?? false,
    billing_cycle_anchor: timestamp,
    metadata: options?.metadata ?? {},
    created: timestamp,
  });

  return wrapInEvent('customer.subscription.updated', subscription, {
    timestamp,
    previousAttributes: { status: previousStatus },
  });
}

export function subscriptionDeleted(
  options?: SubscriptionDeletedOptions,
): StripeEvent<StripeSubscription> {
  const subId = options?.subscriptionId ?? subscriptionId();
  const timestamp = options?.timestamp ?? now();
  const price = buildPrice();
  const items = buildItemsList(subId, price, timestamp);

  const subscription = buildSubscription({
    id: subId,
    collection_method: options?.collectionMethod ?? 'charge_automatically',
    currency: options?.currency ?? 'usd',
    status: 'canceled',
    customer: options?.customerId ?? customerId(),
    items,
    billing_cycle_anchor: timestamp,
    canceled_at: timestamp,
    cancellation_details: {
      comment: null,
      feedback: null,
      reason: options?.cancellationReason ?? 'cancellation_requested',
    },
    ended_at: timestamp,
    metadata: options?.metadata ?? {},
    created: timestamp,
  });

  return wrapInEvent('customer.subscription.deleted', subscription, {
    timestamp,
  });
}
