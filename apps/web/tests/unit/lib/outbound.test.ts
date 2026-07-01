// Copyright 2026 Sutyr Inc. SPDX-License-Identifier: Apache-2.0

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { lookup } from 'node:dns/promises';
import { resolveAndValidateTarget } from '@/lib/outbound';

vi.mock('node:dns/promises', () => ({
  lookup: vi.fn(),
}));

describe('resolveAndValidateTarget (DNS-aware SSRF validation)', () => {
  beforeEach(() => {
    vi.mocked(lookup).mockReset();
  });

  it('rejects a domain that resolves to a private IP (SSRF via DNS)', async () => {
    vi.mocked(lookup).mockResolvedValue([{ address: '10.0.0.5', family: 4 }] as never);
    const r = await resolveAndValidateTarget('http://internal.example.com/');
    expect(r.valid).toBe(false);
    expect(r.code).toBe('BLOCKED_IP');
  });

  it('rejects a domain that resolves to cloud metadata (169.254.169.254)', async () => {
    vi.mocked(lookup).mockResolvedValue([{ address: '169.254.169.254', family: 4 }] as never);
    const r = await resolveAndValidateTarget('http://169-254-169-254.nip.io/');
    expect(r.valid).toBe(false);
    expect(r.code).toBe('BLOCKED_IP');
  });

  it('rejects if ANY resolved address is private (mixed records)', async () => {
    vi.mocked(lookup).mockResolvedValue([
      { address: '93.184.216.34', family: 4 },
      { address: '127.0.0.1', family: 4 },
    ] as never);
    const r = await resolveAndValidateTarget('http://rebind.example.com/');
    expect(r.valid).toBe(false);
    expect(r.code).toBe('BLOCKED_IP');
  });

  it('allows a domain that resolves to a public IP and returns it for pinning', async () => {
    vi.mocked(lookup).mockResolvedValue([{ address: '93.184.216.34', family: 4 }] as never);
    const r = await resolveAndValidateTarget('https://example.com/webhook');
    expect(r.valid).toBe(true);
    expect(r.address).toBe('93.184.216.34');
    expect(r.family).toBe(4);
    expect(lookup).toHaveBeenCalledWith('example.com', expect.objectContaining({ all: true }));
  });

  it('blocks a private IP literal without any DNS lookup', async () => {
    const r = await resolveAndValidateTarget('http://127.0.0.1/');
    expect(r.valid).toBe(false);
    expect(r.code).toBe('BLOCKED_IP');
    expect(lookup).not.toHaveBeenCalled();
  });

  it('blocks a non-http scheme', async () => {
    const r = await resolveAndValidateTarget('file:///etc/passwd');
    expect(r.valid).toBe(false);
    expect(r.code).toBe('BLOCKED_SCHEME');
  });

  it('returns BLOCKED_HOST when the domain does not resolve', async () => {
    vi.mocked(lookup).mockRejectedValue(new Error('ENOTFOUND'));
    const r = await resolveAndValidateTarget('http://does-not-exist.example/');
    expect(r.valid).toBe(false);
    expect(r.code).toBe('BLOCKED_HOST');
  });

  it('skips resolution when allowPrivate is set (self-hosted)', async () => {
    const r = await resolveAndValidateTarget('http://10.0.0.1/', { allowPrivate: true });
    expect(r.valid).toBe(true);
    expect(lookup).not.toHaveBeenCalled();
  });

  it('pins a public IPv4 literal directly, no DNS', async () => {
    const r = await resolveAndValidateTarget('http://93.184.216.34/');
    expect(r.valid).toBe(true);
    expect(r.address).toBe('93.184.216.34');
    expect(r.family).toBe(4);
    expect(lookup).not.toHaveBeenCalled();
  });
});
