// Copyright 2026 Sutyr Inc. SPDX-License-Identifier: Apache-2.0
'use client';

import {
  CreditCard,
  FileText,
  RefreshCw,
  ShoppingCart,
  Users,
  Shield,
  CheckCircle,
  AlertTriangle,
  RotateCcw,
  type LucideIcon,
} from 'lucide-react';
import type { EventCategory } from '@webhook-lab/events';
import { useLabState, useLabDispatch } from '@/lib/lab-context';
import { cn } from '@/lib/cn';

const CATEGORY_ITEMS: { id: EventCategory; icon: LucideIcon; label: string }[] = [
  { id: 'payments', icon: CreditCard, label: 'Payments' },
  { id: 'billing', icon: FileText, label: 'Billing' },
  { id: 'subscriptions', icon: RefreshCw, label: 'Subscriptions' },
  { id: 'checkout', icon: ShoppingCart, label: 'Checkout' },
  { id: 'customers', icon: Users, label: 'Customers' },
  { id: 'disputes', icon: Shield, label: 'Disputes' },
];

const SCENARIO_ITEMS: { id: string; icon: LucideIcon; label: string }[] = [
  { id: 'subscription-happy-path', icon: CheckCircle, label: 'Happy Path' },
  { id: 'subscription-failure', icon: AlertTriangle, label: 'Dunning' },
  { id: 'checkout-flow', icon: ShoppingCart, label: 'Checkout' },
  { id: 'dispute-lifecycle', icon: Shield, label: 'Dispute' },
  { id: 'refund-flow', icon: RotateCcw, label: 'Refund' },
];

interface CollapsedSidebarProps {
  onExpand: () => void;
}

export function CollapsedSidebar({ onExpand }: CollapsedSidebarProps) {
  const { activeTab, drillCategory, selectedScenarioId, mode } = useLabState();
  const dispatch = useLabDispatch();

  const items = activeTab === 'events' ? CATEGORY_ITEMS : SCENARIO_ITEMS;

  function handleClick(item: { id: string }) {
    if (activeTab === 'events') {
      dispatch({ type: 'DRILL_INTO_CATEGORY', id: item.id });
      onExpand();
    } else {
      dispatch({ type: 'SELECT_SCENARIO', scenarioId: item.id });
      onExpand();
    }
  }

  return (
    <div className="flex flex-col items-center gap-1 py-3">
      {items.map((item) => {
        const Icon = item.icon;
        const isActive =
          activeTab === 'events'
            ? drillCategory === item.id
            : mode === 'scenario' && selectedScenarioId === item.id;

        return (
          <button
            key={item.id}
            type="button"
            onClick={() => handleClick(item)}
            title={item.label}
            className={cn(
              'flex h-8 w-8 items-center justify-center rounded-input transition-all duration-150 hover:scale-110',
              isActive
                ? 'bg-surface-input text-text-primary'
                : 'text-text-tertiary hover:bg-surface-input hover:text-text-secondary',
            )}
          >
            <Icon size={20} strokeWidth={1.75} />
          </button>
        );
      })}
    </div>
  );
}
