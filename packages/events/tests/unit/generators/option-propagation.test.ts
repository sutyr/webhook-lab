// Copyright 2026 Sutyr Inc. SPDX-License-Identifier: Apache-2.0

import { describe, it, expect } from 'vitest';
import {
  paymentIntentSucceeded,
  paymentIntentPaymentFailed,
  chargeSucceeded,
  chargeRefunded,
  invoiceCreated,
  invoicePaymentFailed,
  subscriptionCreated,
  checkoutSessionCompleted,
  customerCreated,
} from '../../../src/generators/index.js';

describe('option propagation: every option reaches the output', () => {
  it('customerId → data.object.customer', () => {
    const event = paymentIntentSucceeded({ customerId: 'cus_custom123' });
    expect(event.data.object.customer).toBe('cus_custom123');
  });

  it('paymentIntentId → data.object.id (PI generator)', () => {
    const event = paymentIntentSucceeded({ paymentIntentId: 'pi_custom456' });
    expect(event.data.object.id).toBe('pi_custom456');
  });

  it('chargeId → data.object.id (charge generator)', () => {
    const event = chargeSucceeded({ chargeId: 'ch_custom789' });
    expect(event.data.object.id).toBe('ch_custom789');
  });

  it('subscriptionId → data.object.subscription (invoice generator)', () => {
    const event = invoiceCreated({ subscriptionId: 'sub_inv123' });
    expect(event.data.object.subscription).toBe('sub_inv123');
  });

  it('customerId → data.object.id on subscription generator (subscription object IS the customer\'s sub)', () => {
    const event = subscriptionCreated({ customerId: 'cus_sub456' });
    expect(event.data.object.customer).toBe('cus_sub456');
  });

  it('paymentMethodId → data.object.payment_method', () => {
    const event = paymentIntentSucceeded({ paymentMethodId: 'pm_custom' });
    expect(event.data.object.payment_method).toBe('pm_custom');
  });

  it('amount → data.object.amount', () => {
    const event = paymentIntentSucceeded({ amount: 9999 });
    expect(event.data.object.amount).toBe(9999);
  });

  it('currency → data.object.currency', () => {
    const event = paymentIntentSucceeded({ currency: 'gbp' });
    expect(event.data.object.currency).toBe('gbp');
  });

  it('metadata → data.object.metadata (deep equal)', () => {
    const meta = { order_id: 'ord_123', plan: 'pro' };
    const event = customerCreated({ metadata: meta });
    expect(event.data.object.metadata).toEqual(meta);
  });

  it('declineCode insufficient_funds → last_payment_error.decline_code present', () => {
    const event = paymentIntentPaymentFailed({ declineCode: 'insufficient_funds' });
    const error = event.data.object.last_payment_error!;
    expect(error.code).toBe('card_declined');
    expect(error.decline_code).toBe('insufficient_funds');
  });

  it('declineCode expired_card → code=expired_card, decline_code absent', () => {
    const event = paymentIntentPaymentFailed({ declineCode: 'expired_card' });
    const error = event.data.object.last_payment_error!;
    expect(error.code).toBe('expired_card');
    expect('decline_code' in error).toBe(false);
  });

  it('cardBrand → payment_method_details.card.brand', () => {
    const event = chargeSucceeded({ cardBrand: 'mastercard' });
    expect(event.data.object.payment_method_details.card!.brand).toBe('mastercard');
  });

  it('cardLast4 → payment_method_details.card.last4', () => {
    const event = chargeSucceeded({ cardLast4: '5555' });
    expect(event.data.object.payment_method_details.card!.last4).toBe('5555');
  });

  it('billingReason → billing_reason', () => {
    const event = invoiceCreated({ billingReason: 'subscription_create' });
    expect(event.data.object.billing_reason).toBe('subscription_create');
  });

  it('attemptCount → attempt_count', () => {
    const event = invoicePaymentFailed({ attemptCount: 3 });
    expect(event.data.object.attempt_count).toBe(3);
  });

  it('captured: false → captured: false', () => {
    const event = chargeSucceeded({ captured: false });
    expect(event.data.object.captured).toBe(false);
  });
});
