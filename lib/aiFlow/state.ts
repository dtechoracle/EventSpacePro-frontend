import type { FlowSlot, FlowState } from './types';
import { extractTurn, getMissingSlots, matchSlotFromQuestion } from './questions';

export function emptyState(): FlowState {
  return { asked: [], phase: 'opening', pendingQuestion: null };
}

const FLOW_KEYS: (keyof FlowState)[] = [
  'spaceType', 'marqueeAsset', 'widthMm', 'heightMm', 'layoutSummary', 'seatingMode',
  'guestCount', 'tableType', 'chairType', 'chairsPerTable', 'arrangement', 'stage',
  'extras', 'layoutScale', 'orientation', 'confirmation', 'pendingQuestion', 'asked', 'phase',
];

const SPACE_TYPES = new Set(['custom', 'marquee', 'grassy field', 'parking lot', 'beach']);
const SEATING_MODES = new Set(['chairs', 'tables']);
const EXTRA_VALUES = new Set(['none', 'listed']);
const SCALE_VALUES = new Set(['fit-space', 'default-size']);
const ORIENTATION_VALUES = new Set(['portrait', 'landscape']);
const CONFIRMATION_VALUES = new Set(['confirmed', 'declined']);
const PHASES = new Set(['opening', 'space', 'brief', 'details', 'ready']);

function coerceNumber(value: unknown): number | undefined {
  const num = Number(value);
  if (!Number.isFinite(num) || num <= 0 || num > 10_000_000) return undefined;
  return num;
}

function coerceString(value: unknown, maxLength = 2000): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  return trimmed.slice(0, maxLength);
}

function coerceStage(value: unknown): FlowState['stage'] {
  if (!value || typeof value !== 'object') return undefined;
  const raw = value as Record<string, unknown>;
  const stage: NonNullable<FlowState['stage']> = { wanted: Boolean(raw.wanted) };
  if (raw.spec && typeof raw.spec === 'object') {
    const spec = raw.spec as Record<string, unknown>;
    const width = coerceNumber(spec.width);
    const height = coerceNumber(spec.height);
    if (width && height) {
      stage.spec = { name: coerceString(spec.name, 120) || 'Stage', width, height };
    }
  }
  if (typeof raw.placement === 'string' && raw.placement.trim()) {
    stage.placement = raw.placement.trim().slice(0, 40);
  }
  return stage;
}

export function normalizeFlowState(raw: unknown): FlowState {
  const state = emptyState();
  if (!raw || typeof raw !== 'object') return state;
  const input = raw as Record<string, unknown>;

  if (typeof input.spaceType === 'string' && SPACE_TYPES.has(input.spaceType)) state.spaceType = input.spaceType as FlowState['spaceType'];
  state.marqueeAsset = coerceString(input.marqueeAsset, 140);
  state.widthMm = coerceNumber(input.widthMm);
  state.heightMm = coerceNumber(input.heightMm);
  state.layoutSummary = coerceString(input.layoutSummary);
  if (typeof input.seatingMode === 'string' && SEATING_MODES.has(input.seatingMode)) state.seatingMode = input.seatingMode as FlowState['seatingMode'];
  const guestCount = coerceNumber(input.guestCount);
  if (guestCount && guestCount <= 1_000_000) state.guestCount = Math.round(guestCount);
  state.tableType = coerceString(input.tableType, 160);
  state.chairType = coerceString(input.chairType, 160);
  const chairsPerTable = coerceNumber(input.chairsPerTable);
  if (chairsPerTable && chairsPerTable <= 200) state.chairsPerTable = Math.round(chairsPerTable);
  state.arrangement = coerceString(input.arrangement, 40);
  const stage = coerceStage(input.stage);
  if (stage) state.stage = stage;
  if (typeof input.extras === 'string' && EXTRA_VALUES.has(input.extras)) state.extras = input.extras as FlowState['extras'];
  if (typeof input.layoutScale === 'string' && SCALE_VALUES.has(input.layoutScale)) state.layoutScale = input.layoutScale as FlowState['layoutScale'];
  if (typeof input.orientation === 'string' && ORIENTATION_VALUES.has(input.orientation)) state.orientation = input.orientation as FlowState['orientation'];
  if (typeof input.confirmation === 'string' && CONFIRMATION_VALUES.has(input.confirmation)) state.confirmation = input.confirmation as FlowState['confirmation'];
  if (typeof input.pendingQuestion === 'string') state.pendingQuestion = input.pendingQuestion as FlowSlot;
  if (Array.isArray(input.asked)) {
    state.asked = input.asked.filter((s): s is FlowSlot => typeof s === 'string').slice(-30);
  }
  if (typeof input.phase === 'string' && PHASES.has(input.phase)) state.phase = input.phase as FlowState['phase'];

  return state;
}

export function mergeSlots(base: FlowState, patch: Partial<FlowState> | undefined | null): FlowState {
  if (!patch) return { ...base };
  const next: FlowState = { ...base };

  for (const key of FLOW_KEYS) {
    const value = patch[key];
    if (value === undefined) continue;
    if (key === 'stage') {
      const incoming = value as FlowState['stage'];
      if (incoming) {
        next.stage = {
          ...(base.stage || {}),
          ...incoming,
          spec: incoming.spec || base.stage?.spec,
        };
      }
      continue;
    }
    if (key === 'asked') {
      const incoming = value as FlowSlot[] | undefined;
      if (Array.isArray(incoming)) {
        next.asked = Array.from(new Set([...(base.asked || []), ...incoming])).slice(-30);
      }
      continue;
    }
    if (key === 'pendingQuestion' && value === null) {
      next.pendingQuestion = null;
      continue;
    }
    (next as Record<string, unknown>)[key] = value;
  }

  return next;
}

export function computePhase(state: FlowState): FlowState['phase'] {
  if (state.confirmation === 'confirmed') return 'ready';
  if (!state.spaceType) return 'opening';
  if (!(state.widthMm && state.heightMm)) return 'space';
  if (!state.layoutSummary && !state.seatingMode) return 'brief';
  if (getMissingSlots(state).length > 0) return 'details';
  return 'ready';
}

export function recordQuestion(state: FlowState, question: string, choices?: string[]): FlowState {
  const slot = matchSlotFromQuestion(question);
  if (!slot) return { ...state, pendingQuestion: null };
  const asked = Array.from(new Set([...(state.asked || []), slot])).slice(-30);
  return { ...state, pendingQuestion: slot, asked };
}

export function deriveStateFromHistory(
  messages: { role: string; content: string }[]
): FlowState {
  let state = emptyState();
  if (!Array.isArray(messages)) return state;

  const entries = messages.filter((m) => m && (m.role === 'user' || m.role === 'assistant'));

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    if (entry.role === 'assistant') {
      const question = extractAssistantQuestion(entry.content);
      if (question) {
        state = recordQuestion(state, question);
      } else {
        state = { ...state, pendingQuestion: null };
      }
      continue;
    }

    const extraction = extractTurn(String(entry.content || ''), state);
    if (extraction.found && Object.keys(extraction.slots).length > 0) {
      state = mergeSlots(state, extraction.slots);
      state = { ...state, pendingQuestion: null };
    }
  }

  state = { ...state, phase: computePhase(state) };
  return state;
}

function extractAssistantQuestion(content: string): string | null {
  const raw = String(content || '');
  if (!raw) return null;
  const trimmed = raw.trim();
  if (trimmed.startsWith('{')) {
    try {
      const parsed = JSON.parse(trimmed) as Record<string, unknown>;
      const candidate =
        (typeof parsed.followUp === 'string' && parsed.followUp) ||
        (typeof parsed.message === 'string' && parsed.message) ||
        (parsed.assetSelection && typeof parsed.assetSelection === 'object'
          ? String((parsed.assetSelection as Record<string, unknown>).message || '')
          : '');
      if (candidate && matchSlotFromQuestion(candidate)) return candidate;
      return null;
    } catch {
      return matchSlotFromQuestion(raw) ? raw : null;
    }
  }
  return matchSlotFromQuestion(raw) ? raw : null;
}
