// Copyright 2026 Sutyr Inc. SPDX-License-Identifier: Apache-2.0

const PREFIX = 'webhook-lab-';

export function loadString(key: string, fallback: string): string {
  if (typeof window === 'undefined') return fallback;
  try {
    return localStorage.getItem(`${PREFIX}${key}`) ?? fallback;
  } catch {
    return fallback;
  }
}

export function persistString(key: string, value: string): void {
  try {
    localStorage.setItem(`${PREFIX}${key}`, value);
  } catch {}
}

export function clearAll(): void {
  try {
    const keys = Object.keys(localStorage).filter(
      (k) => k.startsWith(PREFIX) && k !== `${PREFIX}theme`,
    );
    for (const k of keys) localStorage.removeItem(k);
  } catch {}
}
