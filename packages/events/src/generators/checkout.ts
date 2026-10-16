// Copyright 2026 Sutyr Inc. SPDX-License-Identifier: Apache-2.0
import type {
  StripeCheckoutSession,
  StripeEvent,
  CheckoutSessionCompletedOptions,
  CheckoutSessionExpiredOptions,
} from '../types/index.js';
import type {
  StripeAsyncPaymentCheckoutSession,
  CheckoutDelayedPaymentMethodType,
  CheckoutSessionAsyncPaymentOptions,
  CheckoutSessionAsyncPaymentSucceededOptions,
  CheckoutSessionAsyncPaymentFailedOptions,
} from '../types/payment-methods.js';
import { wrapInEvent } from './envelope.js';
import {
  checkoutSessionId,
  customerId,
  generateId,
  invoiceId,
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

// ─── Delayed payment methods ────────────────────────────────────────────────
// ACH, SEPA, Bacs and Boleto payments settle days after the customer completes
// Checkout. checkout.session.completed arrives first with payment_status
// 'unpaid'; one of the async events follows once the payment settles. The
// session stays 'complete' either way: only payment_status moves.
//
// Since 2026-09-30.endive, Checkout always computes payment methods
// dynamically from a payment method configuration; the session here narrows
// that set to one delayed method with allowed_payment_method_types. The
// session is a hosted page whose customer Checkout created at completion.

const DELAYED_METHODS: Record<CheckoutDelayedPaymentMethodType, { currency: string; country: string }> = {
  us_bank_account: { currency: 'usd', country: 'US' },
  sepa_debit: { currency: 'eur', country: 'DE' },
  bacs_debit: { currency: 'gbp', country: 'GB' },
  boleto: { currency: 'brl', country: 'BR' },
};

const SETTLEMENT_DELAY_SECONDS = 3 * 86400;

function buildAsyncPaymentSession(
  paymentStatus: 'paid' | 'unpaid',
  options?: CheckoutSessionAsyncPaymentOptions,
): StripeAsyncPaymentCheckoutSession {
  const mode = options?.mode ?? 'payment';
  const ts = options?.timestamp ?? now();
  const methodType = options?.paymentMethodType ?? 'us_bank_account';
  // Like an unknown decline code, an unknown type is refused by name.
  if (!Object.hasOwn(DELAYED_METHODS, methodType)) {
    throw new Error(`Unknown delayed payment method type: ${methodType}`);
  }
  const method = DELAYED_METHODS[methodType];
  const amount = options?.amount ?? 2999;
  const created = ts - SETTLEMENT_DELAY_SECONDS;

  return {
    id: options?.checkoutSessionId ?? checkoutSessionId(),
    object: 'checkout.session',
    // Payment mode sessions default to Adaptive Pricing; subscription mode
    // sessions report none.
    adaptive_pricing: mode === 'payment' ? { enabled: true } : null,
    after_expiration: null,
    allow_promotion_codes: null,
    allowed_payment_method_types: [methodType],
    amount_subtotal: amount,
    amount_total: amount,
    automatic_tax: { enabled: false, liability: null, provider: null, status: null },
    billing_address_collection: null,
    branding_settings: {
      background_color: '#ffffff',
      border_style: 'rounded',
      button_color: '#0074d4',
      display_name: 'Example Store',
      font_family: 'default',
      icon: null,
      logo: null,
    },
    cancel_url: 'https://example.com/cancel',
    client_reference_id: options?.clientReferenceId ?? null,
    client_secret: null,
    collected_information: { business_name: null, individual_name: null, shipping_details: null },
    consent: null,
    consent_collection: null,
    created,
    currency: options?.currency ?? method.currency,
    currency_conversion: null,
    custom_fields: [],
    custom_text: {
      after_submit: null,
      shipping_address: null,
      submit: null,
      terms_of_service_acceptance: null,
    },
    customer: options?.customerId ?? customerId(),
    customer_account: null,
    customer_creation: 'always',
    customer_details: {
      address: {
        city: null,
        country: method.country,
        line1: null,
        line2: null,
        postal_code: null,
        state: null,
      },
      business_name: null,
      email: 'jane@example.com',
      individual_name: null,
      name: 'Jane Doe',
      phone: null,
      tax_exempt: 'none',
      tax_ids: [],
    },
    customer_email: null,
    discounts: [],
    expires_at: created + 24 * 3600,
    integration_identifier: null,
    // Subscription mode links the subscription's first invoice; payment mode
    // creates no invoice unless invoice_creation is enabled.
    invoice: mode === 'subscription' ? (options?.invoiceId ?? invoiceId()) : null,
    // Post-purchase invoices are a payment mode setting; subscription mode
    // reports null.
    invoice_creation:
      mode === 'payment'
        ? {
            enabled: false,
            invoice_data: {
              account_tax_ids: null,
              custom_fields: null,
              description: null,
              footer: null,
              issuer: null,
              metadata: {},
              rendering_options: null,
            },
          }
        : null,
    livemode: false,
    locale: null,
    managed_payments: { enabled: false },
    metadata: options?.metadata ?? {},
    mode,
    origin_context: null,
    payment_intent: mode === 'payment' ? (options?.paymentIntentId ?? paymentIntentId()) : null,
    payment_link: null,
    payment_method_collection: 'always',
    payment_method_configuration_details: { id: generateId('pmc_'), parent: null },
    payment_method_options: {},
    payment_method_types: [methodType],
    payment_status: paymentStatus,
    permissions: null,
    phone_number_collection: { enabled: false },
    recovered_from: null,
    saved_payment_method_options: {
      allow_redisplay_filters: ['always'],
      payment_method_remove: 'disabled',
      payment_method_save: null,
    },
    setup_intent: null,
    shipping_address_collection: null,
    shipping_cost: null,
    shipping_options: [],
    status: 'complete',
    submit_type: null,
    subscription: mode === 'subscription' ? (options?.subscriptionId ?? subscriptionId()) : null,
    success_url: 'https://example.com/success',
    total_details: { amount_discount: 0, amount_shipping: 0, amount_tax: 0 },
    ui_mode: 'hosted_page',
    url: null,
    wallet_options: null,
  };
}

// ─── checkout.session.async_payment_succeeded ───────────────────────────────

export function checkoutSessionAsyncPaymentSucceeded(
  options?: CheckoutSessionAsyncPaymentSucceededOptions,
): StripeEvent<StripeAsyncPaymentCheckoutSession> {
  const ts = options?.timestamp ?? now();
  const session = buildAsyncPaymentSession('paid', { ...options, timestamp: ts });

  return wrapInEvent('checkout.session.async_payment_succeeded', session, { timestamp: ts });
}

// ─── checkout.session.async_payment_failed ──────────────────────────────────

export function checkoutSessionAsyncPaymentFailed(
  options?: CheckoutSessionAsyncPaymentFailedOptions,
): StripeEvent<StripeAsyncPaymentCheckoutSession> {
  const ts = options?.timestamp ?? now();
  const session = buildAsyncPaymentSession('unpaid', { ...options, timestamp: ts });

  return wrapInEvent('checkout.session.async_payment_failed', session, { timestamp: ts });
}
