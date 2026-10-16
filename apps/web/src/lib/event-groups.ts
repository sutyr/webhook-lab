// Copyright 2026 Sutyr Inc. SPDX-License-Identifier: Apache-2.0
// Sidebar grouping and search for the event catalog. Pure data helpers, so
// the groups, their order and the search matching can be unit tested.
import { EVENT_CATALOG } from '@webhook-lab/events';
import type { EventCatalogEntry, EventCategory, StripeEventType } from '@webhook-lab/events';

/**
 * Group names shown in the sidebar. A Record so that a new category in the
 * events package fails to compile here until it has a name.
 */
export const GROUP_LABELS: Record<EventCategory, string> = {
  payments: 'Payments',
  billing: 'Invoices',
  subscriptions: 'Subscriptions',
  checkout: 'Checkout',
  customers: 'Customers',
  payment_methods: 'Payment methods',
  disputes: 'Disputes and fraud',
};

export interface EventGroup {
  category: EventCategory;
  label: string;
  events: EventCatalogEntry[];
}

/** One group per category, in the order the catalog first lists each one. */
export const EVENT_GROUPS: readonly EventGroup[] = (() => {
  const groups = new Map<EventCategory, EventGroup>();
  for (const entry of EVENT_CATALOG) {
    let group = groups.get(entry.category);
    if (!group) {
      group = { category: entry.category, label: GROUP_LABELS[entry.category], events: [] };
      groups.set(entry.category, group);
    }
    group.events.push(entry);
  }
  return [...groups.values()];
})();

const CATEGORY_BY_TYPE = new Map<string, EventCategory>(
  EVENT_CATALOG.map((entry) => [entry.type, entry.category]),
);

export function isEventType(value: string): value is StripeEventType {
  return CATEGORY_BY_TYPE.has(value);
}

export function categoryOf(type: string): EventCategory | undefined {
  return CATEGORY_BY_TYPE.get(type);
}

export function isEventCategory(value: string): value is EventCategory {
  return Object.hasOwn(GROUP_LABELS, value);
}

// ─── Search ──────────────────────────────────────────────────────────────────

/** Half-open [start, end) character ranges. */
export type MatchRange = readonly [number, number];

/**
 * Where `query` matches `text`, ignoring case. Each space-separated word must
 * appear somewhere in the text, so "sub upd" finds customer.subscription.updated.
 * Returns the merged ranges to highlight, [] for an empty query, or null when
 * a word is missing.
 */
export function matchRanges(text: string, query: string): MatchRange[] | null {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];
  const haystack = text.toLowerCase();
  const ranges: [number, number][] = [];
  for (const word of words) {
    const at = haystack.indexOf(word);
    if (at === -1) return null;
    ranges.push([at, at + word.length]);
  }
  ranges.sort((a, b) => a[0] - b[0]);
  const merged: [number, number][] = [];
  for (const range of ranges) {
    const last = merged[merged.length - 1];
    if (last && range[0] <= last[1]) last[1] = Math.max(last[1], range[1]);
    else merged.push([range[0], range[1]]);
  }
  return merged;
}

export interface TextSegment {
  text: string;
  match: boolean;
}

/** Split `text` into plain and highlighted runs for rendering. */
export function splitByRanges(text: string, ranges: readonly MatchRange[]): TextSegment[] {
  const segments: TextSegment[] = [];
  let at = 0;
  for (const [start, end] of ranges) {
    if (start > at) segments.push({ text: text.slice(at, start), match: false });
    segments.push({ text: text.slice(start, end), match: true });
    at = end;
  }
  if (at < text.length) segments.push({ text: text.slice(at), match: false });
  return segments;
}

/** Catalog entries whose event type matches the query, in catalog order. */
export function filterEvents(query: string): EventCatalogEntry[] {
  if (query.trim() === '') return [...EVENT_CATALOG];
  return EVENT_CATALOG.filter((entry) => matchRanges(entry.type, query) !== null);
}

/**
 * The events arrow keys move through: every match while searching, otherwise
 * the events of the open groups in sidebar order.
 */
export function navigableEvents(
  openGroups: readonly EventCategory[],
  query: string,
): StripeEventType[] {
  if (query.trim() !== '') return filterEvents(query).map((entry) => entry.type);
  return EVENT_GROUPS.filter((group) => openGroups.includes(group.category)).flatMap((group) =>
    group.events.map((entry) => entry.type),
  );
}

/**
 * The event `delta` steps from `current` in `list`, clamped to the ends. When
 * `current` is not in the list, moving down starts at the first event and
 * moving up at the last.
 */
export function stepEvent(
  list: readonly StripeEventType[],
  current: StripeEventType,
  delta: 1 | -1,
): StripeEventType | undefined {
  if (list.length === 0) return undefined;
  const at = list.indexOf(current);
  if (at === -1) return delta === 1 ? list[0] : list[list.length - 1];
  return list[Math.min(list.length - 1, Math.max(0, at + delta))];
}
