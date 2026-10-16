// Copyright 2026 Sutyr Inc. SPDX-License-Identifier: Apache-2.0
'use client';

import type { RefObject } from 'react';
import { Search, X } from 'lucide-react';
import { useLabState, useLabDispatch } from '@/lib/lab-context';

/**
 * The event search inside the mobile drawer, where the header's inline
 * search has no room. Typing switches the drawer to the Events tab's
 * matches; clearing returns to the groups.
 */
export function DrawerSearch({ inputRef }: { inputRef: RefObject<HTMLInputElement | null> }) {
  const { searchQuery } = useLabState();
  const dispatch = useLabDispatch();

  return (
    <div className="flex items-center gap-2 border-b border-border px-3 py-2">
      <Search size={16} strokeWidth={1.75} className="flex-shrink-0 text-text-muted" />
      <input
        ref={inputRef}
        type="search"
        enterKeyHint="search"
        placeholder="Search events"
        aria-label="Search events"
        aria-controls="tabpanel-events"
        autoComplete="off"
        spellCheck={false}
        className="min-w-0 flex-1 bg-transparent py-1 font-mono text-text-primary outline-none placeholder:font-sans placeholder:text-text-muted [&::-webkit-search-cancel-button]:hidden"
        value={searchQuery}
        onChange={(e) => dispatch({ type: 'SET_SEARCH_QUERY', query: e.target.value })}
      />
      {searchQuery && (
        <button
          type="button"
          onClick={() => {
            dispatch({ type: 'SET_SEARCH_QUERY', query: '' });
            inputRef.current?.focus();
          }}
          aria-label="Clear search"
          className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-input text-text-muted transition-colors hover:bg-surface-hover hover:text-text-secondary"
        >
          <X size={16} strokeWidth={1.75} />
        </button>
      )}
    </div>
  );
}
