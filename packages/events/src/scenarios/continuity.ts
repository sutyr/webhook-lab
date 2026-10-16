// Copyright 2026 Sutyr Inc. SPDX-License-Identifier: Apache-2.0
import type { StripeEvent, StripeObject } from '../types/index.js';
import type { StripeLifecycleInvoice } from '../types/invoices.js';
import { wrapInEvent, type WrapInEventOptions } from '../generators/envelope.js';

// ─── Object Continuity Across Steps ─────────────────────────────────────────
// Generators build every event from nothing, so each call returns a new
// `created` time and fresh nested IDs (line items, prices, hosted URLs). A
// scenario sends one object through several states, so later steps must show
// the same object: only the fields the transition changes may differ.

/**
 * An event carrying a copy of `object` with `changes` applied. Used when a
 * step is the same object in another state, so every unchanged field (nested
 * IDs, `created`, client secrets) matches the other steps exactly.
 */
export function snapshot<T extends StripeObject>(
  type: string,
  object: T,
  changes: Partial<T>,
  options: WrapInEventOptions<T> & { timestamp: number },
): StripeEvent<T> {
  return wrapInEvent(type, { ...structuredClone(object), ...structuredClone(changes) }, options);
}

// An invoice keeps these from the moment it is created.
const FIXED_AT_CREATION = [
  'created',
  'billing_reason',
  'period_start',
  'period_end',
  'lines',
] as const satisfies readonly (keyof StripeLifecycleInvoice)[];

// And these from the moment it is finalized. `webhooks_delivered_at` is set
// once the invoice.created deliveries succeed, before finalization.
const FIXED_AT_FINALIZATION = [
  'number',
  'hosted_invoice_url',
  'invoice_pdf',
  'effective_at',
  'webhooks_delivered_at',
] as const satisfies readonly (keyof StripeLifecycleInvoice)[];

function copyField<T, K extends keyof T>(target: T, source: T, key: K): void {
  target[key] = structuredClone(source[key]);
}

/**
 * Makes the invoice in `event` the same invoice as `earlier`, a previous state
 * of it. The generator's status fields (amounts, attempts, auto_advance,
 * next_payment_attempt, paid_at) stay; the fields fixed at creation, and at
 * finalization when `earlier` is finalized, come from `earlier`.
 */
export function continueInvoice(
  event: StripeEvent<StripeLifecycleInvoice>,
  earlier: StripeLifecycleInvoice,
): StripeEvent<StripeLifecycleInvoice> {
  const invoice = event.data.object;
  for (const key of FIXED_AT_CREATION) copyField(invoice, earlier, key);
  if (earlier.status !== 'draft') {
    for (const key of FIXED_AT_FINALIZATION) copyField(invoice, earlier, key);
    invoice.status_transitions.finalized_at = earlier.status_transitions.finalized_at;
  }
  return event;
}
