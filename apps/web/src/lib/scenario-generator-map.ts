// Copyright 2026 Sutyr Inc. SPDX-License-Identifier: Apache-2.0
import 'server-only';

import type { ScenarioPreset } from '@webhook-lab/events';
import { SCENARIO_GENERATORS } from '@webhook-lab/events';

/**
 * A scenario takes only a seed. Pass it through when it is a string and drop
 * everything else, so a malformed body gets the default IDs instead of an
 * error from the seeded ID generator.
 */
function seedOnly(options: unknown): { seed: string } | undefined {
  if (options === null || typeof options !== 'object') return undefined;
  const seed = (options as { seed?: unknown }).seed;
  return typeof seed === 'string' ? { seed } : undefined;
}

/**
 * Every scenario in the events registry, keyed by scenario ID. The route looks
 * up the ID from the request body, so the map has no prototype: names like
 * `constructor` or `toString` find nothing and get UNKNOWN_SCENARIO.
 */
export const SCENARIO_ID_TO_GENERATOR: Record<string, (options?: unknown) => ScenarioPreset> =
  Object.assign(
    Object.create(null) as Record<string, (options?: unknown) => ScenarioPreset>,
    Object.fromEntries(
      Object.entries(SCENARIO_GENERATORS).map(([id, generate]) => [
        id,
        (options?: unknown) => generate(seedOnly(options)),
      ]),
    ),
  );
