// Copyright 2026 Sutyr Inc. SPDX-License-Identifier: Apache-2.0
import type { StripeEvent } from '../types/index.js';
import type { RefundCreatedOptions, StripeRefundDetailed } from '../types/payments.js';
import { wrapInEvent } from './envelope.js';
import {
  generateId,
  refundId,
  chargeId,
  customerId,
  paymentIntentId,
  paymentMethodId,
} from '../utils/ids.js';
import { now } from '../utils/timestamps.js';

const balanceTransactionId = () => generateId('txn_');

// ─── refund.created ─────────────────────────────────────────────────────────
// A card refund at creation. Refunds have no `livemode` field. The card
// reference (ARN) arrives later through refund.updated, so at creation the
// reference is pending and whether it settles as a refund or a reversal is
// not yet known (`type: 'pending'`). `reference` and `reference_type` are
// optional strings, never null, so they stay absent until Stripe has a
// reference. `description`, `failure_reason`, `next_action` and
// `instructions_email` belong to non-card or failed refunds and are omitted.

export function refundCreated(
  options?: RefundCreatedOptions,
): StripeEvent<StripeRefundDetailed> {
  const ts = options?.timestamp ?? now();
  const status = options?.status ?? 'succeeded';

  const refund: StripeRefundDetailed = {
    id: options?.refundId ?? refundId(),
    object: 'refund',
    amount: options?.amount ?? 2999,
    balance_transaction: balanceTransactionId(),
    charge: options?.chargeId ?? chargeId(),
    created: ts,
    currency: options?.currency ?? 'usd',
    customer: options?.customerId ?? customerId(),
    customer_account: null,
    destination_details: {
      type: 'card',
      card: {
        reference_status: 'pending',
        type: 'pending',
      },
    },
    metadata: options?.metadata ?? {},
    payment_intent: options?.paymentIntentId ?? paymentIntentId(),
    payment_method: options?.paymentMethodId ?? paymentMethodId(),
    ...(status === 'pending' ? { pending_reason: options?.pendingReason ?? 'processing' } : {}),
    reason: options?.reason ?? null,
    receipt_number: null,
    source_transfer_reversal: null,
    status,
    transfer_reversal: null,
  };

  return wrapInEvent('refund.created', refund, { timestamp: ts });
}
