import type { FlowSlot, FlowState, Intent, NextQuestion, TurnExtraction } from './types';

export const ARRANGEMENT_CHOICES = [
  'Grid', 'Linear', 'Circular', 'Perimeter', 'U-Shape', 'Boardroom', 'Classroom', 'Chevron',
];

export const SPACE_CHOICES = ['Custom', 'Marquee', 'Grassy field', 'Parking lot', 'Beach'];

export const STAGE_CHOICES = ['Yes, add a stage', 'No stage'];

const seatingTypeQuestion = (draftLabel: string) =>
  `I've drafted a ${draftLabel} for you. How would you like to set up seating?`;

const ROOM_SUMMARY_HINT =
  'In plain language, tell me what you want for this event layout. For example: "40 guests on the left side, a table with 2 chairs on the right, and a stage at the top."';

const DIMENSION_HINT =
  'Please provide the width and height in meters, millimeters, or feet.';

function canonicalize(value: string): string {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

function normalizeIntentText(value: string): string {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s']/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function isAffirmativeIntent(text: string): boolean {
  const lower = normalizeIntentText(text);
  if (!lower) return false;
  return (
    /(^|\b)(?:yes|yeah|yep|sure|okay|ok|alright|proceed|continue)\b/.test(lower) ||
    /\bgo ahead\b|\bsounds good\b|\bthat works\b|\bplease do\b|\badd it\b|\badd one\b|\binclude one\b|\bi want one\b|\bi need one\b/.test(lower)
  );
}

export function isNegativeIntent(text: string): boolean {
  const lower = normalizeIntentText(text);
  if (!lower) return false;
  return (
    /(^|\b)(?:no+|nah+|nope|none|nothing|without|skip)\b/.test(lower) ||
    /\bnot at all\b|\bnot really\b|\bno need\b|\bno thanks\b|\bdon't add\b|\bdont add\b|\bdo not add\b|\bdon't include\b|\bdont include\b|\bdo not include\b|\bdon't need\b|\bdont need\b|\bdo not need\b|\bdon't want\b|\bdont want\b|\bdo not want\b|\bno extras\b|\bno additional feature\b|\bno additional features\b|\bnothing else\b|\bnone of that\b|\bwithout a stage\b/.test(lower)
  );
}

export function parseDimensionPair(text: string): {
  widthValue: string;
  widthUnit?: string;
  heightValue: string;
  heightUnit?: string;
} | null {
  const raw = String(text || '');
  const patterns = [
    /(\d+(?:\.\d+)?)\s*(mm|m|ft)?\s*(?:x|by)\s*(\d+(?:\.\d+)?)\s*(mm|m|ft)?/i,
    /(?:about|roughly|around)?\s*(\d+(?:\.\d+)?)\s*(mm|m|ft)\s*(?:wide|width)?\s*(?:and|,)\s*(\d+(?:\.\d+)?)\s*(mm|m|ft)\s*(?:long|length|deep|height)?/i,
    /(?:about|roughly|around)?\s*(\d+(?:\.\d+)?)\s*(mm|m|ft)\s*(?:long|length|deep|height)\s*(?:and|,)\s*(\d+(?:\.\d+)?)\s*(mm|m|ft)\s*(?:wide|width)?/i,
  ];
  for (const pattern of patterns) {
    const match = raw.match(pattern);
    if (match) {
      return {
        widthValue: match[1],
        widthUnit: match[2],
        heightValue: match[3],
        heightUnit: match[4] || match[2],
      };
    }
  }
  return null;
}

export function toMm(value?: string, unit?: string): number | null {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return null;
  const normalizedUnit = (unit || '').toLowerCase();
  if (normalizedUnit === 'm') return numeric * 1000;
  if (normalizedUnit === 'ft') return numeric * 304.8;
  return numeric;
}

export function parseDimensions(text: string): { widthMm: number; heightMm: number } | null {
  const pair = parseDimensionPair(text);
  if (!pair) return null;
  const widthMm = toMm(pair.widthValue, pair.widthUnit);
  const heightMm = toMm(pair.heightValue, pair.heightUnit);
  if (!widthMm || !heightMm) return null;
  return { widthMm, heightMm };
}

export function extractGuestCount(text: string): number | null {
  const directMatch = String(text || '').match(
    /(?:about\s+)?(\d+)\s*[a-z]*\s*(?:guest|guests|attendee|attendees|people|persons)/i
  );
  if (!directMatch) return null;
  const value = Number(directMatch[1]);
  return Number.isFinite(value) ? value : null;
}

export function parseArrangementIntent(text: string): string | null {
  const lower = String(text || '').toLowerCase();
  const compact = canonicalize(lower);
  if (
    lower.includes('u-shape') || lower.includes('u shape') || lower.includes('u shaped') ||
    lower.includes('horseshoe') || lower.includes('horse shoe') ||
    compact.includes('ushape') || compact.includes('ushaped') || compact.includes('horseshoe')
  ) return 'u-shape';
  if (lower.includes('boardroom') || compact.includes('boardroom')) return 'boardroom';
  if (
    lower.includes('classroom') || lower.includes('lecture style') || lower.includes('seminar style') ||
    lower.includes('rows facing front') || compact.includes('classroom')
  ) return 'classroom';
  if (
    lower.includes('chevron') || lower.includes('zig zag') || lower.includes('zig-zag') ||
    lower.includes('zigzag') || lower.includes('staggered') || lower.includes('angled rows') ||
    compact.includes('chevron') || compact.includes('zigzag')
  ) return 'chevron';
  if (
    lower.includes('perimeter') || lower.includes('around the wall') || lower.includes('around the edge') ||
    lower.includes('by the edges') || lower.includes('around the room') || compact.includes('perimeter')
  ) return 'perimeter';
  if (
    lower.includes('circular') || lower.includes('circle') || lower.includes('round arrangement') ||
    lower.includes('semi circle') || lower.includes('semi-circle') || lower.includes('arc arrangement') ||
    lower.includes('around the center') || compact.includes('circular') || compact.includes('rounded') ||
    compact.includes('semicircle')
  ) return 'circular';
  if (
    lower.includes('linear') || lower.includes('single row') || lower.includes('single file') ||
    lower.includes('in a line') || lower.includes('straight line') || compact.includes('linear')
  ) return 'linear';
  if (lower.includes('grid') || lower.includes('matrix') || lower.includes('even rows and columns') ||
    lower.includes('balanced rows') || compact.includes('grid') || compact.includes('matrix')
  ) return 'grid';
  return null;
}

export function parseSpaceChoice(text: string): FlowState['spaceType'] | null {
  const lower = String(text || '').toLowerCase();
  if (lower.includes('parking lot') || lower.includes('car park')) return 'parking lot';
  if (lower.includes('grassy field')) return 'grassy field';
  if (lower.includes('marquee') || lower.includes('tent')) return 'marquee';
  if (lower.includes('beach')) return 'beach';
  if (lower.includes('custom')) return 'custom';
  return null;
}

export function parseOrientation(text: string): 'portrait' | 'landscape' | null {
  const lower = String(text || '').toLowerCase();
  if (/\bportrait\b/.test(lower)) return 'portrait';
  if (/\blandscape\b/.test(lower)) return 'landscape';
  return null;
}

export function parseStagePlacement(text: string): string | null {
  const lower = String(text || '').toLowerCase();
  if (lower.includes('top center') || lower.includes('top-centre') || lower.includes('top centre')) return 'top';
  if (lower.includes('bottom center') || lower.includes('bottom-centre') || lower.includes('bottom centre')) return 'bottom';
  if (lower.includes('inside u') || lower.includes('open end') || lower.includes('opening')) return 'open-end';
  if (/\btop\b/.test(lower)) return 'top';
  if (/\bbottom\b/.test(lower)) return 'bottom';
  if (/\bleft\b/.test(lower)) return 'left';
  if (/\bright\b/.test(lower)) return 'right';
  if (lower.includes('center') || lower.includes('centre') || lower.includes('middle')) return 'center';
  return null;
}

export function parseStageSize(text: string): { widthMm: number; heightMm: number } | null {
  const lower = String(text || '').toLowerCase();
  if (!lower.includes('stage') && !parseDimensionPair(text)) return null;
  if (/\bsmall\b/.test(lower)) return { widthMm: 2000, heightMm: 1500 };
  if (/\bmedium\b/.test(lower)) return { widthMm: 3000, heightMm: 2000 };
  if (/\blarge\b/.test(lower)) return { widthMm: 4000, heightMm: 2500 };
  return parseDimensions(text);
}

export function parseChairsPerTable(text: string, expectNumeric: boolean): number | null {
  const raw = String(text || '');
  const explicit = raw.match(/(\d{1,2})\s*(?:chairs?|seats?|stools?)\s*(?:per|around each|on each)/i);
  if (explicit) {
    const value = Number(explicit[1]);
    return Number.isFinite(value) ? value : null;
  }
  if (expectNumeric) {
    const numeric = raw.match(/(\d{1,2})/);
    if (numeric) {
      const value = Number(numeric[1]);
      return Number.isFinite(value) ? value : null;
    }
  }
  return null;
}

const QUESTION_SLOT_PATTERNS: { slot: FlowSlot; test: (lower: string) => boolean }[] = [
  { slot: 'layoutSummary', test: (t) => /in plain language, tell me what you want|describe what you want for this event layout|describe the event layout you want/.test(t) },
  { slot: 'extras', test: (t) => t.includes('would you like to include any additional features') },
  { slot: 'layoutScale', test: (t) => /scale the layout to use more of the available space|keep it at default size|fit to space|keep default size/.test(t) },
  { slot: 'stagePlacement', test: (t) => /where should i place the stage|where would you like the stage/.test(t) },
  { slot: 'stageSize', test: (t) => /what size would you like for the stage|select a stage/.test(t) },
  { slot: 'stage', test: (t) => t.includes('would you like to add a stage') },
  { slot: 'chairType', test: (t) => /what chair would you like to pair|select a chair|select seating for this table|what seating would you like to pair|which chair would you like|what chair should i (?:pair|use)|what seating should i use/.test(t) },
  { slot: 'chairsPerTable', test: (t) => /how many chairs should i place around each table|how many seats should i place around each table|chairs per table/.test(t) },
  { slot: 'guestCount', test: (t) => /how many guests|number of guests|guest count|how many people|how many attendees|roughly how many guests|about how many guests/.test(t) },
  { slot: 'tableType', test: (t) => /what type of seating|what type of tables|what table|round tables|rectangular tables|select a table|select seating|table or seating setup|what table or seating/.test(t) },
  { slot: 'arrangement', test: (t) => /how would you like those .* arranged|how would you like them arranged|what arrangement would you like|arrangement\?|arranged\?/.test(t) },
  { slot: 'confirmation', test: (t) => /would you like to proceed with generating|generate the layout now|generate now|ready to proceed|should i generate|generate the layout\?/.test(t) },
  { slot: 'orientation', test: (t) => /landscape or portrait|portrait or landscape/.test(t) },
  { slot: 'seatingMode' as FlowSlot, test: (t) => t.includes('how would you like to set up seating') },
  { slot: 'marquee', test: (t) => /which marquee|which tent|which marquee would you like/.test(t) },
  { slot: 'spaceType', test: (t) => t.includes('event location and space options') },
  { slot: 'dimensions', test: (t) => /what are the dimensions|dimensions of your/.test(t) },
];

export function matchSlotFromQuestion(question: string): FlowSlot | null {
  const lower = String(question || '').toLowerCase();
  if (!lower) return null;
  for (const entry of QUESTION_SLOT_PATTERNS) {
    if (entry.test(lower)) return entry.slot;
  }
  return null;
}

const DIMENSION_FOLLOWUPS: Record<string, string> = {
  custom: `Great choice! What are the dimensions of your custom space? ${DIMENSION_HINT}`,
  'grassy field': `Great choice! What are the dimensions of the grassy field space you want to use? ${DIMENSION_HINT}`,
  'parking lot': `Great choice! What are the dimensions of the parking lot space you want to use? ${DIMENSION_HINT}`,
  beach: `Great choice! What are the dimensions of the beach space you want to use? ${DIMENSION_HINT}`,
};

export function buildSpaceDraftLabel(state: FlowState): string {
  if (state.spaceType === 'marquee') return `${state.marqueeAsset || 'marquee'} space`;
  if (state.spaceType === 'grassy field') return 'grassy field space';
  if (state.spaceType === 'parking lot') return 'parking lot space';
  if (state.spaceType === 'beach') return 'beach space';
  if (state.widthMm && state.heightMm) return `${state.widthMm / 1000}m x ${state.heightMm / 1000}m empty space`;
  return 'empty space';
}

export function stagePositionChoices(arrangement?: string): string[] {
  if (arrangement === 'circular') return ['Center', 'Top', 'Bottom', 'Left', 'Right'];
  if (arrangement === 'u-shape') return ['Inside U opening', 'Top center', 'Bottom center', 'Left', 'Right'];
  return ['Top center', 'Bottom center', 'Left', 'Right', 'Center'];
}

const QUESTION_TEXT: Record<FlowSlot, (state: FlowState) => NextQuestion> = {
  spaceType: () => ({
    slot: 'spaceType',
    followUp: 'Would you like to use one of our event location and space options?',
    choices: SPACE_CHOICES,
  }),
  marquee: () => ({
    slot: 'marquee',
    followUp: 'Excellent! Which marquee would you like to use for your event?',
    assetSelection: { category: 'marquee', message: 'Select a marquee' },
  }),
  dimensions: (state) => ({
    slot: 'dimensions',
    followUp: DIMENSION_FOLLOWUPS[state.spaceType || 'custom'] || `What are the dimensions of your space? ${DIMENSION_HINT}`,
  }),
  layoutSummary: (state) => ({
    slot: 'layoutSummary',
    followUp: `I've drafted a ${buildSpaceDraftLabel(state)} for you. ${ROOM_SUMMARY_HINT}`,
  }),
  seatingMode: (state) => ({
    slot: 'seatingMode',
    followUp: seatingTypeQuestion(buildSpaceDraftLabel(state)),
    choices: ['Single seater chairs', 'Table and chairs'],
  }),
  guestCount: (state) => ({
    slot: 'guestCount',
    followUp: state.tableType
      ? `About how many guests should I plan for with the ${state.tableType}?`
      : 'Roughly how many guests should I plan for in total?',
  }),
  tableType: (state) => ({
    slot: 'tableType',
    followUp: state.guestCount
      ? `For ${state.guestCount} guests, what table or seating setup would you like to use?`
      : 'What table or seating setup would you like to use?',
    assetSelection: { category: 'table', message: 'Select a table or seating setup' },
  }),
  chairType: (state) => ({
    slot: 'chairType',
    followUp: state.tableType
      ? `What chair would you like to pair with the ${state.tableType}?`
      : 'What chair or stool would you like me to use?',
    assetSelection: { category: 'chair', message: 'Select seating' },
  }),
  chairsPerTable: (state) => ({
    slot: 'chairsPerTable',
    followUp: `How many chairs should I place around each ${state.tableType || 'table'}? You can reply with a number.`,
  }),
  arrangement: () => ({
    slot: 'arrangement',
    followUp: 'How would you like the tables arranged?',
    choices: ARRANGEMENT_CHOICES,
  }),
  stage: () => ({
    slot: 'stage',
    followUp: 'Would you like to add a stage to your layout?',
    choices: STAGE_CHOICES,
  }),
  stageSize: () => ({
    slot: 'stageSize',
    followUp: 'What size would you like for the stage? You can reply like 3000mm x 2000mm, 3m x 2m, or 10ft x 8ft.',
  }),
  stagePlacement: (state) => ({
    slot: 'stagePlacement',
    followUp: 'Where should I place the stage in relation to the arrangement?',
    choices: stagePositionChoices(state.arrangement),
  }),
  extras: () => ({
    slot: 'extras',
    followUp: 'Would you like to include any additional features like a dance floor, entrance doors, or a VIP area before I generate the layout?',
  }),
  layoutScale: () => ({
    slot: 'layoutScale',
    followUp: 'Would you like me to scale the layout to use more of the available space, or keep it at default size?',
    choices: ['Fit to space', 'Keep default size'],
  }),
  orientation: () => ({
    slot: 'orientation',
    followUp: 'Would you like the layout in landscape or portrait orientation?',
    choices: ['Landscape', 'Portrait'],
  }),
  confirmation: () => ({
    slot: 'confirmation',
    followUp: 'Would you like me to generate the layout now?',
    choices: ['Generate now', 'Add more details'],
  }),
};

export function tableNeedsLooseChairs(tableName: string): boolean {
  return !String(tableName || '').toLowerCase().includes('seater');
}

export function getMissingSlots(state: FlowState): FlowSlot[] {
  const missing: FlowSlot[] = [];
  const hasDims = Boolean(state.widthMm && state.heightMm);

  if (!state.spaceType) {
    missing.push('spaceType');
    return missing;
  }
  if (state.spaceType === 'marquee' && !state.marqueeAsset) {
    missing.push('marquee');
    return missing;
  }
  if (!hasDims) {
    missing.push('dimensions');
    return missing;
  }

  const briefLooksComplete =
    Boolean(state.layoutSummary) &&
    (Boolean(state.guestCount) || Boolean(state.tableType) || Boolean(state.chairType));

  if (!state.layoutSummary && !briefLooksComplete) missing.push('layoutSummary');
  if (!state.seatingMode && !state.layoutSummary) missing.push('seatingMode');
  if (!state.guestCount && (state.layoutSummary || state.seatingMode)) missing.push('guestCount');

  const wantsTables = state.seatingMode !== 'chairs';
  if (wantsTables && !state.tableType && (state.guestCount || state.layoutSummary)) {
    missing.push('tableType');
  }
  if (!wantsTables && !state.chairType && (state.guestCount || state.layoutSummary)) {
    missing.push('chairType');
  }

  if (state.tableType && tableNeedsLooseChairs(state.tableType)) {
    if (!state.chairType && state.seatingMode !== 'tables') missing.push('chairType');
    if (!state.chairsPerTable) missing.push('chairsPerTable');
  }

  if ((state.tableType || state.chairType) && !state.arrangement) missing.push('arrangement');

  const stageMentioned = /\bstage\b/.test(String(state.layoutSummary || '').toLowerCase());
  if (!state.stage && stageMentioned) missing.push('stage');
  if (state.stage?.wanted && !state.stage.spec) missing.push('stageSize');
  if (state.stage?.wanted && state.stage.spec && !state.stage.placement) missing.push('stagePlacement');

  const stageResolved =
    !stageMentioned ||
    Boolean(state.stage && (!state.stage.wanted || (state.stage.spec && state.stage.placement)));
  if (stageResolved && !state.extras) missing.push('extras');

  if (state.extras && !state.orientation && state.widthMm && state.heightMm) {
    const aspectRatio = state.widthMm / state.heightMm;
    if (Math.abs(aspectRatio - 1) > 0.15) missing.push('orientation');
  }

  if (
    state.orientation ||
    (state.extras && state.widthMm && Math.abs(state.widthMm / (state.heightMm || 1) - 1) <= 0.15)
  ) {
    if (!state.confirmation) missing.push('confirmation');
  }

  return missing;
}

export function getNextQuestion(state: FlowState): NextQuestion | null {
  const missing = getMissingSlots(state);
  if (missing.length === 0) return null;
  const slot = missing[0];
  const builder = QUESTION_TEXT[slot];
  return builder ? builder(state) : null;
}

export function buildPendingQuestion(state: FlowState): NextQuestion | null {
  const slot = state.pendingQuestion;
  if (slot && QUESTION_TEXT[slot]) return QUESTION_TEXT[slot](state);
  return getNextQuestion(state);
}

export function answerToSlots(
  answer: string,
  pendingSlot: FlowSlot | null,
  state: FlowState
): { slots: Partial<FlowState>; intent: Intent | null } {
  const slots: Partial<FlowState> = {};
  let intent: Intent | null = null;
  const text = String(answer || '');
  const lower = text.toLowerCase();

  if (pendingSlot === 'layoutSummary' && text.trim().length > 0) {
    slots.layoutSummary = text.trim();
    intent = 'layout-summary';
    return { slots, intent };
  }

  const dims = parseDimensions(text);
  if (dims && (pendingSlot === 'dimensions' || pendingSlot === 'stageSize' || !pendingSlot)) {
    if (pendingSlot === 'stageSize') {
      slots.stage = { ...(state.stage || { wanted: true }), spec: { name: 'Stage', width: dims.widthMm, height: dims.heightMm } };
      intent = 'stage-size';
    } else {
      slots.widthMm = dims.widthMm;
      slots.heightMm = dims.heightMm;
      intent = 'dimensions';
    }
    return { slots, intent };
  }

  if (pendingSlot === 'spaceType') {
    const choice = parseSpaceChoice(text);
    if (choice) {
      slots.spaceType = choice;
      intent = 'space-type';
      return { slots, intent };
    }
  }

  if (pendingSlot === 'guestCount') {
    const direct = extractGuestCount(text);
    const numeric = direct ?? (text.trim().match(/^(\d{1,5})$/) ? Number(text.trim()) : null);
    if (numeric && Number.isFinite(numeric)) {
      slots.guestCount = numeric;
      intent = 'guest-count';
      return { slots, intent };
    }
  }

  if (pendingSlot === 'seatingMode') {
    if (/single\s*seater/i.test(text)) {
      slots.seatingMode = 'chairs';
      intent = 'table-choice';
      return { slots, intent };
    }
    if (/table\s*(?:and|&|\+)\s*chair/i.test(text)) {
      slots.seatingMode = 'tables';
      intent = 'table-choice';
      return { slots, intent };
    }
  }

  if (pendingSlot === 'arrangement') {
    const arrangement = parseArrangementIntent(text);
    if (arrangement) {
      slots.arrangement = arrangement;
      intent = 'arrangement';
      return { slots, intent };
    }
  }

  if (pendingSlot === 'stage') {
    if (isNegativeIntent(text) || /\bno stage\b/.test(lower)) {
      slots.stage = { wanted: false };
      intent = 'stage-decision';
      return { slots, intent };
    }
    if (isAffirmativeIntent(text) || /\bstage\b/.test(lower)) {
      slots.stage = { ...(state.stage || {}), wanted: true };
      intent = 'stage-decision';
      return { slots, intent };
    }
  }

  if (pendingSlot === 'stageSize') {
    const size = parseStageSize(text);
    if (size) {
      slots.stage = { ...(state.stage || { wanted: true }), spec: { name: 'Stage', width: size.widthMm, height: size.heightMm } };
      intent = 'stage-size';
      return { slots, intent };
    }
  }

  if (pendingSlot === 'stagePlacement') {
    const placement = parseStagePlacement(text);
    if (placement) {
      slots.stage = { ...(state.stage || { wanted: true }), placement };
      intent = 'stage-placement';
      return { slots, intent };
    }
  }

  if (pendingSlot === 'chairsPerTable') {
    const count = parseChairsPerTable(text, true);
    if (count) {
      slots.chairsPerTable = count;
      intent = 'chairs-per-table';
      return { slots, intent };
    }
  }

  if (pendingSlot === 'extras') {
    if (isNegativeIntent(text) || /\bnone\b|\bno extras\b|\bnothing else\b/.test(lower)) {
      slots.extras = 'none';
      intent = 'extras';
      return { slots, intent };
    }
    if (isAffirmativeIntent(text) || /\b(dance floor|entrance|door|vip|buffet|bar|presentation)\b/.test(lower)) {
      slots.extras = 'listed';
      intent = 'extras';
      return { slots, intent };
    }
  }

  if (pendingSlot === 'layoutScale') {
    if (isNegativeIntent(text) || /\bdefault\b|\bkeep (?:it|default)\b|\bas is\b/.test(lower)) {
      slots.layoutScale = 'default-size';
      intent = 'layout-scale';
      return { slots, intent };
    }
    if (isAffirmativeIntent(text) || /\bfit\b|\bscale\b|\bbigger\b|\bmore of the space\b/.test(lower)) {
      slots.layoutScale = 'fit-space';
      intent = 'layout-scale';
      return { slots, intent };
    }
  }

  if (pendingSlot === 'orientation') {
    const orientation = parseOrientation(text);
    if (orientation) {
      slots.orientation = orientation;
      intent = 'orientation';
      return { slots, intent };
    }
  }

  if (pendingSlot === 'confirmation') {
    if (isAffirmativeIntent(text) || /\bgenerate\b|\bproceed\b|\bgo ahead\b|\bdo it\b/.test(lower)) {
      slots.confirmation = 'confirmed';
      intent = 'confirmation';
      return { slots, intent };
    }
    if (isNegativeIntent(text) || /\badd more\b|\bnot yet\b|\bwait\b/.test(lower)) {
      slots.confirmation = 'declined';
      intent = 'confirmation';
      return { slots, intent };
    }
  }

  if (pendingSlot === 'tableType' && text.trim().length > 0 && text.length < 90 && !text.includes('?')) {
    slots.tableType = text.trim();
    intent = 'table-choice';
    return { slots, intent };
  }
  if (pendingSlot === 'chairType' && text.trim().length > 0 && text.length < 90 && !text.includes('?')) {
    slots.chairType = text.trim();
    intent = 'chair-choice';
    return { slots, intent };
  }

  if (pendingSlot === 'marquee' && text.trim().length > 0 && text.length < 90 && !text.includes('?')) {
    slots.marqueeAsset = text.trim();
    intent = 'space-type';
    return { slots, intent };
  }

  return { slots: {}, intent: null };
}

export function extractTurn(text: string, state: FlowState): TurnExtraction {
  const pending = state.pendingQuestion || null;
  const answer = answerToSlots(text, pending, state);
  if (answer.intent) {
    return { intent: answer.intent, slots: answer.slots, found: true };
  }

  const slots: Partial<FlowState> = {};
  let intent: Intent = 'freeform';

  const dims = parseDimensions(text);
  if (dims && !state.widthMm) {
    slots.widthMm = dims.widthMm;
    slots.heightMm = dims.heightMm;
    intent = 'dimensions';
  }

  const guests = extractGuestCount(text);
  if (guests && !state.guestCount) {
    slots.guestCount = guests;
    intent = 'guest-count';
  }

  const space = parseSpaceChoice(text);
  if (space && !state.spaceType) {
    slots.spaceType = space;
    intent = 'space-type';
  }

  const arrangement = parseArrangementIntent(text);
  if (arrangement && !state.arrangement) {
    slots.arrangement = arrangement;
    intent = 'arrangement';
  }

  const orientation = parseOrientation(text);
  if (orientation && !state.orientation) {
    slots.orientation = orientation;
    intent = 'orientation';
  }

  if (/\bstage\b/.test(text.toLowerCase()) && !state.stage) {
    if (isNegativeIntent(text) || /\bno stage\b/.test(text.toLowerCase())) {
      slots.stage = { wanted: false };
      intent = 'stage-decision';
    } else if (/\bstage\b/.test(text.toLowerCase())) {
      const size = parseStageSize(text);
      slots.stage = { wanted: true, ...(size ? { spec: { name: 'Stage', width: size.widthMm, height: size.heightMm } } : {}) };
      intent = 'stage-decision';
    }
  }

  const found = Object.keys(slots).length > 0;
  return { intent, slots, found };
}
