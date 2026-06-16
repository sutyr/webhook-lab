// Copyright 2026 Sutyr Inc. SPDX-License-Identifier: Apache-2.0

import { describe, it, expect } from 'vitest';
import { POST } from '@/app/api/fire-scenario/route';

function makeRequest(body: unknown): Request {
  return new Request('http://localhost/api/fire-scenario', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/fire-scenario', () => {
  it('returns steps array for valid scenario ID', async () => {
    const request = makeRequest({ scenarioId: 'subscription-happy-path' });
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.steps).toBeDefined();
    expect(Array.isArray(data.steps)).toBe(true);
    expect(data.steps.length).toBeGreaterThan(0);
  });

  it('returns 400 UNKNOWN_SCENARIO for invalid scenario ID', async () => {
    const request = makeRequest({ scenarioId: 'nonexistent-scenario' });
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error.code).toBe('UNKNOWN_SCENARIO');
  });

  it('each step has event, delayMs, and description', async () => {
    const request = makeRequest({ scenarioId: 'refund-flow' });
    const response = await POST(request);
    const data = await response.json();

    for (const step of data.steps) {
      expect(step).toHaveProperty('event');
      expect(step).toHaveProperty('delayMs');
      expect(step).toHaveProperty('description');
      expect(typeof step.delayMs).toBe('number');
      expect(typeof step.description).toBe('string');
      expect(step.event).toHaveProperty('id');
      expect(step.event).toHaveProperty('type');
    }
  });

  it('returns correct step count for each scenario', async () => {
    const scenarios: Record<string, number> = {
      'subscription-happy-path': 7,
      'subscription-failure': 7,
      'checkout-flow': 3,
      'dispute-lifecycle': 4,
      'refund-flow': 2,
    };

    for (const [id, expectedCount] of Object.entries(scenarios)) {
      const request = makeRequest({ scenarioId: id });
      const response = await POST(request);
      const data = await response.json();

      expect(data.steps.length).toBe(expectedCount);
    }
  });

  it('returns 400 when scenarioId is missing', async () => {
    const request = makeRequest({});
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error.code).toBe('UNKNOWN_SCENARIO');
  });
});
