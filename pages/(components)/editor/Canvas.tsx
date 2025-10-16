"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useSceneStore, AssetInstance, EventData } from "@/store/sceneStore";
import { PaperSize } from "@/lib/paperSizes";
import { PAPER_SIZES } from "@/lib/paperSizes";
import GridOverlay from "./GridOverlay";
import DrawingPath from "./DrawingPath";
import WallRendering from "./WallRendering";
import AssetRenderer from "./AssetRenderer";
import CanvasControls from "./CanvasControls";
import { useCanvasMouseHandlers } from "@/hooks/useCanvasMouseHandlers";
import { useCanvasKeyboardHandlers } from "@/hooks/useCanvasKeyboardHandlers";
import { useAssetHandlers } from "@/hooks/useAssetHandlers";
import { useDrawingLogic } from "@/hooks/useDrawingLogic";

// Type for API response that wraps EventData
type EventDataResponse = {
  data: EventData;
} | EventData;

type CanvasProps = {
  workspaceZoom: number;
  mmToPx: number;
  canvasPos: { x: number; y: number };
  setCanvasPos: React.Dispatch<React.SetStateAction<{ x: number; y: number }>>;
  canvas?: { size: string; width: number; height: number } | null;
  assets?: AssetInstance[];
  eventData?: EventDataResponse | null;
};

export default function Canvas({ workspaceZoom, mmToPx, canvasPos, setCanvasPos, canvas: propCanvas, assets: propAssets, eventData }: CanvasProps) {
  // Use store data for rendering (synced from props)
  const canvas = useSceneStore((s) => s.canvas);
  const assets = useSceneStore((s) => s.assets);
  const addAsset = useSceneStore((s) => s.addAsset);
  const addAssetObject = useSceneStore((s) => s.addAssetObject);
  const reset = useSceneStore((s) => s.reset);
  const markAsSaved = useSceneStore((s) => s.markAsSaved);
  const showGrid = useSceneStore((s) => s.showGrid);
  const isPenMode = useSceneStore((s) => s.isPenMode);
  const isWallMode = useSceneStore((s) => s.isWallMode);
  const isDrawing = useSceneStore((s) => s.isDrawing);
  const currentPath = useSceneStore((s) => s.currentPath);
  const tempPath = useSceneStore((s) => s.tempPath);
  const wallDrawingMode = useSceneStore((s) => s.wallDrawingMode);
  const currentWallSegments = useSceneStore((s) => s.currentWallSegments);
  const currentWallStart = useSceneStore((s) => s.currentWallStart);
  const currentWallTempEnd = useSceneStore((s) => s.currentWallTempEnd);
  const selectedAssetId = useSceneStore((s) => s.selectedAssetId);
  const selectAsset = useSceneStore((s) => s.selectAsset);
  const setPenMode = useSceneStore((s) => s.setPenMode);
  const setWallMode = useSceneStore((s) => s.setWallMode);
  const setIsDrawing = useSceneStore((s) => s.setIsDrawing);
  const setCurrentPath = useSceneStore((s) => s.setCurrentPath);
  const setTempPath = useSceneStore((s) => s.setTempPath);
  const startWallSegment = useSceneStore((s) => s.startWallSegment);

  // Sync props data to store when props change (only once per data change)
  const hasSyncedRef = useRef(false);
  const lastDataRef = useRef<string>('');
  
  useEffect(() => {
    if (propCanvas && propAssets) {
      // Create a unique identifier for this data set
      const dataId = JSON.stringify({ canvas: propCanvas, assets: propAssets });
      
      // Only sync if the data has actually changed and we haven't synced this data yet
      if (dataId !== lastDataRef.current) {
        
        // Reset store and populate with current props data
        reset();
        
        // Set canvas only if size is a known PaperSize (A1–A5)
        const isKnownSize = !!(propCanvas.size && (propCanvas.size as keyof typeof PAPER_SIZES) in PAPER_SIZES);
        if (isKnownSize) {
          const setCanvas = useSceneStore.getState().setCanvas;
          setCanvas(propCanvas.size as PaperSize);
        }
        
        // Add assets
        propAssets.forEach(asset => {
          addAssetObject(asset);
        });
        
        // Mark as saved since this is from the backend
        markAsSaved();
        
        // Update the refs
        lastDataRef.current = dataId;
        hasSyncedRef.current = true;
      }
    }
  }, [propCanvas, propAssets]);

  const canvasRef = useRef<HTMLDivElement | null>(null);
  const currentDrawingPath = useRef<{ x: number; y: number }[]>([]);
  const lastMousePosition = useRef({ x: 0, y: 0 });

  const [rotation, setRotation] = useState<number>(0);

  // Use store canvas when known; otherwise fall back to provided dimensions so we can still render an empty layout without paper
  const effectiveWidthMm = (canvas?.width ?? propCanvas?.width ?? 0);
  const effectiveHeightMm = (canvas?.height ?? propCanvas?.height ?? 0);
  const canvasPxW = effectiveWidthMm * mmToPx;
  const canvasPxH = effectiveHeightMm * mmToPx;

  // Create coordinate transformation function
  const clientToCanvasMM = useCallback((clientX: number, clientY: number) => {
    if (!canvasRef.current || !effectiveWidthMm || !effectiveHeightMm) return { x: 0, y: 0 };
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
  }, [effectiveWidthMm, effectiveHeightMm, canvasPxW, canvasPxH, workspaceZoom, mmToPx, rotation]);

  // Use custom hooks
  const { straightenPath } = useDrawingLogic();
  const mouseRefs = useCanvasMouseHandlers({
    workspaceZoom,
    mmToPx,
    canvasPos,
    setCanvasPos,
    canvas,
    clientToCanvasMM,
    straightenPath,
  });
  const { copiedAssetId } = useCanvasKeyboardHandlers();
  const assetHandlers = useAssetHandlers({
    clientToCanvasMM,
    mouseRefs,
  });

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const type = e.dataTransfer.getData("assetType");
    if (!type || !canvasRef.current || !canvas) return;
    const { x, y } = clientToCanvasMM(e.clientX, e.clientY);
    addAsset(type, x, y);
  };

  const rotateCW = () => setRotation((r) => (r + 90) % 360);
  const rotateCCW = () => setRotation((r) => (r - 90 + 360) % 360);

  return (
    <div
      ref={canvasRef}
      className={`relative ${canvas ? 'bg-white border shadow-md' : 'bg-transparent'} ${(isPenMode || isWallMode || wallDrawingMode) ? 'cursor-crosshair' : ''}`}
      style={{ width: canvasPxW, height: canvasPxH, transform: `rotate(${rotation}deg)`, transformOrigin: "center center" }}
      onDragOver={(e) => e.preventDefault()}
      onDrop={handleDrop}
      onMouseDown={(e) => {
        if (e.button !== 0) return;
        if (e.target === canvasRef.current) {
          if (isPenMode || isWallMode) {
            e.stopPropagation();
            const { x, y } = clientToCanvasMM(e.clientX, e.clientY);
            
            // Start drawing
            currentDrawingPath.current = [{ x, y }];
            setIsDrawing(true);
            setCurrentPath([{ x, y }]);
            setTempPath([{ x, y }]);
            console.log('Started drawing at:', { x, y });
            return; // Prevent canvas movement when in pen mode
          } else if (wallDrawingMode) {
            // Check if the click target is the canvas itself (not a child element like sidebar buttons)
            if (e.target !== canvasRef.current) {
              console.log('Click not on canvas element, ignoring wall drawing');
              return;
            }
            
            e.stopPropagation();
            const { x, y } = clientToCanvasMM(e.clientX, e.clientY);
            
            // Check if click is within canvas bounds
            if (canvas && (x < 0 || y < 0 || x > canvas.width || y > canvas.height)) {
              console.log('Click outside canvas bounds, ignoring');
              return; // Don't create wall segments outside canvas
            }
            
            if (!currentWallStart) {
              // Start new wall segment
              startWallSegment({ x, y });
              console.log('Started wall segment at:', { x, y });
            } else {
              // This will be handled by the mouse up event to commit the current segment
              console.log('Continuing wall segment at:', { x, y });
            }
            return; // Prevent canvas movement when in wall mode
          } else {
            selectAsset(null);
            e.stopPropagation();
            mouseRefs.isMovingCanvas.current = true;
            mouseRefs.lastCanvasPointer.current = { x: e.clientX, y: e.clientY };
          }
        }
      }}
    >
      {/* Grid Overlay */}
      <GridOverlay 
        showGrid={showGrid}
        canvasPxW={canvasPxW}
        canvasPxH={canvasPxH}
        mmToPx={mmToPx}
      />

      {/* Drawing Path */}
      <DrawingPath
        isDrawing={isDrawing}
        tempPath={tempPath}
        wallDrawingMode={wallDrawingMode}
        currentWallSegments={currentWallSegments}
        currentWallStart={currentWallStart}
        currentWallTempEnd={currentWallTempEnd}
        assets={assets}
        canvasPxW={canvasPxW}
        canvasPxH={canvasPxH}
        mmToPx={mmToPx}
        lastMousePosition={lastMousePosition.current}
        clientToCanvasMM={clientToCanvasMM}
      />

      {/* Canvas Controls */}
      <CanvasControls
        selectedAssetId={selectedAssetId}
        onRotateCW={rotateCW}
        onRotateCCW={rotateCCW}
        canvas={canvas}
      />

      {/* Render Assets */}
      {assets.map((asset) => {
        const isSelected = asset.id === selectedAssetId;
        const isCopied = asset.id === copiedAssetId;
        const leftPx = asset.x * mmToPx;
        const topPx = asset.y * mmToPx;
        const totalRotation = asset.rotation;

        return (
          <AssetRenderer
            key={asset.id}
            asset={asset}
            isSelected={isSelected}
            isCopied={isCopied}
            leftPx={leftPx}
            topPx={topPx}
            totalRotation={totalRotation}
            editingTextId={assetHandlers.editingTextId}
            editingText={assetHandlers.editingText}
            onAssetMouseDown={assetHandlers.onAssetMouseDown}
            onTextDoubleClick={assetHandlers.onTextDoubleClick}
            onTextEditKeyDown={assetHandlers.onTextEditKeyDown}
            onTextEditBlur={assetHandlers.onTextEditBlur}
            onTextEditChange={assetHandlers.setEditingText}
            onScaleHandleMouseDown={assetHandlers.onScaleHandleMouseDown}
            onRotationHandleMouseDown={assetHandlers.onRotationHandleMouseDown}
          />
        );
      })}
    </div>
  );
}