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

export type Wall = {
    id: string;
    nodes: WallNode[];
    edges: WallEdge[];
    zIndex: number;
};

export type Shape = {
    id: string;
    type: 'rectangle' | 'ellipse' | 'line' | 'arrow' | 'freehand';
    x: number;
    y: number;
    width: number;
    height: number;
    rotation: number;
    fill?: string;
    stroke?: string;
    strokeWidth?: number;
    points?: { x: number; y: number }[]; // For freehand paths
    zIndex: number;
};

export type Asset = {
    id: string;
    type: string; // e.g., 'chair', 'table', 'door', 'window'
    x: number;
    y: number;
    width: number;
    height: number;
    rotation: number;
    scale: number;
    zIndex: number;
    attachedToWallId?: string; // For doors/windows attached to walls
    metadata?: Record<string, any>;

    // Visual properties
    fillColor?: string;
    strokeColor?: string;
    strokeWidth?: number;
    opacity?: number;

    // Text properties
    text?: string;
    fontSize?: number;
    textColor?: string;
    fontFamily?: string;

    // Line/Wall properties
    lineColor?: string;
    lineGap?: number;
    wallThickness?: number;
    wallGap?: number;
    backgroundColor?: string;
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

export type Dimension = {
    id: string;
    type: 'linear' | 'wall'; // 'wall' is auto-generated/linked
    startPoint: { x: number, y: number };
    endPoint: { x: number, y: number };
    offset: number; // Distance from the measured line
    value?: number; // Optional override, otherwise calculated
    targetId?: string; // ID of the object being measured (e.g., wall ID)
    zIndex: number;
};

export type Comment = {
    id: string;
    x: number;
    y: number;
    content: string;
    author: string;
    timestamp: number;
    resolved: boolean;
};

// ============================================================================
// Store
// ============================================================================

export type ProjectState = {
    // Project metadata
    projectId: string | null;
    projectName: string;

    // Canvas
    canvas: Canvas;

    // Data
    walls: Wall[]; // Legacy wall system (node-edge based)
    wallSegments: WallSegment[]; // New wall engine (segment-based)
    shapes: Shape[];
    assets: Asset[];
    comments: Comment[];
    layers: Layer[];

    // Active layer
    activeLayerId: string | null;

    // History
    history: {
        past: Array<{ walls: Wall[]; shapes: Shape[]; assets: Asset[] }>;
        future: Array<{ walls: Wall[]; shapes: Shape[]; assets: Asset[] }>;
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
    addWall: (wall: Wall) => void;
    updateWall: (id: string, updates: Partial<Wall>, skipHistory?: boolean) => void;
    removeWall: (id: string) => void;
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
    removeWallNode: (wallId: string, nodeId: string) => void;

    addWallEdge: (wallId: string, edge: WallEdge) => void;
    updateWallEdge: (wallId: string, edgeId: string, updates: Partial<WallEdge>) => void;
    removeWallEdge: (wallId: string, edgeId: string) => void;

    // Methods - Shapes
    addShape: (shape: Shape) => void;
    updateShape: (id: string, updates: Partial<Shape>, skipHistory?: boolean) => void;
    removeShape: (id: string) => void;
    getShape: (id: string) => Shape | undefined;

    // Methods - Assets
    addAsset: (asset: Asset) => void;
    updateAsset: (id: string, updates: Partial<Asset>, skipHistory?: boolean) => void;
    removeAsset: (id: string) => void;
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
    commitDragHistory: (snapshot: { walls: Wall[]; shapes: Shape[]; assets: Asset[] }) => void;

    // Methods - Utility
    getNextZIndex: () => number;
    markAsSaved: () => void;
    reset: () => void;

    // Methods - Snap
    snapToAnchor: (selectedId: string, anchorType: string, targetObjectId?: string) => void;

    // Methods - Clipboard
    clipboard: Array<{ type: 'shape' | 'wall' | 'asset'; data: any }>;
    copySelection: (selectedIds: string[]) => void;
    cutSelection: (selectedIds: string[]) => void;
    pasteSelection: () => string[]; // Returns new IDs for selection

    // Methods - Dimensions
    dimensions: Dimension[];
    addDimension: (dimension: Dimension) => void;
    updateDimension: (id: string, updates: Partial<Dimension>) => void;
    removeDimension: (id: string) => void;

    // Methods - Comments
    addComment: (comment: Comment) => void;
    updateComment: (id: string, updates: Partial<Comment>) => void;
    removeComment: (id: string) => void;
    resolveComment: (id: string) => void;

    // Methods - Wall Junctions
    splitWallEdge: (wallId: string, edgeId: string, point: { x: number; y: number }) => WallNode;
    connectWallToEdge: (
        sourceWallId: string,
        sourceNodeId: string,
        targetWallId: string,
        targetEdgeId: string,
        point: { x: number; y: number }
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

export const useProjectStore = create<ProjectState>()(
    persist(
        (set, get) => ({
            // Initial state
            projectId: null,
            projectName: 'Untitled Project',
            canvas: DEFAULT_CANVAS,
            walls: [],
            wallSegments: [], // New wall engine segments
            shapes: [],
            assets: [],
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

            // Persistence Actions
            clearWorkspace: () => {
                console.log('→ Clearing workspace (preventing localStorage pollution)');
                set({
                    shapes: [],
                    assets: [],
                    walls: [],
                    layers: [DEFAULT_LAYER],
                    canvas: DEFAULT_CANVAS,
                    hasUnsavedChanges: false,
                    lastSaved: undefined,
                });
            },

            loadEvent: async (eventId: string, slug: string) => {
                set({ isSaving: true });
                try {
                    const response = await apiRequest(`/projects/${slug}/events/${eventId}`, 'GET');
                    const data = response.data;

                    if (data.canvasData) {
                        // Load from rich canvasData if available
                        const { shapes, assets, walls, layers, canvas } = data.canvasData;
                        set({
                            shapes: shapes || [],
                            assets: assets || [],
                            walls: walls || [],
                            layers: layers || [DEFAULT_LAYER],
                            canvas: canvas || DEFAULT_CANVAS,
                            hasUnsavedChanges: false,
                            lastSaved: new Date(),
                        });
                        console.log(`✓ Loaded event ${eventId} from backend`);
                    } else if (data.canvasAssets) {
                        // Fallback to legacy canvasAssets
                        set({ hasUnsavedChanges: false, lastSaved: new Date() });
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
                            layers: [DEFAULT_LAYER],
                            canvas: DEFAULT_CANVAS,
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
                const { shapes, assets, walls, layers, canvas } = get();
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
                    
                    const canvasData = { shapes, assets, walls, layers, canvas };
                    
                    // CRITICAL: Save complete asset data, not just id/type/x/y
                    // Convert shapes, assets, and walls to canvasAssets format with ALL properties
                    const canvasAssets: any[] = [];
                    
                    // Convert shapes to canvasAssets
                    shapes.forEach(shape => {
                        canvasAssets.push({
                            id: shape.id,
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
                            id: asset.id,
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
                    
                    // Convert walls to canvasAssets (wall-polygon format)
                    walls.forEach(wall => {
                        // Convert wall nodes/edges to wallPolygon format
                        const wallPolygon = wall.nodes.map(node => ({
                            x: node.x - wall.nodes[0].x, // Relative to first node
                            y: node.y - wall.nodes[0].y,
                        }));
                        
                        const centerline = wall.edges.length > 0 ? [
                            { x: 0, y: 0 },
                            { x: wall.nodes[wall.nodes.length - 1].x - wall.nodes[0].x, y: wall.nodes[wall.nodes.length - 1].y - wall.nodes[0].y }
                        ] : [];
                        
                        canvasAssets.push({
                            id: wall.id,
                            type: 'wall-polygon',
                            x: wall.nodes[0]?.x || 0,
                            y: wall.nodes[0]?.y || 0,
                            wallPolygon,
                            centerline,
                            wallThickness: wall.edges[0]?.thickness || 75,
                            strokeColor: '#1E40AF',
                            backgroundColor: '#F3F4F6',
                            strokeWidth: 2,
                            zIndex: wall.zIndex,
                        });
                    });

                    // PUT /projects/{slug}/events/{eventId}
                    // Include all required fields: name, type, canvases, canvasData, canvasAssets
                    const payload = {
                        name: eventName,
                        type: eventType,
                        canvases: canvases,
                        canvasData,
                        canvasAssets
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
            addWall: (wall) => {
                get().saveToHistory();
                set((state) => ({
                    walls: [...state.walls, wall],
                    hasUnsavedChanges: true,
                }));
            },

            updateWall: (id, updates, skipHistory = false) => {
                if (!skipHistory) get().saveToHistory();
                set((state) => ({
                    walls: state.walls.map((w) => (w.id === id ? { ...w, ...updates } : w)),
                    hasUnsavedChanges: true,
                }));
            },

            removeWall: (id) => {
                get().saveToHistory();
                set((state) => ({
                    walls: state.walls.filter((w) => w.id !== id),
                    hasUnsavedChanges: true,
                }));
            },

            getWall: (id) => {
                return get().walls.find((w) => w.id === id);
            },

            // Wall node operations
            addWallNode: (wallId, node) => {
                set((state) => ({
                    walls: state.walls.map((w) =>
                        w.id === wallId ? { ...w, nodes: [...w.nodes, node] } : w
                    ),
                    hasUnsavedChanges: true,
                }));
            },

            updateWallNode: (wallId, nodeId, updates) => {
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

            removeWallNode: (wallId, nodeId) => {
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
                set((state) => ({
                    walls: state.walls.map((w) =>
                        w.id === wallId ? { ...w, edges: [...w.edges, edge] } : w
                    ),
                    hasUnsavedChanges: true,
                }));
            },

            updateWallEdge: (wallId, edgeId, updates) => {
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

            removeWallEdge: (wallId, edgeId) => {
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
            addShape: (shape) => {
                get().saveToHistory();
                set((state) => ({
                    shapes: [...state.shapes, shape],
                    hasUnsavedChanges: true,
                }));
            },

            updateShape: (id, updates, skipHistory = false) => {
                if (!skipHistory) get().saveToHistory();
                set((state) => ({
                    shapes: state.shapes.map((s) => (s.id === id ? { ...s, ...updates } : s)),
                    hasUnsavedChanges: true,
                }));
            },

            removeShape: (id) => {
                get().saveToHistory();
                set((state) => ({
                    shapes: state.shapes.filter((s) => s.id !== id),
                    hasUnsavedChanges: true,
                }));
            },

            getShape: (id) => {
                return get().shapes.find((s) => s.id === id);
            },

            // Asset methods
            addAsset: (asset) => {
                get().saveToHistory();
                set((state) => ({
                    assets: [...state.assets, asset],
                    hasUnsavedChanges: true,
                }));
            },

            updateAsset: (id, updates, skipHistory = false) => {
                if (!skipHistory) get().saveToHistory();
                set((state) => ({
                    assets: state.assets.map((a) => (a.id === id ? { ...a, ...updates } : a)),
                    hasUnsavedChanges: true,
                }));
            },

            removeAsset: (id) => {
                get().saveToHistory();
                set((state) => ({
                    assets: state.assets.filter((a) => a.id !== id),
                    hasUnsavedChanges: true,
                }));
            },

            getAsset: (id) => {
                return get().assets.find((a) => a.id === id);
            },

            // Layer methods
            addLayer: (layer) => {
                set((state) => ({
                    layers: [...state.layers, layer],
                    hasUnsavedChanges: true,
                }));
            },

            updateLayer: (id, updates) => {
                set((state) => ({
                    layers: state.layers.map((l) => (l.id === id ? { ...l, ...updates } : l)),
                    hasUnsavedChanges: true,
                }));
            },

            removeLayer: (id) => {
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
                const { history, walls, shapes, assets } = get();
                if (history.past.length === 0) return;

                const previous = history.past[history.past.length - 1];
                const newPast = history.past.slice(0, history.past.length - 1);

                set({
                    walls: previous.walls,
                    shapes: previous.shapes,
                    assets: previous.assets,
                    history: {
                        past: newPast,
                        future: [{ walls, shapes, assets }, ...history.future],
                    },
                    hasUnsavedChanges: true,
                });
            },

            redo: () => {
                const { history, walls, shapes, assets } = get();
                if (history.future.length === 0) return;

                const next = history.future[0];
                const newFuture = history.future.slice(1);

                set({
                    walls: next.walls,
                    shapes: next.shapes,
                    assets: next.assets,
                    history: {
                        past: [...history.past, { walls, shapes, assets }],
                        future: newFuture,
                    },
                    hasUnsavedChanges: true,
                });
            },

            saveToHistory: () => {
                const { walls, shapes, assets, history } = get();
                const newPast = [...history.past, { walls, shapes, assets }].slice(-50);
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

            commitDragHistory: (snapshot) => {
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
                const { shapes, walls, assets } = get();
                const clipboardData: Array<{ type: 'shape' | 'wall' | 'asset'; data: any }> = [];

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
                });

                set({ clipboard: clipboardData });
            },

            cutSelection: (selectedIds: string[]) => {
                get().copySelection(selectedIds);
                get().saveToHistory();

                const { shapes, walls, assets } = get();
                const newShapes = shapes.filter(s => !selectedIds.includes(s.id));
                const newWalls = walls.filter(w => !selectedIds.includes(w.id));
                const newAssets = assets.filter(a => !selectedIds.includes(a.id));

                set({ shapes: newShapes, walls: newWalls, assets: newAssets });
            },

            pasteSelection: () => {
                const { clipboard, shapes, walls, assets } = get();
                if (clipboard.length === 0) return [];

                get().saveToHistory();
                const newIds: string[] = [];
                const offset = 20;

                const newShapes = [...shapes];
                const newWalls = [...walls];
                const newAssets = [...assets];

                clipboard.forEach(item => {
                    const newId = crypto.randomUUID();
                    newIds.push(newId);

                    if (item.type === 'shape') {
                        const newShape = { ...item.data, id: newId, x: item.data.x + offset, y: item.data.y + offset };
                        newShapes.push(newShape);
                    } else if (item.type === 'wall') {
                        const newNodes = item.data.nodes.map((n: any) => ({ ...n, x: n.x + offset, y: n.y + offset }));
                        const newWall = { ...item.data, id: newId, nodes: newNodes };
                        newWalls.push(newWall);
                    } else if (item.type === 'asset') {
                        const newAsset = { ...item.data, id: newId, x: item.data.x + offset, y: item.data.y + offset };
                        newAssets.push(newAsset);
                    }
                });

                set({ shapes: newShapes, walls: newWalls, assets: newAssets });
                return newIds;
            },

            // Dimension methods
            addDimension: (dimension) => {
                get().saveToHistory();
                set((state) => ({
                    dimensions: [...state.dimensions, dimension],
                    hasUnsavedChanges: true,
                }));
            },

            updateDimension: (id, updates) => {
                get().saveToHistory();
                set((state) => ({
                    dimensions: state.dimensions.map((d) => (d.id === id ? { ...d, ...updates } : d)),
                    hasUnsavedChanges: true,
                }));
            },

            removeDimension: (id) => {
                get().saveToHistory();
                set((state) => ({
                    dimensions: state.dimensions.filter((d) => d.id !== id),
                    hasUnsavedChanges: true,
                }));
            },

            // Comment methods
            addComment: (comment) => {
                get().saveToHistory();
                const newComment = { ...comment, author: 'Jeremiah' };
                set((state) => ({
                    comments: [...state.comments, newComment],
                    hasUnsavedChanges: true,
                }));
            },

            updateComment: (id, updates) => {
                get().saveToHistory();
                set((state) => ({
                    comments: state.comments.map((c) => (c.id === id ? { ...c, ...updates } : c)),
                    hasUnsavedChanges: true,
                }));
            },

            removeComment: (id) => {
                get().saveToHistory();
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
            splitWallEdge: (wallId, edgeId, point) => {
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

                get().saveToHistory();
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

            connectWallToEdge: (sourceWallId, sourceNodeId, targetWallId, targetEdgeId, point) => {
                get().saveToHistory();
                const newNode = get().splitWallEdge(targetWallId, targetEdgeId, point);
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
                shapes: state.shapes,
                assets: state.assets,
                layers: state.layers,
                dimensions: state.dimensions,
            }),
        }
    )
);
