// Copyright 2026 Sutyr Inc. SPDX-License-Identifier: Apache-2.0
import { describe, it, expect } from 'vitest';
import {
  checkoutSessionCompleted,
  checkoutSessionExpired,
  checkoutSessionAsyncPaymentSucceeded,
  checkoutSessionAsyncPaymentFailed,
} from '../../../src/generators/checkout.js';
import { STRIPE_API_VERSION } from '../../../src/generators/envelope.js';

describe('checkoutSessionCompleted', () => {
  it('returns a checkout.session.completed event', () => {
    const event = checkoutSessionCompleted();
    expect(event.type).toBe('checkout.session.completed');
  });

  it('wraps the session in data.object', () => {
    const event = checkoutSessionCompleted();
    expect(event.data.object.object).toBe('checkout.session');
  });

  it('has status complete and payment_status paid', () => {
    const event = checkoutSessionCompleted();
    expect(event.data.object.status).toBe('complete');
    expect(event.data.object.payment_status).toBe('paid');
  });

  it('defaults mode to payment', () => {
    const event = checkoutSessionCompleted();
    expect(event.data.object.mode).toBe('payment');
  });

  it('generates a session id starting with cs_', () => {
    const event = checkoutSessionCompleted();
    expect(event.data.object.id.startsWith('cs_')).toBe(true);
  });

  it('sets payment_intent for payment mode', () => {
    const event = checkoutSessionCompleted({ mode: 'payment' });
    expect(event.data.object.payment_intent).not.toBeNull();
    expect(event.data.object.payment_intent!.startsWith('pi_')).toBe(true);
    expect(event.data.object.subscription).toBeNull();
  });

  it('sets subscription for subscription mode', () => {
    const event = checkoutSessionCompleted({ mode: 'subscription' });
    expect(event.data.object.subscription).not.toBeNull();
    expect(event.data.object.subscription!.startsWith('sub_')).toBe(true);
    expect(event.data.object.payment_intent).toBeNull();
  });

  it('sets customer id starting with cus_', () => {
    const event = checkoutSessionCompleted();
    expect(event.data.object.customer).not.toBeNull();
    expect(event.data.object.customer!.startsWith('cus_')).toBe(true);
  });

  it('uses custom amount and currency', () => {
    const event = checkoutSessionCompleted({ amount: 5000, currency: 'eur' });
    expect(event.data.object.amount_total).toBe(5000);
    expect(event.data.object.amount_subtotal).toBe(5000);
    expect(event.data.object.currency).toBe('eur');
  });

  it('accepts a custom customerId', () => {
    const event = checkoutSessionCompleted({ customerId: 'cus_custom123' });
    expect(event.data.object.customer).toBe('cus_custom123');
  });

  it('uses custom timestamp', () => {
    const ts = 1700000000;
    const event = checkoutSessionCompleted({ timestamp: ts });
    expect(event.created).toBe(ts);
    expect(event.data.object.created).toBe(ts);
  });

  it('sets success_url and cancel_url', () => {
    const event = checkoutSessionCompleted();
    expect(event.data.object.success_url).toBe('https://example.com/success');
    expect(event.data.object.cancel_url).toBe('https://example.com/cancel');
  });

  it('sets livemode to false', () => {
    const event = checkoutSessionCompleted();
    expect(event.data.object.livemode).toBe(false);
    expect(event.livemode).toBe(false);
  });

  it('defaults metadata to empty object', () => {
    const event = checkoutSessionCompleted();
    expect(event.data.object.metadata).toEqual({});
  });

  it('accepts custom metadata', () => {
    const event = checkoutSessionCompleted({ metadata: { order: '123' } });
    expect(event.data.object.metadata).toEqual({ order: '123' });
  });
});

describe('checkoutSessionExpired', () => {
  it('returns a checkout.session.expired event', () => {
    const event = checkoutSessionExpired();
    expect(event.type).toBe('checkout.session.expired');
  });

  it('has status expired and payment_status unpaid', () => {
    const event = checkoutSessionExpired();
    expect(event.data.object.status).toBe('expired');
    expect(event.data.object.payment_status).toBe('unpaid');
  });

  it('defaults mode to payment', () => {
    const event = checkoutSessionExpired();
    expect(event.data.object.mode).toBe('payment');
  });

  it('accepts subscription mode', () => {
    const event = checkoutSessionExpired({ mode: 'subscription' });
    expect(event.data.object.mode).toBe('subscription');
  });

  it('generates a session id starting with cs_', () => {
    const event = checkoutSessionExpired();
    expect(event.data.object.id.startsWith('cs_')).toBe(true);
  });

  it('sets payment_intent and subscription to null', () => {
    const event = checkoutSessionExpired();
    expect(event.data.object.payment_intent).toBeNull();
    expect(event.data.object.subscription).toBeNull();
  });

  it('sets customer to null', () => {
    const event = checkoutSessionExpired();
    expect(event.data.object.customer).toBeNull();
  });

  it('sets amount fields to null', () => {
    const event = checkoutSessionExpired();
    expect(event.data.object.amount_total).toBeNull();
    expect(event.data.object.amount_subtotal).toBeNull();
    expect(event.data.object.currency).toBeNull();
  });

  it('sets livemode to false', () => {
    const event = checkoutSessionExpired();
    expect(event.data.object.livemode).toBe(false);
  });

  it('generates an event id starting with evt_', () => {
    const event = checkoutSessionExpired();
    expect(event.id.startsWith('evt_')).toBe(true);
  });
});

describe('checkoutSessionCompleted mode variants', () => {
  it('mode: subscription has subscription field non-null and payment_intent null', () => {
    const event = checkoutSessionCompleted({ mode: 'subscription' });
    expect(event.data.object.subscription).not.toBeNull();
    expect(event.data.object.subscription).toMatch(/^sub_/);
    expect(event.data.object.payment_intent).toBeNull();
  });

  it('mode: setup has both payment_intent and subscription null', () => {
    const event = checkoutSessionCompleted({ mode: 'setup' });
    expect(event.data.object.payment_intent).toBeNull();
    expect(event.data.object.subscription).toBeNull();
  });
});

// ─── Delayed payment methods ────────────────────────────────────────────────

// Default response fields of a hosted_page Checkout Session at 2026-09-30.endive.
const DEFAULT_SESSION_FIELDS = [
  'id',
  'object',
  'adaptive_pricing',
  'after_expiration',
  'allow_promotion_codes',
  'allowed_payment_method_types',
  'amount_subtotal',
  'amount_total',
  'automatic_tax',
  'billing_address_collection',
  'branding_settings',
  'cancel_url',
  'client_reference_id',
  'client_secret',
  'collected_information',
  'consent',
  'consent_collection',
  'created',
  'currency',
  'currency_conversion',
  'custom_fields',
  'custom_text',
  'customer',
  'customer_account',
  'customer_creation',
  'customer_details',
  'customer_email',
  'discounts',
  'expires_at',
  'integration_identifier',
  'invoice',
  'invoice_creation',
  'livemode',
  'locale',
  'managed_payments',
  'metadata',
  'mode',
  'origin_context',
  'payment_intent',
  'payment_link',
  'payment_method_collection',
  'payment_method_configuration_details',
  'payment_method_options',
  'payment_method_types',
  'payment_status',
  'permissions',
  'phone_number_collection',
  'recovered_from',
  'saved_payment_method_options',
  'setup_intent',
  'shipping_address_collection',
  'shipping_cost',
  'shipping_options',
  'status',
  'submit_type',
  'subscription',
  'success_url',
  'total_details',
  'ui_mode',
  'url',
  'wallet_options',
];

const asyncGenerators = [
  {
    name: 'checkoutSessionAsyncPaymentSucceeded',
    fn: checkoutSessionAsyncPaymentSucceeded,
    type: 'checkout.session.async_payment_succeeded',
    paymentStatus: 'paid',
  },
  {
    name: 'checkoutSessionAsyncPaymentFailed',
    fn: checkoutSessionAsyncPaymentFailed,
    type: 'checkout.session.async_payment_failed',
    paymentStatus: 'unpaid',
  },
] as const;

for (const { name, fn, type, paymentStatus } of asyncGenerators) {
  describe(name, () => {
    it(`returns a ${type} event at the current API version`, () => {
      const event = fn();
      expect(event.type).toBe(type);
      expect(event.object).toBe('event');
      expect(event.api_version).toBe(STRIPE_API_VERSION);
      expect(event.id).toMatch(/^evt_/);
    });

    it('wraps a complete checkout.session with a cs_ id', () => {
      const session = fn().data.object;
      expect(session.object).toBe('checkout.session');
      expect(session.id).toMatch(/^cs_/);
      expect(session.status).toBe('complete');
    });

    it(`sets payment_status to ${paymentStatus}`, () => {
      expect(fn().data.object.payment_status).toBe(paymentStatus);
    });

    it('defaults to an ACH Direct Debit payment in usd', () => {
      const session = fn().data.object;
      expect(session.payment_method_types).toEqual(['us_bank_account']);
      expect(session.currency).toBe('usd');
      expect(session.customer_details?.address?.country).toBe('US');
    });

    it.each([
      ['us_bank_account', 'usd', 'US'],
      ['sepa_debit', 'eur', 'DE'],
      ['bacs_debit', 'gbp', 'GB'],
      ['boleto', 'brl', 'BR'],
    ] as const)('uses %s with its settlement currency %s', (method, currency, country) => {
      const session = fn({ paymentMethodType: method }).data.object;
      expect(session.payment_method_types).toEqual([method]);
      expect(session.currency).toBe(currency);
      expect(session.customer_details?.address?.country).toBe(country);
    });

    it('never lists card, which settles immediately', () => {
      for (const method of ['us_bank_account', 'sepa_debit', 'bacs_debit', 'boleto'] as const) {
        expect(fn({ paymentMethodType: method }).data.object.payment_method_types).not.toContain('card');
      }
    });

    it('lets an explicit currency override the method default', () => {
      expect(fn({ paymentMethodType: 'sepa_debit', currency: 'usd' }).data.object.currency).toBe('usd');
    });

    it('payment mode links a pi_ intent and no subscription or invoice', () => {
      const session = fn().data.object;
      expect(session.mode).toBe('payment');
      expect(session.payment_intent).toMatch(/^pi_/);
      expect(session.subscription).toBeNull();
      expect(session.invoice).toBeNull();
      expect(session.setup_intent).toBeNull();
    });

    it('subscription mode links sub_ and in_ and no payment intent', () => {
      const session = fn({ mode: 'subscription' }).data.object;
      expect(session.mode).toBe('subscription');
      expect(session.subscription).toMatch(/^sub_/);
      expect(session.invoice).toMatch(/^in_/);
      expect(session.payment_intent).toBeNull();
      expect(session.setup_intent).toBeNull();
    });

    it('propagates shared IDs for scenarios', () => {
      const payment = fn({
        checkoutSessionId: 'cs_shared',
        customerId: 'cus_shared',
        paymentIntentId: 'pi_shared',
      }).data.object;
      expect(payment.id).toBe('cs_shared');
      expect(payment.customer).toBe('cus_shared');
      expect(payment.payment_intent).toBe('pi_shared');

      const subscription = fn({
        mode: 'subscription',
        subscriptionId: 'sub_shared',
        invoiceId: 'in_shared',
      }).data.object;
      expect(subscription.subscription).toBe('sub_shared');
      expect(subscription.invoice).toBe('in_shared');
    });

    it('generates a cus_ customer by default', () => {
      expect(fn().data.object.customer).toMatch(/^cus_/);
    });

    it('propagates amount, client_reference_id and metadata', () => {
      const session = fn({
        amount: 125000,
        clientReferenceId: 'order_42',
        metadata: { order: '42' },
      }).data.object;
      expect(session.amount_total).toBe(125000);
      expect(session.amount_subtotal).toBe(125000);
      expect(session.client_reference_id).toBe('order_42');
      expect(session.metadata).toEqual({ order: '42' });
    });

    it('defaults client_reference_id to null and metadata to empty', () => {
      const session = fn().data.object;
      expect(session.client_reference_id).toBeNull();
      expect(session.metadata).toEqual({});
    });

    it('stamps the event at the timestamp and dates the session days earlier', () => {
      const ts = 1_790_000_000;
      const event = fn({ timestamp: ts });
      expect(event.created).toBe(ts);
      expect(event.data.object.created).toBeLessThan(ts);
      expect(event.data.object.expires_at).toBe(event.data.object.created + 24 * 3600);
    });

    it('carries customer_details with the null fields Stripe returns', () => {
      const details = fn().data.object.customer_details;
      expect(details).toEqual({
        address: {
          city: null,
          country: 'US',
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
      });
    });

    it('has no hosted url once complete and is in test mode', () => {
      const event = fn();
      expect(event.data.object.url).toBeNull();
      expect(event.data.object.livemode).toBe(false);
      expect(event.livemode).toBe(false);
    });

    it('omits includable line_items and sends no previous_attributes', () => {
      const event = fn();
      expect(event.data.object).not.toHaveProperty('line_items');
      expect(event.data).not.toHaveProperty('previous_attributes');
    });

    it('returns every field Stripe sends by default, in either mode', () => {
      for (const mode of ['payment', 'subscription'] as const) {
        const session = fn({ mode }).data.object;
        expect(Object.keys(session).sort()).toEqual([...DEFAULT_SESSION_FIELDS].sort());
      }
    });

    it('leaves out fields Stripe only returns in other configurations', () => {
      const session = fn().data.object;
      for (const field of [
        'excluded_payment_method_types',
        'name_collection',
        'optional_items',
        'presentment_details',
        'redirect_on_completion',
        'return_url',
        'tax_id_collection',
      ]) {
        expect(session, field).not.toHaveProperty(field);
      }
    });

    it('narrows dynamic payment methods with allowed_payment_method_types (endive)', () => {
      const session = fn({ paymentMethodType: 'sepa_debit' }).data.object;
      expect(session.allowed_payment_method_types).toEqual(['sepa_debit']);
      expect(session.payment_method_types).toEqual(['sepa_debit']);
      expect(session.payment_method_configuration_details).toEqual({
        id: expect.stringMatching(/^pmc_[A-Za-z0-9]{24}$/),
        parent: null,
      });
      expect(session.payment_method_options).toEqual({});
    });

    it('is a hosted page session with no client secret', () => {
      const session = fn().data.object;
      expect(session.ui_mode).toBe('hosted_page');
      expect(session.client_secret).toBeNull();
      expect(session.branding_settings.border_style).toBe('rounded');
    });

    it('reports the Checkout-created customer and its saved payment method settings', () => {
      const session = fn().data.object;
      expect(session.customer_creation).toBe('always');
      expect(session.customer_account).toBeNull();
      expect(session.saved_payment_method_options).toEqual({
        allow_redisplay_filters: ['always'],
        payment_method_remove: 'disabled',
        payment_method_save: null,
      });
      expect(session.collected_information).toEqual({
        business_name: null,
        individual_name: null,
        shipping_details: null,
      });
    });

    it('carries the default settings objects with zero totals', () => {
      const session = fn().data.object;
      expect(session.automatic_tax).toEqual({ enabled: false, liability: null, provider: null, status: null });
      expect(session.custom_text).toEqual({
        after_submit: null,
        shipping_address: null,
        submit: null,
        terms_of_service_acceptance: null,
      });
      expect(session.custom_fields).toEqual([]);
      expect(session.shipping_options).toEqual([]);
      expect(session.discounts).toEqual([]);
      expect(session.phone_number_collection).toEqual({ enabled: false });
      expect(session.managed_payments).toEqual({ enabled: false });
      expect(session.total_details).toEqual({ amount_discount: 0, amount_shipping: 0, amount_tax: 0 });
    });

    it('sets invoice_creation and adaptive_pricing in payment mode only', () => {
      const payment = fn().data.object;
      expect(payment.adaptive_pricing).toEqual({ enabled: true });
      expect(payment.invoice_creation).toEqual({
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
      });

      const subscription = fn({ mode: 'subscription' }).data.object;
      expect(subscription.adaptive_pricing).toBeNull();
      expect(subscription.invoice_creation).toBeNull();
    });

    it('carries the nullable fields Stripe returns as null', () => {
      const session = fn().data.object;
      for (const field of [
        'after_expiration',
        'allow_promotion_codes',
        'billing_address_collection',
        'consent',
        'consent_collection',
        'currency_conversion',
        'integration_identifier',
        'locale',
        'origin_context',
        'payment_link',
        'permissions',
        'recovered_from',
        'shipping_address_collection',
        'shipping_cost',
        'submit_type',
        'wallet_options',
      ] as const) {
        expect(session[field], field).toBeNull();
      }
    });
  });
}

describe('async payment sessions with an unknown payment method type', () => {
  it('throws a named error instead of a TypeError', () => {
    for (const fn of [checkoutSessionAsyncPaymentSucceeded, checkoutSessionAsyncPaymentFailed]) {
      // Options often come from user input (CLI --set, request bodies).
      const bogus = { paymentMethodType: 'card' } as unknown as Parameters<typeof fn>[0];
      expect(() => fn(bogus)).toThrow('Unknown delayed payment method type: card');
      const inherited = { paymentMethodType: 'toString' } as unknown as Parameters<typeof fn>[0];
      expect(() => fn(inherited)).toThrow('Unknown delayed payment method type: toString');
    }
  });
});
