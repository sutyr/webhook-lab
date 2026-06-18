// Copyright 2026 Sutyr Inc. SPDX-License-Identifier: Apache-2.0

import { sign } from '@webhook-lab/signatures';
import { checkRateLimit } from '@/lib/rate-limit';
import { validateTargetUrl } from '@/lib/url-validator';
import { parseJsonBody } from '@/lib/parse-body';

const MAX_RESPONSE_BODY = 1024 * 1024; // 1MB

interface FirePreparedBody {
  payload: object;
  targetUrl: string;
  signingSecret?: string;
}

async function readResponseBody(res: Response): Promise<{ body: string; truncated: boolean }> {
  const reader = res.body?.getReader();
  if (!reader) return { body: '', truncated: false };

  const decoder = new TextDecoder();
  let body = '';
  let bytesRead = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytesRead += value.byteLength;
      if (bytesRead > MAX_RESPONSE_BODY) {
        body += decoder.decode(value, { stream: false });
        body = body.slice(0, MAX_RESPONSE_BODY);
        reader.cancel();
        return { body, truncated: true };
      }
      body += decoder.decode(value, { stream: true });
    }
  } catch {
    // Reader error
  }

  return { body, truncated: false };
}

export async function POST(request: Request) {
  // ── Kill switch ───────────────────────────────────────────────────────────
  // Operator-controlled instant off-switch for outbound firing.
  if (process.env.WEBHOOK_LAB_DISABLE_FIRE === 'true') {
    return Response.json(
      { error: { code: 'FIRING_DISABLED', message: 'Firing is temporarily disabled on this instance.' } },
      { status: 503 },
    );
  }

  // ── Rate limit ──────────────────────────────────────────────────────────────
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || '127.0.0.1';
  const rateLimit = checkRateLimit(ip);

  if (!rateLimit.allowed) {
    const retryAfterSeconds = Math.ceil((rateLimit.resetAt - Date.now()) / 1000);
    return Response.json(
      { error: { code: 'RATE_LIMITED', message: 'Rate limit exceeded' } },
      { status: 429, headers: { 'Retry-After': String(retryAfterSeconds) } },
    );
  }

  // ── Parse body ──────────────────────────────────────────────────────────────
  const parsed = await parseJsonBody<FirePreparedBody>(request);
  if (!parsed.ok) {
    return Response.json({ error: parsed.error }, { status: parsed.status });
  }

  const { payload, targetUrl, signingSecret } = parsed.data;

  // ── Validate target URL (SSRF protection) ─────────────────────────────────
  const urlCheck = validateTargetUrl(targetUrl ?? '', {
    allowPrivate: process.env.WEBHOOK_LAB_ALLOW_PRIVATE === 'true',
  });

  if (!urlCheck.valid) {
    return Response.json(
      { error: { code: urlCheck.code ?? 'INVALID_URL', message: urlCheck.error ?? 'Invalid target URL' } },
      { status: 400 },
    );
  }

  // ── Sign (preserve the pre-generated payload) ─────────────────────────────
  const timestamp = Math.floor(Date.now() / 1000);
  const secret = signingSecret || 'whsec_test_secret';
  const signatureHeader = sign(payload, secret, timestamp);

  // ── Request ID ──────────────────────────────────────────────────────────────
  const requestId = crypto.randomUUID();

  // ── Fire ────────────────────────────────────────────────────────────────────
  const startTime = performance.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);

  try {
    const res = await fetch(new URL(targetUrl).toString(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Stripe-Signature': signatureHeader,
        'User-Agent': 'WebhookLab/1.0',
        'X-Webhook-Lab-Request-Id': requestId,
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
      // Do NOT follow redirects: only the original URL passed SSRF validation,
      // and Stripe itself treats a 3xx webhook response as a failed delivery.
      redirect: 'manual',
    });

    clearTimeout(timeout);
    const responseTimeMs = Math.round(performance.now() - startTime);
    const { body: responseBody, truncated } = await readResponseBody(res);

    return Response.json({
      statusCode: res.status,
      responseBody,
      responseTimeMs,
      signatureHeader,
      requestId,
      truncated,
    });
  } catch (err: unknown) {
    clearTimeout(timeout);
    const responseTimeMs = Math.round(performance.now() - startTime);

    let errorMessage = 'Network error';
    if (err instanceof DOMException && err.name === 'AbortError') {
      errorMessage = 'Request timed out after 30 seconds';
    } else if (err instanceof TypeError) {
      errorMessage = `Network error: ${err.message}`;
    } else if (err instanceof Error) {
      errorMessage = err.message;
    }

    return Response.json({
      statusCode: 0,
      responseBody: errorMessage,
      responseTimeMs,
      signatureHeader,
      requestId,
      truncated: false,
    });
  }
}
