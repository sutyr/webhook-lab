// Copyright 2026 Sutyr Inc. SPDX-License-Identifier: Apache-2.0
import { createHash, randomBytes } from 'node:crypto';

const ALPHANUMERIC = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

export function generateId(prefix: string, length = 24): string {
  const bytes = randomBytes(length);
  let result = prefix;
  for (let i = 0; i < length; i++) {
    result += ALPHANUMERIC[bytes[i]! % ALPHANUMERIC.length];
  }
  return result;
}

// ─── Seeded PRNG (xorshift128+) ──────────────────────────────────────────────

function seedToState(seed: string): [bigint, bigint] {
  const hash = createHash('sha256').update(seed).digest();
  const s0 = hash.readBigUInt64LE(0);
  const s1 = hash.readBigUInt64LE(8);
  // Ensure non-zero state
  return [s0 || 1n, s1 || 1n];
}

function createXorshift128Plus(seed: string) {
  let [s0, s1] = seedToState(seed);
  const mask64 = (1n << 64n) - 1n;

  return function next(): bigint {
    let x = s0;
    const y = s1;
    s0 = y;
    x ^= (x << 23n) & mask64;
    x ^= x >> 17n;
    x ^= y;
    x ^= y >> 26n;
    s1 = x;
    return (s0 + s1) & mask64;
  };
}

function seededGenerateId(rng: () => bigint, prefix: string, length = 24): string {
  let result = prefix;
  for (let i = 0; i < length; i++) {
    const val = rng();
    result += ALPHANUMERIC[Number(val % BigInt(ALPHANUMERIC.length))];
  }
  return result;
}

// ─── Convenience Functions ───────────────────────────────────────────────────

export const eventId = () => generateId('evt_');
export const customerId = () => generateId('cus_');
export const subscriptionId = () => generateId('sub_');
export const invoiceId = () => generateId('in_');
export const invoiceItemId = () => generateId('ii_');
export const invoiceLineItemId = () => generateId('il_');
export const paymentIntentId = () => generateId('pi_');
export const chargeId = () => generateId('ch_');
export const paymentMethodId = () => generateId('pm_');
export const checkoutSessionId = () => generateId('cs_');
export const disputeId = () => generateId('dp_');
export const refundId = () => generateId('re_');
export const productId = () => generateId('prod_');
export const priceId = () => generateId('price_');
export const subscriptionItemId = () => generateId('si_');
export const setupIntentId = () => generateId('seti_');

// ─── Seeded ID Generator ────────────────────────────────────────────────────

export interface SeededIdGenerator {
  generateId: (prefix: string, length?: number) => string;
  eventId: () => string;
  customerId: () => string;
  subscriptionId: () => string;
  invoiceId: () => string;
  invoiceItemId: () => string;
  invoiceLineItemId: () => string;
  paymentIntentId: () => string;
  chargeId: () => string;
  paymentMethodId: () => string;
  checkoutSessionId: () => string;
  disputeId: () => string;
  refundId: () => string;
  productId: () => string;
  priceId: () => string;
  subscriptionItemId: () => string;
  setupIntentId: () => string;
}

export function createSeededIdGenerator(seed: string): SeededIdGenerator {
  const rng = createXorshift128Plus(seed);
  const gen = (prefix: string, length = 24) => seededGenerateId(rng, prefix, length);

  return {
    generateId: gen,
    eventId: () => gen('evt_'),
    customerId: () => gen('cus_'),
    subscriptionId: () => gen('sub_'),
    invoiceId: () => gen('in_'),
    invoiceItemId: () => gen('ii_'),
    invoiceLineItemId: () => gen('il_'),
    paymentIntentId: () => gen('pi_'),
    chargeId: () => gen('ch_'),
    paymentMethodId: () => gen('pm_'),
    checkoutSessionId: () => gen('cs_'),
    disputeId: () => gen('dp_'),
    refundId: () => gen('re_'),
    productId: () => gen('prod_'),
    priceId: () => gen('price_'),
    subscriptionItemId: () => gen('si_'),
    setupIntentId: () => gen('seti_'),
  };
}
