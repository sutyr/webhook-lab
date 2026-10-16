// Copyright 2026 Sutyr Inc. SPDX-License-Identifier: Apache-2.0
import type {
  StripeInvoice,
  StripeEvent,
  StripeObject,
  InvoiceCreatedOptions,
  InvoicePaidOptions,
  InvoicePaymentFailedOptions,
  InvoicePaymentSucceededOptions,
} from '../types/index.js';
import type {
  StripeInvoiceBillingReason,
  StripeInvoiceStatusDetails,
  StripeLifecycleInvoice,
  StripeLifecycleInvoiceLineItem,
  StripeUpcomingInvoice,
  StripeUpcomingInvoiceEvent,
  InvoiceUpcomingOptions,
  InvoiceFinalizedOptions,
  InvoicePaymentActionRequiredOptions,
  InvoiceMarkedUncollectibleOptions,
  InvoiceOverdueOptions,
  InvoiceVoidedOptions,
} from '../types/invoices.js';
import { wrapInEvent } from './envelope.js';
import {
  generateId,
  invoiceId,
  customerId,
  subscriptionId,
  invoiceLineItemId,
  priceId,
  productId,
  subscriptionItemId,
} from '../utils/ids.js';
import { now, futureHours } from '../utils/timestamps.js';

// ─── Helpers ────────────────────────────────────────────────────────────────
// Shapes follow the 2026-09-30.endive Invoice and carry every field Stripe
// returns by default. Since 2025-03-31.basil there is no `paid`,
// `subscription`, `payment_intent` or `charge`: the subscription lives under
// `parent.subscription_details.subscription`; line items reference their price
// via `pricing.price_details` and their subscription via
// `parent.subscription_item_details`. `payments`, `amount_paid_off_stripe`
// and `confirmation_secret` are includable only, so they are absent from
// webhook payloads. `status_details` (2026-09-30.endive) is present only on
// uncollectible invoices. None of these events carry `previous_attributes`:
// Stripe sends it on `*.updated` events only.

const HOUR = 3600;
const DAY = 86400;
const PERIOD_SECONDS = 30 * DAY;
// Stripe leaves a subscription invoice in draft for about an hour before it
// finalizes it. The first invoice of a charge_automatically subscription is
// finalized at creation.
const DRAFT_SECONDS = HOUR;
// Default `days_until_due` for send_invoice examples.
const DAYS_UNTIL_DUE = 30;
// The test-mode business and customer every invoice is addressed between.
const ACCOUNT_COUNTRY = 'US';
const ACCOUNT_NAME = 'Example Inc.';
const CUSTOMER_NAME = 'Jane Doe';
const CUSTOMER_EMAIL = 'jane@example.com';

type CollectionMethod = StripeInvoice['collection_method'];
type StatusTransitions = StripeInvoice['status_transitions'];

interface BuildInvoiceOptions {
  status: StripeInvoice['status'];
  amount: number;
  currency: string;
  amountPaid: number;
  amountRemaining: number;
  attemptCount: number;
  attempted: boolean;
  nextPaymentAttempt: number | null;
  billingReason: StripeInvoice['billing_reason'];
  collectionMethod?: CollectionMethod;
  dueDate?: number | null;
  customerId?: string;
  subscriptionId?: string;
  invoiceId?: string;
  /** Invoice `created`; also anchors the period and default transitions. */
  timestamp?: number;
  statusTransitions?: Partial<StatusTransitions>;
  statusDetails?: StripeInvoiceStatusDetails;
  metadata?: Record<string, string>;
}

// Line items on a preview (`invId` null) do not exist yet, so Stripe gives
// them temporary `il_tmp_` IDs.
function buildLineItem(
  amount: number,
  currency: string,
  invId: string | null,
  subId: string,
  timestamp: number,
): StripeLifecycleInvoiceLineItem {
  return {
    id: invId === null ? generateId('il_tmp_') : invoiceLineItemId(),
    object: 'line_item',
    amount,
    currency,
    description: '1 × Subscription',
    discount_amounts: [],
    discountable: true,
    discounts: [],
    invoice: invId,
    livemode: false,
    metadata: {},
    parent: {
      type: 'subscription_item_details',
      invoice_item_details: null,
      subscription_item_details: {
        invoice_item: null,
        proration: false,
        proration_details: { credited_items: null },
        subscription: subId,
        subscription_item: subscriptionItemId(),
      },
    },
    period: {
      start: timestamp,
      end: timestamp + PERIOD_SECONDS,
    },
    pretax_credit_amounts: [],
    pricing: {
      type: 'price_details',
      price_details: {
        price: priceId(),
        product: productId(),
      },
      unit_amount_decimal: String(amount),
    },
    quantity: 1,
    quantity_decimal: '1',
    subtotal: amount,
    taxes: [],
  };
}

// Finalized invoices get a hosted page and PDF; drafts and previews have
// null for both.
function hostedInvoiceUrls(): { page: string; pdf: string } {
  const account = generateId('acct_', 16);
  const token = generateId('test_', 72);
  return {
    page: `https://invoice.stripe.com/i/${account}/${token}?s=ap`,
    pdf: `https://pay.stripe.com/invoice/${account}/${token}/pdf?s=ap`,
  };
}

// Builds every invoice field except `id`. `invId` is null only for the
// `invoice.upcoming` preview, which has no invoice yet.
function buildInvoiceFields(
  opts: BuildInvoiceOptions,
  invId: string | null,
  linesUrl: string,
): StripeUpcomingInvoice {
  const ts = opts.timestamp ?? now();
  const cusId = opts.customerId ?? customerId();
  const subId = opts.subscriptionId ?? subscriptionId();
  const collectionMethod = opts.collectionMethod ?? 'charge_automatically';
  const lineItem = buildLineItem(opts.amount, opts.currency, invId, subId, ts);
  const finalized = opts.status !== 'draft' && invId !== null;

  // Invoice numbers are assigned at finalization; drafts have number: null.
  let invoiceNumber: string | null = null;
  if (finalized) {
    const idSuffix = invId.replace('in_', '');
    const numericHash = Array.from(idSuffix.slice(0, 4)).reduce((acc, c) => acc + c.charCodeAt(0), 0);
    invoiceNumber = `INV-${String(numericHash % 10000).padStart(4, '0')}`;
  }
  const hosted = finalized ? hostedInvoiceUrls() : null;

  // A subscription_create invoice covers no elapsed period; a cycle invoice
  // closes the period that just ended.
  const periodStart = opts.billingReason === 'subscription_create' ? ts : ts - PERIOD_SECONDS;

  const statusTransitions: StatusTransitions = {
    finalized_at: finalized ? ts : null,
    marked_uncollectible_at: null,
    paid_at: opts.status === 'paid' ? ts : null,
    voided_at: null,
    ...opts.statusTransitions,
  };

  return {
    object: 'invoice',
    account_country: ACCOUNT_COUNTRY,
    account_name: ACCOUNT_NAME,
    account_tax_ids: null,
    amount_due: opts.amount,
    amount_overpaid: 0,
    amount_paid: opts.amountPaid,
    amount_remaining: opts.amountRemaining,
    amount_shipping: 0,
    application: null,
    attempt_count: opts.attemptCount,
    attempted: opts.attempted,
    auto_advance: autoAdvance(opts.status, opts.billingReason, collectionMethod),
    automatic_tax: {
      disabled_reason: null,
      enabled: false,
      liability: null,
      provider: null,
      status: null,
    },
    automatically_finalizes_at: null,
    billing_reason: opts.billingReason,
    collection_method: collectionMethod,
    created: ts,
    currency: opts.currency,
    custom_fields: null,
    customer: cusId,
    customer_account: null,
    customer_address: null,
    customer_email: CUSTOMER_EMAIL,
    customer_name: CUSTOMER_NAME,
    customer_phone: null,
    customer_shipping: null,
    customer_tax_exempt: 'none',
    customer_tax_ids: [],
    default_payment_method: null,
    default_source: null,
    default_tax_rates: [],
    description: null,
    discounts: [],
    due_date: opts.dueDate ?? null,
    effective_at: statusTransitions.finalized_at,
    // No customer balance is applied, so the balance after finalization is 0.
    ending_balance: finalized ? 0 : null,
    footer: null,
    from_invoice: null,
    hosted_invoice_url: hosted?.page ?? null,
    invoice_pdf: hosted?.pdf ?? null,
    issuer: { type: 'self' },
    last_finalization_error: null,
    latest_revision: null,
    lines: {
      object: 'list',
      data: [lineItem],
      has_more: false,
      total_count: 1,
      url: linesUrl,
    },
    livemode: false,
    metadata: opts.metadata ?? {},
    next_payment_attempt: opts.nextPaymentAttempt,
    number: invoiceNumber,
    on_behalf_of: null,
    parent: {
      type: 'subscription_details',
      quote_details: null,
      subscription_details: {
        metadata: {},
        subscription: subId,
      },
    },
    payment_settings: {
      default_mandate: null,
      payment_method_options: null,
      payment_method_types: null,
    },
    period_end: ts,
    period_start: periodStart,
    post_payment_credit_notes_amount: 0,
    pre_payment_credit_notes_amount: 0,
    receipt_number: null,
    rendering: null,
    shipping_cost: null,
    shipping_details: null,
    starting_balance: 0,
    statement_descriptor: null,
    status: opts.status,
    ...(opts.statusDetails !== undefined ? { status_details: opts.statusDetails } : {}),
    status_transitions: statusTransitions,
    subtotal: opts.amount,
    subtotal_excluding_tax: opts.amount,
    test_clock: null,
    total: opts.amount,
    total_discount_amounts: [],
    total_excluding_tax: opts.amount,
    total_pretax_credit_amounts: [],
    total_taxes: [],
    // Drafts and previews have not had their webhooks delivered yet.
    webhooks_delivered_at: finalized ? ts : null,
  };
}

function buildInvoice(opts: BuildInvoiceOptions): StripeLifecycleInvoice {
  const invId = opts.invoiceId ?? invoiceId();
  return {
    id: invId,
    ...buildInvoiceFields(opts, invId, `/v1/invoices/${invId}/lines`),
  };
}

// Invoices that are paid, void or uncollectible always have automatic
// advancement off. Stripe also keeps it off on the first invoice of a
// charge_automatically subscription until that invoice is paid, and on
// invoices a subscription update creates. Without it Stripe schedules no
// payment attempts, so `next_payment_attempt` stays null.
function autoAdvance(
  status: StripeInvoice['status'],
  billingReason: StripeInvoice['billing_reason'],
  collectionMethod: CollectionMethod,
): boolean {
  if (status === 'paid' || status === 'void' || status === 'uncollectible') return false;
  if (billingReason === 'subscription_update') return false;
  return !(billingReason === 'subscription_create' && collectionMethod === 'charge_automatically');
}

// Seconds an invoice spends in draft before it is finalized. Stripe holds
// subscription invoices for about an hour, but finalizes the first invoice of
// a charge_automatically subscription at creation. An update invoice starts
// with automatic advancement off, so Stripe never finalizes it after a delay:
// it is finalized when the update creates it.
function draftSeconds(
  billingReason: StripeInvoiceBillingReason,
  collectionMethod: CollectionMethod,
): number {
  const finalizedAtCreation =
    billingReason === 'subscription_update' ||
    (billingReason === 'subscription_create' && collectionMethod === 'charge_automatically');
  return finalizedAtCreation ? 0 : DRAFT_SECONDS;
}

// ─── Generators ─────────────────────────────────────────────────────────────

export function invoiceCreated(
  options?: InvoiceCreatedOptions,
): StripeEvent<StripeLifecycleInvoice> {
  const amount = options?.amount ?? 2999;
  const currency = options?.currency ?? 'usd';

  const invoice = buildInvoice({
    status: 'draft',
    amount,
    currency,
    amountPaid: 0,
    amountRemaining: amount,
    attemptCount: 0,
    attempted: false,
    nextPaymentAttempt: null,
    billingReason: options?.billingReason ?? 'subscription_cycle',
    customerId: options?.customerId,
    subscriptionId: options?.subscriptionId,
    invoiceId: options?.invoiceId,
    timestamp: options?.timestamp,
    metadata: options?.metadata,
  });

  return wrapInEvent('invoice.created', invoice, {
    timestamp: options?.timestamp,
  });
}

export function invoicePaid(
  options?: InvoicePaidOptions,
): StripeEvent<StripeLifecycleInvoice> {
  const amount = options?.amount ?? 2999;
  const currency = options?.currency ?? 'usd';

  const invoice = buildInvoice({
    status: 'paid',
    amount,
    currency,
    amountPaid: amount,
    amountRemaining: 0,
    attemptCount: 1,
    attempted: true,
    nextPaymentAttempt: null,
    billingReason: 'subscription_cycle',
    customerId: options?.customerId,
    subscriptionId: options?.subscriptionId,
    invoiceId: options?.invoiceId,
    timestamp: options?.timestamp,
    metadata: options?.metadata,
  });

  return wrapInEvent('invoice.paid', invoice, {
    timestamp: options?.timestamp,
  });
}

export function invoicePaymentFailed(
  options?: InvoicePaymentFailedOptions,
): StripeEvent<StripeLifecycleInvoice> {
  const amount = options?.amount ?? 2999;
  const currency = options?.currency ?? 'usd';

  const invoice = buildInvoice({
    status: 'open',
    amount,
    currency,
    amountPaid: 0,
    amountRemaining: amount,
    attemptCount: options?.attemptCount ?? 1,
    attempted: true,
    nextPaymentAttempt: futureHours(24),
    billingReason: 'subscription_cycle',
    customerId: options?.customerId,
    subscriptionId: options?.subscriptionId,
    invoiceId: options?.invoiceId,
    timestamp: options?.timestamp,
    metadata: options?.metadata,
  });

  return wrapInEvent('invoice.payment_failed', invoice, {
    timestamp: options?.timestamp,
  });
}

export function invoicePaymentSucceeded(
  options?: InvoicePaymentSucceededOptions,
): StripeEvent<StripeLifecycleInvoice> {
  const amount = options?.amount ?? 2999;
  const currency = options?.currency ?? 'usd';

  const invoice = buildInvoice({
    status: 'paid',
    amount,
    currency,
    amountPaid: amount,
    amountRemaining: 0,
    attemptCount: 1,
    attempted: true,
    nextPaymentAttempt: null,
    billingReason: 'subscription_cycle',
    customerId: options?.customerId,
    subscriptionId: options?.subscriptionId,
    invoiceId: options?.invoiceId,
    timestamp: options?.timestamp,
    metadata: options?.metadata,
  });

  return wrapInEvent('invoice.payment_succeeded', invoice, {
    timestamp: options?.timestamp,
  });
}

/**
 * Sent a few days before a charge_automatically subscription renews (Stripe
 * does not send it for send_invoice). The object is a preview of the invoice
 * the renewal will create: it has no `id`, is a draft with no number, and has
 * `billing_reason: 'upcoming'`. Its line items have temporary `il_tmp_` IDs
 * and `invoice: null`.
 */
export function invoiceUpcoming(
  options?: InvoiceUpcomingOptions,
): StripeUpcomingInvoiceEvent {
  const amount = options?.amount ?? 2999;
  const currency = options?.currency ?? 'usd';
  const ts = options?.timestamp ?? now();
  const periodEnd = options?.periodEnd ?? ts + 7 * DAY;
  const cusId = options?.customerId ?? customerId();
  const subId = options?.subscriptionId ?? subscriptionId();

  // The preview is dated at the renewal, when the real invoice is created;
  // payment is attempted once that invoice leaves draft.
  const preview = buildInvoiceFields(
    {
      status: 'draft',
      amount,
      currency,
      amountPaid: 0,
      amountRemaining: amount,
      attemptCount: 0,
      attempted: false,
      nextPaymentAttempt: periodEnd + DRAFT_SECONDS,
      billingReason: 'upcoming',
      customerId: cusId,
      subscriptionId: subId,
      timestamp: periodEnd,
      metadata: options?.metadata,
    },
    null,
    `/v1/invoices/upcoming/lines?customer=${cusId}&subscription=${subId}`,
  );

  // wrapInEvent's StripeObject bound only exists to type `data.object`; it
  // never reads `id`, so the id-less preview passes through unchanged.
  return wrapInEvent('invoice.upcoming', preview as StripeUpcomingInvoice & StripeObject, {
    timestamp: ts,
  });
}

/**
 * A draft invoice was finalized: status `open`, a number and hosted URLs
 * assigned, payment not attempted yet. For send_invoice, `due_date` is set and
 * `next_payment_attempt` is null. The first invoice of a charge_automatically
 * subscription, and an invoice from a subscription update, have
 * `auto_advance: false`: the request that created them collects payment, so
 * Stripe schedules no attempt.
 */
export function invoiceFinalized(
  options?: InvoiceFinalizedOptions,
): StripeEvent<StripeLifecycleInvoice> {
  const amount = options?.amount ?? 2999;
  const currency = options?.currency ?? 'usd';
  const ts = options?.timestamp ?? now();
  const billingReason = options?.billingReason ?? 'subscription_cycle';
  const collectionMethod = options?.collectionMethod ?? 'charge_automatically';
  const sendInvoice = collectionMethod === 'send_invoice';
  const scheduled = !sendInvoice && autoAdvance('open', billingReason, collectionMethod);

  const invoice = buildInvoice({
    status: 'open',
    amount,
    currency,
    amountPaid: 0,
    amountRemaining: amount,
    attemptCount: 0,
    attempted: false,
    // Stripe charges a renewal invoice right after finalizing it.
    nextPaymentAttempt: scheduled ? ts : null,
    billingReason,
    collectionMethod,
    dueDate: sendInvoice ? (options?.dueDate ?? ts + DAYS_UNTIL_DUE * DAY) : null,
    customerId: options?.customerId,
    subscriptionId: options?.subscriptionId,
    invoiceId: options?.invoiceId,
    timestamp: ts - draftSeconds(billingReason, collectionMethod),
    statusTransitions: { finalized_at: ts },
    metadata: options?.metadata,
  });

  return wrapInEvent('invoice.finalized', invoice, { timestamp: ts });
}

/**
 * A payment on a subscription invoice needs customer authentication (3D
 * Secure). The invoice stays `open`; the linked PaymentIntent is in
 * `requires_action` and is not on the invoice (see invoice_payment events).
 * Stripe keeps `auto_advance` false on a `subscription_create` invoice until
 * it is paid, so no automatic attempt is scheduled; a renewal keeps its
 * scheduled retry.
 */
export function invoicePaymentActionRequired(
  options?: InvoicePaymentActionRequiredOptions,
): StripeEvent<StripeLifecycleInvoice> {
  const amount = options?.amount ?? 2999;
  const currency = options?.currency ?? 'usd';
  const ts = options?.timestamp ?? now();
  const billingReason = options?.billingReason ?? 'subscription_create';
  const scheduled = autoAdvance('open', billingReason, 'charge_automatically');

  const invoice = buildInvoice({
    status: 'open',
    amount,
    currency,
    amountPaid: 0,
    amountRemaining: amount,
    attemptCount: options?.attemptCount ?? 1,
    attempted: true,
    nextPaymentAttempt: scheduled ? ts + DAY : null,
    billingReason,
    collectionMethod: 'charge_automatically',
    customerId: options?.customerId,
    subscriptionId: options?.subscriptionId,
    invoiceId: options?.invoiceId,
    timestamp: ts - draftSeconds(billingReason, 'charge_automatically'),
    statusTransitions: { finalized_at: ts },
    metadata: options?.metadata,
  });

  return wrapInEvent('invoice.payment_action_required', invoice, { timestamp: ts });
}

/**
 * An open invoice was marked uncollectible. Nothing is paid, nothing more is
 * attempted, and `status_details.uncollectible.reason` (2026-09-30.endive)
 * says why. Defaults to `max_payment_attempts`, or `payment_not_received` for
 * send_invoice.
 */
export function invoiceMarkedUncollectible(
  options?: InvoiceMarkedUncollectibleOptions,
): StripeEvent<StripeLifecycleInvoice> {
  const amount = options?.amount ?? 2999;
  const currency = options?.currency ?? 'usd';
  const ts = options?.timestamp ?? now();
  const collectionMethod = options?.collectionMethod ?? 'charge_automatically';
  const sendInvoice = collectionMethod === 'send_invoice';
  const billingReason = 'subscription_cycle';

  // send_invoice: due two weeks before the event. charge_automatically:
  // created two weeks before the event.
  const dueDate = sendInvoice ? ts - 14 * DAY : null;
  const draft = draftSeconds(billingReason, collectionMethod);
  const finalizedAt = dueDate !== null ? dueDate - DAYS_UNTIL_DUE * DAY : ts - 14 * DAY + draft;

  const invoice = buildInvoice({
    status: 'uncollectible',
    amount,
    currency,
    amountPaid: 0,
    amountRemaining: amount,
    attemptCount: options?.attemptCount ?? (sendInvoice ? 0 : 4),
    attempted: true,
    nextPaymentAttempt: null,
    billingReason,
    collectionMethod,
    dueDate,
    customerId: options?.customerId,
    subscriptionId: options?.subscriptionId,
    invoiceId: options?.invoiceId,
    timestamp: finalizedAt - draft,
    statusTransitions: { finalized_at: finalizedAt, marked_uncollectible_at: ts },
    statusDetails: {
      uncollectible: {
        // `null` is a valid reason: Stripe reports one only when it has a
        // supported reason, so only `undefined` falls back to the default.
        reason:
          options?.reason !== undefined
            ? options.reason
            : sendInvoice ? 'payment_not_received' : 'max_payment_attempts',
      },
    },
    metadata: options?.metadata,
  });

  return wrapInEvent('invoice.marked_uncollectible', invoice, { timestamp: ts });
}

/**
 * A send_invoice invoice is still `open` some days after its `due_date`. The
 * event comes from a Stripe automation, which only runs on invoices with
 * `auto_advance` on. Stripe never charges send_invoice invoices
 * automatically, so `next_payment_attempt` is null.
 */
export function invoiceOverdue(
  options?: InvoiceOverdueOptions,
): StripeEvent<StripeLifecycleInvoice> {
  const amount = options?.amount ?? 2999;
  const currency = options?.currency ?? 'usd';
  const ts = options?.timestamp ?? now();
  const billingReason = options?.billingReason ?? 'subscription_cycle';
  const dueDate = options?.dueDate ?? ts - DAY;
  const finalizedAt = dueDate - DAYS_UNTIL_DUE * DAY;

  const invoice = buildInvoice({
    status: 'open',
    amount,
    currency,
    amountPaid: 0,
    amountRemaining: amount,
    attemptCount: 0,
    attempted: true,
    nextPaymentAttempt: null,
    billingReason,
    collectionMethod: 'send_invoice',
    dueDate,
    customerId: options?.customerId,
    subscriptionId: options?.subscriptionId,
    invoiceId: options?.invoiceId,
    timestamp: finalizedAt - draftSeconds(billingReason, 'send_invoice'),
    statusTransitions: { finalized_at: finalizedAt },
    metadata: options?.metadata,
  });

  return wrapInEvent('invoice.overdue', invoice, { timestamp: ts });
}

/**
 * A finalized invoice was voided. It can no longer be paid and Stripe stops
 * collecting it; the unpaid balance stays in `amount_remaining`. Defaults to
 * the first invoice of a subscription that expired unpaid 23 hours after
 * creation.
 */
export function invoiceVoided(
  options?: InvoiceVoidedOptions,
): StripeEvent<StripeLifecycleInvoice> {
  const amount = options?.amount ?? 2999;
  const currency = options?.currency ?? 'usd';
  const ts = options?.timestamp ?? now();
  const billingReason = options?.billingReason ?? 'subscription_create';
  const collectionMethod = options?.collectionMethod ?? 'charge_automatically';
  const sendInvoice = collectionMethod === 'send_invoice';
  const createdAt = ts - 23 * HOUR;
  const finalizedAt = createdAt + draftSeconds(billingReason, collectionMethod);

  const invoice = buildInvoice({
    status: 'void',
    amount,
    currency,
    amountPaid: 0,
    amountRemaining: amount,
    attemptCount: options?.attemptCount ?? (sendInvoice ? 0 : 1),
    attempted: true,
    nextPaymentAttempt: null,
    billingReason,
    collectionMethod,
    dueDate: sendInvoice ? finalizedAt + DAYS_UNTIL_DUE * DAY : null,
    customerId: options?.customerId,
    subscriptionId: options?.subscriptionId,
    invoiceId: options?.invoiceId,
    timestamp: createdAt,
    statusTransitions: { finalized_at: finalizedAt, voided_at: ts },
    metadata: options?.metadata,
  });

  return wrapInEvent('invoice.voided', invoice, { timestamp: ts });
}
