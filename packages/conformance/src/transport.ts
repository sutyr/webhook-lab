// Copyright 2026 Sutyr Inc. SPDX-License-Identifier: Apache-2.0
import type { Transport, TransportResponse } from './types.js';

/** How long fetchTransport waits for a response by default. */
export const DEFAULT_TIMEOUT_MS = 10_000;

/**
 * The longest wait fetchTransport honours: the largest delay setTimeout
 * accepts. Node fires a longer timer after 1 ms instead, so a larger
 * timeoutMs is clamped to this.
 */
export const MAX_TIMEOUT_MS = 2_147_483_647;

/** How much of a response body fetchTransport reads by default. */
export const DEFAULT_MAX_BODY_BYTES = 64 * 1024;

export interface FetchTransportOptions {
  timeoutMs?: number;
  maxBodyBytes?: number;
}

/**
 * A Transport built on the global fetch. It does not follow redirects, because
 * Stripe counts a 3xx as a failed delivery, and it stops reading the body
 * after maxBodyBytes. It applies no URL restrictions: it is meant for the
 * CLI, which runs on the developer's machine and must reach localhost.
 */
export function fetchTransport(options?: FetchTransportOptions): Transport {
  const timeoutMs = Math.min(options?.timeoutMs ?? DEFAULT_TIMEOUT_MS, MAX_TIMEOUT_MS);
  const maxBodyBytes = options?.maxBodyBytes ?? DEFAULT_MAX_BODY_BYTES;

  return async (req): Promise<TransportResponse> => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const started = performance.now();
    const elapsed = () => Math.round(performance.now() - started);

    try {
      const res = await fetch(req.url, {
        method: 'POST',
        headers: req.headers,
        body: req.body,
        redirect: 'manual',
        signal: controller.signal,
      });
      const body = await readCapped(res, maxBodyBytes);
      return { status: res.status, body, durationMs: elapsed() };
    } catch (err) {
      if (controller.signal.aborted) {
        return {
          status: 0,
          body: '',
          durationMs: elapsed(),
          error: `No response within ${timeoutMs} ms`,
          timedOut: true,
        };
      }
      return { status: 0, body: '', durationMs: elapsed(), error: describeFetchError(err) };
    } finally {
      clearTimeout(timer);
    }
  };
}

async function readCapped(res: Response, maxBytes: number): Promise<string> {
  if (!res.body) return '';
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;

  while (total < maxBytes) {
    const { done, value } = await reader.read();
    if (done) return decode(chunks, total);
    const room = maxBytes - total;
    const chunk = value.byteLength > room ? value.subarray(0, room) : value;
    chunks.push(chunk);
    total += chunk.byteLength;
  }

  // Cap reached: drop the rest instead of buffering it.
  await reader.cancel().catch(() => undefined);
  return decode(chunks, total);
}

function decode(chunks: Uint8Array[], total: number): string {
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(bytes);
}

/**
 * Node's fetch reports network failures as TypeError('fetch failed') with the
 * real reason in `cause` (ECONNREFUSED, ENOTFOUND, ...). Surface that reason.
 */
function describeFetchError(err: unknown): string {
  const cause = (err as { cause?: unknown } | null)?.cause ?? err;
  const first = cause instanceof AggregateError && cause.errors.length > 0 ? cause.errors[0] : cause;
  if (first instanceof Error) {
    const code = (first as Error & { code?: unknown }).code;
    return first.message || (typeof code === 'string' ? code : 'Request failed');
  }
  return String(first);
}
