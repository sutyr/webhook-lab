// Copyright 2026 Sutyr Inc. SPDX-License-Identifier: Apache-2.0

/**
 * Zero-decimal currencies per Stripe docs.
 * These currencies do NOT divide by 100.
 * See: https://docs.stripe.com/currencies#zero-decimal
 */
const ZERO_DECIMAL_CURRENCIES = new Set([
  'bif', 'clp', 'djf', 'gnf', 'jpy', 'kmf', 'krw', 'mga',
  'pyg', 'rwf', 'ugx', 'vnd', 'vuv', 'xaf', 'xof', 'xpf',
]);

/**
 * Format a Stripe amount (in smallest currency unit) as a human-readable string.
 * Returns null if the amount is empty/undefined/NaN.
 *
 * @example formatAmount(2999, 'usd') => '= $29.99'
 * @example formatAmount(1000, 'jpy') => '= ¥1,000'
 */
export function formatAmount(amount: unknown, currency: string): string | null {
  if (amount === '' || amount === undefined || amount === null) return null;
  const num = Number(amount);
  if (!Number.isFinite(num)) return null;

  const cur = (currency || 'usd').toLowerCase();
  const isZeroDecimal = ZERO_DECIMAL_CURRENCIES.has(cur);
  const displayAmount = isZeroDecimal ? num : num / 100;

  try {
    const formatted = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: cur.toUpperCase(),
      minimumFractionDigits: isZeroDecimal ? 0 : 2,
      maximumFractionDigits: isZeroDecimal ? 0 : 2,
    }).format(displayAmount);

    return `= ${formatted}`;
  } catch {
    return `= ${displayAmount}`;
  }
}
