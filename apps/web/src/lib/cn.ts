// Copyright 2026 Sutyr Inc. SPDX-License-Identifier: Apache-2.0
import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
