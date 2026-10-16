// Copyright 2026 Sutyr Inc. SPDX-License-Identifier: Apache-2.0
import type {
  BaseEventOptions,
  StripeCustomer,
  StripeList,
  StripePrice,
  StripePriceRecurring,
  StripeSubscription,
  StripeSubscriptionCancellationReason,
  StripeSubscriptionItem,
} from './index.js';

// ─── Price and Subscription Item: full default shape ─────────────────────────
// The shared StripePrice and StripeSubscriptionItem model a subset. The trial
// and pause events carry every field Stripe returns by default at
// 2026-09-30.endive. Includable fields (price `currency_options` and `tiers`,
// item `billed_until`) are not returned by default and stay absent.

export interface StripePriceDetailed extends StripePrice {
  billing_scheme: 'per_unit' | 'tiered';
  custom_unit_amount: {
    maximum: number | null;
    minimum: number | null;
    preset: number | null;
  } | null;
  lookup_key: string | null;
  metadata: Record<string, string>;
  nickname: string | null;
  recurring: (StripePriceRecurring & { meter: string | null }) | null;
  tax_behavior: 'exclusive' | 'inclusive' | 'unspecified' | null;
  tiers_mode: 'graduated' | 'volume' | null;
  transform_quantity: { divide_by: number; round: 'down' | 'up' } | null;
  unit_amount_decimal: string | null;
}

/** Set on an item that is on a trial offer. Null for a subscription-level trial. */
export interface StripeSubscriptionItemCurrentTrial {
  end_date: number;
  start_date: number;
  trial_offer: string;
}

export interface StripeSubscriptionItemDetailed extends StripeSubscriptionItem {
  billing_thresholds: { usage_gte: number | null } | null;
  current_trial: StripeSubscriptionItemCurrentTrial | null;
  /** Discount IDs, expandable. */
  discounts: string[];
  price: StripePriceDetailed;
  tax_rates: Array<Record<string, unknown>> | null;
}

// ─── Subscription: trial and pause state ─────────────────────────────────────

/**
 * Pausing payment collection. Not the same as `status: 'paused'`: while
 * collection is paused the status is unchanged and invoices keep being created.
 */
export interface StripeSubscriptionPauseCollection {
  behavior: 'keep_as_draft' | 'mark_uncollectible' | 'void';
  resumes_at: number | null;
}

export interface StripeSubscriptionTrialSettings {
  end_behavior: {
    billing_cycle_anchor: 'now' | 'unchanged' | null;
    missing_payment_method: 'cancel' | 'create_invoice' | 'pause';
  };
}

/** `status_details.paused.subscription.type`: why the subscription paused. */
export type StripeSubscriptionPauseReason =
  | 'final_payment_failure'
  | 'first_payment_failure'
  | 'pause_requested'
  | 'system'
  | 'trial_end_without_payment_method';

/**
 * Added in 2026-09-30.endive with the pause endpoint. `paused` describes the
 * last transition to `paused`, so it stays after the subscription resumes.
 */
export interface StripeSubscriptionStatusDetails {
  paused: {
    subscription: {
      type: StripeSubscriptionPauseReason;
    };
    transitioned_at: number;
    type: 'subscription';
  };
}

/** Pausing through the API requires `flexible`, the default since 2025-09-30.clover. */
export interface StripeSubscriptionBillingMode {
  flexible: { proration_discounts: 'included' | 'itemized' } | null;
  type: 'classic' | 'flexible';
  updated_at?: number;
}

/**
 * A Subscription with every field Stripe returns by default at
 * 2026-09-30.endive. `presentment_details` (Adaptive Pricing only) and
 * `status_details` (only once the subscription has paused) are absent
 * otherwise, not null.
 */
export interface StripeSubscriptionWithTrialAndPause extends StripeSubscription {
  application: string | null;
  application_fee_percent: number | null;
  automatic_tax: {
    disabled_reason: 'requires_location_inputs' | null;
    enabled: boolean;
    liability: { type: 'account' | 'self'; account?: string } | null;
  };
  billing_cycle_anchor_config: {
    day_of_month: number;
    hour: number | null;
    minute: number | null;
    month: number | null;
    second: number | null;
  } | null;
  billing_mode: StripeSubscriptionBillingMode;
  billing_schedules: Array<Record<string, unknown>>;
  billing_thresholds: {
    amount_gte: number | null;
    reset_billing_cycle_anchor: boolean | null;
  } | null;
  cancellation_details: {
    comment: string | null;
    feedback: string | null;
    /** Billing feedback option ID, added in 2026-09-30.endive. */
    feedback_option: string | null;
    reason: StripeSubscriptionCancellationReason | null;
  } | null;
  customer_account: string | null;
  /** Null when `collection_method` is `charge_automatically`. */
  days_until_due: number | null;
  default_source: string | null;
  default_tax_rates: Array<Record<string, unknown>> | null;
  description: string | null;
  /** Discount IDs, expandable. */
  discounts: string[];
  invoice_settings: {
    account_tax_ids: string[] | null;
    custom_fields: Array<{ name: string; value: string }> | null;
    description: string | null;
    footer: string | null;
    issuer: { type: 'account' | 'self'; account?: string };
  };
  items: StripeList<StripeSubscriptionItemDetailed>;
  managed_payments: Record<string, unknown> | null;
  next_pending_invoice_item_invoice: number | null;
  on_behalf_of: string | null;
  pause_collection: StripeSubscriptionPauseCollection | null;
  payment_settings: {
    payment_method_options: Record<string, unknown> | null;
    payment_method_types: string[] | null;
    save_default_payment_method: 'off' | 'on_subscription' | null;
  } | null;
  pending_invoice_item_interval: {
    interval: 'day' | 'week' | 'month' | 'year';
    interval_count: number;
  } | null;
  pending_setup_intent: string | null;
  pending_update: Record<string, unknown> | null;
  schedule: string | null;
  /** Absent until the subscription has transitioned to `paused`. */
  status_details?: StripeSubscriptionStatusDetails;
  test_clock: string | null;
  transfer_data: { amount_percent: number | null; destination: string } | null;
  trial_settings: StripeSubscriptionTrialSettings | null;
}

// ─── Generator Option Types ──────────────────────────────────────────────────

type BillingInterval = 'day' | 'week' | 'month' | 'year';

export interface SubscriptionTrialWillEndOptions extends BaseEventOptions {
  customerId?: string;
  subscriptionId?: string;
  /** `latest_invoice`: the zero amount invoice created when the trial started. */
  invoiceId?: string;
  /** `default_payment_method`. Defaults to null: no payment method collected yet. */
  paymentMethodId?: string | null;
  priceAmount?: number;
  currency?: string;
  interval?: BillingInterval;
  /** Defaults to three days after the event timestamp. */
  trialEnd?: number;
  /** Trial length in days, used to derive `trial_start`. Defaults to 14. */
  trialPeriodDays?: number;
  /** `trial_settings.end_behavior.missing_payment_method`. Defaults to create_invoice. */
  missingPaymentMethod?: StripeSubscriptionTrialSettings['end_behavior']['missing_payment_method'];
}

export interface SubscriptionPausedOptions extends BaseEventOptions {
  customerId?: string;
  subscriptionId?: string;
  /**
   * `latest_invoice`. A trial-end pause keeps the zero amount trial invoice, a
   * payment failure pause keeps the unpaid renewal invoice.
   */
  invoiceId?: string;
  /**
   * `default_payment_method`. Defaults to null when the trial ended without a
   * payment method, otherwise to a generated `pm_` ID.
   */
  paymentMethodId?: string | null;
  priceAmount?: number;
  currency?: string;
  interval?: BillingInterval;
  /** Defaults to trial_end_without_payment_method. */
  pauseReason?: StripeSubscriptionPauseReason;
  /** Trial length in days when the pause follows a trial. Defaults to 14. */
  trialPeriodDays?: number;
}

export interface SubscriptionResumedOptions extends BaseEventOptions {
  customerId?: string;
  subscriptionId?: string;
  /** `latest_invoice`: the paid resumption invoice. */
  invoiceId?: string;
  /**
   * `default_payment_method`. Defaults to a generated `pm_` ID. Pass null when
   * the payment method lives on the customer instead.
   */
  paymentMethodId?: string | null;
  priceAmount?: number;
  currency?: string;
  interval?: BillingInterval;
  /** Why the subscription had paused. Defaults to trial_end_without_payment_method. */
  pauseReason?: StripeSubscriptionPauseReason;
  /** When the subscription paused. Defaults to seven days before the event. */
  pausedAt?: number;
  /** Trial length in days when the pause followed a trial. Defaults to 14. */
  trialPeriodDays?: number;
}

// ─── Customer: full default shape ────────────────────────────────────────────
// Includable fields (`cash_balance`, `invoice_credit_balance`, `sources`,
// `subscriptions`, `tax`, `tax_ids`) are not returned by default and stay
// absent.

export interface StripeCustomerAddress {
  city: string | null;
  country: string | null;
  line1: string | null;
  line2: string | null;
  postal_code: string | null;
  state: string | null;
}

export interface StripeCustomerDetailed extends StripeCustomer {
  address: StripeCustomerAddress | null;
  /** Present only when set. */
  business_name?: string;
  customer_account: string | null;
  default_source: string | null;
  discount: Record<string, unknown> | null;
  /** Present only when set. */
  individual_name?: string;
  invoice_settings: {
    custom_fields: Array<{ name: string; value: string }> | null;
    default_payment_method: string | null;
    footer: string | null;
    rendering_options: {
      amount_tax_display: string | null;
      template: string | null;
    } | null;
  };
  /** Omitted when the account uses account level invoice numbering. */
  next_invoice_sequence?: number;
  preferred_locales: string[] | null;
  shipping: {
    address: StripeCustomerAddress;
    carrier: string | null;
    name: string;
    phone: string | null;
    tracking_number: string | null;
  } | null;
  tax_exempt: 'exempt' | 'none' | 'reverse' | null;
  test_clock: string | null;
}

export interface CustomerDeletedOptions extends BaseEventOptions {
  customerId?: string;
  email?: string | null;
  name?: string | null;
  /** Set once the customer has been billed. Defaults to null. */
  currency?: string | null;
}
