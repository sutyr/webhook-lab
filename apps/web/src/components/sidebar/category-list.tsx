// Copyright 2026 Sutyr Inc. SPDX-License-Identifier: Apache-2.0
'use client';

import {
  ChevronRight,
  CreditCard,
  FileText,
  RefreshCw,
  ShoppingCart,
  Users,
  Shield,
  type LucideIcon,
} from 'lucide-react';
import { EVENT_CATALOG } from '@webhook-lab/events';
import type { EventCategory } from '@webhook-lab/events';
import { useLabState, useLabDispatch } from '@/lib/lab-context';
import { cn } from '@/lib/cn';

const CATEGORIES: { id: EventCategory; name: string; icon: LucideIcon }[] = [
  { id: 'payments', name: 'Payments', icon: CreditCard },
  { id: 'billing', name: 'Billing', icon: FileText },
  { id: 'subscriptions', name: 'Subscriptions', icon: RefreshCw },
  { id: 'checkout', name: 'Checkout', icon: ShoppingCart },
  { id: 'customers', name: 'Customers', icon: Users },
  { id: 'disputes', name: 'Disputes', icon: Shield },
];

function countByCategory(categoryId: string, query: string): number {
  return EVENT_CATALOG.filter(
    (e) =>
      e.category === categoryId &&
      (query === '' || e.type.includes(query.toLowerCase())),
  ).length;
}

export function CategoryList() {
  const { searchQuery, testedEventTypes } = useLabState();
  const dispatch = useLabDispatch();

  return (
    <div className="space-y-1 p-2" role="group" aria-label="Event categories">
      {CATEGORIES.map((cat) => {
        const count = countByCategory(cat.id, searchQuery);
        if (searchQuery && count === 0) return null;
        const Icon = cat.icon;
        const testedInCategory = EVENT_CATALOG.filter(
          (e) => e.category === cat.id && testedEventTypes.has(e.type),
        ).length;

        return (
          <button
            key={cat.id}
            type="button"
            onClick={() => dispatch({ type: 'DRILL_INTO_CATEGORY', id: cat.id })}
            className="group flex w-full items-center gap-3 rounded-input px-3 py-2.5 transition-colors duration-150 hover:bg-surface-input"
          >
            <Icon
              size={18}
              strokeWidth={1.75}
              className="text-text-tertiary transition-colors group-hover:text-text-secondary"
            />
            <span className="flex-1 text-left font-sans text-[0.81rem] font-medium text-text-secondary">
              {cat.name}
            </span>
            <span className={cn(
              'font-mono text-[0.69rem]',
              testedInCategory === count ? 'text-state-success' : 'text-text-muted',
            )}>
              {testedInCategory}/{count}
            </span>
            <ChevronRight
              size={14}
              className="text-text-muted transition-all duration-150 group-hover:translate-x-0.5 group-hover:text-text-secondary"
            />
          </button>
        );
      })}
    </div>
  );
}
