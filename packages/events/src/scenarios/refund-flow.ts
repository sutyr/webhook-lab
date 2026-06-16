// Copyright 2026 Sutyr Inc. SPDX-License-Identifier: Apache-2.0
import type { ScenarioPreset } from '../types/index.js';
import {
  chargeSucceeded,
  chargeRefunded,
} from '../generators/index.js';
import { createSeededIdGenerator } from '../utils/ids.js';
import { sequentialTimestamps } from '../utils/timestamps.js';

export function refundFlow(
  options?: { seed?: string },
): ScenarioPreset {
  const seed = options?.seed ?? 'refund-flow';
  const ids = createSeededIdGenerator(seed);
  const timestamps = sequentialTimestamps(2, { start: 1700000000 });

  const cusId = ids.customerId();
  const chId = ids.chargeId();
  const piId = ids.paymentIntentId();

  return {
    id: 'refund-flow',
    name: 'Refund Flow',
    description:
      'A charge is refunded: the original charge succeeds, then a full refund is issued.',
    steps: [
      {
        event: chargeSucceeded({
          customerId: cusId,
          paymentIntentId: piId,
          chargeId: chId,
          timestamp: timestamps[0],
        }),
        delayMs: 0,
        description: 'Original charge succeeds',
      },
      {
        event: chargeRefunded({
          customerId: cusId,
          paymentIntentId: piId,
          chargeId: chId,
          timestamp: timestamps[1],
        }),
        delayMs: 2000,
        description: 'Full refund is issued for the charge',
      },
    ],
  };
}
