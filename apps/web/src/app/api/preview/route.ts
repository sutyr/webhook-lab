// Copyright 2026 Sutyr Inc. SPDX-License-Identifier: Apache-2.0

import { EVENT_TYPE_TO_GENERATOR } from '@/lib/event-generator-map';
import { parseJsonBody } from '@/lib/parse-body';
import type { StripeEventType } from '@webhook-lab/events';

interface PreviewBody {
  eventType: string;
  eventOptions?: Record<string, unknown>;
}

export async function POST(request: Request) {
  const parsed = await parseJsonBody<PreviewBody>(request);
  if (!parsed.ok) {
    return Response.json({ error: parsed.error }, { status: parsed.status });
  }

  const { eventType, eventOptions } = parsed.data;

  const generator = EVENT_TYPE_TO_GENERATOR[eventType as StripeEventType];

  if (!generator) {
    return Response.json(
      { error: { code: 'UNKNOWN_EVENT_TYPE', message: 'Unknown event type' } },
      { status: 400 },
    );
  }

  // Generators throw a descriptive Error for option values Stripe would never
  // send (an unknown decline code, for example). Surface it as a 400.
  let event: Record<string, unknown>;
  try {
    event = generator(eventOptions) as Record<string, unknown>;
  } catch (err) {
    return Response.json(
      {
        error: {
          code: 'INVALID_EVENT_OPTIONS',
          message: err instanceof Error ? err.message : 'Invalid event options',
        },
      },
      { status: 400 },
    );
  }

  // Apply envelope overrides (livemode, apiVersion)
  if (eventOptions?.livemode === true) {
    event.livemode = true;
    // Stripe sets livemode on both the event and the inner data.object
    const data = event.data as Record<string, unknown> | undefined;
    const inner = data?.object as Record<string, unknown> | undefined;
    if (inner) inner.livemode = true;
  }
  if (typeof eventOptions?.apiVersion === 'string' && eventOptions.apiVersion) {
    event.api_version = eventOptions.apiVersion;
  }

  return Response.json(event);
}
