// Copyright 2026 Sutyr Inc. SPDX-License-Identifier: Apache-2.0

import { describe, it, expect } from 'vitest';
import { CHECKS, runSuite, type CheckStatus } from '@webhook-lab/conformance';
import {
  CHECK_STATUS_META,
  CHECK_STATUS_ORDER,
  SUITE_CHECKS,
  SUITE_DELIVERY_COUNT,
} from '@/lib/suite-checks';

describe('SUITE_CHECKS', () => {
  it('matches the conformance checks: same ids, titles, explanations and order', () => {
    expect(SUITE_CHECKS).toEqual(CHECKS.map(({ id, title, why }) => ({ id, title, why })));
  });

  it('uses plain punctuation in the copy', () => {
    for (const check of SUITE_CHECKS) {
      expect(check.title + check.why).not.toMatch(/[—·]/);
    }
  });
});

describe('SUITE_DELIVERY_COUNT', () => {
  it('is the number of requests a full run sends', async () => {
    let sent = 0;
    await runSuite({
      url: 'https://example.com/hook',
      secret: 'whsec_test_secret',
      spacingMs: 0,
      transport: async () => {
        sent += 1;
        return { status: 200, body: '', durationMs: 1 };
      },
    });
    expect(sent).toBe(SUITE_DELIVERY_COUNT);
  });
});

describe('CHECK_STATUS_META', () => {
  const statuses: CheckStatus[] = ['pass', 'fail', 'warn', 'error'];

  it('describes every status, in summary order', () => {
    expect([...CHECK_STATUS_ORDER].sort()).toEqual([...statuses].sort());
    for (const status of statuses) {
      expect(CHECK_STATUS_META[status].label).not.toBe('');
      expect(CHECK_STATUS_META[status].meaning).toMatch(/\.$/);
    }
  });

  it('keeps state colours to their meanings', () => {
    expect(CHECK_STATUS_META.pass.text).toBe('text-state-success');
    expect(CHECK_STATUS_META.fail.text).toBe('text-state-error');
    expect(CHECK_STATUS_META.warn.text).toBe('text-state-warning');
    expect(CHECK_STATUS_META.error.text).toBe('text-state-error');
  });
});
