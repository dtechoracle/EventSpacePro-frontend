// sceneStore.ts
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { PAPER_SIZES, PaperSize } from "@/lib/paperSizes";

export type AssetInstance = {
  id: string;
  type: string;
  x: number;
  y: number;
  scale: number;
  rotation: number;
  zIndex: number; // for proper layering - higher values appear on top

  // Universal sizing properties
  width?: number; // for all assets
  height?: number; // for all assets

  // Shape-specific properties
  strokeWidth?: number; // for line
  fillColor?: string; // for shapes
  strokeColor?: string; // for line

  // Double-line specific properties
  lineGap?: number; // gap between the two lines
  lineColor?: string; // color of the double lines
  isHorizontal?: boolean; // orientation of double lines

  // Path-based line properties
  path?: { x: number; y: number }[]; // for drawn lines

  // Wall segment properties
  wallSegments?: { start: { x: number; y: number }; end: { x: number; y: number } }[]; // for wall segments
  wallThickness?: number; // thickness of wall lines
  wallGap?: number; // gap between wall lines
  // Graph representation (nodes + edges). Nodes are absolute mm positions; edges reference node indices
  wallNodes?: { x: number; y: number }[];
  wallEdges?: { a: number; b: number }[];

  // Text properties
  text?: string; // for text
  fontSize?: number; // for text
  textColor?: string; // for text
  fontFamily?: string; // for text

  // Universal background properties
  backgroundColor?: string; // for all assets, default white

  // Group properties
  isGroup?: boolean; // indicates if this asset is a group
  groupAssets?: AssetInstance[]; // assets contained within this group
  groupExpanded?: boolean; // whether the group is expanded in the UI
};

export type CanvasData = {
  size: string;
  width: number;
  height: number;
  _id: string;
};

export type EventData = {
  _id: string;
  name: string;
  type?: string;
  canvases: CanvasData[];
  canvasAssets: AssetInstance[];
  createdAt: string;
  updatedAt: string;
};

type SceneState = {
  canvas: {
    size: PaperSize; // for custom layouts we set a string casted to PaperSize
    width: number;
    height: number;
  } | null;
  assets: AssetInstance[];
  selectedAssetId: string | null;
  eventData: EventData | null;
  isInitialized: boolean;
  hasUnsavedChanges: boolean;
  showGrid: boolean;
  showDebugOutlines?: boolean;
  gridSize: number; // Grid size in mm
  snapToGridEnabled: boolean; // Whether to snap to grid
  
  // Grid size options
  availableGridSizes: number[]; // Available grid sizes in mm
  selectedGridSizeIndex: number; // Index of currently selected grid size
  
  // Wall type and size options
  wallType: 'thin' | 'standard' | 'thick' | 'extra-thick'; // Current wall type
  wallTool?: 'wall' | 'cross';
  availableWallTypes: Array<{
    id: 'thin' | 'standard' | 'thick' | 'extra-thick';
    label: string;
    thickness: number; // Thickness in mm
  }>;
  // Shape drawing
  shapeMode: 'rectangle' | 'ellipse' | 'line' | null;
  shapeStart: { x: number; y: number } | null;
  shapeTempEnd: { x: number; y: number } | null;

  // Pen tool state
  isPenMode: boolean;
  isWallMode: boolean;
  isDrawing: boolean;
  currentPath: { x: number; y: number }[];
  tempPath: { x: number; y: number }[];

  // Wall drawing state
  wallDrawingMode: boolean;
  currentWallSegments: { start: { x: number; y: number }; end: { x: number; y: number } }[];
  currentWallStart: { x: number; y: number } | null;
  currentWallTempEnd: { x: number; y: number } | null;
  // Tracking: remember first horizontal wall length during drawing
  firstHorizontalWallLength?: number | null;
  // New draft state (nodes-only while drawing)
  wallDraftNodes?: { x: number; y: number }[];

  // Chair placement settings
  chairSettings: {
    numChairs: number;
    radius: number;
  };

  // Copy/paste state
  clipboard: AssetInstance | null;

  // Undo/Redo state
  history: AssetInstance[][];
  historyIndex: number;

  // Smart duplication state
  lastDuplicatedAsset: AssetInstance | null;
  duplicationPattern: {
    type: 'linear' | 'circular' | 'grid' | null;
    center?: { x: number; y: number };
    angle?: number;
    distance?: number;
    direction?: { x: number; y: number };
  } | null;

  // 3D overlay state
  is3DOverlayOpen?: boolean;
  open3DOverlay?: () => void;
  close3DOverlay?: () => void;

  // Multi-select state
  selectedAssetIds: string[];
  isRectangularSelecting: boolean;
  isRectangularSelectionMode: boolean;
  rectangularSelectionStart: { x: number; y: number } | null;
  rectangularSelectionEnd: { x: number; y: number } | null;
  selectionBox: {
    startX: number;
    startY: number;
    endX: number;
    endY: number;
  } | null;

  // Group management state
  createGroupFromSelection: boolean;

  // Methods
  setCanvas: (size: PaperSize) => void;
  setCanvasDimensions: (width: number, height: number) => void; // allow arbitrary canvas when not a known PaperSize
  addAsset: (type: string, x: number, y: number) => void;
  addAssetObject: (assetObj: AssetInstance) => void;
  updateAsset: (id: string, updates: Partial<AssetInstance>) => void;
  removeAsset: (id: string) => void;
  processDoorWallOpening: (doorId: string) => void;
  selectAsset: (id: string | null) => void;
  toggleGrid: () => void;
  toggleDebugOutlines: () => void;
  setGridSize: (size: number) => void;
  toggleSnapToGrid: () => void;
  snapToGrid: (x: number, y: number) => { x: number; y: number };
  
  // Grid size selection methods
  setSelectedGridSizeIndex: (index: number) => void;
  getCurrentGridSize: () => number;
  
  // Wall type selection methods - Updated
  setWallType: (type: 'thin' | 'standard' | 'thick' | 'extra-thick') => void;
  setWallTool: (tool: 'wall' | 'cross') => void;
  getCurrentWallThickness: () => number;
  setChairSettings: (settings: { numChairs: number; radius: number }) => void;
  getChairSettings: () => { numChairs: number; radius: number };
  setShapeMode: (mode: 'rectangle' | 'ellipse' | 'line' | null) => void;
  startShape: (start: { x: number; y: number }) => void;
  updateShapeTempEnd: (end: { x: number; y: number }) => void;
  finishShape: () => void;
  cancelShape: () => void;
  reset: () => void;
  syncToEventData: () => AssetInstance[];
  markAsSaved: () => void;
  hasHydrated: boolean;

  // Pen tool methods
  setPenMode: (enabled: boolean) => void;
  setWallMode: (enabled: boolean) => void;
  setIsDrawing: (drawing: boolean) => void;
  setCurrentPath: (path: { x: number; y: number }[]) => void;
  setTempPath: (path: { x: number; y: number }[]) => void;
  addPointToPath: (point: { x: number; y: number }) => void;
  clearPath: () => void;

  // Wall drawing methods
  setWallDrawingMode: (enabled: boolean) => void;
  startWallSegment: (start: { x: number; y: number }) => void;
  updateWallTempEnd: (end: { x: number; y: number }) => void;
  commitWallSegment: () => void;
  finishWallDrawing: () => void;
  cancelWallDrawing: () => void;
  createCrossAt: (center: { x: number; y: number }, armMm?: number) => void;
  // Wall moving/snap methods
  getWallSnapDelta: (assetId: string, proposedCenter: { x: number; y: number }) => { dx: number; dy: number };
  finishWallMove: (assetId: string, finalCenter: { x: number; y: number }) => void;
  // New draft methods
  startWallDraft: (start: { x: number; y: number }) => void;
  addWallDraftNode: (pt: { x: number; y: number }) => void;
  finishWallDraft: () => void;

  // Copy/paste methods
  copyAsset: (id: string) => void;
  pasteAsset: (offsetX?: number, offsetY?: number) => void;
  clearClipboard: () => void;

  // Undo/Redo methods
  undo: () => void;
  redo: () => void;
  saveToHistory: () => void;
  clearHistory: () => void;

  // Smart duplication methods
  smartDuplicate: (id: string) => void;
  detectDuplicationPattern: (originalAsset: AssetInstance, duplicatedAsset: AssetInstance) => void;

  // Multi-select methods
  startRectangularSelection: (startX: number, startY: number) => void;
  updateRectangularSelection: (endX: number, endY: number) => void;
  finishRectangularSelection: () => void;
  selectMultipleAssets: (ids: string[]) => void;
  clearSelection: () => void;
  moveSelectedAssets: (deltaX: number, deltaY: number) => void;
  duplicateSelectedAssets: () => void;
  deleteSelectedAssets: () => void;
  setRectangularSelectionMode: (enabled: boolean) => void;
  startRectangularSelectionDrag: (startX: number, startY: number) => void;
  updateRectangularSelectionDrag: (endX: number, endY: number) => void;
  finishRectangularSelectionDrag: () => void;
  setCreateGroupFromSelection: (enabled: boolean) => void;
  createGroupFromSelectedAssets: () => void;
  groupSelectedAssets: () => void;
  ungroupAsset: (groupId: string) => void;
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const useSceneStore = create<SceneState>()(
  persist(
    (set, get) => ({
      canvas: null,
      assets: [],
      selectedAssetId: null,
      eventData: null,
      isInitialized: false,
      hasUnsavedChanges: false,
      hasHydrated: false,
      showGrid: false,
      showDebugOutlines: true,
      gridSize: 10, // Default 10mm grid
      snapToGridEnabled: false,
      availableGridSizes: [5, 10, 25, 50, 100],
      selectedGridSizeIndex: 1,
      wallType: 'thin',
      wallTool: 'wall',
      availableWallTypes: [
        { id: 'thin', label: 'Partition (75mm)', thickness: 1 },
        { id: 'standard', label: 'Partition (100mm)', thickness: 2 },
        { id: 'thick', label: 'Enclosure Wall (150mm)', thickness: 5 },
        { id: 'extra-thick', label: 'Enclosure Wall (225mm)', thickness: 8 }
      ],
      shapeMode: null,
      shapeStart: null,
      shapeTempEnd: null,
      isPenMode: false,
      isWallMode: false,
      isDrawing: false,
      currentPath: [],
      tempPath: [],
      wallDrawingMode: false,
      currentWallSegments: [],
      currentWallStart: null,
      currentWallTempEnd: null,
      firstHorizontalWallLength: null,
      wallDraftNodes: [],
      chairSettings: {
        numChairs: 8,
        radius: 80
      },
      clipboard: null,
      history: [[]],
      historyIndex: 0,
      lastDuplicatedAsset: null,
      duplicationPattern: null,
      // 3D overlay default state
      is3DOverlayOpen: false,
      selectedAssetIds: [],
      isRectangularSelecting: false,
      isRectangularSelectionMode: false,
      rectangularSelectionStart: null,
      rectangularSelectionEnd: null,
      selectionBox: null,
      createGroupFromSelection: false,

      setCanvas: (size) => {
        const { width, height } = PAPER_SIZES[size];
        set({
          canvas: { size, width, height },
          assets: [],
          selectedAssetId: null,
          hasUnsavedChanges: true
        });
      },

      // Directly set canvas dimensions (supports custom/layout canvas not in PAPER_SIZES)
      setCanvasDimensions: (width: number, height: number) => {
        set({
          canvas: { size: "layout" as PaperSize, width, height },
          hasUnsavedChanges: true,
        } as any);
      },

      addAsset: (type, x, y) => {
        const state = get();
        // Prevent any non-wall asset creation while wall drawing is active (avoids ghost assets)
        if (state.wallDrawingMode && type !== "wall-segments") return;
        const id = `${type}-${Date.now()}`;

        // Get the next zIndex (highest existing zIndex + 1, or 1 if no assets exist)
        const nextZIndex = state.assets.length > 0 
          ? Math.max(...state.assets.map(a => a.zIndex || 0)) + 1 
          : 1;

        // Use universal bg-gray-100 background for all assets
        const defaultBackgroundColor = "#f3f4f6"; // bg-gray-100

        // Default properties for shapes
        const shapeDefaults: Partial<AssetInstance> =
          type === "square" || type === "circle"
            ? { width: 50, height: 50, backgroundColor: defaultBackgroundColor }
            : type === "line"
              ? { width: 100, height: 2, strokeWidth: 2, strokeColor: "#000000", backgroundColor: defaultBackgroundColor }
              : type === "double-line"
                ? { width: 2, height: 100, strokeWidth: 2, strokeColor: "#000000", lineGap: 8, lineColor: "#000000", backgroundColor: defaultBackgroundColor }
                : type === "drawn-line"
                  ? { strokeWidth: 2, strokeColor: "#000000", backgroundColor: defaultBackgroundColor }
                  : type === "wall-segments"
                    ? { wallThickness: get().getCurrentWallThickness(), wallGap: 8, lineColor: "#000000", backgroundColor: defaultBackgroundColor }
                    : type === "text"
                      ? { width: 100, height: 20, text: "Enter text", fontSize: 16, textColor: "#000000", fontFamily: "Arial", backgroundColor: defaultBackgroundColor }
                      : { width: 24, height: 24, backgroundColor: defaultBackgroundColor }; // Default for icons

        set({
          assets: [
            ...state.assets,
            { id, type, x, y, scale: 1, rotation: 0, zIndex: nextZIndex, ...shapeDefaults },
          ],
          selectedAssetId: id,
          hasUnsavedChanges: true,
        });
        
        // Save to history after adding asset
        setTimeout(() => get().saveToHistory(), 0);
      },

      addAssetObject: (assetObj: AssetInstance) => {
        set((state) => {
          // Block ghost creations during wall drawing; only allow the wall asset itself
          if (state.wallDrawingMode && assetObj.type !== "wall-segments") {
            return { hasUnsavedChanges: state.hasUnsavedChanges } as any;
          }
          
          // Ensure the asset has a zIndex (use existing or assign next available)
          const assetWithZIndex = {
            ...assetObj,
            zIndex: assetObj.zIndex ?? (state.assets.length > 0 
              ? Math.max(...state.assets.map(a => a.zIndex || 0)) + 1 
              : 1)
          };
          
          return {
            assets: [...state.assets, assetWithZIndex],
            selectedAssetId: assetObj.id,
            hasUnsavedChanges: true,
          };
        });
        
        // Save to history after adding asset object
        setTimeout(() => get().saveToHistory(), 0);
      },

      updateAsset: (id, updates) => {
        const state = get();
        const updatedAssets = state.assets.map((a) => {
          if (a.id === id) {
            const updatedAsset = { ...a, ...updates };
            
            // If this is a group and we're updating scale/width/height/rotation, update all child assets
            if (a.isGroup && a.groupAssets && (updates.scale !== undefined || updates.width !== undefined || updates.height !== undefined || updates.rotation !== undefined)) {
              let scaleRatio = 1;
              
              if (updates.scale !== undefined) {
                scaleRatio = updates.scale / a.scale;
              } else if (updates.width !== undefined) {
                scaleRatio = a.width ? updates.width / a.width : 1;
              } else if (updates.height !== undefined) {
                scaleRatio = a.height ? updates.height / a.height : 1;
              }
              
              const updatedGroupAssets = a.groupAssets.map(childAsset => {
                let updatedChild = { ...childAsset };
                
                // Apply scaling if needed
                if (scaleRatio !== 1) {
                  updatedChild = {
                    ...updatedChild,
                    scale: childAsset.scale * scaleRatio,
                    x: childAsset.x * scaleRatio,
                    y: childAsset.y * scaleRatio,
                  };
                }
                
                // Don't apply rotation to child assets - they should rotate as a group
                // The group rotation will be applied during rendering
                
                return updatedChild;
              });
              
              return {
                ...updatedAsset,
                groupAssets: updatedGroupAssets,
              };
            }
            
            return updatedAsset;
          }
          return a;
        });
        set({ assets: updatedAssets, hasUnsavedChanges: true });
        
        // Save to history after updating asset
        setTimeout(() => get().saveToHistory(), 0);

        // Automatic wall opening for double doors when moved/scaled
        // Only apply wall opening logic when dragging is complete (not during active dragging)
        const moved = updates.x !== undefined || updates.y !== undefined || updates.rotation !== undefined || updates.width !== undefined || updates.scale !== undefined;
        const door = updatedAssets.find(a => a.id === id);
        if (!door || door.type !== 'double-door' || !moved) return;
        
        // Skip wall opening during active dragging to prevent visual artifacts
        // This will be handled by a separate method when dragging completes
        return;
      },

      removeAsset: (id) => {
        set((state) => ({
          assets: state.assets.filter((a) => a.id !== id),
          selectedAssetId: state.selectedAssetId === id ? null : state.selectedAssetId,
          hasUnsavedChanges: true,
        }));
        
        // Save to history after removing asset
        setTimeout(() => get().saveToHistory(), 0);
      },

      // Handle wall opening for double doors when dragging is complete
      processDoorWallOpening: (doorId: string) => {
        const state = get();
        const door = state.assets.find(a => a.id === doorId);
        if (!door || door.type !== 'double-door') return;

        const doorCenter = { x: door.x, y: door.y };
        // Door width is adjustable; assume it's stored in mm on the asset
        const doorWidthMm = Math.max(50, (door.width ?? 900) * (door.scale ?? 1));
        const opening = doorWidthMm; // opening equals visual door width

        const projectPointToSegment = (p: { x: number; y: number }, aPt: { x: number; y: number }, bPt: { x: number; y: number }) => {
          const abx = bPt.x - aPt.x; const aby = bPt.y - aPt.y;
          const apx = p.x - aPt.x; const apy = p.y - aPt.y;
          const ab2 = abx * abx + aby * aby;
          if (ab2 === 0) return { x: aPt.x, y: aPt.y, t: 0, dist: Math.hypot(p.x - aPt.x, p.y - aPt.y) };
          let t = (apx * abx + apy * aby) / ab2;
          t = Math.max(0, Math.min(1, t));
          const projx = aPt.x + abx * t; const projy = aPt.y + aby * t;
          // perpendicular distance
          const dist = Math.abs((aby * p.x - abx * p.y + bPt.x * aPt.y - bPt.y * aPt.x)) / Math.sqrt(ab2);
          return { x: projx, y: projy, t, dist };
        };

        // find nearest wall edge
        let targetIndex = -1; let targetEdgeIndex = -1; let targetProj: any = null; let minDist = Infinity;
        state.assets.forEach((w, wi) => {
          if (!w.wallNodes || !w.wallEdges || w.id === door.id) return;
          w.wallEdges.forEach((e, ei) => {
            const a = w.wallNodes![e.a];
            const b = w.wallNodes![e.b];
            const proj = projectPointToSegment(doorCenter, a, b);
            if (proj.dist < minDist) { minDist = proj.dist; targetIndex = wi; targetEdgeIndex = ei; targetProj = { ...proj, aIndex: e.a, bIndex: e.b }; }
          });
        });
        const snapThreshold = 20; // mm - easier to catch the target wall
        if (targetIndex >= 0 && minDist <= snapThreshold) {
          const wall = state.assets[targetIndex];
          const nodes = [...(wall.wallNodes ?? [])];
          const edges = [...(wall.wallEdges ?? [])];
          const a = nodes[targetProj.aIndex];
          const b = nodes[targetProj.bIndex];
          const dx = b.x - a.x; const dy = b.y - a.y;
          const length = Math.sqrt(dx * dx + dy * dy) || 1;
          const nx = dx / length; const ny = dy / length;
          const half = (opening / 2);
          const center = { x: targetProj.x, y: targetProj.y };
          const p1 = { x: center.x - nx * half, y: center.y - ny * half };
          const p2 = { x: center.x + nx * half, y: center.y + ny * half };
          const n1 = nodes.push(p1) - 1;
          const n2 = nodes.push(p2) - 1;
          // replace edge with two edges leaving a gap (n1..n2 is the opening)
          edges.splice(targetEdgeIndex, 1, { a: targetProj.aIndex, b: n1 }, { a: n2, b: targetProj.bIndex });

          // Persist updated wall
          const newAssets = state.assets.map((w, wi) => wi === targetIndex ? { ...w, wallNodes: nodes, wallEdges: edges, wallSegments: undefined } : w);
          set({ assets: newAssets, hasUnsavedChanges: true });
        }
      },

      selectAsset: (id) => set({ selectedAssetId: id }),

      toggleGrid: () => set((state) => ({ showGrid: !state.showGrid })),

      toggleDebugOutlines: () => set((state) => ({ showDebugOutlines: !state.showDebugOutlines })),

      setGridSize: (size: number) => set({ gridSize: size }),

      // 3D overlay controls
      open3DOverlay: () => set({ is3DOverlayOpen: true }),
      close3DOverlay: () => set({ is3DOverlayOpen: false }),

      toggleSnapToGrid: () => set((state) => ({ snapToGridEnabled: !state.snapToGridEnabled })),

      // Grid snapping utility
      snapToGrid: (x: number, y: number) => {
        const state = get();
        if (!state.snapToGridEnabled) return { x, y };
        
        const gridSize = state.gridSize;
        return {
          x: Math.round(x / gridSize) * gridSize,
          y: Math.round(y / gridSize) * gridSize,
        };
      },

      // Grid size selection methods
      setSelectedGridSizeIndex: (index: number) => {
        const state = get();
        if (index >= 0 && index < state.availableGridSizes.length) {
          set({ 
            selectedGridSizeIndex: index,
            gridSize: state.availableGridSizes[index]
          });
        }
      },

      getCurrentGridSize: () => {
        const state = get();
        return state.availableGridSizes[state.selectedGridSizeIndex] || state.gridSize;
      },

      // Wall type selection methods
      setWallType: (type: 'thin' | 'standard' | 'thick' | 'extra-thick') => {
        set({ wallType: type });
      },

      setWallTool: (tool: 'wall' | 'cross') => set({ wallTool: tool }),

      getCurrentWallThickness: () => {
        const state = get();
        const wallType = state.availableWallTypes.find(wt => wt.id === state.wallType);
        return wallType?.thickness || 1; // Default to 1px if not found
      },

      setChairSettings: (settings: { numChairs: number; radius: number }) => {
        set({ chairSettings: settings });
      },

      getChairSettings: () => {
        return get().chairSettings;
      },

      setShapeMode: (mode) => set({ shapeMode: mode, shapeStart: null, shapeTempEnd: null }),
      startShape: (start) => set({ shapeStart: start }),
      updateShapeTempEnd: (end) => set({ shapeTempEnd: end }),
      finishShape: () => {
        const state = get();
        if (!state.shapeMode || !state.shapeStart || !state.shapeTempEnd) return;
        const start = state.shapeStart;
        const end = state.shapeTempEnd;
        const centerX = (start.x + end.x) / 2;
        const centerY = (start.y + end.y) / 2;
        const rawWidthMm = Math.abs(end.x - start.x);
        const rawHeightMm = Math.abs(end.y - start.y);
        
        // Use the exact same calculation as the preview
        // Preview: w = Math.abs(x2 - x1), then w * mmToPx
        // Don't apply minimum constraints here - let the preview handle it
        const actualMmToPx = 2.000021; // This matches the preview conversion factor
        const width = rawWidthMm * actualMmToPx;
        const height = rawHeightMm * actualMmToPx;
        
        let newAsset: AssetInstance | null = null;
        if (state.shapeMode === 'rectangle') {
          newAsset = {
            id: `rect-${Date.now()}`,
            type: 'square',
            x: centerX,
            y: centerY,
            scale: 1,
            rotation: 0,
            width,
            height,
            backgroundColor: '#f3f4f6', // bg-gray-100
            fillColor: 'transparent',
            strokeColor: '#000000',
            strokeWidth: 2,
          } as any;
        } else if (state.shapeMode === 'ellipse') {
          newAsset = {
            id: `ellipse-${Date.now()}`,
            type: 'circle',
            x: centerX,
            y: centerY,
            scale: 1,
            rotation: 0,
            width,
            height,
            backgroundColor: '#f3f4f6', // bg-gray-100
            fillColor: 'transparent',
            strokeColor: '#000000',
            strokeWidth: 2,
          } as any;
        } else if (state.shapeMode === 'line') {
          // Calculate line length and angle
          const lineLength = Math.max(2, Math.sqrt(width * width + height * height)); // Minimum 2mm length
          const angle = Math.atan2(end.y - start.y, end.x - start.x) * (180 / Math.PI);
          
          newAsset = {
            id: `line-${Date.now()}`,
            type: 'line',
            x: centerX,
            y: centerY,
            scale: 1,
            rotation: angle,
            width: lineLength,
            height: 2,
            strokeWidth: 2,
            strokeColor: '#000000',
          } as any;
        }
        if (newAsset) {
          set({
            assets: [...state.assets, newAsset],
            selectedAssetId: newAsset.id,
            hasUnsavedChanges: true,
          });
        }
        set({ shapeStart: null, shapeTempEnd: null, shapeMode: null });
      },
      cancelShape: () => set({ shapeStart: null, shapeTempEnd: null, shapeMode: null }),

      reset: () => set({
        canvas: null,
        assets: [],
        selectedAssetId: null,
        eventData: null,
        isInitialized: false,
        hasUnsavedChanges: false,
        isPenMode: false,
        isWallMode: false,
        isDrawing: false,
        currentPath: [],
        tempPath: [],
        wallDrawingMode: false,
        currentWallSegments: [],
        currentWallStart: null,
        currentWallTempEnd: null
      }),

      markAsSaved: () => set({ hasUnsavedChanges: false }),

      syncToEventData: () => {
        const state = get();
        // This method will be called with current event data from the component
        // Return just the assets for updating
        return state.assets;
      },

      setPenMode: (enabled) => set({ isPenMode: enabled }),

      setWallMode: (enabled) => set({ isWallMode: enabled }),

      setIsDrawing: (drawing) => set({ isDrawing: drawing }),

      setCurrentPath: (path) => set({ currentPath: path }),

      setTempPath: (path) => set({ tempPath: path }),

      addPointToPath: (point) => set((state) => ({
        currentPath: [...state.currentPath, point]
      })),

      clearPath: () => set({
        currentPath: [],
        tempPath: [],
        isDrawing: false
      }),

      // Wall drawing methods
      setWallDrawingMode: (enabled) => set({
        wallDrawingMode: enabled,
        // Ensure pen drawing is fully disabled to avoid ghost assets
        isPenMode: false,
        isWallMode: false,
        isDrawing: false,
        currentPath: [],
        tempPath: [],
        currentWallSegments: enabled ? [] : [],
        currentWallStart: enabled ? null : null,
        currentWallTempEnd: enabled ? null : null,
        wallDraftNodes: enabled ? [] : [],
        firstHorizontalWallLength: enabled ? null : null
      }),
      // New draft methods (nodes only)
      startWallDraft: (start) => set((state) => ({
        wallDraftNodes: [start],
        wallDrawingMode: true,
      })),

      addWallDraftNode: (pt) => set((state) => ({
        wallDraftNodes: [...(state.wallDraftNodes ?? []), pt],
      })),

      finishWallDraft: () => {
        const state = get();
        const nodes = state.wallDraftNodes ?? [];
        if (nodes.length < 2) {
          set({ wallDrawingMode: false, wallDraftNodes: [] });
          return;
        }

        // Build edges from consecutive nodes
        const edges: { a: number; b: number }[] = [];
        for (let i = 0; i < nodes.length - 1; i++) {
          edges.push({ a: i, b: i + 1 });
        }

        // Auto-close if last is near first
        const first = nodes[0];
        const last = nodes[nodes.length - 1];
        if (Math.hypot(last.x - first.x, last.y - first.y) <= 1) {
          edges.push({ a: nodes.length - 1, b: 0 });
          nodes[nodes.length - 1] = { x: first.x, y: first.y };
        }

        // Compute center and dimensions
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        nodes.forEach(n => { minX = Math.min(minX, n.x); minY = Math.min(minY, n.y); maxX = Math.max(maxX, n.x); maxY = Math.max(maxY, n.y); });
        const cx = (minX + maxX) / 2; 
        const cy = (minY + maxY) / 2;
        const wallWidth = maxX - minX;
        const wallHeight = maxY - minY;

        // Get a low zIndex for wall assets to ensure they render behind other assets
        const nextZIndex = -100; // Walls should render behind other assets

        const wallAsset: AssetInstance = {
          id: `wall-segments-${Date.now()}`,
          type: "wall-segments",
          x: cx,
          y: cy,
          scale: 1, // Keep scale at 1 for consistent rendering
          rotation: 0,
          zIndex: nextZIndex,
          width: wallWidth, // Store actual wall dimensions
          height: wallHeight, // Store actual wall dimensions
          wallNodes: nodes,
          wallEdges: edges,
          wallThickness: get().getCurrentWallThickness(), // Use selected wall thickness
          wallGap: 8,
          lineColor: "#000000",
          backgroundColor: "#f3f4f6" // bg-gray-100
        };
        
        // Store debug info for wall debugging
        (wallAsset as any).debugInfo = {
          originalNodes: nodes,
          center: { x: cx, y: cy },
          boundingBox: { minX, minY, maxX, maxY },
          storedDimensions: { width: wallWidth, height: wallHeight },
          timestamp: Date.now()
        };


        set((state) => ({
          assets: [...state.assets, wallAsset],
          selectedAssetId: wallAsset.id,
          wallDrawingMode: false,
          wallDraftNodes: [],
          currentWallSegments: [],
          currentWallStart: null,
          currentWallTempEnd: null,
          hasUnsavedChanges: true,
        }));
      },

      startWallSegment: (start) => set({
        currentWallStart: start,
        currentWallTempEnd: null
      }),

      updateWallTempEnd: (end) => set({
        currentWallTempEnd: end
      }),

      commitWallSegment: () => {
        const state = get();
        if (state.currentWallStart && state.currentWallTempEnd) {
          // Do not snap endpoints to preserve exact drawn length
          const snapTol = 0; // mm (no snapping)
          const snapToNearestEndpoint = (pt: {x:number;y:number}) => {
            let best = pt;
            let bestD = Infinity;
            for (const a of state.assets) {
              if (a.type !== 'wall-segments' || !a.wallSegments) continue;
              for (const seg of a.wallSegments) {
                const s = { x: seg.start.x + a.x, y: seg.start.y + a.y };
                const e = { x: seg.end.x + a.x, y: seg.end.y + a.y };
                const ds = Math.hypot(pt.x - s.x, pt.y - s.y);
                if (ds < bestD) { bestD = ds; best = s; }
                const de = Math.hypot(pt.x - e.x, pt.y - e.y);
                if (de < bestD) { bestD = de; best = e; }
              }
            }
            return bestD <= snapTol ? best : pt;
          };
          const snappedEnd = snapToNearestEndpoint(state.currentWallTempEnd);
          const newSegment = {
            start: state.currentWallStart,
            end: snappedEnd
          };
          // Determine if this is the first horizontal segment to track length
          const dx = newSegment.end.x - newSegment.start.x;
          const dy = newSegment.end.y - newSegment.start.y;
          const isHorizontal = Math.abs(dx) >= Math.abs(dy);
          const length = Math.sqrt(dx * dx + dy * dy);

          set({
            currentWallSegments: [...state.currentWallSegments, newSegment],
            currentWallStart: snappedEnd, // Next segment starts where this one ends (snapped)
            currentWallTempEnd: null,
            firstHorizontalWallLength: state.firstHorizontalWallLength ?? (isHorizontal ? length : null)
          });
        }
      },

      finishWallDrawing: () => {
        const state = get();
        if (state.currentWallSegments.length > 0) {
          // Helper function to calculate corner intersection for perpendicular walls
          const calculateCornerIntersection = (
            segment1: { start: { x: number; y: number }; end: { x: number; y: number } },
            segment2: { start: { x: number; y: number }; end: { x: number; y: number } },
            connectionPoint: { x: number; y: number },
            wallGap: number = 8
          ) => {
            // Calculate wall directions
            const dir1 = {
              x: segment1.end.x - segment1.start.x,
              y: segment1.end.y - segment1.start.y
            };
            const dir2 = {
              x: segment2.end.x - segment2.start.x,
              y: segment2.end.y - segment2.start.y
            };

            // Normalize directions
            const len1 = Math.sqrt(dir1.x * dir1.x + dir1.y * dir1.y);
            const len2 = Math.sqrt(dir2.x * dir2.x + dir2.y * dir2.y);

            if (len1 === 0 || len2 === 0) return { segment1, segment2 };

            const norm1 = { x: dir1.x / len1, y: dir1.y / len1 };
            const norm2 = { x: dir2.x / len2, y: dir2.y / len2 };

            // Calculate perpendicular vectors (wall thickness direction)
            const perp1 = { x: -norm1.y, y: norm1.x };
            const perp2 = { x: -norm2.y, y: norm2.x };

            // Calculate outer and inner edge points for both walls
            const halfGap = wallGap / 2;
            const outer1 = {
              x: connectionPoint.x + perp1.x * halfGap,
              y: connectionPoint.y + perp1.y * halfGap
            };
            const inner1 = {
              x: connectionPoint.x - perp1.x * halfGap,
              y: connectionPoint.y - perp1.y * halfGap
            };
            const outer2 = {
              x: connectionPoint.x + perp2.x * halfGap,
              y: connectionPoint.y + perp2.y * halfGap
            };
            const inner2 = {
              x: connectionPoint.x - perp2.x * halfGap,
              y: connectionPoint.y - perp2.y * halfGap
            };

            // Calculate intersection points for clean corner
            // For smooth corners, we need to trim the existing wall segment
            // so the new wall can fill the corner space

            // Determine which wall is the "existing" one (segment1) and which is "new" (segment2)
            // Trim the existing wall to stop before the connection point
            const trimDistance = wallGap; // Trim by wall gap distance to create smooth corner

            // Calculate trim point for existing wall (segment1)
            const segment1Dir = {
              x: segment1.end.x - segment1.start.x,
              y: segment1.end.y - segment1.start.y
            };
            const segment1Len = Math.sqrt(segment1Dir.x * segment1Dir.x + segment1Dir.y * segment1Dir.y);

            if (segment1Len > 0) {
              const segment1Norm = { x: segment1Dir.x / segment1Len, y: segment1Dir.y / segment1Len };

              // Trim point is trimDistance away from connection point along the wall direction
              const trimmedSegment1 = {
                start: segment1.start,
                end: {
                  x: connectionPoint.x - segment1Norm.x * trimDistance,
                  y: connectionPoint.y - segment1Norm.y * trimDistance
                }
              };

              // New wall (segment2) starts from connection point
              const trimmedSegment2 = {
                start: connectionPoint,
                end: segment2.end
              };

              return { segment1: trimmedSegment1, segment2: trimmedSegment2 };
            }

            // Fallback if segment length is 0
            return { segment1, segment2 };
          };

          // Check if current wall connects to any existing walls
          const wallAssets = state.assets.filter(asset => asset.wallSegments && asset.wallSegments.length > 0);
          let connectedAsset: { asset: AssetInstance; segmentIndex: number; connectionPoint: 'start' | 'end'; connectionPosition: { x: number; y: number }; isPerpendicular: boolean; currentSide: 'first' | 'last' } | null = null;

          // Check if the first or last point of current wall connects to an existing wall
          if (state.currentWallSegments.length > 0) {
            const firstPoint = state.currentWallSegments[0].start;
            const lastPoint = state.currentWallSegments[state.currentWallSegments.length - 1].end;

            // Helper function to find nearby wall segment with connection details
            const findNearbyWallSegment = (
              point: { x: number; y: number },
              threshold: number = 10 // Updated from 5mm to 10mm for better snap distance
            ): { asset: AssetInstance; segmentIndex: number; connectionPoint: 'start' | 'end'; connectionPosition: { x: number; y: number }; isPerpendicular: boolean } | null => {
              for (const asset of wallAssets) {
                if (!asset.wallSegments) continue;

                for (let i = 0; i < asset.wallSegments.length; i++) {
                  const segment = asset.wallSegments[i];
                  // Convert relative coordinates to absolute for comparison
                  const absStart = {
                    x: segment.start.x + asset.x,
                    y: segment.start.y + asset.y
                  };
                  const absEnd = {
                    x: segment.end.x + asset.x,
                    y: segment.end.y + asset.y
                  };

                  // Check distance to start point
                  const distToStart = Math.sqrt(
                    Math.pow(point.x - absStart.x, 2) +
                    Math.pow(point.y - absStart.y, 2)
                  );

                  // Check distance to end point
                  const distToEnd = Math.sqrt(
                    Math.pow(point.x - absEnd.x, 2) +
                    Math.pow(point.y - absEnd.y, 2)
                  );

                  if (distToStart <= threshold) {
                    // Check if walls are perpendicular (within 5 degrees of 90°)
                    const currentWallDir = state.currentWallSegments.length > 0 ? {
                      x: state.currentWallSegments[state.currentWallSegments.length - 1].end.x - state.currentWallSegments[0].start.x,
                      y: state.currentWallSegments[state.currentWallSegments.length - 1].end.y - state.currentWallSegments[0].start.y
                    } : { x: 0, y: 0 };

                    const existingWallDir = {
                      x: absEnd.x - absStart.x,
                      y: absEnd.y - absStart.y
                    };

                    const currentLen = Math.sqrt(currentWallDir.x * currentWallDir.x + currentWallDir.y * currentWallDir.y);
                    const existingLen = Math.sqrt(existingWallDir.x * existingWallDir.x + existingWallDir.y * existingWallDir.y);

                    let isPerpendicular = false;
                    if (currentLen > 0 && existingLen > 0) {
                      const dotProduct = Math.abs((currentWallDir.x * existingWallDir.x + currentWallDir.y * existingWallDir.y) / (currentLen * existingLen));
                      isPerpendicular = dotProduct < 0.087; // cos(85°) ≈ 0.087, so walls within 5° of perpendicular
                    }

                    return {
                      asset,
                      segmentIndex: i,
                      connectionPoint: 'start',
                      connectionPosition: absStart,
                      isPerpendicular
                    };
                  }

                  if (distToEnd <= threshold) {
                    // Check if walls are perpendicular (within 5 degrees of 90°)
                    const currentWallDir = state.currentWallSegments.length > 0 ? {
                      x: state.currentWallSegments[state.currentWallSegments.length - 1].end.x - state.currentWallSegments[0].start.x,
                      y: state.currentWallSegments[state.currentWallSegments.length - 1].end.y - state.currentWallSegments[0].start.y
                    } : { x: 0, y: 0 };

                    const existingWallDir = {
                      x: absEnd.x - absStart.x,
                      y: absEnd.y - absStart.y
                    };

                    const currentLen = Math.sqrt(currentWallDir.x * currentWallDir.x + currentWallDir.y * currentWallDir.y);
                    const existingLen = Math.sqrt(existingWallDir.x * existingWallDir.x + existingWallDir.y * existingWallDir.y);

                    let isPerpendicular = false;
                    if (currentLen > 0 && existingLen > 0) {
                      const dotProduct = Math.abs((currentWallDir.x * existingWallDir.x + currentWallDir.y * existingWallDir.y) / (currentLen * existingLen));
                      isPerpendicular = dotProduct < 0.087; // cos(85°) ≈ 0.087, so walls within 5° of perpendicular
                    }

                    return {
                      asset,
                      segmentIndex: i,
                      connectionPoint: 'end',
                      connectionPosition: absEnd,
                      isPerpendicular
                    };
                  }
                }
              }
              return null;
            };

            const firstConn = findNearbyWallSegment(firstPoint);
            const lastConn = findNearbyWallSegment(lastPoint);
            if (firstConn) {
              connectedAsset = { ...firstConn, currentSide: 'first' };
            } else if (lastConn) {
              connectedAsset = { ...lastConn, currentSide: 'last' };
            }
          }

          if (connectedAsset) {
            // Merge with existing wall asset and handle overlaps (prefer node reuse)
            const updatedAssets = state.assets.map(asset => {
              if (asset.id === connectedAsset!.asset.id) {
                // Convert existing asset segments to absolute coordinates
                const existingSegments = asset.wallSegments!.map((segment, index) => {
                  // Handle the connected segment with proper corner calculation
                  if (index === connectedAsset!.segmentIndex) {
                    const connectionPos = connectedAsset!.connectionPosition;
                    const connectionPoint = connectedAsset!.connectionPoint;
                    const isPerpendicular = connectedAsset!.isPerpendicular;

                    // Convert segment to absolute coordinates
                    const absSegment = {
                      start: {
                        x: segment.start.x + asset.x,
                        y: segment.start.y + asset.y
                      },
                      end: {
                        x: segment.end.x + asset.x,
                        y: segment.end.y + asset.y
                      }
                    };

                    if (isPerpendicular) {
                      // Use corner intersection calculation for perpendicular walls
                      const currentWallSegment = connectedAsset!.currentSide === 'last'
                        ? state.currentWallSegments[state.currentWallSegments.length - 1]
                        : state.currentWallSegments[0];
                      const cornerResult = calculateCornerIntersection(
                        absSegment,
                        currentWallSegment,
                        connectionPos,
                        asset.wallGap || 8
                      );

                      // Return the trimmed existing segment
                      return {
                        start: cornerResult.segment1.start,
                        end: cornerResult.segment1.end
                      };
                    } else {
                      // For non-perpendicular walls, still trim existing wall to make room
                      const trimDistance = asset.wallGap || 8;

                      if (connectionPoint === 'start') {
                        // Trim from start, moving the start point away from connection
                        const segmentDir = {
                          x: absSegment.end.x - absSegment.start.x,
                          y: absSegment.end.y - absSegment.start.y
                        };
                        const segmentLen = Math.sqrt(segmentDir.x * segmentDir.x + segmentDir.y * segmentDir.y);

                        if (segmentLen > 0) {
                          const segmentNorm = { x: segmentDir.x / segmentLen, y: segmentDir.y / segmentLen };
                          return {
                            start: {
                              x: connectionPos.x + segmentNorm.x * trimDistance,
                              y: connectionPos.y + segmentNorm.y * trimDistance
                            },
                            end: absSegment.end
                          };
                        }
                      } else {
                        // Trim from end, moving the end point away from connection
                        const segmentDir = {
                          x: absSegment.end.x - absSegment.start.x,
                          y: absSegment.end.y - absSegment.start.y
                        };
                        const segmentLen = Math.sqrt(segmentDir.x * segmentDir.x + segmentDir.y * segmentDir.y);

                        if (segmentLen > 0) {
                          const segmentNorm = { x: segmentDir.x / segmentLen, y: segmentDir.y / segmentLen };
                          return {
                            start: absSegment.start,
                            end: {
                              x: connectionPos.x - segmentNorm.x * trimDistance,
                              y: connectionPos.y - segmentNorm.y * trimDistance
                            }
                          };
                        }
                      }

                      // Fallback to original trimming
                      if (connectionPoint === 'start') {
                        return {
                          start: connectionPos,
                          end: absSegment.end
                        };
                      } else {
                        return {
                          start: absSegment.start,
                          end: connectionPos
                        };
                      }
                    }
                  } else {
                    // Keep other segments unchanged
                    return {
                      start: {
                        x: segment.start.x + asset.x,
                        y: segment.start.y + asset.y
                      },
                      end: {
                        x: segment.end.x + asset.x,
                        y: segment.end.y + asset.y
                      }
                    };
                  }
                });

                // Handle current wall segments: trim/miter near the connection point
                let currentSegments = state.currentWallSegments;
                if (connectedAsset.isPerpendicular) {
                  const currentWallSegment = connectedAsset.currentSide === 'last'
                    ? state.currentWallSegments[state.currentWallSegments.length - 1]
                    : state.currentWallSegments[0];
                  const existingSegment = connectedAsset.asset.wallSegments![connectedAsset.segmentIndex];
                  const absExistingSegment = {
                    start: {
                      x: existingSegment.start.x + connectedAsset.asset.x,
                      y: existingSegment.start.y + connectedAsset.asset.y
                    },
                    end: {
                      x: existingSegment.end.x + connectedAsset.asset.x,
                      y: existingSegment.end.y + connectedAsset.asset.y
                    }
                  };

                  const cornerResult = calculateCornerIntersection(
                    absExistingSegment,
                    currentWallSegment,
                    connectedAsset.connectionPosition,
                    connectedAsset.asset.wallGap || 8
                  );

                  // Update the affected segment of current wall with trimmed version
                  if (connectedAsset.currentSide === 'last') {
                    currentSegments = [...state.currentWallSegments.slice(0, -1), cornerResult.segment2];
                  } else {
                    currentSegments = [cornerResult.segment2, ...state.currentWallSegments.slice(1)];
                  }
                } else {
                  // Non-perpendicular: also trim the current wall so both sides make room
                  const trimDistance = connectedAsset.asset.wallGap || 8;
                  if (connectedAsset.currentSide === 'last') {
                    const seg = state.currentWallSegments[state.currentWallSegments.length - 1];
                    const dir = { x: seg.end.x - seg.start.x, y: seg.end.y - seg.start.y };
                    const len = Math.sqrt(dir.x * dir.x + dir.y * dir.y);
                    if (len > 0) {
                      const norm = { x: dir.x / len, y: dir.y / len };
                      const trimmed = {
                        start: seg.start,
                        end: { x: seg.end.x - norm.x * trimDistance, y: seg.end.y - norm.y * trimDistance }
                      };
                      currentSegments = [...state.currentWallSegments.slice(0, -1), trimmed];
                    }
                  } else {
                    const seg = state.currentWallSegments[0];
                    const dir = { x: seg.end.x - seg.start.x, y: seg.end.y - seg.start.y };
                    const len = Math.sqrt(dir.x * dir.x + dir.y * dir.y);
                    if (len > 0) {
                      const norm = { x: dir.x / len, y: dir.y / len };
                      const trimmed = {
                        start: { x: seg.start.x + norm.x * trimDistance, y: seg.start.y + norm.y * trimDistance },
                        end: seg.end
                      };
                      currentSegments = [trimmed, ...state.currentWallSegments.slice(1)];
                    }
                  }
                }

                // Snap the current wall endpoint exactly to the connection position so endpoints match
                if (connectedAsset.currentSide === 'last') {
                  if (currentSegments.length > 0) {
                    const lastIdx = currentSegments.length - 1;
                    currentSegments[lastIdx] = {
                      start: currentSegments[lastIdx].start,
                      end: { x: connectedAsset.connectionPosition.x, y: connectedAsset.connectionPosition.y }
                    };
                  }
                } else {
                  if (currentSegments.length > 0) {
                    currentSegments[0] = {
                      start: { x: connectedAsset.connectionPosition.x, y: connectedAsset.connectionPosition.y },
                      end: currentSegments[0].end
                    };
                  }
                }

                // Combine all segments
                const allSegments = [...existingSegments, ...currentSegments];

                // Remove duplicates and merge connected segments with improved tolerance
                const mergedSegments: { start: { x: number; y: number }; end: { x: number; y: number } }[] = [];
                const connectionTolerance = 15; // Increased from 1mm to 15mm for better connection detection

                for (const segment of allSegments) {
                  // Check if this segment connects to any existing merged segment
                  let connected = false;

                  for (let i = 0; i < mergedSegments.length; i++) {
                    const merged = mergedSegments[i];

                    // Check if segment connects to merged segment start
                    const distToStart = Math.sqrt(
                      Math.pow(segment.end.x - merged.start.x, 2) +
                      Math.pow(segment.end.y - merged.start.y, 2)
                    );

                    // Check if segment connects to merged segment end
                    const distToEnd = Math.sqrt(
                      Math.pow(segment.start.x - merged.end.x, 2) +
                      Math.pow(segment.start.y - merged.end.y, 2)
                    );

                    if (distToStart <= connectionTolerance) {
                      mergedSegments[i] = { start: segment.start, end: merged.end };
                      connected = true;
                      break;
                    }

                    if (distToEnd <= connectionTolerance) {
                      mergedSegments[i] = { start: merged.start, end: segment.end };
                      connected = true;
                      break;
                    }
                  }

                  if (!connected) {
                    mergedSegments.push(segment);
                  }
                }

                // Order segments so consecutive items share endpoints (critical for clean corners)
                const tolerance = 1; // mm
                const orderedSegments: { start: { x: number; y: number }; end: { x: number; y: number } }[] = [];
                if (mergedSegments.length > 0) {
                  const remaining = [...mergedSegments];
                  orderedSegments.push(remaining.shift()!);
                  while (remaining.length > 0) {
                    const last = orderedSegments[orderedSegments.length - 1];
                    let foundIndex = -1;
                    for (let i = 0; i < remaining.length; i++) {
                      const seg = remaining[i];
                      const distEndToStart = Math.hypot(last.end.x - seg.start.x, last.end.y - seg.start.y);
                      const distEndToEnd = Math.hypot(last.end.x - seg.end.x, last.end.y - seg.end.y);
                      if (distEndToStart <= tolerance) {
                        foundIndex = i; // correct orientation
                        break;
                      } else if (distEndToEnd <= tolerance) {
                        // reverse segment to match orientation
                        remaining[i] = { start: seg.end, end: seg.start };
                        foundIndex = i;
                        break;
                      }
                    }
                    if (foundIndex >= 0) {
                      orderedSegments.push(remaining.splice(foundIndex, 1)[0]);
                    } else {
                      // start a new chain if no continuation found
                      orderedSegments.push(remaining.shift()!);
                    }
                  }
                }

                const finalSegments = orderedSegments.length > 0 ? orderedSegments : mergedSegments;

                // Build/merge nodes graph on the target asset
                const nodes: { x: number; y: number }[] = asset.wallNodes ? [...asset.wallNodes] : [];
                const addNode = (pt: { x: number; y: number }) => {
                  const idx = nodes.findIndex(n => Math.hypot(n.x - pt.x, n.y - pt.y) <= 0.5);
                  if (idx >= 0) return idx;
                  nodes.push({ x: pt.x, y: pt.y });
                  return nodes.length - 1;
                };
                const edges: { a: number; b: number }[] = [];
                finalSegments.forEach(seg => {
                  const ai = addNode(seg.start);
                  const bi = addNode(seg.end);
                  if (ai !== bi) edges.push({ a: ai, b: bi });
                });

                // Calculate new center point for the merged wall
                let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
                finalSegments.forEach(segment => {
                  minX = Math.min(minX, segment.start.x, segment.end.x);
                  minY = Math.min(minY, segment.start.y, segment.end.y);
                  maxX = Math.max(maxX, segment.start.x, segment.end.x);
                  maxY = Math.max(maxY, segment.start.y, segment.end.y);
                });

                const newCenterX = (minX + maxX) / 2;
                const newCenterY = (minY + maxY) / 2;

                // Convert merged segments back to relative coordinates
                const relativeSegments = finalSegments.map(segment => ({
                  start: {
                    x: segment.start.x - newCenterX,
                    y: segment.start.y - newCenterY
                  },
                  end: {
                    x: segment.end.x - newCenterX,
                    y: segment.end.y - newCenterY
                  }
                }));

                return {
                  ...asset,
                  x: newCenterX,
                  y: newCenterY,
                  // Keep segments only for compatibility features like bbox; runtime rendering will prefer nodes
                  wallSegments: undefined,
                  wallNodes: nodes,
                  wallEdges: edges
                };
              }
              return asset;
            });

            set((state) => ({
              assets: updatedAssets,
              selectedAssetId: connectedAsset.asset.id,
              hasUnsavedChanges: true,
              wallDrawingMode: false,
              currentWallSegments: [],
              currentWallStart: null,
              currentWallTempEnd: null,
              firstHorizontalWallLength: null
            }));
          } else {
            // Create new wall asset as node-edge graph
            // If the path returns to the start within tolerance, snap it closed so no start cap remains
            let segmentsToUse = state.currentWallSegments;
            if (state.currentWallSegments.length > 1) {
              const first = state.currentWallSegments[0].start;
              const lastEnd = state.currentWallSegments[state.currentWallSegments.length - 1].end;
              const closeTol = 1.0; // mm
              if (Math.hypot(lastEnd.x - first.x, lastEnd.y - first.y) <= closeTol) {
                // Force exact closure
                const fixed = [...state.currentWallSegments];
                fixed[fixed.length - 1] = {
                  start: fixed[fixed.length - 1].start,
                  end: { x: first.x, y: first.y }
                };
                segmentsToUse = fixed;
              }
            }
            let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

            segmentsToUse.forEach(segment => {
              minX = Math.min(minX, segment.start.x, segment.end.x);
              minY = Math.min(minY, segment.start.y, segment.end.y);
              maxX = Math.max(maxX, segment.start.x, segment.end.x);
              maxY = Math.max(maxY, segment.start.y, segment.end.y);
            });

            const centerX = (minX + maxX) / 2;
            const centerY = (minY + maxY) / 2;

            // Build node list and edges from path endpoints
            const nodes: { x: number; y: number }[] = [];
            const edges: { a: number; b: number }[] = [];
            const addNode = (pt: { x: number; y: number }) => {
              const idx = nodes.findIndex(n => Math.hypot(n.x - pt.x, n.y - pt.y) <= 0.5);
              if (idx >= 0) return idx;
              nodes.push({ x: pt.x, y: pt.y });
              return nodes.length - 1;
            };
            segmentsToUse.forEach(seg => {
              const ai = addNode(seg.start);
              const bi = addNode(seg.end);
              if (!(ai === bi)) edges.push({ a: ai, b: bi });
            });

            // Get a low zIndex for wall assets to ensure they render behind other assets
            const nextZIndex = -100; // Walls should render behind other assets

            const wallAsset: AssetInstance = {
              id: `wall-segments-${Date.now()}`,
              type: "wall-segments",
              x: centerX,
              y: centerY,
              scale: 1, // Keep scale at 1 for consistent rendering
              rotation: 0,
              zIndex: nextZIndex,
              wallSegments: undefined,
              wallNodes: nodes,
              wallEdges: edges,
              wallThickness: get().getCurrentWallThickness(), // Use selected wall thickness
              wallGap: 8,
              lineColor: "#000000",
              backgroundColor: "#f3f4f6" // bg-gray-100
            };
            // Post-process: split existing walls and the new wall at intersections for seamless joints
            const splitEdgeAtPoint = (
              asset: AssetInstance,
              aIndex: number,
              bIndex: number,
              point: { x: number; y: number }
            ) => {
              if (!asset.wallNodes || !asset.wallEdges) return asset;
              const nodes = [...asset.wallNodes];
              const edges = [...asset.wallEdges];
              const newNodeIndex = nodes.findIndex(n => Math.hypot(n.x - point.x, n.y - point.y) <= 0.5);
              const idx = newNodeIndex >= 0 ? newNodeIndex : (nodes.push({ x: point.x, y: point.y }), nodes.length - 1);
              // remove original edge a-b once, add a-idx and idx-b
              const filtered = edges.filter(e => !(e.a === aIndex && e.b === bIndex) && !(e.a === bIndex && e.b === aIndex));
              filtered.push({ a: aIndex, b: idx });
              filtered.push({ a: idx, b: bIndex });
              return { ...asset, wallNodes: nodes, wallEdges: filtered } as AssetInstance;
            };

            const lineIntersection = (
              p1: {x:number;y:number}, p2: {x:number;y:number},
              p3: {x:number;y:number}, p4: {x:number;y:number}
            ): {x:number;y:number} | null => {
              const denom = (p1.x - p2.x) * (p3.y - p4.y) - (p1.y - p2.y) * (p3.x - p4.x);
              if (Math.abs(denom) < 1e-9) return null;
              const t = ((p1.x - p3.x) * (p3.y - p4.y) - (p1.y - p3.y) * (p3.x - p4.x)) / denom;
              const u = ((p1.x - p3.x) * (p1.y - p2.y) - (p1.y - p3.y) * (p1.x - p2.x)) / denom;
              if (t <= 0 || t >= 1 || u <= 0 || u >= 1) return null;
              return { x: p1.x + t * (p2.x - p1.x), y: p1.y + t * (p2.y - p1.y) };
            };

            // Ensure all wall assets have node-edge representation
            const toNodesEdges = (asset: AssetInstance): AssetInstance => {
              if (asset.type !== 'wall-segments') return asset;
              if (asset.wallNodes && asset.wallEdges) return asset;
              if (!asset.wallSegments || asset.wallSegments.length === 0) return asset;
              const nodes: { x: number; y: number }[] = [];
              const edges: { a: number; b: number }[] = [];
              const addNode = (pt: { x: number; y: number }) => {
                const idx = nodes.findIndex(n => Math.hypot(n.x - pt.x, n.y - pt.y) <= 0.5);
                if (idx >= 0) return idx;
                nodes.push({ x: pt.x, y: pt.y });
                return nodes.length - 1;
              };
              for (const s of asset.wallSegments) {
                const a = { x: s.start.x + asset.x, y: s.start.y + asset.y };
                const b = { x: s.end.x + asset.x, y: s.end.y + asset.y };
                const ai = addNode(a);
                const bi = addNode(b);
                if (ai !== bi) edges.push({ a: ai, b: bi });
              }
              return { ...asset, wallNodes: nodes, wallEdges: edges, wallSegments: undefined } as AssetInstance;
            };

            const cleanupSmallEdges = (asset: AssetInstance, minLen = 0.8) => {
              if (!asset.wallNodes || !asset.wallEdges) return asset;
              const kept = asset.wallEdges.filter(e => {
                const a = asset.wallNodes![e.a];
                const b = asset.wallNodes![e.b];
                return Math.hypot(a.x - b.x, a.y - b.y) >= minLen;
              });
              return { ...asset, wallEdges: kept } as AssetInstance;
            };

            const addAndBlendWalls = (stateAssets: AssetInstance[]) => {
              // Normalize all walls first
              const result = stateAssets.map(a => toNodesEdges(a));
              // Insert new wall first
              result.push(wallAsset);
              const newIdx = result.length - 1;
              const newWall = result[newIdx];
              if (!newWall.wallNodes || !newWall.wallEdges) return result;
              // Compare against all existing walls
              for (let i = 0; i < result.length - 1; i++) {
                const other = result[i];
                if (other.type !== 'wall-segments' || !other.wallNodes || !other.wallEdges) continue;
                // Iterate edges
                for (const e1 of newWall.wallEdges) {
                  const a1 = newWall.wallNodes[e1.a];
                  const b1 = newWall.wallNodes[e1.b];
                  for (const e2 of other.wallEdges) {
                    const a2 = other.wallNodes[e2.a];
                    const b2 = other.wallNodes[e2.b];
                    const p = lineIntersection(a1, b1, a2, b2);
                    if (p) {
                      // Split both edges at intersection point
                      result[newIdx] = splitEdgeAtPoint(result[newIdx], e1.a, e1.b, p);
                      result[i] = splitEdgeAtPoint(result[i], e2.a, e2.b, p);
                    }
                  }
                }
              }
              // Merge coincident nodes across all walls (dedup within tolerance)
              const mergeTol = 0;
              for (let i = 0; i < result.length; i++) {
                const a = result[i];
                if (a.type !== 'wall-segments' || !a.wallNodes || !a.wallEdges) continue;
                const nodes = [...a.wallNodes];
                const mapIdx: number[] = nodes.map((_, idx) => idx);
                for (let j = 0; j < nodes.length; j++) {
                  for (let k = j + 1; k < nodes.length; k++) {
                    if (Math.hypot(nodes[j].x - nodes[k].x, nodes[j].y - nodes[k].y) <= mergeTol) {
                      mapIdx[k] = j;
                    }
                  }
                }
                const newEdges = a.wallEdges!.map(e => ({ a: mapIdx[e.a], b: mapIdx[e.b] })).filter(e => e.a !== e.b);
                result[i] = { ...a, wallNodes: nodes, wallEdges: newEdges } as AssetInstance;
              }
              // Remove tiny caps created by splits so the pass-through looks smooth
              for (let i = 0; i < result.length; i++) result[i] = cleanupSmallEdges(result[i]);
              return result;
            };

            set((state) => ({
              assets: addAndBlendWalls(state.assets),
              selectedAssetId: wallAsset.id,
              hasUnsavedChanges: true,
              wallDrawingMode: false,
              currentWallSegments: [],
              currentWallStart: null,
              currentWallTempEnd: null,
              firstHorizontalWallLength: null
            }));
          }
        }
      },

      cancelWallDrawing: () => set({
        wallDrawingMode: false,
        currentWallSegments: [],
        currentWallStart: null,
        currentWallTempEnd: null
      }),

      // Create a cross wall asset centered at position
      createCrossAt: (center, armMm = 160) => {
        const state = get();
        const thickness = state.getCurrentWallThickness();
        const wallGap = 8;
        const segments = [
          { start: { x: -armMm, y: 0 }, end: { x: armMm, y: 0 } },
          { start: { x: 0, y: -armMm }, end: { x: 0, y: armMm } },
        ];
        const asset: AssetInstance = {
          id: `wall-cross-${Date.now()}`,
          type: 'wall-segments',
          x: center.x,
          y: center.y,
          scale: 1,
          rotation: 0,
          zIndex: -100,
          wallSegments: segments,
          wallGap,
          wallThickness: thickness,
          lineColor: '#000000',
          backgroundColor: '#f3f4f6'
        } as any;
        set({
          assets: [...state.assets, asset],
          selectedAssetId: asset.id,
          wallDrawingMode: false,
          wallTool: 'wall',
          hasUnsavedChanges: true,
        });
      },

      // Compute snap delta for a wall being dragged to align with other walls
      getWallSnapDelta: (assetId, proposedCenter) => {
        const state = get();
        const tol = 2.0; // mm
        const asset = state.assets.find(a => a.id === assetId);
        if (!asset || asset.type !== 'wall-segments' || !asset.wallNodes || !asset.wallEdges) return { dx: 0, dy: 0 };
        const currentCenter = { x: asset.x, y: asset.y };
        const delta = { dx: proposedCenter.x - currentCenter.x, dy: proposedCenter.y - currentCenter.y };

        const movingNodes = asset.wallNodes.map(n => ({ x: n.x + delta.dx, y: n.y + delta.dy }));

        const foreignEndpoints: { x: number; y: number }[] = [];
        const foreignEdges: { a: { x: number; y: number }; b: { x: number; y: number } }[] = [];
        for (const other of state.assets) {
          if (other.id === assetId || other.type !== 'wall-segments' || !other.wallNodes || !other.wallEdges) continue;
          for (const n of other.wallNodes) foreignEndpoints.push({ x: n.x, y: n.y });
          for (const e of other.wallEdges) {
            const a = other.wallNodes[e.a];
            const b = other.wallNodes[e.b];
            foreignEdges.push({ a, b });
          }
        }

        const projectPointToSegment = (p: {x:number;y:number}, a: {x:number;y:number}, b: {x:number;y:number}) => {
          const abx = b.x - a.x, aby = b.y - a.y;
          const apx = p.x - a.x, apy = p.y - a.y;
          const ab2 = abx*abx + aby*aby;
          if (ab2 === 0) return null;
          let t = (apx*abx + apy*aby) / ab2;
          if (t <= 0 || t >= 1) return null;
          return { x: a.x + t*abx, y: a.y + t*aby };
        };

        let best = { dx: 0, dy: 0 };
        let bestD = tol + 1;
        // Endpoint -> endpoint
        for (const pn of movingNodes) {
          for (const q of foreignEndpoints) {
            const d = Math.hypot(q.x - pn.x, q.y - pn.y);
            if (d < bestD && d <= tol) {
              bestD = d; best = { dx: q.x - pn.x, dy: q.y - pn.y };
            }
          }
        }
        // Endpoint -> edge projection
        for (const pn of movingNodes) {
          for (const e of foreignEdges) {
            const proj = projectPointToSegment(pn, e.a, e.b);
            if (!proj) continue;
            const d = Math.hypot(proj.x - pn.x, proj.y - pn.y);
            if (d < bestD && d <= tol) {
              bestD = d; best = { dx: proj.x - pn.x, dy: proj.y - pn.y };
            }
          }
        }
        return best;
      },

      // Apply final move and split/merge at intersections
      finishWallMove: (assetId, finalCenter) => {
        const state = get();
        const idx = state.assets.findIndex(a => a.id === assetId);
        if (idx < 0) return;
        const a = state.assets[idx];
        if (a.type !== 'wall-segments' || !a.wallNodes || !a.wallEdges) return;
        const delta = { x: finalCenter.x - a.x, y: finalCenter.y - a.y };
        const movedNodes = a.wallNodes.map(n => ({ x: n.x + delta.x, y: n.y + delta.y }));
        const movedAsset: AssetInstance = { ...a, x: finalCenter.x, y: finalCenter.y, wallNodes: movedNodes } as AssetInstance;

        // helpers
        const splitEdgeAtPoint = (
          asset: AssetInstance,
          aIndex: number,
          bIndex: number,
          point: { x: number; y: number }
        ) => {
          if (!asset.wallNodes || !asset.wallEdges) return asset;
          const nodes = [...asset.wallNodes];
          const edges = [...asset.wallEdges];
          const newNodeIndex = nodes.findIndex(n => Math.hypot(n.x - point.x, n.y - point.y) <= 0.5);
          const idxN = newNodeIndex >= 0 ? newNodeIndex : (nodes.push({ x: point.x, y: point.y }), nodes.length - 1);
          const filtered = edges.filter(e => !(e.a === aIndex && e.b === bIndex) && !(e.a === bIndex && e.b === aIndex));
          filtered.push({ a: aIndex, b: idxN });
          filtered.push({ a: idxN, b: bIndex });
          return { ...asset, wallNodes: nodes, wallEdges: filtered } as AssetInstance;
        };
        const lineIntersection = (
          p1: {x:number;y:number}, p2: {x:number;y:number},
          p3: {x:number;y:number}, p4: {x:number;y:number}
        ): {x:number;y:number} | null => {
          const denom = (p1.x - p2.x) * (p3.y - p4.y) - (p1.y - p2.y) * (p3.x - p4.x);
          if (Math.abs(denom) < 1e-9) return null;
          const t = ((p1.x - p3.x) * (p3.y - p4.y) - (p1.y - p3.y) * (p3.x - p4.x)) / denom;
          const u = ((p1.x - p3.x) * (p1.y - p2.y) - (p1.y - p3.y) * (p1.x - p2.x)) / denom;
          if (t <= 0 || t >= 1 || u <= 0 || u >= 1) return null;
          return { x: p1.x + t * (p2.x - p1.x), y: p1.y + t * (p2.y - p1.y) };
        };

        // Start from current assets with moved asset injected
        const result = [...state.assets];
        result[idx] = movedAsset;
        // Split intersections between movedAsset and all other walls
        const moved = result[idx];
        if (moved.wallNodes && moved.wallEdges) {
          for (let i = 0; i < result.length; i++) {
            if (i === idx) continue;
            const other = result[i];
            if (other.type !== 'wall-segments' || !other.wallNodes || !other.wallEdges) continue;
            for (const e1 of moved.wallEdges) {
              const a1n = moved.wallNodes[e1.a];
              const b1n = moved.wallNodes[e1.b];
              for (const e2 of other.wallEdges) {
                const a2n = other.wallNodes[e2.a];
                const b2n = other.wallNodes[e2.b];
                const p = lineIntersection(a1n, b1n, a2n, b2n);
                if (p) {
                  result[idx] = splitEdgeAtPoint(result[idx], e1.a, e1.b, p);
                  result[i] = splitEdgeAtPoint(result[i], e2.a, e2.b, p);
                }
              }
            }
          }
        }

        // Cleanup tiny edges after splits
            const cleanupSmallEdges = (asset: AssetInstance, minLen = 0) => {
          if (!asset.wallNodes || !asset.wallEdges) return asset;
          const kept = asset.wallEdges.filter(e => {
            const a = asset.wallNodes![e.a];
            const b = asset.wallNodes![e.b];
            return Math.hypot(a.x - b.x, a.y - b.y) >= minLen;
          });
          return { ...asset, wallEdges: kept } as AssetInstance;
        };
        for (let i=0;i<result.length;i++) result[i] = cleanupSmallEdges(result[i]);

        set({ assets: result, hasUnsavedChanges: true, selectedAssetId: assetId });
      },

      // Copy/paste methods
      copyAsset: (id) => {
        const state = get();
        const asset = state.assets.find(a => a.id === id);
        if (asset) {
          set({ clipboard: { ...asset } });
        }
      },

      pasteAsset: (offsetX = 10, offsetY = 10) => {
        const state = get();
        if (!state.clipboard) return;

        // Get the next zIndex for the pasted asset
        const nextZIndex = state.assets.length > 0 
          ? Math.max(...state.assets.map(a => a.zIndex || 0)) + 1 
          : 1;

        const newAsset: AssetInstance = {
          ...state.clipboard,
          id: `${state.clipboard.type}-${Date.now()}`,
          x: state.clipboard.x + offsetX,
          y: state.clipboard.y + offsetY,
          zIndex: nextZIndex,
        };

        set({
          assets: [...state.assets, newAsset],
          selectedAssetId: newAsset.id,
          hasUnsavedChanges: true,
        });
        
        // Save to history after pasting asset
        setTimeout(() => get().saveToHistory(), 0);
      },

      clearClipboard: () => set({ clipboard: null }),

      // Undo/Redo methods - Optimized for localStorage
      saveToHistory: () => {
        try {
          const state = get();
          
          // Limit history size to prevent localStorage overflow
          const MAX_HISTORY_SIZE = 20;
          const newHistory = state.history.slice(0, state.historyIndex + 1);
          
          // Only save if assets have actually changed
          const currentAssets = state.assets;
          const lastAssets = newHistory[newHistory.length - 1];
          
          if (lastAssets && JSON.stringify(currentAssets) === JSON.stringify(lastAssets)) {
            return; // No changes, don't save
          }
          
          // Add current state
          newHistory.push([...currentAssets]);
          
          // Trim history if it exceeds max size
          if (newHistory.length > MAX_HISTORY_SIZE) {
            newHistory.shift(); // Remove oldest entry
          }
          
          set({
            history: newHistory,
            historyIndex: newHistory.length - 1,
          });
        } catch (error) {
          console.warn('Failed to save to history, clearing history to free space:', error);
          // Clear history if we can't save
          set({
            history: [],
            historyIndex: -1,
          });
        }
      },

      undo: () => {
        const state = get();
        if (state.historyIndex > 0) {
          const newIndex = state.historyIndex - 1;
          set({
            assets: [...state.history[newIndex]],
            historyIndex: newIndex,
            hasUnsavedChanges: true,
          });
        }
      },

      redo: () => {
        const state = get();
        if (state.historyIndex < state.history.length - 1) {
          const newIndex = state.historyIndex + 1;
          set({
            assets: [...state.history[newIndex]],
            historyIndex: newIndex,
            hasUnsavedChanges: true,
          });
        }
      },

      // Clear history to free up localStorage space
      clearHistory: () => {
        set({
          history: [],
          historyIndex: -1,
        });
      },

      // Smart duplication methods
      smartDuplicate: (id) => {
        const state = get();
        const originalAsset = state.assets.find(a => a.id === id);
        if (!originalAsset) return;

        // If we have a pattern and this is the same type of asset, continue the pattern
        if (state.duplicationPattern && state.lastDuplicatedAsset && 
            originalAsset.type === state.lastDuplicatedAsset.type) {
          
          let newX = originalAsset.x;
          let newY = originalAsset.y;
          
          switch (state.duplicationPattern.type) {
            case 'linear':
              if (state.duplicationPattern.direction) {
                newX += state.duplicationPattern.direction.x;
                newY += state.duplicationPattern.direction.y;
              }
              break;
              
            case 'circular':
              if (state.duplicationPattern.center && state.duplicationPattern.angle !== undefined) {
                const angle = state.duplicationPattern.angle;
                const distance = state.duplicationPattern.distance || 100;
                newX = state.duplicationPattern.center.x + Math.cos(angle) * distance;
                newY = state.duplicationPattern.center.y + Math.sin(angle) * distance;
                // Update pattern for next duplication
                set({
                  duplicationPattern: {
                    ...state.duplicationPattern,
                    angle: angle + (Math.PI / 6) // 30 degree increments
                  }
                });
              }
              break;
              
            case 'grid':
              // Simple grid pattern - could be enhanced
              newX += 50;
              break;
          }
          
          // Create the duplicated asset
          const newAsset: AssetInstance = {
            ...originalAsset,
            id: `${originalAsset.type}-${Date.now()}`,
            x: newX,
            y: newY,
            zIndex: Math.max(...state.assets.map(a => a.zIndex || 0)) + 1,
          };
          
          set({
            assets: [...state.assets, newAsset],
            selectedAssetId: newAsset.id,
            lastDuplicatedAsset: newAsset,
            hasUnsavedChanges: true,
          });
          
          // Save to history
          setTimeout(() => get().saveToHistory(), 0);
          return;
        }
        
        // Fallback to regular duplication
        const newAsset: AssetInstance = {
          ...originalAsset,
          id: `${originalAsset.type}-${Date.now()}`,
          x: originalAsset.x + 20,
          y: originalAsset.y + 20,
          zIndex: Math.max(...state.assets.map(a => a.zIndex || 0)) + 1,
        };
        
        set({
          assets: [...state.assets, newAsset],
          selectedAssetId: newAsset.id,
          lastDuplicatedAsset: newAsset,
          hasUnsavedChanges: true,
        });
        
        // Save to history
        setTimeout(() => get().saveToHistory(), 0);
      },

      detectDuplicationPattern: (originalAsset, duplicatedAsset) => {
        const state = get();
        const dx = duplicatedAsset.x - originalAsset.x;
        const dy = duplicatedAsset.y - originalAsset.y;
        const distance = Math.hypot(dx, dy);
        
        // Detect circular pattern around a center point
        const nearbyAssets = state.assets.filter(asset => 
          asset.id !== originalAsset.id && 
          asset.id !== duplicatedAsset.id &&
          Math.hypot(asset.x - originalAsset.x, asset.y - originalAsset.y) < 300
        );
        
        if (nearbyAssets.length > 0) {
          // Try to find a center point that makes sense
          const potentialCenters = nearbyAssets.map(asset => ({
            x: asset.x,
            y: asset.y,
            distance: Math.hypot(asset.x - originalAsset.x, asset.y - originalAsset.y)
          }));
          
          // Find the center that's most equidistant from both assets
          let bestCenter = null;
          let bestScore = Infinity;
          
          for (const center of potentialCenters) {
            const dist1 = Math.hypot(originalAsset.x - center.x, originalAsset.y - center.y);
            const dist2 = Math.hypot(duplicatedAsset.x - center.x, duplicatedAsset.y - center.y);
            const score = Math.abs(dist1 - dist2);
            
            if (score < bestScore && score < 30) {
              bestScore = score;
              bestCenter = center;
            }
          }
          
          if (bestCenter) {
            // Circular pattern detected
            const angle = Math.atan2(duplicatedAsset.y - bestCenter.y, duplicatedAsset.x - bestCenter.x);
            const distance = Math.hypot(originalAsset.x - bestCenter.x, originalAsset.y - bestCenter.y);
            
            set({
              duplicationPattern: {
                type: 'circular',
                center: { x: bestCenter.x, y: bestCenter.y },
                angle: angle + (Math.PI / 6), // Next position (30 degrees)
                distance
              }
            });
            return;
          }
        }
        
        // Detect linear pattern
        if (Math.abs(dx) > Math.abs(dy)) {
          // Horizontal line
          set({
            duplicationPattern: {
              type: 'linear',
              direction: { x: dx, y: 0 },
              distance
            }
          });
        } else if (Math.abs(dy) > Math.abs(dx)) {
          // Vertical line
          set({
            duplicationPattern: {
              type: 'linear',
              direction: { x: 0, y: dy },
              distance
            }
          });
        } else {
          // Diagonal line
          set({
            duplicationPattern: {
              type: 'linear',
              direction: { x: dx, y: dy },
              distance
            }
          });
        }
      },

      // Multi-select methods
      startRectangularSelection: (startX, startY) => {
        set({
          isRectangularSelecting: true,
          selectionBox: { startX, startY, endX: startX, endY: startY },
          selectedAssetIds: [],
        });
      },

      updateRectangularSelection: (endX, endY) => {
        const state = get();
        if (state.isRectangularSelecting && state.selectionBox) {
          set({
            selectionBox: { ...state.selectionBox, endX, endY },
          });
        }
      },

      finishRectangularSelection: () => {
        const state = get();
        if (!state.isRectangularSelecting || !state.selectionBox) return;

        const { startX, startY, endX, endY } = state.selectionBox;
        const minX = Math.min(startX, endX);
        const maxX = Math.max(startX, endX);
        const minY = Math.min(startY, endY);
        const maxY = Math.max(startY, endY);

        // Find assets that intersect with the selection box
        const selectedIds = state.assets
          .filter(asset => {
            const assetLeft = asset.x - (asset.width || 24) * (asset.scale || 1) / 2;
            const assetRight = asset.x + (asset.width || 24) * (asset.scale || 1) / 2;
            const assetTop = asset.y - (asset.height || 24) * (asset.scale || 1) / 2;
            const assetBottom = asset.y + (asset.height || 24) * (asset.scale || 1) / 2;

            return !(assetRight < minX || assetLeft > maxX || assetBottom < minY || assetTop > maxY);
          })
          .map(asset => asset.id);

        set({
          isRectangularSelecting: false,
          selectionBox: null,
          selectedAssetIds: selectedIds,
          selectedAssetId: selectedIds.length === 1 ? selectedIds[0] : null,
        });
      },

      selectMultipleAssets: (ids) => {
        set({
          selectedAssetIds: ids,
          selectedAssetId: ids.length === 1 ? ids[0] : null,
        });
      },

      clearSelection: () => {
        set({
          selectedAssetIds: [],
          selectedAssetId: null,
        });
      },

      moveSelectedAssets: (deltaX, deltaY) => {
        const state = get();
        const updatedAssets = state.assets.map(asset => {
          if (state.selectedAssetIds.includes(asset.id)) {
            return { ...asset, x: asset.x + deltaX, y: asset.y + deltaY };
          }
          return asset;
        });

        set({
          assets: updatedAssets,
          hasUnsavedChanges: true,
        });

        // Save to history
        setTimeout(() => get().saveToHistory(), 0);
      },

      duplicateSelectedAssets: () => {
        const state = get();
        if (state.selectedAssetIds.length === 0) return;

        const duplicatedAssets: AssetInstance[] = [];
        const offsetX = 20;
        const offsetY = 20;

        state.selectedAssetIds.forEach((id, index) => {
          const originalAsset = state.assets.find(a => a.id === id);
          if (originalAsset) {
            const newAsset: AssetInstance = {
              ...originalAsset,
              id: `${originalAsset.type}-${Date.now()}-${index}`,
              x: originalAsset.x + offsetX,
              y: originalAsset.y + offsetY,
              zIndex: Math.max(...state.assets.map(a => a.zIndex || 0)) + index + 1,
            };
            duplicatedAssets.push(newAsset);
          }
        });

        set({
          assets: [...state.assets, ...duplicatedAssets],
          selectedAssetIds: duplicatedAssets.map(a => a.id),
          selectedAssetId: duplicatedAssets.length === 1 ? duplicatedAssets[0].id : null,
          hasUnsavedChanges: true,
        });

        // Save to history
        setTimeout(() => get().saveToHistory(), 0);
      },

      deleteSelectedAssets: () => {
        const state = get();
        if (state.selectedAssetIds.length === 0) return;

        const remainingAssets = state.assets.filter(asset => 
          !state.selectedAssetIds.includes(asset.id)
        );

        set({
          assets: remainingAssets,
          selectedAssetIds: [],
          selectedAssetId: null,
          hasUnsavedChanges: true,
        });

        // Save to history
        setTimeout(() => get().saveToHistory(), 0);
      },

      setRectangularSelectionMode: (enabled) => {
        console.log("Store: setRectangularSelectionMode called with enabled:", enabled);
        set({ 
          isRectangularSelectionMode: enabled,
          createGroupFromSelection: enabled, // Enable group creation when using rectangular selection
        });
        console.log("Store: After setting, createGroupFromSelection:", get().createGroupFromSelection);
      },

      startRectangularSelectionDrag: (startX, startY) => {
        console.log("Store: Starting rectangular selection drag at:", startX, startY);
        set({
          rectangularSelectionStart: { x: startX, y: startY },
          rectangularSelectionEnd: { x: startX, y: startY },
          isRectangularSelecting: true,
        });
      },

      updateRectangularSelectionDrag: (endX, endY) => {
        console.log("Store: Updating rectangular selection drag to:", endX, endY);
        set({
          rectangularSelectionEnd: { x: endX, y: endY },
        });
      },

      finishRectangularSelectionDrag: () => {
        console.log("Store: Finishing rectangular selection drag");
        const state = get();
        if (!state.rectangularSelectionStart || !state.rectangularSelectionEnd) {
          console.log("Store: No start or end point, returning");
          return;
        }

        const { rectangularSelectionStart, rectangularSelectionEnd } = state;
        const minX = Math.min(rectangularSelectionStart.x, rectangularSelectionEnd.x);
        const maxX = Math.max(rectangularSelectionStart.x, rectangularSelectionEnd.x);
        const minY = Math.min(rectangularSelectionStart.y, rectangularSelectionEnd.y);
        const maxY = Math.max(rectangularSelectionStart.y, rectangularSelectionEnd.y);

        // Find assets that intersect with the selection box
        console.log("Store: Selection box bounds:", { minX, maxX, minY, maxY });
        console.log("Store: Available assets:", state.assets.length);
        
        const selectedIds = state.assets
          .filter(asset => {
            // Get asset dimensions based on type
            let assetWidth = asset.width || 24;
            let assetHeight = asset.height || 24;
            
            // Handle special cases for different asset types
            if (asset.type === 'square' || asset.type === 'circle') {
              assetWidth = asset.width || 50;
              assetHeight = asset.height || 50;
            } else if (asset.type === 'line') {
              assetWidth = asset.width || 100;
              assetHeight = asset.height || 2;
            } else if (asset.type === 'double-line') {
              assetWidth = asset.width || 2;
              assetHeight = asset.height || 100;
            } else if (asset.type === 'text') {
              assetWidth = asset.width || 100;
              assetHeight = asset.height || 20;
            }
            
            // Apply scale
            const scaledWidth = assetWidth * (asset.scale || 1);
            const scaledHeight = assetHeight * (asset.scale || 1);
            
            // Calculate bounds
            const assetLeft = asset.x - scaledWidth / 2;
            const assetRight = asset.x + scaledWidth / 2;
            const assetTop = asset.y - scaledHeight / 2;
            const assetBottom = asset.y + scaledHeight / 2;

            const intersects = !(assetRight < minX || assetLeft > maxX || assetBottom < minY || assetTop > maxY);
            
            console.log(`Store: Asset ${asset.id} (${asset.type}):`, {
              position: { x: asset.x, y: asset.y },
              originalSize: { width: assetWidth, height: assetHeight },
              scaledSize: { width: scaledWidth, height: scaledHeight },
              bounds: { left: assetLeft, right: assetRight, top: assetTop, bottom: assetBottom },
              selectionBox: { minX, maxX, minY, maxY },
              intersects
            });

            return intersects;
          })
          .map(asset => asset.id);

        console.log("Store: Selected assets:", selectedIds.length, selectedIds);
        console.log("Store: createGroupFromSelection:", state.createGroupFromSelection);
        
        // If we have multiple assets selected, automatically create a group
        if (selectedIds.length >= 2) {
          console.log("Store: Auto-creating group from rectangular selection");
          set({
            isRectangularSelecting: false,
            rectangularSelectionStart: null,
            rectangularSelectionEnd: null,
            selectedAssetIds: selectedIds,
            selectedAssetId: null,
          });
          
          // Create group from selected assets
          setTimeout(() => {
            console.log("Store: About to create group, selectedAssetIds:", get().selectedAssetIds);
            get().createGroupFromSelectedAssets();
          }, 0);
        } else {
          // Single asset or no assets - just select normally
          set({
            isRectangularSelecting: false,
            rectangularSelectionStart: null,
            rectangularSelectionEnd: null,
            selectedAssetIds: selectedIds,
            selectedAssetId: selectedIds.length === 1 ? selectedIds[0] : null,
          });
        }
      },

      setCreateGroupFromSelection: (enabled) => {
        set({ createGroupFromSelection: enabled });
      },

      groupSelectedAssets: () => {
        const state = get();
        console.log("Store: groupSelectedAssets called with selectedAssetIds:", state.selectedAssetIds);
        if (state.selectedAssetIds.length < 2) {
          console.log("Store: Not enough assets to create group (need at least 2)");
          return; // Need at least 2 assets to create a group
        }
        
        // Get the selected assets
        const selectedAssets = state.assets.filter(asset => 
          state.selectedAssetIds.includes(asset.id)
        );

        if (selectedAssets.length === 0) return;

        // Calculate group bounds with proper asset dimensions
        const minX = Math.min(...selectedAssets.map(a => {
          const assetWidth = (a.width || 24) * (a.scale || 1);
          return a.x - assetWidth / 2;
        }));
        const maxX = Math.max(...selectedAssets.map(a => {
          const assetWidth = (a.width || 24) * (a.scale || 1);
          return a.x + assetWidth / 2;
        }));
        const minY = Math.min(...selectedAssets.map(a => {
          const assetHeight = (a.height || 24) * (a.scale || 1);
          return a.y - assetHeight / 2;
        }));
        const maxY = Math.max(...selectedAssets.map(a => {
          const assetHeight = (a.height || 24) * (a.scale || 1);
          return a.y + assetHeight / 2;
        }));

        const groupCenterX = (minX + maxX) / 2;
        const groupCenterY = (minY + maxY) / 2;
        const groupWidth = Math.max(50, maxX - minX); // Minimum width of 50mm
        const groupHeight = Math.max(50, maxY - minY); // Minimum height of 50mm

        // Create group asset
        const groupId = `group-${Date.now()}`;
        const groupAsset: AssetInstance = {
          id: groupId,
          type: 'group',
          x: groupCenterX,
          y: groupCenterY,
          scale: 1,
          rotation: 0,
          zIndex: Math.max(...state.assets.map(a => a.zIndex || 0)) + 1,
          width: groupWidth,
          height: groupHeight,
          isGroup: true,
          groupAssets: selectedAssets.map(asset => ({
            ...asset,
            // Convert to relative positions within the group
            x: asset.x - groupCenterX,
            y: asset.y - groupCenterY,
          })),
          groupExpanded: false,
          backgroundColor: '#f3f4f6', // bg-gray-100
        };

        // Keep all assets and add group (don't remove individual assets)
        console.log("Store: Creating group with ID:", groupId);
        console.log("Store: Group contains assets:", groupAsset.groupAssets?.length);
        console.log("Store: Total assets after group creation:", state.assets.length + 1);

        set({
          assets: [...state.assets, groupAsset],
          selectedAssetIds: [groupId],
          selectedAssetId: groupId,
          hasUnsavedChanges: true,
        });

        // Save to history
        setTimeout(() => get().saveToHistory(), 0);
      },

      createGroupFromSelectedAssets: () => {
        // Use the new groupSelectedAssets method
        get().groupSelectedAssets();
      },

      ungroupAsset: (groupId) => {
        const state = get();
        const groupAsset = state.assets.find(asset => asset.id === groupId);
        
        if (!groupAsset || !groupAsset.isGroup || !groupAsset.groupAssets) return;

        // Convert group assets back to absolute positions
        const ungroupedAssets = groupAsset.groupAssets.map(asset => ({
          ...asset,
          x: asset.x + groupAsset.x,
          y: asset.y + groupAsset.y,
          zIndex: Math.max(...state.assets.map(a => a.zIndex || 0)) + 1,
        }));

        // Remove group and add ungrouped assets
        const remainingAssets = state.assets.filter(asset => asset.id !== groupId);
        
        set({
          assets: [...remainingAssets, ...ungroupedAssets],
          selectedAssetIds: ungroupedAssets.map(a => a.id),
          selectedAssetId: ungroupedAssets[0]?.id || null,
          hasUnsavedChanges: true,
        });

        // Save to history
        setTimeout(() => get().saveToHistory(), 0);
      },
    }),
    { 
      name: "scene-storage-v2",
      partialize: (state) => ({
        // Only persist essential data, not the full history
        canvas: state.canvas,
        assets: state.assets,
        selectedAssetId: state.selectedAssetId,
        showGrid: state.showGrid,
        gridSize: state.gridSize,
        snapToGridEnabled: state.snapToGridEnabled,
        wallType: state.wallType,
        chairSettings: state.chairSettings,
        // Don't persist history to prevent localStorage overflow
        // history: state.history,
        // historyIndex: state.historyIndex,
      }),
      // Add storage error handling
      onRehydrateStorage: () => (state) => {
        if (state) {
          // Clear history on rehydration to prevent storage issues
          state.history = [];
          state.historyIndex = -1;
        }
      },
    }
  )
);

