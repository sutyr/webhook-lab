// Copyright 2026 Sutyr Inc. SPDX-License-Identifier: Apache-2.0

import { describe, it, expect } from 'vitest';
import { parseJsonBody } from '@/lib/parse-body';

function makeRequest(body: string, contentType = 'application/json'): Request {
  return new Request('http://localhost/test', {
    method: 'POST',
    headers: { 'Content-Type': contentType },
    body,
  });
}

describe('parseJsonBody', () => {
  it('parses valid JSON with application/json', async () => {
    const r = await parseJsonBody(makeRequest('{"name":"test"}'));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.data).toEqual({ name: 'test' });
  });

  it('rejects non-JSON Content-Type', async () => {
    const r = await parseJsonBody(makeRequest('{"name":"test"}', 'text/plain'));
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.status).toBe(415);
      expect(r.error.code).toBe('INVALID_CONTENT_TYPE');
    }
  });

  it('rejects missing Content-Type', async () => {
    const req = new Request('http://localhost/test', {
      method: 'POST',
      body: '{"name":"test"}',
    });
    const r = await parseJsonBody(req);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.status).toBe(415);
  });

  it('rejects malformed JSON', async () => {
    const r = await parseJsonBody(makeRequest('{bad json'));
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.status).toBe(400);
      expect(r.error.code).toBe('INVALID_JSON');
    }
  });

  it('rejects empty body', async () => {
    const r = await parseJsonBody(makeRequest(''));
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.status).toBe(400);
      expect(r.error.code).toBe('INVALID_JSON');
    }
  });

  it('rejects body exceeding 512KB', async () => {
    const largeBody = JSON.stringify({ data: 'x'.repeat(600_000) });
    const r = await parseJsonBody(makeRequest(largeBody));
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.status).toBe(413);
      expect(r.error.code).toBe('PAYLOAD_TOO_LARGE');
    }
  });

  it('accepts body at exactly 512KB boundary', async () => {
    // Create a body just under the limit
    const padding = 'a'.repeat(500_000);
    const body = JSON.stringify({ d: padding });
    const r = await parseJsonBody(makeRequest(body));
    expect(r.ok).toBe(true);
  });

  it('returns structured error object', async () => {
    const r = await parseJsonBody(makeRequest('{bad'));
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error).toHaveProperty('code');
      expect(r.error).toHaveProperty('message');
      expect(typeof r.error.code).toBe('string');
      expect(typeof r.error.message).toBe('string');
    }
  });

  // ─── Boundary & edge cases ──────────────────────────────────────────────

  it('accepts Content-Type with charset (application/json; charset=utf-8)', async () => {
    const request = new Request('http://localhost', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify({ ok: true }),
    });
    const r = await parseJsonBody(request);
    expect(r.ok).toBe(true);
  });

  it('accepts body at exactly 512KB (524288 chars)', async () => {
    // Build a JSON string of exactly MAX_REQUEST_BODY length
    const target = 512 * 1024; // 524288
    const prefix = '{"d":"';
    const suffix = '"}';
    const padding = 'a'.repeat(target - prefix.length - suffix.length);
    const body = prefix + padding + suffix;
    expect(body.length).toBe(target);
    const r = await parseJsonBody(makeRequest(body));
    expect(r.ok).toBe(true);
  });

  it('rejects body at 512KB + 1 (524289 chars)', async () => {
    const target = 512 * 1024 + 1;
    const prefix = '{"d":"';
    const suffix = '"}';
    const padding = 'a'.repeat(target - prefix.length - suffix.length);
    const body = prefix + padding + suffix;
    expect(body.length).toBe(target);
    const r = await parseJsonBody(makeRequest(body));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('PAYLOAD_TOO_LARGE');
  });

  // ─── Content-Type edge cases ────────────────────────────────────────────

  it('accepts uppercase APPLICATION/JSON (case-insensitive per RFC 7230)', async () => {
    const request = new Request('http://localhost', {
      method: 'POST',
      headers: { 'Content-Type': 'APPLICATION/JSON' },
      body: JSON.stringify({ ok: true }),
    });
    const r = await parseJsonBody(request);
    expect(r.ok).toBe(true);
  });

  it('rejects text/json as invalid Content-Type', async () => {
    const request = new Request('http://localhost', {
      method: 'POST',
      headers: { 'Content-Type': 'text/json' },
      body: JSON.stringify({ ok: true }),
    });
    const r = await parseJsonBody(request);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('INVALID_CONTENT_TYPE');
  });

  it('rejects request with no Content-Type header', async () => {
    const request = new Request('http://localhost', {
      method: 'POST',
      body: JSON.stringify({ ok: true }),
    });
    const r = await parseJsonBody(request);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('INVALID_CONTENT_TYPE');
  });
});
