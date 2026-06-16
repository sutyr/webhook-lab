// Copyright 2026 Sutyr Inc. SPDX-License-Identifier: Apache-2.0
// ─── Types ───────────────────────────────────────────────────────────────────

export type {
  StripeList,
  StripeObject,
  StripeEvent,
  StripePaymentError,
  StripePaymentIntent,
  StripeCharge,
  StripeChargeOutcome,
  StripeCardDetails,
  StripeRefund,
  StripeInvoice,
  StripeInvoiceLineItem,
  StripePrice,
  StripePriceRecurring,
  StripeSubscription,
  StripeSubscriptionItem,
  StripeCustomer,
  StripeCheckoutSession,
  StripeDispute,
  ScenarioStep,
  ScenarioPreset,
  EventCatalogEntry,
  EventCategory,
  StripeEventType,
  EventResult,
  DeclineCodeEntry,
  BaseEventOptions,
  PaymentIntentSucceededOptions,
  PaymentIntentFailedOptions,
  ChargeSucceededOptions,
  ChargeRefundedOptions,
  InvoiceCreatedOptions,
  InvoicePaidOptions,
  InvoicePaymentFailedOptions,
  InvoicePaymentSucceededOptions,
  SubscriptionCreatedOptions,
  SubscriptionUpdatedOptions,
  SubscriptionDeletedOptions,
  CheckoutSessionCompletedOptions,
  CheckoutSessionExpiredOptions,
  CustomerCreatedOptions,
  CustomerUpdatedOptions,
  DisputeCreatedOptions,
  DisputeUpdatedOptions,
  DisputeClosedOptions,
} from './types/index.js';

export { DECLINE_CODE_MAP } from './types/index.js';

// ─── Generators ──────────────────────────────────────────────────────────────

export {
  STRIPE_API_VERSION,
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
} from './generators/index.js';

// ─── Scenarios ───────────────────────────────────────────────────────────────

export {
  subscriptionHappyPath,
  subscriptionFailure,
  checkoutFlow,
  disputeLifecycle,
  refundFlow,
} from './scenarios/index.js';

// ─── Catalog ─────────────────────────────────────────────────────────────────

export { EVENT_CATALOG, SCENARIO_CATALOG } from './catalog.js';
