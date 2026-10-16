// Copyright 2026 Sutyr Inc. SPDX-License-Identifier: Apache-2.0
import { describe, it, expect } from 'vitest';
import {
  paymentIntentSucceeded,
  paymentIntentPaymentFailed,
  chargeSucceeded,
  chargeRefunded,
} from '../../../src/generators/payments.js';

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
