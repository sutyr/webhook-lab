// Copyright 2026 Sutyr Inc. SPDX-License-Identifier: Apache-2.0
import { describe, it, expect } from 'vitest';
import {
  paymentIntentSucceeded,
  paymentIntentPaymentFailed,
  chargeSucceeded,
  chargeRefunded,
  paymentIntentRequiresAction,
  paymentIntentCanceled,
  chargeFailed,
} from '../../../src/generators/payments.js';
import { STRIPE_API_VERSION } from '../../../src/generators/envelope.js';
import { DECLINE_CODE_MAP } from '../../../src/types/index.js';
import type { StripePaymentIntentDetailed } from '../../../src/types/payments.js';

// ─── paymentIntentSucceeded ─────────────────────────────────────────────────

describe('paymentIntentSucceeded', () => {
  it('returns correct event type', () => {
    const event = paymentIntentSucceeded();
    expect(event.type).toBe('payment_intent.succeeded');
    expect(event.object).toBe('event');
    expect(event.id).toMatch(/^evt_/);
  });

  it('inner object has correct shape and ID prefix', () => {
    const event = paymentIntentSucceeded();
    const pi = event.data.object;
    expect(pi.object).toBe('payment_intent');
    expect(pi.id).toMatch(/^pi_/);
  });

  it('uses sensible defaults', () => {
    const event = paymentIntentSucceeded();
    const pi = event.data.object;
    expect(pi.status).toBe('succeeded');
    expect(pi.amount).toBe(2999);
    expect(pi.amount_received).toBe(2999);
    expect(pi.currency).toBe('usd');
    expect(pi.customer).toMatch(/^cus_/);
    expect(pi.payment_method).toMatch(/^pm_/);
    expect(pi.latest_charge).toMatch(/^ch_/);
    expect(pi.last_payment_error).toBeNull();
    expect(pi.livemode).toBe(false);
    expect(pi.amount_capturable).toBe(0);
  });

  it('allows overriding options', () => {
    const event = paymentIntentSucceeded({
      amount: 5000,
      currency: 'eur',
      customerId: 'cus_test123',
      paymentMethodId: 'pm_test456',
      chargeId: 'ch_test789',
      metadata: { order: '42' },
    });
    const pi = event.data.object;
    expect(pi.amount).toBe(5000);
    expect(pi.amount_received).toBe(5000);
    expect(pi.currency).toBe('eur');
    expect(pi.customer).toBe('cus_test123');
    expect(pi.payment_method).toBe('pm_test456');
    expect(pi.latest_charge).toBe('ch_test789');
    expect(pi.metadata).toEqual({ order: '42' });
  });

  it('all required StripePaymentIntent fields are present', () => {
    const pi = paymentIntentSucceeded().data.object;
    const requiredKeys = [
      'id', 'object', 'amount', 'amount_capturable', 'amount_received',
      'currency', 'status', 'customer', 'payment_method', 'latest_charge',
      'last_payment_error', 'description', 'metadata', 'created',
      'livemode',
    ];
    for (const key of requiredKeys) {
      expect(pi).toHaveProperty(key);
    }
  });

  it('omits `invoice` (removed from PaymentIntent in 2025-03-31.basil)', () => {
    const pi = paymentIntentSucceeded().data.object;
    expect(pi).not.toHaveProperty('invoice');
  });
});

// ─── paymentIntentPaymentFailed ─────────────────────────────────────────────

describe('paymentIntentPaymentFailed', () => {
  it('returns correct event type', () => {
    const event = paymentIntentPaymentFailed();
    expect(event.type).toBe('payment_intent.payment_failed');
    expect(event.object).toBe('event');
    expect(event.id).toMatch(/^evt_/);
  });

  it('inner object has correct shape', () => {
    const pi = paymentIntentPaymentFailed().data.object;
    expect(pi.object).toBe('payment_intent');
    expect(pi.id).toMatch(/^pi_/);
    expect(pi.status).toBe('requires_payment_method');
    expect(pi.amount_received).toBe(0);
  });

  it('defaults to generic_decline (card_declined with decline_code)', () => {
    const pi = paymentIntentPaymentFailed().data.object;
    const err = pi.last_payment_error!;
    expect(err.type).toBe('card_error');
    expect(err.code).toBe('card_declined');
    expect(err.decline_code).toBe('generic_decline');
    expect(err.message).toBe('Your card was declined.');
    expect(err.payment_method).toBeDefined();
    expect(err.payment_method!.id).toMatch(/^pm_/);
  });

  it('insufficient_funds sets decline_code', () => {
    const pi = paymentIntentPaymentFailed({ declineCode: 'insufficient_funds' }).data.object;
    const err = pi.last_payment_error!;
    expect(err.code).toBe('card_declined');
    expect(err.decline_code).toBe('insufficient_funds');
    expect('decline_code' in err).toBe(true);
  });

  it('expired_card has code only — decline_code key is absent', () => {
    const pi = paymentIntentPaymentFailed({ declineCode: 'expired_card' }).data.object;
    const err = pi.last_payment_error!;
    expect(err.code).toBe('expired_card');
    expect('decline_code' in err).toBe(false);
  });

  it('incorrect_cvc has code only — decline_code key is absent', () => {
    const pi = paymentIntentPaymentFailed({ declineCode: 'incorrect_cvc' }).data.object;
    const err = pi.last_payment_error!;
    expect(err.code).toBe('incorrect_cvc');
    expect('decline_code' in err).toBe(false);
  });

  it('allows overriding amount and currency', () => {
    const pi = paymentIntentPaymentFailed({ amount: 1000, currency: 'gbp' }).data.object;
    expect(pi.amount).toBe(1000);
    expect(pi.currency).toBe('gbp');
  });

  it('throws for unknown decline codes', () => {
    expect(() =>
      paymentIntentPaymentFailed({ declineCode: 'not_a_real_code' }),
    ).toThrow('Unknown decline code: not_a_real_code');
  });
});

// ─── chargeSucceeded ────────────────────────────────────────────────────────

describe('paymentIntentPaymentFailed failed-charge linkage', () => {
  it('latest_charge and last_payment_error.charge reference the same failed charge', () => {
    const pi = paymentIntentPaymentFailed({ declineCode: 'insufficient_funds' }).data.object;
    expect(pi.latest_charge).toMatch(/^ch_/);
    expect(pi.last_payment_error!.charge).toBe(pi.latest_charge);
  });

  it('last_payment_error.doc_url points at the error code docs', () => {
    const declined = paymentIntentPaymentFailed({ declineCode: 'insufficient_funds' }).data.object;
    expect(declined.last_payment_error!.doc_url).toBe('https://stripe.com/docs/error-codes/card-declined');
    const expired = paymentIntentPaymentFailed({ declineCode: 'expired_card' }).data.object;
    expect(expired.last_payment_error!.doc_url).toBe('https://stripe.com/docs/error-codes/expired-card');
    expect(expired.last_payment_error).not.toHaveProperty('decline_code');
  });
});

describe('chargeSucceeded', () => {
  it('returns correct event type', () => {
    const event = chargeSucceeded();
    expect(event.type).toBe('charge.succeeded');
    expect(event.object).toBe('event');
    expect(event.id).toMatch(/^evt_/);
  });

  it('inner object has correct shape and ID prefix', () => {
    const charge = chargeSucceeded().data.object;
    expect(charge.object).toBe('charge');
    expect(charge.id).toMatch(/^ch_/);
  });

  it('uses sensible defaults', () => {
    const charge = chargeSucceeded().data.object;
    expect(charge.status).toBe('succeeded');
    expect(charge.amount).toBe(2999);
    expect(charge.amount_captured).toBe(2999);
    expect(charge.amount_refunded).toBe(0);
    expect(charge.currency).toBe('usd');
    expect(charge.customer).toMatch(/^cus_/);
    expect(charge.payment_intent).toMatch(/^pi_/);
    expect(charge.payment_method).toMatch(/^pm_/);
    expect(charge.refunded).toBe(false);
    expect(charge.disputed).toBe(false);
    expect(charge.livemode).toBe(false);
  });

  it('has correct outcome', () => {
    const charge = chargeSucceeded().data.object;
    expect(charge.outcome).toEqual({
      type: 'authorized',
      network_status: 'approved_by_network',
      reason: null,
      risk_level: 'normal',
      risk_score: 32,
      seller_message: 'Payment complete.',
    });
  });

  it('has correct card defaults in payment_method_details', () => {
    const charge = chargeSucceeded().data.object;
    expect(charge.payment_method_details.type).toBe('card');
    expect(charge.payment_method_details.card).toEqual({
      brand: 'visa',
      last4: '4242',
      exp_month: 12,
      exp_year: 2027,
      funding: 'credit',
      country: 'US',
    });
  });

  it('has captured: true by default', () => {
    const charge = chargeSucceeded().data.object;
    expect(charge.captured).toBe(true);
  });

  it('accepts captured: false option', () => {
    const charge = chargeSucceeded({ captured: false }).data.object;
    expect(charge.captured).toBe(false);
  });

  it('omits includable-only `refunds` and removed `invoice` fields', () => {
    const charge = chargeSucceeded().data.object;
    expect(charge).not.toHaveProperty('refunds');
    expect(charge).not.toHaveProperty('invoice');
  });

  it('is paid with no failure code', () => {
    const charge = chargeSucceeded().data.object;
    expect(charge.paid).toBe(true);
    expect(charge.failure_code).toBeNull();
    expect(charge.failure_message).toBeNull();
  });

  it('allows overriding card details', () => {
    const charge = chargeSucceeded({ cardBrand: 'mastercard', cardLast4: '5555' }).data.object;
    expect(charge.payment_method_details.card!.brand).toBe('mastercard');
    expect(charge.payment_method_details.card!.last4).toBe('5555');
  });

  it('allows overriding amount, currency, customer, paymentIntent', () => {
    const charge = chargeSucceeded({
      amount: 10000,
      currency: 'eur',
      customerId: 'cus_override',
      paymentIntentId: 'pi_override',
    }).data.object;
    expect(charge.amount).toBe(10000);
    expect(charge.amount_captured).toBe(10000);
    expect(charge.currency).toBe('eur');
    expect(charge.customer).toBe('cus_override');
    expect(charge.payment_intent).toBe('pi_override');
  });
});

// ─── chargeRefunded ─────────────────────────────────────────────────────────

describe('chargeRefunded', () => {
  it('returns correct event type', () => {
    const event = chargeRefunded();
    expect(event.type).toBe('charge.refunded');
    expect(event.object).toBe('event');
    expect(event.id).toMatch(/^evt_/);
  });

  it('inner object has correct shape and ID prefix', () => {
    const charge = chargeRefunded().data.object;
    expect(charge.object).toBe('charge');
    expect(charge.id).toMatch(/^ch_/);
  });

  it('has captured: true by default', () => {
    const charge = chargeRefunded().data.object;
    expect(charge.captured).toBe(true);
  });

  it('full refund by default', () => {
    const charge = chargeRefunded().data.object;
    expect(charge.refunded).toBe(true);
    expect(charge.amount_refunded).toBe(charge.amount);
  });

  it('omits the refunds list (not returned by default since 2022-11-15)', () => {
    const charge = chargeRefunded().data.object;
    expect(charge).not.toHaveProperty('refunds');
    expect(charge.amount_refunded).toBe(charge.amount);
  });

  it('supports partial refund via refundAmount', () => {
    const charge = chargeRefunded({ amount: 5000, refundAmount: 2000 }).data.object;
    expect(charge.amount).toBe(5000);
    expect(charge.amount_refunded).toBe(2000);
    expect(charge.refunded).toBe(false);
  });

  it('allows overriding chargeId', () => {
    const charge = chargeRefunded({ chargeId: 'ch_custom' }).data.object;
    expect(charge.id).toBe('ch_custom');
  });

  it('all required StripeCharge fields are present', () => {
    const charge = chargeRefunded().data.object;
    const requiredKeys = [
      'id', 'object', 'amount', 'amount_captured', 'amount_refunded',
      'currency', 'status', 'customer', 'payment_intent', 'payment_method',
      'payment_method_details', 'outcome', 'paid', 'failure_code',
      'failure_message', 'refunded', 'disputed', 'description', 'receipt_email', 'metadata', 'created',
      'livemode',
    ];
    for (const key of requiredKeys) {
      expect(charge).toHaveProperty(key);
    }
  });
});

// ─── Full default shapes at 2026-09-30.endive ───────────────────────────────
// Every property the API returns by default. Left out on purpose: PaymentIntent
// `hooks`, `payment_details`, `presentment_details` and Charge
// `presentment_details`, `radar_options`, `transfer` (feature-specific) and
// `refunds` (includable only).

const PAYMENT_INTENT_KEYS = [
  'allowed_payment_method_types', 'amount', 'amount_capturable', 'amount_details',
  'amount_received', 'application', 'application_fee_amount', 'automatic_payment_methods',
  'canceled_at', 'cancellation_reason', 'capture_method', 'client_secret',
  'confirmation_method', 'created', 'currency', 'customer', 'customer_account', 'description',
  'excluded_payment_method_types', 'id', 'last_payment_error', 'latest_charge', 'livemode',
  'managed_payments', 'metadata', 'next_action', 'object', 'on_behalf_of', 'payment_method',
  'payment_method_configuration_details', 'payment_method_options', 'payment_method_types',
  'payment_record', 'processing', 'receipt_email', 'review', 'setup_future_usage', 'shipping',
  'statement_descriptor', 'statement_descriptor_suffix', 'status', 'transfer_data',
  'transfer_group',
].sort();

const PAYMENT_INTENT_NULL_FIELDS = [
  'allowed_payment_method_types', 'application', 'application_fee_amount',
  'automatic_payment_methods', 'customer_account', 'excluded_payment_method_types',
  'managed_payments', 'on_behalf_of', 'payment_method_configuration_details', 'payment_record',
  'processing', 'receipt_email', 'review', 'setup_future_usage', 'shipping',
  'statement_descriptor', 'statement_descriptor_suffix', 'transfer_data', 'transfer_group',
];

const CHARGE_KEYS = [
  'amount', 'amount_captured', 'amount_refunded', 'application', 'application_fee',
  'application_fee_amount', 'balance_transaction', 'billing_details',
  'calculated_statement_descriptor', 'captured', 'created', 'currency', 'customer',
  'description', 'disputed', 'failure_balance_transaction', 'failure_code', 'failure_message',
  'fraud_details', 'id', 'livemode', 'metadata', 'object', 'on_behalf_of', 'outcome', 'paid',
  'payment_intent', 'payment_method', 'payment_method_details', 'receipt_email',
  'receipt_number', 'receipt_url', 'refunded', 'review', 'shipping', 'source_transfer',
  'statement_descriptor', 'statement_descriptor_suffix', 'status', 'transfer_data',
  'transfer_group',
].sort();

const CHARGE_CARD_KEYS = [
  'amount_authorized', 'authorization_code', 'brand', 'checks', 'country',
  'electronic_commerce_indicator', 'exp_month', 'exp_year', 'fingerprint', 'funding',
  'installments', 'last4', 'mandate', 'network', 'network_token', 'network_transaction_id',
  'regulated_status', 'three_d_secure', 'transaction_link_id', 'wallet',
].sort();

function expectDefaultPaymentIntentFields(pi: StripePaymentIntentDetailed) {
  expect(Object.keys(pi).sort()).toEqual(PAYMENT_INTENT_KEYS);
  for (const field of PAYMENT_INTENT_NULL_FIELDS) {
    expect(pi).toHaveProperty(field, null);
  }
  expect(pi).toMatchObject({
    amount_details: { tip: {} },
    capture_method: 'automatic_async',
    confirmation_method: 'automatic',
    payment_method_types: ['card'],
    payment_method_options: {
      card: {
        installments: null,
        mandate_options: null,
        network: null,
        request_three_d_secure: 'automatic',
      },
    },
  });
  expect(pi.client_secret).toMatch(
    new RegExp(`^${pi.id}_secret_[A-Za-z0-9]{25}$`),
  );
}

// ─── paymentIntentRequiresAction ────────────────────────────────────────────

describe('paymentIntentRequiresAction', () => {
  it('returns every field a PaymentIntent has by default', () => {
    expectDefaultPaymentIntentFields(paymentIntentRequiresAction().data.object);
    expectDefaultPaymentIntentFields(
      paymentIntentRequiresAction({ nextActionType: 'redirect_to_url' }).data.object,
    );
  });

  it('returns correct event envelope', () => {
    const event = paymentIntentRequiresAction();
    expect(event.type).toBe('payment_intent.requires_action');
    expect(event.object).toBe('event');
    expect(event.id).toMatch(/^evt_/);
    expect(event.api_version).toBe(STRIPE_API_VERSION);
    expect(event.api_version).toBe('2026-09-30.endive');
  });

  it('inner object is a requires_action PaymentIntent with correct ID prefixes', () => {
    const pi = paymentIntentRequiresAction().data.object;
    expect(pi.object).toBe('payment_intent');
    expect(pi.id).toMatch(/^pi_/);
    expect(pi.status).toBe('requires_action');
    expect(pi.customer).toMatch(/^cus_/);
    expect(pi.payment_method).toMatch(/^pm_/);
    expect(pi.livemode).toBe(false);
  });

  it('has not charged anything yet: no charge, no amounts received, no error', () => {
    const pi = paymentIntentRequiresAction().data.object;
    expect(pi.latest_charge).toBeNull();
    expect(pi.amount_received).toBe(0);
    expect(pi.amount_capturable).toBe(0);
    expect(pi.last_payment_error).toBeNull();
    expect(pi.canceled_at).toBeNull();
    expect(pi.cancellation_reason).toBeNull();
  });

  it('defaults next_action to use_stripe_sdk for 3D Secure', () => {
    const pi = paymentIntentRequiresAction().data.object;
    expect(pi.next_action).not.toBeNull();
    expect(pi.next_action!.type).toBe('use_stripe_sdk');
    expect(pi.next_action!.use_stripe_sdk).toBeTypeOf('object');
    expect(pi.next_action).not.toHaveProperty('redirect_to_url');
  });

  it('supports redirect_to_url with a return_url', () => {
    const pi = paymentIntentRequiresAction({
      nextActionType: 'redirect_to_url',
      returnUrl: 'https://shop.test/return',
      paymentIntentId: 'pi_redirect',
    }).data.object;
    expect(pi.next_action!.type).toBe('redirect_to_url');
    expect(pi.next_action!.redirect_to_url).toEqual({
      return_url: 'https://shop.test/return',
      url: 'https://hooks.stripe.com/3d_secure_2/hosted?payment_intent=pi_redirect',
    });
    expect(pi.next_action).not.toHaveProperty('use_stripe_sdk');
  });

  it('propagates options', () => {
    const event = paymentIntentRequiresAction({
      amount: 4200,
      currency: 'eur',
      customerId: 'cus_shared',
      paymentIntentId: 'pi_shared',
      paymentMethodId: 'pm_shared',
      timestamp: 1_700_000_000,
      metadata: { order: '7' },
    });
    const pi = event.data.object;
    expect(pi.id).toBe('pi_shared');
    expect(pi.amount).toBe(4200);
    expect(pi.currency).toBe('eur');
    expect(pi.customer).toBe('cus_shared');
    expect(pi.payment_method).toBe('pm_shared');
    expect(pi.metadata).toEqual({ order: '7' });
    expect(pi.created).toBe(1_700_000_000);
    expect(event.created).toBe(1_700_000_000);
  });

  it('omits previous_attributes (only sent on *.updated events) and removed `invoice`', () => {
    const event = paymentIntentRequiresAction();
    expect(event.data).not.toHaveProperty('previous_attributes');
    expect(event.data.object).not.toHaveProperty('invoice');
  });
});

// ─── paymentIntentCanceled ──────────────────────────────────────────────────

describe('paymentIntentCanceled', () => {
  it('returns correct event envelope', () => {
    const event = paymentIntentCanceled();
    expect(event.type).toBe('payment_intent.canceled');
    expect(event.object).toBe('event');
    expect(event.id).toMatch(/^evt_/);
    expect(event.api_version).toBe(STRIPE_API_VERSION);
  });

  it('returns every field a PaymentIntent has by default', () => {
    expectDefaultPaymentIntentFields(paymentIntentCanceled().data.object);
  });

  it('was created before it was canceled; the event fires at cancellation', () => {
    const event = paymentIntentCanceled({ timestamp: 1_700_000_500 });
    const pi = event.data.object;
    expect(event.created).toBe(1_700_000_500);
    expect(pi.canceled_at).toBe(1_700_000_500);
    expect(pi.created).toBeLessThan(pi.canceled_at!);
  });

  it('inner object is a canceled PaymentIntent', () => {
    const pi = paymentIntentCanceled({ timestamp: 1_700_000_500 }).data.object;
    expect(pi.object).toBe('payment_intent');
    expect(pi.id).toMatch(/^pi_/);
    expect(pi.status).toBe('canceled');
    expect(pi.canceled_at).toBe(1_700_000_500);
    expect(pi.cancellation_reason).toBe('requested_by_customer');
    expect(pi.next_action).toBeNull();
    expect(pi.last_payment_error).toBeNull();
    expect(pi.amount_received).toBe(0);
    expect(pi.amount_capturable).toBe(0);
  });

  it('defaults payment_method and latest_charge to null', () => {
    const pi = paymentIntentCanceled().data.object;
    expect(pi.payment_method).toBeNull();
    expect(pi.latest_charge).toBeNull();
    expect(pi.customer).toMatch(/^cus_/);
  });

  it('accepts every cancellation_reason in the endive enum', () => {
    const reasons = [
      'abandoned', 'automatic', 'duplicate', 'expired', 'failed_invoice',
      'fraudulent', 'requested_by_customer', 'void_invoice',
    ] as const;
    for (const reason of reasons) {
      const pi = paymentIntentCanceled({ cancellationReason: reason }).data.object;
      expect(pi.cancellation_reason).toBe(reason);
    }
  });

  it('propagates options', () => {
    const pi = paymentIntentCanceled({
      amount: 1500,
      currency: 'gbp',
      customerId: 'cus_shared',
      paymentIntentId: 'pi_shared',
      paymentMethodId: 'pm_shared',
      chargeId: 'ch_shared',
      metadata: { cart: 'abc' },
    }).data.object;
    expect(pi.id).toBe('pi_shared');
    expect(pi.amount).toBe(1500);
    expect(pi.currency).toBe('gbp');
    expect(pi.customer).toBe('cus_shared');
    expect(pi.payment_method).toBe('pm_shared');
    expect(pi.latest_charge).toBe('ch_shared');
    expect(pi.metadata).toEqual({ cart: 'abc' });
  });

  it('omits previous_attributes', () => {
    expect(paymentIntentCanceled().data).not.toHaveProperty('previous_attributes');
  });
});

// ─── chargeFailed ───────────────────────────────────────────────────────────

describe('chargeFailed', () => {
  it('returns correct event envelope', () => {
    const event = chargeFailed();
    expect(event.type).toBe('charge.failed');
    expect(event.object).toBe('event');
    expect(event.id).toMatch(/^evt_/);
    expect(event.api_version).toBe(STRIPE_API_VERSION);
  });

  it('returns every field a Charge has by default, nullable ones as null', () => {
    const charge = chargeFailed().data.object;
    expect(Object.keys(charge).sort()).toEqual(CHARGE_KEYS);
    for (const field of [
      'application', 'application_fee', 'application_fee_amount', 'on_behalf_of',
      'receipt_number', 'review', 'shipping', 'source_transfer', 'statement_descriptor',
      'statement_descriptor_suffix', 'transfer_data', 'transfer_group',
    ]) {
      expect(charge).toHaveProperty(field, null);
    }
    expect(charge.fraud_details).toEqual({});
    expect(charge.billing_details).toEqual({
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
    });
  });

  it('has no receipt: Stripe creates receipts for successful payments only', () => {
    expect(chargeFailed().data.object.receipt_url).toBeNull();
  });

  it('card details carry every default field and nothing was authorized', () => {
    const card = chargeFailed().data.object.payment_method_details.card!;
    expect(Object.keys(card).sort()).toEqual(CHARGE_CARD_KEYS);
    expect(card.amount_authorized).toBeNull();
    expect(card.authorization_code).toBeNull();
    expect(card.network_transaction_id).toBeNull();
    expect(card.three_d_secure).toBeNull();
    expect(card.network).toBe('visa');
    expect(card.network_token).toEqual({ used: false });
    expect(card.fingerprint).toMatch(/^[A-Za-z0-9]{16}$/);
    for (const field of ['capture_before', 'extended_authorization', 'incremental_authorization', 'multicapture', 'overcapture']) {
      expect(card).not.toHaveProperty(field);
    }
  });

  it('cvc_check follows the decline: fail for incorrect_cvc, unchecked when Radar blocks', () => {
    const cvc = (key: string) =>
      chargeFailed({ declineCode: key }).data.object.payment_method_details.card!.checks!.cvc_check;
    expect(cvc('incorrect_cvc')).toBe('fail');
    expect(cvc('fraudulent')).toBe('unchecked');
    expect(cvc('insufficient_funds')).toBe('pass');
  });

  it('card network follows the brand, unknown for brands outside the network enum', () => {
    const network = (cardBrand: string) =>
      chargeFailed({ cardBrand }).data.object.payment_method_details.card!.network;
    expect(network('mastercard')).toBe('mastercard');
    expect(network('amex')).toBe('amex');
    expect(network('not_a_brand')).toBe('unknown');
  });

  it('inner object is a failed, unpaid, uncaptured charge', () => {
    const charge = chargeFailed().data.object;
    expect(charge.object).toBe('charge');
    expect(charge.id).toMatch(/^ch_/);
    expect(charge.status).toBe('failed');
    expect(charge.paid).toBe(false);
    expect(charge.captured).toBe(false);
    expect(charge.amount_captured).toBe(0);
    expect(charge.amount_refunded).toBe(0);
    expect(charge.refunded).toBe(false);
    expect(charge.disputed).toBe(false);
    expect(charge.balance_transaction).toBeNull();
    expect(charge.failure_balance_transaction).toBeNull();
    expect(charge.customer).toMatch(/^cus_/);
    expect(charge.payment_intent).toMatch(/^pi_/);
    expect(charge.payment_method).toMatch(/^pm_/);
  });

  it('defaults to generic_decline', () => {
    const charge = chargeFailed().data.object;
    expect(charge.failure_code).toBe('card_declined');
    expect(charge.failure_message).toBe('Your card was declined.');
    expect(charge.outcome!.type).toBe('issuer_declined');
    expect(charge.outcome!.network_status).toBe('declined_by_network');
    expect(charge.outcome!.reason).toBe('generic_decline');
  });

  it('insufficient_funds: failure_code card_declined, issuer reason in outcome.reason', () => {
    const charge = chargeFailed({ declineCode: 'insufficient_funds' }).data.object;
    expect(charge.failure_code).toBe('card_declined');
    expect(charge.failure_message).toBe('Your card has insufficient funds.');
    expect(charge.outcome!.reason).toBe('insufficient_funds');
    expect(charge.outcome!.seller_message).toBe(
      'The bank returned the decline code `insufficient_funds`.',
    );
  });

  it('expired_card: failure_code expired_card with the documented network codes', () => {
    const charge = chargeFailed({ declineCode: 'expired_card' }).data.object;
    expect(charge.failure_code).toBe('expired_card');
    expect(charge.failure_message).toBe('Your card has expired.');
    expect(charge.outcome).toEqual({
      type: 'issuer_declined',
      network_status: 'declined_by_network',
      reason: 'expired_card',
      risk_level: 'normal',
      risk_score: 32,
      seller_message: 'The bank returned the decline code `expired_card`.',
      advice_code: 'confirm_card_data',
      network_advice_code: '03',
      network_decline_code: '54',
    });
  });

  it('fraudulent is a Radar block that never reaches the network', () => {
    const charge = chargeFailed({ declineCode: 'fraudulent' }).data.object;
    expect(charge.failure_code).toBe('card_declined');
    expect(charge.outcome!.type).toBe('blocked');
    expect(charge.outcome!.network_status).toBe('not_sent_to_network');
    expect(charge.outcome!.reason).toBe('highest_risk_level');
    expect(charge.outcome!.risk_level).toBe('highest');
    expect(charge.outcome!.advice_code).toBe('do_not_try_again');
    expect(charge.outcome!.network_decline_code).toBeNull();
  });

  it('failure_code matches the PaymentIntent error code for every decline key', () => {
    for (const [key, entry] of Object.entries(DECLINE_CODE_MAP)) {
      const charge = chargeFailed({ declineCode: key }).data.object;
      expect(charge.failure_code).toBe(entry.code);
      expect(charge.failure_message).toBe(entry.message);
      expect(charge.outcome).not.toBeNull();
      for (const field of ['advice_code', 'network_advice_code', 'network_decline_code']) {
        expect(charge.outcome).toHaveProperty(field);
      }
    }
  });

  it('never carries decline_code (that field lives on PaymentIntent.last_payment_error)', () => {
    for (const key of Object.keys(DECLINE_CODE_MAP)) {
      const charge = chargeFailed({ declineCode: key }).data.object;
      expect(charge).not.toHaveProperty('decline_code');
      expect(charge.outcome).not.toHaveProperty('decline_code');
    }
  });

  it('throws for unknown decline codes, including inherited object keys', () => {
    expect(() => chargeFailed({ declineCode: 'not_a_real_code' })).toThrow(
      'Unknown decline code: not_a_real_code',
    );
    expect(() => chargeFailed({ declineCode: 'toString' })).toThrow('Unknown decline code: toString');
  });

  it('propagates options', () => {
    const event = chargeFailed({
      amount: 7500,
      currency: 'cad',
      customerId: 'cus_shared',
      paymentIntentId: 'pi_shared',
      paymentMethodId: 'pm_shared',
      chargeId: 'ch_shared',
      cardBrand: 'mastercard',
      cardLast4: '4444',
      timestamp: 1_700_001_000,
      metadata: { attempt: '2' },
    });
    const charge = event.data.object;
    expect(charge.id).toBe('ch_shared');
    expect(charge.amount).toBe(7500);
    expect(charge.currency).toBe('cad');
    expect(charge.customer).toBe('cus_shared');
    expect(charge.payment_intent).toBe('pi_shared');
    expect(charge.payment_method).toBe('pm_shared');
    expect(charge.payment_method_details.card!.brand).toBe('mastercard');
    expect(charge.payment_method_details.card!.last4).toBe('4444');
    expect(charge.metadata).toEqual({ attempt: '2' });
    expect(charge.created).toBe(1_700_001_000);
    expect(event.created).toBe(1_700_001_000);
  });

  it('omits includable-only `refunds`, removed `invoice` and previous_attributes', () => {
    const event = chargeFailed();
    expect(event.data.object).not.toHaveProperty('refunds');
    expect(event.data.object).not.toHaveProperty('invoice');
    expect(event.data).not.toHaveProperty('previous_attributes');
  });
});
