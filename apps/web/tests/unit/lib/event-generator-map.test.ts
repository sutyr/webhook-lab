// Copyright 2026 Sutyr Inc. SPDX-License-Identifier: Apache-2.0

import { describe, it, expect } from 'vitest';
import { EVENT_CATALOG } from '@webhook-lab/events';
import { EVENT_TYPE_TO_GENERATOR } from '@/lib/event-generator-map';

describe('EVENT_TYPE_TO_GENERATOR', () => {
  it('has an entry for every event type in EVENT_CATALOG', () => {
    for (const entry of EVENT_CATALOG) {
      expect(
        EVENT_TYPE_TO_GENERATOR[entry.type],
        `Missing generator for ${entry.type}`,
      ).toBeDefined();
    }
  });

  it('maps exactly the catalogued event types', () => {
    expect(Object.keys(EVENT_TYPE_TO_GENERATOR).sort()).toEqual(
      EVENT_CATALOG.map((e) => e.type).sort(),
    );
  });

  it('every generator function is callable and returns an event envelope', () => {
    for (const [eventType, generator] of Object.entries(EVENT_TYPE_TO_GENERATOR)) {
      const event = generator();

      expect(event, `${eventType} generator did not return an object`).toBeDefined();
      expect(event.id, `${eventType} event missing id`).toBeDefined();
      expect(event.id).toMatch(/^evt_/);
      expect(event.object, `${eventType} event missing object`).toBe('event');
      expect(event.type, `${eventType} event missing type`).toBe(eventType);
      expect(event.data, `${eventType} event missing data`).toBeDefined();
    }
  });

  it('finds nothing for Object.prototype names', () => {
    const lookup = EVENT_TYPE_TO_GENERATOR as Record<string, unknown>;
    for (const name of ['constructor', 'toString', '__proto__', 'hasOwnProperty']) {
      expect(lookup[name], name).toBeUndefined();
    }
  });

  it('drops empty-string options so the generator default applies', () => {
    const event = EVENT_TYPE_TO_GENERATOR['charge.refunded']({ refundAmount: '', customerId: '', amount: 5000 });
    expect(event.data.object.amount_refunded).toBe(5000);
    expect(event.data.object.customer).toMatch(/^cus_/);
  });

  it('passes other options through unchanged', () => {
    const event = EVENT_TYPE_TO_GENERATOR['customer.deleted']({ currency: null, email: null });
    expect(event.data.object.currency).toBeNull();
    expect(event.data.object.email).toBeNull();
  });

  it('treats a non-object options value as no options', () => {
    for (const options of [null, 'amount=5', [1, 2], 42]) {
      const event = EVENT_TYPE_TO_GENERATOR['payment_intent.succeeded'](options);
      expect(event.data.object.amount).toBe(2999);
    }
  });
});
