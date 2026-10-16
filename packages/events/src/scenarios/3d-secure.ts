// Copyright 2026 Sutyr Inc. SPDX-License-Identifier: Apache-2.0
import type { ScenarioPreset } from '../types/index.js';
import {
  invoiceFinalized,
  invoicePaymentActionRequired,
  paymentIntentRequiresAction,
  invoicePaid,
  invoicePaymentPaid,
} from '../generators/index.js';
import { createSeededIdGenerator } from '../utils/ids.js';
import { continueInvoice, snapshot } from './continuity.js';

const HOUR = 3600;
const AMOUNT = 2000;

// An off-session subscription renewal where the card issuer asks for 3D
// Secure. Object state follows Stripe's docs:
// - Finalizing the renewal invoice creates its default PaymentIntent and
//   InvoicePayment, and Stripe attempts payment right away.
// - The PaymentIntent stops at requires_action and the invoice stays open
//   (invoice.payment_action_required). The customer is not in your app, so
//   they confirm later, for example from Stripe's hosted confirmation email.
//   Meanwhile the subscription is past_due (Subscription.status: "awaiting
//   additional user actions").
// - The customer authenticates, the PaymentIntent succeeds and the invoice is
//   paid. attempt_count stays 1: only automatic retries increment it.

export function threeDSecure(
  options?: { seed?: string },
): ScenarioPreset {
  const seed = options?.seed ?? '3d-secure';
  const ids = createSeededIdGenerator(seed);

  const cusId = ids.customerId();
  const subId = ids.subscriptionId();
  const inId = ids.invoiceId();
  const piId = ids.paymentIntentId();
  const chId = ids.chargeId();
  const pmId = ids.paymentMethodId();
  const invoicePaymentId = ids.generateId('inpay_');

  // The renewal invoice was created as a draft an hour before finalization.
  const finalizedAt = 1700000000 + HOUR;
  const attemptedAt = finalizedAt + 1;
  const authenticatedAt = attemptedAt + 2 * HOUR;
  const paidAt = authenticatedAt + 1;

  const invoice = {
    customerId: cusId,
    subscriptionId: subId,
    invoiceId: inId,
    amount: AMOUNT,
  };

  const finalized = invoiceFinalized({
    ...invoice,
    billingReason: 'subscription_cycle',
    timestamp: finalizedAt,
  });

  const actionRequired = continueInvoice(
    invoicePaymentActionRequired({
      ...invoice,
      billingReason: 'subscription_cycle',
      attemptCount: 1,
      timestamp: attemptedAt,
    }),
    finalized.data.object,
  );

  const requiresAction = paymentIntentRequiresAction({
    amount: AMOUNT,
    customerId: cusId,
    paymentIntentId: piId,
    paymentMethodId: pmId,
    timestamp: attemptedAt,
  });
  // The default PaymentIntent exists from finalization.
  requiresAction.data.object.created = finalizedAt;

  const succeeded = snapshot(
    'payment_intent.succeeded',
    requiresAction.data.object,
    {
      status: 'succeeded',
      amount_received: AMOUNT,
      latest_charge: chId,
      next_action: null,
    },
    { timestamp: authenticatedAt },
  );

  const paid = continueInvoice(
    invoicePaid({ ...invoice, timestamp: paidAt }),
    actionRequired.data.object,
  );

  const invoicePayment = invoicePaymentPaid({
    amount: AMOUNT,
    invoiceId: inId,
    invoicePaymentId,
    paymentIntentId: piId,
    timestamp: paidAt,
  });
  // The default InvoicePayment exists from finalization.
  invoicePayment.data.object.created = finalizedAt;

  return {
    id: '3d-secure',
    name: '3D Secure Authentication',
    description:
      'A subscription renewal needs 3D Secure: the invoice is finalized, the payment waits for the customer to authenticate, then the authenticated payment pays the invoice.',
    steps: [
      {
        event: finalized,
        delayMs: 0,
        description: 'Renewal invoice is finalized and payment is attempted',
      },
      {
        event: actionRequired,
        delayMs: 500,
        description: 'Card issuer asks for authentication, so the invoice needs customer action',
      },
      {
        event: requiresAction,
        delayMs: 100,
        description: 'Payment intent waits for the customer to complete 3D Secure',
      },
      {
        event: succeeded,
        delayMs: 3000,
        description: 'Customer authenticates and the payment succeeds',
      },
      {
        event: paid,
        delayMs: 500,
        description: 'Invoice is paid',
      },
      {
        event: invoicePayment,
        delayMs: 100,
        description: 'Invoice payment is marked paid',
      },
    ],
  };
}
