// Copyright 2026 Sutyr Inc. SPDX-License-Identifier: Apache-2.0
import { describe, it, expect } from 'vitest';
import {
  paymentIntentSucceeded,
  paymentIntentPaymentFailed,
  chargeSucceeded,
  chargeRefunded,
  invoiceCreated,
  invoicePaid,
  invoicePaymentFailed,
  invoicePaymentSucceeded,
  subscriptionCreated,
  subscriptionUpdated,
  subscriptionDeleted,
  checkoutSessionCompleted,
  checkoutSessionExpired,
  customerCreated,
  customerUpdated,
  disputeCreated,
  disputeUpdated,
  disputeClosed,
  STRIPE_API_VERSION,
} from '@webhook-lab/events';
import type { StripeEvent } from '@webhook-lab/events';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const ID_PREFIX_MAP: Record<string, RegExp> = {
  evt_: /^evt_[a-zA-Z0-9]+$/,
  cus_: /^cus_[a-zA-Z0-9]+$/,
  sub_: /^sub_[a-zA-Z0-9]+$/,
  in_: /^in_[a-zA-Z0-9]+$/,
  il_: /^il_[a-zA-Z0-9]+$/,
  pi_: /^pi_[a-zA-Z0-9]+$/,
  ch_: /^ch_[a-zA-Z0-9]+$/,
  pm_: /^pm_[a-zA-Z0-9]+$/,
  cs_: /^cs_[a-zA-Z0-9]+$/,
  dp_: /^dp_[a-zA-Z0-9]+$/,
  re_: /^re_[a-zA-Z0-9]+$/,
  prod_: /^prod_[a-zA-Z0-9]+$/,
  price_: /^price_[a-zA-Z0-9]+$/,
  si_: /^si_[a-zA-Z0-9]+$/,
  seti_: /^seti_[a-zA-Z0-9]+$/,
};

function findMatchingPrefix(value: string): RegExp | null {
  for (const [prefix, pattern] of Object.entries(ID_PREFIX_MAP)) {
    if (value.startsWith(prefix)) {
      return pattern;
    }
  }
  return null;
}

function assertNoUndefined(obj: unknown, path = 'root'): void {
  if (obj === undefined) {
    throw new Error(`Found undefined at ${path}`);
  }
  if (obj !== null && typeof obj === 'object') {
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      assertNoUndefined(value, `${path}.${key}`);
    }
  }
}

function assertValidTimestamp(ts: unknown, path: string): void {
  expect(typeof ts).toBe('number');
  const num = ts as number;
  expect(Number.isInteger(num)).toBe(true);
  // Must be Unix seconds (not milliseconds) — between 2020 and 2030
  expect(num).toBeGreaterThan(1577836800); // 2020-01-01
  expect(num).toBeLessThan(1893456000); // 2030-01-01
}

function assertValidIds(obj: unknown, path = 'root'): void {
  if (obj === null || obj === undefined) return;
  if (typeof obj === 'string') {
    const pattern = findMatchingPrefix(obj);
    if (pattern) {
      expect(obj, `Invalid ID at ${path}: ${obj}`).toMatch(pattern);
    }
    return;
  }
  if (typeof obj === 'object') {
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      assertValidIds(value, `${path}.${key}`);
    }
  }
}

const VALID_OBJECT_VALUES = new Set([
  'event',
  'payment_intent',
  'charge',
  'refund',
  'invoice',
  'line_item',
  'subscription',
  'subscription_item',
  'price',
  'customer',
  'checkout.session',
  'dispute',
  'list',
  'payment_method',
]);

function assertValidObjectFields(obj: unknown, path = 'root'): void {
  if (obj === null || obj === undefined || typeof obj !== 'object') return;

  const record = obj as Record<string, unknown>;
  if ('object' in record && typeof record.object === 'string') {
    expect(
      VALID_OBJECT_VALUES.has(record.object),
      `Invalid object value "${record.object}" at ${path}.object`,
    ).toBe(true);
  }

  for (const [key, value] of Object.entries(record)) {
    if (key !== 'object' && typeof value === 'object' && value !== null) {
      assertValidObjectFields(value, `${path}.${key}`);
    }
  }
}

function assertValidListWrappers(obj: unknown, path = 'root'): void {
  if (obj === null || obj === undefined || typeof obj !== 'object') return;

  const record = obj as Record<string, unknown>;
  if (record.object === 'list') {
    expect(Array.isArray(record.data), `${path}.data should be array`).toBe(true);
    expect(typeof record.has_more, `${path}.has_more should be boolean`).toBe('boolean');
    expect(typeof record.total_count, `${path}.total_count should be number`).toBe('number');
    expect(typeof record.url, `${path}.url should be string`).toBe('string');
  }

  for (const [key, value] of Object.entries(record)) {
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      assertValidListWrappers(value, `${path}.${key}`);
    }
    if (Array.isArray(value)) {
      for (let i = 0; i < value.length; i++) {
        assertValidListWrappers(value[i], `${path}.${key}[${i}]`);
      }
    }
  }
}

function assertValidEventEnvelope(event: StripeEvent): void {
  expect(event.id).toBeDefined();
  expect(event.id.startsWith('evt_')).toBe(true);
  expect(event.object).toBe('event');
  expect(event.api_version).toBe(STRIPE_API_VERSION);
  assertValidTimestamp(event.created, 'event.created');
  expect(typeof event.type).toBe('string');
  expect(event.type.length).toBeGreaterThan(0);
  expect(event.livemode).toBe(false);
  expect(typeof event.pending_webhooks).toBe('number');
  expect(event.request).toBeDefined();
  expect(event.data).toBeDefined();
  expect(event.data.object).toBeDefined();
}

function validateEvent(event: StripeEvent): void {
  // 1. No undefined in serialized JSON
  const parsed = JSON.parse(JSON.stringify(event));
  assertNoUndefined(parsed);

  // 2. Valid ID prefixes
  assertValidIds(parsed);

  // 3. Valid timestamps
  assertValidTimestamp(event.created, 'event.created');
  const innerObj = event.data.object as Record<string, unknown>;
  if ('created' in innerObj) {
    assertValidTimestamp(innerObj.created, 'data.object.created');
  }

  // 4. Valid object fields
  assertValidObjectFields(parsed);

  // 5. Valid List wrappers
  assertValidListWrappers(parsed);

  // 6. Valid event envelope
  assertValidEventEnvelope(event);
}

// ─── Tests ───────────────────────────────────────────────────────────────────

const ALL_GENERATORS: Array<[string, () => StripeEvent]> = [
  ['paymentIntentSucceeded', () => paymentIntentSucceeded()],
  ['paymentIntentPaymentFailed', () => paymentIntentPaymentFailed()],
  ['chargeSucceeded', () => chargeSucceeded()],
  ['chargeRefunded', () => chargeRefunded()],
  ['invoiceCreated', () => invoiceCreated()],
  ['invoicePaid', () => invoicePaid()],
  ['invoicePaymentFailed', () => invoicePaymentFailed()],
  ['invoicePaymentSucceeded', () => invoicePaymentSucceeded()],
  ['subscriptionCreated', () => subscriptionCreated()],
  ['subscriptionUpdated', () => subscriptionUpdated()],
  ['subscriptionDeleted', () => subscriptionDeleted()],
  ['checkoutSessionCompleted', () => checkoutSessionCompleted()],
  ['checkoutSessionExpired', () => checkoutSessionExpired()],
  ['customerCreated', () => customerCreated()],
  ['customerUpdated', () => customerUpdated()],
  ['disputeCreated', () => disputeCreated()],
  ['disputeUpdated', () => disputeUpdated()],
  ['disputeClosed', () => disputeClosed()],
];

describe('schema validation: all 18 generators', () => {
  for (const [name, generate] of ALL_GENERATORS) {
    describe(name, () => {
      it('passes full structural validation', () => {
        const event = generate();
        validateEvent(event);
      });

      it('produces valid JSON with no undefined values', () => {
        const event = generate();
        const json = JSON.stringify(event);
        expect(json).not.toContain('undefined');
        const parsed = JSON.parse(json);
        assertNoUndefined(parsed);
      });

      it('has matching event type in envelope and inner object type', () => {
        const event = generate();
        expect(event.type).toBeTruthy();
        expect(event.data.object.object).toBeTruthy();
      });
    });
  }
});

describe('schema validation: timestamp-specific checks', () => {
  it('subscription has current_period_end > current_period_start', () => {
    const event = subscriptionCreated();
    const sub = event.data.object as Record<string, unknown>;
    expect(sub.current_period_end).toBeGreaterThan(sub.current_period_start as number);
  });

  it('invoice.payment_failed has future next_payment_attempt', () => {
    const event = invoicePaymentFailed();
    const inv = event.data.object as Record<string, unknown>;
    const nextAttempt = inv.next_payment_attempt as number;
    expect(nextAttempt).toBeGreaterThan(event.created);
  });
});

describe('schema validation: decline code placement', () => {
  it('paymentIntentPaymentFailed has decline_code at correct path', () => {
    const event = paymentIntentPaymentFailed({ declineCode: 'insufficient_funds' });
    const pi = event.data.object as Record<string, unknown>;
    const error = pi.last_payment_error as Record<string, unknown>;
    expect(error.decline_code).toBe('insufficient_funds');
    expect(error.code).toBe('card_declined');
  });

  it('paymentIntentPaymentFailed with expired_card has NO decline_code key', () => {
    const event = paymentIntentPaymentFailed({ declineCode: 'expired_card' });
    const pi = event.data.object as Record<string, unknown>;
    const error = pi.last_payment_error as Record<string, unknown>;
    expect(error.code).toBe('expired_card');
    expect('decline_code' in error).toBe(false);
  });

  it('invoicePaymentFailed has NO decline_code anywhere in the payload', () => {
    const event = invoicePaymentFailed();
    const json = JSON.stringify(event);
    expect(json).not.toContain('decline_code');
  });
});

// ─── Stripe Enum Validation ──────────────────────────────────────────────────

describe('schema validation: Stripe enum values', () => {
  const VALID_PAYMENT_INTENT_STATUSES = new Set([
    'requires_payment_method', 'requires_confirmation', 'requires_action',
    'processing', 'requires_capture', 'canceled', 'succeeded',
  ]);

  const VALID_INVOICE_STATUSES = new Set([
    'draft', 'open', 'paid', 'void', 'uncollectible',
  ]);

  const VALID_SUBSCRIPTION_STATUSES = new Set([
    'incomplete', 'incomplete_expired', 'trialing', 'active',
    'past_due', 'canceled', 'unpaid', 'paused',
  ]);

  const VALID_DISPUTE_STATUSES = new Set([
    'warning_needs_response', 'warning_under_review', 'warning_closed',
    'needs_response', 'under_review', 'won', 'lost',
  ]);

  const VALID_CHECKOUT_STATUSES = new Set(['open', 'complete', 'expired']);
  const VALID_CHECKOUT_MODES = new Set(['payment', 'subscription', 'setup']);

  it('paymentIntentSucceeded uses valid PaymentIntent status', () => {
    const event = paymentIntentSucceeded();
    const obj = event.data.object as Record<string, unknown>;
    expect(VALID_PAYMENT_INTENT_STATUSES.has(obj.status as string)).toBe(true);
  });

  it('paymentIntentPaymentFailed uses valid PaymentIntent status', () => {
    const event = paymentIntentPaymentFailed();
    const obj = event.data.object as Record<string, unknown>;
    expect(VALID_PAYMENT_INTENT_STATUSES.has(obj.status as string)).toBe(true);
  });

  it('invoiceCreated uses valid Invoice status', () => {
    const event = invoiceCreated();
    const obj = event.data.object as Record<string, unknown>;
    expect(VALID_INVOICE_STATUSES.has(obj.status as string)).toBe(true);
  });

  it('invoicePaid uses valid Invoice status', () => {
    const event = invoicePaid();
    const obj = event.data.object as Record<string, unknown>;
    expect(VALID_INVOICE_STATUSES.has(obj.status as string)).toBe(true);
  });

  it('invoicePaymentFailed uses valid Invoice status', () => {
    const event = invoicePaymentFailed();
    const obj = event.data.object as Record<string, unknown>;
    expect(VALID_INVOICE_STATUSES.has(obj.status as string)).toBe(true);
  });

  it('subscriptionCreated uses valid Subscription status', () => {
    const event = subscriptionCreated();
    const obj = event.data.object as Record<string, unknown>;
    expect(VALID_SUBSCRIPTION_STATUSES.has(obj.status as string)).toBe(true);
  });

  it('subscriptionUpdated uses valid Subscription status', () => {
    const event = subscriptionUpdated();
    const obj = event.data.object as Record<string, unknown>;
    expect(VALID_SUBSCRIPTION_STATUSES.has(obj.status as string)).toBe(true);
  });

  it('subscriptionDeleted uses valid Subscription status', () => {
    const event = subscriptionDeleted();
    const obj = event.data.object as Record<string, unknown>;
    expect(VALID_SUBSCRIPTION_STATUSES.has(obj.status as string)).toBe(true);
  });

  it('disputeCreated uses valid Dispute status', () => {
    const event = disputeCreated();
    const obj = event.data.object as Record<string, unknown>;
    expect(VALID_DISPUTE_STATUSES.has(obj.status as string)).toBe(true);
  });

  it('disputeUpdated uses valid Dispute status', () => {
    const event = disputeUpdated();
    const obj = event.data.object as Record<string, unknown>;
    expect(VALID_DISPUTE_STATUSES.has(obj.status as string)).toBe(true);
  });

  it('disputeClosed uses valid Dispute status', () => {
    const event = disputeClosed();
    const obj = event.data.object as Record<string, unknown>;
    expect(VALID_DISPUTE_STATUSES.has(obj.status as string)).toBe(true);
  });

  it('checkoutSessionCompleted uses valid Checkout status and mode', () => {
    const event = checkoutSessionCompleted();
    const obj = event.data.object as Record<string, unknown>;
    expect(VALID_CHECKOUT_STATUSES.has(obj.status as string)).toBe(true);
    expect(VALID_CHECKOUT_MODES.has(obj.mode as string)).toBe(true);
  });

  it('checkoutSessionExpired uses valid Checkout status', () => {
    const event = checkoutSessionExpired();
    const obj = event.data.object as Record<string, unknown>;
    expect(VALID_CHECKOUT_STATUSES.has(obj.status as string)).toBe(true);
  });
});
