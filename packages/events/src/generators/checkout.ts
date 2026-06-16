// Copyright 2026 Sutyr Inc. SPDX-License-Identifier: Apache-2.0
import type {
  StripeCheckoutSession,
  StripeEvent,
  CheckoutSessionCompletedOptions,
  CheckoutSessionExpiredOptions,
} from '../types/index.js';
import { wrapInEvent } from './envelope.js';
import {
  checkoutSessionId,
  customerId,
  paymentIntentId,
  subscriptionId,
} from '../utils/ids.js';
import { now, futureHours } from '../utils/timestamps.js';

// ─── checkout.session.completed ─────────────────────────────────────────────

export function checkoutSessionCompleted(
  options?: CheckoutSessionCompletedOptions,
): StripeEvent<StripeCheckoutSession> {
  const mode = options?.mode ?? 'payment';
  const ts = options?.timestamp ?? now();
  const cusId = options?.customerId ?? customerId();
  const amount = options?.amount ?? 2999;
  const currency = options?.currency ?? 'usd';

  const session: StripeCheckoutSession = {
    id: checkoutSessionId(),
    object: 'checkout.session',
    mode,
    status: 'complete',
    payment_status: 'paid',
    payment_intent: mode === 'payment' ? (options?.paymentIntentId ?? paymentIntentId()) : null,
    subscription: mode === 'subscription' ? (options?.subscriptionId ?? subscriptionId()) : null,
    customer: cusId,
    customer_email: null,
    amount_total: amount,
    amount_subtotal: amount,
    currency,
    success_url: 'https://example.com/success',
    cancel_url: 'https://example.com/cancel',
    url: null,
    expires_at: ts + 24 * 3600,
    metadata: options?.metadata ?? {},
    created: ts,
    livemode: false,
  };

  return wrapInEvent('checkout.session.completed', session, { timestamp: ts });
}

// ─── checkout.session.expired ───────────────────────────────────────────────

export function checkoutSessionExpired(
  options?: CheckoutSessionExpiredOptions,
): StripeEvent<StripeCheckoutSession> {
  const mode = options?.mode ?? 'payment';
  const ts = options?.timestamp ?? now();

  const session: StripeCheckoutSession = {
    id: checkoutSessionId(),
    object: 'checkout.session',
    mode,
    status: 'expired',
    payment_status: 'unpaid',
    payment_intent: null,
    subscription: null,
    customer: null,
    customer_email: null,
    amount_total: null,
    amount_subtotal: null,
    currency: null,
    success_url: 'https://example.com/success',
    cancel_url: 'https://example.com/cancel',
    url: null,
    expires_at: ts,
    metadata: options?.metadata ?? {},
    created: ts - 24 * 3600,
    livemode: false,
  };

  return wrapInEvent('checkout.session.expired', session, { timestamp: ts });
}
