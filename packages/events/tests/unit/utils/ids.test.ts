// Copyright 2026 Sutyr Inc. SPDX-License-Identifier: Apache-2.0
import { describe, it, expect } from 'vitest';
import {
  generateId,
  eventId,
  customerId,
  subscriptionId,
  invoiceId,
  invoiceItemId,
  invoiceLineItemId,
  paymentIntentId,
  chargeId,
  paymentMethodId,
  checkoutSessionId,
  disputeId,
  refundId,
  productId,
  priceId,
  subscriptionItemId,
  setupIntentId,
  createSeededIdGenerator,
} from '../../../src/utils/ids.js';

describe('generateId', () => {
  it('returns a string starting with the given prefix', () => {
    const id = generateId('test_');
    expect(id.startsWith('test_')).toBe(true);
  });

  it('generates IDs with correct default length (prefix + 24 chars)', () => {
    const id = generateId('xx_');
    expect(id.length).toBe(3 + 24); // 'xx_' + 24 chars
  });

  it('respects custom length parameter', () => {
    const id = generateId('xx_', 10);
    expect(id.length).toBe(3 + 10);
  });

  it('generates only alphanumeric characters after prefix', () => {
    const id = generateId('test_');
    const suffix = id.slice(5); // after 'test_'
    expect(suffix).toMatch(/^[a-zA-Z0-9]+$/);
  });

  it('generates different IDs on each call', () => {
    const id1 = generateId('test_');
    const id2 = generateId('test_');
    expect(id1).not.toBe(id2);
  });
});

describe('convenience ID functions', () => {
  const cases: Array<[string, () => string, string]> = [
    ['eventId', eventId, 'evt_'],
    ['customerId', customerId, 'cus_'],
    ['subscriptionId', subscriptionId, 'sub_'],
    ['invoiceId', invoiceId, 'in_'],
    ['invoiceItemId', invoiceItemId, 'ii_'],
    ['invoiceLineItemId', invoiceLineItemId, 'il_'],
    ['paymentIntentId', paymentIntentId, 'pi_'],
    ['chargeId', chargeId, 'ch_'],
    ['paymentMethodId', paymentMethodId, 'pm_'],
    ['checkoutSessionId', checkoutSessionId, 'cs_'],
    ['disputeId', disputeId, 'dp_'],
    ['refundId', refundId, 're_'],
    ['productId', productId, 'prod_'],
    ['priceId', priceId, 'price_'],
    ['subscriptionItemId', subscriptionItemId, 'si_'],
    ['setupIntentId', setupIntentId, 'seti_'],
  ];

  for (const [name, fn, prefix] of cases) {
    it(`${name}() returns an ID starting with '${prefix}'`, () => {
      const id = fn();
      expect(id.startsWith(prefix)).toBe(true);
    });

    it(`${name}() returns alphanumeric characters after prefix`, () => {
      const id = fn();
      const suffix = id.slice(prefix.length);
      expect(suffix).toMatch(/^[a-zA-Z0-9]+$/);
    });
  }
});

describe('createSeededIdGenerator', () => {
  it('produces the same IDs for the same seed', () => {
    const gen1 = createSeededIdGenerator('test-seed');
    const gen2 = createSeededIdGenerator('test-seed');

    expect(gen1.customerId()).toBe(gen2.customerId());
  });

  it('produces a deterministic sequence with same seed', () => {
    const gen1 = createSeededIdGenerator('seq-test');
    const gen2 = createSeededIdGenerator('seq-test');

    const ids1 = [gen1.customerId(), gen1.subscriptionId(), gen1.invoiceId()];
    const ids2 = [gen2.customerId(), gen2.subscriptionId(), gen2.invoiceId()];

    expect(ids1).toEqual(ids2);
  });

  it('produces different IDs for different seeds', () => {
    const gen1 = createSeededIdGenerator('seed-a');
    const gen2 = createSeededIdGenerator('seed-b');

    expect(gen1.customerId()).not.toBe(gen2.customerId());
  });

  it('produces IDs with correct prefixes', () => {
    const gen = createSeededIdGenerator('prefix-test');
    expect(gen.eventId().startsWith('evt_')).toBe(true);
    expect(gen.customerId().startsWith('cus_')).toBe(true);
    expect(gen.subscriptionId().startsWith('sub_')).toBe(true);
    expect(gen.invoiceId().startsWith('in_')).toBe(true);
    expect(gen.paymentIntentId().startsWith('pi_')).toBe(true);
    expect(gen.chargeId().startsWith('ch_')).toBe(true);
    expect(gen.priceId().startsWith('price_')).toBe(true);
    expect(gen.disputeId().startsWith('dp_')).toBe(true);
  });

  it('produces alphanumeric characters after prefix', () => {
    const gen = createSeededIdGenerator('alnum-test');
    const id = gen.customerId();
    const suffix = id.slice(4); // after 'cus_'
    expect(suffix).toMatch(/^[a-zA-Z0-9]+$/);
  });
});
