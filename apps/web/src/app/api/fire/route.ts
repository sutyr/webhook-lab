// Copyright 2026 Sutyr Inc. SPDX-License-Identifier: Apache-2.0

import { sign } from '@webhook-lab/signatures';
import { EVENT_TYPE_TO_GENERATOR } from '@/lib/event-generator-map';
import { checkRateLimit } from '@/lib/rate-limit';
import { resolveAndValidateTarget } from '@/lib/outbound';
import { parseJsonBody } from '@/lib/parse-body';
import type { StripeEventType } from '@webhook-lab/events';

const MAX_RESPONSE_BODY = 1024 * 1024; // 1MB

interface FireRequestBody {
  eventType: string;
  eventOptions?: Record<string, unknown>;
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
    // Reader error — return what we have
  }

  return { body, truncated: false };
}

export async function POST(request: Request) {
  // ── Kill switch ───────────────────────────────────────────────────────────
  // Operator-controlled instant off-switch for outbound firing (set the env var
  // and redeploy). Lets a public instance be disabled without code changes.
  if (process.env.WEBHOOK_LAB_DISABLE_FIRE === 'true') {
    return Response.json(
      { error: { code: 'FIRING_DISABLED', message: 'Firing is temporarily disabled on this instance.' } },
      { status: 503 },
    );
  }

  // ── Rate limit ──────────────────────────────────────────────────────────────
  // Trust only the platform-set client IP; raw x-forwarded-for is client-settable.
  // The Vercel WAF rate rule (keyed on the true edge IP) is the primary control;
  // this app-level limit is defense-in-depth.
  const ip =
    request.headers.get('x-real-ip') ||
    request.headers.get('x-vercel-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    '127.0.0.1';
  const rateLimit = checkRateLimit(ip);

  if (!rateLimit.allowed) {
    const retryAfterSeconds = Math.ceil((rateLimit.resetAt - Date.now()) / 1000);
    return Response.json(
      { error: { code: 'RATE_LIMITED', message: 'Rate limit exceeded' } },
      { status: 429, headers: { 'Retry-After': String(retryAfterSeconds) } },
    );
  }

  // ── Parse body ──────────────────────────────────────────────────────────────
  const parsed = await parseJsonBody<FireRequestBody>(request);
  if (!parsed.ok) {
    return Response.json({ error: parsed.error }, { status: parsed.status });
  }

  const { eventType, eventOptions, targetUrl, signingSecret } = parsed.data;

  // ── Validate target URL (SSRF protection) ─────────────────────────────────
  // Resolves the host and validates every resolved address, then the connection
  // is pinned to it below.
  const urlCheck = await resolveAndValidateTarget(targetUrl ?? '', {
    allowPrivate: process.env.WEBHOOK_LAB_ALLOW_PRIVATE === 'true',
  });

  if (!urlCheck.valid) {
    return Response.json(
      { error: { code: urlCheck.code ?? 'INVALID_URL', message: urlCheck.error ?? 'Invalid target URL' } },
      { status: 400 },
    );
  }

  // ── Generate event ──────────────────────────────────────────────────────────
  const generator = EVENT_TYPE_TO_GENERATOR[eventType as StripeEventType];

  if (!generator) {
    return Response.json(
      { error: { code: 'UNKNOWN_EVENT_TYPE', message: 'Unknown event type' } },
      { status: 400 },
    );
  }

  const payload = generator(eventOptions) as Record<string, unknown>;

  // ── Apply envelope overrides (livemode, apiVersion) ────────────────────────
  if (eventOptions?.livemode === true) {
    payload.livemode = true;
    // Stripe sets livemode on both the event and the inner data.object
    const data = payload.data as Record<string, unknown> | undefined;
    const inner = data?.object as Record<string, unknown> | undefined;
    if (inner) inner.livemode = true;
  }
  if (typeof eventOptions?.apiVersion === 'string' && eventOptions.apiVersion) {
    payload.api_version = eventOptions.apiVersion;
  }

  // ── Sign ────────────────────────────────────────────────────────────────────
  const timestamp = Math.floor(Date.now() / 1000);
  const secret = signingSecret || 'whsec_test_secret';
  const signatureHeader = sign(payload, secret, timestamp);

  // ── Request ID ──────────────────────────────────────────────────────────────
  const requestId = crypto.randomUUID();

  // ── Fire ────────────────────────────────────────────────────────────────────
  const startTime = performance.now();
  const controller = new AbortController();
  // Under the 10s function maxDuration so we return a clean timeout ourselves.
  const timeout = setTimeout(() => controller.abort(), 9_000);

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

    const responseTimeMs = Math.round(performance.now() - startTime);
    const { body: responseBody, truncated } = await readResponseBody(res);

    return Response.json({
      statusCode: res.status,
      responseBody,
      responseTimeMs,
      signatureHeader,
      payload,
      requestId,
      truncated,
    });
  } catch (err: unknown) {
    const responseTimeMs = Math.round(performance.now() - startTime);

    let errorMessage = 'Network error';
    if (err instanceof DOMException && err.name === 'AbortError') {
      errorMessage = 'Request timed out after 9 seconds';
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
      payload,
      requestId,
      truncated: false,
    });
  } finally {
    clearTimeout(timeout);
  }
}
