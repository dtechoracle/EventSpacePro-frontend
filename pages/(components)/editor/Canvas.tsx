"use client";

import { useEffect, useRef, useState } from "react";
import { useSceneStore } from "@/store/sceneStore";
import { ASSET_LIBRARY } from "@/lib/assets";
import { RotateCw, RotateCcw } from "lucide-react";

type CanvasProps = {
  workspaceZoom: number;
  mmToPx: number;
  canvasPos: { x: number; y: number };
  setCanvasPos: React.Dispatch<React.SetStateAction<{ x: number; y: number }>>;
};

export default function Canvas({ workspaceZoom, mmToPx, canvasPos, setCanvasPos }: CanvasProps) {
  const canvas = useSceneStore((s) => s.canvas);
  const assets = useSceneStore((s) => s.assets);
  const addAsset = useSceneStore((s) => s.addAsset);
  const addAssetObject = useSceneStore((s) => s.addAssetObject);
  const updateAsset = useSceneStore((s) => s.updateAsset);
  const selectedAssetId = useSceneStore((s) => s.selectedAssetId);
  const selectAsset = useSceneStore((s) => s.selectAsset);

  const canvasRef = useRef<HTMLDivElement | null>(null);
  const draggingAssetRef = useRef<string | null>(null);
  const isMovingCanvas = useRef(false);
  const lastCanvasPointer = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const isScalingAsset = useRef(false);
  const isAdjustingHeight = useRef(false);
  const initialScale = useRef(1);
  const initialHeight = useRef(1);
  const initialDistance = useRef(0);
  const scaleHandleType = useRef<'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | null>(null);
  const heightHandleType = useRef<'top' | 'bottom' | null>(null);

  const [rotation, setRotation] = useState<number>(0);
  const canvasPxW = (canvas?.width ?? 0) * mmToPx;
  const canvasPxH = (canvas?.height ?? 0) * mmToPx;

  const clientToCanvasMM = (clientX: number, clientY: number) => {
    if (!canvasRef.current || !canvas) return { x: 0, y: 0 };
    const rect = canvasRef.current.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dx = clientX - cx;
    const dy = clientY - cy;
    const theta = (-rotation * Math.PI) / 180;
    const ux = dx * Math.cos(theta) - dy * Math.sin(theta);
    const uy = dx * Math.sin(theta) + dy * Math.cos(theta);
    const halfWscreen = (canvasPxW * workspaceZoom) / 2;
    const halfHscreen = (canvasPxH * workspaceZoom) / 2;
    const xMm = (ux + halfWscreen) / (mmToPx * workspaceZoom);
    const yMm = (uy + halfHscreen) / (mmToPx * workspaceZoom);
    return { x: xMm, y: yMm };
  };

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (isScalingAsset.current && selectedAssetId && scaleHandleType.current) {
        const asset = assets.find((a) => a.id === selectedAssetId);
        if (asset) {
          const { x: mouseX, y: mouseY } = clientToCanvasMM(e.clientX, e.clientY);
          
          // Use distance from asset center to mouse position for stable scaling
          const assetCenterX = asset.x;
          const assetCenterY = asset.y;
          
          // Calculate current distance from asset center to mouse position
          const currentDistance = Math.sqrt(
            Math.pow(mouseX - assetCenterX, 2) + Math.pow(mouseY - assetCenterY, 2)
          );
          
          // Calculate scale based on distance ratio
          const scaleRatio = currentDistance / initialDistance.current;
          const newScale = Math.max(0.1, Math.min(5, initialScale.current * scaleRatio));
          
          updateAsset(selectedAssetId, { scale: newScale });
        }
        return;
      }

      if (isAdjustingHeight.current && selectedAssetId && heightHandleType.current) {
        const asset = assets.find((a) => a.id === selectedAssetId);
        if (asset) {
          const { x: mouseX, y: mouseY } = clientToCanvasMM(e.clientX, e.clientY);
          const assetCenterY = asset.y;
          
          // Calculate height adjustment based on mouse distance from center
          const heightDelta = Math.abs(mouseY - assetCenterY);
          const heightRatio = heightDelta / initialDistance.current;
          const newHeight = Math.max(10, Math.min(500, initialHeight.current * heightRatio));
          
          updateAsset(selectedAssetId, { height: newHeight });
        }
        return;
      }
      
      if (draggingAssetRef.current) {
        const { x, y } = clientToCanvasMM(e.clientX, e.clientY);
        updateAsset(draggingAssetRef.current, { x, y });
        return;
      }
      if (isMovingCanvas.current) {
        const dx = e.clientX - lastCanvasPointer.current.x;
        const dy = e.clientY - lastCanvasPointer.current.y;
        setCanvasPos((p) => ({ x: p.x + dx / workspaceZoom, y: p.y + dy / workspaceZoom }));
        lastCanvasPointer.current = { x: e.clientX, y: e.clientY };
      }
    };

    const onUp = () => {
      draggingAssetRef.current = null;
      isMovingCanvas.current = false;
      isScalingAsset.current = false;
      isAdjustingHeight.current = false;
      initialScale.current = 1;
      initialHeight.current = 1;
      initialDistance.current = 0;
      scaleHandleType.current = null;
      heightHandleType.current = null;
    };

    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
    return () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };
  }, [workspaceZoom, mmToPx, rotation, updateAsset, setCanvasPos, selectedAssetId, assets]);

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const type = e.dataTransfer.getData("assetType");
    if (!type || !canvasRef.current || !canvas) return;
    const { x, y } = clientToCanvasMM(e.clientX, e.clientY);
    addAsset(type, x, y);
  };

  if (!canvas) return null;

  const rotateCW = () => setRotation((r) => (r + 90) % 360);
  const rotateCCW = () => setRotation((r) => (r - 90 + 360) % 360);

  const onAssetMouseDown = (e: React.MouseEvent, assetId: string) => {
    e.stopPropagation();
    const asset = assets.find((a) => a.id === assetId);
    if (!asset) return;

    let draggingId = asset.id;

    if (e.ctrlKey || e.metaKey) {
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
    draggingAssetRef.current = draggingId;
  };

  const onScaleHandleMouseDown = (e: React.MouseEvent, assetId: string, handleType: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right') => {
    e.stopPropagation();
    const asset = assets.find((a) => a.id === assetId);
    if (!asset) return;

    const { x: mouseX, y: mouseY } = clientToCanvasMM(e.clientX, e.clientY);
    
    // Use distance from asset center to mouse position for stable scaling
    const assetCenterX = asset.x;
    const assetCenterY = asset.y;
    
    // Calculate initial distance from asset center to mouse position
    initialDistance.current = Math.sqrt(
      Math.pow(mouseX - assetCenterX, 2) + Math.pow(mouseY - assetCenterY, 2)
    );
    
    initialScale.current = asset.scale;
    scaleHandleType.current = handleType;
    isScalingAsset.current = true;
  };

  const onHeightHandleMouseDown = (e: React.MouseEvent, assetId: string, handleType: 'top' | 'bottom') => {
    e.stopPropagation();
    const asset = assets.find((a) => a.id === assetId);
    if (!asset) return;

    const { x: mouseX, y: mouseY } = clientToCanvasMM(e.clientX, e.clientY);
    const assetCenterY = asset.y;
    
    // Calculate initial distance from asset center to mouse position
    initialDistance.current = Math.abs(mouseY - assetCenterY);
    
    initialHeight.current = asset.height ?? 50;
    heightHandleType.current = handleType;
    isAdjustingHeight.current = true;
  };

  const getAssetCornerPosition = (asset: any, handleType: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right') => {
    if (asset.type === "square" || asset.type === "circle") {
      const width = (asset.width ?? 50) * asset.scale;
      const height = (asset.height ?? 50) * asset.scale;
      
      switch (handleType) {
        case 'top-left':
          return { x: asset.x - width / 2, y: asset.y - height / 2 };
        case 'top-right':
          return { x: asset.x + width / 2, y: asset.y - height / 2 };
        case 'bottom-left':
          return { x: asset.x - width / 2, y: asset.y + height / 2 };
        case 'bottom-right':
          return { x: asset.x + width / 2, y: asset.y + height / 2 };
      }
    } else if (asset.type === "line") {
      const width = (asset.width ?? 100) * asset.scale;
      const height = (asset.strokeWidth ?? 2) * asset.scale;
      
      switch (handleType) {
        case 'top-left':
          return { x: asset.x - width / 2, y: asset.y - height / 2 };
        case 'top-right':
          return { x: asset.x + width / 2, y: asset.y - height / 2 };
        case 'bottom-left':
          return { x: asset.x - width / 2, y: asset.y + height / 2 };
        case 'bottom-right':
          return { x: asset.x + width / 2, y: asset.y + height / 2 };
      }
    } else {
      // For icons, use a fixed size reference
      const iconSize = 24 * asset.scale;
      switch (handleType) {
        case 'top-left':
          return { x: asset.x - iconSize / 2, y: asset.y - iconSize / 2 };
        case 'top-right':
          return { x: asset.x + iconSize / 2, y: asset.y - iconSize / 2 };
        case 'bottom-left':
          return { x: asset.x - iconSize / 2, y: asset.y + iconSize / 2 };
        case 'bottom-right':
          return { x: asset.x + iconSize / 2, y: asset.y + iconSize / 2 };
      }
    }
    return { x: asset.x, y: asset.y };
  };

  const renderAssetHandles = (asset: any, leftPx: number, topPx: number) => {
    const handleSize = 12;
    
    // Get corner positions in MM coordinates
    const topLeft = getAssetCornerPosition(asset, 'top-left');
    const topRight = getAssetCornerPosition(asset, 'top-right');
    const bottomLeft = getAssetCornerPosition(asset, 'bottom-left');
    const bottomRight = getAssetCornerPosition(asset, 'bottom-right');
    
    // Convert to pixel coordinates
    const topLeftPx = { x: topLeft.x * mmToPx, y: topLeft.y * mmToPx };
    const topRightPx = { x: topRight.x * mmToPx, y: topRight.y * mmToPx };
    const bottomLeftPx = { x: bottomLeft.x * mmToPx, y: bottomLeft.y * mmToPx };
    const bottomRightPx = { x: bottomRight.x * mmToPx, y: bottomRight.y * mmToPx };

    if (asset.type === "square" || asset.type === "circle") {
      const width = (asset.width ?? 50) * asset.scale;
      const height = (asset.height ?? 50) * asset.scale;
      
      return (
        <>
          {/* Corner scaling handles */}
          <div
            onMouseDown={(e) => onScaleHandleMouseDown(e, asset.id, 'top-left')}
            style={{
              position: "absolute",
              left: topLeftPx.x,
              top: topLeftPx.y,
              width: handleSize,
              height: handleSize,
              backgroundColor: "#3B82F6",
              border: "2px solid white",
              borderRadius: "2px",
              cursor: "nw-resize",
              zIndex: 10,
            }}
            className="hover:bg-blue-600 transition-colors"
            title="Scale"
          />
          <div
            onMouseDown={(e) => onScaleHandleMouseDown(e, asset.id, 'top-right')}
            style={{
              position: "absolute",
              left: topRightPx.x - handleSize,
              top: topRightPx.y,
              width: handleSize,
              height: handleSize,
              backgroundColor: "#3B82F6",
              border: "2px solid white",
              borderRadius: "2px",
              cursor: "ne-resize",
              zIndex: 10,
            }}
            className="hover:bg-blue-600 transition-colors"
            title="Scale"
          />
          <div
            onMouseDown={(e) => onScaleHandleMouseDown(e, asset.id, 'bottom-left')}
            style={{
              position: "absolute",
              left: bottomLeftPx.x,
              top: bottomLeftPx.y - handleSize,
              width: handleSize,
              height: handleSize,
              backgroundColor: "#3B82F6",
              border: "2px solid white",
              borderRadius: "2px",
              cursor: "sw-resize",
              zIndex: 10,
            }}
            className="hover:bg-blue-600 transition-colors"
            title="Scale"
          />
          <div
            onMouseDown={(e) => onScaleHandleMouseDown(e, asset.id, 'bottom-right')}
            style={{
              position: "absolute",
              left: bottomRightPx.x - handleSize,
              top: bottomRightPx.y - handleSize,
              width: handleSize,
              height: handleSize,
              backgroundColor: "#3B82F6",
              border: "2px solid white",
              borderRadius: "2px",
              cursor: "se-resize",
              zIndex: 10,
            }}
            className="hover:bg-blue-600 transition-colors"
            title="Scale"
          />
          
          {/* Height adjustment handles */}
          <div
            onMouseDown={(e) => onHeightHandleMouseDown(e, asset.id, 'top')}
            style={{
              position: "absolute",
              left: leftPx - 4,
              top: topLeftPx.y,
              width: 8,
              height: handleSize,
              backgroundColor: "#10B981",
              border: "2px solid white",
              borderRadius: "2px",
              cursor: "ns-resize",
              zIndex: 10,
            }}
            className="hover:bg-green-600 transition-colors"
            title="Adjust height"
          />
          <div
            onMouseDown={(e) => onHeightHandleMouseDown(e, asset.id, 'bottom')}
            style={{
              position: "absolute",
              left: leftPx - 4,
              top: bottomLeftPx.y - handleSize,
              width: 8,
              height: handleSize,
              backgroundColor: "#10B981",
              border: "2px solid white",
              borderRadius: "2px",
              cursor: "ns-resize",
              zIndex: 10,
            }}
            className="hover:bg-green-600 transition-colors"
            title="Adjust height"
          />
        </>
      );
    }

    if (asset.type === "line") {
      return (
        <>
          {/* Corner scaling handles for line */}
          <div
            onMouseDown={(e) => onScaleHandleMouseDown(e, asset.id, 'top-left')}
            style={{
              position: "absolute",
              left: topLeftPx.x,
              top: topLeftPx.y,
              width: handleSize,
              height: handleSize,
              backgroundColor: "#3B82F6",
              border: "2px solid white",
              borderRadius: "2px",
              cursor: "nw-resize",
              zIndex: 10,
            }}
            className="hover:bg-blue-600 transition-colors"
            title="Scale"
          />
          <div
            onMouseDown={(e) => onScaleHandleMouseDown(e, asset.id, 'top-right')}
            style={{
              position: "absolute",
              left: topRightPx.x - handleSize,
              top: topRightPx.y,
              width: handleSize,
              height: handleSize,
              backgroundColor: "#3B82F6",
              border: "2px solid white",
              borderRadius: "2px",
              cursor: "ne-resize",
              zIndex: 10,
            }}
            className="hover:bg-blue-600 transition-colors"
            title="Scale"
          />
          <div
            onMouseDown={(e) => onScaleHandleMouseDown(e, asset.id, 'bottom-left')}
            style={{
              position: "absolute",
              left: bottomLeftPx.x,
              top: bottomLeftPx.y - handleSize,
              width: handleSize,
              height: handleSize,
              backgroundColor: "#3B82F6",
              border: "2px solid white",
              borderRadius: "2px",
              cursor: "sw-resize",
              zIndex: 10,
            }}
            className="hover:bg-blue-600 transition-colors"
            title="Scale"
          />
          <div
            onMouseDown={(e) => onScaleHandleMouseDown(e, asset.id, 'bottom-right')}
            style={{
              position: "absolute",
              left: bottomRightPx.x - handleSize,
              top: bottomRightPx.y - handleSize,
              width: handleSize,
              height: handleSize,
              backgroundColor: "#3B82F6",
              border: "2px solid white",
              borderRadius: "2px",
              cursor: "se-resize",
              zIndex: 10,
            }}
            className="hover:bg-blue-600 transition-colors"
            title="Scale"
          />
        </>
      );
    }

    // For icons, only show corner scaling handles
    return (
      <>
        <div
          onMouseDown={(e) => onScaleHandleMouseDown(e, asset.id, 'top-left')}
          style={{
            position: "absolute",
            left: topLeftPx.x,
            top: topLeftPx.y,
            width: handleSize,
            height: handleSize,
            backgroundColor: "#3B82F6",
            border: "2px solid white",
            borderRadius: "2px",
            cursor: "nw-resize",
            zIndex: 10,
          }}
          className="hover:bg-blue-600 transition-colors"
          title="Scale"
        />
        <div
          onMouseDown={(e) => onScaleHandleMouseDown(e, asset.id, 'top-right')}
          style={{
            position: "absolute",
            left: topRightPx.x - handleSize,
            top: topRightPx.y,
            width: handleSize,
            height: handleSize,
            backgroundColor: "#3B82F6",
            border: "2px solid white",
            borderRadius: "2px",
            cursor: "ne-resize",
            zIndex: 10,
          }}
          className="hover:bg-blue-600 transition-colors"
          title="Scale"
        />
        <div
          onMouseDown={(e) => onScaleHandleMouseDown(e, asset.id, 'bottom-left')}
          style={{
            position: "absolute",
            left: bottomLeftPx.x,
            top: bottomLeftPx.y - handleSize,
            width: handleSize,
            height: handleSize,
            backgroundColor: "#3B82F6",
            border: "2px solid white",
            borderRadius: "2px",
            cursor: "sw-resize",
            zIndex: 10,
          }}
          className="hover:bg-blue-600 transition-colors"
          title="Scale"
        />
        <div
          onMouseDown={(e) => onScaleHandleMouseDown(e, asset.id, 'bottom-right')}
          style={{
            position: "absolute",
            left: bottomRightPx.x - handleSize,
            top: bottomRightPx.y - handleSize,
            width: handleSize,
            height: handleSize,
            backgroundColor: "#3B82F6",
            border: "2px solid white",
            borderRadius: "2px",
            cursor: "se-resize",
            zIndex: 10,
          }}
          className="hover:bg-blue-600 transition-colors"
          title="Scale"
        />
      </>
    );
  };

  return (
    <div
      ref={canvasRef}
      className="relative bg-white border shadow-md"
      style={{ width: canvasPxW, height: canvasPxH, transform: `rotate(${rotation}deg)`, transformOrigin: "center center" }}
      onDragOver={(e) => e.preventDefault()}
      onDrop={handleDrop}
      onMouseDown={(e) => {
        if (e.button !== 0) return;
        if (e.target === canvasRef.current) {
          selectAsset(null);
          e.stopPropagation();
          isMovingCanvas.current = true;
          lastCanvasPointer.current = { x: e.clientX, y: e.clientY };
        }
      }}
    >
      {/* Rotate Buttons */}
      {selectedAssetId === null && (
        <div className="absolute -top-10 left-1/2 -translate-x-1/2 flex gap-2 z-10 pointer-events-auto">
          <button onClick={(ev) => { ev.stopPropagation(); rotateCCW(); }} className="p-2 bg-gray-200 rounded-full shadow hover:bg-gray-300" title="Rotate CCW"><RotateCcw size={16} /></button>
          <button onClick={(ev) => { ev.stopPropagation(); rotateCW(); }} className="p-2 bg-gray-200 rounded-full shadow hover:bg-gray-300" title="Rotate CW"><RotateCw size={16} /></button>
        </div>
      )}

      {/* Render Assets */}
      {assets.map((asset) => {
        const def = ASSET_LIBRARY.find((a) => a.id === asset.type);
        const isSelected = asset.id === selectedAssetId;
        const leftPx = asset.x * mmToPx;
        const topPx = asset.y * mmToPx;
        const totalRotation = asset.rotation;

        if (asset.type === "square" || asset.type === "circle") {
          return (
            <div key={asset.id} className="relative">
              <div
                onMouseDown={(e) => onAssetMouseDown(e, asset.id)}
                style={{
                  position: "absolute",
                  left: leftPx,
                  top: topPx,
                  width: (asset.width ?? 50) * asset.scale,
                  height: (asset.height ?? 50) * asset.scale,
                  backgroundColor: asset.fillColor,
                  borderRadius: asset.type === "circle" ? "50%" : "0%",
                  transform: `translate(-50%, -50%) rotate(${totalRotation}deg)`,
                  cursor: "move",
                }}
                className={isSelected ? "ring-2 ring-blue-500" : ""}
              />
              
              {/* Handles */}
              {isSelected && renderAssetHandles(asset, leftPx, topPx)}
            </div>
          );
        }

        if (asset.type === "line") {
          return (
            <div key={asset.id} className="relative">
              <div
                onMouseDown={(e) => onAssetMouseDown(e, asset.id)}
                style={{
                  position: "absolute",
                  left: leftPx,
                  top: topPx,
                  width: (asset.width ?? 100) * asset.scale,
                  height: (asset.strokeWidth ?? 2) * asset.scale,
                  backgroundColor: asset.strokeColor,
                  transform: `translate(-50%, -50%) rotate(${totalRotation}deg)`,
                  cursor: "move",
                }}
                className={isSelected ? "ring-2 ring-blue-500" : ""}
              />
              
              {/* Handles */}
              {isSelected && renderAssetHandles(asset, leftPx, topPx)}
            </div>
          );
        }

        if (!def) return null;
        const Icon = def.icon;
        return (
          <div key={asset.id} className="relative">
            <div
              onMouseDown={(e) => onAssetMouseDown(e, asset.id)}
              style={{
                position: "absolute",
                left: leftPx,
                top: topPx,
                transform: `translate(-50%, -50%) rotate(${totalRotation}deg) scale(${asset.scale})`,
              }}
              className={isSelected ? "ring-2 ring-blue-500 bg-blue-50 p-1 rounded" : "text-[var(--accent)]"}
            >
              <Icon size={24} />
            </div>
            
            {/* Handles */}
            {isSelected && renderAssetHandles(asset, leftPx, topPx)}
          </div>
        );
      })}

      <span className="absolute bottom-2 right-2 text-xs text-gray-400 pointer-events-none">
        {canvas.size} ({canvas.width}×{canvas.height} mm)
      </span>
    </div>
  );
}

