// Copyright 2026 Sutyr Inc. SPDX-License-Identifier: Apache-2.0
import 'server-only';

import type { StripeEventType } from '@webhook-lab/events';
import {
  paymentIntentSucceeded,
  paymentIntentPaymentFailed,
  chargeSucceeded,
  chargeRefunded,
  invoiceCreated,
  invoicePaid,
  invoicePaymentFailed,
  invoicePaymentSucceeded,
  subscriptionCreated,
  subscriptionUpdated,
  subscriptionDeleted,
  checkoutSessionCompleted,
  checkoutSessionExpired,
  customerCreated,
  customerUpdated,
  disputeCreated,
  disputeUpdated,
  disputeClosed,
} from '@webhook-lab/events';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const EVENT_TYPE_TO_GENERATOR: Record<StripeEventType, (options?: any) => any> = {
  'payment_intent.succeeded': paymentIntentSucceeded,
  'payment_intent.payment_failed': paymentIntentPaymentFailed,
  'charge.succeeded': chargeSucceeded,
  'charge.refunded': chargeRefunded,
  'invoice.created': invoiceCreated,
  'invoice.paid': invoicePaid,
  'invoice.payment_failed': invoicePaymentFailed,
  'invoice.payment_succeeded': invoicePaymentSucceeded,
  'customer.subscription.created': subscriptionCreated,
  'customer.subscription.updated': subscriptionUpdated,
  'customer.subscription.deleted': subscriptionDeleted,
  'checkout.session.completed': checkoutSessionCompleted,
  'checkout.session.expired': checkoutSessionExpired,
  'customer.created': customerCreated,
  'customer.updated': customerUpdated,
  'charge.dispute.created': disputeCreated,
  'charge.dispute.updated': disputeUpdated,
  'charge.dispute.closed': disputeClosed,
};
