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

  // Extra shape properties
  width?: number; // for square/circle/line
  height?: number; // for square/circle
  strokeWidth?: number; // for line
  fillColor?: string; // for shapes
  strokeColor?: string; // for line
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
            ? { width: 50, height: 50, fillColor: "#93C5FD" }
            : type === "line"
              ? { width: 100, strokeWidth: 2, strokeColor: "#3B82F6" }
              : {};

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
        hasUnsavedChanges: false
      }),

      markAsSaved: () => set({ hasUnsavedChanges: false }),

      syncToEventData: () => {
        const state = get();
        // This method will be called with current event data from the component
        // Return just the assets for updating
        return state.assets;
      },
    }),
    { name: "scene-storage" }
  )
);

