// Copyright 2026 Sutyr Inc. SPDX-License-Identifier: Apache-2.0
'use client';

import { useLabState, useLabDispatch } from '@/lib/lab-context';
import { fireEvent, firePrepared } from '@/lib/fire-event';
import { cliFireCommand } from '@/lib/cli-command';
import { TargetFields } from './target-fields';
import { PrimaryActionButton, useOutcomeFlash, useRunShortcut } from './primary-action-button';

export function FireControls() {
  const {
    targetUrl, signingSecret, selectedEventType, eventOptions,
    isLoading, response, isEditingPayload, editedPayload,
  } = useLabState();
  const dispatch = useLabDispatch();

  const flash = useOutcomeFlash(
    response,
    (r) => r.statusCode >= 200 && r.statusCode < 300,
  );

  // Check if edited JSON is valid
  const editJsonValid = (() => {
    if (!isEditingPayload || !editedPayload) return true;
    try { JSON.parse(editedPayload); return true; } catch { return false; }
  })();

  function doFire() {
    if (!targetUrl || isLoading) return;
    if (isEditingPayload && !editJsonValid) return;

    dispatch({ type: 'FIRE_START' });

    if (isEditingPayload && editedPayload) {
      let parsed: object;
      try {
        parsed = JSON.parse(editedPayload);
      } catch {
        dispatch({ type: 'FIRE_ERROR', error: 'Invalid JSON in edited payload' });
        return;
      }
      firePrepared({ payload: parsed, targetUrl, signingSecret })
        .then((resp) => {
          dispatch({ type: 'FIRE_SUCCESS', response: resp, payload: parsed });
        })
        .catch((err: unknown) => {
          dispatch({
            type: 'FIRE_ERROR',
            error: err instanceof Error ? err.message : 'Unknown error',
          });
        });
    } else {
      fireEvent({ eventType: selectedEventType, eventOptions, targetUrl, signingSecret })
        .then((result) => {
          const { payload, ...resp } = result;
          dispatch({ type: 'FIRE_SUCCESS', response: resp, payload });
        })
        .catch((err: unknown) => {
          dispatch({
            type: 'FIRE_ERROR',
            error: err instanceof Error ? err.message : 'Unknown error',
          });
        });
    }
  }

  useRunShortcut(doFire);

  return (
    <div className="space-y-3">
      <TargetFields
        idPrefix="fire"
        cliCommand={(url) => cliFireCommand(selectedEventType, url, eventOptions)}
      />
      <PrimaryActionButton
        label="Fire event"
        busyLabel="Firing"
        busy={isLoading}
        disabled={!targetUrl || (isEditingPayload && !editJsonValid)}
        onRun={doFire}
        flash={flash}
      />
    </div>
  );
}
