// Copyright 2026 Sutyr Inc. SPDX-License-Identifier: Apache-2.0

import { STRIPE_API_VERSION } from '@webhook-lab/events';

export async function GET() {
  return Response.json({
    status: 'ok',
    version: '0.1.0',
    stripeApiVersion: STRIPE_API_VERSION,
    timestamp: Math.floor(Date.now() / 1000),
  });
}
