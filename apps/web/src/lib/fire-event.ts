// Copyright 2026 Sutyr Inc. SPDX-License-Identifier: Apache-2.0
'use client';

import type { FireResponse } from '@/lib/lab-context';

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

  if (!res.ok) {
    const error = await res.json();
    const msg = error.error?.message ?? error.error ?? `Request failed with status ${res.status}`;
    throw new Error(msg);
  }

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

  if (!res.ok) {
    const error = await res.json();
    const msg = error.error?.message ?? error.error ?? `Request failed with status ${res.status}`;
    throw new Error(msg);
  }

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

  if (!res.ok) {
    const error = await res.json();
    const msg = error.error?.message ?? error.error ?? `Request failed with status ${res.status}`;
    throw new Error(msg);
  }

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

  if (!res.ok) {
    const error = await res.json();
    const msg = error.error?.message ?? error.error ?? `Request failed with status ${res.status}`;
    throw new Error(msg);
  }

  const data = await res.json();
  return data.steps;
}
