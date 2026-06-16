// Copyright 2026 Sutyr Inc. SPDX-License-Identifier: Apache-2.0

import { describe, it, expect } from 'vitest';
import { createHmac } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { sign, verify } from '../../src/index.js';

describe('Stripe signature algorithm compatibility', () => {
  // Known test vector: we pre-compute the expected HMAC-SHA256 to verify
  // our sign() matches Stripe's documented algorithm exactly.
  const testPayload = { id: 'evt_test' };
  const testSecret = 'whsec_test_secret';
  const testTimestamp = 1614556800;

  // Pre-computed: HMAC-SHA256(testSecret, "1614556800.{\"id\":\"evt_test\"}")
  // The secret is used verbatim — matching Stripe's official SDK, which does
  // NOT strip the `whsec_` prefix before HMAC-ing.
  const expectedSignature =
    '8d7e36959f35255aff1c2cc6a906fedf5d8f34dc74004f274f68dbde50ff6d16';
  const expectedHeader = `t=${testTimestamp},v1=${expectedSignature}`;

  it('produces the exact same signature as manual HMAC-SHA256 computation', () => {
    // Manual computation following Stripe's documented algorithm:
    // 1. Concatenate: "${timestamp}.${JSON.stringify(payload)}"
    // 2. HMAC-SHA256 with the signing secret used verbatim (matches Stripe SDK)
    const signedPayload = `${testTimestamp}.${JSON.stringify(testPayload)}`;
    const manualSig = createHmac('sha256', testSecret)
      .update(signedPayload)
      .digest('hex');

    const header = sign(testPayload, testSecret, testTimestamp);

    expect(header).toBe(`t=${testTimestamp},v1=${manualSig}`);
    expect(header).toBe(expectedHeader);
  });

  it('concatenation format is exactly ${timestamp}.${JSON.stringify(payload)}', () => {
    // This test ensures the signed content is the timestamp, a dot, then the
    // JSON-stringified payload — NOT the raw object or any other format.
    const header = sign(testPayload, testSecret, testTimestamp);
    const signature = header.split(',v1=')[1];

    // Recompute with the exact concatenation format
    const expectedContent = `${testTimestamp}.${JSON.stringify(testPayload)}`;
    const expectedHex = createHmac('sha256', testSecret)
      .update(expectedContent)
      .digest('hex');

    expect(signature).toBe(expectedHex);
  });

  it('header format is exactly t={timestamp},v1={64-char-hex}', () => {
    const header = sign(testPayload, testSecret, testTimestamp);
    expect(header).toMatch(/^t=\d+,v1=[0-9a-f]{64}$/);
  });

  it('verify() accepts signatures produced by sign() (round-trip)', () => {
    const header = sign(testPayload, testSecret, testTimestamp);
    // Use a large tolerance since the test timestamp is in the past
    const result = verify(testPayload, header, testSecret, 999_999_999);
    expect(result).toBe(true);
  });

  it('verify() rejects a signature with a tampered payload', () => {
    const header = sign(testPayload, testSecret, testTimestamp);
    const tampered = { id: 'evt_tampered' };
    const result = verify(tampered, header, testSecret, 999_999_999);
    expect(result).toBe(false);
  });

  it('verify() rejects a signature with the wrong secret', () => {
    const header = sign(testPayload, testSecret, testTimestamp);
    const result = verify(testPayload, header, 'whsec_wrong_secret', 999_999_999);
    expect(result).toBe(false);
  });

  it('uses the secret verbatim as the HMAC key (matches Stripe SDK)', () => {
    // Stripe's official SDK (`stripe.webhooks.constructEvent`) uses the
    // signing secret exactly as provided — including any `whsec_` prefix.
    // Stripping the prefix would produce signatures that fail verification
    // against the Stripe SDK.
    const withPrefix = sign(testPayload, 'whsec_my_key', testTimestamp);
    const withoutPrefix = sign(testPayload, 'my_key', testTimestamp);
    expect(withPrefix).not.toBe(withoutPrefix);

    // Confirm the signatures use the keys verbatim
    const signedPayload = `${testTimestamp}.${JSON.stringify(testPayload)}`;
    const expectedWith = createHmac('sha256', 'whsec_my_key')
      .update(signedPayload)
      .digest('hex');
    const expectedWithout = createHmac('sha256', 'my_key')
      .update(signedPayload)
      .digest('hex');
    expect(withPrefix).toBe(`t=${testTimestamp},v1=${expectedWith}`);
    expect(withoutPrefix).toBe(`t=${testTimestamp},v1=${expectedWithout}`);
  });

  it('produces different signatures for different payloads', () => {
    const header1 = sign({ id: 'evt_1' }, testSecret, testTimestamp);
    const header2 = sign({ id: 'evt_2' }, testSecret, testTimestamp);
    expect(header1).not.toBe(header2);
  });

  it('produces different signatures for different timestamps', () => {
    const header1 = sign(testPayload, testSecret, 1000);
    const header2 = sign(testPayload, testSecret, 2000);
    expect(header1).not.toBe(header2);
  });

  it('verify() uses timingSafeEqual for constant-time comparison', () => {
    // Structural test: verify the source code imports and uses timingSafeEqual
    // This prevents accidental replacement with === or Buffer.compare
    const verifySource = readFileSync(
      resolve(__dirname, '../../src/verify.ts'),
      'utf-8',
    );
    expect(verifySource).toContain('timingSafeEqual');
    expect(verifySource).toContain("import { createHmac, timingSafeEqual } from 'node:crypto'");
  });
});
