"use client";

import React, { useRef, useEffect, useState, useCallback } from 'react';
import toast from 'react-hot-toast';
import { useEditorStore } from '@/store/editorStore';
import { useProjectStore } from '@/store/projectStore';
import type { Shape, Asset, Wall } from '@/store/projectStore';
import { useSceneStore } from '@/store/sceneStore';
import WallRenderer from './renderers/WallRenderer';
import ShapeRenderer from './renderers/ShapeRenderer';
import AssetRenderer from './renderers/AssetRenderer';
import GridRenderer from './renderers/GridRenderer';
import FreehandRenderer from './renderers/FreehandRenderer';
import { DimensionRenderer } from './renderers/DimensionRenderer';
import CommentRenderer from './renderers/CommentRenderer';
import WallTool from './tools/WallTool';
import ShapeTool from './tools/ShapeTool';
import FreehandTool from './tools/FreehandTool';
import SelectionTool from './tools/SelectionTool';
import DimensionTool from './tools/DimensionTool';
import ArchTool from './tools/ArchTool';
import LabelArrowTool from './tools/LabelArrowTool';
import TextAnnotationTool from './tools/TextAnnotationTool';
import TrimTool from './tools/TrimTool';
import TexturePatternDefs from './TexturePatternDefs';
import { PlacementRenderer } from './renderers/PlacementRenderer';
import LabelArrowRenderer from './renderers/LabelArrowRenderer';
import TextAnnotationRenderer from './renderers/TextAnnotationRenderer';
import SnapGuidesRenderer from './renderers/SnapGuidesRenderer';
import SnapMarkersRenderer from './renderers/SnapMarkersRenderer';
import { AutoDimensionRenderer } from './renderers/AutoDimensionRenderer';
import ContextMenu from './ui/ContextMenu';
import DuplicateDistributeModal from './ui/DuplicateDistributeModal';
import { AnchorType, getAnchorsForObject, snapToObjects } from '@/utils/snapAnchors';

// Safe UUID generator with fallback for non-secure contexts
const generateId = (): string => {
  try {
    return crypto.randomUUID();
  } catch {
    // Fallback for non-secure contexts
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
};

import { ASSET_LIBRARY } from '@/lib/assets';
import { CursorOverlay } from './ui/CursorOverlay';
import type { RemoteCursor } from '@/hooks/useMultiplayer';
import { findSnapPoint } from '@/utils/wallSnapping';
import { convertAssetToShapes } from '@/utils/assetUtils';
import { texturePatterns } from '@/utils/texturePatterns';
import { calculateSmartSnap } from '@/utils/smartSnapping'; // Added import

interface Workspace2DProps {
  width?: number;
  height?: number;
  remoteCursors?: RemoteCursor[];
  updateCursor?: (x: number, y: number) => void;
}

type SnapObject =
  | { type: 'shape'; object: Shape }
  | { type: 'asset'; object: Asset }
  | { type: 'wall'; object: Wall };


export default function Workspace2D({
  width = 1200,
  height = 800,
  remoteCursors = [],
  updateCursor
}: Workspace2DProps) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const [viewportSize, setViewportSize] = useState({ width, height });
  const [mouseWorldPos, setMouseWorldPos] = useState({ x: 0, y: 0 });
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);
  const [isDraggingItem, setIsDraggingItem] = useState(false);
  const [draggedItemStart, setDraggedItemStart] = useState<{ x: number; y: number } | null>(null);
  const [selectionRect, setSelectionRect] = useState<{ x1: number; y1: number; x2: number; y2: number } | null>(null);
  const [gridHud, setGridHud] = useState<{ visible: boolean; message: string }>({ visible: false, message: '' });
  const gridHudTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [activeCommentId, setActiveCommentId] = useState<string | null>(null);
  const [draggedPoint, setDraggedPoint] = useState<{ shapeId: string; pointIndex: number } | null>(null);
  const [contextMenu, setContextMenu] = useState<{
    visible: boolean;
    x: number;
    y: number;
    worldX: number;
    worldY: number;
    targetId: string | null;
  } | null>(null);
  const [duplicateDistributeModal, setDuplicateDistributeModal] = useState<{
    isOpen: boolean;
    mode: 'duplicate' | 'distribute';
  }>({ isOpen: false, mode: 'duplicate' });


  const {
    zoom,
    panX,
    panY,
    activeTool,
    selectedIds,
    hoveredId,
    isPanning,
    snapToGrid,
    gridSize,
    canvasOffset,
    setZoom,
    setPan,
    panBy,
    setPanning,
    zoomIn,
    zoomOut,
    setCanvasOffset,
    setSelectedIds,
    clearSelection,
    isSnapMode,
    snapSourceId,
    snapAnchor,
    setSnapMode,
    setHoveredId,
    snapToObjects: snapToObjectsEnabled,
    toggleSnapToObjects,
    placementMode,
    setPlacementMode,
  } = useEditorStore();

  const {
    walls, shapes, assets, dimensions, comments, textAnnotations, labelArrows, groups,
    updateShape, updateAsset, updateWall, updateDimension, updateTextAnnotation, updateGroup,
    addAsset, addDimension, removeDimension, addGroup,
    addComment, updateComment, removeComment, resolveComment
  } = useProjectStore();

  const sceneStore = useSceneStore();
  const showGrid = sceneStore.showGrid;
  const sceneGridSize = sceneStore.gridSize;
  const availableGridSizes = sceneStore.availableGridSizes || [];
  const selectedGridSizeIndex = sceneStore.selectedGridSizeIndex || 0;
  const currentGridSizeValue = availableGridSizes[selectedGridSizeIndex] || sceneStore.gridSize || 1000;
  const unitSystem = sceneStore.unitSystem || 'metric';
  const setUnitSystem = sceneStore.setUnitSystem;
  const initialGridHudSkip = useRef(true);

  const formatGridSize = useCallback((size: number) => {
    if (unitSystem === 'imperial') {
      const feet = size / 304.8; // mm to feet
      const rounded = feet >= 10 ? feet.toFixed(0) : feet.toFixed(1);
      return `${rounded}ft`;
    }
    if (size >= 1000) {
      const meters = size / 1000;
      return `${Number.isInteger(meters) ? meters : meters.toFixed(1)}m`;
    }
    return `${size}mm`;
  }, [unitSystem]);

  const showGridHud = useCallback((size: number) => {
    if (gridHudTimeoutRef.current) {
      clearTimeout(gridHudTimeoutRef.current);
    }
    setGridHud({
      visible: true,
      message: `Grid auto-adjusted to ${formatGridSize(size)}`,
    });
    gridHudTimeoutRef.current = setTimeout(() => {
      setGridHud({ visible: false, message: '' });
    }, 1600);
  }, [formatGridSize]);

  const snapToGridFn = useCallback(
    (pos: { x: number; y: number }) => {
      if (!snapToGrid) return pos;
      return {
        x: Math.round(pos.x / gridSize) * gridSize,
        y: Math.round(pos.y / gridSize) * gridSize,
      };
    },
    [snapToGrid, gridSize]
  );

  // Use ResizeObserver to track layout changes (size AND position shifts)
  useEffect(() => {
    if (!canvasRef.current) return;

    const updateMetrics = () => {
      if (canvasRef.current) {
        const rect = canvasRef.current.getBoundingClientRect();
        setViewportSize({ width: rect.width, height: rect.height });
        setCanvasOffset({ left: rect.left, top: rect.top });
      }
    };

    // Initial measure
    updateMetrics();

    // Observe changes
    const resizeObserver = new ResizeObserver(() => {
      updateMetrics();
    });

    resizeObserver.observe(canvasRef.current);
    window.addEventListener('resize', updateMetrics); // Fallback/Additional check for window resize events
    window.addEventListener('scroll', updateMetrics); // Check for scroll events that might shift layout

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('resize', updateMetrics);
      window.removeEventListener('scroll', updateMetrics);
    };
  }, [setCanvasOffset]);

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!canvasRef.current) return;

      // Handle panning first
      if (isPanning && dragStart) {
        const currentX = e.clientX;
        const currentY = e.clientY;
        const dx = currentX - dragStart.x;
        const dy = currentY - dragStart.y;

        // Update dragStart FIRST to prevent delta accumulation/jumping
        setDragStart({ x: currentX, y: currentY });

        // Apply pan with natural direction
        panBy(dx, dy);
        return; // Don't process hover when panning
      }

      const rect = canvasRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      const worldX = (x - panX) / zoom;
      const worldY = (y - panY) / zoom;
      setMouseWorldPos({ x: worldX, y: worldY });

      // Hover detection
      let targetId: string | null = null;

      // Check shapes (reverse order for z-index)
      for (let i = shapes.length - 1; i >= 0; i--) {
        const shape = shapes[i];
        const halfW = shape.width / 2;
        const halfH = shape.height / 2;
        if (
          worldX >= shape.x - halfW &&
          worldX <= shape.x + halfW &&
          worldY >= shape.y - halfH &&
          worldY <= shape.y + halfH
        ) {
          targetId = shape.id;
          break;
        }
      }

      // Check assets if no shape was hit
      if (!targetId) {
        for (let i = assets.length - 1; i >= 0; i--) {
          const asset = assets[i];
          if (asset.isExploded) continue; // ignore invisible exploded container
          const halfW = (asset.width * asset.scale) / 2;
          const halfH = (asset.height * asset.scale) / 2;
          if (
            worldX >= asset.x - halfW &&
            worldX <= asset.x + halfW &&
            worldY >= asset.y - halfH &&
            worldY <= asset.y + halfH
          ) {
            targetId = asset.id;
            break;
          }
        }
      }

      // Check walls if no shape or asset was hit
      if (!targetId) {
        for (let i = walls.length - 1; i >= 0; i--) {
          const wall = walls[i];
          let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
          wall.nodes.forEach(node => {
            minX = Math.min(minX, node.x);
            minY = Math.min(minY, node.y);
            maxX = Math.max(maxX, node.x);
            maxY = Math.max(maxY, node.y);
          });
          if (
            worldX >= minX &&
            worldX <= maxX &&
            worldY >= minY &&
            worldY <= maxY
          ) {
            targetId = wall.id;
            break;
          }
        }
      }

      setHoveredId(targetId);

      // Broadcast cursor position to other users
      if (updateCursor) {
        updateCursor(x, y);
      }

      if (isDraggingItem && draggedItemStart && selectedIds.length > 0) {
        let finalX = worldX;
        let finalY = worldY;
        let guides: any[] = [];

        if (snapToObjectsEnabled && selectedIds.length === 1) {
          const id = selectedIds[0];
          let itemBounds: any = null;

          const shape = shapes.find(s => s.id === id);
          if (shape) {
            itemBounds = {
              x: shape.x + (worldX - draggedItemStart.x),
              y: shape.y + (worldY - draggedItemStart.y),
              width: shape.width,
              height: shape.height,
              id: shape.id
            };
          } else {
            const asset = assets.find(a => a.id === id);
            if (asset) {
              itemBounds = {
                x: asset.x + (worldX - draggedItemStart.x),
                y: asset.y + (worldY - draggedItemStart.y),
                width: (asset.width || 0) * (asset.scale || 1),
                height: (asset.height || 0) * (asset.scale || 1),
                rotation: asset.rotation,
                id: asset.id
              };
            }
          }

          if (itemBounds) {
            // Collect targets
            const targets = [
              ...shapes.filter(s => s.id !== id).map(s => ({
                x: s.x, y: s.y, width: s.width, height: s.height, id: s.id
              })),
              ...assets.filter(a => a.id !== id).map(a => ({
                x: a.x,
                y: a.y,
                width: (a.width || 0) * (a.scale || 1),
                height: (a.height || 0) * (a.scale || 1),
                id: a.id
              })),
              ...walls.filter(w => w.id !== id).map(w => {
                // Calculate wall bounding box from nodes
                let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
                w.nodes.forEach(n => {
                  minX = Math.min(minX, n.x);
                  minY = Math.min(minY, n.y);
                  maxX = Math.max(maxX, n.x);
                  maxY = Math.max(maxY, n.y);
                });
                return {
                  x: (minX + maxX) / 2,
                  y: (minY + maxY) / 2,
                  width: maxX - minX,
                  height: maxY - minY,
                  id: w.id
                };
              })
            ];

            // Use our new smart snapping calc
            const result = calculateSmartSnap(itemBounds, targets as any[], 10 / zoom);

            // result.dx/dy are the adjustments to the PROPOSED position (itemBounds)
            // So final position = itemBounds.x + result.dx
            // We need to set finalX such that finalX - draggedItemStart.x = itemBounds.x + result.dx - shape.x
            // finalX = itemBounds.x + result.dx - shape.x + draggedItemStart.x
            // Substituting itemBounds.x:
            // finalX = (shape.x + worldX - draggedItemStart.x) + result.dx - shape.x + draggedItemStart.x
            // finalX = worldX + result.dx

            finalX = worldX + result.dx;
            finalY = worldY + result.dy;

            guides = result.guides;
          }

        } else {
          // Standard Grid Snap
          const snapped = snapToGridFn({ x: worldX, y: worldY });
          finalX = snapped.x;
          finalY = snapped.y;

          // Wall snapping priority (legacy)
          if (walls.length > 0) {
            const wallSnap = findSnapPoint(
              { x: worldX, y: worldY },
              walls,
              snapToGrid,
              gridSize,
              15
            );
            if (wallSnap.snapped && wallSnap.snapType !== 'grid') {
              finalX = wallSnap.x;
              finalY = wallSnap.y;
            }
          }
        }

        // Update guides
        sceneStore.setSnapGuides(guides);

        const snappedDx = finalX - draggedItemStart.x;
        const snappedDy = finalY - draggedItemStart.y;

        selectedIds.forEach((id) => {
          const shape = shapes.find((s) => s.id === id);
          if (shape) {
            updateShape(id, {
              x: shape.x + snappedDx,
              y: shape.y + snappedDy,
            }, true);
          }

          const asset = assets.find((a) => a.id === id);
          if (asset) {
            updateAsset(id, {
              x: asset.x + snappedDx,
              y: asset.y + snappedDy,
            }, true);
          }

          const wall = walls.find((w) => w.id === id);
          if (wall) {
            const newNodes = wall.nodes.map(node => ({
              ...node,
              x: node.x + snappedDx,
              y: node.y + snappedDy
            }));
            updateWall(id, { nodes: newNodes }, true);
          }

          const textAnnotation = textAnnotations.find((t) => t.id === id);
          if (textAnnotation) {
            useProjectStore.getState().updateTextAnnotation(id, {
              x: textAnnotation.x + snappedDx,
              y: textAnnotation.y + snappedDy,
            });
          }

          const labelArrow = labelArrows.find((l) => l.id === id);
          if (labelArrow) {
            useProjectStore.getState().updateLabelArrow(id, {
              startPoint: {
                x: labelArrow.startPoint.x + snappedDx,
                y: labelArrow.startPoint.y + snappedDy,
              },
              endPoint: {
                x: labelArrow.endPoint.x + snappedDx,
                y: labelArrow.endPoint.y + snappedDy,
              },
            });
          }

          const dimension = dimensions.find((d) => d.id === id);
          if (dimension) {
            useProjectStore.getState().updateDimension(id, {
              startPoint: {
                x: dimension.startPoint.x + snappedDx,
                y: dimension.startPoint.y + snappedDy,
              },
              endPoint: {
                x: dimension.endPoint.x + snappedDx,
                y: dimension.endPoint.y + snappedDy,
              },
            });
          }
        });

        setDraggedItemStart({ x: finalX, y: finalY });
      }

      // Update selection rectangle if dragging to select
      if (selectionRect && dragStart) {
        setSelectionRect({
          x1: (dragStart.x - panX) / zoom,
          y1: (dragStart.y - panY) / zoom,
          x2: worldX,
          y2: worldY
        });
      }
    },
    [panX, panY, zoom, isPanning, dragStart, panBy, isDraggingItem, draggedItemStart, selectedIds, shapes, assets, walls, textAnnotations, labelArrows, dimensions, updateShape, updateAsset, updateWall, snapToGridFn, selectionRect, updateCursor, setHoveredId, draggedPoint]
  );

  const handleDoubleClick = useCallback(
    (e: React.MouseEvent) => {
      if (!canvasRef.current) return;
      const rect = canvasRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const worldX = (x - panX) / zoom;
      const worldY = (y - panY) / zoom;

      // Check for asset hit (Assets are rendered on top of shapes)
      for (let i = assets.length - 1; i >= 0; i--) {
        const asset = assets[i];
        const halfW = (asset.width * asset.scale) / 2;
        const halfH = (asset.height * asset.scale) / 2;
        if (
          worldX >= asset.x - halfW &&
          worldX <= asset.x + halfW &&
          worldY >= asset.y - halfH &&
          worldY <= asset.y + halfH
        ) {
          // Explode asset
          if (asset.isExploded) {
            toast("Asset already exploded.");
            return;
          }

          // Optimize explosion with batched updates using requestAnimationFrame
          convertAssetToShapes(asset).then((newShapes) => {
            if (newShapes.length > 0) {
              const store = useProjectStore.getState();
              // Batch all shape additions in a single update
              requestAnimationFrame(() => {
                const batchSize = 50; // Process in batches to avoid blocking
                let index = 0;

                const addBatch = () => {
                  const end = Math.min(index + batchSize, newShapes.length);
                  for (let i = index; i < end; i++) {
                    store.addShape(newShapes[i]);
                  }
                  index = end;

                  if (index < newShapes.length) {
                    requestAnimationFrame(addBatch);
                  } else {
                    // All shapes added, now create a group for them
                    const groupId = `group-${Date.now()}`;
                    const newGroup = {
                      id: groupId,
                      itemIds: newShapes.map((s) => s.id),
                      zIndex: asset.zIndex,
                    };
                    store.addGroup(newGroup);

                    // Update asset and selection
                    store.updateAsset(asset.id, {
                      isExploded: true,
                      childShapeIds: newShapes.map((s) => s.id),
                    });

                    // Select the group instead of individual shapes
                    setSelectedIds([groupId]);
                    toast.success("Asset exploded into a group!");
                  }
                };

                addBatch();
              });
            } else {
              toast.error("Could not convert asset to shapes.");
            }
          });
          return;
        }
      }

      // Check for shape hit
      for (let i = shapes.length - 1; i >= 0; i--) {
        const shape = shapes[i];
        const halfW = shape.width / 2;
        const halfH = shape.height / 2;

        // Simple bounding box check (ignoring rotation for hit test simplicity)
        if (
          worldX >= shape.x - halfW &&
          worldX <= shape.x + halfW &&
          worldY >= shape.y - halfH &&
          worldY <= shape.y + halfH
        ) {
          // Convert to polygon if rectangle or ellipse
          /* 
          // DISABLED: User requested to disable double-click conversion for shapes
          if (shape.type === 'rectangle' || shape.type === 'ellipse') {
            let pts: { x: number, y: number }[] = [];
            if (shape.type === 'rectangle') {
              pts = [
                { x: -halfW, y: -halfH },
                { x: halfW, y: -halfH },
                { x: halfW, y: halfH },
                { x: -halfW, y: halfH }
              ];
            } else {
              // Ellipse approximation (16 points)
              const sides = 16;
              for (let j = 0; j < sides; j++) {
                const angle = (Math.PI * 2 * j) / sides;
                pts.push({
                  x: Math.cos(angle) * halfW,
                  y: Math.sin(angle) * halfH
                });
              }
            }

            updateShape(shape.id, {
              type: 'polygon',
              points: pts,
              polygonSides: pts.length
            });
            toast.success("Converted to editable polygon");
            setSelectedIds([shape.id]);
          } else */
          if (shape.type === 'polygon' || shape.type === 'line') {
            // Already editable, just ensure selected
            setSelectedIds([shape.id]);
          }
          return;
        }
      }
    },
    [panX, panY, zoom, shapes, assets, updateShape, setSelectedIds]
  );

  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      e.preventDefault(); // Always prevent default scroll

      if (e.shiftKey) {
        // Pan with Shift+Wheel
        panBy(-e.deltaX, -e.deltaY);
      } else {
        // Zoom by default (centered on cursor)
        const rect = canvasRef.current?.getBoundingClientRect();
        if (!rect) return;

        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        // Calculate world position before zoom
        const worldXBefore = (mouseX - panX) / zoom;
        const worldYBefore = (mouseY - panY) / zoom;

        // Apply zoom
        const delta = e.deltaY;
        const zoomFactor = delta > 0 ? 0.9 : 1.1; // Zoom out if scrolling down, in if scrolling up
        const newZoom = Math.max(0.000001, Math.min(1000000, zoom * zoomFactor));

        // Calculate world position after zoom
        const worldXAfter = (mouseX - panX) / newZoom;
        const worldYAfter = (mouseY - panY) / newZoom;

        // Adjust pan to keep cursor at same world position
        const newPanX = panX + (worldXAfter - worldXBefore) * newZoom;
        const newPanY = panY + (worldYAfter - worldYBefore) * newZoom;

        setZoom(newZoom);
        setPan(newPanX, newPanY);
      }
    },
    [zoom, panX, panY, setZoom, setPan, panBy]
  );

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (!canvasRef.current) return;

      const rect = canvasRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const worldX = (x - panX) / zoom;
      const worldY = (y - panY) / zoom;

      if (e.button === 1 || (e.button === 0 && (e.shiftKey || activeTool === 'pan'))) {
        setPanning(true);
        // Use clientX/clientY to match handleMouseMove coordinate system
        setDragStart({ x: e.clientX, y: e.clientY });
        e.preventDefault();
        return;
      }

      if (e.button === 0) {
        // Check for control point hit on selected shapes
        for (const id of selectedIds) {
          const shape = shapes.find(s => s.id === id);
          if (shape && (shape.type === 'polygon' || shape.type === 'line') && shape.points) {
            // Transform mouse to local shape coordinates
            // Assuming rotation is 0 for simplicity or small enough. 
            // For exactness we should rotate mouse point.
            const dx = worldX - shape.x;
            const dy = worldY - shape.y;
            // Rotate point by -rotation
            const rad = -shape.rotation * (Math.PI / 180);
            const localX = dx * Math.cos(rad) - dy * Math.sin(rad);
            const localY = dx * Math.sin(rad) + dy * Math.cos(rad);

            for (let i = 0; i < shape.points.length; i++) {
              const p = shape.points[i];
              const dist = Math.hypot(localX - p.x, localY - p.y);
              if (dist < 10 / zoom) { // 10px tolerance
                setDraggedPoint({ shapeId: shape.id, pointIndex: i });
                e.stopPropagation(); // Prevent drag start
                return;
              }
            }
          }
        }

        // Don't handle clicks when text-annotation tool is active AND tool is focused on creating
        // But still allow selection of existing items when no tool explicitly active (activeTool may be undefined/null)
        if (activeTool === 'text-annotation') {
          // Check if we clicked on an existing text annotation
          let hitExistingText = false;
          for (let i = textAnnotations.length - 1; i >= 0; i--) {
            const annotation = textAnnotations[i];
            const fontSize = annotation.fontSize || 14;
            const textLength = annotation.text.length || 1;
            const estimatedWidth = textLength * fontSize * 0.6;
            const estimatedHeight = fontSize * 1.2;
            const hitRadius = Math.max(Math.max(estimatedWidth, estimatedHeight) / 2, 30);

            const dist = Math.hypot(worldX - annotation.x, worldY - annotation.y);
            if (dist <= hitRadius) {
              hitExistingText = true;
              break;
            }
          }

          // If we didn't hit existing text, let the tool handle creation
          if (!hitExistingText) {
            return;
          }
          // If we DID hit existing text, fall through to selection logic below
        }



        // Handle Rectangular Selection
        if (sceneStore.isRectangularSelectionMode) {
          setSelectionRect({ x1: worldX, y1: worldY, x2: worldX, y2: worldY });
          return;
        }

        // Handle Snap to Anchor Mode - Click anywhere on target object
        if (isSnapMode && snapSourceId && snapAnchor) {
          let targetHit: SnapObject | null = null;

          // Check if clicked on a shape
          for (const shape of shapes) {
            if (shape.id === snapSourceId) continue;
            const width = shape.width || 100;
            const height = shape.height || 100;
            const halfW = width / 2;
            const halfH = height / 2;
            if (
              worldX >= shape.x - halfW &&
              worldX <= shape.x + halfW &&
              worldY >= shape.y - halfH &&
              worldY <= shape.y + halfH
            ) {
              targetHit = { type: 'shape', object: shape };
              break;
            }
          }

          // Check if clicked on an asset
          if (!targetHit) {
            for (const asset of assets) {
              if (asset.isExploded) continue;
              if (asset.id === snapSourceId) continue;
              const width = asset.width || 100;
              const height = asset.height || 100;
              const scale = asset.scale || 1;
              const halfW = (width * scale) / 2;
              const halfH = (height * scale) / 2;
              if (
                worldX >= asset.x - halfW &&
                worldX <= asset.x + halfW &&
                worldY >= asset.y - halfH &&
                worldY <= asset.y + halfH
              ) {
                targetHit = { type: 'asset', object: asset };
                break;
              }
            }
          }

          // Check if clicked on a wall (use its bounding box)
          if (!targetHit) {
            for (const wall of walls) {
              if (wall.id === snapSourceId) continue;
              if (!wall.nodes || wall.nodes.length === 0) continue;

              let minX = Infinity,
                minY = Infinity,
                maxX = -Infinity,
                maxY = -Infinity;
              wall.nodes.forEach((node) => {
                minX = Math.min(minX, node.x);
                minY = Math.min(minY, node.y);
                maxX = Math.max(maxX, node.x);
                maxY = Math.max(maxY, node.y);
              });

              if (worldX >= minX && worldX <= maxX && worldY >= minY && worldY <= maxY) {
                targetHit = { type: 'wall', object: wall };
                break;
              }
            }
          }

          // If clicked on an object, snap to its nearest anchor
          if (targetHit) {
            const targetAnchors = getAnchorsForObject(targetHit);

            if (targetAnchors && targetAnchors.length > 0) {
              // Find nearest anchor to click point
              let nearestAnchor = targetAnchors[0];
              let minDist = Math.hypot(worldX - nearestAnchor.x, worldY - nearestAnchor.y);

              for (const anchor of targetAnchors) {
                const dist = Math.hypot(worldX - anchor.x, worldY - anchor.y);
                if (dist < minDist) {
                  minDist = dist;
                  nearestAnchor = anchor;
                }
              }

              const sourceShape = shapes.find((s) => s.id === snapSourceId);
              const sourceAsset = assets.find((a) => a.id === snapSourceId);
              let sourceHit: SnapObject | null = null;

              if (sourceShape) {
                sourceHit = { type: 'shape', object: sourceShape };
              } else if (sourceAsset) {
                sourceHit = { type: 'asset', object: sourceAsset };
              }

              if (!sourceHit) {
                console.warn('Snap mode: source object not found or unsupported', { snapSourceId });
                setSnapMode(false);
                return;
              }

              const sourceAnchors = getAnchorsForObject(sourceHit);

              if (sourceAnchors) {
                const sourceAnchorPoint = sourceAnchors.find((a) => a.id === snapAnchor);

                if (sourceAnchorPoint) {
                  const sourceObj = sourceHit.object as Shape | Asset;
                  const offsetX = sourceAnchorPoint.x - sourceObj.x;
                  const offsetY = sourceAnchorPoint.y - sourceObj.y;
                  const newX = nearestAnchor.x - offsetX;
                  const newY = nearestAnchor.y - offsetY;

                  if (sourceHit.type === 'shape') {
                    updateShape(snapSourceId, { x: newX, y: newY });
                  } else if (sourceHit.type === 'asset') {
                    updateAsset(snapSourceId, { x: newX, y: newY });
                  }

                  console.log(
                    `Snapped ${snapSourceId} anchor:${snapAnchor} to ${targetHit.object.id} anchor:${nearestAnchor.id}`
                  );
                }
              }
            }
            setSnapMode(false);
          }
          // Always stop here while snap mode is active so normal selection logic doesn't clear the state
          return;
        }

        // Normal Selection Logic
        if (activeTool === 'select') {
          let itemSelected = false;

          // Check dimensions FIRST (before shapes/assets) so they're easier to select
          for (let i = dimensions.length - 1; i >= 0; i--) {
            const dim = dimensions[i];
            // Hit-test the dimension line (the offset line, not the extension lines)
            const dx = dim.endPoint.x - dim.startPoint.x;
            const dy = dim.endPoint.y - dim.startPoint.y;
            const length = Math.sqrt(dx * dx + dy * dy);
            if (length === 0) continue;

            const nx = dx / length;
            const ny = dy / length;
            const px = -ny;
            const py = nx;

            // Calculate dimension line position
            const p1x = dim.startPoint.x + px * dim.offset;
            const p1y = dim.startPoint.y + py * dim.offset;
            const p2x = dim.endPoint.x + px * dim.offset;
            const p2y = dim.endPoint.y + py * dim.offset;

            // Hit-test the dimension line
            const lineDx = p2x - p1x;
            const lineDy = p2y - p1y;
            const lineLengthSquared = lineDx * lineDx + lineDy * lineDy;
            if (lineLengthSquared === 0) continue;

            const t = Math.max(
              0,
              Math.min(
                1,
                ((worldX - p1x) * lineDx + (worldY - p1y) * lineDy) / lineLengthSquared
              )
            );

            const projX = p1x + t * lineDx;
            const projY = p1y + t * lineDy;
            const dist = Math.sqrt((worldX - projX) ** 2 + (worldY - projY) ** 2);

            // Also check if clicking near the text (midpoint)
            const midX = (p1x + p2x) / 2;
            const midY = (p1y + p2y) / 2;
            const distToText = Math.sqrt((worldX - midX) ** 2 + (worldY - midY) ** 2);

            // Also check extension lines
            const distToStart = Math.sqrt((worldX - dim.startPoint.x) ** 2 + (worldY - dim.startPoint.y) ** 2);
            const distToEnd = Math.sqrt((worldX - dim.endPoint.x) ** 2 + (worldY - dim.endPoint.y) ** 2);

            const hitRadius = 40; // Even larger hit radius for easier clicking
            const textHitRadius = 50; // Larger radius for text area
            const extensionHitRadius = 30; // For extension lines

            if (dist <= hitRadius || distToText <= textHitRadius || distToStart <= extensionHitRadius || distToEnd <= extensionHitRadius) {
              if (selectedIds.includes(dim.id)) {
                useProjectStore.getState().saveToHistory();
                setIsDraggingItem(true);
                setDraggedItemStart({ x: worldX, y: worldY });
              } else {
                setSelectedIds([dim.id]);
                sceneStore.selectMultipleAssets([dim.id]);
              }
              itemSelected = true;
              return;
            }
          }

          // Check shapes (reverse order for z-index)
          for (let i = shapes.length - 1; i >= 0; i--) {
            const shape = shapes[i];

            // Improved hit-test for lines/arrows so you can click anywhere on the visible stroke,
            // not just inside the tiny bounding box.
            if (shape.type === 'line' || shape.type === 'arrow') {
              const thickness = (shape.strokeWidth ?? 20) / 2 + 10; // extra padding

              // If this is a polyline, test each segment
              if (shape.points && shape.points.length >= 2) {
                let hit = false;
                for (let s = 0; s < shape.points.length - 1; s++) {
                  const p1 = shape.points[s];
                  const p2 = shape.points[s + 1];
                  const ax = shape.x + p1.x;
                  const ay = shape.y + p1.y;
                  const bx = shape.x + p2.x;
                  const by = shape.y + p2.y;

                  const dx = bx - ax;
                  const dy = by - ay;
                  const lenSq = dx * dx + dy * dy;
                  if (lenSq === 0) continue;
                  const t = Math.max(0, Math.min(1, ((worldX - ax) * dx + (worldY - ay) * dy) / lenSq));
                  const projX = ax + t * dx;
                  const projY = ay + t * dy;
                  const dist = Math.hypot(worldX - projX, worldY - projY);
                  if (dist <= thickness) {
                    hit = true;
                    break;
                  }
                }

                if (!hit) {
                  continue;
                }
              } else {
                // Legacy straight line/arrow defined by width + rotation
                const rot = (shape.rotation || 0) * (Math.PI / 180);
                const cosR = Math.cos(rot);
                const sinR = Math.sin(rot);
                const halfLen = shape.width / 2;
                const ax = shape.x - halfLen * cosR;
                const ay = shape.y - halfLen * sinR;
                const bx = shape.x + halfLen * cosR;
                const by = shape.y + halfLen * sinR;
                const dx = bx - ax;
                const dy = by - ay;
                const lenSq = dx * dx + dy * dy;
                if (lenSq === 0) continue;
                const t = Math.max(0, Math.min(1, ((worldX - ax) * dx + (worldY - ay) * dy) / lenSq));
                const projX = ax + t * dx;
                const projY = ay + t * dy;
                const dist = Math.hypot(worldX - projX, worldY - projY);
                if (dist > thickness) {
                  continue;
                }
              }

              const store = useProjectStore.getState();
              const idsToSelect = shape.groupId
                ? (store.groups.find(g => g.id === shape.groupId)?.itemIds || [shape.id])
                : [shape.id];

              if (idsToSelect.some(id => selectedIds.includes(id))) {
                store.saveToHistory();
                setIsDraggingItem(true);
                setDraggedItemStart({ x: worldX, y: worldY });
              } else {
                setSelectedIds(idsToSelect);
                sceneStore.selectMultipleAssets(idsToSelect);
              }
              itemSelected = true;
              return;
            }

            // Default hit-test for rectangles / ellipses / other shapes: axis-aligned bounds
            const halfW = shape.width / 2;
            const halfH = shape.height / 2;

            if (
              worldX >= shape.x - halfW &&
              worldX <= shape.x + halfW &&
              worldY >= shape.y - halfH &&
              worldY <= shape.y + halfH
            ) {
              const store = useProjectStore.getState();
              const idsToSelect = shape.groupId
                ? (store.groups.find(g => g.id === shape.groupId)?.itemIds || [shape.id])
                : [shape.id];

              if (idsToSelect.some(id => selectedIds.includes(id))) {
                store.saveToHistory();
                setIsDraggingItem(true);
                setDraggedItemStart({ x: worldX, y: worldY });
              } else {
                setSelectedIds(idsToSelect);
                sceneStore.selectMultipleAssets(idsToSelect);
              }
              itemSelected = true;
              return;
            }
          }

          // Check assets (reverse order for z-index)
          for (let i = assets.length - 1; i >= 0; i--) {
            const asset = assets[i];
            if (asset.isExploded) continue;
            const halfW = (asset.width * asset.scale) / 2;
            const halfH = (asset.height * asset.scale) / 2;

            if (
              worldX >= asset.x - halfW &&
              worldX <= asset.x + halfW &&
              worldY >= asset.y - halfH &&
              worldY <= asset.y + halfH
            ) {
              const store = useProjectStore.getState();
              const idsToSelect = asset.groupId
                ? (store.groups.find(g => g.id === asset.groupId)?.itemIds || [asset.id])
                : [asset.id];

              if (idsToSelect.some(id => selectedIds.includes(id))) {
                store.saveToHistory();
                setIsDraggingItem(true);
                setDraggedItemStart({ x: worldX, y: worldY });
              } else {
                setSelectedIds(idsToSelect);
                sceneStore.selectMultipleAssets(idsToSelect);
              }
              itemSelected = true;
              return;
            }
          }

          // Check walls
          for (const wall of walls) {
            const nodeMap = new Map(wall.nodes.map((n) => [n.id, n]));
            for (const edge of wall.edges) {
              const nodeA = nodeMap.get(edge.nodeA);
              const nodeB = nodeMap.get(edge.nodeB);
              if (!nodeA || !nodeB) continue;

              const dx = nodeB.x - nodeA.x;
              const dy = nodeB.y - nodeA.y;
              const lengthSquared = dx * dx + dy * dy;
              if (lengthSquared === 0) continue;

              const t = Math.max(
                0,
                Math.min(
                  1,
                  ((worldX - nodeA.x) * dx + (worldY - nodeA.y) * dy) / lengthSquared
                )
              );

              const projX = nodeA.x + t * dx;
              const projY = nodeA.y + t * dy;
              const dist = Math.sqrt((worldX - projX) ** 2 + (worldY - projY) ** 2);

              if (dist <= edge.thickness / 2 + 20) {
                const store = useProjectStore.getState();
                const idsToSelect = wall.groupId
                  ? (store.groups.find(g => g.id === wall.groupId)?.itemIds || [wall.id])
                  : [wall.id];

                if (idsToSelect.some(id => selectedIds.includes(id))) {
                  useProjectStore.getState().saveToHistory();
                  setIsDraggingItem(true);
                  setDraggedItemStart({ x: worldX, y: worldY });
                } else {
                  setSelectedIds(idsToSelect);
                  sceneStore.selectMultipleAssets(idsToSelect);
                }
                itemSelected = true;
                return;
              }
            }
          }

          // Check text annotations (reverse order for z-index)
          for (let i = textAnnotations.length - 1; i >= 0; i--) {
            const annotation = textAnnotations[i];
            const fontSize = annotation.fontSize || 14;
            const textLength = annotation.text.length || 1;
            const estimatedWidth = textLength * fontSize * 0.6;
            const estimatedHeight = fontSize * 1.2;
            const hitRadius = Math.max(Math.max(estimatedWidth, estimatedHeight) / 2, 30);

            const dist = Math.hypot(worldX - annotation.x, worldY - annotation.y);
            if (dist <= hitRadius) {
              const store = useProjectStore.getState();
              const idsToSelect = annotation.groupId
                ? (store.groups.find(g => g.id === annotation.groupId)?.itemIds || [annotation.id])
                : [annotation.id];

              if (idsToSelect.some(id => selectedIds.includes(id))) {
                // Check if double-click for editing (only if single item selected or explicitly double-clicked)
                const now = Date.now();
                const lastClickTime = (window as any).__lastTextClickTime || 0;
                const lastClickId = (window as any).__lastTextClickId;

                if (now - lastClickTime < 300 && lastClickId === annotation.id) {
                  (window as any).__lastTextClickTime = 0;
                  (window as any).__lastTextClickId = null;
                  setSelectedIds([annotation.id]); // Select only this for editing
                  sceneStore.selectMultipleAssets([annotation.id]);
                } else {
                  useProjectStore.getState().saveToHistory();
                  setIsDraggingItem(true);
                  setDraggedItemStart({ x: worldX, y: worldY });
                }
                (window as any).__lastTextClickTime = now;
                (window as any).__lastTextClickId = annotation.id;
              } else {
                setSelectedIds(idsToSelect);
                sceneStore.selectMultipleAssets(idsToSelect);
                (window as any).__lastTextClickTime = Date.now();
                (window as any).__lastTextClickId = annotation.id;
              }
              itemSelected = true;
              return;
            }
          }

          // Check label arrows
          for (let i = labelArrows.length - 1; i >= 0; i--) {
            const arrow = labelArrows[i];
            // Hit test logic for arrow (line segment)
            const dx = arrow.endPoint.x - arrow.startPoint.x;
            const dy = arrow.endPoint.y - arrow.startPoint.y;
            const lengthSquared = dx * dx + dy * dy;
            const thickness = (arrow.strokeWidth || 2) + 20; // Hit tolerance

            let dist = Infinity;
            if (lengthSquared === 0) {
              dist = Math.hypot(worldX - arrow.startPoint.x, worldY - arrow.startPoint.y);
            } else {
              const t = Math.max(0, Math.min(1, ((worldX - arrow.startPoint.x) * dx + (worldY - arrow.startPoint.y) * dy) / lengthSquared));
              const projX = arrow.startPoint.x + t * dx;
              const projY = arrow.startPoint.y + t * dy;
              dist = Math.hypot(worldX - projX, worldY - projY);
            }

            if (dist <= thickness) {
              const store = useProjectStore.getState();
              const idsToSelect = arrow.groupId
                ? (store.groups.find(g => g.id === arrow.groupId)?.itemIds || [arrow.id])
                : [arrow.id];

              if (idsToSelect.some(id => selectedIds.includes(id))) {
                useProjectStore.getState().saveToHistory();
                setIsDraggingItem(true);
                setDraggedItemStart({ x: worldX, y: worldY });
              } else {
                setSelectedIds(idsToSelect);
                sceneStore.selectMultipleAssets(idsToSelect);
              }
              itemSelected = true;
              return;
            }
          }



          if (!itemSelected) {
            // Clear selection and any auto-generated wall dimensions when clicking empty space
            clearSelection();
            useEditorStore.getState().setSelectedEdgeId(null);

            // If we are in wall mode but clicked empty space (and not drawing), we might want to ensure we are not stuck
            // But usually wall mode allows drawing.
            // The user issue "cant be unselected" suggests they want to clear selection.
            // We just called clearSelection().

            dimensions
              .filter((d) => (d as any).type === 'wall')
              .forEach((d) => removeDimension(d.id));
            // Start rectangular selection if in selection tool mode
            if (activeTool === 'select') {
              setSelectionRect({
                x1: worldX,
                y1: worldY,
                x2: worldX,
                y2: worldY
              });
              setDragStart({ x, y }); // Set dragStart to enable mouse move updates
            }
          }
        } else if (activeTool === 'pan') {
          setPanning(true);
          setDragStart({ x, y });
        }
        // For text-annotation and other tools (wall, shape-*, freehand, dimension), don't handle - let tool handle it
        // For other tools (wall, shape-*, freehand, dimension), don't handle - let tool handle it
      }
    },
    [activeTool, setPanning, panX, panY, zoom, shapes, assets, walls, setSelectedIds, clearSelection, selectedIds, setIsDraggingItem, setDraggedItemStart, sceneStore]
  );

  const handleMouseUp = useCallback((e: React.MouseEvent) => {
    // Handle Placement Mode
    if (placementMode.active && placementMode.data && e.button === 0) {
      const { walls: newWalls, assets: newAssets, shapes: newShapes } = placementMode.data;
      const { x: worldX, y: worldY } = mouseWorldPos;

      // Calculate the center of the bounding box of the new items
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

      if (newWalls.length > 0) {
        newWalls.forEach((w: any) => {
          w.nodes.forEach((n: any) => {
            minX = Math.min(minX, n.x);
            minY = Math.min(minY, n.y);
            maxX = Math.max(maxX, n.x);
            maxY = Math.max(maxY, n.y);
          });
        });
      }
      if (newAssets.length > 0) {
        newAssets.forEach((a: any) => {
          const w = (a.width || 0) * (a.scale || 1);
          const h = (a.height || 0) * (a.scale || 1);
          minX = Math.min(minX, a.x - w / 2);
          maxX = Math.max(maxX, a.x + w / 2);
          minY = Math.min(minY, a.y - h / 2);
          maxY = Math.max(maxY, a.y + h / 2);
        });
      }
      const minX_init = minX;
      if (newShapes.length > 0) {
        newShapes.forEach((s: any) => {
          minX = Math.min(minX, s.x - s.width / 2);
          maxX = Math.max(maxX, s.x + s.width / 2);
          minY = Math.min(minY, s.y - s.height / 2);
          maxY = Math.max(maxY, s.y + s.height / 2);
        });
      }

      const newTextAnnotations = placementMode.data.textAnnotations || [];
      if (newTextAnnotations.length > 0) {
        newTextAnnotations.forEach((t: any) => {
          const w = (t.text?.length || 1) * (t.fontSize || 16) * 0.6;
          const h = (t.fontSize || 16) * 1.2;
          minX = Math.min(minX, t.x - w / 2);
          maxX = Math.max(maxX, t.x + w / 2);
          minY = Math.min(minY, t.y - h / 2);
          maxY = Math.max(maxY, t.y + h / 2);
        });
      }

      // If no bounds found (empty plan?), just use 0,0
      if (!isFinite(minX)) { minX = 0; maxX = 0; minY = 0; maxY = 0; }

      const centerX = (minX + maxX) / 2;
      const centerY = (minY + maxY) / 2;

      const dx = worldX - centerX;
      const dy = worldY - centerY;

      // Apply items with offset
      const store = useProjectStore.getState();
      store.saveToHistory();

      // ── Track all newly placed IDs for auto-selection ──────────────────────
      const placedIds: string[] = [];

      // Batch add walls
      newWalls.forEach((w: any) => {
        const newWallId = generateId();
        placedIds.push(newWallId);

        // Re-map node IDs for uniqueness, apply offset ONCE
        const nodeIdMap = new Map<string, string>();
        w.nodes.forEach((n: any) => nodeIdMap.set(n.id, generateId()));

        const newNodes = w.nodes.map((n: any) => ({
          ...n,
          id: nodeIdMap.get(n.id),
          x: n.x + dx,
          y: n.y + dy,
        }));
        const newEdges = w.edges.map((e: any) => ({
          ...e,
          id: generateId(),
          nodeA: nodeIdMap.get(e.nodeA),
          nodeB: nodeIdMap.get(e.nodeB),
        }));

        store.addWall({ ...w, id: newWallId, nodes: newNodes, edges: newEdges });
      });

      // Batch add assets
      newAssets.forEach((a: any) => {
        const newId = generateId();
        placedIds.push(newId);
        store.addAsset({ ...a, id: newId, x: a.x + dx, y: a.y + dy });
      });

      // Batch add shapes
      newShapes.forEach((s: any) => {
        const newId = generateId();
        placedIds.push(newId);
        store.addShape({ ...s, id: newId, x: s.x + dx, y: s.y + dy });
      });

      // Batch add textAnnotations
      newTextAnnotations.forEach((t: any) => {
        const newId = generateId();
        placedIds.push(newId);
        store.addTextAnnotation({ ...t, id: newId, x: t.x + dx, y: t.y + dy });
      });

      setPlacementMode({ active: false, data: null });

      // ── Auto-select all placed items so the user can move them as a group ──
      if (placedIds.length > 0) {
        setSelectedIds(placedIds);
        // Deselect after 5 seconds
        setTimeout(() => {
          setSelectedIds([]);
        }, 5000);
      }

      // ── Pan the viewport to center on the newly placed content ──
      const canvasEl = canvasRef.current;
      const canvasW = canvasEl?.clientWidth ?? window.innerWidth;
      const canvasH = canvasEl?.clientHeight ?? window.innerHeight;
      setPan(canvasW / 2 - worldX * zoom, canvasH / 2 - worldY * zoom);

      toast.success('Plan placed! Items selected — drag to reposition, or click elsewhere to deselect.', { duration: 4500 });
      return;
    }

    // Finalize rectangular selection
    if (selectionRect) {
      const minX = Math.min(selectionRect.x1, selectionRect.x2);
      const maxX = Math.max(selectionRect.x1, selectionRect.x2);
      const minY = Math.min(selectionRect.y1, selectionRect.y2);
      const maxY = Math.max(selectionRect.y1, selectionRect.y2);

      const selectedItems: string[] = [];

      // Select shapes within rectangle
      shapes.forEach(shape => {
        if (shape.x >= minX && shape.x <= maxX && shape.y >= minY && shape.y <= maxY) {
          selectedItems.push(shape.id);
        }
      });

      // Select assets within rectangle (but skip exploded assets - their shapes are already selected)
      assets.forEach(asset => {
        if (asset.isExploded) return; // Skip invisible exploded containers
        if (asset.x >= minX && asset.x <= maxX && asset.y >= minY && asset.y <= maxY) {
          selectedItems.push(asset.id);
        }
      });

      // Select walls with any node within rectangle
      walls.forEach(wall => {
        const hasNodeInRect = wall.nodes.some(node =>
          node.x >= minX && node.x <= maxX && node.y >= minY && node.y <= maxY
        );
        if (hasNodeInRect) {
          selectedItems.push(wall.id);
        }
      });

      // Select text annotations within rectangle
      textAnnotations.forEach(annotation => {
        if (annotation.x >= minX && annotation.x <= maxX && annotation.y >= minY && annotation.y <= maxY) {
          selectedItems.push(annotation.id);
        }
      });

      // Select label arrows within rectangle (check if any point is in rectangle)
      labelArrows.forEach(arrow => {
        const startInRect = arrow.startPoint.x >= minX && arrow.startPoint.x <= maxX &&
          arrow.startPoint.y >= minY && arrow.startPoint.y <= maxY;
        const endInRect = arrow.endPoint.x >= minX && arrow.endPoint.x <= maxX &&
          arrow.endPoint.y >= minY && arrow.endPoint.y <= maxY;
        if (startInRect || endInRect) {
          selectedItems.push(arrow.id);
        }
      });

      // Select dimensions within rectangle (check if any point is in rectangle)
      dimensions.forEach(dim => {
        const startInRect = dim.startPoint.x >= minX && dim.startPoint.x <= maxX &&
          dim.startPoint.y >= minY && dim.startPoint.y <= maxY;
        const endInRect = dim.endPoint.x >= minX && dim.endPoint.x <= maxX &&
          dim.endPoint.y >= minY && dim.endPoint.y <= maxY;
        // Also check the dimension line midpoint
        const midX = (dim.startPoint.x + dim.endPoint.x) / 2;
        const midY = (dim.startPoint.y + dim.endPoint.y) / 2;
        const midInRect = midX >= minX && midX <= maxX && midY >= minY && midY <= maxY;
        if (startInRect || endInRect || midInRect) {
          selectedItems.push(dim.id);
        }
      });

      if (selectedItems.length > 0) {
        setSelectedIds(selectedItems);
        sceneStore.selectMultipleAssets(selectedItems);
      } else {
        // Clear selection if no items found in rectangle
        clearSelection();
      }

      setSelectionRect(null);
    }

    setPanning(false);
    setDragStart(null);
    setIsDraggingItem(false);
    setDraggedItemStart(null);
    setDraggedPoint(null);
    sceneStore.setSnapGuides([]); // Clear snap guides
  }, [setPanning, selectionRect, shapes, assets, walls, textAnnotations, labelArrows, setSelectedIds, sceneStore, draggedPoint, clearSelection, setPan, zoom]);

  const handleAssetDrop = useCallback(
    async (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      const type = e.dataTransfer.getData('assetType');
      if (!type || !canvasRef.current) return;

      const rect = canvasRef.current.getBoundingClientRect();
      const localX = e.clientX - rect.left;
      const localY = e.clientY - rect.top;
      const worldX = (localX - panX) / zoom;
      const worldY = (localY - panY) / zoom;

      const template = ASSET_LIBRARY.find((asset) => asset.id === type);
      // Use template dimensions if available, otherwise fallback to defaults
      const defaultSize = type.includes('table') ? 1800 : type.includes('chair') ? 600 : 1000;

      let width = template?.width || defaultSize;
      let height = template?.height || defaultSize;

      // Try to get dimensions from drag data
      const dimsStr = e.dataTransfer.getData('assetDimensions');
      if (dimsStr) {
        try {
          const dims = JSON.parse(dimsStr);
          width = dims.width;
          height = dims.height;
        } catch (e) {
          console.error("Failed to parse asset dimensions", e);
        }
      }

      const zCandidates = [
        ...walls.map((w) => w.zIndex || 0),
        ...shapes.map((s) => s.zIndex || 0),
        ...assets.map((a) => a.zIndex || 0),
      ];
      const nextZIndex = zCandidates.length > 0 ? Math.max(...zCandidates) + 1 : 1;

      const newAsset: Asset = {
        id: `${type}-${Date.now()}`,
        type,
        x: worldX,
        y: worldY,
        width,
        height,
        rotation: 0,
        scale: 1,
        zIndex: nextZIndex,
        metadata: template ? { label: template.label } : {},
      };

      addAsset(newAsset);
      useEditorStore.getState().setSelectedIds([newAsset.id]);
      toast.success(`Added ${template?.label || type}`, { duration: 1500 });

      // Don't auto-explode on drop - let user double-click to explode if needed
      // Assets should stay as assets initially
    },
    [addAsset, assets, panX, panY, shapes, walls, zoom]
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let zoomToastTimeout: NodeJS.Timeout | null = null;

    const handleWheel = (e: WheelEvent) => {
      // Mouse wheel behavior:
      // - Shift + Wheel -> Pan
      // - Standard Wheel / Pinch (Ctrl) -> Zoom

      e.preventDefault();
      e.stopPropagation();

      const isPanAction = e.shiftKey;

      if (isPanAction) {
        panBy(-e.deltaX, -e.deltaY);
        return;
      }

      // Zoom Handling
      const delta = e.deltaY > 0 ? 0.9 : 1.1;
      const newZoom = Math.max(0.000001, Math.min(1000000, zoom * delta));

      const rect = canvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      const worldX = (mouseX - panX) / zoom;
      const worldY = (mouseY - panY) / zoom;

      // Calculate new pan to keep mouse over same world point
      const newPanX = mouseX - worldX * newZoom;
      const newPanY = mouseY - worldY * newZoom;

      setZoom(newZoom);
      setPan(newPanX, newPanY);

      // Show toast notification about grid size
      if (zoomToastTimeout) clearTimeout(zoomToastTimeout);
      zoomToastTimeout = setTimeout(() => {
        const zoomPercent = Math.round(newZoom * 100);
        toast(`Zoom: ${zoomPercent}%`, {
          duration: 1500,
          icon: '🔍',
          style: {
            fontSize: '12px',
            padding: '8px 12px',
          },
        });
      }, 100);
    };

    canvas.addEventListener('wheel', handleWheel, { passive: false });
    return () => {
      canvas.removeEventListener('wheel', handleWheel);
      if (zoomToastTimeout) clearTimeout(zoomToastTimeout);
    };
  }, [zoom, panX, panY, setZoom, setPan, panBy]);

  useEffect(() => {
    if (!showGrid) return;
    if (initialGridHudSkip.current) {
      initialGridHudSkip.current = false;
      return;
    }
    showGridHud(currentGridSizeValue);
  }, [currentGridSizeValue, showGrid, showGridHud]);

  useEffect(() => {
    return () => {
      if (gridHudTimeoutRef.current) {
        clearTimeout(gridHudTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Zoom shortcuts
      if ((e.ctrlKey || e.metaKey) && e.key === '=') {
        e.preventDefault();
        zoomIn();
      } else if ((e.ctrlKey || e.metaKey) && e.key === '-') {
        e.preventDefault();
        zoomOut();
      }
      // Copy (Ctrl+C)
      else if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
        e.preventDefault();
        const { selectedIds } = useEditorStore.getState();
        if (selectedIds.length > 0) {
          useProjectStore.getState().copySelection(selectedIds);
          toast.success(`Copied ${selectedIds.length} item(s)`, { duration: 1500 });
        }
      }
      // Paste (Ctrl+V)
      else if ((e.ctrlKey || e.metaKey) && e.key === 'v') {
        e.preventDefault();
        const newIds = useProjectStore.getState().pasteSelection();
        if (newIds.length > 0) {
          useEditorStore.getState().setSelectedIds(newIds);
          toast.success(`Pasted ${newIds.length} item(s)`, { duration: 1500 });
        }
      }
      // Bring to front (Shift + ])
      else if (e.shiftKey && e.key === '}') {
        e.preventDefault();
        const { selectedIds } = useEditorStore.getState();
        if (selectedIds.length > 0) {
          const store = useProjectStore.getState();
          const { walls, shapes, assets, dimensions, labelArrows, textAnnotations, updateShape, updateWall, updateAsset, updateDimension, updateLabelArrow, updateTextAnnotation } = store;
          const allItems = [...walls, ...shapes, ...assets, ...dimensions, ...textAnnotations, ...labelArrows];
          const currentMaxZ = allItems.length ? Math.max(...allItems.map((i: any) => i.zIndex || 0)) : 0;
          let z = currentMaxZ + 1;

          store.saveToHistory();
          const applyZToId = (itemId: string) => {
            if (shapes.find((s) => s.id === itemId)) updateShape(itemId, { zIndex: z++ }, true);
            else if (walls.find((w) => w.id === itemId)) updateWall(itemId, { zIndex: z++ }, true);
            else if (assets.find((a) => a.id === itemId)) updateAsset(itemId, { zIndex: z++ }, true);
            else if (dimensions.find((d) => d.id === itemId)) updateDimension(itemId, { zIndex: z++ }, true);
            else if (labelArrows.find((la) => la.id === itemId)) updateLabelArrow(itemId, { zIndex: z++ }, true);
            else if (textAnnotations.find((t) => t.id === itemId)) updateTextAnnotation(itemId, { zIndex: z++ }, true);
            else {
              const group = store.groups.find(g => g.id === itemId);
              if (group) group.itemIds.forEach(applyZToId);
            }
          };
          selectedIds.forEach(applyZToId);
        }
      }
      // Send to back (Shift + [)
      else if (e.shiftKey && e.key === '{') {
        e.preventDefault();
        const { selectedIds } = useEditorStore.getState();
        if (selectedIds.length > 0) {
          const store = useProjectStore.getState();
          const { walls, shapes, assets, dimensions, labelArrows, textAnnotations, updateShape, updateWall, updateAsset, updateDimension, updateLabelArrow, updateTextAnnotation } = store;
          const allItems = [...walls, ...shapes, ...assets, ...dimensions, ...textAnnotations, ...labelArrows];
          const currentMinZ = allItems.length ? Math.min(...allItems.map((i: any) => i.zIndex || 0)) : 0;
          let z = currentMinZ - 1;

          store.saveToHistory();
          const applyZToId = (itemId: string) => {
            if (shapes.find((s) => s.id === itemId)) updateShape(itemId, { zIndex: z-- }, true);
            else if (walls.find((w) => w.id === itemId)) updateWall(itemId, { zIndex: z-- }, true);
            else if (assets.find((a) => a.id === itemId)) updateAsset(itemId, { zIndex: z-- }, true);
            else if (dimensions.find((d) => d.id === itemId)) updateDimension(itemId, { zIndex: z-- }, true);
            else if (labelArrows.find((la) => la.id === itemId)) updateLabelArrow(itemId, { zIndex: z-- }, true);
            else if (textAnnotations.find((t) => t.id === itemId)) updateTextAnnotation(itemId, { zIndex: z-- }, true);
            else {
              const group = store.groups.find(g => g.id === itemId);
              if (group) group.itemIds.forEach(applyZToId);
            }
          };
          selectedIds.forEach(applyZToId);
        }
      }
      // Duplicate (Ctrl+D)
      else if ((e.ctrlKey || e.metaKey) && e.key === 'd') {
        e.preventDefault();
        const { selectedIds, setSelectedIds } = useEditorStore.getState();
        const { shapes, walls, assets, addShape, addWall, addAsset } = useProjectStore.getState();

        const newSelectedIds: string[] = [];
        const offset = 20; // 20mm offset

        selectedIds.forEach(id => {
          // Try shape
          const shape = shapes.find(s => s.id === id);
          if (shape) {
            const newShape = { ...shape, id: crypto.randomUUID(), x: shape.x + offset, y: shape.y + offset };
            addShape(newShape);
            newSelectedIds.push(newShape.id);
            return;
          }

          // Try asset
          const asset = assets.find(a => a.id === id);
          if (asset) {
            const newAsset = { ...asset, id: crypto.randomUUID(), x: asset.x + offset, y: asset.y + offset };
            addAsset(newAsset);
            newSelectedIds.push(newAsset.id);
            return;
          }

          // Try wall
          const wall = walls.find(w => w.id === id);
          if (wall) {
            const nodeIdMap = new Map<string, string>();
            const newWallNodes = wall.nodes.map(n => {
              const newId = crypto.randomUUID();
              nodeIdMap.set(n.id, newId);
              return { ...n, id: newId, x: n.x + offset, y: n.y + offset };
            });

            const newEdges = wall.edges.map(e => ({
              ...e,
              id: crypto.randomUUID(),
              nodeA: nodeIdMap.get(e.nodeA)!,
              nodeB: nodeIdMap.get(e.nodeB)!
            }));

            const newWall = { ...wall, id: crypto.randomUUID(), nodes: newWallNodes, edges: newEdges };
            addWall(newWall);
            newSelectedIds.push(newWall.id);
          }
        });

        if (newSelectedIds.length > 0) {
          setSelectedIds(newSelectedIds);
        }
      }
      // Delete key (global delete for selected items)
      else if (e.key === 'Delete' || e.key === 'Backspace') {
        // Don't handle delete if user is typing in an input
        const target = e.target as HTMLElement;
        if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
          return;
        }

        const active = useEditorStore.getState().activeTool;
        // If user is typing in text tool, let TextAnnotationTool handle it
        if (active === 'text-annotation') return;

        e.preventDefault();
        const { selectedIds, selectedEdgeId, setSelectedEdgeId } = useEditorStore.getState();
        const { removeWall, removeShape, removeAsset, removeWallEdge, removeDimension, removeLabelArrow, removeTextAnnotation, walls } = useProjectStore.getState();

        // Delete selected edge
        if (selectedEdgeId) {
          const wall = walls.find(w => w.edges.some(e => e.id === selectedEdgeId));
          if (wall && wall.edges.length > 2) {
            removeWallEdge(wall.id, selectedEdgeId);
            setSelectedEdgeId(null);
          }
        }
        // Delete selected items
        else if (selectedIds.length > 0) {
          selectedIds.forEach(id => {
            // Try to remove as wall
            if (walls.find(w => w.id === id)) {
              removeWall(id);
            }
            // Try to remove as shape
            else if (shapes.find(s => s.id === id)) {
              removeShape(id);
            }
            // Try to remove as asset
            else if (assets.find(a => a.id === id)) {
              removeAsset(id);
            }
            // Try to remove as dimension
            else if (dimensions.find(d => d.id === id)) {
              removeDimension(id);
            }
            // Try to remove as label arrow
            else if (labelArrows.find(la => la.id === id)) {
              removeLabelArrow(id);
            }
            // Try to remove as text annotation
            else if (textAnnotations.find(ta => ta.id === id)) {
              removeTextAnnotation(id);
            }
          });
          clearSelection();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [zoomIn, zoomOut, clearSelection, walls, shapes, assets, dimensions, labelArrows, textAnnotations]);

  // Undo/Redo Keyboard Shortcuts
  useEffect(() => {
    const handleUndoRedo = (e: KeyboardEvent) => {
      // Undo (Ctrl+Z)
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        useProjectStore.getState().undo();
      }
      // Redo (Ctrl+Y or Ctrl+Shift+Z)
      else if (
        ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') ||
        ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'z')
      ) {
        e.preventDefault();
        useProjectStore.getState().redo();
      }
    };

    window.addEventListener('keydown', handleUndoRedo);
    return () => window.removeEventListener('keydown', handleUndoRedo);
  }, []);



  const alignSelection = (mode: 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom') => {
    const selectedIds = useEditorStore.getState().selectedIds;
    if (selectedIds.length < 2) return;

    // Gather all selected items with bounds
    const items: Array<{
      id: string;
      type: 'shape' | 'asset' | 'wall' | 'dimension' | 'textAnnotation';
      bounds: { x1: number; y1: number; x2: number; y2: number };
    }> = [];

    const addItemBounds = (id: string) => {
      const shape = shapes.find(s => s.id === id);
      if (shape) {
        const halfW = shape.width / 2;
        const halfH = shape.height / 2;
        items.push({ id, type: 'shape', bounds: { x1: shape.x - halfW, y1: shape.y - halfH, x2: shape.x + halfW, y2: shape.y + halfH } });
        return;
      }
      const asset = assets.find(a => a.id === id);
      if (asset) {
        const w = asset.width * asset.scale;
        const h = asset.height * asset.scale;
        items.push({ id, type: 'asset', bounds: { x1: asset.x - w / 2, y1: asset.y - h / 2, x2: asset.x + w / 2, y2: asset.y + h / 2 } });
        return;
      }
      const wall = walls.find(w => w.id === id);
      if (wall && wall.nodes.length > 0) {
        const xs = wall.nodes.map(n => n.x);
        const ys = wall.nodes.map(n => n.y);
        items.push({ id, type: 'wall', bounds: { x1: Math.min(...xs), y1: Math.min(...ys), x2: Math.max(...xs), y2: Math.max(...ys) } });
        return;
      }
      const dimension = dimensions.find(d => d.id === id);
      if (dimension) {
        const pts = [
          dimension.startPoint,
          dimension.endPoint,
        ];
        // include offset line endpoints
        const dx = dimension.endPoint.x - dimension.startPoint.x;
        const dy = dimension.endPoint.y - dimension.startPoint.y;
        const len = Math.sqrt(dx * dx + dy * dy);
        if (len > 0 && dimension.offset !== undefined) {
          const px = -dy / len;
          const py = dx / len;
          pts.push(
            { x: dimension.startPoint.x + px * dimension.offset, y: dimension.startPoint.y + py * dimension.offset },
            { x: dimension.endPoint.x + px * dimension.offset, y: dimension.endPoint.y + py * dimension.offset },
          );
        }
        const xs = pts.map(p => p.x);
        const ys = pts.map(p => p.y);
        items.push({ id, type: 'dimension', bounds: { x1: Math.min(...xs), y1: Math.min(...ys), x2: Math.max(...xs), y2: Math.max(...ys) } });
        return;
      }
      const text = textAnnotations.find(t => t.id === id);
      if (text) {
        const fontSize = text.fontSize || 14;
        const width = Math.max(10, (text.text?.length || 1) * (fontSize * 0.6));
        const height = fontSize * 1.2;
        items.push({ id, type: 'textAnnotation', bounds: { x1: text.x, y1: text.y - height / 2, x2: text.x + width, y2: text.y + height / 2 } });
      }
    };

    selectedIds.forEach(addItemBounds);
    if (items.length < 2) return;

    // Compute group bounds
    const x1 = Math.min(...items.map(i => i.bounds.x1));
    const y1 = Math.min(...items.map(i => i.bounds.y1));
    const x2 = Math.max(...items.map(i => i.bounds.x2));
    const y2 = Math.max(...items.map(i => i.bounds.y2));
    const centerX = (x1 + x2) / 2;
    const centerY = (y1 + y2) / 2;

    items.forEach(item => {
      const bounds = item.bounds;
      let targetX = 0;
      let targetY = 0;
      const width = bounds.x2 - bounds.x1;
      const height = bounds.y2 - bounds.y1;

      if (mode === 'left') targetX = x1;
      if (mode === 'center') targetX = centerX - width / 2;
      if (mode === 'right') targetX = x2 - width;
      if (mode === 'top') targetY = y1;
      if (mode === 'middle') targetY = centerY - height / 2;
      if (mode === 'bottom') targetY = y2 - height;

      const deltaX = (mode === 'left' || mode === 'center' || mode === 'right') ? targetX - bounds.x1 : 0;
      const deltaY = (mode === 'top' || mode === 'middle' || mode === 'bottom') ? targetY - bounds.y1 : 0;

      if (item.type === 'shape') {
        const shape = shapes.find(s => s.id === item.id);
        if (shape) updateShape(item.id, { x: shape.x + deltaX, y: shape.y + deltaY });
      } else if (item.type === 'asset') {
        const asset = assets.find(a => a.id === item.id);
        if (asset) updateAsset(item.id, { x: asset.x + deltaX, y: asset.y + deltaY });
      } else if (item.type === 'wall') {
        const wall = walls.find(w => w.id === item.id);
        if (wall) updateWall(item.id, { nodes: wall.nodes.map(n => ({ ...n, x: n.x + deltaX, y: n.y + deltaY })) });
      } else if (item.type === 'dimension') {
        const dim = dimensions.find(d => d.id === item.id);
        if (dim) {
          updateDimension(item.id, {
            startPoint: { x: dim.startPoint.x + deltaX, y: dim.startPoint.y + deltaY },
            endPoint: { x: dim.endPoint.x + deltaX, y: dim.endPoint.y + deltaY },
          });
        }
      } else if (item.type === 'textAnnotation') {
        const t = textAnnotations.find(tt => tt.id === item.id);
        if (t) updateTextAnnotation(item.id, { x: t.x + deltaX, y: t.y + deltaY });
      }
    });
  };

  const duplicateSelection = useCallback((count: number) => {
    try {
      const selectedIds = useEditorStore.getState().selectedIds;
      if (selectedIds.length === 0) {
        toast.error("No items selected to duplicate");
        return [];
      }

      const store = useProjectStore.getState();
      const { shapes, walls, assets, addShape, addWall, addAsset, getNextZIndex } = store;
      const newSelectedIds: string[] = [...selectedIds]; // Include originals
      const offset = 20; // Base offset between duplicates



      useProjectStore.getState().saveToHistory();

      for (let i = 0; i < count; i++) {
        selectedIds.forEach(id => {

          // Try shape
          const shape = shapes.find(s => s.id === id);
          if (shape) {
            const newShape = {
              ...shape,
              id: generateId(),
              x: shape.x + offset * (i + 1),
              y: shape.y + offset * (i + 1),
              zIndex: getNextZIndex()
            };
            addShape(newShape);
            newSelectedIds.push(newShape.id);
            return;
          }

          // Try asset
          const asset = assets.find(a => a.id === id);
          if (asset) {
            const newAsset = {
              ...asset,
              id: generateId(),
              x: asset.x + offset * (i + 1),
              y: asset.y + offset * (i + 1),
              zIndex: getNextZIndex()
            };
            addAsset(newAsset);
            newSelectedIds.push(newAsset.id);
            return;
          }

          // Try wall
          const wall = walls.find(w => w.id === id);
          if (wall) {
            const nodeIdMap = new Map<string, string>();
            const newWallNodes = wall.nodes.map(n => {
              const newId = generateId();
              nodeIdMap.set(n.id, newId);
              return { ...n, id: newId, x: n.x + offset * (i + 1), y: n.y + offset * (i + 1) };
            });

            const newEdges = wall.edges.map(e => ({
              ...e,
              id: generateId(),
              nodeA: nodeIdMap.get(e.nodeA)!,
              nodeB: nodeIdMap.get(e.nodeB)!
            }));

            const newWall = {
              ...wall,
              id: generateId(),
              nodes: newWallNodes,
              edges: newEdges,
              zIndex: getNextZIndex()
            };
            addWall(newWall);
            newSelectedIds.push(newWall.id);
            return;
          }

          // Try Group
          const group = store.groups.find(g => g.id === id);
          if (group) {
            const newGroupId = generateId();
            const newChildIds: string[] = [];

            group.itemIds.forEach(childId => {
              // Duplicate child
              const shape = shapes.find(s => s.id === childId);
              if (shape) {
                const newShape = { ...shape, id: generateId(), groupId: newGroupId, x: shape.x + offset * (i + 1), y: shape.y + offset * (i + 1), zIndex: getNextZIndex() };
                addShape(newShape);
                newChildIds.push(newShape.id);
                return;
              }
              const asset = assets.find(a => a.id === childId);
              if (asset) {
                const newAsset = { ...asset, id: generateId(), groupId: newGroupId, x: asset.x + offset * (i + 1), y: asset.y + offset * (i + 1), zIndex: getNextZIndex() };
                addAsset(newAsset);
                newChildIds.push(newAsset.id);
                return;
              }
              // Add other types if needed (walls in groups?)
            });

            const newGroup = { ...group, id: newGroupId, itemIds: newChildIds, zIndex: getNextZIndex() };
            store.addGroup(newGroup);
            newSelectedIds.push(newGroupId);
            return;
          }


        });
      }

      if (newSelectedIds.length > 0) {
        useEditorStore.getState().setSelectedIds(newSelectedIds);
        toast.success(`Duplicated ${selectedIds.length} item(s) ${count} time(s)`);
      } else {
        toast.error("Failed to duplicate items");
      }
      return newSelectedIds;
    } catch (error) {
      console.error("[Duplicate] ERROR:", error);
      toast.error(`Duplication failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return [];
    }
  }, []);

  const distributeSelection = (mode: 'horizontal' | 'vertical' | 'circular', spacing?: number, diameter?: number, overrideIds?: string[]) => {
    const selectedIds = overrideIds || useEditorStore.getState().selectedIds;
    if (mode === 'circular' && selectedIds.length < 2) return;
    if ((mode === 'horizontal' || mode === 'vertical') && selectedIds.length < 2) return;

    // Get fresh values from store
    const store = useProjectStore.getState();
    const currentShapes = store.shapes;
    const currentAssets = store.assets;
    const currentWalls = store.walls;
    const currentDimensions = store.dimensions;
    const currentTextAnnotations = store.textAnnotations;

    const items: Array<{ id: string; type: 'shape' | 'asset' | 'wall' | 'dimension' | 'textAnnotation' | 'group'; bounds: { x1: number; y1: number; x2: number; y2: number }; center: { x: number; y: number } }> = [];

    const addItemBounds = (id: string) => {
      const shape = currentShapes.find(s => s.id === id);
      if (shape) {
        const halfW = shape.width / 2;
        const halfH = shape.height / 2;
        items.push({ id, type: 'shape', bounds: { x1: shape.x - halfW, y1: shape.y - halfH, x2: shape.x + halfW, y2: shape.y + halfH }, center: { x: shape.x, y: shape.y } });
        return;
      }
      const asset = currentAssets.find(a => a.id === id);
      if (asset) {
        const w = asset.width * asset.scale;
        const h = asset.height * asset.scale;
        items.push({ id, type: 'asset', bounds: { x1: asset.x - w / 2, y1: asset.y - h / 2, x2: asset.x + w / 2, y2: asset.y + h / 2 }, center: { x: asset.x, y: asset.y } });
        return;
      }
      const wall = currentWalls.find(w => w.id === id);
      if (wall && wall.nodes.length > 0) {
        const xs = wall.nodes.map(n => n.x);
        const ys = wall.nodes.map(n => n.y);
        const cx = (Math.min(...xs) + Math.max(...xs)) / 2;
        const cy = (Math.min(...ys) + Math.max(...ys)) / 2;
        items.push({ id, type: 'wall', bounds: { x1: Math.min(...xs), y1: Math.min(...ys), x2: Math.max(...xs), y2: Math.max(...ys) }, center: { x: cx, y: cy } });
        return;
      }
      const dimension = currentDimensions.find(d => d.id === id);
      if (dimension) {
        const pts = [
          dimension.startPoint,
          dimension.endPoint,
        ];
        const dx = dimension.endPoint.x - dimension.startPoint.x;
        const dy = dimension.endPoint.y - dimension.startPoint.y;
        const len = Math.sqrt(dx * dx + dy * dy);
        if (len > 0 && dimension.offset !== undefined) {
          const px = -dy / len;
          const py = dx / len;
          pts.push(
            { x: dimension.startPoint.x + px * dimension.offset, y: dimension.startPoint.y + py * dimension.offset },
            { x: dimension.endPoint.x + px * dimension.offset, y: dimension.endPoint.y + py * dimension.offset },
          );
        }
        const xs = pts.map(p => p.x);
        const ys = pts.map(p => p.y);
        const cx = (Math.min(...xs) + Math.max(...xs)) / 2;
        const cy = (Math.min(...ys) + Math.max(...ys)) / 2;
        items.push({ id, type: 'dimension', bounds: { x1: Math.min(...xs), y1: Math.min(...ys), x2: Math.max(...xs), y2: Math.max(...ys) }, center: { x: cx, y: cy } });
        return;
      }
      const text = currentTextAnnotations.find(t => t.id === id);
      if (text) {
        const fontSize = text.fontSize || 14;
        const width = Math.max(10, (text.text?.length || 1) * (fontSize * 0.6));
        const height = fontSize * 1.2;
        items.push({ id, type: 'textAnnotation', bounds: { x1: text.x, y1: text.y - height / 2, x2: text.x + width, y2: text.y + height / 2 }, center: { x: text.x + width / 2, y: text.y } });
        return;
      }

      const group = store.groups.find(g => g.id === id);
      if (group) {
        // Calculate group bounds from children
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        let hasChild = false;

        group.itemIds.forEach(childId => {
          const s = currentShapes.find(x => x.id === childId);
          if (s) {
            minX = Math.min(minX, s.x - s.width / 2);
            maxX = Math.max(maxX, s.x + s.width / 2);
            minY = Math.min(minY, s.y - s.height / 2);
            maxY = Math.max(maxY, s.y + s.height / 2);
            hasChild = true;
          }
          const a = currentAssets.find(a => a.id === childId);
          if (a) {
            const w = a.width * a.scale;
            const h = a.height * a.scale;
            minX = Math.min(minX, a.x - w / 2);
            maxX = Math.max(maxX, a.x + w / 2);
            minY = Math.min(minY, a.y - h / 2);
            maxY = Math.max(maxY, a.y + h / 2);
            hasChild = true;
          }
        });

        if (hasChild) {
          items.push({ id, type: 'group', bounds: { x1: minX, y1: minY, x2: maxX, y2: maxY }, center: { x: (minX + maxX) / 2, y: (minY + maxY) / 2 } });
        }
        return;
      }
    };

    selectedIds.forEach(addItemBounds);
    if (items.length < 3) return;

    if (mode === 'circular') {
      // Distribute items evenly around a circle based on their centers
      const centers = items.map(i => i.center);
      const avgX = centers.reduce((s, c) => s + c.x, 0) / centers.length;
      const avgY = centers.reduce((s, c) => s + c.y, 0) / centers.length;
      // Use provided diameter or calculate from max distance
      const radius = diameter ? diameter / 2 : (() => {
        const maxDist = Math.max(
          ...centers.map(c => Math.hypot(c.x - avgX, c.y - avgY))
        ) || 1;
        return maxDist * 1.2;
      })();

      items.forEach((item, idx) => {
        const angle = (2 * Math.PI * idx) / items.length - Math.PI / 2; // start at top
        const targetX = avgX + radius * Math.cos(angle);
        const targetY = avgY + radius * Math.sin(angle);
        const deltaX = targetX - item.center.x;
        const deltaY = targetY - item.center.y;

        if (item.type === 'shape') {
          const shape = currentShapes.find(s => s.id === item.id);
          if (shape) updateShape(item.id, { x: shape.x + deltaX, y: shape.y + deltaY });
        } else if (item.type === 'asset') {
          const asset = currentAssets.find(a => a.id === item.id);
          if (asset) updateAsset(item.id, { x: asset.x + deltaX, y: asset.y + deltaY });
        } else if (item.type === 'wall') {
          const wall = currentWalls.find(w => w.id === item.id);
          if (wall) updateWall(item.id, { nodes: wall.nodes.map(n => ({ ...n, x: n.x + deltaX, y: n.y + deltaY })) });
        } else if (item.type === 'dimension') {
          const dim = currentDimensions.find(d => d.id === item.id);
          if (dim) {
            updateDimension(item.id, {
              startPoint: { x: dim.startPoint.x + deltaX, y: dim.startPoint.y + deltaY },
              endPoint: { x: dim.endPoint.x + deltaX, y: dim.endPoint.y + deltaY },
            });
          }
        } else if (item.type === 'textAnnotation') {
          const t = currentTextAnnotations.find(tt => tt.id === item.id);
          if (t) updateTextAnnotation(item.id, { x: t.x + deltaX, y: t.y + deltaY });
        }
      });
    } else if (mode === 'horizontal') {
      // Calculate average Y center to align all items on same horizontal line
      const avgY = items.reduce((sum, item) => sum + item.center.y, 0) / items.length;

      // Sort by X (left to right)
      const sorted = items.slice().sort((a, b) => a.center.x - b.center.x);

      // Calculate total width of all items combined (sum of widths)
      const totalWidth = sorted.reduce((sum, item) => {
        const width = item.bounds.x2 - item.bounds.x1;
        return sum + width;
      }, 0);

      // Use provided spacing or calculate from average width
      const minSpacing = spacing !== undefined ? spacing : (() => {
        const avgWidth = totalWidth / sorted.length;
        return avgWidth * 1.5;
      })();

      // Calculate distribution range: total width + spacing between items
      const distributionWidth = totalWidth + (minSpacing * (sorted.length - 1));

      // Start position: leftmost item's left edge minus some padding
      const leftmostLeft = Math.min(...sorted.map(item => item.bounds.x1));
      const startX = leftmostLeft - (distributionWidth - totalWidth) / 2;

      // Calculate all target positions: align Y to avgY, distribute X evenly
      const updates: Array<{ id: string; type: string; deltaX: number; deltaY: number }> = [];
      let currentX = startX;

      sorted.forEach((item, idx) => {
        const itemWidth = item.bounds.x2 - item.bounds.x1;
        // Position item's center at currentX + half its width
        const targetX = currentX + itemWidth / 2;
        const deltaX = targetX - item.center.x;
        const deltaY = avgY - item.center.y;
        updates.push({ id: item.id, type: item.type, deltaX, deltaY });
        // Move to next position: current position + item width + spacing
        currentX += itemWidth + minSpacing;
      });

      // Apply all updates
      updates.forEach(({ id, type, deltaX, deltaY }) => {
        if (type === 'shape') {
          const shape = currentShapes.find(s => s.id === id);
          if (shape) updateShape(id, { x: shape.x + deltaX, y: shape.y + deltaY });
        } else if (type === 'asset') {
          const asset = currentAssets.find(a => a.id === id);
          if (asset) updateAsset(id, { x: asset.x + deltaX, y: asset.y + deltaY });
        } else if (type === 'wall') {
          const wall = currentWalls.find(w => w.id === id);
          if (wall) updateWall(id, { nodes: wall.nodes.map(n => ({ ...n, x: n.x + deltaX, y: n.y + deltaY })) });
        } else if (type === 'dimension') {
          const dim = currentDimensions.find(d => d.id === id);
          if (dim) {
            updateDimension(id, {
              startPoint: { x: dim.startPoint.x + deltaX, y: dim.startPoint.y + deltaY },
              endPoint: { x: dim.endPoint.x + deltaX, y: dim.endPoint.y + deltaY },
            });
          }
        } else if (type === 'textAnnotation') {
          const t = currentTextAnnotations.find(tt => tt.id === id);
          if (t) updateTextAnnotation(id, { x: t.x + deltaX, y: t.y + deltaY });
        }
      });
    } else {
      // Vertical distribute: align all items on same vertical line, then distribute evenly
      // Calculate average X center to align all items on same vertical line
      const avgX = items.reduce((sum, item) => sum + item.center.x, 0) / items.length;

      // Sort by Y center (top to bottom)
      const sorted = items.slice().sort((a, b) => a.center.y - b.center.y);

      // Calculate total height of all items combined (sum of heights)
      const totalHeight = sorted.reduce((sum, item) => {
        const height = item.bounds.y2 - item.bounds.y1;
        return sum + height;
      }, 0);

      // Use provided spacing or calculate from average height
      const minSpacing = spacing !== undefined ? spacing : (() => {
        const avgHeight = totalHeight / sorted.length;
        return avgHeight * 1.5;
      })();

      // Calculate distribution range: total height + spacing between items
      const distributionHeight = totalHeight + (minSpacing * (sorted.length - 1));

      // Start position: topmost item's top edge minus some padding
      const topmostTop = Math.min(...sorted.map(item => item.bounds.y1));
      const startY = topmostTop - (distributionHeight - totalHeight) / 2;

      // Calculate all target positions: align X to avgX, distribute Y evenly
      const updates: Array<{ id: string; type: string; deltaX: number; deltaY: number }> = [];
      let currentY = startY;

      sorted.forEach((item, idx) => {
        const itemHeight = item.bounds.y2 - item.bounds.y1;
        // Position item's center at currentY + half its height
        const targetY = currentY + itemHeight / 2;
        const deltaX = avgX - item.center.x;
        const deltaY = targetY - item.center.y;
        updates.push({ id: item.id, type: item.type, deltaX, deltaY });
        // Move to next position: current position + item height + spacing
        currentY += itemHeight + minSpacing;
      });

      // Apply all updates
      updates.forEach(({ id, type, deltaX, deltaY }) => {
        if (type === 'shape') {
          const shape = currentShapes.find(s => s.id === id);
          if (shape) updateShape(id, { x: shape.x + deltaX, y: shape.y + deltaY });
        } else if (type === 'asset') {
          const asset = currentAssets.find(a => a.id === id);
          if (asset) updateAsset(id, { x: asset.x + deltaX, y: asset.y + deltaY });
        } else if (type === 'wall') {
          const wall = currentWalls.find(w => w.id === id);
          if (wall) updateWall(id, { nodes: wall.nodes.map(n => ({ ...n, x: n.x + deltaX, y: n.y + deltaY })) });
        } else if (type === 'dimension') {
          const dim = currentDimensions.find(d => d.id === id);
          if (dim) {
            updateDimension(id, {
              startPoint: { x: dim.startPoint.x + deltaX, y: dim.startPoint.y + deltaY },
              endPoint: { x: dim.endPoint.x + deltaX, y: dim.endPoint.y + deltaY },
            });
          }
        } else if (type === 'textAnnotation') {
          const t = currentTextAnnotations.find(tt => tt.id === id);
          if (t) updateTextAnnotation(id, { x: t.x + deltaX, y: t.y + deltaY });
        } else if (type === 'group') {
          const group = store.groups.find(g => g.id === id);
          if (group) {
            group.itemIds.forEach(childId => {
              const s = currentShapes.find(x => x.id === childId);
              if (s) { updateShape(childId, { x: s.x + deltaX, y: s.y + deltaY }); }
              const a = currentAssets.find(x => x.id === childId);
              if (a) { updateAsset(childId, { x: a.x + deltaX, y: a.y + deltaY }); }
            });
          }
        }
      });
    }
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();

    if (!canvasRef.current) {
      return;
    }

    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const worldX = (x - panX) / zoom;
    const worldY = (y - panY) / zoom;

    // Try to find the top‑most object under the cursor to mark as target
    let targetId: string | null = null;

    // Check shapes (reverse order for z-index)
    for (let i = shapes.length - 1; i >= 0; i--) {
      const shape = shapes[i];
      const halfW = shape.width / 2;
      const halfH = shape.height / 2;
      if (
        worldX >= shape.x - halfW &&
        worldX <= shape.x + halfW &&
        worldY >= shape.y - halfH &&
        worldY <= shape.y + halfH
      ) {
        targetId = shape.id;
        break;
      }
    }

    // Check assets if no shape was hit
    if (!targetId) {
      for (let i = assets.length - 1; i >= 0; i--) {
        const asset = assets[i];
        const halfW = (asset.width * asset.scale) / 2;
        const halfH = (asset.height * asset.scale) / 2;
        if (
          worldX >= asset.x - halfW &&
          worldX <= asset.x + halfW &&
          worldY >= asset.y - halfH &&
          worldY <= asset.y + halfH
        ) {
          targetId = asset.id;
          break;
        }
      }
    }

    // Check walls if no shape or asset was hit
    if (!targetId) {
      for (let i = walls.length - 1; i >= 0; i--) {
        const wall = walls[i];
        // Check if point is within wall's bounding box
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        wall.nodes.forEach(node => {
          minX = Math.min(minX, node.x);
          minY = Math.min(minY, node.y);
          maxX = Math.max(maxX, node.x);
          maxY = Math.max(maxY, node.y);
        });
        if (
          worldX >= minX &&
          worldX <= maxX &&
          worldY >= minY &&
          worldY <= maxY
        ) {
          targetId = wall.id;
          break;
        }
      }
    }

    setContextMenu({
      visible: true,
      x: e.clientX,
      y: e.clientY,
      worldX,
      worldY,
      targetId,
    });
  };

  const closeContextMenu = () => {
    setContextMenu(null);
  };

  // Define Context Menu Actions
  const getContextMenuActions = () => {
    const selectedIds = useEditorStore.getState().selectedIds;
    const hasSelection = selectedIds.length > 0;
    const singleSelection = selectedIds.length === 1;

    const actions: any[] = [
      {
        label: "Cut",
        shortcut: "Ctrl+X",
        disabled: !hasSelection,
        action: () => {
          useProjectStore.getState().cutSelection(selectedIds);
          useEditorStore.getState().clearSelection();
        },
      },
      {
        label: "Copy",
        shortcut: "Ctrl+C",
        disabled: !hasSelection,
        action: () => useProjectStore.getState().copySelection(selectedIds),
      },
      {
        label: "Paste",
        shortcut: "Ctrl+V",
        action: () => {
          const newIds = useProjectStore.getState().pasteSelection(
            contextMenu ? { x: contextMenu.worldX, y: contextMenu.worldY } : undefined
          );
          if (newIds.length > 0) {
            useEditorStore.getState().setSelectedIds(newIds);
          }
        },
      },
      { separator: true },
    ];

    if (hasSelection) {
      // Distribute only
      actions.push({
        label: "Distribute...",
        action: () => {
          setDuplicateDistributeModal({ isOpen: true, mode: 'distribute' });
          closeContextMenu();
        },
      });

      // Duplicate & Distribute
      actions.push({
        label: "Duplicate & Distribute...",
        action: () => {
          setDuplicateDistributeModal({ isOpen: true, mode: 'duplicate' });
          closeContextMenu();
        },
      });
      actions.push({
        label: "Add to AI chat",
        action: () => {
          try {
            // Store selection info in a custom window-scoped object that AiTrigger can read
            (window as any).__ESP_AI_SELECTED_IDS__ = selectedIds.slice();
            // Fire a custom event that AiTrigger listens for; it will
            // open the modal and sync selection on its side.
            window.dispatchEvent(
              new CustomEvent('esp-add-to-ai-chat', {
                detail: { selectedIds: selectedIds.slice() },
              })
            );
            toast.success("Selection added to AI chat context", {
              duration: 2000,
              style: {
                fontSize: '12px',
                padding: '8px 12px',
              },
            });
          } catch (err) {
            console.error("Failed to add selection to AI chat context", err);
          }
        },
      });
      actions.push({ separator: true });
    }

    // Add Comment Action
    if (!hasSelection && !isSnapMode) {
      actions.push({
        label: "Add comment",
        action: () => {
          const id = crypto.randomUUID();
          addComment({
            id,
            x: contextMenu?.worldX || 0,
            y: contextMenu?.worldY || 0,
            content: '',
            author: 'User', // TODO: Get from user store
            timestamp: Date.now(),
            resolved: false,
          });
          setActiveCommentId(id);
          closeContextMenu();
        }
      });
      actions.push({ separator: true });
    }

    // STEP 1: "Snap to Anchor" on the SOURCE item (select which anchor on the source to use)
    if (hasSelection && !isSnapMode) {
      actions.push({
        label: "Snap to Anchor",
        children: [
          {
            label: "↖ Top-Left", action: () => {
              if (singleSelection) {
                setSnapMode(true, selectedIds[0], 'top-left');
                closeContextMenu();
              } else {
                selectedIds.forEach(id => useProjectStore.getState().snapToAnchor(id, 'top-left'));
              }
            }
          },
          {
            label: "↑ Top-Center", action: () => {
              if (singleSelection) {
                setSnapMode(true, selectedIds[0], 'top-center');
                closeContextMenu();
              } else {
                selectedIds.forEach(id => useProjectStore.getState().snapToAnchor(id, 'top-center'));
              }
            }
          },
          {
            label: "↗ Top-Right", action: () => {
              if (singleSelection) {
                setSnapMode(true, selectedIds[0], 'top-right');
                closeContextMenu();
              } else {
                selectedIds.forEach(id => useProjectStore.getState().snapToAnchor(id, 'top-right'));
              }
            }
          },
          { separator: true },
          {
            label: "← Left-Center", action: () => {
              if (singleSelection) {
                setSnapMode(true, selectedIds[0], 'left-center');
                closeContextMenu();
              } else {
                selectedIds.forEach(id => useProjectStore.getState().snapToAnchor(id, 'left-center'));
              }
            }
          },
          {
            label: "⊙ Center", action: () => {
              if (singleSelection) {
                setSnapMode(true, selectedIds[0], 'center');
                closeContextMenu();
              } else {
                selectedIds.forEach(id => useProjectStore.getState().snapToAnchor(id, 'center'));
              }
            }
          },
          {
            label: "→ Right-Center", action: () => {
              if (singleSelection) {
                setSnapMode(true, selectedIds[0], 'right-center');
                closeContextMenu();
              } else {
                selectedIds.forEach(id => useProjectStore.getState().snapToAnchor(id, 'right-center'));
              }
            }
          },
          { separator: true },
          {
            label: "↙ Bottom-Left", action: () => {
              if (singleSelection) {
                setSnapMode(true, selectedIds[0], 'bottom-left');
                closeContextMenu();
              } else {
                selectedIds.forEach(id => useProjectStore.getState().snapToAnchor(id, 'bottom-left'));
              }
            }
          },
          {
            label: "↓ Bottom-Center", action: () => {
              if (singleSelection) {
                setSnapMode(true, selectedIds[0], 'bottom-center');
                closeContextMenu();
              } else {
                selectedIds.forEach(id => useProjectStore.getState().snapToAnchor(id, 'bottom-center'));
              }
            }
          },
          {
            label: "↘ Bottom-Right", action: () => {
              if (singleSelection) {
                setSnapMode(true, selectedIds[0], 'bottom-right');
                closeContextMenu();
              } else {
                selectedIds.forEach(id => useProjectStore.getState().snapToAnchor(id, 'bottom-right'));
              }
            }
          },
        ]
      });
      actions.push({ separator: true });
    }

    // STEP 2: When already in snap mode and right‑clicking a DIFFERENT object, show "Set as Anchor"
    if (
      isSnapMode &&
      snapSourceId &&
      snapAnchor &&
      contextMenu?.targetId &&
      contextMenu.targetId !== snapSourceId
    ) {
      const targetId = contextMenu.targetId;
      const clickWorldX = contextMenu.worldX;
      const clickWorldY = contextMenu.worldY;

      actions.push({
        label: "Set as Anchor",
        action: () => {
          // Resolve target object (shape or asset)
          const targetShape = shapes.find((s) => s.id === targetId);
          const targetAsset = assets.find((a) => a.id === targetId);
          const targetWall = walls.find((w) => w.id === targetId);

          let targetContext: SnapObject | null = null;
          if (targetShape) {
            targetContext = { type: 'shape', object: targetShape };
          } else if (targetAsset) {
            targetContext = { type: 'asset', object: targetAsset };
          } else if (targetWall) {
            targetContext = { type: 'wall', object: targetWall };
          }

          if (!targetContext) {
            console.warn("Set as Anchor: target object not found", { targetId });
            return;
          }

          const targetAnchors = getAnchorsForObject(targetContext);

          if (!targetAnchors || targetAnchors.length === 0) {
            console.warn("Set as Anchor: no anchors for target", { targetId });
            return;
          }

          // Pick the target anchor nearest to the right‑click point
          let nearestTargetAnchor = targetAnchors[0];
          let minDist = Math.hypot(
            clickWorldX - nearestTargetAnchor.x,
            clickWorldY - nearestTargetAnchor.y
          );

          for (const anchor of targetAnchors) {
            const d = Math.hypot(clickWorldX - anchor.x, clickWorldY - anchor.y);
            if (d < minDist) {
              minDist = d;
              nearestTargetAnchor = anchor;
            }
          }

          // Resolve source object (shape, asset, or wall)
          const sourceShape = shapes.find((s) => s.id === snapSourceId);
          const sourceAsset = assets.find((a) => a.id === snapSourceId);
          const sourceWall = walls.find((w) => w.id === snapSourceId);
          let sourceContext: SnapObject | null = null;
          if (sourceShape) {
            sourceContext = { type: 'shape', object: sourceShape };
          } else if (sourceAsset) {
            sourceContext = { type: 'asset', object: sourceAsset };
          } else if (sourceWall) {
            sourceContext = { type: 'wall', object: sourceWall };
          }

          if (!sourceContext) {
            console.warn("Set as Anchor: source object not found or unsupported", { snapSourceId });
            return;
          }

          const sourceAnchors = getAnchorsForObject(sourceContext);

          if (!sourceAnchors) {
            console.warn("Set as Anchor: no anchors for source", { snapSourceId });
            return;
          }

          const sourceAnchorPoint = sourceAnchors.find((a) => a.id === snapAnchor);
          if (!sourceAnchorPoint) {
            console.warn("Set as Anchor: source anchor not found", {
              snapSourceId,
              snapAnchor,
            });
            return;
          }

          // Move the source so its chosen anchor sits exactly on the chosen target anchor
          if (sourceContext.type === 'wall') {
            // For walls, we need to move all nodes by the same offset
            const sourceWall = sourceContext.object as Wall;
            const sourceObj = sourceContext.object as Wall;
            // Calculate wall center for offset calculation
            let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
            sourceWall.nodes.forEach(node => {
              minX = Math.min(minX, node.x);
              minY = Math.min(minY, node.y);
              maxX = Math.max(maxX, node.x);
              maxY = Math.max(maxY, node.y);
            });
            const wallCenterX = (minX + maxX) / 2;
            const wallCenterY = (minY + maxY) / 2;
            const offsetX = sourceAnchorPoint.x - wallCenterX;
            const offsetY = sourceAnchorPoint.y - wallCenterY;
            const newCenterX = nearestTargetAnchor.x - offsetX;
            const newCenterY = nearestTargetAnchor.y - offsetY;
            const dx = newCenterX - wallCenterX;
            const dy = newCenterY - wallCenterY;
            // Move all nodes by the same offset
            const newNodes = sourceWall.nodes.map(node => ({
              ...node,
              x: node.x + dx,
              y: node.y + dy
            }));
            updateWall(snapSourceId, { nodes: newNodes });
          } else {
            const sourceObj = sourceContext.object as Shape | Asset;
            const offsetX = sourceAnchorPoint.x - sourceObj.x;
            const offsetY = sourceAnchorPoint.y - sourceObj.y;
            const newX = nearestTargetAnchor.x - offsetX;
            const newY = nearestTargetAnchor.y - offsetY;

            if (sourceContext.type === 'shape') {
              updateShape(snapSourceId, { x: newX, y: newY });
            } else if (sourceContext.type === 'asset') {
              updateAsset(snapSourceId, { x: newX, y: newY });
            }
          }

          console.log(
            `Set as Anchor: moved ${snapSourceId} (${snapAnchor}) to ${targetId} (${nearestTargetAnchor.id})`
          );

          setSnapMode(false);
          closeContextMenu();
        },
      });

      actions.push({ separator: true });
    }


    // Grouping Actions
    if (hasSelection) {
      actions.push({
        label: 'Group',
        disabled: selectedIds.length <= 1,
        action: () => {
          const newGroupId = useProjectStore.getState().groupSelection(selectedIds);
          useEditorStore.getState().setSelectedIds(useProjectStore.getState().groups.find(g => g.id === newGroupId)?.itemIds || []);
          toast.success("Grouped");
          closeContextMenu();
        }
      });

      actions.push({
        label: 'Ungroup',
        disabled: !selectedIds.some(id => {
          const store = useProjectStore.getState();
          const item = store.shapes.find(s => s.id === id) ||
            store.assets.find(a => a.id === id) ||
            store.walls.find(w => w.id === id) ||
            store.textAnnotations.find(t => t.id === id) ||
            store.labelArrows.find(l => l.id === id);
          return !!item?.groupId;
        }),
        action: () => {
          const ungroupedIds = useProjectStore.getState().ungroupSelection(selectedIds);
          useEditorStore.getState().setSelectedIds(ungroupedIds);
          toast.success("Ungrouped");
          closeContextMenu();
        }
      });

      actions.push({ separator: true });
      actions.push({ separator: true });
    }

    // Duplicate Actions
    if (hasSelection) {
      actions.push({
        label: 'Duplicate & Distribute',
        action: () => {
          setDuplicateDistributeModal({ isOpen: true, mode: 'duplicate' });
          setTimeout(() => closeContextMenu(), 0);
        }
      });

      // Only show distribute if multiple items selected
      if (selectedIds.length > 1) {
        actions.push({
          label: 'Distribute...',
          action: () => {
            setDuplicateDistributeModal({ isOpen: true, mode: 'distribute' });
            setTimeout(() => closeContextMenu(), 0);
          }
        });
      }

      actions.push({ separator: true });
    }

    if (hasSelection) {
      const state = useProjectStore.getState();
      const {
        walls,
        shapes,
        assets,
        dimensions,
        textAnnotations,
        labelArrows,
        updateShape,
        updateWall,
        updateAsset,
        updateDimension,
        updateTextAnnotation,
        updateLabelArrow,
      } = state;

      const allItems = [
        ...walls,
        ...shapes,
        ...assets,
        ...dimensions,
        ...textAnnotations,
        ...labelArrows,
      ];

      const currentMaxZ = allItems.length
        ? Math.max(...allItems.map((i: any) => i.zIndex || 0))
        : 0;
      const currentMinZ = allItems.length
        ? Math.min(...allItems.map((i: any) => i.zIndex || 0))
        : 0;

      actions.push(
        {
          label: "Bring to front",
          shortcut: "Shift+]",
          disabled: !hasSelection,
          action: () => {
            state.saveToHistory();
            let z = currentMaxZ + 1;
            const applyZToId = (itemId: string) => {
              if (shapes.find((s) => s.id === itemId)) {
                updateShape(itemId, { zIndex: z++ }, true);
              } else if (walls.find((w) => w.id === itemId)) {
                updateWall(itemId, { zIndex: z++ }, true);
              } else if (assets.find((a) => a.id === itemId)) {
                updateAsset(itemId, { zIndex: z++ }, true);
              } else if (dimensions.find((d) => d.id === itemId)) {
                updateDimension(itemId, { zIndex: z++ }, true);
              } else if (labelArrows.find((la) => la.id === itemId)) {
                updateLabelArrow(itemId, { zIndex: z++ }, true);
              } else if (textAnnotations.find((t) => t.id === itemId)) {
                updateTextAnnotation(itemId, { zIndex: z++ }, true);
              } else {
                const group = state.groups.find(g => g.id === itemId);
                if (group) group.itemIds.forEach(applyZToId);
              }
            };
            selectedIds.forEach(applyZToId);
            closeContextMenu();
          },
        },
        {
          label: "Send to back",
          shortcut: "Shift+[",
          disabled: !hasSelection,
          action: () => {
            state.saveToHistory();
            let z = currentMinZ - 1;
            const applyZToId = (itemId: string) => {
              if (shapes.find((s) => s.id === itemId)) {
                updateShape(itemId, { zIndex: z-- }, true);
              } else if (walls.find((w) => w.id === itemId)) {
                updateWall(itemId, { zIndex: z-- }, true);
              } else if (assets.find((a) => a.id === itemId)) {
                updateAsset(itemId, { zIndex: z-- }, true);
              } else if (dimensions.find((d) => d.id === itemId)) {
                updateDimension(itemId, { zIndex: z-- }, true);
              } else if (labelArrows.find((la) => la.id === itemId)) {
                updateLabelArrow(itemId, { zIndex: z-- }, true);
              } else if (textAnnotations.find((t) => t.id === itemId)) {
                updateTextAnnotation(itemId, { zIndex: z-- }, true);
              } else {
                const group = state.groups.find(g => g.id === itemId);
                if (group) group.itemIds.forEach(applyZToId);
              }
            };
            selectedIds.forEach(applyZToId);
            closeContextMenu();
          },
        }
      );
    }

    actions.push({
      label: "Convert to Shapes",
      disabled: !hasSelection || !selectedIds.some(id => assets.find(a => a.id === id)),
      action: async () => {
        const state = useProjectStore.getState();
        const assetsToConvert = selectedIds.filter(id => assets.find(a => a.id === id));

        for (const id of assetsToConvert) {
          const asset = assets.find(a => a.id === id);
          if (asset) {
            const newShapes = await convertAssetToShapes(asset);
            if (newShapes.length > 0) {
              newShapes.forEach((s) => state.addShape(s));

              // Create a group for the new shapes
              const groupId = `group-${Date.now()}`;
              const newGroup = {
                id: groupId,
                itemIds: newShapes.map((s) => s.id),
                zIndex: asset.zIndex,
              };
              state.addGroup(newGroup);

              state.updateAsset(id, {
                isExploded: true,
                childShapeIds: newShapes.map((s) => s.id),
              });

              // Select the group
              useEditorStore.getState().setSelectedIds([groupId]);
            } else {
              toast.error(`Could not convert asset ${asset.type}`);
            }
          }
        }
        // useEditorStore.getState().clearSelection(); // Don't clear, we just selected the group
        toast.success("Converted assets to shapes (grouped)");
      }
    });

    actions.push({
      label: "Delete",
      shortcut: "Del",
      disabled: !hasSelection,
      action: () => {
        const state = useProjectStore.getState();
        selectedIds.forEach((id) => {
          state.removeShape(id);
          state.removeWall(id);
          state.removeAsset(id);
          state.removeDimension(id);
          state.removeLabelArrow(id);
          state.removeTextAnnotation(id);
        });
        useEditorStore.getState().clearSelection();
      },
    });

    return actions;
  };



  return (
    <div
      ref={canvasRef}
      className={`relative w-full h-full overflow-hidden bg-gray-50 select-none ${activeTool === 'select' ? 'workspace-cursor-default' : ''}`}
      onDragOver={(e) => e.preventDefault()}
      onDrop={handleAssetDrop}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onWheel={handleWheel}
      onContextMenu={handleContextMenu}
      onDoubleClick={handleDoubleClick}
      onClick={() => {
        if (contextMenu) closeContextMenu();
      }
      }
      style={{
        cursor: isPanning ? 'grabbing' : activeTool === 'pan' ? 'grab' : activeTool === 'select' ? undefined : 'crosshair',
      }}
    >
      {gridHud.visible && showGrid && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-50 px-3 py-1 rounded-md text-xs font-semibold bg-slate-900/80 text-white shadow">
          {gridHud.message}
        </div>
      )}
      {/* Grid unit / size control */}
      <div className="absolute top-3 right-3 z-50 flex items-center gap-3 bg-white/90 shadow-sm rounded-md px-3 py-2 text-xs sm:text-sm text-slate-700 border border-slate-200">
        <label className="flex items-center gap-1 cursor-pointer" title="Snap to drawing elements">
          <input
            type="checkbox"
            checked={snapToObjectsEnabled}
            onChange={toggleSnapToObjects}
            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
          <span>Snap to Objects</span>
        </label>
        <div className="w-px h-4 bg-slate-300 mx-1"></div>
        <span className="font-semibold whitespace-nowrap">Grid: {formatGridSize(currentGridSizeValue)}</span>
        <select
          className="text-xs sm:text-sm border border-slate-300 rounded px-1 py-0.5 bg-white focus:outline-none"
          value={unitSystem}
          onChange={(e) => setUnitSystem?.(e.target.value as 'metric' | 'imperial')}
        >
          <option value="metric">Meters</option>
          <option value="imperial">Feet</option>
        </select>
      </div>
      {/* Snap to Anchor HUD for old right-click snap mode */}
      {isSnapMode && snapSourceId && snapAnchor && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-50 px-3 py-1 rounded-md text-xs font-medium bg-blue-600 text-white shadow">
          Snap mode: click a target object to snap <span className="font-semibold">{snapAnchor}</span> of the selected item
        </div>
      )}
      {/* Context Menu */}
      {
        contextMenu && (
          <ContextMenu
            x={contextMenu.x}
            y={contextMenu.y}
            onClose={closeContextMenu}
            actions={getContextMenuActions()}
          />
        )
      }

      <svg
        width={viewportSize.width}
        height={viewportSize.height}
        className="absolute inset-0"
        data-workspace-root="true"
      >
        <TexturePatternDefs />
        <g transform={`translate(${panX}, ${panY}) scale(${zoom})`}>
          {showGrid && <GridRenderer gridSize={sceneGridSize} viewportSize={viewportSize} zoom={zoom} panX={panX} panY={panY} unitSystem={unitSystem} />}
          <SnapMarkersRenderer />

          {/* Unified Rendering sorted by Z-Index */}
          {(() => {
            // Helper to get zIndex safely
            const getZ = (item: any) => (typeof item.zIndex === 'number' ? item.zIndex : 0);

            // Combine all renderable items into one list
            const allRenderables = [
              ...walls.map(w => ({ ...w, _renderType: 'wall' as const })),
              ...shapes.map(s => ({ ...s, _renderType: 'shape' as const })),
              ...assets.map(a => ({ ...a, _renderType: 'asset' as const })),
              ...dimensions.map(d => ({ ...d, _renderType: 'dimension' as const })),
              ...labelArrows.map(l => ({ ...l, _renderType: 'labelArrow' as const })),
              ...textAnnotations.map(t => ({ ...t, _renderType: 'textAnnotation' as const })),
            ].sort((a, b) => getZ(a) - getZ(b));

            return (
              <>
                {allRenderables.map((item) => {
                  if (item._renderType === 'wall') {
                    // eslint-disable-next-line @typescript-eslint/no-unused-vars
                    const { _renderType, ...wall } = item as any;
                    return (
                      <WallRenderer
                        key={wall.id}
                        wall={wall}
                        isSelected={selectedIds.includes(wall.id)}
                        isHovered={hoveredId === wall.id}
                      />
                    );
                  } else if (item._renderType === 'shape') {
                    // eslint-disable-next-line @typescript-eslint/no-unused-vars
                    const { _renderType, ...shape } = item as any;
                    return (
                      <ShapeRenderer
                        key={shape.id}
                        shape={shape}
                        isSelected={selectedIds.includes(shape.id)}
                        isHovered={hoveredId === shape.id}
                      />
                    );
                  } else if (item._renderType === 'asset') {
                    // eslint-disable-next-line @typescript-eslint/no-unused-vars
                    const { _renderType, ...asset } = item as any;
                    return (
                      <AssetRenderer
                        key={asset.id}
                        asset={asset}
                        isSelected={selectedIds.includes(asset.id)}
                        isHovered={hoveredId === asset.id}
                      />
                    );
                  } else if (item._renderType === 'dimension') {
                    // eslint-disable-next-line @typescript-eslint/no-unused-vars
                    const { _renderType, ...dim } = item as any;
                    return (
                      <DimensionRenderer
                        key={dim.id}
                        dimension={dim}
                        zoom={zoom}
                      />
                    );
                  } else if (item._renderType === 'labelArrow') {
                    // eslint-disable-next-line @typescript-eslint/no-unused-vars
                    const { _renderType, ...arrow } = item as any;
                    return (
                      <LabelArrowRenderer
                        key={arrow.id}
                        arrow={arrow}
                        zoom={zoom}
                      />
                    );
                  } else if (item._renderType === 'textAnnotation') {
                    // eslint-disable-next-line @typescript-eslint/no-unused-vars
                    const { _renderType, ...annotation } = item as any;
                    // Do not render if editing
                    if (annotation.id === useEditorStore.getState().editingTextId) return null;

                    return (
                      <TextAnnotationRenderer
                        key={annotation.id}
                        annotation={annotation}
                        zoom={zoom}
                      />
                    );
                  }
                  return null;
                })}

                {/* Auto Dimensions (Show Dimensions Toggle) */}
                <AutoDimensionRenderer
                  walls={walls}
                  shapes={shapes}
                  assets={assets}
                  zoom={zoom}
                />
              </>
            );
          })()}

          {/* AI Plan Placement Preview */}
          {placementMode.active && placementMode.data && (
            <PlacementRenderer
              mouseWorldPos={mouseWorldPos}
            />
          )}

          {/* Snap Mode Source Highlight */}
          {isSnapMode && snapSourceId && (() => {
            const shape = shapes.find(s => s.id === snapSourceId);
            if (shape) {
              return (
                <rect
                  x={shape.x - shape.width / 2}
                  y={shape.y - shape.height / 2}
                  width={shape.width}
                  height={shape.height}
                  fill="none"
                  stroke="#3B82F6" // Blue
                  strokeWidth={3}
                  strokeDasharray="6,3"
                  vectorEffect="non-scaling-stroke"
                  pointerEvents="none"
                />
              );
            }
            const asset = assets.find(a => a.id === snapSourceId);
            if (asset) {
              return (
                <rect
                  x={asset.x - (asset.width * asset.scale) / 2}
                  y={asset.y - (asset.height * asset.scale) / 2}
                  width={asset.width * asset.scale}
                  height={asset.height * asset.scale}
                  fill="none"
                  stroke="#3B82F6"
                  strokeWidth={3}
                  strokeDasharray="6,3"
                  vectorEffect="non-scaling-stroke"
                  pointerEvents="none"
                />
              );
            }
            const wall = walls.find(w => w.id === snapSourceId);
            if (wall) {
              return (
                <g pointerEvents="none">
                  {wall.edges.map(edge => {
                    const nodeA = wall.nodes.find(n => n.id === edge.nodeA);
                    const nodeB = wall.nodes.find(n => n.id === edge.nodeB);
                    if (!nodeA || !nodeB) return null;
                    return (
                      <line
                        key={edge.id}
                        x1={nodeA.x}
                        y1={nodeA.y}
                        x2={nodeB.x}
                        y2={nodeB.y}
                        stroke="#3B82F6"
                        strokeWidth={Math.max(edge.thickness + 100, 200)}
                        strokeOpacity={0.4}
                        strokeLinecap="round"
                      />
                    );
                  })}
                </g>
              );
            }
            return null;
          })()}

          <WallTool
            isActive={activeTool === 'wall'}
            thickness={sceneStore.getCurrentWallThickness()}
          />

          <DimensionTool isActive={activeTool === 'dimension'} />
          <ArchTool isActive={activeTool === 'arch'} />
          <LabelArrowTool isActive={activeTool === 'label-arrow'} />
          <TrimTool isActive={activeTool === 'trim'} />

          {['shape-rectangle', 'shape-ellipse', 'shape-line', 'shape-arrow', 'shape-polygon'].includes(activeTool) && (
            <ShapeTool
              isActive={true}
              shapeType={activeTool.replace('shape-', '') as 'rectangle' | 'ellipse' | 'line' | 'arrow' | 'polygon'}
            />
          )}

          <FreehandTool isActive={activeTool === 'freehand'} />

          {/* Rectangular Selection Preview */}
          {selectionRect && (
            <rect
              x={Math.min(selectionRect.x1, selectionRect.x2)}
              y={Math.min(selectionRect.y1, selectionRect.y2)}
              width={Math.abs(selectionRect.x2 - selectionRect.x1)}
              height={Math.abs(selectionRect.y2 - selectionRect.y1)}
              fill="rgba(59, 130, 246, 0.1)"
              stroke="#3b82f6"
              strokeWidth={1}
              strokeDasharray="4,4"
              vectorEffect="non-scaling-stroke"
              pointerEvents="none"
            />
          )}



          {/* SelectionTool handles will be rendered outside the scaled group for fixed size */}
        </g>
        {/* Render SelectionTool outside scaled group so handles stay fixed size */}
        <SelectionTool isActive={activeTool === 'select'} />

        {/* Snap Guides - Rendered last to be on top */}
        <g transform={`translate(${panX}, ${panY}) scale(${zoom})`}>
          <SnapGuidesRenderer zoom={zoom} />
        </g>
      </svg>

      <TextAnnotationTool isActive={activeTool === 'text-annotation'} />

      {/* Comments Layer */}
      {
        comments.map((comment) => (
          <CommentRenderer
            key={comment.id}
            comment={comment}
            zoom={zoom}
            panX={panX}
            panY={panY}
            isActive={activeCommentId === comment.id}
            onActivate={setActiveCommentId}
            onDeactivate={() => setActiveCommentId(null)}
            onUpdate={updateComment}
            onResolve={resolveComment}
            onDelete={removeComment}
          />
        ))
      }

      {
        contextMenu && (
          <ContextMenu
            x={contextMenu.x}
            y={contextMenu.y}
            onClose={closeContextMenu}
            actions={getContextMenuActions()}
          />
        )
      }

      {/* Duplicate/Distribute Modal */}
      <DuplicateDistributeModal
        isOpen={duplicateDistributeModal.isOpen}
        mode={duplicateDistributeModal.mode}
        onClose={() => setDuplicateDistributeModal({ isOpen: false, mode: 'duplicate' })}
        onConfirm={(data) => {
          if (duplicateDistributeModal.mode === 'duplicate') {
            // Duplicate & distribute
            const newIds = duplicateSelection(data.count || 1);

            if (newIds && newIds.length > 0) {
              // Distribute immediately using the new IDs
              distributeSelection(
                data.type || 'horizontal',
                data.spacing,
                data.diameter,
                newIds
              );
            }
          } else {
            distributeSelection(
              data.type || 'horizontal',
              data.spacing,
              data.diameter
            );
          }
          setDuplicateDistributeModal({ isOpen: false, mode: 'duplicate' });
        }}
      />


    </div >
  );
}
