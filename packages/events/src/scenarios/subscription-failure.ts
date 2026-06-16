// Copyright 2026 Sutyr Inc. SPDX-License-Identifier: Apache-2.0
import type { ScenarioPreset } from '../types/index.js';
import {
  invoiceCreated,
  invoicePaymentFailed,
  paymentIntentPaymentFailed,
  subscriptionUpdated,
  subscriptionDeleted,
} from '../generators/index.js';
import { createSeededIdGenerator } from '../utils/ids.js';
import { sequentialTimestamps } from '../utils/timestamps.js';

export function subscriptionFailure(
  options?: { seed?: string },
): ScenarioPreset {
  const seed = options?.seed ?? 'subscription-failure';
  const ids = createSeededIdGenerator(seed);
  const timestamps = sequentialTimestamps(7, { start: 1700000000 });

  const cusId = ids.customerId();
  const subId = ids.subscriptionId();
  const inId = ids.invoiceId();
  const piId = ids.paymentIntentId();

  return {
    id: 'subscription-failure',
    name: 'Subscription Payment Failure',
    description:
      'A subscription payment fails, moves to past_due, retries payment, fails again, and the subscription is canceled.',
    steps: [
      {
        event: invoiceCreated({
          customerId: cusId,
          subscriptionId: subId,
          invoiceId: inId,
          paymentIntentId: piId,
          timestamp: timestamps[0],
        }),
        delayMs: 0,
        description: 'Invoice is created for the subscription billing cycle',
      },
      {
        event: invoicePaymentFailed({
          customerId: cusId,
          subscriptionId: subId,
          invoiceId: inId,
          paymentIntentId: piId,
          attemptCount: 1,
          timestamp: timestamps[1],
        }),
        delayMs: 2000,
        description: 'First payment attempt fails',
      },
      {
        event: paymentIntentPaymentFailed({
          customerId: cusId,
          paymentIntentId: piId,
          timestamp: timestamps[2],
        }),
        delayMs: 100,
        description: 'Payment intent fails for the invoice payment attempt',
      },
      {
        event: subscriptionUpdated({
          customerId: cusId,
          subscriptionId: subId,
          status: 'past_due',
          previousStatus: 'active',
          timestamp: timestamps[3],
        }),
        delayMs: 500,
        description: 'Subscription status moves to past_due after failed payment',
      },
      {
        event: invoicePaymentFailed({
          customerId: cusId,
          subscriptionId: subId,
          invoiceId: inId,
          paymentIntentId: piId,
          attemptCount: 2,
          timestamp: timestamps[4],
        }),
        delayMs: 3000,
        description: 'Second payment attempt also fails',
      },
      {
        event: paymentIntentPaymentFailed({
          customerId: cusId,
          paymentIntentId: piId,
          timestamp: timestamps[5],
        }),
        delayMs: 100,
        description: 'Payment intent fails again on retry',
      },
      {
        event: subscriptionDeleted({
          customerId: cusId,
          subscriptionId: subId,
          timestamp: timestamps[6],
        }),
        delayMs: 1000,
        description: 'Subscription is canceled after exhausting retry attempts',
      },
    ],
  };
}
