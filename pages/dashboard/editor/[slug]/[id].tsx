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

// Extended EventData type with canvasData
type EventData = BaseEventData & {
  canvasData?: {
    walls: any[];
    shapes: any[];
    assets: any[];
    textAnnotations?: any[];
    dimensions?: any[];
    labelArrows?: any[];
    layers?: any[];
    canvas?: any;
  };
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

    return [
    // Filter out items that belong to a group
    ...walls.filter(w => !w.groupId).map((w) => {
      if (!w.nodes || w.nodes.length === 0) {
        return { id: w.id, label: w.name || "Wall", type: "Wall" as const, x: 0, y: 0 };
      }
      const xs = w.nodes.map((n) => n.x);
      const ys = w.nodes.map((n) => n.y);
      const centerX = (Math.min(...xs) + Math.max(...xs)) / 2;
      const centerY = (Math.min(...ys) + Math.max(...ys)) / 2;
      return { id: w.id, label: w.name || "Wall", type: "Wall" as const, x: centerX, y: centerY };
    }),
    ...independentShapes.filter(s => !s.groupId).map((s) => ({
      id: s.id,
      label: s.name || s.type,
      type: "Shape" as const,
      x: s.x,
      y: s.y,
      shape: s,
    })),
    ...assets.filter(a => !a.groupId).map((a) => ({
      id: a.id,
      label: a.name || (a.metadata as any)?.label || a.type || "Asset",
      type: "Asset" as const,
      x: a.x,
      y: a.y,
      asset: a,
      childShapes: assetChildrenMap[a.id] || [],
    })),
    ...textAnnotations.filter(t => !t.groupId).map((t) => ({
      id: t.id,
      label: t.name || t.text || "Text",
      type: "Text" as const,
      x: t.x,
      y: t.y,
      text: t,
    })),
    ...dimensions.filter(d => !d.groupId).map((d) => ({
      id: d.id,
      label: d.name || ((d.type as string) === "wall" ? "Wall Dimension" : "Dimension"),
      type: "Dimension" as const,
      x: (d.startPoint.x + d.endPoint.x) / 2,
      y: (d.startPoint.y + d.endPoint.y) / 2,
      dimension: d,
    })),
    ...labelArrows.filter(la => !la.groupId).map((la) => ({
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
        {items.map((item) => {
          // Get asset definition for icon/path
          const assetDef = item.type === "Asset" && item.asset
            ? ASSET_LIBRARY.find(a => a.id === item.asset.type)
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
                className={`w-full flex items-center gap-1 px-1.5 py-1.5 text-[11px] hover:bg-blue-100 border-b border-gray-100 transition-colors ${isSelected ? "text-blue-700 bg-blue-50 font-medium" : "text-gray-700 hover:bg-gray-100"}`}
              >
                {/* Mini preview */}
                <div className="w-7 h-7 rounded border border-gray-200 bg-white flex-shrink-0 overflow-hidden flex items-center justify-center">
                  {item.type === "Asset" && item.asset && (
                    assetDef?.path ? (
                      <div className="w-full h-full p-1">

                        <InlineSvg
                          src={assetDef.path}
                          fill={item.asset.fillColor || (item.asset as any).fill || "none"}
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
                                return `url(#${item.shape.fillTexture}-scale-${item.shape.fillTextureScale || 4}-thick-${item.shape.fillTextureThickness || 1})`;
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
                                return `url(#${item.shape.fillTexture}-scale-${item.shape.fillTextureScale || 4}-thick-${item.shape.fillTextureThickness || 1})`;
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
                                return `url(#${item.shape.fillTexture}-scale-${item.shape.fillTextureScale || 4}-thick-${item.shape.fillTextureThickness || 1})`;
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
                      <path d="M3 7h18a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1z" fill="none" stroke="#2563eb" strokeWidth={1.5} />
                      <path d="M7 4h10a1 1 0 0 1 1 1v2H6V5a1 1 0 0 1 1-1z" fill="none" stroke="#2563eb" strokeWidth={1.5} />
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
                          const w = (item as any).wall;
                          if (!w) return "#cbd5e1";
                          if ((w.fillType === 'texture' || w.fillType === 'hatch' || w.fillType === 'hash') && w.fillTexture) {
                            return `url(#${w.fillTexture}-scale-${w.fillTextureScale || 1}-thick-${w.fillTextureThickness || 1})`;
                          }
                          return w.fill || "#cbd5e1";
                        })()}
                        stroke={(item as any).wall?.stroke || "#94a3b8"}
                        strokeWidth={0.6}
                        rx={1}
                      />
                      <line x1={4} y1={12} x2={20} y2={12} stroke="currentColor" strokeWidth={0.5} strokeOpacity={0.3} />
                    </svg>
                  )}
                  {item.type === "Text" && item.text && (
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
                  {item.type === "Dimension" && item.dimension && (
                    <svg width={24} height={24} viewBox="0 0 24 24">
                      <line
                        x1={4}
                        y1={12}
                        x2={20}
                        y2={12}
                        stroke={item.dimension.color || "#111827"}
                        strokeWidth={1}
                        strokeLinecap="round"
                      />
                      <polyline
                        points="6,10 4,12 6,14"
                        fill="none"
                        stroke={item.dimension.color || "#111827"}
                        strokeWidth={0.8}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      <polyline
                        points="18,10 20,12 18,14"
                        fill="none"
                        stroke={item.dimension.color || "#111827"}
                        strokeWidth={0.8}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      <text
                        x={12}
                        y={10}
                        textAnchor="middle"
                        fontSize={6}
                        fill={item.dimension.color || "#111827"}
                        fontFamily="system-ui"
                      >
                        dim
                      </text>
                    </svg>
                  )}
                  {item.type === "Label" && item.labelArrow && (
                    <svg width={24} height={24} viewBox="0 0 24 24">
                      {/* arrow line */}
                      <line
                        x1={6}
                        y1={16}
                        x2={18}
                        y2={16}
                        stroke={item.labelArrow.color || "#111827"}
                        strokeWidth={0.6}
                        strokeLinecap="round"
                      />
                      {/* arrow head */}
                      <polyline
                        points="16,14 18,16 16,18"
                        fill="none"
                        stroke={item.labelArrow.color || "#111827"}
                        strokeWidth={0.6}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      {/* label text bubble */}
                      <rect
                        x={5}
                        y={5}
                        width={14}
                        height={7}
                        rx={2}
                        ry={2}
                        fill="#F3F4F6"
                        stroke={item.labelArrow.color || "#9CA3AF"}
                        strokeWidth={0.8}
                      />
                      <text
                        x={12}
                        y={10}
                        textAnchor="middle"
                        fontSize={6}
                        fill={item.labelArrow.color || "#111827"}
                        fontFamily="system-ui"
                      >
                        Aa
                      </text>
                    </svg>
                  )}
                </div>

                {/* Label and type */}
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

              {/* Child shapes for exploded assets */}
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
                                    return `url(#${s.fillTexture}-scale-${s.fillTextureScale || 4}-thick-${s.fillTextureThickness || 1})`;
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
                                    return `url(#${s.fillTexture}-scale-${s.fillTextureScale || 4}-thick-${s.fillTextureThickness || 1})`;
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
                                    return `url(#${s.fillTexture}-scale-${s.fillTextureScale || 4}-thick-${s.fillTextureThickness || 1})`;
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
  const { slug, id, preview, aiMode } = router.query;
  const queryClient = useQueryClient();

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

  // Wait for router to be ready before enabling queries
  const isRouterReady = router.isReady;

  // Detect if we're in an iframe or preview mode
  useEffect(() => {
    setIsInIframe(window.self !== window.top || preview === 'true');
  }, [preview]);

  // New stores
  const setZoom = useEditorStore(s => s.setZoom);
  const setPan = useEditorStore(s => s.setPan);
  const projectAssets = useProjectStore(s => s.assets);
  const walls = useProjectStore(s => s.walls);
  const shapes = useProjectStore(s => s.shapes);
  const sceneAssets = useSceneStore((s) => s.assets);

  // Old scene store methods (for compatibility)
  const hasUnsavedChanges = useSceneStore((s) => s.hasUnsavedChanges);
  const projectHasUnsavedChanges = useProjectStore((s) => s.hasUnsavedChanges);
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
    if (isRouterReady && router.query.texture && currentEventData) {
      // Ensure the synced event matches the current route ID
      const routeId = router.query.id as string;
      const currentId = currentEventData._id || (currentEventData as any).id;

      if (currentId !== routeId) {
        console.log('[Editor] Waiting for event data sync...', { routeId, currentId });
        return;
      }

      const textureParam = router.query.texture;
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
  }, [isRouterReady, router.query, router, currentEventData]);
 
  // Handle marqueeId query param
  useEffect(() => {
    if (isRouterReady && router.query.marqueeId && currentEventData) {
      const routeId = router.query.id as string;
      const currentId = currentEventData._id || (currentEventData as any).id;
 
      if (currentId !== routeId) return;
 
      const marqueeId = Array.isArray(router.query.marqueeId) ? router.query.marqueeId[0] : router.query.marqueeId;
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
  }, [isRouterReady, router.query, currentEventData]);


  // Reset currentEventData when route changes to ensure new event loads
  useEffect(() => {
    if (isRouterReady && id && slug) {
      const eventId = id as string;
      const eventSlug = slug as string;
      console.log(`[Editor] Route changed to: ${eventSlug}/${eventId}, clearing ALL data`);

      // Clear current event data
      setCurrentEventData(null);

      // CRITICAL: Reset project store to clear localStorage data
      // This prevents loading old event data from localStorage
      const projectStore = useProjectStore.getState();
      projectStore.reset();
      projectStore.clearWorkspace();

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
            projectStore.markAsSaved();

            // DEFAULT OUTDOOR LAYOUT if empty
            if (eventData.type === 'Outdoor Venue' && shapes.length === 0 && walls.length === 0 && assets.length === 0) {
              const textureId = (router.query.texture as string) || 'sand-01';
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

          // CRITICAL: Always clear and load from database when opening an event
          // This ensures we show the actual database data, not localStorage
          console.log(`[Editor] Clearing workspace and loading from DATABASE`);
          projectStore.reset();
          projectStore.clearWorkspace();

          // Load into sceneStore (new editor) - use the store's set method
          useSceneStore.setState({ assets: eventData.canvasAssets });

          // Always load canvasAssets from database into workspace
          console.log(`[Editor] Converting canvasAssets to workspace format:`, {
            canvasAssetsCount: eventData.canvasAssets.length,
          });

          let loadedCount = 0;
          eventData.canvasAssets.forEach((asset: AssetInstance | any) => {
            if ((asset.itemType === 'dimension' || asset.type === 'dimension') && asset.startPoint && asset.endPoint) {
              const existingDimension = projectStore.dimensions.find(d => d.id === asset.id);
              if (!existingDimension) {
                projectStore.addDimension({
                  ...asset,
                  id: asset.id,
                  type: asset.dimensionType || asset.dimensionKind || 'linear',
                  startPoint: asset.startPoint,
                  endPoint: asset.endPoint,
                  offset: asset.offset || 0,
                  zIndex: asset.zIndex || 0,
                }, true);
                loadedCount++;
              }
              return;
            }

            if ((asset.itemType === 'label-arrow' || asset.type === 'label-arrow') && asset.startPoint && asset.endPoint) {
              const existingArrow = projectStore.labelArrows.find(a => a.id === asset.id);
              if (!existingArrow) {
                projectStore.addLabelArrow({
                  ...asset,
                  id: asset.id,
                  startPoint: asset.startPoint,
                  endPoint: asset.endPoint,
                  label: asset.label || '',
                  zIndex: asset.zIndex || 0,
                }, true);
                loadedCount++;
              }
              return;
            }

            // Handle wall-polygon type (new format)
            if (asset.type === 'wall-polygon') {
              const savedWall = asset.wallData || asset.wall;
              if (savedWall?.nodes?.length && savedWall?.edges?.length) {
                const existingWall = projectStore.walls.find(w => w.id === asset.id);
                if (!existingWall) {
                  projectStore.addWall({
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
                  }, true);
                  loadedCount++;
                }
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

                const existingWall = projectStore.walls.find(w => w.id === asset.id);
                if (!existingWall && wallNodes.length > 0 && wallEdges.length > 0) {
                  projectStore.addWall({
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
                  }, true);
                  loadedCount++;
                }
                return;
              }

              if (asset.wallPolygon && Array.isArray(asset.wallPolygon)) {
              // Convert wall-polygon to wall format with nodes and edges
              const wallNodes = asset.wallPolygon.map((point: any, idx: number) => ({
                id: `node-${asset.id}-${idx}`,
                x: asset.x + (point.x || 0),
                y: asset.y + (point.y || 0),
              }));

              // Create edges connecting consecutive nodes
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
                const existingWall = projectStore.walls.find(w => w.id === asset.id);
                if (!existingWall) {
                  projectStore.addWall({
                    id: asset.id,
                    name: asset.name, // RESTORE NAME
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
                  }, true);
                  loadedCount++;
                }
              }
              }
            }
            // Check if it's a wall-segments (legacy format)
            else if (asset.type === 'wall-segments' && asset.wallNodes && asset.wallEdges) {
              // Convert to Wall format
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
                const existingWall = projectStore.walls.find(w => w.id === asset.id);
                if (!existingWall) {
                  projectStore.addWall({
                    id: asset.id,
                    name: asset.name, // RESTORE NAME
                    nodes: wallNodes,
                    edges: wallEdges,
                    zIndex: asset.zIndex || 0
                  }, true);
                  loadedCount++;
                  console.log(`[Editor] ✅ Loaded wall-segments from DATABASE:`, asset.id);
                }
              }
            }
            // Handle line-segment type (convert to line shape)
            else if (asset.type === 'line-segment' && asset.startPoint && asset.endPoint) {
              // Convert line-segment to line shape format
              const startX = asset.startPoint.x || asset.x;
              const startY = asset.startPoint.y || asset.y;
              const endX = asset.endPoint.x || (asset.x + asset.width);
              const endY = asset.endPoint.y || (asset.y + asset.height);

              const existingShape = projectStore.shapes.find(s => s.id === asset.id);
              if (!existingShape) {
                projectStore.addShape({
                  id: asset.id,
                  type: 'line',
                  x: (startX + endX) / 2, // Center point
                  y: (startY + endY) / 2, // Center point
                  width: Math.sqrt(Math.pow(endX - startX, 2) + Math.pow(endY - startY, 2)), // Length
                  height: 2, // Line thickness
                  rotation: asset.rotation || 0,
                  fill: asset.backgroundColor || 'transparent',
                  stroke: asset.strokeColor || '#3B82F6',
                  strokeWidth: asset.strokeWidth ?? 2,
                  points: [
                    { x: startX - (startX + endX) / 2, y: startY - (startY + endY) / 2 },
                    { x: endX - (startX + endX) / 2, y: endY - (startY + endY) / 2 },
                  ],
                  zIndex: asset.zIndex || 0
                }, true);
                loadedCount++;
                console.log(`[Editor] ✅ Loaded line-segment from DATABASE:`, asset.id);
              }
            }
            // Handle standard shape types (rectangle, ellipse, line, arrow, freehand)
            else if (asset.type && ['rectangle', 'ellipse', 'line', 'arrow', 'freehand'].includes(asset.type)) {
              // Convert to Shape format
              const existingShape = projectStore.shapes.find(s => s.id === asset.id);
              if (!existingShape) {
                // Use reasonable defaults for missing dimensions
                const defaultWidth = asset.width || 100;
                const defaultHeight = asset.height || 100;

                projectStore.addShape({
                  ...asset, // BRING IN EVERYTHING!
                  id: asset.id,
                  name: asset.name, // RESTORE NAME
                  type: asset.type as 'rectangle' | 'ellipse' | 'line' | 'arrow' | 'freehand',
                  x: asset.x || 0,
                  y: asset.y || 0,
                  width: defaultWidth,
                  height: defaultHeight,
                  rotation: asset.rotation || 0,
                  fill: asset.fillColor || asset.backgroundColor || asset.fill || "#3B82F6",
                  stroke: asset.strokeColor || asset.stroke || "#1E40AF",
                  strokeWidth: asset.strokeWidth ?? 2,
                  points: asset.points,
                  zIndex: asset.zIndex || 0
                }, true);

                console.log(`[Editor] ✅ Loaded ${asset.type} shape from DATABASE:`, {
                  id: asset.id,
                  x: asset.x,
                  y: asset.y,
                  width: defaultWidth,
                  height: defaultHeight,
                });
                loadedCount++;
              }
            } else if (asset.type) {
              // Convert to Asset format - load furniture/assets from database
              const existingAsset = projectStore.assets.find(a => a.id === asset.id);
              if (!existingAsset) {
                // Use reasonable defaults based on asset type
                // Chairs and tables typically need larger dimensions to be visible
                let defaultWidth = asset.width || 100;
                let defaultHeight = asset.height || 100;

                // Set better defaults for common asset types
                if (asset.type.includes('chair')) {
                  defaultWidth = asset.width || 80;
                  defaultHeight = asset.height || 80;
                } else if (asset.type.includes('table') || asset.type.includes('cocktail')) {
                  defaultWidth = asset.width || 200;
                  defaultHeight = asset.height || 200;
                }

                projectStore.addAsset({
                  ...asset, // BRING IN EVERYTHING!
                  id: asset.id,
                  name: asset.name, // RESTORE NAME
                  type: asset.type,
                  x: asset.x || 0,
                  y: asset.y || 0,
                  width: defaultWidth,
                  height: defaultHeight,
                  rotation: asset.rotation || 0,
                  scale: asset.scale || 1,
                  zIndex: asset.zIndex || 0,
                }, true);

                console.log(`[Editor] ✅ Loaded asset from DATABASE:`, {
                  id: asset.id,
                  type: asset.type,
                  x: asset.x,
                  y: asset.y,
                  width: defaultWidth,
                  height: defaultHeight,
                });
                loadedCount++;
              }
            }
          });

          console.log(`[Editor] ✅ Loaded ${loadedCount} items from DATABASE into workspace`);
          console.log(`[Editor] Workspace state after load:`, {
            walls: projectStore.walls.length,
            shapes: projectStore.shapes.length,
            assets: projectStore.assets.length,
          });
          projectStore.markAsSaved();
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
            hasUnsavedChanges: true,
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
        }, 300);

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
      if (
        !parsed ||
        parsed.version !== LOCAL_DRAFT_VERSION ||
        parsed.eventId !== id ||
        parsed.slug !== slug ||
        !parsed.data
      ) {
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
  }, [currentEventData, id, slug]);

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

    return (
      <div className={`${isPreviewMode ? 'h-full w-full' : 'h-screen'} flex overflow-hidden bg-gray-50`}>
        {/* Dashboard Sidebar - only show if not in preview mode */}
        {!isPreviewMode && <DashboardSidebar />}

        <div className="flex-1 flex overflow-hidden">
          {/* Elements Pane - only show if not in preview mode */}
          {!isPreviewMode && (
            <div className="w-40 bg-white border-r border-gray-200 flex-shrink-0 shadow-sm">
              <ElementsPane />
            </div>
          )}

          <div className="flex-1 flex flex-col overflow-hidden">
            {!isPreviewMode && (
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
                    <Workspace2D />
                  </div>
                )}

                {/* 3D Preview / toggle removed per request */}
              </div>

              {/* Properties Sidebar - only show if not in preview mode */}
              {!isPreviewMode && (
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
