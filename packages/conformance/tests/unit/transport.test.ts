// Copyright 2026 Sutyr Inc. SPDX-License-Identifier: Apache-2.0
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createServer, type IncomingMessage, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { customerCreated } from '@webhook-lab/events';
import { verify } from '@webhook-lab/signatures';
import { deliverEvent, fetchTransport, STRIPE_USER_AGENT } from '../../src/index.js';

const SECRET = 'whsec_transport_test_secret';

let server: Server;
let base: string;
let lastRequest: { headers: IncomingMessage['headers']; body: string; method?: string } | undefined;

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve) => {
    const chunks: Buffer[] = [];
    req.on('data', (c: Buffer) => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
  });
}

beforeAll(async () => {
  server = createServer(async (req, res) => {
    const body = await readBody(req);
    lastRequest = { headers: req.headers, body, method: req.method };
    switch (req.url) {
      case '/ok':
        res.writeHead(200, { 'Content-Type': 'application/json' }).end('{"received":true}');
        return;
      case '/redirect':
        res.writeHead(302, { Location: '/ok' }).end();
        return;
      case '/slow':
        setTimeout(() => res.writeHead(200).end('late'), 500);
        return;
      case '/big':
        res.writeHead(200).end('x'.repeat(200_000));
        return;
      default:
        res.writeHead(404).end('not found');
    }
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(async () => {
  server.closeAllConnections();
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

describe('fetchTransport', () => {
  it('POSTs the body and headers and returns status, body and timing', async () => {
    const transport = fetchTransport();
    const res = await transport({
      url: `${base}/ok`,
      headers: { 'Content-Type': 'application/json', 'X-Test': 'yes' },
      body: '{"hello":"world"}',
    });
    expect(res.status).toBe(200);
    expect(res.body).toBe('{"received":true}');
    expect(res.durationMs).toBeGreaterThanOrEqual(0);
    expect(res.error).toBeUndefined();
    expect(lastRequest?.method).toBe('POST');
    expect(lastRequest?.body).toBe('{"hello":"world"}');
    expect(lastRequest?.headers['x-test']).toBe('yes');
  });

  it('does not follow redirects, because Stripe counts them as failures', async () => {
    const res = await fetchTransport()({ url: `${base}/redirect`, headers: {}, body: '{}' });
    expect(res.status).toBe(302);
  });

  it('gives up after the timeout and says so', async () => {
    const res = await fetchTransport({ timeoutMs: 100 })({ url: `${base}/slow`, headers: {}, body: '{}' });
    expect(res.status).toBe(0);
    expect(res.timedOut).toBe(true);
    expect(res.error).toBe('No response within 100 ms');
  });

  it('clamps a timeout too large for a timer rather than giving up after 1 ms', async () => {
    const res = await fetchTransport({ timeoutMs: 3_000_000_000 })({ url: `${base}/slow`, headers: {}, body: '{}' });
    expect(res.timedOut).toBeUndefined();
    expect(res.status).toBe(200);
    expect(res.body).toBe('late');
  });

  it('caps how much of the body it reads', async () => {
    const res = await fetchTransport({ maxBodyBytes: 1024 })({ url: `${base}/big`, headers: {}, body: '{}' });
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1024);
  });

  it('reports a refused connection with the network reason', async () => {
    const closed = createServer();
    await new Promise<void>((resolve) => closed.listen(0, '127.0.0.1', resolve));
    const port = (closed.address() as AddressInfo).port;
    await new Promise<void>((resolve) => closed.close(() => resolve()));

    const res = await fetchTransport()({ url: `http://127.0.0.1:${port}/`, headers: {}, body: '{}' });
    expect(res.status).toBe(0);
    expect(res.timedOut).toBeUndefined();
    expect(res.error).toMatch(/ECONNREFUSED/);
  });
});

describe('deliverEvent', () => {
  it('signs the event and sends it the way Stripe does', async () => {
    const event = customerCreated();
    const delivery = await deliverEvent({ url: `${base}/ok`, secret: SECRET, transport: fetchTransport(), event });

    expect(delivery.status).toBe(200);
    expect(delivery.eventId).toBe(event.id);
    expect(delivery.eventType).toBe('customer.created');
    expect(delivery.responseBody).toBe('{"received":true}');

    expect(lastRequest?.headers['content-type']).toBe('application/json');
    expect(lastRequest?.headers['user-agent']).toBe(STRIPE_USER_AGENT);
    expect(lastRequest?.headers['x-webhook-lab-request-id']).toBe(delivery.requestId);
    const signature = lastRequest?.headers['stripe-signature'] as string;
    expect(signature).toBe(delivery.signatureHeader);
    expect(verify(lastRequest!.body, signature, SECRET, 300)).toBe(true);
    expect(JSON.parse(lastRequest!.body)).toEqual(event);
  });
});
