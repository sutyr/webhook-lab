// Copyright 2026 Sutyr Inc. SPDX-License-Identifier: Apache-2.0
import { describe, it, expect } from 'vitest';
import {
  paymentMethodAttached,
  paymentMethodAutomaticallyUpdated,
  setupIntentSucceeded,
} from '../../../src/generators/payment-methods.js';
import { STRIPE_API_VERSION } from '../../../src/generators/envelope.js';

// 2026-10-16T00:00:00Z
const OCT_2026 = 1_792_108_800;

describe('paymentMethodAttached', () => {
  it('returns a payment_method.attached event at the current API version', () => {
    const event = paymentMethodAttached();
    expect(event.type).toBe('payment_method.attached');
    expect(event.object).toBe('event');
    expect(event.api_version).toBe(STRIPE_API_VERSION);
    expect(event.id).toMatch(/^evt_/);
  });

  it('wraps a pm_ payment_method attached to a cus_ customer', () => {
    const pm = paymentMethodAttached().data.object;
    expect(pm.object).toBe('payment_method');
    expect(pm.id).toMatch(/^pm_/);
    expect(pm.customer).toMatch(/^cus_/);
  });

  it('defaults to a visa card with a complete card hash', () => {
    const pm = paymentMethodAttached({ timestamp: OCT_2026 }).data.object;
    expect(pm.type).toBe('card');
    expect(pm.card).toEqual({
      brand: 'visa',
      checks: {
        address_line1_check: null,
        address_postal_code_check: null,
        cvc_check: 'pass',
      },
      country: 'US',
      display_brand: 'visa',
      exp_month: 12,
      exp_year: 2029,
      fingerprint: pm.card!.fingerprint,
      funding: 'credit',
      generated_from: null,
      last4: '4242',
      networks: { available: ['visa'], preferred: null },
      regulated_status: 'unregulated',
      three_d_secure_usage: { supported: true },
      wallet: null,
    });
    expect(pm.card!.fingerprint).toMatch(/^[A-Za-z0-9]{16}$/);
  });

  it('only carries the hash matching its type', () => {
    const card = paymentMethodAttached().data.object;
    expect(card).toHaveProperty('card');
    expect(card).not.toHaveProperty('us_bank_account');

    const bank = paymentMethodAttached({ type: 'us_bank_account' }).data.object;
    expect(bank.type).toBe('us_bank_account');
    expect(bank).toHaveProperty('us_bank_account');
    expect(bank).not.toHaveProperty('card');
  });

  it('builds an ACH bank account matching Stripe test data', () => {
    const account = paymentMethodAttached({ type: 'us_bank_account' }).data.object.us_bank_account!;
    expect(account.account_holder_type).toBe('individual');
    expect(account.account_type).toBe('checking');
    expect(account.bank_name).toBe('STRIPE TEST BANK');
    expect(account.financial_connections_account).toBeNull();
    expect(account.last4).toBe('6789');
    expect(account.routing_number).toBe('110000000');
    expect(account.networks).toEqual({ preferred: 'ach', supported: ['ach'] });
    expect(account.status_details).toEqual({});
  });

  it('maps display_brand to Stripe spelling', () => {
    expect(paymentMethodAttached({ cardBrand: 'amex' }).data.object.card!.display_brand).toBe('american_express');
    expect(paymentMethodAttached({ cardBrand: 'unionpay' }).data.object.card!.display_brand).toBe('union_pay');
    expect(paymentMethodAttached({ cardBrand: 'diners' }).data.object.card!.display_brand).toBe('diners_club');
    expect(paymentMethodAttached({ cardBrand: 'mastercard' }).data.object.card!.display_brand).toBe('mastercard');
  });

  it('propagates IDs, card details, allow_redisplay and metadata', () => {
    const pm = paymentMethodAttached({
      customerId: 'cus_shared',
      paymentMethodId: 'pm_shared',
      cardBrand: 'mastercard',
      cardLast4: '4444',
      cardExpMonth: 3,
      cardExpYear: 2031,
      allowRedisplay: 'always',
      metadata: { source: 'settings' },
    }).data.object;
    expect(pm.id).toBe('pm_shared');
    expect(pm.customer).toBe('cus_shared');
    expect(pm.card!.brand).toBe('mastercard');
    expect(pm.card!.networks).toEqual({ available: ['mastercard'], preferred: null });
    expect(pm.card!.last4).toBe('4444');
    expect(pm.card!.exp_month).toBe(3);
    expect(pm.card!.exp_year).toBe(2031);
    expect(pm.allow_redisplay).toBe('always');
    expect(pm.metadata).toEqual({ source: 'settings' });
  });

  it('defaults allow_redisplay to unspecified and metadata to empty', () => {
    const pm = paymentMethodAttached().data.object;
    expect(pm.allow_redisplay).toBe('unspecified');
    expect(pm.metadata).toEqual({});
  });

  it('carries billing_details with the null fields Stripe returns', () => {
    expect(paymentMethodAttached().data.object.billing_details).toEqual({
      address: {
        city: null,
        country: null,
        line1: null,
        line2: null,
        postal_code: null,
        state: null,
      },
      email: null,
      name: 'Jane Doe',
      phone: null,
      tax_id: null,
    });
  });

  it('returns every field Stripe sends by default plus the hash for its type', () => {
    const base = [
      'id',
      'object',
      'allow_redisplay',
      'billing_details',
      'created',
      'customer',
      'customer_account',
      'livemode',
      'metadata',
      'type',
    ];
    expect(Object.keys(paymentMethodAttached().data.object).sort()).toEqual([...base, 'card'].sort());
    expect(Object.keys(paymentMethodAttached({ type: 'us_bank_account' }).data.object).sort()).toEqual(
      [...base, 'us_bank_account'].sort(),
    );
  });

  it('includes customer_account as null and omits conditional radar_options', () => {
    const pm = paymentMethodAttached().data.object;
    expect(pm.customer_account).toBeNull();
    expect(pm).not.toHaveProperty('radar_options');
  });

  it('uses the timestamp for the event and the payment method', () => {
    const event = paymentMethodAttached({ timestamp: OCT_2026 });
    expect(event.created).toBe(OCT_2026);
    expect(event.data.object.created).toBe(OCT_2026);
  });

  it('sends no previous_attributes and is in test mode', () => {
    const event = paymentMethodAttached();
    expect(event.data).not.toHaveProperty('previous_attributes');
    expect(event.livemode).toBe(false);
    expect(event.data.object.livemode).toBe(false);
  });
});

describe('paymentMethodAutomaticallyUpdated', () => {
  it('returns a payment_method.automatically_updated event at the current API version', () => {
    const event = paymentMethodAutomaticallyUpdated();
    expect(event.type).toBe('payment_method.automatically_updated');
    expect(event.api_version).toBe(STRIPE_API_VERSION);
    expect(event.id).toMatch(/^evt_/);
  });

  it('wraps a saved pm_ card on a cus_ customer', () => {
    const pm = paymentMethodAutomaticallyUpdated().data.object;
    expect(pm.object).toBe('payment_method');
    expect(pm.id).toMatch(/^pm_/);
    expect(pm.type).toBe('card');
    expect(pm.customer).toMatch(/^cus_/);
    expect(pm).not.toHaveProperty('us_bank_account');
  });

  it('has a null request id because no API call triggered it', () => {
    expect(paymentMethodAutomaticallyUpdated().request.id).toBeNull();
  });

  it('defaults to a reissue: same number, expiry pushed out three years', () => {
    const event = paymentMethodAutomaticallyUpdated({ timestamp: OCT_2026 });
    const card = event.data.object.card!;
    expect(card.last4).toBe('4242');
    expect(card.exp_month).toBe(10);
    expect(card.exp_year).toBe(2029);
    expect(event.data.previous_attributes).toEqual({ card: { exp_year: 2026 } });
  });

  it('lists only changed card keys in previous_attributes', () => {
    const event = paymentMethodAutomaticallyUpdated({
      previousCardExpMonth: 4,
      previousCardExpYear: 2026,
      cardExpMonth: 9,
      cardExpYear: 2030,
    });
    expect(event.data.previous_attributes).toEqual({ card: { exp_month: 4, exp_year: 2026 } });
  });

  it('reports the old last4 and fingerprint when the card number changed', () => {
    const event = paymentMethodAutomaticallyUpdated({
      previousCardLast4: '4242',
      cardLast4: '1881',
    });
    const card = event.data.object.card!;
    const previous = event.data.previous_attributes as unknown as {
      card: { last4?: string; fingerprint?: string };
    };
    expect(card.last4).toBe('1881');
    expect(previous.card.last4).toBe('4242');
    expect(previous.card.fingerprint).toMatch(/^[A-Za-z0-9]{16}$/);
    expect(previous.card.fingerprint).not.toBe(card.fingerprint);
  });

  it('sends no previous_attributes when the options change nothing', () => {
    const event = paymentMethodAutomaticallyUpdated({
      previousCardExpMonth: 4,
      previousCardExpYear: 2030,
      cardExpMonth: 4,
      cardExpYear: 2030,
    });
    expect(event.data).not.toHaveProperty('previous_attributes');
  });

  it('keeps the fingerprint out of previous_attributes when the number is unchanged', () => {
    const previous = paymentMethodAutomaticallyUpdated().data.previous_attributes as unknown as {
      card: Record<string, unknown>;
    };
    expect(previous.card).not.toHaveProperty('fingerprint');
    expect(previous.card).not.toHaveProperty('last4');
  });

  it('propagates IDs, brand and metadata', () => {
    const pm = paymentMethodAutomaticallyUpdated({
      customerId: 'cus_shared',
      paymentMethodId: 'pm_shared',
      cardBrand: 'amex',
      metadata: { plan: 'pro' },
    }).data.object;
    expect(pm.id).toBe('pm_shared');
    expect(pm.customer).toBe('cus_shared');
    expect(pm.card!.brand).toBe('amex');
    expect(pm.card!.display_brand).toBe('american_express');
    expect(pm.metadata).toEqual({ plan: 'pro' });
  });

  it('dates the payment method before the event', () => {
    const event = paymentMethodAutomaticallyUpdated({ timestamp: OCT_2026 });
    expect(event.created).toBe(OCT_2026);
    expect(event.data.object.created).toBeLessThan(OCT_2026);
  });
});

describe('setupIntentSucceeded', () => {
  it('returns a setup_intent.succeeded event at the current API version', () => {
    const event = setupIntentSucceeded();
    expect(event.type).toBe('setup_intent.succeeded');
    expect(event.api_version).toBe(STRIPE_API_VERSION);
    expect(event.id).toMatch(/^evt_/);
  });

  it('wraps a succeeded seti_ setup_intent', () => {
    const seti = setupIntentSucceeded().data.object;
    expect(seti.object).toBe('setup_intent');
    expect(seti.id).toMatch(/^seti_/);
    expect(seti.status).toBe('succeeded');
  });

  it('sets the saved payment method, customer and latest attempt', () => {
    const seti = setupIntentSucceeded().data.object;
    expect(seti.payment_method).toMatch(/^pm_/);
    expect(seti.customer).toMatch(/^cus_/);
    expect(seti.latest_attempt).toMatch(/^setatt_/);
  });

  it('defaults usage to off_session and accepts on_session', () => {
    expect(setupIntentSucceeded().data.object.usage).toBe('off_session');
    expect(setupIntentSucceeded({ usage: 'on_session' }).data.object.usage).toBe('on_session');
  });

  it('derives client_secret from the setup intent id', () => {
    const seti = setupIntentSucceeded().data.object;
    expect(seti.client_secret).toMatch(new RegExp(`^${seti.id}_secret_[A-Za-z0-9]{31}$`));
  });

  it('sets up a card with no mandate by default', () => {
    const seti = setupIntentSucceeded().data.object;
    expect(seti.payment_method_types).toEqual(['card']);
    expect(seti.payment_method_options).toEqual({
      card: { mandate_options: null, network: null, request_three_d_secure: 'automatic' },
    });
    expect(seti.mandate).toBeNull();
  });

  it('sets up an ACH bank account with a mandate_ mandate', () => {
    const seti = setupIntentSucceeded({ paymentMethodType: 'us_bank_account' }).data.object;
    expect(seti.payment_method_types).toEqual(['us_bank_account']);
    expect(seti.payment_method_options).toEqual({
      us_bank_account: {
        financial_connections: { permissions: ['payment_method'], prefetch: [] },
        mandate_options: {},
        verification_method: 'automatic',
      },
    });
    expect(seti.mandate).toMatch(/^mandate_/);
  });

  it('carries the nullable fields Stripe returns as null', () => {
    const seti = setupIntentSucceeded().data.object;
    for (const field of [
      'application',
      'cancellation_reason',
      'customer_account',
      'description',
      'excluded_payment_method_types',
      'flow_directions',
      'last_setup_error',
      'next_action',
      'on_behalf_of',
      'single_use_mandate',
    ] as const) {
      expect(seti[field], field).toBeNull();
    }
  });

  it('uses dynamic payment methods narrowed to one type, as endive requires', () => {
    for (const type of ['card', 'us_bank_account'] as const) {
      const seti = setupIntentSucceeded({ paymentMethodType: type }).data.object;
      expect(seti.automatic_payment_methods).toEqual({ enabled: true });
      expect(seti.allowed_payment_method_types).toEqual([type]);
      expect(seti.payment_method_types).toEqual([type]);
      expect(seti.payment_method_configuration_details).toEqual({
        id: expect.stringMatching(/^pmc_[A-Za-z0-9]{24}$/),
        parent: null,
      });
    }
  });

  it('reports managed_payments as disabled', () => {
    expect(setupIntentSucceeded().data.object.managed_payments).toEqual({ enabled: false });
  });

  it('returns every field Stripe sends by default and omits attach_to_self', () => {
    const seti = setupIntentSucceeded().data.object;
    expect(Object.keys(seti).sort()).toEqual(
      [
        'id',
        'object',
        'allowed_payment_method_types',
        'application',
        'automatic_payment_methods',
        'cancellation_reason',
        'client_secret',
        'created',
        'customer',
        'customer_account',
        'description',
        'excluded_payment_method_types',
        'flow_directions',
        'last_setup_error',
        'latest_attempt',
        'livemode',
        'managed_payments',
        'mandate',
        'metadata',
        'next_action',
        'on_behalf_of',
        'payment_method',
        'payment_method_configuration_details',
        'payment_method_options',
        'payment_method_types',
        'single_use_mandate',
        'status',
        'usage',
      ].sort(),
    );
    expect(seti).not.toHaveProperty('attach_to_self');
  });

  it('propagates IDs and metadata', () => {
    const seti = setupIntentSucceeded({
      setupIntentId: 'seti_shared',
      customerId: 'cus_shared',
      paymentMethodId: 'pm_shared',
      metadata: { flow: 'trial' },
    }).data.object;
    expect(seti.id).toBe('seti_shared');
    expect(seti.customer).toBe('cus_shared');
    expect(seti.payment_method).toBe('pm_shared');
    expect(seti.client_secret).toMatch(/^seti_shared_secret_/);
    expect(seti.metadata).toEqual({ flow: 'trial' });
  });

  it('dates the setup intent just before the event', () => {
    const event = setupIntentSucceeded({ timestamp: OCT_2026 });
    expect(event.created).toBe(OCT_2026);
    expect(event.data.object.created).toBeLessThanOrEqual(OCT_2026);
  });

  it('sends no previous_attributes and is in test mode', () => {
    const event = setupIntentSucceeded();
    expect(event.data).not.toHaveProperty('previous_attributes');
    expect(event.livemode).toBe(false);
    expect(event.data.object.livemode).toBe(false);
  });
});

describe('shared IDs across payment method events', () => {
  it('links a setup intent, the attached method and a later card update', () => {
    const ids = { customerId: 'cus_flow', paymentMethodId: 'pm_flow' };
    const seti = setupIntentSucceeded(ids).data.object;
    const attached = paymentMethodAttached(ids).data.object;
    const updated = paymentMethodAutomaticallyUpdated(ids).data.object;
    expect(seti.payment_method).toBe(attached.id);
    expect(updated.id).toBe(attached.id);
    expect(new Set([seti.customer, attached.customer, updated.customer])).toEqual(new Set(['cus_flow']));
  });
});
