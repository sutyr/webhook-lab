// Copyright 2026 Sutyr Inc. SPDX-License-Identifier: Apache-2.0

import type { FieldDef } from './event-fields-map';

/**
 * Traverse a nested object by dot-notation path.
 * Supports numeric keys for array access (e.g., 'data.0.amount').
 */
function getNestedValue(obj: unknown, path: string): unknown {
  return path.split('.').reduce(
    (acc, key) =>
      acc && typeof acc === 'object' ? (acc as Record<string, unknown>)[key] : undefined,
    obj,
  );
}

/**
 * Extract eventOptions values from a parsed JSON payload using
 * the jsonPath defined on each FieldDef.
 *
 * Only returns keys where a value was found in the JSON.
 * Fields without jsonPath are skipped.
 */
export function extractOptionsFromJson(
  json: object,
  fields: FieldDef[],
): Record<string, unknown> {
  const options: Record<string, unknown> = {};
  for (const field of fields) {
    if (!field.jsonPath) continue;
    const value = getNestedValue(json, field.jsonPath);
    if (value !== undefined) {
      options[field.key] = value;
    }
  }
  return options;
}
