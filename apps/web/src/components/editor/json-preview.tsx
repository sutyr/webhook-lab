// Copyright 2026 Sutyr Inc. SPDX-License-Identifier: Apache-2.0
'use client';

import { useEffect, useRef, useState, type JSX } from 'react';
import { Pencil, RotateCcw } from 'lucide-react';
import { useLabState, useLabDispatch } from '@/lib/lab-context';
import { previewEvent } from '@/lib/fire-event';
import { CopyButton } from '@/components/ui/copy-button';

const COLLAPSED_LINES = 10;

function syntaxHighlight(json: string, startLine = 1): JSX.Element[] {
  const lines = json.split('\n');
  return lines.map((line, i) => {
    const tokens: JSX.Element[] = [];
    let remaining = line;
    let tokenIndex = 0;

    while (remaining.length > 0) {
      const wsMatch = remaining.match(/^(\s+)/);
      if (wsMatch) {
        tokens.push(<span key={`${i}-${tokenIndex++}`}>{wsMatch[1]}</span>);
        remaining = remaining.slice(wsMatch[1].length);
        continue;
      }

      const keyMatch = remaining.match(/^("(?:[^"\\]|\\.)*")(\s*:)/);
      if (keyMatch) {
        tokens.push(
          <span key={`${i}-${tokenIndex++}`} className="text-text-tertiary">
            {keyMatch[1]}
          </span>,
        );
        tokens.push(<span key={`${i}-${tokenIndex++}`}>{keyMatch[2]}</span>);
        remaining = remaining.slice(keyMatch[0].length);
        continue;
      }

      const nullMatch = remaining.match(/^(null)/);
      if (nullMatch) {
        tokens.push(
          <span key={`${i}-${tokenIndex++}`} className="text-text-muted">
            {nullMatch[1]}
          </span>,
        );
        remaining = remaining.slice(nullMatch[1].length);
        continue;
      }

      const boolMatch = remaining.match(/^(true|false)/);
      if (boolMatch) {
        tokens.push(
          <span key={`${i}-${tokenIndex++}`} className="text-text-secondary">
            {boolMatch[1]}
          </span>,
        );
        remaining = remaining.slice(boolMatch[1].length);
        continue;
      }

      const numMatch = remaining.match(/^(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)/);
      if (numMatch) {
        tokens.push(
          <span key={`${i}-${tokenIndex++}`} className="text-text-secondary">
            {numMatch[1]}
          </span>,
        );
        remaining = remaining.slice(numMatch[1].length);
        continue;
      }

      const strMatch = remaining.match(/^("(?:[^"\\]|\\.)*")/);
      if (strMatch) {
        tokens.push(
          <span key={`${i}-${tokenIndex++}`} className="text-text-secondary">
            {strMatch[1]}
          </span>,
        );
        remaining = remaining.slice(strMatch[1].length);
        continue;
      }

      tokens.push(
        <span key={`${i}-${tokenIndex++}`} className="text-text-muted">
          {remaining[0]}
        </span>,
      );
      remaining = remaining.slice(1);
    }

    return (
      <div key={i} className="flex leading-5">
        <span
          className="inline-block w-8 flex-shrink-0 select-none pr-3 text-right font-mono text-[0.69rem] text-text-muted"
          aria-hidden="true"
        >
          {startLine + i}
        </span>
        <span className="flex-1 whitespace-pre">{tokens}</span>
      </div>
    );
  });
}

export function JsonPreview() {
  const { selectedEventType, eventOptions, isEditingPayload, editedPayload } =
    useLabState();
  const dispatch = useLabDispatch();
  const [json, setJson] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(false);
  const previousJsonRef = useRef<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (json) previousJsonRef.current = json;

    setLoading(true);
    setExpanded(false);

    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }

    timerRef.current = setTimeout(async () => {
      try {
        const payload = await previewEvent({
          eventType: selectedEventType,
          eventOptions,
        });
        setJson(JSON.stringify(payload, null, 2));
      } catch {
        setJson(null);
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [selectedEventType, eventOptions]);

  // Fix 2: Auto-populate editedPayload on entering edit mode
  useEffect(() => {
    if (isEditingPayload && editedPayload === null && json) {
      dispatch({ type: 'SET_EDIT_PAYLOAD', json });
    }
  }, [isEditingPayload, editedPayload, json, dispatch]);

  // Fix 3: Debounced JSON validation (visual only — Fire button uses immediate check)
  const [parseError, setParseError] = useState(false);
  const editValue = editedPayload ?? json ?? '';
  useEffect(() => {
    if (!isEditingPayload || !editValue) { setParseError(false); return; }
    const timer = setTimeout(() => {
      try { JSON.parse(editValue); setParseError(false); }
      catch { setParseError(true); }
    }, 300);
    return () => clearTimeout(timer);
  }, [isEditingPayload, editValue]);

  // Edit mode: textarea with line numbers
  if (isEditingPayload && json) {
    const editLines = editValue.split('\n');

    return (
      <div className="rounded-card bg-surface-input p-3 animate-fade-in">
        <div className="mb-2 flex items-center justify-between">
          <span className="font-sans text-[0.69rem] text-text-muted">Editing payload</span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => dispatch({ type: 'RESET_EDIT_PAYLOAD' })}
              className="rounded-badge p-1 text-text-muted transition-colors hover:bg-surface-hover hover:text-text-secondary"
              aria-label="Reset to generated payload"
            >
              <RotateCcw size={13} strokeWidth={1.75} />
            </button>
            <CopyButton text={editValue} />
          </div>
        </div>
        <div className="flex">
          <div
            className="flex-shrink-0 select-none pr-3 text-right font-mono text-[0.69rem] leading-5 text-text-muted"
            aria-hidden="true"
          >
            {editLines.map((_, i) => (
              <div key={i}>{i + 1}</div>
            ))}
          </div>
          <textarea
            value={editValue}
            onChange={(e) =>
              dispatch({ type: 'SET_EDIT_PAYLOAD', json: e.target.value })
            }
            className="min-h-[200px] flex-1 resize-y bg-transparent font-mono text-[0.75rem] leading-5 text-text-primary outline-none"
            spellCheck={false}
            style={{ tabSize: 2 }}
          />
        </div>
        {parseError && (
          <p className="mt-2 font-sans text-[0.69rem] text-state-error">
            Invalid JSON — fix syntax to fire
          </p>
        )}
      </div>
    );
  }

  // Shimmer state: loading + have previous JSON to show dimmed
  if (loading && showPreview && previousJsonRef.current) {
    const prevLines = previousJsonRef.current.split('\n');
    const displayPrev = expanded
      ? previousJsonRef.current
      : prevLines.slice(0, COLLAPSED_LINES).join('\n');

    return (
      <div className="relative rounded-card bg-surface-input p-3">
        <div className="absolute left-0 right-0 top-0 h-1 shimmer-line rounded-full" />
        <div className="pointer-events-none opacity-40">
          <div className="overflow-x-auto pr-8 font-mono text-[0.75rem]">
            {syntaxHighlight(displayPrev)}
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <p className="font-mono text-[0.75rem] text-text-muted">Generating payload...</p>
    );
  }

  if (!json) return null;

  const lines = json.split('\n');

  // Fully collapsed — just a toggle link
  if (!showPreview) {
    return (
      <button
        type="button"
        onClick={() => setShowPreview(true)}
        className="font-sans text-[0.75rem] text-text-secondary hover:underline"
      >
        Show payload ({lines.length} lines)
      </button>
    );
  }

  const needsCollapse = lines.length > COLLAPSED_LINES;

  return (
    <div className="relative rounded-card bg-surface-input p-3 animate-fade-in">
      <div className="absolute right-2 top-2 flex items-center gap-1">
        {editedPayload && (
          <span className="font-mono text-[0.56rem] text-copper">edited</span>
        )}
        <button
          type="button"
          onClick={() => dispatch({ type: 'TOGGLE_EDIT_MODE' })}
          className="rounded-badge p-1 text-text-muted transition-colors hover:bg-surface-hover hover:text-text-secondary"
          aria-label="Edit payload"
        >
          <Pencil size={13} strokeWidth={1.75} />
        </button>
        <CopyButton text={editedPayload ?? json} />
      </div>

      {/* Always show first COLLAPSED_LINES */}
      <div className="overflow-x-auto pr-16 font-mono text-[0.75rem]">
        {syntaxHighlight(lines.slice(0, COLLAPSED_LINES).join('\n'))}
      </div>

      {/* Expandable overflow section */}
      {needsCollapse && (
        <div
          className="grid transition-[grid-template-rows] duration-[250ms] ease-out"
          style={{ gridTemplateRows: expanded ? '1fr' : '0fr' }}
        >
          <div className="overflow-hidden">
            <div className="overflow-x-auto pr-16 font-mono text-[0.75rem]">
              {syntaxHighlight(
                lines.slice(COLLAPSED_LINES).join('\n'),
                COLLAPSED_LINES + 1,
              )}
            </div>
          </div>
        </div>
      )}

      <div className="mt-2 flex gap-3">
        {needsCollapse && (
          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            className="font-sans text-[0.75rem] text-text-secondary hover:underline"
          >
            {expanded ? 'Collapse' : `Show full payload (${lines.length} lines)`}
          </button>
        )}
        <button
          type="button"
          onClick={() => setShowPreview(false)}
          className="font-sans text-[0.75rem] text-text-muted hover:text-text-secondary hover:underline"
        >
          Hide
        </button>
      </div>
    </div>
  );
}
