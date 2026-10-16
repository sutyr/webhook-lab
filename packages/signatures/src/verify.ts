// Copyright 2026 Sutyr Inc. SPDX-License-Identifier: Apache-2.0
import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Verify a Stripe-compatible webhook signature header.
 *
 * The secret is used verbatim as the HMAC key — matching the behavior of
 * Stripe's official SDK (`stripe.webhooks.constructEvent`), which does not
 * strip the `whsec_` prefix before HMAC-ing.
 *
 * @param payload   - The raw request body (string) or parsed object
 * @param header    - The `Stripe-Signature` header value
 * @param secret    - The signing secret (used verbatim, exactly as Stripe's SDK does)
 * @param tolerance - Maximum age of the event in seconds (default 300)
 * @returns `true` if the signature is valid and within tolerance
 */
export function verify(
  payload: string | object,
  header: string,
  secret: string,
  tolerance: number = 300,
): boolean {
  const parts = header.split(',');

  let timestamp: string | undefined;
  // Stripe sends one v1 entry per active secret (e.g. during secret rotation);
  // the official SDK accepts the header if ANY v1 signature matches.
  const signatures: string[] = [];

  for (const part of parts) {
    const [key, value] = part.split('=', 2);
    if (key === 't') timestamp = value;
    if (key === 'v1' && value) signatures.push(value);
  }

  if (!timestamp || signatures.length === 0) {
    return false;
  }

  const ts = Number(timestamp);
  if (!Number.isFinite(ts)) {
    return false;
  }

  const payloadString =
    typeof payload === 'string' ? payload : JSON.stringify(payload);

  const signedPayload = `${timestamp}.${payloadString}`;
  const expectedHex = createHmac('sha256', secret)
    .update(signedPayload)
    .digest('hex');

  // Constant-time comparison against each candidate signature
  const expected = Buffer.from(expectedHex, 'hex');
  const signatureMatch = signatures.some((candidate) => {
    const received = Buffer.from(candidate, 'hex');
    return received.length === expected.length && timingSafeEqual(received, expected);
  });

  // Check timestamp tolerance
  const now = Math.floor(Date.now() / 1000);
  const withinTolerance = Math.abs(now - ts) <= tolerance;

  return signatureMatch && withinTolerance;
}
