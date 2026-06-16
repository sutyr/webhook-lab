// Copyright 2026 Sutyr Inc. SPDX-License-Identifier: Apache-2.0
'use client';

import { useState } from 'react';
import { Plus, X, ChevronDown, ChevronRight } from 'lucide-react';
import { useLabState, useLabDispatch } from '@/lib/lab-context';

const MAX_PAIRS = 10;

export function MetadataBuilder() {
  const { eventOptions, isEditingPayload } = useLabState();
  const dispatch = useLabDispatch();
  const [open, setOpen] = useState(false);

  if (isEditingPayload) return null;

  const metadata = (eventOptions.metadata ?? {}) as Record<string, string>;
  const pairs = Object.entries(metadata);

  function updateMetadata(newMetadata: Record<string, string>) {
    dispatch({ type: 'SET_EVENT_OPTIONS', options: { metadata: newMetadata } });
  }

  function addPair() {
    if (pairs.length >= MAX_PAIRS) return;
    const key = `key${pairs.length + 1}`;
    updateMetadata({ ...metadata, [key]: '' });
  }

  function updateKey(oldKey: string, newKey: string, index: number) {
    const entries = Object.entries(metadata);
    const newEntries = entries.map(([k, v], i) =>
      i === index ? [newKey, v] as [string, string] : [k, v] as [string, string],
    );
    updateMetadata(Object.fromEntries(newEntries));
  }

  function updateValue(key: string, newValue: string, index: number) {
    const entries = Object.entries(metadata);
    const newEntries = entries.map(([k, v], i) =>
      i === index ? [k, newValue] as [string, string] : [k, v] as [string, string],
    );
    updateMetadata(Object.fromEntries(newEntries));
  }

  function removePair(index: number) {
    const entries = Object.entries(metadata);
    updateMetadata(Object.fromEntries(entries.filter((_, i) => i !== index)));
  }

  const inputClasses =
    'bg-surface-input border border-border rounded-input px-2 py-1.5 text-[0.75rem] text-text-primary w-full input-copper-focus';

  return (
    <div className="border-t border-border pt-3">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center gap-2 font-sans text-[0.75rem] text-text-muted transition-colors hover:text-text-secondary"
      >
        {open ? (
          <ChevronDown size={14} className="flex-shrink-0" />
        ) : (
          <ChevronRight size={14} className="flex-shrink-0" />
        )}
        <span>Metadata</span>
        {!open && pairs.length > 0 && (
          <span className="font-mono text-[0.69rem] text-text-muted">
            ({pairs.length} {pairs.length === 1 ? 'field' : 'fields'})
          </span>
        )}
        {!open && pairs.length === 0 && (
          <span className="font-mono text-[0.69rem] text-text-muted">
            (none)
          </span>
        )}
      </button>

      {open && (
        <div className="mt-2 space-y-2 animate-fade-in">
          {pairs.map(([key, value], i) => (
            <div key={i} className="flex items-center gap-2">
              <input
                type="text"
                value={key}
                onChange={(e) => updateKey(key, e.target.value, i)}
                placeholder="key"
                className={`${inputClasses} font-sans flex-1`}
              />
              <input
                type="text"
                value={value}
                onChange={(e) => updateValue(key, e.target.value, i)}
                placeholder="value"
                className={`${inputClasses} font-mono flex-1`}
              />
              <button
                type="button"
                onClick={() => removePair(i)}
                className="flex-shrink-0 rounded-badge p-1 text-text-muted transition-colors hover:bg-surface-hover hover:text-state-error"
                aria-label="Remove metadata field"
              >
                <X size={14} />
              </button>
            </div>
          ))}
          {pairs.length < MAX_PAIRS && (
            <button
              type="button"
              onClick={addPair}
              className="flex items-center gap-1.5 font-sans text-[0.69rem] text-text-muted transition-colors hover:text-text-secondary"
            >
              <Plus size={12} />
              Add metadata field
            </button>
          )}
        </div>
      )}
    </div>
  );
}
