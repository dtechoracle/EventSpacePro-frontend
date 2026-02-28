// editorStore.ts - Manages viewport and interaction state
import { create } from "zustand";
import { persist } from "zustand/middleware";

export type Tool =
  | 'select'
  | 'wall'
  | 'shape-rectangle'
  | 'shape-ellipse'
  | 'shape-line'
  | 'shape-arrow'
  | 'shape-polygon'
  | 'arch'
  | 'freehand'
  | 'asset'
  | 'dimension'
  | 'label-arrow'
  | 'text-annotation'
  | 'trim'
  | 'pan';

export type DimensionType = 'linear' | 'aligned' | 'angular' | 'radial';

export type EditorState = {
  // Viewport state
  zoom: number;
  panX: number;
  panY: number;

  // Canvas state
  canvasOffset: { left: number; top: number };

  // Tool state
  activeTool: Tool;

  // Selection state
  selectedIds: string[];
  hoveredId: string | null;
  selectedEdgeId: string | null; // For selecting individual wall edges

  // Grid state
  showGrid: boolean;
  gridSize: number;
  snapToGrid: boolean;
  snapToObjects: boolean;

  // Interaction state
  isDragging: boolean;
  isDrawing: boolean;
  isPanning: boolean;

  // Text editing state
  editingTextId: string | null;
  setEditingTextId: (id: string | null) => void;

  // Dimension Tool State
  dimensionType: DimensionType;
  setDimensionType: (type: DimensionType) => void;

  // Arc Tool State
  archWaveMode: boolean;
  toggleArchWaveMode: () => void;

  // Methods
  setZoom: (zoom: number) => void;
  zoomIn: () => void;
  zoomOut: () => void;
  resetZoom: () => void;

  setPan: (x: number, y: number) => void;
  panBy: (dx: number, dy: number) => void;
  resetPan: () => void;

  setCanvasOffset: (offset: { left: number; top: number }) => void;

  setActiveTool: (tool: Tool) => void;

  setSelectedIds: (ids: string[]) => void;
  addToSelection: (id: string) => void;
  removeFromSelection: (id: string) => void;
  clearSelection: () => void;
  toggleSelection: (id: string) => void;

  setHoveredId: (id: string | null) => void;
  setSelectedEdgeId: (id: string | null) => void;

  // Snap Mode (Interactive snap to object)
  isSnapMode: boolean;
  snapSourceId: string | null;
  snapAnchor: string | null; // Which anchor to snap (e.g., 'top-left', 'center')
  setSnapMode: (active: boolean, sourceId?: string | null, anchor?: string | null) => void;

  toggleGrid: () => void;
  setGridSize: (size: number) => void;
  toggleSnapToGrid: () => void;
  toggleSnapToObjects: () => void;

  setDragging: (dragging: boolean) => void;
  setDrawing: (drawing: boolean) => void;
  setPanning: (panning: boolean) => void;

  // Utility methods
  screenToWorld: (screenX: number, screenY: number) => { x: number; y: number };
  worldToScreen: (worldX: number, worldY: number) => { x: number; y: number };

  // Placement Mode
  placementMode: {
    active: boolean;
    data: {
      walls: any[];
      assets: any[];
      shapes: any[];
      textAnnotations?: any[];
      width?: number; // Optional bounding width
      height?: number; // Optional bounding height
    } | null;
  };
  setPlacementMode: (mode: { active: boolean; data: any | null }) => void;
};

export const useEditorStore = create<EditorState>()(
  persist(
    (set, get) => ({
      // Initial state
      zoom: 1,
      panX: 0,
      panY: 0,

      canvasOffset: { left: 0, top: 0 },

      activeTool: 'select',

      selectedIds: [],
      hoveredId: null,
      selectedEdgeId: null,

      showGrid: true,
      gridSize: 1000, // Default 1m grid
      snapToGrid: false,
      snapToObjects: true,

      isDragging: false,
      isDrawing: false,
      isPanning: false,

      // Text editing state
      editingTextId: null,
      setEditingTextId: (id) => set({ editingTextId: id }),

      // Dimension Tool
      dimensionType: 'linear',
      setDimensionType: (type) => set({ dimensionType: type }),

      // Arc Wave Mode
      archWaveMode: false,
      toggleArchWaveMode: () => set((state) => ({ archWaveMode: !state.archWaveMode })),

      // Zoom methods
      // Zoom methods - "Infinity" zoom (very wide range)
      setZoom: (zoom) => set({ zoom: Math.max(0.000001, Math.min(1000000, zoom)) }),

      zoomIn: () => {
        const state = get();
        set({ zoom: Math.min(1000000, state.zoom * 1.2) });
      },

      zoomOut: () => {
        const state = get();
        set({ zoom: Math.max(0.000001, state.zoom / 1.2) });
      },

      resetZoom: () => set({ zoom: 1 }),

      // Pan methods
      setPan: (x, y) => set({ panX: x, panY: y }),

      panBy: (dx, dy) => {
        const state = get();
        set({ panX: state.panX + dx, panY: state.panY + dy });
      },

      resetPan: () => set({ panX: 0, panY: 0 }),

      setCanvasOffset: (offset) => set({ canvasOffset: offset }),

      // Tool methods
      setActiveTool: (tool) => set({ activeTool: tool }),

      // Selection methods
      setSelectedIds: (ids) => set({ selectedIds: ids }),

      addToSelection: (id) => {
        const state = get();
        if (!state.selectedIds.includes(id)) {
          set({ selectedIds: [...state.selectedIds, id] });
        }
      },

      removeFromSelection: (id) => {
        const state = get();
        set({ selectedIds: state.selectedIds.filter(sid => sid !== id) });
      },

      clearSelection: () => set({ selectedIds: [] }),

      toggleSelection: (id) => {
        const state = get();
        if (state.selectedIds.includes(id)) {
          set({ selectedIds: state.selectedIds.filter(sid => sid !== id) });
        } else {
          set({ selectedIds: [...state.selectedIds, id] });
        }
      },

      setHoveredId: (id) => set({ hoveredId: id }),

      setSelectedEdgeId: (id) => set({ selectedEdgeId: id }),

      // Snap Mode
      isSnapMode: false,
      snapSourceId: null,
      snapAnchor: null,
      setSnapMode: (active, sourceId = null, anchor = null) => set({
        isSnapMode: active,
        snapSourceId: active ? sourceId : null,
        snapAnchor: active ? anchor : null
      }),

      // Grid methods
      toggleGrid: () => set((state) => ({ showGrid: !state.showGrid })),

      setGridSize: (size) => set({ gridSize: size }),

      toggleSnapToGrid: () => set((state) => ({ snapToGrid: !state.snapToGrid })),

      toggleSnapToObjects: () => set((state) => ({ snapToObjects: !state.snapToObjects })),

      // Interaction state methods
      setDragging: (dragging) => set({ isDragging: dragging }),

      setDrawing: (drawing) => set({ isDrawing: drawing }),

      setPanning: (panning) => set({ isPanning: panning }),

      // Utility methods
      screenToWorld: (screenX, screenY) => {
        const state = get();
        // Adjust for canvas offset
        const localX = screenX - state.canvasOffset.left;
        const localY = screenY - state.canvasOffset.top;
        return {
          x: (localX - state.panX) / state.zoom,
          y: (localY - state.panY) / state.zoom,
        };
      },

      worldToScreen: (worldX, worldY) => {
        const state = get();
        const localX = worldX * state.zoom + state.panX;
        const localY = worldY * state.zoom + state.panY;
        return {
          x: localX + state.canvasOffset.left,
          y: localY + state.canvasOffset.top,
        };
      },

      // Placement Mode
      placementMode: { active: false, data: null },
      setPlacementMode: (mode) => set({ placementMode: mode }),

    }),
    {
      name: 'editor-storage',
      partialize: (state) => ({
        zoom: state.zoom,
        panX: state.panX,
        panY: state.panY,
        showGrid: state.showGrid,
        gridSize: state.gridSize,
        snapToGrid: state.snapToGrid,
        dimensionType: state.dimensionType,
        // Don't persist canvasOffset
      }),
    }
  )
);
