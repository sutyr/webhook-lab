// Copyright 2026 Sutyr Inc. SPDX-License-Identifier: Apache-2.0
import type { ScenarioPreset, StripeEvent, StripeEventType } from './types/index.js';
import {
  paymentIntentSucceeded,
  paymentIntentPaymentFailed,
  paymentIntentRequiresAction,
  paymentIntentCanceled,
  chargeSucceeded,
  chargeFailed,
  chargeRefunded,
  refundCreated,
  invoiceUpcoming,
  invoiceCreated,
  invoiceFinalized,
  invoicePaid,
  invoicePaymentFailed,
  invoicePaymentActionRequired,
  invoicePaymentSucceeded,
  invoicePaymentPaid,
  invoiceOverdue,
  invoiceMarkedUncollectible,
  invoiceVoided,
  subscriptionCreated,
  subscriptionTrialWillEnd,
  subscriptionUpdated,
  subscriptionPaused,
  subscriptionResumed,
  subscriptionDeleted,
  checkoutSessionCompleted,
  checkoutSessionAsyncPaymentSucceeded,
  checkoutSessionAsyncPaymentFailed,
  checkoutSessionExpired,
  customerCreated,
  customerUpdated,
  customerDeleted,
  paymentMethodAttached,
  setupIntentSucceeded,
  paymentMethodAutomaticallyUpdated,
  earlyFraudWarningCreated,
  disputeCreated,
  disputeUpdated,
  disputeClosed,
} from './generators/index.js';
import {
  subscriptionHappyPath,
  subscriptionFailure,
  checkoutFlow,
  disputeLifecycle,
  refundFlow,
  trialConversion,
  threeDSecure,
  earlyFraudWarning,
} from './scenarios/index.js';

// ─── Event Generators ────────────────────────────────────────────────────────
// One entry per event type, in catalog order. The Record type makes the
// compiler reject a StripeEventType without a generator. Options are
// event-specific, so callers that pick a generator at runtime (the CLI, the
// web routes) pass a plain object. Look entries up with Object.hasOwn, since
// the key usually comes from user input.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type EventGenerator = (options?: any) => StripeEvent;

export const EVENT_GENERATORS: Record<StripeEventType, EventGenerator> = {
  // Payments
  'payment_intent.succeeded': paymentIntentSucceeded,
  'payment_intent.payment_failed': paymentIntentPaymentFailed,
  'payment_intent.requires_action': paymentIntentRequiresAction,
  'payment_intent.canceled': paymentIntentCanceled,
  'charge.succeeded': chargeSucceeded,
  'charge.failed': chargeFailed,
  'charge.refunded': chargeRefunded,
  'refund.created': refundCreated,
  // Billing
  // invoice.upcoming carries a preview of an invoice that does not exist yet,
  // so data.object has no `id` and the generator returns
  // StripeUpcomingInvoiceEvent rather than StripeEvent. Registry callers only
  // read the envelope (id, type, created), so the cast is safe; code that reads
  // data.object.id from a registry event must allow it to be absent.
  'invoice.upcoming': invoiceUpcoming as unknown as EventGenerator,
  'invoice.created': invoiceCreated,
  'invoice.finalized': invoiceFinalized,
  'invoice.paid': invoicePaid,
  'invoice.payment_failed': invoicePaymentFailed,
  'invoice.payment_action_required': invoicePaymentActionRequired,
  'invoice.payment_succeeded': invoicePaymentSucceeded,
  'invoice_payment.paid': invoicePaymentPaid,
  'invoice.overdue': invoiceOverdue,
  'invoice.marked_uncollectible': invoiceMarkedUncollectible,
  'invoice.voided': invoiceVoided,
  // Subscriptions
  'customer.subscription.created': subscriptionCreated,
  'customer.subscription.trial_will_end': subscriptionTrialWillEnd,
  'customer.subscription.updated': subscriptionUpdated,
  'customer.subscription.paused': subscriptionPaused,
  'customer.subscription.resumed': subscriptionResumed,
  'customer.subscription.deleted': subscriptionDeleted,
  // Checkout
  'checkout.session.completed': checkoutSessionCompleted,
  'checkout.session.async_payment_succeeded': checkoutSessionAsyncPaymentSucceeded,
  'checkout.session.async_payment_failed': checkoutSessionAsyncPaymentFailed,
  'checkout.session.expired': checkoutSessionExpired,
  // Customers
  'customer.created': customerCreated,
  'customer.updated': customerUpdated,
  'customer.deleted': customerDeleted,
  // Payment methods
  'payment_method.attached': paymentMethodAttached,
  'setup_intent.succeeded': setupIntentSucceeded,
  'payment_method.automatically_updated': paymentMethodAutomaticallyUpdated,
  // Disputes and fraud
  'radar.early_fraud_warning.created': earlyFraudWarningCreated,
  'charge.dispute.created': disputeCreated,
  'charge.dispute.updated': disputeUpdated,
  'charge.dispute.closed': disputeClosed,
};

// ─── Scenario Generators ─────────────────────────────────────────────────────
// Each scenario derives every entity ID (cus_, sub_, in_, pi_, ...) from one
// seeded generator, so all steps refer to the same objects. The seed defaults
// to the scenario id; pass a fresh seed to get new IDs on every run.

export type ScenarioGenerator = (options?: { seed?: string }) => ScenarioPreset;

export const SCENARIO_GENERATORS: Record<string, ScenarioGenerator> = {
  'subscription-happy-path': subscriptionHappyPath,
  'subscription-failure': subscriptionFailure,
  'checkout-flow': checkoutFlow,
  'dispute-lifecycle': disputeLifecycle,
  'refund-flow': refundFlow,
  'trial-conversion': trialConversion,
  '3d-secure': threeDSecure,
  'early-fraud-warning': earlyFraudWarning,
};
