// Copyright 2026 Sutyr Inc. SPDX-License-Identifier: Apache-2.0
// Spots target URLs the hosted Lab cannot reach (this machine or a private
// network) while the user types, so the editor can point to the CLI before a
// request is refused. The server's SSRF checks stay the authority: this only
// decides whether to show a hint.

function isPrivateIpv4(host: string): boolean {
  const parts = host.split('.');
  if (parts.length !== 4 || !parts.every((p) => /^\d{1,3}$/.test(p))) return false;
  const [a, b] = parts.map(Number);
  return (
    a === 0 || // 0.0.0.0/8, "this host"
    a === 127 || // loopback
    a === 10 ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 169 && b === 254) || // link-local
    (a === 100 && b >= 64 && b <= 127) // carrier-grade NAT
  );
}

function isPrivateIpv6(literal: string): boolean {
  const ip = literal.toLowerCase();
  if (ip === '::1' || ip === '::') return true;
  if (/^f[cd][0-9a-f]{0,2}:/.test(ip)) return true; // fc00::/7 unique local
  if (/^fe[89ab][0-9a-f]?:/.test(ip)) return true; // fe80::/10 link-local
  // IPv4-mapped, which the URL parser writes in hex: ::ffff:7f00:1
  const mapped = /^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/.exec(ip);
  if (mapped) {
    const high = parseInt(mapped[1], 16);
    const low = parseInt(mapped[2], 16);
    return isPrivateIpv4(`${high >> 8}.${high & 0xff}.${low >> 8}.${low & 0xff}`);
  }
  return false;
}

/** True for a hostname on this machine or a private network. */
export function isLocalHostname(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/\.$/, '');
  if (host === 'localhost' || host.endsWith('.localhost')) return true;
  if (host.endsWith('.local')) return true; // mDNS names only resolve on the LAN
  if (host.startsWith('[') && host.endsWith(']')) return isPrivateIpv6(host.slice(1, -1));
  return isPrivateIpv4(host);
}

export interface LocalTarget {
  /** The URL to put in a CLI command, with http:// added when it was left off. */
  url: string;
  /** The hostname as the URL parser normalised it, for the note's wording. */
  hostname: string;
}

/**
 * When `raw` points at this machine or a private network, the URL to hand to
 * the CLI. People often type "localhost:3000/webhooks" without a scheme, which
 * the hosted Lab refuses outright, so that form counts as http:// too.
 * Returns null for public hosts and anything that is not an http(s) URL.
 */
export function localTarget(raw: string): LocalTarget | null {
  const text = raw.trim();
  if (text === '') return null;
  const candidates = text.includes('://') ? [text] : [text, `http://${text}`];
  for (const candidate of candidates) {
    let parsed: URL;
    try {
      parsed = new URL(candidate);
    } catch {
      continue;
    }
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') continue;
    if (!isLocalHostname(parsed.hostname)) return null;
    return { url: candidate, hostname: parsed.hostname };
  }
  return null;
}
