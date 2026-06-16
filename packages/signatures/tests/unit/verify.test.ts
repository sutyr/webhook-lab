// Copyright 2026 Sutyr Inc. SPDX-License-Identifier: Apache-2.0
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { sign } from '../../src/sign.js';
import { verify } from '../../src/verify.js';

describe('verify', () => {
  const secret = 'test_signing_secret';
  const payload = { id: 'evt_abc', type: 'invoice.paid' };

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('accepts a valid signature produced by sign()', () => {
    const now = Date.now();
    vi.setSystemTime(now);
    const timestamp = Math.floor(now / 1000);
    const header = sign(payload, secret, timestamp);
    expect(verify(payload, header, secret)).toBe(true);
  });

  it('rejects a tampered payload', () => {
    const now = Date.now();
    vi.setSystemTime(now);
    const timestamp = Math.floor(now / 1000);
    const header = sign(payload, secret, timestamp);
    const tampered = { ...payload, type: 'invoice.payment_failed' };
    expect(verify(tampered, header, secret)).toBe(false);
  });

  it('rejects an incorrect secret', () => {
    const now = Date.now();
    vi.setSystemTime(now);
    const timestamp = Math.floor(now / 1000);
    const header = sign(payload, secret, timestamp);
    expect(verify(payload, header, 'wrong_secret')).toBe(false);
  });

  it('rejects an expired timestamp', () => {
    const now = Date.now();
    vi.setSystemTime(now);
    const oldTimestamp = Math.floor(now / 1000) - 301; // 1 second past default tolerance
    const header = sign(payload, secret, oldTimestamp);
    expect(verify(payload, header, secret)).toBe(false);
  });

  it('accepts a timestamp within tolerance', () => {
    const now = Date.now();
    vi.setSystemTime(now);
    const recentTimestamp = Math.floor(now / 1000) - 299; // within default 300s tolerance
    const header = sign(payload, secret, recentTimestamp);
    expect(verify(payload, header, secret)).toBe(true);
  });

  it('requires the same secret form (verbatim) used for signing', () => {
    // sign() and verify() use the secret verbatim — matching Stripe's SDK.
    // A signature produced with `whsec_xxx` only verifies against `whsec_xxx`,
    // not against the bare `xxx`. This is the correct, Stripe-compatible behavior.
    const prefixedSecret = `whsec_${secret}`;
    const now = Date.now();
    vi.setSystemTime(now);
    const timestamp = Math.floor(now / 1000);

    const headerPrefixed = sign(payload, prefixedSecret, timestamp);
    const headerBare = sign(payload, secret, timestamp);

    // Same secret form -> verifies
    expect(verify(payload, headerPrefixed, prefixedSecret)).toBe(true);
    expect(verify(payload, headerBare, secret)).toBe(true);

    // Different secret form -> rejects (would also fail on the Stripe SDK side)
    expect(verify(payload, headerPrefixed, secret)).toBe(false);
    expect(verify(payload, headerBare, prefixedSecret)).toBe(false);
  });

  it('returns false for invalid header format', () => {
    expect(verify(payload, 'garbage-header', secret)).toBe(false);
    expect(verify(payload, '', secret)).toBe(false);
    expect(verify(payload, 'x=1,y=2', secret)).toBe(false);
  });

  it('returns false for missing v1= in header', () => {
    const timestamp = Math.floor(Date.now() / 1000);
    expect(verify(payload, `t=${timestamp}`, secret)).toBe(false);
  });

  it('accepts payload passed as a string', () => {
    const now = Date.now();
    vi.setSystemTime(now);
    const timestamp = Math.floor(now / 1000);
    const header = sign(payload, secret, timestamp);
    const payloadString = JSON.stringify(payload);
    expect(verify(payloadString, header, secret)).toBe(true);
  });

  it('accepts payload passed as an object', () => {
    const now = Date.now();
    vi.setSystemTime(now);
    const timestamp = Math.floor(now / 1000);
    const header = sign(payload, secret, timestamp);
    expect(verify(payload, header, secret)).toBe(true);
  });

  // ─── Boundary & edge cases ──────────────────────────────────────────────

  it('accepts timestamp exactly at tolerance boundary', () => {
    const now = Date.now();
    vi.setSystemTime(now);
    const header = sign(payload, secret, Math.floor(now / 1000) - 300);
    expect(verify(payload, header, secret, 300)).toBe(true);
  });

  it('rejects timestamp 1 second past tolerance (301s old, tolerance=300)', () => {
    const now = Date.now();
    vi.setSystemTime(now);
    const header = sign(payload, secret, Math.floor(now / 1000) - 301);
    expect(verify(payload, header, secret, 300)).toBe(false);
  });

  it('rejects malformed header with empty timestamp (t=,v1=abc)', () => {
    expect(verify(payload, 't=,v1=abc123def456abc123def456abc123def456abc123def456abc123def456abcd', secret)).toBe(false);
  });

  it('rejects malformed header with non-numeric timestamp (t=notanumber,v1=...)', () => {
    expect(verify(payload, 't=notanumber,v1=abc123def456abc123def456abc123def456abc123def456abc123def456abcd', secret)).toBe(false);
  });

  it('rejects malformed header with short hex (t=123,v1=short)', () => {
    expect(verify(payload, 't=123,v1=short', secret)).toBe(false);
  });

  it('round-trips empty payload', () => {
    const now = Date.now();
    vi.setSystemTime(now);
    const ts = Math.floor(now / 1000);
    const header = sign({}, secret, ts);
    expect(verify({}, header, secret)).toBe(true);
  });

  it('round-trips large payload (100KB)', () => {
    const large = { data: 'x'.repeat(100_000) };
    const now = Date.now();
    vi.setSystemTime(now);
    const ts = Math.floor(now / 1000);
    const header = sign(large, secret, ts);
    expect(verify(large, header, secret)).toBe(true);
  });

  it('round-trips payload with unicode and special characters', () => {
    const special = { name: '日本語テスト', emoji: '🔥', quotes: "it's a \"test\"" };
    const now = Date.now();
    vi.setSystemTime(now);
    const ts = Math.floor(now / 1000);
    const header = sign(special, secret, ts);
    expect(verify(special, header, secret)).toBe(true);
  });
});
