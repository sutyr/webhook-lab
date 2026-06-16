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
  subscriptionHappyPath,
  subscriptionFailure,
  checkoutFlow,
  disputeLifecycle,
  refundFlow,
  EVENT_CATALOG,
  SCENARIO_CATALOG,
  STRIPE_API_VERSION,
  DECLINE_CODE_MAP,
} from '@webhook-lab/events';
import type { EventResult } from '@webhook-lab/events';
import { sign, verify } from '@webhook-lab/signatures';

describe('cross-package: event generation + signing round-trip', () => {
  it('generates an event, signs it, and verifies the signature', () => {
    const event = paymentIntentSucceeded({ amount: 5000 });
    const secret = 'whsec_test_secret_for_integration';
    const header = sign(event, secret);
    const valid = verify(event, header, secret);
    expect(valid).toBe(true);
  });

  it('rejects a tampered event after signing', () => {
    const event = paymentIntentPaymentFailed({ declineCode: 'insufficient_funds' });
    const secret = 'whsec_tamper_test';
    const header = sign(event, secret);

    // Tamper with the event
    const tampered = { ...event, type: 'payment_intent.succeeded' };
    const valid = verify(tampered, header, secret);
    expect(valid).toBe(false);
  });

  it('signs and verifies each event in a full scenario', () => {
    const scenario = subscriptionHappyPath({ seed: 'integration-test' });
    const secret = 'whsec_scenario_test';

    for (const step of scenario.steps) {
      const header = sign(step.event, secret);
      const valid = verify(step.event, header, secret);
      expect(valid).toBe(true);
    }
  });

  const allGenerators: [string, () => unknown][] = [
    ['payment_intent.succeeded', paymentIntentSucceeded],
    ['payment_intent.payment_failed', paymentIntentPaymentFailed],
    ['charge.succeeded', chargeSucceeded],
    ['charge.refunded', chargeRefunded],
    ['invoice.created', invoiceCreated],
    ['invoice.paid', invoicePaid],
    ['invoice.payment_failed', invoicePaymentFailed],
    ['invoice.payment_succeeded', invoicePaymentSucceeded],
    ['customer.subscription.created', subscriptionCreated],
    ['customer.subscription.updated', subscriptionUpdated],
    ['customer.subscription.deleted', subscriptionDeleted],
    ['checkout.session.completed', checkoutSessionCompleted],
    ['checkout.session.expired', checkoutSessionExpired],
    ['customer.created', customerCreated],
    ['customer.updated', customerUpdated],
    ['charge.dispute.created', disputeCreated],
    ['charge.dispute.updated', disputeUpdated],
    ['charge.dispute.closed', disputeClosed],
  ];

  it.each(allGenerators)('sign/verify round-trip for %s', (_eventType, generator) => {
    const event = generator();
    const secret = 'whsec_roundtrip_test';
    const header = sign(event, secret);
    expect(verify(event, header, secret)).toBe(true);
  });

  it('signs and verifies events from all 5 scenarios', () => {
    const secret = 'whsec_all_scenarios';
    const scenarios = [
      subscriptionHappyPath({ seed: 'a' }),
      subscriptionFailure({ seed: 'b' }),
      checkoutFlow({ seed: 'c' }),
      disputeLifecycle({ seed: 'd' }),
      refundFlow({ seed: 'e' }),
    ];

    for (const scenario of scenarios) {
      for (const step of scenario.steps) {
        const header = sign(step.event, secret);
        expect(verify(step.event, header, secret)).toBe(true);
      }
    }
  });
});

describe('cross-package: public API surface', () => {
  it('exports all 18 generator functions', () => {
    const generators = [
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
    ];

    expect(generators).toHaveLength(18);
    for (const gen of generators) {
      expect(typeof gen).toBe('function');
    }
  });

  it('exports all 5 scenario functions', () => {
    const scenarios = [
      subscriptionHappyPath,
      subscriptionFailure,
      checkoutFlow,
      disputeLifecycle,
      refundFlow,
    ];

    expect(scenarios).toHaveLength(5);
    for (const s of scenarios) {
      expect(typeof s).toBe('function');
    }
  });

  it('exports EVENT_CATALOG with 18 entries', () => {
    expect(EVENT_CATALOG).toHaveLength(18);
    for (const entry of EVENT_CATALOG) {
      expect(entry).toHaveProperty('type');
      expect(entry).toHaveProperty('category');
      expect(entry).toHaveProperty('name');
      expect(entry).toHaveProperty('description');
    }
  });

  it('exports SCENARIO_CATALOG with 5 entries', () => {
    expect(SCENARIO_CATALOG).toHaveLength(5);
  });

  it('exports STRIPE_API_VERSION as a non-empty string', () => {
    expect(typeof STRIPE_API_VERSION).toBe('string');
    expect(STRIPE_API_VERSION.length).toBeGreaterThan(0);
  });

  it('exports sign and verify functions from signatures', () => {
    expect(typeof sign).toBe('function');
    expect(typeof verify).toBe('function');
  });
});

describe('cross-package: DECLINE_CODE_MAP correctness', () => {
  it('has exactly 10 entries', () => {
    expect(Object.keys(DECLINE_CODE_MAP)).toHaveLength(10);
  });

  it('maps card_declined codes to have both code and decline_code', () => {
    const cardDeclinedEntries = ['insufficient_funds', 'generic_decline', 'lost_card', 'stolen_card', 'fraudulent', 'card_velocity_exceeded'];
    for (const key of cardDeclinedEntries) {
      const entry = DECLINE_CODE_MAP[key];
      expect(entry).toBeDefined();
      expect(entry!.code).toBe('card_declined');
      expect(entry!.decline_code).toBe(key);
      expect(entry!.type).toBe('card_error');
    }
  });

  it('maps non-card_declined codes to have code but no decline_code', () => {
    const nonCardDeclined = ['expired_card', 'incorrect_cvc', 'processing_error', 'authentication_required'];
    for (const key of nonCardDeclined) {
      const entry = DECLINE_CODE_MAP[key];
      expect(entry).toBeDefined();
      expect(entry!.code).toBe(key);
      expect(entry!.decline_code).toBeUndefined();
      expect(entry!.type).toBe('card_error');
    }
  });

  it('all entries have a non-empty message', () => {
    for (const entry of Object.values(DECLINE_CODE_MAP)) {
      expect(typeof entry.message).toBe('string');
      expect(entry.message.length).toBeGreaterThan(0);
    }
  });
});

describe('cross-package: EventResult type structure', () => {
  it('is structurally sound when constructed manually', () => {
    const result: EventResult = {
      event: {
        id: 'evt_test',
        type: 'payment_intent.succeeded',
        payload: {},
        timestamp: Math.floor(Date.now() / 1000),
      },
      delivery: {
        targetUrl: 'https://example.com/webhook',
        statusCode: 200,
        responseBody: '{"ok":true}',
        responseTimeMs: 42,
        signatureValid: true,
      },
      context: null,
    };

    expect(result.event.id).toBe('evt_test');
    expect(result.delivery.statusCode).toBe(200);
    expect(result.context).toBeNull();
  });
});
