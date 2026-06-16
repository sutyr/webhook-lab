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
];

const DISPUTE_STATUS_OPTIONS = [
  { value: 'won', label: 'Won' },
  { value: 'lost', label: 'Lost' },
];

const SUBSCRIPTION_STATUS_OPTIONS = [
  { value: 'active', label: 'Active' },
  { value: 'past_due', label: 'Past due' },
  { value: 'canceled', label: 'Canceled' },
  { value: 'unpaid', label: 'Unpaid' },
  { value: 'trialing', label: 'Trialing' },
  { value: 'incomplete', label: 'Incomplete' },
  { value: 'paused', label: 'Paused' },
];

const BILLING_REASON_OPTIONS = [
  { value: 'subscription_cycle', label: 'Subscription cycle' },
  { value: 'subscription_create', label: 'Subscription create' },
  { value: 'subscription_update', label: 'Subscription update' },
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
  label: 'Payment Intent ID',
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

const paymentMethodIdField: FieldDef = {
  key: 'paymentMethodId',
  label: 'Payment Method ID',
  type: 'text',
  defaultValue: '',
  mono: true,
  section: 'entity-ids',
  placeholder: 'pm_',
  jsonPath: 'data.object.payment_method',
};

// ─── Shared Event Options Fields ─────────────────────────────────────────────

const livemodeField: FieldDef = {
  key: 'livemode',
  label: 'Live Mode',
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
  label: 'API Version',
  type: 'text',
  defaultValue: '',
  mono: true,
  description: 'Changes the version string on the event envelope. Payload structure reflects the current API version.',
  section: 'event-options',
  placeholder: '2025-10-29.clover',
  jsonPath: 'api_version',
};

// ─── Event Field Definitions ────────────────────────────────────────────────

export const EVENT_FIELDS: Partial<Record<StripeEventType, FieldDef[]>> = {
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
      label: 'Decline Code',
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
  'charge.succeeded': [
    amountField,
    currencyField,
    {
      key: 'cardBrand',
      label: 'Card Brand',
      type: 'select',
      defaultValue: 'visa',
      options: CARD_BRAND_OPTIONS,
      jsonPath: 'data.object.payment_method_details.card.brand',
    },
    {
      key: 'cardLast4',
      label: 'Card Last 4',
      type: 'text',
      defaultValue: '4242',
      mono: true,
      jsonPath: 'data.object.payment_method_details.card.last4',
    },
    customerIdField,
    paymentIntentIdField,
    { ...chargeIdField, jsonPath: 'data.object.id' },
  ],
  'charge.refunded': [
    amountField,
    currencyField,
    {
      key: 'refundAmount',
      label: 'Refund Amount (cents, empty = full)',
      type: 'number',
      defaultValue: '',
      mono: true,
      jsonPath: 'data.object.refunds.data.0.amount',
    },
    customerIdField,
    paymentIntentIdField,
    { ...chargeIdField, jsonPath: 'data.object.id' },
  ],
  'invoice.created': [
    amountField,
    currencyField,
    {
      key: 'billingReason',
      label: 'Billing Reason',
      type: 'select',
      defaultValue: 'subscription_cycle',
      options: BILLING_REASON_OPTIONS,
      jsonPath: 'data.object.billing_reason',
    },
    customerIdField,
    subscriptionIdField,
  ],
  'invoice.paid': [
    amountField,
    currencyField,
    customerIdField,
    subscriptionIdField,
  ],
  'invoice.payment_failed': [
    amountField,
    currencyField,
    {
      key: 'attemptCount',
      label: 'Attempt Count',
      type: 'number',
      defaultValue: 1,
      mono: true,
      jsonPath: 'data.object.attempt_count',
    },
    customerIdField,
    subscriptionIdField,
  ],
  'invoice.payment_succeeded': [
    amountField,
    currencyField,
    customerIdField,
    subscriptionIdField,
  ],
  'customer.subscription.created': [
    {
      key: 'priceAmount',
      label: 'Price Amount (cents)',
      type: 'number',
      defaultValue: 2999,
      mono: true,
      jsonPath: 'data.object.items.data.0.price.unit_amount',
    },
    currencyField,
    {
      key: 'interval',
      label: 'Billing Interval',
      type: 'select',
      defaultValue: 'month',
      options: INTERVAL_OPTIONS,
      jsonPath: 'data.object.items.data.0.price.recurring.interval',
    },
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
  'customer.subscription.updated': [
    {
      key: 'status',
      label: 'New Status',
      type: 'select',
      defaultValue: 'past_due',
      options: SUBSCRIPTION_STATUS_OPTIONS,
      jsonPath: 'data.object.status',
    },
    {
      key: 'previousStatus',
      label: 'Previous Status',
      type: 'select',
      defaultValue: 'active',
      options: SUBSCRIPTION_STATUS_OPTIONS,
      jsonPath: 'data.previous_attributes.status',
    },
    {
      key: 'cancelAtPeriodEnd',
      label: 'Cancel at Period End',
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
  'customer.subscription.deleted': [
    customerIdField,
  ],
  'checkout.session.completed': [
    { ...amountField, jsonPath: 'data.object.amount_total' },
    currencyField,
    {
      key: 'mode',
      label: 'Checkout Mode',
      type: 'select',
      defaultValue: 'payment',
      options: CHECKOUT_MODE_OPTIONS,
      jsonPath: 'data.object.mode',
    },
    customerIdField,
    paymentIntentIdField,
    subscriptionIdField,
  ],
  'checkout.session.expired': [
    {
      key: 'mode',
      label: 'Checkout Mode',
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
      defaultValue: 'jane@example.com',
      jsonPath: 'data.object.email',
    },
    {
      key: 'previousEmail',
      label: 'Previous Email',
      type: 'text',
      defaultValue: 'old@example.com',
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
  'charge.dispute.created': [
    amountField,
    currencyField,
    {
      key: 'reason',
      label: 'Dispute Reason',
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
      key: 'reason',
      label: 'Dispute Reason',
      type: 'select',
      defaultValue: 'fraudulent',
      options: DISPUTE_REASON_OPTIONS,
      jsonPath: 'data.object.reason',
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
