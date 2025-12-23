import { useState, useCallback } from "react";
import { useSceneStore, AssetInstance } from "@/store/sceneStore";

interface UseAssetHandlersProps {
  clientToCanvasMM: (
    clientX: number,
    clientY: number
  ) => { x: number; y: number };
  mouseRefs: {
    draggingAssetRef: React.MutableRefObject<string | null>;
    isScalingAsset: React.MutableRefObject<boolean>;
    isAdjustingHeight: React.MutableRefObject<boolean>;
    isRotatingAsset: React.MutableRefObject<boolean>;
    initialScale: React.MutableRefObject<number>;
    initialHeight: React.MutableRefObject<number>;
    initialDistance: React.MutableRefObject<number>;
    initialRotation: React.MutableRefObject<number>;
    initialMouseAngle: React.MutableRefObject<number>;
    scaleHandleType: React.MutableRefObject<
      "top-left" | "top-right" | "bottom-left" | "bottom-right" | null
    >;
    heightHandleType: React.MutableRefObject<"top" | "bottom" | null>;
    draggingOffset: React.MutableRefObject<{ x: number; y: number }>;
    draggingAssetStart: React.MutableRefObject<{ x: number; y: number }>;
  };
}

export function useAssetHandlers({
  clientToCanvasMM,
  mouseRefs,
}: UseAssetHandlersProps) {
  const assets = useSceneStore((s) => s.assets);
  const selectedAssetId = useSceneStore((s) => s.selectedAssetId);
  const addAssetObject = useSceneStore((s) => s.addAssetObject);
  const selectAsset = useSceneStore((s) => s.selectAsset);
  const updateAsset = useSceneStore((s) => s.updateAsset);
  const setDraggingAsset = useSceneStore((s) => (s as any).setDraggingAsset);

  const [editingTextId, setEditingTextId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState<string>("");

  const onAssetMouseDown = useCallback(
    (e: React.MouseEvent, assetId: string) => {
      // If in snap-to-anchor mode, don't handle the click here - let the canvas handler deal with it
      const snapToAnchorMode = useSceneStore.getState().snapToAnchorMode;
      if (snapToAnchorMode) {
        // Don't stop propagation or prevent default - let the canvas handler process the click
        // The canvas handler will use clientToCanvasMM to get the position
        console.log('Asset click in snap mode - letting canvas handle it. Asset:', assetId);
        return;
      }
      
      e.stopPropagation();
      const asset = assets.find((a) => a.id === assetId);
      if (!asset) return;

      let draggingId = asset.id;

      // Duplicate only when Alt/Option is held, not Ctrl/Cmd (to avoid accidental duplication during move)
      if (e.altKey) {
        const newAsset = {
          ...asset,
          id: crypto.randomUUID(),
          x: asset.x + 5,
          y: asset.y + 5,
        };
        addAssetObject(newAsset);
        draggingId = newAsset.id;
      }

      selectAsset(draggingId);
      mouseRefs.draggingAssetRef.current = draggingId;
      if (setDraggingAsset) setDraggingAsset(true);
      // Record offset as asset - mouse; during drag, newPos = mouse + offset
      const { x: mouseX, y: mouseY } = clientToCanvasMM(
        (e as any).clientX,
        (e as any).clientY
      );
      mouseRefs.draggingOffset.current = {
        x: asset.x - mouseX,
        y: asset.y - mouseY,
      };
      mouseRefs.draggingAssetStart.current = { x: asset.x, y: asset.y };
    },
    [assets, addAssetObject, selectAsset, mouseRefs, clientToCanvasMM]
  );

  const onTextDoubleClick = useCallback(
    (e: React.MouseEvent, assetId: string) => {
      e.stopPropagation();
      const asset = assets.find((a) => a.id === assetId);
      if (!asset || asset.type !== "text") return;

      setEditingTextId(assetId);
      setEditingText(asset.text ?? "");
    },
    [assets]
  );

  const onTextEditKeyDown = useCallback(
    (e: React.KeyboardEvent, assetId: string) => {
      if (e.key === "Enter" || e.key === "Escape") {
        e.preventDefault();
        if (e.key === "Enter") {
          updateAsset(assetId, { text: editingText });
        }
        setEditingTextId(null);
        setEditingText("");
      }
    },
    [editingText, updateAsset]
  );

  const onTextEditBlur = useCallback(
    (assetId: string) => {
      updateAsset(assetId, { text: editingText });
      setEditingTextId(null);
      setEditingText("");
    },
    [editingText, updateAsset]
  );

  const onScaleHandleMouseDown = useCallback(
    (
      e: React.MouseEvent,
      assetId: string,
      handleType: "top-left" | "top-right" | "bottom-left" | "bottom-right"
    ) => {
      e.stopPropagation();
      const asset = assets.find((a) => a.id === assetId);
      if (!asset) return;

      const { x: mouseX, y: mouseY } = clientToCanvasMM(e.clientX, e.clientY);

      // Use distance from asset center to mouse position for stable scaling
      const assetCenterX = asset.x;
      const assetCenterY = asset.y;

      // Calculate initial distance from asset center to mouse position
      mouseRefs.initialDistance.current = Math.sqrt(
        Math.pow(mouseX - assetCenterX, 2) + Math.pow(mouseY - assetCenterY, 2)
      );

      mouseRefs.initialScale.current = asset.scale;
      mouseRefs.scaleHandleType.current = handleType;
      mouseRefs.isScalingAsset.current = true;
    },
    [assets, clientToCanvasMM, mouseRefs]
  );

  const onHeightHandleMouseDown = useCallback(
    (e: React.MouseEvent, assetId: string, handleType: "top" | "bottom") => {
      e.stopPropagation();
      const asset = assets.find((a) => a.id === assetId);
      if (!asset) return;

      const { x: mouseX, y: mouseY } = clientToCanvasMM(e.clientX, e.clientY);
      const assetCenterY = asset.y;

      // Calculate initial distance from asset center
      mouseRefs.initialDistance.current = Math.abs(mouseY - assetCenterY);

      mouseRefs.initialHeight.current = asset.height ?? 50;
      mouseRefs.heightHandleType.current = handleType;
      mouseRefs.isAdjustingHeight.current = true;
    },
    [assets, clientToCanvasMM, mouseRefs]
  );

  const onRotationHandleMouseDown = useCallback(
    (e: React.MouseEvent, assetId: string) => {
      e.stopPropagation();
      const asset = assets.find((a) => a.id === assetId);
      if (!asset) return;

      const { x: mouseX, y: mouseY } = clientToCanvasMM(e.clientX, e.clientY);

      // Calculate initial angle from asset center to mouse position
      const deltaX = mouseX - asset.x;
      const deltaY = mouseY - asset.y;
      mouseRefs.initialMouseAngle.current =
        Math.atan2(deltaY, deltaX) * (180 / Math.PI);

      mouseRefs.initialRotation.current = asset.rotation;
      mouseRefs.isRotatingAsset.current = true;
    },
    [assets, clientToCanvasMM, mouseRefs]
  );

  return {
    editingTextId,
    editingText,
    setEditingText,
    onAssetMouseDown,
    onTextDoubleClick,
    onTextEditKeyDown,
    onTextEditBlur,
    onScaleHandleMouseDown,
    onHeightHandleMouseDown,
    onRotationHandleMouseDown,
  };
}
