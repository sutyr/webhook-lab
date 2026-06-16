// Copyright 2026 Sutyr Inc. SPDX-License-Identifier: Apache-2.0
import 'server-only';

import {
  subscriptionHappyPath,
  subscriptionFailure,
  checkoutFlow,
  disputeLifecycle,
  refundFlow,
} from '@webhook-lab/events';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const SCENARIO_ID_TO_GENERATOR: Record<string, (options?: any) => any> = {
  'subscription-happy-path': subscriptionHappyPath,
  'subscription-failure': subscriptionFailure,
  'checkout-flow': checkoutFlow,
  'dispute-lifecycle': disputeLifecycle,
  'refund-flow': refundFlow,
};
