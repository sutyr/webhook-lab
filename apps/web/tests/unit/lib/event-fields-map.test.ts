// Copyright 2026 Sutyr Inc. SPDX-License-Identifier: Apache-2.0

import { describe, it, expect } from 'vitest';
import { EVENT_FIELDS, getFieldsForEvent } from '@/lib/event-fields-map';
import type { StripeEventType } from '@webhook-lab/events';

describe('EVENT_FIELDS', () => {
  it('every event type with fields has at least one field', () => {
    for (const [eventType, fields] of Object.entries(EVENT_FIELDS)) {
      expect(
        fields!.length,
        `${eventType} has an empty fields array`,
      ).toBeGreaterThan(0);
    }
  });

  it('each field has key, label, type, and defaultValue', () => {
    for (const [eventType, fields] of Object.entries(EVENT_FIELDS)) {
      for (const field of fields!) {
        expect(field.key, `${eventType}: field missing key`).toBeDefined();
        expect(typeof field.key).toBe('string');
        expect(field.label, `${eventType}: field missing label`).toBeDefined();
        expect(typeof field.label).toBe('string');
        expect(field.type, `${eventType}: field missing type`).toBeDefined();
        expect(['number', 'text', 'select']).toContain(field.type);
        expect(
          field,
          `${eventType}.${field.key}: field missing defaultValue`,
        ).toHaveProperty('defaultValue');
      }
    }
  });

  it('payment_intent.payment_failed has a declineCode field with options', () => {
    const fields = EVENT_FIELDS['payment_intent.payment_failed'];
    expect(fields).toBeDefined();

    const declineCodeField = fields!.find((f) => f.key === 'declineCode');
    expect(declineCodeField, 'declineCode field not found').toBeDefined();
    expect(declineCodeField!.type).toBe('select');
    expect(declineCodeField!.options).toBeDefined();
    expect(declineCodeField!.options!.length).toBeGreaterThan(0);

    // Each option should have value and label
    for (const option of declineCodeField!.options!) {
      expect(option.value).toBeDefined();
      expect(option.label).toBeDefined();
    }
  });
});

describe('getFieldsForEvent', () => {
  it('returns fields for a known event type', () => {
    const fields = getFieldsForEvent('payment_intent.succeeded' as StripeEventType);
    expect(fields.length).toBeGreaterThan(0);
  });

  it('returns an empty array for unknown event types', () => {
    const fields = getFieldsForEvent('totally.unknown.event' as StripeEventType);
    expect(fields).toEqual([]);
  });

  it('includes entity-id section fields for events that accept entity IDs', () => {
    const fields = getFieldsForEvent('payment_intent.succeeded' as StripeEventType);
    const entityIdFields = fields.filter((f) => f.section === 'entity-ids');
    expect(entityIdFields.length).toBeGreaterThan(0);
    // Should include customerId at minimum
    expect(entityIdFields.find((f) => f.key === 'customerId')).toBeDefined();
  });

  it('includes event-options section fields (livemode + apiVersion) for all event types', () => {
    const fields = getFieldsForEvent('invoice.payment_failed' as StripeEventType);
    const eventOptionFields = fields.filter((f) => f.section === 'event-options');
    expect(eventOptionFields).toHaveLength(2);
    expect(eventOptionFields.find((f) => f.key === 'livemode')).toBeDefined();
    expect(eventOptionFields.find((f) => f.key === 'apiVersion')).toBeDefined();
  });

  it('entity-id fields have mono: true and placeholder with ID prefix', () => {
    const fields = getFieldsForEvent('charge.succeeded' as StripeEventType);
    const entityIdFields = fields.filter((f) => f.section === 'entity-ids');
    for (const field of entityIdFields) {
      expect(field.mono).toBe(true);
      expect(field.placeholder).toBeDefined();
      expect(field.defaultValue).toBe('');
    }
  });
});
