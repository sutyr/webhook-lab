// Copyright 2026 Sutyr Inc. SPDX-License-Identifier: Apache-2.0
'use client';

import type { FireResponse, SuiteRunResult } from '@/lib/lab-context';

/**
 * The message from an API error response ({ error: { code, message } }), or
 * a plain status line when the body is not that shape, such as a platform
 * timeout page.
 */
async function errorMessage(res: Response): Promise<string> {
  try {
    const data = (await res.json()) as { error?: { message?: unknown } | string };
    const msg = typeof data.error === 'string' ? data.error : data.error?.message;
    if (typeof msg === 'string' && msg !== '') return msg;
  } catch {
    // Not JSON; fall through to the status line.
  }
  return `Request failed with status ${res.status}`;
}

/**
 * Generate, sign, and fire an event at a target URL.
 * Calls the server-side `/api/fire` route.
 */
export async function fireEvent(params: {
  eventType: string;
  eventOptions: Record<string, unknown>;
  targetUrl: string;
  signingSecret: string;
}): Promise<FireResponse & { payload: object }> {
  const res = await fetch('/api/fire', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });

  if (!res.ok) throw new Error(await errorMessage(res));

  return res.json();
}

/**
 * Fire a pre-generated payload at a target URL.
 * Used for scenario steps where entity IDs must be preserved.
 * Calls the server-side `/api/fire-prepared` route.
 */
export async function firePrepared(params: {
  payload: object;
  targetUrl: string;
  signingSecret: string;
}): Promise<FireResponse> {
  const res = await fetch('/api/fire-prepared', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });

  if (!res.ok) throw new Error(await errorMessage(res));

  return res.json();
}

/**
 * Generate an event payload server-side without firing it.
 * Calls the server-side `/api/preview` route.
 */
export async function previewEvent(params: {
  eventType: string;
  eventOptions: Record<string, unknown>;
}): Promise<object> {
  const res = await fetch('/api/preview', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });

  if (!res.ok) throw new Error(await errorMessage(res));

  return res.json();
}

/**
 * Generate all steps for a scenario with shared entity IDs.
 * Calls the server-side `/api/fire-scenario` route.
 */
export async function loadScenarioSteps(
  scenarioId: string,
): Promise<Array<{ event: object; delayMs: number; description: string }>> {
  const res = await fetch('/api/fire-scenario', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ scenarioId }),
  });

  if (!res.ok) throw new Error(await errorMessage(res));

  const data = await res.json();
  return data.steps;
}

/**
 * Run the conformance suite against a target URL.
 * Calls the server-side `/api/run-suite` route, which sends up to 10
 * deliveries one at a time and can take most of a minute for a slow handler.
 */
export async function runChecks(params: {
  targetUrl: string;
  signingSecret: string;
}): Promise<SuiteRunResult> {
  let res: Response;
  try {
    res = await fetch('/api/run-suite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
  } catch {
    throw new Error('Could not reach Webhook Lab. Check your connection and try again.');
  }

  if (!res.ok) throw new Error(await errorMessage(res));

  return res.json();
}
