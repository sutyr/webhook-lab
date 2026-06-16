// Copyright 2026 Sutyr Inc. SPDX-License-Identifier: Apache-2.0

import { SCENARIO_ID_TO_GENERATOR } from '@/lib/scenario-generator-map';
import { parseJsonBody } from '@/lib/parse-body';
import type { ScenarioPreset } from '@webhook-lab/events';

interface FireScenarioBody {
  scenarioId: string;
  scenarioOptions?: Record<string, unknown>;
}

export async function POST(request: Request) {
  const parsed = await parseJsonBody<FireScenarioBody>(request);
  if (!parsed.ok) {
    return Response.json({ error: parsed.error }, { status: parsed.status });
  }

  const { scenarioId, scenarioOptions } = parsed.data;

  const generator = SCENARIO_ID_TO_GENERATOR[scenarioId];

  if (!generator) {
    return Response.json(
      { error: { code: 'UNKNOWN_SCENARIO', message: 'Unknown scenario ID' } },
      { status: 400 },
    );
  }

  const preset: ScenarioPreset = generator(scenarioOptions);

  return Response.json({
    steps: preset.steps.map((s) => ({
      event: s.event,
      delayMs: s.delayMs,
      description: s.description,
    })),
  });
}
