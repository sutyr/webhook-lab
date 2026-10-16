// Copyright 2026 Sutyr Inc. SPDX-License-Identifier: Apache-2.0
// The CLI and the suite pick generators at runtime from the events registry,
// so check that the registry and the catalogs agree.
import { describe, it, expect } from 'vitest';
import {
  EVENT_CATALOG,
  EVENT_GENERATORS,
  SCENARIO_CATALOG,
  SCENARIO_GENERATORS,
  STRIPE_API_VERSION,
  type StripeEventType,
} from '@webhook-lab/events';

const ORIGINAL_18: StripeEventType[] = [
  'payment_intent.succeeded',
  'payment_intent.payment_failed',
  'charge.succeeded',
  'charge.refunded',
  'invoice.created',
  'invoice.paid',
  'invoice.payment_failed',
  'invoice.payment_succeeded',
  'customer.subscription.created',
  'customer.subscription.updated',
  'customer.subscription.deleted',
  'checkout.session.completed',
  'checkout.session.expired',
  'customer.created',
  'customer.updated',
  'charge.dispute.created',
  'charge.dispute.updated',
  'charge.dispute.closed',
];

describe('EVENT_GENERATORS', () => {
  it('has a generator for each of the original 18 events', () => {
    for (const type of ORIGINAL_18) {
      expect(Object.hasOwn(EVENT_GENERATORS, type), type).toBe(true);
    }
  });

  it('produces an event of the type it is registered under', () => {
    for (const [type, generate] of Object.entries(EVENT_GENERATORS)) {
      const event = generate!();
      expect(event.type, type).toBe(type);
      expect(event.object).toBe('event');
      expect(event.id).toMatch(/^evt_/);
      expect(event.api_version).toBe(STRIPE_API_VERSION);
    }
  });

  it('only registers types that are in the catalog', () => {
    const catalogued = new Set(EVENT_CATALOG.map((e) => e.type));
    for (const type of Object.keys(EVENT_GENERATORS)) {
      expect(catalogued.has(type as StripeEventType), type).toBe(true);
    }
  });
});

describe('SCENARIO_GENERATORS', () => {
  it('matches the scenario catalog', () => {
    expect(Object.keys(SCENARIO_GENERATORS).sort()).toEqual(
      SCENARIO_CATALOG.map((s) => s.id).sort(),
    );
  });

  it('shares entity IDs across steps and changes them with the seed', () => {
    const a = SCENARIO_GENERATORS['subscription-failure']!({ seed: 'one' });
    const b = SCENARIO_GENERATORS['subscription-failure']!({ seed: 'two' });
    const subId = (preset: typeof a) =>
      (preset.steps.at(-1)!.event.data.object as { id: string }).id;
    expect(a.steps[3]!.event.data.object.id).toBe(subId(a));
    expect(subId(a)).not.toBe(subId(b));
  });

  it('returns the step count the catalog advertises', () => {
    for (const entry of SCENARIO_CATALOG) {
      expect(SCENARIO_GENERATORS[entry.id]!().steps, entry.id).toHaveLength(entry.stepCount);
    }
  });
});
