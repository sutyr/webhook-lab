// Copyright 2026 Sutyr Inc. SPDX-License-Identifier: Apache-2.0
import {
  AlertTriangle,
  CheckCircle,
  CreditCard,
  FileText,
  Hourglass,
  KeyRound,
  ListChecks,
  ListOrdered,
  RefreshCw,
  RotateCcw,
  Shield,
  ShieldAlert,
  ShoppingCart,
  Users,
  Wallet,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import type { EventCategory } from '@webhook-lab/events';
import type { SidebarTab } from '@/lib/lab-context';

/** One icon per event group, for the collapsed sidebar. */
export const CATEGORY_ICONS: Record<EventCategory, LucideIcon> = {
  payments: CreditCard,
  billing: FileText,
  subscriptions: RefreshCw,
  checkout: ShoppingCart,
  customers: Users,
  payment_methods: Wallet,
  disputes: Shield,
};

const SCENARIO_ICONS: Record<string, LucideIcon> = {
  'subscription-happy-path': CheckCircle,
  'subscription-failure': AlertTriangle,
  'checkout-flow': ShoppingCart,
  'dispute-lifecycle': Shield,
  'refund-flow': RotateCcw,
  'trial-conversion': Hourglass,
  '3d-secure': KeyRound,
  'early-fraud-warning': ShieldAlert,
};

/** Scenarios without an icon of their own get a numbered-list icon. */
export function scenarioIcon(id: string): LucideIcon {
  return Object.hasOwn(SCENARIO_ICONS, id) ? SCENARIO_ICONS[id] : ListOrdered;
}

export const TAB_ICONS: Record<SidebarTab, LucideIcon> = {
  suite: ListChecks,
  scenarios: ListOrdered,
  events: Zap,
};
