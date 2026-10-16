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

  it('has number: null (numbers are assigned at finalization)', () => {
    const inv = invoiceObject(invoiceCreated());
    expect(inv.number).toBeNull();
  });

  it('finalized invoices have a number matching INV- pattern', () => {
    expect(invoiceObject(invoicePaid()).number).toMatch(/^INV-\d+/);
    expect(invoiceObject(invoicePaymentFailed()).number).toMatch(/^INV-\d+/);
  });

  it('omits fields removed in 2025-03-31.basil (paid, subscription, payment_intent, charge)', () => {
    const inv = invoiceObject(invoiceCreated()) as unknown as Record<string, unknown>;
    expect(inv).not.toHaveProperty('paid');
    expect(inv).not.toHaveProperty('subscription');
    expect(inv).not.toHaveProperty('payment_intent');
    expect(inv).not.toHaveProperty('charge');
  });

  it('omits includable-only payments list from the webhook payload', () => {
    const inv = invoiceObject(invoiceCreated()) as unknown as Record<string, unknown>;
    expect(inv).not.toHaveProperty('payments');
  });

  it('references the subscription via parent.subscription_details', () => {
    const inv = invoiceObject(invoiceCreated({ subscriptionId: 'sub_parent123' }));
    expect(inv.parent).not.toBeNull();
    expect(inv.parent!.type).toBe('subscription_details');
    expect(inv.parent!.quote_details).toBeNull();
    expect(inv.parent!.subscription_details!.subscription).toBe('sub_parent123');
  });

  it('draft invoice has no finalized_at or paid_at', () => {
    const inv = invoiceObject(invoiceCreated());
    expect(inv.status_transitions.finalized_at).toBeNull();
    expect(inv.status_transitions.paid_at).toBeNull();
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

  it('line item references price via pricing.price_details (basil shape)', () => {
    const line = invoiceObject(invoiceCreated({ amount: 4200 })).lines.data[0]!;
    expect(line.object).toBe('line_item');
    expect(line.id).toMatch(/^il_/);
    expect(line).not.toHaveProperty('price');
    expect(line).not.toHaveProperty('type');
    expect(line).not.toHaveProperty('subscription');
    expect(line.pricing).not.toBeNull();
    expect(line.pricing!.type).toBe('price_details');
    expect(line.pricing!.price_details.price).toMatch(/^price_/);
    expect(line.pricing!.price_details.product).toMatch(/^prod_/);
    expect(line.pricing!.unit_amount_decimal).toBe('4200');
  });

  it('line item parent is subscription_item_details linked to the invoice subscription', () => {
    const inv = invoiceObject(invoiceCreated({ subscriptionId: 'sub_line123' }));
    const line = inv.lines.data[0]!;
    expect(line.invoice).toBe(inv.id);
    expect(line.parent!.type).toBe('subscription_item_details');
    expect(line.parent!.invoice_item_details).toBeNull();
    expect(line.parent!.subscription_item_details!.subscription).toBe('sub_line123');
    expect(line.parent!.subscription_item_details!.subscription_item).toMatch(/^si_/);
    expect(line.parent!.subscription_item_details!.proration).toBe(false);
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

  it('records paid_at and finalized_at in status_transitions', () => {
    const inv = invoiceObject(invoicePaid({ timestamp: 1700000000 }));
    expect(inv.status_transitions.paid_at).toBe(1700000000);
    expect(inv.status_transitions.finalized_at).toBe(1700000000);
    expect(inv).not.toHaveProperty('paid');
  });

  it('invoice object has correct structure', () => {
    const inv = invoiceObject(invoicePaid());
    expect(inv.object).toBe('invoice');
    expect(inv.id).toMatch(/^in_/);
    expect(inv.lines.data).toHaveLength(1);
    expect(inv.lines.data[0]!.pricing!.price_details.price).toMatch(/^price_/);
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

  it('is finalized but has no paid_at', () => {
    const inv = invoiceObject(invoicePaymentFailed({ timestamp: 1700000000 }));
    expect(inv.status_transitions.finalized_at).toBe(1700000000);
    expect(inv.status_transitions.paid_at).toBeNull();
    expect(inv).not.toHaveProperty('paid');
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
    expect(inv.lines.data[0]!.pricing!.type).toBe('price_details');
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
    expect(inv.parent!.subscription_details!.subscription).toMatch(/^sub_/);
    expect(inv).not.toHaveProperty('payment_intent');
    expect(inv.lines.object).toBe('list');
    expect(inv.lines.data).toHaveLength(1);
    expect(inv.lines.data[0]!.pricing!.price_details.price).toMatch(/^price_/);
  });
});

describe('billing edge cases', () => {
  it('invoicePaid with amount: 0 has status paid (trial invoice)', () => {
    const inv = invoiceObject(invoicePaid({ amount: 0 }));
    expect(inv.amount_due).toBe(0);
    expect(inv.amount_paid).toBe(0);
    expect(inv.status).toBe('paid');
  });

  it('invoicePaymentFailed with attemptCount: 0 is accepted', () => {
    const inv = invoiceObject(invoicePaymentFailed({ attemptCount: 0 }));
    expect(inv.attempt_count).toBe(0);
  });
});
