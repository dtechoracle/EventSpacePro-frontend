"use client";

import AssetsModal from "@/pages/(components)/editor/AssetsModal";
import BottomToolbar from "@/pages/(components)/editor/BottomToolBar";
import PropertiesSidebar from "@/pages/(components)/editor/PropertiesSidebar";
import Workspace2D from "@/components/Workspace2D"; // NEW WORKSPACE
import Scene3D from "@/components/Scene3D";
import DashboardSidebar from "@/pages/(components)/DashboardSidebar";
import AiTrigger from "@/pages/(components)/AiTrigger";
import InlineSvg from "@/components/tools/InlineSvg";
import TexturePatternDefs from "@/components/TexturePatternDefs";
import React, { useState, useEffect, useCallback, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/router";
import { apiRequest } from "@/helpers/Config";
import { useEditorStore } from "@/store/editorStore";
import { useProjectStore } from "@/store/projectStore";
import { useUserStore } from "@/store/userStore";
import {
  useSceneStore,
  EventData as BaseEventData,
  AssetInstance,
  CanvasData,
} from "@/store/sceneStore";
import WorkspacePreview from "@/components/WorkspacePreview";
import { ASSET_LIBRARY } from "@/lib/assets";
import toast from "react-hot-toast";
import { calculateWorkspaceBounds } from "@/utils/workspaceBounds";
import { useAutoSave } from "@/hooks/useAutoSave";
import { useRouteParams } from "@/hooks/useRouteParams";
import { PRELOADED_VENUES } from "@/lib/preloadedVenues";
import {
  canvasDataFromCollaborationAssets,
  flattenCanvasAssets,
  hasCanvasContent,
  isCollaborationCanvasShape,
} from "@/lib/canvasAssets";

const PRELOADED_VENUE_IDS = new Set(PRELOADED_VENUES.map(v => v.id));
const PRELOADED_VENUE_MAP = new Map(PRELOADED_VENUES.map(v => [v.id, v]));


// Extended EventData type with canvasData
type EventData = BaseEventData & {
  comments?: any[];
  canvasData?: {
    walls: any[];
    shapes: any[];
    assets: any[];
    textAnnotations?: any[];
    dimensions?: any[];
    labelArrows?: any[];
    layers?: any[];
    canvas?: any;
    comments?: any[];
  };
};

const elementAssetDefinitionById = new Map(ASSET_LIBRARY.map((asset) => [asset.id, asset]));

const isPointInClosedPolygon = (x: number, y: number, points: { x: number; y: number }[]) => {
  let inside = false;

  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const xi = points[i].x;
    const yi = points[i].y;
    const xj = points[j].x;
    const yj = points[j].y;
    const intersects =
      yi > y !== yj > y &&
      x < ((xj - xi) * (y - yi)) / ((yj - yi) || 0.0000001) + xi;
    if (intersects) inside = !inside;
  }

  return inside;
};

const getAssetCountBucket = (label: string) => {
  const normalized = label.toLowerCase();

  if (normalized.includes("chair")) return "chairs";
  if (normalized.includes("stool")) return "stools";
  if (normalized.includes("table")) return "tables";
  if (normalized.includes("sofa")) return "sofas";
  return "other assets";
};

// Lightweight pane listing all elements on the workspace (walls, shapes, assets)
function ElementsPane() {
  const walls = useProjectStore(s => s.walls);
  const shapes = useProjectStore(s => s.shapes);
  const assets = useProjectStore(s => s.assets);
  const textAnnotations = useProjectStore(s => s.textAnnotations);
  const dimensions = useProjectStore(s => s.dimensions);
  const labelArrows = useProjectStore(s => s.labelArrows);
  const groups = useProjectStore(s => s.groups);
  const selectedIds = useEditorStore(s => s.selectedIds);
  const setSelectedIds = useEditorStore(s => s.setSelectedIds);
  const setPan = useEditorStore(s => s.setPan);
  const [expandedAssets, setExpandedAssets] = React.useState<Record<string, boolean>>({});
  const [expandedAssetGroups, setExpandedAssetGroups] = React.useState<Record<string, boolean>>({
    venue: true,
    walls: true,
    shapes: true,
    chairs: true,
    tables: true,
    stools: false,
    sofas: false,
    "other assets": false,
  });

  const [renamingId, setRenamingId] = React.useState<string | null>(null);
  const [renamingText, setRenamingText] = React.useState("");

  const handleRename = (id: string, newName: string, type: string) => {
    const store = useProjectStore.getState();
    const updates = { name: newName };

    if (type === "Wall") store.updateWall(id, updates);
    else if (type === "Shape") store.updateShape(id, updates);
    else if (type === "Asset") store.updateAsset(id, updates);
    else if (type === "Text") store.updateTextAnnotation(id, updates);
    else if (type === "Dimension") store.updateDimension(id, updates);
    else if (type === "Label") store.updateLabelArrow(id, updates);
    else if (type === "Group") store.updateGroup(id, updates);

    setRenamingId(null);
  };

  const items = React.useMemo(() => {
    // Group shapes by exploded asset (sourceAssetId)
    const assetChildrenMap: Record<string, typeof shapes> = {};
    const independentShapes: typeof shapes = [];

    shapes.forEach((s) => {
      // Show all shapes including background-texture if it exists
      // if (s.id === 'background-texture') return;

      const sourceId = (s as any).sourceAssetId as string | undefined;
      if (sourceId) {
        if (!assetChildrenMap[sourceId]) assetChildrenMap[sourceId] = [];
        assetChildrenMap[sourceId].push(s);
      } else {
        independentShapes.push(s);
      }
    });

    // Only exclude items whose groupId references an existing group
    const existingGroupIds = new Set(groups.map(g => g.id));

    return [
    // Filter out items that belong to an existing group
    ...walls.filter(w => !w.groupId || !existingGroupIds.has(w.groupId)).map((w) => {
      if (!w.nodes || w.nodes.length === 0) {
        return { id: w.id, label: w.name || "Wall", type: "Wall" as const, x: 0, y: 0, wall: w };
      }
      const xs = w.nodes.map((n) => n.x);
      const ys = w.nodes.map((n) => n.y);
      const centerX = (Math.min(...xs) + Math.max(...xs)) / 2;
      const centerY = (Math.min(...ys) + Math.max(...ys)) / 2;
      return { id: w.id, label: w.name || "Wall", type: "Wall" as const, x: centerX, y: centerY, wall: w };
    }),
    ...independentShapes.filter(s => !s.groupId || !existingGroupIds.has(s.groupId)).map((s) => ({
      id: s.id,
      label: s.name || s.type,
      type: "Shape" as const,
      x: s.x,
      y: s.y,
      shape: s,
    })),
    ...assets.filter(a => !a.groupId || !existingGroupIds.has(a.groupId)).map((a) => ({
      id: a.id,
      label: a.name || (a.metadata as any)?.label || a.type || "Asset",
      type: "Asset" as const,
      x: a.x,
      y: a.y,
      asset: a,
      childShapes: assetChildrenMap[a.id] || [],
    })),
    ...textAnnotations.filter(t => !t.groupId || !existingGroupIds.has(t.groupId)).map((t) => ({
      id: t.id,
      label: t.name || t.text || "Text",
      type: "Text" as const,
      x: t.x,
      y: t.y,
      text: t,
    })),
    ...dimensions.filter(d => !d.groupId || !existingGroupIds.has(d.groupId)).map((d) => ({
      id: d.id,
      label: d.name || ((d.type as string) === "wall" ? "Wall Dimension" : "Dimension"),
      type: "Dimension" as const,
      x: (d.startPoint.x + d.endPoint.x) / 2,
      y: (d.startPoint.y + d.endPoint.y) / 2,
      dimension: d,
    })),
    ...labelArrows.filter(la => !la.groupId || !existingGroupIds.has(la.groupId)).map((la) => ({
      id: la.id,
      label: la.name || la.label || "Label",
      type: "Label" as const,
      x: (la.startPoint.x + la.endPoint.x) / 2,
      y: (la.startPoint.y + la.endPoint.y) / 2,
      labelArrow: la,
    })),
    // Groups
    ...groups.map(g => {
      // Find children to compute center
      const children = [
        ...shapes.filter(s => g.itemIds.includes(s.id)),
        ...assets.filter(a => g.itemIds.includes(a.id)),
        ...walls.filter(w => g.itemIds.includes(w.id)),
        ...textAnnotations.filter(t => g.itemIds.includes(t.id)),
        ...dimensions.filter(d => g.itemIds.includes(d.id)),
        ...labelArrows.filter(la => g.itemIds.includes(la.id)),
      ];

      const getCenter = (item: any) => {
        if (item.nodes) { // Wall
          const xs = item.nodes.map((n: any) => n.x);
          const ys = item.nodes.map((n: any) => n.y);
          return {
            x: (Math.min(...xs) + Math.max(...xs)) / 2,
            y: (Math.min(...ys) + Math.max(...ys)) / 2
          };
        }
        if (item.startPoint && item.endPoint) { // Dimension, Label
          return {
            x: (item.startPoint.x + item.endPoint.x) / 2,
            y: (item.startPoint.y + item.endPoint.y) / 2
          };
        }
        return { x: item.x || 0, y: item.y || 0 };
      };

      const centers = children.map(c => getCenter(c));
      const avgX = centers.length > 0 ? centers.reduce((sum, c) => sum + c.x, 0) / centers.length : 0;
      const avgY = centers.length > 0 ? centers.reduce((sum, c) => sum + c.y, 0) / centers.length : 0;

      return {
        id: g.id,
        label: g.name || `Group (${g.itemIds.length} items)`,
        type: "Group" as const,
        x: avgX,
        y: avgY,
        childIds: g.itemIds,
      };
    }),
    ];
  }, [assets, dimensions, groups, labelArrows, shapes, textAnnotations, walls]);

  const assetSummary = React.useMemo(() => {
    const enclosureWalls = walls.filter((wall) => wall.nodes && wall.nodes.length >= 3);
    const counts = new Map<string, number>();

    assets.forEach((asset) => {
      const assetDef = elementAssetDefinitionById.get(asset.type);
      if (!assetDef) return;
      if (assetDef.category === "Space_Elements" || assetDef.category === "Marquee") return;

      const isInsideWall =
        enclosureWalls.length === 0 ||
        enclosureWalls.some((wall) => isPointInClosedPolygon(asset.x, asset.y, wall.nodes));

      if (!isInsideWall) return;

      const bucket = getAssetCountBucket(asset.name || assetDef.label || assetDef.name || "Asset");
      counts.set(bucket, (counts.get(bucket) || 0) + 1);
    });

    const order = ["chairs", "stools", "tables", "sofas", "other assets"];
    return order
      .filter((key) => counts.has(key))
      .map((key) => ({ label: key, count: counts.get(key) || 0 }));
  }, [assets, walls]);

  const groupedElementItems = React.useMemo(() => {
    const venueItems: typeof items = [];
    const assetBuckets: Record<string, typeof items> = {
      chairs: [],
      tables: [],
      stools: [],
      sofas: [],
      "other assets": [],
    };
    const nonAssetItems: typeof items = [];
    const wallItems: typeof items = [];
    const shapeItems: typeof items = [];
    const groupItems: typeof items = [];

    items.forEach((item) => {
      if (item.type === "Group") {
        groupItems.push(item);
        return;
      }
      if (item.type === "Wall") {
        wallItems.push(item);
        return;
      }
      if (item.type === "Shape") {
        shapeItems.push(item);
        return;
      }
      if (item.type !== "Asset" || !item.asset) {
        nonAssetItems.push(item);
        return;
      }

      // Preloaded venue assets get their own group
      if (PRELOADED_VENUE_IDS.has(item.asset.type)) {
        venueItems.push(item);
        return;
      }

      const assetDef = elementAssetDefinitionById.get(item.asset.type);
      const bucket = getAssetCountBucket(
        item.asset.name ||
        assetDef?.label ||
        assetDef?.name ||
        item.label ||
        "Asset"
      );

      if (!assetBuckets[bucket]) assetBuckets[bucket] = [];
      assetBuckets[bucket].push(item);
    });

    return { nonAssetItems, assetBuckets, wallItems, shapeItems, venueItems, groupItems };
  }, [items]);


  const assetGroupOrder = ["chairs", "tables", "stools", "sofas", "other assets"];
  const assetGroupLabels: Record<string, string> = {
    chairs: "Chairs",
    tables: "Tables",
    stools: "Stools",
    sofas: "Sofas",
    "other assets": "Other Assets",
  };

  const handleSelect = (item: { id: string; x: number; y: number; childIds?: string[] }, e?: React.MouseEvent) => {
    const idsToSelect = item.childIds && item.childIds.length > 0 ? item.childIds : [item.id];

    if (e?.shiftKey) {
      const currentSelected = new Set(useEditorStore.getState().selectedIds);
      const allInGroupAlreadySelected = idsToSelect.every(id => currentSelected.has(id));

      if (allInGroupAlreadySelected) {
        idsToSelect.forEach(id => currentSelected.delete(id));
      } else {
        idsToSelect.forEach(id => currentSelected.add(id));
      }
      setSelectedIds(Array.from(currentSelected));
    } else {
      setSelectedIds(idsToSelect);
    }

    // Pan the workspace so that the selected element is roughly centered
    const zoom = useEditorStore.getState().zoom;
    if (typeof window !== "undefined" && zoom > 0) {
      const availableWidth = window.innerWidth - 260 - 200; // sidebar + properties
      const availableHeight = window.innerHeight - 140; // account for toolbar/header
      const targetPanX = availableWidth / 2 - item.x * zoom;
      const targetPanY = availableHeight / 2 - item.y * zoom;
      setPan(targetPanX, targetPanY);
    }
  };

  const renderMiniPreview = (item: any) => {
    const assetDef: any = item.type === "Asset" && item.asset
      ? (ASSET_LIBRARY.find(a => a.id === item.asset.type) || PRELOADED_VENUES.find(v => v.id === item.asset.type))
      : null;

    return (
      <div className="w-7 h-7 rounded border border-gray-200 bg-white flex-shrink-0 overflow-hidden flex items-center justify-center">
        {item.type === "Asset" && item.asset && (
          assetDef?.path ? (
            <div className="w-full h-full p-1">
              <InlineSvg
                src={assetDef.path}
                fill={item.asset.tableColor || item.asset.chairColor || item.asset.fillColor || (item.asset as any).fill || "none"}
                stroke={item.asset.strokeColor || (item.asset as any).stroke || "currentColor"}
                strokeWidth={0.6}
                category={assetDef.category}
              />
            </div>
          ) : (
            <div className="text-[8px] text-gray-400 text-center px-1">
              {item.asset.type}
            </div>
          )
        )}
        {item.type === "Shape" && item.shape && (
          <svg width={24} height={24} viewBox="0 0 24 24">
            {item.shape.type === "rectangle" && (
              <rect
                x={!item.shape.fillType || item.shape.fillType === 'solid' ? 4 : 2}
                y={!item.shape.fillType || item.shape.fillType === 'solid' ? 7 : 5}
                width={!item.shape.fillType || item.shape.fillType === 'solid' ? 16 : 20}
                height={!item.shape.fillType || item.shape.fillType === 'solid' ? 10 : 14}
                fill={(() => {
                  if (item.shape.fillType === 'texture' || item.shape.fillType === 'hatch' || item.shape.fillType === 'hash') {
                    if (item.shape.fillTexture) {
                      return `url(#${item.shape.fillTexture}-scale-${item.shape.fillTextureScale || 1}-thick-${item.shape.fillTextureThickness || 1}-rot-${item.shape.hatchRotation || 0})`;
                    }
                  }
                  return item.shape.fill || "transparent";
                })()}
                stroke={item.shape.stroke || "#9CA3AF"}
                strokeWidth={0.6}
                rx={2}
                ry={2}
              />
            )}
            {item.shape.type === "ellipse" && (
              <ellipse
                cx={12}
                cy={12}
                rx={!item.shape.fillType || item.shape.fillType === 'solid' ? 8 : 10}
                ry={!item.shape.fillType || item.shape.fillType === 'solid' ? 9 : 11}
                fill={(() => {
                  if (item.shape.fillType === 'texture' || item.shape.fillType === 'hatch' || item.shape.fillType === 'hash') {
                    if (item.shape.fillTexture) {
                      return `url(#${item.shape.fillTexture}-scale-${item.shape.fillTextureScale || 1}-thick-${item.shape.fillTextureThickness || 1}-rot-${item.shape.hatchRotation || 0})`;
                    }
                  }
                  return item.shape.fill || "transparent";
                })()}
                stroke={item.shape.stroke || "#9CA3AF"}
                strokeWidth={0.6}
              />
            )}
            {item.shape.type === "line" && (
              <line
                x1={4}
                y1={12}
                x2={20}
                y2={12}
                stroke={item.shape.stroke || "#9CA3AF"}
                strokeWidth={1.5}
                strokeLinecap="round"
              />
            )}
            {item.shape.type === "polygon" && (
              <polygon
                points={(() => {
                  const sides =
                    item.shape.polygonSides ||
                    (item.shape.points ? item.shape.points.length : 4);
                  const s = Math.max(3, Math.min(12, sides || 4));
                  const cx = 12;
                  const cy = 12;
                  const r = !item.shape.fillType || item.shape.fillType === 'solid' ? 8 : 10;
                  const pts: string[] = [];
                  for (let i = 0; i < s; i++) {
                    const angle = ((Math.PI * 2) / s) * i - Math.PI / 2;
                    const x = cx + r * Math.cos(angle);
                    const y = cy + r * Math.sin(angle);
                    pts.push(`${x},${y}`);
                  }
                  return pts.join(" ");
                })()}
                fill={(() => {
                  if (item.shape.fillType === 'texture' || item.shape.fillType === 'hatch' || item.shape.fillType === 'hash') {
                    if (item.shape.fillTexture) {
                      return `url(#${item.shape.fillTexture}-scale-${item.shape.fillTextureScale || 1}-thick-${item.shape.fillTextureThickness || 1}-rot-${item.shape.hatchRotation || 0})`;
                    }
                  }
                  return item.shape.fill || "transparent";
                })()}
                stroke={item.shape.stroke || "#9CA3AF"}
                strokeWidth={0.6}
                strokeLinejoin="round"
              />
            )}
          </svg>
        )}
        {item.type === "Group" && (
          <svg width={24} height={24} viewBox="0 0 24 24">
            <rect x={4} y={4} width={7} height={7} rx={1.5} fill="#2563eb" fillOpacity={0.15} stroke="#2563eb" strokeWidth={1.2} />
            <rect x={13} y={4} width={7} height={7} rx={1.5} fill="#2563eb" fillOpacity={0.15} stroke="#2563eb" strokeWidth={1.2} />
            <rect x={4} y={13} width={7} height={7} rx={1.5} fill="#2563eb" fillOpacity={0.15} stroke="#2563eb" strokeWidth={1.2} />
            <rect x={13} y={13} width={7} height={7} rx={1.5} fill="#2563eb" fillOpacity={0.15} stroke="#2563eb" strokeWidth={1.2} />
          </svg>
        )}
        {item.type === "Wall" && (
          <svg width={24} height={24} viewBox="0 0 24 24">
            <rect
              x={4}
              y={8}
              width={16}
              height={8}
              fill={(() => {
                const w = (item as any).wall || item.wall;
                if (!w) return "#cbd5e1";
                if ((w.fillType === 'texture' || w.fillType === 'hatch' || w.fillType === 'hash') && w.fillTexture) {
                  return `url(#${w.fillTexture}-scale-${w.fillTextureScale || 1}-thick-${w.fillTextureThickness || 1}-rot-${w.hatchRotation || 0})`;
                }
                return w.fill || "#cbd5e1";
              })()}
              stroke={(item as any).wall?.stroke || item.wall?.stroke || "#94a3b8"}
              strokeWidth={0.6}
              rx={1}
            />
            <line x1={4} y1={12} x2={20} y2={12} stroke="currentColor" strokeWidth={0.5} strokeOpacity={0.3} />
          </svg>
        )}
        {item.type === "Text" && (
          <svg width={24} height={24} viewBox="0 0 24 24">
            <text
              x={12}
              y={14}
              textAnchor="middle"
              fontSize={12}
              fill="#111827"
              fontFamily="system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
            >
              T
            </text>
          </svg>
        )}
        {item.type === "Dimension" && (
          <svg width={24} height={24} viewBox="0 0 24 24">
            <line
              x1={4}
              y1={12}
              x2={20}
              y2={12}
              stroke={item.dimension?.color || "#111827"}
              strokeWidth={1}
              strokeLinecap="round"
            />
            <polyline
              points="6,10 4,12 6,14"
              fill="none"
              stroke={item.dimension?.color || "#111827"}
              strokeWidth={0.8}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <polyline
              points="18,10 20,12 18,14"
              fill="none"
              stroke={item.dimension?.color || "#111827"}
              strokeWidth={0.8}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
        {item.type === "Label" && (
          <svg width={24} height={24} viewBox="0 0 24 24">
            <line
              x1={6}
              y1={16}
              x2={18}
              y2={16}
              stroke={item.labelArrow?.color || "#111827"}
              strokeWidth={0.6}
              strokeLinecap="round"
            />
            <polyline
              points="16,14 18,16 16,18"
              fill="none"
              stroke={item.labelArrow?.color || "#111827"}
              strokeWidth={0.6}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <rect
              x={5}
              y={5}
              width={14}
              height={7}
              rx={2}
              ry={2}
              fill="#F3F4F6"
              stroke={item.labelArrow?.color || "#9CA3AF"}
              strokeWidth={0.8}
            />
          </svg>
        )}
      </div>
    );
  };

  const renderItemRow = (item: any, plClass = "px-3") => {
    const isAsset = item.type === "Asset";
    const childShapes = (item as any).childShapes as any[] | undefined;
    const hasChildren = isAsset && childShapes && childShapes.length > 0;
    const isExpanded = isAsset && expandedAssets[item.id];

    const itemChildIds = (item as any).childIds as string[] | undefined;
    const isSelected = itemChildIds
      ? itemChildIds.length > 0 && itemChildIds.every(cid => selectedIds.includes(cid))
      : selectedIds.includes(item.id);

    return (
      <div key={item.id} className={isSelected ? "bg-blue-50" : ""}>
        <button
          onClick={(e) =>
            isAsset && hasChildren
              ? setExpandedAssets(prev => ({ ...prev, [item.id]: !prev[item.id] }))
              : handleSelect({
                id: item.id,
                x: item.x,
                y: item.y,
                childIds: (item as any).childIds || (hasChildren ? childShapes.map(s => s.id) : undefined),
              }, e)
          }
          className={`w-full flex items-center gap-1.5 ${plClass} py-1.5 text-[11px] hover:bg-blue-100 border-b border-gray-100 transition-colors ${isSelected ? "text-blue-700 bg-blue-50 font-medium" : "text-gray-700 hover:bg-gray-100"}`}
        >
          {renderMiniPreview(item)}

          <div 
            className="flex-1 min-w-0 text-left" 
            onDoubleClick={(e) => {
              e.stopPropagation();
              setRenamingId(item.id);
              setRenamingText(item.label);
            }}
          >
            {renamingId === item.id ? (
              <input
                autoFocus
                className="w-full text-[11px] px-1 py-0.5 border border-blue-400 rounded outline-none bg-white"
                value={renamingText}
                onChange={(e) => setRenamingText(e.target.value)}
                onBlur={() => handleRename(item.id, renamingText, item.type)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleRename(item.id, renamingText, item.type);
                  if (e.key === 'Escape') setRenamingId(null);
                }}
                onClick={(e) => e.stopPropagation()}
              />
            ) : (
              <>
                <div className="truncate text-gray-700 leading-tight font-medium">{item.label}</div>
                <div className="text-[0.6rem] text-gray-400 mt-0.5">
                  {isAsset && hasChildren ? "Asset (exploded)" : item.type}
                </div>
              </>
            )}
          </div>
        </button>

        {isAsset && hasChildren && isExpanded && (
          <div className="ml-6 border-l border-gray-200">
            {childShapes!.map((s) => (
              <button
                key={s.id}
                onClick={(e) => handleSelect({ id: s.id, x: s.x, y: s.y }, e)}
                className="w-full flex items-center gap-1 px-1.5 py-1 text-[10px] hover:bg-gray-50 border-b border-gray-100"
              >
                <div className="w-5 h-5 rounded border border-gray-200 bg-white flex-shrink-0 overflow-hidden flex items-center justify-center">
                  <svg width={18} height={18} viewBox="0 0 24 24">
                    {s.type === "rectangle" && (
                      <rect
                        x={!s.fillType || s.fillType === 'solid' ? 4 : 2}
                        y={!s.fillType || s.fillType === 'solid' ? 7 : 5}
                        width={!s.fillType || s.fillType === 'solid' ? 16 : 20}
                        height={!s.fillType || s.fillType === 'solid' ? 10 : 14}
                        fill={(() => {
                          if (s.fillType === 'texture' || s.fillType === 'hatch' || s.fillType === 'hash') {
                            if (s.fillTexture) {
                              return `url(#${s.fillTexture}-scale-${s.fillTextureScale || 1}-thick-${s.fillTextureThickness || 1}-rot-${s.hatchRotation || 0})`;
                            }
                          }
                          return s.fill || "transparent";
                        })()}
                        stroke={s.stroke || "#9CA3AF"}
                        strokeWidth={1}
                        rx={1.5}
                        ry={1.5}
                      />
                    )}
                    {s.type === "ellipse" && (
                      <ellipse
                        cx={12}
                        cy={12}
                        rx={!s.fillType || s.fillType === 'solid' ? 8 : 10}
                        ry={!s.fillType || s.fillType === 'solid' ? 9 : 11}
                        fill={(() => {
                          if (s.fillType === 'texture' || s.fillType === 'hatch' || s.fillType === 'hash') {
                            if (s.fillTexture) {
                              return `url(#${s.fillTexture}-scale-${s.fillTextureScale || 1}-thick-${s.fillTextureThickness || 1}-rot-${s.hatchRotation || 0})`;
                            }
                          }
                          return s.fill || "transparent";
                        })()}
                        stroke={s.stroke || "#9CA3AF"}
                        strokeWidth={1}
                      />
                    )}
                    {s.type === "line" && (
                      <line
                        x1={4}
                        y1={12}
                        x2={20}
                        y2={12}
                        stroke={s.stroke || "#9CA3AF"}
                        strokeWidth={0.6}
                        strokeLinecap="round"
                      />
                    )}
                    {s.type === "polygon" && (
                      <polygon
                        points={(() => {
                          const sides =
                            s.polygonSides ||
                            (s.points ? s.points.length : 4);
                          const cnt = Math.max(3, Math.min(12, sides || 4));
                          const cx = 12;
                          const cy = 12;
                          const r = !s.fillType || s.fillType === 'solid' ? 8 : 10;
                          const pts: string[] = [];
                          for (let i = 0; i < cnt; i++) {
                            const angle = ((Math.PI * 2) / cnt) * i - Math.PI / 2;
                            const x = cx + r * Math.cos(angle);
                            const y = cy + r * Math.sin(angle);
                            pts.push(`${x},${y}`);
                          }
                          return pts.join(" ");
                        })()}
                        fill={(() => {
                          if (s.fillType === 'texture' || s.fillType === 'hatch' || s.fillType === 'hash') {
                            if (s.fillTexture) {
                              return `url(#${s.fillTexture}-scale-${s.fillTextureScale || 1}-thick-${s.fillTextureThickness || 1}-rot-${s.hatchRotation || 0})`;
                            }
                          }
                          return s.fill || "transparent";
                        })()}
                        stroke={s.stroke || "#9CA3AF"}
                        strokeWidth={1}
                        strokeLinejoin="round"
                      />
                    )}
                  </svg>
                </div>
                <div className="flex-1 text-left truncate ml-1">
                  <div className="truncate text-gray-500">{s.type}</div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    );
  };

  const renderItemGroup = (
    groupLabel: string,
    groupKey: string,
    groupItems: typeof items,
    expanded: Record<string, boolean>,
    setExpanded: React.Dispatch<React.SetStateAction<Record<string, boolean>>>
  ) => {
    if (groupItems.length === 0) return null;
    const isExpanded = expanded[groupKey] ?? true;
    return (
      <div key={groupKey} className="border-b border-gray-100">
        <button
          type="button"
          onClick={() => setExpanded(prev => ({ ...prev, [groupKey]: !isExpanded }))}
          className="flex w-full items-center justify-between px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--accent)] hover:bg-[var(--accent)]/5 transition-colors"
        >
          <span>{groupLabel}</span>
          <span className="flex items-center gap-2">
            <span className="rounded-full bg-[var(--accent)]/10 px-1.5 py-0.5 text-[9px] font-semibold tracking-normal text-[var(--accent)]">{groupItems.length}</span>
            <span className="text-xs text-gray-400">{isExpanded ? "▾" : "▸"}</span>
          </span>
        </button>
        {isExpanded && (
          <div>
            {groupItems.map((item) => renderItemRow(item, "pl-5"))}
          </div>
        )}
      </div>
    );
  };

  if (items.length === 0) {
    return (
      <div className="h-full flex items-center justify-center text-xs text-gray-400 px-3 text-center">
        No elements on the workspace yet
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Invisible SVG to host global pattern definitions for sidebar previews */}
      <svg width="0" height="0" className="absolute pointer-events-none">
        <TexturePatternDefs />
      </svg>
      <div className="p-3 border-b border-gray-100 flex items-center justify-between">
        Elements
      </div>
      <div
        className="flex-1 overflow-y-auto"
        onWheel={(e) => {
          // Stop wheel events from propagating to canvas zoom handlers
          e.stopPropagation();
        }}
      >
        {groupedElementItems.nonAssetItems.map((item) => renderItemRow(item, "px-3"))}
        {/* Groups section — collapsible */}
        {renderItemGroup('Groups', 'groups', groupedElementItems.groupItems, expandedAssetGroups, setExpandedAssetGroups)}
        {/* Venue section — shown first when a preloaded venue is on the canvas */}
        {groupedElementItems.venueItems.length > 0 && (() => {
          const isExpanded = expandedAssetGroups['venue'] ?? true;
          return (
            <div className="border-b border-gray-100">
              <button
                type="button"
                onClick={() => setExpandedAssetGroups(prev => ({ ...prev, venue: !isExpanded }))}
                className="flex w-full items-center justify-between px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--accent)] hover:bg-[var(--accent)]/5 transition-colors"
              >
                <span className="flex items-center gap-1.5">🏛️ Venue</span>
                <span className="flex items-center gap-2">
                  <span className="rounded-full bg-[var(--accent)]/10 px-1.5 py-0.5 text-[9px] font-semibold tracking-normal text-[var(--accent)]">{groupedElementItems.venueItems.length}</span>
                  <span className="text-xs text-gray-400">{isExpanded ? '▾' : '▸'}</span>
                </span>
              </button>
              {isExpanded && groupedElementItems.venueItems.map((item) => {
                const assetDef: any = item.type === 'Asset' && item.asset
                  ? (ASSET_LIBRARY.find(a => a.id === item.asset!.type) || PRELOADED_VENUES.find(v => v.id === item.asset!.type))
                  : null;
                const isSelected = selectedIds.includes(item.id);
                return (
                  <button
                    key={item.id}
                    onClick={(e) => handleSelect({ id: item.id, x: item.x, y: item.y }, e)}
                    className={`w-full flex items-center gap-1.5 px-2 py-2 text-[11px] border-b border-gray-100 transition-colors ${
                      isSelected ? 'text-indigo-700 bg-indigo-50 font-medium' : 'text-gray-700 hover:bg-indigo-50'
                    }`}
                  >
                    {/* SVG thumbnail */}
                    <div className="w-10 h-10 rounded border border-indigo-200 bg-white flex-shrink-0 overflow-hidden flex items-center justify-center p-0.5">
                      {assetDef?.path ? (
                        <InlineSvg
                          src={assetDef.path}
                          fill="none"
                          stroke="#4f46e5"
                          strokeWidth={0.5}
                          category={assetDef.category}
                        />
                      ) : (
                        <span className="text-[8px] text-indigo-400">SVG</span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0 text-left">
                      <div className="truncate font-medium text-indigo-700">{item.label}</div>
                      <div className="text-[0.6rem] text-indigo-400 mt-0.5">Venue</div>
                    </div>
                  </button>
                );
              })}
            </div>
          );
        })()}
        {renderItemGroup('Walls', 'walls', groupedElementItems.wallItems, expandedAssetGroups, setExpandedAssetGroups)}
        {renderItemGroup('Shapes', 'shapes', groupedElementItems.shapeItems, expandedAssetGroups, setExpandedAssetGroups)}

        {assetGroupOrder.map((groupKey) => {
          const groupItems = groupedElementItems.assetBuckets[groupKey] || [];
          if (groupItems.length === 0) return null;

          const isExpanded = expandedAssetGroups[groupKey] ?? false;

          return (
            <div key={groupKey} className="border-b border-gray-100">
              <button
                type="button"
                onClick={() =>
                  setExpandedAssetGroups((prev) => ({
                    ...prev,
                    [groupKey]: !isExpanded,
                  }))
                }
                className="flex w-full items-center justify-between px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--accent)] hover:bg-[var(--accent)]/5 transition-colors"
              >
                <span>{assetGroupLabels[groupKey] || groupKey}</span>
                <span className="flex items-center gap-2">
                  <span className="rounded-full bg-[var(--accent)]/10 px-1.5 py-0.5 text-[9px] font-semibold tracking-normal text-[var(--accent)]">
                    {groupItems.length}
                  </span>
                  <span className="text-xs text-gray-400">{isExpanded ? "▾" : "▸"}</span>
                </span>
              </button>

              {isExpanded && (
                <div>
                  {groupItems.map((item) => {
                    const assetDef: any = item.type === "Asset" && item.asset
                      ? (ASSET_LIBRARY.find(a => a.id === item.asset.type) || PRELOADED_VENUES.find(v => v.id === item.asset.type))
                      : null;

                    const isAsset = item.type === "Asset";
                    const childShapes = (item as any).childShapes as any[] | undefined;
                    const hasChildren = isAsset && childShapes && childShapes.length > 0;
                    const isExpanded = isAsset && expandedAssets[item.id];

                    const itemChildIds = (item as any).childIds as string[] | undefined;
                    const isSelected = itemChildIds
                      ? itemChildIds.length > 0 && itemChildIds.every(cid => selectedIds.includes(cid))
                      : selectedIds.includes(item.id);

                    return (
                      <div key={item.id} className={isSelected ? "bg-blue-50" : ""}>
                        <button
                          onClick={(e) =>
                            isAsset && hasChildren
                              ? setExpandedAssets(prev => ({ ...prev, [item.id]: !prev[item.id] }))
                              : handleSelect({
                                id: item.id,
                                x: item.x,
                                y: item.y,
                                childIds: (item as any).childIds || (hasChildren ? childShapes.map(s => s.id) : undefined),
                              }, e)
                          }
                          className={`w-full flex items-center gap-1 px-1.5 py-1.5 pl-3 text-[11px] hover:bg-blue-100 border-t border-gray-100 transition-colors ${isSelected ? "text-blue-700 bg-blue-50 font-medium" : "text-gray-700 hover:bg-gray-100"}`}
                        >
                          <div className="w-7 h-7 rounded border border-gray-200 bg-white flex-shrink-0 overflow-hidden flex items-center justify-center">
                            {item.type === "Asset" && item.asset && (
                              assetDef?.path ? (
                                <div className="w-full h-full p-1">
                                  <InlineSvg
                                    src={assetDef.path}
                                    fill={item.asset.tableColor || item.asset.chairColor || item.asset.fillColor || (item.asset as any).fill || "none"}
                                    stroke={item.asset.strokeColor || (item.asset as any).stroke || "currentColor"}
                                    strokeWidth={0.6}
                                    category={assetDef.category}
                                  />
                                </div>
                              ) : (
                                <div className="text-[8px] text-gray-400 text-center px-1">
                                  {item.asset.type}
                                </div>
                              )
                            )}
                          </div>

                          <div
                            className="flex-1 min-w-0"
                            onDoubleClick={(e) => {
                              e.stopPropagation();
                              setRenamingId(item.id);
                              setRenamingText(item.label);
                            }}
                          >
                            {renamingId === item.id ? (
                              <input
                                autoFocus
                                className="w-full text-[11px] px-1 py-0.5 border border-blue-400 rounded outline-none"
                                value={renamingText}
                                onChange={(e) => setRenamingText(e.target.value)}
                                onBlur={() => handleRename(item.id, renamingText, item.type)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') handleRename(item.id, renamingText, item.type);
                                  if (e.key === 'Escape') setRenamingId(null);
                                }}
                                onClick={(e) => e.stopPropagation()}
                              />
                            ) : (
                              <>
                                <div className="truncate text-gray-700 leading-tight">{item.label}</div>
                                <div className="text-[0.6rem] text-gray-400 mt-0.5">
                                  {isAsset && hasChildren ? "Asset (exploded)" : item.type}
                                </div>
                              </>
                            )}
                          </div>
                        </button>

                        {isAsset && hasChildren && isExpanded && (
                          <div className="ml-6 border-l border-gray-200">
                            {childShapes!.map((s) => (
                              <button
                                key={s.id}
                                onClick={(e) => handleSelect({ id: s.id, x: s.x, y: s.y }, e)}
                                className="w-full flex items-center gap-1 px-1.5 py-1 text-[10px] hover:bg-gray-50 border-b border-gray-100"
                              >
                                <div className="w-5 h-5 rounded border border-gray-200 bg-white flex-shrink-0 overflow-hidden flex items-center justify-center">
                                  <svg width={18} height={18} viewBox="0 0 24 24">
                                    {s.type === "rectangle" && (
                                      <rect
                                        x={!s.fillType || s.fillType === 'solid' ? 4 : 2}
                                        y={!s.fillType || s.fillType === 'solid' ? 7 : 5}
                                        width={!s.fillType || s.fillType === 'solid' ? 16 : 20}
                                        height={!s.fillType || s.fillType === 'solid' ? 10 : 14}
                                        fill={(() => {
                                          if (s.fillType === 'texture' || s.fillType === 'hatch' || s.fillType === 'hash') {
                                            if (s.fillTexture) {
                                              return `url(#${s.fillTexture}-scale-${s.fillTextureScale || 1}-thick-${s.fillTextureThickness || 1}-rot-${s.hatchRotation || 0})`;
                                            }
                                          }
                                          return s.fill || "transparent";
                                        })()}
                                        stroke={s.stroke || "#9CA3AF"}
                                        strokeWidth={1}
                                        rx={1.5}
                                        ry={1.5}
                                      />
                                    )}
                                    {s.type === "ellipse" && (
                                      <ellipse
                                        cx={12}
                                        cy={12}
                                        rx={!s.fillType || s.fillType === 'solid' ? 8 : 10}
                                        ry={!s.fillType || s.fillType === 'solid' ? 9 : 11}
                                        fill={(() => {
                                          if (s.fillType === 'texture' || s.fillType === 'hatch' || s.fillType === 'hash') {
                                            if (s.fillTexture) {
                                              return `url(#${s.fillTexture}-scale-${s.fillTextureScale || 1}-thick-${s.fillTextureThickness || 1}-rot-${s.hatchRotation || 0})`;
                                            }
                                          }
                                          return s.fill || "transparent";
                                        })()}
                                        stroke={s.stroke || "#9CA3AF"}
                                        strokeWidth={1}
                                      />
                                    )}
                                    {s.type === "line" && (
                                      <line
                                        x1={4}
                                        y1={12}
                                        x2={20}
                                        y2={12}
                                        stroke={s.stroke || "#9CA3AF"}
                                        strokeWidth={0.6}
                                        strokeLinecap="round"
                                      />
                                    )}
                                    {s.type === "polygon" && (
                                      <polygon
                                        points={(() => {
                                          const sides =
                                            s.polygonSides ||
                                            (s.points ? s.points.length : 4);
                                          const cnt = Math.max(3, Math.min(12, sides || 4));
                                          const cx = 12;
                                          const cy = 12;
                                          const r = !s.fillType || s.fillType === 'solid' ? 8 : 10;
                                          const pts: string[] = [];
                                          for (let i = 0; i < cnt; i++) {
                                            const angle = ((Math.PI * 2) / cnt) * i - Math.PI / 2;
                                            const x = cx + r * Math.cos(angle);
                                            const y = cy + r * Math.sin(angle);
                                            pts.push(`${x},${y}`);
                                          }
                                          return pts.join(" ");
                                        })()}
                                        fill={(() => {
                                          if (s.fillType === 'texture' || s.fillType === 'hatch' || s.fillType === 'hash') {
                                            if (s.fillTexture) {
                                              return `url(#${s.fillTexture}-scale-${s.fillTextureScale || 1}-thick-${s.fillTextureThickness || 1}-rot-${s.hatchRotation || 0})`;
                                            }
                                          }
                                          return s.fill || "transparent";
                                        })()}
                                        stroke={s.stroke || "#9CA3AF"}
                                        strokeWidth={1}
                                        strokeLinejoin="round"
                                      />
                                    )}
                                  </svg>
                                </div>
                                <div className="flex-1 text-left truncate">
                                  <div className="truncate">{s.type}</div>
                                </div>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
      <div className="border-t border-gray-100 bg-gray-50 px-3 py-2">
        <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-gray-500">
          Totals Inside Walls
        </div>
        {assetSummary.length > 0 ? (
          <div className="mt-1 flex flex-wrap gap-1.5">
            {assetSummary.map((entry) => (
              <div
                key={entry.label}
                className="rounded-full border border-gray-200 bg-white px-2 py-1 text-[10px] text-gray-700"
              >
                {entry.count} {entry.label}
              </div>
            ))}
          </div>
        ) : (
          <div className="mt-1 text-[10px] text-gray-400">
            No counted furniture assets inside the walls yet
          </div>
        )}
      </div>
    </div>
  );
}

// Type for the payload we send to the API
type UpdateEventPayload = {
  name: string;
  type?: string;
  canvases: CanvasData[];
  canvasAssets: AssetInstance[];
  canvasData?: {
    walls: any[];
    shapes: any[];
    assets: any[];
    layers?: any[];
    canvas?: any;
  };
};

const normalizeLegacyWallStroke = (...values: Array<string | undefined | null>) => {
  const stroke = values.find((value) => value && value !== 'none');
  return stroke?.toUpperCase() === '#1E40AF' ? '#1f2937' : (stroke || '#1f2937');
};

const normalizeEventComments = (rawComments: any[] = []) =>
  rawComments
    .filter(Boolean)
    .map((comment: any) => {
      const currentUser = useUserStore.getState().user;
      const currentUserName =
        currentUser
          ? `${currentUser.firstName || ''} ${currentUser.lastName || ''}`.trim() || currentUser.email || currentUser._id
          : null;
      const author =
        comment.author ||
        (comment.userId && currentUser && comment.userId === currentUser._id ? currentUserName : null) ||
        comment.userId ||
        'Unknown';
      return {
        id: String(comment.id || comment._id || crypto.randomUUID()),
        x: Number(comment.x || 0),
        y: Number(comment.y || 0),
        content: String(comment.content ?? comment.text ?? ''),
        author: String(author),
        timestamp: comment.timestamp
          ? Number(comment.timestamp)
          : comment.createdAt
            ? new Date(comment.createdAt).getTime()
            : Date.now(),
        resolved: Boolean(comment.resolved),
        color: comment.color,
        userId: comment.userId,
        createdAt: comment.createdAt,
      };
    });

const LOCAL_DRAFT_VERSION = 1;

type LocalWorkspaceDraft = {
  version: number;
  eventId: string;
  slug: string;
  savedAt: number;
  data: {
    canvas: any;
    walls: any[];
    wallSegments: any[];
    shapes: any[];
    assets: any[];
    layers: any[];
    dimensions: any[];
    textAnnotations: any[];
    labelArrows: any[];
    groups: any[];
    activeLayerId: string | null;
    comments: any[];
  };
};

const getLocalDraftKey = (slug: string, eventId: string) =>
  `esp-workspace-draft:${slug}:${eventId}`;

export default function Editor() {
  const [showAssetsModal, setShowAssetsModal] = useState(false);
  const [show3D, setShow3D] = useState(false);
  const [isInIframe, setIsInIframe] = useState(false);
  const router = useRouter();
  // Not `router.query`: on a cold load of this dynamic route the router never
  // becomes ready on this deployment, so the query stays empty and the event
  // fetch below never fires — a refresh or a shared link rendered
  // "No event data found" over a perfectly good event. See hooks/useRouteParams.
  const { params: routeParams, isReady: isRouterReady } = useRouteParams();
  const { slug, id, preview, aiMode } = routeParams as {
    slug?: string; id?: string; preview?: string; aiMode?: string;
  };
  const queryClient = useQueryClient();

  // Allow the AI assistant to open the asset library via a window event
  useEffect(() => {
    const openAssets = () => setShowAssetsModal(true);
    window.addEventListener("esp-open-assets", openAssets);
    return () => window.removeEventListener("esp-open-assets", openAssets);
  }, []);

  // Open AI modal if aiMode is set
  useEffect(() => {
    if (aiMode === 'true' && typeof window !== 'undefined') {
      // Retry mechanism to ensure AiTrigger is mounted
      let attempts = 0;
      const maxAttempts = 10;
      const tryOpenAI = () => {
        attempts++;
        try {
          const openAI = (window as any).__ESP_OPEN_AI_CHAT__;
          if (openAI && typeof openAI === 'function') {
            openAI();
            // Clear the query parameter after opening
            router.replace({
              pathname: router.pathname,
              query: { ...router.query, aiMode: undefined }
            }, undefined, { shallow: true });
          } else if (attempts < maxAttempts) {
            // Retry after 200ms if not ready
            setTimeout(tryOpenAI, 200);
          }
        } catch (e) {
          console.warn('Could not open AI chat:', e);
        }
      };
      // Start trying after a short delay
      setTimeout(tryOpenAI, 300);
    }
  }, [aiMode, router]);


  // Detect if we're in an iframe or preview mode
  useEffect(() => {
    setIsInIframe(window.self !== window.top || preview === 'true');
  }, [preview]);

  // New stores
  const setZoom = useEditorStore(s => s.setZoom);
  const setPan = useEditorStore(s => s.setPan);
  const isReadOnly = useEditorStore(s => s.isReadOnly);
  const projectAssets = useProjectStore(s => s.assets);
  const walls = useProjectStore(s => s.walls);
  const shapes = useProjectStore(s => s.shapes);
  const sceneAssets = useSceneStore((s) => s.assets);

  // Old scene store methods (for compatibility)
  const hasUnsavedChanges = useSceneStore((s) => s.hasUnsavedChanges);
  const projectHasUnsavedChanges = useProjectStore((s) => s.hasUnsavedChanges);

  // Auto-save backup with 30s interval + online/offline queuing
  const autoSave = useAutoSave({ interval: 30000, enabled: true });
  const sceneHistoryIndex = useSceneStore((s) => s.historyIndex);
  const projectHistoryIndex = useProjectStore((s: any) => s.historyIndex);
  const syncToEventData = useSceneStore((s) => s.syncToEventData);
  const markAsSaved = useSceneStore((s) => s.markAsSaved);

  // Local state for current event data
  const [currentEventData, setCurrentEventData] = useState<EventData | null>(
    null
  );

  const {
    data: eventData,
    isLoading,
    error,
    refetch,
  } = useQuery<EventData>({
    queryKey: ["event", slug, id],
    queryFn: async () => {
      const eventSlug = slug as string;
      const eventId = id as string;
      console.log(`[Editor] Fetching event from DATABASE: ${eventSlug}/${eventId}`);
      const response = await apiRequest(`/projects/${eventSlug}/events/${eventId}`, "GET", null, true);
      // apiRequest may return data directly or wrapped in response.data
      const data = (response.data || response) as EventData;
      const receivedId = data._id || (data as any).id;
      console.log(`[Editor] Received event data from DATABASE:`, {
        requestedId: eventId,
        receivedId,
        name: data.name,
        hasCanvasData: !!data.canvasData,
        canvasDataWalls: data.canvasData?.walls?.length || 0,
        canvasDataShapes: data.canvasData?.shapes?.length || 0,
        canvasDataAssets: data.canvasData?.assets?.length || 0,
      });

      // `canvasAssets` comes back in one of two shapes. The collaboration
      // flush writes the keyed collection object
      // ({ yShapes: { id: shape }, ... }); the older REST save wrote a flat
      // array. Every load path below is written against the array — PRIORITY 2
      // is literally guarded by `Array.isArray` — so an event that had been
      // edited collaboratively hit neither branch and the editor opened blank
      // on a canvas mongo was holding perfectly well.
      //
      // Normalise it into `canvasData` here, so PRIORITY 1 loads it with the
      // code that already exists. A real `canvasData` from the server always
      // wins; this only fills the gap.
      if (isCollaborationCanvasShape(data.canvasAssets)) {
        const normalized = canvasDataFromCollaborationAssets(data.canvasAssets);
        const serverCanvasData = data.canvasData as any;
        const serverHasContent =
          !!serverCanvasData &&
          [
            serverCanvasData.walls,
            serverCanvasData.shapes,
            serverCanvasData.assets,
            serverCanvasData.textAnnotations,
            serverCanvasData.dimensions,
            serverCanvasData.labelArrows,
          ].some((collection) => Array.isArray(collection) && collection.length > 0);

        if (!serverHasContent && hasCanvasContent(normalized)) {
          console.log("[Editor] Rebuilt canvasData from collaboration canvasAssets:", {
            walls: normalized.walls.length,
            shapes: normalized.shapes.length,
            assets: normalized.assets.length,
          });
          (data as any).canvasData = {
            ...(serverCanvasData || {}),
            ...normalized,
            canvas: normalized.canvas || serverCanvasData?.canvas,
          };
        }

        // The preview and card components downstream still expect an array.
        (data as any).canvasAssets = flattenCanvasAssets(data.canvasAssets);
      }

      return data;
    },
    enabled: !!(isRouterReady && slug && id), // Only enable when router is ready
    staleTime: 0, // Always refetch when route changes
    gcTime: 0, // Don't cache (formerly cacheTime)
    refetchOnMount: true, // Always refetch when component mounts
    refetchOnWindowFocus: false, // Don't refetch on window focus
    refetchInterval: false, // Don't auto-refetch periodically
  });

  // Track if we just saved to prevent reloading
  const justSavedRef = useRef(false);
  const restoredLocalDraftRef = useRef<string | null>(null);
  const isAutoSavingRef = useRef(false);
  const pendingAutoSaveRef = useRef(false);
  const lastSavedProjectHistoryRef = useRef<number | null>(null);
  const lastSavedSceneHistoryRef = useRef<number | null>(null);

  const writeLocalWorkspaceDraft = useCallback(() => {
    if (typeof window === "undefined" || !id || !slug || typeof id !== "string" || typeof slug !== "string") return;

    try {
      const projectState = useProjectStore.getState();
      const sceneState = useSceneStore.getState();
      const sceneAssetsById = new Map(sceneState.assets.map((sceneAsset) => [sceneAsset.id, sceneAsset]));
      const mergedAssets = projectState.assets.map((asset) => {
        const sceneAsset = sceneAssetsById.get(asset.id);
        return sceneAsset ? { ...asset, ...sceneAsset } : asset;
      });

      const draft: LocalWorkspaceDraft = {
        version: LOCAL_DRAFT_VERSION,
        eventId: id,
        slug,
        savedAt: Date.now(),
        data: {
          canvas: projectState.canvas,
          walls: projectState.walls,
          wallSegments: projectState.wallSegments,
          shapes: projectState.shapes,
          assets: mergedAssets,
          layers: projectState.layers,
          dimensions: projectState.dimensions,
          textAnnotations: projectState.textAnnotations,
          labelArrows: projectState.labelArrows,
          groups: projectState.groups,
          activeLayerId: projectState.activeLayerId,
          comments: projectState.comments,
        },
      };

      window.localStorage.setItem(getLocalDraftKey(slug, id), JSON.stringify(draft));
    } catch (error) {
      console.warn("[Editor] Failed to write local workspace draft", error);
    }
  }, [id, slug]);

  const clearLocalWorkspaceDraft = useCallback(() => {
    if (typeof window === "undefined" || !id || !slug || typeof id !== "string" || typeof slug !== "string") return;
    try {
      window.localStorage.removeItem(getLocalDraftKey(slug, id));
    } catch (error) {
      console.warn("[Editor] Failed to clear local workspace draft", error);
    }
  }, [id, slug]);

  // Mutation to save canvas assets
  const saveCanvasAssets = useMutation({
    mutationFn: async (
      payload: UpdateEventPayload | { canvasAssets: AssetInstance[] }
    ) => {
      console.log('[Editor] Saving to DATABASE...', { id, slug });
      return apiRequest(`/projects/${slug}/events/${id}`, "PUT", payload, true);
    },
    onSuccess: (savedData) => {
      console.log('[Editor] ✅ Saved successfully to DATABASE');
      markAsSaved();
      clearLocalWorkspaceDraft();
      // Mark that we just saved to prevent reloading
      justSavedRef.current = true;
      // Update current event data but don't reload workspace
      setCurrentEventData(savedData);
      // Reset the flag after a short delay
      setTimeout(() => {
        justSavedRef.current = false;
      }, 1000);
    },
    onError: (error) => {
      console.error("[Editor] ❌ Failed to save canvas assets:", error);
      justSavedRef.current = false;
    },
  });

  // Handle texture query param for outdoor events
  useEffect(() => {
    // Only run if we have the router ready, a texture param, and fully loaded AND SYNCED event data
    if (isRouterReady && routeParams.texture && currentEventData) {
      // Ensure the synced event matches the current route ID
      const routeId = routeParams.id as string;
      const currentId = currentEventData._id || (currentEventData as any).id;

      if (currentId !== routeId) {
        console.log('[Editor] Waiting for event data sync...', { routeId, currentId });
        return;
      }

      const textureParam = routeParams.texture;
      const textureId = Array.isArray(textureParam) ? textureParam[0] : textureParam;

      if (!textureId) return;

      const bgId = "background-texture";
      const projectStore = useProjectStore.getState();

      // Check if background already exists
      const existingBg = projectStore.shapes.find(s => s.id === bgId);

      // Get dimensions from currentEventData
      const canvas = currentEventData.canvasData?.canvas || currentEventData.canvases?.[0];
      const width = canvas?.width || 10000;
      const height = canvas?.height || 10000;

      console.log(`[Editor] Applying texture ${textureId} to event ${currentId} with dims ${width}x${height}`);

      if (existingBg) {
        console.log(`[Editor] Updating existing background texture to: ${textureId}`);
        projectStore.updateShape(bgId, {
          width: width,
          height: height,
          x: width / 2,
          y: height / 2,
          fill: `url(#${textureId})`,
          fillType: 'texture',
          fillTexture: textureId
        });
        toast.success(`Updated environment to ${textureId}`);
      } else {
        console.log(`[Editor] Applying new background texture: ${textureId}`);
        projectStore.addShape({
          id: bgId,
          type: "rectangle",
          x: width / 2,
          y: height / 2,
          width: width,
          height: height,
          fill: `url(#${textureId})`,
          fillType: 'texture',
          fillTexture: textureId,
          stroke: "none",
          strokeWidth: 0,
          rotation: 0,
          zIndex: -100,
          points: []
        });
        toast.success(`Applied ${textureId} environment`);

        // Log the shapes after addition to verify
        const newStore = useProjectStore.getState();
        console.log('[Editor] Shapes after addition:', newStore.shapes.map(s => s.id));


      }
    }
  }, [isRouterReady, routeParams, router, currentEventData]);
 
  // Handle marqueeId query param
  useEffect(() => {
    if (isRouterReady && routeParams.marqueeId && currentEventData) {
      const routeId = routeParams.id as string;
      const currentId = currentEventData._id || (currentEventData as any).id;
 
      if (currentId !== routeId) return;
 
      const marqueeId = Array.isArray(routeParams.marqueeId) ? routeParams.marqueeId[0] : routeParams.marqueeId;
      if (!marqueeId) return;

      const projectStore = useProjectStore.getState();
      
      // Check if marquee already exists by checking if any asset has this marquee ID as its type
      const existingMarquee = projectStore.assets.find(a => a.type === marqueeId);
      
      if (!existingMarquee) {
        console.log(`[Editor] Marquee missing from workspace! Force-loading: ${marqueeId}`);
        const canvas = currentEventData.canvasData?.canvas || currentEventData.canvases?.[0];
        const width = canvas?.width || 10000;
        const height = canvas?.height || 10000;

        // Find marquee dimensions from ASSET_LIBRARY
        const marqueeDef = ASSET_LIBRARY.find(a => a.id === marqueeId);
        const marqueeWidth = marqueeDef?.width || 10000;
        const marqueeHeight = marqueeDef?.height || 10000;

        projectStore.addAsset({
          id: `marquee-${Date.now()}`,
          name: 'Marquee',
          type: marqueeId,
          x: width / 2,
          y: height / 2,
          width: marqueeWidth,
          height: marqueeHeight,
          rotation: 0,
          scale: 1,
          zIndex: 1
        });
        
        toast.success(`Loaded marquee: ${marqueeDef?.label || marqueeId}`);
      }
    }
  }, [isRouterReady, routeParams, currentEventData]);




  // Handle preloadedVenue query param - force-inject the venue asset if missing
  useEffect(() => {
    if (isRouterReady && routeParams.preloadedVenue && currentEventData) {
      const routeId = routeParams.id as string;
      const currentId = currentEventData._id || (currentEventData as any).id;

      if (currentId !== routeId) return;

      const venueId = Array.isArray(routeParams.preloadedVenue)
        ? routeParams.preloadedVenue[0]
        : routeParams.preloadedVenue;
      if (!venueId) return;

      const venueDef = PRELOADED_VENUE_MAP.get(venueId);
      if (!venueDef) {
        console.warn(`[Editor] Unknown preloaded venue: ${venueId}`);
        return;
      }

      // If user has explicitly deleted this venue from this event, don't force load it again on refresh
      const storageKey = `preloaded-venue-loaded-${currentId}-${venueId}`;
      if (typeof window !== 'undefined' && window.localStorage.getItem(storageKey) === 'deleted') {
        console.log(`[Editor] Venue was explicitly deleted by the user. Skipping auto-preload.`);
        return;
      }

      const projectStore = useProjectStore.getState();

      // Check if venue already exists in workspace
      const existingVenue = projectStore.assets.find(a => a.type === venueId);

      if (!existingVenue) {
        console.log(`[Editor] Venue missing from workspace! Force-loading: ${venueId}`);

        const canvas = currentEventData.canvasData?.canvas || currentEventData.canvases?.[0];
        const canvasW = canvas?.width || (venueDef.width + 4000);
        const canvasH = canvas?.height || (venueDef.height + 4000);

        const assetId = `venue-${Date.now()}`;
        projectStore.addAsset({
          id: assetId,
          name: venueDef.name,
          type: venueId,
          x: canvasW / 2,
          y: canvasH / 2,
          width: venueDef.width,
          height: venueDef.height,
          rotation: 0,
          scale: 1,
          zIndex: 0,
        });

        if (typeof window !== 'undefined') {
          window.localStorage.setItem(storageKey, 'loaded');
        }

        console.log(`[Editor] ✅ Force-loaded venue: ${venueDef.name}`);

        // Auto-pan/zoom to show the venue
        setTimeout(() => {
          if (typeof window === 'undefined') return;
          const viewportW = window.innerWidth - 300;
          const viewportH = window.innerHeight - 150;
          const zoomX = viewportW / venueDef.width;
          const zoomY = viewportH / venueDef.height;
          const finalZoom = Math.max(0.002, Math.min(zoomX, zoomY) * 0.85);
          useEditorStore.getState().setZoom(finalZoom);
          const panX = viewportW / 2 + 150 - (canvasW / 2) * finalZoom;
          const panY = viewportH / 2 + 75 - (canvasH / 2) * finalZoom;
          useEditorStore.getState().setPan(panX, panY);
        }, 300);
      }
    }
  }, [isRouterReady, routeParams, currentEventData]);



  // Reset currentEventData when route changes to ensure new event loads
  const prevEventIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (isRouterReady && id && slug) {
      const eventId = id as string;
      const eventSlug = slug as string;

      // If navigating to a DIFFERENT event, full clear
      if (prevEventIdRef.current && prevEventIdRef.current !== eventId) {
        console.log(`[Editor] Navigating from ${prevEventIdRef.current} to ${eventId}, clearing workspace`);
        const projectStore = useProjectStore.getState();
        projectStore.reset();
        projectStore.clearWorkspace();
      } else if (!prevEventIdRef.current) {
        // First load / page refresh — clear stale persisted data but don't clearWorkspace
        // (clearWorkspace is slow and unnecessary on first load since data loading effect handles it)
        console.log(`[Editor] First load for ${eventId}, resetting project store`);
        const projectStore = useProjectStore.getState();
        projectStore.reset();
      }
      prevEventIdRef.current = eventId;

      console.log(`[Editor] Route changed to: ${eventSlug}/${eventId}`);

      // Clear current event data so the data loading effect triggers
      setCurrentEventData(null);

      // Clear the query cache for this specific event to force fresh fetch
      queryClient.removeQueries({ queryKey: ["event", eventSlug, eventId] });

      // Invalidate and refetch the query to ensure fresh data from database
      queryClient.invalidateQueries({ queryKey: ["event", eventSlug, eventId] });
    }
  }, [isRouterReady, id, slug, queryClient]);

  // Set current event data when loaded and sync to stores
  useEffect(() => {
    // CRITICAL: Don't reload if we just saved - this prevents clearing newly drawn elements
    if (justSavedRef.current) {
      console.log('[Editor] Skipping reload - we just saved');
      return;
    }

    // Only load if we have new event data and it's actually different (by ID)
    // This prevents clearing workspace when React Query refetches the same event
    if (eventData && id) {
      const eventId = eventData._id || (eventData as any).id;
      const requestedId = id as string;
      const currentId = currentEventData?._id || (currentEventData as any)?.id;

      // CRITICAL: Verify we're loading the correct event
      if (eventId !== requestedId) {
        console.error(`[Editor] MISMATCH! Requested event ${requestedId} but received ${eventId}`);
        return;
      }

      // CRITICAL: Only load if it's a different event OR if we don't have current event data yet
      // Don't reload if it's the same event and we already have data (prevents clearing on refetch)
      // Also check if we just saved to prevent clearing newly drawn elements
      const shouldLoad = !currentEventData || currentId !== eventId;

      if (shouldLoad && !justSavedRef.current) {
        console.log(`[Editor] Loading NEW event from DATABASE: ${eventId} (previous: ${currentId})`);
        setCurrentEventData(eventData);
        const normalizedComments = normalizeEventComments(eventData.comments || eventData.canvasData?.comments || []);

        // Load event data into stores for Workspace2D
        const projectStore = useProjectStore.getState();
        const sceneStore = useSceneStore.getState();

        // Always clear workspace when loading a different event to prevent localStorage pollution
        const isDifferentEvent = !currentId || currentId !== eventId;

        if (isDifferentEvent) {
          console.log(`[Editor] Clearing workspace before loading event ${eventId}`);
          projectStore.reset();
          projectStore.clearWorkspace();
          projectStore.setProjectName(eventData.name);
        }

        const hasCanvasDataWorkspaceItems = !!eventData.canvasData && [
          eventData.canvasData.walls,
          eventData.canvasData.shapes,
          eventData.canvasData.assets,
          eventData.canvasData.textAnnotations,
          eventData.canvasData.dimensions,
          eventData.canvasData.labelArrows,
        ].some((collection) => Array.isArray(collection) && collection.length > 0);

        // PRIORITY 1: Load from canvasData (preferred format from DATABASE).
        // If an older backend response has an empty canvasData object but populated
        // canvasAssets, fall through so dimensions/arrows/walls can still restore.
        if (eventData.canvasData && (hasCanvasDataWorkspaceItems || !eventData.canvasAssets?.length)) {
          const {
            walls = [],
            shapes = [],
            assets = [],
            textAnnotations = [],
            dimensions = [],
            labelArrows = []
          } = eventData.canvasData;

          console.log(`[Editor] Loading canvasData from DATABASE:`, {
            walls: walls.length,
            shapes: shapes.length,
            assets: assets.length,
            textAnnotations: textAnnotations.length,
            dimensions: dimensions.length,
            labelArrows: labelArrows.length,
          });

          // Always load from DATABASE when opening an event
          if (isDifferentEvent) {
            walls.forEach((wall: any) => {
              console.log(`[Editor] Adding wall:`, wall.id);
              projectStore.addWall({
                ...wall,
                stroke: normalizeLegacyWallStroke(wall.stroke, wall.strokeColor),
                strokeWidth: wall.strokeWidth ?? 2,
              }, true);
            });
            shapes.forEach((shape: any) => {
              console.log(`[Editor] Adding shape:`, shape.id, shape.type);
              projectStore.addShape(shape, true);
            });
            assets.forEach((asset: any) => {
              console.log(`[Editor] Adding asset:`, asset.id, asset.type);
              projectStore.addAsset(asset, true);
            });
            textAnnotations.forEach((annotation: any) => {
              console.log(`[Editor] Adding text annotation:`, annotation.id);
              projectStore.addTextAnnotation(annotation, true);
            });
            dimensions.forEach((dimension: any) => {
              console.log(`[Editor] Adding dimension:`, dimension.id);
              projectStore.addDimension(dimension, true);
            });
            labelArrows.forEach((arrow: any) => {
              projectStore.addLabelArrow(arrow, true);
            });
            useProjectStore.setState((state) => ({
              ...state,
              comments: normalizedComments,
            }));
            // DEBUG: Verify store state immediately after canvasData load
            const verifyAfterCanvasData = useProjectStore.getState();
            console.log('[Editor] DEBUG verify-after-canvasData-load:', {
              shapes: verifyAfterCanvasData.shapes.length,
              assets: verifyAfterCanvasData.assets.length,
              walls: verifyAfterCanvasData.walls.length,
              shapeIds: verifyAfterCanvasData.shapes.map(s => s.id),
            });
            projectStore.markAsSaved();

            // DEFAULT OUTDOOR LAYOUT if empty
            if (eventData.type === 'Outdoor Venue' && shapes.length === 0 && walls.length === 0 && assets.length === 0) {
              const textureId = (routeParams.texture as string) || 'sand-01';
              const canvas = eventData.canvasData?.canvas || eventData.canvases?.[0];
              const width = canvas?.width || 10000;
              const height = canvas?.height || 10000;

              console.log(`[Editor] Applying fallback outdoor layout (texture: ${textureId})`);
              const backgroundName = textureId === 'sand-01' ? 'Beach Layout' : 'Grass Layout';
              projectStore.addShape({
                id: "background-texture",
                name: backgroundName,
                type: "rectangle",
                x: width / 2,
                y: height / 2,
                width: width,
                height: height,
                fill: `url(#${textureId})`,
                fillType: 'texture',
                fillTexture: textureId,
                stroke: "none",
                strokeWidth: 0,
                rotation: 0,
                zIndex: -100,
                points: []
              }, true);
            }

            console.log(`[Editor] ✅ Loaded ${walls.length} walls, ${shapes.length} shapes, ${assets.length} assets from DATABASE`);
          }
        }
        // PRIORITY 2: Fallback to canvasAssets (most events use this format)
        else if (eventData.canvasAssets && Array.isArray(eventData.canvasAssets) && eventData.canvasAssets.length > 0) {
          console.log(`[Editor] Loading from canvasAssets for event ${eventId} from DATABASE:`, {
            canvasAssetsCount: eventData.canvasAssets.length,
            assetTypes: eventData.canvasAssets.map((a: any) => a.type),
          });

          // Categorize all canvasAssets by type first, then batch-load each category.
          // This avoids 78+ individual Zustand state updates that cause race conditions
          // with React rendering (assets invisible until next save triggers re-render).
          const wallsToLoad: any[] = [];
          const shapesToLoad: any[] = [];
          const assetsToLoad: any[] = [];
          const dimensionsToLoad: any[] = [];
          const arrowsToLoad: any[] = [];
          const annotationsToLoad: any[] = [];

          eventData.canvasAssets.forEach((asset: AssetInstance | any) => {
            // Dimensions
            if ((asset.itemType === 'dimension' || asset.type === 'dimension') && asset.startPoint && asset.endPoint) {
              dimensionsToLoad.push({
                ...asset,
                id: asset.id,
                type: asset.dimensionType || asset.dimensionKind || 'linear',
                startPoint: asset.startPoint,
                endPoint: asset.endPoint,
                offset: asset.offset || 0,
                zIndex: asset.zIndex || 0,
              });
              return;
            }

            // Label arrows
            if ((asset.itemType === 'label-arrow' || asset.type === 'label-arrow') && asset.startPoint && asset.endPoint) {
              arrowsToLoad.push({
                ...asset,
                id: asset.id,
                startPoint: asset.startPoint,
                endPoint: asset.endPoint,
                label: asset.label || '',
                zIndex: asset.zIndex || 0,
              });
              return;
            }

            // Text annotations
            if ((asset.itemType === 'text-annotation' || asset.type === 'text-annotation' || asset.itemType === 'textAnnotation' || asset.type === 'textAnnotation') && asset.text !== undefined) {
              annotationsToLoad.push({
                ...asset,
                id: asset.id,
                x: asset.x || 0,
                y: asset.y || 0,
                text: asset.text || '',
                zIndex: asset.zIndex || 0,
              });
              return;
            }

            // Wall-polygon type (new format)
            if (asset.type === 'wall-polygon') {
              const savedWall = asset.wallData || asset.wall;
              if (savedWall?.nodes?.length && savedWall?.edges?.length) {
                wallsToLoad.push({
                  ...savedWall,
                  id: asset.id,
                  name: savedWall.name || asset.name,
                  nodes: savedWall.nodes,
                  edges: savedWall.edges,
                  fill: savedWall.fill ?? asset.fill ?? asset.backgroundColor,
                  stroke: normalizeLegacyWallStroke(savedWall.stroke, asset.stroke, asset.strokeColor),
                  strokeWidth: savedWall.strokeWidth ?? asset.strokeWidth ?? 2,
                  fillType: savedWall.fillType ?? asset.fillType,
                  fillTexture: savedWall.fillTexture ?? asset.fillTexture,
                  fillTextureScale: savedWall.fillTextureScale ?? asset.fillTextureScale,
                  fillTextureThickness: savedWall.fillTextureThickness ?? asset.fillTextureThickness,
                  zIndex: savedWall.zIndex ?? asset.zIndex ?? 0,
                });
                return;
              }

              if (asset.wallNodes?.length && asset.wallEdges?.length) {
                const wallNodes = asset.wallNodes.map((node: any, idx: number) => ({
                  id: node.id || `node-${asset.id}-${idx}`,
                  x: node.x,
                  y: node.y,
                }));
                const wallEdges = asset.wallEdges.map((edge: any, idx: number) => ({
                  id: edge.id || `edge-${asset.id}-${idx}`,
                  nodeA: edge.nodeA || wallNodes[edge.a]?.id || '',
                  nodeB: edge.nodeB || wallNodes[edge.b]?.id || '',
                  thickness: edge.thickness ?? asset.wallThickness ?? 75,
                })).filter((edge: any) => edge.nodeA && edge.nodeB);

                if (wallNodes.length > 0 && wallEdges.length > 0) {
                  wallsToLoad.push({
                    id: asset.id,
                    name: asset.name,
                    nodes: wallNodes,
                    edges: wallEdges,
                    fill: asset.fill ?? asset.backgroundColor,
                    stroke: normalizeLegacyWallStroke(asset.stroke, asset.strokeColor),
                    strokeWidth: asset.strokeWidth ?? 2,
                    fillType: asset.fillType,
                    fillTexture: asset.fillTexture,
                    fillTextureScale: asset.fillTextureScale,
                    fillTextureThickness: asset.fillTextureThickness,
                    zIndex: asset.zIndex || 0,
                  });
                }
                return;
              }

              if (asset.wallPolygon && Array.isArray(asset.wallPolygon)) {
                const wallNodes = asset.wallPolygon.map((point: any, idx: number) => ({
                  id: `node-${asset.id}-${idx}`,
                  x: asset.x + (point.x || 0),
                  y: asset.y + (point.y || 0),
                }));
                const wallEdges = [];
                for (let i = 0; i < wallNodes.length; i++) {
                  const nextIdx = (i + 1) % wallNodes.length;
                  wallEdges.push({
                    id: `edge-${asset.id}-${i}`,
                    nodeA: wallNodes[i].id,
                    nodeB: wallNodes[nextIdx].id,
                    thickness: asset.wallThickness ?? 75,
                  });
                }
                if (wallNodes.length > 0 && wallEdges.length > 0) {
                  wallsToLoad.push({
                    id: asset.id,
                    name: asset.name,
                    nodes: wallNodes,
                    edges: wallEdges,
                    fill: asset.fill ?? asset.backgroundColor,
                    stroke: normalizeLegacyWallStroke(asset.stroke, asset.strokeColor),
                    strokeWidth: asset.strokeWidth ?? 2,
                    fillType: asset.fillType,
                    fillTexture: asset.fillTexture,
                    fillTextureScale: asset.fillTextureScale,
                    fillTextureThickness: asset.fillTextureThickness,
                    zIndex: asset.zIndex || 0
                  });
                }
              }
              return;
            }

            // Wall-segments (legacy format)
            if (asset.type === 'wall-segments' && asset.wallNodes && asset.wallEdges) {
              const wallNodes = asset.wallNodes.map((node: any, idx: number) => ({
                id: `node-${asset.id}-${idx}`,
                x: node.x,
                y: node.y
              }));
              const wallEdges = asset.wallEdges.map((edge: any, idx: number) => ({
                id: `edge-${asset.id}-${idx}`,
                nodeA: wallNodes[edge.a]?.id || '',
                nodeB: wallNodes[edge.b]?.id || '',
                thickness: asset.wallThickness ?? 75
              }));
              if (wallNodes.length > 0 && wallEdges.length > 0) {
                wallsToLoad.push({
                  id: asset.id,
                  name: asset.name,
                  nodes: wallNodes,
                  edges: wallEdges,
                  zIndex: asset.zIndex || 0
                });
              }
              return;
            }

            // Line-segment (convert to line shape)
            if (asset.type === 'line-segment' && asset.startPoint && asset.endPoint) {
              const startX = asset.startPoint.x || asset.x;
              const startY = asset.startPoint.y || asset.y;
              const endX = asset.endPoint.x || (asset.x + asset.width);
              const endY = asset.endPoint.y || (asset.y + asset.height);
              shapesToLoad.push({
                id: asset.id,
                type: 'line',
                x: (startX + endX) / 2,
                y: (startY + endY) / 2,
                width: Math.sqrt(Math.pow(endX - startX, 2) + Math.pow(endY - startY, 2)),
                height: 2,
                rotation: asset.rotation || 0,
                fill: asset.backgroundColor || 'transparent',
                stroke: asset.strokeColor || '#3B82F6',
                strokeWidth: asset.strokeWidth ?? 2,
                points: [
                  { x: startX - (startX + endX) / 2, y: startY - (startY + endY) / 2 },
                  { x: endX - (startX + endX) / 2, y: endY - (startY + endY) / 2 },
                ],
                zIndex: asset.zIndex || 0
              });
              return;
            }

            // Standard shape types
            if (asset.type && ['rectangle', 'ellipse', 'line', 'arrow', 'freehand'].includes(asset.type)) {
              shapesToLoad.push({
                ...asset,
                id: asset.id,
                name: asset.name,
                type: asset.type as 'rectangle' | 'ellipse' | 'line' | 'arrow' | 'freehand',
                x: asset.x || 0,
                y: asset.y || 0,
                width: asset.width || 100,
                height: asset.height || 100,
                rotation: asset.rotation || 0,
                fill: asset.fillColor || asset.backgroundColor || asset.fill || "#3B82F6",
                stroke: asset.strokeColor || asset.stroke || "#1E40AF",
                strokeWidth: asset.strokeWidth ?? 2,
                points: asset.points,
                zIndex: asset.zIndex || 0
              });
              return;
            }

            // Furniture / standard assets
            if (asset.type) {
              let defaultWidth = asset.width || 100;
              let defaultHeight = asset.height || 100;
              if (asset.type.includes('chair')) {
                defaultWidth = asset.width || 80;
                defaultHeight = asset.height || 80;
              } else if (asset.type.includes('table') || asset.type.includes('cocktail')) {
                defaultWidth = asset.width || 200;
                defaultHeight = asset.height || 200;
              }
              assetsToLoad.push({
                ...asset,
                id: asset.id,
                name: asset.name,
                type: asset.type,
                x: asset.x || 0,
                y: asset.y || 0,
                width: defaultWidth,
                height: defaultHeight,
                rotation: asset.rotation || 0,
                scale: asset.scale || 1,
                strokeWidth: asset.strokeWidth !== undefined ? asset.strokeWidth : 0.6,
                zIndex: asset.zIndex || 0,
              });
            }
          });

          // Batch-load all categories at once — single Zustand state update per category
          // instead of 78+ individual addAsset calls that race with React rendering.
          if (wallsToLoad.length > 0) projectStore.addWallBatch(wallsToLoad, true);
          if (shapesToLoad.length > 0) projectStore.addShapeBatch(shapesToLoad, true);
          if (assetsToLoad.length > 0) projectStore.addAssetBatch(assetsToLoad, true);
          dimensionsToLoad.forEach(d => projectStore.addDimension(d, true));
          arrowsToLoad.forEach(a => projectStore.addLabelArrow(a, true));
          annotationsToLoad.forEach(t => projectStore.addTextAnnotation(t, true));

          useProjectStore.setState((state) => ({
            ...state,
            comments: normalizedComments,
          }));

          const loadedCount = wallsToLoad.length + shapesToLoad.length + assetsToLoad.length + dimensionsToLoad.length + arrowsToLoad.length + annotationsToLoad.length;
          console.log(`[Editor] ✅ Loaded ${loadedCount} items from DATABASE into workspace (batch)`, {
            walls: wallsToLoad.length,
            shapes: shapesToLoad.length,
            assets: assetsToLoad.length,
            dimensions: dimensionsToLoad.length,
            arrows: arrowsToLoad.length,
            annotations: annotationsToLoad.length,
          });
          // DEBUG: Verify store state immediately after batch load
          const verifyAfterLoad = useProjectStore.getState();
          console.log('[Editor] DEBUG verify-after-load:', {
            shapes: verifyAfterLoad.shapes.length,
            assets: verifyAfterLoad.assets.length,
            walls: verifyAfterLoad.walls.length,
            shapeIds: verifyAfterLoad.shapes.map(s => s.id),
          });
          projectStore.markAsSaved();
        }
        // PRIORITY 3: Fall back to localStorage backup if both canvasData and canvasAssets are empty
        else {
          try {
            const raw = localStorage.getItem(`event-canvas-${eventId}`);
            if (raw) {
              const backup = JSON.parse(raw);
              const backupCanvasData = backup.canvasData;
              const backupCanvasAssets = backup.canvasAssets;
              const hasBackupData = (backupCanvasData && [
                backupCanvasData.walls, backupCanvasData.shapes, backupCanvasData.assets,
                backupCanvasData.textAnnotations, backupCanvasData.dimensions, backupCanvasData.labelArrows,
              ].some((c: any) => Array.isArray(c) && c.length > 0)) || (Array.isArray(backupCanvasAssets) && backupCanvasAssets.length > 0);

              if (hasBackupData) {
                console.log(`[Editor] ⚠️ Backend returned empty data, restoring from localStorage backup for event ${eventId}`);

                if (backupCanvasData) {
                  const { walls = [], shapes = [], assets = [], textAnnotations = [], dimensions = [], labelArrows = [] } = backupCanvasData;
                  walls.forEach((wall: any) => projectStore.addWall({ ...wall, stroke: normalizeLegacyWallStroke(wall.stroke, wall.strokeColor), strokeWidth: wall.strokeWidth ?? 2 }, true));
                  shapes.forEach((shape: any) => projectStore.addShape(shape, true));
                  assets.forEach((asset: any) => projectStore.addAsset(asset, true));
                  textAnnotations.forEach((a: any) => projectStore.addTextAnnotation(a, true));
                  dimensions.forEach((d: any) => projectStore.addDimension(d, true));
                  labelArrows.forEach((a: any) => projectStore.addLabelArrow(a, true));
                } else if (Array.isArray(backupCanvasAssets)) {
                  const wallsToLoad: any[] = [];
                  const shapesToLoad: any[] = [];
                  const assetsToLoad: any[] = [];
                  const dimensionsToLoad: any[] = [];
                  const arrowsToLoad: any[] = [];
                  const annotationsToLoad: any[] = [];

                  backupCanvasAssets.forEach((asset: any) => {
                    if ((asset.itemType === 'dimension' || asset.type === 'dimension') && asset.startPoint && asset.endPoint) {
                      dimensionsToLoad.push({ ...asset, id: asset.id, type: asset.dimensionType || 'linear', startPoint: asset.startPoint, endPoint: asset.endPoint, offset: asset.offset || 0, zIndex: asset.zIndex || 0 });
                    } else if ((asset.itemType === 'label-arrow' || asset.type === 'label-arrow') && asset.startPoint && asset.endPoint) {
                      arrowsToLoad.push({ ...asset, id: asset.id, startPoint: asset.startPoint, endPoint: asset.endPoint, label: asset.label || '', zIndex: asset.zIndex || 0 });
                    } else if ((asset.itemType === 'text-annotation' || asset.type === 'text-annotation') && asset.text !== undefined) {
                      annotationsToLoad.push({ ...asset, id: asset.id, x: asset.x || 0, y: asset.y || 0, text: asset.text || '', zIndex: asset.zIndex || 0 });
                    } else if (asset.type === 'wall-polygon') {
                      const savedWall = asset.wallData || asset;
                      if (savedWall?.nodes?.length && savedWall?.edges?.length) {
                        wallsToLoad.push({ ...savedWall, id: asset.id, name: savedWall.name || asset.name, nodes: savedWall.nodes, edges: savedWall.edges, fill: savedWall.fill ?? asset.backgroundColor, stroke: normalizeLegacyWallStroke(savedWall.stroke, asset.strokeColor), strokeWidth: savedWall.strokeWidth ?? asset.strokeWidth ?? 2, fillType: savedWall.fillType, fillTexture: savedWall.fillTexture, fillTextureScale: savedWall.fillTextureScale, fillTextureThickness: savedWall.fillTextureThickness, zIndex: savedWall.zIndex ?? asset.zIndex ?? 0 });
                      } else if (asset.wallPolygon && Array.isArray(asset.wallPolygon)) {
                        const origin = { x: asset.x || 0, y: asset.y || 0 };
                        const wallNodes = asset.wallPolygon.map((p: any, i: number) => ({ id: `node-${asset.id}-${i}`, x: origin.x + (p.x || 0), y: origin.y + (p.y || 0) }));
                        const wallEdges = (asset.wallEdges || []).map((e: any, i: number) => ({ id: `edge-${asset.id}-${i}`, nodeA: wallNodes[e.a]?.id || '', nodeB: wallNodes[e.b]?.id || '', thickness: e.thickness ?? asset.wallThickness ?? 75 })).filter((e: any) => e.nodeA && e.nodeB);
                        if (wallNodes.length > 0 && wallEdges.length > 0) {
                          wallsToLoad.push({ id: asset.id, name: asset.name, nodes: wallNodes, edges: wallEdges, fill: asset.fill ?? asset.backgroundColor, stroke: normalizeLegacyWallStroke(asset.stroke, asset.strokeColor), strokeWidth: asset.strokeWidth ?? 2, fillType: asset.fillType, fillTexture: asset.fillTexture, fillTextureScale: asset.fillTextureScale, fillTextureThickness: asset.fillTextureThickness, zIndex: asset.zIndex || 0 });
                        }
                      }
                    } else if (['rectangle', 'ellipse', 'line', 'arrow', 'freehand'].includes(asset.type)) {
                      shapesToLoad.push({ ...asset, id: asset.id, name: asset.name, type: asset.type, x: asset.x || 0, y: asset.y || 0, width: asset.width || 100, height: asset.height || 100, rotation: asset.rotation || 0, fill: asset.fillColor || asset.backgroundColor || asset.fill || '#3B82F6', stroke: asset.strokeColor || asset.stroke || '#1E40AF', strokeWidth: asset.strokeWidth ?? 2, points: asset.points, zIndex: asset.zIndex || 0 });
                    } else if (asset.type) {
                      assetsToLoad.push({ ...asset, id: asset.id, name: asset.name, type: asset.type, x: asset.x || 0, y: asset.y || 0, width: asset.width || 100, height: asset.height || 100, rotation: asset.rotation || 0, scale: asset.scale || 1, strokeWidth: asset.strokeWidth !== undefined ? asset.strokeWidth : 0.6, zIndex: asset.zIndex || 0 });
                    }
                  });

                  if (wallsToLoad.length > 0) projectStore.addWallBatch(wallsToLoad, true);
                  if (shapesToLoad.length > 0) projectStore.addShapeBatch(shapesToLoad, true);
                  if (assetsToLoad.length > 0) projectStore.addAssetBatch(assetsToLoad, true);
                  dimensionsToLoad.forEach(d => projectStore.addDimension(d, true));
                  arrowsToLoad.forEach(a => projectStore.addLabelArrow(a, true));
                  annotationsToLoad.forEach(t => projectStore.addTextAnnotation(t, true));
                }

                projectStore.markAsSaved();
                console.log(`[Editor] ✅ Restored event from localStorage backup`);
              }
            }
          } catch (e) {
            console.warn('[Editor] Failed to restore from localStorage backup:', e);
          }
        }
      } else {
        console.log(`[Editor] Skipping load - same event and we have current data`);
      }
    }
  }, [eventData, currentEventData, id]);

  // Handle focusing on content if requested in query params
  useEffect(() => {
    if (router.query.focus === 'true' && eventData && (walls.length > 0 || shapes.length > 0 || projectAssets.length > 0)) {
      // Small timeout to ensure stores are fully populated and layout is ready
      const timeoutId = setTimeout(() => {
        const bounds = calculateWorkspaceBounds(walls, shapes, projectAssets);
        
        // If no bounds (because only background exists), fallback to background bounds if it exists
        let targetBounds = bounds;
        if (!targetBounds) {
          const bgTexture = shapes.find(s => s.id === 'background-texture');
          if (bgTexture) {
            targetBounds = {
              minX: bgTexture.x - bgTexture.width / 2,
              minY: bgTexture.y - bgTexture.height / 2,
              maxX: bgTexture.x + bgTexture.width / 2,
              maxY: bgTexture.y + bgTexture.height / 2,
              width: bgTexture.width,
              height: bgTexture.height
            };
          }
        }

        if (targetBounds) {
          const viewportWidth = window.innerWidth - 300; // Account for sidebars
          const viewportHeight = window.innerHeight - 150; // Account for toolbars

          const zoomX = viewportWidth / (targetBounds.width || 100);
          const zoomY = viewportHeight / (targetBounds.height || 100);
          
          // Use a reasonable zoom level
          const finalZoom = Math.max(0.05, Math.min(zoomX, zoomY, 0.4));
          setZoom(finalZoom);

          // Center the content
          const centerX = (targetBounds.minX + targetBounds.maxX) / 2;
          const centerY = (targetBounds.minY + targetBounds.maxY) / 2;
          
          const panX = (window.innerWidth / 2) - (centerX * finalZoom);
          const panY = (window.innerHeight / 2) - (centerY * finalZoom);
          
          setPan(panX, panY);
          
          // Clear the focus param so it doesn't keep focusing
          const newQuery = { ...router.query };
          delete newQuery.focus;
          router.replace({ pathname: router.pathname, query: newQuery }, undefined, { shallow: true });
        }
      }, 300);
      
      return () => clearTimeout(timeoutId);
    }
  }, [router.query.focus, eventData, walls, shapes, projectAssets]);

  // Auto-fit content on first load in normal edit mode (not preview, not focus query)
  // Shapes from the DB may have huge coordinates (millions of mm) that are off-screen.
  // This zooms/pans the viewport to fit all content so the user can see it immediately.
  const hasAutoFittedRef = useRef(false);
  useEffect(() => {
    if (preview === 'true' || router.query.focus === 'true') return;
    if (!currentEventData) return;
    if (hasAutoFittedRef.current) return;

    const routeId = id as string;
    const currentId = currentEventData._id || (currentEventData as any)?.id;
    if (currentId !== routeId) return;

    const hasContent = walls.length > 0 || shapes.length > 0 || projectAssets.length > 0;
    if (!hasContent) return;

    hasAutoFittedRef.current = true;

    const timeoutId = setTimeout(() => {
      const bounds = calculateWorkspaceBounds(walls, shapes, projectAssets);
      if (!bounds || bounds.width <= 0 || bounds.height <= 0) return;

      const viewportWidth = window.innerWidth - 300;
      const viewportHeight = window.innerHeight - 150;

      const zoomX = viewportWidth / bounds.width;
      const zoomY = viewportHeight / bounds.height;
      const finalZoom = Math.max(0.001, Math.min(zoomX, zoomY, 1));

      setZoom(finalZoom);

      const centerX = (bounds.minX + bounds.maxX) / 2;
      const centerY = (bounds.minY + bounds.maxY) / 2;
      const panX = (window.innerWidth / 2) - (centerX * finalZoom);
      const panY = (window.innerHeight / 2) - (centerY * finalZoom);
      setPan(panX, panY);

      console.log(`[Editor] Auto-fit: zoom=${finalZoom.toFixed(4)}, center=(${centerX.toFixed(0)}, ${centerY.toFixed(0)})`);
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [currentEventData, id, walls.length, shapes.length, projectAssets.length, preview, router.query.focus, setZoom, setPan]);

  // Reset auto-fit flag when event changes
  useEffect(() => {
    hasAutoFittedRef.current = false;
  }, [id]);

  // Auto-fit content when in preview mode
  useEffect(() => {
    if (preview !== 'true' || !eventData || !currentEventData) return;

    // Wait for assets to be loaded into stores
    const timeoutId = setTimeout(() => {
      // Get all assets from both stores
      const allAssets = [...sceneAssets];
      const allProjectAssets = [...projectAssets];
      const allShapes = [...shapes];
      const allWalls = [...walls];

      // Calculate bounding box
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      let hasContent = false;

      // Process scene assets (new editor)
      allAssets.forEach(asset => {
        if (asset.type === 'wall-segments' && asset.wallNodes) {
          asset.wallNodes.forEach(node => {
            minX = Math.min(minX, node.x);
            minY = Math.min(minY, node.y);
            maxX = Math.max(maxX, node.x);
            maxY = Math.max(maxY, node.y);
            hasContent = true;
          });
        } else {
          const w = (asset.width || 50) * (asset.scale || 1);
          const h = (asset.height || 50) * (asset.scale || 1);
          minX = Math.min(minX, asset.x - w / 2);
          minY = Math.min(minY, asset.y - h / 2);
          maxX = Math.max(maxX, asset.x + w / 2);
          maxY = Math.max(maxY, asset.y + h / 2);
          hasContent = true;
        }
      });

      // Process project assets (old editor)
      allProjectAssets.forEach(asset => {
        const w = asset.width * asset.scale;
        const h = asset.height * asset.scale;
        minX = Math.min(minX, asset.x - w / 2);
        minY = Math.min(minY, asset.y - h / 2);
        maxX = Math.max(maxX, asset.x + w / 2);
        maxY = Math.max(maxY, asset.y + h / 2);
        hasContent = true;
      });

      // Process shapes
      allShapes.forEach(shape => {
        const halfW = shape.width / 2;
        const halfH = shape.height / 2;
        minX = Math.min(minX, shape.x - halfW);
        minY = Math.min(minY, shape.y - halfH);
        maxX = Math.max(maxX, shape.x + halfW);
        maxY = Math.max(maxY, shape.y + halfH);
        hasContent = true;
      });

      // Process walls
      allWalls.forEach(wall => {
        wall.nodes.forEach(node => {
          minX = Math.min(minX, node.x);
          minY = Math.min(minY, node.y);
          maxX = Math.max(maxX, node.x);
          maxY = Math.max(maxY, node.y);
          hasContent = true;
        });
      });

      if (hasContent && isFinite(minX) && isFinite(minY) && isFinite(maxX) && isFinite(maxY)) {
        const contentWidth = maxX - minX;
        const contentHeight = maxY - minY;
        const centerX = (minX + maxX) / 2;
        const centerY = (minY + maxY) / 2;

        // Get actual viewport dimensions
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;

        // Calculate zoom to fit content with some padding (in mm)
        // Convert viewport pixels to mm (assuming ~2px per mm for reasonable zoom)
        const padding = 100; // mm padding around content
        const viewportWidthMm = viewportWidth / 2; // Approximate conversion
        const viewportHeightMm = viewportHeight / 2;

        const zoomX = (viewportWidthMm - padding * 2) / Math.max(contentWidth, 100);
        const zoomY = (viewportHeightMm - padding * 2) / Math.max(contentHeight, 100);
        const fitZoom = Math.min(zoomX, zoomY, 1.5); // Cap at 1.5x zoom max for preview

        // Set zoom
        const finalZoom = Math.max(0.3, Math.min(fitZoom, 1.5));
        setZoom(finalZoom);

        // Center the content in viewport
        const screenCenterX = viewportWidth / 2;
        const screenCenterY = viewportHeight / 2;
        const panX = screenCenterX - centerX * finalZoom * 2; // Account for zoom scaling
        const panY = screenCenterY - centerY * finalZoom * 2;
        setPan(panX, panY);
      } else {
        // No content - use default zoom and center
        setZoom(0.5);
        setPan(0, 0);
      }
    }, 500); // Wait 500ms for assets to load

    return () => clearTimeout(timeoutId);
  }, [preview, eventData, sceneAssets, projectAssets, shapes, walls, setZoom, setPan]);

  // Auto-save functionality - automatically save to database
  useEffect(() => {
    if (!currentEventData || !id || !slug) return;

    const hasAnyUnsavedChanges = projectHasUnsavedChanges || hasUnsavedChanges;
    if (!hasAnyUnsavedChanges) {
      lastSavedProjectHistoryRef.current = projectHistoryIndex;
      lastSavedSceneHistoryRef.current = sceneHistoryIndex;
      return;
    }

    const projectChangedSinceLastSave =
      lastSavedProjectHistoryRef.current === null || lastSavedProjectHistoryRef.current !== projectHistoryIndex;
    const sceneChangedSinceLastSave =
      lastSavedSceneHistoryRef.current === null || lastSavedSceneHistoryRef.current !== sceneHistoryIndex;

    if (!projectChangedSinceLastSave && !sceneChangedSinceLastSave) return;

    const timeoutId = setTimeout(() => {
      const projectStore = useProjectStore.getState();
      const sceneStore = useSceneStore.getState();
      const currentProjectHasChanges = projectStore.hasUnsavedChanges;
      const currentSceneHasChanges = sceneStore.hasUnsavedChanges;

      if ((currentProjectHasChanges || currentSceneHasChanges) && id && typeof id === 'string' && slug && typeof slug === 'string') {
        if (isAutoSavingRef.current) {
          pendingAutoSaveRef.current = true;
          return;
        }

        if (currentSceneHasChanges && sceneStore.assets.length > 0) {
          const sceneAssetsById = new Map(sceneStore.assets.map((sceneAsset) => [sceneAsset.id, sceneAsset]));
          useProjectStore.setState((state) => ({
            assets: state.assets.map((asset) => {
              const sceneAsset = sceneAssetsById.get(asset.id);
              return sceneAsset ? { ...asset, ...sceneAsset } : asset;
            }),
          }));
        } else if (currentProjectHasChanges && projectStore.assets.length > 0) {
          const projectAssetsById = new Map(projectStore.assets.map((projectAsset) => [projectAsset.id, projectAsset]));
          useSceneStore.setState((state) => ({
            assets: state.assets.map((asset) => {
              const projectAsset = projectAssetsById.get(asset.id);
              return projectAsset ? { ...asset, ...projectAsset } : asset;
            }),
          }));
        }

        const saveStore = useProjectStore.getState();
        const { walls, shapes, assets } = saveStore;

        console.log('[Editor] Auto-save: Saving to DATABASE:', {
          eventId: id,
          walls: walls.length,
          shapes: shapes.length,
          assets: assets.length,
        });

        // Mark that we're saving to prevent reload
        isAutoSavingRef.current = true;
        pendingAutoSaveRef.current = false;
        justSavedRef.current = true;

        // Save to database automatically
        saveStore.saveEvent(id, slug)
          .then(() => {
            useSceneStore.getState().markAsSaved();
            lastSavedProjectHistoryRef.current = projectHistoryIndex;
            lastSavedSceneHistoryRef.current = sceneHistoryIndex;
            isAutoSavingRef.current = false;
            if (pendingAutoSaveRef.current) {
              pendingAutoSaveRef.current = false;
              window.setTimeout(() => {
                useProjectStore.setState((state) => ({ ...state }));
              }, 0);
            }
            console.log('[Editor] ✅ Auto-saved to DATABASE successfully');
          })
          .catch((error) => {
            console.error('[Editor] ❌ Auto-save failed:', error);
            isAutoSavingRef.current = false;
          });
        setTimeout(() => {
          justSavedRef.current = false;
        }, 2500);

        const latestProjectStore = useProjectStore.getState();
        const latestSceneStore = useSceneStore.getState();
        const stillDirty = latestProjectStore.hasUnsavedChanges || latestSceneStore.hasUnsavedChanges;
        const newChangesSinceSave =
          lastSavedProjectHistoryRef.current !== projectHistoryIndex ||
          lastSavedSceneHistoryRef.current !== sceneHistoryIndex;

        if (pendingAutoSaveRef.current || (stillDirty && newChangesSinceSave)) {
          pendingAutoSaveRef.current = false;
          window.setTimeout(() => {
            useProjectStore.setState((state) => ({ ...state }));
          }, 0);
        }
      }
    }, 180); // Auto-save right after the action settles

    return () => clearTimeout(timeoutId);
  }, [projectHasUnsavedChanges, hasUnsavedChanges, currentEventData, id, slug, projectHistoryIndex, sceneHistoryIndex]);

  // Restore local draft for this exact event if a recent unsaved checkpoint exists
  useEffect(() => {
    if (
      typeof window === "undefined" ||
      !currentEventData ||
      !id ||
      !slug ||
      typeof id !== "string" ||
      typeof slug !== "string"
    ) return;

    const draftKey = getLocalDraftKey(slug, id);
    if (restoredLocalDraftRef.current === draftKey) return;

    try {
      const raw = window.localStorage.getItem(draftKey);
      if (!raw) {
        restoredLocalDraftRef.current = draftKey;
        return;
      }

      const parsed = JSON.parse(raw) as LocalWorkspaceDraft;
      const backendUpdatedAt = currentEventData?.updatedAt ? new Date(currentEventData.updatedAt).getTime() : 0;
      if (
        !parsed ||
        parsed.version !== LOCAL_DRAFT_VERSION ||
        parsed.eventId !== id ||
        parsed.slug !== slug ||
        !parsed.data ||
        (backendUpdatedAt && parsed.savedAt <= backendUpdatedAt)
      ) {
        if (backendUpdatedAt && parsed?.savedAt <= backendUpdatedAt) {
          clearLocalWorkspaceDraft();
        }
        restoredLocalDraftRef.current = draftKey;
        return;
      }

      useProjectStore.setState((state) => ({
        ...state,
        canvas: parsed.data.canvas || state.canvas,
        walls: parsed.data.walls || [],
        wallSegments: parsed.data.wallSegments || [],
        shapes: parsed.data.shapes || [],
        assets: parsed.data.assets || [],
        layers: parsed.data.layers || state.layers,
        dimensions: parsed.data.dimensions || [],
        textAnnotations: parsed.data.textAnnotations || [],
        labelArrows: parsed.data.labelArrows || [],
        groups: parsed.data.groups || [],
        activeLayerId: parsed.data.activeLayerId || state.activeLayerId,
        comments: parsed.data.comments || [],
        hasUnsavedChanges: true,
      }));

      useSceneStore.setState((state) => ({
        ...state,
        assets: parsed.data.assets || [],
        canvas: parsed.data.canvas || state.canvas,
        hasUnsavedChanges: true,
      }));

      restoredLocalDraftRef.current = draftKey;
      toast.success("Recovered unsaved workspace draft");
    } catch (error) {
      console.warn("[Editor] Failed to restore local workspace draft", error);
      restoredLocalDraftRef.current = draftKey;
    }
  }, [currentEventData, id, slug, clearLocalWorkspaceDraft]);

  // Fast local draft checkpoint for crash / shutdown recovery
  useEffect(() => {
    if (!currentEventData || !id || !slug || typeof id !== "string" || typeof slug !== "string") return;

    const hasAnyUnsavedChanges = projectHasUnsavedChanges || hasUnsavedChanges;
    if (!hasAnyUnsavedChanges) {
      clearLocalWorkspaceDraft();
      return;
    }

    const timeoutId = window.setTimeout(() => {
      writeLocalWorkspaceDraft();
    }, 350);

    return () => window.clearTimeout(timeoutId);
  }, [
    projectHasUnsavedChanges,
    hasUnsavedChanges,
    currentEventData,
    id,
    slug,
    writeLocalWorkspaceDraft,
    clearLocalWorkspaceDraft,
  ]);

  // Flush local draft immediately when the tab becomes hidden or page is closing
  useEffect(() => {
    if (typeof window === "undefined") return;

    const flushDraft = () => {
      const projectStore = useProjectStore.getState();
      const sceneStore = useSceneStore.getState();
      if (projectStore.hasUnsavedChanges || sceneStore.hasUnsavedChanges) {
        writeLocalWorkspaceDraft();
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        flushDraft();
      }
    };

    window.addEventListener("beforeunload", flushDraft);
    window.addEventListener("pagehide", flushDraft);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener("beforeunload", flushDraft);
      window.removeEventListener("pagehide", flushDraft);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [writeLocalWorkspaceDraft]);

  // Save functionality is handled by PropertiesSidebar

  // Render content based on iframe/preview status
  const renderContent = () => {
    const isPreviewMode = preview === 'true' || isInIframe;
    // Viewers (read-only collaborators) get a clean canvas: no element or
    // property sidebar, but they can still zoom, pan and read the plan.
    const isViewerMode = isReadOnly;

    return (
      <div className={`${isPreviewMode ? 'h-full w-full' : 'h-screen'} flex overflow-hidden bg-gray-50`}>
        {/* Dashboard Sidebar - only show if not in preview mode */}
        {!isPreviewMode && <DashboardSidebar />}

        <div className="flex-1 flex overflow-hidden">
          {/* Elements Pane - only show if not in preview mode and not a viewer */}
          {!isPreviewMode && !isViewerMode && (
            <div className="w-40 bg-white border-r border-gray-200 flex-shrink-0 shadow-sm">
              <ElementsPane />
            </div>
          )}

          <div className="flex-1 flex flex-col overflow-hidden">
            {!isPreviewMode && !isViewerMode && (
              <>
                <AssetsModal
                  isOpen={showAssetsModal}
                  onClose={() => setShowAssetsModal(false)}
                />
                <BottomToolbar setShowAssetsModal={setShowAssetsModal} />
                <AiTrigger />
              </>
            )}

            {/* Main Content Area */}
            <div className="flex-1 flex overflow-hidden">
              {/* NEW WORKSPACE */}
              <div className="flex-1 relative overflow-hidden">
                {!show3D && (
                  <div className="absolute inset-0">
                    <Workspace2D projectId={Array.isArray(slug) ? slug[0] : slug} eventId={Array.isArray(id) ? id[0] : id} />
                  </div>
                )}

                {/* 3D Preview / toggle removed per request */}
              </div>

              {/* Properties Sidebar - only show if not in preview mode and not a viewer */}
              {!isPreviewMode && !isViewerMode && (
                <div className="flex-shrink-0 w-64 bg-white border-l border-gray-200">
                  <PropertiesSidebar />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const isPreviewMode = preview === 'true' || isInIframe;

  if (isLoading) {
    return isPreviewMode ? (
      <div className="h-full w-full flex items-center justify-center">
        <div className="text-lg">Loading event data...</div>
      </div>
    ) : (
      <div className="flex h-screen bg-gray-50 overflow-hidden">
        <DashboardSidebar />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-lg">Loading event data...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return isPreviewMode ? (
      <div className="h-full w-full flex items-center justify-center">
        <div className="text-lg text-red-600">
          Error loading event: {error?.message || 'Unknown error'}
        </div>
      </div>
    ) : (
      <div className="flex h-screen bg-gray-50 overflow-hidden">
        <DashboardSidebar />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-lg text-red-600">
            Error loading event: {error?.message || 'Unknown error'}
          </div>
        </div>
      </div>
    );
  }

  if (!eventData) {
    return isPreviewMode ? (
      <div className="h-full w-full flex items-center justify-center">
        <div className="text-lg">No event data found</div>
      </div>
    ) : (
      <div className="flex h-screen bg-gray-50 overflow-hidden">
        <DashboardSidebar />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-lg">No event data found</div>
        </div>
      </div>
    );
  }

  return renderContent();
}
