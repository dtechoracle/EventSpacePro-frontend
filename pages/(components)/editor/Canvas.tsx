"use client";

import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { useSceneStore, AssetInstance } from "@/store/sceneStore";
import { PaperSize } from "@/lib/paperSizes";
import { PAPER_SIZES } from "@/lib/paperSizes";
import GridOverlay from "./GridOverlay";
import UnifiedWallRendering from "./UnifiedWallRendering";
import DrawingPath from "./DrawingPath";
import DimensionOverlay from "./DimensionOverlay";
import AssetRenderer from "./AssetRenderer";
import GroupRenderer from "./GroupRenderer";
import CanvasControls from "./CanvasControls";
import PatternIndicator from "./PatternIndicator";
import SelectionBox from "./SelectionBox";
import ThreeDOverlay from "./ThreeDOverlay";
import AnchorHighlights from "./AnchorHighlights";
import { useCanvasMouseHandlers } from "@/hooks/useCanvasMouseHandlers";
import { useCanvasKeyboardHandlers } from "@/hooks/useCanvasKeyboardHandlers";
import { useAssetHandlers } from "@/hooks/useAssetHandlers";
import { useDrawingLogic } from "@/hooks/useDrawingLogic";
import { motion, AnimatePresence } from "framer-motion";
import { calculateShapeAnchors, calculateAssetAnchors, AnchorType } from "@/utils/snapAnchors";
import { useProjectStore } from "@/store/projectStore";
import React from "react";

type CanvasProps = {
  canvas?: { size: string; width: number; height: number } | null;
  assets?: AssetInstance[];
};

// Moved outside to avoid re-renders
const SnapGuidesRenderer = React.memo(({ mmToPx, workspaceZoom }: { mmToPx: number, workspaceZoom: number }) => {
  const snapGuides = useSceneStore((s) => s.snapGuides);
  if (!snapGuides || snapGuides.length === 0) return null;

  return (
    <>
      {snapGuides.map((guide, i) => {
        const isVertical = guide.type === 'vertical';
        const x1 = guide.x1 * mmToPx;
        const y1 = guide.y1 * mmToPx;
        const x2 = guide.x2 * mmToPx;
        const y2 = guide.y2 * mmToPx;

        const style: React.CSSProperties = {
          position: 'absolute',
          pointerEvents: 'none',
          zIndex: 99999,
          backgroundColor: isVertical ? '#ff0000' : '#00ff00',
        };

        if (isVertical) {
          style.left = x1;
          style.top = y1;
          style.width = Math.max(1, 1.5 / workspaceZoom);
          style.height = (y2 - y1) || 1;
        } else {
          style.left = x1;
          style.top = y1;
          style.width = (x2 - x1) || 1;
          style.height = Math.max(1, 1.5 / workspaceZoom);
        }

        return <div key={i} style={style} />;
      })}
    </>
  );
});

SnapGuidesRenderer.displayName = "SnapGuidesRenderer";

export default function Canvas({
  canvas: propCanvas,
  assets: propAssets,
}: CanvasProps) {
  // Workspace (viewport) transform
  const MM_TO_PX = 2; 
  const ZOOM_SENSITIVITY = 0.001;
  const MIN_ZOOM_BASE = 0.000001; 
  const MIN_ZOOM_PADDING = 1; 
  const EDGE_PADDING_MM = 10;

  // Large virtual scene
  const SCENE_W_MM = 100000; 
  const SCENE_H_MM = 100000; 

  const containerRef = useRef<HTMLDivElement | null>(null);
  const [zoom, setZoom] = useState(1);
  const targetZoom = useRef(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const targetOffset = useRef({ x: 0, y: 0 });
  const isPanning = useRef(false);
  const lastPanPos = useRef({ x: 0, y: 0 });
  const [canvasPos, setCanvasPos] = useState<{ x: number; y: number }>({ x: 200, y: 150 });
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; assetId: string } | null>(null);

  const sceneState = useSceneStore();
  const {
    canvas, assets, showGrid, gridSize, isPenMode, isWallMode, isDrawing, 
    tempPath, wallDrawingMode, currentWallSegments, currentWallStart, 
    currentWallTempEnd, selectedAssetId, selectedAssetIds, chairSettings,
    snapToAnchorMode, snapSourceAssetId, snapSourceAnchor, snapTargetAssetId, 
    snapTargetAnchor, isRectangularSelectionMode, rectangularSelectionStart,
    rectangularSelectionEnd,
    addAsset, addAssetObject, reset, markAsSaved, selectAsset, updateAsset, 
    clearSelection, setIsDrawing, setCurrentPath, setTempPath, shapeMode, 
    shapeStart, shapeTempEnd, startShape, finishShape, updateShapeTempEnd, 
    startWallSegment, updateWallTempEnd, commitWallSegment, finishWallDrawing, 
    setWallDrawingMode, setSnapGuides, setSnapSource, setSnapTarget, 
    performSnapToAnchor, clearSnapToAnchor, setSnapToAnchorMode,
    startRectangularSelectionDrag, updateRectangularSelectionDrag, finishRectangularSelectionDrag
  } = sceneState;

  const isDrawingActive = isPenMode || isWallMode || wallDrawingMode || shapeMode;

  // Sync props data to store
  const hasSyncedRef = useRef(false);
  const lastAssetIdsRef = useRef<string>("");

  useEffect(() => {
    if (propCanvas && propAssets) {
      const assetIdsKey = propAssets.map(a => a.id).sort().join(",");
      if (!hasSyncedRef.current || assetIdsKey !== lastAssetIdsRef.current) {
        reset();
        const isKnownSize = !!(propCanvas.size && (propCanvas.size as keyof typeof PAPER_SIZES) in PAPER_SIZES);
        if (isKnownSize) {
          useSceneStore.getState().setCanvas(propCanvas.size as PaperSize);
        }
        propAssets.forEach(addAssetObject);
        markAsSaved();
        lastAssetIdsRef.current = assetIdsKey;
        hasSyncedRef.current = true;
      }
    }
  }, [propCanvas, propAssets, addAssetObject, markAsSaved, reset]);

  const canvasRef = useRef<HTMLDivElement | null>(null);
  const currentDrawingPath = useRef<{ x: number; y: number }[]>([]);
  const lastMousePosition = useRef({ x: 0, y: 0 });
  const [rotation, setRotation] = useState<number>(0);

  const mmToPx = MM_TO_PX;
  const workspaceZoom = zoom;
  const scenePxWNoZoom = SCENE_W_MM * mmToPx;
  const scenePxHNoZoom = SCENE_H_MM * mmToPx;

  const clientToCanvasMM = useCallback((clientX: number, clientY: number) => {
    if (!canvasRef.current) return { x: 0, y: 0 };
    const rect = canvasRef.current.getBoundingClientRect();
    return {
      x: (clientX - rect.left) / (mmToPx * workspaceZoom),
      y: (clientY - rect.top) / (mmToPx * workspaceZoom),
    };
  }, [workspaceZoom, mmToPx]);

  const clampOffset = useCallback((offsetCandidate: { x: number; y: number }, zoomVal: number, allowOverscroll = false) => {
    const el = containerRef.current;
    if (!el) return offsetCandidate;
    const rect = el.getBoundingClientRect();
    const vw = rect.width;
    const vh = rect.height;
    const sceneW = SCENE_W_MM * mmToPx;
    const sceneH = SCENE_H_MM * mmToPx;
    const padPx = EDGE_PADDING_MM * mmToPx * zoomVal;
    
    // Bounds for 100m x 100m scene
    const minOffsetX = vw - padPx - sceneW * zoomVal;
    const maxOffsetX = padPx;
    const minOffsetY = vh - padPx - sceneH * zoomVal;
    const maxOffsetY = padPx;

    let x = offsetCandidate.x;
    if (minOffsetX > maxOffsetX) x = vw / 2 - (sceneW / 2) * zoomVal;
    else if (!allowOverscroll) x = Math.min(maxOffsetX, Math.max(minOffsetX, x));

    let y = offsetCandidate.y;
    if (minOffsetY > maxOffsetY) y = vh / 2 - (sceneH / 2) * zoomVal;
    else if (!allowOverscroll) y = Math.min(maxOffsetY, Math.max(minOffsetY, y));

    return { x, y };
  }, [mmToPx]);

  // Smooth zoom/offset animation loop
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      setZoom((z) => {
        const dz = targetZoom.current - z;
        if (Math.abs(dz) < 0.001) return targetZoom.current;
        return z + dz * 0.2;
      });
      setOffset((o) => {
        const dx = targetOffset.current.x - o.x;
        const dy = targetOffset.current.y - o.y;
        if (Math.abs(dx) < 0.1 && Math.abs(dy) < 0.1) {
          return clampOffset(targetOffset.current, targetZoom.current, false);
        }
        return clampOffset({ x: o.x + dx * 0.2, y: o.y + dy * 0.2 }, targetZoom.current, false);
      });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [clampOffset]);

  // Wheel handler for zoom/pan
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const isPixelMode = e.deltaMode === WheelEvent.DOM_DELTA_PIXEL;
      const absDeltaY = Math.abs(e.deltaY);
      const absDeltaX = Math.abs(e.deltaX);
      const isTrackpadLike = isPixelMode && absDeltaY < 80 && absDeltaX < 80;
      const shouldZoom = e.ctrlKey || e.metaKey || (!isTrackpadLike && absDeltaY > absDeltaX && absDeltaY > 0);

      if (shouldZoom) {
        const rect = el.getBoundingClientRect();
        const cursor = { x: e.clientX - rect.left, y: e.clientY - rect.top };
        const sceneX = (cursor.x - targetOffset.current.x) / targetZoom.current;
        const sceneY = (cursor.y - targetOffset.current.y) / targetZoom.current;
        const delta = -e.deltaY * 0.001;
        const newZoom = Math.min(1000000, Math.max(MIN_ZOOM_BASE, targetZoom.current + delta));
        
        targetZoom.current = newZoom;
        targetOffset.current = clampOffset({
          x: cursor.x - sceneX * newZoom,
          y: cursor.y - sceneY * newZoom,
        }, newZoom, false);
        return;
      }

      targetOffset.current = clampOffset({
        x: targetOffset.current.x - e.deltaX,
        y: targetOffset.current.y - e.deltaY,
      }, targetZoom.current, false);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [clampOffset]);

  // Initial centering and resize handling
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const enforceMin = () => {
      const rect = el.getBoundingClientRect();
      const minW = rect.width / scenePxWNoZoom;
      const minH = rect.height / scenePxHNoZoom;
      const minZoom = Math.min(minW, minH) * MIN_ZOOM_PADDING;
      const clampedMin = Math.max(MIN_ZOOM_BASE, Math.min(3, minZoom));
      
      if (targetZoom.current < clampedMin) {
        targetZoom.current = clampedMin;
        targetOffset.current = clampOffset({
          x: rect.width / 2 - (scenePxWNoZoom * clampedMin) / 2,
          y: rect.height / 2 - (scenePxHNoZoom * clampedMin) / 2,
        }, clampedMin, false);
      } else {
        targetOffset.current = clampOffset(targetOffset.current, targetZoom.current, false);
      }
    };
    enforceMin();
    window.addEventListener("resize", enforceMin);
    return () => window.removeEventListener("resize", enforceMin);
  }, [scenePxWNoZoom, scenePxHNoZoom, clampOffset]);

  const isSpaceDown = useRef(false);
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => { if (e.code === "Space") isSpaceDown.current = true; };
    const onKeyUp = (e: KeyboardEvent) => { if (e.code === "Space") isSpaceDown.current = false; };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => { window.removeEventListener("keydown", onKeyDown); window.removeEventListener("keyup", onKeyUp); };
  }, []);

  const handlePointerDown = (e: React.MouseEvent) => {
    if (contextMenu) setContextMenu(null);
    if (e.button === 1 || isSpaceDown.current) {
      e.preventDefault();
      isPanning.current = true;
      lastPanPos.current = { x: e.clientX, y: e.clientY };
      const onDocMove = (ev: MouseEvent) => {
        if (!isPanning.current) return;
        const dx = ev.clientX - lastPanPos.current.x;
        const dy = ev.clientY - lastPanPos.current.y;
        lastPanPos.current = { x: ev.clientX, y: ev.clientY };
        const clamped = clampOffset({ x: targetOffset.current.x + dx, y: targetOffset.current.y + dy }, targetZoom.current, false);
        setOffset(clamped);
        targetOffset.current = clamped;
      };
      const onDocUp = () => {
        isPanning.current = false;
        document.removeEventListener("mousemove", onDocMove);
        document.removeEventListener("mouseup", onDocUp);
      };
      document.addEventListener("mousemove", onDocMove);
      document.addEventListener("mouseup", onDocUp);
    }
  };

  const { straightenPath } = useDrawingLogic();
  const groupScaleCenterRef = useRef<{ x: number; y: number } | null>(null);
  const mouseRefs = useCanvasMouseHandlers({
    workspaceZoom, mmToPx, canvasPos, setCanvasPos, canvas, clientToCanvasMM, straightenPath, groupScaleCenterRef
  });
  const { copiedAssetId } = useCanvasKeyboardHandlers();
  const assetHandlers = useAssetHandlers({ clientToCanvasMM, mouseRefs, groupScaleCenterRef });
  
  const closeContextMenu = useCallback(() => setContextMenu(null), []);
  const handleAssetContextMenu = useCallback((e: React.MouseEvent, assetId: string) => {
    e.preventDefault(); e.stopPropagation(); setContextMenu({ x: e.clientX, y: e.clientY, assetId });
  }, []);

  const anchorMenuOptions: { id: AnchorType; label: string }[] = [
    { id: "top-left", label: "↖ Top-Left" },
    { id: "top-center", label: "↑ Top-Center" },
    { id: "top-right", label: "↗ Top-Right" },
    { id: "left-center", label: "← Left-Center" },
    { id: "center", label: "⊙ Center" },
    { id: "right-center", label: "→ Right-Center" },
    { id: "bottom-left", label: "↙ Bottom-Left" },
    { id: "bottom-center", label: "↓ Bottom-Center" },
    { id: "bottom-right", label: "↘ Bottom-Right" },
  ];

  const handleSnapMenuSelect = useCallback((anchorId: AnchorType) => {
    if (!contextMenu) return;
    if (!snapSourceAssetId || !snapSourceAnchor || contextMenu.assetId === snapSourceAssetId) {
      setSnapSource(contextMenu.assetId, anchorId);
      setSnapTarget(null, null);
      setSnapToAnchorMode(true);
    } else {
      setSnapTarget(contextMenu.assetId, anchorId);
      performSnapToAnchor();
      clearSnapToAnchor();
      setSnapToAnchorMode(false);
    }
    closeContextMenu();
  }, [contextMenu, snapSourceAssetId, snapSourceAnchor, setSnapSource, setSnapTarget, setSnapToAnchorMode, performSnapToAnchor, clearSnapToAnchor, closeContextMenu]);

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const type = e.dataTransfer.getData("assetType");
    if (!type || !canvasRef.current) return;
    const width = parseFloat(e.dataTransfer.getData("assetWidth") || "800");
    const height = parseFloat(e.dataTransfer.getData("assetHeight") || "800");
    const { x, y } = clientToCanvasMM(e.clientX, e.clientY);
    addAsset(type, x, y, width, height);
  };

  const rotateCW = () => setRotation((r) => (r + 90) % 360);
  const rotateCCW = () => setRotation((r) => (r - 90 + 360) % 360);

  // High-performance move handler
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onMouseMove = (e: MouseEvent) => {
      lastMousePosition.current = { x: e.clientX, y: e.clientY };
      const state = useSceneStore.getState();
      const drawingActive = state.isPenMode || state.isWallMode || state.wallDrawingMode || state.shapeMode;
      const rectSelectionMode = state.isRectangularSelectionMode;

      if (!drawingActive && !rectSelectionMode) return;

      const { x, y } = clientToCanvasMM(e.clientX, e.clientY);

      if (rectSelectionMode && state.rectangularSelectionStart) {
        state.updateRectangularSelectionDrag(x, y);
      }

      if (drawingActive) {
        const SNAP_THRESHOLD = 5;
        let snappedX = x;
        let snappedY = y;
        let snapGuides: any[] = [];

        if (state.assets.length > 0) {
          const candidatesX = [SCENE_W_MM / 2];
          const candidatesY = [SCENE_H_MM / 2];
          state.assets.forEach(a => {
            candidatesX.push(a.x); candidatesY.push(a.y);
            const hw = ((a.width || 0) * (a.scale || 1)) / 2;
            const hh = ((a.height || 0) * (a.scale || 1)) / 2;
            candidatesX.push(a.x - hw, a.x + hw);
            candidatesY.push(a.y - hh, a.y + hh);
          });

          let bestX = Infinity, bestY = Infinity;
          let matchedX: number | null = null, matchedY: number | null = null;
          candidatesX.forEach(cx => {
            const d = Math.abs(x - cx);
            if (d < SNAP_THRESHOLD && d < bestX) { bestX = d; matchedX = cx; }
          });
          candidatesY.forEach(cy => {
            const d = Math.abs(y - cy);
            if (d < SNAP_THRESHOLD && d < bestY) { bestY = d; matchedY = cy; }
          });

          if (matchedX !== null) {
            snappedX = matchedX;
            snapGuides.push({ x1: matchedX, y1: 0, x2: matchedX, y2: SCENE_H_MM, type: 'vertical' });
          }
          if (matchedY !== null) {
            snappedY = matchedY;
            snapGuides.push({ x1: 0, y1: matchedY, x2: SCENE_W_MM, y2: matchedY, type: 'horizontal' });
          }
        }
        state.setSnapGuides(snapGuides);

        if (state.shapeMode && state.shapeStart) {
          let end = { x: snappedX, y: snappedY };
          if (e.shiftKey && (state.shapeMode === "rectangle" || state.shapeMode === "ellipse")) {
            const dx = end.x - state.shapeStart.x;
            const dy = end.y - state.shapeStart.y;
            const size = Math.max(Math.abs(dx), Math.abs(dy));
            end = { x: state.shapeStart.x + Math.sign(dx || 1) * size, y: state.shapeStart.y + Math.sign(dy || 1) * size };
          }
          state.updateShapeTempEnd(end);
        }

        if ((state.wallDrawingMode || state.isWallMode) && state.currentWallStart) {
          let wX = snappedX, wY = snappedY;
          if (state.currentWallSegments?.length > 0) {
            const first = state.currentWallSegments[0].start;
            if (Math.hypot(wX - first.x, wY - first.y) <= 6) { wX = first.x; wY = first.y; }
          }
          state.updateWallTempEnd({ x: wX, y: wY });
        }
      }
    };
    el.addEventListener("mousemove", onMouseMove);
    return () => el.removeEventListener("mousemove", onMouseMove);
  }, [clientToCanvasMM]);

  const globalPos = useProjectStore(s => s.globalTableNumberingPosition);
  const globalOrientation = useProjectStore(s => s.globalTableNumberingOrientation);

  // Optimized asset list with culling
  const MemoizedAssetList = useMemo(() => {
    const viewportPad = 1000;
    const vLeft = (-offset.x / zoom) / mmToPx - viewportPad;
    const vTop = (-offset.y / zoom) / mmToPx - viewportPad;
    const vRight = ((-offset.x + (containerRef.current?.offsetWidth || 2000)) / zoom) / mmToPx + viewportPad;
    const vBottom = ((-offset.y + (containerRef.current?.offsetHeight || 2000)) / zoom) / mmToPx + viewportPad;

    const visibleAssets = assets.filter(a => a.x > vLeft && a.x < vRight && a.y > vTop && a.y < vBottom);

    return visibleAssets
      .slice()
      .sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0))
      .map(asset => {
        const isSelected = asset.id === selectedAssetId;
        const isMultiSelected = selectedAssetIds.includes(asset.id);
        const isCopied = asset.id === copiedAssetId;
        const leftPx = asset.x * mmToPx;
        const topPx = asset.y * mmToPx;

        return (
          <div key={asset.id} style={{ pointerEvents: isDrawingActive ? 'none' : 'auto' }}>
            {asset.isGroup ? (
              <GroupRenderer
                group={asset} isSelected={isSelected} isMultiSelected={isMultiSelected}
                leftPx={leftPx} topPx={topPx} mmToPx={mmToPx}
                onAssetClick={selectAsset}
                onAssetDoubleClick={(id) => {
                  const a = assets.find(x => x.id === id);
                  if (a?.isGroup) updateAsset(id, { groupExpanded: !a.groupExpanded });
                }}
                onAssetMouseDown={assetHandlers.onAssetMouseDown}
                onAssetMouseMove={() => {}}
                onAssetMouseUp={() => {}}
                onAssetMouseLeave={() => {}}
                onAssetMouseEnter={() => {}}
                onAssetMouseOver={() => {}}
                onAssetMouseOut={() => {}}
                onAssetContextMenu={handleAssetContextMenu}
                onScaleHandleMouseDown={assetHandlers.onScaleHandleMouseDown}
                onRotationHandleMouseDown={assetHandlers.onRotationHandleMouseDown}
                selectedAssetId={selectedAssetId}
                selectedAssetIds={selectedAssetIds}
              />
            ) : (
              <AssetRenderer
                asset={asset} updateAsset={updateAsset} isSelected={isSelected} isMultiSelected={isMultiSelected}
                isCopied={isCopied} leftPx={leftPx} topPx={topPx} totalRotation={asset.rotation}
                editingTextId={assetHandlers.editingTextId}
                onAssetMouseDown={assetHandlers.onAssetMouseDown}
                onTextDoubleClick={assetHandlers.onTextDoubleClick}
                onTextEditBlur={assetHandlers.onTextEditBlur}
                onScaleHandleMouseDown={assetHandlers.onScaleHandleMouseDown}
                onRotationHandleMouseDown={assetHandlers.onRotationHandleMouseDown}
                onAssetContextMenu={handleAssetContextMenu}
                globalPos={globalPos} globalOrientation={globalOrientation}
              />
            )}
          </div>
        );
      });
  }, [assets, offset, zoom, mmToPx, selectedAssetId, selectedAssetIds, copiedAssetId, isDrawingActive, assetHandlers, selectAsset, updateAsset, handleAssetContextMenu, globalPos, globalOrientation]);

  return (
    <div
      ref={containerRef}
      className="w-full h-full overflow-hidden bg-gray-50"
      onMouseDown={(e) => {
        if (e.button !== 0) return;
        if (isDrawingActive) {
          e.stopPropagation();
          const { x, y } = clientToCanvasMM(e.clientX, e.clientY);
          if (isPenMode) {
            currentDrawingPath.current = [{ x, y }];
            setIsDrawing(true); setCurrentPath([{ x, y }]); setTempPath([{ x, y }]);
          } else if (isWallMode || wallDrawingMode) {
            if (!currentWallStart) {
              let startPoint = { x, y };
              const wallAssets = assets.filter(a => a.wallSegments?.length);
              let closest = null, closestDist = Infinity;
              wallAssets.forEach(a => a.wallSegments!.forEach(seg => {
                const absS = { x: seg.start.x + a.x, y: seg.start.y + a.y };
                const absE = { x: seg.end.x + a.x, y: seg.end.y + a.y };
                const dS = Math.hypot(x - absS.x, y - absS.y);
                const dE = Math.hypot(x - absE.x, y - absE.y);
                if (dS < closestDist) { closestDist = dS; closest = absS; }
                if (dE < closestDist) { closestDist = dE; closest = absE; }
              }));
              if (closest && closestDist <= 6) startPoint = closest;
              startWallSegment(startPoint);
            }
          } else if (shapeMode) {
            startShape({ x, y });
          }
          return;
        }
        
        if (snapToAnchorMode) {
          e.stopPropagation(); e.preventDefault();
          const { x, y } = clientToCanvasMM(e.clientX, e.clientY);
          let clickedAnchor = null;
          for (const asset of assets) {
            const anchors = asset.type === "square" || asset.type === "circle" 
              ? calculateShapeAnchors({ x: asset.x, y: asset.y, width: asset.width || 0, height: asset.height || 0 } as any)
              : calculateAssetAnchors({ x: asset.x, y: asset.y, width: asset.width || 0, height: asset.height || 0, scale: asset.scale || 1 } as any);
            for (const anchor of anchors) {
              if (Math.hypot(anchor.x - x, anchor.y - y) <= 15) { clickedAnchor = { asset, anchor }; break; }
            }
            if (clickedAnchor) break;
          }

          if (clickedAnchor) {
            const { asset, anchor } = clickedAnchor;
            if (snapSourceAssetId && asset.id === snapSourceAssetId && !snapSourceAnchor) {
              setSnapSource(asset.id, anchor.id); return;
            }
            if (snapSourceAssetId && snapSourceAnchor && snapTargetAssetId && asset.id === snapTargetAssetId && !snapTargetAnchor) {
              setSnapTarget(asset.id, anchor.id); performSnapToAnchor(); setSnapToAnchorMode(false); return;
            }
            return;
          }

          const clickedAsset = assets.find(a => {
            const hw = ((a.width || 0) * (a.scale || 1)) / 2;
            const hh = ((a.height || 0) * (a.scale || 1)) / 2;
            return x >= a.x - hw && x <= a.x + hw && y >= a.y - hh && y <= a.y + hh;
          });

          if (clickedAsset) {
            if (!snapSourceAssetId) {
              setSnapSource(clickedAsset.id, null); return;
            }
            if (snapSourceAssetId && snapSourceAnchor && !snapTargetAssetId && clickedAsset.id !== snapSourceAssetId) {
              const anchors = clickedAsset.type === "square" || clickedAsset.type === "circle"
                ? calculateShapeAnchors({ x: clickedAsset.x, y: clickedAsset.y, width: clickedAsset.width, height: clickedAsset.height } as any)
                : calculateAssetAnchors({ x: clickedAsset.x, y: clickedAsset.y, width: clickedAsset.width, height: clickedAsset.height, scale: clickedAsset.scale } as any);
              const anchor = anchors.find(a => a.id === "center") || anchors[0];
              if (anchor) { setSnapTarget(clickedAsset.id, anchor.id); performSnapToAnchor(); setSnapToAnchorMode(false); }
              return;
            }
          }
          return;
        }

        if (isRectangularSelectionMode) {
          const { x, y } = clientToCanvasMM(e.clientX, e.clientY);
          startRectangularSelectionDrag(x, y); return;
        }

        clearSelection();
        handlePointerDown(e);
      }}
      onContextMenu={(e) => { e.preventDefault(); closeContextMenu(); }}
      data-export-id="canvas-container"
    >
      <div
        className="relative w-full h-full"
        ref={canvasRef}
        style={{ transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoom})`, transformOrigin: "0 0" }}
      >
        <div className="relative" style={{ width: scenePxWNoZoom, height: scenePxHNoZoom }}>
          <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 1 }}>
            <GridOverlay showGrid={showGrid} canvasPxW={scenePxWNoZoom} canvasPxH={scenePxHNoZoom} mmToPx={mmToPx} gridSize={gridSize} />
          </div>

          <div className={`absolute inset-0 ${isDrawingActive ? "pointer-events-none" : ""}`}>
            <UnifiedWallRendering mmToPx={mmToPx} />
          </div>

          <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 50 }}>
            <DrawingPath
              isDrawing={isDrawing} tempPath={tempPath} wallDrawingMode={wallDrawingMode} currentWallSegments={currentWallSegments}
              currentWallStart={currentWallStart} currentWallTempEnd={currentWallTempEnd} assets={assets} 
              canvasPxW={scenePxWNoZoom} canvasPxH={scenePxHNoZoom} mmToPx={mmToPx} lastMousePosition={lastMousePosition.current}
              clientToCanvasMM={clientToCanvasMM} isRectangularSelectionMode={isRectangularSelectionMode}
              rectangularSelectionStart={rectangularSelectionStart} rectangularSelectionEnd={rectangularSelectionEnd}
            />
          </div>

          <div
            data-canvas-container="true"
            className={`relative ${isDrawingActive || isRectangularSelectionMode ? "cursor-crosshair" : ""}`}
            style={{ width: scenePxWNoZoom, height: scenePxHNoZoom, cursor: isRectangularSelectionMode ? "crosshair" : isDrawingActive ? "crosshair !important" : undefined }}
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
            onMouseUp={(e) => {
              if (isRectangularSelectionMode && rectangularSelectionStart) {
                finishRectangularSelectionDrag(); return;
              }
              if ((wallDrawingMode || isWallMode) && currentWallStart) {
                const { x, y } = clientToCanvasMM(e.clientX, e.clientY);
                if (currentWallSegments?.length > 0) {
                  const first = currentWallSegments[0].start;
                  if (Math.hypot(x - first.x, y - first.y) <= 6) { commitWallSegment(); finishWallDrawing(); return; }
                }
                commitWallSegment();
              }
              if (shapeMode && shapeStart) { setSnapGuides([]); finishShape(); }
            }}
          >
            {MemoizedAssetList}

            <CanvasControls selectedAssetId={selectedAssetId} onRotateCW={rotateCW} onRotateCCW={rotateCCW} canvas={canvas} />
            <PatternIndicator />
            <DimensionOverlay mmToPx={mmToPx} />
            <SnapGuidesRenderer mmToPx={mmToPx} workspaceZoom={workspaceZoom} />
            
            <SelectionBox mmToPx={mmToPx} />
            <AnchorHighlights mmToPx={mmToPx} />
          </div>
        </div>
        <ThreeDOverlay />
      </div>

      {/* Context Menu outside transformed content */}
      {contextMenu && (
        <div className="fixed z-50 bg-white border border-gray-200 rounded-md shadow-xl text-sm min-w-[180px]" style={{ top: contextMenu.y, left: contextMenu.x }}>
          <div className="px-3 py-2 text-xs font-semibold text-gray-500 border-b border-gray-100 uppercase">
            {snapSourceAssetId && snapSourceAnchor ? "Use as Anchor" : "Snap to Anchor"}
          </div>
          {anchorMenuOptions.map((opt) => (
            <button key={opt.id} className="w-full px-3 py-2 text-left hover:bg-gray-100 text-gray-800" onClick={() => handleSnapMenuSelect(opt.id)}>
              {opt.label}
            </button>
          ))}
        </div>
      )}

      {/* Status Indicators */}
      <AnimatePresence>
        {isRectangularSelectionMode && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }} className='absolute top-4 left-1/2 -translate-x-1/2 bg-blue-600 text-white px-4 py-2 rounded-lg shadow-lg text-sm whitespace-nowrap z-50'>
            Click and drag to select multiple assets
          </motion.div>
        )}
        {snapToAnchorMode && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }} className='absolute top-4 left-1/2 -translate-x-1/2 bg-green-600 text-white px-4 py-2 rounded-lg shadow-lg text-sm whitespace-nowrap z-50'>
            {!snapSourceAssetId ? "Step 1: Click on the source item" : !snapSourceAnchor ? "Step 2: Click on an anchor on the source" : !snapTargetAssetId ? "Step 3: Click on the target item" : "Step 4: Click on an anchor on the target"}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}