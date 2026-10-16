// Copyright 2026 Sutyr Inc. SPDX-License-Identifier: Apache-2.0
import 'server-only';

import type { StripeEventType } from '@webhook-lab/events';
import { EVENT_GENERATORS } from '@webhook-lab/events';

/**
 * The editor sends '' for a text or number input the user cleared, and for a
 * select's empty "default" choice. In each case the form shows the generator's
 * default, so drop those keys and let the generator apply it. Anything that is
 * not a plain options object becomes no options, as before.
 */
function withoutEmptyValues(options: unknown): Record<string, unknown> | undefined {
  if (options === null || typeof options !== 'object' || Array.isArray(options)) return undefined;
  return Object.fromEntries(Object.entries(options).filter(([, value]) => value !== ''));
}

/**
 * Every generator in the events registry, keyed by event type. The routes look
 * up the event type from the request body, so the map has no prototype: names
 * like `constructor` or `toString` find nothing and get UNKNOWN_EVENT_TYPE.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const EVENT_TYPE_TO_GENERATOR: Record<StripeEventType, (options?: any) => any> =
  Object.assign(
    Object.create(null) as Record<StripeEventType, (options?: unknown) => unknown>,
    Object.fromEntries(
      Object.entries(EVENT_GENERATORS).map(([type, generate]) => [
        type,
        (options?: unknown) => generate(withoutEmptyValues(options)),
      ]),
    ),
  );
