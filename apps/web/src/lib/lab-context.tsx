// Copyright 2026 Sutyr Inc. SPDX-License-Identifier: Apache-2.0
'use client';

import { createContext, use, useEffect, useMemo, useReducer, useState, type Dispatch, type ReactNode } from 'react';
import type { EventCategory, StripeEventType } from '@webhook-lab/events';
import type { CheckId, SuiteReport } from '@webhook-lab/conformance';
import { loadString, persistString } from '@/lib/local-storage';
import { parseUrlState, serializeToUrl } from '@/lib/url-state';
import { getFieldsForEvent } from '@/lib/event-fields-map';
import { extractOptionsFromJson } from '@/lib/json-to-options';
import { categoryOf, isEventCategory, isEventType } from '@/lib/event-groups';

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

/** What /api/run-suite returns: the conformance report plus the run's request ID. */
export type SuiteRunResult = SuiteReport & { requestId: string };

export type SidebarTab = 'suite' | 'scenarios' | 'events';

/** What the center and response panels show. */
export type LabMode = 'suite' | 'event' | 'scenario';

export interface LabState {
  mode: LabMode;
  activeTab: SidebarTab;
  /** Which surface the mobile (<md) segmented control shows. Ignored at md+. */
  mobileView: 'editor' | 'response';
  /** Event groups expanded in the sidebar, in the order they were opened. */
  openGroups: EventCategory[];
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
  suiteReport: SuiteRunResult | null;
  suiteRunning: boolean;
  /** Epoch ms the current run started, for the elapsed time while it runs. */
  suiteStartedAt: number | null;
  suiteError: string | null;
  /** The check last picked from the sidebar; the panels expand and reveal it. */
  focusedCheck: CheckId | null;
  /** Bumped on every FOCUS_CHECK so picking the same check again still reveals it. */
  focusNonce: number;
}

/** Values restored from localStorage on load. None of them change the mode. */
export interface HydratePayload {
  targetUrl?: string;
  signingSecret?: string;
  selectedEventType?: StripeEventType;
  openGroups?: EventCategory[];
}

export type LabAction =
  | { type: 'SET_TAB'; tab: SidebarTab }
  | { type: 'SET_MOBILE_VIEW'; view: 'editor' | 'response' }
  | { type: 'TOGGLE_GROUP'; category: EventCategory }
  | { type: 'SET_GROUP_OPEN'; category: EventCategory; open: boolean }
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
  | { type: 'RESTORE_FROM_HISTORY'; entry: ResponseHistoryEntry }
  | { type: 'HYDRATE'; values: HydratePayload }
  | { type: 'SUITE_START'; startedAt: number }
  | { type: 'SUITE_SUCCESS'; report: SuiteRunResult }
  | { type: 'SUITE_ERROR'; error: string }
  | { type: 'FOCUS_CHECK'; id: CheckId };

// ─── Default State ──────────────────────────────────────────────────────────

const DEFAULT_EVENT: StripeEventType = 'payment_intent.succeeded';
const DEFAULT_SECRET = 'whsec_test_secret';

/** A visitor with no URL state lands on the suite. */
export const defaultLabState: LabState = {
  mode: 'suite',
  activeTab: 'suite',
  mobileView: 'editor',
  openGroups: ['payments'],
  searchQuery: '',
  selectedEventType: DEFAULT_EVENT,
  selectedScenarioId: null,
  eventOptions: {},
  targetUrl: '',
  signingSecret: DEFAULT_SECRET,
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
  suiteReport: null,
  suiteRunning: false,
  suiteStartedAt: null,
  suiteError: null,
  focusedCheck: null,
  focusNonce: 0,
};

/** `groups` with the selected event's group added, so it is never hidden. */
function withGroupOf(groups: EventCategory[], eventType: string): EventCategory[] {
  const category = categoryOf(eventType);
  if (!category || groups.includes(category)) return groups;
  return [...groups, category];
}

// ─── Reducer ────────────────────────────────────────────────────────────────

export function labReducer(state: LabState, action: LabAction): LabState {
  switch (action.type) {
    case 'SET_TAB':
      // The suite has nothing to pick in the sidebar, so its tab opens it.
      // Events and Scenarios keep the current panels until something is picked.
      if (action.tab === 'suite') return { ...state, activeTab: 'suite', mode: 'suite' };
      return { ...state, activeTab: action.tab };

    case 'SET_MOBILE_VIEW':
      return { ...state, mobileView: action.view };

    case 'TOGGLE_GROUP':
      return {
        ...state,
        openGroups: state.openGroups.includes(action.category)
          ? state.openGroups.filter((c) => c !== action.category)
          : [...state.openGroups, action.category],
      };

    case 'SET_GROUP_OPEN': {
      const isOpen = state.openGroups.includes(action.category);
      if (isOpen === action.open) return state;
      return {
        ...state,
        openGroups: action.open
          ? [...state.openGroups, action.category]
          : state.openGroups.filter((c) => c !== action.category),
      };
    }

    case 'SET_SEARCH_QUERY':
      // Results show in the Events tab, whichever tab the search started from.
      return {
        ...state,
        searchQuery: action.query,
        activeTab: action.query.trim() !== '' ? 'events' : state.activeTab,
      };

    case 'SELECT_EVENT':
      return {
        ...state,
        mode: 'event',
        activeTab: 'events',
        mobileView: 'editor',
        selectedEventType: action.eventType,
        openGroups: withGroupOf(state.openGroups, action.eventType),
        selectedScenarioId: null,
        eventOptions: {},
        payload: null,
        isEditingPayload: false,
        editedPayload: null,
        response: null,
        error: null,
      };

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
        configSummary: summaryParts.join(', '),
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

    case 'RESTORE_FROM_HISTORY':
      return {
        ...state,
        mode: 'event' as const,
        activeTab: 'events' as const,
        mobileView: 'editor' as const,
        selectedEventType: action.entry.eventType as StripeEventType,
        openGroups: withGroupOf(state.openGroups, action.entry.eventType),
        eventOptions: { ...action.entry.eventOptions },
        targetUrl: action.entry.targetUrl,
        selectedScenarioId: null,
        isEditingPayload: false,
        editedPayload: null,
        response: null,
        error: null,
      };

    case 'HYDRATE': {
      const { values } = action;
      const selectedEventType = values.selectedEventType ?? state.selectedEventType;
      return {
        ...state,
        targetUrl: values.targetUrl ?? state.targetUrl,
        signingSecret: values.signingSecret ?? state.signingSecret,
        selectedEventType,
        openGroups: withGroupOf(values.openGroups ?? state.openGroups, selectedEventType),
      };
    }

    case 'SUITE_START':
      // Results land on the mobile Results view; the old report gives way to skeletons.
      return {
        ...state,
        suiteRunning: true,
        suiteStartedAt: action.startedAt,
        suiteError: null,
        suiteReport: null,
        focusedCheck: null,
        mobileView: 'response',
      };

    case 'SUITE_SUCCESS':
      return { ...state, suiteRunning: false, suiteStartedAt: null, suiteReport: action.report };

    case 'SUITE_ERROR':
      return { ...state, suiteRunning: false, suiteStartedAt: null, suiteError: action.error };

    case 'FOCUS_CHECK':
      return {
        ...state,
        mode: 'suite',
        activeTab: 'suite',
        focusedCheck: action.id,
        focusNonce: state.focusNonce + 1,
        // With results, the check's row is on the Results view; before a run it
        // is in the checklist on the editor view.
        mobileView: state.suiteReport ? 'response' : 'editor',
      };

    default:
      return state;
  }
}

// ─── Context ────────────────────────────────────────────────────────────────

const LabStateContext = createContext<LabState | null>(null);
const LabDispatchContext = createContext<Dispatch<LabAction> | null>(null);

// ─── Provider ───────────────────────────────────────────────────────────────

const OPEN_GROUPS_KEY = 'open-groups';

function loadOpenGroups(): EventCategory[] | undefined {
  const raw = loadString(OPEN_GROUPS_KEY, '');
  if (!raw) return undefined;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return undefined;
    return parsed.filter((c): c is EventCategory => typeof c === 'string' && isEventCategory(c));
  } catch {
    return undefined;
  }
}

/** Everything localStorage remembers. Unknown or stale values are dropped. */
function loadPersisted(): HydratePayload {
  const values: HydratePayload = {};
  const targetUrl = loadString('target-url', '');
  if (targetUrl) values.targetUrl = targetUrl;
  const signingSecret = loadString('signing-secret', DEFAULT_SECRET);
  if (signingSecret !== DEFAULT_SECRET) values.signingSecret = signingSecret;
  const lastEvent = loadString('last-event', '');
  if (isEventType(lastEvent)) values.selectedEventType = lastEvent;
  const openGroups = loadOpenGroups();
  if (openGroups) values.openGroups = openGroups;
  return values;
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
      case 'SELECT_EVENT':
        persistString('last-event', action.eventType);
        break;
    }
  };
}

export function LabProvider({ children }: { children: ReactNode }) {
  const [state, baseDispatch] = useReducer(labReducer, defaultLabState);
  const dispatch = useMemo(() => persistingDispatch(baseDispatch), [baseDispatch]);
  // URL and storage writes wait for the first restore, so they never
  // overwrite a shared link or saved state with the defaults.
  const [hydrated, setHydrated] = useState(false);

  // Restore on mount: URL > localStorage > defaults.
  useEffect(() => {
    baseDispatch({ type: 'HYDRATE', values: loadPersisted() });

    const urlState = parseUrlState(new URLSearchParams(window.location.search));
    if (urlState.selectedEventType) baseDispatch({ type: 'SELECT_EVENT', eventType: urlState.selectedEventType });
    if (urlState.selectedScenarioId) baseDispatch({ type: 'SELECT_SCENARIO', scenarioId: urlState.selectedScenarioId });
    if (urlState.eventOptions) {
      baseDispatch({ type: 'SET_EVENT_OPTIONS', options: urlState.eventOptions });
    }
    if (urlState.targetUrl) baseDispatch({ type: 'SET_TARGET_URL', url: urlState.targetUrl });
    setHydrated(true);
  }, []);

  // Keep the address bar shareable as the selection changes.
  useEffect(() => {
    if (!hydrated) return;
    const qs = serializeToUrl(state);
    const newUrl = qs || window.location.pathname;
    if (newUrl !== window.location.pathname + window.location.search) {
      window.history.replaceState(null, '', newUrl);
    }
  }, [hydrated, state.selectedEventType, state.selectedScenarioId, state.eventOptions, state.targetUrl, state.mode]);

  useEffect(() => {
    if (!hydrated) return;
    persistString(OPEN_GROUPS_KEY, JSON.stringify(state.openGroups));
  }, [hydrated, state.openGroups]);

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
