// Copyright 2026 Sutyr Inc. SPDX-License-Identifier: Apache-2.0
import type { ScenarioPreset } from '../types/index.js';
import {
  customerCreated,
  subscriptionCreated,
  invoiceCreated,
  chargeSucceeded,
  paymentIntentSucceeded,
  invoicePaid,
  invoicePaymentSucceeded,
} from '../generators/index.js';
import { createSeededIdGenerator } from '../utils/ids.js';
import { sequentialTimestamps } from '../utils/timestamps.js';

export function subscriptionHappyPath(
  options?: { seed?: string },
): ScenarioPreset {
  const seed = options?.seed ?? 'subscription-happy-path';
  const ids = createSeededIdGenerator(seed);
  const timestamps = sequentialTimestamps(7, { start: 1700000000 });

  const cusId = ids.customerId();
  const subId = ids.subscriptionId();
  const inId = ids.invoiceId();
  const piId = ids.paymentIntentId();
  const chId = ids.chargeId();

  return {
    id: 'subscription-happy-path',
    name: 'Subscription Happy Path',
    description:
      'A successful subscription lifecycle: customer creation, subscription setup, invoice, payment, and confirmation.',
    steps: [
      {
        event: customerCreated({ timestamp: timestamps[0] }),
        delayMs: 0,
        description: 'Customer is created in Stripe',
      },
      {
        event: subscriptionCreated({
          customerId: cusId,
          subscriptionId: subId,
          timestamp: timestamps[1],
        }),
        delayMs: 1000,
        description: 'Subscription is created for the customer',
      },
      {
        event: invoiceCreated({
          customerId: cusId,
          subscriptionId: subId,
          invoiceId: inId,
          paymentIntentId: piId,
          billingReason: 'subscription_create',
          timestamp: timestamps[2],
        }),
        delayMs: 500,
        description: 'Invoice is created for the initial subscription charge',
      },
      {
        event: chargeSucceeded({
          customerId: cusId,
          paymentIntentId: piId,
          chargeId: chId,
          timestamp: timestamps[3],
        }),
        delayMs: 1000,
        description: 'Charge succeeds for the invoice amount',
      },
      {
        event: paymentIntentSucceeded({
          customerId: cusId,
          paymentIntentId: piId,
          chargeId: chId,
          timestamp: timestamps[4],
        }),
        delayMs: 100,
        description: 'Payment intent succeeds',
      },
      {
        event: invoicePaid({
          customerId: cusId,
          subscriptionId: subId,
          invoiceId: inId,
          paymentIntentId: piId,
          timestamp: timestamps[5],
        }),
        delayMs: 500,
        description: 'Invoice is marked as paid after successful payment',
      },
      {
        event: invoicePaymentSucceeded({
          customerId: cusId,
          subscriptionId: subId,
          invoiceId: inId,
          paymentIntentId: piId,
          timestamp: timestamps[6],
        }),
        delayMs: 100,
        description: 'Payment succeeded confirmation for the invoice',
      },
    ],
  };
}
