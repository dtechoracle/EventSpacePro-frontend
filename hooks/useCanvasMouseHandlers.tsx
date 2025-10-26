import React, { useEffect, useRef, useCallback } from "react";
import { useSceneStore, AssetInstance } from "@/store/sceneStore";
import { snapTo90Degrees } from "@/lib/wallGeometry";

interface UseCanvasMouseHandlersProps {
  workspaceZoom: number;
  mmToPx: number;
  canvasPos: { x: number; y: number };
  setCanvasPos: React.Dispatch<React.SetStateAction<{ x: number; y: number }>>;
  canvas?: { size: string; width: number; height: number } | null;
  clientToCanvasMM: (
    clientX: number,
    clientY: number
  ) => { x: number; y: number };
  straightenPath: (
    path: { x: number; y: number }[]
  ) => { x: number; y: number }[];
}

export function useCanvasMouseHandlers({
  workspaceZoom,
  mmToPx,
  canvasPos,
  setCanvasPos,
  canvas,
  clientToCanvasMM,
  straightenPath,
}: UseCanvasMouseHandlersProps) {
  // Store selectors
  const assets = useSceneStore((s) => s.assets);
  const selectedAssetId = useSceneStore((s) => s.selectedAssetId);
  const isPenMode = useSceneStore((s) => s.isPenMode);
  const isWallMode = useSceneStore((s) => s.isWallMode);
  const isDrawing = useSceneStore((s) => s.isDrawing);
  const currentPath = useSceneStore((s) => s.currentPath);
  const tempPath = useSceneStore((s) => s.tempPath);
  const wallDrawingMode = useSceneStore((s) => s.wallDrawingMode);
  const currentWallSegments = useSceneStore((s) => s.currentWallSegments);
  const currentWallStart = useSceneStore((s) => s.currentWallStart);
  const currentWallTempEnd = useSceneStore((s) => s.currentWallTempEnd);
  const firstHorizontalWallLength = useSceneStore(
    (s) => s.firstHorizontalWallLength
  );
  const wallDraftNodes = useSceneStore((s) => s.wallDraftNodes);
  const selectedAssetIds = useSceneStore((s) => s.selectedAssetIds);
  const isRectangularSelecting = useSceneStore((s) => s.isRectangularSelecting);
  const isRectangularSelectionMode = useSceneStore(
    (s) => s.isRectangularSelectionMode
  );
  const rectangularSelectionStart = useSceneStore(
    (s) => s.rectangularSelectionStart
  );
  const updateRectangularSelectionDrag = useSceneStore(
    (s) => s.updateRectangularSelectionDrag
  );
  const finishRectangularSelectionDrag = useSceneStore(
    (s) => s.finishRectangularSelectionDrag
  );

  // Store actions
  const updateAsset = useSceneStore((s) => s.updateAsset);
  const snapToGrid = useSceneStore((s) => s.snapToGrid);
  const snapToGridEnabled = useSceneStore((s) => s.snapToGridEnabled);
  const setIsDrawing = useSceneStore((s) => s.setIsDrawing);
  const setCurrentPath = useSceneStore((s) => s.setCurrentPath);
  const setTempPath = useSceneStore((s) => s.setTempPath);
  const setPenMode = useSceneStore((s) => s.setPenMode);
  const setWallMode = useSceneStore((s) => s.setWallMode);
  const clearPath = useSceneStore((s) => s.clearPath);
  const addPointToPath = useSceneStore((s) => s.addPointToPath);
  const updateWallTempEnd = useSceneStore((s) => s.updateWallTempEnd);
  const commitWallSegment = useSceneStore((s) => s.commitWallSegment);
  const finishWallDrawingAction = useSceneStore((s) => s.finishWallDrawing);
  const finishWallDraftAction = useSceneStore((s) => s.finishWallDraft);
  const shapeMode = useSceneStore((s) => s.shapeMode);
  const shapeStart = useSceneStore((s) => s.shapeStart);
  const shapeTempEnd = useSceneStore((s) => s.shapeTempEnd);
  const startShape = useSceneStore((s) => s.startShape);
  const updateShapeTempEnd = useSceneStore((s) => s.updateShapeTempEnd);
  const finishShapeAction = useSceneStore((s) => s.finishShape);
  const addAssetObject = useSceneStore((s) => s.addAssetObject);
  const selectAsset = useSceneStore((s) => s.selectAsset);
  const startRectangularSelection = useSceneStore(
    (s) => s.startRectangularSelection
  );
  const updateRectangularSelection = useSceneStore(
    (s) => s.updateRectangularSelection
  );
  const finishRectangularSelection = useSceneStore(
    (s) => s.finishRectangularSelection
  );
  const moveSelectedAssets = useSceneStore((s) => s.moveSelectedAssets);
  const clearSelection = useSceneStore((s) => s.clearSelection);

  // Refs for tracking state
  const draggingAssetRef = useRef<string | null>(null);
  const isMovingCanvas = useRef(false);
  const lastCanvasPointer = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const isScalingAsset = useRef(false);
  const isAdjustingHeight = useRef(false);
  const isRotatingAsset = useRef(false);
  const initialScale = useRef(1);
  const initialHeight = useRef(1);
  const initialDistance = useRef(0);
  const initialRotation = useRef(0);
  const initialMouseAngle = useRef(0);
  const scaleHandleType = useRef<
    "top-left" | "top-right" | "bottom-left" | "bottom-right" | null
  >(null);
  const heightHandleType = useRef<"top" | "bottom" | null>(null);
  const currentDrawingPath = useRef<{ x: number; y: number }[]>([]);
  const lastMousePosition = useRef({ x: 0, y: 0 });
  const draggingOffset = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const draggingAssetStart = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const isDraggingMultiple = useRef(false);
  const lastMousePos = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // Expose refs for external access
  const refs = {
    draggingAssetRef,
    isMovingCanvas,
    lastCanvasPointer,
    isScalingAsset,
    isAdjustingHeight,
    isRotatingAsset,
    initialScale,
    initialHeight,
    initialDistance,
    initialRotation,
    initialMouseAngle,
    scaleHandleType,
    heightHandleType,
    currentDrawingPath,
    lastMousePosition,
    draggingOffset,
    draggingAssetStart,
  };

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (e.button !== 0) return; // Only handle left mouse button

      const { x, y } = clientToCanvasMM(e.clientX, e.clientY);

      // Check if clicking on a multi-selected asset
      if (selectedAssetIds.length > 1) {
        // Find if we clicked on any of the selected assets
        const clickedAsset = assets.find((asset) => {
          if (!selectedAssetIds.includes(asset.id)) return false;

          // Check if click is within asset bounds
          const assetWidth = (asset.width || 24) * (asset.scale || 1);
          const assetHeight = (asset.height || 24) * (asset.scale || 1);
          const assetLeft = asset.x - assetWidth / 2;
          const assetRight = asset.x + assetWidth / 2;
          const assetTop = asset.y - assetHeight / 2;
          const assetBottom = asset.y + assetHeight / 2;

          return (
            x >= assetLeft &&
            x <= assetRight &&
            y >= assetTop &&
            y <= assetBottom
          );
        });

        if (clickedAsset) {
          console.log("Starting multi-asset drag for:", selectedAssetIds);
          isDraggingMultiple.current = true;
          lastMousePos.current = { x, y };
          return;
        }
      }
    };

    const onMove = (e: MouseEvent) => {
      // Store mouse position for use in mouse up handler
      lastMousePosition.current = { x: e.clientX, y: e.clientY };
      const { x, y } = clientToCanvasMM(e.clientX, e.clientY);

      console.log(
        "Mouse move - isRectangularSelectionMode:",
        isRectangularSelectionMode,
        "rectangularSelectionStart:",
        rectangularSelectionStart
      );

      // Handle rectangular selection dragging
      if (isRectangularSelectionMode && rectangularSelectionStart) {
        console.log("Mouse move - Updating rectangular selection drag:", x, y);
        updateRectangularSelectionDrag(x, y);
        return;
      }

      // Handle multi-asset dragging
      if (isDraggingMultiple.current && selectedAssetIds.length > 0) {
        const deltaX = x - lastMousePos.current.x;
        const deltaY = y - lastMousePos.current.y;
        moveSelectedAssets(deltaX, deltaY);
        lastMousePos.current = { x, y };
        return;
      }

      if (isRotatingAsset.current && selectedAssetId) {
        const asset = assets.find((a) => a.id === selectedAssetId);
        if (asset) {
          const { x: mouseX, y: mouseY } = clientToCanvasMM(
            e.clientX,
            e.clientY
          );

          // Calculate angle from asset center to mouse position
          const deltaX = mouseX - asset.x;
          const deltaY = mouseY - asset.y;
          const currentMouseAngle =
            Math.atan2(deltaY, deltaX) * (180 / Math.PI);

          // Calculate rotation difference from initial angle
          const rotationDelta = currentMouseAngle - initialMouseAngle.current;
          const newRotation = initialRotation.current + rotationDelta;

          updateAsset(selectedAssetId, { rotation: newRotation });
        }
        return;
      }

      if (
        isScalingAsset.current &&
        selectedAssetId &&
        scaleHandleType.current
      ) {
        const asset = assets.find((a) => a.id === selectedAssetId);
        if (asset) {
          const { x: mouseX, y: mouseY } = clientToCanvasMM(
            e.clientX,
            e.clientY
          );

          // Use distance from asset center to mouse position for stable scaling
          const assetCenterX = asset.x;
          const assetCenterY = asset.y;

          // Calculate current distance from asset center to mouse position
          const currentDistance = Math.sqrt(
            Math.pow(mouseX - assetCenterX, 2) +
              Math.pow(mouseY - assetCenterY, 2)
          );

          // Calculate scale based on distance ratio
          const scaleRatio = currentDistance / initialDistance.current;
          const newScale = Math.max(
            0.1,
            Math.min(10, initialScale.current * scaleRatio)
          );

          updateAsset(selectedAssetId, { scale: newScale });
        }
        return;
      }

      if (
        isAdjustingHeight.current &&
        selectedAssetId &&
        heightHandleType.current
      ) {
        const asset = assets.find((a) => a.id === selectedAssetId);
        if (asset) {
          const { x: mouseX, y: mouseY } = clientToCanvasMM(
            e.clientX,
            e.clientY
          );
          const assetCenterY = asset.y;

          // Calculate height adjustment based on mouse distance from center
          const heightDelta = Math.abs(mouseY - assetCenterY);
          const heightRatio = heightDelta / initialDistance.current;
          const newHeight = Math.max(
            10,
            Math.min(500, initialHeight.current * heightRatio)
          );

          updateAsset(selectedAssetId, { height: newHeight });
        }
        return;
      }

      if (isDrawing && isPenMode) {
        const { x, y } = clientToCanvasMM(e.clientX, e.clientY);
        currentDrawingPath.current = [...currentDrawingPath.current, { x, y }];
        setCurrentPath(currentDrawingPath.current);
        setTempPath([...currentDrawingPath.current]); // Create a new array to ensure re-render
        console.log(
          "Drawing point:",
          { x, y },
          "Path length:",
          currentDrawingPath.current.length
        );
        return;
      }

      // Shape drawing mouse move preview
      if (shapeMode && shapeStart) {
        const { x, y } = clientToCanvasMM(e.clientX, e.clientY);
        let end = { x, y };
        if (
          (e as any).shiftKey &&
          (shapeMode === "rectangle" || shapeMode === "ellipse")
        ) {
          const dx = x - shapeStart.x;
          const dy = y - shapeStart.y;
          const size = Math.max(Math.abs(dx), Math.abs(dy));
          end = {
            x: shapeStart.x + Math.sign(dx || 1) * size,
            y: shapeStart.y + Math.sign(dy || 1) * size,
          };
        }
        updateShapeTempEnd(end);
        return;
      }

      // Handle wall drawing mode mouse movement
      if (wallDrawingMode && currentWallStart) {
        const { x, y } = clientToCanvasMM(e.clientX, e.clientY);

        // Check if mouse is within canvas bounds
        if (
          canvas &&
          x >= 0 &&
          y >= 0 &&
          x <= canvas.width &&
          y <= canvas.height
        ) {
          // Apply 90-degree snapping relative to current segment start
          let snappedPoint = { x, y };
          snappedPoint = snapTo90Degrees(currentWallStart, snappedPoint);

          // If we have a tracked first horizontal length, align opposite horizontal walls
          // if (firstHorizontalWallLength && currentWallSegments.length >= 2) {
          //   // Heuristic: if this looks horizontal, force length to match the first horizontal
          //   const dx = snappedPoint.x - currentWallStart.x;
          //   const dy = snappedPoint.y - currentWallStart.y;
          //   if (Math.abs(dx) >= Math.abs(dy)) {
          //     const sign = dx >= 0 ? 1 : -1;
          //     snappedPoint = {
          //       x: currentWallStart.x + sign * firstHorizontalWallLength,
          //       y: currentWallStart.y,
          //     };
          //   }

          // Edge snapping: if endpoint is near an existing wall edge, snap to the edge projection
          const projectPointToSegment = (
            p: { x: number; y: number },
            aPt: { x: number; y: number },
            bPt: { x: number; y: number }
          ) => {
            const abx = bPt.x - aPt.x;
            const aby = bPt.y - aPt.y;
            const apx = p.x - aPt.x;
            const apy = p.y - aPt.y;
            const ab2 = abx * abx + aby * aby;
            if (ab2 === 0) return { x: aPt.x, y: aPt.y, t: 0 };
            let t = (apx * abx + apy * aby) / ab2;
            t = Math.max(0, Math.min(1, t));
            return { x: aPt.x + abx * t, y: aPt.y + aby * t, t };
          };

          const edgeSnapThreshold = 3; // mm
          let nearestProj: { x: number; y: number } | null = null;
          let nearestDist = Infinity;
          const wallAssets = assets.filter(
            (a) =>
              (a.wallNodes && a.wallNodes.length > 0) ||
              (a.wallSegments && a.wallSegments.length > 0)
          );
          for (const a of wallAssets) {
            if (a.wallNodes && a.wallEdges && a.wallEdges.length > 0) {
              for (const e of a.wallEdges) {
                const pa = a.wallNodes[e.a];
                const pb = a.wallNodes[e.b];
                const proj = projectPointToSegment(snappedPoint, pa, pb);
                const d = Math.hypot(
                  proj.x - snappedPoint.x,
                  proj.y - snappedPoint.y
                );
                if (d < nearestDist) {
                  nearestDist = d;
                  nearestProj = { x: proj.x, y: proj.y };
                }
              }
            } else if (a.wallSegments && a.wallSegments.length > 0) {
              for (const seg of a.wallSegments) {
                const pa = { x: seg.start.x + a.x, y: seg.start.y + a.y };
                const pb = { x: seg.end.x + a.x, y: seg.end.y + a.y };
                const proj = projectPointToSegment(snappedPoint, pa, pb);
                const d = Math.hypot(
                  proj.x - snappedPoint.x,
                  proj.y - snappedPoint.y
                );
                if (d < nearestDist) {
                  nearestDist = d;
                  nearestProj = { x: proj.x, y: proj.y };
                }
              }
            }
          }
          if (nearestProj && nearestDist <= edgeSnapThreshold) {
            snappedPoint = nearestProj;
          }

          // Additionally, snap to the very first point to allow easy closing of the loop
          const firstPoint =
            currentWallSegments.length > 0
              ? currentWallSegments[0].start
              : null;
          if (firstPoint) {
            const dxStart = snappedPoint.x - firstPoint.x;
            const dyStart = snappedPoint.y - firstPoint.y;
            const distStart = Math.sqrt(dxStart * dxStart + dyStart * dyStart);
            const closeThreshold = 6; // mm
            if (distStart <= closeThreshold) {
              // Snap directly to the first point so the last corner will close perfectly
              snappedPoint = { x: firstPoint.x, y: firstPoint.y };
            }
          }

          // Auto-close when approaching first point (no extra click)
          const firstPointAuto =
            currentWallSegments.length > 0
              ? currentWallSegments[0].start
              : null;
          if (firstPointAuto) {
            const dist = Math.hypot(
              snappedPoint.x - firstPointAuto.x,
              snappedPoint.y - firstPointAuto.y
            );
            if (dist <= 2) {
              updateWallTempEnd({ x: firstPointAuto.x, y: firstPointAuto.y });
              // If we're using the draft flow, finish that instead of legacy
              if (
                wallDraftNodes &&
                wallDraftNodes.length > 0 &&
                finishWallDraftAction
              ) {
                finishWallDraftAction();
              } else {
                commitWallSegment();
                finishWallDrawingAction();
              }
              return;
            }
          }
          const gridSnapped = snapToGrid(snappedPoint.x, snappedPoint.y);
          updateWallTempEnd(gridSnapped);
        }
        return;
      }

      if (draggingAssetRef.current) {
        const { x, y } = clientToCanvasMM(e.clientX, e.clientY);
        const newX = x + draggingOffset.current.x;
        const newY = y + draggingOffset.current.y;
        const snapped = snapToGrid(newX, newY);
        updateAsset(draggingAssetRef.current, { x: snapped.x, y: snapped.y });
        return;
      }

      if (isMovingCanvas.current) {
        const dx = e.clientX - lastCanvasPointer.current.x;
        const dy = e.clientY - lastCanvasPointer.current.y;
        setCanvasPos((p) => ({
          x: p.x + dx / workspaceZoom,
          y: p.y + dy / workspaceZoom,
        }));
        lastCanvasPointer.current = { x: e.clientX, y: e.clientY };
      }
    };

    const onUp = () => {
      // Handle rectangular selection finish
      if (isRectangularSelectionMode && rectangularSelectionStart) {
        console.log("Finishing rectangular selection drag");
        finishRectangularSelectionDrag();
        return;
      }

      // Handle multi-asset drag finish
      if (isDraggingMultiple.current) {
        isDraggingMultiple.current = false;
        return;
      }

      // If we're in wall drawing mode, do not create any pen/wall (double-line) assets here
      if (!wallDrawingMode && isDrawing && isPenMode) {
        if (currentDrawingPath.current.length > 1) {
          // Straighten the path if it's close to a straight line
          const straightenedPath = straightenPath(currentDrawingPath.current);

          // Calculate center point and dimensions of the straightened path
          const startPoint = straightenedPath[0];
          const endPoint = straightenedPath[straightenedPath.length - 1];

          const centerX = (startPoint.x + endPoint.x) / 2;
          const centerY = (startPoint.y + endPoint.y) / 2;

          // Calculate length for the line
          const length = Math.sqrt(
            Math.pow(endPoint.x - startPoint.x, 2) +
              Math.pow(endPoint.y - startPoint.y, 2)
          );

          // Determine if the line is more horizontal or vertical
          const deltaX = Math.abs(endPoint.x - startPoint.x);
          const deltaY = Math.abs(endPoint.y - startPoint.y);
          const isHorizontal = deltaX > deltaY;

          let newAsset: AssetInstance;

          if (isWallMode) {
            // Create double line asset for wall mode
            const id = `double-line-${Date.now()}`;
            newAsset = {
              id,
              type: "double-line",
              x: centerX,
              y: centerY,
              scale: 1,
              rotation: 0, // Start with 0 rotation - user can rotate manually if needed
              width: isHorizontal ? length : 2, // Width: length for horizontal lines, thickness for vertical
              height: isHorizontal ? 2 : length, // Height: thickness for horizontal lines, length for vertical
              lineGap: 8, // Gap between the two lines
              lineColor: "#000000", // Color of the lines
              backgroundColor: "transparent",
              isHorizontal: isHorizontal, // Store the orientation
              zIndex: 0,
            };
          } else {
            // Create single line asset for pen mode (drawn-line type for path rendering)
            const id = `drawn-line-${Date.now()}`;

            // Convert path coordinates to be relative to the center point
            const relativePath = straightenedPath.map((point) => ({
              x: point.x - centerX,
              y: point.y - centerY,
            }));

            newAsset = {
              id,
              type: "drawn-line",
              x: centerX,
              y: centerY,
              scale: 1,
              rotation: 0, // Start with 0 rotation - user can rotate manually if needed
              strokeWidth: 2,
              strokeColor: "#000000",
              backgroundColor: "transparent",
              path: relativePath, // Store the relative path for rendering
              zIndex: 0,
            };
          }

          addAssetObject(newAsset);
          selectAsset(newAsset.id);
        }

        // Reset drawing state
        setIsDrawing(false);
        currentDrawingPath.current = [];
        clearPath();
        setPenMode(false);
        setWallMode(false);
      }

      // Handle wall drawing mode mouse up
      if (wallDrawingMode && currentWallStart && currentWallTempEnd) {
        // If we're close to the very first point, close the loop and finish the wall
        const firstPoint =
          currentWallSegments.length > 0 ? currentWallSegments[0].start : null;

        if (firstPoint) {
          const dxStart = currentWallTempEnd.x - firstPoint.x;
          const dyStart = currentWallTempEnd.y - firstPoint.y;
          const distStart = Math.sqrt(dxStart * dxStart + dyStart * dyStart);
          const closeThreshold = 6; // mm
          if (distStart <= closeThreshold) {
            // Snap end to start, commit final segment, then finish to build asset/merge
            updateWallTempEnd({ x: firstPoint.x, y: firstPoint.y });
            commitWallSegment();
            // Finish drawing (will create or merge wall and reset state)
            const { finishWallDrawing } = useSceneStore.getState();
            finishWallDrawing();
            return;
          }
        }

        // Default behavior: just commit the current segment and continue
        commitWallSegment();
      }

      // Finish shape drawing on mouse up
      if (shapeMode && shapeStart) {
        finishShapeAction();
        return;
      }

      // Handle door wall opening when dragging is complete
      if (draggingAssetRef.current) {
        const draggedAsset = assets.find(
          (a) => a.id === draggingAssetRef.current
        );
        if (draggedAsset && draggedAsset.type === "double-door") {
          const { processDoorWallOpening } = useSceneStore.getState();
          processDoorWallOpening(draggedAsset.id);
        }
      }

      // Reset all interaction states
      draggingAssetRef.current = null;
      isMovingCanvas.current = false;
      isScalingAsset.current = false;
      isAdjustingHeight.current = false;
      isRotatingAsset.current = false;
      initialScale.current = 1;
      initialHeight.current = 1;
      initialDistance.current = 0;
      initialRotation.current = 0;
      initialMouseAngle.current = 0;
      scaleHandleType.current = null;
      heightHandleType.current = null;
    };

    document.addEventListener("mousedown", onDown);
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };
  }, [
    workspaceZoom,
    mmToPx,
    updateAsset,
    setCanvasPos,
    selectedAssetId,
    clientToCanvasMM,
    isDrawing,
    isPenMode,
    isWallMode,
    setCurrentPath,
    setTempPath,
    clearPath,
    setPenMode,
    setWallMode,
    straightenPath,
    wallDrawingMode,
    currentWallStart,
    currentWallTempEnd,
    updateWallTempEnd,
    commitWallSegment,
    addAssetObject,
    selectAsset,
    setIsDrawing,
    canvas,
    assets,
    isRectangularSelectionMode,
    rectangularSelectionStart,
    updateRectangularSelectionDrag,
    finishRectangularSelectionDrag,
    selectedAssetIds,
    moveSelectedAssets,
    snapToGrid,
    shapeMode,
    startShape,
  ]);

  return refs;
}
