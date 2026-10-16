// Copyright 2026 Sutyr Inc. SPDX-License-Identifier: Apache-2.0
import { STRIPE_API_VERSION } from '@webhook-lab/events';
import { CHECKS, CHECK_RUNNERS, sendBaseline, type CheckContext } from './checks.js';
import { send, type SendOptions } from './deliver.js';
import type {
  CheckDefinition,
  CheckResult,
  Delivery,
  RunSuiteOptions,
  SuiteReport,
  SuiteSummary,
} from './types.js';

const DEFAULT_SPACING_MS = 150;

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Pick the checks to run, in CHECKS order. Throws a RangeError naming any id
 * that is not a known check, so a typo never silently runs nothing.
 */
export function selectChecks(only?: readonly string[]): CheckDefinition[] {
  if (only === undefined) return [...CHECKS];
  const known = new Set<string>(CHECKS.map((c) => c.id));
  const unknown = only.filter((id) => !known.has(id));
  if (unknown.length > 0) {
    throw new RangeError(
      `Unknown check id: ${unknown.join(', ')}. Known ids: ${[...known].join(', ')}`,
    );
  }
  const wanted = new Set(only);
  return CHECKS.filter((c) => wanted.has(c.id));
}

/**
 * Run the conformance checks against one webhook handler. Deliveries go out
 * one at a time, spaced slightly apart. Transport failures become 'error'
 * results; runSuite itself only throws for bad options.
 */
export async function runSuite(options: RunSuiteOptions): Promise<SuiteReport> {
  if (!options.url) throw new TypeError('runSuite: url is required');
  if (!options.secret) throw new TypeError('runSuite: secret is required');

  const selected = selectChecks(options.only);
  const spacingMs = options.spacingMs ?? DEFAULT_SPACING_MS;
  let sent = 0;
  let baselinePromise: Promise<Delivery> | undefined;
  let baselineDelivery: Delivery | undefined;

  const ctx: CheckContext = {
    secret: options.secret,
    async send(sendOptions: SendOptions) {
      if (sent > 0 && spacingMs > 0) await sleep(spacingMs);
      sent += 1;
      return send(options.transport, options.url, sendOptions);
    },
    baseline() {
      baselinePromise ??= sendBaseline(ctx).then((d) => (baselineDelivery = d));
      return baselinePromise;
    },
    sentBaseline: () => baselineDelivery,
  };

  const results: CheckResult[] = [];
  const summary: SuiteSummary = { pass: 0, fail: 0, warn: 0, error: 0 };

  for (const check of selected) {
    let result: CheckResult;
    try {
      const { expected, verdict, deliveries } = await CHECK_RUNNERS[check.id](ctx);
      result = {
        id: check.id,
        title: check.title,
        status: verdict.status,
        expected,
        observed: verdict.observed,
        why: check.why,
        durationMs: deliveries.reduce((total, d) => total + d.durationMs, 0),
        deliveries,
      };
    } catch (err) {
      // Generators and signing are local and should not throw; if one does,
      // report it against the check rather than abandoning the suite.
      result = {
        id: check.id,
        title: check.title,
        status: 'error',
        expected: '',
        observed: err instanceof Error ? err.message : String(err),
        why: check.why,
        durationMs: 0,
        deliveries: [],
      };
    }
    results.push(result);
    summary[result.status] += 1;
    options.onResult?.(result);
  }

  return {
    target: options.url,
    apiVersion: STRIPE_API_VERSION,
    results,
    summary,
  };
}
