export type Intent =
  | 'new-layout'
  | 'space-type'
  | 'dimensions'
  | 'layout-summary'
  | 'guest-count'
  | 'table-choice'
  | 'chair-choice'
  | 'chairs-per-table'
  | 'arrangement'
  | 'stage-decision'
  | 'stage-size'
  | 'stage-placement'
  | 'extras'
  | 'layout-scale'
  | 'orientation'
  | 'confirmation'
  | 'workspace-op'
  | 'freeform';

export type SpaceType = 'custom' | 'marquee' | 'grassy field' | 'parking lot' | 'beach' | 'preloaded venues';

export type FlowSlot =
  | 'spaceType'
  | 'marquee'
  | 'preloadedVenue'
  | 'dimensions'
  | 'layoutSummary'
  | 'seatingMode'
  | 'guestCount'
  | 'tableType'
  | 'chairType'
  | 'chairsPerTable'
  | 'arrangement'
  | 'stage'
  | 'stageSize'
  | 'stagePlacement'
  | 'extras'
  | 'layoutScale'
  | 'orientation'
  | 'confirmation';

export interface StageSpec {
  name: string;
  width: number;
  height: number;
}

export interface AssetSelectionPayload {
  category: string;
  message: string;
  options?: unknown[];
}

export interface FlowState {
  spaceType?: SpaceType;
  marqueeAsset?: string;
  preloadedVenueAsset?: string;
  widthMm?: number;
  heightMm?: number;
  layoutSummary?: string;
  seatingMode?: 'chairs' | 'tables';
  guestCount?: number;
  tableType?: string;
  chairType?: string;
  chairsPerTable?: number;
  arrangement?: string;
  stage?: { wanted: boolean; spec?: StageSpec; placement?: string };
  extras?: 'none' | 'listed';
  layoutScale?: 'fit-space' | 'default-size';
  orientation?: 'landscape' | 'portrait';
  confirmation?: 'confirmed' | 'declined';
  pendingQuestion?: FlowSlot | null;
  asked?: FlowSlot[];
  phase?: 'opening' | 'space' | 'brief' | 'details' | 'ready';
}

export interface TurnExtraction {
  intent: Intent;
  slots: Partial<FlowState>;
  found: boolean;
}

export interface LocalIntentResult {
  intent: Intent;
  slots?: Partial<FlowState>;
  payload: Record<string, unknown>;
  reset?: boolean;
}

export interface NextQuestion {
  slot: FlowSlot;
  followUp: string;
  choices?: string[];
  assetSelection?: AssetSelectionPayload;
}
