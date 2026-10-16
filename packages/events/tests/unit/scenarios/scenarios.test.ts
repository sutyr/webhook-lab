// Copyright 2026 Sutyr Inc. SPDX-License-Identifier: Apache-2.0
import { describe, it, expect } from 'vitest';
import { subscriptionHappyPath } from '../../../src/scenarios/subscription-happy-path.js';
import { subscriptionFailure } from '../../../src/scenarios/subscription-failure.js';
import { checkoutFlow } from '../../../src/scenarios/checkout-flow.js';
import { disputeLifecycle } from '../../../src/scenarios/dispute-lifecycle.js';
import { refundFlow } from '../../../src/scenarios/refund-flow.js';
import { trialConversion } from '../../../src/scenarios/trial-conversion.js';
import { threeDSecure } from '../../../src/scenarios/3d-secure.js';
import { earlyFraudWarning } from '../../../src/scenarios/early-fraud-warning.js';
import { SCENARIO_CATALOG } from '../../../src/catalog.js';
import { SCENARIO_GENERATORS } from '../../../src/registry.js';
import { STRIPE_API_VERSION } from '../../../src/generators/envelope.js';
import type { ScenarioPreset } from '../../../src/types/index.js';

// ─── Helpers ────────────────────────────────────────────────────────────────

function extractCustomerIds(preset: ScenarioPreset): string[] {
  return preset.steps.map((step) => {
    const obj = step.event.data.object as unknown as Record<string, unknown>;
    // For customer events, the object itself is the customer
    if (obj.object === 'customer') return obj.id as string;
    // For other events, customer is a field on the object
    return (obj.customer as string) ?? '';
  });
}

function extractFieldFromSteps(
  preset: ScenarioPreset,
  field: string,
): (string | null)[] {
  return preset.steps.map((step) => {
    const obj = step.event.data.object as unknown as Record<string, unknown>;
    return (obj[field] as string | null) ?? null;
  });
}

function invoiceSubscription(preset: ScenarioPreset, step: number): string | undefined {
  const invoice = preset.steps[step]!.event.data.object as unknown as {
    parent?: { subscription_details?: { subscription?: string } | null } | null;
  };
  return invoice.parent?.subscription_details?.subscription;
}

// ─── Subscription Happy Path ────────────────────────────────────────────────

describe('subscriptionHappyPath', () => {
  it('returns a ScenarioPreset with 7 steps', () => {
    const preset = subscriptionHappyPath();
    expect(preset.steps).toHaveLength(7);
    expect(preset.id).toBe('subscription-happy-path');
    expect(preset.name).toBeTruthy();
    expect(preset.description).toBeTruthy();
  });

  it('has steps in expected event type order', () => {
    const preset = subscriptionHappyPath();
    const types = preset.steps.map((s) => s.event.type);
    expect(types).toEqual([
      'customer.created',
      'customer.subscription.created',
      'invoice.created',
      'charge.succeeded',
      'payment_intent.succeeded',
      'invoice.paid',
      'invoice.payment_succeeded',
    ]);
  });

  it('shares customer IDs across subscription, charge, and invoice steps', () => {
    const preset = subscriptionHappyPath({ seed: 'test-happy' });
    const customerIds = extractCustomerIds(preset);
    // Steps 1-6 should share the same customer ID
    const sharedCusId = customerIds[1];
    expect(sharedCusId).toMatch(/^cus_/);
    for (let i = 2; i < customerIds.length; i++) {
      expect(customerIds[i]).toBe(sharedCusId);
    }
  });

  it('shares subscription IDs across ALL subscription-related steps', () => {
    const preset = subscriptionHappyPath({ seed: 'test-happy' });

    // The customer.subscription.created event has the subscription as its
    // top-level object (id field). Invoice events reference it via
    // `parent.subscription_details.subscription` (2025-03-31.basil+).
    const subCreated = preset.steps[1].event.data.object as unknown as Record<string, unknown>;
    const subCreatedId = subCreated.id as string;
    expect(subCreatedId).toMatch(/^sub_/);

    // invoice.created (2), invoice.paid (5), invoice.payment_succeeded (6)
    // must reference the SAME subscription as the customer.subscription.created event
    expect(invoiceSubscription(preset, 2)).toBe(subCreatedId);
    expect(invoiceSubscription(preset, 5)).toBe(subCreatedId);
    expect(invoiceSubscription(preset, 6)).toBe(subCreatedId);
  });

  it('uses ONE invoice ID across the invoice lifecycle (created → paid → payment_succeeded)', () => {
    // A real Stripe invoice progresses through these three events; they must
    // all carry the same in_ ID, not three unrelated invoices.
    const preset = subscriptionHappyPath({ seed: 'test-happy' });
    const obj = (i: number) =>
      preset.steps[i].event.data.object as unknown as Record<string, unknown>;
    const inIdValue = obj(2).id as string;
    expect(inIdValue).toMatch(/^in_/);
    expect(obj(5).id).toBe(inIdValue);
    expect(obj(6).id).toBe(inIdValue);
  });

  it('correlates charge.payment_intent with the payment_intent.succeeded event; invoices carry no payment_intent', () => {
    // Since 2025-03-31.basil the Invoice has no `payment_intent` field (payments
    // are includable-only via `payments`), so only the charge carries the PI ID.
    const preset = subscriptionHappyPath({ seed: 'test-happy' });
    const obj = (i: number) =>
      preset.steps[i].event.data.object as unknown as Record<string, unknown>;
    const piIdValue = obj(4).id as string;
    expect(piIdValue).toMatch(/^pi_/);
    expect(obj(3).payment_intent).toBe(piIdValue);
    for (const i of [2, 5, 6]) {
      expect(obj(i)).not.toHaveProperty('payment_intent');
    }
  });

  it('charge.succeeded and payment_intent.succeeded share same charge and PI IDs', () => {
    const preset = subscriptionHappyPath({ seed: 'test-happy' });
    const charge = preset.steps[3].event.data.object as unknown as Record<string, unknown>;
    const pi = preset.steps[4].event.data.object as unknown as Record<string, unknown>;
    // charge.payment_intent === pi.id
    expect(charge.payment_intent).toBe(pi.id);
    // pi.latest_charge === charge.id
    expect(pi.latest_charge).toBe(charge.id);
  });

  it('first invoice has billing_reason subscription_create', () => {
    const preset = subscriptionHappyPath();
    const invoiceStep = preset.steps[2];
    const invoice = invoiceStep.event.data.object as unknown as Record<string, unknown>;
    expect(invoice.billing_reason).toBe('subscription_create');
  });

  it('each step has a description and delayMs >= 0', () => {
    const preset = subscriptionHappyPath();
    for (const step of preset.steps) {
      expect(typeof step.description).toBe('string');
      expect(step.description.length).toBeGreaterThan(0);
      expect(step.delayMs).toBeGreaterThanOrEqual(0);
    }
  });

  it('is deterministic: same seed produces identical shared IDs', () => {
    const a = subscriptionHappyPath({ seed: 'determinism' });
    const b = subscriptionHappyPath({ seed: 'determinism' });
    // Seeded IDs (customer, subscription) are deterministic
    const aCus = extractCustomerIds(a);
    const bCus = extractCustomerIds(b);
    expect(aCus[1]).toBe(bCus[1]);
    expect(aCus[2]).toBe(bCus[2]);
    const aSubIds = extractFieldFromSteps(a, 'subscription');
    const bSubIds = extractFieldFromSteps(b, 'subscription');
    expect(aSubIds[2]).toBe(bSubIds[2]);
  });

  it('different seeds produce different IDs', () => {
    const a = subscriptionHappyPath({ seed: 'seed-a' });
    const b = subscriptionHappyPath({ seed: 'seed-b' });
    const aCusIds = extractCustomerIds(a);
    const bCusIds = extractCustomerIds(b);
    // The shared customer IDs (index 1) should differ between seeds
    expect(aCusIds[1]).not.toBe(bCusIds[1]);
  });
});

// ─── Subscription Failure ───────────────────────────────────────────────────

describe('subscriptionFailure', () => {
  it('returns a ScenarioPreset with 7 steps', () => {
    const preset = subscriptionFailure();
    expect(preset.steps).toHaveLength(7);
    expect(preset.id).toBe('subscription-failure');
    expect(preset.name).toBeTruthy();
    expect(preset.description).toBeTruthy();
  });

  it('has steps in expected event type order', () => {
    const preset = subscriptionFailure();
    const types = preset.steps.map((s) => s.event.type);
    expect(types).toEqual([
      'invoice.created',
      'invoice.payment_failed',
      'payment_intent.payment_failed',
      'customer.subscription.updated',
      'invoice.payment_failed',
      'payment_intent.payment_failed',
      'customer.subscription.deleted',
    ]);
  });

  it('shares customer IDs across all steps', () => {
    const preset = subscriptionFailure({ seed: 'test-failure' });
    const customerIds = extractCustomerIds(preset);
    const sharedCusId = customerIds[0];
    expect(sharedCusId).toMatch(/^cus_/);
    for (const id of customerIds) {
      expect(id).toBe(sharedCusId);
    }
  });

  it('shares subscription IDs across ALL subscription-related steps', () => {
    const preset = subscriptionFailure({ seed: 'test-failure' });
    const sharedSubId = invoiceSubscription(preset, 0);
    expect(sharedSubId).toMatch(/^sub_/);
    expect(invoiceSubscription(preset, 1)).toBe(sharedSubId);
    expect(invoiceSubscription(preset, 4)).toBe(sharedSubId);

    // Step 3 (customer.subscription.updated) and step 6 (customer.subscription.deleted)
    // carry the subscription as the top-level data.object — verify their `id` matches.
    const subUpdated = preset.steps[3].event.data.object as unknown as Record<string, unknown>;
    const subDeleted = preset.steps[6].event.data.object as unknown as Record<string, unknown>;
    expect(subUpdated.id).toBe(sharedSubId);
    expect(subDeleted.id).toBe(sharedSubId);
  });

  it('second invoice.payment_failed has attemptCount 2', () => {
    const preset = subscriptionFailure();
    const secondFailed = preset.steps[4];
    const invoice = secondFailed.event.data.object as unknown as Record<string, unknown>;
    expect(invoice.attempt_count).toBe(2);
  });

  it('subscription updated step has status past_due', () => {
    const preset = subscriptionFailure();
    const updatedStep = preset.steps[3];
    const sub = updatedStep.event.data.object as unknown as Record<string, unknown>;
    expect(sub.status).toBe('past_due');
  });

  it('payment_intent.payment_failed events share same PI ID', () => {
    const preset = subscriptionFailure({ seed: 'pi-correlation' });
    const pi1 = preset.steps[2].event.data.object as unknown as Record<string, unknown>;
    const pi2 = preset.steps[5].event.data.object as unknown as Record<string, unknown>;
    expect(pi1.id).toMatch(/^pi_/);
    expect(pi1.id).toBe(pi2.id);
  });

  it('each step has a description and delayMs >= 0', () => {
    const preset = subscriptionFailure();
    for (const step of preset.steps) {
      expect(typeof step.description).toBe('string');
      expect(step.description.length).toBeGreaterThan(0);
      expect(step.delayMs).toBeGreaterThanOrEqual(0);
    }
  });

  it('is deterministic: same seed produces identical shared IDs', () => {
    const a = subscriptionFailure({ seed: 'determinism' });
    const b = subscriptionFailure({ seed: 'determinism' });
    const aCus = extractCustomerIds(a);
    const bCus = extractCustomerIds(b);
    expect(aCus[0]).toBe(bCus[0]);
    const aSubIds = extractFieldFromSteps(a, 'subscription');
    const bSubIds = extractFieldFromSteps(b, 'subscription');
    expect(aSubIds[0]).toBe(bSubIds[0]);
  });

  it('different seeds produce different IDs', () => {
    const a = subscriptionFailure({ seed: 'seed-a' });
    const b = subscriptionFailure({ seed: 'seed-b' });
    const aCusIds = extractCustomerIds(a);
    const bCusIds = extractCustomerIds(b);
    expect(aCusIds[0]).not.toBe(bCusIds[0]);
  });
});

// ─── Checkout Flow ──────────────────────────────────────────────────────────

describe('checkoutFlow', () => {
  it('returns a ScenarioPreset with 3 steps', () => {
    const preset = checkoutFlow();
    expect(preset.steps).toHaveLength(3);
    expect(preset.id).toBe('checkout-flow');
    expect(preset.name).toBeTruthy();
    expect(preset.description).toBeTruthy();
  });

  it('has steps in expected event type order', () => {
    const preset = checkoutFlow();
    const types = preset.steps.map((s) => s.event.type);
    expect(types).toEqual([
      'checkout.session.completed',
      'payment_intent.succeeded',
      'charge.succeeded',
    ]);
  });

  it('shares customer IDs across all steps', () => {
    const preset = checkoutFlow({ seed: 'test-checkout' });
    const customerIds = extractCustomerIds(preset);
    const sharedCusId = customerIds[0];
    expect(sharedCusId).toMatch(/^cus_/);
    for (const id of customerIds) {
      expect(id).toBe(sharedCusId);
    }
  });

  it('each step has a description and delayMs >= 0', () => {
    const preset = checkoutFlow();
    for (const step of preset.steps) {
      expect(typeof step.description).toBe('string');
      expect(step.description.length).toBeGreaterThan(0);
      expect(step.delayMs).toBeGreaterThanOrEqual(0);
    }
  });

  it('is deterministic: same seed produces identical shared IDs', () => {
    const a = checkoutFlow({ seed: 'determinism' });
    const b = checkoutFlow({ seed: 'determinism' });
    const aCus = extractCustomerIds(a);
    const bCus = extractCustomerIds(b);
    expect(aCus[0]).toBe(bCus[0]);
    expect(aCus[1]).toBe(bCus[1]);
  });

  it('different seeds produce different IDs', () => {
    const a = checkoutFlow({ seed: 'seed-a' });
    const b = checkoutFlow({ seed: 'seed-b' });
    const aCusIds = extractCustomerIds(a);
    const bCusIds = extractCustomerIds(b);
    expect(aCusIds[0]).not.toBe(bCusIds[0]);
  });

  it('session.payment_intent matches paymentIntent.id across steps', () => {
    const preset = checkoutFlow({ seed: 'id-correlation' });
    const session = preset.steps[0].event.data.object as unknown as Record<string, unknown>;
    const pi = preset.steps[1].event.data.object as unknown as Record<string, unknown>;
    expect(session.payment_intent).toBe(pi.id);
  });

  it('paymentIntent.latest_charge matches charge.id across steps', () => {
    const preset = checkoutFlow({ seed: 'id-correlation' });
    const pi = preset.steps[1].event.data.object as unknown as Record<string, unknown>;
    const charge = preset.steps[2].event.data.object as unknown as Record<string, unknown>;
    expect(pi.latest_charge).toBe(charge.id);
  });
});

// ─── Dispute Lifecycle ──────────────────────────────────────────────────────

describe('disputeLifecycle', () => {
  it('returns a ScenarioPreset with 4 steps', () => {
    const preset = disputeLifecycle();
    expect(preset.steps).toHaveLength(4);
    expect(preset.id).toBe('dispute-lifecycle');
    expect(preset.name).toBeTruthy();
    expect(preset.description).toBeTruthy();
  });

  it('has steps in expected event type order', () => {
    const preset = disputeLifecycle();
    const types = preset.steps.map((s) => s.event.type);
    expect(types).toEqual([
      'charge.succeeded',
      'charge.dispute.created',
      'charge.dispute.updated',
      'charge.dispute.closed',
    ]);
  });

  it('shares charge IDs across dispute steps', () => {
    const preset = disputeLifecycle({ seed: 'test-dispute' });
    // Steps 1-3 (dispute events) should share the same charge ID
    const disputeSteps = preset.steps.slice(1);
    const chargeIds = disputeSteps.map((s) => {
      const obj = s.event.data.object as unknown as Record<string, unknown>;
      return obj.charge as string;
    });
    const sharedChId = chargeIds[0];
    expect(sharedChId).toMatch(/^ch_/);
    for (const id of chargeIds) {
      expect(id).toBe(sharedChId);
    }
  });

  it('uses ONE dispute ID across created → updated → closed', () => {
    // A real Stripe dispute keeps the same dp_ ID through its lifecycle.
    const preset = disputeLifecycle({ seed: 'test-dispute' });
    const obj = (i: number) =>
      preset.steps[i].event.data.object as unknown as Record<string, unknown>;
    const duId = obj(1).id as string;
    expect(duId).toMatch(/^dp_/);
    expect(obj(2).id).toBe(duId);
    expect(obj(3).id).toBe(duId);
  });

  it('correlates dispute.payment_intent with the disputed charge', () => {
    const preset = disputeLifecycle({ seed: 'test-dispute' });
    const obj = (i: number) =>
      preset.steps[i].event.data.object as unknown as Record<string, unknown>;
    const piId = obj(0).payment_intent as string;
    expect(piId).toMatch(/^pi_/);
    expect(obj(1).payment_intent).toBe(piId);
    expect(obj(2).payment_intent).toBe(piId);
    expect(obj(3).payment_intent).toBe(piId);
  });

  it('dispute updated has status under_review', () => {
    const preset = disputeLifecycle();
    const updatedStep = preset.steps[2];
    const dispute = updatedStep.event.data.object as unknown as Record<string, unknown>;
    expect(dispute.status).toBe('under_review');
  });

  it('dispute closed has status won', () => {
    const preset = disputeLifecycle();
    const closedStep = preset.steps[3];
    const dispute = closedStep.event.data.object as unknown as Record<string, unknown>;
    expect(dispute.status).toBe('won');
  });

  it('each step has a description and delayMs >= 0', () => {
    const preset = disputeLifecycle();
    for (const step of preset.steps) {
      expect(typeof step.description).toBe('string');
      expect(step.description.length).toBeGreaterThan(0);
      expect(step.delayMs).toBeGreaterThanOrEqual(0);
    }
  });

  it('is deterministic: same seed produces identical shared IDs', () => {
    const a = disputeLifecycle({ seed: 'determinism' });
    const b = disputeLifecycle({ seed: 'determinism' });
    const aChargeIds = a.steps.slice(1).map((s) => {
      const obj = s.event.data.object as unknown as Record<string, unknown>;
      return obj.charge as string;
    });
    const bChargeIds = b.steps.slice(1).map((s) => {
      const obj = s.event.data.object as unknown as Record<string, unknown>;
      return obj.charge as string;
    });
    expect(aChargeIds[0]).toBe(bChargeIds[0]);
    expect(a.steps[0].event.created).toBe(b.steps[0].event.created);
  });

  it('different seeds produce different IDs', () => {
    const a = disputeLifecycle({ seed: 'seed-a' });
    const b = disputeLifecycle({ seed: 'seed-b' });
    const aChargeIds = a.steps.slice(1).map((s) => {
      const obj = s.event.data.object as unknown as Record<string, unknown>;
      return obj.charge as string;
    });
    const bChargeIds = b.steps.slice(1).map((s) => {
      const obj = s.event.data.object as unknown as Record<string, unknown>;
      return obj.charge as string;
    });
    expect(aChargeIds[0]).not.toBe(bChargeIds[0]);
  });

  it('charge.id in step 1 matches dispute.charge in step 2', () => {
    const preset = disputeLifecycle({ seed: 'id-correlation' });
    const charge = preset.steps[0].event.data.object as unknown as Record<string, unknown>;
    const dispute = preset.steps[1].event.data.object as unknown as Record<string, unknown>;
    expect(charge.id).toBe(dispute.charge);
  });
});

// ─── Refund Flow ────────────────────────────────────────────────────────────

describe('refundFlow', () => {
  it('returns a ScenarioPreset with 2 steps', () => {
    const preset = refundFlow();
    expect(preset.steps).toHaveLength(2);
    expect(preset.id).toBe('refund-flow');
    expect(preset.name).toBeTruthy();
    expect(preset.description).toBeTruthy();
  });

  it('has steps in expected event type order', () => {
    const preset = refundFlow();
    const types = preset.steps.map((s) => s.event.type);
    expect(types).toEqual([
      'charge.succeeded',
      'charge.refunded',
    ]);
  });

  it('shares customer IDs across steps', () => {
    const preset = refundFlow({ seed: 'test-refund' });
    const customerIds = extractCustomerIds(preset);
    const sharedCusId = customerIds[0];
    expect(sharedCusId).toMatch(/^cus_/);
    expect(customerIds[1]).toBe(sharedCusId);
  });

  it('shares payment intent IDs across steps', () => {
    const preset = refundFlow({ seed: 'test-refund' });
    const piIds = extractFieldFromSteps(preset, 'payment_intent');
    const sharedPiId = piIds[0];
    expect(sharedPiId).toMatch(/^pi_/);
    expect(piIds[1]).toBe(sharedPiId);
  });

  it('refunded charge references a charge ID with ch_ prefix', () => {
    const preset = refundFlow();
    const refundedStep = preset.steps[1];
    const charge = refundedStep.event.data.object as unknown as Record<string, unknown>;
    expect((charge.id as string)).toMatch(/^ch_/);
  });

  it('each step has a description and delayMs >= 0', () => {
    const preset = refundFlow();
    for (const step of preset.steps) {
      expect(typeof step.description).toBe('string');
      expect(step.description.length).toBeGreaterThan(0);
      expect(step.delayMs).toBeGreaterThanOrEqual(0);
    }
  });

  it('is deterministic: same seed produces identical shared IDs', () => {
    const a = refundFlow({ seed: 'determinism' });
    const b = refundFlow({ seed: 'determinism' });
    const aCusIds = extractCustomerIds(a);
    const bCusIds = extractCustomerIds(b);
    expect(aCusIds[0]).toBe(bCusIds[0]);
    expect(aCusIds[1]).toBe(bCusIds[1]);
    const aPiIds = extractFieldFromSteps(a, 'payment_intent');
    const bPiIds = extractFieldFromSteps(b, 'payment_intent');
    expect(aPiIds[0]).toBe(bPiIds[0]);
    expect(a.steps[0].event.created).toBe(b.steps[0].event.created);
  });

  it('different seeds produce different IDs', () => {
    const a = refundFlow({ seed: 'seed-a' });
    const b = refundFlow({ seed: 'seed-b' });
    const aCusIds = extractCustomerIds(a);
    const bCusIds = extractCustomerIds(b);
    expect(aCusIds[0]).not.toBe(bCusIds[0]);
  });

  it('charge.id in step 1 matches refunded charge.id in step 2', () => {
    const preset = refundFlow({ seed: 'id-correlation' });
    const succeeded = preset.steps[0].event.data.object as unknown as Record<string, unknown>;
    const refunded = preset.steps[1].event.data.object as unknown as Record<string, unknown>;
    expect(succeeded.id).toBe(refunded.id);
  });
});

// ─── Batch 5: Scenario Field-Level Deep Tests ─────────────────────────────

describe('subscriptionHappyPath field-level correctness', () => {
  const preset = subscriptionHappyPath({ seed: 'field-test' });
  const obj = (i: number) => preset.steps[i].event.data.object as unknown as Record<string, unknown>;

  it('invoice.created has status draft', () => {
    expect(obj(2).status).toBe('draft');
  });

  it('invoice.paid has status paid and status_transitions.paid_at set', () => {
    expect(obj(5).status).toBe('paid');
    const transitions = obj(5).status_transitions as Record<string, unknown>;
    expect(typeof transitions.paid_at).toBe('number');
    expect(obj(5)).not.toHaveProperty('paid');
  });

  it('charge.succeeded has captured: true', () => {
    expect(obj(3).captured).toBe(true);
  });

  it('payment_intent.succeeded has status succeeded', () => {
    expect(obj(4).status).toBe('succeeded');
  });

  it('customer.subscription.created has status active', () => {
    expect(obj(1).status).toBe('active');
  });

  it('all non-customer steps share same currency', () => {
    const currencies = [obj(1), obj(2), obj(3), obj(4), obj(5), obj(6)]
      .map((o) => o.currency)
      .filter(Boolean);
    expect(new Set(currencies).size).toBe(1);
  });

  it('charge amount matches invoice amount_due', () => {
    expect(obj(3).amount).toBe(obj(2).amount_due);
  });
});

describe('subscriptionFailure field-level correctness', () => {
  const preset = subscriptionFailure({ seed: 'field-test' });
  const obj = (i: number) => preset.steps[i].event.data.object as unknown as Record<string, unknown>;

  it('customer.subscription.deleted carries cancellation_details.reason payment_failed', () => {
    const preset = subscriptionFailure();
    const sub = preset.steps[6]!.event.data.object as unknown as {
      cancellation_details: { reason: string | null } | null;
    };
    expect(sub.cancellation_details!.reason).toBe('payment_failed');
  });

  it('payment_intent.payment_failed has status requires_payment_method', () => {
    expect(obj(2).status).toBe('requires_payment_method');
  });

  it('payment_intent.payment_failed has last_payment_error present', () => {
    expect(obj(2).last_payment_error).not.toBeNull();
    expect(obj(2).last_payment_error).toBeDefined();
  });

  it('attempt_count increments between invoice.payment_failed steps', () => {
    const attempt1 = obj(1).attempt_count as number;
    const attempt2 = obj(4).attempt_count as number;
    expect(attempt2).toBeGreaterThan(attempt1);
  });
});

describe('checkoutFlow field-level correctness', () => {
  const preset = checkoutFlow({ seed: 'field-test' });
  const obj = (i: number) => preset.steps[i].event.data.object as unknown as Record<string, unknown>;

  it('checkout.session.completed has payment_status paid', () => {
    expect(obj(0).payment_status).toBe('paid');
  });

  it('checkout.session.completed has mode payment', () => {
    expect(obj(0).mode).toBe('payment');
  });

  it('charge amount matches session amount_total', () => {
    expect(obj(2).amount).toBe(obj(0).amount_total);
  });
});

describe('disputeLifecycle field-level correctness', () => {
  const preset = disputeLifecycle({ seed: 'field-test' });
  const obj = (i: number) => preset.steps[i].event.data.object as unknown as Record<string, unknown>;

  it('dispute.created amount matches charge.succeeded amount', () => {
    expect(obj(1).amount).toBe(obj(0).amount);
  });
});

describe('refundFlow field-level correctness', () => {
  const preset = refundFlow({ seed: 'field-test' });
  const obj = (i: number) => preset.steps[i].event.data.object as unknown as Record<string, unknown>;

  it('charge.refunded has refunded: true', () => {
    expect(obj(1).refunded).toBe(true);
  });

  it('charge.refunded amount_refunded equals original amount', () => {
    expect(obj(1).amount_refunded).toBe(obj(1).amount);
  });
});

// ─── Every Scenario ─────────────────────────────────────────────────────────

type AnyObject = Record<string, unknown>;

/** `data.object` of step `i`, for reading fields without casting each time. */
function stepObject(preset: ScenarioPreset, i: number): AnyObject {
  return preset.steps[i]!.event.data.object as unknown as AnyObject;
}

/** Every data.object ID in step order: the IDs a seed fixes. */
function objectIds(preset: ScenarioPreset): string[] {
  return preset.steps.map((step) => step.event.data.object.id);
}

describe('every scenario', () => {
  const presets = Object.entries(SCENARIO_GENERATORS).map(([id, generate]) => [id, generate()] as const);

  it('registry and catalog list the same scenarios with the same step counts', () => {
    expect(Object.keys(SCENARIO_GENERATORS)).toEqual(SCENARIO_CATALOG.map((s) => s.id));
    for (const entry of SCENARIO_CATALOG) {
      const preset = SCENARIO_GENERATORS[entry.id]!();
      expect(preset.id, entry.id).toBe(entry.id);
      expect(preset.steps, entry.id).toHaveLength(entry.stepCount);
    }
  });

  it.each(presets)('%s pins every event to the current API version', (_id, preset) => {
    for (const step of preset.steps) {
      expect(step.event.api_version).toBe(STRIPE_API_VERSION);
      expect(step.event.object).toBe('event');
    }
  });

  it.each(presets)('%s never goes back in time from one step to the next', (_id, preset) => {
    const created = preset.steps.map((s) => s.event.created);
    for (let i = 1; i < created.length; i++) {
      expect(created[i]!, `step ${i}`).toBeGreaterThanOrEqual(created[i - 1]!);
    }
  });

  it.each(presets)('%s has no event created before the object it carries', (_id, preset) => {
    for (const step of preset.steps) {
      const created = (step.event.data.object as unknown as { created: number }).created;
      expect(created, step.event.type).toBeLessThanOrEqual(step.event.created);
    }
  });

  it.each(presets)('%s copy has no em dashes or middle dots', (id, preset) => {
    const entry = SCENARIO_CATALOG.find((s) => s.id === id)!;
    const copy = [entry.name, entry.description, preset.description, ...preset.steps.map((s) => s.description)];
    for (const text of copy) {
      expect(text).not.toMatch(/[—·]/);
      expect(text.length).toBeGreaterThan(0);
    }
  });
});

// ─── Trial Conversion ───────────────────────────────────────────────────────

describe('trialConversion', () => {
  const preset = trialConversion({ seed: 'trial-test' });
  const obj = (i: number) => stepObject(preset, i);
  const SUBSCRIPTION_STEPS = [0, 1, 3];
  const INVOICE_STEPS = [2, 4, 5];

  it('returns a ScenarioPreset with 7 steps', () => {
    expect(trialConversion().id).toBe('trial-conversion');
    expect(preset.steps).toHaveLength(7);
    expect(preset.name).toBe('Trial Conversion');
  });

  it('has steps in expected event type order', () => {
    expect(preset.steps.map((s) => s.event.type)).toEqual([
      'customer.subscription.created',
      'customer.subscription.trial_will_end',
      'invoice.created',
      'customer.subscription.updated',
      'invoice.finalized',
      'invoice.paid',
      'invoice_payment.paid',
    ]);
  });

  it('uses one subscription and one customer across every subscription and invoice step', () => {
    const subId = obj(0).id as string;
    const cusId = obj(0).customer as string;
    expect(subId).toMatch(/^sub_/);
    expect(cusId).toMatch(/^cus_/);
    for (const i of SUBSCRIPTION_STEPS) {
      expect(obj(i).id).toBe(subId);
      expect(obj(i).customer).toBe(cusId);
    }
    for (const i of INVOICE_STEPS) {
      expect(invoiceSubscription(preset, i)).toBe(subId);
      expect(obj(i).customer).toBe(cusId);
    }
  });

  it('uses one invoice ID across the invoice steps and the invoice payment', () => {
    const inId = obj(2).id as string;
    expect(inId).toMatch(/^in_/);
    for (const i of INVOICE_STEPS) expect(obj(i).id).toBe(inId);
    expect(obj(6).invoice).toBe(inId);
    expect(obj(6).id).toMatch(/^inpay_/);
  });

  it('moves the subscription from trialing to active', () => {
    expect(obj(0).status).toBe('trialing');
    expect(obj(1).status).toBe('trialing');
    expect(obj(3).status).toBe('active');
    expect(preset.steps[3]!.event.data.previous_attributes).toMatchObject({ status: 'trialing' });
  });

  it('moves the invoice from draft to open to paid', () => {
    expect(INVOICE_STEPS.map((i) => obj(i).status)).toEqual(['draft', 'open', 'paid']);
    expect(obj(6).status).toBe('paid');
  });

  it('keeps one trial window on every subscription step', () => {
    const trialStart = obj(0).trial_start as number;
    const trialEnd = obj(0).trial_end as number;
    expect(trialEnd - trialStart).toBe(30 * 86400);
    for (const i of SUBSCRIPTION_STEPS) {
      expect(obj(i).trial_start).toBe(trialStart);
      expect(obj(i).trial_end).toBe(trialEnd);
      expect(obj(i).created).toBe(trialStart);
      // A trial anchors the billing cycle to its end.
      expect(obj(i).billing_cycle_anchor).toBe(trialEnd);
    }
  });

  it('times each step against the trial end', () => {
    const trialStart = obj(0).trial_start as number;
    const trialEnd = obj(0).trial_end as number;
    const created = preset.steps.map((s) => s.event.created);
    expect(created[0]).toBe(trialStart);
    expect(created[1]).toBe(trialEnd - 3 * 86400);
    expect(created[2]).toBe(trialEnd);
    expect(created[3]).toBe(trialEnd);
    // Stripe finalizes the draft about an hour later, then collects payment.
    expect(created[4]).toBe(trialEnd + 3600);
    expect(created[5]).toBeGreaterThan(created[4]!);
    expect(created[6]).toBe(created[5]);
  });

  it('keeps the same item and price, and starts a new period at the trial end', () => {
    type Item = { id: string; price: { id: string; product: string }; current_period_start: number; current_period_end: number };
    const item = (i: number) => (obj(i).items as { data: Item[] }).data[0]!;
    const trialEnd = obj(0).trial_end as number;
    for (const i of SUBSCRIPTION_STEPS) {
      expect(item(i).id).toBe(item(0).id);
      expect(item(i).price).toEqual(item(0).price);
    }
    expect(item(0).current_period_start).toBe(obj(0).trial_start);
    expect(item(0).current_period_end).toBe(trialEnd);
    expect(item(3).current_period_start).toBe(trialEnd);
    expect(item(3).current_period_end).toBe(trialEnd + 30 * 86400);
  });

  it('reports every changed field in previous_attributes', () => {
    const previous = preset.steps[3]!.event.data.previous_attributes as unknown as AnyObject;
    expect(Object.keys(previous).sort()).toEqual(['items', 'latest_invoice', 'status']);
    expect(previous.latest_invoice).toBe(obj(0).latest_invoice);
    expect(previous.items).toEqual({ data: (obj(0).items as { data: unknown[] }).data });
    // Nothing else differs between the trialing and the active subscription.
    const { status: _s, latest_invoice: _l, items: _i, ...activeRest } = obj(3);
    const { status: _s0, latest_invoice: _l0, items: _i0, ...trialingRest } = obj(0);
    expect(activeRest).toEqual(trialingRest);
  });

  it('points latest_invoice at the trial invoice, then at the first paid invoice', () => {
    const inId = obj(2).id;
    expect(obj(0).latest_invoice).toMatch(/^in_/);
    expect(obj(0).latest_invoice).not.toBe(inId);
    expect(obj(1).latest_invoice).toBe(obj(0).latest_invoice);
    expect(obj(3).latest_invoice).toBe(inId);
  });

  it('has a payment method on file for the whole trial', () => {
    const pmId = obj(0).default_payment_method;
    expect(pmId).toMatch(/^pm_/);
    for (const i of SUBSCRIPTION_STEPS) expect(obj(i).default_payment_method).toBe(pmId);
  });

  it('carries the same subscription object in created and trial_will_end', () => {
    expect(obj(1)).toEqual(obj(0));
  });

  it('only the API request that created the subscription has a request ID', () => {
    expect(preset.steps[0]!.event.request.id).toMatch(/^req_[A-Za-z0-9]{14}$/);
    for (const step of preset.steps.slice(1)) expect(step.event.request.id).toBeNull();
  });

  it('bills the first period after the trial, with the trial as the look-back period', () => {
    const trialEnd = obj(0).trial_end as number;
    for (const i of INVOICE_STEPS) {
      expect(obj(i).billing_reason).toBe('subscription_cycle');
      expect(obj(i).period_start).toBe(obj(0).trial_start);
      expect(obj(i).period_end).toBe(trialEnd);
      const line = (obj(i).lines as { data: Array<{ period: { start: number; end: number } }> }).data[0]!;
      expect(line.period).toEqual({ start: trialEnd, end: trialEnd + 30 * 86400 });
    }
  });

  it('bills the subscription item at its price', () => {
    type Item = { id: string; price: { id: string; product: string; unit_amount: number } };
    const item = (obj(3).items as { data: Item[] }).data[0]!;
    for (const i of INVOICE_STEPS) {
      const line = (obj(i).lines as { data: AnyObject[] }).data[0]! as {
        parent: { subscription_item_details: { subscription: string; subscription_item: string } };
        pricing: { price_details: { price: string; product: string } };
      };
      expect(line.parent.subscription_item_details.subscription).toBe(obj(3).id);
      expect(line.parent.subscription_item_details.subscription_item).toBe(item.id);
      expect(line.pricing.price_details).toEqual({ price: item.price.id, product: item.price.product });
      expect(obj(i).amount_due).toBe(item.price.unit_amount);
    }
    expect(obj(6).amount_paid).toBe(item.price.unit_amount);
  });

  it('keeps the fields an invoice fixes at creation and finalization', () => {
    for (const i of INVOICE_STEPS) {
      expect(obj(i).created).toBe(obj(2).created);
      expect(obj(i).lines).toEqual(obj(2).lines);
    }
    expect(obj(4).number).toMatch(/^INV-/);
    for (const field of ['number', 'hosted_invoice_url', 'invoice_pdf', 'effective_at', 'webhooks_delivered_at']) {
      expect(obj(5)[field], field).toEqual(obj(4)[field]);
    }
    const transitions = (i: number) => obj(i).status_transitions as AnyObject;
    expect(transitions(4).finalized_at).toBe(preset.steps[4]!.event.created);
    expect(transitions(5).finalized_at).toBe(transitions(4).finalized_at);
    expect(transitions(5).paid_at).toBe(preset.steps[5]!.event.created);
  });

  it('dates the default invoice payment from finalization and pays it with the invoice', () => {
    expect(obj(6).created).toBe((obj(4).status_transitions as AnyObject).finalized_at);
    expect((obj(6).status_transitions as AnyObject).paid_at).toBe((obj(5).status_transitions as AnyObject).paid_at);
    expect(obj(6).is_default).toBe(true);
    expect((obj(6).payment as AnyObject).payment_intent).toMatch(/^pi_/);
  });

  it('is deterministic: same seed produces identical object IDs', () => {
    const a = trialConversion({ seed: 'determinism' });
    const b = trialConversion({ seed: 'determinism' });
    expect(objectIds(a)).toEqual(objectIds(b));
    expect(stepObject(a, 0).latest_invoice).toBe(stepObject(b, 0).latest_invoice);
    expect(a.steps.map((s) => s.event.created)).toEqual(b.steps.map((s) => s.event.created));
  });

  it('different seeds produce different IDs', () => {
    expect(objectIds(trialConversion({ seed: 'seed-a' }))).not.toEqual(objectIds(trialConversion({ seed: 'seed-b' })));
  });
});

// ─── 3D Secure Authentication ───────────────────────────────────────────────

describe('threeDSecure', () => {
  const preset = threeDSecure({ seed: '3ds-test' });
  const obj = (i: number) => stepObject(preset, i);
  const INVOICE_STEPS = [0, 1, 4];

  it('returns a ScenarioPreset with 6 steps', () => {
    expect(threeDSecure().id).toBe('3d-secure');
    expect(preset.steps).toHaveLength(6);
    expect(preset.name).toBe('3D Secure Authentication');
  });

  it('has steps in expected event type order', () => {
    expect(preset.steps.map((s) => s.event.type)).toEqual([
      'invoice.finalized',
      'invoice.payment_action_required',
      'payment_intent.requires_action',
      'payment_intent.succeeded',
      'invoice.paid',
      'invoice_payment.paid',
    ]);
  });

  it('uses one invoice, subscription and customer across the invoice steps', () => {
    const inId = obj(0).id as string;
    const subId = invoiceSubscription(preset, 0);
    expect(inId).toMatch(/^in_/);
    expect(subId).toMatch(/^sub_/);
    for (const i of INVOICE_STEPS) {
      expect(obj(i).id).toBe(inId);
      expect(invoiceSubscription(preset, i)).toBe(subId);
      expect(obj(i).customer).toBe(obj(0).customer);
    }
    expect(obj(5).invoice).toBe(inId);
  });

  it('uses one PaymentIntent for the attempt, the success and the invoice payment', () => {
    const piId = obj(2).id as string;
    expect(piId).toMatch(/^pi_/);
    expect(obj(3).id).toBe(piId);
    expect((obj(5).payment as AnyObject).payment_intent).toBe(piId);
    expect(obj(2).customer).toBe(obj(0).customer);
  });

  it('keeps the invoice open until the authenticated payment pays it', () => {
    expect(INVOICE_STEPS.map((i) => obj(i).status)).toEqual(['open', 'open', 'paid']);
    expect(INVOICE_STEPS.map((i) => obj(i).attempted)).toEqual([false, true, true]);
    // Confirming after authentication is not an automatic retry.
    expect(INVOICE_STEPS.map((i) => obj(i).attempt_count)).toEqual([0, 1, 1]);
    expect(INVOICE_STEPS.map((i) => obj(i).auto_advance)).toEqual([true, true, false]);
    expect(obj(4).amount_remaining).toBe(0);
    expect(obj(5).status).toBe('paid');
  });

  it('is a renewal invoice in every invoice step', () => {
    for (const i of INVOICE_STEPS) expect(obj(i).billing_reason).toBe('subscription_cycle');
  });

  it('moves the PaymentIntent from requires_action to succeeded', () => {
    expect(obj(2).status).toBe('requires_action');
    expect(obj(2).next_action).not.toBeNull();
    expect(obj(2).latest_charge).toBeNull();
    expect(obj(2).amount_received).toBe(0);
    expect(obj(3).status).toBe('succeeded');
    expect(obj(3).next_action).toBeNull();
    expect(obj(3).latest_charge).toMatch(/^ch_/);
    expect(obj(3).amount_received).toBe(obj(3).amount);
  });

  it('changes only the PaymentIntent fields that authentication changes', () => {
    const changed = ['status', 'amount_received', 'latest_charge', 'next_action'];
    const rest = (o: AnyObject) => Object.fromEntries(Object.entries(o).filter(([k]) => !changed.includes(k)));
    expect(rest(obj(3))).toEqual(rest(obj(2)));
    expect(obj(3).client_secret).toBe(obj(2).client_secret);
  });

  it('asks for the same amount everywhere', () => {
    const amount = obj(0).amount_due;
    expect(obj(2).amount).toBe(amount);
    expect(obj(3).amount).toBe(amount);
    expect(obj(4).amount_paid).toBe(amount);
    expect(obj(5).amount_paid).toBe(amount);
  });

  it('dates the default PaymentIntent and invoice payment from finalization', () => {
    const finalizedAt = (obj(0).status_transitions as AnyObject).finalized_at;
    expect(finalizedAt).toBe(preset.steps[0]!.event.created);
    expect(obj(2).created).toBe(finalizedAt);
    expect(obj(3).created).toBe(finalizedAt);
    expect(obj(5).created).toBe(finalizedAt);
  });

  it('keeps the fields an invoice fixes at creation and finalization', () => {
    for (const i of INVOICE_STEPS) {
      for (const field of ['created', 'period_start', 'period_end', 'lines', 'number', 'hosted_invoice_url', 'invoice_pdf', 'effective_at', 'webhooks_delivered_at']) {
        expect(obj(i)[field], `step ${i} ${field}`).toEqual(obj(0)[field]);
      }
      expect((obj(i).status_transitions as AnyObject).finalized_at).toBe((obj(0).status_transitions as AnyObject).finalized_at);
    }
    // The renewal draft was held for an hour before finalization.
    expect(preset.steps[0]!.event.created - (obj(0).created as number)).toBe(3600);
    expect((obj(4).status_transitions as AnyObject).paid_at).toBe(preset.steps[4]!.event.created);
  });

  it('attempts payment right after finalization and succeeds after the customer authenticates', () => {
    const created = preset.steps.map((s) => s.event.created);
    expect(created[1]! - created[0]!).toBeLessThanOrEqual(5);
    expect(created[2]).toBe(created[1]);
    expect(created[3]! - created[2]!).toBeGreaterThanOrEqual(3600);
    expect(created[4]).toBeGreaterThan(created[3]!);
  });

  it('is deterministic: same seed produces identical object IDs', () => {
    const a = threeDSecure({ seed: 'determinism' });
    const b = threeDSecure({ seed: 'determinism' });
    expect(objectIds(a)).toEqual(objectIds(b));
    expect(stepObject(a, 3).latest_charge).toBe(stepObject(b, 3).latest_charge);
  });

  it('different seeds produce different IDs', () => {
    expect(objectIds(threeDSecure({ seed: 'seed-a' }))).not.toEqual(objectIds(threeDSecure({ seed: 'seed-b' })));
  });
});

// ─── Early Fraud Warning ────────────────────────────────────────────────────

describe('earlyFraudWarning', () => {
  const preset = earlyFraudWarning({ seed: 'efw-test' });
  const obj = (i: number) => stepObject(preset, i);

  it('returns a ScenarioPreset with 4 steps', () => {
    expect(earlyFraudWarning().id).toBe('early-fraud-warning');
    expect(preset.steps).toHaveLength(4);
    expect(preset.name).toBe('Early Fraud Warning');
  });

  it('has steps in expected event type order', () => {
    expect(preset.steps.map((s) => s.event.type)).toEqual([
      'charge.succeeded',
      'radar.early_fraud_warning.created',
      'refund.created',
      'charge.refunded',
    ]);
  });

  it('points the warning and the refund at the charge and its PaymentIntent', () => {
    const chId = obj(0).id as string;
    const piId = obj(0).payment_intent as string;
    expect(chId).toMatch(/^ch_/);
    expect(piId).toMatch(/^pi_/);
    expect(obj(1).charge).toBe(chId);
    expect(obj(1).payment_intent).toBe(piId);
    expect(obj(2).charge).toBe(chId);
    expect(obj(2).payment_intent).toBe(piId);
    expect(obj(3).id).toBe(chId);
    expect(obj(3).payment_intent).toBe(piId);
  });

  it('refunds the customer and payment method that paid', () => {
    expect(obj(0).customer).toMatch(/^cus_/);
    expect(obj(0).payment_method).toMatch(/^pm_/);
    expect(obj(2).customer).toBe(obj(0).customer);
    expect(obj(2).payment_method).toBe(obj(0).payment_method);
    expect(obj(3).customer).toBe(obj(0).customer);
  });

  it('raises an actionable warning on a charge that is neither disputed nor refunded', () => {
    expect(obj(1).id).toMatch(/^issfr_/);
    expect(obj(1).actionable).toBe(true);
    expect(obj(0).disputed).toBe(false);
    expect(obj(0).amount_refunded).toBe(0);
  });

  it('refunds the full amount as fraudulent', () => {
    expect(obj(2).id).toMatch(/^re_/);
    expect(obj(2).reason).toBe('fraudulent');
    expect(obj(2).status).toBe('succeeded');
    expect(obj(2).amount).toBe(obj(0).amount);
    expect(obj(2).currency).toBe(obj(0).currency);
  });

  it('leaves the charge fully refunded and not disputed', () => {
    expect(obj(3).refunded).toBe(true);
    expect(obj(3).amount_refunded).toBe(obj(0).amount);
    expect(obj(3).disputed).toBe(false);
    expect(obj(3).status).toBe('succeeded');
  });

  it('changes only the refund fields on the charge', () => {
    const { amount_refunded: _a, refunded: _r, ...refundedRest } = obj(3);
    const { amount_refunded: _a0, refunded: _r0, ...chargedRest } = obj(0);
    expect(refundedRest).toEqual(chargedRest);
  });

  it('sends refund.created and charge.refunded from one API request', () => {
    const requestId = preset.steps[2]!.event.request.id;
    expect(requestId).toMatch(/^req_[A-Za-z0-9]{14}$/);
    expect(preset.steps[3]!.event.request.id).toBe(requestId);
    expect(preset.steps[0]!.event.request.id).toBeNull();
    expect(preset.steps[1]!.event.request.id).toBeNull();
  });

  it('warns days after the charge and refunds after the warning', () => {
    const created = preset.steps.map((s) => s.event.created);
    expect(created[1]! - created[0]!).toBeGreaterThanOrEqual(86400);
    expect(created[2]).toBeGreaterThan(created[1]!);
    expect(created[3]).toBeGreaterThanOrEqual(created[2]!);
  });

  it('is deterministic: same seed produces identical object IDs', () => {
    const a = earlyFraudWarning({ seed: 'determinism' });
    const b = earlyFraudWarning({ seed: 'determinism' });
    expect(objectIds(a)).toEqual(objectIds(b));
    expect(stepObject(a, 0).payment_method).toBe(stepObject(b, 0).payment_method);
    expect(a.steps[2]!.event.request.id).toBe(b.steps[2]!.event.request.id);
  });

  it('different seeds produce different IDs', () => {
    expect(objectIds(earlyFraudWarning({ seed: 'seed-a' }))).not.toEqual(objectIds(earlyFraudWarning({ seed: 'seed-b' })));
  });
});
