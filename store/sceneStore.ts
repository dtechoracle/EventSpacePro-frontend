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

type SceneState = {
  canvas: {
    size: PaperSize;
    width: number;
    height: number;
  } | null;
  assets: AssetInstance[];
  selectedAssetId: string | null;

  // Methods
  setCanvas: (size: PaperSize) => void;
  addAsset: (type: string, x: number, y: number) => void;
  addAssetObject: (assetObj: AssetInstance) => void;
  updateAsset: (id: string, updates: Partial<AssetInstance>) => void;
  removeAsset: (id: string) => void;
  selectAsset: (id: string | null) => void;
  reset: () => void;
  hasHydrated: boolean;
};

export const useSceneStore = create<SceneState>()(
  persist(
    (set, get) => ({
      canvas: null,
      assets: [],
      selectedAssetId: null,
      hasHydrated: false,

      setCanvas: (size) => {
        const { width, height } = PAPER_SIZES[size];
        set({ canvas: { size, width, height }, assets: [], selectedAssetId: null });
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
        });
      },
      addAssetObject: (assetObj: AssetInstance) => {
        set((state) => ({
          assets: [...state.assets, assetObj],
          selectedAssetId: assetObj.id,
        }));
      },

      updateAsset: (id, updates) =>
        set((state) => ({
          assets: state.assets.map((a) =>
            a.id === id ? { ...a, ...updates } : a
          ),
        })),

      removeAsset: (id) =>
        set((state) => ({
          assets: state.assets.filter((a) => a.id !== id),
          selectedAssetId: state.selectedAssetId === id ? null : state.selectedAssetId,
        })),

      selectAsset: (id) => set({ selectedAssetId: id }),

      reset: () => set({ canvas: null, assets: [], selectedAssetId: null }),
    }),
    { name: "scene-storage" }
  )
);

