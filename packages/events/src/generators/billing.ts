// Copyright 2026 Sutyr Inc. SPDX-License-Identifier: Apache-2.0
import type {
  StripeInvoice,
  StripeInvoiceLineItem,
  StripeEvent,
  InvoiceCreatedOptions,
  InvoicePaidOptions,
  InvoicePaymentFailedOptions,
  InvoicePaymentSucceededOptions,
} from '../types/index.js';
import { wrapInEvent } from './envelope.js';
import {
  invoiceId,
  customerId,
  subscriptionId,
  invoiceLineItemId,
  priceId,
  productId,
  subscriptionItemId,
} from '../utils/ids.js';
import { now, futureHours } from '../utils/timestamps.js';

// ─── Helpers ────────────────────────────────────────────────────────────────
// Shapes follow the post-2025-03-31.basil Invoice: no `paid`, `subscription`,
// `payment_intent` or `charge` fields. The subscription lives under
// `parent.subscription_details.subscription`; line items reference their price
// via `pricing.price_details` and their subscription via
// `parent.subscription_item_details`. `payments` is includable only, so it is
// absent from webhook payloads.

const PERIOD_SECONDS = 30 * 86400;

function buildLineItem(
  amount: number,
  currency: string,
  invId: string,
  subId: string,
  timestamp: number,
): StripeInvoiceLineItem {
  return {
    id: invoiceLineItemId(),
    object: 'line_item',
    amount,
    currency,
    description: '1 × Subscription',
    discount_amounts: [],
    discountable: true,
    discounts: [],
    invoice: invId,
    livemode: false,
    metadata: {},
    parent: {
      type: 'subscription_item_details',
      invoice_item_details: null,
      subscription_item_details: {
        invoice_item: null,
        proration: false,
        proration_details: { credited_items: null },
        subscription: subId,
        subscription_item: subscriptionItemId(),
      },
    },
    period: {
      start: timestamp,
      end: timestamp + PERIOD_SECONDS,
    },
    pricing: {
      type: 'price_details',
      price_details: {
        price: priceId(),
        product: productId(),
      },
      unit_amount_decimal: String(amount),
    },
    quantity: 1,
    subtotal: amount,
    taxes: [],
  };
}

function buildInvoice(opts: {
  status: StripeInvoice['status'];
  amount: number;
  currency: string;
  amountPaid: number;
  amountRemaining: number;
  attemptCount: number;
  attempted: boolean;
  nextPaymentAttempt: number | null;
  billingReason: StripeInvoice['billing_reason'];
  customerId?: string;
  subscriptionId?: string;
  invoiceId?: string;
  timestamp?: number;
  metadata?: Record<string, string>;
}): StripeInvoice {
  const ts = opts.timestamp ?? now();
  const invId = opts.invoiceId ?? invoiceId();
  const cusId = opts.customerId ?? customerId();
  const subId = opts.subscriptionId ?? subscriptionId();
  const lineItem = buildLineItem(opts.amount, opts.currency, invId, subId, ts);
  const finalized = opts.status !== 'draft';

  // Invoice numbers are assigned at finalization; drafts have number: null.
  const idSuffix = invId.replace('in_', '');
  const numericHash = Array.from(idSuffix.slice(0, 4)).reduce((acc, c) => acc + c.charCodeAt(0), 0);
  const invoiceNumber = finalized ? `INV-${String(numericHash % 10000).padStart(4, '0')}` : null;

  // A subscription_create invoice covers no elapsed period; a cycle invoice
  // closes the period that just ended.
  const periodStart = opts.billingReason === 'subscription_create' ? ts : ts - PERIOD_SECONDS;

  return {
    id: invId,
    object: 'invoice',
    number: invoiceNumber,
    status: opts.status,
    amount_due: opts.amount,
    amount_overpaid: 0,
    amount_paid: opts.amountPaid,
    amount_remaining: opts.amountRemaining,
    attempt_count: opts.attemptCount,
    attempted: opts.attempted,
    next_payment_attempt: opts.nextPaymentAttempt,
    parent: {
      type: 'subscription_details',
      quote_details: null,
      subscription_details: {
        metadata: {},
        subscription: subId,
      },
    },
    customer: cusId,
    collection_method: 'charge_automatically',
    billing_reason: opts.billingReason,
    currency: opts.currency,
    lines: {
      object: 'list',
      data: [lineItem],
      has_more: false,
      total_count: 1,
      url: `/v1/invoices/${invId}/lines`,
    },
    period_start: periodStart,
    period_end: ts,
    status_transitions: {
      finalized_at: finalized ? ts : null,
      marked_uncollectible_at: null,
      paid_at: opts.status === 'paid' ? ts : null,
      voided_at: null,
    },
    subtotal: opts.amount,
    total: opts.amount,
    hosted_invoice_url: null,
    invoice_pdf: null,
    metadata: opts.metadata ?? {},
    created: ts,
    livemode: false,
  };
}

// ─── Generators ─────────────────────────────────────────────────────────────

export function invoiceCreated(
  options?: InvoiceCreatedOptions,
): StripeEvent<StripeInvoice> {
  const amount = options?.amount ?? 2999;
  const currency = options?.currency ?? 'usd';

  const invoice = buildInvoice({
    status: 'draft',
    amount,
    currency,
    amountPaid: 0,
    amountRemaining: amount,
    attemptCount: 0,
    attempted: false,
    nextPaymentAttempt: null,
    billingReason: options?.billingReason ?? 'subscription_cycle',
    customerId: options?.customerId,
    subscriptionId: options?.subscriptionId,
    invoiceId: options?.invoiceId,
    timestamp: options?.timestamp,
    metadata: options?.metadata,
  });

  return wrapInEvent('invoice.created', invoice, {
    timestamp: options?.timestamp,
  });
}

export function invoicePaid(
  options?: InvoicePaidOptions,
): StripeEvent<StripeInvoice> {
  const amount = options?.amount ?? 2999;
  const currency = options?.currency ?? 'usd';

  const invoice = buildInvoice({
    status: 'paid',
    amount,
    currency,
    amountPaid: amount,
    amountRemaining: 0,
    attemptCount: 1,
    attempted: true,
    nextPaymentAttempt: null,
    billingReason: 'subscription_cycle',
    customerId: options?.customerId,
    subscriptionId: options?.subscriptionId,
    invoiceId: options?.invoiceId,
    timestamp: options?.timestamp,
    metadata: options?.metadata,
  });

  return wrapInEvent('invoice.paid', invoice, {
    timestamp: options?.timestamp,
  });
}

export function invoicePaymentFailed(
  options?: InvoicePaymentFailedOptions,
): StripeEvent<StripeInvoice> {
  const amount = options?.amount ?? 2999;
  const currency = options?.currency ?? 'usd';

  const invoice = buildInvoice({
    status: 'open',
    amount,
    currency,
    amountPaid: 0,
    amountRemaining: amount,
    attemptCount: options?.attemptCount ?? 1,
    attempted: true,
    nextPaymentAttempt: futureHours(24),
    billingReason: 'subscription_cycle',
    customerId: options?.customerId,
    subscriptionId: options?.subscriptionId,
    invoiceId: options?.invoiceId,
    timestamp: options?.timestamp,
    metadata: options?.metadata,
  });

  return wrapInEvent('invoice.payment_failed', invoice, {
    timestamp: options?.timestamp,
  });
}

export function invoicePaymentSucceeded(
  options?: InvoicePaymentSucceededOptions,
): StripeEvent<StripeInvoice> {
  const amount = options?.amount ?? 2999;
  const currency = options?.currency ?? 'usd';

  const invoice = buildInvoice({
    status: 'paid',
    amount,
    currency,
    amountPaid: amount,
    amountRemaining: 0,
    attemptCount: 1,
    attempted: true,
    nextPaymentAttempt: null,
    billingReason: 'subscription_cycle',
    customerId: options?.customerId,
    subscriptionId: options?.subscriptionId,
    invoiceId: options?.invoiceId,
    timestamp: options?.timestamp,
    metadata: options?.metadata,
  });

  return wrapInEvent('invoice.payment_succeeded', invoice, {
    timestamp: options?.timestamp,
  });
}
