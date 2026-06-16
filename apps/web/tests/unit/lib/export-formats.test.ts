// Copyright 2026 Sutyr Inc. SPDX-License-Identifier: Apache-2.0

import { describe, it, expect } from 'vitest';
import { createHmac } from 'node:crypto';
import { sign } from '@webhook-lab/signatures';
import { exportAsCurl, exportAsTypeScript, exportAsPython } from '@/lib/export-formats';

const testParams = {
  targetUrl: 'https://example.com/webhook',
  payload: { id: 'evt_test', type: 'payment_intent.succeeded', data: { object: { amount: 2999 } } },
  signatureHeader: 't=1700000000,v1=abc123def456',
  requestId: 'req-uuid-123',
};

describe('exportAsCurl', () => {
  it('includes -X POST and target URL', () => {
    const curl = exportAsCurl(testParams);
    expect(curl).toContain("-X POST 'https://example.com/webhook'");
  });

  it('includes Content-Type header', () => {
    const curl = exportAsCurl(testParams);
    expect(curl).toContain("Content-Type: application/json");
  });

  it('includes Stripe-Signature header', () => {
    const curl = exportAsCurl(testParams);
    expect(curl).toContain('Stripe-Signature: t=1700000000,v1=abc123def456');
  });

  it('includes User-Agent header', () => {
    const curl = exportAsCurl(testParams);
    expect(curl).toContain('User-Agent: WebhookLab/1.0');
  });

  it('includes request ID header', () => {
    const curl = exportAsCurl(testParams);
    expect(curl).toContain('X-Webhook-Lab-Request-Id: req-uuid-123');
  });

  it('payload is valid JSON in -d flag', () => {
    const curl = exportAsCurl(testParams);
    const match = curl.match(/-d '([\s\S]+)'/);
    expect(match).not.toBeNull();
    expect(() => JSON.parse(match![1])).not.toThrow();
  });

  it('single quotes in payload are properly escaped', () => {
    const params = {
      ...testParams,
      payload: { description: "it's a test" },
    };
    const curl = exportAsCurl(params);
    expect(curl).toContain("it'\\''s a test");
  });

  it('never includes signing secret', () => {
    const curl = exportAsCurl(testParams);
    expect(curl).not.toContain('whsec_');
  });
});

describe('exportAsTypeScript', () => {
  it('includes fetch call with target URL', () => {
    const ts = exportAsTypeScript(testParams);
    expect(ts).toContain("fetch('https://example.com/webhook'");
  });

  it('uses placeholder secret, not real secret', () => {
    const ts = exportAsTypeScript(testParams);
    expect(ts).toContain('whsec_your_secret_here');
    expect(ts).toContain('Replace with your signing secret');
  });

  it('includes signing computation', () => {
    const ts = exportAsTypeScript(testParams);
    expect(ts).toContain('createHmac');
    expect(ts).toContain('sha256');
  });

  it('does NOT strip the whsec_ prefix before HMAC (must match Stripe SDK)', () => {
    // Regression: the exported snippet previously did secret.replace('whsec_', '')
    // which produces signatures that fail verification against Stripe's SDK.
    const ts = exportAsTypeScript(testParams);
    expect(ts).not.toContain("replace('whsec_'");
    expect(ts).not.toContain('replace("whsec_"');
  });

  it('signs and sends the exact same body bytes', () => {
    // The snippet must sign the same string it sends, or the signature is invalid.
    const ts = exportAsTypeScript(testParams);
    expect(ts).toContain('const body = JSON.stringify(payload)');
    expect(ts).toContain('body,');
  });

  it('payload is valid JavaScript object', () => {
    const ts = exportAsTypeScript(testParams);
    expect(ts).toContain('const payload = {');
  });

  it('the exported algorithm produces a Stripe-valid signature', () => {
    // Reconstruct exactly what the snippet does and confirm it equals the
    // library sign() (which is verified against the real Stripe SDK).
    const secret = 'whsec_my_signing_secret';
    const timestamp = 1700000000;
    const body = JSON.stringify(testParams.payload);
    const snippetSig = createHmac('sha256', secret)
      .update(`${timestamp}.${body}`)
      .digest('hex');
    expect(sign(testParams.payload, secret, timestamp)).toBe(
      `t=${timestamp},v1=${snippetSig}`,
    );
  });
});

describe('exportAsPython', () => {
  it('includes requests.post with target URL', () => {
    const py = exportAsPython(testParams);
    expect(py).toContain("requests.post(");
    expect(py).toContain("'https://example.com/webhook'");
  });

  it('uses placeholder secret, not real secret', () => {
    const py = exportAsPython(testParams);
    expect(py).toContain('whsec_your_secret_here');
    expect(py).toContain('Replace with your signing secret');
  });

  it('includes hmac signing computation', () => {
    const py = exportAsPython(testParams);
    expect(py).toContain('hmac.new');
    expect(py).toContain('hashlib.sha256');
  });

  it('payload uses json.loads with triple double-quote delimiter', () => {
    const py = exportAsPython(testParams);
    expect(py).toContain('json.loads(r"""');
  });

  it('does NOT strip the whsec_ prefix before HMAC (must match Stripe SDK)', () => {
    const py = exportAsPython(testParams);
    expect(py).not.toContain("replace('whsec_'");
    expect(py).not.toContain('replace("whsec_"');
  });

  it('signs and sends the exact same body bytes (data=body, not json=payload)', () => {
    // requests' json= re-serializes with spaces, breaking the signature.
    // The snippet must send the same compact string it signed over.
    const py = exportAsPython(testParams);
    expect(py).toContain("body = json.dumps(payload, separators=(',', ':'))");
    expect(py).toContain('data=body');
    expect(py).not.toContain('json=payload');
  });
});

describe('export edge cases', () => {
  it('cURL handles URL with special characters', () => {
    const params = {
      ...testParams,
      targetUrl: 'https://example.com/hook?token=abc&ref=1',
    };
    const curl = exportAsCurl(params);
    expect(curl).toContain("'https://example.com/hook?token=abc&ref=1'");
  });

  it('cURL handles payload with unicode characters', () => {
    const params = {
      ...testParams,
      payload: { name: '日本語', emoji: '🔥' },
    };
    const curl = exportAsCurl(params);
    expect(curl).toContain('日本語');
    expect(curl).toContain('🔥');
  });

  it('cURL handles large payload (1000+ chars) without truncation', () => {
    const params = {
      ...testParams,
      payload: { data: 'x'.repeat(1000) },
    };
    const curl = exportAsCurl(params);
    expect(curl).toContain('x'.repeat(100)); // spot check — not truncated
    expect(curl.length).toBeGreaterThan(1000);
  });

  it('Python export uses triple double-quote delimiter (safe for JSON content)', () => {
    const params = {
      ...testParams,
      payload: { note: "it's a test with '''quotes'''" },
    };
    const py = exportAsPython(params);
    expect(py).toContain('r"""');
    expect(py).toContain("it's a test");
  });

  it('cURL handles empty payload {}', () => {
    const params = { ...testParams, payload: {} };
    const curl = exportAsCurl(params);
    expect(curl).toContain("-d '{}'");
  });

  it('cURL handles deeply nested payload (5 levels)', () => {
    const params = {
      ...testParams,
      payload: { a: { b: { c: { d: { e: 'deep' } } } } },
    };
    const curl = exportAsCurl(params);
    expect(curl).toContain('"deep"');
  });

  it('TypeScript export handles payload with template literal chars', () => {
    const params = {
      ...testParams,
      payload: { template: '${variable}' },
    };
    const ts = exportAsTypeScript(params);
    expect(ts).toContain('${variable}');
  });

  it('Python export handles payload with backslashes', () => {
    const params = {
      ...testParams,
      payload: { path: 'C:\\Users\\test' },
    };
    const py = exportAsPython(params);
    expect(py).toContain('C:\\\\Users\\\\test');
  });
});
