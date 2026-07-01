// Copyright 2026 Sutyr Inc. SPDX-License-Identifier: Apache-2.0

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
}

const store = new Map<string, { count: number; resetAt: number }>();

// Cap tracked IPs so spoofed/rotated addresses can't grow the map without
// bound. Defense-in-depth; the Vercel WAF rate rule (true edge IP) is primary.
const MAX_ENTRIES = 10_000;

function pruneExpired(now: number): void {
  for (const [key, entry] of store) {
    if (now >= entry.resetAt) store.delete(key);
  }
}

/**
 * Sliding-window rate limiter backed by an in-memory Map.
 * Returns whether the request is allowed, how many requests remain,
 * and when the current window resets (Unix ms).
 */
export function checkRateLimit(
  ip: string,
  limit = 60,
  windowMs = 60_000,
): RateLimitResult {
  const now = Date.now();
  const entry = store.get(ip);

  // No existing entry or window has expired — start a fresh window.
  if (!entry || now >= entry.resetAt) {
    // Keep the map bounded before inserting a new IP.
    if (store.size >= MAX_ENTRIES) {
      pruneExpired(now);
      if (store.size >= MAX_ENTRIES) store.clear();
    }
    const resetAt = now + windowMs;
    store.set(ip, { count: 1, resetAt });
    return { allowed: true, remaining: limit - 1, resetAt };
  }

  // Window still active — increment.
  entry.count += 1;

  if (entry.count > limit) {
    return { allowed: false, remaining: 0, resetAt: entry.resetAt };
  }

  return {
    allowed: true,
    remaining: limit - entry.count,
    resetAt: entry.resetAt,
  };
}
