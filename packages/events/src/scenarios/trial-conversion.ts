// Copyright 2026 Sutyr Inc. SPDX-License-Identifier: Apache-2.0
import type { ScenarioPreset } from '../types/index.js';
import type { StripeSubscriptionWithTrialAndPause } from '../types/subscriptions.js';
import {
  subscriptionTrialWillEnd,
  invoiceCreated,
  invoiceFinalized,
  invoicePaid,
  invoicePaymentPaid,
} from '../generators/index.js';
import { createSeededIdGenerator } from '../utils/ids.js';
import { continueInvoice, snapshot } from './continuity.js';

const HOUR = 3600;
const DAY = 86400;
const TRIAL_DAYS = 30;
// A monthly period, as the subscription generators count it.
const PERIOD_SECONDS = 30 * DAY;
// The default subscription price, so the invoice bills what the item costs.
const AMOUNT = 2000;

// A 30 day free trial with a card on file converts to paid. Event order and
// object state follow Stripe's docs:
// - trial_will_end fires three days before trial_end.
// - When the trial ends, a new billing period begins and Stripe creates the
//   first paid invoice (billing_reason subscription_cycle) as a draft. A
//   trialing subscription "moves to active when the trial period is over"
//   (Subscription.status), and the billing testing guide has it become active
//   "immediately, with a draft invoice created when the trial period ends". So
//   the status changes before payment, and `active` does not mean paid.
// - About an hour later Stripe finalizes the invoice, which creates the default
//   PaymentIntent and InvoicePayment, and charges the card.
// The subscription steps all come from the trial_will_end subscription. Unlike
// subscriptionCreated and subscriptionUpdated, it carries the trial dates and
// the full 2026-09-30.endive shape, and one source keeps the item, price and
// product IDs the same in every step.

export function trialConversion(
  options?: { seed?: string },
): ScenarioPreset {
  const seed = options?.seed ?? 'trial-conversion';
  const ids = createSeededIdGenerator(seed);

  const cusId = ids.customerId();
  const subId = ids.subscriptionId();
  const pmId = ids.paymentMethodId();
  // The zero amount invoice Stripe creates when the trial starts.
  const trialInvoiceId = ids.invoiceId();
  const inId = ids.invoiceId();
  const piId = ids.paymentIntentId();
  const invoicePaymentId = ids.generateId('inpay_');
  const createRequestId = ids.generateId('req_', 14);

  const trialStart = 1700000000;
  const trialEnd = trialStart + TRIAL_DAYS * DAY;
  const finalizedAt = trialEnd + HOUR;
  const paidAt = finalizedAt + 1;

  const trialWillEnd = subscriptionTrialWillEnd({
    customerId: cusId,
    subscriptionId: subId,
    invoiceId: trialInvoiceId,
    paymentMethodId: pmId,
    trialEnd,
    trialPeriodDays: TRIAL_DAYS,
    timestamp: trialEnd - 3 * DAY,
  });
  const trialing = trialWillEnd.data.object;
  const trialItem = trialing.items.data[0]!;

  // Nothing changes between creation and the trial ending notice.
  const created = snapshot('customer.subscription.created', trialing, {}, {
    timestamp: trialStart,
    requestId: createRequestId,
  });

  const draft = invoiceCreated({
    customerId: cusId,
    subscriptionId: subId,
    invoiceId: inId,
    amount: AMOUNT,
    billingReason: 'subscription_cycle',
    timestamp: trialEnd,
  });
  // The line bills the subscription's own item and price.
  const line = draft.data.object.lines.data[0]!;
  line.parent!.subscription_item_details!.subscription_item = trialItem.id;
  line.pricing!.price_details = {
    price: trialItem.price.id,
    product: trialItem.price.product,
  };

  const activeItem = {
    ...structuredClone(trialItem),
    current_period_start: trialEnd,
    current_period_end: trialEnd + PERIOD_SECONDS,
  };
  // An array that changed comes back whole in previous_attributes, under the
  // list's `data` key; the list's other keys did not change.
  const previousAttributes = {
    items: { data: [trialItem] },
    latest_invoice: trialInvoiceId,
    status: 'trialing',
  } as unknown as Partial<StripeSubscriptionWithTrialAndPause>;
  const activated = snapshot(
    'customer.subscription.updated',
    trialing,
    {
      status: 'active',
      latest_invoice: inId,
      items: { ...trialing.items, data: [activeItem] },
    },
    { timestamp: trialEnd, previousAttributes },
  );

  const finalized = continueInvoice(
    invoiceFinalized({
      customerId: cusId,
      subscriptionId: subId,
      invoiceId: inId,
      amount: AMOUNT,
      billingReason: 'subscription_cycle',
      timestamp: finalizedAt,
    }),
    draft.data.object,
  );

  const paid = continueInvoice(
    invoicePaid({
      customerId: cusId,
      subscriptionId: subId,
      invoiceId: inId,
      amount: AMOUNT,
      timestamp: paidAt,
    }),
    finalized.data.object,
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
    id: 'trial-conversion',
    name: 'Trial Conversion',
    description:
      'A free trial converts to paid: the subscription starts trialing, gets the trial ending notice, turns active when the trial ends, and its first invoice is finalized and paid.',
    steps: [
      {
        event: created,
        delayMs: 0,
        description: 'Subscription is created with a 30 day free trial',
      },
      {
        event: trialWillEnd,
        delayMs: 2000,
        description: 'Trial ends in three days',
      },
      {
        event: draft,
        delayMs: 2000,
        description: 'Trial is over and the first paid invoice is created as a draft',
      },
      {
        event: activated,
        delayMs: 100,
        description: 'Subscription moves from trialing to active before payment',
      },
      {
        event: finalized,
        delayMs: 2000,
        description: 'Invoice is finalized an hour later and payment is attempted',
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
