// Copyright 2026 Sutyr Inc. SPDX-License-Identifier: Apache-2.0
import 'server-only';

import { lookup as dnsLookup } from 'node:dns/promises';
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
 * checks, then, for domain names, resolves every A/AAAA record and rejects if
 * ANY resolved address is private or reserved. This closes the confirmed SSRF
 * path where a domain name points at an internal or reserved IP.
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

  // Validated. address/family are returned for reference (e.g. logging); the
  // routes fetch by hostname. NOTE: this leaves a narrow DNS-rebinding residual
  // (the record could flip between this lookup and fetch's own lookup); the
  // confirmed exploit (a domain whose record points at an internal IP) is fully
  // closed here. Connection pinning was tried but broke legitimate public
  // fetches on the runtime, so it is deferred to a properly-tested follow-up.
  return { valid: true, address: addrs[0].address, family: addrs[0].family };
}
