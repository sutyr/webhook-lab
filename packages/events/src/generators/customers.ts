// Copyright 2026 Sutyr Inc. SPDX-License-Identifier: Apache-2.0
import type {
  StripeCustomer,
  StripeEvent,
  CustomerCreatedOptions,
  CustomerUpdatedOptions,
} from '../types/index.js';
import { wrapInEvent } from './envelope.js';
import { customerId } from '../utils/ids.js';
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
