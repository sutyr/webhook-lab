// Copyright 2026 Sutyr Inc. SPDX-License-Identifier: Apache-2.0

import { runSuite, selectChecks } from '@webhook-lab/conformance';
import { checkRateLimit } from '@/lib/rate-limit';
import { resolveAndValidateTarget, type ResolvedTarget } from '@/lib/outbound';
import { parseJsonBody } from '@/lib/parse-body';
import { cliCommand, suiteTransport } from '@/lib/suite-transport';

// A full run sends 10 deliveries, one at a time. Vercel takes this export over
// vercel.json, which repeats it; keep the two equal.
export const maxDuration = 60;

/**
 * Deliveries must be over this long after the request arrives. The rest of
 * maxDuration covers cold start, spacing between skipped deliveries and the
 * response itself.
 */
const SUITE_BUDGET_MS = 50_000;

/**
 * Suite runs per IP per minute, on top of the 60 requests every route allows.
 * A run sends up to 10 deliveries, so this keeps the outbound traffic one IP
 * can cause in line with /api/fire.
 */
const SUITE_RUNS_PER_MINUTE = 6;

interface RunSuiteBody {
  targetUrl?: unknown;
  signingSecret?: unknown;
  only?: unknown;
}

function errorResponse(status: number, code: string, message: string, headers?: HeadersInit) {
  return Response.json({ error: { code, message } }, { status, headers });
}

function rateLimited(resetAt: number) {
  const retryAfterSeconds = Math.ceil((resetAt - Date.now()) / 1000);
  return errorResponse(429, 'RATE_LIMITED', 'Rate limit exceeded', {
    'Retry-After': String(retryAfterSeconds),
  });
}

/**
 * True when the target was refused because it is on the caller's own machine
 * or network rather than the public internet. Cloud metadata hostnames and
 * names that do not resolve are refused for other reasons.
 */
function isLocalOrPrivate(check: ResolvedTarget, url: string): boolean {
  if (check.code === 'BLOCKED_IP') return true;
  if (check.code !== 'BLOCKED_HOST') return false;
  const hostname = new URL(url.trim()).hostname;
  return hostname === 'localhost' || hostname.endsWith('.localhost');
}

export async function POST(request: Request) {
  const deadline = Date.now() + SUITE_BUDGET_MS;

  // ── Kill switch ───────────────────────────────────────────────────────────
  // Same operator switch as /api/fire: it stops every outbound delivery.
  if (process.env.WEBHOOK_LAB_DISABLE_FIRE === 'true') {
    return errorResponse(503, 'FIRING_DISABLED', 'Firing is temporarily disabled on this instance.');
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
  if (!rateLimit.allowed) return rateLimited(rateLimit.resetAt);

  // ── Parse body ──────────────────────────────────────────────────────────────
  const parsed = await parseJsonBody<unknown>(request);
  if (!parsed.ok) {
    return Response.json({ error: parsed.error }, { status: parsed.status });
  }
  if (typeof parsed.data !== 'object' || parsed.data === null || Array.isArray(parsed.data)) {
    return errorResponse(400, 'INVALID_REQUEST', 'Request body must be a JSON object');
  }
  const body = parsed.data as RunSuiteBody;

  // ── Validate fields ───────────────────────────────────────────────────────
  // The suite is only meaningful with the secret the handler verifies with,
  // so unlike /api/fire there is no default.
  if (typeof body.signingSecret !== 'string' || body.signingSecret === '') {
    return errorResponse(
      400,
      'INVALID_REQUEST',
      'signingSecret is required: use the whsec_ secret your handler verifies with',
    );
  }
  const signingSecret = body.signingSecret;

  let only: string[] | undefined;
  if (body.only !== undefined && body.only !== null) {
    if (
      !Array.isArray(body.only) ||
      body.only.length === 0 ||
      !body.only.every((id): id is string => typeof id === 'string')
    ) {
      return errorResponse(400, 'INVALID_REQUEST', 'only must be a non-empty array of check ids');
    }
    try {
      selectChecks(body.only);
    } catch (err) {
      return errorResponse(400, 'UNKNOWN_CHECK', err instanceof Error ? err.message : 'Unknown check id');
    }
    only = body.only;
  }

  // ── Validate target URL (SSRF protection) ─────────────────────────────────
  // Resolves the host and validates every resolved address. The transport
  // repeats this before each delivery.
  const targetUrl = typeof body.targetUrl === 'string' ? body.targetUrl : '';
  const allowPrivate = process.env.WEBHOOK_LAB_ALLOW_PRIVATE === 'true';
  const urlCheck = await resolveAndValidateTarget(targetUrl, { allowPrivate });

  if (!urlCheck.valid) {
    const code = urlCheck.code ?? 'INVALID_URL';
    const reason = urlCheck.error ?? 'Invalid target URL';
    if (isLocalOrPrivate(urlCheck, targetUrl)) {
      const href = new URL(targetUrl.trim()).href;
      return errorResponse(
        400,
        code,
        `${reason}. The hosted Lab can only reach public URLs. ` +
          `To test a handler on your machine or private network, run the CLI instead: ${cliCommand(href)}`,
      );
    }
    return errorResponse(400, code, reason);
  }

  // ── Suite rate limit ──────────────────────────────────────────────────────
  // Charged only for runs that will send deliveries.
  const suiteLimit = checkRateLimit(`run-suite:${ip}`, SUITE_RUNS_PER_MINUTE);
  if (!suiteLimit.allowed) return rateLimited(suiteLimit.resetAt);

  // ── Run ─────────────────────────────────────────────────────────────────────
  const requestId = crypto.randomUUID();
  const report = await runSuite({
    url: new URL(targetUrl.trim()).toString(),
    secret: signingSecret,
    only,
    transport: suiteTransport({ allowPrivate, deadline }),
  });

  return Response.json({ ...report, requestId });
}
