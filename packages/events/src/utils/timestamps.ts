// Copyright 2026 Sutyr Inc. SPDX-License-Identifier: Apache-2.0
export function now(): number {
  return Math.floor(Date.now() / 1000);
}

export function minutesAgo(n: number): number {
  return now() - n * 60;
}

export function hoursAgo(n: number): number {
  return now() - n * 3600;
}

export function daysAgo(n: number): number {
  return now() - n * 86400;
}

export function futureMinutes(n: number): number {
  return now() + n * 60;
}

export function futureHours(n: number): number {
  return now() + n * 3600;
}

export function futureDays(n: number): number {
  return now() + n * 86400;
}

export function sequentialTimestamps(
  count: number,
  options?: { start?: number; gapSeconds?: number },
): number[] {
  const gap = options?.gapSeconds ?? 60;
  const start = options?.start ?? now() - count * gap;
  const result: number[] = [];
  for (let i = 0; i < count; i++) {
    result.push(start + i * gap);
  }
  return result;
}
