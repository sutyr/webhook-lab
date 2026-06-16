// Copyright 2026 Sutyr Inc. SPDX-License-Identifier: Apache-2.0
import { describe, it, expect } from 'vitest';
import {
  invoiceCreated,
  invoicePaid,
  invoicePaymentFailed,
  invoicePaymentSucceeded,
} from '../../../src/generators/billing.js';

// ─── Shared helpers ─────────────────────────────────────────────────────────

function invoiceObject(event: ReturnType<typeof invoiceCreated>) {
  return event.data.object;
}

// ─── invoiceCreated ─────────────────────────────────────────────────────────

describe('invoiceCreated', () => {
  it('produces correct event type', () => {
    const event = invoiceCreated();
    expect(event.type).toBe('invoice.created');
    expect(event.object).toBe('event');
    expect(event.id).toMatch(/^evt_/);
  });

  it('produces an invoice with object: "invoice" and correct ID prefix', () => {
    const inv = invoiceObject(invoiceCreated());
    expect(inv.object).toBe('invoice');
    expect(inv.id).toMatch(/^in_/);
  });

  it('has status draft, attempt_count 0, attempted false', () => {
    const inv = invoiceObject(invoiceCreated());
    expect(inv.status).toBe('draft');
    expect(inv.attempt_count).toBe(0);
    expect(inv.attempted).toBe(false);
  });

  it('sets default billing_reason to subscription_cycle', () => {
    const inv = invoiceObject(invoiceCreated());
    expect(inv.billing_reason).toBe('subscription_cycle');
  });

  it('accepts billingReason option', () => {
    const inv = invoiceObject(invoiceCreated({ billingReason: 'subscription_create' }));
    expect(inv.billing_reason).toBe('subscription_create');
  });

  it('sets collection_method to charge_automatically', () => {
    const inv = invoiceObject(invoiceCreated());
    expect(inv.collection_method).toBe('charge_automatically');
  });

  it('has number field matching INV- pattern', () => {
    const inv = invoiceObject(invoiceCreated());
    expect(inv.number).toMatch(/^INV-\d+/);
  });

  it('has paid: false (draft invoices are not paid)', () => {
    const inv = invoiceObject(invoiceCreated());
    expect(inv.paid).toBe(false);
  });

  it('defaults amount_due to 2999, amount_paid to 0, amount_remaining equals amount_due', () => {
    const inv = invoiceObject(invoiceCreated());
    expect(inv.amount_due).toBe(2999);
    expect(inv.amount_paid).toBe(0);
    expect(inv.amount_remaining).toBe(2999);
  });

  it('accepts custom amount', () => {
    const inv = invoiceObject(invoiceCreated({ amount: 5000 }));
    expect(inv.amount_due).toBe(5000);
    expect(inv.amount_remaining).toBe(5000);
    expect(inv.amount_paid).toBe(0);
  });

  it('accepts custom currency', () => {
    const inv = invoiceObject(invoiceCreated({ currency: 'eur' }));
    expect(inv.currency).toBe('eur');
  });

  it('has lines with Stripe List wrapper', () => {
    const inv = invoiceObject(invoiceCreated());
    expect(inv.lines.object).toBe('list');
    expect(inv.lines.has_more).toBe(false);
    expect(inv.lines.total_count).toBe(1);
    expect(inv.lines.url).toMatch(/^\/v1\/invoices\/in_.*\/lines$/);
    expect(inv.lines.data).toHaveLength(1);
  });

  it('line item has a price with recurring', () => {
    const line = invoiceObject(invoiceCreated()).lines.data[0]!;
    expect(line.object).toBe('line_item');
    expect(line.id).toMatch(/^il_/);
    expect(line.price.object).toBe('price');
    expect(line.price.id).toMatch(/^price_/);
    expect(line.price.recurring).not.toBeNull();
    expect(line.price.recurring!.interval).toBe('month');
    expect(line.price.recurring!.interval_count).toBe(1);
    expect(line.price.type).toBe('recurring');
  });
});

// ─── invoicePaid ────────────────────────────────────────────────────────────

describe('invoicePaid', () => {
  it('produces correct event type', () => {
    const event = invoicePaid();
    expect(event.type).toBe('invoice.paid');
  });

  it('has status paid, amount_paid = amount_due, amount_remaining 0', () => {
    const inv = invoiceObject(invoicePaid({ amount: 4200 }));
    expect(inv.status).toBe('paid');
    expect(inv.amount_due).toBe(4200);
    expect(inv.amount_paid).toBe(4200);
    expect(inv.amount_remaining).toBe(0);
  });

  it('has attempt_count 1 and attempted true', () => {
    const inv = invoiceObject(invoicePaid());
    expect(inv.attempt_count).toBe(1);
    expect(inv.attempted).toBe(true);
  });

  it('has paid: true', () => {
    const inv = invoiceObject(invoicePaid());
    expect(inv.paid).toBe(true);
  });

  it('invoice object has correct structure', () => {
    const inv = invoiceObject(invoicePaid());
    expect(inv.object).toBe('invoice');
    expect(inv.id).toMatch(/^in_/);
    expect(inv.lines.data).toHaveLength(1);
    expect(inv.lines.data[0]!.price.recurring).not.toBeNull();
  });
});

// ─── invoicePaymentFailed ───────────────────────────────────────────────────

describe('invoicePaymentFailed', () => {
  it('produces correct event type', () => {
    const event = invoicePaymentFailed();
    expect(event.type).toBe('invoice.payment_failed');
  });

  it('has status open, amount_paid 0, amount_remaining = amount_due', () => {
    const inv = invoiceObject(invoicePaymentFailed({ amount: 1500 }));
    expect(inv.status).toBe('open');
    expect(inv.amount_paid).toBe(0);
    expect(inv.amount_due).toBe(1500);
    expect(inv.amount_remaining).toBe(1500);
  });

  it('defaults attempt_count to 1 and attempted true', () => {
    const inv = invoiceObject(invoicePaymentFailed());
    expect(inv.attempt_count).toBe(1);
    expect(inv.attempted).toBe(true);
  });

  it('accepts custom attemptCount', () => {
    const inv = invoiceObject(invoicePaymentFailed({ attemptCount: 3 }));
    expect(inv.attempt_count).toBe(3);
  });

  it('sets next_payment_attempt to a future timestamp', () => {
    const inv = invoiceObject(invoicePaymentFailed());
    expect(inv.next_payment_attempt).toBeTypeOf('number');
    expect(inv.next_payment_attempt!).toBeGreaterThan(Math.floor(Date.now() / 1000));
  });

  it('has paid: false', () => {
    const inv = invoiceObject(invoicePaymentFailed());
    expect(inv.paid).toBe(false);
  });

  it('CRITICAL: payload does NOT contain decline_code anywhere', () => {
    const event = invoicePaymentFailed();
    const serialized = JSON.stringify(event);
    expect(serialized).not.toContain('decline_code');
  });

  it('has correct invoice structure with lines', () => {
    const inv = invoiceObject(invoicePaymentFailed());
    expect(inv.object).toBe('invoice');
    expect(inv.id).toMatch(/^in_/);
    expect(inv.lines.object).toBe('list');
    expect(inv.lines.data).toHaveLength(1);
    expect(inv.lines.data[0]!.price.recurring).not.toBeNull();
  });

  it('accepts custom currency', () => {
    const inv = invoiceObject(invoicePaymentFailed({ currency: 'gbp' }));
    expect(inv.currency).toBe('gbp');
  });
});

// ─── invoicePaymentSucceeded ────────────────────────────────────────────────

describe('invoicePaymentSucceeded', () => {
  it('produces correct event type (distinct from invoice.paid)', () => {
    const event = invoicePaymentSucceeded();
    expect(event.type).toBe('invoice.payment_succeeded');
    expect(event.type).not.toBe('invoice.paid');
  });

  it('has status paid, amount_paid = amount_due, amount_remaining 0', () => {
    const inv = invoiceObject(invoicePaymentSucceeded({ amount: 7777 }));
    expect(inv.status).toBe('paid');
    expect(inv.amount_due).toBe(7777);
    expect(inv.amount_paid).toBe(7777);
    expect(inv.amount_remaining).toBe(0);
  });

  it('has attempt_count 1 and attempted true', () => {
    const inv = invoiceObject(invoicePaymentSucceeded());
    expect(inv.attempt_count).toBe(1);
    expect(inv.attempted).toBe(true);
  });

  it('invoice object has correct structure', () => {
    const inv = invoiceObject(invoicePaymentSucceeded());
    expect(inv.object).toBe('invoice');
    expect(inv.id).toMatch(/^in_/);
    expect(inv.customer).toMatch(/^cus_/);
    expect(inv.subscription).toMatch(/^sub_/);
    expect(inv.payment_intent).toMatch(/^pi_/);
    expect(inv.lines.object).toBe('list');
    expect(inv.lines.data).toHaveLength(1);
    expect(inv.lines.data[0]!.price.recurring).not.toBeNull();
  });
});

describe('billing edge cases', () => {
  it('invoicePaid with amount: 0 has paid: true (trial invoice)', () => {
    const inv = invoiceObject(invoicePaid({ amount: 0 }));
    expect(inv.amount_due).toBe(0);
    expect(inv.amount_paid).toBe(0);
    expect(inv.paid).toBe(true);
  });

  it('invoicePaymentFailed with attemptCount: 0 is accepted', () => {
    const inv = invoiceObject(invoicePaymentFailed({ attemptCount: 0 }));
    expect(inv.attempt_count).toBe(0);
  });
});
