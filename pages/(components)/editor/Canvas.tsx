"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useSceneStore, AssetInstance } from "@/store/sceneStore";
import { PaperSize } from "@/lib/paperSizes";
import { PAPER_SIZES } from "@/lib/paperSizes";
import GridOverlay from "./GridOverlay";
import DrawingPath from "./DrawingPath";
import AssetRenderer from "./AssetRenderer";
import GroupRenderer from "./GroupRenderer";
import CanvasControls from "./CanvasControls";
import PatternIndicator from "./PatternIndicator";
import SelectionBox from "./SelectionBox";
import { useCanvasMouseHandlers } from "@/hooks/useCanvasMouseHandlers";
import { useCanvasKeyboardHandlers } from "@/hooks/useCanvasKeyboardHandlers";
import { useAssetHandlers } from "@/hooks/useAssetHandlers";
import { useDrawingLogic } from "@/hooks/useDrawingLogic";
import { motion } from "framer-motion";

// Type for API response that wraps EventData
// type EventDataResponse = {
//   data: EventData;
// } | EventData;

type CanvasProps = {
  workspaceZoom: number;
  mmToPx: number;
  canvasPos: { x: number; y: number };
  setCanvasPos: React.Dispatch<React.SetStateAction<{ x: number; y: number }>>;
  canvas?: { size: string; width: number; height: number } | null;
  assets?: AssetInstance[];
};

export default function Canvas({
  workspaceZoom,
  mmToPx,
  canvasPos,
  setCanvasPos,
  canvas: propCanvas,
  assets: propAssets,
}: CanvasProps) {
  // Use store data for rendering (synced from props)
  const canvas = useSceneStore((s) => s.canvas);
  const assets = useSceneStore((s) => s.assets);

  const addAsset = useSceneStore((s) => s.addAsset);
  const addAssetObject = useSceneStore((s) => s.addAssetObject);
  const reset = useSceneStore((s) => s.reset);
  const markAsSaved = useSceneStore((s) => s.markAsSaved);
  const showGrid = useSceneStore((s) => s.showGrid);
  const gridSize = useSceneStore((s) => s.gridSize);
  const isPenMode = useSceneStore((s) => s.isPenMode);
  const isWallMode = useSceneStore((s) => s.isWallMode);
  const wallType = useSceneStore((s) => s.wallType);
  const isDrawing = useSceneStore((s) => s.isDrawing);
  // const currentPath = useSceneStore((s) => s.currentPath);
  const tempPath = useSceneStore((s) => s.tempPath);
  const wallDrawingMode = useSceneStore((s) => s.wallDrawingMode);
  const currentWallSegments = useSceneStore((s) => s.currentWallSegments);
  const currentWallStart = useSceneStore((s) => s.currentWallStart);
  const currentWallTempEnd = useSceneStore((s) => s.currentWallTempEnd);
  const selectedAssetId = useSceneStore((s) => s.selectedAssetId);
  const chairSettings = useSceneStore((s) => s.chairSettings) || { numChairs: 8, radius: 80 };
  const selectAsset = useSceneStore((s) => s.selectAsset);
  const updateAsset = useSceneStore((s) => s.updateAsset);
  const clearSelection = useSceneStore((s) => s.clearSelection);
  // const setPenMode = useSceneStore((s) => s.setPenMode);
  // const setWallMode = useSceneStore((s) => s.setWallMode);
  const setIsDrawing = useSceneStore((s) => s.setIsDrawing);
  const setCurrentPath = useSceneStore((s) => s.setCurrentPath);
  const setTempPath = useSceneStore((s) => s.setTempPath);
  const shapeMode = useSceneStore((s) => s.shapeMode);
  const shapeStart = useSceneStore((s) => s.shapeStart);
  const shapeTempEnd = useSceneStore((s) => s.shapeTempEnd);
  const startShape = useSceneStore((s) => s.startShape);
  const finishShape = useSceneStore((s) => s.finishShape);
  const updateShapeTempEnd = useSceneStore((s) => s.updateShapeTempEnd);
  const startWallSegment = useSceneStore((s) => s.startWallSegment);
  const startRectangularSelection = useSceneStore(
    (s) => s.startRectangularSelection
  );
  const selectedAssetIds = useSceneStore((s) => s.selectedAssetIds);
  const isRectangularSelectionMode = useSceneStore(
    (s) => s.isRectangularSelectionMode
  );

  const rectangularSelectionStart = useSceneStore(
    (s) => s.rectangularSelectionStart
  );
  const rectangularSelectionEnd = useSceneStore(
    (s) => s.rectangularSelectionEnd
  );
  const startRectangularSelectionDrag = useSceneStore(
    (s) => s.startRectangularSelectionDrag
  );
  const updateRectangularSelectionDrag = useSceneStore(
    (s) => s.updateRectangularSelectionDrag
  );
  const finishRectangularSelectionDrag = useSceneStore(
    (s) => s.finishRectangularSelectionDrag
  );

  // Sync props data to store when props change (only once per data change)
  const hasSyncedRef = useRef(false);
  const lastDataRef = useRef<string>("");

  useEffect(() => {
    if (propCanvas && propAssets && propAssets.length > 0) {
      // Create a unique identifier for this data set
      const dataId = JSON.stringify({ canvas: propCanvas, assets: propAssets });

      // Only sync if the data has actually changed and we haven't synced this data yet
      if (dataId !== lastDataRef.current) {
        // Reset store and populate with current props data
        reset();

        // Set canvas only if size is a known PaperSize (A1–A5)
        const isKnownSize = !!(
          propCanvas.size &&
          (propCanvas.size as keyof typeof PAPER_SIZES) in PAPER_SIZES
        );
        if (isKnownSize) {
          const setCanvas = useSceneStore.getState().setCanvas;
          setCanvas(propCanvas.size as PaperSize);
        }

        // Add assets
        propAssets.forEach((asset) => {
          addAssetObject(asset);
        });

        // Mark as saved since this is from the backend
        markAsSaved();

        // Update the refs
        lastDataRef.current = dataId;
        hasSyncedRef.current = true;
      }
    }
  }, [propCanvas, propAssets, addAssetObject, markAsSaved, reset]);

  const canvasRef = useRef<HTMLDivElement | null>(null);
  const currentDrawingPath = useRef<{ x: number; y: number }[]>([]);
  const lastMousePosition = useRef({ x: 0, y: 0 });

  const [rotation, setRotation] = useState<number>(0);

  // Use store canvas when known; otherwise fall back to provided dimensions so we can still render an empty layout without paper
  const effectiveWidthMm = canvas?.width ?? propCanvas?.width ?? 0;
  const effectiveHeightMm = canvas?.height ?? propCanvas?.height ?? 0;
  const canvasPxW = effectiveWidthMm * mmToPx;
  const canvasPxH = effectiveHeightMm * mmToPx;

  // Create coordinate transformation function
  const clientToCanvasMM = useCallback(
    (clientX: number, clientY: number) => {
      if (!canvasRef.current || !effectiveWidthMm || !effectiveHeightMm)
        return { x: 0, y: 0 };
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
    },
    [
      effectiveWidthMm,
      effectiveHeightMm,
      canvasPxW,
      canvasPxH,
      workspaceZoom,
      mmToPx,
      rotation,
    ]
  );

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
    if (!type || !canvasRef.current) return;
    const { x, y } = clientToCanvasMM(e.clientX, e.clientY);
    addAsset(type, x, y);
  };

  const rotateCW = () => setRotation((r) => (r + 90) % 360);
  const rotateCCW = () => setRotation((r) => (r - 90 + 360) % 360);

  return (
    <div className="relative w-full h-full">
      {/* Debug Panel */}
      <div
        ref={canvasRef}
        className={`relative ${canvas ? "bg-gray-100" : "bg-transparent"} ${
          isPenMode ||
          isWallMode ||
          wallDrawingMode ||
          shapeMode ||
          isRectangularSelectionMode
            ? "cursor-crosshair"
            : ""
        }`}
      style={{
        width: canvasPxW,
        height: canvasPxH,
        transform: `rotate(${rotation}deg)`,
        transformOrigin: "center center",
        cursor: isRectangularSelectionMode ? "crosshair" : (isWallMode || wallDrawingMode || shapeMode) ? "crosshair" : undefined,
      }}
      onDragOver={(e) => e.preventDefault()}
      onDrop={handleDrop}
      onMouseMove={(e) => {
        if (isRectangularSelectionMode && rectangularSelectionStart) {
          const { x, y } = clientToCanvasMM(e.clientX, e.clientY);
          updateRectangularSelectionDrag(x, y);
        }
        // Update shape preview while drawing
        if (shapeMode && shapeStart) {
          const { x, y } = clientToCanvasMM(e.clientX, e.clientY);
          let end = { x, y };
          
          // Apply Shift key constraint for perfect squares/circles
          if (e.shiftKey && (shapeMode === "rectangle" || shapeMode === "ellipse")) {
            const dx = x - shapeStart.x;
            const dy = y - shapeStart.y;
            const size = Math.max(Math.abs(dx), Math.abs(dy));
            end = {
              x: shapeStart.x + Math.sign(dx || 1) * size,
              y: shapeStart.y + Math.sign(dy || 1) * size,
            };
          }
          
          updateShapeTempEnd(end);
        }
      }}
      onMouseUp={(e) => {
        if (isRectangularSelectionMode && rectangularSelectionStart) {
          finishRectangularSelectionDrag();
        }
        // Finish shape drawing on mouse up
        if (shapeMode && shapeStart) {
          finishShape();
        }
      }}
      onMouseDown={(e) => {
        if (e.button !== 0) return;
        if (e.target === canvasRef.current) {
          // Handle rectangular selection (when in rectangular selection mode and not in drawing modes)
          if (
            isRectangularSelectionMode &&
            !isPenMode &&
            !isWallMode &&
            !wallDrawingMode &&
            !shapeMode
          ) {
            const { x, y } = clientToCanvasMM(e.clientX, e.clientY);
            startRectangularSelectionDrag(x, y);
            return;
          }

          if (isPenMode || isWallMode) {
            e.stopPropagation();
            const { x, y } = clientToCanvasMM(e.clientX, e.clientY);

            // Start drawing
            currentDrawingPath.current = [{ x, y }];
            setIsDrawing(true);
            setCurrentPath([{ x, y }]);
            setTempPath([{ x, y }]);
            return; // Prevent canvas movement when in pen mode
          } else if (wallDrawingMode) {
            // Check if the click target is the canvas itself (not a child element like sidebar buttons)
            if (e.target !== canvasRef.current) {
              return;
            }

            e.stopPropagation();
            const { x, y } = clientToCanvasMM(e.clientX, e.clientY);

            // For very large canvas, allow wall creation anywhere
            // No bounds checking needed for large canvas

            if (!currentWallStart) {
              // Start new wall segment, snapping to nearest existing wall endpoint if close
              let startPoint = { x, y };
              const snapThreshold = 6; // mm
              // Look for nearest endpoint among existing wall assets
              const wallAssets = assets.filter(
                (a) => a.wallSegments && a.wallSegments.length > 0
              );
              let closest: { x: number; y: number } | null = null;
              let closestDist = Infinity;
              for (const a of wallAssets) {
                for (const seg of a.wallSegments!) {
                  const absStart = {
                    x: seg.start.x + a.x,
                    y: seg.start.y + a.y,
                  };
                  const absEnd = { x: seg.end.x + a.x, y: seg.end.y + a.y };
                  const dxS = x - absStart.x;
                  const dyS = y - absStart.y;
                  const distS = Math.sqrt(dxS * dxS + dyS * dyS);
                  if (distS < closestDist) {
                    closestDist = distS;
                    closest = absStart;
                  }
                  const dxE = x - absEnd.x;
                  const dyE = y - absEnd.y;
                  const distE = Math.sqrt(dxE * dxE + dyE * dyE);
                  if (distE < closestDist) {
                    closestDist = distE;
                    closest = absEnd;
                  }
                }
              }
              if (closest && closestDist <= snapThreshold) {
                startPoint = closest;
              }
              startWallSegment(startPoint);
            } else {
              // This will be handled by the mouse up event to commit the current segment
            }
            return; // Prevent canvas movement when in wall mode
          } else if (shapeMode) {
            e.stopPropagation();
            const { x, y } = clientToCanvasMM(e.clientX, e.clientY);
            startShape({ x, y });
            return;
          } else {
            clearSelection();
            e.stopPropagation();
            mouseRefs.isMovingCanvas.current = true;
            mouseRefs.lastCanvasPointer.current = {
              x: e.clientX,
              y: e.clientY,
            };
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
        gridSize={gridSize}
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
        isRectangularSelectionMode={isRectangularSelectionMode}
        rectangularSelectionStart={rectangularSelectionStart}
        rectangularSelectionEnd={rectangularSelectionEnd}
      />

      {/* Canvas Controls */}
      <CanvasControls
        selectedAssetId={selectedAssetId}
        onRotateCW={rotateCW}
        onRotateCCW={rotateCCW}
        canvas={canvas}
      />

      {/* Pattern Indicator */}
      <PatternIndicator />

      {/* Rectangular Selection Status */}
      {isRectangularSelectionMode && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          className='absolute top-4 left-1/2 -translate-x-1/2 bg-blue-600 text-white px-4 py-2 rounded-lg shadow-lg text-sm whitespace-nowrap z-50'
        >
          Click and drag to select multiple assets
          <div className='absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-blue-600'></div>
        </motion.div>
      )}

      {/* Selection Box */}
      <SelectionBox mmToPx={mmToPx} />

      {/* Chair Radius Preview */}
      {selectedAssetId && assets.find(a => a.id === selectedAssetId)?.type.includes('table') && (
        <div
          className="absolute pointer-events-none"
          style={{
            left: `${assets.find(a => a.id === selectedAssetId)!.x * mmToPx}px`,
            top: `${assets.find(a => a.id === selectedAssetId)!.y * mmToPx}px`,
            transform: 'translate(-50%, -50%)',
            width: `${chairSettings.radius * mmToPx * 2}px`,
            height: `${chairSettings.radius * mmToPx * 2}px`,
          }}
        >
          <div
            className="absolute inset-0 rounded-full border-2 border-blue-400 border-dashed opacity-60"
            style={{
              width: '100%',
              height: '100%',
            }}
          />
          {/* Debug text showing current radius */}
          <div className="absolute top-2 left-1/2 transform -translate-x-1/2 text-xs text-blue-600 font-bold bg-white px-1 rounded">
            {chairSettings.radius}mm radius
          </div>
          {/* Show chair count */}
          <div className="absolute bottom-2 left-1/2 transform -translate-x-1/2 text-xs text-blue-600 font-bold bg-white px-1 rounded">
            {chairSettings.numChairs} chairs
          </div>
        </div>
      )}

      {/* Render Assets - Sort by zIndex to ensure proper layering */}
      {assets
        .slice()
        .filter((asset) => asset != null) // Filter out null/undefined assets
        .sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0))
        .map((asset) => {
          const isSelected = asset.id === selectedAssetId;
          const isMultiSelected = selectedAssetIds.includes(asset.id);
          const isCopied = asset.id === copiedAssetId;
          const leftPx = asset.x * mmToPx;
          const topPx = asset.y * mmToPx;
          const totalRotation = asset.rotation;

          // Use GroupRenderer for group assets, AssetRenderer for regular assets
          if (asset.isGroup) {
            return (
              <GroupRenderer
                key={asset.id}
                group={asset}
                isSelected={isSelected}
                isMultiSelected={isMultiSelected}
                leftPx={leftPx}
                topPx={topPx}
                mmToPx={mmToPx}
                onAssetClick={(id) => selectAsset(id)}
                onAssetDoubleClick={(id) => {
                  if (id) {
                    const asset = assets.find((a: AssetInstance) => a.id === id);
                    if (asset?.isGroup) {
                      updateAsset(id, { groupExpanded: !asset.groupExpanded });
                    }
                  }
                }}
                onAssetMouseDown={assetHandlers.onAssetMouseDown}
                onAssetMouseMove={() => {}}
                onAssetMouseUp={() => {}}
                onAssetMouseLeave={() => {}}
                onAssetMouseEnter={() => {}}
                onAssetMouseOver={() => {}}
                onAssetMouseOut={() => {}}
                onAssetContextMenu={() => {}}
                onScaleHandleMouseDown={assetHandlers.onScaleHandleMouseDown}
                onRotationHandleMouseDown={
                  assetHandlers.onRotationHandleMouseDown
                }
                selectedAssetId={selectedAssetId}
                selectedAssetIds={selectedAssetIds}
              />
            );
          }

          return (
            <AssetRenderer
              key={asset.id}
              asset={asset}
              isSelected={isSelected}
              isMultiSelected={isMultiSelected}
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
              onRotationHandleMouseDown={
                assetHandlers.onRotationHandleMouseDown
              }
            />
          );
        })}
      </div>
      
    </div>
  );
}
