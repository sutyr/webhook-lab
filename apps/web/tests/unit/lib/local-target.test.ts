// Copyright 2026 Sutyr Inc. SPDX-License-Identifier: Apache-2.0

import { describe, it, expect } from 'vitest';
import { isLocalHostname, localTarget } from '@/lib/local-target';

describe('localTarget', () => {
  it.each([
    'http://localhost:3000/webhooks',
    'http://LOCALHOST/hook',
    'http://api.localhost:4000/hook',
    'http://127.0.0.1:3000/hook',
    'http://127.12.0.9/hook',
    'http://[::1]:3000/hook',
    'http://0.0.0.0:8080/hook',
    'http://10.0.0.5/hook',
    'http://172.16.3.4/hook',
    'http://172.31.255.255/hook',
    'http://192.168.1.20:3000/hook',
    'http://169.254.10.10/hook',
    'http://100.64.0.1/hook',
    'http://[fd12:3456::1]/hook',
    'http://[fe80::1]/hook',
    'http://[::ffff:127.0.0.1]/hook',
    'http://my-laptop.local:3000/hook',
    'https://localhost/hook',
  ])('points %s at the CLI', (url) => {
    expect(localTarget(url)).not.toBeNull();
  });

  it.each([
    'https://example.com/hook',
    'https://staging.example.com/webhooks',
    'http://172.32.0.1/hook',
    'http://11.0.0.1/hook',
    'https://fcbarcelona.com/hook',
    'https://fdic.gov/hook',
    'https://localhost.example.com/hook',
    'http://[2606:4700::1111]/hook',
    'https://webhook.site/abc',
  ])('leaves %s to the hosted Lab', (url) => {
    expect(localTarget(url)).toBeNull();
  });

  it('treats a URL typed without a scheme as http', () => {
    expect(localTarget('localhost:3000/webhooks')).toEqual({
      url: 'http://localhost:3000/webhooks',
      hostname: 'localhost',
    });
    expect(localTarget('127.0.0.1:4242')).toEqual({ url: 'http://127.0.0.1:4242', hostname: '127.0.0.1' });
  });

  it('keeps what the user typed when it has a scheme', () => {
    expect(localTarget('  http://localhost:3000/webhooks?x=1 ')).toEqual({
      url: 'http://localhost:3000/webhooks?x=1',
      hostname: 'localhost',
    });
  });

  it('reports the normalised hostname', () => {
    expect(localTarget('http://127.1:3000/')?.hostname).toBe('127.0.0.1');
    expect(localTarget('http://[::1]/')?.hostname).toBe('[::1]');
  });

  it('ignores empty input, other schemes and text that is not a URL', () => {
    expect(localTarget('')).toBeNull();
    expect(localTarget('   ')).toBeNull();
    expect(localTarget('ftp://localhost/file')).toBeNull();
    expect(localTarget('not a url')).toBeNull();
  });
});

describe('isLocalHostname', () => {
  it('ignores a trailing dot', () => {
    expect(isLocalHostname('localhost.')).toBe(true);
  });

  it('does not treat domain names that start like IPv6 prefixes as private', () => {
    expect(isLocalHostname('fc.example.com')).toBe(false);
    expect(isLocalHostname('fe80.example.com')).toBe(false);
  });
});
