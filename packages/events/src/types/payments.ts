// Copyright 2026 Sutyr Inc. SPDX-License-Identifier: Apache-2.0
import type {
  BaseEventOptions,
  StripeCardDetails,
  StripeCharge,
  StripeChargeOutcome,
  StripeObject,
  StripePaymentIntent,
  StripeRefund,
} from './index.js';
import type { StripeAddress, StripeBillingDetails } from './payment-methods.js';

// ─── Shared ──────────────────────────────────────────────────────────────────

export interface StripeShipping {
  address?: StripeAddress;
  carrier?: string | null;
  name?: string;
  phone?: string | null;
  tracking_number?: string | null;
}

// ─── PaymentIntent: full default shape ───────────────────────────────────────
// The shared StripePaymentIntent models a subset. This extension adds every
// other field the 2026-09-30.endive API returns by default (nullable fields
// come back as null), so lifecycle events carry the complete object.
// `hooks`, `payment_details` and `presentment_details` only appear when those
// features are used, so they are left out.

export type StripePaymentIntentCancellationReason =
  | 'abandoned'
  | 'automatic'
  | 'duplicate'
  | 'expired'
  | 'failed_invoice'
  | 'fraudulent'
  | 'requested_by_customer'
  | 'void_invoice';

export type StripePaymentIntentNextActionType = 'use_stripe_sdk' | 'redirect_to_url';

export interface StripePaymentIntentNextAction {
  /** Open-ended in the API (alipay_handle_redirect, oxxo_display_details and so on). */
  type: string;
  /** Opaque to integrations: Stripe documents its contents as intended for Stripe.js only. */
  use_stripe_sdk?: Record<string, unknown>;
  redirect_to_url?: {
    return_url: string | null;
    url: string | null;
  };
}

export interface StripePaymentIntentCardOptions {
  installments: Record<string, unknown> | null;
  mandate_options: Record<string, unknown> | null;
  network: string | null;
  request_three_d_secure: 'any' | 'automatic' | 'challenge' | null;
}

export interface StripePaymentIntentDetailed extends StripePaymentIntent {
  allowed_payment_method_types: string[] | null;
  /** Optional in the API; card PaymentIntents return `{ tip: {} }`. */
  amount_details?: { tip?: { amount?: number } };
  application: string | null;
  application_fee_amount: number | null;
  automatic_payment_methods: { allow_redirects?: 'always' | 'never'; enabled: boolean } | null;
  canceled_at: number | null;
  cancellation_reason: StripePaymentIntentCancellationReason | null;
  capture_method: 'automatic' | 'automatic_async' | 'manual';
  client_secret: string | null;
  confirmation_method: 'automatic' | 'manual';
  customer_account: string | null;
  excluded_payment_method_types: string[] | null;
  managed_payments: { enabled: boolean } | null;
  next_action: StripePaymentIntentNextAction | null;
  on_behalf_of: string | null;
  payment_method_configuration_details: { id: string; parent: string | null } | null;
  payment_method_options: { card?: StripePaymentIntentCardOptions } | null;
  payment_method_types: string[];
  payment_record: string | null;
  processing: { type: 'card'; card?: Record<string, unknown> } | null;
  receipt_email: string | null;
  review: string | null;
  setup_future_usage: 'off_session' | 'on_session' | null;
  shipping: StripeShipping | null;
  statement_descriptor: string | null;
  statement_descriptor_suffix: string | null;
  transfer_data: { amount?: number; destination: string } | null;
  transfer_group: string | null;
}

// ─── Charge: full default shape ──────────────────────────────────────────────
// Same approach as StripePaymentIntentDetailed. `presentment_details`,
// `radar_options` and `transfer` only appear when those features are used;
// `refunds` is includable only.

export type StripeChargeAdviceCode = 'confirm_card_data' | 'do_not_try_again' | 'try_again_later';

export interface StripeChargeOutcomeDetailed extends StripeChargeOutcome {
  advice_code: StripeChargeAdviceCode | null;
  network_advice_code: string | null;
  network_decline_code: string | null;
}

export interface StripeChargeCardChecks {
  address_line1_check: string | null;
  address_postal_code_check: string | null;
  cvc_check: string | null;
}

/**
 * `capture_before`, `extended_authorization`, `incremental_authorization`,
 * `multicapture` and `overcapture` describe an authorization, so they are
 * left out of declined charges.
 */
export interface StripeChargeCardDetailed extends StripeCardDetails {
  amount_authorized: number | null;
  authorization_code: string | null;
  checks: StripeChargeCardChecks | null;
  electronic_commerce_indicator: string | null;
  fingerprint: string | null;
  installments: Record<string, unknown> | null;
  mandate: string | null;
  network: string | null;
  network_token: { used: boolean } | null;
  network_transaction_id: string | null;
  regulated_status: 'regulated' | 'unregulated' | null;
  three_d_secure: Record<string, unknown> | null;
  transaction_link_id: string | null;
  wallet: Record<string, unknown> | null;
}

export interface StripeChargeDetailed extends StripeCharge {
  application: string | null;
  application_fee: string | null;
  application_fee_amount: number | null;
  balance_transaction: string | null;
  billing_details: StripeBillingDetails;
  calculated_statement_descriptor: string | null;
  failure_balance_transaction: string | null;
  fraud_details: { stripe_report?: string; user_report?: string } | null;
  on_behalf_of: string | null;
  outcome: StripeChargeOutcomeDetailed | null;
  payment_method_details: {
    type: string;
    card?: StripeChargeCardDetailed;
  };
  receipt_number: string | null;
  receipt_url: string | null;
  review: string | null;
  shipping: StripeShipping | null;
  source_transfer: string | null;
  statement_descriptor: string | null;
  statement_descriptor_suffix: string | null;
  transfer_data: { amount: number | null; destination: string } | null;
  transfer_group: string | null;
}

// ─── Refund ──────────────────────────────────────────────────────────────────

export type StripeRefundReason =
  | 'duplicate'
  | 'expired_uncaptured_charge'
  | 'fraudulent'
  | 'requested_by_customer';

export type StripeRefundPendingReason = 'charge_pending' | 'insufficient_funds' | 'processing';

/**
 * Only `type` is always present. `reference`, `reference_status` and
 * `reference_type` are optional strings (never null): they are absent until
 * Stripe has something to report.
 */
export interface StripeRefundCardDestinationDetails {
  reference?: string;
  reference_status?: 'pending' | 'available' | 'unavailable';
  reference_type?: string;
  type: 'pending' | 'refund' | 'reversal';
}

export interface StripeRefundDestinationDetails {
  type: string;
  card?: StripeRefundCardDestinationDetails;
}

/**
 * The Refund object has no `livemode` field. `description`, `failure_reason`,
 * `failure_balance_transaction`, `instructions_email`, `next_action` and
 * `presentment_details` only appear for non-card refunds or later states.
 */
export interface StripeRefundDetailed extends StripeRefund {
  reason: StripeRefundReason | null;
  balance_transaction: string | null;
  customer: string | null;
  customer_account: string | null;
  destination_details: StripeRefundDestinationDetails | null;
  metadata: Record<string, string> | null;
  payment_method: string | null;
  /** Present only while `status` is `pending`. */
  pending_reason?: StripeRefundPendingReason;
  receipt_number: string | null;
  source_transfer_reversal: string | null;
  transfer_reversal: string | null;
}

// ─── Radar Early Fraud Warning ───────────────────────────────────────────────

export type StripeEarlyFraudWarningFraudType =
  | 'card_never_received'
  | 'fraudulent_card_application'
  | 'made_with_counterfeit_card'
  | 'made_with_lost_card'
  | 'made_with_stolen_card'
  | 'misc'
  | 'unauthorized_use_of_card';

/** Has no `metadata`, `amount` or `currency` fields. */
export interface StripeEarlyFraudWarning extends StripeObject {
  object: 'radar.early_fraud_warning';
  actionable: boolean;
  charge: string;
  created: number;
  fraud_type: StripeEarlyFraudWarningFraudType;
  livemode: false;
  /** Optional, never null: absent when the charge was not created by a PaymentIntent. */
  payment_intent?: string;
}

// ─── Generator Option Types ──────────────────────────────────────────────────

export interface PaymentIntentRequiresActionOptions extends BaseEventOptions {
  amount?: number;
  currency?: string;
  customerId?: string;
  paymentIntentId?: string;
  paymentMethodId?: string;
  /** `use_stripe_sdk` (Stripe.js handles 3D Secure) or `redirect_to_url` (a return URL was supplied at confirmation). */
  nextActionType?: StripePaymentIntentNextActionType;
  /** Only used with `redirect_to_url`. */
  returnUrl?: string;
}

export interface PaymentIntentCanceledOptions extends BaseEventOptions {
  amount?: number;
  currency?: string;
  customerId?: string;
  paymentIntentId?: string;
  /** Left null when omitted: an abandoned PaymentIntent often never received a payment method. */
  paymentMethodId?: string;
  /** Sets `latest_charge` when a confirmation was attempted before cancellation. */
  chargeId?: string;
  cancellationReason?: StripePaymentIntentCancellationReason;
}

export interface ChargeFailedOptions extends BaseEventOptions {
  /** A key of DECLINE_CODE_MAP. Defaults to `generic_decline`. */
  declineCode?: string;
  amount?: number;
  currency?: string;
  customerId?: string;
  paymentIntentId?: string;
  paymentMethodId?: string;
  chargeId?: string;
  cardBrand?: string;
  cardLast4?: string;
}

export interface RefundCreatedOptions extends BaseEventOptions {
  amount?: number;
  currency?: string;
  customerId?: string;
  chargeId?: string;
  paymentIntentId?: string;
  paymentMethodId?: string;
  refundId?: string;
  reason?: StripeRefundReason;
  /** Card refunds start as `succeeded`, or `pending` while Stripe processes them. */
  status?: 'succeeded' | 'pending';
  /** Only used when `status` is `pending`. Defaults to `processing`. */
  pendingReason?: StripeRefundPendingReason;
}

export interface EarlyFraudWarningCreatedOptions extends BaseEventOptions {
  chargeId?: string;
  paymentIntentId?: string;
  earlyFraudWarningId?: string;
  fraudType?: StripeEarlyFraudWarningFraudType;
  /** False once the charge is disputed or fully refunded. */
  actionable?: boolean;
  /** Ignored: an early fraud warning has no `metadata` field. */
  metadata?: Record<string, string>;
}
