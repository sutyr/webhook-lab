// Copyright 2026 Sutyr Inc. SPDX-License-Identifier: Apache-2.0
import 'server-only';

import { randomUUID } from 'node:crypto';
import {
  DEFAULT_MAX_BODY_BYTES,
  DEFAULT_TIMEOUT_MS,
  type Transport,
  type TransportResponse,
} from '@webhook-lab/conformance';
import { resolveAndValidateTarget } from './outbound';
import { pinnedTransport } from './pinned-transport';

/**
 * How long one hosted delivery waits for the handler. Same as the CLI default,
 * which is also where responds-in-time turns from a warning into a failure, so
 * a slow handler gets the same verdict hosted and local.
 */
export const SUITE_DELIVERY_TIMEOUT_MS = DEFAULT_TIMEOUT_MS;

/**
 * How much of each response is read. The report keeps 4 KB of it, and this
 * stays well under the 1MB cap the other outbound routes use.
 */
export const SUITE_MAX_RESPONSE_BYTES = DEFAULT_MAX_BODY_BYTES;

/** A delivery is not started with less time than this left in the run. */
const MIN_DELIVERY_WINDOW_MS = 100;

const OUT_OF_TIME =
  'Not sent: the hosted run reached its time limit. Run the suite from your machine to give a slow handler more time.';
const CUT_SHORT =
  'No response before the hosted run reached its time limit. Run the suite from your machine to give a slow handler more time.';

export interface SuiteTransportOptions {
  /** WEBHOOK_LAB_ALLOW_PRIVATE: self-hosted instances may reach private hosts. */
  allowPrivate: boolean;
  /**
   * Epoch milliseconds by which every delivery must be over, so the whole
   * suite returns inside the function's maxDuration. No delivery starts after
   * it, and one in flight is abandoned when it passes.
   */
  deadline: number;
  /** Per-delivery wait. Defaults to SUITE_DELIVERY_TIMEOUT_MS. */
  timeoutMs?: number;
  /** Response bytes read per delivery. Defaults to SUITE_MAX_RESPONSE_BYTES. */
  maxBodyBytes?: number;
}

/**
 * The Transport the hosted suite runs on. Every delivery gets the kill switch,
 * the same SSRF validation as /api/fire (for its error codes and CLI hint),
 * then a connection pinned to the address validated at connect time by
 * pinnedTransport, so a DNS record that flips to a private address between
 * the check and the connection is refused (DNS rebinding). No redirects, a
 * capped read, and an X-Webhook-Lab-Request-Id header. A refused delivery
 * comes back as status 0 with an error, which the suite reports as 'error'.
 */
export function suiteTransport(options: SuiteTransportOptions): Transport {
  const timeoutMs = options.timeoutMs ?? SUITE_DELIVERY_TIMEOUT_MS;
  const maxBodyBytes = options.maxBodyBytes ?? SUITE_MAX_RESPONSE_BYTES;

  return async (req): Promise<TransportResponse> => {
    if (process.env.WEBHOOK_LAB_DISABLE_FIRE === 'true') {
      return notSent('Firing is temporarily disabled on this instance.');
    }
    if (options.deadline - Date.now() < MIN_DELIVERY_WINDOW_MS) return notSent(OUT_OF_TIME);

    // The lookup has no timeout of its own and the target's DNS server sets
    // its pace, so it gets only the time left in the run.
    const target = await beforeDeadline(
      resolveAndValidateTarget(req.url, { allowPrivate: options.allowPrivate }),
      options.deadline,
    );
    if (target === null) return notSent(OUT_OF_TIME);
    if (!target.valid) return notSent(target.error ?? 'Invalid target URL');

    // Measured after the DNS check so the lookup cannot push the run past its limit.
    const remaining = options.deadline - Date.now();
    if (remaining < MIN_DELIVERY_WINDOW_MS) return notSent(OUT_OF_TIME);
    const window = Math.min(timeoutMs, remaining);

    const headers = { ...req.headers };
    if (!Object.keys(headers).some((name) => name.toLowerCase() === 'x-webhook-lab-request-id')) {
      headers['X-Webhook-Lab-Request-Id'] = randomUUID();
    }

    const res = await pinnedTransport({
      allowPrivate: options.allowPrivate,
      timeoutMs: window,
      maxBodyBytes,
    })({ ...req, headers });

    // Waiting was cut by the run's limit, not the per-delivery timeout, so the
    // handler was not given its full time. Report no answer rather than a
    // timeout, which responds-in-time would count as a failure.
    if (res.timedOut && window < timeoutMs) {
      return { status: 0, body: '', durationMs: res.durationMs, error: CUT_SHORT };
    }
    return res;
  };
}

function notSent(error: string): TransportResponse {
  return { status: 0, body: '', durationMs: 0, error };
}

/** `work`'s result, or null if `deadline` (epoch ms) passes first. */
async function beforeDeadline<T>(work: Promise<T>, deadline: number): Promise<T | null> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const expired = new Promise<null>((resolve) => {
    timer = setTimeout(() => resolve(null), Math.max(0, deadline - Date.now()));
  });
  try {
    return await Promise.race([work, expired]);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * The CLI command that runs the suite against `url` from the developer's own
 * machine, where localhost and private networks are reachable. The URL is
 * single-quoted when a shell would otherwise interpret part of it (?, &, #).
 */
export function cliCommand(url: string): string {
  const arg = /^[\w.:/@%+=,~-]+$/.test(url) ? url : `'${url.replace(/'/g, `'\\''`)}'`;
  return `npx @sutyr/webhook-lab test ${arg}`;
}
