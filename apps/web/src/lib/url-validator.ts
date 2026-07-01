// Copyright 2026 Sutyr Inc. SPDX-License-Identifier: Apache-2.0

export interface UrlValidationResult {
  valid: boolean;
  error?: string;
  code?: 'INVALID_URL' | 'BLOCKED_SCHEME' | 'BLOCKED_HOST' | 'BLOCKED_IP';
}

const BLOCKED_HOSTS = new Set([
  'localhost',
  'metadata.google.internal',
  'metadata.google.internal.',
]);

function isPrivateIpv4(ip: string): boolean {
  const parts = ip.split('.');
  if (parts.length !== 4) return false;

  const octets = parts.map(Number);
  if (octets.some((o) => Number.isNaN(o) || o < 0 || o > 255)) return false;

  const [a, b] = octets;

  // 0.0.0.0
  if (octets.every((o) => o === 0)) return true;
  // 127.0.0.0/8 (loopback)
  if (a === 127) return true;
  // 10.0.0.0/8 (private)
  if (a === 10) return true;
  // 172.16.0.0/12 (private)
  if (a === 172 && b >= 16 && b <= 31) return true;
  // 192.168.0.0/16 (private)
  if (a === 192 && b === 168) return true;
  // 169.254.0.0/16 (link-local / cloud metadata)
  if (a === 169 && b === 254) return true;
  // 100.64.0.0/10 (RFC 6598 carrier-grade NAT / shared address space)
  if (a === 100 && b >= 64 && b <= 127) return true;

  return false;
}

export function isPrivateIp(hostname: string): boolean {
  // IPv6 loopback
  if (hostname === '[::1]' || hostname === '::1') return true;

  // Strip brackets for IPv6
  const ip = hostname.startsWith('[') ? hostname.slice(1, -1) : hostname;

  // IPv6 unique local (fc00::/7) and link-local (fe80::/10)
  const lower = ip.toLowerCase();
  if (lower.startsWith('fc') || lower.startsWith('fd') || lower.startsWith('fe80:')) return true;

  // IPv4-mapped IPv6 (::ffff:x.x.x.x or ::ffff:7f00:1)
  if (lower.startsWith('::ffff:')) {
    const mapped = lower.slice(7);
    if (mapped.includes('.')) {
      return isPrivateIpv4(mapped);
    }
    // Hex format: convert ::ffff:7f00:1 → 127.0.0.1
    // Format is two 16-bit groups representing the IPv4 address
    const hexParts = mapped.split(':');
    if (hexParts.length === 2) {
      const high = parseInt(hexParts[0], 16); // e.g., 0x7f00 = 32512
      const low = parseInt(hexParts[1], 16);   // e.g., 0x0001 = 1
      const a = (high >> 8) & 0xff;  // first octet
      const b = high & 0xff;          // second octet
      const c = (low >> 8) & 0xff;    // third octet
      const d = low & 0xff;           // fourth octet
      return isPrivateIpv4(`${a}.${b}.${c}.${d}`);
    }
  }

  // IPv4 parsing
  return isPrivateIpv4(ip);
}

export function validateTargetUrl(
  url: string,
  options?: { allowPrivate?: boolean },
): UrlValidationResult {
  const trimmed = url.trim();
  if (!trimmed) {
    return { valid: false, error: 'URL is required', code: 'INVALID_URL' };
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return { valid: false, error: 'Invalid URL format', code: 'INVALID_URL' };
  }

  // Scheme check — always enforced, even with allowPrivate
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return {
      valid: false,
      error: `Blocked scheme: ${parsed.protocol}. Only http: and https: are allowed.`,
      code: 'BLOCKED_SCHEME',
    };
  }

  const hostname = parsed.hostname;

  if (!options?.allowPrivate) {
    // Blocked hostnames
    if (BLOCKED_HOSTS.has(hostname)) {
      return {
        valid: false,
        error: `Blocked host: ${hostname}`,
        code: 'BLOCKED_HOST',
      };
    }

    // Blocked IPs
    if (isPrivateIp(hostname)) {
      return {
        valid: false,
        error: `Blocked private/reserved IP: ${hostname}`,
        code: 'BLOCKED_IP',
      };
    }
  }

  return { valid: true };
}
