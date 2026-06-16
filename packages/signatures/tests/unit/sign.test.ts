// Copyright 2026 Sutyr Inc. SPDX-License-Identifier: Apache-2.0
import { describe, it, expect, vi, afterEach } from 'vitest';
import { createHmac } from 'node:crypto';
import { sign } from '../../src/sign.js';

describe('sign', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns format t=<number>,v1=<64-char-hex>', () => {
    const header = sign({ id: 'evt_test' }, 'test_secret', 1000000);
    const match = header.match(/^t=(\d+),v1=([0-9a-f]{64})$/);
    expect(match).not.toBeNull();
  });

  it('produces a known output for a known input', () => {
    const payload = { id: 'evt_123' };
    const secret = 'my_secret';
    const timestamp = 1700000000;

    // Manually compute expected signature
    const signedPayload = `${timestamp}.${JSON.stringify(payload)}`;
    const expected = createHmac('sha256', secret)
      .update(signedPayload)
      .digest('hex');

    const header = sign(payload, secret, timestamp);
    expect(header).toBe(`t=${timestamp},v1=${expected}`);
  });

  it('uses the secret verbatim — `whsec_` prefix is part of the HMAC key', () => {
    // Stripe's official SDK uses the secret exactly as provided. Stripping
    // the prefix would produce signatures that fail verification against the
    // Stripe SDK on the receiving end.
    const payload = { type: 'invoice.paid' };
    const bareSecret = 'abc123';
    const timestamp = 1700000000;

    const withPrefix = sign(payload, `whsec_${bareSecret}`, timestamp);
    const withoutPrefix = sign(payload, bareSecret, timestamp);

    expect(withPrefix).not.toBe(withoutPrefix);
  });

  it('works with bare secret (no prefix)', () => {
    const header = sign({ ok: true }, 'bare_secret', 1700000000);
    expect(header).toMatch(/^t=1700000000,v1=[0-9a-f]{64}$/);
  });

  it('uses custom timestamp when provided', () => {
    const header = sign({}, 'secret', 1234567890);
    expect(header).toMatch(/^t=1234567890,/);
  });

  it('defaults timestamp to approximately current time', () => {
    const before = Math.floor(Date.now() / 1000);
    const header = sign({}, 'secret');
    const after = Math.floor(Date.now() / 1000);

    const match = header.match(/^t=(\d+),/);
    expect(match).not.toBeNull();

    const ts = Number(match![1]);
    expect(ts).toBeGreaterThanOrEqual(before);
    expect(ts).toBeLessThanOrEqual(after);
  });

  // ─── Edge cases ──────────────────────────────────────────────────────────

  it('signs empty payload without error', () => {
    const header = sign({}, 'secret', 1700000000);
    expect(header).toMatch(/^t=1700000000,v1=[0-9a-f]{64}$/);
  });

  it('signs large payload (100KB) without hanging', () => {
    const payload = { data: 'x'.repeat(100_000) };
    const header = sign(payload, 'secret', 1700000000);
    expect(header).toMatch(/^t=\d+,v1=[0-9a-f]{64}$/);
  });

  it('handles timestamp = 0 (epoch)', () => {
    const header = sign({ id: 'test' }, 'secret', 0);
    expect(header).toMatch(/^t=0,v1=[0-9a-f]{64}$/);
  });

  it('handles very large timestamp (year 3000)', () => {
    const ts = 32503680000; // Jan 1, 3000
    const header = sign({ id: 'test' }, 'secret', ts);
    expect(header).toMatch(new RegExp(`^t=${ts},v1=[0-9a-f]{64}$`));
  });
});
