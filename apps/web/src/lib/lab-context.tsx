// Copyright 2026 Sutyr Inc. SPDX-License-Identifier: Apache-2.0
'use client';

import { createContext, use, useEffect, useMemo, useReducer, type Dispatch, type ReactNode } from 'react';
import type { StripeEventType } from '@webhook-lab/events';
import { EVENT_CATALOG } from '@webhook-lab/events';
import { loadString, persistString } from '@/lib/local-storage';
import { parseUrlState, serializeToUrl } from '@/lib/url-state';
import { getFieldsForEvent } from '@/lib/event-fields-map';
import { extractOptionsFromJson } from '@/lib/json-to-options';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface FireResponse {
  statusCode: number;
  responseBody: string;
  responseTimeMs: number;
  signatureHeader: string;
  requestId?: string;
  truncated?: boolean;
}

export interface ResponseHistoryEntry {
  eventType: string;
  response: FireResponse;
  payload: object;
  eventOptions: Record<string, unknown>;
  timestamp: number;
  targetUrl: string;
  configSummary: string;
}

export interface ScenarioStepResult {
  stepIndex: number;
  eventType: string;
  response: FireResponse | null;
  status: 'pending' | 'firing' | 'done' | 'error';
}

export type SidebarTab = 'events' | 'scenarios';

export interface LabState {
  mode: 'event' | 'scenario';
  activeTab: SidebarTab;
  /** Which surface the mobile (<md) segmented control shows. Ignored at md+. */
  mobileView: 'editor' | 'response';
  drillCategory: string | null;
  searchQuery: string;
  selectedEventType: StripeEventType;
  selectedScenarioId: string | null;
  eventOptions: Record<string, unknown>;
  targetUrl: string;
  signingSecret: string;
  payload: object | null;
  isEditingPayload: boolean;
  editedPayload: string | null;
  response: FireResponse | null;
  responseHistory: ResponseHistoryEntry[];
  testedEventTypes: Set<string>;
  scenarioResults: ScenarioStepResult[];
  scenarioSteps: Array<{ event: object; delayMs: number; description: string }>;
  isLoading: boolean;
  error: string | null;
}

export type LabAction =
  | { type: 'SET_TAB'; tab: SidebarTab }
  | { type: 'SET_MOBILE_VIEW'; view: 'editor' | 'response' }
  | { type: 'DRILL_INTO_CATEGORY'; id: string }
  | { type: 'DRILL_OUT' }
  | { type: 'SET_SEARCH_QUERY'; query: string }
  | { type: 'SELECT_EVENT'; eventType: StripeEventType }
  | { type: 'SELECT_SCENARIO'; scenarioId: string }
  | { type: 'SET_EVENT_OPTIONS'; options: Record<string, unknown> }
  | { type: 'SET_TARGET_URL'; url: string }
  | { type: 'SET_SIGNING_SECRET'; secret: string }
  | { type: 'SET_PAYLOAD'; payload: object }
  | { type: 'FIRE_START' }
  | { type: 'FIRE_SUCCESS'; response: FireResponse; payload: object }
  | { type: 'FIRE_ERROR'; error: string }
  | {
      type: 'SET_SCENARIO_STEPS';
      steps: Array<{ event: object; delayMs: number; description: string }>;
      eventTypes: string[];
    }
  | { type: 'SCENARIO_STEP_START'; stepIndex: number }
  | { type: 'SCENARIO_STEP_DONE'; stepIndex: number; response: FireResponse }
  | { type: 'SCENARIO_STEP_ERROR'; stepIndex: number }
  | { type: 'CLEAR_RESPONSE' }
  | { type: 'TOGGLE_EDIT_MODE' }
  | { type: 'RESET_EDIT_PAYLOAD' }
  | { type: 'SET_EDIT_PAYLOAD'; json: string }
  | { type: 'HYDRATE_TESTED_EVENTS'; eventTypes: Set<string> }
  | { type: 'RESTORE_FROM_HISTORY'; entry: ResponseHistoryEntry };

// ─── Default State ──────────────────────────────────────────────────────────

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

// ─── Reducer ────────────────────────────────────────────────────────────────

export function labReducer(state: LabState, action: LabAction): LabState {
  switch (action.type) {
    case 'SET_TAB':
      return { ...state, activeTab: action.tab };

    case 'SET_MOBILE_VIEW':
      return { ...state, mobileView: action.view };

    case 'DRILL_INTO_CATEGORY':
      return { ...state, drillCategory: action.id };

    case 'DRILL_OUT':
      return { ...state, drillCategory: null };

    case 'SET_SEARCH_QUERY':
      return { ...state, searchQuery: action.query };

    case 'SELECT_EVENT': {
      const entry = EVENT_CATALOG.find((e) => e.type === action.eventType);
      return {
        ...state,
        mode: 'event',
        activeTab: 'events',
        mobileView: 'editor',
        selectedEventType: action.eventType,
        drillCategory: entry?.category ?? state.drillCategory,
        selectedScenarioId: null,
        eventOptions: {},
        payload: null,
        isEditingPayload: false,
        editedPayload: null,
        response: null,
        error: null,
      };
    }

    case 'SELECT_SCENARIO':
      return {
        ...state,
        mode: 'scenario',
        activeTab: 'scenarios',
        selectedScenarioId: action.scenarioId,
        response: null,
        error: null,
      };

    case 'SET_EVENT_OPTIONS':
      return {
        ...state,
        eventOptions: { ...state.eventOptions, ...action.options },
      };

    case 'SET_TARGET_URL':
      return { ...state, targetUrl: action.url };

    case 'SET_SIGNING_SECRET':
      return { ...state, signingSecret: action.secret };

    case 'SET_PAYLOAD':
      return { ...state, payload: action.payload };

    case 'FIRE_START':
      // On mobile, surface the result immediately (slide-up lands on Response).
      return { ...state, isLoading: true, error: null, mobileView: 'response' };

    case 'FIRE_SUCCESS': {
      // Build config summary from eventOptions for history display
      const opts = state.eventOptions;
      const summaryParts: string[] = [];
      const amt = opts.amount !== undefined && opts.amount !== '' ? opts.amount : 2999;
      const cur = (opts.currency as string) || 'usd';
      const symbols: Record<string, string> = { usd: '$', eur: '€', gbp: '£', jpy: '¥' };
      const sym = symbols[cur] ?? cur.toUpperCase() + ' ';
      const isZeroDecimal = ['jpy', 'krw'].includes(cur);
      summaryParts.push(`${sym}${isZeroDecimal ? amt : (Number(amt) / 100).toFixed(2)}`);
      if (cur !== 'usd') summaryParts.push(cur.toUpperCase());
      if (opts.declineCode) summaryParts.push(String(opts.declineCode));

      const historyEntry: ResponseHistoryEntry = {
        eventType: state.selectedEventType,
        response: action.response,
        payload: action.payload,
        eventOptions: { ...state.eventOptions },
        timestamp: Math.floor(Date.now() / 1000),
        targetUrl: state.targetUrl,
        configSummary: summaryParts.join(' · '),
      };
      const newHistory = [historyEntry, ...state.responseHistory].slice(0, 20);
      const newTested = new Set(state.testedEventTypes);
      newTested.add(state.selectedEventType);
      return {
        ...state,
        response: action.response,
        payload: action.payload,
        responseHistory: newHistory,
        testedEventTypes: newTested,
        isLoading: false,
      };
    }

    case 'FIRE_ERROR':
      return { ...state, error: action.error, isLoading: false };

    case 'SET_SCENARIO_STEPS':
      return {
        ...state,
        scenarioSteps: action.steps,
        scenarioResults: action.steps.map((_, i) => ({
          stepIndex: i,
          eventType: action.eventTypes[i],
          response: null,
          status: 'pending' as const,
        })),
      };

    case 'SCENARIO_STEP_START':
      return {
        ...state,
        scenarioResults: state.scenarioResults.map((r) =>
          r.stepIndex === action.stepIndex ? { ...r, status: 'firing' as const } : r,
        ),
      };

    case 'SCENARIO_STEP_DONE':
      return {
        ...state,
        scenarioResults: state.scenarioResults.map((r) =>
          r.stepIndex === action.stepIndex
            ? { ...r, status: 'done' as const, response: action.response }
            : r,
        ),
      };

    case 'SCENARIO_STEP_ERROR':
      return {
        ...state,
        scenarioResults: state.scenarioResults.map((r) =>
          r.stepIndex === action.stepIndex ? { ...r, status: 'error' as const } : r,
        ),
      };

    case 'CLEAR_RESPONSE':
      return {
        ...state,
        response: null,
        error: null,
        scenarioResults: [],
      };

    case 'TOGGLE_EDIT_MODE': {
      // Exiting edit mode with edits — sync JSON → eventOptions
      if (state.isEditingPayload && state.editedPayload) {
        try {
          const parsed = JSON.parse(state.editedPayload);
          const fields = getFieldsForEvent(state.selectedEventType);
          const extracted = extractOptionsFromJson(parsed, fields);
          return {
            ...state,
            isEditingPayload: false,
            eventOptions: { ...state.eventOptions, ...extracted },
          };
        } catch {
          // Invalid JSON — just toggle, don't sync
          return { ...state, isEditingPayload: false };
        }
      }
      return { ...state, isEditingPayload: !state.isEditingPayload };
    }

    case 'RESET_EDIT_PAYLOAD':
      return {
        ...state,
        isEditingPayload: false,
        editedPayload: null,
      };

    case 'SET_EDIT_PAYLOAD':
      return { ...state, editedPayload: action.json };

    case 'HYDRATE_TESTED_EVENTS':
      return { ...state, testedEventTypes: action.eventTypes };

    case 'RESTORE_FROM_HISTORY': {
      const restored = EVENT_CATALOG.find((e) => e.type === action.entry.eventType);
      return {
        ...state,
        mode: 'event' as const,
        activeTab: 'events' as const,
        mobileView: 'editor' as const,
        selectedEventType: action.entry.eventType as StripeEventType,
        drillCategory: restored?.category ?? state.drillCategory,
        eventOptions: { ...action.entry.eventOptions },
        targetUrl: action.entry.targetUrl,
        selectedScenarioId: null,
        isEditingPayload: false,
        editedPayload: null,
        response: null,
        error: null,
      };
    }

    default:
      return state;
  }
}

// ─── Context ────────────────────────────────────────────────────────────────

const LabStateContext = createContext<LabState | null>(null);
const LabDispatchContext = createContext<Dispatch<LabAction> | null>(null);

// ─── Provider ───────────────────────────────────────────────────────────────

function loadInitialState(): LabState {
  const targetUrl = loadString('target-url', '');
  const signingSecret = loadString('signing-secret', 'whsec_test_secret');
  const lastEvent = loadString('last-event', 'payment_intent.succeeded') as StripeEventType;
  const lastCategory = loadString('last-category', '');

  return {
    ...defaultState,
    targetUrl,
    signingSecret,
    selectedEventType: lastEvent,
    drillCategory: lastCategory || null,
  };
}

function persistingDispatch(
  baseDispatch: Dispatch<LabAction>,
): Dispatch<LabAction> {
  return (action: LabAction) => {
    baseDispatch(action);
    switch (action.type) {
      case 'SET_TARGET_URL':
        persistString('target-url', action.url);
        break;
      case 'SET_SIGNING_SECRET':
        persistString('signing-secret', action.secret);
        break;
      case 'SELECT_EVENT': {
        persistString('last-event', action.eventType);
        const evtEntry = EVENT_CATALOG.find((e) => e.type === action.eventType);
        if (evtEntry) persistString('last-category', evtEntry.category);
        break;
      }
      case 'DRILL_INTO_CATEGORY':
        persistString('last-category', action.id);
        break;
      case 'DRILL_OUT':
        persistString('last-category', '');
        break;
    }
  };
}

export function LabProvider({ children }: { children: ReactNode }) {
  const [state, baseDispatch] = useReducer(labReducer, defaultState);
  const dispatch = useMemo(() => persistingDispatch(baseDispatch), [baseDispatch]);

  // Load persisted state on mount, then override with URL params (URL > localStorage > defaults)
  useEffect(() => {
    const persisted = loadInitialState();
    if (persisted.targetUrl) baseDispatch({ type: 'SET_TARGET_URL', url: persisted.targetUrl });
    if (persisted.signingSecret !== 'whsec_test_secret') baseDispatch({ type: 'SET_SIGNING_SECRET', secret: persisted.signingSecret });
    if (persisted.selectedEventType !== 'payment_intent.succeeded') baseDispatch({ type: 'SELECT_EVENT', eventType: persisted.selectedEventType });
    if (persisted.drillCategory) baseDispatch({ type: 'DRILL_INTO_CATEGORY', id: persisted.drillCategory });

    // URL params override localStorage
    if (typeof window !== 'undefined') {
      const urlState = parseUrlState(new URLSearchParams(window.location.search));
      if (urlState.selectedEventType) baseDispatch({ type: 'SELECT_EVENT', eventType: urlState.selectedEventType });
      if (urlState.selectedScenarioId) baseDispatch({ type: 'SELECT_SCENARIO', scenarioId: urlState.selectedScenarioId });
      if (urlState.eventOptions) {
        baseDispatch({ type: 'SET_EVENT_OPTIONS', options: urlState.eventOptions });
      }
      if (urlState.targetUrl) baseDispatch({ type: 'SET_TARGET_URL', url: urlState.targetUrl });
    }
  }, []);

  // Auto-update URL on relevant state changes
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const qs = serializeToUrl(state);
    const newUrl = qs || window.location.pathname;
    if (newUrl !== window.location.pathname + window.location.search) {
      window.history.replaceState(null, '', newUrl);
    }
  }, [state.selectedEventType, state.selectedScenarioId, state.eventOptions, state.targetUrl, state.mode]);

  return (
    <LabStateContext value={state}>
      <LabDispatchContext value={dispatch}>{children}</LabDispatchContext>
    </LabStateContext>
  );
}

// ─── Hooks ──────────────────────────────────────────────────────────────────

export function useLabState(): LabState {
  const context = use(LabStateContext);
  if (!context) {
    throw new Error('useLabState must be used within a LabProvider');
  }
  return context;
}

export function useLabDispatch(): Dispatch<LabAction> {
  const context = use(LabDispatchContext);
  if (!context) {
    throw new Error('useLabDispatch must be used within a LabProvider');
  }
  return context;
}
