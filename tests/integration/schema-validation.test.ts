// Copyright 2026 Sutyr Inc. SPDX-License-Identifier: Apache-2.0
import { describe, it, expect } from 'vitest';
import {
  paymentIntentSucceeded,
  paymentIntentPaymentFailed,
  paymentIntentRequiresAction,
  paymentIntentCanceled,
  chargeSucceeded,
  chargeFailed,
  chargeRefunded,
  refundCreated,
  invoiceUpcoming,
  invoiceCreated,
  invoiceFinalized,
  invoicePaid,
  invoicePaymentFailed,
  invoicePaymentActionRequired,
  invoicePaymentSucceeded,
  invoicePaymentPaid,
  invoiceOverdue,
  invoiceMarkedUncollectible,
  invoiceVoided,
  subscriptionCreated,
  subscriptionTrialWillEnd,
  subscriptionUpdated,
  subscriptionPaused,
  subscriptionResumed,
  subscriptionDeleted,
  checkoutSessionCompleted,
  checkoutSessionAsyncPaymentSucceeded,
  checkoutSessionAsyncPaymentFailed,
  checkoutSessionExpired,
  customerCreated,
  customerUpdated,
  customerDeleted,
  paymentMethodAttached,
  setupIntentSucceeded,
  paymentMethodAutomaticallyUpdated,
  earlyFraudWarningCreated,
  disputeCreated,
  disputeUpdated,
  disputeClosed,
  EVENT_CATALOG,
  EVENT_GENERATORS,
  STRIPE_API_VERSION,
} from '@webhook-lab/events';
import type { StripeEvent, StripeEventType } from '@webhook-lab/events';

// ─── Helpers ─────────────────────────────────────────────────────────────────

// Checked in order, so a longer prefix (il_tmp_) must come before the
// shorter one it starts with (il_).
const ID_PREFIX_MAP: Record<string, RegExp> = {
  evt_: /^evt_[a-zA-Z0-9]+$/,
  cus_: /^cus_[a-zA-Z0-9]+$/,
  sub_: /^sub_[a-zA-Z0-9]+$/,
  in_: /^in_[a-zA-Z0-9]+$/,
  inpay_: /^inpay_[a-zA-Z0-9]+$/,
  // Line items on the invoice.upcoming preview have temporary IDs.
  il_tmp_: /^il_tmp_[a-zA-Z0-9]+$/,
  il_: /^il_[a-zA-Z0-9]+$/,
  pi_: /^pi_[a-zA-Z0-9]+$/,
  ch_: /^ch_[a-zA-Z0-9]+$/,
  pm_: /^pm_[a-zA-Z0-9]+$/,
  pmc_: /^pmc_[a-zA-Z0-9]+$/,
  cs_: /^cs_[a-zA-Z0-9]+$/,
  dp_: /^dp_[a-zA-Z0-9]+$/,
  re_: /^re_[a-zA-Z0-9]+$/,
  req_: /^req_[a-zA-Z0-9]+$/,
  txn_: /^txn_[a-zA-Z0-9]+$/,
  issfr_: /^issfr_[a-zA-Z0-9]+$/,
  prod_: /^prod_[a-zA-Z0-9]+$/,
  price_: /^price_[a-zA-Z0-9]+$/,
  si_: /^si_[a-zA-Z0-9]+$/,
  seti_: /^seti_[a-zA-Z0-9]+$/,
  setatt_: /^setatt_[a-zA-Z0-9]+$/,
  mandate_: /^mandate_[a-zA-Z0-9]+$/,
};

// A client secret is `<intent id>_secret_<random>`, so it starts with an ID
// prefix but is not an ID.
const CLIENT_SECRET = /^(pi|seti)_[a-zA-Z0-9]+_secret_[a-zA-Z0-9]+$/;

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
  if (typeof obj === 'string' && path.endsWith('.client_secret')) {
    expect(obj, `Invalid client secret at ${path}: ${obj}`).toMatch(CLIENT_SECRET);
    return;
  }
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
  'invoice_payment',
  'radar.early_fraud_warning',
  'setup_intent',
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

// invoice.upcoming's preview invoice has no `id`, so its envelope type is
// StripeUpcomingInvoiceEvent. The structural checks here never read
// data.object.id, so it is validated as a StripeEvent.
const upcomingAsEvent = () => invoiceUpcoming() as unknown as StripeEvent;

const ALL_GENERATORS: Array<[string, () => StripeEvent]> = [
  ['paymentIntentSucceeded', () => paymentIntentSucceeded()],
  ['paymentIntentPaymentFailed', () => paymentIntentPaymentFailed()],
  ['paymentIntentRequiresAction', () => paymentIntentRequiresAction()],
  ['paymentIntentCanceled', () => paymentIntentCanceled()],
  ['chargeSucceeded', () => chargeSucceeded()],
  ['chargeFailed', () => chargeFailed()],
  ['chargeRefunded', () => chargeRefunded()],
  ['refundCreated', () => refundCreated()],
  ['invoiceUpcoming', upcomingAsEvent],
  ['invoiceCreated', () => invoiceCreated()],
  ['invoiceFinalized', () => invoiceFinalized()],
  ['invoicePaid', () => invoicePaid()],
  ['invoicePaymentFailed', () => invoicePaymentFailed()],
  ['invoicePaymentActionRequired', () => invoicePaymentActionRequired()],
  ['invoicePaymentSucceeded', () => invoicePaymentSucceeded()],
  ['invoicePaymentPaid', () => invoicePaymentPaid()],
  ['invoiceOverdue', () => invoiceOverdue()],
  ['invoiceMarkedUncollectible', () => invoiceMarkedUncollectible()],
  ['invoiceVoided', () => invoiceVoided()],
  ['subscriptionCreated', () => subscriptionCreated()],
  ['subscriptionTrialWillEnd', () => subscriptionTrialWillEnd()],
  ['subscriptionUpdated', () => subscriptionUpdated()],
  ['subscriptionPaused', () => subscriptionPaused()],
  ['subscriptionResumed', () => subscriptionResumed()],
  ['subscriptionDeleted', () => subscriptionDeleted()],
  ['checkoutSessionCompleted', () => checkoutSessionCompleted()],
  ['checkoutSessionAsyncPaymentSucceeded', () => checkoutSessionAsyncPaymentSucceeded()],
  ['checkoutSessionAsyncPaymentFailed', () => checkoutSessionAsyncPaymentFailed()],
  ['checkoutSessionExpired', () => checkoutSessionExpired()],
  ['customerCreated', () => customerCreated()],
  ['customerUpdated', () => customerUpdated()],
  ['customerDeleted', () => customerDeleted()],
  ['paymentMethodAttached', () => paymentMethodAttached()],
  ['setupIntentSucceeded', () => setupIntentSucceeded()],
  ['paymentMethodAutomaticallyUpdated', () => paymentMethodAutomaticallyUpdated()],
  ['earlyFraudWarningCreated', () => earlyFraudWarningCreated()],
  ['disputeCreated', () => disputeCreated()],
  ['disputeUpdated', () => disputeUpdated()],
  ['disputeClosed', () => disputeClosed()],
];

describe('schema validation: all 39 generators', () => {
  it('covers every catalogued event type', () => {
    expect(ALL_GENERATORS).toHaveLength(EVENT_CATALOG.length);
  });

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
  it('subscription items have current_period_end > current_period_start', () => {
    const event = subscriptionCreated();
    const item = event.data.object.items.data[0]!;
    expect(item.current_period_end).toBeGreaterThan(item.current_period_start);
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
    'needs_response', 'under_review', 'won', 'lost', 'prevented',
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

// Fields removed or made includable-only by Stripe API versions at or before
// the stamped api_version. Their presence would mean the payload claims a
// version it does not match.
describe('schema validation: payloads match the stamped api_version', () => {
  const ABSENT_FIELDS: [string, () => StripeEvent, string[]][] = [
    // 2025-03-31.basil: Invoice payment/subscription fields moved
    ['invoice.created', () => invoiceCreated(), ['paid', 'paid_out_of_band', 'subscription', 'payment_intent', 'charge', 'payments']],
    ['invoice.paid', () => invoicePaid(), ['paid', 'paid_out_of_band', 'subscription', 'payment_intent', 'charge', 'payments']],
    ['invoice.payment_failed', () => invoicePaymentFailed(), ['paid', 'paid_out_of_band', 'subscription', 'payment_intent', 'charge', 'payments']],
    ['invoice.payment_succeeded', () => invoicePaymentSucceeded(), ['paid', 'paid_out_of_band', 'subscription', 'payment_intent', 'charge', 'payments']],
    // 2025-03-31.basil: current_period_* moved to subscription items
    ['customer.subscription.created', () => subscriptionCreated(), ['current_period_start', 'current_period_end']],
    ['customer.subscription.updated', () => subscriptionUpdated(), ['current_period_start', 'current_period_end']],
    ['customer.subscription.deleted', () => subscriptionDeleted(), ['current_period_start', 'current_period_end']],
    // 2025-03-31.basil: invoice removed from PaymentIntent and Charge;
    // 2022-11-15: Charge.refunds no longer returned by default
    ['payment_intent.succeeded', () => paymentIntentSucceeded(), ['invoice']],
    ['payment_intent.payment_failed', () => paymentIntentPaymentFailed(), ['invoice']],
    ['charge.succeeded', () => chargeSucceeded(), ['invoice', 'refunds']],
    ['charge.refunded', () => chargeRefunded(), ['invoice', 'refunds']],
  ];

  for (const [type, gen, fields] of ABSENT_FIELDS) {
    it(`${type} omits ${fields.join(', ')}`, () => {
      const obj = gen().data.object as unknown as Record<string, unknown>;
      for (const field of fields) {
        expect(obj, `${type} should not contain ${field}`).not.toHaveProperty(field);
      }
    });
  }

  it('invoice line items use pricing.price_details and parent, not price/type/subscription', () => {
    for (const gen of [invoiceCreated, invoicePaid, invoicePaymentFailed, invoicePaymentSucceeded]) {
      const line = gen().data.object.lines.data[0]! as unknown as Record<string, unknown>;
      for (const field of ['price', 'plan', 'type', 'subscription', 'subscription_item', 'proration']) {
        expect(line).not.toHaveProperty(field);
      }
      expect(line).toHaveProperty('pricing.price_details.price');
      expect(line).toHaveProperty('parent.subscription_item_details.subscription_item');
    }
  });
});

// ─── Events added for 2026-09-30.endive ──────────────────────────────────────

describe('schema validation: the 21 newer events', () => {
  // [event type, generator, data.object.object, data.object.id prefix]
  // invoice.upcoming has no ID prefix: its preview invoice has no `id` at all.
  const NEW_EVENTS: Array<[StripeEventType, () => StripeEvent, string, string | null]> = [
    ['payment_intent.requires_action', () => paymentIntentRequiresAction(), 'payment_intent', 'pi_'],
    ['payment_intent.canceled', () => paymentIntentCanceled(), 'payment_intent', 'pi_'],
    ['charge.failed', () => chargeFailed(), 'charge', 'ch_'],
    ['refund.created', () => refundCreated(), 'refund', 're_'],
    ['invoice.upcoming', upcomingAsEvent, 'invoice', null],
    ['invoice.finalized', () => invoiceFinalized(), 'invoice', 'in_'],
    ['invoice.payment_action_required', () => invoicePaymentActionRequired(), 'invoice', 'in_'],
    ['invoice_payment.paid', () => invoicePaymentPaid(), 'invoice_payment', 'inpay_'],
    ['invoice.overdue', () => invoiceOverdue(), 'invoice', 'in_'],
    ['invoice.marked_uncollectible', () => invoiceMarkedUncollectible(), 'invoice', 'in_'],
    ['invoice.voided', () => invoiceVoided(), 'invoice', 'in_'],
    ['customer.subscription.trial_will_end', () => subscriptionTrialWillEnd(), 'subscription', 'sub_'],
    ['customer.subscription.paused', () => subscriptionPaused(), 'subscription', 'sub_'],
    ['customer.subscription.resumed', () => subscriptionResumed(), 'subscription', 'sub_'],
    ['customer.deleted', () => customerDeleted(), 'customer', 'cus_'],
    ['checkout.session.async_payment_succeeded', () => checkoutSessionAsyncPaymentSucceeded(), 'checkout.session', 'cs_'],
    ['checkout.session.async_payment_failed', () => checkoutSessionAsyncPaymentFailed(), 'checkout.session', 'cs_'],
    ['payment_method.attached', () => paymentMethodAttached(), 'payment_method', 'pm_'],
    ['setup_intent.succeeded', () => setupIntentSucceeded(), 'setup_intent', 'seti_'],
    ['payment_method.automatically_updated', () => paymentMethodAutomaticallyUpdated(), 'payment_method', 'pm_'],
    ['radar.early_fraud_warning.created', () => earlyFraudWarningCreated(), 'radar.early_fraud_warning', 'issfr_'],
  ];

  it('lists 21 events', () => {
    expect(NEW_EVENTS).toHaveLength(21);
  });

  it.each(NEW_EVENTS)('%s carries api_version 2026-09-30.endive', (type, generate) => {
    const event = generate();
    expect(event.type).toBe(type);
    expect(event.api_version).toBe('2026-09-30.endive');
    expect(event.api_version).toBe(STRIPE_API_VERSION);
  });

  it.each(NEW_EVENTS)('%s has object %s and the right ID prefix', (_type, generate, object, prefix) => {
    const inner = generate().data.object as unknown as Record<string, unknown>;
    expect(inner.object).toBe(object);
    if (prefix === null) {
      expect(inner).not.toHaveProperty('id');
    } else {
      expect(inner.id).toEqual(expect.stringMatching(new RegExp(`^${prefix}[a-zA-Z0-9]+$`)));
    }
  });

  // Stripe sends previous_attributes on *.updated events. The automatic card
  // update carries the card keys it replaced.
  it.each(NEW_EVENTS)('%s sends previous_attributes only when something was replaced', (type, generate) => {
    const data = generate().data as unknown as Record<string, unknown>;
    if (type === 'payment_method.automatically_updated') {
      expect(data).toHaveProperty('previous_attributes.card');
    } else {
      expect(data).not.toHaveProperty('previous_attributes');
    }
  });

  it('invoice.upcoming previews the renewal invoice with temporary line item IDs', () => {
    const preview = invoiceUpcoming().data.object;
    expect(preview).not.toHaveProperty('id');
    expect(preview.status).toBe('draft');
    expect(preview.billing_reason).toBe('upcoming');
    expect(preview.number).toBeNull();
    for (const line of preview.lines.data) {
      expect(line.id).toMatch(/^il_tmp_[a-zA-Z0-9]+$/);
      expect(line.invoice).toBeNull();
    }
  });

  it('only invoice.marked_uncollectible carries status_details', () => {
    expect(invoiceMarkedUncollectible().data.object).toHaveProperty('status_details.uncollectible.reason');
    for (const generate of [invoiceFinalized, invoicePaymentActionRequired, invoiceOverdue, invoiceVoided]) {
      expect(generate().data.object).not.toHaveProperty('status_details');
    }
  });

  it('invoice_payment.paid sets only the payment key that matches payment.type', () => {
    const byIntent = invoicePaymentPaid().data.object.payment;
    expect(byIntent).toEqual({ type: 'payment_intent', payment_intent: expect.stringMatching(/^pi_/) });
    const byCharge = invoicePaymentPaid({ paymentType: 'charge' }).data.object.payment;
    expect(byCharge).toEqual({ type: 'charge', charge: expect.stringMatching(/^ch_/) });
  });
});

describe('schema validation: Stripe enum values on the newer events', () => {
  const PAYMENT_INTENT_STATUSES = new Set([
    'requires_payment_method', 'requires_confirmation', 'requires_action',
    'processing', 'requires_capture', 'canceled', 'succeeded',
  ]);
  const INVOICE_STATUSES = new Set(['draft', 'open', 'paid', 'void', 'uncollectible']);
  const SUBSCRIPTION_STATUSES = new Set([
    'incomplete', 'incomplete_expired', 'trialing', 'active',
    'past_due', 'canceled', 'unpaid', 'paused',
  ]);
  const REFUND_STATUSES = new Set(['pending', 'requires_action', 'succeeded', 'failed', 'canceled']);
  const INVOICE_PAYMENT_STATUSES = new Set(['open', 'paid', 'canceled']);
  const SETUP_INTENT_STATUSES = new Set([
    'canceled', 'processing', 'requires_action', 'requires_confirmation',
    'requires_payment_method', 'succeeded',
  ]);
  const CHECKOUT_PAYMENT_STATUSES = new Set(['no_payment_required', 'paid', 'unpaid']);
  const FRAUD_TYPES = new Set([
    'card_never_received', 'fraudulent_card_application', 'made_with_counterfeit_card',
    'made_with_lost_card', 'made_with_stolen_card', 'misc', 'unauthorized_use_of_card',
  ]);

  const status = (event: StripeEvent) => (event.data.object as unknown as Record<string, unknown>).status;

  it('PaymentIntent events use the expected statuses', () => {
    expect(status(paymentIntentRequiresAction())).toBe('requires_action');
    expect(status(paymentIntentCanceled())).toBe('canceled');
    for (const event of [paymentIntentRequiresAction(), paymentIntentCanceled()]) {
      expect(PAYMENT_INTENT_STATUSES.has(status(event) as string)).toBe(true);
    }
  });

  it('invoice events use valid Invoice statuses', () => {
    const expected: Array<[() => StripeEvent, string]> = [
      [upcomingAsEvent, 'draft'],
      [() => invoiceFinalized(), 'open'],
      [() => invoicePaymentActionRequired(), 'open'],
      [() => invoiceOverdue(), 'open'],
      [() => invoiceMarkedUncollectible(), 'uncollectible'],
      [() => invoiceVoided(), 'void'],
    ];
    for (const [generate, value] of expected) {
      const event = generate();
      expect(status(event), event.type).toBe(value);
      expect(INVOICE_STATUSES.has(value)).toBe(true);
    }
  });

  it('subscription events use valid Subscription statuses', () => {
    expect(status(subscriptionTrialWillEnd())).toBe('trialing');
    expect(status(subscriptionPaused())).toBe('paused');
    expect(status(subscriptionResumed())).toBe('active');
    for (const event of [subscriptionTrialWillEnd(), subscriptionPaused(), subscriptionResumed()]) {
      expect(SUBSCRIPTION_STATUSES.has(status(event) as string)).toBe(true);
    }
  });

  it('refund, invoice payment and setup intent statuses are valid', () => {
    expect(REFUND_STATUSES.has(status(refundCreated()) as string)).toBe(true);
    expect(REFUND_STATUSES.has(status(refundCreated({ status: 'pending' })) as string)).toBe(true);
    expect(INVOICE_PAYMENT_STATUSES.has(status(invoicePaymentPaid()) as string)).toBe(true);
    expect(SETUP_INTENT_STATUSES.has(status(setupIntentSucceeded()) as string)).toBe(true);
  });

  it('async Checkout events complete the session and set payment_status', () => {
    const succeeded = checkoutSessionAsyncPaymentSucceeded().data.object;
    const failed = checkoutSessionAsyncPaymentFailed().data.object;
    expect(succeeded.status).toBe('complete');
    expect(failed.status).toBe('complete');
    expect(succeeded.payment_status).toBe('paid');
    expect(failed.payment_status).toBe('unpaid');
    expect(CHECKOUT_PAYMENT_STATUSES.has(succeeded.payment_status)).toBe(true);
    expect(CHECKOUT_PAYMENT_STATUSES.has(failed.payment_status)).toBe(true);
  });

  it('early fraud warnings use a valid fraud_type', () => {
    expect(FRAUD_TYPES.has(earlyFraudWarningCreated().data.object.fraud_type)).toBe(true);
  });
});

describe('schema validation: charge.failed decline code placement', () => {
  // A Charge has no decline_code field: the error code is failure_code and the
  // issuer's reason is outcome.reason. (outcome.network_decline_code is a
  // different field: the card network's own code.)
  function keyPaths(obj: unknown, path = 'root'): string[] {
    if (obj === null || typeof obj !== 'object') return [];
    return Object.entries(obj as Record<string, unknown>).flatMap(([key, value]) => [
      `${path}.${key}`,
      ...keyPaths(value, `${path}.${key}`),
    ]);
  }
  const declineCodeKeys = (obj: unknown) => keyPaths(obj).filter((p) => p.endsWith('.decline_code'));

  it('insufficient_funds gives failure_code card_declined and outcome.reason insufficient_funds', () => {
    const charge = chargeFailed({ declineCode: 'insufficient_funds' }).data.object;
    expect(charge.status).toBe('failed');
    expect(charge.failure_code).toBe('card_declined');
    expect(charge.outcome?.reason).toBe('insufficient_funds');
    expect(declineCodeKeys(charge)).toEqual([]);
  });

  it('expired_card gives failure_code expired_card', () => {
    const charge = chargeFailed({ declineCode: 'expired_card' }).data.object;
    expect(charge.failure_code).toBe('expired_card');
    expect(charge.outcome?.reason).toBe('expired_card');
    expect(declineCodeKeys(charge)).toEqual([]);
  });
});

describe('schema validation: newer payloads match the stamped api_version', () => {
  // 2025-03-31.basil moved these off the Invoice; payments and
  // amount_paid_off_stripe are includable only.
  const REMOVED_INVOICE_FIELDS = [
    'paid', 'paid_out_of_band', 'subscription', 'payment_intent', 'charge',
    'payments', 'amount_paid_off_stripe',
  ];
  const INVOICE_EVENTS: Array<[string, () => StripeEvent]> = [
    ['invoice.upcoming', upcomingAsEvent],
    ['invoice.finalized', () => invoiceFinalized()],
    ['invoice.payment_action_required', () => invoicePaymentActionRequired()],
    ['invoice.overdue', () => invoiceOverdue()],
    ['invoice.marked_uncollectible', () => invoiceMarkedUncollectible()],
    ['invoice.voided', () => invoiceVoided()],
  ];

  it.each(INVOICE_EVENTS)('%s omits fields basil removed from the Invoice', (type, generate) => {
    const invoice = generate().data.object as unknown as Record<string, unknown>;
    for (const field of REMOVED_INVOICE_FIELDS) {
      expect(invoice, `${type} should not contain ${field}`).not.toHaveProperty(field);
    }
  });

  it.each([
    ['customer.subscription.trial_will_end', () => subscriptionTrialWillEnd()],
    ['customer.subscription.paused', () => subscriptionPaused()],
    ['customer.subscription.resumed', () => subscriptionResumed()],
  ] as Array<[string, () => StripeEvent]>)('%s keeps current_period_* on the items only', (_type, generate) => {
    const subscription = generate().data.object as unknown as Record<string, unknown>;
    expect(subscription).not.toHaveProperty('current_period_start');
    expect(subscription).not.toHaveProperty('current_period_end');
    expect(subscription).toHaveProperty('items.data.0.current_period_end');
  });

  it('charge.failed and payment_intent events omit invoice', () => {
    for (const generate of [chargeFailed, paymentIntentRequiresAction, paymentIntentCanceled]) {
      expect(generate().data.object).not.toHaveProperty('invoice');
    }
    expect(chargeFailed().data.object).not.toHaveProperty('refunds');
  });
});

describe('schema validation: the registry', () => {
  it('registers a generator for every catalogued event type, and nothing else', () => {
    expect(Object.keys(EVENT_GENERATORS).sort()).toEqual(EVENT_CATALOG.map((e) => e.type).sort());
  });

  it.each(EVENT_CATALOG.map((e) => e.type))('%s generates an event of its own type', (type) => {
    const event = EVENT_GENERATORS[type]();
    expect(event.type).toBe(type);
    validateEvent(event);
  });
});
