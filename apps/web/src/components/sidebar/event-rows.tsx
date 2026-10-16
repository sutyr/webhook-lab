// Copyright 2026 Sutyr Inc. SPDX-License-Identifier: Apache-2.0
'use client';

import { Fragment, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { Check } from 'lucide-react';
import type { EventCatalogEntry, StripeEventType } from '@webhook-lab/events';
import { useLabState, useLabDispatch } from '@/lib/lab-context';
import { matchRanges, splitByRanges } from '@/lib/event-groups';
import { cn } from '@/lib/cn';

/**
 * Event types are long dotted names. Offer a line break after each dot so a
 * narrow sidebar wraps them between words (customer.subscription. then
 * trial_will_end) instead of cutting off the end, where
 * async_payment_succeeded and async_payment_failed differ. A word too long
 * for the line still breaks, through overflow-wrap on the row.
 */
function withBreaks(text: string): ReactNode[] {
  const out: ReactNode[] = [];
  let start = 0;
  for (let i = 0; i < text.length; i++) {
    if (text[i] === '.') {
      out.push(text.slice(start, i + 1), <wbr key={i} />);
      start = i + 1;
    }
  }
  if (start < text.length) out.push(text.slice(start));
  return out;
}

function EventLabel({ type, query }: { type: string; query: string }) {
  const ranges = query ? matchRanges(type, query) : null;
  if (!ranges || ranges.length === 0) return <>{withBreaks(type)}</>;
  return (
    <>
      {splitByRanges(type, ranges).map((segment, i) =>
        segment.match ? (
          <mark key={i} className="rounded-[2px] bg-surface-hover text-text-primary underline decoration-text-muted underline-offset-2">
            {withBreaks(segment.text)}
          </mark>
        ) : (
          <Fragment key={i}>{withBreaks(segment.text)}</Fragment>
        ),
      )}
    </>
  );
}

interface Box {
  top: number;
  height: number;
}

interface EventRowsProps {
  entries: readonly EventCatalogEntry[];
  /** Accessible name of the list, such as "Invoices events". */
  label: string;
  id?: string;
  /** Highlight what matches this search. */
  query?: string;
}

/**
 * A list of events with the traveling highlight: the selection marker slides
 * between rows in 200ms, so arrow keys and clicks read as movement through one
 * list. Rows wrap, so the marker measures the selected row instead of
 * assuming a row height.
 */
export function EventRows({ entries, label, id, query = '' }: EventRowsProps) {
  const { selectedEventType, mode, testedEventTypes } = useLabState();
  const dispatch = useLabDispatch();
  const listRef = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState<Box | null>(null);
  // The marker slides only between two rows of this list; entering the list
  // from elsewhere fades it in where it lands.
  const placedRef = useRef(false);
  const lastBoxRef = useRef<Box>({ top: 0, height: 0 });

  const typesKey = entries.map((e) => e.type).join(' ');
  const selectedHere = entries.some((e) => e.type === selectedEventType);

  useLayoutEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const measure = () => {
      const row = selectedHere
        ? list.querySelector<HTMLElement>(`[data-event-type="${selectedEventType}"]`)
        : null;
      setBox((prev) => {
        if (!row) return null;
        const next = { top: row.offsetTop, height: row.offsetHeight };
        return prev && prev.top === next.top && prev.height === next.height ? prev : next;
      });
    };
    measure();
    // Rows rewrap when fonts load or the sidebar changes width.
    const observer = new ResizeObserver(measure);
    observer.observe(list);
    return () => observer.disconnect();
  }, [selectedEventType, selectedHere, typesKey]);

  useEffect(() => {
    placedRef.current = box !== null;
    if (box) lastBoxRef.current = box;
  });

  const shown = box ?? lastBoxRef.current;
  const visible = box !== null && mode === 'event';

  function select(type: StripeEventType) {
    dispatch({ type: 'SELECT_EVENT', eventType: type });
  }

  return (
    <div ref={listRef} id={id} className="relative" role="listbox" aria-label={label}>
      {/* Traveling highlight: decorative, the options carry aria-selected */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-0 right-0 rounded-r-input border-l-[3px] border-text-primary bg-surface-input duration-200 ease-out"
        style={{
          top: shown.top,
          height: shown.height,
          opacity: visible ? 1 : 0,
          transitionProperty: placedRef.current ? 'top, height, opacity' : 'opacity',
        }}
      />

      {entries.map((entry) => {
        const isSelected = mode === 'event' && selectedEventType === entry.type;
        const isCurrent = selectedEventType === entry.type;
        return (
          <button
            key={entry.type}
            type="button"
            role="option"
            aria-selected={isSelected}
            data-event-type={entry.type}
            // Roving tab stop: Tab lands on the current event, arrows move on.
            tabIndex={isCurrent ? 0 : -1}
            onClick={() => select(entry.type)}
            className={cn(
              'relative z-10 flex w-full items-start gap-1 py-2.5 pl-3 pr-2 text-left font-mono text-[0.78rem] leading-[1.35] transition-colors duration-150 md:py-1.5',
              isSelected ? 'text-text-primary' : 'text-text-secondary hover:text-text-primary',
            )}
          >
            <span className="min-w-0 flex-1 [overflow-wrap:anywhere]">
              <EventLabel type={entry.type} query={query} />
            </span>
            {testedEventTypes.has(entry.type) && (
              <Check
                size={12}
                strokeWidth={2}
                className="mt-[3px] shrink-0 text-state-success"
                role="img"
                aria-label="Fired this session"
              />
            )}
          </button>
        );
      })}
    </div>
  );
}
