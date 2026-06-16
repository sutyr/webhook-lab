// Copyright 2026 Sutyr Inc. SPDX-License-Identifier: Apache-2.0
import type { ScenarioPreset } from '../types/index.js';
import {
  chargeSucceeded,
  disputeCreated,
  disputeUpdated,
  disputeClosed,
} from '../generators/index.js';
import { createSeededIdGenerator } from '../utils/ids.js';
import { sequentialTimestamps } from '../utils/timestamps.js';

export function disputeLifecycle(
  options?: { seed?: string },
): ScenarioPreset {
  const seed = options?.seed ?? 'dispute-lifecycle';
  const ids = createSeededIdGenerator(seed);
  const timestamps = sequentialTimestamps(4, { start: 1700000000 });

  const cusId = ids.customerId();
  const chId = ids.chargeId();
  const duId = ids.disputeId();
  const piId = ids.paymentIntentId();

  return {
    id: 'dispute-lifecycle',
    name: 'Dispute Lifecycle',
    description:
      'A charge is disputed: charge succeeds, dispute is opened, moves to under_review, and is closed as won.',
    steps: [
      {
        event: chargeSucceeded({
          customerId: cusId,
          chargeId: chId,
          paymentIntentId: piId,
          timestamp: timestamps[0],
        }),
        delayMs: 0,
        description: 'Original charge succeeds',
      },
      {
        event: disputeCreated({
          chargeId: chId,
          disputeId: duId,
          paymentIntentId: piId,
          timestamp: timestamps[1],
        }),
        delayMs: 5000,
        description: 'Customer files a dispute against the charge',
      },
      {
        event: disputeUpdated({
          chargeId: chId,
          disputeId: duId,
          paymentIntentId: piId,
          status: 'under_review',
          previousStatus: 'needs_response',
          timestamp: timestamps[2],
        }),
        delayMs: 3000,
        description: 'Dispute moves to under_review after evidence submission',
      },
      {
        event: disputeClosed({
          chargeId: chId,
          disputeId: duId,
          paymentIntentId: piId,
          status: 'won',
          timestamp: timestamps[3],
        }),
        delayMs: 5000,
        description: 'Dispute is closed in favor of the merchant (won)',
      },
    ],
  };
}
