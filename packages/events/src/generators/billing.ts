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
  paymentIntentId,
  invoiceLineItemId,
  priceId,
  productId,
  subscriptionItemId,
} from '../utils/ids.js';
import { now, futureHours } from '../utils/timestamps.js';

// ─── Helpers ────────────────────────────────────────────────────────────────

function buildLineItem(
  amount: number,
  currency: string,
  subId: string,
  timestamp: number,
): StripeInvoiceLineItem {
  const pId = priceId();
  const prodId = productId();
  const siId = subscriptionItemId();

  return {
    id: invoiceLineItemId(),
    object: 'line_item',
    amount,
    currency,
    description: 'Subscription update',
    price: {
      id: pId,
      object: 'price',
      product: prodId,
      unit_amount: amount,
      currency,
      recurring: {
        interval: 'month',
        interval_count: 1,
        usage_type: 'licensed',
      },
      type: 'recurring',
      active: true,
      created: timestamp,
      livemode: false,
    },
    quantity: 1,
    subscription: subId,
    subscription_item: siId,
    type: 'subscription',
    period: {
      start: timestamp,
      end: timestamp + 30 * 86400,
    },
  };
}

function buildInvoice(opts: {
  status: StripeInvoice['status'];
  paid: boolean;
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
  paymentIntentId?: string;
  timestamp?: number;
  metadata?: Record<string, string>;
}): StripeInvoice {
  const ts = opts.timestamp ?? now();
  const invId = opts.invoiceId ?? invoiceId();
  const cusId = opts.customerId ?? customerId();
  const subId = opts.subscriptionId ?? subscriptionId();
  const piId = opts.paymentIntentId ?? paymentIntentId();
  const lineItem = buildLineItem(opts.amount, opts.currency, subId, ts);

  // Derive invoice number from ID suffix
  const idSuffix = invId.replace('in_', '');
  const numericHash = Array.from(idSuffix.slice(0, 4)).reduce((acc, c) => acc + c.charCodeAt(0), 0);
  const invoiceNumber = `INV-${String(numericHash % 10000).padStart(4, '0')}`;

  return {
    id: invId,
    object: 'invoice',
    number: invoiceNumber,
    paid: opts.paid,
    status: opts.status,
    amount_due: opts.amount,
    amount_paid: opts.amountPaid,
    amount_remaining: opts.amountRemaining,
    attempt_count: opts.attemptCount,
    attempted: opts.attempted,
    next_payment_attempt: opts.nextPaymentAttempt,
    subscription: subId,
    payment_intent: piId,
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
    paid: false,
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
    paymentIntentId: options?.paymentIntentId,
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
    paid: true,
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
    paymentIntentId: options?.paymentIntentId,
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
    paid: false,
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
    paymentIntentId: options?.paymentIntentId,
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
    paid: true,
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
    paymentIntentId: options?.paymentIntentId,
    timestamp: options?.timestamp,
    metadata: options?.metadata,
  });

  return wrapInEvent('invoice.payment_succeeded', invoice, {
    timestamp: options?.timestamp,
  });
}
