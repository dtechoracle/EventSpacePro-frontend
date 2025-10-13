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
      isPenMode: false,
      isWallMode: false,
      isDrawing: false,
      currentPath: [],
      tempPath: [],
      wallDrawingMode: false,
      currentWallSegments: [],
      currentWallStart: null,
      currentWallTempEnd: null,
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
        if (!state.canvas) return;
        const id = `${type}-${Date.now()}`;

        // Default properties for shapes
        const shapeDefaults: Partial<AssetInstance> =
          type === "square" || type === "circle"
            ? { width: 50, height: 50, backgroundColor: "transparent" }
            : type === "line"
              ? { width: 100, height: 2, strokeWidth: 2, strokeColor: "#000000", backgroundColor: "transparent" }
              : type === "double-line"
                ? { width: 2, height: 100, strokeWidth: 2, strokeColor: "#000000", lineGap: 8, lineColor: "#000000", backgroundColor: "transparent" }
                : type === "drawn-line"
                  ? { strokeWidth: 2, strokeColor: "#000000", backgroundColor: "transparent" }
                  : type === "wall-segments"
                    ? { wallThickness: 1, wallGap: 8, lineColor: "#000000", backgroundColor: "transparent" }
                    : type === "text"
                      ? { width: 100, height: 20, text: "Enter text", fontSize: 16, textColor: "#000000", fontFamily: "Arial", backgroundColor: "transparent" }
                      : { width: 24, height: 24, backgroundColor: "transparent" }; // Default for icons

        set({
          assets: [
            ...state.assets,
            { id, type, x, y, scale: 1, rotation: 0, ...shapeDefaults },
          ],
          selectedAssetId: id,
          hasUnsavedChanges: true,
        });
      },

      addAssetObject: (assetObj: AssetInstance) => {
        set((state) => ({
          assets: [...state.assets, assetObj],
          selectedAssetId: assetObj.id,
          hasUnsavedChanges: true,
        }));
      },

      updateAsset: (id, updates) =>
        set((state) => ({
          assets: state.assets.map((a) =>
            a.id === id ? { ...a, ...updates } : a
          ),
          hasUnsavedChanges: true,
        })),

      removeAsset: (id) =>
        set((state) => ({
          assets: state.assets.filter((a) => a.id !== id),
          selectedAssetId: state.selectedAssetId === id ? null : state.selectedAssetId,
          hasUnsavedChanges: true,
        })),

      selectAsset: (id) => set({ selectedAssetId: id }),

      toggleGrid: () => set((state) => ({ showGrid: !state.showGrid })),

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
        currentWallSegments: enabled ? [] : [],
        currentWallStart: enabled ? null : null,
        currentWallTempEnd: enabled ? null : null
      }),

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
          set({
            currentWallSegments: [...state.currentWallSegments, newSegment],
            currentWallStart: state.currentWallTempEnd, // Next segment starts where this one ends
            currentWallTempEnd: null
          });
        }
      },

      finishWallDrawing: () => {
        const state = get();
        if (state.currentWallSegments.length > 0) {
          // Check if current wall connects to any existing walls
          const wallAssets = state.assets.filter(asset => asset.wallSegments && asset.wallSegments.length > 0);
          let connectedAsset: { asset: AssetInstance; segmentIndex: number; connectionPoint: 'start' | 'end'; connectionPosition: { x: number; y: number } } | null = null;

          // Check if the first or last point of current wall connects to an existing wall
          if (state.currentWallSegments.length > 0) {
            const firstPoint = state.currentWallSegments[0].start;
            const lastPoint = state.currentWallSegments[state.currentWallSegments.length - 1].end;

            // Helper function to find nearby wall segment with connection details
            const findNearbyWallSegment = (
              point: { x: number; y: number },
              threshold: number = 5
            ): { asset: AssetInstance; segmentIndex: number; connectionPoint: 'start' | 'end'; connectionPosition: { x: number; y: number } } | null => {
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
                    return {
                      asset,
                      segmentIndex: i,
                      connectionPoint: 'start',
                      connectionPosition: absStart
                    };
                  }

                  if (distToEnd <= threshold) {
                    return {
                      asset,
                      segmentIndex: i,
                      connectionPoint: 'end',
                      connectionPosition: absEnd
                    };
                  }
                }
              }
              return null;
            };

            connectedAsset = findNearbyWallSegment(firstPoint) || findNearbyWallSegment(lastPoint);
          }

          if (connectedAsset) {
            // Merge with existing wall asset and handle overlaps
            const updatedAssets = state.assets.map(asset => {
              if (asset.id === connectedAsset!.asset.id) {
                // Convert existing asset segments to absolute coordinates
                const existingSegments = asset.wallSegments!.map((segment, index) => {
                  // Trim the connected segment to avoid overlap
                  if (index === connectedAsset!.segmentIndex) {
                    const connectionPos = connectedAsset!.connectionPosition;
                    const connectionPoint = connectedAsset!.connectionPoint;

                    // If connecting to the start of the segment, trim from the start
                    if (connectionPoint === 'start') {
                      return {
                        start: connectionPos, // Trim to connection point
                        end: {
                          x: segment.end.x + asset.x,
                          y: segment.end.y + asset.y
                        }
                      };
                    } else {
                      // If connecting to the end of the segment, trim from the end
                      return {
                        start: {
                          x: segment.start.x + asset.x,
                          y: segment.start.y + asset.y
                        },
                        end: connectionPos // Trim to connection point
                      };
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

                // Combine all segments
                const allSegments = [...existingSegments, ...state.currentWallSegments];

                // Remove duplicates and merge connected segments
                const mergedSegments: { start: { x: number; y: number }; end: { x: number; y: number } }[] = [];

                for (const segment of allSegments) {
                  // Check if this segment connects to any existing merged segment
                  let connected = false;

                  for (let i = 0; i < mergedSegments.length; i++) {
                    const merged = mergedSegments[i];

                    // Check if segment connects to merged segment start
                    if (Math.abs(segment.end.x - merged.start.x) < 1 &&
                      Math.abs(segment.end.y - merged.start.y) < 1) {
                      mergedSegments[i] = { start: segment.start, end: merged.end };
                      connected = true;
                      break;
                    }

                    // Check if segment connects to merged segment end
                    if (Math.abs(segment.start.x - merged.end.x) < 1 &&
                      Math.abs(segment.start.y - merged.end.y) < 1) {
                      mergedSegments[i] = { start: merged.start, end: segment.end };
                      connected = true;
                      break;
                    }
                  }

                  if (!connected) {
                    mergedSegments.push(segment);
                  }
                }

                // Calculate new center point for the merged wall
                let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
                mergedSegments.forEach(segment => {
                  minX = Math.min(minX, segment.start.x, segment.end.x);
                  minY = Math.min(minY, segment.start.y, segment.end.y);
                  maxX = Math.max(maxX, segment.start.x, segment.end.x);
                  maxY = Math.max(maxY, segment.start.y, segment.end.y);
                });

                const newCenterX = (minX + maxX) / 2;
                const newCenterY = (minY + maxY) / 2;

                // Convert merged segments back to relative coordinates
                const relativeSegments = mergedSegments.map(segment => ({
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
                  wallSegments: relativeSegments
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
              currentWallTempEnd: null
            }));
          } else {
            // Create new wall asset (existing logic)
            let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

            state.currentWallSegments.forEach(segment => {
              minX = Math.min(minX, segment.start.x, segment.end.x);
              minY = Math.min(minY, segment.start.y, segment.end.y);
              maxX = Math.max(maxX, segment.start.x, segment.end.x);
              maxY = Math.max(maxY, segment.start.y, segment.end.y);
            });

            const centerX = (minX + maxX) / 2;
            const centerY = (minY + maxY) / 2;

            // Keep segments in absolute coordinates (like temporary preview)
            // This ensures the wall appears at the same size as during drawing
            // Convert wall segments to relative coordinates
            const relativeSegments = state.currentWallSegments.map(segment => ({
              start: {
                x: segment.start.x - centerX,
                y: segment.start.y - centerY
              },
              end: {
                x: segment.end.x - centerX,
                y: segment.end.y - centerY
              }
            }));

            const wallAsset: AssetInstance = {
              id: `wall-segments-${Date.now()}`,
              type: "wall-segments",
              x: centerX,
              y: centerY,
              scale: 2, // Default scale of 2 for proper wall size
              rotation: 0,
              wallSegments: relativeSegments, // Store relative coordinates
              wallThickness: 1, // Default wall thickness of 1
              wallGap: 8,
              lineColor: "#000000",
              backgroundColor: "transparent"
            };

            set((state) => ({
              assets: [...state.assets, wallAsset],
              selectedAssetId: wallAsset.id,
              hasUnsavedChanges: true,
              wallDrawingMode: false,
              currentWallSegments: [],
              currentWallStart: null,
              currentWallTempEnd: null
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

        const newAsset: AssetInstance = {
          ...state.clipboard,
          id: `${state.clipboard.type}-${Date.now()}`,
          x: state.clipboard.x + offsetX,
          y: state.clipboard.y + offsetY,
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

