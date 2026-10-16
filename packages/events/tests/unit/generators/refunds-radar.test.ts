// Copyright 2026 Sutyr Inc. SPDX-License-Identifier: Apache-2.0
import { describe, it, expect } from 'vitest';
import { refundCreated } from '../../../src/generators/refunds.js';
import { earlyFraudWarningCreated } from '../../../src/generators/radar.js';
import { STRIPE_API_VERSION } from '../../../src/generators/envelope.js';

// ─── refundCreated ──────────────────────────────────────────────────────────

describe('refundCreated', () => {
  it('returns correct event envelope', () => {
    const event = refundCreated();
    expect(event.type).toBe('refund.created');
    expect(event.object).toBe('event');
    expect(event.id).toMatch(/^evt_/);
    expect(event.api_version).toBe(STRIPE_API_VERSION);
    expect(event.api_version).toBe('2026-09-30.endive');
    expect(event.livemode).toBe(false);
  });

  it('inner object is a refund with correct ID prefixes', () => {
    const refund = refundCreated().data.object;
    expect(refund.object).toBe('refund');
    expect(refund.id).toMatch(/^re_/);
    expect(refund.charge).toMatch(/^ch_/);
    expect(refund.payment_intent).toMatch(/^pi_/);
    expect(refund.payment_method).toMatch(/^pm_/);
    expect(refund.customer).toMatch(/^cus_/);
    expect(refund.balance_transaction).toMatch(/^txn_/);
  });

  it('defaults to a succeeded full refund of the default charge amount', () => {
    const refund = refundCreated().data.object;
    expect(refund.status).toBe('succeeded');
    expect(refund.amount).toBe(2999);
    expect(refund.currency).toBe('usd');
    expect(refund.reason).toBeNull();
    expect(refund.metadata).toEqual({});
    expect(refund).not.toHaveProperty('pending_reason');
  });

  it('returns nullable fields as null', () => {
    const refund = refundCreated().data.object;
    expect(refund.customer_account).toBeNull();
    expect(refund.receipt_number).toBeNull();
    expect(refund.source_transfer_reversal).toBeNull();
    expect(refund.transfer_reversal).toBeNull();
  });

  it('card destination_details: reference is pending at creation', () => {
    const refund = refundCreated().data.object;
    expect(refund.destination_details).toEqual({
      type: 'card',
      card: {
        reference_status: 'pending',
        type: 'pending',
      },
    });
  });

  it('leaves reference and reference_type absent until Stripe has a reference (never null)', () => {
    const card = refundCreated().data.object.destination_details!.card!;
    expect(card).not.toHaveProperty('reference');
    expect(card).not.toHaveProperty('reference_type');
  });

  it('pending status carries pending_reason, defaulting to processing', () => {
    const pending = refundCreated({ status: 'pending' }).data.object;
    expect(pending.status).toBe('pending');
    expect(pending.pending_reason).toBe('processing');

    const held = refundCreated({ status: 'pending', pendingReason: 'insufficient_funds' }).data.object;
    expect(held.pending_reason).toBe('insufficient_funds');
  });

  it('ignores pendingReason unless status is pending', () => {
    const refund = refundCreated({ pendingReason: 'charge_pending' }).data.object;
    expect(refund).not.toHaveProperty('pending_reason');
  });

  it('accepts every reason in the endive enum', () => {
    const reasons = ['duplicate', 'expired_uncaptured_charge', 'fraudulent', 'requested_by_customer'] as const;
    for (const reason of reasons) {
      expect(refundCreated({ reason }).data.object.reason).toBe(reason);
    }
  });

  it('propagates options', () => {
    const event = refundCreated({
      amount: 1000,
      currency: 'eur',
      customerId: 'cus_shared',
      chargeId: 'ch_shared',
      paymentIntentId: 'pi_shared',
      paymentMethodId: 'pm_shared',
      refundId: 're_shared',
      timestamp: 1_700_002_000,
      metadata: { ticket: '42' },
    });
    const refund = event.data.object;
    expect(refund.id).toBe('re_shared');
    expect(refund.amount).toBe(1000);
    expect(refund.currency).toBe('eur');
    expect(refund.customer).toBe('cus_shared');
    expect(refund.charge).toBe('ch_shared');
    expect(refund.payment_intent).toBe('pi_shared');
    expect(refund.payment_method).toBe('pm_shared');
    expect(refund.metadata).toEqual({ ticket: '42' });
    expect(refund.created).toBe(1_700_002_000);
    expect(event.created).toBe(1_700_002_000);
  });

  it('omits fields that do not exist on a refund or only appear in later states', () => {
    const event = refundCreated();
    const refund = event.data.object;
    for (const field of [
      'livemode',
      'description',
      'failure_reason',
      'failure_balance_transaction',
      'next_action',
      'instructions_email',
      'presentment_details',
    ]) {
      expect(refund).not.toHaveProperty(field);
    }
    expect(event.data).not.toHaveProperty('previous_attributes');
  });
});

// ─── earlyFraudWarningCreated ───────────────────────────────────────────────

describe('earlyFraudWarningCreated', () => {
  it('returns correct event envelope', () => {
    const event = earlyFraudWarningCreated();
    expect(event.type).toBe('radar.early_fraud_warning.created');
    expect(event.object).toBe('event');
    expect(event.id).toMatch(/^evt_/);
    expect(event.api_version).toBe(STRIPE_API_VERSION);
  });

  it('inner object has correct object value and ID prefixes', () => {
    const efw = earlyFraudWarningCreated().data.object;
    expect(efw.object).toBe('radar.early_fraud_warning');
    expect(efw.id).toMatch(/^issfr_/);
    expect(efw.charge).toMatch(/^ch_/);
    expect(efw.payment_intent).toMatch(/^pi_/);
    expect(efw.livemode).toBe(false);
  });

  it('defaults to an actionable unauthorized_use_of_card warning', () => {
    const efw = earlyFraudWarningCreated().data.object;
    expect(efw.actionable).toBe(true);
    expect(efw.fraud_type).toBe('unauthorized_use_of_card');
  });

  it('accepts every fraud_type in the endive enum', () => {
    const types = [
      'card_never_received',
      'fraudulent_card_application',
      'made_with_counterfeit_card',
      'made_with_lost_card',
      'made_with_stolen_card',
      'misc',
      'unauthorized_use_of_card',
    ] as const;
    for (const fraudType of types) {
      expect(earlyFraudWarningCreated({ fraudType }).data.object.fraud_type).toBe(fraudType);
    }
  });

  it('propagates options', () => {
    const event = earlyFraudWarningCreated({
      chargeId: 'ch_shared',
      paymentIntentId: 'pi_shared',
      earlyFraudWarningId: 'issfr_shared',
      actionable: false,
      timestamp: 1_700_003_000,
    });
    const efw = event.data.object;
    expect(efw.id).toBe('issfr_shared');
    expect(efw.charge).toBe('ch_shared');
    expect(efw.payment_intent).toBe('pi_shared');
    expect(efw.actionable).toBe(false);
    expect(efw.created).toBe(1_700_003_000);
    expect(event.created).toBe(1_700_003_000);
  });

  it('has exactly the endive fields: no metadata, amount, currency or status', () => {
    const efw = earlyFraudWarningCreated({ metadata: { ignored: 'yes' } }).data.object;
    expect(Object.keys(efw).sort()).toEqual([
      'actionable',
      'charge',
      'created',
      'fraud_type',
      'id',
      'livemode',
      'object',
      'payment_intent',
    ]);
  });

  it('omits previous_attributes', () => {
    expect(earlyFraudWarningCreated().data).not.toHaveProperty('previous_attributes');
  });
});
