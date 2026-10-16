// Copyright 2026 Sutyr Inc. SPDX-License-Identifier: Apache-2.0
import { describe, it, expect } from 'vitest';
import {
  invoiceCreated,
  invoicePaid,
  invoicePaymentFailed,
  invoicePaymentSucceeded,
  invoiceUpcoming,
  invoiceFinalized,
  invoicePaymentActionRequired,
  invoiceMarkedUncollectible,
  invoiceOverdue,
  invoiceVoided,
} from '../../../src/generators/billing.js';
import { STRIPE_API_VERSION } from '../../../src/generators/envelope.js';

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

// ─── Shared lifecycle helpers ───────────────────────────────────────────────

const TS = 1760000000;
const HOUR = 3600;
const DAY = 86400;
const PERIOD = 30 * DAY;

// Fields removed in 2025-03-31.basil or includable only (never in webhooks).
const ABSENT_INVOICE_FIELDS = [
  'paid',
  'paid_out_of_band',
  'subscription',
  'payment_intent',
  'charge',
  'payments',
  'amount_paid_off_stripe',
  'confirmation_secret',
];

function asRecord(value: unknown): Record<string, unknown> {
  return value as Record<string, unknown>;
}

function expectNoAbsentInvoiceFields(inv: unknown) {
  for (const field of ABSENT_INVOICE_FIELDS) {
    expect(inv, `unexpected field ${field}`).not.toHaveProperty(field);
  }
}

// ─── Lifecycle fields on the existing generators ────────────────────────────

describe('existing invoice generators: lifecycle fields', () => {
  it('charge_automatically invoices have due_date: null', () => {
    for (const gen of [invoiceCreated, invoicePaid, invoicePaymentFailed, invoicePaymentSucceeded]) {
      expect(asRecord(gen().data.object).due_date).toBeNull();
    }
  });

  it('drafts have no hosted page or PDF', () => {
    const inv = invoiceCreated().data.object;
    expect(inv.hosted_invoice_url).toBeNull();
    expect(inv.invoice_pdf).toBeNull();
  });

  it('finalized invoices have a hosted page and PDF', () => {
    for (const gen of [invoicePaid, invoicePaymentFailed, invoicePaymentSucceeded]) {
      const inv = gen().data.object;
      expect(inv.hosted_invoice_url).toMatch(/^https:\/\/invoice\.stripe\.com\/i\/acct_[A-Za-z0-9]+\/test_[A-Za-z0-9]+\?s=ap$/);
      expect(inv.invoice_pdf).toMatch(/^https:\/\/pay\.stripe\.com\/invoice\/acct_[A-Za-z0-9]+\/test_[A-Za-z0-9]+\/pdf\?s=ap$/);
    }
  });

  it('status_details is absent unless the invoice is uncollectible', () => {
    for (const gen of [invoiceCreated, invoicePaid, invoicePaymentFailed, invoicePaymentSucceeded]) {
      expect(gen().data.object).not.toHaveProperty('status_details');
    }
  });
});

// ─── Full default Invoice shape (2026-09-30.endive) ─────────────────────────
// Every field the Invoice returns by default, checked against the OpenAPI
// spec and docs.stripe.com/api/invoices/object. Includable fields
// (`payments`, `amount_paid_off_stripe`, `confirmation_secret`) and
// `threshold_reason` (subscription_threshold invoices only) are not here;
// `status_details` is added only for uncollectible invoices.

const DEFAULT_INVOICE_KEYS = [
  'id', 'object', 'account_country', 'account_name', 'account_tax_ids', 'amount_due',
  'amount_overpaid', 'amount_paid', 'amount_remaining', 'amount_shipping', 'application',
  'attempt_count', 'attempted', 'auto_advance', 'automatic_tax', 'automatically_finalizes_at',
  'billing_reason', 'collection_method', 'created', 'currency', 'custom_fields', 'customer',
  'customer_account', 'customer_address', 'customer_email', 'customer_name', 'customer_phone',
  'customer_shipping', 'customer_tax_exempt', 'customer_tax_ids', 'default_payment_method',
  'default_source', 'default_tax_rates', 'description', 'discounts', 'due_date', 'effective_at',
  'ending_balance', 'footer', 'from_invoice', 'hosted_invoice_url', 'invoice_pdf', 'issuer',
  'last_finalization_error', 'latest_revision', 'lines', 'livemode', 'metadata',
  'next_payment_attempt', 'number', 'on_behalf_of', 'parent', 'payment_settings', 'period_end',
  'period_start', 'post_payment_credit_notes_amount', 'pre_payment_credit_notes_amount',
  'receipt_number', 'rendering', 'shipping_cost', 'shipping_details', 'starting_balance',
  'statement_descriptor', 'status', 'status_transitions', 'subtotal', 'subtotal_excluding_tax',
  'test_clock', 'total', 'total_discount_amounts', 'total_excluding_tax',
  'total_pretax_credit_amounts', 'total_taxes', 'webhooks_delivered_at',
].sort();

// `subscription` was removed from line items in 2025-03-31.basil.
const DEFAULT_LINE_ITEM_KEYS = [
  'id', 'object', 'amount', 'currency', 'description', 'discount_amounts', 'discountable',
  'discounts', 'invoice', 'livemode', 'metadata', 'parent', 'period', 'pretax_credit_amounts',
  'pricing', 'quantity', 'quantity_decimal', 'subtotal', 'taxes',
].sort();

describe('full default Invoice shape', () => {
  const finalizedInvoices = () => [
    invoicePaid().data.object,
    invoicePaymentFailed().data.object,
    invoicePaymentSucceeded().data.object,
    invoiceFinalized().data.object,
    invoicePaymentActionRequired().data.object,
    invoiceOverdue().data.object,
    invoiceVoided().data.object,
  ];

  it('every invoice event carries exactly the default Invoice fields', () => {
    for (const inv of [invoiceCreated().data.object, ...finalizedInvoices()]) {
      expect(Object.keys(inv).sort()).toEqual(DEFAULT_INVOICE_KEYS);
    }
  });

  it('an uncollectible invoice adds status_details and nothing else', () => {
    const keys = Object.keys(invoiceMarkedUncollectible().data.object).sort();
    expect(keys).toEqual([...DEFAULT_INVOICE_KEYS, 'status_details'].sort());
  });

  it('the upcoming preview has every default field except id', () => {
    const keys = Object.keys(invoiceUpcoming().data.object).sort();
    expect(keys).toEqual(DEFAULT_INVOICE_KEYS.filter((key) => key !== 'id'));
  });

  it('line items carry exactly the default line item fields', () => {
    for (const inv of [invoiceUpcoming().data.object, invoiceCreated().data.object, ...finalizedInvoices()]) {
      const line = inv.lines.data[0]!;
      expect(Object.keys(line).sort()).toEqual(DEFAULT_LINE_ITEM_KEYS);
      expect(line.quantity_decimal).toBe('1');
      expect(line.pretax_credit_amounts).toEqual([]);
    }
  });

  it('uses test-mode defaults for account, customer, tax and settings fields', () => {
    const inv = invoiceFinalized().data.object;
    expect(inv.account_country).toBe('US');
    expect(inv.account_name).toEqual(expect.any(String));
    expect(inv.customer_email).toBe('jane@example.com');
    expect(inv.customer_name).toBe('Jane Doe');
    expect(inv.customer_tax_exempt).toBe('none');
    expect(inv.customer_tax_ids).toEqual([]);
    expect(inv.issuer).toEqual({ type: 'self' });
    expect(inv.automatic_tax).toEqual({
      disabled_reason: null,
      enabled: false,
      liability: null,
      provider: null,
      status: null,
    });
    expect(inv.payment_settings).toEqual({
      default_mandate: null,
      payment_method_options: null,
      payment_method_types: null,
    });
    expect(inv.default_tax_rates).toEqual([]);
    expect(inv.discounts).toEqual([]);
    expect(inv.total_taxes).toEqual([]);
    expect(inv.starting_balance).toBe(0);
    expect(inv.amount_shipping).toBe(0);
    expect(inv.subtotal_excluding_tax).toBe(inv.subtotal);
    expect(inv.total_excluding_tax).toBe(inv.total);
    expect(inv.automatically_finalizes_at).toBeNull();
  });

  it('effective_at follows finalized_at; ending_balance and webhooks_delivered_at are set once finalized', () => {
    for (const inv of finalizedInvoices()) {
      expect(inv.effective_at).toBe(inv.status_transitions.finalized_at);
      expect(inv.ending_balance).toBe(0);
      expect(inv.webhooks_delivered_at).toBe(inv.created);
    }
    for (const inv of [invoiceCreated().data.object, invoiceUpcoming().data.object]) {
      expect(inv.effective_at).toBeNull();
      expect(inv.ending_balance).toBeNull();
      expect(inv.webhooks_delivered_at).toBeNull();
    }
  });

  it('auto_advance is off once an invoice is paid, void or uncollectible', () => {
    for (const inv of [
      invoicePaid().data.object,
      invoicePaymentSucceeded().data.object,
      invoiceVoided({ billingReason: 'subscription_cycle' }).data.object,
      invoiceMarkedUncollectible().data.object,
    ]) {
      expect(inv.auto_advance).toBe(false);
    }
  });

  it('auto_advance is on for renewal drafts, open renewals, overdue invoices and the preview', () => {
    for (const inv of [
      invoiceCreated().data.object,
      invoicePaymentFailed().data.object,
      invoiceFinalized().data.object,
      invoiceFinalized({ collectionMethod: 'send_invoice', billingReason: 'subscription_create' }).data.object,
      invoicePaymentActionRequired({ billingReason: 'subscription_cycle' }).data.object,
      invoiceOverdue().data.object,
      invoiceUpcoming().data.object,
    ]) {
      expect(inv.auto_advance).toBe(true);
    }
  });

  it('auto_advance is off on an open first invoice of a charge_automatically subscription', () => {
    expect(invoiceFinalized({ billingReason: 'subscription_create' }).data.object.auto_advance).toBe(false);
    expect(invoicePaymentActionRequired().data.object.auto_advance).toBe(false);
  });
});

// ─── invoiceUpcoming ────────────────────────────────────────────────────────

describe('invoiceUpcoming', () => {
  it('produces an invoice.upcoming event at the current API version', () => {
    const event = invoiceUpcoming();
    expect(event.type).toBe('invoice.upcoming');
    expect(event.object).toBe('event');
    expect(event.id).toMatch(/^evt_/);
    expect(event.api_version).toBe(STRIPE_API_VERSION);
    expect(event.livemode).toBe(false);
  });

  it('carries an invoice preview with no id key (absent, not null)', () => {
    const inv = asRecord(invoiceUpcoming().data.object);
    expect(inv.object).toBe('invoice');
    expect(inv).not.toHaveProperty('id');
    expect(JSON.stringify(inv)).not.toMatch(/"id":"in_/);
    expect(JSON.stringify(inv)).not.toContain('upcoming_in');
  });

  it('is a draft with no number and billing_reason upcoming', () => {
    const inv = invoiceUpcoming().data.object;
    expect(inv.status).toBe('draft');
    expect(inv.number).toBeNull();
    expect(inv.billing_reason).toBe('upcoming');
    expect(inv.attempted).toBe(false);
    expect(inv.attempt_count).toBe(0);
    expect(inv.amount_paid).toBe(0);
  });

  it('is charge_automatically with no due date, hosted page or transitions', () => {
    const inv = invoiceUpcoming().data.object;
    expect(inv.collection_method).toBe('charge_automatically');
    expect(inv.due_date).toBeNull();
    expect(inv.hosted_invoice_url).toBeNull();
    expect(inv.invoice_pdf).toBeNull();
    expect(inv.status_transitions).toEqual({
      finalized_at: null,
      marked_uncollectible_at: null,
      paid_at: null,
      voided_at: null,
    });
  });

  it('defaults the renewal to 7 days after the event and dates the preview at it', () => {
    const event = invoiceUpcoming({ timestamp: TS });
    const inv = event.data.object;
    expect(event.created).toBe(TS);
    expect(inv.period_end).toBe(TS + 7 * DAY);
    expect(inv.period_start).toBe(TS + 7 * DAY - PERIOD);
    expect(inv.created).toBe(inv.period_end);
    expect(inv.next_payment_attempt).toBe(inv.period_end + HOUR);
  });

  it('accepts periodEnd', () => {
    const inv = invoiceUpcoming({ timestamp: TS, periodEnd: TS + 3 * DAY }).data.object;
    expect(inv.period_end).toBe(TS + 3 * DAY);
    expect(inv.lines.data[0]!.period).toEqual({ start: TS + 3 * DAY, end: TS + 3 * DAY + PERIOD });
  });

  it('line items have temporary il_tmp_ IDs, invoice: null and a lines URL naming the customer and subscription', () => {
    const inv = invoiceUpcoming({ customerId: 'cus_up1', subscriptionId: 'sub_up1' }).data.object;
    const line = inv.lines.data[0]!;
    expect(line.id).toMatch(/^il_tmp_[A-Za-z0-9]+$/);
    expect(line.invoice).toBeNull();
    expect(line.parent!.subscription_item_details!.subscription).toBe('sub_up1');
    expect(inv.lines.url).toBe('/v1/invoices/upcoming/lines?customer=cus_up1&subscription=sub_up1');
  });

  it('propagates customerId, subscriptionId, amount, currency and metadata', () => {
    const inv = invoiceUpcoming({
      customerId: 'cus_up2',
      subscriptionId: 'sub_up2',
      amount: 4500,
      currency: 'eur',
      metadata: { plan: 'pro' },
    }).data.object;
    expect(inv.customer).toBe('cus_up2');
    expect(inv.parent!.subscription_details!.subscription).toBe('sub_up2');
    expect(inv.amount_due).toBe(4500);
    expect(inv.amount_remaining).toBe(4500);
    expect(inv.total).toBe(4500);
    expect(inv.currency).toBe('eur');
    expect(inv.lines.data[0]!.currency).toBe('eur');
    expect(inv.metadata).toEqual({ plan: 'pro' });
  });

  it('omits removed and includable fields, status_details and previous_attributes', () => {
    const event = invoiceUpcoming();
    expectNoAbsentInvoiceFields(event.data.object);
    expect(event.data.object).not.toHaveProperty('status_details');
    expect(event.data).not.toHaveProperty('previous_attributes');
  });
});

// ─── invoiceFinalized ───────────────────────────────────────────────────────

describe('invoiceFinalized', () => {
  it('produces an invoice.finalized event at the current API version', () => {
    const event = invoiceFinalized();
    expect(event.type).toBe('invoice.finalized');
    expect(event.id).toMatch(/^evt_/);
    expect(event.api_version).toBe(STRIPE_API_VERSION);
  });

  it('is an open invoice with an in_ id, a number and hosted URLs', () => {
    const inv = invoiceFinalized().data.object;
    expect(inv.object).toBe('invoice');
    expect(inv.id).toMatch(/^in_/);
    expect(inv.status).toBe('open');
    expect(inv.number).toMatch(/^INV-\d+/);
    expect(inv.hosted_invoice_url).toMatch(/^https:\/\/invoice\.stripe\.com\/i\//);
    expect(inv.invoice_pdf).toMatch(/\/pdf\?s=ap$/);
    expect(inv.lines.url).toBe(`/v1/invoices/${inv.id}/lines`);
    expect(inv.lines.data[0]!.invoice).toBe(inv.id);
  });

  it('has not been attempted yet', () => {
    const inv = invoiceFinalized({ amount: 1200 }).data.object;
    expect(inv.attempted).toBe(false);
    expect(inv.attempt_count).toBe(0);
    expect(inv.amount_paid).toBe(0);
    expect(inv.amount_remaining).toBe(1200);
  });

  it('records finalized_at at the event time after about an hour in draft', () => {
    const inv = invoiceFinalized({ timestamp: TS }).data.object;
    expect(inv.status_transitions).toEqual({
      finalized_at: TS,
      marked_uncollectible_at: null,
      paid_at: null,
      voided_at: null,
    });
    expect(inv.created).toBe(TS - HOUR);
    expect(inv.billing_reason).toBe('subscription_cycle');
  });

  it('finalizes a charge_automatically subscription_create invoice at creation', () => {
    const inv = invoiceFinalized({ timestamp: TS, billingReason: 'subscription_create' }).data.object;
    expect(inv.billing_reason).toBe('subscription_create');
    expect(inv.created).toBe(TS);
    expect(inv.period_start).toBe(inv.period_end);
  });

  it('schedules no attempt on a first invoice: subscription creation collects payment itself', () => {
    const inv = invoiceFinalized({ timestamp: TS, billingReason: 'subscription_create' }).data.object;
    expect(inv.auto_advance).toBe(false);
    expect(inv.next_payment_attempt).toBeNull();
  });

  it('a subscription_update invoice is finalized at creation with auto_advance off', () => {
    for (const collectionMethod of ['charge_automatically', 'send_invoice'] as const) {
      const inv = invoiceFinalized({
        timestamp: TS,
        billingReason: 'subscription_update',
        collectionMethod,
      }).data.object;
      expect(inv.created).toBe(TS);
      expect(inv.auto_advance).toBe(false);
      expect(inv.next_payment_attempt).toBeNull();
    }
  });

  it('charge_automatically: no due date, payment attempted right after finalization', () => {
    const inv = invoiceFinalized({ timestamp: TS }).data.object;
    expect(inv.collection_method).toBe('charge_automatically');
    expect(inv.due_date).toBeNull();
    expect(inv.next_payment_attempt).toBe(TS);
  });

  it('send_invoice: due 30 days after finalization by default, no automatic attempt', () => {
    const inv = invoiceFinalized({ timestamp: TS, collectionMethod: 'send_invoice' }).data.object;
    expect(inv.collection_method).toBe('send_invoice');
    expect(inv.due_date).toBe(TS + 30 * DAY);
    expect(inv.next_payment_attempt).toBeNull();
  });

  it('send_invoice subscription_create invoices still spend an hour in draft', () => {
    const inv = invoiceFinalized({
      timestamp: TS,
      billingReason: 'subscription_create',
      collectionMethod: 'send_invoice',
    }).data.object;
    expect(inv.created).toBe(TS - HOUR);
  });

  it('accepts dueDate for send_invoice and ignores it for charge_automatically', () => {
    const due = TS + 14 * DAY;
    expect(invoiceFinalized({ collectionMethod: 'send_invoice', dueDate: due }).data.object.due_date).toBe(due);
    expect(invoiceFinalized({ dueDate: due }).data.object.due_date).toBeNull();
  });

  it('propagates invoiceId, customerId, subscriptionId, currency and metadata', () => {
    const inv = invoiceFinalized({
      invoiceId: 'in_fin1',
      customerId: 'cus_fin1',
      subscriptionId: 'sub_fin1',
      currency: 'gbp',
      metadata: { order: '42' },
    }).data.object;
    expect(inv.id).toBe('in_fin1');
    expect(inv.customer).toBe('cus_fin1');
    expect(inv.parent!.subscription_details!.subscription).toBe('sub_fin1');
    expect(inv.currency).toBe('gbp');
    expect(inv.metadata).toEqual({ order: '42' });
  });

  it('omits removed and includable fields, status_details and previous_attributes', () => {
    const event = invoiceFinalized();
    expectNoAbsentInvoiceFields(event.data.object);
    expect(event.data.object).not.toHaveProperty('status_details');
    expect(event.data).not.toHaveProperty('previous_attributes');
  });
});

// ─── invoicePaymentActionRequired ───────────────────────────────────────────

describe('invoicePaymentActionRequired', () => {
  it('produces an invoice.payment_action_required event at the current API version', () => {
    const event = invoicePaymentActionRequired();
    expect(event.type).toBe('invoice.payment_action_required');
    expect(event.id).toMatch(/^evt_/);
    expect(event.api_version).toBe(STRIPE_API_VERSION);
  });

  it('is an open, attempted, unpaid charge_automatically invoice', () => {
    const inv = invoicePaymentActionRequired({ amount: 8000 }).data.object;
    expect(inv.object).toBe('invoice');
    expect(inv.id).toMatch(/^in_/);
    expect(inv.status).toBe('open');
    expect(inv.attempted).toBe(true);
    expect(inv.attempt_count).toBe(1);
    expect(inv.amount_paid).toBe(0);
    expect(inv.amount_remaining).toBe(8000);
    expect(inv.collection_method).toBe('charge_automatically');
    expect(inv.due_date).toBeNull();
    expect(inv.hosted_invoice_url).toMatch(/^https:\/\/invoice\.stripe\.com\//);
  });

  it('defaults to the first invoice of a subscription, with no automatic attempt scheduled', () => {
    const inv = invoicePaymentActionRequired({ timestamp: TS }).data.object;
    expect(inv.billing_reason).toBe('subscription_create');
    expect(inv.next_payment_attempt).toBeNull();
    expect(inv.created).toBe(TS);
    expect(inv.status_transitions.finalized_at).toBe(TS);
    expect(inv.status_transitions.paid_at).toBeNull();
    expect(inv.period_start).toBe(inv.period_end);
  });

  it('supports an off-session renewal that keeps a scheduled attempt', () => {
    const inv = invoicePaymentActionRequired({ timestamp: TS, billingReason: 'subscription_cycle' }).data.object;
    expect(inv.billing_reason).toBe('subscription_cycle');
    expect(inv.created).toBe(TS - HOUR);
    expect(inv.next_payment_attempt).toBeGreaterThan(TS);
  });

  it('accepts attemptCount', () => {
    expect(invoicePaymentActionRequired({ attemptCount: 2 }).data.object.attempt_count).toBe(2);
  });

  it('propagates invoiceId, customerId, subscriptionId and currency', () => {
    const inv = invoicePaymentActionRequired({
      invoiceId: 'in_sca1',
      customerId: 'cus_sca1',
      subscriptionId: 'sub_sca1',
      currency: 'eur',
    }).data.object;
    expect(inv.id).toBe('in_sca1');
    expect(inv.customer).toBe('cus_sca1');
    expect(inv.parent!.subscription_details!.subscription).toBe('sub_sca1');
    expect(inv.currency).toBe('eur');
  });

  it('carries no PaymentIntent, decline code or previous_attributes', () => {
    const event = invoicePaymentActionRequired();
    expectNoAbsentInvoiceFields(event.data.object);
    expect(JSON.stringify(event)).not.toContain('decline_code');
    expect(JSON.stringify(event)).not.toMatch(/"pi_/);
    expect(event.data.object).not.toHaveProperty('status_details');
    expect(event.data).not.toHaveProperty('previous_attributes');
  });
});

// ─── invoiceMarkedUncollectible ─────────────────────────────────────────────

describe('invoiceMarkedUncollectible', () => {
  it('produces an invoice.marked_uncollectible event at the current API version', () => {
    const event = invoiceMarkedUncollectible();
    expect(event.type).toBe('invoice.marked_uncollectible');
    expect(event.id).toMatch(/^evt_/);
    expect(event.api_version).toBe(STRIPE_API_VERSION);
  });

  it('has status uncollectible with marked_uncollectible_at at the event time', () => {
    const inv = invoiceMarkedUncollectible({ timestamp: TS }).data.object;
    expect(inv.object).toBe('invoice');
    expect(inv.id).toMatch(/^in_/);
    expect(inv.status).toBe('uncollectible');
    expect(inv.status_transitions.marked_uncollectible_at).toBe(TS);
    expect(inv.status_transitions.finalized_at).toBeLessThan(TS);
    expect(inv.status_transitions.paid_at).toBeNull();
    expect(inv.status_transitions.voided_at).toBeNull();
    expect(inv.number).toMatch(/^INV-\d+/);
  });

  it('is unpaid with nothing more scheduled', () => {
    const inv = invoiceMarkedUncollectible({ amount: 3100 }).data.object;
    expect(inv.amount_paid).toBe(0);
    expect(inv.amount_due).toBe(3100);
    expect(inv.amount_remaining).toBe(3100);
    expect(inv.next_payment_attempt).toBeNull();
    expect(inv.attempted).toBe(true);
  });

  it('explains why in status_details.uncollectible.reason, defaulting to max_payment_attempts', () => {
    const inv = invoiceMarkedUncollectible().data.object;
    expect(inv.status_details).toEqual({ uncollectible: { reason: 'max_payment_attempts' } });
    expect(inv.attempt_count).toBe(4);
  });

  it('accepts reason and attemptCount', () => {
    const inv = invoiceMarkedUncollectible({ reason: 'user_forgiven', attemptCount: 1 }).data.object;
    expect(inv.status_details!.uncollectible!.reason).toBe('user_forgiven');
    expect(inv.attempt_count).toBe(1);
  });

  it('accepts reason: null for an invoice with no supported reason', () => {
    const inv = invoiceMarkedUncollectible({ reason: null }).data.object;
    expect(inv.status_details).toEqual({ uncollectible: { reason: null } });
  });

  it('charge_automatically: created two weeks before the event, no due date', () => {
    const inv = invoiceMarkedUncollectible({ timestamp: TS }).data.object;
    expect(inv.collection_method).toBe('charge_automatically');
    expect(inv.due_date).toBeNull();
    expect(inv.created).toBe(TS - 14 * DAY);
    expect(inv.status_transitions.finalized_at).toBe(TS - 14 * DAY + HOUR);
  });

  it('send_invoice: past due, never charged, payment_not_received by default', () => {
    const inv = invoiceMarkedUncollectible({ timestamp: TS, collectionMethod: 'send_invoice' }).data.object;
    expect(inv.collection_method).toBe('send_invoice');
    expect(inv.due_date).toBe(TS - 14 * DAY);
    expect(inv.status_transitions.finalized_at).toBe(inv.due_date! - 30 * DAY);
    expect(inv.attempt_count).toBe(0);
    expect(inv.status_details!.uncollectible!.reason).toBe('payment_not_received');
  });

  it('propagates invoiceId, customerId, subscriptionId and currency', () => {
    const inv = invoiceMarkedUncollectible({
      invoiceId: 'in_unc1',
      customerId: 'cus_unc1',
      subscriptionId: 'sub_unc1',
      currency: 'jpy',
    }).data.object;
    expect(inv.id).toBe('in_unc1');
    expect(inv.customer).toBe('cus_unc1');
    expect(inv.parent!.subscription_details!.subscription).toBe('sub_unc1');
    expect(inv.currency).toBe('jpy');
  });

  it('omits removed and includable fields and previous_attributes', () => {
    const event = invoiceMarkedUncollectible();
    expectNoAbsentInvoiceFields(event.data.object);
    expect(event.data).not.toHaveProperty('previous_attributes');
  });
});

// ─── invoiceOverdue ─────────────────────────────────────────────────────────

describe('invoiceOverdue', () => {
  it('produces an invoice.overdue event at the current API version', () => {
    const event = invoiceOverdue();
    expect(event.type).toBe('invoice.overdue');
    expect(event.id).toMatch(/^evt_/);
    expect(event.api_version).toBe(STRIPE_API_VERSION);
  });

  it('is an open send_invoice invoice past its due date', () => {
    const inv = invoiceOverdue({ timestamp: TS }).data.object;
    expect(inv.object).toBe('invoice');
    expect(inv.id).toMatch(/^in_/);
    expect(inv.status).toBe('open');
    expect(inv.collection_method).toBe('send_invoice');
    expect(inv.due_date).toBe(TS - DAY);
    expect(inv.due_date!).toBeLessThan(TS);
  });

  it('is never charged automatically', () => {
    const inv = invoiceOverdue().data.object;
    expect(inv.next_payment_attempt).toBeNull();
    expect(inv.attempt_count).toBe(0);
    expect(inv.amount_paid).toBe(0);
    expect(inv.amount_remaining).toBe(inv.amount_due);
  });

  it('was finalized 30 days before the due date, after an hour in draft', () => {
    const inv = invoiceOverdue({ timestamp: TS }).data.object;
    expect(inv.status_transitions.finalized_at).toBe(TS - DAY - 30 * DAY);
    expect(inv.created).toBe(inv.status_transitions.finalized_at! - HOUR);
    expect(inv.status_transitions.paid_at).toBeNull();
    expect(inv.hosted_invoice_url).toMatch(/^https:\/\/invoice\.stripe\.com\//);
  });

  it('accepts dueDate and billingReason', () => {
    const inv = invoiceOverdue({
      timestamp: TS,
      dueDate: TS - 10 * DAY,
      billingReason: 'subscription_create',
    }).data.object;
    expect(inv.due_date).toBe(TS - 10 * DAY);
    expect(inv.billing_reason).toBe('subscription_create');
  });

  it('propagates invoiceId, customerId, subscriptionId, amount and currency', () => {
    const inv = invoiceOverdue({
      invoiceId: 'in_due1',
      customerId: 'cus_due1',
      subscriptionId: 'sub_due1',
      amount: 99000,
      currency: 'usd',
    }).data.object;
    expect(inv.id).toBe('in_due1');
    expect(inv.customer).toBe('cus_due1');
    expect(inv.parent!.subscription_details!.subscription).toBe('sub_due1');
    expect(inv.amount_due).toBe(99000);
  });

  it('omits removed and includable fields, status_details and previous_attributes', () => {
    const event = invoiceOverdue();
    expectNoAbsentInvoiceFields(event.data.object);
    expect(event.data.object).not.toHaveProperty('status_details');
    expect(event.data).not.toHaveProperty('previous_attributes');
  });
});

// ─── invoiceVoided ──────────────────────────────────────────────────────────

describe('invoiceVoided', () => {
  it('produces an invoice.voided event at the current API version', () => {
    const event = invoiceVoided();
    expect(event.type).toBe('invoice.voided');
    expect(event.id).toMatch(/^evt_/);
    expect(event.api_version).toBe(STRIPE_API_VERSION);
  });

  it('has status void with voided_at at the event time and a prior finalization', () => {
    const inv = invoiceVoided({ timestamp: TS }).data.object;
    expect(inv.object).toBe('invoice');
    expect(inv.id).toMatch(/^in_/);
    expect(inv.status).toBe('void');
    expect(inv.status_transitions.voided_at).toBe(TS);
    expect(inv.status_transitions.finalized_at).toBeLessThan(TS);
    expect(inv.status_transitions.paid_at).toBeNull();
    expect(inv.status_transitions.marked_uncollectible_at).toBeNull();
    expect(inv.number).toMatch(/^INV-\d+/);
  });

  it('keeps the unpaid balance and schedules nothing', () => {
    const inv = invoiceVoided({ amount: 2500 }).data.object;
    expect(inv.amount_paid).toBe(0);
    expect(inv.amount_remaining).toBe(2500);
    expect(inv.next_payment_attempt).toBeNull();
  });

  it('defaults to a first invoice voided 23 hours after creation', () => {
    const inv = invoiceVoided({ timestamp: TS }).data.object;
    expect(inv.billing_reason).toBe('subscription_create');
    expect(inv.collection_method).toBe('charge_automatically');
    expect(inv.created).toBe(TS - 23 * HOUR);
    expect(inv.status_transitions.finalized_at).toBe(inv.created);
    expect(inv.attempt_count).toBe(1);
    expect(inv.attempted).toBe(true);
    expect(inv.due_date).toBeNull();
  });

  it('accepts billingReason and attemptCount', () => {
    const inv = invoiceVoided({ timestamp: TS, billingReason: 'subscription_cycle', attemptCount: 3 }).data.object;
    expect(inv.billing_reason).toBe('subscription_cycle');
    expect(inv.status_transitions.finalized_at).toBe(inv.created + HOUR);
    expect(inv.attempt_count).toBe(3);
  });

  it('send_invoice: due 30 days after finalization, never charged', () => {
    const inv = invoiceVoided({ timestamp: TS, collectionMethod: 'send_invoice' }).data.object;
    expect(inv.collection_method).toBe('send_invoice');
    expect(inv.due_date).toBe(inv.status_transitions.finalized_at! + 30 * DAY);
    expect(inv.attempt_count).toBe(0);
  });

  it('propagates invoiceId, customerId, subscriptionId, currency and metadata', () => {
    const inv = invoiceVoided({
      invoiceId: 'in_void1',
      customerId: 'cus_void1',
      subscriptionId: 'sub_void1',
      currency: 'eur',
      metadata: { source: 'test' },
    }).data.object;
    expect(inv.id).toBe('in_void1');
    expect(inv.customer).toBe('cus_void1');
    expect(inv.parent!.subscription_details!.subscription).toBe('sub_void1');
    expect(inv.currency).toBe('eur');
    expect(inv.metadata).toEqual({ source: 'test' });
  });

  it('omits removed and includable fields, status_details and previous_attributes', () => {
    const event = invoiceVoided();
    expectNoAbsentInvoiceFields(event.data.object);
    expect(event.data.object).not.toHaveProperty('status_details');
    expect(event.data).not.toHaveProperty('previous_attributes');
  });
});

// ─── Shared IDs across the lifecycle ────────────────────────────────────────

describe('invoice lifecycle shared IDs', () => {
  it('the same invoice can move from finalized to action required to voided', () => {
    const ids = { invoiceId: 'in_life1', customerId: 'cus_life1', subscriptionId: 'sub_life1' };
    const events = [
      invoiceFinalized({ ...ids, billingReason: 'subscription_create' }),
      invoicePaymentActionRequired(ids),
      invoiceVoided(ids),
    ];
    for (const event of events) {
      const inv = event.data.object;
      expect(inv.id).toBe('in_life1');
      expect(inv.customer).toBe('cus_life1');
      expect(inv.parent!.subscription_details!.subscription).toBe('sub_life1');
    }
  });

  it('every generated invoice timestamp is in Unix seconds', () => {
    const invoices = [
      invoiceUpcoming({ timestamp: TS }).data.object,
      invoiceFinalized({ timestamp: TS }).data.object,
      invoicePaymentActionRequired({ timestamp: TS }).data.object,
      invoiceMarkedUncollectible({ timestamp: TS }).data.object,
      invoiceOverdue({ timestamp: TS }).data.object,
      invoiceVoided({ timestamp: TS }).data.object,
    ];
    for (const inv of invoices) {
      for (const value of [inv.created, inv.period_start, inv.period_end]) {
        expect(Number.isInteger(value)).toBe(true);
        expect(value).toBeGreaterThan(1577836800);
        expect(value).toBeLessThan(1893456000);
      }
    }
  });
});
