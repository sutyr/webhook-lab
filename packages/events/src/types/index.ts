// Copyright 2026 Sutyr Inc. SPDX-License-Identifier: Apache-2.0
// ─── Stripe List Wrapper ─────────────────────────────────────────────────────

export interface StripeList<T> {
  object: 'list';
  data: T[];
  has_more: boolean;
  total_count: number;
  url: string;
}

// ─── Stripe Object Base ──────────────────────────────────────────────────────

export interface StripeObject {
  id: string;
  object: string;
}

// ─── Stripe Event Envelope ───────────────────────────────────────────────────

export interface StripeEvent<T extends StripeObject = StripeObject> {
  id: string;
  object: 'event';
  api_version: string;
  created: number;
  type: string;
  livemode: boolean;
  pending_webhooks: number;
  request: {
    id: string | null;
    idempotency_key: string | null;
  };
  data: {
    object: T;
    previous_attributes?: Partial<T>;
  };
}

// ─── Payment Error ───────────────────────────────────────────────────────────

export interface StripePaymentError {
  type: 'card_error' | 'invalid_request_error' | 'api_error';
  code: string;
  decline_code?: string;
  message: string;
  payment_method?: {
    id: string;
    object: 'payment_method';
    type: string;
  };
  charge?: string | null;
}

// ─── PaymentIntent ───────────────────────────────────────────────────────────

export interface StripePaymentIntent extends StripeObject {
  object: 'payment_intent';
  amount: number;
  amount_capturable: number;
  amount_received: number;
  currency: string;
  status:
    | 'requires_payment_method'
    | 'requires_confirmation'
    | 'requires_action'
    | 'processing'
    | 'requires_capture'
    | 'canceled'
    | 'succeeded';
  customer: string | null;
  payment_method: string | null;
  latest_charge: string | null;
  last_payment_error: StripePaymentError | null;
  invoice: string | null;
  description: string | null;
  metadata: Record<string, string>;
  created: number;
  livemode: false;
}

// ─── Charge ──────────────────────────────────────────────────────────────────

export interface StripeChargeOutcome {
  type: string;
  network_status: string;
  reason: string | null;
  risk_level: string;
  risk_score: number;
  seller_message: string;
}

export interface StripeCardDetails {
  brand: string;
  last4: string;
  exp_month: number;
  exp_year: number;
  funding: string;
  country: string;
}

export interface StripeCharge extends StripeObject {
  object: 'charge';
  amount: number;
  amount_captured: number;
  amount_refunded: number;
  captured: boolean;
  currency: string;
  status: 'succeeded' | 'failed' | 'pending';
  customer: string | null;
  payment_intent: string | null;
  payment_method: string | null;
  payment_method_details: {
    type: string;
    card?: StripeCardDetails;
  };
  outcome: StripeChargeOutcome | null;
  invoice: string | null;
  refunded: boolean;
  refunds: StripeList<StripeRefund>;
  disputed: boolean;
  description: string | null;
  receipt_email: string | null;
  metadata: Record<string, string>;
  created: number;
  livemode: false;
}

// ─── Refund ──────────────────────────────────────────────────────────────────

export interface StripeRefund extends StripeObject {
  object: 'refund';
  amount: number;
  status: 'succeeded' | 'failed' | 'pending' | 'canceled';
  charge: string | null;
  payment_intent: string | null;
  currency: string;
  reason: string | null;
  created: number;
}

// ─── Invoice ─────────────────────────────────────────────────────────────────

export interface StripeInvoiceLineItem extends StripeObject {
  object: 'line_item';
  amount: number;
  currency: string;
  description: string | null;
  price: StripePrice;
  quantity: number;
  subscription: string | null;
  subscription_item: string | null;
  type: 'invoiceitem' | 'subscription';
  period: {
    start: number;
    end: number;
  };
}

export interface StripeInvoice extends StripeObject {
  object: 'invoice';
  number: string;
  paid: boolean;
  status: 'draft' | 'open' | 'paid' | 'void' | 'uncollectible';
  amount_due: number;
  amount_paid: number;
  amount_remaining: number;
  attempt_count: number;
  attempted: boolean;
  next_payment_attempt: number | null;
  subscription: string | null;
  payment_intent: string | null;
  customer: string;
  collection_method: 'charge_automatically' | 'send_invoice';
  billing_reason:
    | 'subscription_create'
    | 'subscription_cycle'
    | 'subscription_update'
    | 'subscription_threshold'
    | 'upcoming'
    | 'manual'
    | 'quote_accept'
    | null;
  currency: string;
  lines: StripeList<StripeInvoiceLineItem>;
  hosted_invoice_url: string | null;
  invoice_pdf: string | null;
  metadata: Record<string, string>;
  created: number;
  livemode: false;
}

// ─── Price ───────────────────────────────────────────────────────────────────

export interface StripePriceRecurring {
  interval: 'day' | 'week' | 'month' | 'year';
  interval_count: number;
  usage_type: 'licensed' | 'metered';
}

export interface StripePrice extends StripeObject {
  object: 'price';
  product: string;
  unit_amount: number;
  currency: string;
  recurring: StripePriceRecurring | null;
  type: 'one_time' | 'recurring';
  active: boolean;
  created: number;
  livemode: false;
}

// ─── Subscription ────────────────────────────────────────────────────────────

export interface StripeSubscriptionItem extends StripeObject {
  object: 'subscription_item';
  price: StripePrice;
  quantity: number;
  subscription: string;
  created: number;
}

export interface StripeSubscription extends StripeObject {
  object: 'subscription';
  collection_method: 'charge_automatically' | 'send_invoice';
  currency: string;
  status:
    | 'incomplete'
    | 'incomplete_expired'
    | 'trialing'
    | 'active'
    | 'past_due'
    | 'canceled'
    | 'unpaid'
    | 'paused';
  customer: string;
  items: StripeList<StripeSubscriptionItem>;
  current_period_start: number;
  current_period_end: number;
  billing_cycle_anchor: number;
  latest_invoice: string | null;
  default_payment_method: string | null;
  cancel_at_period_end: boolean;
  cancel_at: number | null;
  canceled_at: number | null;
  ended_at: number | null;
  trial_start: number | null;
  trial_end: number | null;
  metadata: Record<string, string>;
  created: number;
  livemode: false;
}

// ─── Customer ────────────────────────────────────────────────────────────────

export interface StripeCustomer extends StripeObject {
  object: 'customer';
  email: string | null;
  name: string | null;
  phone: string | null;
  balance: number;
  currency: string | null;
  delinquent: boolean;
  description: string | null;
  invoice_prefix: string;
  invoice_settings: {
    default_payment_method: string | null;
  };
  metadata: Record<string, string>;
  created: number;
  livemode: false;
}

// ─── Checkout Session ────────────────────────────────────────────────────────

export interface StripeCheckoutSession extends StripeObject {
  object: 'checkout.session';
  mode: 'payment' | 'subscription' | 'setup';
  status: 'open' | 'complete' | 'expired';
  payment_status: 'paid' | 'unpaid' | 'no_payment_required';
  payment_intent: string | null;
  subscription: string | null;
  customer: string | null;
  customer_email: string | null;
  amount_total: number | null;
  amount_subtotal: number | null;
  currency: string | null;
  success_url: string;
  cancel_url: string | null;
  url: string | null;
  expires_at: number;
  metadata: Record<string, string>;
  created: number;
  livemode: false;
}

// ─── Dispute ─────────────────────────────────────────────────────────────────

export interface StripeDispute extends StripeObject {
  object: 'dispute';
  amount: number;
  charge: string;
  payment_intent: string | null;
  currency: string;
  reason:
    | 'bank_cannot_process'
    | 'check_returned'
    | 'credit_not_processed'
    | 'customer_initiated'
    | 'debit_not_authorized'
    | 'duplicate'
    | 'fraudulent'
    | 'general'
    | 'incorrect_account_details'
    | 'insufficient_funds'
    | 'noncompliant'
    | 'product_not_received'
    | 'product_unacceptable'
    | 'subscription_canceled'
    | 'unrecognized';
  status:
    | 'warning_needs_response'
    | 'warning_under_review'
    | 'warning_closed'
    | 'needs_response'
    | 'under_review'
    | 'won'
    | 'lost';
  is_charge_refundable: boolean;
  evidence_details: {
    due_by: number | null;
    has_evidence: boolean;
    past_due: boolean;
    submission_count: number;
  };
  metadata: Record<string, string>;
  created: number;
  livemode: false;
}

// ─── Decline Code Lookup Table ───────────────────────────────────────────────
// Maps user-selectable decline reasons to correct code + decline_code pairs.
// When code is 'card_declined', decline_code is present with the issuer's reason.
// For all other codes, decline_code must be ABSENT (not null, not empty).

export interface DeclineCodeEntry {
  code: string;
  decline_code: string | undefined;
  type: 'card_error';
  message: string;
}

export const DECLINE_CODE_MAP: Record<string, DeclineCodeEntry> = {
  insufficient_funds: {
    code: 'card_declined',
    decline_code: 'insufficient_funds',
    type: 'card_error',
    message: 'Your card has insufficient funds.',
  },
  generic_decline: {
    code: 'card_declined',
    decline_code: 'generic_decline',
    type: 'card_error',
    message: 'Your card was declined.',
  },
  lost_card: {
    code: 'card_declined',
    decline_code: 'lost_card',
    type: 'card_error',
    message: 'Your card was declined.',
  },
  stolen_card: {
    code: 'card_declined',
    decline_code: 'stolen_card',
    type: 'card_error',
    message: 'Your card was declined.',
  },
  fraudulent: {
    code: 'card_declined',
    decline_code: 'fraudulent',
    type: 'card_error',
    message: 'Your card was declined.',
  },
  card_velocity_exceeded: {
    code: 'card_declined',
    decline_code: 'card_velocity_exceeded',
    type: 'card_error',
    message: 'Your card has exceeded its velocity limit.',
  },
  expired_card: {
    code: 'expired_card',
    decline_code: undefined,
    type: 'card_error',
    message: 'Your card has expired.',
  },
  incorrect_cvc: {
    code: 'incorrect_cvc',
    decline_code: undefined,
    type: 'card_error',
    message: 'Your card\'s security code is incorrect.',
  },
  processing_error: {
    code: 'processing_error',
    decline_code: undefined,
    type: 'card_error',
    message: 'An error occurred while processing your card. Try again in a little bit.',
  },
  authentication_required: {
    code: 'authentication_required',
    decline_code: undefined,
    type: 'card_error',
    message: 'Your card was declined. This transaction requires authentication.',
  },
} as const;

// ─── Generator Option Types ──────────────────────────────────────────────────

export interface BaseEventOptions {
  timestamp?: number;
  metadata?: Record<string, string>;
}

export interface PaymentIntentSucceededOptions extends BaseEventOptions {
  amount?: number;
  currency?: string;
  customerId?: string;
  paymentIntentId?: string;
  paymentMethodId?: string;
  chargeId?: string;
}

export interface PaymentIntentFailedOptions extends BaseEventOptions {
  declineCode?: string;
  amount?: number;
  currency?: string;
  customerId?: string;
  paymentIntentId?: string;
  paymentMethodId?: string;
}

export interface ChargeSucceededOptions extends BaseEventOptions {
  amount?: number;
  currency?: string;
  customerId?: string;
  paymentIntentId?: string;
  chargeId?: string;
  cardBrand?: string;
  cardLast4?: string;
  captured?: boolean;
}

export interface ChargeRefundedOptions extends BaseEventOptions {
  amount?: number;
  refundAmount?: number;
  currency?: string;
  customerId?: string;
  paymentIntentId?: string;
  chargeId?: string;
  captured?: boolean;
}

export interface InvoiceCreatedOptions extends BaseEventOptions {
  amount?: number;
  currency?: string;
  customerId?: string;
  subscriptionId?: string;
  invoiceId?: string;
  paymentIntentId?: string;
  billingReason?: 'subscription_create' | 'subscription_cycle' | 'subscription_update' | 'subscription_threshold' | 'upcoming' | 'manual' | 'quote_accept';
}

export interface InvoicePaidOptions extends BaseEventOptions {
  amount?: number;
  currency?: string;
  customerId?: string;
  subscriptionId?: string;
  invoiceId?: string;
  paymentIntentId?: string;
}

export interface InvoicePaymentFailedOptions extends BaseEventOptions {
  amount?: number;
  currency?: string;
  customerId?: string;
  subscriptionId?: string;
  invoiceId?: string;
  paymentIntentId?: string;
  attemptCount?: number;
}

export interface InvoicePaymentSucceededOptions extends BaseEventOptions {
  amount?: number;
  currency?: string;
  customerId?: string;
  subscriptionId?: string;
  invoiceId?: string;
  paymentIntentId?: string;
}

export interface SubscriptionCreatedOptions extends BaseEventOptions {
  status?: StripeSubscription['status'];
  customerId?: string;
  subscriptionId?: string;
  priceAmount?: number;
  currency?: string;
  interval?: 'day' | 'week' | 'month' | 'year';
  collectionMethod?: 'charge_automatically' | 'send_invoice';
}

export interface SubscriptionUpdatedOptions extends BaseEventOptions {
  customerId?: string;
  subscriptionId?: string;
  status?: StripeSubscription['status'];
  previousStatus?: StripeSubscription['status'];
  cancelAtPeriodEnd?: boolean;
  collectionMethod?: 'charge_automatically' | 'send_invoice';
  currency?: string;
}

export interface SubscriptionDeletedOptions extends BaseEventOptions {
  customerId?: string;
  subscriptionId?: string;
  collectionMethod?: 'charge_automatically' | 'send_invoice';
  currency?: string;
}

export interface CheckoutSessionCompletedOptions extends BaseEventOptions {
  mode?: 'payment' | 'subscription' | 'setup';
  customerId?: string;
  paymentIntentId?: string;
  subscriptionId?: string;
  amount?: number;
  currency?: string;
}

export interface CheckoutSessionExpiredOptions extends BaseEventOptions {
  mode?: 'payment' | 'subscription' | 'setup';
}

export interface CustomerCreatedOptions extends BaseEventOptions {
  email?: string;
  name?: string;
}

export interface CustomerUpdatedOptions extends BaseEventOptions {
  customerId?: string;
  email?: string;
  previousEmail?: string;
  name?: string;
}

export interface DisputeCreatedOptions extends BaseEventOptions {
  amount?: number;
  currency?: string;
  chargeId?: string;
  disputeId?: string;
  paymentIntentId?: string;
  reason?: StripeDispute['reason'];
}

export interface DisputeUpdatedOptions extends BaseEventOptions {
  amount?: number;
  currency?: string;
  chargeId?: string;
  disputeId?: string;
  paymentIntentId?: string;
  status?: StripeDispute['status'];
  previousStatus?: StripeDispute['status'];
}

export interface DisputeClosedOptions extends BaseEventOptions {
  amount?: number;
  currency?: string;
  chargeId?: string;
  disputeId?: string;
  paymentIntentId?: string;
  status?: 'won' | 'lost';
}

// ─── Scenario Types ──────────────────────────────────────────────────────────

export interface ScenarioStep {
  event: StripeEvent;
  delayMs: number;
  description: string;
}

export interface ScenarioPreset {
  id: string;
  name: string;
  description: string;
  steps: ScenarioStep[];
}

// ─── Event Catalog Types ─────────────────────────────────────────────────────

export type EventCategory =
  | 'payments'
  | 'billing'
  | 'subscriptions'
  | 'checkout'
  | 'customers'
  | 'disputes';

export type StripeEventType =
  | 'payment_intent.succeeded'
  | 'payment_intent.payment_failed'
  | 'charge.succeeded'
  | 'charge.refunded'
  | 'invoice.created'
  | 'invoice.paid'
  | 'invoice.payment_failed'
  | 'invoice.payment_succeeded'
  | 'customer.subscription.created'
  | 'customer.subscription.updated'
  | 'customer.subscription.deleted'
  | 'checkout.session.completed'
  | 'checkout.session.expired'
  | 'customer.created'
  | 'customer.updated'
  | 'charge.dispute.created'
  | 'charge.dispute.updated'
  | 'charge.dispute.closed';

export interface EventCatalogEntry {
  type: StripeEventType;
  category: EventCategory;
  name: string;
  description: string;
}

// ─── EventResult (shared data contract — consumed in Phase 2 & platform) ─────

export interface EventResult {
  event: {
    id: string;
    type: string;
    payload: object;
    timestamp: number;
  };
  delivery: {
    targetUrl: string;
    statusCode: number;
    responseBody: string;
    responseTimeMs: number;
    signatureValid: boolean;
  };
  context?: {
    organizationId: string;
    registeredEventTypes: string[];
    webhookApiVersion: string;
  } | null;
}
