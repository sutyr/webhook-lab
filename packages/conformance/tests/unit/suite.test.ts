// Copyright 2026 Sutyr Inc. SPDX-License-Identifier: Apache-2.0
import { describe, it, expect } from 'vitest';
import { STRIPE_API_VERSION } from '@webhook-lab/events';
import { verify } from '@webhook-lab/signatures';
import {
  CHECKS,
  STRIPE_USER_AGENT,
  runSuite,
  selectChecks,
  type CheckResult,
  type CheckStatus,
  type Transport,
  type TransportRequest,
} from '../../src/index.js';

const SECRET = 'whsec_conformance_test_secret';
const URL = 'http://localhost:3000/webhooks';

// ─── Fake Handlers ───────────────────────────────────────────────────────────

interface FakeReply {
  status: number;
  body?: string;
  durationMs?: number;
  error?: string;
  timedOut?: boolean;
}

type Handler = (req: TransportRequest) => FakeReply;

function fakeTransport(handler: Handler): Transport & { requests: TransportRequest[] } {
  const requests: TransportRequest[] = [];
  const transport = async (req: TransportRequest) => {
    requests.push(req);
    const reply = handler(req);
    return {
      status: reply.status,
      body: reply.body ?? '',
      durationMs: reply.durationMs ?? 5,
      ...(reply.error !== undefined ? { error: reply.error } : {}),
      ...(reply.timedOut ? { timedOut: true } : {}),
    };
  };
  return Object.assign(transport, { requests });
}

function header(req: TransportRequest, name: string): string | undefined {
  const key = Object.keys(req.headers).find((k) => k.toLowerCase() === name.toLowerCase());
  return key === undefined ? undefined : req.headers[key];
}

/** What a careful handler does: verify, dedupe on event.id, 2xx everything else. */
function correctHandler(secret = SECRET): Handler {
  const seen = new Set<string>();
  return (req) => {
    const signature = header(req, 'stripe-signature');
    if (!signature || !verify(req.body, signature, secret, 300)) {
      return { status: 400, body: '{"error":"invalid signature"}' };
    }
    const event = JSON.parse(req.body) as { id: string };
    if (seen.has(event.id)) return { status: 200, body: '{"received":true,"duplicate":true}' };
    seen.add(event.id);
    return { status: 200, body: '{"received":true}' };
  };
}

/** Accepts anything without looking at the signature. */
const naiveHandler: Handler = () => ({ status: 200, body: 'ok' });

function statuses(results: CheckResult[]): Record<string, CheckStatus> {
  return Object.fromEntries(results.map((r) => [r.id, r.status]));
}

function run(transport: Transport, extra: Partial<Parameters<typeof runSuite>[0]> = {}) {
  return runSuite({ url: URL, secret: SECRET, transport, spacingMs: 0, ...extra });
}

// ─── CHECKS ──────────────────────────────────────────────────────────────────

describe('CHECKS', () => {
  it('lists the nine checks in run order', () => {
    expect(CHECKS.map((c) => c.id)).toEqual([
      'valid-event-accepted',
      'forged-signature-rejected',
      'missing-signature-rejected',
      'tampered-body-rejected',
      'stale-timestamp-rejected',
      'duplicate-delivery-acknowledged',
      'out-of-order-acknowledged',
      'unhandled-event-acknowledged',
      'responds-in-time',
    ]);
  });

  it('gives every check a title and a why', () => {
    for (const check of CHECKS) {
      expect(check.title.length).toBeGreaterThan(0);
      expect(check.why.length).toBeGreaterThan(40);
    }
  });

  it('keeps em dashes and middle dots out of user-facing copy', () => {
    for (const check of CHECKS) {
      expect(`${check.title} ${check.why}`).not.toMatch(/[\u2014\u00B7\u2022]/);
    }
  });

  it('is honest that the Lab cannot see side effects of a duplicate', () => {
    const dup = CHECKS.find((c) => c.id === 'duplicate-delivery-acknowledged')!;
    expect(dup.why).toMatch(/cannot tell/);
    expect(dup.why).toMatch(/event\.id/);
  });
});

// ─── A Correct Handler ───────────────────────────────────────────────────────

describe('runSuite against a correct handler', () => {
  it('passes every check', async () => {
    const report = await run(fakeTransport(correctHandler()));
    expect(statuses(report.results)).toEqual(
      Object.fromEntries(CHECKS.map((c) => [c.id, 'pass'])),
    );
    expect(report.summary).toEqual({ pass: 9, fail: 0, warn: 0, error: 0 });
  });

  it('reports the target and the Stripe API version', async () => {
    const report = await run(fakeTransport(correctHandler()));
    expect(report.target).toBe(URL);
    expect(report.apiVersion).toBe(STRIPE_API_VERSION);
  });

  it('fills every result field', async () => {
    const report = await run(fakeTransport(correctHandler()));
    for (const r of report.results) {
      const def = CHECKS.find((c) => c.id === r.id)!;
      expect(r.title).toBe(def.title);
      expect(r.why).toBe(def.why);
      expect(r.expected).not.toBe('');
      expect(r.observed).not.toBe('');
      expect(r.deliveries.length).toBeGreaterThan(0);
      expect(r.durationMs).toBe(r.deliveries.reduce((t, d) => t + d.durationMs, 0));
    }
  });

  it('calls onResult once per check, in order', async () => {
    const seen: string[] = [];
    await run(fakeTransport(correctHandler()), { onResult: (r) => seen.push(r.id) });
    expect(seen).toEqual(CHECKS.map((c) => c.id));
  });

  it('sends ten deliveries: responds-in-time reuses the valid one', async () => {
    const transport = fakeTransport(correctHandler());
    await run(transport);
    expect(transport.requests).toHaveLength(10);
  });
});

// ─── Request Shape ───────────────────────────────────────────────────────────

describe('requests look like Stripe deliveries', () => {
  async function requestsFor(id: string) {
    const transport = fakeTransport(correctHandler());
    await run(transport, { only: [id] });
    return transport.requests;
  }

  it('sends JSON with Stripe\'s User-Agent and a correct signature', async () => {
    const [req] = await requestsFor('valid-event-accepted');
    expect(header(req!, 'content-type')).toBe('application/json');
    expect(header(req!, 'user-agent')).toBe(STRIPE_USER_AGENT);
    expect(header(req!, 'user-agent')).toBe('Stripe/1.0 (+https://stripe.com/docs/webhooks)');
    expect(header(req!, 'x-webhook-lab-request-id')).toMatch(/^[0-9a-f-]{36}$/);
    const signature = header(req!, 'stripe-signature')!;
    expect(signature).toMatch(/^t=\d+,v1=[0-9a-f]{64}$/);
    expect(verify(req!.body, signature, SECRET, 300)).toBe(true);

    const event = JSON.parse(req!.body);
    expect(event.object).toBe('event');
    expect(event.type).toBe('invoice.payment_failed');
    expect(event.id).toMatch(/^evt_/);
    expect(event.api_version).toBe(STRIPE_API_VERSION);
  });

  it('signs the forged delivery with a secret that is not the handler\'s', async () => {
    const [req] = await requestsFor('forged-signature-rejected');
    const signature = header(req!, 'stripe-signature')!;
    expect(signature).toMatch(/^t=\d+,v1=[0-9a-f]{64}$/);
    expect(verify(req!.body, signature, SECRET, 300)).toBe(false);
  });

  it('sends no Stripe-Signature header for the missing-signature check', async () => {
    const [req] = await requestsFor('missing-signature-rejected');
    expect(header(req!, 'stripe-signature')).toBeUndefined();
    expect(header(req!, 'user-agent')).toBe(STRIPE_USER_AGENT);
  });

  it('changes the body after signing for the tampered check', async () => {
    const [req] = await requestsFor('tampered-body-rejected');
    const signature = header(req!, 'stripe-signature')!;
    expect(verify(req!.body, signature, SECRET, 300)).toBe(false);

    const tampered = JSON.parse(req!.body);
    const original = structuredClone(tampered);
    original.data.object.amount_due -= 100_000;
    original.data.object.amount_remaining -= 100_000;
    // The header is a genuine signature for the original body.
    expect(verify(JSON.stringify(original), signature, SECRET, 300)).toBe(true);
  });

  it('signs the stale delivery correctly, 10 minutes in the past', async () => {
    const [req] = await requestsFor('stale-timestamp-rejected');
    const signature = header(req!, 'stripe-signature')!;
    const t = Number(/^t=(\d+)/.exec(signature)![1]);
    const age = Math.floor(Date.now() / 1000) - t;
    expect(age).toBeGreaterThanOrEqual(600);
    expect(age).toBeLessThan(610);
    // Valid signature, only the age is wrong.
    expect(verify(req!.body, signature, SECRET, 3600)).toBe(true);
    expect(verify(req!.body, signature, SECRET, 300)).toBe(false);
  });

  it('delivers the same event twice with different timestamps', async () => {
    const [first, second] = await requestsFor('duplicate-delivery-acknowledged');
    expect(first!.body).toBe(second!.body);
    // Same type as the valid delivery, so the repeat is the only variable.
    expect(JSON.parse(first!.body).type).toBe('invoice.payment_failed');
    const t1 = /^t=(\d+)/.exec(header(first!, 'stripe-signature')!)![1];
    const t2 = /^t=(\d+)/.exec(header(second!, 'stripe-signature')!)![1];
    expect(t1).not.toBe(t2);
    expect(verify(second!.body, header(second!, 'stripe-signature')!, SECRET, 300)).toBe(true);
  });

  it('sends subscription.updated before subscription.created for one subscription', async () => {
    const [first, second] = await requestsFor('out-of-order-acknowledged');
    const updated = JSON.parse(first!.body);
    const created = JSON.parse(second!.body);
    expect(updated.type).toBe('customer.subscription.updated');
    expect(created.type).toBe('customer.subscription.created');
    expect(updated.data.object.id).toMatch(/^sub_/);
    expect(updated.data.object.id).toBe(created.data.object.id);
    expect(updated.data.object.customer).toBe(created.data.object.customer);
    expect(created.data.object.status).toBe('incomplete');
    expect(updated.data.object.status).toBe('active');
    expect(updated.data.previous_attributes).toEqual({ status: 'incomplete' });
    expect(updated.created).toBeGreaterThan(created.created);
    expect(updated.id).not.toBe(created.id);
  });

  it('uses charge.dispute.updated as the unhandled type', async () => {
    const [req] = await requestsFor('unhandled-event-acknowledged');
    const event = JSON.parse(req!.body);
    expect(event.type).toBe('charge.dispute.updated');
    expect(event.data.object.id).toMatch(/^dp_/);
  });

  it('uses a fresh event for every check', async () => {
    const transport = fakeTransport(correctHandler());
    await run(transport);
    const ids = transport.requests.map((r) => JSON.parse(r.body).id as string);
    // Ten deliveries, one of them the intentional duplicate.
    expect(new Set(ids).size).toBe(9);
  });
});

// ─── A Naive Handler ─────────────────────────────────────────────────────────

describe('runSuite against a handler that never verifies', () => {
  it('fails the four signature checks and passes the rest', async () => {
    const report = await run(fakeTransport(naiveHandler));
    expect(statuses(report.results)).toEqual({
      'valid-event-accepted': 'pass',
      'forged-signature-rejected': 'fail',
      'missing-signature-rejected': 'fail',
      'tampered-body-rejected': 'fail',
      'stale-timestamp-rejected': 'fail',
      'duplicate-delivery-acknowledged': 'pass',
      'out-of-order-acknowledged': 'pass',
      'unhandled-event-acknowledged': 'pass',
      'responds-in-time': 'pass',
    });
    expect(report.summary).toEqual({ pass: 5, fail: 4, warn: 0, error: 0 });
    const forged = report.results.find((r) => r.id === 'forged-signature-rejected')!;
    expect(forged.expected).toBe('4xx');
    expect(forged.observed).toBe('200 in 5 ms, accepted');
  });
});

// ─── Other Handlers ──────────────────────────────────────────────────────────

describe('runSuite judging other behaviour', () => {
  it('warns between 2 and 10 seconds and fails beyond', async () => {
    const at = async (durationMs: number) => {
      const report = await run(
        fakeTransport((req) => ({ ...correctHandler()(req), durationMs })),
        { only: ['responds-in-time'] },
      );
      return report.results[0]!;
    };
    expect((await at(1_999)).status).toBe('pass');
    expect((await at(2_000)).status).toBe('warn');
    expect((await at(10_000)).status).toBe('warn');
    const slow = await at(10_001);
    expect(slow.status).toBe('fail');
    expect(slow.observed).toBe('10001 ms');
    expect(slow.expected).toBe('under 2000 ms');
  });

  it('fails responds-in-time on a timeout but reports the other checks as errors', async () => {
    const report = await run(
      fakeTransport(() => ({ status: 0, error: 'No response within 10000 ms', timedOut: true, durationMs: 10_000 })),
      { only: ['valid-event-accepted', 'responds-in-time'] },
    );
    expect(statuses(report.results)).toEqual({
      'valid-event-accepted': 'error',
      'responds-in-time': 'fail',
    });
    expect(report.results[1]!.observed).toBe('No response within 10000 ms');
  });

  it('fails unhandled-event-acknowledged when the handler 500s on unknown types', async () => {
    const handled = new Set([
      'invoice.payment_failed',
      'invoice.paid',
      'customer.subscription.created',
      'customer.subscription.updated',
    ]);
    const verifying = correctHandler();
    const report = await run(
      fakeTransport((req) => {
        const reply = verifying(req);
        if (reply.status !== 200) return reply;
        const { type } = JSON.parse(req.body) as { type: string };
        return handled.has(type) ? reply : { status: 500, body: `Unhandled event type ${type}` };
      }),
    );
    const results = statuses(report.results);
    expect(results['unhandled-event-acknowledged']).toBe('fail');
    expect(report.summary).toEqual({ pass: 8, fail: 1, warn: 0, error: 0 });
    const unhandled = report.results.find((r) => r.id === 'unhandled-event-acknowledged')!;
    expect(unhandled.deliveries[0]!.responseBody).toBe('Unhandled event type charge.dispute.updated');
  });

  it('warns when a handler refuses an update for a subscription it has not seen', async () => {
    const verifying = correctHandler();
    const known = new Set<string>();
    const report = await run(
      fakeTransport((req) => {
        const reply = verifying(req);
        if (reply.status !== 200) return reply;
        const event = JSON.parse(req.body);
        if (event.type === 'customer.subscription.created') known.add(event.data.object.id);
        if (event.type === 'customer.subscription.updated' && !known.has(event.data.object.id)) {
          return { status: 404 };
        }
        return reply;
      }),
      { only: ['out-of-order-acknowledged'] },
    );
    expect(report.results[0]!.status).toBe('warn');
    expect(report.results[0]!.observed).toBe('updated 404, created 200');
  });

  it('fails the duplicate check when the repeat gets a non-2xx', async () => {
    const seen = new Set<string>();
    const report = await run(
      fakeTransport((req) => {
        const { id } = JSON.parse(req.body) as { id: string };
        if (seen.has(id)) return { status: 409 };
        seen.add(id);
        return { status: 200 };
      }),
      { only: ['duplicate-delivery-acknowledged'] },
    );
    expect(report.results[0]!.status).toBe('fail');
    expect(report.results[0]!.observed).toBe('first 200, second 409');
  });

  it('warns when a bad signature gets a 5xx instead of a 4xx', async () => {
    const verifying = correctHandler();
    const report = await run(
      fakeTransport((req) => {
        const reply = verifying(req);
        return reply.status === 400 ? { status: 500 } : reply;
      }),
    );
    expect(statuses(report.results)).toMatchObject({
      'forged-signature-rejected': 'warn',
      'missing-signature-rejected': 'warn',
      'tampered-body-rejected': 'warn',
      'stale-timestamp-rejected': 'warn',
    });
  });

  it('does not pass the rejection checks when the valid event was refused too', async () => {
    // Handler verifies with a different secret than the Lab uses.
    const report = await run(fakeTransport(correctHandler('whsec_some_other_secret')));
    const results = statuses(report.results);
    expect(results['valid-event-accepted']).toBe('fail');
    expect(results['forged-signature-rejected']).toBe('warn');
    expect(results['missing-signature-rejected']).toBe('warn');
    const forged = report.results.find((r) => r.id === 'forged-signature-rejected')!;
    expect(forged.observed).toBe('400 in 5 ms, but the correctly signed event got 400 too');
  });

  it('fails acceptance on a redirect, as Stripe does', async () => {
    const report = await run(fakeTransport(() => ({ status: 302 })), {
      only: ['valid-event-accepted'],
    });
    expect(report.results[0]!.status).toBe('fail');
    expect(report.results[0]!.observed).toMatch(/redirect/);
  });
});

// ─── Transport Failures ──────────────────────────────────────────────────────

describe('runSuite when the transport fails', () => {
  it('reports every check as an error when the transport throws', async () => {
    const throwing: Transport = async () => {
      throw new Error('connect ECONNREFUSED 127.0.0.1:3000');
    };
    const report = await run(throwing);
    expect(report.summary).toEqual({ pass: 0, fail: 0, warn: 0, error: 9 });
    for (const r of report.results) {
      expect(r.status).toBe('error');
      expect(r.observed).toBe('connect ECONNREFUSED 127.0.0.1:3000');
    }
  });

  it('reports a transport error result as an error', async () => {
    const report = await run(
      fakeTransport(() => ({ status: 0, error: 'getaddrinfo ENOTFOUND nope.invalid' })),
      { only: ['forged-signature-rejected'] },
    );
    expect(report.results[0]!.status).toBe('error');
    expect(report.results[0]!.observed).toBe('getaddrinfo ENOTFOUND nope.invalid');
  });
});

// ─── Options ─────────────────────────────────────────────────────────────────

describe('runSuite options', () => {
  it('runs only the selected checks, in CHECKS order', async () => {
    const report = await run(fakeTransport(correctHandler()), {
      only: ['responds-in-time', 'forged-signature-rejected'],
    });
    expect(report.results.map((r) => r.id)).toEqual([
      'forged-signature-rejected',
      'responds-in-time',
    ]);
  });

  it('rejects unknown check ids', async () => {
    await expect(run(fakeTransport(correctHandler()), { only: ['nope'] })).rejects.toThrow(
      /Unknown check id: nope/,
    );
    expect(() => selectChecks(['valid-event-accepted', 'typo'])).toThrow(RangeError);
  });

  it('requires a secret', async () => {
    await expect(run(fakeTransport(correctHandler()), { secret: '' })).rejects.toThrow(/secret/);
  });

  it('spaces deliveries apart', async () => {
    const times: number[] = [];
    const transport = fakeTransport((req) => {
      times.push(performance.now());
      return correctHandler()(req);
    });
    await run(transport, { only: ['duplicate-delivery-acknowledged'], spacingMs: 40 });
    expect(times[1]! - times[0]!).toBeGreaterThanOrEqual(35);
  });
});
