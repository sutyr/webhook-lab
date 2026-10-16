// Copyright 2026 Sutyr Inc. SPDX-License-Identifier: Apache-2.0
import { describe, it, expect } from 'vitest';
import { invoicePaymentPaid } from '../../../src/generators/invoice-payments.js';
import { invoicePaid } from '../../../src/generators/billing.js';
import { STRIPE_API_VERSION } from '../../../src/generators/envelope.js';

const TS = 1760000000;

// ─── invoicePaymentPaid ─────────────────────────────────────────────────────

describe('invoicePaymentPaid', () => {
  it('produces an invoice_payment.paid event at the current API version', () => {
    const event = invoicePaymentPaid();
    expect(event.type).toBe('invoice_payment.paid');
    expect(event.object).toBe('event');
    expect(event.id).toMatch(/^evt_/);
    expect(event.api_version).toBe(STRIPE_API_VERSION);
    expect(event.livemode).toBe(false);
  });

  it('carries an invoice_payment object with an inpay_ id', () => {
    const payment = invoicePaymentPaid().data.object;
    expect(payment.object).toBe('invoice_payment');
    expect(payment.id).toMatch(/^inpay_[A-Za-z0-9]+$/);
    expect(payment.livemode).toBe(false);
  });

  it('is paid, with paid_at at the event time and no cancellation', () => {
    const event = invoicePaymentPaid({ timestamp: TS });
    const payment = event.data.object;
    expect(event.created).toBe(TS);
    expect(payment.status).toBe('paid');
    expect(payment.created).toBe(TS);
    expect(payment.status_transitions).toEqual({ canceled_at: null, paid_at: TS });
  });

  it('defaults amount_paid and amount_requested to 2999 usd', () => {
    const payment = invoicePaymentPaid().data.object;
    expect(payment.amount_requested).toBe(2999);
    expect(payment.amount_paid).toBe(2999);
    expect(payment.currency).toBe('usd');
  });

  it('accepts amount, amountPaid and currency', () => {
    const full = invoicePaymentPaid({ amount: 5000, currency: 'eur' }).data.object;
    expect(full.amount_requested).toBe(5000);
    expect(full.amount_paid).toBe(5000);
    expect(full.currency).toBe('eur');

    const partial = invoicePaymentPaid({ amount: 5000, amountPaid: 3000 }).data.object;
    expect(partial.amount_requested).toBe(5000);
    expect(partial.amount_paid).toBe(3000);
  });

  it('links the invoice to a PaymentIntent by default', () => {
    const payment = invoicePaymentPaid().data.object;
    expect(payment.invoice).toMatch(/^in_/);
    expect(payment.payment.type).toBe('payment_intent');
    expect(payment.payment.payment_intent).toMatch(/^pi_/);
  });

  it('includes only the payment key that matches payment.type', () => {
    const viaIntent = invoicePaymentPaid().data.object.payment;
    expect(Object.keys(viaIntent).sort()).toEqual(['payment_intent', 'type']);
    expect(viaIntent).not.toHaveProperty('charge');
    expect(viaIntent).not.toHaveProperty('payment_record');

    const viaCharge = invoicePaymentPaid({ paymentType: 'charge' }).data.object.payment;
    expect(viaCharge.type).toBe('charge');
    expect(viaCharge.charge).toMatch(/^ch_/);
    expect(Object.keys(viaCharge).sort()).toEqual(['charge', 'type']);
    expect(viaCharge).not.toHaveProperty('payment_intent');
  });

  it('propagates invoiceId, paymentIntentId, chargeId and invoicePaymentId', () => {
    const viaIntent = invoicePaymentPaid({
      invoiceId: 'in_link1',
      paymentIntentId: 'pi_link1',
      invoicePaymentId: 'inpay_link1',
    }).data.object;
    expect(viaIntent.id).toBe('inpay_link1');
    expect(viaIntent.invoice).toBe('in_link1');
    expect(viaIntent.payment.payment_intent).toBe('pi_link1');

    const viaCharge = invoicePaymentPaid({ paymentType: 'charge', chargeId: 'ch_link1' }).data.object;
    expect(viaCharge.payment.charge).toBe('ch_link1');
  });

  it('is the default invoice payment unless isDefault is false', () => {
    expect(invoicePaymentPaid().data.object.is_default).toBe(true);
    expect(invoicePaymentPaid({ isDefault: false }).data.object.is_default).toBe(false);
  });

  it('has no customer, metadata or other fields InvoicePayment does not define', () => {
    const event = invoicePaymentPaid({ metadata: { ignored: 'yes' } });
    const payment = event.data.object;
    for (const field of ['customer', 'metadata', 'amount', 'charge', 'payment_intent', 'subscription', 'description']) {
      expect(payment, `unexpected field ${field}`).not.toHaveProperty(field);
    }
    expect(Object.keys(payment).sort()).toEqual([
      'amount_paid',
      'amount_requested',
      'created',
      'currency',
      'id',
      'invoice',
      'is_default',
      'livemode',
      'object',
      'payment',
      'status',
      'status_transitions',
    ]);
    expect(event.data).not.toHaveProperty('previous_attributes');
  });

  it('shares IDs with invoice.paid so a handler can join the two events', () => {
    const paid = invoicePaid({ invoiceId: 'in_join1', amount: 4200 });
    const payment = invoicePaymentPaid({
      invoiceId: paid.data.object.id,
      amount: paid.data.object.amount_paid,
      currency: paid.data.object.currency,
      paymentIntentId: 'pi_join1',
    }).data.object;
    expect(payment.invoice).toBe('in_join1');
    expect(payment.amount_paid).toBe(4200);
    expect(payment.payment.payment_intent).toBe('pi_join1');
    // Since 2025-03-31.basil the invoice itself carries no PaymentIntent.
    expect(paid.data.object).not.toHaveProperty('payment_intent');
  });
});
