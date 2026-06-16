// Copyright 2026 Sutyr Inc. SPDX-License-Identifier: Apache-2.0

import { describe, it, expect } from 'vitest';
import { labReducer } from '@/lib/lab-context';
import type { LabState, LabAction, FireResponse, ResponseHistoryEntry } from '@/lib/lab-context';

const defaultState: LabState = {
  mode: 'event',
  activeTab: 'events',
  mobileView: 'editor',
  drillCategory: null,
  searchQuery: '',
  selectedEventType: 'payment_intent.succeeded',
  selectedScenarioId: null,
  eventOptions: {},
  targetUrl: '',
  signingSecret: 'whsec_test_secret',
  payload: null,
  isEditingPayload: false,
  editedPayload: null,
  response: null,
  responseHistory: [],
  testedEventTypes: new Set<string>(),
  scenarioResults: [],
  scenarioSteps: [],
  isLoading: false,
  error: null,
};

const mockResponse: FireResponse = {
  statusCode: 200,
  responseBody: '{"received":true}',
  responseTimeMs: 42,
  signatureHeader: 't=123,v1=abc',
  requestId: 'req-123',
};

const mockPayload = { id: 'evt_test', type: 'payment_intent.succeeded' };

describe('labReducer', () => {
  it('initial state has correct defaults', () => {
    expect(defaultState.mode).toBe('event');
    expect(defaultState.activeTab).toBe('events');
    expect(defaultState.isLoading).toBe(false);
    expect(defaultState.isEditingPayload).toBe(false);
    expect(defaultState.responseHistory).toHaveLength(0);
  });

  // ─── Navigation ──────────────────────────────────────────────────────────

  it('SET_TAB switches activeTab', () => {
    const state = labReducer(defaultState, { type: 'SET_TAB', tab: 'scenarios' });
    expect(state.activeTab).toBe('scenarios');
  });

  it('DRILL_INTO_CATEGORY sets drillCategory', () => {
    const state = labReducer(defaultState, { type: 'DRILL_INTO_CATEGORY', id: 'billing' });
    expect(state.drillCategory).toBe('billing');
  });

  it('DRILL_OUT clears drillCategory', () => {
    const drilled = { ...defaultState, drillCategory: 'billing' };
    const state = labReducer(drilled, { type: 'DRILL_OUT' });
    expect(state.drillCategory).toBeNull();
  });

  // ─── Event selection ─────────────────────────────────────────────────────

  it('SELECT_EVENT sets selectedEventType and derives drillCategory', () => {
    const state = labReducer(defaultState, { type: 'SELECT_EVENT', eventType: 'invoice.paid' });
    expect(state.selectedEventType).toBe('invoice.paid');
    expect(state.drillCategory).toBe('billing');
    expect(state.mode).toBe('event');
    expect(state.activeTab).toBe('events');
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

  it('RESTORE_FROM_HISTORY sets eventType, eventOptions, targetUrl, drillCategory', () => {
    const entry: ResponseHistoryEntry = {
      eventType: 'invoice.payment_failed',
      response: mockResponse,
      payload: mockPayload,
      eventOptions: { amount: 4999, currency: 'eur', declineCode: 'insufficient_funds' },
      timestamp: 1700000000,
      targetUrl: 'https://staging.example.com/hook',
      configSummary: '€49.99 · insufficient_funds',
    };
    const state = labReducer(defaultState, { type: 'RESTORE_FROM_HISTORY', entry });
    expect(state.selectedEventType).toBe('invoice.payment_failed');
    expect(state.eventOptions).toEqual({ amount: 4999, currency: 'eur', declineCode: 'insufficient_funds' });
    expect(state.targetUrl).toBe('https://staging.example.com/hook');
    expect(state.drillCategory).toBe('billing');
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
});
