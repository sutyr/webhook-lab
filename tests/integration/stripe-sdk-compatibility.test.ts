// Copyright 2026 Sutyr Inc. SPDX-License-Identifier: Apache-2.0
//
// End-to-end signature compatibility test: signatures produced by Webhook Lab's
// `sign()` must verify successfully when consumed by Stripe's official SDK via
// `stripe.webhooks.constructEvent`. This is the only test that catches the
// "strip whsec_ prefix" bug — internal HMAC round-trips cannot detect it
// because they re-derive the wrong key on both ends.

import { describe, it, expect } from 'vitest';
import Stripe from 'stripe';
import { sign } from '@webhook-lab/signatures';
import {
  paymentIntentSucceeded,
  paymentIntentPaymentFailed,
  invoicePaymentFailed,
  disputeCreated,
  subscriptionCreated,
  checkoutSessionCompleted,
} from '@webhook-lab/events';

const stripe = new Stripe('sk_test_dummy_not_used_for_verification', {
  apiVersion: '2025-10-29.clover',
});

function fireAndVerify(payload: object, secret: string): Stripe.Event {
  const timestamp = Math.floor(Date.now() / 1000);
  const header = sign(payload, secret, timestamp);
  const rawBody = JSON.stringify(payload);
  return stripe.webhooks.constructEvent(rawBody, header, secret);
}

describe('Stripe SDK compatibility — signatures verify against the official Stripe SDK', () => {
  const STRIPE_DASHBOARD_SECRET = 'whsec_dashboard_format_secret_value_here';

  it('verifies payment_intent.succeeded with a real `whsec_` dashboard-format secret', () => {
    const payload = paymentIntentSucceeded();
    const event = fireAndVerify(payload, STRIPE_DASHBOARD_SECRET);
    expect(event.type).toBe('payment_intent.succeeded');
    expect(event.id).toMatch(/^evt_/);
  });

  it('verifies payment_intent.payment_failed with decline code metadata', () => {
    const payload = paymentIntentPaymentFailed({
      declineCode: 'insufficient_funds',
    });
    const event = fireAndVerify(payload, STRIPE_DASHBOARD_SECRET);
    expect(event.type).toBe('payment_intent.payment_failed');
  });

  it('verifies invoice.payment_failed', () => {
    const payload = invoicePaymentFailed();
    const event = fireAndVerify(payload, STRIPE_DASHBOARD_SECRET);
    expect(event.type).toBe('invoice.payment_failed');
  });

  it('verifies charge.dispute.created (dp_ prefix)', () => {
    const payload = disputeCreated();
    const event = fireAndVerify(payload, STRIPE_DASHBOARD_SECRET);
    expect(event.type).toBe('charge.dispute.created');
  });

  it('verifies customer.subscription.created', () => {
    const payload = subscriptionCreated();
    const event = fireAndVerify(payload, STRIPE_DASHBOARD_SECRET);
    expect(event.type).toBe('customer.subscription.created');
  });

  it('verifies checkout.session.completed', () => {
    const payload = checkoutSessionCompleted();
    const event = fireAndVerify(payload, STRIPE_DASHBOARD_SECRET);
    expect(event.type).toBe('checkout.session.completed');
  });

  it('verifies a signature produced with a non-prefixed secret', () => {
    // Some self-hosted users store the secret without the `whsec_` prefix.
    // As long as the same form is used on both sides, it must verify.
    const bareSecret = 'bare_secret_no_prefix';
    const payload = paymentIntentSucceeded();
    const event = fireAndVerify(payload, bareSecret);
    expect(event.type).toBe('payment_intent.succeeded');
  });

  it('Stripe SDK rejects a signature signed with a different secret', () => {
    const payload = paymentIntentSucceeded();
    const timestamp = Math.floor(Date.now() / 1000);
    const header = sign(payload, 'whsec_signing_secret', timestamp);
    const rawBody = JSON.stringify(payload);

    expect(() =>
      stripe.webhooks.constructEvent(rawBody, header, 'whsec_DIFFERENT_secret'),
    ).toThrow(/signature/i);
  });

  it('Stripe SDK rejects a tampered payload', () => {
    const payload = paymentIntentSucceeded();
    const timestamp = Math.floor(Date.now() / 1000);
    const header = sign(payload, STRIPE_DASHBOARD_SECRET, timestamp);

    // Tamper with the body after signing
    const tamperedBody = JSON.stringify({ ...payload, type: 'malicious' });

    expect(() =>
      stripe.webhooks.constructEvent(tamperedBody, header, STRIPE_DASHBOARD_SECRET),
    ).toThrow(/signature/i);
  });

  it('Stripe SDK rejects a signature outside tolerance', () => {
    const payload = paymentIntentSucceeded();
    const oldTimestamp = Math.floor(Date.now() / 1000) - 600; // 10 minutes ago
    const header = sign(payload, STRIPE_DASHBOARD_SECRET, oldTimestamp);
    const rawBody = JSON.stringify(payload);

    // Stripe's default tolerance is 300 seconds
    expect(() =>
      stripe.webhooks.constructEvent(rawBody, header, STRIPE_DASHBOARD_SECRET),
    ).toThrow(/timestamp|tolerance/i);
  });
});
