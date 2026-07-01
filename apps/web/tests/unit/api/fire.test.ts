// Copyright 2026 Sutyr Inc. SPDX-License-Identifier: Apache-2.0

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { verify } from '@webhook-lab/signatures';
import { POST } from '@/app/api/fire/route';
import { lookup } from 'node:dns/promises';

// Resolve domain targets to a public IP by default so tests run offline.
// Individual tests override this to simulate a domain resolving internally.
vi.mock('node:dns/promises', () => ({
  lookup: vi.fn(async () => [{ address: '93.184.216.34', family: 4 }]),
}));

const originalFetch = global.fetch;

function makeRequest(body: unknown): Request {
  return new Request('http://localhost/api/fire', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/fire', () => {
  beforeEach(() => {
    global.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ received: true }), { status: 200 }),
    );
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  // ─── Kill switch ────────────────────────────────────────────────────────────

  it('returns 503 FIRING_DISABLED when WEBHOOK_LAB_DISABLE_FIRE=true', async () => {
    vi.stubEnv('WEBHOOK_LAB_DISABLE_FIRE', 'true');
    const request = makeRequest({
      eventType: 'payment_intent.succeeded',
      targetUrl: 'https://example.com/webhook',
    });
    const response = await POST(request);
    const data = await response.json();
    expect(response.status).toBe(503);
    expect(data.error.code).toBe('FIRING_DISABLED');
    expect(global.fetch).not.toHaveBeenCalled();
    vi.unstubAllEnvs();
  });

  // ─── URL validation ─────────────────────────────────────────────────────────

  it('returns 400 when targetUrl is missing', async () => {
    const request = makeRequest({ eventType: 'payment_intent.succeeded' });
    const response = await POST(request);
    const data = await response.json();
    expect(response.status).toBe(400);
    expect(data.error).toHaveProperty('code');
    expect(data.error).toHaveProperty('message');
  });

  it('returns 400 for invalid URL (no protocol)', async () => {
    const request = makeRequest({
      eventType: 'payment_intent.succeeded',
      targetUrl: 'not-a-url',
    });
    const response = await POST(request);
    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error.code).toBe('INVALID_URL');
  });

  it('returns 400 for file:// protocol URL', async () => {
    const request = makeRequest({
      eventType: 'payment_intent.succeeded',
      targetUrl: 'file:///etc/passwd',
    });
    const response = await POST(request);
    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error.code).toBe('BLOCKED_SCHEME');
  });

  it('returns 400 for javascript: protocol URL', async () => {
    const request = makeRequest({
      eventType: 'payment_intent.succeeded',
      targetUrl: 'javascript:alert(1)',
    });
    const response = await POST(request);
    expect(response.status).toBe(400);
  });

  it('returns 400 for data: protocol URL', async () => {
    const request = makeRequest({
      eventType: 'payment_intent.succeeded',
      targetUrl: 'data:text/html,<h1>hi</h1>',
    });
    const response = await POST(request);
    expect(response.status).toBe(400);
  });

  // ─── SSRF protection ───────────────────────────────────────────────────────

  it('returns 400 for private IP (127.0.0.1)', async () => {
    const request = makeRequest({
      eventType: 'payment_intent.succeeded',
      targetUrl: 'http://127.0.0.1/webhook',
    });
    const response = await POST(request);
    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error.code).toBe('BLOCKED_IP');
  });

  it('returns 400 for localhost', async () => {
    const request = makeRequest({
      eventType: 'payment_intent.succeeded',
      targetUrl: 'http://localhost/webhook',
    });
    const response = await POST(request);
    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error.code).toBe('BLOCKED_HOST');
  });

  it('returns 400 BLOCKED_IP for a domain that resolves to a private IP', async () => {
    // The literal 127.0.0.1 was already blocked; this covers the DNS path:
    // a domain name whose A record points at an internal address.
    vi.mocked(lookup).mockResolvedValueOnce([{ address: '10.0.0.5', family: 4 }] as never);
    const request = makeRequest({
      eventType: 'payment_intent.succeeded',
      targetUrl: 'http://internal.example.com/webhook',
    });
    const response = await POST(request);
    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error.code).toBe('BLOCKED_IP');
    expect(global.fetch).not.toHaveBeenCalled();
  });

  // ─── Event type validation ────────────────────────────────────────────────

  it('returns 400 for unknown eventType', async () => {
    const request = makeRequest({
      eventType: 'nonexistent.event',
      targetUrl: 'https://example.com/webhook',
    });
    const response = await POST(request);
    const data = await response.json();
    expect(response.status).toBe(400);
    expect(data.error.code).toBe('UNKNOWN_EVENT_TYPE');
  });

  // ─── Success ──────────────────────────────────────────────────────────────

  it('returns full response on success', async () => {
    const request = makeRequest({
      eventType: 'payment_intent.succeeded',
      targetUrl: 'https://example.com/webhook',
    });
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.statusCode).toBe(200);
    expect(data.responseBody).toBe(JSON.stringify({ received: true }));
    expect(typeof data.responseTimeMs).toBe('number');
    expect(data.signatureHeader).toBeDefined();
    expect(data.payload).toBeDefined();
    expect(data.payload.type).toBe('payment_intent.succeeded');
    expect(typeof data.requestId).toBe('string');
    expect(typeof data.truncated).toBe('boolean');
    expect(data.truncated).toBe(false);
  });

  it('does NOT follow redirects (SSRF: only the original URL passed validation)', async () => {
    const request = makeRequest({
      eventType: 'payment_intent.succeeded',
      targetUrl: 'https://example.com/webhook',
    });
    await POST(request);
    expect(global.fetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ redirect: 'manual' }),
    );
  });

  it('returns a signatureHeader matching the t=...,v1=... format', async () => {
    const request = makeRequest({
      eventType: 'payment_intent.succeeded',
      targetUrl: 'https://example.com/webhook',
    });
    const response = await POST(request);
    const data = await response.json();
    expect(data.signatureHeader).toMatch(/^t=\d+,v1=[0-9a-f]{64}$/);
  });

  it('defaults signingSecret to whsec_test_secret and produces a valid signature', async () => {
    const request = makeRequest({
      eventType: 'payment_intent.succeeded',
      targetUrl: 'https://example.com/webhook',
    });
    const response = await POST(request);
    const data = await response.json();
    const isValid = verify(data.payload, data.signatureHeader, 'whsec_test_secret');
    expect(isValid).toBe(true);
  });

  // ─── Error shape consistency ──────────────────────────────────────────────

  it('all error responses have { error: { code, message } } shape', async () => {
    const cases = [
      makeRequest({ eventType: 'payment_intent.succeeded' }), // missing URL
      makeRequest({ eventType: 'bad.type', targetUrl: 'https://example.com' }), // bad type
    ];

    for (const req of cases) {
      const res = await POST(req);
      const data = await res.json();
      expect(data.error).toHaveProperty('code');
      expect(data.error).toHaveProperty('message');
      expect(typeof data.error.code).toBe('string');
      expect(typeof data.error.message).toBe('string');
    }
  });

  // ─── Response truncation ───────────────────────────────────────────────

  it('truncates response body larger than 1MB', async () => {
    const largeBody = 'x'.repeat(2 * 1024 * 1024); // 2MB
    global.fetch = vi.fn().mockResolvedValue(
      new Response(largeBody, { status: 200 }),
    );

    const request = makeRequest({
      eventType: 'payment_intent.succeeded',
      targetUrl: 'https://example.com/webhook',
    });
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.truncated).toBe(true);
    expect(data.responseBody.length).toBeLessThanOrEqual(1024 * 1024);
  });

  // ─── Additional edge cases ─────────────────────────────────────────────

  it('returns 400 when body has targetUrl but no eventType', async () => {
    const request = makeRequest({ targetUrl: 'https://example.com/webhook' });
    const response = await POST(request);
    expect(response.status).toBe(400);
  });

  it('returns 400 for empty string targetUrl', async () => {
    const request = makeRequest({
      eventType: 'payment_intent.succeeded',
      targetUrl: '',
    });
    const response = await POST(request);
    expect(response.status).toBe(400);
  });

  it('uses custom signingSecret for signature', async () => {
    const customSecret = 'whsec_custom_test_key';
    const request = makeRequest({
      eventType: 'payment_intent.succeeded',
      targetUrl: 'https://example.com/webhook',
      signingSecret: customSecret,
    });
    const response = await POST(request);
    const data = await response.json();

    const isValid = verify(data.payload, data.signatureHeader, customSecret);
    expect(isValid).toBe(true);
  });

  // ─── Header injection prevention ──────────────────────────────────────

  it('rejects eventType with newlines (not in catalog)', async () => {
    const request = makeRequest({
      eventType: 'payment_intent.succeeded\r\nX-Injected: true',
      targetUrl: 'https://example.com/webhook',
    });
    const response = await POST(request);
    expect(response.status).toBe(400);
  });

  it('rejects targetUrl with newlines (blocked by URL parser)', async () => {
    const request = makeRequest({
      eventType: 'payment_intent.succeeded',
      targetUrl: 'https://example.com\r\nInjected: header',
    });
    const response = await POST(request);
    expect(response.status).toBe(400);
  });
});
