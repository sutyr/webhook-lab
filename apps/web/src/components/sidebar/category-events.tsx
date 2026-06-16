// Copyright 2026 Sutyr Inc. SPDX-License-Identifier: Apache-2.0
'use client';

import { useState, useCallback } from 'react';
import {
  ArrowLeft,
  Check,
  CreditCard,
  FileText,
  RefreshCw,
  ShoppingCart,
  Users,
  Shield,
  type LucideIcon,
} from 'lucide-react';
import { EVENT_CATALOG } from '@webhook-lab/events';
import type { EventCategory, StripeEventType } from '@webhook-lab/events';
import { useLabState, useLabDispatch } from '@/lib/lab-context';
import { cn } from '@/lib/cn';

const CATEGORY_ICONS: Record<string, LucideIcon> = {
  payments: CreditCard,
  billing: FileText,
  subscriptions: RefreshCw,
  checkout: ShoppingCart,
  customers: Users,
  disputes: Shield,
};

const CATEGORY_LABELS: Record<string, string> = {
  payments: 'Payments',
  billing: 'Billing',
  subscriptions: 'Subscriptions',
  checkout: 'Checkout',
  customers: 'Customers',
  disputes: 'Disputes',
};

export function CategoryEvents() {
  const { drillCategory, selectedEventType, mode, searchQuery, testedEventTypes } = useLabState();
  const dispatch = useLabDispatch();

  // #6: Measure item height dynamically
  const [itemHeight, setItemHeight] = useState(32);
  const firstItemRef = useCallback((node: HTMLElement | null) => {
    if (node) setItemHeight(node.getBoundingClientRect().height);
  }, []);

  if (!drillCategory) return null;

  const Icon = CATEGORY_ICONS[drillCategory];
  const label = CATEGORY_LABELS[drillCategory] ?? drillCategory;
  const events = EVENT_CATALOG.filter(
    (e) =>
      e.category === (drillCategory as EventCategory) &&
      (searchQuery === '' || e.type.includes(searchQuery.toLowerCase())),
  );

  const selectedIndex = events.findIndex((e) => e.type === selectedEventType);

  function selectEvent(eventType: StripeEventType) {
    dispatch({ type: 'SELECT_EVENT', eventType });
  }

  return (
    <div>
      {/* Back button */}
      <button
        type="button"
        onClick={() => dispatch({ type: 'DRILL_OUT' })}
        className="flex items-center gap-2 px-3 py-2 font-sans text-[0.75rem] text-text-tertiary transition-colors duration-150 hover:text-text-secondary"
      >
        <ArrowLeft size={14} strokeWidth={1.75} />
        <span>All events</span>
      </button>

      {/* Category context header (#5 scale-settle) */}
      <div className="flex items-center gap-2 px-3 py-1.5">
        {Icon && <Icon key={drillCategory} size={14} strokeWidth={1.75} className="text-text-tertiary animate-scale-settle" />}
        <span className="font-mono text-[0.69rem] font-medium uppercase tracking-[0.12em] text-text-tertiary">
          {label}
        </span>
      </div>

      {/* Event list with traveling highlight (#6) + arrow key nav */}
      <div
        className="relative"
        role="listbox"
        aria-label={`${label} events`}
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown' && selectedIndex < events.length - 1) {
            e.preventDefault();
            selectEvent(events[selectedIndex + 1].type);
          } else if (e.key === 'ArrowUp' && selectedIndex > 0) {
            e.preventDefault();
            selectEvent(events[selectedIndex - 1].type);
          } else if (e.key === 'ArrowDown' && selectedIndex === -1 && events.length > 0) {
            e.preventDefault();
            selectEvent(events[0].type);
          } else if (e.key === 'Escape') {
            e.preventDefault();
            dispatch({ type: 'DRILL_OUT' });
          }
        }}
      >
        {/* Traveling highlight — purely decorative, excluded from a11y tree */}
        <div
          aria-hidden="true"
          role="presentation"
          className="pointer-events-none absolute left-0 right-0 rounded-r-input border-l-[3px] border-text-primary bg-surface-input transition-all duration-200 ease-out"
          style={{
            top: selectedIndex >= 0 ? `${selectedIndex * itemHeight}px` : 0,
            height: `${itemHeight}px`,
            opacity: selectedIndex >= 0 && mode === 'event' ? 1 : 0,
          }}
        />

        {events.map((entry, i) => {
          const isSelected = mode === 'event' && selectedEventType === entry.type;

          return (
            <button
              key={entry.type}
              ref={i === 0 ? firstItemRef : undefined}
              type="button"
              role="option"
              aria-selected={isSelected}
              onClick={() => selectEvent(entry.type)}
              className={cn(
                'relative z-10 flex w-full items-center gap-1 py-2.5 pl-3 pr-2 text-left font-mono text-[0.78rem] leading-[1.4] transition-colors duration-150 md:py-1.5',
                isSelected ? 'text-text-primary' : 'text-text-secondary hover:text-text-primary',
              )}
            >
              <span className="min-w-0 truncate">{entry.type}</span>
              {testedEventTypes.has(entry.type) && (
                <Check size={12} strokeWidth={2} className="ml-auto shrink-0 text-state-success" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
