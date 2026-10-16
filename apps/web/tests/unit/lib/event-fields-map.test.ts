// Copyright 2026 Sutyr Inc. SPDX-License-Identifier: Apache-2.0

import { describe, it, expect } from 'vitest';
import { EVENT_FIELDS, getFieldsForEvent } from '@/lib/event-fields-map';
import type { FieldDef } from '@/lib/event-fields-map';
import { EVENT_TYPE_TO_GENERATOR } from '@/lib/event-generator-map';
import { extractOptionsFromJson } from '@/lib/json-to-options';
import { EVENT_CATALOG } from '@webhook-lab/events';
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

  it('has fields for every event in the catalog, and only for those', () => {
    const catalogTypes = EVENT_CATALOG.map((e) => e.type).sort();
    expect(Object.keys(EVENT_FIELDS).sort()).toEqual(catalogTypes);
  });

  it('uses each field key once per event', () => {
    for (const [eventType, fields] of Object.entries(EVENT_FIELDS)) {
      const keys = fields.map((f) => f.key);
      expect(new Set(keys).size, `${eventType} repeats a field key`).toBe(keys.length);
    }
  });

  it('gives every select a default that is one of its options', () => {
    for (const [eventType, fields] of Object.entries(EVENT_FIELDS)) {
      for (const field of fields.filter((f) => f.type === 'select')) {
        const values = (field.options ?? []).map((o) => o.value);
        expect(values, `${eventType}.${field.key} options`).toContain(String(field.defaultValue));
      }
    }
  });

  it('marks every entity ID field mono, empty by default, with an ID prefix placeholder', () => {
    for (const [eventType, fields] of Object.entries(EVENT_FIELDS)) {
      for (const field of fields.filter((f) => f.section === 'entity-ids')) {
        const where = `${eventType}.${field.key}`;
        expect(field.mono, where).toBe(true);
        expect(field.defaultValue, where).toBe('');
        expect(field.placeholder, where).toMatch(/^[a-z]+_$/);
      }
    }
  });
});

// ─── Fields against generated payloads ───────────────────────────────────────
// The editor shows a field's defaultValue until the user edits it, and sends
// only edited keys. So a default must equal what the generator produces with
// no options, and a jsonPath must point at the value the option sets, or the
// form and the payload disagree.

type Generated = Record<string, unknown>;

function at(obj: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>(
    (acc, key) => (acc && typeof acc === 'object' ? (acc as Record<string, unknown>)[key] : undefined),
    obj,
  );
}

function generate(type: StripeEventType, options: Record<string, unknown> = {}): Generated {
  return EVENT_TYPE_TO_GENERATOR[type](options) as Generated;
}

function coerce(field: FieldDef, value: unknown): unknown {
  return field.coerceBoolean ? value === 'true' || value === true : value;
}

// Expiry months spaced so the default, a sample and a context value differ.
const CURRENT_MONTH = new Date().getUTCMonth() + 1;
const monthPlus = (n: number) => ((CURRENT_MONTH - 1 + n) % 12) + 1;

// Options a field needs before its value shows up in the payload.
const CONTEXT: Record<string, Record<string, unknown>> = {
  'checkout.session.completed.subscriptionId': { mode: 'subscription' },
  'payment_intent.requires_action.returnUrl': { nextActionType: 'redirect_to_url' },
  'refund.created.pendingReason': { status: 'pending' },
  'invoice.finalized.dueDate': { collectionMethod: 'send_invoice' },
  'invoice_payment.paid.chargeId': { paymentType: 'charge' },
  'checkout.session.async_payment_succeeded.subscriptionId': { mode: 'subscription' },
  'checkout.session.async_payment_succeeded.invoiceId': { mode: 'subscription' },
  'checkout.session.async_payment_failed.subscriptionId': { mode: 'subscription' },
  'checkout.session.async_payment_failed.invoiceId': { mode: 'subscription' },
  // previous_attributes lists a card key only when its value changed.
  'payment_method.automatically_updated.previousCardLast4': { cardLast4: '9999' },
  'payment_method.automatically_updated.previousCardExpMonth': { cardExpMonth: monthPlus(6) },
};

const SAMPLE_BY_KEY: Record<string, unknown> = {
  amount: 4321,
  amountPaid: 1234,
  priceAmount: 4999,
  refundAmount: 1000,
  attemptCount: 3,
  trialPeriodDays: 30,
  periodEnd: 1_790_000_000,
  dueDate: 1_790_000_000,
  pausedAt: 1_790_000_000,
  cardExpMonth: monthPlus(6),
  cardExpYear: 2031,
  previousCardExpMonth: monthPlus(3),
  previousCardExpYear: 2024,
  cardLast4: '1881',
  previousCardLast4: '0005',
  email: 'sam@example.com',
  previousEmail: 'before@example.com',
  name: 'Sam Example',
  returnUrl: 'https://example.com/return',
  clientReferenceId: 'order_42',
};

/** A value for the field that differs from its default. */
function sampleFor(field: FieldDef): unknown {
  if (field.type === 'select') {
    const option = (field.options ?? []).find(
      (o) => o.value !== '' && o.value !== String(field.defaultValue),
    );
    return option ? coerce(field, option.value) : coerce(field, field.defaultValue);
  }
  if (field.section === 'entity-ids') return `${field.placeholder}Sample123`;
  if (Object.hasOwn(SAMPLE_BY_KEY, field.key)) return SAMPLE_BY_KEY[field.key];
  return field.type === 'number' ? 777 : 'sample';
}

const EVENT_TYPES = Object.keys(EVENT_FIELDS) as StripeEventType[];

describe('EVENT_FIELDS against generated payloads', () => {
  it.each(EVENT_TYPES)('%s: shown defaults match the generated payload', (type) => {
    for (const field of EVENT_FIELDS[type]) {
      if (!field.jsonPath || field.defaultValue === '') continue;
      const context = CONTEXT[`${type}.${field.key}`] ?? {};
      const event = generate(type, context);
      expect(at(event, field.jsonPath), `${type}.${field.key} at ${field.jsonPath}`).toEqual(
        coerce(field, field.defaultValue),
      );
    }
  });

  it.each(EVENT_TYPES)('%s: each jsonPath reads back the value its option set', (type) => {
    for (const field of EVENT_FIELDS[type]) {
      if (!field.jsonPath) continue;
      const sample = sampleFor(field);
      const context = CONTEXT[`${type}.${field.key}`] ?? {};
      const event = generate(type, { ...context, [field.key]: sample });
      expect(at(event, field.jsonPath), `${type}.${field.key} at ${field.jsonPath}`).toEqual(sample);
    }
  });

  it.each(EVENT_TYPES)('%s: every select option generates, and JSON sync is stable', (type) => {
    const fields = getFieldsForEvent(type);
    for (const field of fields.filter((f) => f.type === 'select')) {
      for (const option of field.options ?? []) {
        const where = `${type}.${field.key}=${option.value}`;
        const context = CONTEXT[`${type}.${field.key}`] ?? {};
        const event = generate(type, { ...context, [field.key]: coerce(field, option.value) });
        expect(event.type, where).toBe(type);

        // Leaving payload edit mode merges jsonPath values into the form's
        // options, which then regenerate. That must not fail or drift.
        const synced = extractOptionsFromJson(event, fields);
        const merged = { ...context, [field.key]: coerce(field, option.value), ...synced };
        const regenerated = generate(type, merged);
        expect(extractOptionsFromJson(regenerated, fields), where).toEqual(synced);
      }
    }
  });

  it('an empty input falls back to the generator default', () => {
    const event = generate('refund.created', { reason: '', amount: '', refundId: '' });
    const refund = at(event, 'data.object') as Record<string, unknown>;
    expect(refund.reason).toBeNull();
    expect(refund.amount).toBe(2999);
    expect(refund.id).toMatch(/^re_/);
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
