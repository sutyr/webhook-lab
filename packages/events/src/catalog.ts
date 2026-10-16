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
    type: 'payment_intent.requires_action',
    category: 'payments',
    name: 'Payment Intent Requires Action',
    description:
      'Sent when a payment needs the customer to finish a step such as 3D Secure. Handlers usually ask the customer to come back and authenticate.',
  },
  {
    type: 'payment_intent.canceled',
    category: 'payments',
    name: 'Payment Intent Canceled',
    description:
      'Sent when a PaymentIntent is canceled before it completes. Handlers usually release held stock and mark the order as unpaid.',
  },
  {
    type: 'charge.succeeded',
    category: 'payments',
    name: 'Charge Succeeded',
    description: 'A charge has been successfully created and funds captured.',
  },
  {
    type: 'charge.failed',
    category: 'payments',
    name: 'Charge Failed',
    description:
      'Sent when a charge is declined or blocked. The reason is in failure_code and outcome.reason, because a Charge has no decline_code field.',
  },
  {
    type: 'charge.refunded',
    category: 'payments',
    name: 'Charge Refunded',
    description: 'A charge has been refunded, either partially or fully.',
  },
  {
    type: 'refund.created',
    category: 'payments',
    name: 'Refund Created',
    description:
      'Sent when a refund is created for a payment. Handlers usually record the refund and let the customer know it is on the way.',
  },

  // Billing
  {
    type: 'invoice.upcoming',
    category: 'billing',
    name: 'Invoice Upcoming',
    description:
      'Sent a few days before a subscription renews, with a preview invoice that has no ID. Handlers can add items or let the customer know.',
  },
  {
    type: 'invoice.created',
    category: 'billing',
    name: 'Invoice Created',
    description: 'A new invoice has been created, typically from a subscription cycle.',
  },
  {
    type: 'invoice.finalized',
    category: 'billing',
    name: 'Invoice Finalized',
    description:
      'Sent when a draft invoice is finalized and open for payment, so handlers can record its number or send it to the customer.',
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
    type: 'invoice.payment_action_required',
    category: 'billing',
    name: 'Invoice Payment Action Required',
    description:
      'Sent when a subscription payment needs customer authentication such as 3D Secure, so handlers can ask the customer to complete it.',
  },
  {
    type: 'invoice.payment_succeeded',
    category: 'billing',
    name: 'Invoice Payment Succeeded',
    description:
      'A payment attempt on an invoice has succeeded. Distinct from invoice.paid, which fires on status transition.',
  },
  {
    type: 'invoice_payment.paid',
    category: 'billing',
    name: 'Invoice Payment Paid',
    description:
      'Sent when a payment on an invoice succeeds. payment.payment_intent links the invoice to its PaymentIntent so handlers can reconcile the two.',
  },
  {
    type: 'invoice.overdue',
    category: 'billing',
    name: 'Invoice Overdue',
    description:
      'Sent some days after a send_invoice invoice passes its due date unpaid, so handlers can remind the customer or limit access.',
  },
  {
    type: 'invoice.marked_uncollectible',
    category: 'billing',
    name: 'Invoice Marked Uncollectible',
    description:
      'Sent when an invoice is marked uncollectible, with the reason in status_details.uncollectible.reason, so handlers can write it off or limit access.',
  },
  {
    type: 'invoice.voided',
    category: 'billing',
    name: 'Invoice Voided',
    description:
      'Sent when a finalized invoice is voided and can no longer be paid, so handlers can stop collecting it and update their records.',
  },

  // Subscriptions
  {
    type: 'customer.subscription.created',
    category: 'subscriptions',
    name: 'Subscription Created',
    description: 'A new subscription has been created for a customer.',
  },
  {
    type: 'customer.subscription.trial_will_end',
    category: 'subscriptions',
    name: 'Subscription Trial Will End',
    description:
      'Sent three days before a trial ends, or right away when a trial is ended early, so a handler can check for a payment method and remind the customer.',
  },
  {
    type: 'customer.subscription.updated',
    category: 'subscriptions',
    name: 'Subscription Updated',
    description:
      'A subscription has been updated. Check previous_attributes for what changed.',
  },
  {
    type: 'customer.subscription.paused',
    category: 'subscriptions',
    name: 'Subscription Paused',
    description:
      "Sent when a subscription's status becomes paused, such as a trial ending without a payment method, so a handler can turn off access.",
  },
  {
    type: 'customer.subscription.resumed',
    category: 'subscriptions',
    name: 'Subscription Resumed',
    description:
      'Sent when a paused subscription becomes active again, so a handler can restore access.',
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
    type: 'checkout.session.async_payment_succeeded',
    category: 'checkout',
    name: 'Checkout Session Async Payment Succeeded',
    description:
      'Sent when a delayed Checkout payment such as ACH or SEPA Direct Debit settles. Handlers usually fulfill the order they were holding.',
  },
  {
    type: 'checkout.session.async_payment_failed',
    category: 'checkout',
    name: 'Checkout Session Async Payment Failed',
    description:
      'Sent when a delayed Checkout payment such as ACH or SEPA Direct Debit fails after the session completed. Handlers usually cancel the held order and ask the customer to pay again.',
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
  {
    type: 'customer.deleted',
    category: 'customers',
    name: 'Customer Deleted',
    description:
      'Sent when a customer is deleted, with the full customer in data.object, so a handler can archive or remove its local record.',
  },

  // Payment methods
  {
    type: 'payment_method.attached',
    category: 'payment_methods',
    name: 'Payment Method Attached',
    description:
      'Sent when a payment method is attached to a customer. Handlers usually store it or make it the default for future invoices.',
  },
  {
    type: 'setup_intent.succeeded',
    category: 'payment_methods',
    name: 'Setup Intent Succeeded',
    description:
      "Sent when a SetupIntent saves a payment method for later charges. Handlers usually record it as the customer's default.",
  },
  {
    type: 'payment_method.automatically_updated',
    category: 'payment_methods',
    name: 'Payment Method Automatically Updated',
    description:
      "Sent when the card network replaces a saved card's expiry date or number. Handlers usually refresh the card details they store.",
  },

  // Disputes and fraud
  {
    type: 'radar.early_fraud_warning.created',
    category: 'disputes',
    name: 'Early Fraud Warning Created',
    description:
      'Sent when a card issuer flags a charge as likely fraud, often before any dispute. Handlers usually review the charge and may refund it to head off a dispute.',
  },
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
  {
    id: 'trial-conversion',
    name: 'Trial Conversion',
    description:
      'Free trial converts to paid: subscription created trialing, trial ending notice, subscription active at trial end, first invoice finalized and paid.',
    stepCount: 7,
  },
  {
    id: '3d-secure',
    name: '3D Secure Authentication',
    description:
      'Renewal needs 3D Secure: invoice finalized, payment action required, customer authenticates, invoice paid.',
    stepCount: 6,
  },
  {
    id: 'early-fraud-warning',
    name: 'Early Fraud Warning',
    description:
      'Issuer flags a charge as likely fraud: charge succeeded, early fraud warning, full refund before any dispute.',
    stepCount: 4,
  },
] as const;
