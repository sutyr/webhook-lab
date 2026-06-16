// Copyright 2026 Sutyr Inc. SPDX-License-Identifier: Apache-2.0
import { describe, it, expect } from 'vitest';
import { formatAmount } from '../../../src/lib/format-amount';

describe('formatAmount', () => {
  it('formats USD amount correctly (divides by 100)', () => {
    expect(formatAmount(2999, 'usd')).toBe('= $29.99');
  });

  it('formats EUR amount correctly', () => {
    expect(formatAmount(100, 'eur')).toBe('= €1.00');
  });

  it('formats GBP amount correctly', () => {
    expect(formatAmount(100, 'gbp')).toBe('= £1.00');
  });

  it('handles zero-decimal currencies (JPY)', () => {
    expect(formatAmount(1000, 'jpy')).toBe('= ¥1,000');
  });

  it('handles zero-decimal currencies (KRW)', () => {
    expect(formatAmount(50000, 'krw')).toBe('= ₩50,000');
  });

  it('formats zero amount', () => {
    expect(formatAmount(0, 'usd')).toBe('= $0.00');
  });

  it('returns null for empty string', () => {
    expect(formatAmount('', 'usd')).toBeNull();
  });

  it('returns null for undefined', () => {
    expect(formatAmount(undefined, 'usd')).toBeNull();
  });

  it('returns null for null', () => {
    expect(formatAmount(null, 'usd')).toBeNull();
  });

  it('returns null for NaN', () => {
    expect(formatAmount(NaN, 'usd')).toBeNull();
  });

  it('defaults to usd when currency is empty', () => {
    expect(formatAmount(2999, '')).toBe('= $29.99');
  });

  // ─── Edge cases ──────────────────────────────────────────────────────────

  it('returns null for Infinity', () => {
    expect(formatAmount(Infinity, 'usd')).toBeNull();
  });

  it('returns null for -Infinity', () => {
    expect(formatAmount(-Infinity, 'usd')).toBeNull();
  });

  it('handles non-integer float (29.99) without crashing', () => {
    const result = formatAmount(29.99, 'usd');
    expect(result).not.toBeNull();
    expect(typeof result).toBe('string');
  });

  it('handles unknown currency code without crashing', () => {
    const result = formatAmount(100, 'zzz');
    expect(result).not.toBeNull();
    expect(typeof result).toBe('string');
  });

  it('handles very large amount without overflow', () => {
    const result = formatAmount(999999999999, 'usd');
    expect(result).not.toBeNull();
    expect(result).toContain('9,999,999,999.99');
  });
});
