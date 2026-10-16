// Copyright 2026 Sutyr Inc. SPDX-License-Identifier: Apache-2.0
'use client';

import { useEffect, useMemo, useRef } from 'react';
import { ChevronRight } from 'lucide-react';
import { useLabState, useLabDispatch } from '@/lib/lab-context';
import { categoryOf, EVENT_GROUPS, filterEvents, navigableEvents, stepEvent } from '@/lib/event-groups';
import { EventRows } from '@/components/sidebar/event-rows';
import { cn } from '@/lib/cn';

/**
 * The Events tab: every event in collapsible groups, or a flat list of
 * matches while a search is open. Arrow keys move the selection through the
 * visible events; Escape folds the current event's group and returns focus
 * to its header.
 */
export function EventCatalog() {
  const { searchQuery, openGroups, selectedEventType, testedEventTypes } = useLabState();
  const dispatch = useLabDispatch();
  const rootRef = useRef<HTMLDivElement>(null);
  const query = searchQuery.trim();
  const matches = useMemo(() => (query ? filterEvents(query) : []), [query]);

  // Bring the current event into view when the tab opens, so a selection
  // made from a shared link or the breadcrumbs is not scrolled out of sight.
  useEffect(() => {
    rootRef.current
      ?.querySelector<HTMLElement>(`[data-event-type="${selectedEventType}"]`)
      ?.scrollIntoView({ block: 'nearest' });
    // Only on mount: later selections come from this list and are in view.
  }, []);

  function focusEvent(type: string) {
    // Wait for the new selection to render before moving focus to it.
    requestAnimationFrame(() => {
      rootRef.current?.querySelector<HTMLElement>(`[data-event-type="${type}"]`)?.focus();
    });
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      const next = stepEvent(
        navigableEvents(openGroups, query),
        selectedEventType,
        e.key === 'ArrowDown' ? 1 : -1,
      );
      if (!next) return;
      e.preventDefault();
      dispatch({ type: 'SELECT_EVENT', eventType: next });
      focusEvent(next);
    } else if (e.key === 'Escape' && !query) {
      const category = categoryOf(selectedEventType);
      if (!category || !openGroups.includes(category)) return;
      e.preventDefault();
      dispatch({ type: 'SET_GROUP_OPEN', category, open: false });
      rootRef.current?.querySelector<HTMLElement>(`[data-group-header="${category}"]`)?.focus();
    }
  }

  return (
    <div
      ref={rootRef}
      id="tabpanel-events"
      role="tabpanel"
      aria-label="Events"
      onKeyDown={handleKeyDown}
    >
      {query ? (
        <div className="py-1">
          <div className="flex items-baseline justify-between px-3 pb-1 pt-2">
            <span className="label-section">Matching events</span>
            <span className="font-mono text-[0.69rem] text-text-muted">{matches.length}</span>
          </div>
          {matches.length > 0 ? (
            <EventRows entries={matches} label="Matching events" query={query} />
          ) : (
            <p className="px-3 py-2 font-sans text-[0.75rem] leading-[1.4] text-text-muted">
              No event type contains &ldquo;{query}&rdquo;. Try part of a name, like invoice or dispute.
            </p>
          )}
        </div>
      ) : (
        <div className="py-1">
          {EVENT_GROUPS.map((group) => {
            const isOpen = openGroups.includes(group.category);
            const tested = group.events.filter((e) => testedEventTypes.has(e.type)).length;
            const total = group.events.length;
            const listId = `event-group-${group.category}`;
            return (
              <section key={group.category}>
                <button
                  type="button"
                  data-group-header={group.category}
                  aria-expanded={isOpen}
                  aria-controls={listId}
                  onClick={() => dispatch({ type: 'TOGGLE_GROUP', category: group.category })}
                  className="group flex w-full items-center gap-1.5 rounded-input px-2 py-2 text-left transition-colors duration-150 hover:bg-surface-input"
                >
                  <ChevronRight
                    size={14}
                    strokeWidth={1.75}
                    className={cn(
                      'flex-shrink-0 text-text-muted transition-transform duration-200 group-hover:text-text-secondary',
                      isOpen && 'rotate-90',
                    )}
                  />
                  <span className="min-w-0 flex-1 truncate font-sans text-[0.78rem] font-medium text-text-secondary">
                    {group.label}
                  </span>
                  <span
                    className={cn(
                      'flex-shrink-0 font-mono text-[0.69rem] tabular-nums',
                      tested === total ? 'text-state-success' : 'text-text-muted',
                    )}
                    title={`${tested} of ${total} fired this session`}
                  >
                    <span className="sr-only">
                      {tested} of {total} fired
                    </span>
                    <span aria-hidden="true">
                      {tested}/{total}
                    </span>
                  </span>
                </button>
                {isOpen && (
                  <div className="animate-fade-in pb-1">
                    <EventRows id={listId} entries={group.events} label={`${group.label} events`} />
                  </div>
                )}
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
