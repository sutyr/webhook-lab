// Copyright 2026 Sutyr Inc. SPDX-License-Identifier: Apache-2.0

import type { StripeEventType } from '@webhook-lab/events';
import { DECLINE_CODE_MAP } from '@webhook-lab/events';

export type FieldSection = 'core' | 'entity-ids' | 'event-options';

export interface FieldDef {
  key: string;
  label: string;
  type: 'number' | 'text' | 'select';
  defaultValue: unknown;
  options?: { value: string; label: string }[];
  mono?: boolean;
  section?: FieldSection;
  placeholder?: string;
  /** When true, select values 'true'/'false' are coerced to boolean before dispatching */
  coerceBoolean?: boolean;
  /** Helper text rendered below the input */
  description?: string;
  /** Dot-notation path into the JSON payload for JSON→Form sync */
  jsonPath?: string;
}

// ─── Shared Options ─────────────────────────────────────────────────────────

const CURRENCY_OPTIONS = [
  { value: 'usd', label: 'USD' },
  { value: 'eur', label: 'EUR' },
  { value: 'gbp', label: 'GBP' },
  { value: 'jpy', label: 'JPY' },
];

const INTERVAL_OPTIONS = [
  { value: 'month', label: 'Monthly' },
  { value: 'year', label: 'Yearly' },
];

const CHECKOUT_MODE_OPTIONS = [
  { value: 'payment', label: 'Payment' },
  { value: 'subscription', label: 'Subscription' },
  { value: 'setup', label: 'Setup' },
];

const DISPUTE_REASON_OPTIONS = [
  { value: 'fraudulent', label: 'Fraudulent' },
  { value: 'product_not_received', label: 'Product not received' },
  { value: 'duplicate', label: 'Duplicate' },
  { value: 'credit_not_processed', label: 'Credit not processed' },
  { value: 'general', label: 'General' },
  { value: 'subscription_canceled', label: 'Subscription canceled' },
  { value: 'product_unacceptable', label: 'Product unacceptable' },
  { value: 'unrecognized', label: 'Unrecognized' },
  { value: 'bank_cannot_process', label: 'Bank cannot process' },
  { value: 'check_returned', label: 'Check returned' },
  { value: 'customer_initiated', label: 'Customer initiated' },
  { value: 'debit_not_authorized', label: 'Debit not authorized' },
  { value: 'incorrect_account_details', label: 'Incorrect account details' },
  { value: 'insufficient_funds', label: 'Insufficient funds' },
  { value: 'noncompliant', label: 'Noncompliant' },
];

const DISPUTE_STATUS_OPTIONS = [
  { value: 'won', label: 'Won' },
  { value: 'lost', label: 'Lost' },
];

// Statuses a dispute moves through before it closes as won or lost.
const DISPUTE_OPEN_STATUS_OPTIONS = [
  { value: 'needs_response', label: 'Needs response' },
  { value: 'under_review', label: 'Under review' },
  { value: 'warning_needs_response', label: 'Warning needs response' },
  { value: 'warning_under_review', label: 'Warning under review' },
];

const SUBSCRIPTION_STATUS_OPTIONS = [
  { value: 'active', label: 'Active' },
  { value: 'past_due', label: 'Past due' },
  { value: 'canceled', label: 'Canceled' },
  { value: 'unpaid', label: 'Unpaid' },
  { value: 'trialing', label: 'Trialing' },
  { value: 'incomplete', label: 'Incomplete' },
  { value: 'incomplete_expired', label: 'Incomplete expired' },
  { value: 'paused', label: 'Paused' },
];

const BILLING_REASON_OPTIONS = [
  { value: 'subscription_cycle', label: 'Subscription cycle' },
  { value: 'subscription_create', label: 'Subscription create' },
  { value: 'subscription_update', label: 'Subscription update' },
  { value: 'subscription_threshold', label: 'Subscription threshold' },
  { value: 'manual', label: 'Manual' },
];

const CARD_BRAND_OPTIONS = [
  { value: 'visa', label: 'Visa' },
  { value: 'mastercard', label: 'Mastercard' },
  { value: 'amex', label: 'American Express' },
  { value: 'discover', label: 'Discover' },
  { value: 'diners', label: 'Diners Club' },
  { value: 'jcb', label: 'JCB' },
  { value: 'unionpay', label: 'UnionPay' },
];

const DECLINE_CODE_OPTIONS = Object.keys(DECLINE_CODE_MAP).map((key) => ({
  value: key,
  label: key.replace(/_/g, ' '),
}));

const COLLECTION_METHOD_OPTIONS = [
  { value: 'charge_automatically', label: 'Charge automatically' },
  { value: 'send_invoice', label: 'Send invoice' },
];

const INVOICE_UNCOLLECTIBLE_REASON_OPTIONS = [
  { value: 'max_payment_attempts', label: 'Max payment attempts' },
  { value: 'payment_not_received', label: 'Payment not received' },
  { value: 'subscription_canceled', label: 'Subscription canceled' },
  { value: 'subscription_paused', label: 'Subscription paused' },
  { value: 'user_forgiven', label: 'User forgiven' },
];

const CANCELLATION_REASON_OPTIONS = [
  { value: 'requested_by_customer', label: 'Requested by customer' },
  { value: 'abandoned', label: 'Abandoned' },
  { value: 'automatic', label: 'Automatic' },
  { value: 'duplicate', label: 'Duplicate' },
  { value: 'expired', label: 'Expired' },
  { value: 'failed_invoice', label: 'Failed invoice' },
  { value: 'fraudulent', label: 'Fraudulent' },
  { value: 'void_invoice', label: 'Void invoice' },
];

const REFUND_REASON_OPTIONS = [
  { value: '', label: 'None' },
  { value: 'requested_by_customer', label: 'Requested by customer' },
  { value: 'duplicate', label: 'Duplicate' },
  { value: 'fraudulent', label: 'Fraudulent' },
  { value: 'expired_uncaptured_charge', label: 'Expired uncaptured charge' },
];

const FRAUD_TYPE_OPTIONS = [
  { value: 'unauthorized_use_of_card', label: 'Unauthorized use of card' },
  { value: 'card_never_received', label: 'Card never received' },
  { value: 'fraudulent_card_application', label: 'Fraudulent card application' },
  { value: 'made_with_counterfeit_card', label: 'Made with counterfeit card' },
  { value: 'made_with_lost_card', label: 'Made with lost card' },
  { value: 'made_with_stolen_card', label: 'Made with stolen card' },
  { value: 'misc', label: 'Misc' },
];

const PAUSE_REASON_OPTIONS = [
  { value: 'trial_end_without_payment_method', label: 'Trial ended without a payment method' },
  { value: 'pause_requested', label: 'Paused through the API' },
  { value: 'first_payment_failure', label: 'First renewal payment failed' },
  { value: 'final_payment_failure', label: 'Final payment attempt failed' },
  { value: 'system', label: 'Paused by Stripe' },
];

const DELAYED_PAYMENT_METHOD_OPTIONS = [
  { value: 'us_bank_account', label: 'ACH Direct Debit' },
  { value: 'sepa_debit', label: 'SEPA Direct Debit' },
  { value: 'bacs_debit', label: 'Bacs Direct Debit' },
  { value: 'boleto', label: 'Boleto' },
];

// Empty keeps the settlement currency of the chosen payment method.
const DELAYED_PAYMENT_CURRENCY_OPTIONS = [
  { value: '', label: 'Payment method default' },
  ...CURRENCY_OPTIONS,
  { value: 'brl', label: 'BRL' },
];

const SAVED_PAYMENT_METHOD_TYPE_OPTIONS = [
  { value: 'card', label: 'Card' },
  { value: 'us_bank_account', label: 'US bank account' },
];

const YES_NO_OPTIONS = [
  { value: 'true', label: 'Yes' },
  { value: 'false', label: 'No' },
];

// Generators date card expiry from the current year. Computed once per page
// load, so the field shows the value the payload will carry.
const CURRENT_YEAR = new Date().getUTCFullYear();
const CURRENT_MONTH = new Date().getUTCMonth() + 1;

// ─── Shared Core Fields ─────────────────────────────────────────────────────

const amountField: FieldDef = {
  key: 'amount',
  label: 'Amount (cents)',
  type: 'number',
  defaultValue: 2999,
  mono: true,
  jsonPath: 'data.object.amount',
};

const currencyField: FieldDef = {
  key: 'currency',
  label: 'Currency',
  type: 'select',
  defaultValue: 'usd',
  options: CURRENCY_OPTIONS,
  jsonPath: 'data.object.currency',
};

// Invoices carry the amount as amount_due.
const invoiceAmountField: FieldDef = { ...amountField, jsonPath: 'data.object.amount_due' };

const priceAmountField: FieldDef = {
  key: 'priceAmount',
  label: 'Price amount (cents)',
  type: 'number',
  defaultValue: 2000,
  mono: true,
  jsonPath: 'data.object.items.data.0.price.unit_amount',
};

const intervalField: FieldDef = {
  key: 'interval',
  label: 'Billing interval',
  type: 'select',
  defaultValue: 'month',
  options: INTERVAL_OPTIONS,
  jsonPath: 'data.object.items.data.0.price.recurring.interval',
};

const collectionMethodField: FieldDef = {
  key: 'collectionMethod',
  label: 'Collection method',
  type: 'select',
  defaultValue: 'charge_automatically',
  options: COLLECTION_METHOD_OPTIONS,
  mono: true,
  jsonPath: 'data.object.collection_method',
};

const pauseReasonField: FieldDef = {
  key: 'pauseReason',
  label: 'Pause reason',
  type: 'select',
  defaultValue: 'trial_end_without_payment_method',
  options: PAUSE_REASON_OPTIONS,
  jsonPath: 'data.object.status_details.paused.subscription.type',
};

const cardBrandField: FieldDef = {
  key: 'cardBrand',
  label: 'Card brand',
  type: 'select',
  defaultValue: 'visa',
  options: CARD_BRAND_OPTIONS,
  jsonPath: 'data.object.card.brand',
};

const cardLast4Field: FieldDef = {
  key: 'cardLast4',
  label: 'Card last 4',
  type: 'text',
  defaultValue: '4242',
  mono: true,
  jsonPath: 'data.object.card.last4',
};

/** A billing reason select limited to the values a generator accepts, labelled as in BILLING_REASON_OPTIONS. */
function billingReasonField(values: string[], defaultValue: string): FieldDef {
  return {
    key: 'billingReason',
    label: 'Billing reason',
    type: 'select',
    defaultValue,
    options: values.map(
      (value) => BILLING_REASON_OPTIONS.find((o) => o.value === value) ?? { value, label: value },
    ),
    jsonPath: 'data.object.billing_reason',
  };
}

/** Fields shared by both async Checkout payment events. */
function asyncCheckoutFields(): FieldDef[] {
  return [
    {
      key: 'paymentMethodType',
      label: 'Payment method',
      type: 'select',
      defaultValue: 'us_bank_account',
      options: DELAYED_PAYMENT_METHOD_OPTIONS,
      jsonPath: 'data.object.payment_method_types.0',
    },
    {
      key: 'mode',
      label: 'Checkout mode',
      type: 'select',
      defaultValue: 'payment',
      // Setup mode collects no payment, so it has no async payment events.
      options: CHECKOUT_MODE_OPTIONS.filter((o) => o.value !== 'setup'),
      jsonPath: 'data.object.mode',
    },
    { ...amountField, jsonPath: 'data.object.amount_total' },
    {
      ...currencyField,
      defaultValue: '',
      options: DELAYED_PAYMENT_CURRENCY_OPTIONS,
    },
    {
      key: 'clientReferenceId',
      label: 'Client reference ID',
      type: 'text',
      defaultValue: '',
      mono: true,
      placeholder: 'order_1234',
      jsonPath: 'data.object.client_reference_id',
    },
    {
      key: 'checkoutSessionId',
      label: 'Checkout session ID',
      type: 'text',
      defaultValue: '',
      mono: true,
      section: 'entity-ids',
      placeholder: 'cs_',
      jsonPath: 'data.object.id',
    },
    customerIdField,
    { ...paymentIntentIdField, label: 'Payment intent ID (payment mode)' },
    { ...subscriptionIdField, label: 'Subscription ID (subscription mode)' },
    { ...invoiceIdField, label: 'Invoice ID (subscription mode)', jsonPath: 'data.object.invoice' },
  ];
}

// ─── Shared Entity ID Fields ────────────────────────────────────────────────

const customerIdField: FieldDef = {
  key: 'customerId',
  label: 'Customer ID',
  type: 'text',
  defaultValue: '',
  mono: true,
  section: 'entity-ids',
  placeholder: 'cus_',
  jsonPath: 'data.object.customer',
};

const paymentIntentIdField: FieldDef = {
  key: 'paymentIntentId',
  label: 'Payment intent ID',
  type: 'text',
  defaultValue: '',
  mono: true,
  section: 'entity-ids',
  placeholder: 'pi_',
  jsonPath: 'data.object.payment_intent',
};

const chargeIdField: FieldDef = {
  key: 'chargeId',
  label: 'Charge ID',
  type: 'text',
  defaultValue: '',
  mono: true,
  section: 'entity-ids',
  placeholder: 'ch_',
  jsonPath: 'data.object.id',
};

const subscriptionIdField: FieldDef = {
  key: 'subscriptionId',
  label: 'Subscription ID',
  type: 'text',
  defaultValue: '',
  mono: true,
  section: 'entity-ids',
  placeholder: 'sub_',
  jsonPath: 'data.object.subscription',
};

// Since 2025-03-31.basil the invoice links its subscription through `parent`.
const invoiceSubscriptionIdField: FieldDef = {
  ...subscriptionIdField,
  jsonPath: 'data.object.parent.subscription_details.subscription',
};

const paymentMethodIdField: FieldDef = {
  key: 'paymentMethodId',
  label: 'Payment method ID',
  type: 'text',
  defaultValue: '',
  mono: true,
  section: 'entity-ids',
  placeholder: 'pm_',
  jsonPath: 'data.object.payment_method',
};

const invoiceIdField: FieldDef = {
  key: 'invoiceId',
  label: 'Invoice ID',
  type: 'text',
  defaultValue: '',
  mono: true,
  section: 'entity-ids',
  placeholder: 'in_',
  jsonPath: 'data.object.id',
};

// The IDs every invoice lifecycle event accepts.
const invoiceEntityFields: FieldDef[] = [
  customerIdField,
  invoiceSubscriptionIdField,
  invoiceIdField,
];

// The subscription itself is data.object, so its ID is data.object.id.
const subscriptionEntityFields: FieldDef[] = [
  customerIdField,
  { ...subscriptionIdField, jsonPath: 'data.object.id' },
  { ...invoiceIdField, label: 'Latest invoice ID', jsonPath: 'data.object.latest_invoice' },
  { ...paymentMethodIdField, label: 'Default payment method ID', jsonPath: 'data.object.default_payment_method' },
];

// ─── Shared Event Options Fields ─────────────────────────────────────────────

const livemodeField: FieldDef = {
  key: 'livemode',
  label: 'Live mode',
  type: 'select',
  defaultValue: 'false',
  options: [
    { value: 'false', label: 'Test (false)' },
    { value: 'true', label: 'Live (true)' },
  ],
  section: 'event-options',
  coerceBoolean: true,
  jsonPath: 'livemode',
};

const apiVersionField: FieldDef = {
  key: 'apiVersion',
  label: 'API version',
  type: 'text',
  defaultValue: '',
  mono: true,
  description: 'Changes the version string on the event envelope. Payload structure reflects the current API version.',
  section: 'event-options',
  placeholder: '2026-09-30.endive',
  jsonPath: 'api_version',
};

// ─── Event Field Definitions ────────────────────────────────────────────────

export const EVENT_FIELDS: Record<StripeEventType, FieldDef[]> = {
  'payment_intent.succeeded': [
    amountField,
    currencyField,
    customerIdField,
    { ...paymentIntentIdField, jsonPath: 'data.object.id' },
    paymentMethodIdField,
    { ...chargeIdField, jsonPath: 'data.object.latest_charge' },
  ],
  'payment_intent.payment_failed': [
    amountField,
    currencyField,
    {
      key: 'declineCode',
      label: 'Decline code',
      type: 'select',
      defaultValue: 'generic_decline',
      options: DECLINE_CODE_OPTIONS,
      mono: true,
      jsonPath: 'data.object.last_payment_error.decline_code',
    },
    customerIdField,
    { ...paymentIntentIdField, jsonPath: 'data.object.id' },
    paymentMethodIdField,
  ],
  'payment_intent.requires_action': [
    amountField,
    currencyField,
    {
      key: 'nextActionType',
      label: 'Next action type',
      type: 'select',
      defaultValue: 'use_stripe_sdk',
      options: [
        { value: 'use_stripe_sdk', label: 'use_stripe_sdk' },
        { value: 'redirect_to_url', label: 'redirect_to_url' },
      ],
      mono: true,
      jsonPath: 'data.object.next_action.type',
    },
    {
      key: 'returnUrl',
      label: 'Return URL (redirect_to_url only)',
      type: 'text',
      defaultValue: '',
      mono: true,
      placeholder: 'https://example.com/checkout/complete',
      jsonPath: 'data.object.next_action.redirect_to_url.return_url',
    },
    customerIdField,
    { ...paymentIntentIdField, jsonPath: 'data.object.id' },
    paymentMethodIdField,
  ],
  'payment_intent.canceled': [
    amountField,
    currencyField,
    {
      key: 'cancellationReason',
      label: 'Cancellation reason',
      type: 'select',
      defaultValue: 'requested_by_customer',
      options: CANCELLATION_REASON_OPTIONS,
      mono: true,
      jsonPath: 'data.object.cancellation_reason',
    },
    customerIdField,
    { ...paymentIntentIdField, jsonPath: 'data.object.id' },
    paymentMethodIdField,
    { ...chargeIdField, label: 'Latest charge ID', jsonPath: 'data.object.latest_charge' },
  ],
  'charge.succeeded': [
    amountField,
    currencyField,
    {
      key: 'cardBrand',
      label: 'Card brand',
      type: 'select',
      defaultValue: 'visa',
      options: CARD_BRAND_OPTIONS,
      jsonPath: 'data.object.payment_method_details.card.brand',
    },
    {
      key: 'cardLast4',
      label: 'Card last 4',
      type: 'text',
      defaultValue: '4242',
      mono: true,
      jsonPath: 'data.object.payment_method_details.card.last4',
    },
    customerIdField,
    paymentIntentIdField,
    { ...chargeIdField, jsonPath: 'data.object.id' },
  ],
  'charge.failed': [
    amountField,
    currencyField,
    // No jsonPath: no single payload field holds the decline key. Card
    // declines put it in outcome.reason, other errors in failure_code, and a
    // Radar block (fraudulent) reports highest_risk_level.
    {
      key: 'declineCode',
      label: 'Decline code',
      type: 'select',
      defaultValue: 'generic_decline',
      options: DECLINE_CODE_OPTIONS,
      mono: true,
    },
    { ...cardBrandField, jsonPath: 'data.object.payment_method_details.card.brand' },
    { ...cardLast4Field, jsonPath: 'data.object.payment_method_details.card.last4' },
    customerIdField,
    paymentIntentIdField,
    paymentMethodIdField,
    { ...chargeIdField, jsonPath: 'data.object.id' },
  ],
  'charge.refunded': [
    amountField,
    currencyField,
    {
      key: 'refundAmount',
      label: 'Refund amount (cents, empty = full)',
      type: 'number',
      defaultValue: '',
      mono: true,
      jsonPath: 'data.object.amount_refunded',
    },
    customerIdField,
    paymentIntentIdField,
    { ...chargeIdField, jsonPath: 'data.object.id' },
  ],
  'refund.created': [
    { ...amountField, label: 'Refund amount (cents)' },
    currencyField,
    {
      key: 'status',
      label: 'Status',
      type: 'select',
      defaultValue: 'succeeded',
      options: [
        { value: 'succeeded', label: 'Succeeded' },
        { value: 'pending', label: 'Pending' },
      ],
      mono: true,
      jsonPath: 'data.object.status',
    },
    {
      key: 'pendingReason',
      label: 'Pending reason (pending only)',
      type: 'select',
      defaultValue: 'processing',
      options: [
        { value: 'processing', label: 'Processing' },
        { value: 'charge_pending', label: 'Charge pending' },
        { value: 'insufficient_funds', label: 'Insufficient funds' },
      ],
      mono: true,
      jsonPath: 'data.object.pending_reason',
    },
    {
      key: 'reason',
      label: 'Reason',
      type: 'select',
      defaultValue: '',
      options: REFUND_REASON_OPTIONS,
      mono: true,
      jsonPath: 'data.object.reason',
    },
    {
      key: 'refundId',
      label: 'Refund ID',
      type: 'text',
      defaultValue: '',
      mono: true,
      section: 'entity-ids',
      placeholder: 're_',
      jsonPath: 'data.object.id',
    },
    { ...chargeIdField, jsonPath: 'data.object.charge' },
    paymentIntentIdField,
    customerIdField,
    paymentMethodIdField,
  ],
  'invoice.upcoming': [
    invoiceAmountField,
    currencyField,
    {
      key: 'periodEnd',
      label: 'Renews at (Unix seconds, empty = in 7 days)',
      type: 'number',
      defaultValue: '',
      mono: true,
      jsonPath: 'data.object.period_end',
    },
    // The preview invoice has no ID yet.
    customerIdField,
    invoiceSubscriptionIdField,
  ],
  'invoice.created': [
    invoiceAmountField,
    currencyField,
    {
      key: 'billingReason',
      label: 'Billing reason',
      type: 'select',
      defaultValue: 'subscription_cycle',
      options: BILLING_REASON_OPTIONS,
      jsonPath: 'data.object.billing_reason',
    },
    customerIdField,
    invoiceSubscriptionIdField,
  ],
  'invoice.finalized': [
    invoiceAmountField,
    currencyField,
    billingReasonField(['subscription_cycle', 'subscription_create', 'subscription_update'], 'subscription_cycle'),
    collectionMethodField,
    {
      key: 'dueDate',
      label: 'Due date (Unix seconds, send_invoice only, empty = in 30 days)',
      type: 'number',
      defaultValue: '',
      mono: true,
      jsonPath: 'data.object.due_date',
    },
    ...invoiceEntityFields,
  ],
  'invoice.paid': [
    invoiceAmountField,
    currencyField,
    customerIdField,
    invoiceSubscriptionIdField,
  ],
  'invoice.payment_failed': [
    invoiceAmountField,
    currencyField,
    {
      key: 'attemptCount',
      label: 'Attempt count',
      type: 'number',
      defaultValue: 1,
      mono: true,
      jsonPath: 'data.object.attempt_count',
    },
    customerIdField,
    invoiceSubscriptionIdField,
  ],
  'invoice.payment_action_required': [
    invoiceAmountField,
    currencyField,
    billingReasonField(['subscription_create', 'subscription_cycle'], 'subscription_create'),
    {
      key: 'attemptCount',
      label: 'Attempt count',
      type: 'number',
      defaultValue: 1,
      mono: true,
      jsonPath: 'data.object.attempt_count',
    },
    ...invoiceEntityFields,
  ],
  'invoice.payment_succeeded': [
    invoiceAmountField,
    currencyField,
    customerIdField,
    invoiceSubscriptionIdField,
  ],
  'invoice_payment.paid': [
    { ...amountField, label: 'Amount requested (cents)', jsonPath: 'data.object.amount_requested' },
    {
      key: 'amountPaid',
      label: 'Amount paid (cents, empty = amount requested)',
      type: 'number',
      defaultValue: '',
      mono: true,
      jsonPath: 'data.object.amount_paid',
    },
    currencyField,
    {
      key: 'paymentType',
      label: 'Paid by',
      type: 'select',
      defaultValue: 'payment_intent',
      options: [
        { value: 'payment_intent', label: 'PaymentIntent' },
        { value: 'charge', label: 'Charge without a PaymentIntent' },
      ],
      jsonPath: 'data.object.payment.type',
    },
    {
      key: 'isDefault',
      label: 'Default invoice payment',
      type: 'select',
      defaultValue: 'true',
      options: YES_NO_OPTIONS,
      coerceBoolean: true,
      jsonPath: 'data.object.is_default',
    },
    { ...invoiceIdField, jsonPath: 'data.object.invoice' },
    { ...paymentIntentIdField, jsonPath: 'data.object.payment.payment_intent' },
    { ...chargeIdField, label: 'Charge ID (charge only)', jsonPath: 'data.object.payment.charge' },
    {
      key: 'invoicePaymentId',
      label: 'Invoice payment ID',
      type: 'text',
      defaultValue: '',
      mono: true,
      section: 'entity-ids',
      placeholder: 'inpay_',
      jsonPath: 'data.object.id',
    },
  ],
  'invoice.overdue': [
    invoiceAmountField,
    currencyField,
    {
      key: 'dueDate',
      label: 'Due date (Unix seconds, empty = 1 day ago)',
      type: 'number',
      defaultValue: '',
      mono: true,
      jsonPath: 'data.object.due_date',
    },
    billingReasonField(['subscription_cycle', 'subscription_create'], 'subscription_cycle'),
    ...invoiceEntityFields,
  ],
  'invoice.marked_uncollectible': [
    invoiceAmountField,
    currencyField,
    {
      key: 'reason',
      label: 'Uncollectible reason',
      type: 'select',
      // The generator's default follows the collection method.
      defaultValue: '',
      options: [
        { value: '', label: 'Default for the collection method' },
        ...INVOICE_UNCOLLECTIBLE_REASON_OPTIONS,
      ],
      mono: true,
      jsonPath: 'data.object.status_details.uncollectible.reason',
    },
    collectionMethodField,
    {
      key: 'attemptCount',
      label: 'Attempt count (empty = 4, or 0 for send_invoice)',
      type: 'number',
      defaultValue: '',
      mono: true,
      jsonPath: 'data.object.attempt_count',
    },
    ...invoiceEntityFields,
  ],
  'invoice.voided': [
    invoiceAmountField,
    currencyField,
    billingReasonField(['subscription_create', 'subscription_cycle', 'subscription_update'], 'subscription_create'),
    collectionMethodField,
    {
      key: 'attemptCount',
      label: 'Attempt count (empty = 1, or 0 for send_invoice)',
      type: 'number',
      defaultValue: '',
      mono: true,
      jsonPath: 'data.object.attempt_count',
    },
    ...invoiceEntityFields,
  ],
  'customer.subscription.created': [
    priceAmountField,
    currencyField,
    intervalField,
    {
      key: 'status',
      label: 'Status',
      type: 'select',
      defaultValue: 'active',
      options: SUBSCRIPTION_STATUS_OPTIONS,
      jsonPath: 'data.object.status',
    },
    customerIdField,
  ],
  'customer.subscription.trial_will_end': [
    priceAmountField,
    currencyField,
    intervalField,
    {
      key: 'trialPeriodDays',
      label: 'Trial length (days)',
      type: 'number',
      defaultValue: 14,
      mono: true,
    },
    {
      key: 'missingPaymentMethod',
      label: 'If the trial ends without a payment method',
      type: 'select',
      defaultValue: 'create_invoice',
      options: [
        { value: 'create_invoice', label: 'Create invoice' },
        { value: 'pause', label: 'Pause' },
        { value: 'cancel', label: 'Cancel' },
      ],
      mono: true,
      jsonPath: 'data.object.trial_settings.end_behavior.missing_payment_method',
    },
    ...subscriptionEntityFields,
  ],
  'customer.subscription.updated': [
    {
      key: 'status',
      label: 'New status',
      type: 'select',
      defaultValue: 'past_due',
      options: SUBSCRIPTION_STATUS_OPTIONS,
      jsonPath: 'data.object.status',
    },
    {
      key: 'previousStatus',
      label: 'Previous status',
      type: 'select',
      defaultValue: 'active',
      options: SUBSCRIPTION_STATUS_OPTIONS,
      jsonPath: 'data.previous_attributes.status',
    },
    {
      key: 'cancelAtPeriodEnd',
      label: 'Cancel at period end',
      type: 'select',
      defaultValue: 'false',
      options: [
        { value: 'false', label: 'No' },
        { value: 'true', label: 'Yes' },
      ],
      coerceBoolean: true,
      jsonPath: 'data.object.cancel_at_period_end',
    },
    customerIdField,
  ],
  'customer.subscription.paused': [
    pauseReasonField,
    priceAmountField,
    currencyField,
    intervalField,
    ...subscriptionEntityFields,
  ],
  'customer.subscription.resumed': [
    pauseReasonField,
    {
      key: 'pausedAt',
      label: 'Paused at (Unix seconds, empty = 7 days ago)',
      type: 'number',
      defaultValue: '',
      mono: true,
      jsonPath: 'data.object.status_details.paused.transitioned_at',
    },
    priceAmountField,
    currencyField,
    intervalField,
    ...subscriptionEntityFields,
  ],
  'customer.subscription.deleted': [
    customerIdField,
  ],
  'checkout.session.completed': [
    { ...amountField, jsonPath: 'data.object.amount_total' },
    currencyField,
    {
      key: 'mode',
      label: 'Checkout mode',
      type: 'select',
      defaultValue: 'payment',
      options: CHECKOUT_MODE_OPTIONS,
      jsonPath: 'data.object.mode',
    },
    customerIdField,
    paymentIntentIdField,
    subscriptionIdField,
  ],
  'checkout.session.async_payment_succeeded': asyncCheckoutFields(),
  'checkout.session.async_payment_failed': asyncCheckoutFields(),
  'checkout.session.expired': [
    {
      key: 'mode',
      label: 'Checkout mode',
      type: 'select',
      defaultValue: 'payment',
      options: CHECKOUT_MODE_OPTIONS,
      jsonPath: 'data.object.mode',
    },
  ],
  'customer.created': [
    {
      key: 'email',
      label: 'Email',
      type: 'text',
      defaultValue: 'jane@example.com',
      jsonPath: 'data.object.email',
    },
    {
      key: 'name',
      label: 'Name',
      type: 'text',
      defaultValue: 'Jane Doe',
      jsonPath: 'data.object.name',
    },
  ],
  'customer.updated': [
    {
      key: 'email',
      label: 'Email',
      type: 'text',
      defaultValue: 'jane.new@example.com',
      jsonPath: 'data.object.email',
    },
    {
      key: 'previousEmail',
      label: 'Previous email',
      type: 'text',
      defaultValue: 'jane@example.com',
      jsonPath: 'data.previous_attributes.email',
    },
    {
      key: 'name',
      label: 'Name',
      type: 'text',
      defaultValue: 'Jane Doe',
      jsonPath: 'data.object.name',
    },
    { ...customerIdField, jsonPath: 'data.object.id' },
  ],
  'customer.deleted': [
    {
      key: 'email',
      label: 'Email',
      type: 'text',
      defaultValue: 'jane@example.com',
      jsonPath: 'data.object.email',
    },
    {
      key: 'name',
      label: 'Name',
      type: 'text',
      defaultValue: 'Jane Doe',
      jsonPath: 'data.object.name',
    },
    {
      ...currencyField,
      // Stripe sets a customer's currency once it is first billed.
      defaultValue: '',
      options: [{ value: '', label: 'None (never billed)' }, ...CURRENCY_OPTIONS],
    },
    { ...customerIdField, jsonPath: 'data.object.id' },
  ],
  'payment_method.attached': [
    {
      key: 'type',
      label: 'Type',
      type: 'select',
      defaultValue: 'card',
      options: SAVED_PAYMENT_METHOD_TYPE_OPTIONS,
      jsonPath: 'data.object.type',
    },
    cardBrandField,
    cardLast4Field,
    {
      key: 'cardExpMonth',
      label: 'Card exp month',
      type: 'number',
      defaultValue: 12,
      mono: true,
      jsonPath: 'data.object.card.exp_month',
    },
    {
      key: 'cardExpYear',
      label: 'Card exp year',
      type: 'number',
      defaultValue: CURRENT_YEAR + 3,
      mono: true,
      jsonPath: 'data.object.card.exp_year',
    },
    {
      key: 'allowRedisplay',
      label: 'Allow redisplay',
      type: 'select',
      defaultValue: 'unspecified',
      options: [
        { value: 'unspecified', label: 'Unspecified' },
        { value: 'always', label: 'Always' },
        { value: 'limited', label: 'Limited' },
      ],
      mono: true,
      jsonPath: 'data.object.allow_redisplay',
    },
    customerIdField,
    { ...paymentMethodIdField, jsonPath: 'data.object.id' },
  ],
  'setup_intent.succeeded': [
    {
      key: 'paymentMethodType',
      label: 'Payment method type',
      type: 'select',
      defaultValue: 'card',
      options: SAVED_PAYMENT_METHOD_TYPE_OPTIONS,
      jsonPath: 'data.object.payment_method_types.0',
    },
    {
      key: 'usage',
      label: 'Usage',
      type: 'select',
      defaultValue: 'off_session',
      options: [
        { value: 'off_session', label: 'Off session' },
        { value: 'on_session', label: 'On session' },
      ],
      mono: true,
      jsonPath: 'data.object.usage',
    },
    {
      key: 'setupIntentId',
      label: 'Setup intent ID',
      type: 'text',
      defaultValue: '',
      mono: true,
      section: 'entity-ids',
      placeholder: 'seti_',
      jsonPath: 'data.object.id',
    },
    customerIdField,
    paymentMethodIdField,
  ],
  'payment_method.automatically_updated': [
    cardBrandField,
    {
      key: 'previousCardLast4',
      label: 'Previous last 4',
      type: 'text',
      defaultValue: '4242',
      mono: true,
      // Present only when the card number changed.
      jsonPath: 'data.previous_attributes.card.last4',
    },
    {
      ...cardLast4Field,
      label: 'New last 4',
      defaultValue: '',
      placeholder: 'Same as previous',
      description: 'Leave empty for an expiry-only update.',
    },
    {
      key: 'previousCardExpMonth',
      label: 'Previous exp month',
      type: 'number',
      defaultValue: CURRENT_MONTH,
      mono: true,
      jsonPath: 'data.previous_attributes.card.exp_month',
    },
    {
      key: 'previousCardExpYear',
      label: 'Previous exp year',
      type: 'number',
      defaultValue: CURRENT_YEAR,
      mono: true,
      jsonPath: 'data.previous_attributes.card.exp_year',
    },
    {
      key: 'cardExpMonth',
      label: 'New exp month (empty = same month)',
      type: 'number',
      defaultValue: '',
      mono: true,
      jsonPath: 'data.object.card.exp_month',
    },
    {
      key: 'cardExpYear',
      label: 'New exp year (empty = 3 years later)',
      type: 'number',
      defaultValue: '',
      mono: true,
      jsonPath: 'data.object.card.exp_year',
    },
    customerIdField,
    { ...paymentMethodIdField, jsonPath: 'data.object.id' },
  ],
  'radar.early_fraud_warning.created': [
    {
      key: 'fraudType',
      label: 'Fraud type',
      type: 'select',
      defaultValue: 'unauthorized_use_of_card',
      options: FRAUD_TYPE_OPTIONS,
      mono: true,
      jsonPath: 'data.object.fraud_type',
    },
    {
      key: 'actionable',
      label: 'Actionable',
      type: 'select',
      defaultValue: 'true',
      options: [
        { value: 'true', label: 'Yes' },
        { value: 'false', label: 'No, already disputed or fully refunded' },
      ],
      coerceBoolean: true,
      jsonPath: 'data.object.actionable',
    },
    {
      key: 'earlyFraudWarningId',
      label: 'Early fraud warning ID',
      type: 'text',
      defaultValue: '',
      mono: true,
      section: 'entity-ids',
      placeholder: 'issfr_',
      jsonPath: 'data.object.id',
    },
    { ...chargeIdField, jsonPath: 'data.object.charge' },
    paymentIntentIdField,
  ],
  'charge.dispute.created': [
    amountField,
    currencyField,
    {
      key: 'reason',
      label: 'Dispute reason',
      type: 'select',
      defaultValue: 'fraudulent',
      options: DISPUTE_REASON_OPTIONS,
      jsonPath: 'data.object.reason',
    },
    { ...chargeIdField, jsonPath: 'data.object.charge' },
  ],
  'charge.dispute.updated': [
    amountField,
    currencyField,
    {
      key: 'status',
      label: 'New status',
      type: 'select',
      defaultValue: 'under_review',
      options: DISPUTE_OPEN_STATUS_OPTIONS,
      mono: true,
      jsonPath: 'data.object.status',
    },
    {
      key: 'previousStatus',
      label: 'Previous status',
      type: 'select',
      defaultValue: 'needs_response',
      options: DISPUTE_OPEN_STATUS_OPTIONS,
      mono: true,
      jsonPath: 'data.previous_attributes.status',
    },
    { ...chargeIdField, jsonPath: 'data.object.charge' },
  ],
  'charge.dispute.closed': [
    amountField,
    currencyField,
    {
      key: 'status',
      label: 'Outcome',
      type: 'select',
      defaultValue: 'won',
      options: DISPUTE_STATUS_OPTIONS,
      jsonPath: 'data.object.status',
    },
    { ...chargeIdField, jsonPath: 'data.object.charge' },
  ],
};

export function getFieldsForEvent(type: StripeEventType): FieldDef[] {
  const fields = EVENT_FIELDS[type];
  if (!fields) return [];
  return [...fields, livemodeField, apiVersionField];
}
