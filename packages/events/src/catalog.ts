// Copyright 2026 Sutyr Inc. SPDX-License-Identifier: Apache-2.0
import type { EventCatalogEntry } from './types/index.js';

export const EVENT_CATALOG: EventCatalogEntry[] = [
  // Payments
  {
    type: 'payment_intent.succeeded',
    category: 'payments',
    name: 'Payment Intent Succeeded',
    description: 'A payment intent has been successfully completed.',
  },
  {
    type: 'payment_intent.payment_failed',
    category: 'payments',
    name: 'Payment Intent Failed',
    description:
      'Payment failed. Decline reason at last_payment_error.decline_code.',
  },
  {
    type: 'charge.succeeded',
    category: 'payments',
    name: 'Charge Succeeded',
    description: 'A charge has been successfully created and funds captured.',
  },
  {
    type: 'charge.refunded',
    category: 'payments',
    name: 'Charge Refunded',
    description: 'A charge has been refunded, either partially or fully.',
  },

  // Billing
  {
    type: 'invoice.created',
    category: 'billing',
    name: 'Invoice Created',
    description: 'A new invoice has been created, typically from a subscription cycle.',
  },
  {
    type: 'invoice.paid',
    category: 'billing',
    name: 'Invoice Paid',
    description: 'An invoice has transitioned to paid status.',
  },
  {
    type: 'invoice.payment_failed',
    category: 'billing',
    name: 'Invoice Payment Failed',
    description:
      'Invoice payment failed. Decline code lives on the linked PaymentIntent, not the invoice.',
  },
  {
    type: 'invoice.payment_succeeded',
    category: 'billing',
    name: 'Invoice Payment Succeeded',
    description:
      'A payment attempt on an invoice has succeeded. Distinct from invoice.paid, which fires on status transition.',
  },

  // Subscriptions
  {
    type: 'customer.subscription.created',
    category: 'subscriptions',
    name: 'Subscription Created',
    description: 'A new subscription has been created for a customer.',
  },
  {
    type: 'customer.subscription.updated',
    category: 'subscriptions',
    name: 'Subscription Updated',
    description:
      'A subscription has been updated. Check previous_attributes for what changed.',
  },
  {
    type: 'customer.subscription.deleted',
    category: 'subscriptions',
    name: 'Subscription Deleted',
    description: 'A subscription has been canceled and is no longer active.',
  },

  // Checkout
  {
    type: 'checkout.session.completed',
    category: 'checkout',
    name: 'Checkout Session Completed',
    description: 'A checkout session has been successfully completed by the customer.',
  },
  {
    type: 'checkout.session.expired',
    category: 'checkout',
    name: 'Checkout Session Expired',
    description: 'A checkout session has expired before the customer completed it.',
  },

  // Customers
  {
    type: 'customer.created',
    category: 'customers',
    name: 'Customer Created',
    description: 'A new customer object has been created.',
  },
  {
    type: 'customer.updated',
    category: 'customers',
    name: 'Customer Updated',
    description:
      'A customer object has been updated. Check previous_attributes for what changed.',
  },

  // Disputes
  {
    type: 'charge.dispute.created',
    category: 'disputes',
    name: 'Dispute Created',
    description: 'A dispute has been filed against a charge. Evidence is due within 21 days.',
  },
  {
    type: 'charge.dispute.updated',
    category: 'disputes',
    name: 'Dispute Updated',
    description: 'A dispute has been updated, typically moving to under_review after evidence submission.',
  },
  {
    type: 'charge.dispute.closed',
    category: 'disputes',
    name: 'Dispute Closed',
    description: 'A dispute has been resolved as won or lost.',
  },
];

export const SCENARIO_CATALOG = [
  {
    id: 'subscription-happy-path',
    name: 'Subscription Happy Path',
    description:
      'Complete successful subscription lifecycle: customer created, subscription started, first invoice paid.',
    stepCount: 7,
  },
  {
    id: 'subscription-failure',
    name: 'Failed Payment Dunning',
    description:
      'Payment failure cascade: invoice fails, subscription goes past_due, second attempt fails, subscription canceled.',
    stepCount: 7,
  },
  {
    id: 'checkout-flow',
    name: 'Checkout Flow',
    description:
      'One-time checkout: session completed, payment intent succeeded, charge created.',
    stepCount: 3,
  },
  {
    id: 'dispute-lifecycle',
    name: 'Dispute Lifecycle',
    description:
      'Full dispute flow: charge created, dispute filed, evidence submitted, dispute resolved.',
    stepCount: 4,
  },
  {
    id: 'refund-flow',
    name: 'Refund Flow',
    description: 'Simple refund: charge succeeded, then fully refunded.',
    stepCount: 2,
  },
] as const;
