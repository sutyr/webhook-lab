// Copyright 2026 Sutyr Inc. SPDX-License-Identifier: Apache-2.0
import type {
  StripePaymentIntent,
  StripeCharge,
  PaymentIntentSucceededOptions,
  PaymentIntentFailedOptions,
  ChargeSucceededOptions,
  ChargeRefundedOptions,
  StripeEvent,
  StripePaymentError,
  DeclineCodeEntry,
} from '../types/index.js';
import type {
  StripePaymentIntentDetailed,
  StripePaymentIntentNextAction,
  StripeChargeCardDetailed,
  StripeChargeDetailed,
  StripeChargeOutcomeDetailed,
  PaymentIntentRequiresActionOptions,
  PaymentIntentCanceledOptions,
  ChargeFailedOptions,
} from '../types/payments.js';
import { DECLINE_CODE_MAP } from '../types/index.js';
import { wrapInEvent } from './envelope.js';
import {
  generateId,
  paymentIntentId,
  chargeId,
  customerId,
  paymentMethodId,
} from '../utils/ids.js';
import { now } from '../utils/timestamps.js';

// ─── payment_intent.succeeded ───────────────────────────────────────────────

export function paymentIntentSucceeded(
  options?: PaymentIntentSucceededOptions,
): StripeEvent<StripePaymentIntent> {
  const amount = options?.amount ?? 2999;
  const currency = options?.currency ?? 'usd';
  const ts = options?.timestamp ?? now();
  const cusId = options?.customerId ?? customerId();
  const pmId = options?.paymentMethodId ?? paymentMethodId();
  const chId = options?.chargeId ?? chargeId();

  const piId = options?.paymentIntentId ?? paymentIntentId();

  const pi: StripePaymentIntent = {
    id: piId,
    object: 'payment_intent',
    amount,
    amount_capturable: 0,
    amount_received: amount,
    currency,
    status: 'succeeded',
    customer: cusId,
    payment_method: pmId,
    latest_charge: chId,
    last_payment_error: null,
    description: null,
    metadata: options?.metadata ?? {},
    created: ts,
    livemode: false,
  };

  return wrapInEvent('payment_intent.succeeded', pi, { timestamp: ts });
}

// ─── payment_intent.payment_failed ──────────────────────────────────────────

export function paymentIntentPaymentFailed(
  options?: PaymentIntentFailedOptions,
): StripeEvent<StripePaymentIntent> {
  const amount = options?.amount ?? 2999;
  const currency = options?.currency ?? 'usd';
  const ts = options?.timestamp ?? now();
  const cusId = options?.customerId ?? customerId();
  const pmId = options?.paymentMethodId ?? paymentMethodId();
  // Card errors are raised by a failed Charge, so both latest_charge and
  // last_payment_error.charge reference it.
  const failedChargeId = chargeId();
  const declineKey = options?.declineCode ?? 'generic_decline';
  const entry = DECLINE_CODE_MAP[declineKey];

  if (!entry) {
    throw new Error(`Unknown decline code: ${declineKey}`);
  }

  // Build the error object. When code !== 'card_declined', decline_code must
  // be completely absent from the object — not null, not undefined as a value.
  const error: StripePaymentError = {
    type: entry.type,
    code: entry.code,
    doc_url: `https://stripe.com/docs/error-codes/${entry.code.replace(/_/g, '-')}`,
    message: entry.message,
    payment_method: {
      id: pmId,
      object: 'payment_method',
      type: 'card',
    },
    charge: failedChargeId,
  };

  if (entry.decline_code !== undefined) {
    error.decline_code = entry.decline_code;
  }

  const piId = options?.paymentIntentId ?? paymentIntentId();

  const pi: StripePaymentIntent = {
    id: piId,
    object: 'payment_intent',
    amount,
    amount_capturable: 0,
    amount_received: 0,
    currency,
    status: 'requires_payment_method',
    customer: cusId,
    payment_method: pmId,
    latest_charge: failedChargeId,
    last_payment_error: error,
    description: null,
    metadata: options?.metadata ?? {},
    created: ts,
    livemode: false,
  };

  return wrapInEvent('payment_intent.payment_failed', pi, { timestamp: ts });
}

// ─── charge.succeeded ───────────────────────────────────────────────────────

export function chargeSucceeded(
  options?: ChargeSucceededOptions,
): StripeEvent<StripeCharge> {
  const amount = options?.amount ?? 2999;
  const currency = options?.currency ?? 'usd';
  const ts = options?.timestamp ?? now();
  const cusId = options?.customerId ?? customerId();
  const piId = options?.paymentIntentId ?? paymentIntentId();
  const pmId = paymentMethodId();

  const chId = options?.chargeId ?? chargeId();

  const charge: StripeCharge = {
    id: chId,
    object: 'charge',
    amount,
    amount_captured: amount,
    amount_refunded: 0,
    captured: options?.captured ?? true,
    currency,
    status: 'succeeded',
    customer: cusId,
    payment_intent: piId,
    payment_method: pmId,
    payment_method_details: {
      type: 'card',
      card: {
        brand: options?.cardBrand ?? 'visa',
        last4: options?.cardLast4 ?? '4242',
        exp_month: 12,
        exp_year: 2027,
        funding: 'credit',
        country: 'US',
      },
    },
    outcome: {
      type: 'authorized',
      network_status: 'approved_by_network',
      reason: null,
      risk_level: 'normal',
      risk_score: 32,
      seller_message: 'Payment complete.',
    },
    paid: true,
    failure_code: null,
    failure_message: null,
    refunded: false,
    disputed: false,
    description: null,
    receipt_email: null,
    metadata: options?.metadata ?? {},
    created: ts,
    livemode: false,
  };

  return wrapInEvent('charge.succeeded', charge, { timestamp: ts });
}

// ─── charge.refunded ────────────────────────────────────────────────────────

export function chargeRefunded(
  options?: ChargeRefundedOptions,
): StripeEvent<StripeCharge> {
  const amount = options?.amount ?? 2999;
  const currency = options?.currency ?? 'usd';
  const ts = options?.timestamp ?? now();
  const cusId = options?.customerId ?? customerId();
  const piId = options?.paymentIntentId ?? paymentIntentId();
  const chId = options?.chargeId ?? chargeId();
  const pmId = paymentMethodId();
  const refAmount = options?.refundAmount ?? amount;

  // `refunds` is includable only (not returned by default since 2022-11-15),
  // so the webhook payload carries the refund total in `amount_refunded` alone.
  const charge: StripeCharge = {
    id: chId,
    object: 'charge',
    amount,
    amount_captured: amount,
    amount_refunded: refAmount,
    captured: options?.captured ?? true,
    currency,
    status: 'succeeded',
    customer: cusId,
    payment_intent: piId,
    payment_method: pmId,
    payment_method_details: {
      type: 'card',
      card: {
        brand: 'visa',
        last4: '4242',
        exp_month: 12,
        exp_year: 2027,
        funding: 'credit',
        country: 'US',
      },
    },
    outcome: {
      type: 'authorized',
      network_status: 'approved_by_network',
      reason: null,
      risk_level: 'normal',
      risk_score: 32,
      seller_message: 'Payment complete.',
    },
    paid: true,
    failure_code: null,
    failure_message: null,
    refunded: refAmount >= amount,
    disputed: false,
    description: null,
    receipt_email: null,
    metadata: options?.metadata ?? {},
    created: ts,
    livemode: false,
  };

  return wrapInEvent('charge.refunded', charge, { timestamp: ts });
}

// ─── Full PaymentIntent for the lifecycle events ────────────────────────────
// Adds the fields the shared StripePaymentIntent leaves out. The shape is a
// card PaymentIntent created with payment_method_types ['card'] and the
// default capture (automatic_async) and confirmation methods, so
// automatic_payment_methods and payment_method_configuration_details are null.

type PaymentIntentLifecycle = Pick<
  StripePaymentIntentDetailed,
  'canceled_at' | 'cancellation_reason' | 'next_action'
>;

function detailedPaymentIntent(
  pi: StripePaymentIntent,
  lifecycle: PaymentIntentLifecycle,
): StripePaymentIntentDetailed {
  return {
    ...pi,
    allowed_payment_method_types: null,
    amount_details: { tip: {} },
    application: null,
    application_fee_amount: null,
    automatic_payment_methods: null,
    canceled_at: lifecycle.canceled_at,
    cancellation_reason: lifecycle.cancellation_reason,
    capture_method: 'automatic_async',
    client_secret: `${pi.id}_secret_${generateId('', 25)}`,
    confirmation_method: 'automatic',
    customer_account: null,
    excluded_payment_method_types: null,
    managed_payments: null,
    next_action: lifecycle.next_action,
    on_behalf_of: null,
    payment_method_configuration_details: null,
    payment_method_options: {
      card: {
        installments: null,
        mandate_options: null,
        network: null,
        request_three_d_secure: 'automatic',
      },
    },
    payment_method_types: ['card'],
    payment_record: null,
    processing: null,
    receipt_email: null,
    review: null,
    setup_future_usage: null,
    shipping: null,
    statement_descriptor: null,
    statement_descriptor_suffix: null,
    transfer_data: null,
    transfer_group: null,
  };
}

// ─── payment_intent.requires_action ─────────────────────────────────────────
// 3D Secure: confirmation stops at requires_action before authorization, so
// no Charge exists yet and latest_charge stays null.

export function paymentIntentRequiresAction(
  options?: PaymentIntentRequiresActionOptions,
): StripeEvent<StripePaymentIntentDetailed> {
  const amount = options?.amount ?? 2999;
  const currency = options?.currency ?? 'usd';
  const ts = options?.timestamp ?? now();
  const cusId = options?.customerId ?? customerId();
  const pmId = options?.paymentMethodId ?? paymentMethodId();
  const piId = options?.paymentIntentId ?? paymentIntentId();
  const authUrl = `https://hooks.stripe.com/3d_secure_2/hosted?payment_intent=${piId}`;

  // `use_stripe_sdk` contents are opaque and meant for Stripe.js only.
  // `redirect_to_url` appears when a return_url was passed at confirmation.
  const nextAction: StripePaymentIntentNextAction =
    options?.nextActionType === 'redirect_to_url'
      ? {
          type: 'redirect_to_url',
          redirect_to_url: {
            return_url: options.returnUrl ?? 'https://example.com/checkout/complete',
            url: authUrl,
          },
        }
      : {
          type: 'use_stripe_sdk',
          use_stripe_sdk: {
            type: 'three_d_secure_redirect',
            stripe_js: authUrl,
          },
        };

  const pi = detailedPaymentIntent(
    {
      id: piId,
      object: 'payment_intent',
      amount,
      amount_capturable: 0,
      amount_received: 0,
      currency,
      status: 'requires_action',
      customer: cusId,
      payment_method: pmId,
      latest_charge: null,
      last_payment_error: null,
      description: null,
      metadata: options?.metadata ?? {},
      created: ts,
      livemode: false,
    },
    { canceled_at: null, cancellation_reason: null, next_action: nextAction },
  );

  return wrapInEvent('payment_intent.requires_action', pi, { timestamp: ts });
}

// ─── payment_intent.canceled ────────────────────────────────────────────────
// The event fires at cancellation (`timestamp`, which is also `canceled_at`);
// the PaymentIntent was created earlier.

const CANCELED_INTENT_AGE_SECONDS = 3600;

export function paymentIntentCanceled(
  options?: PaymentIntentCanceledOptions,
): StripeEvent<StripePaymentIntentDetailed> {
  const amount = options?.amount ?? 2999;
  const currency = options?.currency ?? 'usd';
  const ts = options?.timestamp ?? now();
  const cusId = options?.customerId ?? customerId();
  const piId = options?.paymentIntentId ?? paymentIntentId();

  // Canceling clears last_payment_error and next_action, and releases any
  // authorized amount, so amount_capturable drops to 0.
  const pi = detailedPaymentIntent(
    {
      id: piId,
      object: 'payment_intent',
      amount,
      amount_capturable: 0,
      amount_received: 0,
      currency,
      status: 'canceled',
      customer: cusId,
      payment_method: options?.paymentMethodId ?? null,
      latest_charge: options?.chargeId ?? null,
      last_payment_error: null,
      description: null,
      metadata: options?.metadata ?? {},
      created: ts - CANCELED_INTENT_AGE_SECONDS,
      livemode: false,
    },
    {
      canceled_at: ts,
      cancellation_reason: options?.cancellationReason ?? 'requested_by_customer',
      next_action: null,
    },
  );

  return wrapInEvent('payment_intent.canceled', pi, { timestamp: ts });
}

// ─── charge.failed ──────────────────────────────────────────────────────────
// A Charge has no decline_code field. The error code goes in failure_code and
// the issuer's reason in outcome.reason: insufficient_funds gives
// failure_code card_declined with outcome.reason insufficient_funds;
// expired_card gives failure_code expired_card with outcome.reason
// expired_card.

// Network and advice codes come from the issuer and are null when the network
// returns none. Values are set only where Stripe documents them
// (docs.stripe.com/declines).
const DOCUMENTED_NETWORK_CODES: Record<
  string,
  Pick<StripeChargeOutcomeDetailed, 'advice_code' | 'network_advice_code' | 'network_decline_code'>
> = {
  expired_card: {
    advice_code: 'confirm_card_data',
    network_advice_code: '03',
    network_decline_code: '54',
  },
};

function failedChargeOutcome(entry: DeclineCodeEntry): StripeChargeOutcomeDetailed {
  const reason = entry.decline_code ?? entry.code;

  // `fraudulent` is raised by Stripe Radar, so the charge is blocked before it
  // reaches the card network.
  if (reason === 'fraudulent') {
    return {
      type: 'blocked',
      network_status: 'not_sent_to_network',
      reason: 'highest_risk_level',
      risk_level: 'highest',
      risk_score: 85,
      seller_message: 'Stripe blocked this charge as too risky.',
      advice_code: 'do_not_try_again',
      network_advice_code: null,
      network_decline_code: null,
    };
  }

  const network = Object.hasOwn(DOCUMENTED_NETWORK_CODES, reason)
    ? DOCUMENTED_NETWORK_CODES[reason]!
    : { advice_code: null, network_advice_code: null, network_decline_code: null };

  return {
    type: 'issuer_declined',
    network_status: 'declined_by_network',
    reason,
    risk_level: 'normal',
    risk_score: 32,
    seller_message: `The bank returned the decline code \`${reason}\`.`,
    ...network,
  };
}

// `payment_method_details.card.network` takes these values; any other brand
// reports `unknown`.
const CARD_NETWORKS = new Set([
  'amex', 'cartes_bancaires', 'diners', 'discover', 'eftpos_au', 'interac',
  'jcb', 'link', 'mastercard', 'unionpay', 'visa',
]);

// Nothing was authorized, so the authorization fields are null. The CVC is
// checked by the issuer during authorization: it fails for incorrect_cvc and
// stays unchecked when Radar blocks the charge before it reaches the network.
function declinedCardDetails(
  brand: string,
  last4: string,
  outcome: StripeChargeOutcomeDetailed,
  failureCode: string,
): StripeChargeCardDetailed {
  let cvcCheck = 'pass';
  if (failureCode === 'incorrect_cvc') cvcCheck = 'fail';
  if (outcome.network_status === 'not_sent_to_network') cvcCheck = 'unchecked';

  return {
    amount_authorized: null,
    authorization_code: null,
    brand,
    checks: {
      address_line1_check: null,
      address_postal_code_check: null,
      cvc_check: cvcCheck,
    },
    country: 'US',
    electronic_commerce_indicator: null,
    exp_month: 12,
    exp_year: 2027,
    fingerprint: generateId('', 16),
    funding: 'credit',
    installments: null,
    last4,
    mandate: null,
    network: CARD_NETWORKS.has(brand) ? brand : 'unknown',
    network_token: { used: false },
    network_transaction_id: null,
    regulated_status: 'unregulated',
    three_d_secure: null,
    transaction_link_id: null,
    wallet: null,
  };
}

export function chargeFailed(
  options?: ChargeFailedOptions,
): StripeEvent<StripeChargeDetailed> {
  const amount = options?.amount ?? 2999;
  const currency = options?.currency ?? 'usd';
  const ts = options?.timestamp ?? now();
  const declineKey = options?.declineCode ?? 'generic_decline';

  if (!Object.hasOwn(DECLINE_CODE_MAP, declineKey)) {
    throw new Error(`Unknown decline code: ${declineKey}`);
  }
  const entry = DECLINE_CODE_MAP[declineKey]!;
  const outcome = failedChargeOutcome(entry);

  const charge: StripeChargeDetailed = {
    id: options?.chargeId ?? chargeId(),
    object: 'charge',
    amount,
    amount_captured: 0,
    amount_refunded: 0,
    application: null,
    application_fee: null,
    application_fee_amount: null,
    // A failed charge never moves funds, so neither balance transaction exists.
    balance_transaction: null,
    billing_details: {
      address: {
        city: null,
        country: null,
        line1: null,
        line2: null,
        postal_code: null,
        state: null,
      },
      email: null,
      name: null,
      phone: null,
      tax_id: null,
    },
    calculated_statement_descriptor: 'WEBHOOK LAB',
    captured: false,
    created: ts,
    currency,
    customer: options?.customerId ?? customerId(),
    description: null,
    disputed: false,
    failure_balance_transaction: null,
    failure_code: entry.code,
    failure_message: entry.message,
    fraud_details: {},
    livemode: false,
    metadata: options?.metadata ?? {},
    on_behalf_of: null,
    outcome,
    paid: false,
    payment_intent: options?.paymentIntentId ?? paymentIntentId(),
    payment_method: options?.paymentMethodId ?? paymentMethodId(),
    payment_method_details: {
      type: 'card',
      card: declinedCardDetails(
        options?.cardBrand ?? 'visa',
        options?.cardLast4 ?? '4242',
        outcome,
        entry.code,
      ),
    },
    receipt_email: null,
    receipt_number: null,
    // Stripe creates receipts for successful payments only.
    receipt_url: null,
    refunded: false,
    review: null,
    shipping: null,
    source_transfer: null,
    statement_descriptor: null,
    statement_descriptor_suffix: null,
    status: 'failed',
    transfer_data: null,
    transfer_group: null,
  };

  return wrapInEvent('charge.failed', charge, { timestamp: ts });
}
