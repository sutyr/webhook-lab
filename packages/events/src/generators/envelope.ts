// Copyright 2026 Sutyr Inc. SPDX-License-Identifier: Apache-2.0
import type { StripeEvent, StripeObject } from '../types/index.js';
import { eventId } from '../utils/ids.js';
import { now } from '../utils/timestamps.js';

// Latest stable dated release. Payload shapes follow the post-basil
// (2025-03-31) Invoice/Subscription model; dahlia (2026-03-25) and endive
// (2026-09-30) made no breaking changes to the response fields generated here.
export const STRIPE_API_VERSION = '2026-09-30.endive';

export interface WrapInEventOptions<T> {
  timestamp?: number;
  previousAttributes?: Partial<T>;
  requestId?: string;
  idempotencyKey?: string;
  livemode?: boolean;
  apiVersion?: string;
}

export function wrapInEvent<T extends StripeObject>(
  type: string,
  object: T,
  options?: WrapInEventOptions<T>,
): StripeEvent<T> {
  const event: StripeEvent<T> = {
    id: eventId(),
    object: 'event',
    api_version: options?.apiVersion ?? STRIPE_API_VERSION,
    created: options?.timestamp ?? now(),
    type,
    livemode: options?.livemode ?? false,
    pending_webhooks: 1,
    request: {
      id: options?.requestId ?? null,
      idempotency_key: options?.idempotencyKey ?? null,
    },
    data: {
      object,
    },
  };

  if (options?.previousAttributes !== undefined) {
    event.data.previous_attributes = options.previousAttributes;
  }

  return event;
}
