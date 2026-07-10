"use client";

import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import toast from 'react-hot-toast';
import { useEditorStore } from '@/store/editorStore';
import { useProjectStore } from '@/store/projectStore';
import { useUserStore } from '@/store/userStore';
import type { Shape, Asset, Wall } from '@/store/projectStore';
import { useSceneStore } from '@/store/sceneStore';
import WallRenderer from './renderers/WallRenderer';
import ShapeRenderer from './renderers/ShapeRenderer';
import AssetRenderer from './renderers/AssetRenderer';
import CanvasGridLayer from './renderers/CanvasGridLayer';
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
import { findClosestSnapPointFromList, findSnapPointInShapes, getSnapPoints } from '@/utils/snapToDrawing';
import { getMarqueeVertices } from '@/utils/assetUtils';

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
import { useCollaboration } from '@/hooks/useCollaboration';
import { findSnapPoint, findWallSnapPoint } from '@/utils/wallSnapping';
import { convertAssetToShapes } from '@/utils/assetUtils';
import { texturePatterns } from '@/utils/texturePatterns';
import { calculateSmartSnap } from '@/utils/smartSnapping'; // Added import
import { trimToBlendShapes } from '@/utils/shapeBoolean';
import { DEFAULT_ASSET_STROKE_WIDTH, canRenderAssetOnCanvas } from '@/utils/assetRenderMode';
import { SpatialIndex, getRotatedItemBounds } from '@/utils/spatialIndex';
import { TEXT_STYLE_FONTS, ensureGoogleFontsLoaded } from '@/utils/googleFonts';

interface Workspace2DProps {
  width?: number;
  height?: number;
}

const getWallRenderKey = (wall: Wall | (Wall & { _renderType?: 'wall' })) => {
  const nodeKey = wall.nodes
    .map((node) => `${node.id}:${node.x.toFixed(3)},${node.y.toFixed(3)}`)
    .join('|');
  const edgeKey = wall.edges
    .map((edge) => `${edge.id}:${edge.nodeA}->${edge.nodeB}:${edge.thickness ?? 150}`)
    .join('|');
  return `${wall.id}:${nodeKey}:${edgeKey}`;
};

type SnapObject =
  | { type: 'shape'; object: Shape }
  | { type: 'asset'; object: Asset }
  | { type: 'wall'; object: Wall };

type DragPreview = {
  ids: string[];
  dx: number;
  dy: number;
};

const LARGE_SELECTION_DRAG_PREVIEW_THRESHOLD = 12;
const MOUSE_WORLD_POS_TOOLS = new Set(['wall', 'shape-line', 'shape-arrow', 'dimension', 'arch']);
const assetDefinitionById = new Map(ASSET_LIBRARY.map((asset) => [asset.id, asset]));

const distanceToSegment = (
  px: number,
  py: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number
) => {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lengthSq = dx * dx + dy * dy;

  if (lengthSq === 0) {
    return Math.hypot(px - x1, py - y1);
  }

  const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / lengthSq));
  const projX = x1 + t * dx;
  const projY = y1 + t * dy;
  return Math.hypot(px - projX, py - projY);
};

const isPointInPolygon = (x: number, y: number, points: { x: number; y: number }[]) => {
  let inside = false;

  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const xi = points[i].x;
    const yi = points[i].y;
    const xj = points[j].x;
    const yj = points[j].y;

    const intersects = ((yi > y) !== (yj > y))
      && (x < ((xj - xi) * (y - yi)) / ((yj - yi) || 0.0000001) + xi);

    if (intersects) {
      inside = !inside;
    }
  }

  return inside;
};

const segmentsIntersect = (
  ax: number,
  ay: number,
  bx: number,
  by: number,
  cx: number,
  cy: number,
  dx: number,
  dy: number
) => {
  const orientation = (
    px: number,
    py: number,
    qx: number,
    qy: number,
    rx: number,
    ry: number
  ) => {
    const value = (qy - py) * (rx - qx) - (qx - px) * (ry - qy);
    if (Math.abs(value) < 0.000001) return 0;
    return value > 0 ? 1 : 2;
  };

  const onSegment = (
    px: number,
    py: number,
    qx: number,
    qy: number,
    rx: number,
    ry: number
  ) =>
    qx <= Math.max(px, rx) + 0.000001 &&
    qx >= Math.min(px, rx) - 0.000001 &&
    qy <= Math.max(py, ry) + 0.000001 &&
    qy >= Math.min(py, ry) - 0.000001;

  const o1 = orientation(ax, ay, bx, by, cx, cy);
  const o2 = orientation(ax, ay, bx, by, dx, dy);
  const o3 = orientation(cx, cy, dx, dy, ax, ay);
  const o4 = orientation(cx, cy, dx, dy, bx, by);

  if (o1 !== o2 && o3 !== o4) return true;
  if (o1 === 0 && onSegment(ax, ay, cx, cy, bx, by)) return true;
  if (o2 === 0 && onSegment(ax, ay, dx, dy, bx, by)) return true;
  if (o3 === 0 && onSegment(cx, cy, ax, ay, dx, dy)) return true;
  if (o4 === 0 && onSegment(cx, cy, bx, by, dx, dy)) return true;
  return false;
};

const wallIntersectsRect = (
  wall: Wall,
  minX: number,
  minY: number,
  maxX: number,
  maxY: number
) => {
  const nodeMap = new Map(wall.nodes.map((node) => [node.id, node]));
  const rectEdges: [number, number, number, number][] = [
    [minX, minY, maxX, minY],
    [maxX, minY, maxX, maxY],
    [maxX, maxY, minX, maxY],
    [minX, maxY, minX, minY],
  ];

  for (const edge of wall.edges) {
    const nodeA = nodeMap.get(edge.nodeA);
    const nodeB = nodeMap.get(edge.nodeB);
    if (!nodeA || !nodeB) continue;

    const nodeAInRect = nodeA.x >= minX && nodeA.x <= maxX && nodeA.y >= minY && nodeA.y <= maxY;
    const nodeBInRect = nodeB.x >= minX && nodeB.x <= maxX && nodeB.y >= minY && nodeB.y <= maxY;
    if (nodeAInRect || nodeBInRect) {
      return true;
    }

    for (const [x1, y1, x2, y2] of rectEdges) {
      if (segmentsIntersect(nodeA.x, nodeA.y, nodeB.x, nodeB.y, x1, y1, x2, y2)) {
        return true;
      }
    }
  }

  return false;
};

const isPointInsideWall = (wall: Wall, worldX: number, worldY: number) => {
  const nodeMap = new Map(wall.nodes.map((node) => [node.id, node]));

  for (const edge of wall.edges) {
    const nodeA = nodeMap.get(edge.nodeA);
    const nodeB = nodeMap.get(edge.nodeB);
    if (!nodeA || !nodeB) continue;

    if (distanceToSegment(worldX, worldY, nodeA.x, nodeA.y, nodeB.x, nodeB.y) <= ((edge.thickness || 150) / 2) + 20) {
      return true;
    }
  }

  return false;
};


// ── STATIC DRAWING LAYER ─────────────────────────────────────────────────────
// Parent SVG transforms handle zooming, so walls/shapes/assets do not need to
// re-render just because the zoom value changed.
const StaticDrawingLayer = React.memo(({
  visibleRenderables,
  hiddenIds,
  selectedIds
}: {
  visibleRenderables: any[],
  hiddenIds?: Set<string>,
  selectedIds: string[]
}) => {
  const selectedIdSet = React.useMemo(() => new Set(selectedIds), [selectedIds]);

  return (
    <>
      {visibleRenderables.map((item) => {
        if (hiddenIds?.has(item.id)) return null;
        switch (item._renderType) {
          case 'wall':
            return <WallRenderer key={getWallRenderKey(item)} wall={item} />;
          
          case 'shape':
            if (item.type === 'freehand') {
              return <FreehandRenderer key={item.id} shape={item} />;
            }
            return <ShapeRenderer key={item.id} shape={item} />;

          case 'asset':
            if (canRenderAssetOnCanvas(item)) return null;
            return <AssetRenderer key={item.id} asset={item} isSelected={selectedIdSet.has(item.id)} />;

          default:
            return null;
        }
      })}
    </>
  );
});
StaticDrawingLayer.displayName = 'StaticDrawingLayer';

// ── ANNOTATION DRAWING LAYER ─────────────────────────────────────────────────
// These items use inverse zoom to keep text/handles readable, so they are the
// only regular drawing items that should update on each zoom tick.
const AnnotationDrawingLayer = React.memo(({
  visibleRenderables,
  zoom,
  hiddenIds
}: {
  visibleRenderables: any[],
  zoom: number,
  hiddenIds?: Set<string>
}) => {
  return (
    <>
      {visibleRenderables.map((item) => {
        if (hiddenIds?.has(item.id)) return null;
        switch (item._renderType) {
          case 'dimension':
            return <DimensionRenderer key={item.id} dimension={item} zoom={zoom} />;

          case 'labelArrow':
            return <LabelArrowRenderer key={item.id} arrow={item} zoom={zoom} />;

          case 'textAnnotation':
            return <TextAnnotationRenderer key={item.id} annotation={item} zoom={zoom} />;

          default:
            return null;
        }
      })}
    </>
  );
});
AnnotationDrawingLayer.displayName = 'AnnotationDrawingLayer';

const DragPreviewLayer = React.memo(({
  visibleRenderables,
  preview,
  zoom
}: {
  visibleRenderables: any[],
  preview: DragPreview | null,
  zoom: number
}) => {
  const items = React.useMemo(() => {
    if (!preview) return [];
    const previewIds = new Set(preview.ids);
    return visibleRenderables.filter(item => previewIds.has(item.id));
  }, [visibleRenderables, preview?.ids]);

  if (!preview) return null;
  if (items.length === 0) return null;

  return (
    <g transform={`translate(${preview.dx}, ${preview.dy})`} className="drag-preview-layer pointer-events-none">
      {items.map((item) => {
        switch (item._renderType) {
          case 'wall':
            return <WallRenderer key={`preview-${getWallRenderKey(item)}`} wall={item} />;

          case 'shape':
            if (item.type === 'freehand') {
              return <FreehandRenderer key={`preview-${item.id}`} shape={item} />;
            }
            return <ShapeRenderer key={`preview-${item.id}`} shape={item} />;

          case 'asset':
            if (canRenderAssetOnCanvas(item)) return null;
            return <AssetRenderer key={`preview-${item.id}`} asset={item} />;

          case 'dimension':
            return <DimensionRenderer key={`preview-${item.id}`} dimension={item} zoom={zoom} />;

          case 'labelArrow':
            return <LabelArrowRenderer key={`preview-${item.id}`} arrow={item} zoom={zoom} />;

          case 'textAnnotation':
            return <TextAnnotationRenderer key={`preview-${item.id}`} annotation={item} zoom={zoom} />;

          default:
            return null;
        }
      })}
    </g>
  );
});
DragPreviewLayer.displayName = 'DragPreviewLayer';

// ── SELECTION HIGHLIGHT LAYER ────────────────────────────────────────────────
// Renders only the blue outlines/glows for selected and hovered items.
// This layer is fast because it only iterates through a few items.
const SelectionHighlightLayer = React.memo(({ 
  visibleRenderables,
  selectedIds, 
  hoveredId,
  verticesMap
}: { 
  visibleRenderables: any[],
  selectedIds: string[], 
  hoveredId: string | null,
  verticesMap: Record<string, { x: number; y: number }[]>
}) => {
  const selectionSet = React.useMemo(() => new Set(selectedIds), [selectedIds]);
  
  // Find only the items that need a highlight
  const highlights = React.useMemo(() => {
    return visibleRenderables.filter(item => selectionSet.has(item.id) || item.id === hoveredId);
  }, [visibleRenderables, selectionSet, hoveredId]);

  if (highlights.length === 0) return null;

  return (
    <g className="interaction-highlights pointer-events-none">
      {highlights.map(item => {
        const isSelected = selectionSet.has(item.id);
        const isHovered = hoveredId === item.id;
        const vertices = verticesMap[item.id] || [];
        
        return (
          <React.Fragment key={`highlight-group-${item.id}`}>
            {item._renderType === 'shape' && (
              <ShapeRenderer shape={item} isSelected={isSelected} isHovered={isHovered} isHighlightOnly />
            )}
            {item._renderType === 'asset' && (
              <AssetRenderer asset={item} isSelected={isSelected} isHovered={isHovered} isHighlightOnly />
            )}
            {item._renderType === 'wall' && (
              <WallRenderer key={`highlight-${getWallRenderKey(item)}`} wall={item} isSelected={isSelected} isHovered={isHovered} isHighlightOnly />
            )}
            
            {/* Premium Vertex Visualization */}
            {(isSelected || isHovered) && vertices.length > 0 && (
              <g className="vertex-anchors pointer-events-none">
                {vertices.map((v, i) => (
                  <circle
                    key={`v-${item.id}-${i}`}
                    cx={v.x}
                    cy={v.y}
                    r={i % 5 === 0 ? 4 : 2} // Visual distinction for base vs offset points
                    fill={i % 5 === 0 ? "#3b82f6" : "#22c55e"} // Blue for base, Green for offsets
                    stroke="white"
                    strokeWidth={1}

                    style={{ filter: 'drop-shadow(0 0 2px rgba(0, 0, 0, 0.3))' }}
                  />
                ))}
              </g>
            )}
          </React.Fragment>
        );
      })}
    </g>
  );
});

// ── RENDER LAYER COMPONENT ───────────────────────────────────────────────────
// High-level wrapper that coordinates the two layers.
const RenderLayer = React.memo(({ 
  visibleRenderables, 
  selectedIds, 
  hoveredId, 
  zoom,
  verticesMap,
  dragPreview
}: { 
  visibleRenderables: any[], 
  selectedIds: string[], 
  hoveredId: string | null, 
  zoom: number,
  verticesMap: Record<string, { x: number; y: number }[]>,
  dragPreview: DragPreview | null
}) => {
  const previewHiddenIds = React.useMemo(
    () => dragPreview ? new Set(dragPreview.ids) : undefined,
    [dragPreview?.ids]
  );

  return (
    <>
      <StaticDrawingLayer visibleRenderables={visibleRenderables} hiddenIds={previewHiddenIds} selectedIds={selectedIds} />
      <AnnotationDrawingLayer visibleRenderables={visibleRenderables} zoom={zoom} hiddenIds={previewHiddenIds} />
      <DragPreviewLayer visibleRenderables={visibleRenderables} preview={dragPreview} zoom={zoom} />
      {!dragPreview && (
        <SelectionHighlightLayer 
          visibleRenderables={visibleRenderables}
          selectedIds={selectedIds} 
          hoveredId={hoveredId} 
          verticesMap={verticesMap}
        />
      )}
    </>
  );
});
RenderLayer.displayName = 'RenderLayer';

export default function Workspace2D({
  width = 1200,
  height = 800
}: Workspace2DProps) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const [viewportSize, setViewportSize] = useState({ width: 0, height: 0 });
  // Removed local mouseWorldPos to use EditorStore's instead for performance
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);
  const [isDraggingItem, setIsDraggingItem] = useState(false);
  const [draggedItemStart, setDraggedItemStart] = useState<{ x: number; y: number } | null>(null);
  const draggedItemStartRef = useRef<{ x: number; y: number } | null>(null);
  const [dragPreview, setDragPreview] = useState<DragPreview | null>(null);
  const dragPreviewRef = useRef<DragPreview | null>(null);
  const pendingDragPreviewRef = useRef<DragPreview | null>(null);
  const dragPreviewRafRef = useRef<number | null>(null);
  const lastHoverHitTestRef = useRef(0);
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

  useEffect(() => {
    ensureGoogleFontsLoaded(TEXT_STYLE_FONTS);
  }, []);
  const assets = useProjectStore(s => s.assets);
  const walls = useProjectStore(s => s.walls);
  const shapes = useProjectStore(s => s.shapes);
  const assetById = useMemo(() => new Map(assets.map((asset) => [asset.id, asset])), [assets]);
  const assetSpatialIndex = useMemo(
    () => new SpatialIndex(
      assets
        .filter((asset) => !asset.isExploded)
        .map((asset) => ({
          id: asset.id,
          item: asset,
          bounds: getRotatedItemBounds(asset),
          zIndex: asset.zIndex || 0,
        }))
    ),
    [assets]
  );
  const findTopAssetAtPoint = useCallback((worldX: number, worldY: number) => {
    const hitAssets = assetSpatialIndex.queryPoint(worldX, worldY);
    if (hitAssets.length === 0) return null;

    let best = hitAssets[0];
    for (let index = 1; index < hitAssets.length; index += 1) {
      const entry = hitAssets[index];
      if ((entry.zIndex || 0) >= (best.zIndex || 0)) {
        best = entry;
      }
    }
    return best;
  }, [assetSpatialIndex]);
  const canvasBackedAssetIds = useMemo(() => {
    const ids = new Set<string>();
    assets.forEach((asset) => {
      if (!asset.isExploded && canRenderAssetOnCanvas(asset)) ids.add(asset.id);
    });
    return ids;
  }, [assets]);
  const verticesMap = useMemo(() => {
    const map: Record<string, { x: number; y: number }[]> = {};

    assets.forEach((asset) => {
      const assetDef = assetDefinitionById.get(asset.type);
      if (assetDef?.category === 'Marquee') {
        map[asset.id] = getMarqueeVertices(asset);
      }
    });

    return map;
  }, [assets]);
  const dimensions = useProjectStore(s => s.dimensions);
  const textAnnotations = useProjectStore(s => s.textAnnotations);
  const labelArrows = useProjectStore(s => s.labelArrows);
  const addWall = useProjectStore(s => s.addWall);
  const updateWall = useProjectStore(s => s.updateWall);
  const addShape = useProjectStore(s => s.addShape);
  const updateShape = useProjectStore(s => s.updateShape);
  const batchUpdateShapes = useProjectStore(s => s.batchUpdateShapes);
  const addAsset = useProjectStore(s => s.addAsset);
  const updateAsset = useProjectStore(s => s.updateAsset);
  const batchUpdateAssets = useProjectStore(s => s.batchUpdateAssets);
  const batchUpdateWalls = useProjectStore(s => s.batchUpdateWalls);
  const removeItemsBatch = useProjectStore(s => s.removeItemsBatch);
  const groups = useProjectStore(s => s.groups);
  const addGroup = useProjectStore(s => s.addGroup);
  const groupSelection = useProjectStore(s => s.groupSelection);
  const ungroupSelection = useProjectStore(s => s.ungroupSelection);
  const undo = useProjectStore(s => s.undo);
  const redo = useProjectStore(s => s.redo);
  const saveToHistory = useProjectStore(s => s.saveToHistory);
  const updateDimension = useProjectStore(s => s.updateDimension);
  const updateTextAnnotation = useProjectStore(s => s.updateTextAnnotation);
  const updateLabelArrow = useProjectStore(s => s.updateLabelArrow);
  const removeDimension = useProjectStore(s => s.removeDimension);
  const addComment = useProjectStore(s => s.addComment);
  const resolveIdsWithGroups = useProjectStore(s => s.resolveIdsWithGroups);
  const getNextZIndex = useProjectStore(s => s.getNextZIndex);
  const addShapeBatch = useProjectStore(s => s.addShapeBatch);
  const addAssetBatch = useProjectStore(s => s.addAssetBatch);
  const addWallBatch = useProjectStore(s => s.addWallBatch);
  const batchUpdateItems = useProjectStore(s => s.batchUpdateItems);
  const copySelection = useProjectStore(s => s.copySelection);
  const pasteSelection = useProjectStore(s => s.pasteSelection);
  const cutSelection = useProjectStore(s => s.cutSelection);
  const comments = useProjectStore(s => s.comments);
  const updateComment = useProjectStore(s => s.updateComment);
  const removeComment = useProjectStore(s => s.removeComment);
  const resolveComment = useProjectStore(s => s.resolveComment);

  useEffect(() => {
    const legacyStrokeUpdates = assets
      .filter((asset) =>
        !asset.isExploded &&
        asset.strokeWidth !== undefined &&
        Math.abs(asset.strokeWidth - 0.5) < 0.001
      )
      .map((asset) => ({
        id: asset.id,
        updates: { strokeWidth: DEFAULT_ASSET_STROKE_WIDTH },
      }));

    if (legacyStrokeUpdates.length > 0) {
      batchUpdateAssets(legacyStrokeUpdates, true);
    }
  }, [assets, batchUpdateAssets]);

  
  const { activeUsers, updateCursor, updateTyping } = useCollaboration(undefined, undefined);


  const activeTool = useEditorStore(s => s.activeTool);

  useEffect(() => {
    setSelectionRect(null);
    setDragStart(null);
  }, [activeTool]);

  const setActiveTool = useEditorStore(s => s.setActiveTool);
  const selectedIds = useEditorStore(s => s.selectedIds);
  const setSelectedIds = useEditorStore(s => s.setSelectedIds);
  const clearSelection = useEditorStore(s => s.clearSelection);
  const hoveredId = useEditorStore(s => s.hoveredId);
  const setHoveredId = useEditorStore(s => s.setHoveredId);
  const zoom = useEditorStore(s => s.zoom);
  const panX = useEditorStore(s => s.panX);
  const panY = useEditorStore(s => s.panY);
  const setPan = useEditorStore(s => s.setPan);
  const setViewportTransform = useEditorStore(s => s.setViewportTransform);
  const panBy = useEditorStore(s => s.panBy);
  const isPanning = useEditorStore(s => s.isPanning);
  const setPanning = useEditorStore(s => s.setPanning);
  const setDragging = useEditorStore(s => s.setDragging);
  const zoomIn = useEditorStore(s => s.zoomIn);
  const zoomOut = useEditorStore(s => s.zoomOut);
  const canvasOffset = useEditorStore(s => s.canvasOffset);
  const setCanvasOffset = useEditorStore(s => s.setCanvasOffset);
  const gridSize = useEditorStore(s => s.gridSize);
  const isSnapMode = useEditorStore(s => s.isSnapMode);
  const snapSourceId = useEditorStore(s => s.snapSourceId);
  const snapAnchor = useEditorStore(s => s.snapAnchor);
  const setSnapMode = useEditorStore(s => s.setSnapMode);
  const snapToObjectsEnabled = useEditorStore(s => s.snapToObjects);
  const toggleSnapToObjects = useEditorStore(s => s.toggleSnapToObjects);
  const placementMode = useEditorStore(s => s.placementMode);
  const setPlacementMode = useEditorStore(s => s.setPlacementMode);
  const pendingImportShape = useEditorStore(s => s.pendingImportShape);
  const setPendingImportShape = useEditorStore(s => s.setPendingImportShape);
  const mouseWorldPos = useEditorStore(s => s.mouseWorldPos);
  const setMouseWorldPos = useEditorStore(s => s.setMouseWorldPos);
  const screenToWorld = useEditorStore(s => s.screenToWorld);
  const setEditingTextId = useEditorStore(s => s.setEditingTextId);
  const setSelectedEdgeId = useEditorStore(s => s.setSelectedEdgeId);
  const wheelTransformRef = useRef({ zoom, panX, panY });
  const pendingViewportTransformRef = useRef<{ zoom: number; panX: number; panY: number } | null>(null);
  const viewportTransformRafRef = useRef<number | null>(null);
  const renderableCacheRef = useRef(new WeakMap<object, any>());

  useEffect(() => {
    wheelTransformRef.current = { zoom, panX, panY };
  }, [zoom, panX, panY]);

  const scheduleDragPreview = useCallback((preview: DragPreview) => {
    pendingDragPreviewRef.current = preview;
    if (dragPreviewRafRef.current !== null) return;

    dragPreviewRafRef.current = requestAnimationFrame(() => {
      dragPreviewRafRef.current = null;
      setDragPreview(pendingDragPreviewRef.current);
    });
  }, []);

  const clearDragPreview = useCallback(() => {
    if (dragPreviewRafRef.current !== null) {
      cancelAnimationFrame(dragPreviewRafRef.current);
      dragPreviewRafRef.current = null;
    }
    pendingDragPreviewRef.current = null;
    dragPreviewRef.current = null;
    setDragPreview(null);
  }, []);

  useEffect(() => {
    return () => {
      if (dragPreviewRafRef.current !== null) {
        cancelAnimationFrame(dragPreviewRafRef.current);
      }
      if (viewportTransformRafRef.current !== null) {
        cancelAnimationFrame(viewportTransformRafRef.current);
      }
    };
  }, []);

  const scheduleViewportTransform = useCallback((nextTransform: { zoom: number; panX: number; panY: number }) => {
    pendingViewportTransformRef.current = nextTransform;

    if (viewportTransformRafRef.current !== null) return;

    viewportTransformRafRef.current = requestAnimationFrame(() => {
      viewportTransformRafRef.current = null;
      const pending = pendingViewportTransformRef.current;
      pendingViewportTransformRef.current = null;

      if (!pending) return;
      setViewportTransform(pending.zoom, pending.panX, pending.panY);
    });
  }, [setViewportTransform]);

  const wallIdSet = useMemo(() => new Set(walls.map((wall) => wall.id)), [walls]);

  const shouldUseDragPreviewForIds = useCallback((ids: string[]) => {
    if (ids.length > 0 && ids.every(id => wallIdSet.has(id))) return true;
    if (ids.length > 0 && ids.every(id => assetById.has(id))) return true;
    if (ids.length >= LARGE_SELECTION_DRAG_PREVIEW_THRESHOLD) return true;
    return ids.length > 0 && ids.every(id => canvasBackedAssetIds.has(id));
  }, [assetById, canvasBackedAssetIds, wallIdSet]);

  // Top-level memoized list of all renderable items for efficient hit-testing and rendering
  const allRenderables = useMemo(() => {
    const getZ = (item: any) => (typeof item.zIndex === 'number' ? item.zIndex : 0);
    const toRenderable = <T extends object>(item: T, renderType: string) => {
      const cached = renderableCacheRef.current.get(item);
      if (cached && cached._renderType === renderType) {
        return cached;
      }

      const next = { ...item, _renderType: renderType };
      renderableCacheRef.current.set(item, next);
      return next;
    };

    return [
      ...walls.map(w => toRenderable(w, 'wall')),
      ...shapes.map(s => toRenderable(s, 'shape')),
      ...assets.map(a => toRenderable(a, 'asset')),
      ...dimensions.map(d => toRenderable(d, 'dimension')),
      ...labelArrows.map(l => toRenderable(l, 'labelArrow')),
      ...textAnnotations.map(t => toRenderable(t, 'textAnnotation')),
    ].sort((a, b) => getZ(a) - getZ(b));
  }, [walls, shapes, assets, dimensions, labelArrows, textAnnotations]);

  const svgRenderables = useMemo(
    () => allRenderables.filter((item: any) => {
      if (item._renderType !== 'asset') return true;
      return !canRenderAssetOnCanvas(item);
    }),
    [allRenderables]
  );

  // Viewport Culling - Filter items that are actually visible to maximize performance with 100k+ assets
  // Using a ref to track the "last calculated bounds" to avoid re-rendering the whole item list on every single pan pixel
  const lastCullBounds = useRef({ 
    left: 0, 
    top: 0, 
    right: 0, 
    bottom: 0, 
    zoom: 0, 
    sourceRenderables: null as any[] | null,
    lastResult: [] as any[] 
  });
  
  const visibleRenderables = useMemo(() => {
    const margin = 1000 / zoom; // Larger margin for better pre-loading
    const worldLeft = -panX / zoom - margin;
    const worldTop = -panY / zoom - margin;
    const worldRight = (viewportSize.width - panX) / zoom + margin;
    const worldBottom = (viewportSize.height - panY) / zoom + margin;

    // Determine if the camera has moved enough to justify a re-cull (hysteresis)
    const dx = Math.abs(worldLeft - lastCullBounds.current.left);
    const dy = Math.abs(worldTop - lastCullBounds.current.top);
    const dz = Math.abs(zoom - lastCullBounds.current.zoom) / zoom;
    
    // Only re-filter if we moved more than 20% of the viewport or zoomed > 10%
    const viewportWidth = worldRight - worldLeft;
    const viewportHeight = worldBottom - worldTop;
    if (
      lastCullBounds.current.sourceRenderables === svgRenderables &&
      dx < viewportWidth * 0.2 &&
      dy < viewportHeight * 0.2 &&
      dz < 0.1
    ) {
       // Return the same array reference to prevent RenderLayer from re-rendering
       return lastCullBounds.current.lastResult || svgRenderables;
    }

    // 2. Filter renderables based on spatial intersection
    const result = svgRenderables.filter((item: any) => {
      // Wall culling (checks all nodes)
      if (item._renderType === 'wall' && item.nodes) {
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        for (const n of item.nodes) {
          if (n.x < minX) minX = n.x;
          if (n.y < minY) minY = n.y;
          if (n.x > maxX) maxX = n.x;
          if (n.y > maxY) maxY = n.y;
        }
        return !(maxX < worldLeft || minX > worldRight || maxY < worldTop || minY > worldBottom);
      }

      // Label Arrow and Dimension culling (checks start/end points)
      if ((item._renderType === 'labelArrow' || item._renderType === 'dimension') && item.startPoint && item.endPoint) {
        const minX = Math.min(item.startPoint.x, item.endPoint.x);
        const maxX = Math.max(item.startPoint.x, item.endPoint.x);
        const minY = Math.min(item.startPoint.y, item.endPoint.y);
        const maxY = Math.max(item.startPoint.y, item.endPoint.y);
        const pad = 200; // Padding for labels/styling
        return !(maxX + pad < worldLeft || minX - pad > worldRight || maxY + pad < worldTop || minY - pad > worldBottom);
      }

      // Text Annotation culling
      if (item._renderType === 'textAnnotation') {
        const x = item.x ?? 0;
        const y = item.y ?? 0;
        const w = item.width ?? 600;
        const h = item.height ?? 200;
        const halfSize = Math.max(w, h);
        return !(x + halfSize < worldLeft || x - halfSize > worldRight || y + halfSize < worldTop || y - halfSize > worldBottom);
      }

      // Standard assets and shapes (centered items)
      const x = item.x ?? 0;
      const y = item.y ?? 0;
      const w = item.width ?? 1000;
      const h = item.height ?? 1000;
      const halfSize = Math.max(w, h); 
      return !(x + halfSize < worldLeft || x - halfSize > worldRight || y + halfSize < worldTop || y - halfSize > worldBottom);
    });

    // Save bounds for next frame
    lastCullBounds.current = { 
      left: worldLeft, 
      top: worldTop, 
      right: worldRight, 
      bottom: worldBottom, 
      zoom,
      sourceRenderables: svgRenderables,
      lastResult: result as any
    };

    return result;
  }, [svgRenderables, panX, panY, zoom, viewportSize]);

  const autoDimensionShapes = useMemo(
    () => shapes.filter((shape) => (shape as any).showDimensions && shape.type !== 'line' && shape.type !== 'arrow'),
    [shapes]
  );
  const autoDimensionAssets = useMemo(
    () => assets.filter((asset) => (asset as any).showDimensions && !asset.isExploded),
    [assets]
  );

  const hoveredSnapPoints = useMemo(() => {
    if (!hoveredId) return [];

    const shape = shapes.find((item) => item.id === hoveredId);
    if (shape) return getSnapPoints(shape);

    const asset = assetById.get(hoveredId);
    if (asset) {
      const assetDef = assetDefinitionById.get(asset.type);
      return assetDef?.category === 'Marquee' ? getSnapPoints(asset) : [];
    }

    const wall = walls.find((item) => item.id === hoveredId);
    if (wall) return getSnapPoints(wall);

    return [];
  }, [hoveredId, shapes, assetById, walls]);

  const activeHoveredSnapPoint = useMemo(() => {
    if (hoveredSnapPoints.length === 0) return null;
    return findClosestSnapPointFromList(mouseWorldPos, hoveredSnapPoints, 20 / zoom);
  }, [hoveredSnapPoints, mouseWorldPos, zoom]);


  const showGrid = useSceneStore(s => s.showGrid);
  const sceneGridSize = useSceneStore(s => s.gridSize);
  const availableGridSizes = useSceneStore(s => s.availableGridSizes || []);
  const selectedGridSizeIndex = useSceneStore(s => s.selectedGridSizeIndex || 0);
  const currentGridSizeValue = availableGridSizes[selectedGridSizeIndex] || sceneGridSize || 1000;
  const snapToGridEnabled = useSceneStore(s => s.snapToGridEnabled);
  const { user } = useUserStore();
  const unitSystem = useSceneStore(s => s.unitSystem || 'metric-mm');
  const setUnitSystem = useSceneStore(s => s.setUnitSystem);
  const setSnapGuides = useSceneStore(s => s.setSnapGuides);
  const selectMultipleAssets = useSceneStore(s => s.selectMultipleAssets);
  const isRectangularSelectionMode = useSceneStore(s => s.isRectangularSelectionMode);
  const currentWallThickness = useSceneStore(s => {
    const wallTypeConfig = s.availableWallTypes.find(wallType => wallType.id === s.wallType);
    return wallTypeConfig?.thickness ?? 150;
  });
  const initialGridHudSkip = useRef(true);

  const formatGridSize = useCallback((size: number) => {
    if (unitSystem === 'imperial-ft') {
      const feet = size / 304.8; // mm to feet
      const rounded = feet >= 10 ? feet.toFixed(0) : feet.toFixed(1);
      return `${rounded}ft`;
    }
    if (unitSystem === 'metric-m') {
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
      if (!snapToGridEnabled) return pos;
      return {
        x: Math.round(pos.x / gridSize) * gridSize,
        y: Math.round(pos.y / gridSize) * gridSize,
      };
    },
    [snapToGridEnabled, gridSize]
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

      const { x: worldX, y: worldY } = screenToWorld(e.clientX, e.clientY);

      // Update store position for other tools to access
      // Throttle mouse position updates to avoid excessive store-triggering re-renders
      const now = Date.now();
      if (!isDraggingItem && (!(window as any)._lastMouseUpdate || now - (window as any)._lastMouseUpdate > 16)) {
        setMouseWorldPos({ x: worldX, y: worldY });
        (window as any)._lastMouseUpdate = now;
      }

      // Handle control point dragging
      if (draggedPoint) {
        const shape = shapes.find(s => s.id === draggedPoint.shapeId);
        if (shape && shape.points) {
          const dx = worldX - shape.x;
          const dy = worldY - shape.y;
          const rad = -shape.rotation * (Math.PI / 180);
          const localX = dx * Math.cos(rad) - dy * Math.sin(rad);
          const localY = dx * Math.sin(rad) + dy * Math.cos(rad);

          const newPoints = [...shape.points];
          newPoints[draggedPoint.pointIndex] = { x: localX, y: localY };
          updateShape(shape.id, { points: newPoints });
        }
        return;
      }

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

      const shouldHitTestHover = activeTool === 'select' || activeTool === 'trim-to-blend';
      if (shouldHitTestHover && !isDraggingItem && now - lastHoverHitTestRef.current > 32) {
      lastHoverHitTestRef.current = now;
      // Hover detection
      let targetId: string | null = null;
      const topAssetHit = findTopAssetAtPoint(worldX, worldY);
      const topAssetZ = topAssetHit?.zIndex ?? -Infinity;

      // OPTIMIZATION: Use visibleRenderables for hit testing!
      // This reduces complexity from O(100,000+) to O(Visible_Items ≈ 500).
      // Iterate in reverse (end to start) to hit the top-most (higher z-index) items first.
      for (let i = visibleRenderables.length - 1; i >= 0; i--) {
        const item = visibleRenderables[i];
        const itemZ = item.zIndex || 0;
        if (topAssetHit && itemZ < topAssetZ) {
          break;
        }
        
        switch (item._renderType) {
          case 'shape': {
            const shape = item;
            if (shape.id === 'background-texture') break;

            if (shape.type === 'line' || shape.type === 'arrow') {
              const thickness = Math.max((shape.strokeWidth ?? 2) + 20, 30);
              const points = shape.points;
              if (points && points.length >= 2) {
                let lineHit = false;
                for (let s = 0; s < points.length - 1; s++) {
                  const p1 = points[s], p2 = points[s+1];
                  const ax = shape.x + (p1.x || 0), ay = shape.y + (p1.y || 0);
                  const bx = shape.x + (p2.x || 0), by = shape.y + (p2.y || 0);
                  const dx = bx - ax, dy = by - ay;
                  const lenSq = dx * dx + dy * dy;
                  if (lenSq === 0) continue;
                  const t = Math.max(0, Math.min(1, ((worldX - ax) * dx + (worldY - ay) * dy) / lenSq));
                  if (Math.hypot(worldX - (ax + t * dx), worldY - (ay + t * dy)) <= thickness) {
                    lineHit = true; break;
                  }
                }
                if (lineHit) targetId = shape.id;
              }
            } else {
              const halfW = (shape.width || 0) / 2, halfH = (shape.height || 0) / 2;
              if (worldX >= (shape.x || 0) - halfW && worldX <= (shape.x || 0) + halfW && worldY >= (shape.y || 0) - halfH && worldY <= (shape.y || 0) + halfH) {
                targetId = shape.id;
              }
            }
            break;
          }

          case 'asset': {
            const asset = item;
            if (asset.isExploded) break;
            const halfW = ((asset.width || 0) * (asset.scale || 1)) / 2;
            const halfH = ((asset.height || 0) * (asset.scale || 1)) / 2;
            if (worldX >= (asset.x || 0) - halfW && worldX <= (asset.x || 0) + halfW && worldY >= (asset.y || 0) - halfH && worldY <= (asset.y || 0) + halfH) {
              targetId = asset.id;
            }
            break;
          }

          case 'wall': {
            const wall = item;
            let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
            if (wall.nodes) {
              wall.nodes.forEach((n: any) => {
                minX = Math.min(minX, n.x); minY = Math.min(minY, n.y);
                maxX = Math.max(maxX, n.x); maxY = Math.max(maxY, n.y);
              });
              if (worldX >= minX && worldX <= maxX && worldY >= minY && worldY <= maxY) {
                targetId = wall.id;
              }
            }
            break;
          }

          case 'textAnnotation': {
            const ann = item;
            const fontSize = ann.fontSize || 250;
            const lineHeight = ann.lineHeight || 1.2;
            const lines = (ann.text || '').split('\n');
            const maxChars = Math.max(...lines.map((l: string) => l.length), 1);
            const halfW = (maxChars * fontSize * 0.6) / 2;
            const halfH = (lines.length * fontSize * lineHeight) / 2;
            if (worldX >= (ann.x || 0) - halfW && worldX <= (ann.x || 0) + halfW && worldY >= (ann.y || 0) - halfH && worldY <= (ann.y || 0) + halfH) {
              targetId = ann.id;
            }
            break;
          }
        }

        if (targetId) break; // Found top-most item
      }

      if (!targetId && topAssetHit) {
        targetId = topAssetHit.id;
      }

      // Throttle hover updates
      if (hoveredId !== targetId) {
        setHoveredId(targetId);
      }
      }

      // Broadcast cursor position to other users
      if (updateCursor) {
        updateCursor(e.clientX - canvasOffset.left, e.clientY - canvasOffset.top);
      }

      const dragOrigin = draggedItemStartRef.current || draggedItemStart;

      if (isDraggingItem && dragOrigin && selectedIds.length > 0) {
        let finalX = worldX;
        let finalY = worldY;
        let guides: any[] = [];
        let finalRotation: number | null = null;

        // Specific checks for Space Elements (Doors/Windows)
        const isSpaceElement = selectedIds.length === 1 &&
          assets.find(a => a.id === selectedIds[0] &&
            ASSET_LIBRARY.find(al => al.id.toLowerCase() === (a.type || a.id).toLowerCase())?.category === 'Space_Elements');

        if (isSpaceElement && walls.length > 0) {
          const asset = assets.find(a => a.id === selectedIds[0]);
          if (asset) {
            const aw = (asset.width || 0) * (asset.scale || 1);
            const ah = (asset.height || 0) * (asset.scale || 1);
            const insertionInset = 50; // Door/window SVGs are drawn with the wall line ~50mm from the base
            const insertionOffset = Math.max(0, (ah / 2) - insertionInset);
            
            const dx = worldX - dragOrigin.x;
            const dy = worldY - dragOrigin.y;
            const proposedCenter = { x: asset.x + dx, y: asset.y + dy };

            let bestSnap: any = null;
            let minSnapDist = 150;

            // 1. Find the closest wall edge first to determine orientation
            const initialSnap = findWallSnapPoint(proposedCenter, walls, 150, {
              allowNodes: false,
              allowCenterLine: false,
              allowFaces: true,
            });
            
            if (initialSnap.snapped && initialSnap.wallId && initialSnap.edgeId) {
              const wall = walls.find(w => w.id === initialSnap.wallId);
              const edge = wall?.edges.find(e => e.id === initialSnap.edgeId);
              const nA = wall?.nodes.find(n => n.id === edge?.nodeA);
              const nB = wall?.nodes.find(n => n.id === edge?.nodeB);

              if (nA && nB) {
                // Determine wall angle
                const wallAngleRad = Math.atan2(nB.y - nA.y, nB.x - nA.x);
                const wallAngleDeg = wallAngleRad * (180 / Math.PI);
                
                // We want to check the actual insertion line, not the visual bbox extremes
                const cos = Math.cos(wallAngleRad);
                const sin = Math.sin(wallAngleRad);

                const rotateLocalPoint = (localX: number, localY: number) => ({
                  x: (localX * cos) - (localY * sin),
                  y: (localX * sin) + (localY * cos),
                });

                const jambInset = Math.min(80, aw / 4);
                const doorPoints = [
                  { ...rotateLocalPoint(0, -insertionOffset), type: 'insertion-center' },
                  { ...rotateLocalPoint(-(aw / 2) + jambInset, -insertionOffset), type: 'insertion-left' },
                  { ...rotateLocalPoint((aw / 2) - jambInset, -insertionOffset), type: 'insertion-right' },
                ];

                for (const pt of doorPoints) {
                  const proposedPt = { x: proposedCenter.x + pt.x, y: proposedCenter.y + pt.y };
                  // Re-check snap for this specific point against THIS wall specifically for precision
                  const snap = findWallSnapPoint(proposedPt, [wall!], 150, {
                    allowNodes: false,
                    allowCenterLine: false,
                    allowFaces: true,
                  });
                  if (snap.snapped) {
                    const dist = Math.hypot(proposedPt.x - snap.x, proposedPt.y - snap.y);
                    let biasedDist = dist;
                    if (snap.snapType === 'wall-face') biasedDist *= 0.7;
                    if (snap.snapType === 'wall-edge') biasedDist *= 0.9;
                    if (snap.snapType === 'wall-node') biasedDist *= 1.4;
                    if (pt.type === 'insertion-center') biasedDist *= 0.8;
                    if (biasedDist < minSnapDist) {
                      minSnapDist = biasedDist;
                      bestSnap = { ...snap, localOffset: pt, wallAngle: wallAngleDeg };
                    }
                  }
                }
              }
            }

            if (bestSnap) {
              finalRotation = bestSnap.wallAngle;
              finalX = worldX + (bestSnap.x - (asset.x + dx + bestSnap.localOffset.x));
              finalY = worldY + (bestSnap.y - (asset.y + dy + bestSnap.localOffset.y));
            }
          }
        } else if (snapToObjectsEnabled && selectedIds.length === 1) {
          const id = selectedIds[0];
          let itemBounds: any = null;

          const shape = shapes.find(s => s.id === id);
          if (shape) {
            itemBounds = {
              x: shape.x + (worldX - dragOrigin.x),
              y: shape.y + (worldY - dragOrigin.y),
              width: shape.width,
              height: shape.height,
              id: shape.id
            };
          } else {
            const asset = assets.find(a => a.id === id);
            if (asset) {
              itemBounds = {
                x: asset.x + (worldX - dragOrigin.x),
                y: asset.y + (worldY - dragOrigin.y),
                width: (asset.width || 0) * (asset.scale || 1),
                height: (asset.height || 0) * (asset.scale || 1),
                rotation: asset.rotation,
                id: asset.id
              };
            } else {
              const textAnnotation = textAnnotations.find(t => t.id === id);
              if (textAnnotation) {
                const fs = textAnnotation.fontSize || 250;
                const lh = textAnnotation.lineHeight || 1.2;
                const lines = (textAnnotation.text || '').split('\n');
                const maxChars = Math.max(...lines.map(l => l.length), 1);
                itemBounds = {
                   x: textAnnotation.x + (worldX - dragOrigin.x),
                   y: textAnnotation.y + (worldY - dragOrigin.y),
                   width: maxChars * fs * 0.6,
                   height: lines.length * fs * lh,
                   id: textAnnotation.id
                };
              }
            }
          }

          if (itemBounds) {
            const targetSearchMargin = Math.max(itemBounds.width, itemBounds.height, 2500 / zoom);
            const nearbyAssets = assetSpatialIndex
              .query({
                left: itemBounds.x - (itemBounds.width / 2) - targetSearchMargin,
                top: itemBounds.y - (itemBounds.height / 2) - targetSearchMargin,
                right: itemBounds.x + (itemBounds.width / 2) + targetSearchMargin,
                bottom: itemBounds.y + (itemBounds.height / 2) + targetSearchMargin,
              })
              .map((entry) => entry.item)
              .filter((asset) => asset.id !== id);

            // Collect targets
            const targets = [
              ...shapes.filter(s => s.id !== id).map(s => {
                const rad = ((s.rotation || 0) * Math.PI) / 180;
                const cos = Math.abs(Math.cos(rad)), sin = Math.abs(Math.sin(rad));
                return { id: s.id, x: s.x, y: s.y, width: s.width * cos + s.height * sin, height: s.width * sin + s.height * cos };
              }),
              ...nearbyAssets.flatMap(a => {
                const w = (a.width || 0) * (a.scale || 1), h = (a.height || 0) * (a.scale || 1);
                const rad = ((a.rotation || 0) * Math.PI) / 180;
                const cos = Math.abs(Math.cos(rad)), sin = Math.abs(Math.sin(rad));
                
                const targets = [
                  { id: a.id, x: a.x, y: a.y, width: w * cos + h * sin, height: w * sin + h * cos }
                ];

                // If it's a Marquee, add its inner face as a snap target
                const assetDef = ASSET_LIBRARY.find(lib => lib.id.toLowerCase() === (a.type || a.id).toLowerCase());
                if (assetDef?.category === 'Marquee') {
                  const thickness = a.wallThickness || a.metadata?.wallThickness || 200; // Default to 200mm if not specified
                  const innerW = w - thickness * 2;
                  const innerH = h - thickness * 2;
                  if (innerW > 0 && innerH > 0) {
                    targets.push({ 
                      id: `${a.id}-inner`, 
                      x: a.x, y: a.y, 
                      width: innerW * cos + innerH * sin, 
                      height: innerW * sin + innerH * cos 
                    });
                  }
                }
                return targets;
              }),
              ...walls.filter(w => w.id !== id).map(w => {
                let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
                w.nodes.forEach(n => { minX = Math.min(minX, n.x); minY = Math.min(minY, n.y); maxX = Math.max(maxX, n.x); maxY = Math.max(maxY, n.y); });
                return { id: w.id, x: (minX + maxX) / 2, y: (minY + maxY) / 2, width: maxX - minX, height: maxY - minY };
              }),
              ...textAnnotations.filter(t => t.id !== id).map(t => {
                const fs = t.fontSize || 250;
                const lh = t.lineHeight || 1.2;
                const lines = (t.text || '').split('\n');
                const maxChars = Math.max(...lines.map(l => l.length), 1);
                return { id: t.id, x: t.x, y: t.y, width: maxChars * fs * 0.6, height: lines.length * fs * lh };
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

            // Prioritize snapping to wall faces/edges while moving
            // Check multiple potential snap anchors on the moved item (Center + 4 Edges)
            const itemHalfW = itemBounds.width / 2;
            const itemHalfH = itemBounds.height / 2;
            const itemSnaps = [
              { x: finalX, y: finalY }, // Center
              { x: finalX - itemHalfW, y: finalY }, // Left edge
              { x: finalX + itemHalfW, y: finalY }, // Right edge
              { x: finalX, y: finalY - itemHalfH }, // Top edge
              { x: finalX, y: finalY + itemHalfH }  // Bottom edge
            ];

            let bestWallSnap: any = null;
            let minWallDist = 20 / zoom;

            itemSnaps.forEach(p => {
              const ws = findWallSnapPoint(p, walls, 20 / zoom);
              if (ws.snapped) {
                const dist = Math.hypot(p.x - ws.x, p.y - ws.y);
                if (dist < minWallDist) {
                  minWallDist = dist;
                  bestWallSnap = { ...ws, sourcePt: p };
                }
              }
            });

            if (bestWallSnap) {
              finalX = finalX + (bestWallSnap.x - bestWallSnap.sourcePt.x);
              finalY = finalY + (bestWallSnap.y - bestWallSnap.sourcePt.y);
            }

            // Fallback to grid snap if no object snap was found
            if (guides.length === 0 && snapToGridEnabled) {
              const gridSnapped = snapToGridFn({ x: worldX, y: worldY });
              finalX = gridSnapped.x;
              finalY = gridSnapped.y;
            }

            // Marquee Vertex Snapping Integration
            const marqueeVertices = verticesMap[id] || [];
            if (marqueeVertices.length > 0) {
                const snapPoint = findSnapPointInShapes({ x: worldX, y: worldY }, nearbyAssets, 20 / zoom, verticesMap);
                if (snapPoint) {
                    finalX = worldX + (snapPoint.x - worldX);
                    finalY = worldY + (snapPoint.y - worldY);
                }
            }
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
              snapToGridEnabled,
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
        setSnapGuides(guides);

        const snappedDx = finalX - dragOrigin.x;
        const snappedDy = finalY - dragOrigin.y;

        // Keep per-frame drag deltas in a ref so dragging doesn't re-render the whole workspace.
        if (dragPreviewRef.current) {
          const nextPreview = {
            ids: dragPreviewRef.current.ids,
            dx: snappedDx,
            dy: snappedDy,
          };
          dragPreviewRef.current = nextPreview;
          scheduleDragPreview(nextPreview);
          return;
        }

        draggedItemStartRef.current = { x: finalX, y: finalY };

        const selectedIdSet = new Set(selectedIds);
        const shapeUpdates: { id: string; updates: Partial<Shape> }[] = [];
        const assetUpdates: { id: string; updates: Partial<Asset> }[] = [];
        const wallUpdates: { id: string; updates: Partial<Wall> }[] = [];

        shapes.forEach((shape) => {
          if (!selectedIdSet.has(shape.id)) return;
          shapeUpdates.push({
            id: shape.id,
            updates: {
              x: shape.x + snappedDx,
              y: shape.y + snappedDy,
            },
          });
        });

        assets.forEach((asset) => {
          if (!selectedIdSet.has(asset.id)) return;
          assetUpdates.push({
            id: asset.id,
            updates: {
              x: asset.x + snappedDx,
              y: asset.y + snappedDy,
              ...(finalRotation !== null && finalRotation !== undefined ? { rotation: finalRotation } : {})
            },
          });
        });

        walls.forEach((wall) => {
          if (!selectedIdSet.has(wall.id)) return;
          wallUpdates.push({
            id: wall.id,
            updates: {
              nodes: wall.nodes.map(node => ({
                ...node,
                x: node.x + snappedDx,
                y: node.y + snappedDy
              }))
            },
          });
        });

        if (shapeUpdates.length > 0) batchUpdateShapes(shapeUpdates, true);
        if (assetUpdates.length > 0) batchUpdateAssets(assetUpdates, true);
        if (wallUpdates.length > 0) batchUpdateWalls(wallUpdates, true);

        selectedIds.forEach((id) => {
          const shape = shapes.find((s) => s.id === id);
          if (shape) {
            return;
          }

          const asset = assets.find((a) => a.id === id);
          if (asset) {
            return;
          }

          const wall = walls.find((w) => w.id === id);
          if (wall) {
            return;
          }

          const textAnnotation = textAnnotations.find((t) => t.id === id);
          if (textAnnotation) {
            updateTextAnnotation(id, {
              x: textAnnotation.x + snappedDx,
              y: textAnnotation.y + snappedDy,
            }, true);
          }

          const labelArrow = labelArrows.find((l) => l.id === id);
          if (labelArrow) {
            updateLabelArrow(id, {
              startPoint: {
                x: labelArrow.startPoint.x + snappedDx,
                y: labelArrow.startPoint.y + snappedDy,
              },
              endPoint: {
                x: labelArrow.endPoint.x + snappedDx,
                y: labelArrow.endPoint.y + snappedDy,
              },
            }, true);
          }

          const dimension = dimensions.find((d) => d.id === id);
          if (dimension) {
            updateDimension(id, {
              startPoint: {
                x: dimension.startPoint.x + snappedDx,
                y: dimension.startPoint.y + snappedDy,
              },
              endPoint: {
                x: dimension.endPoint.x + snappedDx,
                y: dimension.endPoint.y + snappedDy,
              },
            }, true);
          }
        });
      }

      // Update selection rectangle if dragging to select
      if (dragStart && !isPanning && !isDraggingItem && activeTool === 'select') {
        const threshold = 5;
        const dx = e.clientX - dragStart.x;
        const dy = e.clientY - dragStart.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (selectionRect) {
          // Robust coordinate check
          if (isFinite(worldX) && isFinite(worldY)) {
            setSelectionRect(prev => prev ? {
              ...prev,
              x2: worldX,
              y2: worldY
            } : null);
          }
        } else if (dist > threshold) {
          // Initialize selection rectangle only after moving past threshold
          const startPos = screenToWorld(dragStart.x, dragStart.y);
          if (isFinite(startPos.x) && isFinite(startPos.y) && isFinite(worldX) && isFinite(worldY)) {
            setSelectionRect({
              x1: startPos.x,
              y1: startPos.y,
              x2: worldX,
              y2: worldY
            });
          }
        }
      }
    },
    [activeTool, panX, panY, zoom, isPanning, dragStart, panBy, isDraggingItem, draggedItemStart, selectedIds, shapes, assets, walls, textAnnotations, labelArrows, dimensions, batchUpdateShapes, batchUpdateAssets, batchUpdateWalls, scheduleDragPreview, snapToGridFn, selectionRect, updateCursor, setHoveredId, draggedPoint, screenToWorld, setMouseWorldPos, canvasOffset, snapToObjectsEnabled, snapToGridEnabled, gridSize, updateTextAnnotation, updateLabelArrow, updateDimension, setSnapGuides, visibleRenderables, verticesMap, findTopAssetAtPoint, assetSpatialIndex, placementMode.active, updateShape]
  );

  const handleDoubleClick = useCallback(
    (e: React.MouseEvent) => {
      if (!canvasRef.current) return;
      const { x: worldX, y: worldY } = screenToWorld(e.clientX, e.clientY);

      // Check for asset hit through the spatial index instead of scanning every asset.
      const assetHit = findTopAssetAtPoint(worldX, worldY);
      if (assetHit) {
        const asset = assetHit.item;
          // Explode asset
          /* // Explode asset logic - commented out for now
          if (asset.isExploded) {
            toast("Asset already exploded.");
            return;
          }

          // Optimize explosion with batched updates using requestAnimationFrame
          convertAssetToShapes(asset).then((newShapes) => {
            if (newShapes.length > 0) {
              const store = useProjectStore.getState();

              // Save history once for the entire explosion
              store.saveToHistory();

              requestAnimationFrame(() => {
                const batchSize = 50;
                let index = 0;

                const addBatch = () => {
                  const end = Math.min(index + batchSize, newShapes.length);
                  for (let i = index; i < end; i++) {
                    // Use skipHistory=true because we already saved once
                    store.addShape(newShapes[i], true);
                  }
                  index = end;

                  if (index < newShapes.length) {
                    requestAnimationFrame(addBatch);
                  } else {
                    const groupId = `group-${Date.now()}`;
                    const newGroup = {
                      id: groupId,
                      itemIds: newShapes.map((s) => s.id),
                      zIndex: asset.zIndex,
                    };
                    store.addGroup(newGroup, true); // skipHistory=true

                    store.updateAsset(asset.id, {
                      isExploded: true,
                      childShapeIds: newShapes.map((s) => s.id),
                    }, true); // skipHistory=true

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
          return; */
          console.log("Asset double-clicked, explosion is currently disabled.");
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

      // Check for text annotation hit
      for (let i = textAnnotations.length - 1; i >= 0; i--) {
        const annotation = textAnnotations[i];
        const fontSize = annotation.fontSize || 250;
        const lineHeight = annotation.lineHeight || 1.2;
        const lines = (annotation.text || '').split('\n');
        const maxChars = Math.max(...lines.map(l => l.length), 1);
        const halfW = (maxChars * fontSize * 0.6) / 2;
        const halfH = (lines.length * fontSize * lineHeight) / 2;

        if (
          worldX >= annotation.x - halfW &&
          worldX <= annotation.x + halfW &&
          worldY >= annotation.y - halfH &&
          worldY <= annotation.y + halfH
        ) {
          // Double click enters edit mode for text
          setEditingTextId(annotation.id);
          setSelectedIds([annotation.id]);
          updateTyping(true);
          return;
        }
      }
    },
    [findTopAssetAtPoint, shapes, textAnnotations, screenToWorld, setSelectedIds, setEditingTextId, updateTyping]
  );

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (!canvasRef.current) return;

      const { x: worldX, y: worldY } = screenToWorld(e.clientX, e.clientY);

      if (e.button === 1 || (e.button === 0 && activeTool === 'pan')) {
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
          if (shape && (shape.type === 'polygon' || shape.type === 'line' || shape.type === 'arc') && shape.points) {
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
            const fontSize = annotation.fontSize || 250;
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



        // Handle Rectangular Selection - Only if the tool is active
        if (isRectangularSelectionMode && activeTool === 'rectangular-select') {
          setDragStart({ x: worldX, y: worldY });
          setSelectionRect({ x1: worldX, y1: worldY, x2: worldX, y2: worldY });
          return;
        }

        // Handle Snap to Anchor Mode - Click anywhere on target object
        if (isSnapMode && snapSourceId && snapAnchor) {
          let targetHit: SnapObject | null = null;

          // Unified z-aware hit testing for snap target
          const getZIndex = (item: any) => (typeof item.zIndex === 'number' ? item.zIndex : 0);
          const candidates = [
            ...walls.map(w => ({ ...w, _renderType: 'wall' as const })),
            ...shapes.map(s => ({ ...s, _renderType: 'shape' as const })),
            ...assets.map(a => ({ ...a, _renderType: 'asset' as const })),
          ]
            .filter(item => item.id !== snapSourceId) // Don't snap to self
            .sort((a, b) => getZIndex(a) - getZIndex(b));

          for (let i = candidates.length - 1; i >= 0; i--) {
            const item = candidates[i];
            let isHit = false;

            if (item._renderType === 'shape') {
              const shape = item;
              const halfW = (shape.width || 100) / 2, halfH = (shape.height || 100) / 2;
              if (worldX >= shape.x - halfW && worldX <= shape.x + halfW && worldY >= shape.y - halfH && worldY <= shape.y + halfH) isHit = true;
            } else if (item._renderType === 'asset') {
              const asset = item;
              if (!asset.isExploded) {
                const halfW = ((asset.width || 100) * (asset.scale || 1)) / 2, halfH = ((asset.height || 100) * (asset.scale || 1)) / 2;
                if (worldX >= asset.x - halfW && worldX <= asset.x + halfW && worldY >= asset.y - halfH && worldY <= asset.y + halfH) isHit = true;
              }
            } else if (item._renderType === 'wall') {
              const wall = item;
              isHit = isPointInsideWall(wall, worldX, worldY);
            }

            if (isHit) {
              targetHit = { type: item._renderType as any, object: item as any };
              break;
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
        setSelectionRect(null);
        setDragStart(null);
        if (activeTool === 'select' || activeTool === 'trim-to-blend') {
          let itemSelected = false;

          const handleItemSelection = (ids: string[], isShift: boolean, clickPoint?: { x: number; y: number }) => {
            const expandedIds = resolveIdsWithGroups(ids);

            if ((activeTool as string) === 'trim-to-blend') {
              const validShapeIds = expandedIds.filter(id => shapes.some(s => s.id === id));
              if (validShapeIds.length === 0) {
                toast.error("Please select a valid shape.");
                return;
              }

              const currentSelected = new Set(selectedIds);

              if (isShift) {
                validShapeIds.forEach(id => {
                  if (currentSelected.has(id)) currentSelected.delete(id);
                  else currentSelected.add(id);
                });
              } else {
                if (currentSelected.size === 0) {
                  validShapeIds.forEach(id => currentSelected.add(id));
                } else if (currentSelected.size === 1) {
                  if (currentSelected.has(validShapeIds[0])) currentSelected.clear();
                  else validShapeIds.forEach(id => currentSelected.add(id));
                } else {
                  currentSelected.clear();
                  validShapeIds.forEach(id => currentSelected.add(id));
                }
              }

              const newSelection = Array.from(currentSelected);
              setSelectedIds(newSelection);

              if (newSelection.length === 1) {
                  toast("Now select the second object to be trimmed relative to the first.", { icon: '✨', duration: 4000 });
              } else if (newSelection.length === 2) {
                const shapesToBlend = [
                  shapes.find(s => s.id === newSelection[0]),
                  shapes.find(s => s.id === newSelection[1])
                ].filter(Boolean) as any[];

                if (shapesToBlend.length === 2) {
                  // Do not sort by zIndex; respect selection order for subtraction logic
                  // Tool = shapesToBlend[0], Target = shapesToBlend[1]

                  try {
                    const projectStore = useProjectStore.getState();
                    const blendedShape = trimToBlendShapes(shapesToBlend, clickPoint);
                    if (blendedShape) {
                      // Save history once for the entire atomic operation
                      projectStore.saveToHistory();
                      // Only remove the SECOND shape (the one being cut)
                      // Keep the FIRST shape (the cutter/boundary)
                      projectStore.removeShape(shapesToBlend[1]!.id, true);
                      
                      projectStore.addShape(blendedShape, true);
                      
                      // Group the cutter (shapesToBlend[0]) and the result (blendedShape)
                      const groupId = crypto.randomUUID();
                      projectStore.addGroup({
                        id: groupId,
                        itemIds: [shapesToBlend[0].id, blendedShape.id],
                        zIndex: Math.max(shapesToBlend[0].zIndex || 0, blendedShape.zIndex || 0)
                      }, true);

                      setSelectedIds([blendedShape.id]);
                      toast.success("Shape blended and grouped!", { icon: '✨' });
                    } else {
                      toast.error("Failed to blend shapes. Ensure they intersect cleanly.");
                      setSelectedIds([]);
                    }
                  } catch (e) {
                    console.error("Blending error:", e);
                    toast.error("Failed to blend geometric shapes.");
                    setSelectedIds([]);
                  }

                  // Revert to select tool
                  setActiveTool("select");
                }
              }
              return;
            }

            if (isShift) {
              const current = new Set(selectedIds);
              const allSelected = expandedIds.every(id => current.has(id));
              if (allSelected) {
                expandedIds.forEach(id => current.delete(id));
              } else {
                expandedIds.forEach(id => current.add(id));
              }
              const newSelection = Array.from(current);
              setSelectedIds(newSelection);
              selectMultipleAssets(newSelection);
            } else {
              setSelectedIds(expandedIds);
              selectMultipleAssets(expandedIds);
            }
          };

          const topAssetHit = findTopAssetAtPoint(worldX, worldY);
          const assetHitRenderable = topAssetHit
            ? { ...topAssetHit.item, _renderType: 'asset' as const }
            : null;
          const hitRenderables = assetHitRenderable
            ? [
                ...visibleRenderables.filter((item) => item.id !== assetHitRenderable.id),
                assetHitRenderable,
              ].sort((a, b) => ((a as any).zIndex || 0) - ((b as any).zIndex || 0))
            : visibleRenderables;

          // Check visible/spatially indexed items from front to back.
          for (let i = hitRenderables.length - 1; i >= 0; i--) {
            const item = hitRenderables[i];
            
            // Skip background texture for hit testing in select mode
            if (activeTool === 'select' && item.id === 'background-texture') continue;

            let isHit = false;

            if (item._renderType === 'dimension') {
              const dim = item;
              const dx = dim.endPoint.x - dim.startPoint.x;
              const dy = dim.endPoint.y - dim.startPoint.y;
              const length = Math.sqrt(dx * dx + dy * dy);
              if (length > 0) {
                const nx = dx / length;
                const ny = dy / length;
                const px = -ny;
                const py = nx;
                const p1x = dim.startPoint.x + px * dim.offset;
                const p1y = dim.startPoint.y + py * dim.offset;
                const p2x = dim.endPoint.x + px * dim.offset;
                const p2y = dim.endPoint.y + py * dim.offset;
                const lineDx = p2x - p1x;
                const lineDy = p2y - p1y;
                const lineLengthSquared = lineDx * lineDx + lineDy * lineDy;
                if (lineLengthSquared > 0) {
                  const t = Math.max(0, Math.min(1, ((worldX - p1x) * lineDx + (worldY - p1y) * lineDy) / lineLengthSquared));
                  const projX = p1x + t * lineDx;
                  const projY = p1y + t * lineDy;
                  const dist = Math.sqrt((worldX - projX) ** 2 + (worldY - projY) ** 2);
                  const midX = (p1x + p2x) / 2;
                  const midY = (p1y + p2y) / 2;
                  const distToText = Math.sqrt((worldX - midX) ** 2 + (worldY - midY) ** 2);
                  const distToStart = Math.sqrt((worldX - dim.startPoint.x) ** 2 + (worldY - dim.startPoint.y) ** 2);
                  const distToEnd = Math.sqrt((worldX - dim.endPoint.x) ** 2 + (worldY - dim.endPoint.y) ** 2);
                  if (dist <= 40 || distToText <= 50 || distToStart <= 30 || distToEnd <= 30) {
                    isHit = true;
                  }
                }
              }
            } else if (item._renderType === 'shape') {
              const shape = item;
              if (shape.type === 'line' || shape.type === 'arrow') {
                const thickness = Math.max((shape.strokeWidth ?? 2) + 20, 30); // Increased hit radius for easier selection
                if (shape.points && shape.points.length >= 2) {
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
                    if (Math.hypot(worldX - projX, worldY - projY) <= thickness) {
                      isHit = true;
                      break;
                    }
                  }
                } else {
                  const rot = (shape.rotation || 0) * (Math.PI / 180);
                  const cosR = Math.cos(rot), sinR = Math.sin(rot);
                  const halfLen = shape.width / 2;
                  const ax = shape.x - halfLen * cosR, ay = shape.y - halfLen * sinR;
                  const bx = shape.x + halfLen * cosR, by = shape.y + halfLen * sinR;
                  const dx = bx - ax, dy = by - ay;
                  const lenSq = dx * dx + dy * dy;
                  if (lenSq > 0) {
                    const t = Math.max(0, Math.min(1, ((worldX - ax) * dx + (worldY - ay) * dy) / lenSq));
                    if (Math.hypot(worldX - (ax + t * dx), worldY - (ay + t * dy)) <= thickness) isHit = true;
                  }
                }
              } else {
                const halfW = shape.width / 2, halfH = shape.height / 2;
                if (worldX >= shape.x - halfW && worldX <= shape.x + halfW && worldY >= shape.y - halfH && worldY <= shape.y + halfH) isHit = true;
              }
            } else if (item._renderType === 'asset') {
              const asset = item;
              if (!asset.isExploded) {
                const assetDef = assetDefinitionById.get(asset.type);
                if (assetDef?.category === 'Marquee') {
                  const halfW = (asset.width * asset.scale) / 2;
                  const halfH = (asset.height * asset.scale) / 2;
                  const rad = ((asset.rotation || 0) * Math.PI) / 180;
                  const cos = Math.cos(rad), sin = Math.sin(rad);
                  const lx = (worldX - asset.x) * cos + (worldY - asset.y) * sin;
                  const ly = -(worldX - asset.x) * sin + (worldY - asset.y) * cos;
                  const edgeDistances = [
                    Math.abs(ly - (-halfH)),
                    Math.abs(ly - halfH),
                    Math.abs(lx - (-halfW)),
                    Math.abs(lx - halfW)
                  ];
                  const minEdgeDist = Math.min(...edgeDistances);
                  const wallThickness = asset.wallThickness || asset.metadata?.wallThickness || 150;
                  if (minEdgeDist <= (wallThickness / 2) + 100) {
                    isHit = true;
                  }
                } else {
                  const halfW = (asset.width * asset.scale) / 2, halfH = (asset.height * asset.scale) / 2;
                  if (worldX >= asset.x - halfW && worldX <= asset.x + halfW && worldY >= asset.y - halfH && worldY <= asset.y + halfH) isHit = true;
                }
              }
            } else if (item._renderType === 'wall') {
              const wall = item;
              isHit = isPointInsideWall(wall, worldX, worldY);
            } else if (item._renderType === 'textAnnotation') {
              const ann = item;
              const fS = ann.fontSize || 250;
              const hitR = Math.max((ann.text.length || 2) * fS * 0.4, fS * 0.8, 40);
              if (Math.hypot(worldX - ann.x, worldY - ann.y) <= hitR) {
                isHit = true;
                // Special double-click handling for text
                if (isHit && activeTool !== 'trim-to-blend' && !e.shiftKey && selectedIds.includes(ann.id)) {
                  const now = Date.now();
                  const lastT = (window as any).__lastTextClickTime || 0;
                  const lastI = (window as any).__lastTextClickId;
                  if (now - lastT < 300 && lastI === ann.id) {
                    (window as any).__lastTextClickTime = 0;
                    (window as any).__lastTextClickId = null;
                    setSelectedIds([ann.id]);
                    selectMultipleAssets([ann.id]);
                    itemSelected = true;
                    return;
                  }
                  (window as any).__lastTextClickTime = now;
                  (window as any).__lastTextClickId = ann.id;
                }
              }
            } else if (item._renderType === 'labelArrow') {
              const arrow = item;
              const dx = arrow.endPoint.x - arrow.startPoint.x, dy = arrow.endPoint.y - arrow.startPoint.y;
              const lenSq = dx * dx + dy * dy;
              const thickness = (arrow.strokeWidth || 2) + 30; // Increased hit radius
              if (lenSq === 0) {
                if (Math.hypot(worldX - arrow.startPoint.x, worldY - arrow.startPoint.y) <= thickness) isHit = true;
              } else {
                const t = Math.max(0, Math.min(1, ((worldX - arrow.startPoint.x) * dx + (worldY - arrow.startPoint.y) * dy) / lenSq));
                if (Math.hypot(worldX - (arrow.startPoint.x + t * dx), worldY - (arrow.startPoint.y + t * dy)) <= thickness) isHit = true;
              }
            }

            if (isHit) {
              const idsToSelect = resolveIdsWithGroups([item.id]);
              if (activeTool !== 'trim-to-blend' && !e.shiftKey) {
                if (idsToSelect.some(id => selectedIds.includes(id))) {
                  saveToHistory();
                  setIsDraggingItem(true);
                  setDragging(true);
                  const dragPoint = { x: worldX, y: worldY };
                  draggedItemStartRef.current = dragPoint;
                  setDraggedItemStart(dragPoint);
                  if (shouldUseDragPreviewForIds(selectedIds)) {
                    const preview = { ids: [...selectedIds], dx: 0, dy: 0 };
                    dragPreviewRef.current = preview;
                    setDragPreview(preview);
                  }
                } else {
                  handleItemSelection([item.id], e.shiftKey, { x: worldX, y: worldY });
                  // Allow immediate drag on first click if not shifting
                  if (!e.shiftKey) {
                    setIsDraggingItem(true);
                    setDragging(true);
                    const dragPoint = { x: worldX, y: worldY };
                    draggedItemStartRef.current = dragPoint;
                    setDraggedItemStart(dragPoint);
                    if (shouldUseDragPreviewForIds(idsToSelect)) {
                      const preview = { ids: [...idsToSelect], dx: 0, dy: 0 };
                      dragPreviewRef.current = preview;
                      setDragPreview(preview);
                    }
                  }
                }
              } else {
                handleItemSelection([item.id], e.shiftKey, { x: worldX, y: worldY });
              }
              itemSelected = true;
              return;
            }
          }



          if (!itemSelected) {
            // Clear selection and any auto-generated wall dimensions when clicking empty space
            clearSelection();
            setSelectedEdgeId(null);

            // If we are in wall mode but clicked empty space (and not drawing), we might want to ensure we are not stuck
            // But usually wall mode allows drawing.
            // The user issue "cant be unselected" suggests they want to clear selection.
            // We just called clearSelection().

            dimensions
              .filter((d) => (d as any).type === 'wall')
              .forEach((d) => removeDimension(d.id));
            // Don't start selectionRect immediately to avoid 1x1 blue dots on simple clicks
            if (activeTool === 'select') {
              setDragStart({ x: e.clientX, y: e.clientY }); // Flag that we might start a selection
            }
          }
        } else if (activeTool === 'pan') {
          setPanning(true);
          setDragStart({ x: e.clientX, y: e.clientY });
        }
        // For text-annotation and other tools (wall, shape-*, freehand, dimension), don't handle - let tool handle it
        // For other tools (wall, shape-*, freehand, dimension), don't handle - let tool handle it
      }
    },
    [activeTool, setPanning, screenToWorld, shapes, assets, walls, setSelectedIds, clearSelection, selectedIds, setIsDraggingItem, setDragging, setDraggedItemStart, selectMultipleAssets, isRectangularSelectionMode, snapToGridEnabled, gridSize, snapToGridFn, snapToObjectsEnabled, isSnapMode, snapSourceId, snapAnchor, setSnapMode, updateShape, updateAsset, zoom, textAnnotations, resolveIdsWithGroups, saveToHistory, setSelectedEdgeId, removeDimension, dimensions, shouldUseDragPreviewForIds, visibleRenderables, findTopAssetAtPoint]
  );

  const handleMouseUp = useCallback((e: React.MouseEvent) => {
    // Handle Pending Import Shape (attach-to-cursor placement)
    if (pendingImportShape && e.button === 0) {
      const { x: worldX, y: worldY } = screenToWorld(e.clientX, e.clientY);
      const placedShape = {
        ...pendingImportShape,
        x: worldX,
        y: worldY,
      };
      addShape(placedShape);
      setSelectedIds([placedShape.id]);
      setPendingImportShape(null);
      return;
    }

    // Handle Placement Mode
    if (placementMode.active && placementMode.data && e.button === 0) {
      const { walls: newWalls, assets: newAssets, shapes: newShapes } = placementMode.data;
      const { x: worldX, y: worldY } = screenToWorld(e.clientX, e.clientY);

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

        addWall({ ...w, id: newWallId, nodes: newNodes, edges: newEdges });
      });

      // Batch add assets
      newAssets.forEach((a: any) => {
        const newId = generateId();
        placedIds.push(newId);
        // Use addAsset for projectStore (which accepts the asset object)
        addAsset({
          ...a,
          id: newId,
          x: a.x + dx,
          y: a.y + dy,
          scale: a.scale !== undefined ? a.scale : 1,
          rotation: a.rotation || 0
        });
      });

      // Batch add shapes
      newShapes.forEach((s: any) => {
        const newId = generateId();
        if (s.type !== 'line' && !String(s.id || '').toLowerCase().includes('stage')) {
          placedIds.push(newId);
        }
        addShape({ ...s, id: newId, x: s.x + dx, y: s.y + dy });
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

    // Update typing state when clicking away from text
    if (useEditorStore.getState().editingTextId) {
      setEditingTextId(null);
      updateTyping(false);
    }

    const previewToCommit = dragPreviewRef.current;
    if (previewToCommit && (previewToCommit.dx !== 0 || previewToCommit.dy !== 0)) {
      const selectedIdSet = new Set(previewToCommit.ids);
      const batchUpdates: {
        id: string;
        type: 'shape' | 'asset' | 'wall' | 'dimension' | 'textAnnotation' | 'labelArrow';
        updates: any;
      }[] = [];

      shapes.forEach((shape) => {
        if (!selectedIdSet.has(shape.id)) return;
        batchUpdates.push({
          id: shape.id,
          type: 'shape',
          updates: { x: shape.x + previewToCommit.dx, y: shape.y + previewToCommit.dy },
        });
      });

      assets.forEach((asset) => {
        if (!selectedIdSet.has(asset.id)) return;
        batchUpdates.push({
          id: asset.id,
          type: 'asset',
          updates: { x: asset.x + previewToCommit.dx, y: asset.y + previewToCommit.dy },
        });
      });

      walls.forEach((wall) => {
        if (!selectedIdSet.has(wall.id)) return;
        batchUpdates.push({
          id: wall.id,
          type: 'wall',
          updates: {
            nodes: wall.nodes.map(node => ({
              ...node,
              x: node.x + previewToCommit.dx,
              y: node.y + previewToCommit.dy,
            })),
          },
        });
      });

      textAnnotations.forEach((annotation) => {
        if (!selectedIdSet.has(annotation.id)) return;
        batchUpdates.push({
          id: annotation.id,
          type: 'textAnnotation',
          updates: { x: annotation.x + previewToCommit.dx, y: annotation.y + previewToCommit.dy },
        });
      });

      labelArrows.forEach((arrow) => {
        if (!selectedIdSet.has(arrow.id)) return;
        batchUpdates.push({
          id: arrow.id,
          type: 'labelArrow',
          updates: {
            startPoint: { x: arrow.startPoint.x + previewToCommit.dx, y: arrow.startPoint.y + previewToCommit.dy },
            endPoint: { x: arrow.endPoint.x + previewToCommit.dx, y: arrow.endPoint.y + previewToCommit.dy },
          },
        });
      });

      dimensions.forEach((dimension) => {
        if (!selectedIdSet.has(dimension.id)) return;
        batchUpdates.push({
          id: dimension.id,
          type: 'dimension',
          updates: {
            startPoint: { x: dimension.startPoint.x + previewToCommit.dx, y: dimension.startPoint.y + previewToCommit.dy },
            endPoint: { x: dimension.endPoint.x + previewToCommit.dx, y: dimension.endPoint.y + previewToCommit.dy },
          },
        });
      });

      if (batchUpdates.length > 0) {
        batchUpdateItems(batchUpdates, true);
      }
    }
    clearDragPreview();

    // Finalize rectangular selection
    if (selectionRect) {
      const minX = Math.min(selectionRect.x1, selectionRect.x2);
      const maxX = Math.max(selectionRect.x1, selectionRect.x2);
      const minY = Math.min(selectionRect.y1, selectionRect.y2);
      const maxY = Math.max(selectionRect.y1, selectionRect.y2);

      const selectedItems: string[] = [];

      // Select shapes within rectangle
      shapes.forEach(shape => {
        if (shape.id !== 'background-texture' && shape.x >= minX && shape.x <= maxX && shape.y >= minY && shape.y <= maxY) {
          selectedItems.push(shape.id);
        }
      });

      // Select assets within rectangle
      assets.forEach(asset => {
        if (!asset.isExploded && asset.x >= minX && asset.x <= maxX && asset.y >= minY && asset.y <= maxY) {
          selectedItems.push(asset.id);
        }
      });


      // Select walls only when the drag rectangle actually catches the wall outline.
      walls.forEach(wall => {
        if (wallIntersectsRect(wall, minX, minY, maxX, maxY)) {
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
        // Expand selection to include full groups
        const expandedItems = resolveIdsWithGroups(selectedItems);
        setSelectedIds(expandedItems);
        selectMultipleAssets(expandedItems);
      } else {
        // Clear selection if no items found in rectangle
        clearSelection();
      }

      setSelectionRect(null);
    }

    setPanning(false);
    setDragging(false);
    setDragStart(null);
    setIsDraggingItem(false);
    draggedItemStartRef.current = null;
    setDraggedItemStart(null);
    setDraggedPoint(null);
    setSnapGuides([]); // Clear snap guides
  }, [setPanning, setDragging, selectionRect, shapes, assetSpatialIndex, walls, textAnnotations, labelArrows, dimensions, batchUpdateItems, clearDragPreview, setSelectedIds, selectMultipleAssets, setSnapGuides, draggedPoint, clearSelection, setPan, zoom, placementMode, addWall, addAsset, addShape, setPlacementMode, resolveIdsWithGroups, updateTyping, pendingImportShape, setPendingImportShape]);

  const handleAssetDrop = useCallback(
    async (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      const type = e.dataTransfer.getData('assetType');
      if (!type || !canvasRef.current) return;

      const { x: worldX, y: worldY } = screenToWorld(e.clientX, e.clientY);

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

      let finalX = worldX;
      let finalY = worldY;
      let finalRotation = 0;

      if (template?.category === 'Space_Elements') {
        // Snap to nearest wall on drop if it's a door/window!
        const snapDistance = 100; // Drop snap radius
        const wallSnap = findWallSnapPoint({ x: worldX, y: worldY }, walls, snapDistance, {
          allowNodes: false,
          allowCenterLine: false,
          allowFaces: true,
        });
        if (wallSnap.snapped && wallSnap.wallId && wallSnap.edgeId) {
          // Attempt to align rotation with wall
          const wall = walls.find(w => w.id === wallSnap.wallId);
          if (wall) {
            const edge = wall.edges.find(e => e.id === wallSnap.edgeId);
            if (edge) {
              const nodeA = wall.nodes.find(n => n.id === edge.nodeA);
              const nodeB = wall.nodes.find(n => n.id === edge.nodeB);
              if (nodeA && nodeB) {
                finalRotation = Math.atan2(nodeB.y - nodeA.y, nodeB.x - nodeA.x) * (180 / Math.PI);
                const angleRad = finalRotation * (Math.PI / 180);
                const insertionInset = 50;
                const insertionOffset = Math.max(0, (height / 2) - insertionInset);
                const insertionAnchor = {
                  x: Math.sin(angleRad) * insertionOffset,
                  y: -Math.cos(angleRad) * insertionOffset,
                };

                finalX = wallSnap.x - insertionAnchor.x;
                finalY = wallSnap.y - insertionAnchor.y;
              }
            }
          }
        }
      }

      const zCandidates = [
        ...walls.map((w) => w.zIndex || 0),
        ...shapes.map((s) => s.zIndex || 0),
        ...assets.map((a) => a.zIndex || 0),
      ];
      const nextZIndex = zCandidates.length > 0 ? Math.max(...zCandidates) + 1 : 1;

      // Default texture initialization based on type/category
      let fillType: 'solid' | 'texture' | 'hatch' | 'gradient' = 'solid';
      let fillTexture: string | undefined = undefined;
      let fillColor: string = 'transparent';

      const typeLower = type.toLowerCase();
      const labelLower = (template?.label || '').toLowerCase();

      if (typeLower.includes('grass') || labelLower.includes('grass')) {
        fillType = 'texture';
        fillTexture = 'grass-01';
      } else if (typeLower.includes('beach') || labelLower.includes('beach') || typeLower.includes('sand') || labelLower.includes('sand')) {
        fillType = 'texture';
        fillTexture = 'sand-01';
      } else if (typeLower.includes('parking') || labelLower.includes('parking')) {
        fillType = 'texture';
        fillTexture = 'parking-lot';
      }

      if (fillType === 'texture' && fillTexture) {
        fillColor = `url(#${fillTexture}-scale-4-thick-1)`;
      }

      const newAsset: Asset = {
        id: `${type}-${Date.now()}`,
        type,
        x: finalX,
        y: finalY,
        width,
        height,
        rotation: finalRotation,
        scale: 1,
        zIndex: nextZIndex,
        fillType,
        fillTexture,
        fillColor,
        metadata: template ? { label: template.label } : {},
      };

      addAsset(newAsset);
      setSelectedIds([newAsset.id]);
      toast.success(`Added ${template?.label || type}`, { duration: 1500 });

      // Don't auto-explode on drop - let user double-click to explode if needed
      // Assets should stay as assets initially
      
      // Clear any pending selection rectangle
      setSelectionRect(null);
      setDragStart(null);
    },
    [addAsset, assets, walls, setSelectedIds, screenToWorld, shapes]
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
        const current = wheelTransformRef.current;
        const nextPanX = current.panX - e.deltaX;
        const nextPanY = current.panY - e.deltaY;
        wheelTransformRef.current = { ...current, panX: nextPanX, panY: nextPanY };
        scheduleViewportTransform({ zoom: current.zoom, panX: nextPanX, panY: nextPanY });
        return;
      }

      // Zoom Handling
      const current = wheelTransformRef.current;
      const delta = e.deltaY > 0 ? 0.9 : 1.1;
      const newZoom = Math.max(0.000001, Math.min(1000000, current.zoom * delta));

      const rect = canvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      const worldX = (mouseX - current.panX) / current.zoom;
      const worldY = (mouseY - current.panY) / current.zoom;

      // Calculate new pan to keep mouse over same world point
      const newPanX = mouseX - worldX * newZoom;
      const newPanY = mouseY - worldY * newZoom;

      wheelTransformRef.current = { zoom: newZoom, panX: newPanX, panY: newPanY };
      scheduleViewportTransform({ zoom: newZoom, panX: newPanX, panY: newPanY });

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
  }, [scheduleViewportTransform]);

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
      // Don't handle shortcuts if user is typing in an input or textarea
      const target = e.target as HTMLElement;
      const isInput = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable);

      // Allow COPY/PASTE/UNDO/REDO in inputs, but skip OUR custom canvas logic
      // Actually, standard Ctrl+C/V/Z/Y should probably bypass our canvas logic if in an input
      if (isInput) return;

      const ctrlKey = e.ctrlKey || e.metaKey;

      // Reset / Clear selection (Esc)
      if (e.key === 'Escape') {
        const active = activeTool;
        // Don't auto-reset to 'select' if we are in a drawing mode that might need to finish or handle its own Escape
        // These tools handle Escape internally (either to finish or cancel specifically)
        const isDrawingTool = ['wall', 'shape-line', 'shape-arrow', 'shape-polygon', 'freehand', 'dimension', 'label-arrow', 'text-annotation', 'trim-to-blend'].includes(active);
        
        if (isDrawingTool) {
          // Let the specific tool handle it. If it wants to exit, it will call setActiveTool('select') itself.
          return;
        }

        clearSelection();
        setActiveTool('select');
        setPlacementMode({ active: false, data: null });
        setPendingImportShape(null);
        setSelectedEdgeId(null);
        return;
      }

      // Undo (Ctrl+Z)
      if (ctrlKey && !e.shiftKey && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        console.log("[Workspace2D] Keyboard Shortcut: Undo (Ctrl+Z)");
        undo();
        return;
      }

      // Redo (Ctrl+Y or Ctrl+Shift+Z)
      if ((ctrlKey && e.key.toLowerCase() === 'y') || (ctrlKey && e.shiftKey && e.key.toLowerCase() === 'z')) {
        e.preventDefault();
        console.log("[Workspace2D] Keyboard Shortcut: Redo (Ctrl+Y/Shift+Z)");
        redo();
        return;
      }

      // Zoom shortcuts
      if (ctrlKey && e.key === '=') {
        e.preventDefault();
        zoomIn();
      } else if (ctrlKey && e.key === '-') {
        e.preventDefault();
        zoomOut();
      }
      // Copy (Ctrl+C)
      else if (ctrlKey && e.key === 'c') {
        e.preventDefault();
        if (selectedIds.length > 0) {
          copySelection(selectedIds);
          toast.success(`Copied ${selectedIds.length} item(s)`, { duration: 1500 });
        }
      }
      // Paste (Ctrl+V)
      else if (ctrlKey && e.key === 'v') {
        e.preventDefault();
        const cursorPos = useEditorStore.getState().mouseWorldPos;
        const newIds = pasteSelection(cursorPos ? { x: cursorPos.x, y: cursorPos.y } : undefined);
        if (newIds.length > 0) {
          setSelectedIds(newIds);
          toast.success(`Pasted ${newIds.length} item(s)`, { duration: 1500 });
        }
      }
      // Bring to front (Shift + ])
      else if (e.shiftKey && e.key === '}') {
        e.preventDefault();
        if (selectedIds.length > 0) {
          const allItems = [...walls, ...shapes, ...assets, ...dimensions, ...textAnnotations, ...labelArrows];
          const currentMaxZ = allItems.length ? Math.max(...allItems.map((i: any) => i.zIndex || 0)) : 0;
          let z = currentMaxZ + 1;

          const batchUpdates: any[] = [];

          const collectUpdatesForId = (itemId: string) => {
            if (shapes.find((s) => s.id === itemId)) batchUpdates.push({ id: itemId, type: 'shape', updates: { zIndex: z++ } });
            else if (walls.find((w) => w.id === itemId)) batchUpdates.push({ id: itemId, type: 'wall', updates: { zIndex: z++ } });
            else if (assets.find((a) => a.id === itemId)) batchUpdates.push({ id: itemId, type: 'asset', updates: { zIndex: z++ } });
            else if (dimensions.find((d) => d.id === itemId)) batchUpdates.push({ id: itemId, type: 'dimension', updates: { zIndex: z++ } });
            else if (labelArrows.find((la) => la.id === itemId)) batchUpdates.push({ id: itemId, type: 'labelArrow', updates: { zIndex: z++ } });
            else if (textAnnotations.find((t) => t.id === itemId)) batchUpdates.push({ id: itemId, type: 'textAnnotation', updates: { zIndex: z++ } });
            else {
              const group = groups.find(g => g.id === itemId);
              if (group) group.itemIds.forEach(collectUpdatesForId);
            }
          };

          selectedIds.forEach(collectUpdatesForId);

          if (batchUpdates.length > 0) {
            batchUpdateItems(batchUpdates);
          }
        }
      }
      // Send to back (Shift + [)
      else if (e.shiftKey && e.key === '{') {
        e.preventDefault();
        if (selectedIds.length > 0) {
          const allItems = [...walls, ...shapes, ...assets, ...dimensions, ...textAnnotations, ...labelArrows];
          const currentMinZ = allItems.length ? Math.min(...allItems.map((i: any) => i.zIndex || 0)) : 0;
          let z = currentMinZ - 1;

          const batchUpdates: any[] = [];

          const collectUpdatesForId = (itemId: string) => {
            if (shapes.find((s) => s.id === itemId)) batchUpdates.push({ id: itemId, type: 'shape', updates: { zIndex: z-- } });
            else if (walls.find((w) => w.id === itemId)) batchUpdates.push({ id: itemId, type: 'wall', updates: { zIndex: z-- } });
            else if (assets.find((a) => a.id === itemId)) batchUpdates.push({ id: itemId, type: 'asset', updates: { zIndex: z-- } });
            else if (dimensions.find((d) => d.id === itemId)) batchUpdates.push({ id: itemId, type: 'dimension', updates: { zIndex: z-- } });
            else if (labelArrows.find((la) => la.id === itemId)) batchUpdates.push({ id: itemId, type: 'labelArrow', updates: { zIndex: z-- } });
            else if (textAnnotations.find((t) => t.id === itemId)) batchUpdates.push({ id: itemId, type: 'textAnnotation', updates: { zIndex: z-- } });
            else {
              const group = groups.find(g => g.id === itemId);
              if (group) group.itemIds.forEach(collectUpdatesForId);
            }
          };

          selectedIds.forEach(collectUpdatesForId);

          if (batchUpdates.length > 0) {
            batchUpdateItems(batchUpdates);
          }
        }
      }
      // Duplicate (Ctrl+D)
      else if (ctrlKey && e.key === 'd') {
        e.preventDefault();
        const newSelectedIds: string[] = [];
        const offset = 20; // Base offset between duplicates (move to side)

        saveToHistory();

        selectedIds.forEach(id => {
          const shape = shapes.find(s => s.id === id);
          if (shape) {
            const newShape = {
              ...shape,
              id: generateId(),
              x: shape.x + offset,
              y: shape.y + offset,
              zIndex: getNextZIndex()
            };
            addShape(newShape, true); // skipHistory
            newSelectedIds.push(newShape.id);
            return;
          }

          const asset = assets.find(a => a.id === id);
          if (asset) {
            const newAsset = {
              ...asset,
              id: generateId(),
              x: asset.x + offset,
              y: asset.y + offset,
              zIndex: getNextZIndex()
            };
            addAsset(newAsset, true); // skipHistory
            newSelectedIds.push(newAsset.id);
            return;
          }

          const wall = walls.find(w => w.id === id);
          if (wall) {
            const nodeIdMap = new Map<string, string>();
            const newWallNodes = wall.nodes.map(n => {
              const newId = generateId();
              nodeIdMap.set(n.id, newId);
              return { ...n, id: newId, x: n.x + offset, y: n.y + offset };
            });

            const newEdges = wall.edges.map(e => ({
              ...e,
              id: generateId(),
              nodeA: nodeIdMap.get(e.nodeA)!,
              nodeB: nodeIdMap.get(e.nodeB)!
            }));

            const newId = generateId();
            addWall({ ...wall, id: newId, nodes: newWallNodes, edges: newEdges, zIndex: getNextZIndex() }, true); // skipHistory
            newSelectedIds.push(newId);
          }
        });

        if (newSelectedIds.length > 0) {
          setSelectedIds(newSelectedIds);
          selectMultipleAssets(newSelectedIds);
          toast.success(`Duplicated ${selectedIds.length} item(s)`);
        }
      }
      // Delete key (global delete for selected items)
      else if (e.key === 'Delete' || e.key === 'Backspace') {
        const active = activeTool;
        // If user is typing in text tool, let TextAnnotationTool handle it
        if (active === 'text-annotation') return;

        e.preventDefault();
        const { selectedEdgeId } = useEditorStore.getState();

        // Delete selected edge
        if (selectedEdgeId) {
          const wall = walls.find(w => w.edges.some(e => e.id === selectedEdgeId));
          if (wall && wall.edges.length > 2) {
            useProjectStore.getState().removeWallEdge(wall.id, selectedEdgeId);
            setSelectedEdgeId(null);
          }
        }
        // Delete selected items
        else if (selectedIds.length > 0) {
          removeItemsBatch(selectedIds);
          clearSelection();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [zoomIn, zoomOut, clearSelection, selectedIds, activeTool, setActiveTool, setPlacementMode, setPendingImportShape, setSelectedEdgeId, undo, redo, copySelection, pasteSelection, setSelectedIds, walls, shapes, assets, dimensions, textAnnotations, labelArrows, groups, batchUpdateItems, saveToHistory, getNextZIndex, addShape, addAsset, addWall, removeItemsBatch]);



  const alignSelection = (mode: 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom') => {
    const selectedIds = useEditorStore.getState().selectedIds;
    if (selectedIds.length < 2) return;

    // Save history once before modifying multiple items
    saveToHistory();

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
        const fontSize = text.fontSize || 250;
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
      const { shapes, walls, assets } = store;
      const newSelectedIds: string[] = [...selectedIds]; // Include originals
      const offset = 20; // Base offset between duplicates (move to side)

      // Save history once for the whole batch
      saveToHistory();

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
            addShape(newShape, true); // skipHistory
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
            addAsset(newAsset, true); // skipHistory
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
            addWall(newWall, true); // skipHistory
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
                addShape(newShape, true);
                newChildIds.push(newShape.id);
                return;
              }
              const asset = assets.find(a => a.id === childId);
              if (asset) {
                const newAsset = { ...asset, id: generateId(), groupId: newGroupId, x: asset.x + offset * (i + 1), y: asset.y + offset * (i + 1), zIndex: getNextZIndex() };
                addAsset(newAsset, true);
                newChildIds.push(newAsset.id);
                return;
              }
            });

            const newGroup = { ...group, id: newGroupId, itemIds: newChildIds, zIndex: getNextZIndex() };
            addGroup(newGroup, true);
            newSelectedIds.push(newGroupId);
            return;
          }
        });
      }

      if (newSelectedIds.length > 0) {
        setSelectedIds(newSelectedIds);
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
  }, [selectedIds, saveToHistory, shapes, assets, walls, getNextZIndex, addShape, addAsset, addWall, groups, addGroup, setSelectedIds]);

  const distributeSelection = (mode: 'horizontal' | 'vertical' | 'circular', spacing?: number, diameter?: number, overrideIds?: string[]) => {
    const selectedIds = overrideIds || useEditorStore.getState().selectedIds;
    if (selectedIds.length < 2) return;

    if (mode === 'circular') {
      useProjectStore.getState().distributeRadial(diameter ? diameter / 2 : 500, 0, 360, selectedIds);
    } else {
      useProjectStore.getState().distributeSelection(
        mode === 'horizontal' ? 'horizontal' : 'vertical',
        spacing || 100,
        selectedIds
      );
    }
  };

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();

    if (!canvasRef.current) {
      return;
    }

    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const worldX = (x - panX) / zoom;
    const worldY = (y - panY) / zoom;

    // Unified z-aware hit testing for context menu target
    const getZ = (item: any) => (typeof item.zIndex === 'number' ? item.zIndex : 0);
    const allItems = [
      ...walls.map(w => ({ ...w, _renderType: 'wall' as const })),
      ...shapes.map(s => ({ ...s, _renderType: 'shape' as const })),
      ...assets.map(a => ({ ...a, _renderType: 'asset' as const })),
      ...dimensions.map(d => ({ ...d, _renderType: 'dimension' as const })),
      ...labelArrows.map(l => ({ ...l, _renderType: 'labelArrow' as const })),
      ...textAnnotations.map(t => ({ ...t, _renderType: 'textAnnotation' as const })),
    ].sort((a, b) => getZ(a) - getZ(b));

    let targetId: string | null = null;
    for (let i = allItems.length - 1; i >= 0; i--) {
      const item = allItems[i];
      let isHit = false;

      if (item._renderType === 'shape') {
        const s = item;
        const halfW = s.width / 2, halfH = s.height / 2;
        if (worldX >= s.x - halfW && worldX <= s.x + halfW && worldY >= s.y - halfH && worldY <= s.y + halfH) isHit = true;
      } else if (item._renderType === 'asset') {
        const a = item;
        if (!a.isExploded) {
          const halfW = (a.width * (a.scale || 1)) / 2, halfH = (a.height * (a.scale || 1)) / 2;
          if (worldX >= a.x - halfW && worldX <= a.x + halfW && worldY >= a.y - halfH && worldY <= a.y + halfH) isHit = true;
        }
      } else if (item._renderType === 'wall') {
        const w = item;
        isHit = isPointInsideWall(w, worldX, worldY);
      } else if (item._renderType === 'textAnnotation') {
        const t = item;
        const fS = t.fontSize || 250;
        const hitR = Math.max((t.text?.length || 1) * fS * 0.3, fS * 0.6, 30);
        if (Math.hypot(worldX - t.x, worldY - t.y) <= hitR) isHit = true;
      }

      if (isHit) {
        targetId = item.id;
        break;
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
  }, [panX, panY, zoom, walls, shapes, assets, dimensions, labelArrows, textAnnotations]);

  const closeContextMenu = () => {
    setContextMenu(null);
  };

  // Define Context Menu Actions
  const getContextMenuActions = useCallback(() => {
    const hasSelection = selectedIds.length > 0;
    const singleSelection = selectedIds.length === 1;

    const actions: any[] = [
      {
        label: "Cut",
        shortcut: "Ctrl+X",
        disabled: !hasSelection,
        action: () => {
          cutSelection(selectedIds);
          clearSelection();
        },
      },
      {
        label: "Copy",
        shortcut: "Ctrl+C",
        disabled: !hasSelection,
        action: () => copySelection(selectedIds),
      },
      {
        label: "Paste",
        shortcut: "Ctrl+V",
        action: () => {
          const newIds = pasteSelection(
            contextMenu ? { x: contextMenu.worldX, y: contextMenu.worldY } : undefined
          );
          if (newIds.length > 0) {
            setSelectedIds(newIds);
          }
        },
      },
      { separator: true },
      {
        label: "Undo",
        shortcut: "Ctrl+Z",
        disabled: useProjectStore.getState().history.past.length === 0,
        action: () => {
          undo();
          closeContextMenu();
        },
      },
      {
        label: "Redo",
        shortcut: "Ctrl+Shift+Z",
        disabled: useProjectStore.getState().history.future.length === 0,
        action: () => {
          redo();
          closeContextMenu();
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
            author: user ? (`${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email || 'User') : 'User',
            userId: user?._id,
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
      const store = useProjectStore.getState();
      const isExactlyOneGroup = store.groups.some(g => 
        g.itemIds.length === selectedIds.length && 
        g.itemIds.every(id => selectedIds.includes(id))
      );
      
      const hasGroupedItems = selectedIds.some(id => {
        const item = store.shapes.find(s => s.id === id) ||
          store.assets.find(a => a.id === id) ||
          store.walls.find(w => w.id === id) ||
          store.textAnnotations.find(t => t.id === id) ||
          store.labelArrows.find(l => l.id === id);
        return !!item?.groupId;
      });

      // Show Group if multiple items selected AND it's not already exactly one group
      actions.push({
        label: 'Group',
        disabled: selectedIds.length <= 1 || isExactlyOneGroup,
        action: () => {
          const newGroupId = useProjectStore.getState().groupSelection(selectedIds);
          useEditorStore.getState().setSelectedIds(useProjectStore.getState().groups.find(g => g.id === newGroupId)?.itemIds || []);
          toast.success("Grouped");
          closeContextMenu();
        }
      });

      // Show Ungroup if any part of selection is grouped
      actions.push({
        label: 'Ungroup',
        disabled: !hasGroupedItems,
        action: () => {
          const ungroupedIds = useProjectStore.getState().ungroupSelection(selectedIds);
          useEditorStore.getState().setSelectedIds(ungroupedIds);
          toast.success("Ungrouped");
          closeContextMenu();
        }
      });

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
        useProjectStore.getState().removeItemsBatch(selectedIds);
        useEditorStore.getState().clearSelection();
      },
    });

    return actions;
  }, [selectedIds, cutSelection, clearSelection, copySelection, pasteSelection, contextMenu, setSelectedIds, addGroup, updateAsset, removeItemsBatch]);



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
      onContextMenu={handleContextMenu}
      onDoubleClick={handleDoubleClick}
      onClick={() => {
        if (contextMenu) closeContextMenu();
      }
      }
      style={{
        cursor: isPanning ? 'grabbing' : 
                activeTool === 'pan' ? 'grab' : 
                activeHoveredSnapPoint ? 'crosshair' :
                (hoveredId && activeTool === 'select') ? 'pointer' :
                activeTool === 'select' ? 'default' : 'crosshair',
      }}
    >
      {gridHud.visible && showGrid && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-50 px-3 py-1 rounded-md text-xs font-semibold bg-slate-900/80 text-white shadow">
          {gridHud.message}
        </div>
      )}
      <CanvasGridLayer
        show={showGrid}
        gridSize={sceneGridSize}
        viewportSize={viewportSize}
        zoom={zoom}
        panX={panX}
        panY={panY}
        unitSystem={unitSystem}
      />
      {/* Grid unit / size control */}
      <div className="absolute top-3 right-3 z-50 flex items-center gap-3 bg-white/90 shadow-sm rounded-md px-3 py-2 text-xs sm:text-sm text-slate-700 border border-slate-200">
        <label className="flex items-center gap-1 cursor-pointer" title="Snap to grid intersections">
          <input
            type="checkbox"
            checked={snapToGridEnabled}
            onChange={() => {
              const next = !snapToGridEnabled;
              useEditorStore.getState().setSnapToGrid(next);
              useSceneStore.getState().setSnapToGridEnabled(next);
            }}
            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
          <span>Snap to Grid</span>
        </label>
        <div className="w-px h-4 bg-slate-300 mx-1"></div>
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
          onChange={(e) => setUnitSystem?.(e.target.value as 'metric-m' | 'metric-mm' | 'imperial-ft')}
        >
          <option value="metric-m">Meters (m)</option>
          <option value="metric-mm">Millimeters (mm)</option>
          <option value="imperial-ft">Feet (ft)</option>
        </select>
      </div>
      {/* Snap to Anchor HUD for old right-click snap mode */}
      {isSnapMode && snapSourceId && snapAnchor && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-50 px-3 py-1 rounded-md text-xs font-medium bg-blue-600 text-white shadow">
          Snap mode: click a target object to snap <span className="font-semibold">{snapAnchor}</span> of the selected item
        </div>
      )}
      {/* Placement Mode HUD */}
      {placementMode.active && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-50 flex items-center gap-4 px-4 py-2 rounded-lg bg-slate-900/90 text-white shadow-xl border border-white/20">
          <div className="flex flex-col">
            <span className="text-sm font-bold">AI Plan Preview</span>
            <span className="text-[10px] text-slate-300">Move your mouse to position the layout, then click to place.</span>
          </div>
          <div className="h-8 w-px bg-white/20"></div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setPlacementMode({ active: false, data: null });
              toast("AI Placement cancelled");
            }}
            className="px-3 py-1.5 rounded-md bg-red-500/20 hover:bg-red-500/40 text-red-200 text-xs font-semibold transition-colors border border-red-500/30"
          >
            Cancel
          </button>
        </div>
      )}
      {/* Pending Import Shape HUD */}
      {pendingImportShape && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-50 flex items-center gap-4 px-4 py-2 rounded-lg bg-slate-900/90 text-white shadow-xl border border-white/20">
          <div className="flex flex-col">
            <span className="text-sm font-bold">Place Imported File</span>
            <span className="text-[10px] text-slate-300">Move your mouse to position, then click to place. Press Esc to cancel.</span>
          </div>
          <div className="h-8 w-px bg-white/20"></div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setPendingImportShape(null);
            }}
            className="px-3 py-1.5 rounded-md bg-red-500/20 hover:bg-red-500/40 text-red-200 text-xs font-semibold transition-colors border border-red-500/30"
          >
            Cancel
          </button>
        </div>
      )}

      <svg
        width={viewportSize.width}
        height={viewportSize.height}
        className="absolute inset-0"
        data-workspace-root="true"
      >
        <TexturePatternDefs />
        {/* Remote Cursors and User Awareness */}
        <CursorOverlay cursors={activeUsers} />
        <g transform={`translate(${panX}, ${panY}) scale(${zoom})`}>
          <SnapMarkersRenderer />

          <RenderLayer 
            visibleRenderables={visibleRenderables}
            selectedIds={selectedIds}
            hoveredId={hoveredId}
            zoom={zoom}
            verticesMap={verticesMap}
            dragPreview={dragPreview}
          />

          {/* Auto Dimensions (Show Dimensions Toggle) */}
          <AutoDimensionRenderer
            walls={walls}
            shapes={autoDimensionShapes}
            assets={autoDimensionAssets}
            zoom={zoom}
          />

          {/* AI Plan Placement Preview */}
          {placementMode.active && placementMode.data && (
            <PlacementRenderer />
          )}

          {/* Pending Import Shape Preview (follows cursor) */}
          {pendingImportShape && (
            <g transform={`translate(${mouseWorldPos.x}, ${mouseWorldPos.y})`} opacity={0.7} style={{ pointerEvents: 'none' }}>
              <image
                href={pendingImportShape.fillImage}
                x={-pendingImportShape.width / 2}
                y={-pendingImportShape.height / 2}
                width={pendingImportShape.width}
                height={pendingImportShape.height}
                preserveAspectRatio="none"
              />
              <rect
                x={-pendingImportShape.width / 2}
                y={-pendingImportShape.height / 2}
                width={pendingImportShape.width}
                height={pendingImportShape.height}
                fill="none"
                stroke="#3b82f6"
                strokeWidth={2}
                strokeDasharray="8 4"
                vectorEffect="non-scaling-stroke"
              />
            </g>
          )}

          {/* Snap Mode Source Highlight - Removed as redundant with SnapMarkers/AnchorHighlights */}
          {/* ... Removed ... */}

          <WallTool
            isActive={activeTool === 'wall'}
            thickness={currentWallThickness}
          />

          <DimensionTool isActive={activeTool === 'dimension'} />
          <ArchTool isActive={activeTool === 'arch'} />
          <LabelArrowTool isActive={activeTool === 'label-arrow'} />
          <TrimTool isActive={activeTool === 'trim' || activeTool === 'trim-to-object'} isTrimToObject={activeTool === 'trim-to-object'} />

          {['shape-rectangle', 'shape-ellipse', 'shape-line', 'shape-arrow', 'shape-polygon'].includes(activeTool) && (
            <ShapeTool
              isActive={true}
              shapeType={activeTool.replace('shape-', '') as 'rectangle' | 'ellipse' | 'line' | 'arrow' | 'polygon'}
            />
          )}

          <FreehandTool isActive={activeTool === 'freehand'} />

          {/* Rectangular Selection Preview */}
          {/* Rectangular Selection Overlay - Only show if in selection mode and NOT dragging an item */}
      {selectionRect && !isDraggingItem && (activeTool === 'rectangular-select' || activeTool === 'select') && (
            <rect
              x={Math.min(selectionRect.x1, selectionRect.x2)}
              y={Math.min(selectionRect.y1, selectionRect.y2)}
              width={Math.min(viewportSize.width / (zoom || 1) * 2, Math.abs(selectionRect.x2 - selectionRect.x1))}
              height={Math.min(viewportSize.height / (zoom || 1) * 2, Math.abs(selectionRect.y2 - selectionRect.y1))}
              fill="#3b82f6"
              fillOpacity={0.1}
              stroke="#3b82f6"
              strokeWidth={1.5}
              vectorEffect="non-scaling-stroke"
              pointerEvents="none"
            />
          )}



          {/* Trim-to-blend individual highlights */}
          {activeTool === 'trim-to-blend' && selectedIds.map(id => {
            const shape = shapes.find(s => s.id === id);
            if (!shape) return null;
            return (
              <g key={id} transform={`translate(${shape.x}, ${shape.y}) rotate(${shape.rotation || 0})`}>
                {shape.type === 'ellipse' ? (
                  <ellipse
                    cx={0}
                    cy={0}
                    rx={shape.width / 2}
                    ry={shape.height / 2}
                    fill="rgba(34, 197, 94, 0.1)"
                    stroke="#22c55e"
                    strokeWidth={2}
                    strokeDasharray={`${6 / zoom},${4 / zoom}`}
                    vectorEffect="non-scaling-stroke"
                    pointerEvents="none"
                  />
                ) : (
                  <rect
                    x={-shape.width / 2}
                    y={-shape.height / 2}
                    width={shape.width}
                    height={shape.height}
                    fill="rgba(34, 197, 94, 0.1)"
                    stroke="#22c55e"
                    strokeWidth={2}
                    strokeDasharray={`${6 / zoom},${4 / zoom}`}
                    vectorEffect="non-scaling-stroke"
                    pointerEvents="none"
                  />
                )}
              </g>
            );
          })}



          {/* SelectionTool handles will be rendered outside the scaled group for fixed size */}
        </g>
        {/* Render SelectionTool outside scaled group so handles stay fixed size */}
        {activeTool === 'select' && !dragPreview && (
          <SelectionTool isActive={true} viewportSize={viewportSize} />
        )}

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
