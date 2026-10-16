// Copyright 2026 Sutyr Inc. SPDX-License-Identifier: Apache-2.0
import type { StripeEvent } from '../types/index.js';
import type {
  StripeBillingDetails,
  StripeCardBrand,
  StripeGeneratedPaymentMethodType,
  StripePaymentMethod,
  StripePaymentMethodCard,
  StripePaymentMethodCardPreviousAttributes,
  StripePaymentMethodUsBankAccount,
  StripeSetupIntent,
  StripeSetupIntentPaymentMethodOptions,
  PaymentMethodAttachedOptions,
  PaymentMethodAutomaticallyUpdatedOptions,
  SetupIntentSucceededOptions,
} from '../types/payment-methods.js';
import { wrapInEvent } from './envelope.js';
import {
  customerId,
  generateId,
  paymentMethodId,
  setupIntentId,
} from '../utils/ids.js';
import { now } from '../utils/timestamps.js';

// ─── Helpers ────────────────────────────────────────────────────────────────

const setupAttemptId = () => generateId('setatt_');
const mandateId = () => generateId('mandate_');
const paymentMethodConfigurationId = () => generateId('pmc_');
const fingerprint = () => generateId('', 16);

// `display_brand` uses its own spelling for some brands.
const DISPLAY_BRAND: Record<StripeCardBrand, string> = {
  amex: 'american_express',
  diners: 'diners_club',
  discover: 'discover',
  jcb: 'jcb',
  mastercard: 'mastercard',
  unionpay: 'union_pay',
  visa: 'visa',
};

const CARD_COUNTRY: Record<StripeCardBrand, string> = {
  amex: 'US',
  diners: 'US',
  discover: 'US',
  jcb: 'JP',
  mastercard: 'US',
  unionpay: 'CN',
  visa: 'US',
};

function buildCard(opts: {
  brand: StripeCardBrand;
  last4: string;
  expMonth: number;
  expYear: number;
  fingerprint: string;
}): StripePaymentMethodCard {
  return {
    brand: opts.brand,
    checks: {
      address_line1_check: null,
      address_postal_code_check: null,
      cvc_check: 'pass',
    },
    country: CARD_COUNTRY[opts.brand],
    display_brand: DISPLAY_BRAND[opts.brand],
    exp_month: opts.expMonth,
    exp_year: opts.expYear,
    fingerprint: opts.fingerprint,
    funding: 'credit',
    generated_from: null,
    last4: opts.last4,
    networks: {
      available: [opts.brand],
      preferred: null,
    },
    regulated_status: 'unregulated',
    three_d_secure_usage: { supported: true },
    wallet: null,
  };
}

// Matches Stripe's ACH test account (routing 110000000, account ending 6789).
function buildUsBankAccount(): StripePaymentMethodUsBankAccount {
  return {
    account_holder_type: 'individual',
    account_type: 'checking',
    bank_name: 'STRIPE TEST BANK',
    financial_connections_account: null,
    fingerprint: fingerprint(),
    last4: '6789',
    networks: {
      preferred: 'ach',
      supported: ['ach'],
    },
    routing_number: '110000000',
    status_details: {},
  };
}

function buildBillingDetails(): StripeBillingDetails {
  return {
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
  };
}

// ─── payment_method.attached ────────────────────────────────────────────────

export function paymentMethodAttached(
  options?: PaymentMethodAttachedOptions,
): StripeEvent<StripePaymentMethod> {
  const ts = options?.timestamp ?? now();
  const type: StripeGeneratedPaymentMethodType = options?.type ?? 'card';

  const paymentMethod: StripePaymentMethod = {
    id: options?.paymentMethodId ?? paymentMethodId(),
    object: 'payment_method',
    allow_redisplay: options?.allowRedisplay ?? 'unspecified',
    billing_details: buildBillingDetails(),
    created: ts,
    customer: options?.customerId ?? customerId(),
    customer_account: null,
    livemode: false,
    metadata: options?.metadata ?? {},
    type,
  };

  if (type === 'card') {
    paymentMethod.card = buildCard({
      brand: options?.cardBrand ?? 'visa',
      last4: options?.cardLast4 ?? '4242',
      expMonth: options?.cardExpMonth ?? 12,
      expYear: options?.cardExpYear ?? new Date(ts * 1000).getUTCFullYear() + 3,
      fingerprint: fingerprint(),
    });
  } else {
    paymentMethod.us_bank_account = buildUsBankAccount();
  }

  return wrapInEvent('payment_method.attached', paymentMethod, { timestamp: ts });
}

// ─── payment_method.automatically_updated ───────────────────────────────────
// The card network replaced a saved card (reissue, expiry, lost or stolen).
// Stripe sends the new expiry and last four digits; previous_attributes holds
// the values they replaced. A new card number also changes the fingerprint.
// request.id stays null: no API call triggered the update.

export function paymentMethodAutomaticallyUpdated(
  options?: PaymentMethodAutomaticallyUpdatedOptions,
): StripeEvent<StripePaymentMethod> {
  const ts = options?.timestamp ?? now();
  const eventDate = new Date(ts * 1000);

  const previousExpMonth = options?.previousCardExpMonth ?? eventDate.getUTCMonth() + 1;
  const previousExpYear = options?.previousCardExpYear ?? eventDate.getUTCFullYear();
  const expMonth = options?.cardExpMonth ?? previousExpMonth;
  const expYear = options?.cardExpYear ?? previousExpYear + 3;
  const previousLast4 = options?.previousCardLast4 ?? '4242';
  const last4 = options?.cardLast4 ?? previousLast4;
  const numberChanged = last4 !== previousLast4;
  const previousFingerprint = fingerprint();
  const currentFingerprint = numberChanged ? fingerprint() : previousFingerprint;

  const paymentMethod: StripePaymentMethod = {
    id: options?.paymentMethodId ?? paymentMethodId(),
    object: 'payment_method',
    allow_redisplay: 'unspecified',
    billing_details: buildBillingDetails(),
    card: buildCard({
      brand: options?.cardBrand ?? 'visa',
      last4,
      expMonth,
      expYear,
      fingerprint: currentFingerprint,
    }),
    // Saved when the customer first added the card, years before the reissue.
    created: ts - 3 * 365 * 86400,
    customer: options?.customerId ?? customerId(),
    customer_account: null,
    livemode: false,
    metadata: options?.metadata ?? {},
    type: 'card',
  };

  const previous: StripePaymentMethodCardPreviousAttributes = { card: {} };
  if (expMonth !== previousExpMonth) previous.card.exp_month = previousExpMonth;
  if (expYear !== previousExpYear) previous.card.exp_year = previousExpYear;
  if (numberChanged) {
    previous.card.fingerprint = previousFingerprint;
    previous.card.last4 = previousLast4;
  }

  return wrapInEvent('payment_method.automatically_updated', paymentMethod, {
    timestamp: ts,
    // Nested partial: only the card keys that changed, as Stripe sends them.
    // Options that change nothing leave previous_attributes out.
    previousAttributes:
      Object.keys(previous.card).length > 0 ? (previous as Partial<StripePaymentMethod>) : undefined,
  });
}

// ─── setup_intent.succeeded ─────────────────────────────────────────────────

export function setupIntentSucceeded(
  options?: SetupIntentSucceededOptions,
): StripeEvent<StripeSetupIntent> {
  const ts = options?.timestamp ?? now();
  const type: StripeGeneratedPaymentMethodType = options?.paymentMethodType ?? 'card';
  const setiId = options?.setupIntentId ?? setupIntentId();

  const paymentMethodOptions: StripeSetupIntentPaymentMethodOptions =
    type === 'card'
      ? {
          card: {
            mandate_options: null,
            network: null,
            request_three_d_secure: 'automatic',
          },
        }
      : {
          us_bank_account: {
            financial_connections: {
              permissions: ['payment_method'],
              prefetch: [],
            },
            mandate_options: {},
            verification_method: 'automatic',
          },
        };

  // Since 2026-09-30.endive a SetupIntent no longer accepts
  // payment_method_types: Stripe computes the set from the account's payment
  // method configuration, here narrowed to one type with
  // allowed_payment_method_types. payment_method_types stays as the read-only
  // result.
  const setupIntent: StripeSetupIntent = {
    id: setiId,
    object: 'setup_intent',
    allowed_payment_method_types: [type],
    application: null,
    automatic_payment_methods: { enabled: true },
    cancellation_reason: null,
    client_secret: `${setiId}_secret_${generateId('', 31)}`,
    created: ts - 60,
    customer: options?.customerId ?? customerId(),
    customer_account: null,
    description: null,
    excluded_payment_method_types: null,
    flow_directions: null,
    last_setup_error: null,
    latest_attempt: setupAttemptId(),
    livemode: false,
    managed_payments: { enabled: false },
    // Bank debits authorize future pulls with a multi-use mandate; a card set
    // up for off-session use carries none.
    mandate: type === 'us_bank_account' ? mandateId() : null,
    metadata: options?.metadata ?? {},
    next_action: null,
    on_behalf_of: null,
    payment_method: options?.paymentMethodId ?? paymentMethodId(),
    payment_method_configuration_details: { id: paymentMethodConfigurationId(), parent: null },
    payment_method_options: paymentMethodOptions,
    payment_method_types: [type],
    single_use_mandate: null,
    status: 'succeeded',
    usage: options?.usage ?? 'off_session',
  };

  return wrapInEvent('setup_intent.succeeded', setupIntent, { timestamp: ts });
}
