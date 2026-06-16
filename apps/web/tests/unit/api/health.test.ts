// Copyright 2026 Sutyr Inc. SPDX-License-Identifier: Apache-2.0

import { describe, it, expect } from 'vitest';
import { GET } from '@/app/api/health/route';
import { STRIPE_API_VERSION } from '@webhook-lab/events';

describe('GET /api/health', () => {
  it('returns 200', async () => {
    const response = await GET();
    expect(response.status).toBe(200);
  });

  it('returns status ok', async () => {
    const response = await GET();
    const data = await response.json();
    expect(data.status).toBe('ok');
  });

  it('returns a version string', async () => {
    const response = await GET();
    const data = await response.json();
    expect(typeof data.version).toBe('string');
    expect(data.version.length).toBeGreaterThan(0);
  });

  it('returns stripeApiVersion matching the events package constant', async () => {
    const response = await GET();
    const data = await response.json();
    expect(data.stripeApiVersion).toBe(STRIPE_API_VERSION);
  });

  it('returns a valid Unix timestamp', async () => {
    const before = Math.floor(Date.now() / 1000);
    const response = await GET();
    const data = await response.json();
    const after = Math.floor(Date.now() / 1000);
    expect(data.timestamp).toBeGreaterThanOrEqual(before);
    expect(data.timestamp).toBeLessThanOrEqual(after);
  });
});
