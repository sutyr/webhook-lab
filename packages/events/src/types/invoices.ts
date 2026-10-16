// Copyright 2026 Sutyr Inc. SPDX-License-Identifier: Apache-2.0
import type {
  BaseEventOptions,
  StripeEvent,
  StripeInvoice,
  StripeInvoiceLineItem,
  StripeList,
  StripeObject,
} from './index.js';

// ─── Invoice Lifecycle Fields ────────────────────────────────────────────────

/**
 * Open enum on `status_details.uncollectible.reason`, added in
 * 2026-09-30.endive.
 */
export type StripeInvoiceUncollectibleReason =
  | 'max_payment_attempts'
  | 'payment_not_received'
  | 'subscription_canceled'
  | 'subscription_paused'
  | 'user_forgiven';

export interface StripeInvoiceStatusDetails {
  uncollectible?: {
    /** Null when Stripe has no supported reason to report. */
    reason: StripeInvoiceUncollectibleReason | null;
  };
}

export type StripeInvoiceBillingReason = NonNullable<StripeInvoice['billing_reason']>;

/** `issuer` and `automatic_tax.liability`. `account` is present only when `type` is `account`. */
export interface StripeConnectAccountReference {
  type: 'account' | 'self';
  account?: string;
}

export interface StripeInvoiceAutomaticTax {
  disabled_reason: 'finalization_requires_location_inputs' | 'finalization_system_error' | null;
  enabled: boolean;
  liability: StripeConnectAccountReference | null;
  provider: string | null;
  status: 'complete' | 'failed' | 'requires_location_inputs' | null;
}

/**
 * Line item with the fields the shared StripeInvoiceLineItem leaves out.
 * `subscription` is not here: 2025-03-31.basil removed it in favour of
 * `parent.subscription_item_details.subscription`.
 */
export interface StripeLifecycleInvoiceLineItem extends StripeInvoiceLineItem {
  pretax_credit_amounts: Array<Record<string, unknown>> | null;
  quantity_decimal: string | null;
}

/**
 * The full Invoice as 2026-09-30.endive returns it by default. The shared
 * StripeInvoice models a subset; this adds every other default field
 * (nullable fields come back as null). Includable fields (`payments`,
 * `amount_paid_off_stripe`, `confirmation_secret`) are never in webhook
 * payloads, and `threshold_reason` only appears on `subscription_threshold`
 * invoices, so none of them are here.
 */
export interface StripeLifecycleInvoice extends StripeInvoice {
  account_country: string | null;
  account_name: string | null;
  account_tax_ids: string[] | null;
  amount_shipping: number;
  application: string | null;
  /** Always false once the invoice is `paid`, `void` or `uncollectible`. */
  auto_advance: boolean;
  automatic_tax: StripeInvoiceAutomaticTax;
  /** Null unless a draft is scheduled to finalize in the future. */
  automatically_finalizes_at: number | null;
  custom_fields: Array<Record<string, unknown>> | null;
  customer_account: string | null;
  customer_address: Record<string, unknown> | null;
  customer_email: string | null;
  customer_name: string | null;
  customer_phone: string | null;
  customer_shipping: Record<string, unknown> | null;
  customer_tax_exempt: 'exempt' | 'none' | 'reverse' | null;
  customer_tax_ids: Array<Record<string, unknown>> | null;
  default_payment_method: string | null;
  default_source: string | null;
  default_tax_rates: Array<Record<string, unknown>>;
  description: string | null;
  discounts: string[];
  /** Null unless `collection_method` is `send_invoice`. */
  due_date: number | null;
  /** Same as `status_transitions.finalized_at` unless overwritten. */
  effective_at: number | null;
  /** Null until the invoice is finalized. */
  ending_balance: number | null;
  footer: string | null;
  from_invoice: { action: string; invoice: string } | null;
  issuer: StripeConnectAccountReference;
  last_finalization_error: Record<string, unknown> | null;
  latest_revision: string | null;
  lines: StripeList<StripeLifecycleInvoiceLineItem>;
  on_behalf_of: string | null;
  payment_settings: {
    default_mandate: string | null;
    payment_method_options: Record<string, unknown> | null;
    payment_method_types: string[] | null;
  };
  post_payment_credit_notes_amount: number;
  pre_payment_credit_notes_amount: number;
  receipt_number: string | null;
  rendering: Record<string, unknown> | null;
  shipping_cost: Record<string, unknown> | null;
  shipping_details: Record<string, unknown> | null;
  starting_balance: number;
  statement_descriptor: string | null;
  /**
   * Stripe includes `status_details` only when `status` is `uncollectible`;
   * the key is absent on every other invoice.
   */
  status_details?: StripeInvoiceStatusDetails;
  subtotal_excluding_tax: number | null;
  test_clock: string | null;
  total_discount_amounts: Array<Record<string, unknown>> | null;
  total_excluding_tax: number | null;
  total_pretax_credit_amounts: Array<Record<string, unknown>> | null;
  total_taxes: Array<Record<string, unknown>> | null;
  /** When webhooks for this invoice were delivered; null on drafts and previews. */
  webhooks_delivered_at: number | null;
}

/**
 * The invoice preview carried by `invoice.upcoming`. The invoice does not
 * exist yet, so the object has no `id` key at all (not null: absent), and its
 * line items have temporary `il_tmp_` IDs.
 */
export type StripeUpcomingInvoice = Omit<StripeLifecycleInvoice, 'id'>;

/**
 * Envelope for `invoice.upcoming`. `StripeEvent<T>` requires an `id` on
 * `data.object`, which the preview does not have, so it gets its own type.
 * Stripe sends no `previous_attributes` on this event.
 */
export interface StripeUpcomingInvoiceEvent
  extends Omit<StripeEvent<StripeLifecycleInvoice>, 'data'> {
  data: {
    object: StripeUpcomingInvoice;
  };
}

// ─── Invoice Payment ─────────────────────────────────────────────────────────
// Links an invoice to the payment that settles it. Since 2025-03-31.basil this
// is the only place the Invoice to PaymentIntent link lives.

export interface StripeInvoicePaymentAssociatedPayment {
  type: 'charge' | 'payment_intent' | 'payment_record';
  /** Present only when `type` is `charge` (a charge with no PaymentIntent). */
  charge?: string;
  /** Present only when `type` is `payment_intent`. */
  payment_intent?: string;
  /** Present only when `type` is `payment_record`. */
  payment_record?: string;
}

export interface StripeInvoicePayment extends StripeObject {
  object: 'invoice_payment';
  /** Null until the payment is `paid`. */
  amount_paid: number | null;
  amount_requested: number;
  created: number;
  currency: string;
  invoice: string;
  is_default: boolean;
  livemode: false;
  payment: StripeInvoicePaymentAssociatedPayment;
  status: 'open' | 'paid' | 'canceled';
  status_transitions: {
    canceled_at: number | null;
    paid_at: number | null;
  };
}

// ─── Generator Option Types ──────────────────────────────────────────────────

export interface InvoiceUpcomingOptions extends BaseEventOptions {
  amount?: number;
  currency?: string;
  customerId?: string;
  subscriptionId?: string;
  /**
   * When the subscription renews and the real invoice will be created.
   * Defaults to 7 days after the event timestamp.
   */
  periodEnd?: number;
}

export interface InvoiceFinalizedOptions extends BaseEventOptions {
  amount?: number;
  currency?: string;
  customerId?: string;
  subscriptionId?: string;
  invoiceId?: string;
  billingReason?: 'subscription_create' | 'subscription_cycle' | 'subscription_update';
  collectionMethod?: StripeInvoice['collection_method'];
  /** Only used with `send_invoice`. Defaults to 30 days after finalization. */
  dueDate?: number;
}

export interface InvoicePaymentActionRequiredOptions extends BaseEventOptions {
  amount?: number;
  currency?: string;
  customerId?: string;
  subscriptionId?: string;
  invoiceId?: string;
  /**
   * `subscription_create` (default) is the first payment at sign-up;
   * `subscription_cycle` is an off-session renewal that needs authentication.
   */
  billingReason?: 'subscription_create' | 'subscription_cycle';
  attemptCount?: number;
}

export interface InvoiceMarkedUncollectibleOptions extends BaseEventOptions {
  amount?: number;
  currency?: string;
  customerId?: string;
  subscriptionId?: string;
  invoiceId?: string;
  /** Pass null for an invoice Stripe has no supported reason for. */
  reason?: StripeInvoiceUncollectibleReason | null;
  collectionMethod?: StripeInvoice['collection_method'];
  attemptCount?: number;
}

export interface InvoiceOverdueOptions extends BaseEventOptions {
  amount?: number;
  currency?: string;
  customerId?: string;
  subscriptionId?: string;
  invoiceId?: string;
  /**
   * No `subscription_update`: Stripe turns `auto_advance` off on those
   * invoices, and automations (which send `invoice.overdue`) only run on
   * invoices with `auto_advance` on.
   */
  billingReason?: 'subscription_create' | 'subscription_cycle';
  /** Must be before the event timestamp. Defaults to 1 day before it. */
  dueDate?: number;
}

export interface InvoiceVoidedOptions extends BaseEventOptions {
  amount?: number;
  currency?: string;
  customerId?: string;
  subscriptionId?: string;
  invoiceId?: string;
  /**
   * Defaults to `subscription_create`: Stripe voids the first invoice when an
   * incomplete subscription expires after 23 hours.
   */
  billingReason?: 'subscription_create' | 'subscription_cycle' | 'subscription_update';
  collectionMethod?: StripeInvoice['collection_method'];
  attemptCount?: number;
}

/** `metadata` is ignored: InvoicePayment has no metadata field. */
export interface InvoicePaymentPaidOptions extends BaseEventOptions {
  /** Sets `amount_requested`, and `amount_paid` unless `amountPaid` is given. */
  amount?: number;
  /** Can be lower than `amount` when the PaymentIntent covers several invoices. */
  amountPaid?: number;
  currency?: string;
  invoiceId?: string;
  invoicePaymentId?: string;
  paymentType?: 'payment_intent' | 'charge';
  paymentIntentId?: string;
  /** Only used when `paymentType` is `charge`. */
  chargeId?: string;
  isDefault?: boolean;
}
