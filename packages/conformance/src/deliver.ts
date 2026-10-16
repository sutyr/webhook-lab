// Copyright 2026 Sutyr Inc. SPDX-License-Identifier: Apache-2.0
import { randomUUID } from 'node:crypto';
import type { StripeEvent } from '@webhook-lab/events';
import { sign } from '@webhook-lab/signatures';
import type { Delivery, Transport } from './types.js';

/** The User-Agent Stripe sends with webhook deliveries. */
export const STRIPE_USER_AGENT = 'Stripe/1.0 (+https://stripe.com/docs/webhooks)';

/** Delivery.responseBody keeps at most this many characters. */
const RESPONSE_BODY_LIMIT = 4096;

export interface SendOptions {
  label: string;
  event: StripeEvent;
  /** The Stripe-Signature header to send, or null to send none. */
  signatureHeader: string | null;
  /** The exact body to send. Defaults to JSON.stringify(event), which is what sign() covers. */
  body?: string;
}

/**
 * Send one webhook request and record the outcome. A transport that throws is
 * recorded as a delivery with no response, never rethrown, so one broken
 * request cannot abort a suite.
 */
export async function send(
  transport: Transport,
  url: string,
  options: SendOptions,
): Promise<Delivery> {
  const requestId = randomUUID();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'User-Agent': STRIPE_USER_AGENT,
    'X-Webhook-Lab-Request-Id': requestId,
  };
  if (options.signatureHeader !== null) {
    headers['Stripe-Signature'] = options.signatureHeader;
  }

  const base = {
    label: options.label,
    eventId: options.event.id,
    eventType: options.event.type,
    requestId,
    signatureHeader: options.signatureHeader,
  };

  try {
    const res = await transport({
      url,
      headers,
      body: options.body ?? JSON.stringify(options.event),
    });
    const delivery: Delivery = {
      ...base,
      status: res.status,
      durationMs: Math.max(0, Math.round(res.durationMs)),
      responseBody: res.body.slice(0, RESPONSE_BODY_LIMIT),
    };
    if (res.error !== undefined) delivery.error = res.error;
    if (res.timedOut) delivery.timedOut = true;
    return delivery;
  } catch (err) {
    return {
      ...base,
      status: 0,
      durationMs: 0,
      responseBody: '',
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export interface DeliverEventOptions {
  url: string;
  secret: string;
  transport: Transport;
  event: StripeEvent;
  label?: string;
}

/** Sign an event with the current time and deliver it, the way Stripe does. */
export function deliverEvent(options: DeliverEventOptions): Promise<Delivery> {
  return send(options.transport, options.url, {
    label: options.label ?? options.event.type,
    event: options.event,
    signatureHeader: sign(options.event, options.secret),
  });
}
