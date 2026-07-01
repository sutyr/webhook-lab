// Copyright 2026 Sutyr Inc. SPDX-License-Identifier: Apache-2.0
import 'server-only';

import { lookup as dnsLookup } from 'node:dns/promises';
import type { LookupFunction } from 'node:net';
import { Agent } from 'undici';
import { validateTargetUrl, isPrivateIp, type UrlValidationResult } from './url-validator';

export interface ResolvedTarget {
  valid: boolean;
  error?: string;
  code?: UrlValidationResult['code'];
  address?: string; // the validated IP to pin the connection to
  family?: number; // 4 or 6
}

/**
 * Full outbound-target validation. Runs the synchronous scheme/host/IP-literal
 * checks, then — for domain names — resolves every A/AAAA record and rejects if
 * ANY resolved address is private or reserved. Returns the validated address so
 * the caller can pin the connection to it (see pinnedDispatcher), closing the
 * gap where the fetch layer would otherwise re-resolve the hostname to an
 * internal address after validation (DNS rebinding / TOCTOU).
 *
 * IP literals are already canonicalised by the WHATWG URL parser (127.1 -> 127.0.0.1,
 * decimal/hex/octal/expanded-IPv6 all normalise), so the sync pass catches those.
 */
export async function resolveAndValidateTarget(
  url: string,
  options?: { allowPrivate?: boolean },
): Promise<ResolvedTarget> {
  const sync = validateTargetUrl(url, options);
  if (!sync.valid) return { valid: false, error: sync.error, code: sync.code };

  // Self-hosted escape hatch: skip resolution and pinning entirely.
  if (options?.allowPrivate) return { valid: true };

  const hostname = new URL(url.trim()).hostname;

  // IPv6 literal (bracketed) — already validated by the sync pass.
  if (hostname.startsWith('[')) {
    return { valid: true, address: hostname.slice(1, -1), family: 6 };
  }
  // IPv4 literal (dotted-quad, normalised by WHATWG URL) — already validated.
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(hostname)) {
    return { valid: true, address: hostname, family: 4 };
  }

  // Domain name — resolve every address and reject if any is private/reserved.
  let addrs: Array<{ address: string; family: number }>;
  try {
    addrs = await dnsLookup(hostname, { all: true });
  } catch {
    return { valid: false, error: `Could not resolve host: ${hostname}`, code: 'BLOCKED_HOST' };
  }
  if (addrs.length === 0) {
    return { valid: false, error: `Could not resolve host: ${hostname}`, code: 'BLOCKED_HOST' };
  }
  for (const a of addrs) {
    if (isPrivateIp(a.address)) {
      return {
        valid: false,
        error: `Blocked private/reserved IP for ${hostname}: ${a.address}`,
        code: 'BLOCKED_IP',
      };
    }
  }

  // Pin to the first validated address.
  return { valid: true, address: addrs[0].address, family: addrs[0].family };
}

/**
 * A one-shot undici dispatcher that pins every connection to a single,
 * pre-validated IP. This stops the connect step from re-resolving the hostname
 * to a different (internal) address after validation. The original URL is still
 * used for the request, so the Host header and TLS SNI remain correct.
 * Close it after the request (see the fire routes' finally block).
 */
export function pinnedDispatcher(address: string, family: number): Agent {
  const lookup: LookupFunction = (_hostname, _options, callback) => {
    callback(null, address, family);
  };
  return new Agent({ connect: { lookup } });
}
