// Copyright 2026 Sutyr Inc. SPDX-License-Identifier: Apache-2.0
// ─── Types ───────────────────────────────────────────────────────────────────

export type {
  Transport,
  TransportRequest,
  TransportResponse,
  CheckId,
  CheckStatus,
  CheckDefinition,
  CheckResult,
  Delivery,
  SuiteReport,
  SuiteSummary,
  RunSuiteOptions,
} from './types.js';
export type { FetchTransportOptions } from './transport.js';
export type { DeliverEventOptions } from './deliver.js';

// ─── Suite ───────────────────────────────────────────────────────────────────

export {
  CHECKS,
  STALE_TIMESTAMP_AGE_SECONDS,
  RESPONSE_PASS_UNDER_MS,
  RESPONSE_FAIL_OVER_MS,
} from './checks.js';
export { runSuite, selectChecks } from './suite.js';

// ─── Delivery ────────────────────────────────────────────────────────────────

export { deliverEvent, STRIPE_USER_AGENT } from './deliver.js';
export { fetchTransport, DEFAULT_TIMEOUT_MS, DEFAULT_MAX_BODY_BYTES, MAX_TIMEOUT_MS } from './transport.js';
