// projectStore.ts - Manages project data (assets, walls, layers)
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { findContainingObjects, findNearestObject, getAnchorsForObject, AnchorType } from '@/utils/snapAnchors';
import { apiRequest } from "@/helpers/Config";
// Temporary type until wallEngine is implemented
export type WallSegment = {
    id: string;
    start: { x: number; y: number };
    end: { x: number; y: number };
    thickness: number;
    rightOffsetLine?: { start: { x: number; y: number }; end: { x: number; y: number } };
};

// ============================================================================
// Types
// ============================================================================

export type Point = {
    x: number;
    y: number;
};

export type WallNode = Point & {
    id: string;
};

export type WallEdge = {
    id: string;
    nodeA: string; // node ID
    nodeB: string; // node ID
    thickness: number; // in mm
};

export type Group = {
    id: string;
    name?: string;
    itemIds: string[];
    zIndex: number;
};

export type Shape = {
    id: string;
    name?: string;
    groupId?: string;
    type: 'rectangle' | 'ellipse' | 'line' | 'arrow' | 'freehand' | 'polygon' | 'arc' | 'path';
    x: number;
    y: number;
    width: number;
    height: number;
    flipX?: boolean;
    flipY?: boolean;
    rotation: number;
    fill?: string;
    stroke?: string;
    strokeWidth?: number;
    points?: { x: number; y: number }[]; // For freehand paths and polygons
    polygonSides?: number; // For regular polygons
    zIndex: number;
    sourceAssetId?: string;
    svgPath?: string; // For custom bezier paths generated via boolean operations

    // Advanced fill options
    fillType?: 'solid' | 'color' | 'gradient' | 'hatch' | 'image' | 'texture' | 'none' | 'hash';
    gradientType?: 'linear' | 'radial';
    gradientColors?: string[]; // Array of color stops
    gradientAngle?: number; // For linear gradients (0-360 degrees)
    hatchPattern?: 'horizontal' | 'vertical' | 'diagonal-right' | 'diagonal-left' | 'cross' | 'diagonal-cross' | 'dots' | 'brick';
    hatchSpacing?: number; // Spacing between hatch lines in pixels
    hatchColor?: string; // Color of hatch pattern
    hatchThickness?: number; // Thickness of hatch lines (default 1)
    hatchRotation?: number; // Rotation of hatch pattern in degrees
    fillImage?: string; // Base64 or URL for image fill
    fillImageScale?: number; // Scale factor for image fill
    fillTexture?: string; // ID of the texture pattern
    fillTextureScale?: number; // Scale for texture pattern
    fillTextureThickness?: number; // Thickness multiplier for texture lines/dots

    // Arrow properties
    // Arrow properties
    arrowHeadType?: 'none' | 'triangle' | 'filled-triangle' | 'circle' | 'square' | 'diamond' | 'field' | 'broadhead' | 'bodkin' | 'blunt' | 'judo' | 'bullet' | 'target' | 'fish' | 'flu-flu' | 'forked';
    arrowTailType?: 'none' | 'bar' | 'circle' | 'square' | 'diamond' | 'triangle' | 'filled-triangle' | 'standard-nock' | 'pin-nock' | 'over-nock' | 'self-nock' | 'flat-nock' | 'g-nock' | 'symmetrical-fletching' | 'offset-fletching' | 'helical-fletching' | 'flu-flu-fletching';
    arrowHeadSize?: number; // Multiplier for head size (default 1)
    arrowTailSize?: number; // Multiplier for tail size (default 1)

    // Line style (for lines and arrows)
    strokeDasharray?: string; // e.g., "5,5" for dashed, "2,2" for dotted, "10,5" for dash-dot, etc.
    lineType?: 'solid' | 'dashed' | 'dotted' | 'double'; // High-level line type

    // Display options
    showDimensions?: boolean;
    dimensionType?: 'linear' | 'aligned' | 'angular' | 'radial' | 'dotted' | 'dashed' | 'solid' | 'circular' | 'double';
    dimensionFontSize?: number;
    dimensionTextPosition?: 'inbetween' | 'above',
    dimensionLabelPosition?: 'top-right' | 'bottom-left';
    dimensionOffset?: number;
    dimensionStrokeWidth?: number;
    dimensionColor?: string;
    dimensionFontFamily?: string;
    dimensionFontWeight?: string;
    dimensionFontStyle?: string;
    dimensionTextDecoration?: string;
    borderRadius?: number;
    tableName?: string;
    showTableName?: boolean;
    tableNumberingPosition?: 'center' | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'top' | 'bottom' | 'middle-left' | 'middle-right';
    tableNumberingOrientation?: 'horizontal' | 'vertical';
    tableNumberingFontSize?: number;
    tableNumberingFontFamily?: string;
    tableNumberingFontWeight?: string;
    tableNumberingFontStyle?: string;
    tableNumberingTextDecoration?: string;
    tableNumberingColor?: string;
};

export type Asset = {
    id: string;
    name?: string;
    groupId?: string;
    type: string; // e.g., 'chair', 'table', 'door', 'window'
    tableName?: string; // e.g., 'Table 1' or '1'
    showTableName?: boolean;
    x: number;
    y: number;
    width: number;
    height: number;
    rotation: number;
    scale: number;
    zIndex: number;
    attachedToWallId?: string; // For doors/windows attached to walls
    metadata?: Record<string, any>;
    isExploded?: boolean;
    childShapeIds?: string[];
    flipX?: boolean;
    flipY?: boolean;

    // Visual properties
    fillColor?: string;
    strokeColor?: string;
    strokeWidth?: number;
    opacity?: number;
    fillType?: 'solid' | 'color' | 'gradient' | 'hatch' | 'image' | 'texture' | 'none' | 'hash';
    fillTexture?: string;
    hatchPattern?: 'horizontal' | 'vertical' | 'diagonal-right' | 'diagonal-left' | 'cross' | 'diagonal-cross' | 'dots' | 'brick';
    hatchRotation?: number;

    // Text properties
    text?: string;
    fontSize?: number;
    textColor?: string;
    fontFamily?: string;

    // Group properties
    isGroup?: boolean;
    // childShapeIds already exists above

    // Line/Wall properties
    lineColor?: string;
    lineGap?: number;
    wallThickness?: number;
    wallGap?: number;
    backgroundColor?: string;
    fillTextureThickness?: number;

    // Display options
    showDimensions?: boolean;
    dimensionType?: 'linear' | 'aligned' | 'angular' | 'radial' | 'dotted' | 'dashed' | 'solid' | 'circular' | 'double';
    dimensionFontSize?: number;
    dimensionTextPosition?: 'inbetween' | 'above' | 'below',
    dimensionLabelPosition?: 'top-right' | 'bottom-left';
    dimensionOffset?: number;
    dimensionStrokeWidth?: number;
    dimensionColor?: string;
    dimensionFontFamily?: string;
    dimensionFontWeight?: string;
    dimensionFontStyle?: string;
    dimensionTextDecoration?: string;
    borderRadius?: number;
    tableNumberingPosition?: 'center' | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'top' | 'bottom' | 'middle-left' | 'middle-right';
    tableNumberingOrientation?: 'horizontal' | 'vertical';
    tableNumberingFontSize?: number;
    tableNumberingFontFamily?: string;
    tableNumberingFontWeight?: string;
    tableNumberingFontStyle?: string;
    tableNumberingTextDecoration?: string;
    tableNumberingColor?: string;
    tableColor?: string;
    chairColor?: string;
};


export type Wall = {
    id: string;
    name?: string;
    groupId?: string;
    nodes: WallNode[];
    edges: WallEdge[];
    fill?: string;
    stroke?: string; // New: Color for wall stroke
    strokeWidth?: number; // New: Width for wall stroke
    fillType?: 'solid' | 'color' | 'texture' | 'hash' | 'hatch';
    fillTexture?: string;
    hatchPattern?: 'horizontal' | 'vertical' | 'diagonal-right' | 'diagonal-left' | 'cross' | 'diagonal-cross' | 'dots' | 'brick';
    hatchRotation?: number;
    fillTextureScale?: number;
    fillTextureThickness?: number;
    isClosed?: boolean; // For closed loops
    zIndex: number;
    showDimensions?: boolean;
    dimensionType?: 'linear' | 'aligned' | 'angular' | 'radial' | 'dotted' | 'dashed' | 'solid' | 'circular' | 'double';
    dimensionFontSize?: number;
    dimensionTextPosition?: 'inbetween' | 'above' | 'below',
    dimensionLabelPosition?: 'top-right' | 'bottom-left';
    dimensionOffset?: number;
    dimensionStrokeWidth?: number;
    dimensionColor?: string;
    dimensionFontFamily?: string;
    dimensionFontWeight?: string;
    dimensionFontStyle?: string;
    dimensionTextDecoration?: string;
};

export type Layer = {
    id: string;
    name: string;
    visible: boolean;
    locked: boolean;
    assetIds: string[];
    wallIds: string[];
    shapeIds: string[];
};

export type Canvas = {
    width: number;
    height: number;
    unit: 'mm' | 'cm' | 'm';
};

export interface Dimension {
    id: string;
    name?: string;
    type: 'linear' | 'aligned' | 'angular' | 'radial' | 'dotted' | 'dashed' | 'solid' | 'circular' | 'double';
    startPoint: { x: number; y: number };
    endPoint: { x: number; y: number };
    centerPoint?: { x: number; y: number }; // For angular/radial
    offset: number;

    value?: number; // Optional manual override or cached value
    targetId?: string; // ID of the object being measured (e.g., wall ID)
    targetIds?: string[]; // IDs of objects touched by a manual dimension

    // Visual properties
    color?: string;
    fontSize?: number;
    fontFamily?: string;
    fontWeight?: string;
    fontStyle?: string;
    textDecoration?: string;
    strokeWidth?: number;
    lineStyle?: 'solid' | 'dashed' | 'dotted' | 'double';
    textPosition?: 'inbetween' | 'above' | 'below';
    labelPosition?: 'top-right' | 'bottom-left';

    zIndex?: number;
    groupId?: string;
}

export type Comment = {
    id: string;
    x: number;
    y: number;
    content: string;
    author: string;
    timestamp: number;
    resolved: boolean;
    color?: string;
    userId?: string;
    createdAt?: string;
};

export type TextAnnotation = {
    id: string;
    name?: string;
    groupId?: string;
    x: number;
    y: number;
    text: string;
    fontSize?: number;
    color?: string;
    fontFamily?: string;
    fontWeight?: string;
    fontStyle?: string;
    textDecoration?: string;
    backgroundColor?: string;
    rotation?: number; // Rotation in degrees
    zIndex: number;
    textAlign?: 'left' | 'center' | 'right' | 'justify';
    lineHeight?: number;
};

export type LabelArrow = {
    id: string;
    name?: string;
    groupId?: string;
    startPoint: { x: number; y: number };
    endPoint: { x: number; y: number };
    label: string;
    fontSize?: number;
    fontFamily?: string;
    fontWeight?: string;
    fontStyle?: string;
    textDecoration?: string;
    color?: string;
    strokeWidth?: number;
    arrowHeadType?: 'none' | 'triangle' | 'filled-triangle' | 'open' | 'circle' | 'square' | 'diamond' | 'bar';
    arrowTailType?: 'none' | 'triangle' | 'filled-triangle' | 'open' | 'circle' | 'square' | 'diamond' | 'bar';
    arrowHeadSize?: number;
    arrowTailSize?: number;
    textPosition?: 'top' | 'middle' | 'bottom';
    backgroundColor?: string;
    zIndex: number;
};

export type ProjectSnapshot = {
    walls: Wall[];
    wallSegments: WallSegment[];
    shapes: Shape[];
    assets: Asset[];
    textAnnotations: TextAnnotation[];
    labelArrows: LabelArrow[];
    dimensions: Dimension[];
    groups: Group[];
    layers: Layer[];
    activeLayerId: string | null;
    comments: Comment[];
    canvas: Canvas;
};

// ============================================================================
// Store
// ============================================================================

export type ProjectState = {
    // Project metadata
    projectId: string | null;
    projectName: string;
    setProjectName: (name: string) => void;
    setEventName?: (name: string) => void; // Added for flexibility

    // Canvas
    canvas: Canvas;

    // Data
    walls: Wall[]; // Legacy wall system (node-edge based)
    wallSegments: WallSegment[]; // New wall engine (segment-based)
    shapes: Shape[];
    assets: Asset[];
    comments: Comment[];
    textAnnotations: TextAnnotation[];
    labelArrows: LabelArrow[];
    layers: Layer[];
    groups: Group[];

    // Global Labeling Settings
    globalTableNumberingPosition: 'center' | 'top' | 'bottom' | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'middle-left' | 'middle-right';
    globalTableNumberingOrientation: 'horizontal' | 'vertical';
    globalTableNumberingFontSize: number;
    globalTableNumberingFontFamily: string;
    globalTableNumberingFontWeight: string;
    globalTableNumberingFontStyle: string;
    globalTableNumberingTextDecoration: string;
    globalTableNumberingColor: string;
    setGlobalTableNumberingPosition: (pos: 'center' | 'top' | 'bottom' | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'middle-left' | 'middle-right', updateAll?: boolean) => void;
    setGlobalTableNumberingOrientation: (orientation: 'horizontal' | 'vertical', updateAll?: boolean) => void;
    setGlobalTableNumberingTextStyle: (updates: {
        fontSize?: number;
        fontFamily?: string;
        fontWeight?: string;
        fontStyle?: string;
        textDecoration?: string;
        color?: string;
    }, updateAll?: boolean) => void;

    // Active layer
    activeLayerId: string | null;

    // Grouping Actions
    groupSelection: (selectedIds: string[]) => string; // Returns new group ID
    ungroupSelection: (selectedIds: string[]) => string[]; // Returns ungrouped item IDs

    // Alignment & Distribution
    alignSelection: (type: 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom', ids: string[]) => void;
    distributeSelection: (axis: 'horizontal' | 'vertical', spacing: number, ids: string[], skipHistory?: boolean) => void;
    distributeRadial: (diameter: number, startAngle: number, endAngle: number, ids: string[], skipHistory?: boolean) => void;
    resolveIdsWithGroups: (ids: string[]) => string[];

    // History
    history: {
        past: ProjectSnapshot[];
        future: ProjectSnapshot[];
    };

    // Persistence
    isSaving: boolean;
    lastSaved: Date | null;
    hasUnsavedChanges: boolean;

    // Actions
    setCanvasSize: (width: number, height: number, unit: 'mm' | 'cm' | 'm') => void;
    splitWallAtIntersection: (wallId: string, point: Point) => void;

    // Persistence Actions
    clearWorkspace: () => void;
    loadEvent: (eventId: string, slug: string) => Promise<void>;
    saveEvent: (eventId: string, slug: string) => Promise<void>;

    // Shape Actions
    setCanvas: (canvas: Canvas) => void;

    // Methods - Walls (Legacy)
    addWall: (wall: Wall, skipHistory?: boolean) => void;
    addWallBatch: (walls: Wall[], skipHistory?: boolean) => void;
    updateWall: (id: string, updates: Partial<Wall>, skipHistory?: boolean) => void;
    updateWallBatch: (ids: string[], updates: Partial<Wall>, skipHistory?: boolean) => void;
    batchUpdateWalls: (updates: { id: string; updates: Partial<Wall> }[], skipHistory?: boolean) => void;
    removeWall: (id: string, skipHistory?: boolean) => void;
    getWall: (id: string) => Wall | undefined;

    // Methods - Wall Segments (New Engine)
    addWallSegment: (segment: WallSegment) => void;
    updateWallSegment: (id: string, updates: Partial<WallSegment>) => void;
    removeWallSegment: (id: string) => void;
    getWallSegment: (id: string) => WallSegment | undefined;
    setWallSegments: (segments: WallSegment[]) => void;

    // Wall node/edge operations
    addWallNode: (wallId: string, node: WallNode) => void;
    updateWallNode: (wallId: string, nodeId: string, updates: Partial<Point>) => void;
    removeWallNode: (wallId: string, nodeId: string, skipHistory?: boolean) => void;

    addWallEdge: (wallId: string, edge: WallEdge) => void;
    updateWallEdge: (wallId: string, edgeId: string, updates: Partial<WallEdge>) => void;
    removeWallEdge: (wallId: string, edgeId: string, skipHistory?: boolean) => void;

    // Methods - Shapes
    addShape: (shape: Shape, skipHistory?: boolean) => void;
    addShapeBatch: (shapes: Shape[], skipHistory?: boolean) => void;
    updateShape: (id: string, updates: Partial<Shape>, skipHistory?: boolean) => void;
    updateShapeBatch: (ids: string[], updates: Partial<Shape>, skipHistory?: boolean) => void;
    batchUpdateShapes: (updates: { id: string; updates: Partial<Shape> }[], skipHistory?: boolean) => void;
    removeShape: (id: string, skipHistory?: boolean) => void;
    getShape: (id: string) => Shape | undefined;

    // Methods - Assets
    addAsset: (asset: Asset, skipHistory?: boolean) => void;
    addAssetBatch: (assets: Asset[], skipHistory?: boolean) => void;
    updateAsset: (id: string, updates: Partial<Asset>, skipHistory?: boolean) => void;
    updateAssetBatch: (ids: string[], updates: Partial<Asset>, skipHistory?: boolean) => void;
    batchUpdateAssets: (updates: { id: string; updates: Partial<Asset> }[], skipHistory?: boolean) => void;
    removeAsset: (id: string, skipHistory?: boolean) => void;
    getAsset: (id: string) => Asset | undefined;

    // Methods - Layers
    addLayer: (layer: Layer) => void;
    updateLayer: (id: string, updates: Partial<Layer>) => void;
    removeLayer: (id: string) => void;
    setActiveLayer: (id: string) => void;

    // Methods - History
    undo: () => void;
    redo: () => void;
    saveToHistory: () => void;
    clearHistory: () => void;
    commitDragHistory: (snapshot: ProjectSnapshot) => void;

    // Methods - Utility
    getNextZIndex: () => number;
    markAsSaved: () => void;
    reset: () => void;

    // Methods - Snap
    snapToAnchor: (selectedId: string, anchorType: string, targetObjectId?: string) => void;

    // Methods - Clipboard
    clipboard: Array<{ type: 'shape' | 'wall' | 'asset' | 'textAnnotation' | 'labelArrow' | 'dimension'; data: any }>;
    copySelection: (selectedIds: string[]) => void;
    cutSelection: (selectedIds: string[]) => void;
    pasteSelection: (cursorPos?: { x: number; y: number }) => string[]; // Returns new IDs for selection
    removeItemsBatch: (ids: string[], skipHistory?: boolean) => void;
    batchUpdateItems: (items: { id: string; type: 'shape' | 'asset' | 'wall' | 'dimension' | 'textAnnotation' | 'labelArrow'; updates: any }[], skipHistory?: boolean) => void;

    // Methods - Dimensions
    dimensions: Dimension[];
    addDimension: (dimension: Dimension, skipHistory?: boolean) => void;
    updateDimension: (id: string, updates: Partial<Dimension>, skipHistory?: boolean) => void;
    removeDimension: (id: string, skipHistory?: boolean) => void;

    // Methods - Text Annotations
    addTextAnnotation: (annotation: TextAnnotation, skipHistory?: boolean) => void;
    updateTextAnnotation: (id: string, updates: Partial<TextAnnotation>, skipHistory?: boolean) => void;
    removeTextAnnotation: (id: string, skipHistory?: boolean) => void;

    // Methods - Label Arrows
    addLabelArrow: (arrow: LabelArrow, skipHistory?: boolean) => void;
    updateLabelArrow: (id: string, updates: Partial<LabelArrow>, skipHistory?: boolean) => void;
    removeLabelArrow: (id: string, skipHistory?: boolean) => void;

    // Methods - Comments
    addComment: (comment: Comment, skipHistory?: boolean) => void;
    updateComment: (id: string, updates: Partial<Comment>) => void;
    removeComment: (id: string, skipHistory?: boolean) => void;
    resolveComment: (id: string) => void;

    // Methods - Groups
    addGroup: (group: Group, skipHistory?: boolean) => void;
    updateGroup: (id: string, updates: Partial<Group>) => void;
    removeGroup: (id: string) => void;

    // Methods - Wall Junctions
    splitWallEdge: (wallId: string, edgeId: string, point: { x: number; y: number }, skipHistory?: boolean) => WallNode;
    connectWallToEdge: (
        sourceWallId: string,
        sourceNodeId: string,
        targetWallId: string,
        targetEdgeId: string,
        point: { x: number; y: number },
        skipHistory?: boolean
    ) => void;
};

const DEFAULT_CANVAS: Canvas = {
    width: 10000,
    height: 10000,
    unit: 'mm',
};

const DEFAULT_LAYER: Layer = {
    id: 'layer-default',
    name: 'Default Layer',
    visible: true,
    locked: false,
    assetIds: [],
    wallIds: [],
    shapeIds: [],
};

const SHARED_WALL_STYLE_KEYS: Array<keyof Wall> = [
    'fill',
    'stroke',
    'strokeWidth',
    'fillType',
    'fillTexture',
    'fillTextureScale',
    'fillTextureThickness',
    'showDimensions',
    'dimensionType',
    'dimensionFontSize',
    'dimensionTextPosition',
    'dimensionLabelPosition',
    'dimensionOffset',
    'dimensionStrokeWidth',
    'dimensionColor',
    'dimensionFontFamily',
    'dimensionFontWeight',
    'dimensionFontStyle',
    'dimensionTextDecoration',
];

const getSharedWallStyleUpdates = (updates: Partial<Wall>): Partial<Wall> => {
    const sharedUpdates: Partial<Wall> = {};
    SHARED_WALL_STYLE_KEYS.forEach((key) => {
        if (key in updates) {
            (sharedUpdates as any)[key] = (updates as any)[key];
        }
    });
    return sharedUpdates;
};

const normalizeLegacyWallStroke = (...values: Array<string | undefined | null>) => {
    const stroke = values.find((value) => value && value !== 'none');
    return stroke?.toUpperCase() === '#1E40AF' ? '#1f2937' : (stroke || '#1f2937');
};

const getWallEdgePoints = (wall: Wall, edge: WallEdge) => {
    const nodeA = wall.nodes.find((node) => node.id === edge.nodeA);
    const nodeB = wall.nodes.find((node) => node.id === edge.nodeB);
    return nodeA && nodeB ? { nodeA, nodeB } : null;
};

const wallsTouchOrBlend = (wallA: Wall, wallB: Wall) => {
    const pointTolerance = 2;
    const lineTolerance = 1.5;

    if (wallA.nodes.some((a) => wallB.nodes.some((b) => Math.hypot(a.x - b.x, a.y - b.y) <= pointTolerance))) {
        return true;
    }

    for (const edgeA of wallA.edges) {
        const pointsA = getWallEdgePoints(wallA, edgeA);
        if (!pointsA) continue;

        for (const edgeB of wallB.edges) {
            const pointsB = getWallEdgePoints(wallB, edgeB);
            if (!pointsB) continue;

            const { nodeA: a1, nodeB: a2 } = pointsA;
            const { nodeA: b1, nodeB: b2 } = pointsB;
            const ax = a2.x - a1.x;
            const ay = a2.y - a1.y;
            const bx = b2.x - b1.x;
            const by = b2.y - b1.y;
            const denom = ax * by - ay * bx;

            if (Math.abs(denom) > 0.0001) {
                const cx = b1.x - a1.x;
                const cy = b1.y - a1.y;
                const t = (cx * by - cy * bx) / denom;
                const u = (cx * ay - cy * ax) / denom;
                if (t >= -0.01 && t <= 1.01 && u >= -0.01 && u <= 1.01) return true;
                continue;
            }

            const lenSq = ax * ax + ay * ay;
            if (lenSq < 0.0001) continue;
            const lineDistanceA = Math.abs((b1.x - a1.x) * ay - (b1.y - a1.y) * ax) / Math.sqrt(lenSq);
            const lineDistanceB = Math.abs((b2.x - a1.x) * ay - (b2.y - a1.y) * ax) / Math.sqrt(lenSq);
            if (lineDistanceA > lineTolerance || lineDistanceB > lineTolerance) continue;

            const projectionA = ((b1.x - a1.x) * ax + (b1.y - a1.y) * ay) / lenSq;
            const projectionB = ((b2.x - a1.x) * ax + (b2.y - a1.y) * ay) / lenSq;
            const overlapStart = Math.max(0, Math.min(projectionA, projectionB));
            const overlapEnd = Math.min(1, Math.max(projectionA, projectionB));
            if (overlapEnd - overlapStart > 0.001) return true;
        }
    }

    return false;
};

const getBlendedWallGroupIds = (walls: Wall[], seedIds: string[]) => {
    const visited = new Set(seedIds);
    const queue = [...seedIds];

    while (queue.length > 0) {
        const currentId = queue.shift()!;
        const currentWall = walls.find((wall) => wall.id === currentId);
        if (!currentWall) continue;

        walls.forEach((candidate) => {
            if (visited.has(candidate.id) || candidate.id === currentWall.id) return;
            if (!wallsTouchOrBlend(currentWall, candidate)) return;
            visited.add(candidate.id);
            queue.push(candidate.id);
        });
    }

    return visited;
};

export const useProjectStore = create<ProjectState>()(
    persist(
        (set, get) => ({
            // Initial state
            projectId: null,
            projectName: 'Untitled Project',
            setProjectName: (name) => set({ projectName: name }),
            canvas: DEFAULT_CANVAS,
            walls: [],
            wallSegments: [], // New wall engine segments
            shapes: [],
            assets: [],
            groups: [],
            layers: [DEFAULT_LAYER],
            activeLayerId: DEFAULT_LAYER.id,
            history: {
                past: [],
                future: [],
            },
            hasUnsavedChanges: false,
            isSaving: false,
            lastSaved: null,
            clipboard: [],
            dimensions: [],
            comments: [],
            textAnnotations: [],
            labelArrows: [],
            globalTableNumberingPosition: 'center',
            globalTableNumberingOrientation: 'horizontal',
            globalTableNumberingFontSize: 0,
            globalTableNumberingFontFamily: 'Inter, sans-serif',
            globalTableNumberingFontWeight: '900',
            globalTableNumberingFontStyle: 'normal',
            globalTableNumberingTextDecoration: 'none',
            globalTableNumberingColor: '#000000',

            setGlobalTableNumberingPosition: (pos, updateAll) => {
                set({ globalTableNumberingPosition: pos, hasUnsavedChanges: true });
                if (updateAll) {
                  const { assets, shapes } = get();
                  const tableAssets = assets.filter(a => (a.type || "").toLowerCase().includes('table'));
                  const tableShapes = shapes.filter(s => (s.name || "").toLowerCase().includes('table'));
                  
                  get().batchUpdateItems([
                    ...tableAssets.map(a => ({ id: a.id, type: 'asset' as const, updates: { tableNumberingPosition: pos } })),
                    ...tableShapes.map(s => ({ id: s.id, type: 'shape' as const, updates: { tableNumberingPosition: pos } }))
                  ]);
                }
            },

            setGlobalTableNumberingOrientation: (orientation, updateAll) => {
                set({ globalTableNumberingOrientation: orientation, hasUnsavedChanges: true });
                if (updateAll) {
                  const { assets, shapes } = get();
                  const tableAssets = assets.filter(a => (a.type || "").toLowerCase().includes('table'));
                  const tableShapes = shapes.filter(s => (s.name || "").toLowerCase().includes('table'));
                  
                  get().batchUpdateItems([
                    ...tableAssets.map(a => ({ id: a.id, type: 'asset' as const, updates: { tableNumberingOrientation: orientation } })),
                    ...tableShapes.map(s => ({ id: s.id, type: 'shape' as const, updates: { tableNumberingOrientation: orientation } }))
                  ]);
                }
            },

            setGlobalTableNumberingTextStyle: (updates, updateAll) => {
                const storeUpdates: Partial<ProjectState> = {
                    hasUnsavedChanges: true,
                };

                if (updates.fontSize !== undefined) storeUpdates.globalTableNumberingFontSize = updates.fontSize;
                if (updates.fontFamily !== undefined) storeUpdates.globalTableNumberingFontFamily = updates.fontFamily;
                if (updates.fontWeight !== undefined) storeUpdates.globalTableNumberingFontWeight = updates.fontWeight;
                if (updates.fontStyle !== undefined) storeUpdates.globalTableNumberingFontStyle = updates.fontStyle;
                if (updates.textDecoration !== undefined) storeUpdates.globalTableNumberingTextDecoration = updates.textDecoration;
                if (updates.color !== undefined) storeUpdates.globalTableNumberingColor = updates.color;

                set(storeUpdates);

                if (updateAll) {
                    const { assets, shapes } = get();
                    const tableAssets = assets.filter(a => (a.type || "").toLowerCase().includes('table'));
                    const tableShapes = shapes.filter(s => (s.name || "").toLowerCase().includes('table'));
                    const itemUpdates: any = {};

                    if (updates.fontSize !== undefined) itemUpdates.tableNumberingFontSize = updates.fontSize;
                    if (updates.fontFamily !== undefined) itemUpdates.tableNumberingFontFamily = updates.fontFamily;
                    if (updates.fontWeight !== undefined) itemUpdates.tableNumberingFontWeight = updates.fontWeight;
                    if (updates.fontStyle !== undefined) itemUpdates.tableNumberingFontStyle = updates.fontStyle;
                    if (updates.textDecoration !== undefined) itemUpdates.tableNumberingTextDecoration = updates.textDecoration;
                    if (updates.color !== undefined) itemUpdates.tableNumberingColor = updates.color;

                    get().batchUpdateItems([
                        ...tableAssets.map(a => ({ id: a.id, type: 'asset' as const, updates: itemUpdates })),
                        ...tableShapes.map(s => ({ id: s.id, type: 'shape' as const, updates: itemUpdates }))
                    ]);
                }
            },

            // Canvas methods
            setCanvas: (canvas) => {
                set({ canvas, hasUnsavedChanges: true });
            },

            setCanvasSize: (width, height, unit) => {
                set((state) => ({
                    canvas: { ...state.canvas, width, height, unit },
                    hasUnsavedChanges: true
                }));
            },

            splitWallAtIntersection: (wallId, point) => {
                get().saveToHistory();
                set((state) => {
                    const wall = state.walls.find((w) => w.id === wallId);
                    if (!wall) return state;

                    // Find the edge that contains the point
                    const nodeMap = new Map(wall.nodes.map((n) => [n.id, n]));
                    let targetEdge: WallEdge | null = null;
                    let t = 0; // Parameter along the edge (0 to 1)

                    for (const edge of wall.edges) {
                        const nodeA = nodeMap.get(edge.nodeA);
                        const nodeB = nodeMap.get(edge.nodeB);
                        if (!nodeA || !nodeB) continue;

                        // Calculate distance from point to line segment
                        const dx = nodeB.x - nodeA.x;
                        const dy = nodeB.y - nodeA.y;
                        const length = Math.sqrt(dx * dx + dy * dy);
                        if (length === 0) continue;

                        const toPointX = point.x - nodeA.x;
                        const toPointY = point.y - nodeA.y;
                        const tValue = (toPointX * dx + toPointY * dy) / (length * length);

                        // Check if point is on the edge (with tolerance)
                        if (tValue >= 0 && tValue <= 1) {
                            const projX = nodeA.x + tValue * dx;
                            const projY = nodeA.y + tValue * dy;
                            const dist = Math.sqrt(
                                (point.x - projX) ** 2 + (point.y - projY) ** 2
                            );

                            // Tolerance: 5mm
                            if (dist < 5) {
                                targetEdge = edge;
                                t = tValue;
                                break;
                            }
                        }
                    }

                    if (!targetEdge) return state;

                    // Create new node at intersection point
                    const newNodeId = `node-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
                    const newNode: WallNode = {
                        id: newNodeId,
                        x: point.x,
                        y: point.y,
                    };

                    // Split the edge into two edges
                    const nodeA = nodeMap.get(targetEdge.nodeA);
                    const nodeB = nodeMap.get(targetEdge.nodeB);
                    if (!nodeA || !nodeB) return state;

                    const newEdge1Id = `edge-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
                    const newEdge2Id = `edge-${Date.now() + 1}-${Math.random().toString(36).slice(2, 11)}`;

                    const newEdge1: WallEdge = {
                        id: newEdge1Id,
                        nodeA: targetEdge.nodeA,
                        nodeB: newNodeId,
                        thickness: targetEdge.thickness,
                    };

                    const newEdge2: WallEdge = {
                        id: newEdge2Id,
                        nodeA: newNodeId,
                        nodeB: targetEdge.nodeB,
                        thickness: targetEdge.thickness,
                    };

                    // Update wall with new node and split edges
                    const updatedWalls = state.walls.map((w) =>
                        w.id === wallId
                            ? {
                                ...w,
                                nodes: [...w.nodes, newNode],
                                edges: [
                                    ...w.edges.filter((e) => e.id !== targetEdge.id),
                                    newEdge1,
                                    newEdge2,
                                ],
                            }
                            : w
                    );

                    return {
                        walls: updatedWalls,
                        hasUnsavedChanges: true,
                    };
                });
            },

            setProjectId: (id: string | null) => {
                set({ projectId: id });
            },

            groupSelection: (selectedIds: string[]) => {
                get().saveToHistory();
                const newGroupId = `group-${Date.now()}`;
                const newGroup: Group = {
                    id: newGroupId,
                    itemIds: selectedIds,
                    zIndex: get().getNextZIndex(),
                };

                const updates = { groupId: newGroupId };
                const { shapes, assets, walls, textAnnotations, labelArrows, dimensions } = get();

                const updateCollection = (collection: any[], ids: string[]) =>
                    collection.map(item => ids.includes(item.id) ? { ...item, ...updates } : item);

                set({
                    groups: [...get().groups, newGroup],
                    shapes: updateCollection(shapes, selectedIds),
                    assets: updateCollection(assets, selectedIds),
                    walls: updateCollection(walls, selectedIds),
                    textAnnotations: updateCollection(textAnnotations, selectedIds),
                    labelArrows: updateCollection(labelArrows, selectedIds),
                    dimensions: updateCollection(dimensions, selectedIds),
                    hasUnsavedChanges: true
                });
                return newGroupId;
            },

            ungroupSelection: (selectedIds: string[]) => {
                get().saveToHistory();
                const { groups, shapes, assets, walls, textAnnotations, labelArrows } = get();

                const groupsToRemove = new Set<string>();

                selectedIds.forEach(id => {
                    // Check if id is a group
                    const group = groups.find(g => g.id === id);
                    if (group) {
                        groupsToRemove.add(group.id);
                    } else {
                        // Check if id is an item in a group
                        const shape = shapes.find(s => s.id === id);
                        if (shape?.groupId) groupsToRemove.add(shape.groupId);

                        const asset = assets.find(a => a.id === id);
                        if (asset?.groupId) groupsToRemove.add(asset.groupId);

                        const wall = walls.find(w => w.id === id);
                        if (wall?.groupId) groupsToRemove.add(wall.groupId);

                        const text = textAnnotations.find(t => t.id === id);
                        if (text?.groupId) groupsToRemove.add(text.groupId);

                        const arrow = labelArrows.find(l => l.id === id);
                        if (arrow?.groupId) groupsToRemove.add(arrow.groupId);
                    }
                });

                if (groupsToRemove.size === 0) return [];

                // Remove groups
                const newGroups = groups.filter(g => !groupsToRemove.has(g.id));

                // Remove groupId from items
                const removeGroupId = (item: any) => {
                    if (item.groupId && groupsToRemove.has(item.groupId)) {
                        const { groupId, ...rest } = item;
                        return rest;
                    }
                    return item;
                };

                set({
                    groups: newGroups,
                    shapes: shapes.map(removeGroupId),
                    assets: assets.map(removeGroupId),
                    walls: walls.map(removeGroupId),
                    textAnnotations: textAnnotations.map(removeGroupId),
                    labelArrows: labelArrows.map(removeGroupId),
                    hasUnsavedChanges: true
                });

                // Return all item IDs that were ungrouped
                const ungroupedItemIds: string[] = [];
                groupsToRemove.forEach(gId => {
                    const group = groups.find(g => g.id === gId);
                    if (group) ungroupedItemIds.push(...group.itemIds);
                });

                return ungroupedItemIds;
            },

            alignSelection: (type, ids) => {
                const { shapes, assets, walls, textAnnotations, groups } = get();
                
                // Identify top-level IDs
                const topLevelIds = new Set<string>();
                ids.forEach(id => {
                    const item = shapes.find(s => s.id === id) || 
                                 assets.find(a => a.id === id) || 
                                 walls.find(w => w.id === id) || 
                                 textAnnotations.find(t => t.id === id);
                    if (item?.groupId) {
                        topLevelIds.add(item.groupId);
                    } else {
                        topLevelIds.add(id);
                    }
                });

                const finalIds = Array.from(topLevelIds);
                if (finalIds.length < 2) return;
                get().saveToHistory();

                const items: { id: string, type: 'item' | 'group', x: number, y: number, w: number, h: number, memberIds: string[] }[] = [];
                
                finalIds.forEach(id => {
                    const group = groups.find(g => g.id === id);
                    if (group) {
                        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
                        const members = [...shapes, ...assets, ...walls, ...textAnnotations].filter(i => i.groupId === group.id);
                        members.forEach(m => {
                            if ('nodes' in m) {
                                m.nodes.forEach(n => {
                                    minX = Math.min(minX, n.x); minY = Math.min(minY, n.y);
                                    maxX = Math.max(maxX, n.x); maxY = Math.max(maxY, n.y);
                                });
                            } else {
                                const mAny = m as any;
                                const w = (mAny.width || 0) * (mAny.scale || 1);
                                const h = (mAny.height || 0) * (mAny.scale || 1);
                                minX = Math.min(minX, mAny.x - w/2);
                                minY = Math.min(minY, mAny.y - h/2);
                                maxX = Math.max(maxX, mAny.x + w/2);
                                maxY = Math.max(maxY, mAny.y + h/2);
                            }
                        });
                        items.push({ id: group.id, type: 'group', x: (minX + maxX) / 2, y: (minY + maxY) / 2, w: maxX - minX, h: maxY - minY, memberIds: group.itemIds });
                    } else {
                        const item = shapes.find(s => s.id === id) || 
                                     assets.find(a => a.id === id) || 
                                     walls.find(w => w.id === id) || 
                                     textAnnotations.find(t => t.id === id);
                        if (!item) return;

                        let x = (item as any).x, y = (item as any).y, w = (item as any).width || 0, h = (item as any).height || 0;
                        if ('nodes' in item) {
                            const xs = item.nodes.map((n: any) => n.x);
                            const ys = item.nodes.map((n: any) => n.y);
                            w = Math.max(...xs) - Math.min(...xs);
                            h = Math.max(...ys) - Math.min(...ys);
                            x = (Math.min(...xs) + Math.max(...xs)) / 2;
                            y = (Math.min(...ys) + Math.max(...ys)) / 2;
                        } else if ('scale' in (item as any)) {
                            w = (item as any).width * ((item as any).scale || 1);
                            h = (item as any).height * ((item as any).scale || 1);
                        }
                        items.push({ id, type: 'item', x, y, w, h, memberIds: [id] });
                    }
                });

                if (items.length < 2) return;

                let minX = Math.min(...items.map(i => i.x - i.w / 2));
                let maxX = Math.max(...items.map(i => i.x + i.w / 2));
                let minY = Math.min(...items.map(i => i.y - i.h / 2));
                let maxY = Math.max(...items.map(i => i.y + i.h / 2));
                let centerX = (minX + maxX) / 2;
                let centerY = (minY + maxY) / 2;

                items.forEach(item => {
                    let newX = item.x;
                    let newY = item.y;

                    switch (type) {
                        case 'left': newX = minX + item.w / 2; break;
                        case 'center': newX = centerX; break;
                        case 'right': newX = maxX - item.w / 2; break;
                        case 'top': newY = minY + item.h / 2; break;
                        case 'middle': newY = centerY; break;
                        case 'bottom': newY = maxY - item.h / 2; break;
                    }

                    const dx = newX - item.x;
                    const dy = newY - item.y;

                    item.memberIds.forEach(mid => {
                        const s = shapes.find(sh => sh.id === mid);
                        if (s) get().updateShape(mid, { x: s.x + dx, y: s.y + dy }, true);
                        const a = assets.find(as => as.id === mid);
                        if (a) get().updateAsset(mid, { x: a.x + dx, y: a.y + dy }, true);
                        const w = walls.find(wa => wa.id === mid);
                        if (w) get().updateWall(mid, { nodes: w.nodes.map(n => ({ ...n, x: n.x + dx, y: n.y + dy })) }, true);
                        const t = textAnnotations.find(ta => ta.id === mid);
                        if (t) get().updateTextAnnotation(mid, { x: t.x + dx, y: t.y + dy }, true);
                    });
                });
            },


            distributeSelection: (axis, spacing, ids, skipHistory = false) => {
                const { shapes, assets, walls, textAnnotations, groups } = get();
                
                // Identify top-level IDs (if an item is in a group, use the group ID)
                const topLevelIds = new Set<string>();
                ids.forEach(id => {
                    const item = shapes.find(s => s.id === id) || 
                                 assets.find(a => a.id === id) || 
                                 walls.find(w => w.id === id) || 
                                 textAnnotations.find(t => t.id === id);
                    if (item?.groupId) {
                        topLevelIds.add(item.groupId);
                    } else {
                        topLevelIds.add(id);
                    }
                });

                const finalIds = Array.from(topLevelIds);
                if (finalIds.length < 2) return;
                if (!skipHistory) get().saveToHistory();

                const items: { id: string, type: 'item' | 'group', x: number, y: number, w: number, h: number, memberIds: string[] }[] = [];
                
                finalIds.forEach(id => {
                    const group = groups.find(g => g.id === id);
                    if (group) {
                        // Calculate group bounds
                        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
                        const members = [...shapes, ...assets, ...walls, ...textAnnotations].filter(i => i.groupId === group.id);
                        
                        members.forEach(m => {
                            if ('nodes' in m) { // Wall
                                m.nodes.forEach(n => {
                                    minX = Math.min(minX, n.x); minY = Math.min(minY, n.y);
                                    maxX = Math.max(maxX, n.x); maxY = Math.max(maxY, n.y);
                                });
                            } else {
                                const mAny = m as any;
                                const w = (mAny.width || 0) * (mAny.scale || 1);
                                const h = (mAny.height || 0) * (mAny.scale || 1);
                                minX = Math.min(minX, mAny.x - w/2);
                                minY = Math.min(minY, mAny.y - h/2);
                                maxX = Math.max(maxX, mAny.x + w/2);
                                maxY = Math.max(maxY, mAny.y + h/2);
                            }
                        });
                        
                        items.push({
                            id: group.id,
                            type: 'group',
                            x: (minX + maxX) / 2,
                            y: (minY + maxY) / 2,
                            w: maxX - minX,
                            h: maxY - minY,
                            memberIds: group.itemIds
                        });
                    } else {
                        // Single item
                        const item = shapes.find(s => s.id === id) || 
                                     assets.find(a => a.id === id) || 
                                     walls.find(w => w.id === id) || 
                                     textAnnotations.find(t => t.id === id);
                        if (!item) return;

                        let x = (item as any).x, y = (item as any).y, w = (item as any).width || 0, h = (item as any).height || 0;
                        if ('nodes' in item) { // Wall
                            const xs = item.nodes.map((n: any) => n.x);
                            const ys = item.nodes.map((n: any) => n.y);
                            w = Math.max(...xs) - Math.min(...xs);
                            h = Math.max(...ys) - Math.min(...ys);
                            x = (Math.min(...xs) + Math.max(...xs)) / 2;
                            y = (Math.min(...ys) + Math.max(...ys)) / 2;
                        } else if ('scale' in (item as any)) { // Asset or Shape
                            w = (item as any).width * ((item as any).scale || 1);
                            h = (item as any).height * ((item as any).scale || 1);
                        }
                        
                        items.push({ id, type: 'item', x, y, w, h, memberIds: [id] });
                    }
                });

                if (items.length < 2) return;

                // Sort items by axis
                items.sort((a, b) => axis === 'horizontal' ? a.x - b.x : a.y - b.y);

                const startX = items[0].x;
                const startY = items[0].y;

                items.forEach((item, index) => {
                    if (index === 0) return;

                    const newX = axis === 'horizontal' ? startX + (index * spacing) : startX;
                    const newY = axis === 'vertical' ? startY + (index * spacing) : startY;

                    const dx = newX - item.x;
                    const dy = newY - item.y;

                    // Move all members of this group/item
                    item.memberIds.forEach(mid => {
                        const s = shapes.find(sh => sh.id === mid);
                        if (s) get().updateShape(mid, { x: s.x + dx, y: s.y + dy }, true);
                        const a = assets.find(as => as.id === mid);
                        if (a) get().updateAsset(mid, { x: a.x + dx, y: a.y + dy }, true);
                        const w = walls.find(wa => wa.id === mid);
                        if (w) get().updateWall(mid, { nodes: w.nodes.map(n => ({ ...n, x: n.x + dx, y: n.y + dy })) }, true);
                        const t = textAnnotations.find(ta => ta.id === mid);
                        if (t) get().updateTextAnnotation(mid, { x: t.x + dx, y: t.y + dy }, true);
                    });
                });
            },

            resolveIdsWithGroups: (ids) => {
                const { shapes, assets, walls, textAnnotations, dimensions, labelArrows, groups } = get();
                const allItems: any[] = [...shapes, ...assets, ...walls, ...textAnnotations, ...dimensions, ...labelArrows];

                const expandedIds = new Set<string>();
                ids.forEach(id => {
                    // Check if it's a Group ID itself
                    const groupAsPrimary = groups.find(g => g.id === id);
                    if (groupAsPrimary) {
                        groupAsPrimary.itemIds.forEach(gid => expandedIds.add(gid));
                        return;
                    }

                    // Otherwise check if it's an item in a group
                    const item = allItems.find(i => i.id === id);
                    if (item && item.groupId) {
                        const group = groups.find(g => g.id === item.groupId);
                        if (group) {
                            group.itemIds.forEach(gid => expandedIds.add(gid));
                        } else {
                            expandedIds.add(id);
                        }
                    } else {
                        expandedIds.add(id);
                    }
                });
                return Array.from(expandedIds);
            },

            distributeRadial: (radius, startAngle, endAngle, ids, skipHistory = false) => {
                if (!skipHistory) get().saveToHistory();
                const { shapes, assets, walls, textAnnotations, groups } = get();

                const topLevelIds = new Set<string>();
                ids.forEach(id => {
                    const item = shapes.find(s => s.id === id) || 
                                 assets.find(a => a.id === id) || 
                                 walls.find(w => w.id === id) || 
                                 textAnnotations.find(t => t.id === id);
                    if (item?.groupId) {
                        topLevelIds.add(item.groupId);
                    } else {
                        topLevelIds.add(id);
                    }
                });

                const finalIds = Array.from(topLevelIds);
                if (finalIds.length === 0) return;

                // Calculate common center of selection to use as radial center
                let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
                const items: { id: string, type: 'group' | 'item', x: number, y: number, memberIds: string[] }[] = [];

                finalIds.forEach(id => {
                    const group = groups.find(g => g.id === id);
                    if (group) {
                        let gMinX = Infinity, gMinY = Infinity, gMaxX = -Infinity, gMaxY = -Infinity;
                        const members = [...shapes, ...assets, ...walls, ...textAnnotations].filter(m => m.groupId === group.id);
                        members.forEach(m => {
                             if ('nodes' in m) {
                                m.nodes.forEach(n => {
                                    gMinX = Math.min(gMinX, n.x); gMinY = Math.min(gMinY, n.y);
                                    gMaxX = Math.max(gMaxX, n.x); gMaxY = Math.max(gMaxY, n.y);
                                });
                            } else {
                                const mAny = m as any;
                                const w = (mAny.width || 0) * (mAny.scale || 1);
                                const h = (mAny.height || 0) * (mAny.scale || 1);
                                gMinX = Math.min(gMinX, mAny.x - w/2);
                                gMinY = Math.min(gMinY, mAny.y - h/2);
                                gMaxX = Math.max(gMaxX, mAny.x + w/2);
                                gMaxY = Math.max(gMaxY, mAny.y + h/2);
                            }
                        });
                        const cx = (gMinX + gMaxX) / 2;
                        const cy = (gMinY + gMaxY) / 2;
                        items.push({ id, type: 'group', x: cx, y: cy, memberIds: group.itemIds });
                        minX = Math.min(minX, gMinX); minY = Math.min(minY, gMinY);
                        maxX = Math.max(maxX, gMaxX); maxY = Math.max(maxY, gMaxY);
                    } else {
                        const item = shapes.find(s => s.id === id) || assets.find(a => a.id === id) || walls.find(w => w.id === id) || textAnnotations.find(t => t.id === id);
                        if (!item) return;
                        const cx = 'nodes' in item ? (Math.min(...item.nodes.map(n => n.x)) + Math.max(...item.nodes.map(n => n.x))) / 2 : (item as any).x;
                        const cy = 'nodes' in item ? (Math.min(...item.nodes.map(n => n.y)) + Math.max(...item.nodes.map(n => n.y))) / 2 : (item as any).y;
                        items.push({ id, type: 'item', x: cx, y: cy, memberIds: [id] });
                        
                        if ('nodes' in item) {
                            item.nodes.forEach(n => {
                                minX = Math.min(minX, n.x); minY = Math.min(minY, n.y);
                                maxX = Math.max(maxX, n.x); maxY = Math.max(maxY, n.y);
                            });
                        } else {
                            const mAny = item as any;
                            const w = (mAny.width || 0) * (mAny.scale || 1);
                            const h = (mAny.height || 0) * (mAny.scale || 1);
                            minX = Math.min(minX, mAny.x - w/2);
                            minY = Math.min(minY, mAny.y - h/2);
                            maxX = Math.max(maxX, mAny.x + w/2);
                            maxY = Math.max(maxY, mAny.y + h/2);
                        }
                    }
                });

                const centerX = (minX + maxX) / 2;
                const centerY = (minY + maxY) / 2;

                items.forEach((item, index) => {
                    const angle = startAngle + (index * (endAngle - startAngle) / Math.max(1, items.length - 1));
                    const rad = angle * (Math.PI / 180);
                    const newX = centerX + radius * Math.cos(rad);
                    const newY = centerY + radius * Math.sin(rad);

                    const dx = newX - item.x;
                    const dy = newY - item.y;

                    item.memberIds.forEach(mid => {
                        const s = shapes.find(sh => sh.id === mid);
                        if (s) get().updateShape(mid, { x: s.x + dx, y: s.y + dy }, true);
                        const a = assets.find(as => as.id === mid);
                        if (a) get().updateAsset(mid, { x: a.x + dx, y: a.y + dy }, true);
                        const w = walls.find(wa => wa.id === mid);
                        if (w) get().updateWall(mid, { nodes: w.nodes.map(n => ({ ...n, x: n.x + dx, y: n.y + dy })) }, true);
                        const t = textAnnotations.find(ta => ta.id === mid);
                        if (t) get().updateTextAnnotation(mid, { x: t.x + dx, y: t.y + dy }, true);
                    });
                });
            },

            // Persistence Actions
            clearWorkspace: () => {
                console.log('→ Clearing workspace (preventing localStorage pollution)');
                set({
                    shapes: [],
                    assets: [],
                    walls: [],
                    wallSegments: [],
                    layers: [DEFAULT_LAYER],
                    groups: [],
                    activeLayerId: DEFAULT_LAYER.id,
                    canvas: DEFAULT_CANVAS,
                    textAnnotations: [],
                    labelArrows: [],
                    dimensions: [],
                    comments: [],
                    hasUnsavedChanges: false,
                    lastSaved: undefined,
                });
            },

            loadEvent: async (eventId: string, slug: string) => {
                set({ isSaving: true });
                try {
                    const response = await apiRequest(`/projects/${slug}/events/${eventId}`, 'GET');
                    const data = response.data;
                    const normalizeLoadedComments = (rawComments: any[] = []) =>
                        rawComments
                            .filter(Boolean)
                            .map((comment: any) => ({
                                id: String(comment.id || comment._id || crypto.randomUUID()),
                                x: Number(comment.x || 0),
                                y: Number(comment.y || 0),
                                content: String(comment.content ?? comment.text ?? ''),
                                author: String(comment.author || comment.userId || 'Unknown'),
                                timestamp: comment.timestamp
                                    ? Number(comment.timestamp)
                                    : comment.createdAt
                                        ? new Date(comment.createdAt).getTime()
                                        : Date.now(),
                                resolved: Boolean(comment.resolved),
                                color: comment.color,
                                userId: comment.userId,
                                createdAt: comment.createdAt,
                            }));

                    if (data.canvasData) {
                        // Load from rich canvasData if available
                        const { 
                            shapes, assets, walls, layers, canvas,
                            textAnnotations, dimensions, labelArrows, groups, wallSegments,
                            activeLayerId, comments
                        } = data.canvasData;
                        set({
                            shapes: shapes || [],
                            assets: assets || [],
                            walls: (walls || []).map((wall: any) => ({
                                ...wall,
                                stroke: normalizeLegacyWallStroke(wall.stroke, wall.strokeColor),
                                strokeWidth: wall.strokeWidth ?? 2,
                            })),
                            wallSegments: wallSegments || [],
                            layers: layers || [DEFAULT_LAYER],
                            groups: groups || [],
                            activeLayerId: activeLayerId || (layers && layers[0]?.id) || DEFAULT_LAYER.id,
                            canvas: canvas || DEFAULT_CANVAS,
                            textAnnotations: textAnnotations || [],
                            dimensions: dimensions || [],
                            labelArrows: labelArrows || [],
                            comments: normalizeLoadedComments(comments || data.comments || []),
                            hasUnsavedChanges: false,
                            lastSaved: new Date(),
                        });
                        console.log(`✓ Loaded event ${eventId} from backend with ${shapes?.length || 0} shapes and ${assets?.length || 0} assets`);
                    } else if (data.canvasAssets) {
                        // Fallback to legacy canvasAssets
                        set({
                            comments: normalizeLoadedComments(data.comments || []),
                            hasUnsavedChanges: false,
                            lastSaved: new Date(),
                        });
                        console.log(`✓ Loaded event ${eventId} from backend (legacy format)`);
                    }
                } catch (error: any) {
                    // Check if it's a 404 (new event that doesn't exist yet)
                    if (error?.response?.status === 404 || error?.status === 404) {
                        console.log(`→ Event ${eventId} doesn't exist yet (new event), starting with empty workspace`);
                        // Clear workspace for new events - don't use localStorage data
                        set({
                            shapes: [],
                            assets: [],
                            walls: [],
                            wallSegments: [],
                            layers: [DEFAULT_LAYER],
                            groups: [],
                            activeLayerId: DEFAULT_LAYER.id,
                            canvas: DEFAULT_CANVAS,
                            textAnnotations: [],
                            dimensions: [],
                            labelArrows: [],
                            comments: [],
                            hasUnsavedChanges: false,
                            lastSaved: undefined,
                        });
                    } else {
                        // For other errors (network issues, etc), use localStorage as fallback
                        console.warn(`⚠ Failed to load event ${eventId} from backend:`, error);
                        console.log(`→ Using localStorage data for event ${eventId} (Zustand persist handles this automatically)`);
                        // Don't set anything - Zustand's persist middleware will use localStorage data
                    }
                } finally {
                    set({ isSaving: false });
                }
            },

            saveEvent: async (eventId: string, slug: string) => {
                const { 
                    shapes, assets, walls, layers, canvas, 
                    textAnnotations, dimensions, labelArrows, groups, wallSegments,
                    activeLayerId, comments
                } = get();
                set({ isSaving: true });
                try {
                    // GET current event to preserve name and other fields
                    let eventName = 'Untitled Event';
                    let eventType = 'custom venue';
                    let canvases: any[] = [];

                    try {
                        const currentEvent = await apiRequest(`/projects/${slug}/events/${eventId}`, 'GET', null, true);
                        const event = currentEvent.data || currentEvent;
                        eventName = event.name || eventName;
                        eventType = event.type || eventType;
                        canvases = event.canvases || [];
                    } catch (e) {
                        console.warn('[projectStore] Could not fetch current event, using defaults');
                    }

                    const canvasData = { 
                        shapes, assets, walls, layers, canvas,
                        textAnnotations, dimensions, labelArrows, groups, wallSegments,
                        activeLayerId, comments
                    };
                    const eventComments = comments.map(comment => ({
                        id: comment.id,
                        x: comment.x,
                        y: comment.y,
                        text: comment.content,
                        author: comment.author,
                        color: comment.color,
                        userId: comment.userId,
                        resolved: comment.resolved,
                        timestamp: comment.timestamp,
                        createdAt: comment.createdAt,
                    }));

                    // CRITICAL: Save complete asset data, not just id/type/x/y
                    // Convert shapes, assets, and walls to canvasAssets format with ALL properties
                    const canvasAssets: any[] = [];

                    // Convert shapes to canvasAssets
                    shapes.forEach(shape => {
                        canvasAssets.push({
                            ...shape, // Spread to retain all custom attributes like tableNumbering and fill customizations
                            id: shape.id,
                            name: shape.name, // SAVE NAME
                            type: shape.type,
                            x: shape.x,
                            y: shape.y,
                            width: shape.width,
                            height: shape.height,
                            rotation: shape.rotation,
                            fillColor: shape.fill,
                            strokeColor: shape.stroke,
                            strokeWidth: shape.strokeWidth,
                            backgroundColor: shape.fill,
                            zIndex: shape.zIndex,
                            points: shape.points,
                        });
                    });

                    // Convert assets to canvasAssets
                    assets.forEach(asset => {
                        canvasAssets.push({
                            ...asset, // Spread to retain all custom attributes
                            id: asset.id,
                            name: asset.name, // SAVE NAME
                            type: asset.type,
                            x: asset.x,
                            y: asset.y,
                            width: asset.width,
                            height: asset.height,
                            rotation: asset.rotation,
                            scale: asset.scale,
                            zIndex: asset.zIndex,
                            fillColor: asset.fillColor,
                            strokeColor: asset.strokeColor,
                            strokeWidth: asset.strokeWidth,
                            opacity: asset.opacity,
                        });
                    });

                    // Convert walls to canvasAssets with full geometry as a compatibility backup.
                    // Older backend/editor paths may fall back to canvasAssets, so keep nodes,
                    // edges, and style data intact instead of rebuilding walls from a flat polygon.
                    walls.forEach(wall => {
                        const origin = wall.nodes[0] || { x: 0, y: 0 };

                        canvasAssets.push({
                            ...wall,
                            id: wall.id,
                            name: wall.name, // SAVE NAME
                            type: 'wall-polygon',
                            x: origin.x,
                            y: origin.y,
                            wallData: wall,
                            wallNodes: wall.nodes,
                            wallEdges: wall.edges,
                            wallPolygon: wall.nodes.map(node => ({
                                x: node.x - origin.x,
                                y: node.y - origin.y,
                            })),
                            wallThickness: wall.edges[0]?.thickness || 75,
                            strokeColor: wall.stroke || '#1f2937',
                            backgroundColor: wall.fill || '#ffffff',
                            fill: wall.fill,
                            stroke: wall.stroke || '#1f2937',
                            fillType: wall.fillType,
                            fillTexture: wall.fillTexture,
                            fillTextureScale: wall.fillTextureScale,
                            fillTextureThickness: wall.fillTextureThickness,
                            strokeWidth: wall.strokeWidth !== undefined ? wall.strokeWidth : 2,
                            zIndex: wall.zIndex,
                        });
                    });

                    dimensions.forEach(dimension => {
                        canvasAssets.push({
                            ...dimension,
                            type: 'dimension',
                            itemType: 'dimension',
                            dimensionType: dimension.type,
                            x: (dimension.startPoint.x + dimension.endPoint.x) / 2,
                            y: (dimension.startPoint.y + dimension.endPoint.y) / 2,
                            zIndex: dimension.zIndex || 0,
                        });
                    });

                    labelArrows.forEach(arrow => {
                        canvasAssets.push({
                            ...arrow,
                            type: 'label-arrow',
                            itemType: 'label-arrow',
                            x: (arrow.startPoint.x + arrow.endPoint.x) / 2,
                            y: (arrow.startPoint.y + arrow.endPoint.y) / 2,
                            zIndex: arrow.zIndex || 0,
                        });
                    });

                    textAnnotations.forEach(annotation => {
                        canvasAssets.push({
                            ...annotation,
                            type: 'text-annotation',
                            itemType: 'text-annotation',
                            x: annotation.x,
                            y: annotation.y,
                            zIndex: annotation.zIndex || 0,
                        });
                    });

                    // PUT /projects/{slug}/events/{eventId}
                    // Include all required fields: name, type, canvases, canvasData, canvasAssets
                    const payload = {
                        name: eventName,
                        type: eventType,
                        canvases: canvases,
                        canvasData,
                        canvasAssets,
                        comments: eventComments,
                    };

                    console.log(`[projectStore] Saving to DATABASE via PUT /projects/${slug}/events/${eventId}:`, {
                        eventId,
                        slug,
                        name: eventName,
                        type: eventType,
                        canvasData: { walls: walls.length, shapes: shapes.length, assets: assets.length },
                        canvasAssets: canvasAssets.length,
                        sampleShape: shapes.length > 0 ? {
                            id: shapes[0].id,
                            type: shapes[0].type,
                            width: shapes[0].width,
                            height: shapes[0].height,
                            x: shapes[0].x,
                            y: shapes[0].y,
                        } : null,
                        payload
                    });

                    const response = await apiRequest(`/projects/${slug}/events/${eventId}`, 'PUT', payload, true);

                    set({ hasUnsavedChanges: false, lastSaved: new Date() });
                    console.log(`[projectStore] ✅ Event saved successfully to DATABASE: ${eventId}`);
                    return response;
                } catch (error: any) {
                    console.error(`[projectStore] ❌ Save failed:`, error);
                    // Re-throw so auto-save can handle offline state
                    throw error;
                } finally {
                    set({ isSaving: false });
                }
            },

            // Wall methods
            addWall: (wall, skipHistory = false) => {
                if (!skipHistory) get().saveToHistory();
                set((state) => ({
                    walls: [...state.walls, wall],
                    hasUnsavedChanges: !skipHistory || state.hasUnsavedChanges,
                }));
            },

            addWallBatch: (newWalls: Wall[], skipHistory = false) => {
                if (!skipHistory) get().saveToHistory();
                set((state) => ({
                    walls: [...state.walls, ...newWalls],
                    hasUnsavedChanges: !skipHistory || state.hasUnsavedChanges,
                }));
            },

            updateWall: (id, updates, skipHistory = false) => {
                if (!skipHistory) get().saveToHistory();
                set((state) => {
                    const sharedUpdates = getSharedWallStyleUpdates(updates);
                    const linkedIds = Object.keys(sharedUpdates).length > 0
                        ? getBlendedWallGroupIds(state.walls, [id])
                        : new Set([id]);

                    return {
                        walls: state.walls.map((w) => {
                            if (w.id === id) return { ...w, ...updates };
                            if (linkedIds.has(w.id)) return { ...w, ...sharedUpdates };
                            return w;
                        }),
                        hasUnsavedChanges: !skipHistory || state.hasUnsavedChanges,
                    };
                });
            },

            updateWallBatch: (ids: string[], updates: Partial<Wall>, skipHistory = false) => {
                if (!skipHistory) get().saveToHistory();
                set((state) => {
                    const sharedUpdates = getSharedWallStyleUpdates(updates);
                    const linkedIds = Object.keys(sharedUpdates).length > 0
                        ? getBlendedWallGroupIds(state.walls, ids)
                        : new Set(ids);

                    return {
                        walls: state.walls.map((w) => {
                            if (ids.includes(w.id)) return { ...w, ...updates };
                            if (linkedIds.has(w.id)) return { ...w, ...sharedUpdates };
                            return w;
                        }),
                        hasUnsavedChanges: !skipHistory || state.hasUnsavedChanges,
                    };
                });
            },

            batchUpdateWalls: (updates: { id: string; updates: Partial<Wall> }[], skipHistory = false) => {
                if (!skipHistory) get().saveToHistory();
                const updatesById = new Map(updates.map((update) => [update.id, update.updates]));
                set((state) => ({
                    walls: state.walls.map((wall) => {
                        const wallUpdates = updatesById.get(wall.id);
                        return wallUpdates ? { ...wall, ...wallUpdates } : wall;
                    }),
                    hasUnsavedChanges: true,
                }));
            },

            removeWall: (id, skipHistory = false) => {
                if (!skipHistory) get().saveToHistory();
                set((state) => ({
                    walls: state.walls.filter((w) => w.id !== id),
                    hasUnsavedChanges: !skipHistory || state.hasUnsavedChanges,
                }));
            },

            getWall: (id) => {
                return get().walls.find((w) => w.id === id);
            },

            // Wall node operations
            addWallNode: (wallId, node) => {
                get().saveToHistory();
                set((state) => ({
                    walls: state.walls.map((w) =>
                        w.id === wallId ? { ...w, nodes: [...w.nodes, node] } : w
                    ),
                    hasUnsavedChanges: true,
                }));
            },

            updateWallNode: (wallId, nodeId, updates) => {
                get().saveToHistory();
                set((state) => ({
                    walls: state.walls.map((w) =>
                        w.id === wallId
                            ? {
                                ...w,
                                nodes: w.nodes.map((n) =>
                                    n.id === nodeId ? { ...n, ...updates } : n
                                ),
                            }
                            : w
                    ),
                    hasUnsavedChanges: true,
                }));
            },

            removeWallNode: (wallId, nodeId, skipHistory = false) => {
                if (!skipHistory) get().saveToHistory();
                set((state) => ({
                    walls: state.walls.map((w) =>
                        w.id === wallId
                            ? { ...w, nodes: w.nodes.filter((n) => n.id !== nodeId) }
                            : w
                    ),
                    hasUnsavedChanges: true,
                }));
            },

            addWallEdge: (wallId, edge) => {
                get().saveToHistory();
                set((state) => ({
                    walls: state.walls.map((w) =>
                        w.id === wallId ? { ...w, edges: [...w.edges, edge] } : w
                    ),
                    hasUnsavedChanges: true,
                }));
            },

            updateWallEdge: (wallId, edgeId, updates) => {
                get().saveToHistory();
                set((state) => ({
                    walls: state.walls.map((w) =>
                        w.id === wallId
                            ? {
                                ...w,
                                edges: w.edges.map((e) =>
                                    e.id === edgeId ? { ...e, ...updates } : e
                                ),
                            }
                            : w
                    ),
                    hasUnsavedChanges: true,
                }));
            },

            removeWallEdge: (wallId, edgeId, skipHistory = false) => {
                if (!skipHistory) get().saveToHistory();
                set((state) => ({
                    walls: state.walls.map((w) =>
                        w.id === wallId
                            ? { ...w, edges: w.edges.filter((e) => e.id !== edgeId) }
                            : w
                    ),
                    hasUnsavedChanges: true,
                }));
            },

            // Wall Segment methods (New Engine)
            addWallSegment: (segment) => {
                get().saveToHistory();
                set((state) => ({
                    wallSegments: [...state.wallSegments, segment],
                    hasUnsavedChanges: true,
                }));
            },

            updateWallSegment: (id, updates) => {
                get().saveToHistory();
                set((state) => ({
                    wallSegments: state.wallSegments.map((w) =>
                        w.id === id ? { ...w, ...updates } : w
                    ),
                    hasUnsavedChanges: true,
                }));
            },

            removeWallSegment: (id) => {
                get().saveToHistory();
                set((state) => ({
                    wallSegments: state.wallSegments.filter((w) => w.id !== id),
                    hasUnsavedChanges: true,
                }));
            },

            getWallSegment: (id) => {
                return get().wallSegments.find((w) => w.id === id);
            },

            setWallSegments: (segments) => {
                get().saveToHistory();
                set({
                    wallSegments: segments,
                    hasUnsavedChanges: true,
                });
            },

            // Shape methods
            addShape: (shape, skipHistory = false) => {
                if (!skipHistory) get().saveToHistory();
                set((state) => ({
                    shapes: [...state.shapes, shape],
                    hasUnsavedChanges: !skipHistory || state.hasUnsavedChanges,
                }));
            },

            addShapeBatch: (newShapes: Shape[], skipHistory = false) => {
                if (!skipHistory) get().saveToHistory();
                set((state) => ({
                    shapes: [...state.shapes, ...newShapes],
                    hasUnsavedChanges: !skipHistory || state.hasUnsavedChanges,
                }));
            },

            updateShape: (id, updates, skipHistory = false) => {
                if (!skipHistory) get().saveToHistory();
                set((state) => ({
                    shapes: state.shapes.map((s) => (s.id === id ? { ...s, ...updates } : s)),
                    hasUnsavedChanges: !skipHistory || state.hasUnsavedChanges,
                }));
            },

            updateShapeBatch: (ids: string[], updates: Partial<Shape>, skipHistory = false) => {
                if (!skipHistory) get().saveToHistory();
                set((state) => ({
                    shapes: state.shapes.map((s) => (ids.includes(s.id) ? { ...s, ...updates } : s)),
                    hasUnsavedChanges: !skipHistory || state.hasUnsavedChanges,
                }));
            },

            batchUpdateShapes: (updates: { id: string; updates: Partial<Shape> }[], skipHistory = false) => {
                if (!skipHistory) get().saveToHistory();
                const updatesById = new Map(updates.map((update) => [update.id, update.updates]));
                set((state) => ({
                    shapes: state.shapes.map((shape) => {
                        const shapeUpdates = updatesById.get(shape.id);
                        return shapeUpdates ? { ...shape, ...shapeUpdates } : shape;
                    }),
                    hasUnsavedChanges: true,
                }));
            },

            removeShape: (id, skipHistory = false) => {
                if (!skipHistory) get().saveToHistory();
                set((state) => {
                    const shape = state.shapes.find((s) => s.id === id);
                    let updatedAssets = state.assets;
                    if (shape?.sourceAssetId) {
                        updatedAssets = state.assets.map((asset) => {
                            if (asset.id !== shape.sourceAssetId) return asset;
                            const remainingChildren = (asset.childShapeIds || []).filter((childId) => childId !== id);
                            return {
                                ...asset,
                                childShapeIds: remainingChildren,
                                isExploded: remainingChildren.length > 0 ? true : false,
                            };
                        });
                    }
                    return {
                        shapes: state.shapes.filter((s) => s.id !== id),
                        assets: updatedAssets,
                        hasUnsavedChanges: !skipHistory || state.hasUnsavedChanges,
                    };
                });
            },

            getShape: (id) => {
                return get().shapes.find((s) => s.id === id);
            },

            // Asset methods
            addAsset: (asset: Asset, skipHistory = false) => {
                if (!skipHistory) get().saveToHistory();
                // Apply default strokeWidth of 2 if not already set
                const assetWithDefaults = {
                    ...asset,
                    strokeWidth: asset.strokeWidth !== undefined ? asset.strokeWidth : 0.6
                };
                set((state) => ({
                    assets: [...state.assets, assetWithDefaults],
                    hasUnsavedChanges: !skipHistory || state.hasUnsavedChanges,
                }));
            },

            addAssetBatch: (newAssets: Asset[], skipHistory = false) => {
                if (!skipHistory) get().saveToHistory();
                const assetsWithDefaults = newAssets.map(asset => ({
                    ...asset,
                    strokeWidth: asset.strokeWidth !== undefined ? asset.strokeWidth : 0.6
                }));
                set((state) => ({
                    assets: [...state.assets, ...assetsWithDefaults],
                    hasUnsavedChanges: !skipHistory || state.hasUnsavedChanges,
                }));
            },
            updateAsset: (id, updates, skipHistory = false) => {
                if (!skipHistory) get().saveToHistory();
                set((state) => ({
                    assets: state.assets.map((a) => (a.id === id ? { ...a, ...updates } : a)),
                    hasUnsavedChanges: !skipHistory || state.hasUnsavedChanges,
                }));
            },

            updateAssetBatch: (ids: string[], updates: Partial<Asset>, skipHistory = false) => {
                if (!skipHistory) get().saveToHistory();
                set((state) => ({
                    assets: state.assets.map((a) => (ids.includes(a.id) ? { ...a, ...updates } : a)),
                    hasUnsavedChanges: !skipHistory || state.hasUnsavedChanges,
                }));
            },

            batchUpdateAssets: (updates: { id: string; updates: Partial<Asset> }[], skipHistory = false) => {
                if (!skipHistory) get().saveToHistory();
                const updatesById = new Map(updates.map((update) => [update.id, update.updates]));
                set((state) => ({
                    assets: state.assets.map((asset) => {
                        const assetUpdates = updatesById.get(asset.id);
                        return assetUpdates ? { ...asset, ...assetUpdates } : asset;
                    }),
                    hasUnsavedChanges: true,
                }));
            },

            removeAsset: (id, skipHistory = false) => {
                if (!skipHistory) get().saveToHistory();
                set((state) => ({
                    assets: state.assets.filter((a) => a.id !== id),
                    shapes: state.shapes.filter((s) => s.sourceAssetId !== id),
                    hasUnsavedChanges: !skipHistory || state.hasUnsavedChanges,
                }));
            },

            getAsset: (id) => {
                return get().assets.find((a) => a.id === id);
            },

            // Group methods
            addGroup: (group, skipHistory = false) => {
                if (!skipHistory) get().saveToHistory();
                set((state) => {
                    return {
                        groups: [...state.groups, group],
                        hasUnsavedChanges: true
                    };
                });
            },
            updateGroup: (id, updates, skipHistory = false) => {
                if (!skipHistory) get().saveToHistory();
                set((state) => ({
                    groups: state.groups.map((g) => (g.id === id ? { ...g, ...updates } : g)),
                    hasUnsavedChanges: true
                }));
            },
            removeGroup: (id, skipHistory = false) => {
                if (!skipHistory) get().saveToHistory();
                set((state) => ({
                    groups: state.groups.filter((g) => g.id !== id),
                    hasUnsavedChanges: true
                }));
            },

            // Layer methods
            addLayer: (layer) => {
                get().saveToHistory();
                set((state) => ({
                    layers: [...state.layers, layer],
                    hasUnsavedChanges: true,
                }));
            },

            updateLayer: (id, updates) => {
                get().saveToHistory();
                set((state) => ({
                    layers: state.layers.map((l) => (l.id === id ? { ...l, ...updates } : l)),
                    hasUnsavedChanges: true,
                }));
            },

            removeLayer: (id) => {
                get().saveToHistory();
                set((state) => ({
                    layers: state.layers.filter((l) => l.id !== id),
                    hasUnsavedChanges: true,
                }));
            },

            setActiveLayer: (id) => {
                set({ activeLayerId: id });
            },

            // History methods
            undo: () => {
                const state = get();
                const { history, canvas } = state;
                if (history.past.length === 0) {
                    console.log("[projectStore] Undo called but history.past is EMPTY");
                    return;
                }

                console.log(`[projectStore] Undo triggered. Past size: ${history.past.length}`);

                const previous = history.past[history.past.length - 1];
                const newPast = history.past.slice(0, history.past.length - 1);

                // Create a snapshot of CURRENT state before rolling back
                const currentSnapshot: ProjectSnapshot = {
                    walls: JSON.parse(JSON.stringify(state.walls)),
                    wallSegments: JSON.parse(JSON.stringify(state.wallSegments)),
                    shapes: JSON.parse(JSON.stringify(state.shapes)),
                    assets: JSON.parse(JSON.stringify(state.assets)),
                    textAnnotations: JSON.parse(JSON.stringify(state.textAnnotations)),
                    labelArrows: JSON.parse(JSON.stringify(state.labelArrows)),
                    dimensions: JSON.parse(JSON.stringify(state.dimensions)),
                    groups: JSON.parse(JSON.stringify(state.groups)),
                    layers: JSON.parse(JSON.stringify(state.layers)),
                    activeLayerId: state.activeLayerId,
                    comments: JSON.parse(JSON.stringify(state.comments)),
                    canvas: JSON.parse(JSON.stringify(state.canvas)),
                };

                set({
                    walls: previous.walls || [],
                    wallSegments: previous.wallSegments || [],
                    shapes: previous.shapes || [],
                    assets: previous.assets || [],
                    textAnnotations: previous.textAnnotations || [],
                    labelArrows: previous.labelArrows || [],
                    dimensions: previous.dimensions || [],
                    groups: previous.groups || [],
                    layers: previous.layers || [],
                    activeLayerId: previous.activeLayerId,
                    comments: previous.comments || [],
                    canvas: previous.canvas || canvas,
                    history: {
                        past: newPast,
                        future: [currentSnapshot, ...history.future].slice(0, 50),
                    },
                    hasUnsavedChanges: true,
                });
            },

            redo: () => {
                const state = get();
                const { history, canvas } = state;
                if (history.future.length === 0) {
                    console.log("[projectStore] Redo called but history.future is EMPTY");
                    return;
                }

                console.log(`[projectStore] Redo triggered. Future size: ${history.future.length}`);

                const next = history.future[0];
                const newFuture = history.future.slice(1);

                // Create a snapshot of CURRENT state before rolling forward
                const currentSnapshot: ProjectSnapshot = {
                    walls: JSON.parse(JSON.stringify(state.walls)),
                    wallSegments: JSON.parse(JSON.stringify(state.wallSegments)),
                    shapes: JSON.parse(JSON.stringify(state.shapes)),
                    assets: JSON.parse(JSON.stringify(state.assets)),
                    textAnnotations: JSON.parse(JSON.stringify(state.textAnnotations)),
                    labelArrows: JSON.parse(JSON.stringify(state.labelArrows)),
                    dimensions: JSON.parse(JSON.stringify(state.dimensions)),
                    groups: JSON.parse(JSON.stringify(state.groups)),
                    layers: JSON.parse(JSON.stringify(state.layers)),
                    activeLayerId: state.activeLayerId,
                    comments: JSON.parse(JSON.stringify(state.comments)),
                    canvas: JSON.parse(JSON.stringify(state.canvas)),
                };

                set({
                    walls: next.walls || [],
                    wallSegments: next.wallSegments || [],
                    shapes: next.shapes || [],
                    assets: next.assets || [],
                    textAnnotations: next.textAnnotations || [],
                    labelArrows: next.labelArrows || [],
                    dimensions: next.dimensions || [],
                    groups: next.groups || [],
                    layers: next.layers || [],
                    activeLayerId: next.activeLayerId,
                    comments: next.comments || [],
                    canvas: next.canvas || canvas,
                    history: {
                        past: [...history.past, currentSnapshot].slice(-50),
                        future: newFuture,
                    },
                    hasUnsavedChanges: true,
                });
            },

            saveToHistory: () => {
                const { walls, wallSegments, shapes, assets, textAnnotations, labelArrows, dimensions, groups, layers, activeLayerId, comments, canvas, history } = get();
                const snapshot: ProjectSnapshot = {
                    walls: JSON.parse(JSON.stringify(walls)),
                    wallSegments: JSON.parse(JSON.stringify(wallSegments)),
                    shapes: JSON.parse(JSON.stringify(shapes)),
                    assets: JSON.parse(JSON.stringify(assets)),
                    textAnnotations: JSON.parse(JSON.stringify(textAnnotations)),
                    labelArrows: JSON.parse(JSON.stringify(labelArrows)),
                    dimensions: JSON.parse(JSON.stringify(dimensions)),
                    groups: JSON.parse(JSON.stringify(groups)),
                    layers: JSON.parse(JSON.stringify(layers)),
                    activeLayerId: activeLayerId,
                    comments: JSON.parse(JSON.stringify(comments)),
                    canvas: JSON.parse(JSON.stringify(canvas)),
                };
                const newPast = [...history.past, snapshot].slice(-50);
                set({
                    history: {
                        past: newPast,
                        future: [],
                    },
                });
            },

            clearHistory: () => {
                set({
                    history: {
                        past: [],
                        future: [],
                    },
                });
            },

            commitDragHistory: (snapshot: ProjectSnapshot) => {
                const { history } = get();
                const newPast = [...history.past, snapshot].slice(-50);
                set({
                    history: {
                        past: newPast,
                        future: [],
                    },
                });
            },

            // Utility methods
            getNextZIndex: () => {
                const { walls, shapes, assets } = get();
                const allItems = [...walls, ...shapes, ...assets];
                if (allItems.length === 0) return 1;
                return Math.max(...allItems.map((i) => i.zIndex || 0)) + 1;
            },

            markAsSaved: () => {
                set({ hasUnsavedChanges: false });
            },

            snapToAnchor: (selectedId: string, anchorType: string, targetObjectId?: string) => {
                const { shapes, walls, assets } = get();

                let selected: { type: 'shape' | 'wall' | 'asset'; object: Shape | Wall | Asset } | null = null;

                const shape = shapes.find(s => s.id === selectedId);
                if (shape) selected = { type: 'shape', object: shape };

                const asset = assets.find(a => a.id === selectedId);
                if (asset) selected = { type: 'asset', object: asset };

                if (!selected) return;

                let target: { type: 'shape' | 'wall' | 'asset'; object: Shape | Wall | Asset } | null = null;

                if (targetObjectId) {
                    const tShape = shapes.find(s => s.id === targetObjectId);
                    if (tShape) target = { type: 'shape', object: tShape };

                    const tWall = walls.find(w => w.id === targetObjectId);
                    if (tWall) target = { type: 'wall', object: tWall };

                    const tAsset = assets.find(a => a.id === targetObjectId);
                    if (tAsset) target = { type: 'asset', object: tAsset };
                } else {
                    if (selected.type === 'wall') return;

                    const centerObj = selected.object as (Shape | Asset);
                    const centerX = centerObj.x;
                    const centerY = centerObj.y;

                    const containers = findContainingObjects({ x: centerX, y: centerY }, shapes, walls, assets, selectedId);

                    if (containers.length > 0) {
                        target = containers[containers.length - 1];
                    } else {
                        const nearest = findNearestObject({ x: centerX, y: centerY }, shapes, walls, assets, selectedId);
                        if (nearest) target = nearest;
                    }
                }

                if (!target) return;

                const anchors = getAnchorsForObject(target);
                const targetAnchor = anchors.find(a => a.id === anchorType);

                if (targetAnchor) {
                    const selectedAnchors = getAnchorsForObject(selected);
                    const selectedAnchorPoint = selectedAnchors.find(a => a.id === anchorType);

                    if (selectedAnchorPoint) {
                        const obj = selected.object as (Shape | Asset);
                        const offsetX = selectedAnchorPoint.x - obj.x;
                        const offsetY = selectedAnchorPoint.y - obj.y;

                        const newX = targetAnchor.x - offsetX;
                        const newY = targetAnchor.y - offsetY;

                        if (selected.type === 'shape') {
                            get().updateShape(selectedId, { x: newX, y: newY });
                        } else if (selected.type === 'asset') {
                            get().updateAsset(selectedId, { x: newX, y: newY });
                        }
                    }
                }
            },

            // Clipboard methods
            copySelection: (selectedIds: string[]) => {
                const { shapes, walls, assets, textAnnotations, labelArrows, dimensions } = get();
                const clipboardData: Array<{ type: 'shape' | 'wall' | 'asset' | 'textAnnotation' | 'labelArrow' | 'dimension'; data: any }> = [];

                selectedIds.forEach(id => {
                    const shape = shapes.find(s => s.id === id);
                    if (shape) {
                        clipboardData.push({ type: 'shape', data: { ...shape } });
                        return;
                    }

                    const wall = walls.find(w => w.id === id);
                    if (wall) {
                        clipboardData.push({ type: 'wall', data: { ...wall } });
                        return;
                    }

                    const asset = assets.find(a => a.id === id);
                    if (asset) {
                        clipboardData.push({ type: 'asset', data: { ...asset } });
                        return;
                    }

                    const textAnn = textAnnotations.find(t => t.id === id);
                    if (textAnn) {
                        clipboardData.push({ type: 'textAnnotation', data: { ...textAnn } });
                        return;
                    }

                    const labelArr = labelArrows.find(l => l.id === id);
                    if (labelArr) {
                        clipboardData.push({ type: 'labelArrow', data: JSON.parse(JSON.stringify(labelArr)) });
                        return;
                    }

                    const dim = dimensions.find(d => d.id === id);
                    if (dim) {
                        clipboardData.push({ type: 'dimension', data: JSON.parse(JSON.stringify(dim)) });
                        return;
                    }
                });

                set({ clipboard: clipboardData });
            },

            cutSelection: (selectedIds: string[]) => {
                get().copySelection(selectedIds);
                get().saveToHistory();

                const { shapes, walls, assets, textAnnotations, labelArrows, dimensions } = get();
                const newShapes = shapes.filter(s => !selectedIds.includes(s.id));
                const newWalls = walls.filter(w => !selectedIds.includes(w.id));
                const newAssets = assets.filter(a => !selectedIds.includes(a.id));
                const newTextAnnotations = textAnnotations.filter(t => !selectedIds.includes(t.id));
                const newLabelArrows = labelArrows.filter(l => !selectedIds.includes(l.id));
                const newDimensions = dimensions.filter(d => !selectedIds.includes(d.id));

                set({ shapes: newShapes, walls: newWalls, assets: newAssets, textAnnotations: newTextAnnotations, labelArrows: newLabelArrows, dimensions: newDimensions });
            },

            pasteSelection: (cursorPos?: { x: number; y: number }) => {
                const { clipboard, shapes, walls, assets, textAnnotations, labelArrows, dimensions } = get();
                if (clipboard.length === 0) return [];

                get().saveToHistory();
                const newIds: string[] = [];

                // Calculate center of clipboard items
                let centerX = 0;
                let centerY = 0;
                let count = 0;
                clipboard.forEach(item => {
                    if (item.type === 'shape' || item.type === 'asset') {
                        centerX += item.data.x;
                        centerY += item.data.y;
                        count++;
                    } else if (item.type === 'wall' && item.data.nodes.length > 0) {
                        const avgX = item.data.nodes.reduce((sum: number, n: any) => sum + n.x, 0) / item.data.nodes.length;
                        const avgY = item.data.nodes.reduce((sum: number, n: any) => sum + n.y, 0) / item.data.nodes.length;
                        centerX += avgX;
                        centerY += avgY;
                        count++;
                    } else if (item.type === 'textAnnotation') {
                        centerX += item.data.x;
                        centerY += item.data.y;
                        count++;
                    } else if (item.type === 'labelArrow') {
                        centerX += item.data.startPoint.x;
                        centerY += item.data.startPoint.y;
                        count++;
                    } else if (item.type === 'dimension' && item.data.startPoint && item.data.endPoint) {
                        centerX += (item.data.startPoint.x + item.data.endPoint.x) / 2;
                        centerY += (item.data.startPoint.y + item.data.endPoint.y) / 2;
                        count++;
                    }
                });
                if (count > 0) {
                    centerX /= count;
                    centerY /= count;
                }

                // If cursor position provided, paste at cursor; otherwise use zero offset (paste-in-place)
                const offsetX = cursorPos ? cursorPos.x - centerX : 0;
                const offsetY = cursorPos ? cursorPos.y - centerY : 0;

                const newShapes = [...shapes];
                const newWalls = [...walls];
                const newAssets = [...assets];
                const newTextAnnotations = [...textAnnotations];
                const newLabelArrows = [...labelArrows];
                const newDimensions = [...dimensions];

                const generateId = (): string => {
                    try {
                        return crypto.randomUUID();
                    } catch {
                        return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
                    }
                };
                
                clipboard.forEach(item => {
                    const newId = generateId();
                    newIds.push(newId);

                    if (item.type === 'shape') {
                        const newShape = { ...item.data, id: newId, x: item.data.x + offsetX, y: item.data.y + offsetY };
                        newShapes.push(newShape);
                    } else if (item.type === 'wall') {
                        const newNodes = item.data.nodes.map((n: any) => ({ ...n, x: n.x + offsetX, y: n.y + offsetY }));
                        const newWall = { ...item.data, id: newId, nodes: newNodes };
                        newWalls.push(newWall);
                    } else if (item.type === 'asset') {
                        const newAsset = { ...item.data, id: newId, x: item.data.x + offsetX, y: item.data.y + offsetY };
                        newAssets.push(newAsset);
                    } else if (item.type === 'textAnnotation') {
                        const newText = { ...item.data, id: newId, x: item.data.x + offsetX, y: item.data.y + offsetY };
                        newTextAnnotations.push(newText);
                    } else if (item.type === 'labelArrow') {
                        const newLabel = {
                            ...item.data,
                            id: newId,
                            startPoint: { x: item.data.startPoint.x + offsetX, y: item.data.startPoint.y + offsetY },
                            endPoint: { x: item.data.endPoint.x + offsetX, y: item.data.endPoint.y + offsetY },
                        };
                        newLabelArrows.push(newLabel);
                    } else if (item.type === 'dimension') {
                        const newDim = {
                            ...item.data,
                            id: newId,
                            startPoint: {
                                x: item.data.startPoint.x + offsetX,
                                y: item.data.startPoint.y + offsetY
                            },
                            endPoint: {
                                x: item.data.endPoint.x + offsetX,
                                y: item.data.endPoint.y + offsetY
                            }
                        };
                        newDimensions.push(newDim);
                    }
                });

                set({ shapes: newShapes, walls: newWalls, assets: newAssets, textAnnotations: newTextAnnotations, labelArrows: newLabelArrows, dimensions: newDimensions });
                return newIds;
            },

            removeItemsBatch: (ids: string[], skipHistory = false) => {
                if (!skipHistory) get().saveToHistory();
                
                const state = get();
                const allResolvedIdsToDelete = state.resolveIdsWithGroups(ids);
                const idsToDelete = new Set([...ids, ...allResolvedIdsToDelete]);

                // Also find any groups whose items are being deleted
                state.groups.forEach(g => {
                    if (g.itemIds.some(itemId => idsToDelete.has(itemId))) {
                        idsToDelete.add(g.id);
                    }
                });

                const deletedWalls = state.walls.filter((w) => idsToDelete.has(w.id));
                const deletedShapes = state.shapes.filter((s) => idsToDelete.has(s.id));
                const deletedAssets = state.assets.filter((a) => idsToDelete.has(a.id));
                const deletedWallIds = new Set(deletedWalls.map((w) => w.id));

                const getRotatedBounds = (item: { x: number; y: number; width: number; height: number; rotation?: number; scale?: number }) => {
                    const width = item.width * (item.scale || 1);
                    const height = item.height * (item.scale || 1);
                    const halfW = width / 2;
                    const halfH = height / 2;
                    const rot = ((item.rotation || 0) * Math.PI) / 180;
                    const cos = Math.cos(rot);
                    const sin = Math.sin(rot);
                    const corners = [
                        { x: -halfW, y: -halfH },
                        { x: halfW, y: -halfH },
                        { x: halfW, y: halfH },
                        { x: -halfW, y: halfH },
                    ].map((corner) => ({
                        x: item.x + corner.x * cos - corner.y * sin,
                        y: item.y + corner.x * sin + corner.y * cos,
                    }));

                    return {
                        minX: Math.min(...corners.map((point) => point.x)),
                        minY: Math.min(...corners.map((point) => point.y)),
                        maxX: Math.max(...corners.map((point) => point.x)),
                        maxY: Math.max(...corners.map((point) => point.y)),
                    };
                };

                const getWallBounds = (wall: Wall) => {
                    if (wall.nodes.length === 0) return null;
                    const maxThickness = Math.max(0, ...wall.edges.map((edge) => edge.thickness || 150));
                    const pad = maxThickness / 2;
                    return {
                        minX: Math.min(...wall.nodes.map((node) => node.x)) - pad,
                        minY: Math.min(...wall.nodes.map((node) => node.y)) - pad,
                        maxX: Math.max(...wall.nodes.map((node) => node.x)) + pad,
                        maxY: Math.max(...wall.nodes.map((node) => node.y)) + pad,
                    };
                };

                const deletedBounds = [
                    ...deletedShapes.map((shape) => ({ id: shape.id, bounds: getRotatedBounds(shape), tolerance: 90 })),
                    ...deletedAssets.map((asset) => ({ id: asset.id, bounds: getRotatedBounds(asset), tolerance: 90 })),
                    ...deletedWalls
                        .map((wall) => {
                            const bounds = getWallBounds(wall);
                            return bounds ? { id: wall.id, bounds, tolerance: 120 } : null;
                        })
                        .filter((entry): entry is { id: string; bounds: { minX: number; minY: number; maxX: number; maxY: number }; tolerance: number } => Boolean(entry)),
                ];

                const pointTouchesDeletedItem = (point: Point) => deletedBounds.some(({ bounds, tolerance }) => (
                    point.x >= bounds.minX - tolerance &&
                    point.x <= bounds.maxX + tolerance &&
                    point.y >= bounds.minY - tolerance &&
                    point.y <= bounds.maxY + tolerance
                ));

                const shouldRemoveDimension = (dimension: Dimension) => {
                    if (idsToDelete.has(dimension.id)) return true;
                    if (dimension.targetId && idsToDelete.has(dimension.targetId)) return true;
                    if (dimension.targetIds?.some((id) => idsToDelete.has(id))) return true;
                    return pointTouchesDeletedItem(dimension.startPoint) || pointTouchesDeletedItem(dimension.endPoint);
                };

                const cleanupCollinearSplitNodes = (wall: Wall): Wall => {
                    if (deletedWallIds.size === 0 || wall.nodes.length === 0 || wall.edges.length === 0) return wall;

                    let nodes = wall.nodes.map((node) => ({ ...node }));
                    let edges = wall.edges.map((edge) => ({ ...edge }));
                    const tolerance = 0.75;

                    let changed = true;
                    while (changed) {
                        changed = false;

                        for (const node of nodes) {
                            const connectedEdges = edges.filter((edge) => edge.nodeA === node.id || edge.nodeB === node.id);
                            if (connectedEdges.length !== 2) continue;

                            const [edgeA, edgeB] = connectedEdges;
                            if ((edgeA.thickness || 150) !== (edgeB.thickness || 150)) continue;

                            const otherAId = edgeA.nodeA === node.id ? edgeA.nodeB : edgeA.nodeA;
                            const otherBId = edgeB.nodeA === node.id ? edgeB.nodeB : edgeB.nodeA;
                            if (otherAId === otherBId) continue;

                            const otherA = nodes.find((entry) => entry.id === otherAId);
                            const otherB = nodes.find((entry) => entry.id === otherBId);
                            if (!otherA || !otherB) continue;

                            const ax = node.x - otherA.x;
                            const ay = node.y - otherA.y;
                            const bx = otherB.x - node.x;
                            const by = otherB.y - node.y;
                            const lenA = Math.hypot(ax, ay);
                            const lenB = Math.hypot(bx, by);
                            if (lenA < 0.01 || lenB < 0.01) continue;

                            const crossDistance = Math.abs(ax * by - ay * bx) / Math.max(lenA, lenB);
                            const dot = (ax * bx + ay * by) / (lenA * lenB);
                            if (crossDistance > tolerance || dot < 0.999) continue;

                            const mergedEdge: WallEdge = {
                                id: `edge-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
                                nodeA: otherAId,
                                nodeB: otherBId,
                                thickness: edgeA.thickness || edgeB.thickness || 150,
                            };

                            nodes = nodes.filter((entry) => entry.id !== node.id);
                            edges = edges
                                .filter((edge) => edge.id !== edgeA.id && edge.id !== edgeB.id)
                                .concat(mergedEdge);
                            changed = true;
                            break;
                        }
                    }

                    const usedNodeIds = new Set(edges.flatMap((edge) => [edge.nodeA, edge.nodeB]));
                    nodes = nodes.filter((node) => usedNodeIds.has(node.id) || edges.length === 0);

                    return nodes.length !== wall.nodes.length || edges.length !== wall.edges.length
                        ? { ...wall, nodes, edges }
                        : wall;
                };

                // If a preloaded venue is explicitly deleted, register its deleted state in localStorage so refreshes don't restore it
                if (typeof window !== 'undefined' && deletedAssets.length > 0) {
                    // Try to resolve the current event ID from query parameters or window path URL
                    const pathParts = window.location.pathname.split('/');
                    const currentEventId = pathParts[pathParts.length - 1];
                    if (currentEventId) {
                        deletedAssets.forEach(asset => {
                            const storageKey = `preloaded-venue-loaded-${currentEventId}-${asset.type}`;
                            if (window.localStorage.getItem(storageKey) === 'loaded') {
                                window.localStorage.setItem(storageKey, 'deleted');
                                console.log(`[projectStore] Venue ${asset.type} marked as deleted in localStorage.`);
                            }
                        });
                    }
                }

                set((state) => ({
                    walls: state.walls.filter((w) => !idsToDelete.has(w.id)).map(cleanupCollinearSplitNodes),
                    shapes: state.shapes.filter((s) => !idsToDelete.has(s.id)),
                    assets: state.assets.filter((a) => !idsToDelete.has(a.id)),
                    dimensions: state.dimensions.filter((d) => !shouldRemoveDimension(d)),
                    labelArrows: state.labelArrows.filter((la) => !idsToDelete.has(la.id)),
                    textAnnotations: state.textAnnotations.filter((ta) => !idsToDelete.has(ta.id)),
                    groups: state.groups.filter((g) => !idsToDelete.has(g.id)),
                    hasUnsavedChanges: true,
                }));
            },

            batchUpdateItems: (items: { id: string; type: 'shape' | 'asset' | 'wall' | 'dimension' | 'textAnnotation' | 'labelArrow'; updates: any }[], skipHistory = false) => {
                if (!skipHistory) get().saveToHistory();
                set((state) => {
                    const shapeUpdates = new Map<string, any>();
                    const assetUpdates = new Map<string, any>();
                    const wallUpdates = new Map<string, any>();
                    const dimensionUpdates = new Map<string, any>();
                    const textAnnotationUpdates = new Map<string, any>();
                    const labelArrowUpdates = new Map<string, any>();
                    
                    items.forEach(item => {
                        if (item.type === 'shape') {
                            shapeUpdates.set(item.id, item.updates);
                        } else if (item.type === 'asset') {
                            assetUpdates.set(item.id, item.updates);
                        } else if (item.type === 'wall') {
                            wallUpdates.set(item.id, item.updates);
                        } else if (item.type === 'dimension') {
                            dimensionUpdates.set(item.id, item.updates);
                        } else if (item.type === 'textAnnotation') {
                            textAnnotationUpdates.set(item.id, item.updates);
                        } else if (item.type === 'labelArrow') {
                            labelArrowUpdates.set(item.id, item.updates);
                        }
                    });

                    return {
                        shapes: shapeUpdates.size > 0 ? state.shapes.map(s => {
                            const updates = shapeUpdates.get(s.id);
                            return updates ? { ...s, ...updates } : s;
                        }) : state.shapes,
                        assets: assetUpdates.size > 0 ? state.assets.map(a => {
                            const updates = assetUpdates.get(a.id);
                            return updates ? { ...a, ...updates } : a;
                        }) : state.assets,
                        walls: wallUpdates.size > 0 ? state.walls.map(w => {
                            const updates = wallUpdates.get(w.id);
                            return updates ? { ...w, ...updates } : w;
                        }) : state.walls,
                        dimensions: dimensionUpdates.size > 0 ? state.dimensions.map(d => {
                            const updates = dimensionUpdates.get(d.id);
                            return updates ? { ...d, ...updates } : d;
                        }) : state.dimensions,
                        textAnnotations: textAnnotationUpdates.size > 0 ? state.textAnnotations.map(ta => {
                            const updates = textAnnotationUpdates.get(ta.id);
                            return updates ? { ...ta, ...updates } : ta;
                        }) : state.textAnnotations,
                        labelArrows: labelArrowUpdates.size > 0 ? state.labelArrows.map(la => {
                            const updates = labelArrowUpdates.get(la.id);
                            return updates ? { ...la, ...updates } : la;
                        }) : state.labelArrows,
                        hasUnsavedChanges: true,
                    };
                });
            },

            // Dimension methods
            addDimension: (dimension, skipHistory = false) => {
                if (!skipHistory) get().saveToHistory();
                set((state) => ({
                    dimensions: [...state.dimensions, dimension],
                    hasUnsavedChanges: !skipHistory || state.hasUnsavedChanges,
                }));
            },

            updateDimension: (id, updates, skipHistory = false) => {
                if (!skipHistory) get().saveToHistory();
                set((state) => ({
                    dimensions: state.dimensions.map((d) => (d.id === id ? { ...d, ...updates } : d)),
                    hasUnsavedChanges: true,
                }));
            },

            removeDimension: (id, skipHistory = false) => {
                if (!skipHistory) get().saveToHistory();
                set((state) => ({
                    dimensions: state.dimensions.filter((d) => d.id !== id),
                    hasUnsavedChanges: true,
                }));
            },

            // Text Annotation methods
            addTextAnnotation: (annotation, skipHistory = false) => {
                if (!skipHistory) get().saveToHistory();
                set((state) => ({
                    textAnnotations: [...state.textAnnotations, annotation],
                    hasUnsavedChanges: !skipHistory || state.hasUnsavedChanges,
                }));
            },

            updateTextAnnotation: (id, updates, skipHistory = false) => {
                if (!skipHistory) get().saveToHistory();
                set((state) => ({
                    textAnnotations: state.textAnnotations.map((a) => (a.id === id ? { ...a, ...updates } : a)),
                    hasUnsavedChanges: true,
                }));
            },

            removeTextAnnotation: (id, skipHistory = false) => {
                if (!skipHistory) get().saveToHistory();
                set((state) => ({
                    textAnnotations: state.textAnnotations.filter((a) => a.id !== id),
                    hasUnsavedChanges: true,
                }));
            },

            // Label Arrow methods
            addLabelArrow: (arrow, skipHistory = false) => {
                if (!skipHistory) get().saveToHistory();
                set((state) => ({
                    labelArrows: [...state.labelArrows, arrow],
                    hasUnsavedChanges: !skipHistory || state.hasUnsavedChanges,
                }));
            },

            updateLabelArrow: (id, updates, skipHistory = false) => {
                if (!skipHistory) get().saveToHistory();
                set((state) => ({
                    labelArrows: state.labelArrows.map((a) => (a.id === id ? { ...a, ...updates } : a)),
                    hasUnsavedChanges: true,
                }));
            },

            removeLabelArrow: (id, skipHistory = false) => {
                if (!skipHistory) get().saveToHistory();
                set((state) => ({
                    labelArrows: state.labelArrows.filter((a) => a.id !== id),
                    hasUnsavedChanges: true,
                }));
            },

            // Comment methods
            addComment: (comment, skipHistory = false) => {
                if (!skipHistory) get().saveToHistory();
                const newComment = { ...comment };
                set((state) => ({
                    comments: [...state.comments, newComment],
                    hasUnsavedChanges: true,
                }));
            },

            updateComment: (id, updates, skipHistory = false) => {
                if (!skipHistory) get().saveToHistory();
                set((state) => ({
                    comments: state.comments.map((c) => (c.id === id ? { ...c, ...updates } : c)),
                    hasUnsavedChanges: true,
                }));
            },

            removeComment: (id, skipHistory = false) => {
                if (!skipHistory) get().saveToHistory();
                set((state) => ({
                    comments: state.comments.filter((c) => c.id !== id),
                    hasUnsavedChanges: true,
                }));
            },

            resolveComment: (id) => {
                get().saveToHistory();
                set((state) => ({
                    comments: state.comments.map((c) => (c.id === id ? { ...c, resolved: true } : c)),
                    hasUnsavedChanges: true,
                }));
            },

            // Wall Junction methods
            splitWallEdge: (wallId, edgeId, point, skipHistory = false) => {
                const wall = get().walls.find((w) => w.id === wallId);
                if (!wall) {
                    console.error(`Wall ${wallId} not found`);
                    return null as any;
                }
                const edge = wall.edges.find((e) => e.id === edgeId);
                if (!edge) {
                    console.error(`Edge ${edgeId} not found in wall ${wallId}`);
                    return null as any;
                }

                const newNode: WallNode = {
                    id: `node-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                    x: point.x,
                    y: point.y,
                };

                const edge1: WallEdge = {
                    id: `edge-${Date.now()}-a`,
                    nodeA: edge.nodeA,
                    nodeB: newNode.id,
                    thickness: edge.thickness,
                };

                const edge2: WallEdge = {
                    id: `edge-${Date.now()}-b`,
                    nodeA: newNode.id,
                    nodeB: edge.nodeB,
                    thickness: edge.thickness,
                };

                if (!skipHistory) get().saveToHistory();
                set((state) => ({
                    walls: state.walls.map((w) =>
                        w.id === wallId
                            ? {
                                ...w,
                                nodes: [...w.nodes, newNode],
                                edges: w.edges.filter((e) => e.id !== edgeId).concat([edge1, edge2]),
                            }
                            : w
                    ),
                    hasUnsavedChanges: true,
                }));

                return newNode;
            },

            connectWallToEdge: (sourceWallId, sourceNodeId, targetWallId, targetEdgeId, point, skipHistory = false) => {
                if (!skipHistory) get().saveToHistory();
                const newNode = get().splitWallEdge(targetWallId, targetEdgeId, point, true);
                if (!newNode) return;

                set((state) => ({
                    walls: state.walls.map((w) => {
                        if (w.id === sourceWallId) {
                            return {
                                ...w,
                                nodes: w.nodes.map((n) =>
                                    n.id === sourceNodeId ? newNode : n
                                ),
                                edges: w.edges.map((e) => ({
                                    ...e,
                                    nodeA: e.nodeA === sourceNodeId ? newNode.id : e.nodeA,
                                    nodeB: e.nodeB === sourceNodeId ? newNode.id : e.nodeB,
                                })),
                            };
                        }
                        return w;
                    }),
                    hasUnsavedChanges: true,
                }));
            },

            reset: () => {
                set({
                    projectId: null,
                    projectName: 'Untitled Project',
                    canvas: DEFAULT_CANVAS,
                    walls: [],
                    wallSegments: [],
                    shapes: [],
                    assets: [],
                    layers: [DEFAULT_LAYER],
                    activeLayerId: DEFAULT_LAYER.id,
                    history: { past: [], future: [] },
                    hasUnsavedChanges: false,
                    dimensions: [],
                    textAnnotations: [],
                    labelArrows: [],
                    groups: [],
                    clipboard: [],
                });
            },
        }),
        {
            name: "project-storage",
            partialize: (state) => ({
                projectId: state.projectId,
                projectName: state.projectName,
                canvas: state.canvas,
                walls: state.walls,
                wallSegments: state.wallSegments,
                shapes: state.shapes,
                assets: state.assets,
                layers: state.layers,
                dimensions: state.dimensions,
                textAnnotations: state.textAnnotations,
                labelArrows: state.labelArrows,
                groups: state.groups,
                activeLayerId: state.activeLayerId,
                comments: state.comments,
            }),
        }
    )
);
