// Copyright 2026 Sutyr Inc. SPDX-License-Identifier: Apache-2.0

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { POST } from '@/app/api/fire-prepared/route';
import { lookup } from 'node:dns/promises';

// Resolve domain targets to a public IP by default so tests run offline.
vi.mock('node:dns/promises', () => ({
  lookup: vi.fn(async () => [{ address: '93.184.216.34', family: 4 }]),
}));

const originalFetch = global.fetch;

function makeRequest(body: unknown): Request {
  return new Request('http://localhost/api/fire-prepared', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

const samplePayload = {
  id: 'evt_test123',
  object: 'event',
  type: 'payment_intent.succeeded',
  data: { object: { id: 'pi_test', object: 'payment_intent', amount: 2999 } },
};

describe('POST /api/fire-prepared', () => {
  beforeEach(() => {
    global.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ received: true }), { status: 200 }),
    );
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('accepts a pre-built payload and signs/fires it', async () => {
    const request = makeRequest({
      payload: samplePayload,
      targetUrl: 'https://example.com/webhook',
    });
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.statusCode).toBe(200);
    expect(data.signatureHeader).toMatch(/^t=\d+,v1=[0-9a-f]{64}$/);
    expect(typeof data.requestId).toBe('string');
    expect(data.truncated).toBe(false);

    expect(global.fetch).toHaveBeenCalledWith(
      'https://example.com/webhook',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
          'Stripe-Signature': data.signatureHeader,
          'X-Webhook-Lab-Request-Id': data.requestId,
        }),
      }),
    );
  });

  it('returns 400 when targetUrl is missing', async () => {
    const request = makeRequest({ payload: samplePayload });
    const response = await POST(request);
    const data = await response.json();
    expect(response.status).toBe(400);
    expect(data.error).toHaveProperty('code');
    expect(data.error).toHaveProperty('message');
  });

  it('returns 400 for invalid URL', async () => {
    const request = makeRequest({
      payload: samplePayload,
      targetUrl: 'ftp://invalid',
    });
    const response = await POST(request);
    const data = await response.json();
    expect(response.status).toBe(400);
    expect(data.error.code).toBe('BLOCKED_SCHEME');
  });

  it('returns 400 for file:// protocol URL', async () => {
    const request = makeRequest({
      payload: samplePayload,
      targetUrl: 'file:///etc/passwd',
    });
    const response = await POST(request);
    expect(response.status).toBe(400);
  });

  it('returns 400 for private IP', async () => {
    const request = makeRequest({
      payload: samplePayload,
      targetUrl: 'http://10.0.0.1/webhook',
    });
    const response = await POST(request);
    const data = await response.json();
    expect(response.status).toBe(400);
    expect(data.error.code).toBe('BLOCKED_IP');
  });

  it('returns 400 BLOCKED_IP for a domain that resolves to a reserved IP', async () => {
    vi.mocked(lookup).mockResolvedValueOnce([{ address: '169.254.169.254', family: 4 }] as never);
    const request = makeRequest({
      payload: samplePayload,
      targetUrl: 'http://metadata.example.com/webhook',
    });
    const response = await POST(request);
    const data = await response.json();
    expect(response.status).toBe(400);
    expect(data.error.code).toBe('BLOCKED_IP');
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('returns statusCode, responseBody, responseTimeMs, signatureHeader, and requestId', async () => {
    const request = makeRequest({
      payload: samplePayload,
      targetUrl: 'https://example.com/webhook',
    });
    const response = await POST(request);
    const data = await response.json();

    expect(data).toHaveProperty('statusCode');
    expect(data).toHaveProperty('responseBody');
    expect(data).toHaveProperty('responseTimeMs');
    expect(data).toHaveProperty('signatureHeader');
    expect(data).toHaveProperty('requestId');
    expect(data).toHaveProperty('truncated');
  });
});
