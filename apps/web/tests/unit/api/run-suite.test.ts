// Copyright 2026 Sutyr Inc. SPDX-License-Identifier: Apache-2.0

import { createHmac, timingSafeEqual } from 'node:crypto';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { lookup } from 'node:dns/promises';
import { CHECKS, STRIPE_USER_AGENT } from '@webhook-lab/conformance';
import { STRIPE_API_VERSION } from '@webhook-lab/events';
import { POST } from '@/app/api/run-suite/route';
import { cliCommand, suiteTransport } from '@/lib/suite-transport';

// Resolve domain targets to a public IP by default so tests run offline.
// Individual tests override this to simulate a domain resolving internally.
vi.mock('node:dns/promises', () => ({
  lookup: vi.fn(async () => [{ address: '93.184.216.34', family: 4 }]),
}));

// The route's network fakes are fetch-based. Pinning itself is covered in
// tests/unit/lib/pinned-transport.test.ts, so here it delegates to fetch.
vi.mock('@/lib/pinned-transport', async () => {
  const { fetchTransport } = await import('@webhook-lab/conformance');
  return {
    pinnedTransport: (o: { timeoutMs: number; maxBodyBytes: number }) =>
      fetchTransport({ timeoutMs: o.timeoutMs, maxBodyBytes: o.maxBodyBytes }),
  };
});

const originalFetch = global.fetch;
const SECRET = 'whsec_run_suite_test_secret';
const TARGET = 'https://example.com/webhooks/stripe';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

// Every request gets its own client IP unless a test sets one, so the
// per-IP rate limits never leak between tests.
let clientCounter = 0;

function makeRequest(body: unknown, ip = `client-${++clientCounter}`): Request {
  return new Request('http://localhost/api/run-suite', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-real-ip': ip },
    body: JSON.stringify(body),
  });
}

// ─── A handler that verifies the way Stripe's libraries do ──────────────────
// HMAC-SHA256 over `${t}.${rawBody}` with the secret used verbatim, and a 300
// second tolerance on t. Returns 400 when verification fails, 200 otherwise.

function verifies(header: string, rawBody: string, secret: string): boolean {
  const fields = new Map<string, string>();
  for (const part of header.split(',')) {
    const at = part.indexOf('=');
    if (at > 0) fields.set(part.slice(0, at), part.slice(at + 1));
  }
  const t = Number(fields.get('t'));
  const v1 = fields.get('v1') ?? '';
  if (!Number.isInteger(t) || Math.abs(Date.now() / 1000 - t) > 300) return false;
  const expected = createHmac('sha256', secret).update(`${t}.${rawBody}`).digest('hex');
  return v1.length === expected.length && timingSafeEqual(Buffer.from(v1), Buffer.from(expected));
}

function stripeLikeHandler(secret = SECRET) {
  return vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
    const signature = new Headers(init?.headers).get('stripe-signature');
    if (!signature || !verifies(signature, String(init?.body ?? ''), secret)) {
      return new Response('Webhook signature verification failed', { status: 400 });
    }
    return Response.json({ received: true });
  });
}

/** A fetch that never answers until its AbortSignal fires. */
function hangingFetch() {
  return vi.fn(
    (_url: string | URL | Request, init?: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () =>
          reject(new DOMException('This operation was aborted', 'AbortError')),
        );
      }),
  );
}

function fetchCalls() {
  return vi.mocked(global.fetch).mock.calls as Array<[string, RequestInit]>;
}

describe('POST /api/run-suite', () => {
  beforeEach(() => {
    global.fetch = stripeLikeHandler() as unknown as typeof fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.unstubAllEnvs();
  });

  // ─── Kill switch ────────────────────────────────────────────────────────────

  it('returns 503 FIRING_DISABLED when WEBHOOK_LAB_DISABLE_FIRE=true', async () => {
    vi.stubEnv('WEBHOOK_LAB_DISABLE_FIRE', 'true');
    const response = await POST(makeRequest({ targetUrl: TARGET, signingSecret: SECRET }));
    const data = await response.json();
    expect(response.status).toBe(503);
    expect(data.error.code).toBe('FIRING_DISABLED');
    expect(global.fetch).not.toHaveBeenCalled();
  });

  // ─── Request validation ─────────────────────────────────────────────────────

  it('returns 415 when Content-Type is not JSON', async () => {
    const request = new Request('http://localhost/api/run-suite', {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain', 'x-real-ip': `client-${++clientCounter}` },
      body: JSON.stringify({ targetUrl: TARGET, signingSecret: SECRET }),
    });
    const response = await POST(request);
    expect(response.status).toBe(415);
    expect((await response.json()).error.code).toBe('INVALID_CONTENT_TYPE');
  });

  it('returns 400 INVALID_REQUEST when the body is not a JSON object', async () => {
    for (const body of [[TARGET], null, 'https://example.com']) {
      const response = await POST(makeRequest(body));
      expect(response.status).toBe(400);
      expect((await response.json()).error.code).toBe('INVALID_REQUEST');
    }
  });

  it('returns 400 INVALID_URL when targetUrl is missing or not a string', async () => {
    for (const targetUrl of [undefined, '', 42]) {
      const response = await POST(makeRequest({ targetUrl, signingSecret: SECRET }));
      expect(response.status).toBe(400);
      expect((await response.json()).error.code).toBe('INVALID_URL');
    }
  });

  it('returns 400 INVALID_URL for a URL without a scheme', async () => {
    const response = await POST(makeRequest({ targetUrl: 'not-a-url', signingSecret: SECRET }));
    expect(response.status).toBe(400);
    expect((await response.json()).error.code).toBe('INVALID_URL');
  });

  it('returns 400 BLOCKED_SCHEME for non-http schemes', async () => {
    for (const targetUrl of ['file:///etc/passwd', 'javascript:alert(1)', 'data:text/html,<h1>hi</h1>']) {
      const response = await POST(makeRequest({ targetUrl, signingSecret: SECRET }));
      expect(response.status).toBe(400);
      expect((await response.json()).error.code).toBe('BLOCKED_SCHEME');
    }
  });

  it('returns 400 INVALID_REQUEST when signingSecret is missing, empty or not a string', async () => {
    for (const signingSecret of [undefined, '', 123]) {
      const response = await POST(makeRequest({ targetUrl: TARGET, signingSecret }));
      const data = await response.json();
      expect(response.status).toBe(400);
      expect(data.error.code).toBe('INVALID_REQUEST');
      expect(data.error.message).toContain('signingSecret');
    }
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('returns 400 INVALID_REQUEST when only is not a non-empty array of strings', async () => {
    for (const only of ['valid-event-accepted', [], [1, 2], {}]) {
      const response = await POST(makeRequest({ targetUrl: TARGET, signingSecret: SECRET, only }));
      expect(response.status).toBe(400);
      expect((await response.json()).error.code).toBe('INVALID_REQUEST');
    }
  });

  it('returns 400 UNKNOWN_CHECK naming the unknown id', async () => {
    const response = await POST(
      makeRequest({ targetUrl: TARGET, signingSecret: SECRET, only: ['valid-event-accepted', 'no-such-check'] }),
    );
    const data = await response.json();
    expect(response.status).toBe(400);
    expect(data.error.code).toBe('UNKNOWN_CHECK');
    expect(data.error.message).toContain('no-such-check');
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('rejects a targetUrl with newlines (header injection)', async () => {
    const response = await POST(
      makeRequest({ targetUrl: 'https://example.com\r\nInjected: header', signingSecret: SECRET }),
    );
    expect(response.status).toBe(400);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('all error responses have the { error: { code, message } } shape', async () => {
    const cases = [
      makeRequest({ signingSecret: SECRET }),
      makeRequest({ targetUrl: TARGET }),
      makeRequest({ targetUrl: TARGET, signingSecret: SECRET, only: ['nope'] }),
      makeRequest({ targetUrl: 'http://localhost:3000/webhooks', signingSecret: SECRET }),
    ];
    for (const request of cases) {
      const data = await (await POST(request)).json();
      expect(Object.keys(data)).toEqual(['error']);
      expect(typeof data.error.code).toBe('string');
      expect(typeof data.error.message).toBe('string');
    }
  });

  // ─── SSRF protection and the CLI hint ───────────────────────────────────────

  it('blocks localhost and tells the user to run the CLI instead', async () => {
    const response = await POST(
      makeRequest({ targetUrl: 'http://localhost:3000/webhooks', signingSecret: SECRET }),
    );
    const data = await response.json();
    expect(response.status).toBe(400);
    expect(data.error.code).toBe('BLOCKED_HOST');
    expect(data.error.message).toContain('npx @sutyr/webhook-lab test http://localhost:3000/webhooks');
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it.each([
    ['http://127.0.0.1:4242/webhook', 'http://127.0.0.1:4242/webhook'],
    ['http://10.0.0.8/webhook', 'http://10.0.0.8/webhook'],
    ['http://192.168.1.20:8080/stripe', 'http://192.168.1.20:8080/stripe'],
    // Brackets are glob characters in zsh, so the IPv6 literal is quoted.
    ['http://[::1]:3000/webhook', "'http://[::1]:3000/webhook'"],
  ])('blocks the private address %s with the CLI hint', async (targetUrl, arg) => {
    const response = await POST(makeRequest({ targetUrl, signingSecret: SECRET }));
    const data = await response.json();
    expect(response.status).toBe(400);
    expect(data.error.code).toBe('BLOCKED_IP');
    expect(data.error.message).toContain(`npx @sutyr/webhook-lab test ${arg}`);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('blocks a domain that resolves to a private IP, with the CLI hint', async () => {
    vi.mocked(lookup).mockResolvedValueOnce([{ address: '10.0.0.5', family: 4 }] as never);
    const response = await POST(
      makeRequest({ targetUrl: 'https://internal.example.com/webhooks', signingSecret: SECRET }),
    );
    const data = await response.json();
    expect(response.status).toBe(400);
    expect(data.error.code).toBe('BLOCKED_IP');
    expect(data.error.message).toContain('npx @sutyr/webhook-lab test https://internal.example.com/webhooks');
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('quotes a localhost URL with a query string so the hint pastes into a shell', async () => {
    const response = await POST(
      makeRequest({ targetUrl: 'http://localhost:3000/webhooks?tenant=a&debug=1', signingSecret: SECRET }),
    );
    const data = await response.json();
    expect(data.error.message).toContain(
      "npx @sutyr/webhook-lab test 'http://localhost:3000/webhooks?tenant=a&debug=1'",
    );
  });

  it('does not suggest the CLI for a cloud metadata host', async () => {
    const response = await POST(
      makeRequest({ targetUrl: 'http://metadata.google.internal/computeMetadata/v1/', signingSecret: SECRET }),
    );
    const data = await response.json();
    expect(response.status).toBe(400);
    expect(data.error.code).toBe('BLOCKED_HOST');
    expect(data.error.message).not.toContain('npx');
  });

  it('reaches localhost when WEBHOOK_LAB_ALLOW_PRIVATE=true (self-hosted)', async () => {
    vi.stubEnv('WEBHOOK_LAB_ALLOW_PRIVATE', 'true');
    const response = await POST(
      makeRequest({
        targetUrl: 'http://localhost:3000/webhooks',
        signingSecret: SECRET,
        only: ['valid-event-accepted'],
      }),
    );
    const data = await response.json();
    expect(response.status).toBe(200);
    expect(data.results[0].status).toBe('pass');
    expect(fetchCalls()[0][0]).toBe('http://localhost:3000/webhooks');
  });

  it('re-validates the host before each delivery (DNS rebinding)', async () => {
    // The route's check sees a public address, then the record flips.
    vi.mocked(lookup)
      .mockResolvedValueOnce([{ address: '93.184.216.34', family: 4 }] as never)
      .mockResolvedValueOnce([{ address: '169.254.169.254', family: 4 }] as never);
    const response = await POST(
      makeRequest({ targetUrl: TARGET, signingSecret: SECRET, only: ['valid-event-accepted'] }),
    );
    const data = await response.json();
    expect(response.status).toBe(200);
    expect(data.results[0].status).toBe('error');
    expect(data.results[0].observed).toContain('169.254.169.254');
    expect(global.fetch).not.toHaveBeenCalled();
  });

  // ─── Running the suite ──────────────────────────────────────────────────────

  it('returns a passing SuiteReport plus requestId for a handler that verifies correctly', async () => {
    const response = await POST(makeRequest({ targetUrl: TARGET, signingSecret: SECRET }));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.requestId).toMatch(UUID);
    expect(data.target).toBe(TARGET);
    expect(data.apiVersion).toBe(STRIPE_API_VERSION);
    expect(data.results.map((r: { id: string }) => r.id)).toEqual(CHECKS.map((c) => c.id));
    for (const result of data.results) {
      expect(result.status, `${result.id}: ${result.observed}`).toBe('pass');
    }
    expect(data.summary).toEqual({ pass: CHECKS.length, fail: 0, warn: 0, error: 0 });

    // Every delivery left through the hardened path: POST to the validated
    // URL, no redirects, a timeout signal, Stripe's headers and a request id.
    const calls = fetchCalls();
    expect(calls.length).toBe(10);
    const requestIds = new Set<string>();
    for (const [url, init] of calls) {
      expect(url).toBe(TARGET);
      expect(init.method).toBe('POST');
      expect(init.redirect).toBe('manual');
      expect(init.signal).toBeInstanceOf(AbortSignal);
      const headers = new Headers(init.headers);
      expect(headers.get('content-type')).toBe('application/json');
      expect(headers.get('user-agent')).toBe(STRIPE_USER_AGENT);
      expect(headers.get('x-webhook-lab-request-id')).toMatch(UUID);
      requestIds.add(headers.get('x-webhook-lab-request-id')!);
    }
    expect(requestIds.size).toBe(calls.length);

    const deliveryIds = data.results.flatMap((r: { deliveries: Array<{ requestId: string }> }) =>
      r.deliveries.map((d) => d.requestId),
    );
    for (const id of deliveryIds) expect(requestIds.has(id)).toBe(true);
  });

  it('reports a handler that verifies with a different secret instead of passing it', async () => {
    global.fetch = stripeLikeHandler('whsec_some_other_secret') as unknown as typeof fetch;
    const response = await POST(
      makeRequest({
        targetUrl: TARGET,
        signingSecret: SECRET,
        only: ['valid-event-accepted', 'forged-signature-rejected'],
      }),
    );
    const data = await response.json();
    expect(response.status).toBe(200);
    expect(data.results.map((r: { status: string }) => r.status)).toEqual(['fail', 'warn']);
  });

  it('runs only the requested checks, in suite order', async () => {
    const response = await POST(
      makeRequest({
        targetUrl: TARGET,
        signingSecret: SECRET,
        only: ['responds-in-time', 'valid-event-accepted'],
      }),
    );
    const data = await response.json();
    expect(data.results.map((r: { id: string }) => r.id)).toEqual(['valid-event-accepted', 'responds-in-time']);
    // responds-in-time reuses the correctly signed delivery.
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('caps a large response body', async () => {
    global.fetch = vi.fn(async () => new Response('x'.repeat(2 * 1024 * 1024))) as unknown as typeof fetch;
    const response = await POST(
      makeRequest({ targetUrl: TARGET, signingSecret: SECRET, only: ['valid-event-accepted'] }),
    );
    const data = await response.json();
    expect(response.status).toBe(200);
    expect(data.results[0].deliveries[0].responseBody.length).toBeLessThanOrEqual(4096);
  });

  it('turns a network failure into an error result, not a failed request', async () => {
    global.fetch = vi.fn(async () => {
      throw new TypeError('fetch failed', { cause: new Error('connect ECONNREFUSED') });
    }) as unknown as typeof fetch;
    const response = await POST(
      makeRequest({ targetUrl: TARGET, signingSecret: SECRET, only: ['valid-event-accepted'] }),
    );
    const data = await response.json();
    expect(response.status).toBe(200);
    expect(data.results[0].status).toBe('error');
    expect(data.results[0].observed).toContain('ECONNREFUSED');
  });

  // ─── Rate limiting ──────────────────────────────────────────────────────────

  it('returns 429 RATE_LIMITED after 60 requests a minute from one IP', async () => {
    const ip = 'rate-limit-shared';
    for (let i = 0; i < 60; i++) {
      const response = await POST(makeRequest({ targetUrl: TARGET }, ip));
      expect(response.status).toBe(400);
    }
    const response = await POST(makeRequest({ targetUrl: TARGET, signingSecret: SECRET }, ip));
    const data = await response.json();
    expect(response.status).toBe(429);
    expect(data.error.code).toBe('RATE_LIMITED');
    expect(Number(response.headers.get('Retry-After'))).toBeGreaterThan(0);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('allows 6 suite runs a minute per IP, so one IP cannot multiply outbound traffic', async () => {
    const ip = 'rate-limit-suite';
    const body = { targetUrl: TARGET, signingSecret: SECRET, only: ['valid-event-accepted'] };
    for (let i = 0; i < 6; i++) {
      expect((await POST(makeRequest(body, ip))).status).toBe(200);
    }
    const response = await POST(makeRequest(body, ip));
    const data = await response.json();
    expect(response.status).toBe(429);
    expect(data.error.code).toBe('RATE_LIMITED');
    expect(response.headers.get('Retry-After')).toBeTruthy();
    expect(global.fetch).toHaveBeenCalledTimes(6);

    // Another client is unaffected.
    expect((await POST(makeRequest(body))).status).toBe(200);
  });

  it('does not count refused requests against the suite run limit', async () => {
    const ip = 'rate-limit-refused';
    for (let i = 0; i < 6; i++) {
      const blocked = { targetUrl: 'http://localhost:3000/webhooks', signingSecret: SECRET };
      expect((await POST(makeRequest(blocked, ip))).status).toBe(400);
    }
    const response = await POST(
      makeRequest({ targetUrl: TARGET, signingSecret: SECRET, only: ['valid-event-accepted'] }, ip),
    );
    expect(response.status).toBe(200);
  });
});

// ─── Transport ───────────────────────────────────────────────────────────────

describe('suiteTransport', () => {
  const request = {
    url: TARGET,
    headers: { 'Content-Type': 'application/json' },
    body: '{}',
  };

  afterEach(() => {
    global.fetch = originalFetch;
    vi.unstubAllEnvs();
  });

  it('times out a delivery after the per-delivery timeout', async () => {
    global.fetch = hangingFetch() as unknown as typeof fetch;
    const transport = suiteTransport({ allowPrivate: false, deadline: Date.now() + 30_000, timeoutMs: 50 });
    const res = await transport(request);
    expect(res.status).toBe(0);
    expect(res.timedOut).toBe(true);
  });

  it('cuts a delivery short at the run deadline without calling it a timeout', async () => {
    global.fetch = hangingFetch() as unknown as typeof fetch;
    const transport = suiteTransport({ allowPrivate: false, deadline: Date.now() + 300, timeoutMs: 10_000 });
    const started = Date.now();
    const res = await transport(request);
    expect(Date.now() - started).toBeLessThan(2_000);
    expect(res.status).toBe(0);
    expect(res.timedOut).toBeUndefined();
    expect(res.error).toContain('time limit');
  });

  it('stops waiting on a slow DNS lookup at the run deadline', async () => {
    // A lookup that outlasts the run: the authoritative server for the
    // target's domain decides how long it takes.
    vi.mocked(lookup).mockImplementationOnce(
      () => new Promise((resolve) => setTimeout(() => resolve([{ address: '93.184.216.34', family: 4 }] as never), 3_000)),
    );
    global.fetch = vi.fn() as unknown as typeof fetch;
    const transport = suiteTransport({ allowPrivate: false, deadline: Date.now() + 300 });
    const started = Date.now();
    const res = await transport(request);
    expect(Date.now() - started).toBeLessThan(1_500);
    expect(res.status).toBe(0);
    expect(res.error).toContain('time limit');
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('does not start a delivery once the deadline has passed', async () => {
    global.fetch = vi.fn() as unknown as typeof fetch;
    const transport = suiteTransport({ allowPrivate: false, deadline: Date.now() - 1 });
    const res = await transport(request);
    expect(res.status).toBe(0);
    expect(res.error).toContain('time limit');
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('honours the kill switch for each delivery', async () => {
    global.fetch = vi.fn() as unknown as typeof fetch;
    vi.stubEnv('WEBHOOK_LAB_DISABLE_FIRE', 'true');
    const transport = suiteTransport({ allowPrivate: false, deadline: Date.now() + 30_000 });
    const res = await transport(request);
    expect(res.status).toBe(0);
    expect(res.error).toContain('disabled');
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('adds an X-Webhook-Lab-Request-Id header when the caller did not set one', async () => {
    global.fetch = vi.fn(async () => new Response('ok')) as unknown as typeof fetch;
    const transport = suiteTransport({ allowPrivate: false, deadline: Date.now() + 30_000 });
    const res = await transport(request);
    expect(res.status).toBe(200);
    const [, init] = fetchCalls()[0];
    expect(new Headers(init.headers).get('x-webhook-lab-request-id')).toMatch(UUID);
  });
});

describe('cliCommand', () => {
  it('leaves a plain URL bare', () => {
    expect(cliCommand('http://localhost:3000/api/webhooks/stripe')).toBe(
      'npx @sutyr/webhook-lab test http://localhost:3000/api/webhooks/stripe',
    );
  });

  it('single-quotes a URL with shell characters and escapes quotes inside it', () => {
    expect(cliCommand("http://localhost:3000/hook?a=1&b='x'")).toBe(
      `npx @sutyr/webhook-lab test 'http://localhost:3000/hook?a=1&b='\\''x'\\'''`,
    );
  });
});
