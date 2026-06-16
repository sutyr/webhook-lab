// Copyright 2026 Sutyr Inc. SPDX-License-Identifier: Apache-2.0
'use client';

import { useState } from 'react';
import { useLabState, useLabDispatch } from '@/lib/lab-context';
import { getFieldsForEvent } from '@/lib/event-fields-map';
import type { FieldDef } from '@/lib/event-fields-map';
import { cn } from '@/lib/cn';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { formatAmount } from '@/lib/format-amount';
import { MetadataBuilder } from '@/components/editor/metadata-builder';

function FieldInput({ field, value, onChange, id, currency }: {
  field: FieldDef;
  value: unknown;
  onChange: (value: unknown) => void;
  id: string;
  currency?: string;
}) {
  const inputClasses = cn(
    'bg-surface-input border border-border rounded-input px-3 py-2 text-[0.81rem] text-text-primary w-full',
    'input-copper-focus',
    field.mono && 'font-mono',
    !field.mono && 'font-sans',
  );

  if (field.type === 'select' && field.options) {
    return (
      <div className="relative">
        <select
          id={id}
          value={String(value ?? field.defaultValue)}
          onChange={(e) => {
            const v = e.target.value;
            onChange(field.coerceBoolean ? v === 'true' : v);
          }}
          className={cn(inputClasses, 'appearance-none pr-8')}
        >
          {field.options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
      </div>
    );
  }

  if (field.type === 'number') {
    const displayValue = value !== undefined && value !== '' ? value : field.defaultValue;
    const isAmount = field.key === 'amount' || field.key === 'priceAmount';
    const amountHint = isAmount
      ? formatAmount(displayValue, currency ?? 'usd')
      : null;

    const AMOUNT_PRESETS = [
      { label: '$0', cents: 0 },
      { label: '$9.99', cents: 999 },
      { label: '$29.99', cents: 2999 },
      { label: '$49.99', cents: 4999 },
      { label: '$99.99', cents: 9999 },
      { label: '$999.99', cents: 99999 },
    ];

    return (
      <div>
        <input
          id={id}
          type="number"
          min="0"
          step="1"
          value={value !== undefined && value !== '' ? String(value) : ''}
          placeholder={String(field.defaultValue)}
          onChange={(e) => {
            const raw = e.target.value;
            onChange(raw === '' ? '' : Number(raw));
          }}
          className={cn(inputClasses, 'font-mono [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none')}
        />
        {amountHint && (
          <p className="mt-1 font-mono text-[0.69rem] leading-[1.3] text-text-tertiary">
            {amountHint}
          </p>
        )}
        {isAmount && (
          <div className="mt-1.5 flex flex-wrap gap-1">
            {AMOUNT_PRESETS.map((preset) => (
              <button
                key={preset.cents}
                type="button"
                onClick={() => onChange(preset.cents)}
                className={cn(
                  'rounded-badge border px-2 py-0.5 font-mono text-[0.625rem] transition-colors duration-150',
                  Number(displayValue) === preset.cents
                    ? 'border-copper bg-copper/10 text-copper'
                    : 'border-border bg-surface-input text-text-muted hover:border-border-medium hover:text-text-tertiary'
                )}
              >
                {preset.label}
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div>
      <input
        id={id}
        type="text"
        value={String(value !== undefined && value !== '' ? value : (field.defaultValue ?? ''))}
        placeholder={field.placeholder ?? String(field.defaultValue ?? '')}
        onChange={(e) => onChange(e.target.value)}
        className={inputClasses}
      />
      {field.description && (
        <p className="mt-1 font-sans text-[0.62rem] leading-[1.3] text-text-muted">
          {field.description}
        </p>
      )}
    </div>
  );
}

export function EventFields() {
  const { selectedEventType, eventOptions, isEditingPayload } = useLabState();
  const dispatch = useLabDispatch();
  const fields = getFieldsForEvent(selectedEventType);
  const [entityIdsOpen, setEntityIdsOpen] = useState(false);
  const [eventOptionsOpen, setEventOptionsOpen] = useState(false);

  if (fields.length === 0) return null;

  if (isEditingPayload) {
    return (
      <div className="rounded-card bg-copper-glass px-3 py-2">
        <p className="font-sans text-[0.75rem] text-text-tertiary">
          Form fields paused — editing payload directly
        </p>
      </div>
    );
  }

  function handleChange(key: string, value: unknown) {
    dispatch({ type: 'SET_EVENT_OPTIONS', options: { [key]: value } });
  }

  const currency = String(eventOptions.currency ?? 'usd');

  const coreFields = fields.filter((f) => !f.section || f.section === 'core');
  const entityIdFields = fields.filter((f) => f.section === 'entity-ids');
  const eventOptionFields = fields.filter((f) => f.section === 'event-options');

  return (
    <div className="space-y-3">
      {/* Core fields — always visible */}
      {coreFields.map((field) => {
        const fieldId = `field-${field.key}`;
        return (
          <div key={field.key}>
            <label htmlFor={fieldId} className="mb-1 block font-sans text-[0.75rem] text-text-secondary">
              {field.label}
            </label>
            <FieldInput
              id={fieldId}
              field={field}
              value={eventOptions[field.key] ?? field.defaultValue}
              onChange={(v) => handleChange(field.key, v)}
              currency={(field.key === 'amount' || field.key === 'priceAmount') ? currency : undefined}
            />
          </div>
        );
      })}

      {/* Entity ID fields — collapsible section */}
      {entityIdFields.length > 0 && (
        <div className="border-t border-border pt-3">
          <button
            type="button"
            onClick={() => setEntityIdsOpen(!entityIdsOpen)}
            className="flex w-full items-center gap-2 font-sans text-[0.75rem] text-text-muted transition-colors hover:text-text-secondary"
          >
            {entityIdsOpen ? (
              <ChevronDown size={14} className="flex-shrink-0" />
            ) : (
              <ChevronRight size={14} className="flex-shrink-0" />
            )}
            <span>Entity IDs</span>
            {!entityIdsOpen && (
              <span className="font-mono text-[0.69rem] text-text-muted">
                (auto-generated)
              </span>
            )}
          </button>

          {entityIdsOpen && (
            <div className="mt-2 space-y-2.5 animate-fade-in">
              <p className="font-sans text-[0.69rem] text-text-muted">
                Leave empty for auto-generated IDs. Set to match your staging data.
              </p>
              {entityIdFields.map((field) => {
                const fieldId = `field-${field.key}`;
                return (
                  <div key={field.key}>
                    <label htmlFor={fieldId} className="mb-1 block font-sans text-[0.69rem] text-text-muted">
                      {field.label}
                    </label>
                    <FieldInput
                      id={fieldId}
                      field={field}
                      value={eventOptions[field.key] ?? ''}
                      onChange={(v) => handleChange(field.key, v)}
                    />
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Metadata key-value builder — collapsible */}
      <MetadataBuilder />

      {/* Event Options — livemode, API version */}
      {eventOptionFields.length > 0 && (
        <div className="border-t border-border pt-3">
          <button
            type="button"
            onClick={() => setEventOptionsOpen(!eventOptionsOpen)}
            className="flex w-full items-center gap-2 font-sans text-[0.75rem] text-text-muted transition-colors hover:text-text-secondary"
          >
            {eventOptionsOpen ? (
              <ChevronDown size={14} className="flex-shrink-0" />
            ) : (
              <ChevronRight size={14} className="flex-shrink-0" />
            )}
            <span>Event Options</span>
            {!eventOptionsOpen && (
              <span className="font-mono text-[0.69rem] text-text-muted">
                (defaults)
              </span>
            )}
          </button>

          {eventOptionsOpen && (
            <div className="mt-2 space-y-2.5 animate-fade-in">
              {eventOptionFields.map((field) => {
                const fieldId = `field-${field.key}`;
                return (
                  <div key={field.key}>
                    <label htmlFor={fieldId} className="mb-1 block font-sans text-[0.69rem] text-text-muted">
                      {field.label}
                    </label>
                    <FieldInput
                      id={fieldId}
                      field={field}
                      value={eventOptions[field.key] ?? field.defaultValue}
                      onChange={(v) => handleChange(field.key, v)}
                    />
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
