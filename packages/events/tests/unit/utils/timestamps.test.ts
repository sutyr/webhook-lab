// Copyright 2026 Sutyr Inc. SPDX-License-Identifier: Apache-2.0
import { describe, it, expect } from 'vitest';
import {
  now,
  minutesAgo,
  hoursAgo,
  daysAgo,
  futureMinutes,
  futureHours,
  futureDays,
  sequentialTimestamps,
} from '../../../src/utils/timestamps.js';

describe('now', () => {
  it('returns a Unix timestamp in seconds (not milliseconds)', () => {
    const ts = now();
    const expected = Math.floor(Date.now() / 1000);
    expect(Math.abs(ts - expected)).toBeLessThanOrEqual(2);
  });

  it('returns an integer', () => {
    expect(Number.isInteger(now())).toBe(true);
  });
});

describe('relative timestamps', () => {
  it('minutesAgo returns a timestamp approximately n minutes before now', () => {
    const ts = minutesAgo(5);
    const expected = Math.floor(Date.now() / 1000) - 300;
    expect(Math.abs(ts - expected)).toBeLessThanOrEqual(2);
  });

  it('hoursAgo returns a timestamp approximately n hours before now', () => {
    const ts = hoursAgo(2);
    const expected = Math.floor(Date.now() / 1000) - 7200;
    expect(Math.abs(ts - expected)).toBeLessThanOrEqual(2);
  });

  it('daysAgo returns a timestamp approximately n days before now', () => {
    const ts = daysAgo(1);
    const expected = Math.floor(Date.now() / 1000) - 86400;
    expect(Math.abs(ts - expected)).toBeLessThanOrEqual(2);
  });

  it('futureMinutes returns a timestamp approximately n minutes from now', () => {
    const ts = futureMinutes(10);
    const expected = Math.floor(Date.now() / 1000) + 600;
    expect(Math.abs(ts - expected)).toBeLessThanOrEqual(2);
  });

  it('futureHours returns a timestamp approximately n hours from now', () => {
    const ts = futureHours(3);
    const expected = Math.floor(Date.now() / 1000) + 10800;
    expect(Math.abs(ts - expected)).toBeLessThanOrEqual(2);
  });

  it('futureDays returns a timestamp approximately n days from now', () => {
    const ts = futureDays(7);
    const expected = Math.floor(Date.now() / 1000) + 604800;
    expect(Math.abs(ts - expected)).toBeLessThanOrEqual(2);
  });

  it('all functions return integers', () => {
    expect(Number.isInteger(minutesAgo(1))).toBe(true);
    expect(Number.isInteger(hoursAgo(1))).toBe(true);
    expect(Number.isInteger(daysAgo(1))).toBe(true);
    expect(Number.isInteger(futureMinutes(1))).toBe(true);
    expect(Number.isInteger(futureHours(1))).toBe(true);
    expect(Number.isInteger(futureDays(1))).toBe(true);
  });
});

describe('sequentialTimestamps', () => {
  it('returns the requested number of timestamps', () => {
    const result = sequentialTimestamps(5);
    expect(result).toHaveLength(5);
  });

  it('returns timestamps in ascending order', () => {
    const result = sequentialTimestamps(5);
    for (let i = 1; i < result.length; i++) {
      expect(result[i]!).toBeGreaterThan(result[i - 1]!);
    }
  });

  it('uses the default gap of 60 seconds', () => {
    const result = sequentialTimestamps(3);
    expect(result[1]! - result[0]!).toBe(60);
    expect(result[2]! - result[1]!).toBe(60);
  });

  it('respects custom gap', () => {
    const result = sequentialTimestamps(3, { gapSeconds: 120 });
    expect(result[1]! - result[0]!).toBe(120);
    expect(result[2]! - result[1]!).toBe(120);
  });

  it('respects custom start timestamp', () => {
    const start = 1700000000;
    const result = sequentialTimestamps(3, { start });
    expect(result[0]).toBe(start);
  });

  it('returns all integers', () => {
    const result = sequentialTimestamps(5);
    for (const ts of result) {
      expect(Number.isInteger(ts)).toBe(true);
    }
  });
});
