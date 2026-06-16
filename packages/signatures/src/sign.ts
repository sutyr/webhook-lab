// Copyright 2026 Sutyr Inc. SPDX-License-Identifier: Apache-2.0
import { createHmac } from 'node:crypto';

/**
 * Generate a Stripe-compatible webhook signature header.
 *
 * The secret is used verbatim as the HMAC key — matching the behavior of
 * Stripe's official SDK (`stripe.webhooks.constructEvent`), which does not
 * strip the `whsec_` prefix before HMAC-ing.
 *
 * @param payload  - The webhook event object to sign
 * @param secret   - The signing secret (used verbatim, exactly as Stripe's SDK does)
 * @param timestamp - Unix timestamp in seconds (defaults to now)
 * @returns A Stripe-Signature header value: `t=<timestamp>,v1=<hex>`
 */
export function sign(
  payload: object,
  secret: string,
  timestamp?: number,
): string {
  const ts = timestamp ?? Math.floor(Date.now() / 1000);
  const signedPayload = `${ts}.${JSON.stringify(payload)}`;
  const signature = createHmac('sha256', secret)
    .update(signedPayload)
    .digest('hex');

  return `t=${ts},v1=${signature}`;
}
