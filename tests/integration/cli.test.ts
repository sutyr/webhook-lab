// Copyright 2026 Sutyr Inc. SPDX-License-Identifier: Apache-2.0
//
// Runs the CLI from source (main() in src/cli.ts, no build) against real HTTP
// handlers started in this file. The "correct" handler verifies with Stripe's
// official SDK, so a full pass means the Lab's deliveries are indistinguishable
// from Stripe's as far as stripe.webhooks.constructEvent can tell.

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { createServer, type IncomingMessage, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { readFileSync } from 'node:fs';
import Stripe from 'stripe';
import { CHECKS } from '@webhook-lab/conformance';
import { main, parseSetOptions, type CliIo } from '../../src/cli.js';

const SECRET = 'whsec_cli_integration_secret_value';
const stripe = new Stripe('sk_test_dummy_not_used_for_verification');

// ─── Handlers ────────────────────────────────────────────────────────────────

interface Received {
  path: string;
  body: string;
  signature: string | undefined;
  verified: Stripe.Event | null;
}

let server: Server;
let base: string;
let received: Received[] = [];
const processed = new Set<string>();

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve) => {
    const chunks: Buffer[] = [];
    req.on('data', (c: Buffer) => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
  });
}

beforeAll(async () => {
  server = createServer(async (req, res) => {
    const body = await readBody(req);
    const signature = req.headers['stripe-signature'] as string | undefined;
    let verified: Stripe.Event | null = null;
    try {
      verified = stripe.webhooks.constructEvent(body, signature ?? '', SECRET);
    } catch {
      verified = null;
    }
    received.push({ path: req.url ?? '', body, signature, verified });

    switch (req.url) {
      // Verifies with the official SDK, dedupes on event.id, acknowledges every type.
      case '/correct':
        if (!verified) {
          res.writeHead(400).end('Webhook signature verification failed');
          return;
        }
        processed.add(verified.id);
        res.writeHead(200, { 'Content-Type': 'application/json' }).end('{"received":true}');
        return;
      // Never looks at the signature.
      case '/naive':
        res.writeHead(200).end('ok');
        return;
      case '/broken':
        res.writeHead(500).end('Internal Server Error');
        return;
      default:
        res.writeHead(404).end('not found');
    }
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(async () => {
  server.closeAllConnections();
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

beforeEach(() => {
  received = [];
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

function capture(overrides: Partial<CliIo> = {}) {
  const out: string[] = [];
  const err: string[] = [];
  const io: CliIo = {
    stdout: (t) => void out.push(t),
    stderr: (t) => void err.push(t),
    env: {},
    isTTY: false,
    columns: 80,
    ...overrides,
  };
  return { io, out: () => out.join(''), err: () => err.join('') };
}

async function cli(argv: string[], overrides: Partial<CliIo> = {}) {
  const c = capture(overrides);
  const code = await main(argv, c.io);
  return { code, out: c.out(), err: c.err() };
}

async function closedPortUrl(): Promise<string> {
  const s = createServer();
  await new Promise<void>((resolve) => s.listen(0, '127.0.0.1', resolve));
  const port = (s.address() as AddressInfo).port;
  await new Promise<void>((resolve) => s.close(() => resolve()));
  return `http://127.0.0.1:${port}/webhooks`;
}

// ─── test ────────────────────────────────────────────────────────────────────

describe('webhook-lab test', () => {
  it('passes every check against a handler that verifies with the Stripe SDK', async () => {
    const { code, out, err } = await cli(['test', `${base}/correct`, '--secret', SECRET]);
    expect(err).toBe('');
    expect(code).toBe(0);
    expect(out).toContain(`Testing ${base}/correct`);
    expect(out).toContain('Stripe API version 2026-09-30.endive');
    for (const check of CHECKS) {
      expect(out).toMatch(new RegExp(`PASS +${check.title}`));
    }
    expect(out).toContain('9 passed, 0 failed, 0 warnings, 0 errors');
    // The correctly signed deliveries really did verify with constructEvent.
    expect(received.filter((r) => r.verified).length).toBe(6);
  }, 20_000);

  it('aligns each result line: status, title, observed', async () => {
    const { out } = await cli(['test', `${base}/correct`, '--secret', SECRET]);
    const lines = out.split('\n').filter((l) => /^ {2}(PASS|FAIL|WARN|ERROR)/.test(l));
    expect(lines).toHaveLength(9);
    const observedColumn = new Set(lines.map((l) => l.search(/\d+ (in \d+ )?ms|first|updated/)));
    expect(observedColumn.size).toBe(1);
  }, 20_000);

  it('reads the secret from STRIPE_WEBHOOK_SECRET', async () => {
    const { code, out } = await cli(['test', `${base}/correct`, '--only', 'valid-event-accepted'], {
      env: { STRIPE_WEBHOOK_SECRET: SECRET },
    });
    expect(code).toBe(0);
    expect(out).toContain('1 passed, 0 failed');
  });

  it('exits 1 and explains the failures for a handler that never verifies', async () => {
    const { code, out } = await cli(['test', `${base}/naive`, '--secret', SECRET]);
    expect(code).toBe(1);
    expect(out).toMatch(/FAIL +Rejects a forged signature +200 in \d+ ms, accepted/);
    expect(out).toMatch(/FAIL +Rejects a missing signature/);
    expect(out).toMatch(/FAIL +Rejects a body changed after signing/);
    expect(out).toMatch(/FAIL +Rejects a stale timestamp/);
    expect(out).toContain('5 passed, 4 failed, 0 warnings, 0 errors');
    // The why is printed, indented, under each failure.
    expect(out).toMatch(/\n {9}This event is signed with a different whsec_ secret/);
  }, 20_000);

  it('runs only the checks named with --only', async () => {
    const { code, out } = await cli([
      'test', `${base}/correct`, '--secret', SECRET,
      '--only', 'stale-timestamp-rejected, forged-signature-rejected',
    ]);
    expect(code).toBe(0);
    const lines = out.split('\n').filter((l) => /^ {2}(PASS|FAIL|WARN|ERROR)/.test(l));
    expect(lines.map((l) => l.replace(/^ {2}\w+ +/, '').split('  ')[0])).toEqual([
      'Rejects a forged signature',
      'Rejects a stale timestamp',
    ]);
    expect(received).toHaveLength(2);
  });

  it('prints the report as JSON with --json', async () => {
    const { code, out } = await cli(['test', `${base}/naive`, '--secret', SECRET, '--json']);
    expect(code).toBe(1);
    const report = JSON.parse(out);
    expect(report.target).toBe(`${base}/naive`);
    expect(report.apiVersion).toBe('2026-09-30.endive');
    expect(report.summary).toEqual({ pass: 5, fail: 4, warn: 0, error: 0 });
    expect(report.results).toHaveLength(9);
    expect(report.results[0].deliveries[0].responseBody).toBe('ok');
    expect(out).not.toContain(SECRET);
  }, 20_000);

  it('reports errors and exits 1 when nothing is listening', async () => {
    const url = await closedPortUrl();
    const { code, out } = await cli(['test', url, '--secret', SECRET, '--only', 'valid-event-accepted,forged-signature-rejected']);
    expect(code).toBe(1);
    expect(out).toMatch(/ERROR +Accepts a correctly signed event +connect ECONNREFUSED/);
    expect(out).toContain('0 passed, 0 failed, 0 warnings, 2 errors');
  });

  it('exits 2 without a secret', async () => {
    const { code, err, out } = await cli(['test', `${base}/correct`]);
    expect(code).toBe(2);
    expect(out).toBe('');
    expect(err).toContain('A signing secret is required. Pass --secret whsec_... or set STRIPE_WEBHOOK_SECRET.');
    expect(received).toHaveLength(0);
  });

  it('exits 2 for unknown check ids, bad URLs and bad timeouts', async () => {
    expect((await cli(['test', `${base}/correct`, '--secret', SECRET, '--only', 'nope'])).code).toBe(2);
    expect((await cli(['test', 'not a url', '--secret', SECRET])).code).toBe(2);
    expect((await cli(['test', 'ftp://example.com/hook', '--secret', SECRET])).code).toBe(2);
    expect((await cli(['test', `${base}/correct`, '--secret', SECRET, '--timeout', 'soon'])).code).toBe(2);
    expect((await cli(['test', `${base}/correct`, '--secret', SECRET, '--bogus'])).code).toBe(2);
    expect(received).toHaveLength(0);
  });

  it('refuses a --timeout too large for a timer instead of timing out after 1 ms', async () => {
    const { code, err } = await cli([
      'test', `${base}/correct`, '--secret', SECRET, '--timeout', '3000000000',
    ]);
    expect(code).toBe(2);
    expect(err).toContain('--timeout can be at most 2147483647 milliseconds');
    expect(received).toHaveLength(0);
  });
});

// ─── fire ────────────────────────────────────────────────────────────────────

describe('webhook-lab fire', () => {
  it('sends one signed event built from --set options', async () => {
    const { code, out } = await cli([
      'fire', 'invoice.payment_failed', `${base}/correct`, '--secret', SECRET,
      '--set', 'amount=4999', '--set', 'attemptCount=2', '--set', 'metadata.order_id=1042',
    ]);
    expect(code).toBe(0);
    expect(out).toContain(`POST ${base}/correct`);
    expect(out).toMatch(/200 in \d+ ms/);
    expect(out).toContain('{"received":true}');

    expect(received).toHaveLength(1);
    const event = received[0]!.verified!;
    expect(event.type).toBe('invoice.payment_failed');
    const invoice = event.data.object as unknown as Record<string, unknown>;
    expect(invoice.amount_due).toBe(4999);
    expect(invoice.attempt_count).toBe(2);
    expect(invoice.metadata).toEqual({ order_id: '1042' });
  });

  it('exits 1 when the handler does not return 2xx', async () => {
    const { code, out } = await cli(['fire', 'customer.created', `${base}/broken`, '--secret', SECRET]);
    expect(code).toBe(1);
    expect(out).toMatch(/500 in \d+ ms/);
    expect(out).toContain('Internal Server Error');
  });

  it('exits 1 when nothing is listening', async () => {
    const { code, out } = await cli(['fire', 'customer.created', await closedPortUrl(), '--secret', SECRET]);
    expect(code).toBe(1);
    expect(out).toMatch(/No response +connect ECONNREFUSED/);
  });

  it('exits 2 for an unknown event type', async () => {
    const { code, err } = await cli(['fire', 'invoice.nope', `${base}/correct`, '--secret', SECRET]);
    expect(code).toBe(2);
    expect(err).toContain('Unknown event type: invoice.nope');
  });

  it('exits 2, not the handler-failure 1, for an option value the generator does not know', async () => {
    const { code, err } = await cli([
      'fire', 'payment_intent.payment_failed', `${base}/correct`, '--secret', SECRET,
      '--set', 'declineCode=not_a_code',
    ]);
    expect(code).toBe(2);
    expect(err).toContain('Unknown decline code: not_a_code');
    expect(received).toHaveLength(0);
  });

  it('does not treat inherited object keys as event types', async () => {
    expect((await cli(['fire', 'constructor', `${base}/correct`, '--secret', SECRET])).code).toBe(2);
    expect((await cli(['payload', '__proto__'])).code).toBe(2);
  });
});

// ─── scenario ────────────────────────────────────────────────────────────────

describe('webhook-lab scenario', () => {
  it('sends every step in order with shared IDs', async () => {
    const { code, out } = await cli(['scenario', 'subscription-failure', `${base}/correct`, '--secret', SECRET]);
    expect(code).toBe(0);
    // Named as in `webhook-lab list scenarios`.
    expect(out).toContain('Failed Payment Dunning: 7 steps');
    expect(out).toContain('7 of 7 steps returned 2xx');
    expect(out.split('\n').filter((l) => /^ +\d\/7 /.test(l))).toHaveLength(7);

    const events = received.map((r) => r.verified!);
    expect(events.every(Boolean)).toBe(true);
    expect(events.map((e) => e.type)).toEqual([
      'invoice.created',
      'invoice.payment_failed',
      'payment_intent.payment_failed',
      'customer.subscription.updated',
      'invoice.payment_failed',
      'payment_intent.payment_failed',
      'customer.subscription.deleted',
    ]);
    const subId = (events[3]!.data.object as { id: string }).id;
    expect((events[6]!.data.object as { id: string }).id).toBe(subId);
  });

  it('gives the same IDs for the same --seed and new IDs otherwise', async () => {
    const objectIds = async (...extra: string[]) => {
      received = [];
      await cli(['scenario', 'refund-flow', `${base}/correct`, '--secret', SECRET, ...extra]);
      return received.map((r) => (r.verified!.data.object as { id: string }).id);
    };
    const a = await objectIds('--seed', 'fixed');
    const b = await objectIds('--seed', 'fixed');
    const c = await objectIds();
    expect(a).toEqual(b);
    expect(c).not.toEqual(a);
  });

  it('exits 1 when any step is not 2xx, and 2 for an unknown scenario', async () => {
    const broken = await cli(['scenario', 'refund-flow', `${base}/broken`, '--secret', SECRET]);
    expect(broken.code).toBe(1);
    expect(broken.out).toContain('0 of 2 steps returned 2xx');
    expect((await cli(['scenario', 'nope', `${base}/correct`, '--secret', SECRET])).code).toBe(2);
  });
});

// ─── payload ─────────────────────────────────────────────────────────────────

describe('webhook-lab payload', () => {
  it('prints the event JSON and sends nothing', async () => {
    const { code, out } = await cli(['payload', 'customer.subscription.updated', '--set', 'status=past_due']);
    expect(code).toBe(0);
    const event = JSON.parse(out);
    expect(event.object).toBe('event');
    expect(event.type).toBe('customer.subscription.updated');
    expect(event.api_version).toBe('2026-09-30.endive');
    expect(event.data.object.id).toMatch(/^sub_/);
    expect(event.data.object.status).toBe('past_due');
    expect(received).toHaveLength(0);
  });

  it('exits 2 without an event type', async () => {
    expect((await cli(['payload'])).code).toBe(2);
  });

  it('exits 2 for an option value the generator does not know', async () => {
    const { code, err } = await cli(['payload', 'customer.subscription.paused', '--set', 'pauseReason=vacation']);
    expect(code).toBe(2);
    expect(err).toContain('Unknown pause reason: vacation');
  });
});

describe('parseSetOptions', () => {
  it('parses numbers and booleans and keeps everything else a string', () => {
    expect(
      parseSetOptions([
        'amount=4999', 'ratio=0.5', 'captured=false', 'cancelAtPeriodEnd=true',
        'customerId=cus_123', 'currency=eur', 'note=a=b', 'big=12345678901234567890',
      ]),
    ).toEqual({
      amount: 4999,
      ratio: 0.5,
      captured: false,
      cancelAtPeriodEnd: true,
      customerId: 'cus_123',
      currency: 'eur',
      note: 'a=b',
      big: '12345678901234567890',
    });
  });

  it('keeps metadata values as strings', () => {
    expect(parseSetOptions(['metadata.order_id=1042', 'metadata.plan=pro'])).toEqual({
      metadata: { order_id: '1042', plan: 'pro' },
    });
  });

  it('rejects malformed pairs and unsafe keys', () => {
    expect(() => parseSetOptions(['amount'])).toThrow(/key=value/);
    expect(() => parseSetOptions(['=5'])).toThrow(/key=value/);
    expect(() => parseSetOptions(['__proto__=1'])).toThrow(/option name/);
    expect(() => parseSetOptions(['metadata.__proto__=1'])).toThrow(/metadata key/);
  });
});

// ─── list, help, version ─────────────────────────────────────────────────────

describe('webhook-lab list', () => {
  it('lists events, scenarios and checks', async () => {
    const { code, out } = await cli(['list']);
    expect(code).toBe(0);
    expect(out).toMatch(/^Events \(\d+\)/);
    expect(out).toMatch(/invoice\.payment_failed +billing/);
    expect(out).toContain('Scenarios (8)');
    expect(out).toMatch(/subscription-failure +Failed Payment Dunning, 7 steps/);
    expect(out).toContain('Checks (9)');
  });

  it('lists one section at a time', async () => {
    const { code, out } = await cli(['list', 'checks']);
    expect(code).toBe(0);
    expect(out).not.toContain('Events');
    for (const check of CHECKS) expect(out).toContain(check.id);
  });

  it('exits 2 for an unknown section', async () => {
    expect((await cli(['list', 'webhooks'])).code).toBe(2);
  });
});

describe('webhook-lab help and version', () => {
  it('prints help with localhost examples', async () => {
    for (const argv of [[], ['--help'], ['-h'], ['test', '--help']]) {
      const { code, out } = await cli(argv);
      expect(code).toBe(0);
      expect(out).toContain('webhook-lab test http://localhost:3000/webhooks');
    }
  });

  it('keeps em dashes and middle dots out of the help', async () => {
    const { out } = await cli(['--help']);
    expect(out).not.toMatch(/[\u2014\u00B7\u2022]/);
  });

  it('prints the version from package.json', async () => {
    const pkg = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8'));
    for (const flag of ['--version', '-v']) {
      const { code, out } = await cli([flag]);
      expect(code).toBe(0);
      expect(out).toBe(`${pkg.version}\n`);
    }
  });

  it('exits 2 for an unknown command', async () => {
    const { code, err } = await cli(['deploy']);
    expect(code).toBe(2);
    expect(err).toContain('Unknown command: deploy');
  });
});

describe('colour', () => {
  const ESC = '\x1b[';

  it('is used on a terminal', async () => {
    const { out } = await cli(['list', 'checks'], { isTTY: true });
    expect(out).toContain(ESC);
  });

  it('is not used when NO_COLOR is set', async () => {
    const { out } = await cli(['list', 'checks'], { isTTY: true, env: { NO_COLOR: '1' } });
    expect(out).not.toContain(ESC);
  });

  it('is not used when output is not a terminal', async () => {
    const { out } = await cli(['list', 'checks'], { isTTY: false });
    expect(out).not.toContain(ESC);
  });
});
