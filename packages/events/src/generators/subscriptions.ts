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
import type {
  StripeSubscriptionWithTrialAndPause,
  StripeSubscriptionItemDetailed,
  StripePriceDetailed,
  StripeSubscriptionTrialSettings,
  StripeSubscriptionStatusDetails,
  StripeSubscriptionPauseReason,
  SubscriptionTrialWillEndOptions,
  SubscriptionPausedOptions,
  SubscriptionResumedOptions,
} from '../types/subscriptions.js';
import { wrapInEvent } from './envelope.js';
import {
  generateId,
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

// Stripe points `items.url` at the subscription_items list filtered by
// subscription, not at a path under /v1/subscriptions.
function itemsList<T extends StripeSubscriptionItem>(subId: string, item: T): StripeList<T> {
  return {
    object: 'list',
    data: [item],
    has_more: false,
    total_count: 1,
    url: `/v1/subscription_items?subscription=${subId}`,
  };
}

function buildItemsList(
  subId: string,
  price: StripePrice,
  periodStart: number = now(),
): StripeList<StripeSubscriptionItem> {
  return itemsList(subId, buildSubscriptionItem(subId, price, periodStart));
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

// ─── Trial and Pause Lifecycle ──────────────────────────────────────────────
// trial_will_end, paused and resumed carry every Subscription field Stripe
// returns by default at 2026-09-30.endive. They carry no
// data.previous_attributes: Stripe sends those only on *.updated events, and a
// customer.subscription.updated event accompanies each pause and resume.
// `pause_collection` stays null on all three: pausing collection never changes
// the status to `paused`.

type BillingInterval = 'day' | 'week' | 'month' | 'year';
type MissingPaymentMethod =
  StripeSubscriptionTrialSettings['end_behavior']['missing_payment_method'];

const HOUR_SECONDS = 3600;
const DAY_SECONDS = 86400;
const DEFAULT_TRIAL_DAYS = 14;
const TRIAL_WILL_END_LEAD_SECONDS = 3 * DAY_SECONDS;

const INTERVAL_SECONDS: Record<BillingInterval, number> = {
  day: DAY_SECONDS,
  week: 7 * DAY_SECONDS,
  month: 30 * DAY_SECONDS,
  year: 365 * DAY_SECONDS,
};

/** Stripe request IDs: `req_` and 14 alphanumerics. */
const requestId = (): string => generateId('req_', 14);

function buildDetailedPrice(
  created: number,
  options: { amount?: number; currency?: string; interval?: BillingInterval },
): StripePriceDetailed {
  const unitAmount = options.amount ?? 2000;
  return {
    id: priceId(),
    object: 'price',
    active: true,
    billing_scheme: 'per_unit',
    // A price exists no later than the subscription that bills it.
    created,
    currency: options.currency ?? 'usd',
    custom_unit_amount: null,
    livemode: false,
    lookup_key: null,
    metadata: {},
    nickname: null,
    product: productId(),
    recurring: {
      interval: options.interval ?? 'month',
      interval_count: 1,
      meter: null,
      usage_type: 'licensed',
    },
    tax_behavior: 'unspecified',
    tiers_mode: null,
    transform_quantity: null,
    type: 'recurring',
    unit_amount: unitAmount,
    unit_amount_decimal: String(unitAmount),
  };
}

function buildDetailedItems(
  subId: string,
  price: StripePriceDetailed,
  period: { created: number; start: number; end: number },
): StripeList<StripeSubscriptionItemDetailed> {
  return itemsList(subId, {
    id: subscriptionItemId(),
    object: 'subscription_item',
    billing_thresholds: null,
    created: period.created,
    current_period_end: period.end,
    current_period_start: period.start,
    // Set only for trial offers. These events model a subscription-level trial.
    current_trial: null,
    discounts: [],
    metadata: {},
    price,
    quantity: 1,
    subscription: subId,
    tax_rates: [],
  });
}

interface LifecycleSubscriptionFields {
  id: string;
  customer: string;
  currency: string;
  status: StripeSubscription['status'];
  items: StripeList<StripeSubscriptionItemDetailed>;
  billingCycleAnchor: number;
  created: number;
  latestInvoice: string;
  defaultPaymentMethod: string | null;
  trialStart: number | null;
  trialEnd: number | null;
  missingPaymentMethod: MissingPaymentMethod;
  metadata: Record<string, string>;
  statusDetails?: StripeSubscriptionStatusDetails;
}

function buildLifecycleSubscription(
  fields: LifecycleSubscriptionFields,
): StripeSubscriptionWithTrialAndPause {
  return {
    id: fields.id,
    object: 'subscription',
    application: null,
    application_fee_percent: null,
    automatic_tax: { disabled_reason: null, enabled: false, liability: null },
    billing_cycle_anchor: fields.billingCycleAnchor,
    billing_cycle_anchor_config: null,
    // Pausing through the API requires flexible billing mode, the default for
    // subscriptions created at 2025-09-30.clover and later.
    billing_mode: {
      flexible: { proration_discounts: 'included' },
      type: 'flexible',
      updated_at: fields.created,
    },
    billing_schedules: [],
    billing_thresholds: null,
    cancel_at: null,
    cancel_at_period_end: false,
    canceled_at: null,
    cancellation_details: { comment: null, feedback: null, feedback_option: null, reason: null },
    collection_method: 'charge_automatically',
    created: fields.created,
    currency: fields.currency,
    customer: fields.customer,
    customer_account: null,
    days_until_due: null,
    default_payment_method: fields.defaultPaymentMethod,
    default_source: null,
    default_tax_rates: [],
    description: null,
    discounts: [],
    ended_at: null,
    invoice_settings: {
      account_tax_ids: null,
      custom_fields: null,
      description: null,
      footer: null,
      issuer: { type: 'self' },
    },
    items: fields.items,
    latest_invoice: fields.latestInvoice,
    livemode: false,
    managed_payments: null,
    metadata: fields.metadata,
    next_pending_invoice_item_invoice: null,
    on_behalf_of: null,
    pause_collection: null,
    payment_settings: {
      payment_method_options: null,
      payment_method_types: null,
      save_default_payment_method: 'off',
    },
    pending_invoice_item_interval: null,
    pending_setup_intent: null,
    pending_update: null,
    schedule: null,
    start_date: fields.created,
    status: fields.status,
    // Absent, not null, until the subscription has paused.
    ...(fields.statusDetails !== undefined ? { status_details: fields.statusDetails } : {}),
    test_clock: null,
    transfer_data: null,
    trial_end: fields.trialEnd,
    trial_settings: {
      end_behavior: {
        billing_cycle_anchor: 'now',
        missing_payment_method: fields.missingPaymentMethod,
      },
    },
    trial_start: fields.trialStart,
  };
}

function pausedStatusDetails(
  reason: StripeSubscriptionPauseReason,
  transitionedAt: number,
): StripeSubscriptionStatusDetails {
  return {
    paused: {
      subscription: { type: reason },
      transitioned_at: transitionedAt,
      type: 'subscription',
    },
  };
}

interface PauseTimeline {
  /** When the subscription was created; also its billing_cycle_anchor. */
  created: number;
  /** Start of the item period that the pause cut short at `pausedAt`. */
  periodStart: number;
  trialStart: number | null;
  trialEnd: number | null;
}

// Every pause ends the item's current period at the pause time. What came
// before depends on why it paused.
function pauseTimeline(
  reason: StripeSubscriptionPauseReason,
  pausedAt: number,
  interval: BillingInterval,
  trialDays: number,
): PauseTimeline {
  const intervalSeconds = INTERVAL_SECONDS[interval];
  switch (reason) {
    case 'trial_end_without_payment_method': {
      // The trial was the first and only period.
      const trialStart = pausedAt - trialDays * DAY_SECONDS;
      return { created: trialStart, periodStart: trialStart, trialStart, trialEnd: pausedAt };
    }
    case 'first_payment_failure': {
      // A renewal invoice is first charged about an hour into its period, so
      // at least one full period came before it.
      const periodStart = pausedAt - HOUR_SECONDS;
      return {
        created: periodStart - intervalSeconds,
        periodStart,
        trialStart: null,
        trialEnd: null,
      };
    }
    case 'final_payment_failure': {
      // Retries on a renewal invoice ran out partway through its period.
      const periodStart = pausedAt - Math.floor(intervalSeconds / 2);
      return {
        created: periodStart - intervalSeconds,
        periodStart,
        trialStart: null,
        trialEnd: null,
      };
    }
    case 'pause_requested':
    case 'system': {
      // Paused partway through the first period.
      const periodStart = pausedAt - Math.floor(intervalSeconds / 2);
      return { created: periodStart, periodStart, trialStart: null, trialEnd: null };
    }
    default:
      // Options can come from user input; refuse an unknown reason by name,
      // as an unknown decline code is.
      throw new Error(`Unknown pause reason: ${String(reason)}`);
  }
}

// Sent three days before trial_end, or at once when a trial is ended early.
export function subscriptionTrialWillEnd(
  options?: SubscriptionTrialWillEndOptions,
): StripeEvent<StripeSubscriptionWithTrialAndPause> {
  const subId = options?.subscriptionId ?? subscriptionId();
  const timestamp = options?.timestamp ?? now();
  const trialEnd = options?.trialEnd ?? timestamp + TRIAL_WILL_END_LEAD_SECONDS;
  const trialStart =
    trialEnd - (options?.trialPeriodDays ?? DEFAULT_TRIAL_DAYS) * DAY_SECONDS;
  const currency = options?.currency ?? 'usd';
  const price = buildDetailedPrice(trialStart, {
    amount: options?.priceAmount,
    currency,
    interval: options?.interval,
  });

  const subscription = buildLifecycleSubscription({
    id: subId,
    customer: options?.customerId ?? customerId(),
    currency,
    status: 'trialing',
    // While trialing, the item's current period is the trial itself.
    items: buildDetailedItems(subId, price, {
      created: trialStart,
      start: trialStart,
      end: trialEnd,
    }),
    // A trial anchors the billing cycle to the moment the trial ends.
    billingCycleAnchor: trialEnd,
    created: trialStart,
    latestInvoice: options?.invoiceId ?? invoiceId(),
    defaultPaymentMethod:
      options?.paymentMethodId !== undefined ? options.paymentMethodId : null,
    trialStart,
    trialEnd,
    missingPaymentMethod: options?.missingPaymentMethod ?? 'create_invoice',
    metadata: options?.metadata ?? {},
  });

  // Fired by Stripe's trial clock, not by an API request.
  return wrapInEvent('customer.subscription.trial_will_end', subscription, {
    timestamp,
  });
}

// Sent when the status becomes `paused`: a trial ended without a payment method
// (trial_settings.end_behavior.missing_payment_method=pause), the pause
// endpoint was called, or a renewal payment failed with automatic pausing on.
export function subscriptionPaused(
  options?: SubscriptionPausedOptions,
): StripeEvent<StripeSubscriptionWithTrialAndPause> {
  const subId = options?.subscriptionId ?? subscriptionId();
  const timestamp = options?.timestamp ?? now();
  const reason = options?.pauseReason ?? 'trial_end_without_payment_method';
  const fromTrial = reason === 'trial_end_without_payment_method';
  const interval = options?.interval ?? 'month';
  const currency = options?.currency ?? 'usd';
  const timeline = pauseTimeline(
    reason,
    timestamp,
    interval,
    options?.trialPeriodDays ?? DEFAULT_TRIAL_DAYS,
  );
  const price = buildDetailedPrice(timeline.created, {
    amount: options?.priceAmount,
    currency,
    interval,
  });

  const subscription = buildLifecycleSubscription({
    id: subId,
    customer: options?.customerId ?? customerId(),
    currency,
    status: 'paused',
    items: buildDetailedItems(subId, price, {
      created: timeline.created,
      start: timeline.periodStart,
      end: timestamp,
    }),
    billingCycleAnchor: fromTrial ? timestamp : timeline.created,
    created: timeline.created,
    // With the default invoicing_behavior=pending_invoice_item, pausing creates
    // no invoice, so this is the trial invoice or the unpaid renewal invoice.
    latestInvoice: options?.invoiceId ?? invoiceId(),
    defaultPaymentMethod:
      options?.paymentMethodId !== undefined
        ? options.paymentMethodId
        : fromTrial
          ? null
          : paymentMethodId(),
    trialStart: timeline.trialStart,
    trialEnd: timeline.trialEnd,
    missingPaymentMethod: fromTrial ? 'pause' : 'create_invoice',
    metadata: options?.metadata ?? {},
    statusDetails: pausedStatusDetails(reason, timestamp),
  });

  // Only pause_requested comes from an API or Dashboard request; the other
  // reasons are automatic, so request.id stays null.
  return wrapInEvent('customer.subscription.paused', subscription, {
    timestamp,
    requestId: reason === 'pause_requested' ? requestId() : undefined,
  });
}

// Sent when a `paused` subscription becomes `active` again. When resuming
// creates an invoice, that happens only once the invoice is paid or marked
// uncollectible.
export function subscriptionResumed(
  options?: SubscriptionResumedOptions,
): StripeEvent<StripeSubscriptionWithTrialAndPause> {
  const subId = options?.subscriptionId ?? subscriptionId();
  const timestamp = options?.timestamp ?? now();
  const reason = options?.pauseReason ?? 'trial_end_without_payment_method';
  const fromTrial = reason === 'trial_end_without_payment_method';
  const pausedAt = options?.pausedAt ?? timestamp - 7 * DAY_SECONDS;
  const interval = options?.interval ?? 'month';
  const currency = options?.currency ?? 'usd';
  const timeline = pauseTimeline(
    reason,
    pausedAt,
    interval,
    options?.trialPeriodDays ?? DEFAULT_TRIAL_DAYS,
  );
  const price = buildDetailedPrice(timeline.created, {
    amount: options?.priceAmount,
    currency,
    interval,
  });

  const subscription = buildLifecycleSubscription({
    id: subId,
    customer: options?.customerId ?? customerId(),
    currency,
    status: 'active',
    // Resume defaults to billing_cycle_anchor=now, so a new period starts at
    // the resume time.
    items: buildDetailedItems(subId, price, {
      created: timeline.created,
      start: timestamp,
      end: timestamp + INTERVAL_SECONDS[interval],
    }),
    billingCycleAnchor: timestamp,
    created: timeline.created,
    latestInvoice: options?.invoiceId ?? invoiceId(),
    defaultPaymentMethod:
      options?.paymentMethodId !== undefined ? options.paymentMethodId : paymentMethodId(),
    // Trial timestamps stay on the subscription after the trial is over.
    trialStart: timeline.trialStart,
    trialEnd: timeline.trialEnd,
    missingPaymentMethod: fromTrial ? 'pause' : 'create_invoice',
    metadata: options?.metadata ?? {},
    // Describes the last transition to `paused`, so it outlives the pause.
    statusDetails: pausedStatusDetails(reason, pausedAt),
  });

  // Resuming goes through the resume endpoint, or the payment request that
  // settles the resumption invoice.
  return wrapInEvent('customer.subscription.resumed', subscription, {
    timestamp,
    requestId: requestId(),
  });
}
