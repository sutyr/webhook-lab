// Copyright 2026 Sutyr Inc. SPDX-License-Identifier: Apache-2.0

import { describe, it, expect } from 'vitest';
import { defaultLabState, labReducer } from '@/lib/lab-context';
import type { LabState, FireResponse, ResponseHistoryEntry, SuiteRunResult } from '@/lib/lab-context';

const defaultState: LabState = { ...defaultLabState, testedEventTypes: new Set<string>() };

const mockResponse: FireResponse = {
  statusCode: 200,
  responseBody: '{"received":true}',
  responseTimeMs: 42,
  signatureHeader: 't=123,v1=abc',
  requestId: 'req-123',
};

const mockPayload = { id: 'evt_test', type: 'payment_intent.succeeded' };

const mockReport: SuiteRunResult = {
  target: 'https://example.com/hook',
  apiVersion: '2026-09-30.endive',
  results: [
    {
      id: 'valid-event-accepted',
      title: 'Accepts a correctly signed event',
      status: 'pass',
      expected: '2xx',
      observed: '200 in 12 ms',
      why: 'why',
      durationMs: 12,
      deliveries: [],
    },
  ],
  summary: { pass: 1, fail: 0, warn: 0, error: 0 },
  requestId: 'run-123',
};

describe('labReducer', () => {
  it('a visitor with no URL state starts on the suite', () => {
    expect(defaultLabState.mode).toBe('suite');
    expect(defaultLabState.activeTab).toBe('suite');
    expect(defaultLabState.isLoading).toBe(false);
    expect(defaultLabState.isEditingPayload).toBe(false);
    expect(defaultLabState.responseHistory).toHaveLength(0);
    expect(defaultLabState.suiteReport).toBeNull();
    expect(defaultLabState.suiteRunning).toBe(false);
  });

  it('the default selected event has its group open', () => {
    expect(defaultLabState.selectedEventType).toBe('payment_intent.succeeded');
    expect(defaultLabState.openGroups).toEqual(['payments']);
  });

  // ─── Navigation ──────────────────────────────────────────────────────────

  it('SET_TAB scenarios switches activeTab but keeps the panels until a pick', () => {
    const inEvent = { ...defaultState, mode: 'event' as const, activeTab: 'events' as const };
    const state = labReducer(inEvent, { type: 'SET_TAB', tab: 'scenarios' });
    expect(state.activeTab).toBe('scenarios');
    expect(state.mode).toBe('event');
  });

  it('SET_TAB events keeps the suite on screen until an event is picked', () => {
    const state = labReducer(defaultState, { type: 'SET_TAB', tab: 'events' });
    expect(state.activeTab).toBe('events');
    expect(state.mode).toBe('suite');
  });

  it('SET_TAB suite opens suite mode, since the tab has nothing to pick', () => {
    const inScenario = {
      ...defaultState,
      mode: 'scenario' as const,
      activeTab: 'scenarios' as const,
      selectedScenarioId: 'checkout-flow',
    };
    const state = labReducer(inScenario, { type: 'SET_TAB', tab: 'suite' });
    expect(state.mode).toBe('suite');
    expect(state.activeTab).toBe('suite');
    // The scenario stays selected for when the user goes back.
    expect(state.selectedScenarioId).toBe('checkout-flow');
  });

  it('TOGGLE_GROUP opens a closed group and closes an open one', () => {
    const opened = labReducer(defaultState, { type: 'TOGGLE_GROUP', category: 'billing' });
    expect(opened.openGroups).toEqual(['payments', 'billing']);
    const closed = labReducer(opened, { type: 'TOGGLE_GROUP', category: 'payments' });
    expect(closed.openGroups).toEqual(['billing']);
  });

  it('SET_GROUP_OPEN opens and closes, and is a no-op when already there', () => {
    const opened = labReducer(defaultState, { type: 'SET_GROUP_OPEN', category: 'disputes', open: true });
    expect(opened.openGroups).toEqual(['payments', 'disputes']);
    expect(labReducer(opened, { type: 'SET_GROUP_OPEN', category: 'disputes', open: true })).toBe(opened);
    const closed = labReducer(opened, { type: 'SET_GROUP_OPEN', category: 'payments', open: false });
    expect(closed.openGroups).toEqual(['disputes']);
    expect(labReducer(closed, { type: 'SET_GROUP_OPEN', category: 'payments', open: false })).toBe(closed);
  });

  // ─── Event selection ─────────────────────────────────────────────────────

  it('SELECT_EVENT sets selectedEventType, event mode and the Events tab', () => {
    const state = labReducer(defaultState, { type: 'SELECT_EVENT', eventType: 'invoice.paid' });
    expect(state.selectedEventType).toBe('invoice.paid');
    expect(state.mode).toBe('event');
    expect(state.activeTab).toBe('events');
  });

  it('SELECT_EVENT opens the group that holds the event and keeps the others', () => {
    const state = labReducer(defaultState, { type: 'SELECT_EVENT', eventType: 'invoice.paid' });
    expect(state.openGroups).toEqual(['payments', 'billing']);
  });

  it('SELECT_EVENT does not duplicate a group that is already open', () => {
    const state = labReducer(defaultState, { type: 'SELECT_EVENT', eventType: 'charge.failed' });
    expect(state.openGroups).toEqual(['payments']);
  });

  it('SELECT_EVENT opens the new payment_methods group for its events', () => {
    const state = labReducer(
      { ...defaultState, openGroups: [] },
      { type: 'SELECT_EVENT', eventType: 'payment_method.automatically_updated' },
    );
    expect(state.openGroups).toEqual(['payment_methods']);
  });

  it('SELECT_EVENT leaves the suite report in place for when the user returns', () => {
    const withReport = { ...defaultState, suiteReport: mockReport };
    const state = labReducer(withReport, { type: 'SELECT_EVENT', eventType: 'invoice.paid' });
    expect(state.suiteReport).toBe(mockReport);
  });

  it('SELECT_EVENT resets eventOptions, payload, response, and edit state', () => {
    const dirty = {
      ...defaultState,
      eventOptions: { amount: 5000 },
      payload: { id: 'old' },
      response: mockResponse,
      isEditingPayload: true,
      editedPayload: '{}',
      error: 'old error',
    };
    const state = labReducer(dirty, { type: 'SELECT_EVENT', eventType: 'charge.succeeded' });
    expect(state.eventOptions).toEqual({});
    expect(state.payload).toBeNull();
    expect(state.response).toBeNull();
    expect(state.isEditingPayload).toBe(false);
    expect(state.editedPayload).toBeNull();
    expect(state.error).toBeNull();
  });

  it('SET_MOBILE_VIEW switches the mobile surface', () => {
    const state = labReducer(defaultState, { type: 'SET_MOBILE_VIEW', view: 'response' });
    expect(state.mobileView).toBe('response');
  });

  it('FIRE_START switches mobileView to response (result lands in view on mobile)', () => {
    const onEditor = { ...defaultState, mobileView: 'editor' as const };
    const state = labReducer(onEditor, { type: 'FIRE_START' });
    expect(state.isLoading).toBe(true);
    expect(state.mobileView).toBe('response');
  });

  it('SELECT_EVENT returns mobileView to editor', () => {
    const onResponse = { ...defaultState, mobileView: 'response' as const };
    const state = labReducer(onResponse, { type: 'SELECT_EVENT', eventType: 'invoice.paid' });
    expect(state.mobileView).toBe('editor');
  });

  it('SELECT_SCENARIO sets scenarioId and mode', () => {
    const state = labReducer(defaultState, { type: 'SELECT_SCENARIO', scenarioId: 'checkout-flow' });
    expect(state.selectedScenarioId).toBe('checkout-flow');
    expect(state.mode).toBe('scenario');
    expect(state.activeTab).toBe('scenarios');
  });

  // ─── Event options ───────────────────────────────────────────────────────

  it('SET_EVENT_OPTIONS merges into existing options (not replaces)', () => {
    const withAmount = labReducer(defaultState, { type: 'SET_EVENT_OPTIONS', options: { amount: 5000 } });
    const withBoth = labReducer(withAmount, { type: 'SET_EVENT_OPTIONS', options: { currency: 'eur' } });
    expect(withBoth.eventOptions).toEqual({ amount: 5000, currency: 'eur' });
  });

  it('SET_TARGET_URL updates targetUrl', () => {
    const state = labReducer(defaultState, { type: 'SET_TARGET_URL', url: 'https://example.com/hook' });
    expect(state.targetUrl).toBe('https://example.com/hook');
  });

  it('SET_SIGNING_SECRET updates signingSecret', () => {
    const state = labReducer(defaultState, { type: 'SET_SIGNING_SECRET', secret: 'whsec_new' });
    expect(state.signingSecret).toBe('whsec_new');
  });

  // ─── Edit mode ───────────────────────────────────────────────────────────

  it('TOGGLE_EDIT_MODE flips isEditingPayload on', () => {
    const state = labReducer(defaultState, { type: 'TOGGLE_EDIT_MODE' });
    expect(state.isEditingPayload).toBe(true);
  });

  it('TOGGLE_EDIT_MODE flips off and preserves editedPayload (Phase 1: edits persist)', () => {
    const editing = { ...defaultState, isEditingPayload: true, editedPayload: '{"test":true}' };
    const state = labReducer(editing, { type: 'TOGGLE_EDIT_MODE' });
    expect(state.isEditingPayload).toBe(false);
    // Phase 1 change: edits persist across toggle, only RESET_EDIT_PAYLOAD clears them
    expect(state.editedPayload).toBe('{"test":true}');
  });

  it('RESET_EDIT_PAYLOAD clears editedPayload and exits edit mode', () => {
    const editing = { ...defaultState, isEditingPayload: true, editedPayload: '{"test":true}' };
    const state = labReducer(editing, { type: 'RESET_EDIT_PAYLOAD' });
    expect(state.isEditingPayload).toBe(false);
    expect(state.editedPayload).toBeNull();
  });

  it('SET_EDIT_PAYLOAD updates editedPayload', () => {
    const state = labReducer(defaultState, { type: 'SET_EDIT_PAYLOAD', json: '{"id":"evt_1"}' });
    expect(state.editedPayload).toBe('{"id":"evt_1"}');
  });

  // ─── Fire lifecycle ──────────────────────────────────────────────────────

  it('FIRE_START sets isLoading true and clears error', () => {
    const withError = { ...defaultState, error: 'previous error' };
    const state = labReducer(withError, { type: 'FIRE_START' });
    expect(state.isLoading).toBe(true);
    expect(state.error).toBeNull();
  });

  it('FIRE_SUCCESS stores response, payload, history entry, and testedEventType', () => {
    const state = labReducer(
      { ...defaultState, isLoading: true, targetUrl: 'https://example.com' },
      { type: 'FIRE_SUCCESS', response: mockResponse, payload: mockPayload },
    );
    expect(state.isLoading).toBe(false);
    expect(state.response).toBe(mockResponse);
    expect(state.payload).toBe(mockPayload);
    expect(state.responseHistory).toHaveLength(1);
    expect(state.responseHistory[0].eventType).toBe('payment_intent.succeeded');
    expect(state.testedEventTypes.has('payment_intent.succeeded')).toBe(true);
  });

  it('FIRE_SUCCESS caps responseHistory at 20 entries (FIFO)', () => {
    let state = { ...defaultState, isLoading: true, targetUrl: 'https://example.com' };
    for (let i = 0; i < 25; i++) {
      state = labReducer(state, { type: 'FIRE_SUCCESS', response: mockResponse, payload: mockPayload });
      state = { ...state, isLoading: true }; // reset for next fire
    }
    expect(state.responseHistory.length).toBe(20);
  });

  it('FIRE_ERROR stores error and sets isLoading false', () => {
    const loading = { ...defaultState, isLoading: true };
    const state = labReducer(loading, { type: 'FIRE_ERROR', error: 'Network error' });
    expect(state.isLoading).toBe(false);
    expect(state.error).toBe('Network error');
  });

  // ─── Restore from history ────────────────────────────────────────────────

  it('RESTORE_FROM_HISTORY sets eventType, eventOptions, targetUrl and opens the group', () => {
    const entry: ResponseHistoryEntry = {
      eventType: 'invoice.payment_failed',
      response: mockResponse,
      payload: mockPayload,
      eventOptions: { amount: 4999, currency: 'eur', declineCode: 'insufficient_funds' },
      timestamp: 1700000000,
      targetUrl: 'https://staging.example.com/hook',
      configSummary: '€49.99, insufficient_funds',
    };
    const state = labReducer(defaultState, { type: 'RESTORE_FROM_HISTORY', entry });
    expect(state.selectedEventType).toBe('invoice.payment_failed');
    expect(state.eventOptions).toEqual({ amount: 4999, currency: 'eur', declineCode: 'insufficient_funds' });
    expect(state.targetUrl).toBe('https://staging.example.com/hook');
    expect(state.openGroups).toContain('billing');
    expect(state.mode).toBe('event');
    expect(state.activeTab).toBe('events');
  });

  it('RESTORE_FROM_HISTORY does NOT restore signingSecret', () => {
    const entry: ResponseHistoryEntry = {
      eventType: 'charge.succeeded',
      response: mockResponse,
      payload: mockPayload,
      eventOptions: {},
      timestamp: 1700000000,
      targetUrl: 'https://example.com',
      configSummary: '$29.99',
    };
    const withSecret = { ...defaultState, signingSecret: 'whsec_my_secret' };
    const state = labReducer(withSecret, { type: 'RESTORE_FROM_HISTORY', entry });
    expect(state.signingSecret).toBe('whsec_my_secret');
  });

  it('RESTORE_FROM_HISTORY sets isEditingPayload to false', () => {
    const entry: ResponseHistoryEntry = {
      eventType: 'charge.succeeded',
      response: mockResponse,
      payload: mockPayload,
      eventOptions: {},
      timestamp: 1700000000,
      targetUrl: 'https://example.com',
      configSummary: '',
    };
    const editing = { ...defaultState, isEditingPayload: true, editedPayload: '{}' };
    const state = labReducer(editing, { type: 'RESTORE_FROM_HISTORY', entry });
    expect(state.isEditingPayload).toBe(false);
  });

  // ─── Other actions ───────────────────────────────────────────────────────

  it('HYDRATE_TESTED_EVENTS sets testedEventTypes', () => {
    const tested = new Set(['charge.succeeded', 'invoice.paid']);
    const state = labReducer(defaultState, { type: 'HYDRATE_TESTED_EVENTS', eventTypes: tested });
    expect(state.testedEventTypes).toBe(tested);
    expect(state.testedEventTypes.size).toBe(2);
  });

  it('CLEAR_RESPONSE clears response, error, and scenarioResults', () => {
    const dirty = {
      ...defaultState,
      response: mockResponse,
      error: 'some error',
      scenarioResults: [{ stepIndex: 0, eventType: 'test', response: null, status: 'pending' as const }],
    };
    const state = labReducer(dirty, { type: 'CLEAR_RESPONSE' });
    expect(state.response).toBeNull();
    expect(state.error).toBeNull();
    expect(state.scenarioResults).toHaveLength(0);
  });

  it('SET_SEARCH_QUERY updates searchQuery', () => {
    const state = labReducer(defaultState, { type: 'SET_SEARCH_QUERY', query: 'inv' });
    expect(state.searchQuery).toBe('inv');
  });

  it('SET_SEARCH_QUERY with text shows the Events tab, where the matches are', () => {
    const state = labReducer(defaultState, { type: 'SET_SEARCH_QUERY', query: 'dispute' });
    expect(state.activeTab).toBe('events');
    // Searching browses; it does not change what the panels show.
    expect(state.mode).toBe('suite');
  });

  it('SET_SEARCH_QUERY with blank text keeps the current tab', () => {
    const state = labReducer(defaultState, { type: 'SET_SEARCH_QUERY', query: '  ' });
    expect(state.activeTab).toBe('suite');
  });

  // ─── Hydration ───────────────────────────────────────────────────────────

  it('HYDRATE restores saved values without leaving the suite', () => {
    const state = labReducer(defaultState, {
      type: 'HYDRATE',
      values: {
        targetUrl: 'https://staging.example.com/hook',
        signingSecret: 'whsec_saved',
        selectedEventType: 'charge.dispute.closed',
        openGroups: ['billing'],
      },
    });
    expect(state.mode).toBe('suite');
    expect(state.activeTab).toBe('suite');
    expect(state.targetUrl).toBe('https://staging.example.com/hook');
    expect(state.signingSecret).toBe('whsec_saved');
    expect(state.selectedEventType).toBe('charge.dispute.closed');
    // Saved open groups, plus the group of the restored event.
    expect(state.openGroups).toEqual(['billing', 'disputes']);
  });

  it('HYDRATE with nothing saved keeps the defaults', () => {
    const state = labReducer(defaultState, { type: 'HYDRATE', values: {} });
    expect(state.targetUrl).toBe('');
    expect(state.signingSecret).toBe('whsec_test_secret');
    expect(state.selectedEventType).toBe('payment_intent.succeeded');
    expect(state.openGroups).toEqual(['payments']);
  });

  it('HYDRATE always opens the selected event\'s group, even if it was saved closed', () => {
    const state = labReducer(defaultState, { type: 'HYDRATE', values: { openGroups: [] } });
    expect(state.openGroups).toEqual(['payments']);
  });

  // ─── Suite ───────────────────────────────────────────────────────────────

  it('SUITE_START marks the run, clears the last result and shows Results on mobile', () => {
    const before = {
      ...defaultState,
      suiteReport: mockReport,
      suiteError: 'old error',
      focusedCheck: 'responds-in-time' as const,
    };
    const state = labReducer(before, { type: 'SUITE_START', startedAt: 1_700_000_000_000 });
    expect(state.suiteRunning).toBe(true);
    expect(state.suiteStartedAt).toBe(1_700_000_000_000);
    expect(state.suiteReport).toBeNull();
    expect(state.suiteError).toBeNull();
    expect(state.focusedCheck).toBeNull();
    expect(state.mobileView).toBe('response');
  });

  it('SUITE_SUCCESS stores the report and ends the run', () => {
    const running = labReducer(defaultState, { type: 'SUITE_START', startedAt: 1 });
    const state = labReducer(running, { type: 'SUITE_SUCCESS', report: mockReport });
    expect(state.suiteRunning).toBe(false);
    expect(state.suiteStartedAt).toBeNull();
    expect(state.suiteReport).toBe(mockReport);
    expect(state.suiteError).toBeNull();
  });

  it('SUITE_ERROR stores the API message and ends the run', () => {
    const running = labReducer(defaultState, { type: 'SUITE_START', startedAt: 1 });
    const state = labReducer(running, { type: 'SUITE_ERROR', error: 'Blocked host: localhost' });
    expect(state.suiteRunning).toBe(false);
    expect(state.suiteError).toBe('Blocked host: localhost');
    expect(state.suiteReport).toBeNull();
  });

  it('suite runs leave the single-event state alone', () => {
    const withEvent = { ...defaultState, response: mockResponse, isLoading: false, error: null };
    const started = labReducer(withEvent, { type: 'SUITE_START', startedAt: 1 });
    const failed = labReducer(started, { type: 'SUITE_ERROR', error: 'Rate limit exceeded' });
    expect(failed.response).toBe(mockResponse);
    expect(failed.isLoading).toBe(false);
    expect(failed.error).toBeNull();
  });

  it('FOCUS_CHECK opens the suite on that check', () => {
    const inEvents = { ...defaultState, mode: 'event' as const, activeTab: 'events' as const };
    const state = labReducer(inEvents, { type: 'FOCUS_CHECK', id: 'stale-timestamp-rejected' });
    expect(state.mode).toBe('suite');
    expect(state.activeTab).toBe('suite');
    expect(state.focusedCheck).toBe('stale-timestamp-rejected');
  });

  it('FOCUS_CHECK bumps the nonce, so picking the same check again reveals it again', () => {
    const once = labReducer(defaultState, { type: 'FOCUS_CHECK', id: 'responds-in-time' });
    const twice = labReducer(once, { type: 'FOCUS_CHECK', id: 'responds-in-time' });
    expect(twice.focusNonce).toBe(once.focusNonce + 1);
  });

  it('FOCUS_CHECK shows the checklist on mobile before a run and the results after', () => {
    const before = labReducer(
      { ...defaultState, mobileView: 'response' },
      { type: 'FOCUS_CHECK', id: 'responds-in-time' },
    );
    expect(before.mobileView).toBe('editor');
    const after = labReducer(
      { ...defaultState, suiteReport: mockReport },
      { type: 'FOCUS_CHECK', id: 'responds-in-time' },
    );
    expect(after.mobileView).toBe('response');
  });
});
