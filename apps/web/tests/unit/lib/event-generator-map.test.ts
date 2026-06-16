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
});
