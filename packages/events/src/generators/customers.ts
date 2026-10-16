// Copyright 2026 Sutyr Inc. SPDX-License-Identifier: Apache-2.0
import type {
  StripeCustomer,
  StripeEvent,
  CustomerCreatedOptions,
  CustomerUpdatedOptions,
} from '../types/index.js';
import type { CustomerDeletedOptions, StripeCustomerDetailed } from '../types/subscriptions.js';
import { wrapInEvent } from './envelope.js';
import { customerId, generateId } from '../utils/ids.js';
import { now } from '../utils/timestamps.js';

// ─── Helpers ────────────────────────────────────────────────────────────────

function generateInvoicePrefix(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < 8; i++) {
    result += chars[Math.floor(Math.random() * chars.length)];
  }
  return result;
}

// ─── customer.created ───────────────────────────────────────────────────────

export function customerCreated(
  options?: CustomerCreatedOptions,
): StripeEvent<StripeCustomer> {
  const ts = options?.timestamp ?? now();

  const customer: StripeCustomer = {
    id: customerId(),
    object: 'customer',
    email: options?.email ?? 'jane@example.com',
    name: options?.name ?? 'Jane Doe',
    phone: null,
    balance: 0,
    currency: null,
    delinquent: false,
    description: null,
    invoice_prefix: generateInvoicePrefix(),
    invoice_settings: {
      default_payment_method: null,
    },
    metadata: options?.metadata ?? {},
    created: ts,
    livemode: false,
  };

  return wrapInEvent('customer.created', customer, { timestamp: ts });
}

// ─── customer.updated ───────────────────────────────────────────────────────

export function customerUpdated(
  options?: CustomerUpdatedOptions,
): StripeEvent<StripeCustomer> {
  const ts = options?.timestamp ?? now();
  const cusId = options?.customerId ?? customerId();
  const newEmail = options?.email ?? 'jane.new@example.com';
  const previousEmail = options?.previousEmail ?? 'jane@example.com';

  const customer: StripeCustomer = {
    id: cusId,
    object: 'customer',
    email: newEmail,
    name: options?.name ?? 'Jane Doe',
    phone: null,
    balance: 0,
    currency: null,
    delinquent: false,
    description: null,
    invoice_prefix: generateInvoicePrefix(),
    invoice_settings: {
      default_payment_method: null,
    },
    metadata: options?.metadata ?? {},
    created: ts,
    livemode: false,
  };

  return wrapInEvent('customer.updated', customer, {
    timestamp: ts,
    previousAttributes: { email: previousEmail },
  });
}

// ─── customer.deleted ───────────────────────────────────────────────────────
// data.object is the full Customer as it stood when deleted, not the
// `{ id, object, deleted: true }` stub that the delete endpoint returns. It
// carries every field Stripe returns by default at 2026-09-30.endive.

const CUSTOMER_AGE_SECONDS = 90 * 86400;

export function customerDeleted(
  options?: CustomerDeletedOptions,
): StripeEvent<StripeCustomerDetailed> {
  const ts = options?.timestamp ?? now();

  const customer: StripeCustomerDetailed = {
    id: options?.customerId ?? customerId(),
    object: 'customer',
    address: null,
    balance: 0,
    // The customer existed before it was deleted.
    created: ts - CUSTOMER_AGE_SECONDS,
    currency: options?.currency ?? null,
    customer_account: null,
    default_source: null,
    delinquent: false,
    description: null,
    discount: null,
    email: options?.email !== undefined ? options.email : 'jane@example.com',
    invoice_prefix: generateInvoicePrefix(),
    invoice_settings: {
      custom_fields: null,
      default_payment_method: null,
      footer: null,
      rendering_options: null,
    },
    livemode: false,
    metadata: options?.metadata ?? {},
    name: options?.name !== undefined ? options.name : 'Jane Doe',
    next_invoice_sequence: 1,
    phone: null,
    preferred_locales: [],
    shipping: null,
    tax_exempt: 'none',
    test_clock: null,
  };

  // A customer is deleted only through the API or the Dashboard, so the event
  // names the request that deleted it.
  return wrapInEvent('customer.deleted', customer, {
    timestamp: ts,
    requestId: generateId('req_', 14),
  });
}
