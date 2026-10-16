// Copyright 2026 Sutyr Inc. SPDX-License-Identifier: Apache-2.0
import type { StripeEvent } from '../types/index.js';
import type {
  EarlyFraudWarningCreatedOptions,
  StripeEarlyFraudWarning,
} from '../types/payments.js';
import { wrapInEvent } from './envelope.js';
import { generateId, chargeId, paymentIntentId } from '../utils/ids.js';
import { now } from '../utils/timestamps.js';

const earlyFraudWarningId = () => generateId('issfr_');

// ─── radar.early_fraud_warning.created ──────────────────────────────────────
// The card issuer flagged a charge as likely fraud. The object carries no
// amount, currency or metadata; it points at the charge. `actionable` is true
// while the charge is neither disputed nor fully refunded.

export function earlyFraudWarningCreated(
  options?: EarlyFraudWarningCreatedOptions,
): StripeEvent<StripeEarlyFraudWarning> {
  const ts = options?.timestamp ?? now();

  const warning: StripeEarlyFraudWarning = {
    id: options?.earlyFraudWarningId ?? earlyFraudWarningId(),
    object: 'radar.early_fraud_warning',
    actionable: options?.actionable ?? true,
    charge: options?.chargeId ?? chargeId(),
    created: ts,
    fraud_type: options?.fraudType ?? 'unauthorized_use_of_card',
    livemode: false,
    payment_intent: options?.paymentIntentId ?? paymentIntentId(),
  };

  return wrapInEvent('radar.early_fraud_warning.created', warning, { timestamp: ts });
}
