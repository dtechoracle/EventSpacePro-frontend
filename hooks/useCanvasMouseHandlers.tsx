import { useEffect, useRef, useCallback } from "react";
import { useSceneStore, AssetInstance } from "@/store/sceneStore";
import { snapTo90Degrees } from "@/lib/wallGeometry";

interface UseCanvasMouseHandlersProps {
  workspaceZoom: number;
  mmToPx: number;
  canvasPos: { x: number; y: number };
  setCanvasPos: React.Dispatch<React.SetStateAction<{ x: number; y: number }>>;
  canvas?: { size: string; width: number; height: number } | null;
  clientToCanvasMM: (clientX: number, clientY: number) => { x: number; y: number };
  straightenPath: (path: { x: number; y: number }[]) => { x: number; y: number }[];
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

  // Store actions
  const updateAsset = useSceneStore((s) => s.updateAsset);
  const setIsDrawing = useSceneStore((s) => s.setIsDrawing);
  const setCurrentPath = useSceneStore((s) => s.setCurrentPath);
  const setTempPath = useSceneStore((s) => s.setTempPath);
  const setPenMode = useSceneStore((s) => s.setPenMode);
  const setWallMode = useSceneStore((s) => s.setWallMode);
  const clearPath = useSceneStore((s) => s.clearPath);
  const updateWallTempEnd = useSceneStore((s) => s.updateWallTempEnd);
  const commitWallSegment = useSceneStore((s) => s.commitWallSegment);
  const addAssetObject = useSceneStore((s) => s.addAssetObject);
  const selectAsset = useSceneStore((s) => s.selectAsset);

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
  const scaleHandleType = useRef<'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | null>(null);
  const heightHandleType = useRef<'top' | 'bottom' | null>(null);
  const currentDrawingPath = useRef<{ x: number; y: number }[]>([]);
  const lastMousePosition = useRef({ x: 0, y: 0 });

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
  };

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      // Store mouse position for use in mouse up handler
      lastMousePosition.current = { x: e.clientX, y: e.clientY };
      
      if (isRotatingAsset.current && selectedAssetId) {
        const asset = assets.find((a) => a.id === selectedAssetId);
        if (asset) {
          const { x: mouseX, y: mouseY } = clientToCanvasMM(e.clientX, e.clientY);
          
          // Calculate angle from asset center to mouse position
          const deltaX = mouseX - asset.x;
          const deltaY = mouseY - asset.y;
          const currentMouseAngle = Math.atan2(deltaY, deltaX) * (180 / Math.PI);
          
          // Calculate rotation difference from initial angle
          const rotationDelta = currentMouseAngle - initialMouseAngle.current;
          const newRotation = initialRotation.current + rotationDelta;
          
          updateAsset(selectedAssetId, { rotation: newRotation });
        }
        return;
      }

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
          const newScale = Math.max(0.1, Math.min(10, initialScale.current * scaleRatio));
          
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
      
      if (isDrawing && (isPenMode || isWallMode)) {
        const { x, y } = clientToCanvasMM(e.clientX, e.clientY);
        currentDrawingPath.current = [...currentDrawingPath.current, { x, y }];
        setCurrentPath(currentDrawingPath.current);
        setTempPath([...currentDrawingPath.current]); // Create a new array to ensure re-render
        console.log('Drawing point:', { x, y }, 'Path length:', currentDrawingPath.current.length);
        return;
      }

      // Handle wall drawing mode mouse movement
      if (wallDrawingMode && currentWallStart) {
        const { x, y } = clientToCanvasMM(e.clientX, e.clientY);
        
        // Check if mouse is within canvas bounds
        if (canvas && (x >= 0 && y >= 0 && x <= canvas.width && y <= canvas.height)) {
          // Apply 90-degree snapping if we have a starting point
          let snappedPoint = { x, y };
          if (currentWallStart) {
            snappedPoint = snapTo90Degrees(currentWallStart, { x, y });
          }
          updateWallTempEnd(snappedPoint);
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
      if (isDrawing && (isPenMode || isWallMode)) {
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
            Math.pow(endPoint.x - startPoint.x, 2) + Math.pow(endPoint.y - startPoint.y, 2)
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
              isHorizontal: isHorizontal // Store the orientation
            };
          } else {
            // Create single line asset for pen mode (drawn-line type for path rendering)
            const id = `drawn-line-${Date.now()}`;
            
            // Convert path coordinates to be relative to the center point
            const relativePath = straightenedPath.map(point => ({
              x: point.x - centerX,
              y: point.y - centerY
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
              path: relativePath // Store the relative path for rendering
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
        commitWallSegment();
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

    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
    return () => {
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
  ]);

  return refs;
}
