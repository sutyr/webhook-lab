// Copyright 2026 Sutyr Inc. SPDX-License-Identifier: Apache-2.0
import type { StripeEvent } from '../types/index.js';
import type {
  StripeInvoicePayment,
  StripeInvoicePaymentAssociatedPayment,
  InvoicePaymentPaidOptions,
} from '../types/invoices.js';
import { wrapInEvent } from './envelope.js';
import {
  generateId,
  invoiceId,
  paymentIntentId,
  chargeId,
} from '../utils/ids.js';
import { now } from '../utils/timestamps.js';

// ─── Helpers ────────────────────────────────────────────────────────────────
// Since 2025-03-31.basil the Invoice no longer carries `payment_intent` or
// `charge`. An InvoicePayment links the two: `invoice` names the invoice and
// `payment` names what paid it. Only the key matching `payment.type` is
// present; the others are absent, not null. InvoicePayment has no `customer`
// and no `metadata`.

const invoicePaymentId = () => generateId('inpay_');

function buildPayment(options?: InvoicePaymentPaidOptions): StripeInvoicePaymentAssociatedPayment {
  if (options?.paymentType === 'charge') {
    return { type: 'charge', charge: options.chargeId ?? chargeId() };
  }
  return {
    type: 'payment_intent',
    payment_intent: options?.paymentIntentId ?? paymentIntentId(),
  };
}

// ─── Generators ─────────────────────────────────────────────────────────────

/**
 * An InvoicePayment reached `paid`. Stripe creates the default InvoicePayment
 * (`is_default: true`) when the invoice is finalized and keeps it in sync with
 * the invoice's `amount_remaining`.
 */
export function invoicePaymentPaid(
  options?: InvoicePaymentPaidOptions,
): StripeEvent<StripeInvoicePayment> {
  const amountRequested = options?.amount ?? 2999;
  const ts = options?.timestamp ?? now();

  const invoicePayment: StripeInvoicePayment = {
    id: options?.invoicePaymentId ?? invoicePaymentId(),
    object: 'invoice_payment',
    amount_paid: options?.amountPaid ?? amountRequested,
    amount_requested: amountRequested,
    created: ts,
    currency: options?.currency ?? 'usd',
    invoice: options?.invoiceId ?? invoiceId(),
    is_default: options?.isDefault ?? true,
    livemode: false,
    payment: buildPayment(options),
    status: 'paid',
    status_transitions: {
      canceled_at: null,
      paid_at: ts,
    },
  };

  return wrapInEvent('invoice_payment.paid', invoicePayment, { timestamp: ts });
}
