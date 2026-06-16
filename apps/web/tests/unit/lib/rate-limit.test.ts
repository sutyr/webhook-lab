// Copyright 2026 Sutyr Inc. SPDX-License-Identifier: Apache-2.0

import { describe, it, expect } from 'vitest';
import { checkRateLimit } from '@/lib/rate-limit';

describe('checkRateLimit', () => {
  // Use unique IPs per test to avoid cross-test pollution from the in-memory store.

  it('allows the first request from a new IP', () => {
    const result = checkRateLimit('10.0.0.1');
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(59);
  });

  it('allows 60 requests within the window', () => {
    const ip = '10.0.0.2';
    let result;
    for (let i = 0; i < 60; i++) {
      result = checkRateLimit(ip);
    }
    expect(result!.allowed).toBe(true);
    expect(result!.remaining).toBe(0);
  });

  it('rejects the 61st request within the window', () => {
    const ip = '10.0.0.3';
    for (let i = 0; i < 60; i++) {
      checkRateLimit(ip);
    }
    const result = checkRateLimit(ip);
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
  });

  it('tracks different IPs independently', () => {
    const ipA = '10.0.0.4';
    const ipB = '10.0.0.5';

    // Exhaust ipA's limit
    for (let i = 0; i < 61; i++) {
      checkRateLimit(ipA);
    }

    // ipB should still be allowed
    const result = checkRateLimit(ipB);
    expect(result.allowed).toBe(true);
  });

  it('resets after the window expires', () => {
    const ip = '10.0.0.6';
    // Use a very short window (10ms)
    for (let i = 0; i < 61; i++) {
      checkRateLimit(ip, 60, 10);
    }

    // Wait for window to expire
    return new Promise<void>((resolve) => {
      setTimeout(() => {
        const result = checkRateLimit(ip, 60, 10);
        expect(result.allowed).toBe(true);
        expect(result.remaining).toBe(59);
        resolve();
      }, 20);
    });
  });

  it('returns a resetAt timestamp in the future', () => {
    const now = Date.now();
    const result = checkRateLimit('10.0.0.7');
    expect(result.resetAt).toBeGreaterThan(now);
  });

  it('supports custom limits', () => {
    const ip = '10.0.0.8';
    for (let i = 0; i < 5; i++) {
      checkRateLimit(ip, 5);
    }
    const result = checkRateLimit(ip, 5);
    expect(result.allowed).toBe(false);
  });

  it('decrements remaining correctly', () => {
    const ip = '10.0.0.9';
    const r1 = checkRateLimit(ip, 10);
    expect(r1.remaining).toBe(9);
    const r2 = checkRateLimit(ip, 10);
    expect(r2.remaining).toBe(8);
    const r3 = checkRateLimit(ip, 10);
    expect(r3.remaining).toBe(7);
  });

  // ─── Stress & edge cases ────────────────────────────────────────────────

  it('allows 60 calls in a burst from same IP', () => {
    const ip = '10.0.0.100';
    for (let i = 0; i < 60; i++) {
      const r = checkRateLimit(ip);
      expect(r.allowed).toBe(true);
    }
    const r61 = checkRateLimit(ip);
    expect(r61.allowed).toBe(false);
  });

  it('allows 100 different IPs each making 1 call', () => {
    for (let i = 0; i < 100; i++) {
      const r = checkRateLimit(`192.168.${Math.floor(i / 256)}.${i % 256}`);
      expect(r.allowed).toBe(true);
    }
  });

  it('resets remaining after window expires', async () => {
    const ip = '10.0.0.200';
    // Use tiny 10ms window
    checkRateLimit(ip, 5, 10);
    checkRateLimit(ip, 5, 10);
    checkRateLimit(ip, 5, 10);
    // Wait for window to expire
    await new Promise((r) => setTimeout(r, 15));
    const result = checkRateLimit(ip, 5, 10);
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(4); // fresh window
  });
});
