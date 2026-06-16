// Copyright 2026 Sutyr Inc. SPDX-License-Identifier: Apache-2.0
import { describe, it, expect } from 'vitest';
import { subscriptionHappyPath } from '../../../src/scenarios/subscription-happy-path.js';
import { subscriptionFailure } from '../../../src/scenarios/subscription-failure.js';
import { checkoutFlow } from '../../../src/scenarios/checkout-flow.js';
import { disputeLifecycle } from '../../../src/scenarios/dispute-lifecycle.js';
import { refundFlow } from '../../../src/scenarios/refund-flow.js';
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
    // top-level object (id field). Invoice events reference it via `subscription`.
    const subCreated = preset.steps[1].event.data.object as unknown as Record<string, unknown>;
    const subCreatedId = subCreated.id as string;
    expect(subCreatedId).toMatch(/^sub_/);

    const subIds = extractFieldFromSteps(preset, 'subscription');
    // invoice.created (2), invoice.paid (5), invoice.payment_succeeded (6)
    // must reference the SAME subscription as the customer.subscription.created event
    expect(subIds[2]).toBe(subCreatedId);
    expect(subIds[5]).toBe(subCreatedId);
    expect(subIds[6]).toBe(subCreatedId);
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

  it('correlates invoice.payment_intent with the payment_intent.succeeded event', () => {
    // The PaymentIntent that pays the invoice must be the same one that the
    // charge references and that fires payment_intent.succeeded.
    const preset = subscriptionHappyPath({ seed: 'test-happy' });
    const obj = (i: number) =>
      preset.steps[i].event.data.object as unknown as Record<string, unknown>;
    const piIdValue = obj(4).id as string;
    expect(piIdValue).toMatch(/^pi_/);
    // charge.succeeded.payment_intent and all three invoices must reference it
    expect(obj(3).payment_intent).toBe(piIdValue);
    expect(obj(2).payment_intent).toBe(piIdValue);
    expect(obj(5).payment_intent).toBe(piIdValue);
    expect(obj(6).payment_intent).toBe(piIdValue);
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
    const subIds = extractFieldFromSteps(preset, 'subscription');
    const sharedSubId = subIds[0];
    expect(sharedSubId).toMatch(/^sub_/);
    expect(subIds[1]).toBe(sharedSubId);
    expect(subIds[4]).toBe(sharedSubId);

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

  it('invoice.paid has status paid and paid: true', () => {
    expect(obj(5).status).toBe('paid');
    expect(obj(5).paid).toBe(true);
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
