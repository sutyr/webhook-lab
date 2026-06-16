// Copyright 2026 Sutyr Inc. SPDX-License-Identifier: Apache-2.0
import type { ScenarioPreset } from '../types/index.js';
import {
  checkoutSessionCompleted,
  paymentIntentSucceeded,
  chargeSucceeded,
} from '../generators/index.js';
import { createSeededIdGenerator } from '../utils/ids.js';
import { sequentialTimestamps } from '../utils/timestamps.js';

export function checkoutFlow(
  options?: { seed?: string },
): ScenarioPreset {
  const seed = options?.seed ?? 'checkout-flow';
  const ids = createSeededIdGenerator(seed);
  const timestamps = sequentialTimestamps(3, { start: 1700000000 });

  const cusId = ids.customerId();
  const piId = ids.paymentIntentId();
  const chId = ids.chargeId();

  return {
    id: 'checkout-flow',
    name: 'Checkout Flow',
    description:
      'A one-time payment checkout: session completes, payment intent succeeds, and charge is confirmed.',
    steps: [
      {
        event: checkoutSessionCompleted({
          customerId: cusId,
          paymentIntentId: piId,
          timestamp: timestamps[0],
        }),
        delayMs: 0,
        description: 'Checkout session is completed by the customer',
      },
      {
        event: paymentIntentSucceeded({
          customerId: cusId,
          paymentIntentId: piId,
          chargeId: chId,
          timestamp: timestamps[1],
        }),
        delayMs: 1000,
        description: 'Payment intent succeeds for the checkout amount',
      },
      {
        event: chargeSucceeded({
          customerId: cusId,
          paymentIntentId: piId,
          chargeId: chId,
          timestamp: timestamps[2],
        }),
        delayMs: 500,
        description: 'Charge is confirmed as succeeded',
      },
    ],
  };
}
