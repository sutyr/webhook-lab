// Copyright 2026 Sutyr Inc. SPDX-License-Identifier: Apache-2.0
import { randomBytes } from 'node:crypto';
import {
  disputeUpdated,
  invoicePaymentFailed,
  subscriptionCreated,
  subscriptionUpdated,
} from '@webhook-lab/events';
import { sign } from '@webhook-lab/signatures';
import type { SendOptions } from './deliver.js';
import type { CheckDefinition, CheckId, CheckStatus, Delivery } from './types.js';

// ─── Thresholds ──────────────────────────────────────────────────────────────

/** Age of the stale delivery. Stripe's libraries tolerate 300 seconds by default. */
export const STALE_TIMESTAMP_AGE_SECONDS = 600;

/** responds-in-time passes below this. The Lab's recommendation, not a Stripe number. */
export const RESPONSE_PASS_UNDER_MS = 2_000;

/**
 * responds-in-time fails above this. Stripe publishes no general webhook
 * timeout; 10 seconds is how long Checkout waits for a response to
 * checkout.session.completed before redirecting the customer.
 */
export const RESPONSE_FAIL_OVER_MS = 10_000;

// ─── Definitions ─────────────────────────────────────────────────────────────
// Run order matters: valid-event-accepted goes first so the rejection checks
// can tell a handler that verifies signatures from one that refuses everything.

export const CHECKS: readonly CheckDefinition[] = [
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
      'Return 400 without acting on the body. A 2xx means anyone who finds the URL can post events to it.',
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
      'Returning a non-2xx so that Stripe sends it again later works in some designs, which is why this is a warning, ' +
      'but in live mode those retries back off exponentially over up to three days.',
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
      'Stripe does not publish a general timeout. The one figure it documents is that Checkout waits up to 10 seconds for your response to checkout.session.completed before redirecting the customer. ' +
      'The thresholds used here, pass under 2 seconds and fail beyond 10, are the Lab\'s recommendation. ' +
      'Measured on the correctly signed delivery. Acknowledge first and queue slow work.',
  },
];

// ─── Runner Plumbing ─────────────────────────────────────────────────────────

export interface CheckContext {
  secret: string;
  /** Send one request, spaced from the previous one. Never throws. */
  send(options: SendOptions): Promise<Delivery>;
  /** The correctly signed delivery. Sent once per suite and shared. */
  baseline(): Promise<Delivery>;
  /** The baseline delivery, if this suite has already sent it. */
  sentBaseline(): Delivery | undefined;
}

export interface Verdict {
  status: CheckStatus;
  observed: string;
}

export interface CheckOutcome {
  expected: string;
  verdict: Verdict;
  deliveries: Delivery[];
}

type CheckRunner = (ctx: CheckContext) => Promise<CheckOutcome>;

const nowSeconds = () => Math.floor(Date.now() / 1000);
const is2xx = (status: number) => status >= 200 && status < 300;
const is3xx = (status: number) => status >= 300 && status < 400;
const is4xx = (status: number) => status >= 400 && status < 500;
const is5xx = (status: number) => status >= 500 && status < 600;

/** The baseline event: correctly signed, current timestamp. */
export async function sendBaseline(ctx: Pick<CheckContext, 'secret' | 'send'>): Promise<Delivery> {
  const event = invoicePaymentFailed();
  return ctx.send({ label: 'correctly signed', event, signatureHeader: sign(event, ctx.secret) });
}

function outcome(d: Delivery): string {
  if (d.status === 0) return d.error ?? 'No response';
  return `${d.status} in ${d.durationMs} ms`;
}

function judgeAcceptance(d: Delivery): Verdict {
  if (d.status === 0) return { status: 'error', observed: outcome(d) };
  if (is2xx(d.status)) return { status: 'pass', observed: outcome(d) };
  if (is3xx(d.status)) {
    return { status: 'fail', observed: `${outcome(d)}, and Stripe counts a redirect as a failure` };
  }
  return { status: 'fail', observed: outcome(d) };
}

function judgeRejection(d: Delivery, baseline: Delivery | undefined): Verdict {
  if (d.status === 0) return { status: 'error', observed: outcome(d) };
  if (is2xx(d.status)) return { status: 'fail', observed: `${outcome(d)}, accepted` };
  if (is4xx(d.status)) {
    if (baseline && baseline.status !== 0 && !is2xx(baseline.status)) {
      return {
        status: 'warn',
        observed: `${outcome(d)}, but the correctly signed event got ${baseline.status} too`,
      };
    }
    return { status: 'pass', observed: outcome(d) };
  }
  if (is5xx(d.status)) return { status: 'warn', observed: `${outcome(d)}, a server error rather than a 4xx` };
  return { status: 'warn', observed: `${outcome(d)}, not a 4xx` };
}

/** Both deliveries must be 2xx; anything else gets `otherwise`. */
function judgePair(
  first: Delivery,
  second: Delivery,
  names: [string, string],
  otherwise: CheckStatus,
): Verdict {
  const failed = [first, second].find((d) => d.status === 0);
  if (failed) return { status: 'error', observed: outcome(failed) };
  const observed = `${names[0]} ${first.status}, ${names[1]} ${second.status}`;
  const ok = is2xx(first.status) && is2xx(second.status);
  return { status: ok ? 'pass' : otherwise, observed };
}

function rejection(
  label: string,
  build: (secret: string) => Omit<SendOptions, 'label'>,
): CheckRunner {
  return async (ctx) => {
    const d = await ctx.send({ label, ...build(ctx.secret) });
    return { expected: '4xx', verdict: judgeRejection(d, ctx.sentBaseline()), deliveries: [d] };
  };
}

// ─── Runners ─────────────────────────────────────────────────────────────────

export const CHECK_RUNNERS: Record<CheckId, CheckRunner> = {
  'valid-event-accepted': async (ctx) => {
    const d = await ctx.baseline();
    return { expected: '2xx', verdict: judgeAcceptance(d), deliveries: [d] };
  },

  'forged-signature-rejected': rejection('forged signature', () => {
    const event = invoicePaymentFailed();
    const otherSecret = `whsec_${randomBytes(16).toString('hex')}`;
    return { event, signatureHeader: sign(event, otherSecret) };
  }),

  'missing-signature-rejected': rejection('no signature', () => ({
    event: invoicePaymentFailed(),
    signatureHeader: null,
  })),

  'tampered-body-rejected': rejection('changed after signing', (secret) => {
    const event = invoicePaymentFailed();
    const signatureHeader = sign(event, secret);
    const tampered = structuredClone(event);
    tampered.data.object.amount_due += 100_000;
    tampered.data.object.amount_remaining += 100_000;
    return { event: tampered, signatureHeader, body: JSON.stringify(tampered) };
  }),

  'stale-timestamp-rejected': rejection('10 minutes old', (secret) => {
    const timestamp = nowSeconds() - STALE_TIMESTAMP_AGE_SECONDS;
    const event = invoicePaymentFailed({ timestamp });
    return { event, signatureHeader: sign(event, secret, timestamp) };
  }),

  'duplicate-delivery-acknowledged': async (ctx) => {
    // Same event type as the valid delivery, so the only variable is the repeat.
    const event = invoicePaymentFailed();
    const firstAt = nowSeconds();
    const first = await ctx.send({
      label: 'first delivery',
      event,
      signatureHeader: sign(event, ctx.secret, firstAt),
    });
    // A redelivery is signed again; make sure its timestamp differs.
    const second = await ctx.send({
      label: 'second delivery',
      event,
      signatureHeader: sign(event, ctx.secret, Math.max(nowSeconds(), firstAt + 1)),
    });
    return {
      expected: '2xx for both deliveries',
      verdict: judgePair(first, second, ['first', 'second'], 'fail'),
      deliveries: [first, second],
    };
  },

  'out-of-order-acknowledged': async (ctx) => {
    const createdAt = nowSeconds() - 5;
    const created = subscriptionCreated({ status: 'incomplete', timestamp: createdAt });
    const subscription = created.data.object;
    const updated = subscriptionUpdated({
      subscriptionId: subscription.id,
      customerId: subscription.customer,
      status: 'active',
      previousStatus: 'incomplete',
      timestamp: createdAt + 3,
    });
    // Same subscription in both events; only the status moved on.
    updated.data.object = { ...structuredClone(subscription), status: 'active' };

    const first = await ctx.send({
      label: 'customer.subscription.updated, sent first',
      event: updated,
      signatureHeader: sign(updated, ctx.secret),
    });
    const second = await ctx.send({
      label: 'customer.subscription.created, sent second',
      event: created,
      signatureHeader: sign(created, ctx.secret),
    });
    return {
      expected: '2xx for both deliveries',
      verdict: judgePair(first, second, ['updated', 'created'], 'warn'),
      deliveries: [first, second],
    };
  },

  'unhandled-event-acknowledged': async (ctx) => {
    const event = disputeUpdated();
    const d = await ctx.send({
      label: 'charge.dispute.updated',
      event,
      signatureHeader: sign(event, ctx.secret),
    });
    return { expected: '2xx', verdict: judgeAcceptance(d), deliveries: [d] };
  },

  'responds-in-time': async (ctx) => {
    const d = await ctx.baseline();
    const expected = `under ${RESPONSE_PASS_UNDER_MS} ms`;
    if (d.timedOut) return { expected, verdict: { status: 'fail', observed: outcome(d) }, deliveries: [d] };
    if (d.status === 0) return { expected, verdict: { status: 'error', observed: outcome(d) }, deliveries: [d] };

    const observed = `${d.durationMs} ms`;
    const status: CheckStatus =
      d.durationMs < RESPONSE_PASS_UNDER_MS ? 'pass' : d.durationMs <= RESPONSE_FAIL_OVER_MS ? 'warn' : 'fail';
    return { expected, verdict: { status, observed }, deliveries: [d] };
  },
};
