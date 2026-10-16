// Copyright 2026 Sutyr Inc. SPDX-License-Identifier: Apache-2.0
// Client-safe copy of the conformance check list. The conformance package
// pulls in node:crypto and the generators, which do not belong in the browser
// bundle, so the editor shows this copy and the server runs the real one.
// tests/unit/lib/suite-checks.test.ts fails if the two drift apart.
import type { CheckDefinition, CheckStatus } from '@webhook-lab/conformance';

export const SUITE_CHECKS: readonly CheckDefinition[] = [
  {
    id: 'valid-event-accepted',
    title: 'Accepts a correctly signed event',
    why:
      'Stripe counts only a 2xx response as delivered and retries anything else, for up to three days in live mode. ' +
      'This invoice.payment_failed event is signed with your secret exactly the way Stripe signs it. ' +
      'A 400 here usually means the handler verifies with a different secret, and a handler that refuses every request passes the rejection checks without proving anything.',
  },
  {
    id: 'forged-signature-rejected',
    title: 'Rejects a forged signature',
    why:
      'This event is signed with a different whsec_ secret, the way someone who does not know yours would sign it. ' +
      'A handler that accepts it will act on events Stripe never sent. ' +
      'Verify the Stripe-Signature header against your endpoint secret and return 400 when it does not match. ' +
      'A 5xx also refuses the event, but it usually means the verification error went uncaught.',
  },
  {
    id: 'missing-signature-rejected',
    title: 'Rejects a missing signature',
    why:
      'Stripe signs every webhook event, so a request without a Stripe-Signature header did not come from Stripe. ' +
      'Return 400 without acting on the body. ' +
      'A 2xx means anyone who finds the URL can post events to it.',
  },
  {
    id: 'tampered-body-rejected',
    title: 'Rejects a body changed after signing',
    why:
      'The signature covers the exact raw body. ' +
      'Here the header carries a genuine signature for the original event, but amount_due was changed after signing. ' +
      'Accepting it means the handler checks that a signature is present without recomputing it over the raw body it received.',
  },
  {
    id: 'stale-timestamp-rejected',
    title: 'Rejects a stale timestamp',
    why:
      'The timestamp in the Stripe-Signature header is signed too, so old deliveries can be refused. ' +
      'This event is correctly signed but 10 minutes old, and Stripe\'s libraries reject anything older than 5 minutes by default. ' +
      'Accepting it lets anyone who captured one real delivery replay it later. ' +
      'Stripe signs every attempt, retries included, with a fresh timestamp, so a tolerance never drops a real retry.',
  },
  {
    id: 'duplicate-delivery-acknowledged',
    title: 'Acknowledges a duplicate delivery',
    why:
      'Stripe can deliver the same event more than once, and signs each attempt with a fresh timestamp. ' +
      'Both deliveries here carry the same event id, and the second needs a 2xx too, because a non-2xx makes Stripe send it again. ' +
      'The Lab sees status codes, not side effects, so it cannot tell whether your handler acted twice. ' +
      'Record each event.id you process and skip the ones you have already seen.',
  },
  {
    id: 'out-of-order-acknowledged',
    title: 'Acknowledges events out of order',
    why:
      'Stripe does not guarantee that events arrive in the order they were created. ' +
      'Here customer.subscription.updated arrives before the customer.subscription.created event for the same subscription. ' +
      'Acknowledge it with a 2xx and fetch the current object from the API if you need it. ' +
      'Returning a non-2xx so that Stripe sends it again later works in some designs, which is why this is a warning, but in live mode those retries back off exponentially over up to three days.',
  },
  {
    id: 'unhandled-event-acknowledged',
    title: 'Acknowledges an event it does not handle',
    why:
      'Endpoints receive types they have no code for, for example after someone subscribes the endpoint to more events. ' +
      'charge.dispute.updated is a real event most SaaS handlers ignore: they act when a dispute opens or closes, not while it is under review. ' +
      'Return a 2xx for types you do not handle, as Stripe\'s own examples do. ' +
      'A non-2xx counts as a failed delivery, so Stripe keeps retrying it for up to three days in live mode.',
  },
  {
    id: 'responds-in-time',
    title: 'Responds in time',
    why:
      'Stripe asks endpoints to return a 2xx quickly, before any slow work, and marks a delivery that takes too long as timed out and retries it. ' +
      'Stripe does not publish a general timeout. ' +
      'The one figure it documents is that Checkout waits up to 10 seconds for your response to checkout.session.completed before redirecting the customer. ' +
      'The thresholds used here, pass under 2 seconds and fail beyond 10, are the Lab\'s recommendation. ' +
      'Measured on the correctly signed delivery. ' +
      'Acknowledge first and queue slow work.',
  },
];

/**
 * Deliveries a full run sends: one per check, two each for the duplicate and
 * out-of-order checks, and responds-in-time reuses the correctly signed one.
 */
export const SUITE_DELIVERY_COUNT = 10;

export interface CheckStatusMeta {
  label: string;
  /** What the status says about the handler, for the results legend. */
  meaning: string;
  text: string;
  dot: string;
  badge: string;
}

/**
 * State colours keep their absolute meanings: green passed, red failed or
 * could not be judged, amber works but not the way Stripe recommends.
 */
export const CHECK_STATUS_META: Record<CheckStatus, CheckStatusMeta> = {
  pass: {
    label: 'Pass',
    meaning: 'The handler did what Stripe expects.',
    text: 'text-state-success',
    dot: 'bg-state-success',
    badge: 'bg-success-10 text-state-success',
  },
  fail: {
    label: 'Fail',
    meaning: 'It would lose events or let forged ones in.',
    text: 'text-state-error',
    dot: 'bg-state-error',
    badge: 'bg-error-10 text-state-error',
  },
  warn: {
    label: 'Warning',
    meaning: 'It works, but not the way Stripe recommends.',
    text: 'text-state-warning',
    dot: 'bg-state-warning',
    badge: 'bg-warning-10 text-state-warning',
  },
  error: {
    label: 'Error',
    meaning: 'The Lab got no answer, so nothing was judged.',
    text: 'text-state-error',
    dot: 'bg-state-error',
    badge: 'bg-error-10 text-state-error',
  },
};

/** Statuses in the order the summary lists them. */
export const CHECK_STATUS_ORDER: readonly CheckStatus[] = ['pass', 'fail', 'warn', 'error'];
