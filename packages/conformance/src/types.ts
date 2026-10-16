// Copyright 2026 Sutyr Inc. SPDX-License-Identifier: Apache-2.0

// ─── Transport ───────────────────────────────────────────────────────────────
// The engine never opens a socket itself. A Transport sends one POST to the
// handler under test and reports what came back, so the CLI can reach
// localhost while a hosted caller can put its own URL checks in front.

export interface TransportRequest {
  url: string;
  headers: Record<string, string>;
  body: string;
}

export interface TransportResponse {
  /** HTTP status code, or 0 when no response arrived. */
  status: number;
  body: string;
  durationMs: number;
  /** Why no response arrived (connection refused, DNS failure, timeout). */
  error?: string;
  /** True when the transport gave up waiting. */
  timedOut?: boolean;
}

export type Transport = (req: TransportRequest) => Promise<TransportResponse>;

// ─── Checks ──────────────────────────────────────────────────────────────────

export type CheckId =
  | 'valid-event-accepted'
  | 'forged-signature-rejected'
  | 'missing-signature-rejected'
  | 'tampered-body-rejected'
  | 'stale-timestamp-rejected'
  | 'duplicate-delivery-acknowledged'
  | 'out-of-order-acknowledged'
  | 'unhandled-event-acknowledged'
  | 'responds-in-time';

/**
 * pass: the handler did what Stripe expects.
 * fail: it did something that loses events or lets forged ones in.
 * warn: it works, but not the way Stripe recommends.
 * error: the Lab could not get an answer, so nothing was judged.
 */
export type CheckStatus = 'pass' | 'fail' | 'warn' | 'error';

export interface CheckDefinition {
  id: CheckId;
  title: string;
  why: string;
}

/** One request the Lab sent during a check, and what came back. */
export interface Delivery {
  label: string;
  eventId: string;
  eventType: string;
  /** Sent as X-Webhook-Lab-Request-Id so the delivery can be found in handler logs. */
  requestId: string;
  /** The Stripe-Signature header sent, or null when the check sends none. */
  signatureHeader: string | null;
  /** HTTP status code, or 0 when no response arrived. */
  status: number;
  durationMs: number;
  /** Response body, capped at 4 KB. */
  responseBody: string;
  error?: string;
  timedOut?: boolean;
}

export interface CheckResult {
  id: CheckId;
  title: string;
  status: CheckStatus;
  expected: string;
  observed: string;
  why: string;
  /** Total time the handler took across this check's deliveries. */
  durationMs: number;
  deliveries: Delivery[];
}

export interface SuiteSummary {
  pass: number;
  fail: number;
  warn: number;
  error: number;
}

export interface SuiteReport {
  target: string;
  apiVersion: string;
  results: CheckResult[];
  summary: SuiteSummary;
}

export interface RunSuiteOptions {
  url: string;
  /** The signing secret the handler verifies with (whsec_...). */
  secret: string;
  transport: Transport;
  /** Run only these check ids. Checks still run in CHECKS order. */
  only?: string[];
  /** Called after each check, in run order. */
  onResult?: (result: CheckResult) => void;
  /** Pause between deliveries in milliseconds. Defaults to 150. */
  spacingMs?: number;
}
