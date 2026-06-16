// Copyright 2026 Sutyr Inc. SPDX-License-Identifier: Apache-2.0
import { describe, it, expect } from 'vitest';
import { disputeCreated, disputeUpdated, disputeClosed } from '../../../src/generators/disputes.js';

describe('disputeCreated', () => {
  it('returns a charge.dispute.created event', () => {
    const event = disputeCreated();
    expect(event.type).toBe('charge.dispute.created');
  });

  it('wraps the dispute in data.object', () => {
    const event = disputeCreated();
    expect(event.data.object.object).toBe('dispute');
  });

  it('generates a dispute id starting with dp_', () => {
    const event = disputeCreated();
    expect(event.data.object.id.startsWith('dp_')).toBe(true);
  });

  it('sets status to needs_response', () => {
    const event = disputeCreated();
    expect(event.data.object.status).toBe('needs_response');
  });

  it('defaults reason to fraudulent', () => {
    const event = disputeCreated();
    expect(event.data.object.reason).toBe('fraudulent');
  });

  it('accepts a custom reason', () => {
    const event = disputeCreated({ reason: 'product_not_received' });
    expect(event.data.object.reason).toBe('product_not_received');
  });

  it('sets evidence_details.has_evidence to false', () => {
    const event = disputeCreated();
    expect(event.data.object.evidence_details.has_evidence).toBe(false);
  });

  it('sets evidence_details.due_by to a future timestamp', () => {
    const before = Math.floor(Date.now() / 1000);
    const event = disputeCreated();
    expect(event.data.object.evidence_details.due_by).not.toBeNull();
    // due_by should be ~21 days in the future
    expect(event.data.object.evidence_details.due_by!).toBeGreaterThan(before);
    expect(event.data.object.evidence_details.due_by!).toBeGreaterThan(before + 20 * 86400);
  });

  it('sets evidence_details.past_due to false', () => {
    const event = disputeCreated();
    expect(event.data.object.evidence_details.past_due).toBe(false);
  });

  it('sets evidence_details.submission_count to 0', () => {
    const event = disputeCreated();
    expect(event.data.object.evidence_details.submission_count).toBe(0);
  });

  it('defaults amount to 2999', () => {
    const event = disputeCreated();
    expect(event.data.object.amount).toBe(2999);
  });

  it('accepts custom amount and currency', () => {
    const event = disputeCreated({ amount: 5000, currency: 'eur' });
    expect(event.data.object.amount).toBe(5000);
    expect(event.data.object.currency).toBe('eur');
  });

  it('generates a charge id starting with ch_ by default', () => {
    const event = disputeCreated();
    expect(event.data.object.charge.startsWith('ch_')).toBe(true);
  });

  it('accepts a custom chargeId', () => {
    const event = disputeCreated({ chargeId: 'ch_custom123' });
    expect(event.data.object.charge).toBe('ch_custom123');
  });

  it('sets payment_intent starting with pi_', () => {
    const event = disputeCreated();
    expect(event.data.object.payment_intent).not.toBeNull();
    expect(event.data.object.payment_intent!.startsWith('pi_')).toBe(true);
  });

  it('sets is_charge_refundable to false', () => {
    const event = disputeCreated();
    expect(event.data.object.is_charge_refundable).toBe(false);
  });

  it('sets livemode to false', () => {
    const event = disputeCreated();
    expect(event.data.object.livemode).toBe(false);
    expect(event.livemode).toBe(false);
  });

  it('defaults metadata to empty object', () => {
    const event = disputeCreated();
    expect(event.data.object.metadata).toEqual({});
  });

  it('uses custom timestamp', () => {
    const ts = 1700000000;
    const event = disputeCreated({ timestamp: ts });
    expect(event.created).toBe(ts);
    expect(event.data.object.created).toBe(ts);
  });

  it('generates an event id starting with evt_', () => {
    const event = disputeCreated();
    expect(event.id.startsWith('evt_')).toBe(true);
  });
});

describe('disputeUpdated', () => {
  it('returns a charge.dispute.updated event', () => {
    const event = disputeUpdated();
    expect(event.type).toBe('charge.dispute.updated');
  });

  it('wraps the dispute in data.object', () => {
    const event = disputeUpdated();
    expect(event.data.object.object).toBe('dispute');
  });

  it('defaults status to under_review', () => {
    const event = disputeUpdated();
    expect(event.data.object.status).toBe('under_review');
  });

  it('accepts a custom status', () => {
    const event = disputeUpdated({ status: 'warning_under_review' });
    expect(event.data.object.status).toBe('warning_under_review');
  });

  it('includes previous_attributes with default previousStatus needs_response', () => {
    const event = disputeUpdated();
    expect(event.data.previous_attributes).toBeDefined();
    expect(event.data.previous_attributes!.status).toBe('needs_response');
  });

  it('accepts a custom previousStatus', () => {
    const event = disputeUpdated({ previousStatus: 'warning_needs_response' });
    expect(event.data.previous_attributes!.status).toBe('warning_needs_response');
  });

  it('sets evidence_details.has_evidence to true', () => {
    const event = disputeUpdated();
    expect(event.data.object.evidence_details.has_evidence).toBe(true);
  });

  it('sets evidence_details.submission_count to 1', () => {
    const event = disputeUpdated();
    expect(event.data.object.evidence_details.submission_count).toBe(1);
  });

  it('generates a dispute id starting with dp_', () => {
    const event = disputeUpdated();
    expect(event.data.object.id.startsWith('dp_')).toBe(true);
  });

  it('defaults amount to 2999', () => {
    const event = disputeUpdated();
    expect(event.data.object.amount).toBe(2999);
  });

  it('accepts custom amount and currency', () => {
    const event = disputeUpdated({ amount: 10000, currency: 'gbp' });
    expect(event.data.object.amount).toBe(10000);
    expect(event.data.object.currency).toBe('gbp');
  });

  it('accepts a custom chargeId', () => {
    const event = disputeUpdated({ chargeId: 'ch_custom456' });
    expect(event.data.object.charge).toBe('ch_custom456');
  });

  it('sets livemode to false', () => {
    const event = disputeUpdated();
    expect(event.data.object.livemode).toBe(false);
  });

  it('uses custom timestamp', () => {
    const ts = 1700000000;
    const event = disputeUpdated({ timestamp: ts });
    expect(event.created).toBe(ts);
  });
});

describe('disputeClosed', () => {
  it('returns a charge.dispute.closed event', () => {
    const event = disputeClosed();
    expect(event.type).toBe('charge.dispute.closed');
  });

  it('wraps the dispute in data.object', () => {
    const event = disputeClosed();
    expect(event.data.object.object).toBe('dispute');
  });

  it('defaults status to won', () => {
    const event = disputeClosed();
    expect(event.data.object.status).toBe('won');
  });

  it('accepts status lost', () => {
    const event = disputeClosed({ status: 'lost' });
    expect(event.data.object.status).toBe('lost');
  });

  it('sets is_charge_refundable to true when won', () => {
    const event = disputeClosed({ status: 'won' });
    expect(event.data.object.is_charge_refundable).toBe(true);
  });

  it('sets is_charge_refundable to false when lost', () => {
    const event = disputeClosed({ status: 'lost' });
    expect(event.data.object.is_charge_refundable).toBe(false);
  });

  it('sets evidence_details.due_by to null', () => {
    const event = disputeClosed();
    expect(event.data.object.evidence_details.due_by).toBeNull();
  });

  it('sets evidence_details.has_evidence to true', () => {
    const event = disputeClosed();
    expect(event.data.object.evidence_details.has_evidence).toBe(true);
  });

  it('includes previous_attributes with status under_review', () => {
    const event = disputeClosed();
    expect(event.data.previous_attributes).toBeDefined();
    expect(event.data.previous_attributes!.status).toBe('under_review');
  });

  it('generates a dispute id starting with dp_', () => {
    const event = disputeClosed();
    expect(event.data.object.id.startsWith('dp_')).toBe(true);
  });

  it('defaults amount to 2999', () => {
    const event = disputeClosed();
    expect(event.data.object.amount).toBe(2999);
  });

  it('accepts custom amount and currency', () => {
    const event = disputeClosed({ amount: 7500, currency: 'cad' });
    expect(event.data.object.amount).toBe(7500);
    expect(event.data.object.currency).toBe('cad');
  });

  it('accepts a custom chargeId', () => {
    const event = disputeClosed({ chargeId: 'ch_custom789' });
    expect(event.data.object.charge).toBe('ch_custom789');
  });

  it('sets livemode to false', () => {
    const event = disputeClosed();
    expect(event.data.object.livemode).toBe(false);
  });

  it('defaults metadata to empty object', () => {
    const event = disputeClosed();
    expect(event.data.object.metadata).toEqual({});
  });

  it('uses custom timestamp', () => {
    const ts = 1700000000;
    const event = disputeClosed({ timestamp: ts });
    expect(event.created).toBe(ts);
    expect(event.data.object.created).toBe(ts);
  });

  it('generates an event id starting with evt_', () => {
    const event = disputeClosed();
    expect(event.id.startsWith('evt_')).toBe(true);
  });
});
