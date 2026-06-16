// Copyright 2026 Sutyr Inc. SPDX-License-Identifier: Apache-2.0
import type {
  StripePaymentIntent,
  StripeCharge,
  StripeRefund,
  PaymentIntentSucceededOptions,
  PaymentIntentFailedOptions,
  ChargeSucceededOptions,
  ChargeRefundedOptions,
  StripeEvent,
  StripePaymentError,
  DECLINE_CODE_MAP as DeclineMap,
} from '../types/index.js';
import { DECLINE_CODE_MAP } from '../types/index.js';
import { wrapInEvent } from './envelope.js';
import {
  paymentIntentId,
  chargeId,
  customerId,
  paymentMethodId,
  refundId,
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
    invoice: null,
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
    message: entry.message,
    payment_method: {
      id: pmId,
      object: 'payment_method',
      type: 'card',
    },
    charge: null,
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
    latest_charge: null,
    last_payment_error: error,
    invoice: null,
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
    invoice: null,
    refunded: false,
    refunds: {
      object: 'list',
      data: [],
      has_more: false,
      total_count: 0,
      url: `/v1/charges/${chId}/refunds`,
    },
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

  const refund: StripeRefund = {
    id: refundId(),
    object: 'refund',
    amount: refAmount,
    status: 'succeeded',
    charge: chId,
    payment_intent: piId,
    currency,
    reason: null,
    created: ts,
  };

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
    invoice: null,
    refunded: refAmount >= amount,
    refunds: {
      object: 'list',
      data: [refund],
      has_more: false,
      total_count: 1,
      url: `/v1/charges/${chId}/refunds`,
    },
    disputed: false,
    description: null,
    receipt_email: null,
    metadata: options?.metadata ?? {},
    created: ts,
    livemode: false,
  };

  return wrapInEvent('charge.refunded', charge, { timestamp: ts });
}
