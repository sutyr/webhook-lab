// Copyright 2026 Sutyr Inc. SPDX-License-Identifier: Apache-2.0
import 'server-only';

import http from 'node:http';
import https from 'node:https';
import { lookup as dnsLookup, type LookupAddress } from 'node:dns';
import type { LookupFunction } from 'node:net';
import type { Transport, TransportResponse } from '@webhook-lab/conformance';
import { isPrivateIp } from './url-validator';

export interface PinnedTransportOptions {
  /** WEBHOOK_LAB_ALLOW_PRIVATE: self-hosted instances may reach private hosts. */
  allowPrivate: boolean;
  timeoutMs: number;
  maxBodyBytes: number;
}

/**
 * A lookup that resolves and validates in one step. The socket connects only
 * to an address this function returned, so a DNS record cannot flip to a
 * private address between the SSRF check and the connection (DNS rebinding).
 * IP literals never reach it; the URL validator has already checked those.
 */
function guardedLookup(allowPrivate: boolean): LookupFunction {
  return (hostname, options, callback) => {
    dnsLookup(hostname, { family: options.family, hints: options.hints, all: true }, (err, addresses) => {
      if (err) {
        callback(err, '', 0);
        return;
      }
      const list = addresses as LookupAddress[];
      if (list.length === 0) {
        callback(Object.assign(new Error(`Could not resolve host: ${hostname}`), { code: 'ENOTFOUND' }), '', 0);
        return;
      }
      if (!allowPrivate) {
        const blocked = list.find((a) => isPrivateIp(a.address));
        if (blocked) {
          const message = `Blocked private/reserved IP for ${hostname}: ${blocked.address}`;
          callback(Object.assign(new Error(message), { code: 'BLOCKED_IP' }), '', 0);
          return;
        }
      }
      if (options.all) {
        callback(null, list);
      } else {
        callback(null, list[0]!.address, list[0]!.family);
      }
    });
  };
}

/**
 * The hosted suite's Transport. Same contract as fetchTransport from
 * @webhook-lab/conformance (no redirects, capped body, identical timeout
 * result), but built on node:http(s) so the connection is pinned to the
 * validated address through guardedLookup. Never throws.
 */
export function pinnedTransport(options: PinnedTransportOptions): Transport {
  const lookup = guardedLookup(options.allowPrivate);

  return (req) =>
    new Promise<TransportResponse>((resolve) => {
      const started = performance.now();
      const elapsed = () => Math.round(performance.now() - started);
      let settled = false;
      let timer: ReturnType<typeof setTimeout> | undefined;
      const finish = (result: TransportResponse) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve(result);
      };

      let url: URL;
      try {
        url = new URL(req.url);
      } catch {
        finish({ status: 0, body: '', durationMs: 0, error: 'Invalid target URL' });
        return;
      }
      const client = url.protocol === 'https:' ? https : http;

      const outgoing = client.request(url, {
        method: 'POST',
        headers: { ...req.headers, 'Content-Length': String(Buffer.byteLength(req.body)) },
        lookup,
        // A fresh socket per delivery, so no pooled connection skips the lookup.
        agent: false,
      });

      timer = setTimeout(() => {
        outgoing.destroy();
        finish({
          status: 0,
          body: '',
          durationMs: elapsed(),
          error: `No response within ${options.timeoutMs} ms`,
          timedOut: true,
        });
      }, options.timeoutMs);

      outgoing.on('response', (res) => {
        const chunks: Buffer[] = [];
        let total = 0;
        const done = () =>
          finish({ status: res.statusCode ?? 0, body: Buffer.concat(chunks).toString('utf8'), durationMs: elapsed() });

        res.on('data', (chunk: Buffer) => {
          const room = options.maxBodyBytes - total;
          if (room > 0) {
            const part = chunk.byteLength > room ? chunk.subarray(0, room) : chunk;
            chunks.push(part);
            total += part.byteLength;
          }
          if (total >= options.maxBodyBytes) {
            // Cap reached: stop reading instead of buffering the rest.
            done();
            res.destroy();
          }
        });
        res.on('end', done);
        res.on('error', done);
      });

      outgoing.on('error', (err) => {
        finish({ status: 0, body: '', durationMs: elapsed(), error: err.message || 'Request failed' });
      });

      outgoing.end(req.body);
    });
}
