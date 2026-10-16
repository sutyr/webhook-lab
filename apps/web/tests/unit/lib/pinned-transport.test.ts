// Copyright 2026 Sutyr Inc. SPDX-License-Identifier: Apache-2.0

import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { lookup } from 'node:dns';
import { pinnedTransport } from '@/lib/pinned-transport';

// The guarded lookup is the only resolver the transport uses. Mocking it lets
// a test decide what a hostname resolves to at connect time.
vi.mock('node:dns', () => ({ lookup: vi.fn() }));

type LookupCb = (err: Error | null, addresses: Array<{ address: string; family: number }>) => void;

function resolveTo(address: string, family = 4) {
  vi.mocked(lookup).mockImplementation(((_host: string, _opts: unknown, cb: LookupCb) => {
    cb(null, [{ address, family }]);
  }) as unknown as typeof lookup);
}

let server: http.Server;
let port: number;
const received: Array<{ host?: string; headers: http.IncomingHttpHeaders; body: string }> = [];

beforeAll(async () => {
  server = http.createServer((req, res) => {
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', () => {
      received.push({ host: req.headers.host, headers: req.headers, body });
      if (req.url === '/redirect') {
        res.writeHead(302, { Location: 'http://169.254.169.254/' }).end();
      } else if (req.url === '/big') {
        res.writeHead(200).end('x'.repeat(10_000));
      } else if (req.url === '/slow') {
        setTimeout(() => res.writeHead(200).end('late'), 500);
      } else {
        res.writeHead(200, { 'Content-Type': 'text/plain' }).end('ok');
      }
    });
  });
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  port = (server.address() as AddressInfo).port;
});

afterAll(() => new Promise<void>((r) => server.close(() => r())));

beforeEach(() => {
  received.length = 0;
  vi.mocked(lookup).mockReset();
});

const req = (url: string) => ({
  url,
  headers: { 'Content-Type': 'application/json', 'Stripe-Signature': 't=1,v1=abc' },
  body: '{"id":"evt_1"}',
});

describe('pinnedTransport', () => {
  it('connects to the address the guarded lookup validated, keeping the hostname', async () => {
    resolveTo('127.0.0.1');
    const send = pinnedTransport({ allowPrivate: true, timeoutMs: 2000, maxBodyBytes: 1024 });
    const res = await send(req(`http://pinned.test:${port}/webhook`));
    expect(res.status).toBe(200);
    expect(res.body).toBe('ok');
    expect(received[0]!.host).toBe(`pinned.test:${port}`);
    expect(received[0]!.headers['stripe-signature']).toBe('t=1,v1=abc');
    expect(received[0]!.body).toBe('{"id":"evt_1"}');
  });

  it('refuses a hostname that resolves to a private address at connect time (DNS rebinding)', async () => {
    resolveTo('127.0.0.1');
    const send = pinnedTransport({ allowPrivate: false, timeoutMs: 2000, maxBodyBytes: 1024 });
    const res = await send(req(`http://rebind.test:${port}/webhook`));
    expect(res.status).toBe(0);
    expect(res.error).toMatch(/Blocked private\/reserved IP for rebind\.test: 127\.0\.0\.1/);
    expect(received).toHaveLength(0);
  });

  it('refuses when any resolved address is private', async () => {
    vi.mocked(lookup).mockImplementation(((_h: string, _o: unknown, cb: LookupCb) => {
      cb(null, [{ address: '93.184.216.34', family: 4 }, { address: '10.0.0.5', family: 4 }]);
    }) as unknown as typeof lookup);
    const send = pinnedTransport({ allowPrivate: false, timeoutMs: 2000, maxBodyBytes: 1024 });
    const res = await send(req('http://mixed.test/webhook'));
    expect(res.status).toBe(0);
    expect(res.error).toMatch(/10\.0\.0\.5/);
  });

  it('does not follow redirects', async () => {
    resolveTo('127.0.0.1');
    const send = pinnedTransport({ allowPrivate: true, timeoutMs: 2000, maxBodyBytes: 1024 });
    const res = await send(req(`http://pinned.test:${port}/redirect`));
    expect(res.status).toBe(302);
    expect(received).toHaveLength(1);
  });

  it('stops reading the body at maxBodyBytes', async () => {
    resolveTo('127.0.0.1');
    const send = pinnedTransport({ allowPrivate: true, timeoutMs: 2000, maxBodyBytes: 100 });
    const res = await send(req(`http://pinned.test:${port}/big`));
    expect(res.status).toBe(200);
    expect(res.body.length).toBe(100);
  });

  it('times out with the same message and flag as fetchTransport', async () => {
    resolveTo('127.0.0.1');
    const send = pinnedTransport({ allowPrivate: true, timeoutMs: 100, maxBodyBytes: 1024 });
    const res = await send(req(`http://pinned.test:${port}/slow`));
    expect(res.status).toBe(0);
    expect(res.timedOut).toBe(true);
    expect(res.error).toBe('No response within 100 ms');
  });

  it('reports an unparseable URL as an error, not a throw', async () => {
    const send = pinnedTransport({ allowPrivate: false, timeoutMs: 2000, maxBodyBytes: 1024 });
    const res = await send(req('not a url'));
    expect(res).toMatchObject({ status: 0, error: 'Invalid target URL' });
  });

  it('reports a DNS failure as an error, not a throw', async () => {
    vi.mocked(lookup).mockImplementation(((_h: string, _o: unknown, cb: LookupCb) => {
      cb(Object.assign(new Error('getaddrinfo ENOTFOUND nowhere.test'), { code: 'ENOTFOUND' }), []);
    }) as unknown as typeof lookup);
    const send = pinnedTransport({ allowPrivate: false, timeoutMs: 2000, maxBodyBytes: 1024 });
    const res = await send(req('https://nowhere.test/webhook'));
    expect(res.status).toBe(0);
    expect(res.error).toMatch(/nowhere\.test/);
  });
});
