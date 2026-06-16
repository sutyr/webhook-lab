// Copyright 2026 Sutyr Inc. SPDX-License-Identifier: Apache-2.0
import type {
  StripeDispute,
  StripeEvent,
  DisputeCreatedOptions,
  DisputeUpdatedOptions,
  DisputeClosedOptions,
} from '../types/index.js';
import { wrapInEvent } from './envelope.js';
import { disputeId, chargeId, paymentIntentId } from '../utils/ids.js';
import { now, futureDays } from '../utils/timestamps.js';

// ─── charge.dispute.created ─────────────────────────────────────────────────

export function disputeCreated(
  options?: DisputeCreatedOptions,
): StripeEvent<StripeDispute> {
  const ts = options?.timestamp ?? now();
  const amount = options?.amount ?? 2999;
  const currency = options?.currency ?? 'usd';
  const chId = options?.chargeId ?? chargeId();

  const dispute: StripeDispute = {
    id: options?.disputeId ?? disputeId(),
    object: 'dispute',
    amount,
    charge: chId,
    payment_intent: options?.paymentIntentId ?? paymentIntentId(),
    currency,
    reason: options?.reason ?? 'fraudulent',
    status: 'needs_response',
    is_charge_refundable: false,
    evidence_details: {
      due_by: futureDays(21),
      has_evidence: false,
      past_due: false,
      submission_count: 0,
    },
    metadata: options?.metadata ?? {},
    created: ts,
    livemode: false,
  };

  return wrapInEvent('charge.dispute.created', dispute, { timestamp: ts });
}

// ─── charge.dispute.updated ─────────────────────────────────────────────────

export function disputeUpdated(
  options?: DisputeUpdatedOptions,
): StripeEvent<StripeDispute> {
  const ts = options?.timestamp ?? now();
  const amount = options?.amount ?? 2999;
  const currency = options?.currency ?? 'usd';
  const chId = options?.chargeId ?? chargeId();
  const status = options?.status ?? 'under_review';
  const previousStatus = options?.previousStatus ?? 'needs_response';

  const dispute: StripeDispute = {
    id: options?.disputeId ?? disputeId(),
    object: 'dispute',
    amount,
    charge: chId,
    payment_intent: options?.paymentIntentId ?? paymentIntentId(),
    currency,
    reason: 'fraudulent',
    status,
    is_charge_refundable: false,
    evidence_details: {
      due_by: futureDays(21),
      has_evidence: true,
      past_due: false,
      submission_count: 1,
    },
    metadata: options?.metadata ?? {},
    created: ts,
    livemode: false,
  };

  return wrapInEvent('charge.dispute.updated', dispute, {
    timestamp: ts,
    previousAttributes: { status: previousStatus },
  });
}

// ─── charge.dispute.closed ──────────────────────────────────────────────────

export function disputeClosed(
  options?: DisputeClosedOptions,
): StripeEvent<StripeDispute> {
  const ts = options?.timestamp ?? now();
  const amount = options?.amount ?? 2999;
  const currency = options?.currency ?? 'usd';
  const chId = options?.chargeId ?? chargeId();
  const status = options?.status ?? 'won';

  const dispute: StripeDispute = {
    id: options?.disputeId ?? disputeId(),
    object: 'dispute',
    amount,
    charge: chId,
    payment_intent: options?.paymentIntentId ?? paymentIntentId(),
    currency,
    reason: 'fraudulent',
    status,
    is_charge_refundable: status === 'won',
    evidence_details: {
      due_by: null,
      has_evidence: true,
      past_due: false,
      submission_count: 1,
    },
    metadata: options?.metadata ?? {},
    created: ts,
    livemode: false,
  };

  return wrapInEvent('charge.dispute.closed', dispute, {
    timestamp: ts,
    previousAttributes: { status: 'under_review' },
  });
}
