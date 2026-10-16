// Copyright 2026 Sutyr Inc. SPDX-License-Identifier: Apache-2.0
import type {
  BaseEventOptions,
  StripeCheckoutSession,
  StripeObject,
  StripePaymentError,
} from './index.js';

// ─── Address and Billing Details ─────────────────────────────────────────────

export interface StripeAddress {
  city: string | null;
  country: string | null;
  line1: string | null;
  line2: string | null;
  postal_code: string | null;
  state: string | null;
}

export interface StripeBillingDetails {
  address: StripeAddress | null;
  email: string | null;
  name: string | null;
  phone: string | null;
  tax_id: string | null;
}

// ─── PaymentMethod ───────────────────────────────────────────────────────────

/** Card brands this package generates. Stripe's `card.brand` can also be `cartes_bancaires`, `eftpos_au`, `link` or `unknown`. */
export type StripeCardBrand =
  | 'amex'
  | 'diners'
  | 'discover'
  | 'jcb'
  | 'mastercard'
  | 'unionpay'
  | 'visa';

export interface StripePaymentMethodCardChecks {
  address_line1_check: string | null;
  address_postal_code_check: string | null;
  cvc_check: string | null;
}

export interface StripePaymentMethodCardGeneratedFrom {
  charge: string | null;
  payment_method_details: Record<string, unknown> | null;
  setup_attempt: string | null;
}

export interface StripePaymentMethodCardWallet {
  type:
    | 'amex_express_checkout'
    | 'apple_pay'
    | 'google_pay'
    | 'link'
    | 'masterpass'
    | 'samsung_pay'
    | 'visa_checkout';
  dynamic_last4: string | null;
}

export interface StripePaymentMethodCard {
  brand: string;
  checks: StripePaymentMethodCardChecks | null;
  country: string | null;
  display_brand: string | null;
  exp_month: number;
  exp_year: number;
  fingerprint: string | null;
  funding: string;
  generated_from: StripePaymentMethodCardGeneratedFrom | null;
  last4: string;
  networks: {
    available: string[];
    preferred: string | null;
  } | null;
  regulated_status: 'regulated' | 'unregulated' | null;
  three_d_secure_usage: { supported: boolean } | null;
  wallet: StripePaymentMethodCardWallet | null;
}

export interface StripePaymentMethodUsBankAccount {
  account_holder_type: 'company' | 'individual' | null;
  account_type: 'checking' | 'savings' | null;
  bank_name: string | null;
  financial_connections_account: string | null;
  fingerprint: string | null;
  last4: string | null;
  networks: {
    preferred: string | null;
    supported: Array<'ach' | 'us_domestic_wire'>;
  } | null;
  routing_number: string | null;
  status_details: {
    blocked?: {
      network_code: string | null;
      reason: string | null;
    };
  } | null;
}

/** Payment method types this package generates PaymentMethod objects for. */
export type StripeGeneratedPaymentMethodType = 'card' | 'us_bank_account';

export interface StripePaymentMethod extends StripeObject {
  object: 'payment_method';
  allow_redisplay: 'always' | 'limited' | 'unspecified';
  billing_details: StripeBillingDetails;
  /** Present only when `type` is `card`. Stripe adds one hash per type, named after it. */
  card?: StripePaymentMethodCard;
  created: number;
  customer: string | null;
  customer_account: string | null;
  livemode: false;
  metadata: Record<string, string>;
  type: string;
  /** Present only when `type` is `us_bank_account`. */
  us_bank_account?: StripePaymentMethodUsBankAccount;
}

/**
 * `data.previous_attributes` on payment_method.automatically_updated: only the
 * card keys the network changed. `last4` and `fingerprint` appear only when the
 * card number changed.
 */
export interface StripePaymentMethodCardPreviousAttributes {
  card: Partial<Pick<StripePaymentMethodCard, 'exp_month' | 'exp_year' | 'last4' | 'fingerprint'>>;
}

// ─── SetupIntent ─────────────────────────────────────────────────────────────

export interface StripeSetupIntentPaymentMethodOptions {
  card?: {
    mandate_options: Record<string, unknown> | null;
    network: string | null;
    request_three_d_secure: 'any' | 'automatic' | 'challenge' | null;
  };
  us_bank_account?: {
    financial_connections?: {
      permissions?: Array<'balances' | 'ownership' | 'payment_method' | 'transactions'>;
      prefetch: Array<'balances' | 'ownership' | 'transactions'> | null;
    };
    mandate_options?: { collection_method?: 'paper' };
    verification_method?: 'automatic' | 'instant' | 'microdeposits';
  };
}

export interface StripeSetupIntent extends StripeObject {
  object: 'setup_intent';
  /**
   * Since 2026-09-30.endive SetupIntents no longer accept `payment_method_types`;
   * this filter narrows the dynamically computed set instead.
   */
  allowed_payment_method_types: string[] | null;
  application: string | null;
  automatic_payment_methods: {
    allow_redirects?: 'always' | 'never';
    enabled: boolean | null;
  } | null;
  cancellation_reason: 'abandoned' | 'duplicate' | 'requested_by_customer' | null;
  client_secret: string | null;
  created: number;
  customer: string | null;
  customer_account: string | null;
  description: string | null;
  excluded_payment_method_types: string[] | null;
  flow_directions: Array<'inbound' | 'outbound'> | null;
  last_setup_error: StripePaymentError | null;
  latest_attempt: string | null;
  livemode: false;
  managed_payments: { enabled: boolean } | null;
  mandate: string | null;
  metadata: Record<string, string>;
  next_action: Record<string, unknown> | null;
  on_behalf_of: string | null;
  payment_method: string | null;
  payment_method_configuration_details: {
    id: string;
    parent: string | null;
  } | null;
  payment_method_options: StripeSetupIntentPaymentMethodOptions | null;
  payment_method_types: string[];
  single_use_mandate: string | null;
  status:
    | 'canceled'
    | 'processing'
    | 'requires_action'
    | 'requires_confirmation'
    | 'requires_payment_method'
    | 'succeeded';
  usage: 'off_session' | 'on_session';
}

// ─── Checkout Session (delayed payment methods) ──────────────────────────────

/** Delayed-notification methods whose Checkout payments settle after the session completes. */
export type CheckoutDelayedPaymentMethodType =
  | 'us_bank_account'
  | 'sepa_debit'
  | 'bacs_debit'
  | 'boleto';

export interface StripeCheckoutSessionCustomerDetails {
  address: StripeAddress | null;
  business_name: string | null;
  email: string | null;
  individual_name: string | null;
  name: string | null;
  phone: string | null;
  tax_exempt: 'exempt' | 'none' | 'reverse' | null;
  tax_ids: Array<{ type: string; value: string | null }> | null;
}

export interface StripeCheckoutSessionAutomaticTax {
  enabled: boolean;
  liability: { type: 'account' | 'self'; account?: string } | null;
  provider: string | null;
  status: 'complete' | 'failed' | 'requires_location_inputs' | null;
}

export interface StripeCheckoutSessionBrandingSettings {
  background_color: string;
  border_style: 'pill' | 'rectangular' | 'rounded';
  button_color: string;
  display_name: string;
  font_family: string;
  icon: Record<string, unknown> | null;
  logo: Record<string, unknown> | null;
}

type StripeCheckoutSessionCustomTextPosition = { message: string } | null;

export interface StripeCheckoutSessionInvoiceCreation {
  enabled: boolean;
  invoice_data: {
    account_tax_ids: string[] | null;
    custom_fields: Array<{ name: string; value: string }> | null;
    description: string | null;
    footer: string | null;
    issuer: { type: 'account' | 'self'; account?: string } | null;
    metadata: Record<string, string> | null;
    rendering_options: Record<string, unknown> | null;
  };
}

/**
 * Checkout Session as sent with checkout.session.async_payment_succeeded and
 * checkout.session.async_payment_failed: every field Stripe returns by default
 * at 2026-09-30.endive. Fields that only appear in some configurations
 * (`excluded_payment_method_types`, `name_collection`, `presentment_details`,
 * `redirect_on_completion`, `return_url`, `tax_id_collection`) and includable
 * fields (`line_items`, `optional_items`) are left out.
 */
export interface StripeAsyncPaymentCheckoutSession extends StripeCheckoutSession {
  adaptive_pricing: { enabled: boolean } | null;
  after_expiration: Record<string, unknown> | null;
  allow_promotion_codes: boolean | null;
  /** Added in 2026-09-30.endive, replacing the `payment_method_types` create parameter. */
  allowed_payment_method_types: string[] | null;
  automatic_tax: StripeCheckoutSessionAutomaticTax;
  billing_address_collection: 'auto' | 'required' | null;
  /** Returned for `hosted_page` sessions. */
  branding_settings: StripeCheckoutSessionBrandingSettings;
  client_reference_id: string | null;
  client_secret: string | null;
  collected_information: {
    business_name: string | null;
    individual_name: string | null;
    shipping_details: { address: StripeAddress; name: string } | null;
  } | null;
  consent: Record<string, unknown> | null;
  consent_collection: Record<string, unknown> | null;
  currency_conversion: Record<string, unknown> | null;
  custom_fields: Array<Record<string, unknown>>;
  custom_text: {
    after_submit: StripeCheckoutSessionCustomTextPosition;
    shipping_address: StripeCheckoutSessionCustomTextPosition;
    submit: StripeCheckoutSessionCustomTextPosition;
    terms_of_service_acceptance: StripeCheckoutSessionCustomTextPosition;
  };
  customer_account: string | null;
  customer_creation: 'always' | 'if_required' | null;
  customer_details: StripeCheckoutSessionCustomerDetails | null;
  discounts: Array<{ coupon: string | null; promotion_code: string | null }> | null;
  integration_identifier: string | null;
  invoice: string | null;
  /** Set in payment mode only. */
  invoice_creation: StripeCheckoutSessionInvoiceCreation | null;
  locale: string | null;
  managed_payments: { enabled: boolean } | null;
  origin_context: 'mobile_app' | 'web' | null;
  payment_link: string | null;
  payment_method_collection: 'always' | 'if_required' | null;
  payment_method_configuration_details: {
    id: string;
    parent: string | null;
  } | null;
  payment_method_options: Record<string, unknown> | null;
  payment_method_types: string[];
  permissions: Record<string, unknown> | null;
  phone_number_collection: { enabled: boolean };
  recovered_from: string | null;
  saved_payment_method_options: {
    allow_redisplay_filters: Array<'always' | 'limited' | 'unspecified'> | null;
    payment_method_remove: 'disabled' | 'enabled' | null;
    payment_method_save: 'disabled' | 'enabled' | null;
  } | null;
  setup_intent: string | null;
  shipping_address_collection: { allowed_countries: string[] } | null;
  shipping_cost: Record<string, unknown> | null;
  shipping_options: Array<{ shipping_amount: number; shipping_rate: string }>;
  submit_type: 'auto' | 'book' | 'donate' | 'pay' | 'subscribe' | null;
  total_details: {
    amount_discount: number;
    amount_shipping: number | null;
    amount_tax: number;
  } | null;
  ui_mode: 'elements' | 'embedded_page' | 'form' | 'hosted_page' | null;
  wallet_options: Record<string, unknown> | null;
}

// ─── Generator Option Types ──────────────────────────────────────────────────

export interface CheckoutSessionAsyncPaymentOptions extends BaseEventOptions {
  /** Setup mode collects no payment, so it never produces async payment events. */
  mode?: 'payment' | 'subscription';
  paymentMethodType?: CheckoutDelayedPaymentMethodType;
  checkoutSessionId?: string;
  customerId?: string;
  /** Used in payment mode only. */
  paymentIntentId?: string;
  /** Used in subscription mode only. */
  subscriptionId?: string;
  /** Used in subscription mode only. */
  invoiceId?: string;
  clientReferenceId?: string;
  amount?: number;
  /** Defaults to the settlement currency of `paymentMethodType`. */
  currency?: string;
}

export interface CheckoutSessionAsyncPaymentSucceededOptions extends CheckoutSessionAsyncPaymentOptions {}

export interface CheckoutSessionAsyncPaymentFailedOptions extends CheckoutSessionAsyncPaymentOptions {}

export interface PaymentMethodAttachedOptions extends BaseEventOptions {
  customerId?: string;
  paymentMethodId?: string;
  type?: StripeGeneratedPaymentMethodType;
  /** Card options apply when `type` is `card`. */
  cardBrand?: StripeCardBrand;
  cardLast4?: string;
  cardExpMonth?: number;
  cardExpYear?: number;
  allowRedisplay?: StripePaymentMethod['allow_redisplay'];
}

export interface PaymentMethodAutomaticallyUpdatedOptions extends BaseEventOptions {
  customerId?: string;
  paymentMethodId?: string;
  cardBrand?: StripeCardBrand;
  /** New last four digits. Defaults to `previousCardLast4` (an expiry-only update). */
  cardLast4?: string;
  previousCardLast4?: string;
  /** New expiry. Defaults to the same month, three years after the previous expiry. */
  cardExpMonth?: number;
  cardExpYear?: number;
  /** Previous expiry. Defaults to the month of the event timestamp. */
  previousCardExpMonth?: number;
  previousCardExpYear?: number;
}

export interface SetupIntentSucceededOptions extends BaseEventOptions {
  customerId?: string;
  setupIntentId?: string;
  paymentMethodId?: string;
  paymentMethodType?: StripeGeneratedPaymentMethodType;
  usage?: StripeSetupIntent['usage'];
}
