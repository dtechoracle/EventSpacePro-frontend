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
  backgroundColor?: string; // for all assets, default transparent
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
    size: PaperSize;
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

  // Copy/paste state
  clipboard: AssetInstance | null;

  // Methods
  setCanvas: (size: PaperSize) => void;
  addAsset: (type: string, x: number, y: number) => void;
  addAssetObject: (assetObj: AssetInstance) => void;
  updateAsset: (id: string, updates: Partial<AssetInstance>) => void;
  removeAsset: (id: string) => void;
  selectAsset: (id: string | null) => void;
  toggleGrid: () => void;
  toggleDebugOutlines: () => void;
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
  // New draft methods
  startWallDraft: (start: { x: number; y: number }) => void;
  addWallDraftNode: (pt: { x: number; y: number }) => void;
  finishWallDraft: () => void;

  // Copy/paste methods
  copyAsset: (id: string) => void;
  pasteAsset: (offsetX?: number, offsetY?: number) => void;
  clearClipboard: () => void;
};

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
      showDebugOutlines: false,
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
      clipboard: null,

      setCanvas: (size) => {
        const { width, height } = PAPER_SIZES[size];
        set({
          canvas: { size, width, height },
          assets: [],
          selectedAssetId: null,
          hasUnsavedChanges: true
        });
      },

      addAsset: (type, x, y) => {
        const state = get();
        // Prevent any non-wall asset creation while wall drawing is active (avoids ghost assets)
        if (state.wallDrawingMode && type !== "wall-segments") return;
        if (!state.canvas) return;
        const id = `${type}-${Date.now()}`;

        // Get the next zIndex (highest existing zIndex + 1, or 1 if no assets exist)
        const nextZIndex = state.assets.length > 0 
          ? Math.max(...state.assets.map(a => a.zIndex || 0)) + 1 
          : 1;

        // Default properties for shapes
        const shapeDefaults: Partial<AssetInstance> =
          type === "square" || type === "circle"
            ? { width: 50, height: 50, backgroundColor: "#FFFFFF" }
            : type === "line"
              ? { width: 100, height: 2, strokeWidth: 2, strokeColor: "#000000", backgroundColor: "#FFFFFF" }
              : type === "double-line"
                ? { width: 2, height: 100, strokeWidth: 2, strokeColor: "#000000", lineGap: 8, lineColor: "#000000", backgroundColor: "#FFFFFF" }
                : type === "drawn-line"
                  ? { strokeWidth: 2, strokeColor: "#000000", backgroundColor: "#FFFFFF" }
                  : type === "wall-segments"
                    ? { wallThickness: 1, wallGap: 8, lineColor: "#000000", backgroundColor: "#FFFFFF" }
                    : type === "text"
                      ? { width: 100, height: 20, text: "Enter text", fontSize: 16, textColor: "#000000", fontFamily: "Arial", backgroundColor: "#FFFFFF" }
                      : { width: 24, height: 24, backgroundColor: "#FFFFFF" }; // Default for icons

        set({
          assets: [
            ...state.assets,
            { id, type, x, y, scale: 1, rotation: 0, zIndex: nextZIndex, ...shapeDefaults },
          ],
          selectedAssetId: id,
          hasUnsavedChanges: true,
        });
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
      },

      updateAsset: (id, updates) => {
        const state = get();
        const updatedAssets = state.assets.map((a) => (a.id === id ? { ...a, ...updates } : a));
        set({ assets: updatedAssets, hasUnsavedChanges: true });

        // Automatic wall opening for double doors when moved/scaled
        const moved = updates.x !== undefined || updates.y !== undefined || updates.rotation !== undefined || updates.width !== undefined || updates.scale !== undefined;
        const door = updatedAssets.find(a => a.id === id);
        if (!door || door.type !== 'double-door' || !moved) return;

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

      removeAsset: (id) =>
        set((state) => ({
          assets: state.assets.filter((a) => a.id !== id),
          selectedAssetId: state.selectedAssetId === id ? null : state.selectedAssetId,
          hasUnsavedChanges: true,
        })),

      selectAsset: (id) => set({ selectedAssetId: id }),

      toggleGrid: () => set((state) => ({ showGrid: !state.showGrid })),

      toggleDebugOutlines: () => set((state) => ({ showDebugOutlines: !state.showDebugOutlines })),

      setShapeMode: (mode) => set({ shapeMode: mode, shapeStart: null, shapeTempEnd: null }),
      startShape: (start) => set({ shapeStart: start, shapeTempEnd: null }),
      updateShapeTempEnd: (end) => set({ shapeTempEnd: end }),
      finishShape: () => {
        const state = get();
        if (!state.shapeMode || !state.shapeStart || !state.shapeTempEnd) return;
        const start = state.shapeStart;
        const end = state.shapeTempEnd;
        const centerX = (start.x + end.x) / 2;
        const centerY = (start.y + end.y) / 2;
        const width = Math.max(1, Math.abs(end.x - start.x));
        const height = Math.max(1, Math.abs(end.y - start.y));
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
            backgroundColor: 'transparent',
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
            backgroundColor: 'transparent',
            fillColor: 'transparent',
            strokeColor: '#000000',
            strokeWidth: 2,
          } as any;
        } else if (state.shapeMode === 'line') {
          newAsset = {
            id: `line-${Date.now()}`,
            type: 'line',
            x: centerX,
            y: centerY,
            scale: 1,
            rotation: 0,
            width,
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

        // Compute center
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        nodes.forEach(n => { minX = Math.min(minX, n.x); minY = Math.min(minY, n.y); maxX = Math.max(maxX, n.x); maxY = Math.max(maxY, n.y); });
        const cx = (minX + maxX) / 2; const cy = (minY + maxY) / 2;

        // Get the next zIndex for the wall asset
        const nextZIndex = state.assets.length > 0 
          ? Math.max(...state.assets.map(a => a.zIndex || 0)) + 1 
          : 1;

        const wallAsset: AssetInstance = {
          id: `wall-segments-${Date.now()}`,
          type: "wall-segments",
          x: cx,
          y: cy,
          scale: 2,
          rotation: 0,
          zIndex: nextZIndex,
          wallNodes: nodes,
          wallEdges: edges,
          wallThickness: 1,
          wallGap: 8,
          lineColor: "#000000",
          backgroundColor: "#FFFFFF"
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
          const newSegment = {
            start: state.currentWallStart,
            end: state.currentWallTempEnd
          };
          // Determine if this is the first horizontal segment to track length
          const dx = newSegment.end.x - newSegment.start.x;
          const dy = newSegment.end.y - newSegment.start.y;
          const isHorizontal = Math.abs(dx) >= Math.abs(dy);
          const length = Math.sqrt(dx * dx + dy * dy);

          set({
            currentWallSegments: [...state.currentWallSegments, newSegment],
            currentWallStart: state.currentWallTempEnd, // Next segment starts where this one ends
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

            // Get the next zIndex for the wall asset
            const nextZIndex = state.assets.length > 0 
              ? Math.max(...state.assets.map(a => a.zIndex || 0)) + 1 
              : 1;

            const wallAsset: AssetInstance = {
              id: `wall-segments-${Date.now()}`,
              type: "wall-segments",
              x: centerX,
              y: centerY,
              scale: 2, // Default scale of 2 for proper wall size
              rotation: 0,
              zIndex: nextZIndex,
              wallSegments: undefined,
              wallNodes: nodes,
              wallEdges: edges,
              wallThickness: 1, // Default wall thickness of 1
              wallGap: 8,
              lineColor: "#000000",
              backgroundColor: "#FFFFFF"
            };

            set((state) => ({
              assets: [...state.assets, wallAsset],
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
        if (!state.clipboard || !state.canvas) return;

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
      },

      clearClipboard: () => set({ clipboard: null }),
    }),
    { name: "scene-storage" }
  )
);

