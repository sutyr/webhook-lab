// Copyright 2026 Sutyr Inc. SPDX-License-Identifier: Apache-2.0

import { describe, it, expect } from 'vitest';
import { EVENT_CATALOG } from '@webhook-lab/events';
import {
  EVENT_GROUPS,
  GROUP_LABELS,
  categoryOf,
  filterEvents,
  isEventCategory,
  isEventType,
  matchRanges,
  navigableEvents,
  splitByRanges,
  stepEvent,
} from '@/lib/event-groups';

describe('EVENT_GROUPS', () => {
  it('holds every catalog event exactly once', () => {
    const grouped = EVENT_GROUPS.flatMap((g) => g.events.map((e) => e.type));
    expect(grouped).toHaveLength(EVENT_CATALOG.length);
    expect(new Set(grouped).size).toBe(EVENT_CATALOG.length);
    expect(new Set(grouped)).toEqual(new Set(EVENT_CATALOG.map((e) => e.type)));
  });

  it('lists the groups in catalog order with their sidebar names', () => {
    expect(EVENT_GROUPS.map((g) => [g.category, g.label])).toEqual([
      ['payments', 'Payments'],
      ['billing', 'Invoices'],
      ['subscriptions', 'Subscriptions'],
      ['checkout', 'Checkout'],
      ['customers', 'Customers'],
      ['payment_methods', 'Payment methods'],
      ['disputes', 'Disputes and fraud'],
    ]);
  });

  it('keeps catalog order inside each group', () => {
    for (const group of EVENT_GROUPS) {
      const expected = EVENT_CATALOG.filter((e) => e.category === group.category).map((e) => e.type);
      expect(group.events.map((e) => e.type)).toEqual(expected);
    }
  });

  it('counts 39 events across the groups', () => {
    expect(EVENT_GROUPS.reduce((n, g) => n + g.events.length, 0)).toBe(39);
  });

  it('names every group in sentence case', () => {
    for (const label of Object.values(GROUP_LABELS)) {
      expect(label[0]).toBe(label[0].toUpperCase());
      expect(label.slice(1)).toBe(label.slice(1).toLowerCase());
    }
  });
});

describe('lookups', () => {
  it('categoryOf finds the group of an event', () => {
    expect(categoryOf('invoice.paid')).toBe('billing');
    expect(categoryOf('radar.early_fraud_warning.created')).toBe('disputes');
    expect(categoryOf('setup_intent.succeeded')).toBe('payment_methods');
    expect(categoryOf('nope')).toBeUndefined();
  });

  it('isEventType and isEventCategory reject prototype names', () => {
    expect(isEventType('charge.failed')).toBe(true);
    expect(isEventType('constructor')).toBe(false);
    expect(isEventCategory('billing')).toBe(true);
    expect(isEventCategory('toString')).toBe(false);
  });
});

describe('matchRanges', () => {
  it('matches a substring, ignoring case', () => {
    expect(matchRanges('invoice.payment_failed', 'PAYMENT')).toEqual([[8, 15]]);
  });

  it('requires every word and returns each match in order', () => {
    expect(matchRanges('customer.subscription.updated', 'upd sub')).toEqual([
      [9, 12],
      [22, 25],
    ]);
    expect(matchRanges('customer.subscription.updated', 'sub deleted')).toBeNull();
  });

  it('merges overlapping words into one range', () => {
    expect(matchRanges('charge.dispute.closed', 'disp spute')).toEqual([[7, 14]]);
  });

  it('returns no ranges for an empty query', () => {
    expect(matchRanges('charge.failed', '   ')).toEqual([]);
  });
});

describe('splitByRanges', () => {
  it('splits text into plain and matching runs', () => {
    expect(splitByRanges('invoice.paid', [[8, 12]])).toEqual([
      { text: 'invoice.', match: false },
      { text: 'paid', match: true },
    ]);
  });

  it('returns the whole text when nothing matches', () => {
    expect(splitByRanges('invoice.paid', [])).toEqual([{ text: 'invoice.paid', match: false }]);
  });
});

describe('filterEvents', () => {
  it('returns every event for an empty query', () => {
    expect(filterEvents('')).toHaveLength(39);
  });

  it('finds events by part of their type, in catalog order', () => {
    expect(filterEvents('dispute').map((e) => e.type)).toEqual([
      'charge.dispute.created',
      'charge.dispute.updated',
      'charge.dispute.closed',
    ]);
  });

  it('finds the new events too', () => {
    expect(filterEvents('async').map((e) => e.type)).toEqual([
      'checkout.session.async_payment_succeeded',
      'checkout.session.async_payment_failed',
    ]);
  });

  it('returns nothing when no type matches', () => {
    expect(filterEvents('zzz')).toEqual([]);
  });
});

describe('navigableEvents and stepEvent', () => {
  it('walks only the open groups, in sidebar order', () => {
    const list = navigableEvents(['customers', 'payments'], '');
    expect(list[0]).toBe('payment_intent.succeeded');
    expect(list.slice(-3)).toEqual(['customer.created', 'customer.updated', 'customer.deleted']);
    expect(list).toHaveLength(8 + 3);
  });

  it('walks the matches while searching, open groups or not', () => {
    expect(navigableEvents([], 'refund')).toEqual(['charge.refunded', 'refund.created']);
  });

  it('steps forward and back, stopping at the ends', () => {
    const list = navigableEvents(['payments'], '');
    expect(stepEvent(list, 'payment_intent.succeeded', 1)).toBe('payment_intent.payment_failed');
    expect(stepEvent(list, 'payment_intent.succeeded', -1)).toBe('payment_intent.succeeded');
    expect(stepEvent(list, 'refund.created', 1)).toBe('refund.created');
  });

  it('starts at the first or last event when the current one is hidden', () => {
    const list = navigableEvents(['payments'], '');
    expect(stepEvent(list, 'invoice.paid', 1)).toBe('payment_intent.succeeded');
    expect(stepEvent(list, 'invoice.paid', -1)).toBe('refund.created');
  });

  it('has nowhere to go with every group closed', () => {
    expect(stepEvent(navigableEvents([], ''), 'invoice.paid', 1)).toBeUndefined();
  });
});
