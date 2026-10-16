// Copyright 2026 Sutyr Inc. SPDX-License-Identifier: Apache-2.0
import type { ScenarioPreset } from '../types/index.js';
import {
  chargeSucceeded,
  earlyFraudWarningCreated,
  refundCreated,
} from '../generators/index.js';
import { createSeededIdGenerator } from '../utils/ids.js';
import { snapshot } from './continuity.js';

const HOUR = 3600;
const DAY = 86400;
const AMOUNT = 2999;

// The card issuer flags a paid charge as likely fraud, and the business refunds
// it in full before the cardholder disputes it. Object state follows Stripe's
// docs:
// - The early fraud warning arrives days after the charge and is `actionable`:
//   the charge is neither disputed nor fully refunded yet.
// - The refund uses reason `fraudulent` (the Dashboard's "Refund as fraud"),
//   and it is a full refund, because a partially refunded payment can still
//   be disputed for the full amount.
// - One refund request sends refund.created and charge.refunded, so both carry
//   that request's ID. The refund also makes the warning no longer
//   `actionable`; that update is not part of this scenario.

export function earlyFraudWarning(
  options?: { seed?: string },
): ScenarioPreset {
  const seed = options?.seed ?? 'early-fraud-warning';
  const ids = createSeededIdGenerator(seed);

  const cusId = ids.customerId();
  const piId = ids.paymentIntentId();
  const chId = ids.chargeId();
  const pmId = ids.paymentMethodId();
  const warningId = ids.generateId('issfr_');
  const reId = ids.refundId();
  const refundRequestId = ids.generateId('req_', 14);

  const chargedAt = 1700000000;
  const warnedAt = chargedAt + 3 * DAY;
  const refundedAt = warnedAt + 2 * HOUR;

  const charge = chargeSucceeded({
    amount: AMOUNT,
    customerId: cusId,
    paymentIntentId: piId,
    chargeId: chId,
    timestamp: chargedAt,
  });
  // chargeSucceeded has no payment method option; seed it like the other IDs.
  charge.data.object.payment_method = pmId;

  const warning = earlyFraudWarningCreated({
    chargeId: chId,
    paymentIntentId: piId,
    earlyFraudWarningId: warningId,
    actionable: true,
    timestamp: warnedAt,
  });

  const refund = refundCreated({
    amount: AMOUNT,
    customerId: cusId,
    chargeId: chId,
    paymentIntentId: piId,
    paymentMethodId: pmId,
    refundId: reId,
    reason: 'fraudulent',
    timestamp: refundedAt,
  });
  refund.request = { id: refundRequestId, idempotency_key: null };

  const refunded = snapshot(
    'charge.refunded',
    charge.data.object,
    { amount_refunded: AMOUNT, refunded: true },
    { timestamp: refundedAt + 1, requestId: refundRequestId },
  );

  return {
    id: 'early-fraud-warning',
    name: 'Early Fraud Warning',
    description:
      'A card issuer flags a paid charge as likely fraud, and the business refunds it in full before the cardholder disputes it.',
    steps: [
      {
        event: charge,
        delayMs: 0,
        description: 'Charge succeeds',
      },
      {
        event: warning,
        delayMs: 3000,
        description: 'Card issuer reports the charge as likely fraud',
      },
      {
        event: refund,
        delayMs: 2000,
        description: 'Business refunds the full amount as fraudulent',
      },
      {
        event: refunded,
        delayMs: 100,
        description: 'Charge is fully refunded, so it can no longer be disputed',
      },
    ],
  };
}
