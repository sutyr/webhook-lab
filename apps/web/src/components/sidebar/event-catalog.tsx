// Copyright 2026 Sutyr Inc. SPDX-License-Identifier: Apache-2.0
'use client';

import { useLabState } from '@/lib/lab-context';
import { CategoryList } from '@/components/sidebar/category-list';
import { CategoryEvents } from '@/components/sidebar/category-events';
import { cn } from '@/lib/cn';

export function EventCatalog() {
  const { drillCategory } = useLabState();
  const isDrilled = drillCategory !== null;

  return (
    <div className="relative overflow-hidden" id="tabpanel-events" role="tabpanel" aria-label="Events">
      {/* Level 1 — category list */}
      <div
        className={cn(
          'transition-transform duration-200 ease-out',
          isDrilled ? '-translate-x-full' : 'translate-x-0',
        )}
      >
        <CategoryList />
      </div>

      {/* Level 2 — category events */}
      <div
        className={cn(
          'absolute inset-0 overflow-y-auto transition-transform duration-200 ease-out',
          isDrilled ? 'translate-x-0' : 'translate-x-full',
        )}
      >
        <CategoryEvents />
      </div>
    </div>
  );
}
