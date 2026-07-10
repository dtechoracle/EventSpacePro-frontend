"use client";

import React, { useState, useEffect, useMemo } from "react";
import { FaUserCircle, FaChevronDown, FaChevronRight, FaAlignLeft, FaAlignCenter, FaAlignRight, FaArrowUp, FaArrowDown, FaArrowsAltV, FaArrowsAltH, FaCircleNotch, FaBold, FaItalic, FaUnderline, FaHighlighter, FaTimes, FaExpand, FaPlus } from "react-icons/fa";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/helpers/Config";

import { IoPlayOutline } from "react-icons/io5";
import ShareModal from "./ShareModal";
import ExportPanel from "./ExportPanel";
import { useSceneStore } from "@/store/sceneStore";
import { useEditorStore } from "@/store/editorStore";
import { useProjectStore } from "@/store/projectStore";
import { texturePatterns } from '@/utils/texturePatterns';
import { useRouter } from "next/router";
import { useUserStore } from "@/store/userStore";
import toast from "react-hot-toast";
import { convertAssetToShapes } from "@/utils/assetUtils";
import LineTypeSelector from "@/components/ui/LineTypeSelector";
import { fromStoreValue, toStoreValue, getUnitLabel, UnitSystem } from '@/lib/units';
import { TEXT_STYLE_FONTS, ensureGoogleFontsLoaded, getFontDisplayName } from "@/utils/googleFonts";

type TableNumberingMode = 'manual' | 'auto';
type TableNumberingPattern = 'linear' | 's-direction';
type TableNumberingDirection =
  | 'from-top-right-to-left'
  | 'from-bottom-right-to-left'
  | 'from-top-left-to-right'
  | 'from-bottom-left-to-right'
  | 'radial';

type NumberableTable = {
  id: string;
  type: 'asset' | 'shape';
  x: number;
  y: number;
  name?: string;
  label: string;
};

const TABLE_NUMBERING_SETTINGS_KEY = 'eventspacepro-table-numbering-settings';

const isTableLike = (item: any) => {
  const haystack = [
    item?.type,
    item?.name,
    item?.label,
    item?.tableName,
  ].filter(Boolean).join(' ').toLowerCase();
  return haystack.includes('table');
};

const isStageLike = (item: any) => {
  const haystack = [
    item?.type,
    item?.name,
    item?.label,
  ].filter(Boolean).join(' ').toLowerCase();
  return haystack.includes('stage');
};

const getTableLabel = (item: any, fallback: string) => {
  return item?.name || item?.label || item?.type || fallback;
};

const getStageAnchor = (assets: any[], shapes: any[]) => {
  const stageItems = [
    ...assets.filter(isStageLike).map((item) => ({ x: item.x, y: item.y })),
    ...shapes.filter(isStageLike).map((item) => ({ x: item.x, y: item.y })),
  ];

  if (stageItems.length === 0) return null;

  return {
    x: stageItems.reduce((sum, item) => sum + item.x, 0) / stageItems.length,
    y: stageItems.reduce((sum, item) => sum + item.y, 0) / stageItems.length,
  };
};

const getOrderedTablesForNumbering = (
  tables: NumberableTable[],
  direction: TableNumberingDirection,
  pattern: TableNumberingPattern,
  stageAnchor: { x: number; y: number } | null
) => {
  if (tables.length <= 1) return tables;

  const anchor = stageAnchor || {
    x: tables.reduce((sum, table) => sum + table.x, 0) / tables.length,
    y: tables.reduce((sum, table) => sum + table.y, 0) / tables.length,
  };

  const distanceToAnchor = (table: NumberableTable) => Math.hypot(table.x - anchor.x, table.y - anchor.y);

  if (direction === 'radial') {
    return [...tables].sort((a, b) => {
      const distanceDelta = distanceToAnchor(a) - distanceToAnchor(b);
      if (Math.abs(distanceDelta) > 20) return distanceDelta;

      const angleA = Math.atan2(a.y - anchor.y, a.x - anchor.x);
      const angleB = Math.atan2(b.y - anchor.y, b.x - anchor.x);
      return angleA - angleB;
    });
  }

  const fromBottom = direction.startsWith('from-bottom');
  const leftToRight = direction.endsWith('left-to-right');
  const minX = Math.min(...tables.map((table) => table.x));
  const maxX = Math.max(...tables.map((table) => table.x));
  const minY = Math.min(...tables.map((table) => table.y));
  const maxY = Math.max(...tables.map((table) => table.y));
  const clusterSize = Math.max(250, Math.min(2500, Math.max(maxX - minX, maxY - minY) / Math.max(1, Math.sqrt(tables.length))));
  const groupedTables = new Map<number, NumberableTable[]>();

  tables.forEach((table) => {
    const key = Math.round(table.y / clusterSize);
    const current = groupedTables.get(key) || [];
    current.push(table);
    groupedTables.set(key, current);
  });

  const rowGroups = Array.from(groupedTables.entries())
    .map(([key, group]) => ({
      key,
      group,
      y: group.reduce((sum, table) => sum + table.y, 0) / group.length,
      stageDistance: stageAnchor ? Math.min(...group.map(distanceToAnchor)) : Infinity,
    }))
    .sort((a, b) => fromBottom ? b.y - a.y : a.y - b.y);

  if (stageAnchor) {
    rowGroups.sort((a, b) => {
      const stageDelta = a.stageDistance - b.stageDistance;
      if (Math.abs(stageDelta) > 20) return stageDelta;
      return fromBottom ? b.y - a.y : a.y - b.y;
    });
  }

  return rowGroups.flatMap((row, rowIndex) => {
    const orderedGroup = [...row.group].sort((a, b) => leftToRight ? a.x - b.x : b.x - a.x);

    const shouldReverse = pattern === 's-direction' && rowIndex % 2 === 1;
    const directionalGroup = shouldReverse ? orderedGroup.reverse() : orderedGroup;

    if (!stageAnchor || rowIndex !== 0) return directionalGroup;

    const closestIndex = directionalGroup.reduce((bestIndex, table, index) => {
      return distanceToAnchor(table) < distanceToAnchor(directionalGroup[bestIndex]) ? index : bestIndex;
    }, 0);

    return [
      ...directionalGroup.slice(closestIndex),
      ...directionalGroup.slice(0, closestIndex),
    ];
  });
};

export default function PropertiesSidebar(): React.JSX.Element {
  const selectedIds = useEditorStore(s => s.selectedIds);
  const activeTool = useEditorStore(s => s.activeTool);
  const dimensionType = useEditorStore(s => s.dimensionType);
  const toggleEditorGrid = useEditorStore(s => s.toggleGrid);
  const setEditorGridSize = useEditorStore(s => s.setGridSize);
  const shapes = useProjectStore(s => s.shapes);
  const assets = useProjectStore(s => s.assets);
  const walls = useProjectStore(s => s.walls);
  const textAnnotations = useProjectStore(s => s.textAnnotations);
  const labelArrows = useProjectStore(s => s.labelArrows);
  const dimensions = useProjectStore(s => s.dimensions);
  const groups = useProjectStore(s => s.groups);
  const comments = useProjectStore(s => s.comments);
  const resolveComment = useProjectStore(s => s.resolveComment);
  const removeComment = useProjectStore(s => s.removeComment);
  const updateShape = useProjectStore(s => s.updateShape);
  const updateAsset = useProjectStore(s => s.updateAsset);
  const updateWall = useProjectStore(s => s.updateWall);
  const updateTextAnnotation = useProjectStore(s => s.updateTextAnnotation);
  const updateLabelArrow = useProjectStore(s => s.updateLabelArrow);
  const updateDimension = useProjectStore(s => s.updateDimension);
  const updateShapeBatch = useProjectStore(s => s.updateShapeBatch);
  const updateAssetBatch = useProjectStore(s => s.updateAssetBatch);
  const updateWallBatch = useProjectStore(s => s.updateWallBatch);
  const batchUpdateItems = useProjectStore(s => s.batchUpdateItems);
  const isSaving = useProjectStore(s => s.isSaving);
  const lastSaved = useProjectStore(s => s.lastSaved);
  const saveEvent = useProjectStore(s => s.saveEvent);
  const hasUnsavedChanges = useProjectStore(s => s.hasUnsavedChanges);
  const projectName = useProjectStore(s => s.projectName);
  const setProjectName = useProjectStore(s => s.setProjectName);
  const globalTableNumberingPosition = useProjectStore(s => s.globalTableNumberingPosition);
  const globalTableNumberingOrientation = useProjectStore(s => s.globalTableNumberingOrientation);
  const globalTableNumberingFontSize = useProjectStore(s => s.globalTableNumberingFontSize);
  const globalTableNumberingFontFamily = useProjectStore(s => s.globalTableNumberingFontFamily);
  const globalTableNumberingFontWeight = useProjectStore(s => s.globalTableNumberingFontWeight);
  const globalTableNumberingFontStyle = useProjectStore(s => s.globalTableNumberingFontStyle);
  const globalTableNumberingTextDecoration = useProjectStore(s => s.globalTableNumberingTextDecoration);
  const globalTableNumberingColor = useProjectStore(s => s.globalTableNumberingColor);
  const setGlobalTableNumberingPosition = useProjectStore(s => s.setGlobalTableNumberingPosition);
  const setGlobalTableNumberingOrientation = useProjectStore(s => s.setGlobalTableNumberingOrientation);
  const setGlobalTableNumberingTextStyle = useProjectStore(s => s.setGlobalTableNumberingTextStyle);

  const [startingNumber, setStartingNumber] = useState(1);
  const [isNumberingEnabled, setIsNumberingEnabled] = useState(false);
  const [numberingMode, setNumberingMode] = useState<TableNumberingMode>('auto');
  const [numberingPattern, setNumberingPattern] = useState<TableNumberingPattern>('linear');
  const [numberingDirection, setNumberingDirection] = useState<TableNumberingDirection>('from-top-left-to-right');
  const [activeInspectorTab, setActiveInspectorTab] = useState<'comments' | 'properties'>('properties');
  const textStyleFonts = TEXT_STYLE_FONTS;

  // Local state to prevent cursor jumping when typing text annotations
  const [localTextProps, setLocalTextProps] = useState({ id: "", text: "" });

  // Resolve the single selected item
  const selectedId = selectedIds.length === 1 ? selectedIds[0] : null;

  // Multi-selection logic
  const isMultiSelection = selectedIds.length > 1;
  const selectedIdSet = useMemo(() => new Set(selectedIds), [selectedIds]);

  // Calculate collective bounding box for multi-selection or single item
  const getCollectiveBounds = () => {
    if (selectedIds.length === 0) return null;

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

    selectedIds.forEach(id => {
      const shape = shapes.find(s => s.id === id);
      if (shape) {
        const halfW = shape.width / 2;
        const halfH = shape.height / 2;
        const rot = (shape.rotation || 0) * (Math.PI / 180);
        const cosR = Math.cos(rot);
        const sinR = Math.sin(rot);
        const corners = [
          { x: -halfW, y: -halfH }, { x: halfW, y: -halfH },
          { x: halfW, y: halfH }, { x: -halfW, y: halfH }
        ].map(c => ({
          x: shape.x + c.x * cosR - c.y * sinR,
          y: shape.y + c.x * sinR + c.y * cosR
        }));
        corners.forEach(c => {
          minX = Math.min(minX, c.x); minY = Math.min(minY, c.y);
          maxX = Math.max(maxX, c.x); maxY = Math.max(maxY, c.y);
        });
        return;
      }
      const asset = assets.find(a => a.id === id);
      if (asset) {
        const width = asset.width * (asset.scale || 1);
        const height = asset.height * (asset.scale || 1);
        const halfW = width / 2;
        const halfH = height / 2;
        const rot = (asset.rotation || 0) * (Math.PI / 180);
        const cosR = Math.cos(rot);
        const sinR = Math.sin(rot);
        const corners = [
          { x: -halfW, y: -halfH }, { x: halfW, y: -halfH },
          { x: halfW, y: halfH }, { x: -halfW, y: halfH }
        ].map(c => ({
          x: asset.x + c.x * cosR - c.y * sinR,
          y: asset.y + c.x * sinR + c.y * cosR
        }));
        corners.forEach(c => {
          minX = Math.min(minX, c.x); minY = Math.min(minY, c.y);
          maxX = Math.max(maxX, c.x); maxY = Math.max(maxY, c.y);
        });
        return;
      }
      const wall = walls.find(w => w.id === id);
      if (wall) {
        wall.nodes.forEach(n => {
          minX = Math.min(minX, n.x); minY = Math.min(minY, n.y);
          maxX = Math.max(maxX, n.x); maxY = Math.max(maxY, n.y);
        });
        return;
      }
      const text = textAnnotations.find(t => t.id === id);
      if (text) {
        const fs = text.fontSize || 14;
        const w = (text.text.length || 1) * fs * 0.6;
        const h = fs * 1.2;
        minX = Math.min(minX, text.x); minY = Math.min(minY, text.y - h / 2);
        maxX = Math.max(maxX, text.x + w); maxY = Math.max(maxY, text.y + h / 2);
      }
    });

    if (minX === Infinity) return null;
    return {
      x: (minX + maxX) / 2,
      y: (minY + maxY) / 2,
      width: maxX - minX,
      height: maxY - minY
    };
  };

  const collectiveBounds = getCollectiveBounds();

  const selectedShape = selectedId ? shapes.find(s => s.id === selectedId) : null;
  const selectedAsset = selectedId ? assets.find(a => a.id === selectedId) : null;
  const selectedWall = selectedId ? walls.find(w => w.id === selectedId) : null;
  const selectedTextAnnotation = selectedId ? textAnnotations.find(t => t.id === selectedId) : null;
  const selectedLabelArrow = selectedId ? labelArrows.find(l => l.id === selectedId) : null;
  const selectedDimension = selectedId ? dimensions.find(d => d.id === selectedId) : null;

  const selectedItem = selectedShape || selectedAsset || selectedWall || selectedTextAnnotation || selectedLabelArrow || selectedDimension;
  const itemType = selectedShape ? 'shape' : selectedWall ? 'wall' : (selectedAsset?.type === 'wall-segments') ? 'wall' : selectedAsset ? 'asset' : selectedTextAnnotation ? 'text-annotation' : selectedLabelArrow ? 'label-arrow' : selectedDimension ? 'dimension' : null;

  const selectedShapes = useMemo(
    () => shapes.filter(s => selectedIdSet.has(s.id)),
    [shapes, selectedIdSet]
  );
  const selectedAssets = useMemo(
    () => assets.filter(a => selectedIdSet.has(a.id)),
    [assets, selectedIdSet]
  );
  const allSelectedAreShapes = isMultiSelection && selectedShapes.length === selectedIds.length;

  const showGrid = useSceneStore((s) => s.showGrid);
  const toggleGrid = useSceneStore((s) => s.toggleGrid);
  const availableGridSizes = useSceneStore((s) => s.availableGridSizes);
  const selectedGridSizeIndex = useSceneStore((s) => s.selectedGridSizeIndex);
  const setSelectedGridSizeIndex = useSceneStore((s) => s.setSelectedGridSizeIndex);
  const snapToGridEnabled = useSceneStore((s) => s.snapToGridEnabled);
  const toggleSnapToGrid = useSceneStore((s) => s.toggleSnapToGrid);
  const updateSceneAsset = useSceneStore((s) => s.updateAsset);
  const unitSystem = useSceneStore((s) => s.unitSystem) || 'metric-mm';
  const unitLabel = getUnitLabel(unitSystem);

  useEffect(() => {
    ensureGoogleFontsLoaded(textStyleFonts);
  }, [textStyleFonts]);

  // Sync local text annotation state when selection changes
  // Keep local props in sync with store selection and real-time edits from the workspace
  useEffect(() => {
    if (itemType === 'text-annotation' && selectedTextAnnotation) {
      if (localTextProps.id !== selectedTextAnnotation.id || localTextProps.text !== selectedTextAnnotation.text) {
        // Only update if not currently focused to avoid cursor jumps in the sidebar itself
        const isSidebarFocused = document.activeElement?.tagName === 'TEXTAREA' && 
                                 document.activeElement.closest('.properties-sidebar');
        if (!isSidebarFocused) {
          setLocalTextProps({ id: selectedTextAnnotation.id, text: selectedTextAnnotation.text || "" });
        }
      }
    }
  }, [itemType, selectedTextAnnotation, localTextProps.id, localTextProps.text]);

  const tableNumberingItems = useMemo<NumberableTable[]>(() => {
    const tables = [
      ...assets
        .filter(isTableLike)
        .map((asset, index) => ({
          id: asset.id,
          type: 'asset' as const,
          x: asset.x,
          y: asset.y,
          name: asset.tableName,
          label: getTableLabel(asset, `Table ${index + 1}`),
        })),
      ...shapes
        .filter(isTableLike)
        .map((shape, index) => ({
          id: shape.id,
          type: 'shape' as const,
          x: shape.x,
          y: shape.y,
          name: shape.tableName,
          label: getTableLabel(shape, `Table ${index + 1}`),
        })),
    ];

    return getOrderedTablesForNumbering(
      tables,
      numberingDirection,
      numberingPattern,
      getStageAnchor(assets, shapes)
    );
  }, [assets, shapes, numberingDirection, numberingPattern]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    try {
      const rawSettings = window.localStorage.getItem(TABLE_NUMBERING_SETTINGS_KEY);
      if (!rawSettings) return;

      const settings = JSON.parse(rawSettings);
      if (settings.mode === 'manual' || settings.mode === 'auto') setNumberingMode(settings.mode);
      if (typeof settings.enabled === 'boolean') setIsNumberingEnabled(settings.enabled);
      if (settings.pattern === 'linear' || settings.pattern === 's-direction') setNumberingPattern(settings.pattern);
      if ([
        'from-top-right-to-left',
        'from-bottom-right-to-left',
        'from-top-left-to-right',
        'from-bottom-left-to-right',
        'radial',
      ].includes(settings.direction)) {
        setNumberingDirection(settings.direction);
      }
      if (Number.isFinite(Number(settings.startingNumber))) {
        setStartingNumber(Math.max(1, Number(settings.startingNumber)));
      }
    } catch {
      // Ignore invalid persisted numbering settings.
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    window.localStorage.setItem(TABLE_NUMBERING_SETTINGS_KEY, JSON.stringify({
      mode: numberingMode,
      enabled: isNumberingEnabled,
      pattern: numberingPattern,
      direction: numberingDirection,
      startingNumber,
    }));
  }, [numberingMode, isNumberingEnabled, numberingPattern, numberingDirection, startingNumber]);

  // ── AUTO-NUMBERING EFFECT ──────────────────────────────────────────────────
  useEffect(() => {
    if (!isNumberingEnabled || numberingMode !== 'auto') return;
    if (tableNumberingItems.length === 0) return;

    // Only apply if the current numbering differs from the intended one
    const updates = tableNumberingItems.map((t, idx) => {
      const expectedName = String(startingNumber + idx);
      if (t.name !== expectedName) {
        return { id: t.id, type: t.type, updates: { tableName: expectedName } };
      }
      return null;
    }).filter(u => u !== null) as any[];

    if (updates.length > 0) {
      batchUpdateItems(updates);
    }
  }, [
    isNumberingEnabled, 
    numberingMode,
    numberingPattern,
    numberingDirection, 
    startingNumber, 
    tableNumberingItems,
    batchUpdateItems
  ]);

  const handleToggleGrid = () => {
    toggleGrid();
    toggleEditorGrid();
  };

  const handleToggleSnapToGrid = () => {
    const nextState = !snapToGridEnabled;
    useEditorStore.getState().setSnapToGrid(nextState);
    useSceneStore.getState().setSnapToGridEnabled(nextState);
  };

  const syncToScene = (id: string, updates: any) => {
    const assetUpdates: any = { ...updates };
    if (updates.fill) assetUpdates.fillColor = updates.fill;
    if (updates.edges && updates.edges[0]?.thickness) assetUpdates.wallThickness = updates.edges[0].thickness;
    if (updates.nodes) assetUpdates.wallNodes = updates.nodes;
    updateSceneAsset(id, assetUpdates);
  };


  const handleSetGridSize = (index: number) => {
    setSelectedGridSizeIndex(index);
    const size = availableGridSizes?.[index] || 10;
    setEditorGridSize(size);
  };

  // Wall drawing state
  const wallDrawingMode = useSceneStore((s) => s.wallDrawingMode);
  const currentWallSegments = useSceneStore((s) => s.currentWallSegments);
  const finishWallDrawing = useSceneStore((s) => s.finishWallDrawing);
  const cancelWallDrawing = useSceneStore((s) => s.cancelWallDrawing);

  const [showModel, setShowModel] = useState(true);
  const [showCanvas, setShowCanvas] = useState(true);
  const [showShareModal, setShowShareModal] = useState(false);
  const [showMoveModal, setShowMoveModal] = useState(false);
  const [modelName, setModelName] = useState<string>("");
  const [targetProjectSlug, setTargetProjectSlug] = useState('');
  const open3D = useSceneStore((s) => s.open3DOverlay);

  const [distributeSpacing, setDistributeSpacing] = useState(100);
  const [radialDiameter, setRadialDiameter] = useState(500);
  const [isFontDropdownOpen, setIsFontDropdownOpen] = useState(false);
  const [isArrowHeadDropdownOpen, setIsArrowHeadDropdownOpen] = useState(false);
  const [isArrowTailDropdownOpen, setIsArrowTailDropdownOpen] = useState(false);

  const user = useUserStore((s) => s.user);

  const getUserName = () => {
    if (!user) return "";
    const firstName = user.firstName || "";
    const lastName = user.lastName || "";
    return `${firstName} ${lastName}`.trim() || user.email || "";
  };

  const userName = getUserName();





  useEffect(() => {
    if (userName && !modelName && !projectName) {
      setModelName(userName);
      setProjectName(userName);
    } else if (projectName && !modelName) {
      setModelName(projectName);
    }
  }, [userName, modelName, projectName, setProjectName]);



  const router = useRouter();
  const { id, slug } = router.query;

  const { data: projectData } = useQuery({
    queryKey: ["project-collaborators", slug],
    queryFn: async () => {
      if (!slug) return null;
      try {
        const res = await apiRequest(`/projects/${slug}`, "GET", null, true).catch(async () => {
          const allRes = await apiRequest("/projects", "GET", null, true);
          return allRes.data.find((p: any) => p.slug === slug);
        });
        return res.data || res;
      } catch (err) {
        console.error("Failed to fetch project for collaborators:", err);
        return null;
      }
    },
    enabled: !!slug,
  });

  const collaborators = useMemo(() => {
    if (!projectData) return [];
    const active = (projectData.users || []).map((u: any) => ({
      email: u.email,
      name: u.user?.firstName || u.email.split('@')[0],
      avatar: u.user?.avatar,
      isPending: false
    })).filter((c: any) => c.email !== user?.email);

    const pending = (projectData.invites || []).map((i: any) => ({
      email: i.email,
      name: i.email.split('@')[0],
      isPending: true
    }));
    return [...active, ...pending];
  }, [projectData, user?.email]);

  const getAvatarColor = (name: string) => {
    const colors = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#06B6D4', '#F97316'];
    const index = (name.charCodeAt(0) || 0) % colors.length;
    return colors[index];
  };

  const handleSave = async () => {
    if (id && typeof id === 'string' && slug && typeof slug === 'string') {
      await saveEvent(id, slug);
    }
  };

  const [canvasName, setCanvasName] = useState<string>("");

  const roundForDisplay = (num: number, isValueFromStore = true) => {
    const val = isValueFromStore ? fromStoreValue(num, unitSystem) : num;
    return Math.round(val * 100) / 100;
  };

  return (
    <aside className="h-screen flex flex-col border-l border-slate-200 bg-[#fcfcfd] text-sm text-slate-900">
      {showShareModal && (
        <ShareModal onClose={() => setShowShareModal(false)} slug={slug as string} />
      )}

      <div className="sticky top-0 z-20 border-b border-slate-200 bg-[#fcfcfd]/95 px-3 pb-3 pt-3 backdrop-blur">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold text-slate-900">
              {projectName || "Untitled Event"}
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button
              className={`rounded-lg border px-2.5 py-1.5 text-[11px] font-semibold transition-colors flex items-center gap-1.5 ${
                hasUnsavedChanges
                  ? "border-blue-600 bg-white text-blue-600 hover:bg-blue-50"
                  : "border-slate-200 bg-white text-slate-500 hover:bg-slate-50"
              } ${isSaving ? "cursor-not-allowed opacity-50" : ""}`}
              onClick={handleSave}
              disabled={isSaving}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  isSaving ? 'bg-blue-500 animate-pulse' : hasUnsavedChanges ? 'bg-amber-400' : 'bg-emerald-500'
                }`}
              />
              {isSaving ? "Saving..." : hasUnsavedChanges ? "Save" : "Saved"}
            </button>
            <button
              className="rounded-lg border border-slate-200 bg-white p-2 text-slate-500 transition-colors hover:bg-slate-50"
              onClick={() => open3D && open3D()}
              title="Preview in 3D"
            >
              <IoPlayOutline size={14} />
            </button>
            <button
              className="rounded-lg bg-[var(--accent)] px-3 py-2 text-[11px] font-semibold text-white transition-opacity hover:opacity-90"
              onClick={() => setShowShareModal(true)}
            >
              Share
            </button>
          </div>
        </div>

        <div className="mb-3 border-b border-slate-200 pb-3">
          <div className="flex items-center justify-between gap-3">
            <div
              className="flex min-w-0 items-center group cursor-pointer"
              onClick={() => setShowShareModal(true)}
            >
              <div className="flex -space-x-3 transition-all duration-300">
                <div
                  className="relative z-40 inline-block h-6 w-6 rounded-full bg-[#272235] text-xs font-bold text-white ring-2 ring-white shadow-sm transition-transform group-hover:scale-105"
                  title={`${userName} (You)`}
                >
                  {user?.avatar ? (
                    <img src={user.avatar} className="h-full w-full rounded-full object-cover" />
                  ) : (
                    <span className="flex h-full w-full items-center justify-center">
                      {user?.firstName?.charAt(0) || user?.email?.charAt(0).toUpperCase() || 'Y'}
                    </span>
                  )}
                  <div className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-white bg-green-500"></div>
                </div>

                {collaborators.map((collab, idx) => (
                  <div
                    key={collab.email}
                    className={`relative inline-block h-6 w-6 rounded-full text-[9px] font-bold text-white ring-2 ring-white shadow-sm transition-all duration-300 group-hover:translate-x-1 ${collab.isPending ? 'opacity-80' : ''}`}
                    style={{
                      backgroundColor: getAvatarColor(collab.email),
                      zIndex: 30 - idx,
                      border: collab.isPending ? '2px dashed #d1d5db' : 'none'
                    }}
                    title={`${collab.name}${collab.isPending ? ' (Pending)' : ''}`}
                  >
                    {collab.avatar ? (
                      <img src={collab.avatar} className="h-full w-full rounded-full object-cover" />
                    ) : (
                      <span className="flex h-full w-full items-center justify-center">
                        {collab.name.charAt(0).toUpperCase()}
                      </span>
                    )}
                    {collab.isPending && (
                      <div className="absolute -right-1 -top-1 h-3 w-3 rounded-full border-2 border-white bg-amber-400" title="Invitation Pending"></div>
                    )}
                  </div>
                ))}

                {collaborators.length > 5 && (
                  <div
                    className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-slate-50 text-[8px] font-bold text-slate-400 ring-2 ring-white"
                    title={`+${collaborators.length - 5} more`}
                  >
                    +{collaborators.length - 5}
                  </div>
                )}
              </div>

              <div className="ml-4 min-w-0">
                <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                  Collaborators
                </div>
                <div className="truncate text-xs text-slate-600">
                  Manage access and workspace visibility
                </div>
              </div>
            </div>
            <button
              className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-slate-50 text-slate-400 transition-all duration-300 hover:bg-slate-900 hover:text-white hover:shadow-lg"
              onClick={(e) => {
                e.stopPropagation();
                setShowShareModal(true);
              }}
              title="Add collaborator"
            >
              <FaPlus size={10} />
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between gap-3">
          <div className="inline-flex rounded-xl border border-slate-200 bg-white p-1">
            <button
              type="button"
              onClick={() => setActiveInspectorTab('comments')}
              className={`rounded-lg px-3 py-1.5 text-[11px] font-medium transition-colors ${
                activeInspectorTab === 'comments'
                  ? 'border border-blue-100 bg-blue-50 text-[var(--accent)] shadow-sm'
                  : 'text-slate-400'
              }`}
            >
              Comments
            </button>
            <button
              type="button"
              onClick={() => setActiveInspectorTab('properties')}
              className={`rounded-lg px-3 py-1.5 text-[11px] font-medium transition-colors ${
                activeInspectorTab === 'properties'
                  ? 'border border-blue-100 bg-blue-50 text-[var(--accent)] shadow-sm'
                  : 'text-slate-400'
              }`}
            >
              Properties
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-3 pb-24 pt-4">
      {activeInspectorTab === 'comments' && (
        <div className="mb-4 space-y-2">
          {comments.length === 0 ? (
            <div className="px-1 py-3 text-sm text-slate-500">
              No comments added yet.
            </div>
          ) : (
            comments
              .slice()
              .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))
              .map((comment) => (
                <div key={comment.id} className="border-b border-slate-200 pb-2 pt-1 last:border-b-0">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-[11px] font-semibold text-slate-800">{comment.author || 'Unknown'}</div>
                      <div className="mt-0.5 text-[10px] text-slate-400">
                        {comment.timestamp ? new Date(comment.timestamp).toLocaleString() : 'No timestamp'}
                      </div>
                    </div>
                  </div>
                  <div className="mt-2 whitespace-pre-wrap text-[12px] leading-5 text-slate-700">
                    {comment.content || 'Empty comment'}
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    {!comment.resolved && (
                      <button
                        type="button"
                        onClick={() => resolveComment(comment.id)}
                        className="rounded-md border border-slate-200 px-2 py-1 text-[10px] font-medium text-slate-600 transition-colors hover:bg-slate-50"
                      >
                        Resolved
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => removeComment(comment.id)}
                      className="rounded-md border border-rose-200 px-2 py-1 text-[10px] font-medium text-rose-600 transition-colors hover:bg-rose-50"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))
          )}
        </div>
      )}
      <div className={activeInspectorTab === 'comments' ? 'hidden' : ''}>
      {/* Grouping Controls Removed as per request (moved to Context Menu) */}

      {/* Dimension Tool Properties - Show when tool is active */}
      {activeTool === 'dimension' && (
        <div className="mb-6 p-4 bg-white rounded-xl shadow-sm border border-gray-100">
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
            Line Style
          </h3>
          <div className="grid grid-cols-3 gap-2">
            {(['solid', 'dashed', 'dotted', 'double'] as const).map((style) => (
              <button
                key={style}
                onClick={() => {
                  if (itemType === 'dimension' && selectedDimension) {
                    updateDimension(selectedDimension.id, { lineStyle: style });
                  }
                }}
                className={`px-3 py-2 text-sm rounded-lg border transition-all ${selectedDimension?.lineStyle === style || (!selectedDimension?.lineStyle && style === 'solid')
                  ? "bg-blue-50 border-blue-200 text-blue-600 font-medium"
                  : "bg-white border-gray-200 text-gray-600 hover:border-gray-300"
                  }`}
              >
                {style.charAt(0).toUpperCase() + style.slice(1)}
              </button>
            ))}
          </div>
          <div className="mt-3 text-xs text-gray-500 leading-relaxed">
            Choose the visual style of the dimension line.

            {dimensionType === 'aligned' && "Measure direct point-to-point distance."}
            {dimensionType === 'angular' && "Measure angle (Center → Start → End)."}
            {dimensionType === 'radial' && "Measure radius (Center → Circle Edge)."}
          </div>
        </div>
      )}

      {/* Model Section */}
      <div className="mb-4 border-b border-slate-200 pb-2">
        <button
          className="flex w-full items-center justify-between px-0 py-3 text-left"
          onClick={() => setShowModel((s) => !s)}
        >
          <div className="text-sm font-bold text-blue-600">
            Workspace
          </div>
          {showModel ? <FaChevronDown size={12} className="text-blue-600" /> : <FaChevronRight size={12} className="text-blue-600" />}
        </button>
        {showModel && (
          <div className="space-y-3 border-t border-slate-100 px-0 pb-4 pt-3 text-xs">
            <div className="flex justify-between items-center">
              <span className="text-black">Event Name</span>
              <input
                type="text"
                value={projectName || ""}
                placeholder="New Event"
                onChange={(e) => {
                  setProjectName(e.target.value);
                  setModelName(e.target.value);
                }}
                className="sidebar-input"
              />
            </div>
            <div className="flex justify-between items-center">
              <span className="w-full">Owner</span>
              <span className="font-medium w-full">{userName || "Not logged in"}</span>
            </div>

            {/* Alignment & Distribution - Only when multiple items selected OR single group selected */}
            {(selectedIds.length > 1 || (selectedIds.length === 1 && useProjectStore.getState().groups.find(g => g.id === selectedIds[0]))) && (
              <div className="border-t border-gray-100 pt-3 mt-2">
                <div className="text-xs font-semibold mb-2 text-gray-600">Alignment</div>
                <div className="flex gap-1 mb-3 justify-between">
                  <button onClick={() => useProjectStore.getState().alignSelection('left', selectedIds)} className="p-1.5 hover:bg-gray-100 rounded" title="Align Left"> <FaAlignLeft /> </button>
                  <button onClick={() => useProjectStore.getState().alignSelection('center', selectedIds)} className="p-1.5 hover:bg-gray-100 rounded" title="Align Center"> <FaAlignCenter /> </button>
                  <button onClick={() => useProjectStore.getState().alignSelection('right', selectedIds)} className="p-1.5 hover:bg-gray-100 rounded" title="Align Right"> <FaAlignRight /> </button>
                  <div className="w-px bg-gray-200 mx-1"></div>
                  <button onClick={() => useProjectStore.getState().alignSelection('top', selectedIds)} className="p-1.5 hover:bg-gray-100 rounded" title="Align Top"> <FaArrowUp className="transform rotate-0" /> </button>
                  <button onClick={() => useProjectStore.getState().alignSelection('middle', selectedIds)} className="p-1.5 hover:bg-gray-100 rounded" title="Align Middle"> <FaArrowsAltV /> </button>
                  <button onClick={() => useProjectStore.getState().alignSelection('bottom', selectedIds)} className="p-1.5 hover:bg-gray-100 rounded" title="Align Bottom"> <FaArrowDown /> </button>
                </div>

                <div className="text-xs font-semibold mb-2 text-gray-600">Distribution</div>
                <div className="flex flex-col gap-2">
                  {/* Linear Distribution */}
                  <div className="grid grid-cols-2 gap-2 items-end">
                    <div className="flex flex-col">
                      <span className="text-[10px] text-gray-400 uppercase font-semibold mb-0.5">Linear Gap ({unitLabel})</span>
                      <input
                        type="number"
                        value={roundForDisplay(distributeSpacing, false)}
                        onChange={(e) => setDistributeSpacing(Number(e.target.value))}
                        className="sidebar-input w-full text-center font-medium"
                        placeholder="Gap"
                      />
                    </div>
                    <div className="flex gap-1 ml-auto pb-1">
                      <button onClick={() => useProjectStore.getState().distributeSelection('horizontal', toStoreValue(distributeSpacing, unitSystem), selectedIds)} className="p-1.5 hover:bg-gray-100 rounded" title="Distribute Horizontally"> <FaArrowsAltH /> </button>
                      <button onClick={() => useProjectStore.getState().distributeSelection('vertical', toStoreValue(distributeSpacing, unitSystem), selectedIds)} className="p-1.5 hover:bg-gray-100 rounded" title="Distribute Vertically"> <FaArrowsAltV /> </button>
                    </div>
                  </div>

                  {/* Circular Distribution */}
                  <div className="flex gap-2 items-center">
                    <span className="text-gray-500 w-12">Circle</span>
                    <input
                      type="number"
                      value={radialDiameter} // Using same state var, but semantically its radius now
                      onChange={(e) => setRadialDiameter(Number(e.target.value))}
                      className="w-16 sidebar-input text-center"
                      placeholder="Radius"
                    />
                    <span className="text-xs text-gray-400">rad</span>
                    <div className="flex gap-1 ml-auto">
                      <button onClick={() => useProjectStore.getState().distributeRadial(radialDiameter, 0, 360, selectedIds)} className="p-1.5 hover:bg-gray-100 rounded" title="Distribute in Circle"> <FaCircleNotch /> </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Canvas / Asset Properties Section */}
      <div className="mb-4 border-b border-slate-200 pb-2">
        <button
          className="flex w-full items-center justify-between px-0 py-3 text-left"
          onClick={() => setShowCanvas((s) => !s)}
        >
          <div className="text-sm font-bold text-blue-600">
            Pages and Canvas
          </div>
          {showCanvas ? <FaChevronDown size={12} className="text-blue-600" /> : <FaChevronRight size={12} className="text-blue-600" />}
        </button>
        {showCanvas && (
          <div className="space-y-1 border-t border-slate-100 px-0 pb-4 pt-3 text-xs">
            {/* Canvas Name */}
            <div className="flex justify-between items-center">
              <span>Name</span>
              <input
                type="text"
                placeholder="New page name"
                value={canvasName}
                onChange={(e) => setCanvasName(e.target.value)}
                className="sidebar-input"
              />
            </div>

            {/* Grid Toggle */}
            <div className="flex justify-between items-center py-2">
              <span>Grid</span>
              <div className="inline-flex rounded-lg bg-[#0000000D] p-1">
                <button
                  onClick={() => !showGrid && handleToggleGrid()}
                  className={`px-4 py-1 text-xs rounded-md transition-all ${showGrid
                    ? "bg-white text-gray-900 shadow-sm font-medium"
                    : "text-gray-600 hover:text-gray-900"
                    }`}
                >
                  Show
                </button>
                <button
                  onClick={() => showGrid && handleToggleGrid()}
                  className={`px-4 py-1 text-xs rounded-md transition-all ${!showGrid
                    ? "bg-white text-gray-900 shadow-sm font-medium"
                    : "text-gray-600 hover:text-gray-900"
                    }`}
                >
                  Hide
                </button>
              </div>
            </div>

            {/* Grid Size */}
            {showGrid && (
              <div className="py-2">
                <label className="block text-xs text-gray-600 mb-1">Grid Size</label>
                <select
                  value={availableGridSizes?.[selectedGridSizeIndex] || 1000}
                  onChange={(e) => {
                    const selectedSize = Number(e.target.value);
                    const index = availableGridSizes?.indexOf(selectedSize) ?? 2;
                    handleSetGridSize(index);
                  }}
                  className="w-full text-xs border rounded px-2 py-1 bg-white"
                >
                  {(availableGridSizes || [100, 500, 1000, 2000, 5000]).map((size) => {
                    const label = unitSystem === 'imperial-ft'
                      ? `${(size / 304.8).toFixed(1)}ft`
                      : unitSystem === 'metric-m'
                        ? `${size / 1000}m`
                        : `${size}mm`;
                    return <option key={size} value={size}>{label}</option>;
                  })}
                </select>
              </div>
            )}

            {showGrid && (
              <div className="flex justify-between items-center py-2">
                <span>Snap to Grid</span>
                <div className="inline-flex rounded-lg bg-[#0000000D] p-1">
                  <button
                    onClick={() => !snapToGridEnabled && handleToggleSnapToGrid()}
                    className={`px-4 py-1 text-xs rounded-md transition-all ${snapToGridEnabled
                      ? "bg-white text-gray-900 shadow-sm font-medium"
                      : "text-gray-600 hover:text-gray-900"
                      }`}
                  >
                    On
                  </button>
                  <button
                    onClick={() => snapToGridEnabled && handleToggleSnapToGrid()}
                    className={`px-4 py-1 text-xs rounded-md transition-all ${!snapToGridEnabled
                      ? "bg-white text-gray-900 shadow-sm font-medium"
                      : "text-gray-600 hover:text-gray-900"
                      }`}
                  >
                    Off
                  </button>
                </div>
              </div>
            )}





            {/* MULTI SELECTION PROPERTIES */}
            {isMultiSelection && (
              <div className="mt-4 pt-4 border-t border-gray-200">
                <div className="text-sm font-bold text-blue-600 mb-3">Properties</div>

                {/* Bounding Box Info */}
                {collectiveBounds && (
                  <div className="grid grid-cols-2 gap-2 mb-4">
                    <div className="flex flex-col">
                      <span className="text-xs text-gray-500 mb-1">Width ({unitLabel})</span>
                      <span className="sidebar-input w-full text-center bg-gray-50 text-gray-500 border-none font-medium">{roundForDisplay(collectiveBounds.width)}</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-xs text-gray-500 mb-1">Height ({unitLabel})</span>
                      <span className="sidebar-input w-full text-center bg-gray-50 text-gray-500 border-none font-medium">{roundForDisplay(collectiveBounds.height)}</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-xs text-gray-500 mb-1">Pos X ({unitLabel})</span>
                      <span className="sidebar-input w-full text-center bg-gray-50 text-gray-500 border-none font-medium">{roundForDisplay(collectiveBounds.x)}</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-xs text-gray-500 mb-1">Pos Y ({unitLabel})</span>
                      <span className="sidebar-input w-full text-center bg-gray-50 text-gray-500 border-none font-medium">{roundForDisplay(collectiveBounds.y)}</span>
                    </div>
                  </div>
                )}

                {/* Fill Color for multiple items */}
                <div className="flex justify-between items-center mb-2">
                  <span className="text-gray-500">Fill Color</span>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      onChange={(e) => {
                        const sIds = selectedShapes.map(s => s.id);
                        const aIds = selectedAssets.map(a => a.id);
                        if (sIds.length > 0) updateShapeBatch(sIds, { fill: e.target.value, fillType: 'color' });
                        if (aIds.length > 0) updateAssetBatch(aIds, { fillColor: e.target.value });
                      }}
                      className="w-6 h-6 p-0 border-0 rounded cursor-pointer"
                    />
                  </div>
                </div>

                {/* Stroke Color for multiple items */}
                <div className="flex justify-between items-center mb-2">
                  <span className="text-gray-500">Stroke Color</span>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      onChange={(e) => {
                        const sIds = selectedShapes.map(s => s.id);
                        const aIds = selectedAssets.map(a => a.id);
                        if (sIds.length > 0) updateShapeBatch(sIds, { stroke: e.target.value });
                        if (aIds.length > 0) updateAssetBatch(aIds, { strokeColor: e.target.value });
                      }}
                      className="w-6 h-6 p-0 border-0 rounded cursor-pointer"
                    />
                  </div>
                </div>

                {/* Stroke Width for multiple items */}
                <div className="flex justify-between items-center mb-2">
                  <span className="text-gray-500">Stroke Width</span>
                  <input
                    type="number"
                    placeholder="Set All"
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      if (val >= 0) {
                        const sIds = selectedShapes.map(s => s.id);
                        const aIds = selectedAssets.map(a => a.id);
                        if (sIds.length > 0) updateShapeBatch(sIds, { strokeWidth: val });
                        if (aIds.length > 0) updateAssetBatch(aIds, { strokeWidth: val });
                      }
                    }}
                    className="sidebar-input w-16 text-center"
                    min={0}
                    step={0.5}
                  />
                </div>
              </div>
            )}

            {/* SELECTED ITEM PROPERTIES */}
            {selectedItem && (
              <div className="mt-4 pt-4 border-t border-gray-200">
                <div className="text-sm font-bold text-blue-600 mb-3">Properties</div>
                {/* Position */}
                {(itemType === 'shape' || itemType === 'asset') && (
                  <div className="grid grid-cols-2 gap-2 mb-2">
                    <div className="flex flex-col">
                      <span className="text-xs text-gray-500 mb-1">Pos X ({unitLabel})</span>
                      <input
                        type="number"
                        value={roundForDisplay((selectedItem as any).x)}
                        onChange={(e) => {
                          const val = Number(e.target.value);
                          const storeVal = toStoreValue(val, unitSystem);
                          if (itemType === 'shape') updateShape(selectedItem.id, { x: storeVal });
                          if (itemType === 'asset') {
                            updateAsset(selectedItem.id, { x: storeVal });
                            updateSceneAsset(selectedItem.id, { x: storeVal });
                          }
                        }}
                        className="sidebar-input w-full text-center font-medium"
                      />
                    </div>
                    <div className="flex flex-col">
                      <span className="text-xs text-gray-500 mb-1">Pos Y ({unitLabel})</span>
                      <input
                        type="number"
                        value={roundForDisplay((selectedItem as any).y)}
                        onChange={(e) => {
                          const val = Number(e.target.value);
                          const storeVal = toStoreValue(val, unitSystem);
                          if (itemType === 'shape') updateShape(selectedItem.id, { y: storeVal });
                          if (itemType === 'asset') {
                            updateAsset(selectedItem.id, { y: storeVal });
                            updateSceneAsset(selectedItem.id, { y: storeVal });
                          }
                        }}
                        className="sidebar-input w-full text-center font-medium"
                      />
                    </div>
                  </div>
                )}

                {/* Dimensions (Shape/Asset) */}
                {(itemType === 'shape' || itemType === 'asset') && (
                  <div className="grid grid-cols-2 gap-2 mb-2">
                    <div className="flex flex-col">
                      <span className="text-xs text-gray-500 mb-1">Width ({unitLabel})</span>
                      <input
                        type="number"
                        value={roundForDisplay((selectedItem as any).width)}
                        onChange={(e) => {
                          const val = Number(e.target.value);
                          const storeVal = toStoreValue(val, unitSystem);
                          if (itemType === 'shape') updateShape(selectedItem.id, { width: storeVal });
                          if (itemType === 'asset') {
                            updateAsset(selectedItem.id, { width: storeVal });
                            updateSceneAsset(selectedItem.id, { width: storeVal });
                          }
                        }}
                        className="sidebar-input w-full text-center font-medium"
                      />
                    </div>
                    <div className="flex flex-col">
                      <span className="text-xs text-gray-500 mb-1">Height ({unitLabel})</span>
                      <input
                        type="number"
                        value={roundForDisplay((selectedItem as any).height)}
                        onChange={(e) => {
                          const val = Number(e.target.value);
                          const storeVal = toStoreValue(val, unitSystem);
                          if (itemType === 'shape') updateShape(selectedItem.id, { height: storeVal });
                          if (itemType === 'asset') {
                            updateAsset(selectedItem.id, { height: storeVal });
                            updateSceneAsset(selectedItem.id, { height: storeVal });
                          }
                        }}
                        className="sidebar-input w-full text-center font-medium"
                      />
                    </div>
                  </div>
                )}

                {/* Rotation (Unified Shape/Asset) */}
                {(itemType === 'shape' || itemType === 'asset') && (
                  <div className="mb-4 pt-2 border-t border-gray-100">
                    <div className="flex justify-between items-center mb-3">
                      <span className="text-xs text-gray-500">Rotation</span>
                      <div className="flex items-center">
                        <input
                          type="number"
                          value={roundForDisplay((selectedItem as any).rotation || 0)}
                          onChange={(e) => {
                            const val = Number(e.target.value);
                            if (itemType === 'shape') updateShape(selectedItem.id, { rotation: val });
                            if (itemType === 'asset') {
                              updateAsset(selectedItem.id, { rotation: val });
                              updateSceneAsset(selectedItem.id, { rotation: val });
                            }
                          }}
                          className="sidebar-input w-16 text-center"
                        />
                        <span className="ml-1 text-gray-400">°</span>
                      </div>
                    </div>

                    {/* Redesigned Flip Controls */}
                    <div className="flex justify-between items-center mb-3 py-2 border-t border-gray-100">
                      <span className="text-xs text-gray-500">Flip</span>
                      <div className="flex gap-1">
                        <button
                          type="button"
                          title="Horizontal"
                          onClick={() => {
                            const next = !(selectedItem as any).flipY;
                            if (itemType === 'shape') updateShape(selectedItem.id, { flipY: next });
                            if (itemType === 'asset') {
                              updateAsset(selectedItem.id, { flipY: next });
                              updateSceneAsset(selectedItem.id, { flipY: next });
                            }
                          }}
                          className={`px-3 py-1 text-xs border rounded transition-colors ${(selectedItem as any).flipY ? 'bg-blue-100 border-blue-200 text-blue-600 font-medium' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}`}
                        >H</button>
                        <button
                          type="button"
                          title="Vertical"
                          onClick={() => {
                            const next = !(selectedItem as any).flipX;
                            if (itemType === 'shape') updateShape(selectedItem.id, { flipX: next });
                            if (itemType === 'asset') {
                              updateAsset(selectedItem.id, { flipX: next });
                              updateSceneAsset(selectedItem.id, { flipX: next });
                            }
                          }}
                          className={`px-3 py-1 text-xs border rounded transition-colors ${(selectedItem as any).flipX ? 'bg-blue-100 border-blue-200 text-blue-600 font-medium' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}`}
                        >V</button>
                      </div>
                    </div>

                    {/* Relocated Appearance Section */}
                    {/* Appearance (Shape/Asset) */}
                
                  <div className="mt-3 pt-3 border-t border-gray-100">

                    {/* Fill Type Selector - Only for Shapes currently */}
                    {itemType === 'shape' && (
                      <div className="mb-3">
                        <label className="block text-xs text-gray-500 mb-1">Fill Type</label>
                        <select
                          value={(selectedItem as any).fillType || 'solid'}
                          onChange={(e) => updateShape(selectedItem.id, { fillType: e.target.value as any })}
                          className="w-full text-xs border rounded px-2 py-1 bg-white"
                        >
                          <option value="solid">Solid Color</option>
                          <option value="gradient">Gradient</option>
                          <option value="texture">Texture</option>
                          <option value="hatch">Hatch Pattern</option>
                          <option value="image">Legacy Image Fill</option>
                          <option value="none">None (Transparent)</option>
                        </select>
                      </div>
                    )}

                    {/* Color Fill (Shape or Asset) */}
                    {((!((selectedItem as any).fillType) || (selectedItem as any).fillType === 'solid' || (selectedItem as any).fillType === 'color') && (() => {
                      const isMultiSeater = itemType === 'asset' && (selectedItem as any).type && /seater|sofa/i.test((selectedItem as any).type);
                      if (isMultiSeater) {
                        return (
                          <>
                            {/* Table / Sofa Color */}
                            <div className="flex justify-between items-center mb-2">
                              <span className="text-gray-500 text-xs">Table/Sofa Color</span>
                              <div className="flex items-center gap-2">
                                <input
                                  type="text"
                                  value={(selectedItem as any).tableColor || (selectedItem as any).fillColor || '#ffffff'}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    updateAsset(selectedItem.id, { tableColor: val });
                                    updateSceneAsset(selectedItem.id, { tableColor: val });
                                  }}
                                  className="sidebar-input w-20 text-xs"
                                />
                                <input
                                  type="color"
                                  value={(selectedItem as any).tableColor || (selectedItem as any).fillColor || '#ffffff'}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    updateAsset(selectedItem.id, { tableColor: val });
                                    updateSceneAsset(selectedItem.id, { tableColor: val });
                                  }}
                                  className="w-6 h-6 p-0 border-0 rounded cursor-pointer"
                                />
                              </div>
                            </div>

                            {/* Chair Color */}
                            <div className="flex justify-between items-center mb-2">
                              <span className="text-gray-500 text-xs">Chair Color</span>
                              <div className="flex items-center gap-2">
                                <input
                                  type="text"
                                  value={(selectedItem as any).chairColor || (selectedItem as any).fillColor || '#ffffff'}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    updateAsset(selectedItem.id, { chairColor: val });
                                    updateSceneAsset(selectedItem.id, { chairColor: val });
                                  }}
                                  className="sidebar-input w-20 text-xs"
                                />
                                <input
                                  type="color"
                                  value={(selectedItem as any).chairColor || (selectedItem as any).fillColor || '#ffffff'}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    updateAsset(selectedItem.id, { chairColor: val });
                                    updateSceneAsset(selectedItem.id, { chairColor: val });
                                  }}
                                  className="w-6 h-6 p-0 border-0 rounded cursor-pointer"
                                />
                              </div>
                            </div>

                            {/* Standard Fill Color */}
                            <div className="flex justify-between items-center mb-2 border-t border-dashed border-gray-100 pt-2">
                              <span className="text-gray-400 text-[10px]">Reset Both Colors</span>
                              <div className="flex items-center gap-2">
                                <input
                                  type="text"
                                  value={(selectedItem as any).fillColor || '#ffffff'}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    updateAsset(selectedItem.id, { fillColor: val, tableColor: undefined, chairColor: undefined });
                                    updateSceneAsset(selectedItem.id, { fillColor: val, tableColor: undefined, chairColor: undefined });
                                  }}
                                  className="sidebar-input w-20 text-xs"
                                />
                                <input
                                  type="color"
                                  value={(selectedItem as any).fillColor || '#ffffff'}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    updateAsset(selectedItem.id, { fillColor: val, tableColor: undefined, chairColor: undefined });
                                    updateSceneAsset(selectedItem.id, { fillColor: val, tableColor: undefined, chairColor: undefined });
                                  }}
                                  className="w-6 h-6 p-0 border-0 rounded cursor-pointer"
                                />
                              </div>
                            </div>
                          </>
                        );
                      }

                      return (
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-gray-500">Fill Color</span>
                          <div className="flex items-center gap-2">
                            <input
                              type="text"
                              value={(itemType === 'asset' ? (selectedItem as any).fillColor : (selectedItem as any).fill) || '#ffffff'}
                              onChange={(e) => {
                                const changes: any = { fill: e.target.value };
                                if (!(selectedItem as any).fillType) changes.fillType = 'solid';

                                if (itemType === 'shape') updateShape(selectedItem.id, changes);
                                if (itemType === 'asset') {
                                  updateAsset(selectedItem.id, { fillColor: e.target.value });
                                  updateSceneAsset(selectedItem.id, { fillColor: e.target.value });
                                }
                              }}
                              className="sidebar-input w-20 text-xs"
                            />
                            <input
                              type="color"
                              value={(itemType === 'asset' ? (selectedItem as any).fillColor : (selectedItem as any).fill) || '#ffffff'}
                              onChange={(e) => {
                                const changes: any = { fill: e.target.value };
                                if (!(selectedItem as any).fillType) changes.fillType = 'solid';

                                if (itemType === 'shape') updateShape(selectedItem.id, changes);
                                if (itemType === 'asset') {
                                  updateAsset(selectedItem.id, { fillColor: e.target.value });
                                  updateSceneAsset(selectedItem.id, { fillColor: e.target.value });
                                }
                              }}
                              className="w-6 h-6 p-0 border-0 rounded cursor-pointer"
                            />
                          </div>
                        </div>
                      );
                    })())}

                    {/* Gradient Fill */}
                    {(selectedItem as any).fillType === 'gradient' && (
                      <div className="space-y-2 mb-2">
                        <div className="flex justify-between items-center">
                          <span className="text-gray-500 text-xs">Gradient Type</span>
                          <select
                            value={(selectedItem as any).gradientType || 'linear'}
                            onChange={(e) => updateShape(selectedItem.id, { gradientType: e.target.value as any })}
                            className="text-xs border rounded px-2 py-1 bg-white"
                          >
                            <option value="linear">Linear</option>
                            <option value="radial">Radial</option>
                          </select>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-gray-500 text-xs">Start Color</span>
                          <input
                            type="color"
                            value={((selectedItem as any).gradientColors || ['#ffffff', '#000000'])[0]}
                            onChange={(e) => {
                              const colors = (selectedItem as any).gradientColors || ['#ffffff', '#000000'];
                              updateShape(selectedItem.id, { gradientColors: [e.target.value, colors[1]] });
                            }}
                            className="w-6 h-6 p-0 border-0 rounded cursor-pointer"
                          />
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-gray-500 text-xs">End Color</span>
                          <input
                            type="color"
                            value={((selectedItem as any).gradientColors || ['#ffffff', '#000000'])[1]}
                            onChange={(e) => {
                              const colors = (selectedItem as any).gradientColors || ['#ffffff', '#000000'];
                              updateShape(selectedItem.id, { gradientColors: [colors[0], e.target.value] });
                            }}
                            className="w-6 h-6 p-0 border-0 rounded cursor-pointer"
                          />
                        </div>
                        {(selectedItem as any).gradientType === 'linear' && (
                          <div className="flex justify-between items-center">
                            <span className="text-gray-500 text-xs">Angle</span>
                            <div className="flex items-center gap-1">
                              <input
                                type="number"
                                value={(selectedItem as any).gradientAngle || 0}
                                onChange={(e) => updateShape(selectedItem.id, { gradientAngle: Number(e.target.value) })}
                                className="sidebar-input w-12 text-center text-xs"
                                min={0}
                                max={360}
                              />
                              <span className="text-gray-400 text-xs">°</span>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Texture Fill */}
                    {(selectedItem as any).fillType === 'texture' && (
                      <div className="space-y-2 mb-2">
                        <div className="grid grid-cols-2 gap-2">
                          {texturePatterns.filter(p => !p.id.startsWith('hatch-')).map((pattern) => (
                            <button
                              key={pattern.id}
                              className={`aspect-square h-auto border rounded overflow-hidden relative ${(selectedItem as any).fillTexture === pattern.id ? 'ring-2 ring-blue-500' : 'border-gray-300'
                                }`}
                              onClick={() => {
                                const val = pattern.id;
                                if ((itemType as string) === 'wall' && !(selectedItem as any).wallSegments) {
                                  updateWall(selectedItem.id, { fillTexture: val });
                                  syncToScene(selectedItem.id, { fillTexture: val });
                                }
                                else if ((itemType as string) === 'shape') {
                                  updateShape(selectedItem.id, { fillTexture: val });
                                }
                                else {
                                  updateAsset(selectedItem.id, { fillTexture: val } as any);
                                  updateSceneAsset(selectedItem.id, { fillTexture: val } as any);
                                }
                              }}
                              title={pattern.name}
                            >
                              <div className="w-full h-full bg-white text-slate-800">
                                <svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice">
                                  {pattern.isImage ? (
                                    <image href={pattern.path} width="100" height="100" preserveAspectRatio="xMidYMid slice" />
                                  ) : (
                                    <>
                                      <defs dangerouslySetInnerHTML={{ __html: (pattern.svg || "").replace(/id="([^"]+)"/g, 'id="preview-sidebar-texture-$1"') }} />
                                      <rect width="100" height="100" fill={`url(#preview-sidebar-texture-${pattern.id})`} />
                                    </>
                                  )}
                                </svg>
                              </div>
                            </button>
                          ))}
                        </div>

                        <div className="flex justify-between items-center">
                          <span className="text-gray-500 text-xs">Scale</span>
                          <input
                            type="number"
                            value={(selectedItem as any).fillTextureScale || 4}
                            onChange={(e) => updateShape(selectedItem.id, { fillTextureScale: Number(e.target.value) } as any)}
                            className="sidebar-input w-12 text-center text-xs"
                            max={1000}
                            step={0.5}
                          />
                        </div>

                        <div className="flex justify-between items-center">
                          <span className="text-gray-500 text-xs">Thickness</span>
                          <input
                            type="number"
                            value={(selectedItem as any).fillTextureThickness || 1}
                            onChange={(e) => updateShape(selectedItem.id, { fillTextureThickness: Number(e.target.value) } as any)}
                            className="sidebar-input w-12 text-center text-xs"
                            min={0.1}
                            max={10}
                            step={0.1}
                          />
                        </div>
                      </div>
                    )}

                    {/* Hatch Fill (Shape or Asset) */}
                    {(selectedItem as any).fillType === 'hatch' && (
                      <div className="space-y-2 mb-2">
                        <div className="grid grid-cols-2 gap-2">
                          {texturePatterns.filter(p => p.id.startsWith('hatch-')).map((pattern) => (
                            <button
                              key={pattern.id}
                              className={`aspect-square h-auto border rounded overflow-hidden relative ${(selectedItem as any).fillTexture === pattern.id ? 'ring-2 ring-blue-500' : 'border-gray-300'
                                }`}
                              onClick={() => {
                                const val = pattern.id;
                                if ((itemType as string) === 'wall' && !(selectedItem as any).wallSegments) {
                                  updateWall(selectedItem.id, { fillTexture: val });
                                  syncToScene(selectedItem.id, { fillTexture: val });
                                }
                                else if ((itemType as string) === 'shape') {
                                  updateShape(selectedItem.id, { fillTexture: val });
                                }
                                else {
                                  updateAsset(selectedItem.id, { fillTexture: val } as any);
                                  updateSceneAsset(selectedItem.id, { fillTexture: val } as any);
                                }
                              }}
                              title={pattern.name}
                            >
                              <div className="w-full h-full bg-white text-slate-800">
                                <svg width="100%" height="100%" viewBox="0 0 40 40" preserveAspectRatio="xMidYMid slice">
                                  {pattern.isImage ? (
                                    <image href={pattern.path} width="40" height="40" preserveAspectRatio="xMidYMid slice" />
                                  ) : (
                                    <>
                                      <defs dangerouslySetInnerHTML={{ __html: (pattern.svg || "").replace(/id="([^"]+)"/g, 'id="preview-sidebar-hatch-$1"') }} />
                                      <rect width="40" height="40" fill={`url(#preview-sidebar-hatch-${pattern.id})`} />
                                    </>
                                  )}
                                </svg>
                              </div>
                            </button>
                          ))}
                        </div>

                        <div className="flex justify-between items-center mt-2">
                          <span className="text-gray-500 text-xs">Scale</span>
                          <input
                            type="number"
                            value={(selectedItem as any).fillTextureScale || 4}
                            onChange={(e) => {
                              const val = Number(e.target.value);
                              if (itemType === 'shape') {
                                updateShape((selectedItem as any).id, { fillTextureScale: val });
                              } else {
                                updateAsset(selectedItem.id, { fillTextureScale: val } as any);
                                updateSceneAsset(selectedItem.id, { fillTextureScale: val } as any);
                              }
                            }}
                            className="sidebar-input w-12 text-center text-xs"
                            max={1000}
                            step={0.5}
                          />
                        </div>

                        <div className="flex justify-between items-center mt-2">
                          <span className="text-gray-500 text-xs">Thickness</span>
                          <input
                            type="number"
                            value={(selectedItem as any).fillTextureThickness || 1}
                            onChange={(e) => {
                              const val = Number(e.target.value);
                              const safeVal = Math.max(0.1, val);
                              if (itemType === 'shape') {
                                updateShape((selectedItem as any).id, { fillTextureThickness: safeVal });
                              } else {
                                updateAsset(selectedItem.id, { fillTextureThickness: safeVal } as any);
                                updateSceneAsset(selectedItem.id, { fillTextureThickness: safeVal } as any);
                              }
                            }}
                            className="sidebar-input w-12 text-center text-xs"
                            min={0.1}
                            max={10}
                            step={0.1}
                          />
                        </div>
                      </div>
                    )}

                    {/* Image Fill */}
                    {(selectedItem as any).fillType === 'image' && (
                      <div className="space-y-2 mb-2">
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">Upload Image</label>
                          <input
                            type="file"
                            accept="image/*"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                const reader = new FileReader();
                                reader.onload = (event) => {
                                  updateShape(selectedItem.id, { fillImage: event.target?.result as string });
                                };
                                reader.readAsDataURL(file);
                              }
                            }}
                            className="text-xs w-full"
                          />
                        </div>
                        {(selectedItem as any).fillImage && (
                          <>
                            <div className="w-full h-20 border rounded overflow-hidden">
                              <img
                                src={(selectedItem as any).fillImage}
                                alt="Fill"
                                className="w-full h-full object-cover"
                              />
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-gray-500 text-xs">Scale</span>
                              <input
                                type="number"
                                value={(selectedItem as any).fillImageScale || 1}
                                onChange={(e) => updateShape(selectedItem.id, { fillImageScale: Number(e.target.value) })}
                                className="sidebar-input w-12 text-center text-xs"
                                min={0.1}
                                max={5}
                                step={0.1}
                              />
                            </div>
                          </>
                        )}
                      </div>
                    )}
                    {/* Stroke Color (Shape or Asset) */}
                    {(itemType === 'shape' || itemType === 'asset') && (
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-gray-500">Stroke Color</span>
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            value={(itemType === 'asset' ? (selectedItem as any).strokeColor : (selectedItem as any).stroke) || '#000000'}
                            onChange={(e) => {
                              if (itemType === 'shape') updateShape(selectedItem.id, { stroke: e.target.value });
                              if (itemType === 'asset') {
                                updateAsset(selectedItem.id, { strokeColor: e.target.value });
                                updateSceneAsset(selectedItem.id, { strokeColor: e.target.value });
                              }
                            }}
                            className="sidebar-input w-20 text-xs"
                          />
                          <input
                            type="color"
                            value={(itemType === 'asset' ? (selectedItem as any).strokeColor : (selectedItem as any).stroke) || '#000000'}
                            onChange={(e) => {
                              if (itemType === 'shape') updateShape(selectedItem.id, { stroke: e.target.value });
                              if (itemType === 'asset') {
                                updateAsset(selectedItem.id, { strokeColor: e.target.value });
                                updateSceneAsset(selectedItem.id, { strokeColor: e.target.value });
                              }
                            }}
                            className="w-6 h-6 p-0 border-0 rounded cursor-pointer"
                          />
                        </div>
                      </div>
                    )}

                    {/* Stroke Width (Shape or Asset) */}
                    {(itemType === 'shape' || itemType === 'asset') && (
                      <>
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-gray-500">Stroke Width</span>
                          <input
                            type="number"
                            value={(selectedItem as any).strokeWidth || 0}
                            onChange={(e) => {
                              const val = Number(e.target.value);
                              if (itemType === 'shape') updateShape(selectedItem.id, { strokeWidth: val });
                              if (itemType === 'asset') {
                                updateAsset(selectedItem.id, { strokeWidth: val });
                                updateSceneAsset(selectedItem.id, { strokeWidth: val });
                              }
                            }}
                            className="sidebar-input w-16 text-center"
                            min={0}
                            step={0.5}
                          />
                        </div>

                        <div className="flex flex-col gap-1 mb-2">
                          <div className="flex justify-between items-center">
                            <span className="text-gray-500">Corner Radius</span>
                            <input
                              type="number"
                              value={(selectedItem as any).borderRadius || 0}
                              onChange={(e) => {
                                const maxR = Math.min((selectedItem as any).width, (selectedItem as any).height) / 2;
                                updateShape(selectedItem.id, { borderRadius: Math.min(Number(e.target.value), maxR) });
                              }}
                              className="sidebar-input w-16 text-center"
                              min={0}
                              max={Math.min((selectedItem as any).width, (selectedItem as any).height) / 2}
                              step={10}
                            />
                          </div>
                          <span className="text-[10px] text-gray-400 italic text-right">Max: {Math.floor(Math.min((selectedItem as any).width, (selectedItem as any).height) / 2)}mm</span>
                        </div>
                      </>
                    )}

                    {/* Line Type (Shape Only) */}
                    {itemType === 'shape' && (
                      <LineTypeSelector
                        currentType={(selectedItem as any).lineType || 'solid'}
                        onChange={(type, dashArray) => {
                          updateShape(selectedItem.id, {
                            lineType: type,
                            strokeDasharray: dashArray
                          });
                        }}
                      />
                    )}

                    {/* Stroke */}
                    {/* This section is now redundant for shapes/assets and will be removed or refactored */}
                    {/* <div className="flex justify-between items-center mb-2">
                      <span className="text-gray-500">Stroke</span>
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={(selectedItem as any).stroke || '#000000'}
                          onChange={(e) => updateShape(selectedItem.id, { stroke: e.target.value })}
                          className="sidebar-input w-20 text-xs"
                        />
                        <input
                          type="color"
                          value={(selectedItem as any).stroke || '#000000'}
                          onChange={(e) => updateShape(selectedItem.id, { stroke: e.target.value })}
                          className="w-6 h-6 p-0 border-0 rounded cursor-pointer"
                        />
                      </div>
                    </div> */}

                    {/* Stroke Width */}
                    {/* This section is now redundant for shapes/assets and will be removed or refactored */}
                    {/* <div className="flex justify-between items-center mb-2">
                      <span className="text-gray-500">Stroke Width</span>
                      <input
                        type="number"
                        value={(selectedItem as any).strokeWidth !== undefined ? (selectedItem as any).strokeWidth : 2}
                        onChange={(e) => {
                          const value = Number(e.target.value);
                          updateShape(selectedItem.id, { strokeWidth: value >= 0 ? value : 2 });
                        }}
                        className="sidebar-input w-16 text-center"
                        min={0}
                        step={0.5}
                      />
                    </div> */}
                    <div className="flex justify-between items-center mt-3 pt-3 border-t border-gray-100">
                      <span className="text-xs text-gray-500">Show Dimensions</span>
                      <button
                        onClick={() => {
                          const val = !((selectedItem as any).showDimensions);
                          if (itemType === 'shape') updateShape(selectedItem.id, { showDimensions: val });
                          if (itemType === 'asset') updateAsset(selectedItem.id, { showDimensions: val });
                        }}
                        className={`w-10 h-5 rounded-full flex items-center transition-colors px-1 ${(selectedItem as any).showDimensions ? 'bg-blue-600' : 'bg-gray-300'}`}
                      >
                        <div
                          className={`w-3.5 h-3.5 bg-white rounded-full shadow-sm transform transition-transform ${(selectedItem as any).showDimensions ? 'translate-x-5' : 'translate-x-0'}`}
                        />
                      </button>
                    </div>

                    {(selectedItem as any).showDimensions && (
                      <div className="space-y-2 mt-3">
                        <div className="flex justify-between items-center">
                          <span className="text-gray-500 text-xs">Line Style</span>
                          <select
                            value={(selectedItem as any).dimensionType || 'solid'}
                            onChange={(e) => {
                              const val = e.target.value as any;
                              if (itemType === 'shape') updateShape(selectedItem.id, { dimensionType: val });
                              if (itemType === 'asset') updateAsset(selectedItem.id, { dimensionType: val });
                            }}
                            className="text-xs border rounded px-2 py-1 bg-white w-32"
                          >
                            <option value="solid">Solid</option>
                            <option value="dashed">Dashed</option>
                            <option value="dotted">Dotted</option>
                          </select>
                        </div>

                        <div className="flex justify-between items-center">
                          <span className="text-gray-500 text-xs">Font Size</span>
                          <input
                            type="number"
                            min="6"
                            max="500000"
                            value={(selectedItem as any).dimensionFontSize || 12}
                            onChange={(e) => {
                              const val = Number(e.target.value);
                              if (itemType === 'shape') updateShape(selectedItem.id, { dimensionFontSize: val });
                              if (itemType === 'asset') updateAsset(selectedItem.id, { dimensionFontSize: val });
                            }}
                            className="sidebar-input w-16 text-center"
                          />
                        </div>

                        <div className="flex justify-between items-center">
                          <span className="text-gray-500 text-xs">Dimension Gap</span>
                          <input
                            type="number"
                            min="0"
                            max="500000"
                            value={(selectedItem as any).dimensionOffset !== undefined ? (selectedItem as any).dimensionOffset : 200}
                            onChange={(e) => {
                              const val = Number(e.target.value);
                              if (itemType === 'shape') updateShape(selectedItem.id, { dimensionOffset: val });
                              if (itemType === 'asset') updateAsset(selectedItem.id, { dimensionOffset: val });
                            }}
                            className="sidebar-input w-16 text-center"
                          />
                        </div>

                        <div className="flex justify-between items-center">
                          <span className="text-gray-500 text-xs">Line Weight</span>
                          <input
                            type="number"
                            min="0.2"
                            step="0.1"
                            value={(selectedItem as any).dimensionStrokeWidth || 1.5}
                            onChange={(e) => {
                              const val = Number(e.target.value);
                              if (itemType === 'shape') updateShape(selectedItem.id, { dimensionStrokeWidth: Math.max(0.2, val) });
                              if (itemType === 'asset') updateAsset(selectedItem.id, { dimensionStrokeWidth: Math.max(0.2, val) });
                            }}
                            className="sidebar-input w-16 text-center"
                          />
                        </div>

                        <div className="flex justify-between items-center">
                          <span className="text-gray-500 text-xs">Color</span>
                          <div className="flex items-center gap-2">
                            <input
                              type="text"
                              value={(selectedItem as any).dimensionColor || '#666666'}
                              onChange={(e) => {
                                const val = e.target.value;
                                if (itemType === 'shape') updateShape(selectedItem.id, { dimensionColor: val });
                                if (itemType === 'asset') updateAsset(selectedItem.id, { dimensionColor: val });
                              }}
                              className="sidebar-input w-20 text-xs"
                            />
                            <input
                              type="color"
                              value={(selectedItem as any).dimensionColor || '#666666'}
                              onChange={(e) => {
                                const val = e.target.value;
                                if (itemType === 'shape') updateShape(selectedItem.id, { dimensionColor: val });
                                if (itemType === 'asset') updateAsset(selectedItem.id, { dimensionColor: val });
                              }}
                              className="w-6 h-6 p-0 border-0 rounded cursor-pointer"
                            />
                          </div>
                        </div>

                        <div className="flex justify-between items-center">
                          <span className="text-gray-500 text-xs">Text Position</span>
                          <select
                            value={(selectedItem as any).dimensionTextPosition || 'inbetween'}
                            onChange={(e) => {
                              const val = e.target.value as any;
                              if (itemType === 'shape') updateShape(selectedItem.id, { dimensionTextPosition: val });
                              if (itemType === 'asset') updateAsset(selectedItem.id, { dimensionTextPosition: val });
                            }}
                            className="text-xs border rounded px-2 py-1 bg-white w-32"
                          >
                            <option value="inbetween">In-between</option>
                            <option value="above">Above Line</option>
                          </select>
                        </div>

                        <div className="flex justify-between items-center">
                          <span className="text-gray-500 text-xs">Label Side</span>
                          <select
                            value={(selectedItem as any).dimensionLabelPosition || 'top-right'}
                            onChange={(e) => {
                              const val = e.target.value as any;
                              if (itemType === 'shape') updateShape(selectedItem.id, { dimensionLabelPosition: val });
                              if (itemType === 'asset') updateAsset(selectedItem.id, { dimensionLabelPosition: val });
                            }}
                            className="text-xs border rounded px-2 py-1 bg-white w-32"
                          >
                            <option value="top-right">Top / Right</option>
                            <option value="bottom-left">Bottom / Left</option>
                          </select>
                        </div>
                      </div>
                    )}
                  </div>
                  </div>
                )}

                                {/* ARROW PROPERTIES */}
                {itemType === 'shape' && (selectedItem as any).type === 'arrow' && (
                  <div className="mt-4 pt-4 border-t border-gray-200">
                    <div className="text-xs font-bold mb-3 uppercase tracking-wider text-gray-500">
                      Arrow Style
                    </div>

                    {/* Head Type */}
                    <div className="mb-2 relative">
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-gray-500 text-xs">Head Type</span>
                      </div>
                      <button
                        onClick={() => setIsArrowHeadDropdownOpen(!isArrowHeadDropdownOpen)}
                        className="w-full p-1 text-xs border border-gray-300 rounded flex justify-between items-center bg-white"
                      >
                        <span>{((selectedItem as any).arrowHeadType || 'filled-triangle').replace('-', ' ')}</span>
                        <FaChevronDown size={10} className="text-gray-400" />
                      </button>

                      {isArrowHeadDropdownOpen && (
                        <>
                          <div
                            className="fixed inset-0 z-10"
                            onClick={() => setIsArrowHeadDropdownOpen(false)}
                          />
                          <div className="absolute top-full left-0 right-0 mt-1 bg-white border rounded shadow-lg z-20 p-2">
                            <div className="grid grid-cols-4 gap-1">
                              {[
                                { id: 'none', label: 'None', path: 'M 2 10 L 22 10' },
                                { id: 'filled-triangle', label: 'Triangle (Filled)', path: 'M 2 10 L 16 10 M 16 6 L 22 10 L 16 14 Z', fill: 'currentColor' },
                                { id: 'triangle', label: 'Triangle (Outline)', path: 'M 2 10 L 16 10 M 16 6 L 22 10 L 16 14 Z', fill: 'none' },
                                { id: 'circle', label: 'Circle', path: 'M 2 10 L 16 10 M 22 10 m -3 0 a 3 3 0 1 0 6 0 a 3 3 0 1 0 -6 0', fill: 'none' },
                                { id: 'square', label: 'Square', path: 'M 2 10 L 16 10 M 16 7 L 22 7 L 22 13 L 16 13 Z', fill: 'none' },
                                { id: 'diamond', label: 'Diamond', path: 'M 2 10 L 16 10 M 19 6 L 22 10 L 19 14 L 16 10 Z', fill: 'none' },
                              ].map((type) => (
                                <button
                                  key={type.id}
                                  onClick={() => {
                                    updateShape(selectedItem.id, { arrowHeadType: type.id as any });
                                    setIsArrowHeadDropdownOpen(false);
                                  }}
                                  className={`h-8 border rounded flex items-center justify-center hover:bg-gray-50 ${((selectedItem as any).arrowHeadType || 'filled-triangle') === type.id ? 'ring-2 ring-blue-500 border-blue-500' : 'border-gray-200'
                                    }`}
                                  title={type.label}
                                >
                                  <svg width="24" height="20" viewBox="0 0 24 20" className="text-gray-700">
                                    <path d={type.path} stroke="currentColor" strokeWidth="1.5" fill={type.fill || 'none'} />
                                  </svg>
                                </button>
                              ))}
                            </div>
                          </div>
                        </>
                      )}
                    </div>

                    {/* Head Size */}
                    <div className="flex justify-between items-center mb-3">
                      <span className="text-gray-500 text-xs">Head Size</span>
                      <input
                        type="number"
                        min="0.1"
                        step="0.1"
                        value={(selectedItem as any).arrowHeadSize || 1}
                        onChange={(e) => updateShape(selectedItem.id, { arrowHeadSize: Number(e.target.value) })}
                        className="sidebar-input w-16 text-center"
                      />
                    </div>

                    {/* Tail Type */}
                    <div className="mb-2 relative">
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-gray-500 text-xs">Tail Type</span>
                      </div>
                      <button
                        onClick={() => setIsArrowTailDropdownOpen(!isArrowTailDropdownOpen)}
                        className="w-full p-1 text-xs border border-gray-300 rounded flex justify-between items-center bg-white"
                      >
                        <span>{((selectedItem as any).arrowTailType || 'none').replace('-', ' ')}</span>
                        <FaChevronDown size={10} className="text-gray-400" />
                      </button>

                      {isArrowTailDropdownOpen && (
                        <>
                          <div
                            className="fixed inset-0 z-10"
                            onClick={() => setIsArrowTailDropdownOpen(false)}
                          />
                          <div className="absolute top-full left-0 right-0 mt-1 bg-white border rounded shadow-lg z-20 p-2">
                            <div className="grid grid-cols-4 gap-1">
                              {[
                                { id: 'none', label: 'None', path: 'M 22 10 L 2 10' },
                                { id: 'standard-nock', label: 'Standard Nock', path: 'M 22 10 L 6 10 M 6 6 L 2 10 L 6 14' },
                                { id: 'circle', label: 'Circle', path: 'M 22 10 L 8 10 M 2 10 m 3 0 a 3 3 0 1 1 -6 0 a 3 3 0 1 1 6 0', fill: 'none' },
                                { id: 'square', label: 'Square', path: 'M 22 10 L 8 10 M 2 7 L 8 7 L 8 13 L 2 13 Z', fill: 'none' },
                                { id: 'diamond', label: 'Diamond', path: 'M 22 10 L 8 10 M 5 6 L 2 10 L 5 14 L 8 10 Z', fill: 'none' },
                                { id: 'triangle', label: 'Triangle', path: 'M 22 10 L 8 10 M 8 6 L 2 10 L 8 14 Z', fill: 'none' },
                                { id: 'filled-triangle', label: 'Filled Triangle', path: 'M 22 10 L 8 10 M 8 6 L 2 10 L 8 14 Z', fill: 'currentColor' },
                              ].map((type) => (
                                <button
                                  key={type.id}
                                  onClick={() => {
                                    updateShape(selectedItem.id, { arrowTailType: type.id as any });
                                    setIsArrowTailDropdownOpen(false);
                                  }}
                                  className={`h-8 border rounded flex items-center justify-center hover:bg-gray-50 ${((selectedItem as any).arrowTailType || 'none') === type.id ? 'ring-2 ring-blue-500 border-blue-500' : 'border-gray-200'
                                    }`}
                                  title={type.label}
                                >
                                  <svg width="24" height="20" viewBox="0 0 24 20" className="text-gray-700">
                                    <path d={type.path} stroke="currentColor" strokeWidth="1.5" fill={type.fill || 'none'} />
                                  </svg>
                                </button>
                              ))}
                            </div>
                          </div>
                        </>
                      )}
                    </div>

                    {/* Tail Size */}
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-gray-500 text-xs">Tail Size</span>
                      <input
                        type="number"
                        min="0.1"
                        step="0.1"
                        value={(selectedItem as any).arrowTailSize || 1}
                        onChange={(e) => updateShape(selectedItem.id, { arrowTailSize: Number(e.target.value) })}
                        className="sidebar-input w-16 text-center"
                      />
                    </div>
                  </div>
                )}

                {/* Table Numbering (Manual Override) */}
                {(itemType === 'shape' || itemType === 'asset') && 
                  (((selectedItem as any).type || "").toLowerCase().includes('table') || 
                    ((selectedItem as any).name || "").toLowerCase().includes('table')) && (
                    <div className="mt-3 pt-3 border-t border-gray-100">
                      <div className="text-xs font-semibold mb-2 text-gray-600 uppercase tracking-tight">Label Override</div>
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-gray-500 text-xs">Label / Number</span>
                        <input
                          type="text"
                          value={(selectedItem as any).tableName || ""}
                          onChange={(e) => {
                            const val = e.target.value;
                            if (itemType === 'shape') {
                              updateShape(selectedItem.id, { tableName: val });
                            } else {
                              updateAsset(selectedItem.id, { tableName: val });
                            }
                          }}
                          className="sidebar-input w-24 text-right text-xs"
                          placeholder="e.g. 1, A"
                        />
                      </div>
                    </div>
                  )}

                {/* Text Annotation Properties */}
                {itemType === 'text-annotation' && selectedTextAnnotation && (
                  <div className="mt-3 pt-3 border-t border-gray-100">
                    <div className="text-xs font-semibold mb-2 text-gray-600">Text Properties</div>

                    {/* Text Content */}
                    <div className="mb-2">
                      <label className="block text-xs text-gray-500 mb-1">Text</label>
                      <textarea
                        value={localTextProps.id === selectedTextAnnotation.id ? localTextProps.text : selectedTextAnnotation.text}
                        onChange={(e) => {
                          setLocalTextProps({ id: selectedTextAnnotation.id, text: e.target.value });
                          updateTextAnnotation(selectedTextAnnotation.id, { text: e.target.value });
                        }}
                        className="w-full text-sm border rounded px-2 py-1 bg-white resize-none"
                        rows={3}
                      />
                    </div>

                    {/* Font Size */}
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-gray-500">Font Size (px)</span>
                      <input
                        type="number"
                        value={selectedTextAnnotation.fontSize ?? 250}
                        onChange={(e) => {
                          const val = Number(e.target.value);
                          if (!isNaN(val) && val > 0) {
                            updateTextAnnotation(selectedTextAnnotation.id, { fontSize: Math.min(5000, val) });
                          }
                        }}
                        className="sidebar-input w-20 text-center"
                        min={8}
                        max={5000}
                      />
                    </div>

                    {/* Line Spacing */}
                    <div className="space-y-2 mb-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-gray-500">Line Spacing</span>
                        <span className="text-xs font-bold text-blue-600">
                          {(selectedTextAnnotation.lineHeight || 1.2).toFixed(1)}
                        </span>
                      </div>
                      <input
                        type="range"
                        min="0.8"
                        max="3.0"
                        step="0.1"
                        value={selectedTextAnnotation.lineHeight || 1.2}
                        onChange={(e) => updateTextAnnotation(selectedTextAnnotation.id, { lineHeight: parseFloat(e.target.value) })}
                        className="w-full accent-blue-600 h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                      />
                    </div>

                    {/* Font Family */}
                    <div className="mb-2 relative">
                      <label className="block text-xs text-gray-500 mb-1">Font Family</label>
                      <button
                        onClick={() => setIsFontDropdownOpen(!isFontDropdownOpen)}
                        className="w-full text-xs border rounded px-2 py-1 bg-white text-left flex justify-between items-center"
                        style={{ fontFamily: selectedTextAnnotation.fontFamily || 'Inter, sans-serif' }}
                      >
                        {getFontDisplayName(selectedTextAnnotation.fontFamily || 'Inter, sans-serif')}
                        <FaChevronDown size={10} className="text-gray-400" />
                      </button>

                      {isFontDropdownOpen && (
                        <>
                          <div
                            className="fixed inset-0 z-10"
                            onClick={() => setIsFontDropdownOpen(false)}
                          />
                          <div className="absolute top-full left-0 right-0 mt-1 bg-white border rounded shadow-lg z-20 max-h-48 overflow-y-auto">
                            {textStyleFonts.map((font) => (
                              <div
                                key={font}
                                className="px-2 py-1.5 hover:bg-gray-100 cursor-pointer text-xs"
                                style={{ fontFamily: font }}
                                onClick={() => {
                                  updateTextAnnotation(selectedTextAnnotation.id, { fontFamily: font });
                                  setIsFontDropdownOpen(false);
                                }}
                              >
                                {getFontDisplayName(font)}
                              </div>
                            ))}
                          </div>
                        </>
                      )}
                    </div>
                    
                    {/* Text Alignment */}
                    <div className="flex justify-between items-center mb-4 mt-3">
                      <span className="text-gray-500">Alignment</span>
                      <div className="flex gap-1 bg-white p-0.5 rounded border">
                        <button
                          onClick={() => updateTextAnnotation(selectedTextAnnotation.id, { textAlign: 'left' })}
                          className={`p-1.5 rounded transition-colors ${selectedTextAnnotation.textAlign === 'left' ? 'bg-blue-100 text-blue-600' : 'text-gray-500 hover:bg-gray-100'}`}
                          title="Align Left"
                        >
                          <FaAlignLeft size={12} />
                        </button>
                        <button
                          onClick={() => updateTextAnnotation(selectedTextAnnotation.id, { textAlign: 'center' })}
                          className={`p-1.5 rounded transition-colors ${selectedTextAnnotation.textAlign === 'center' || !selectedTextAnnotation.textAlign ? 'bg-blue-100 text-blue-600' : 'text-gray-500 hover:bg-gray-100'}`}
                          title="Align Center"
                        >
                          <FaAlignCenter size={12} />
                        </button>
                        <button
                          onClick={() => updateTextAnnotation(selectedTextAnnotation.id, { textAlign: 'right' })}
                          className={`p-1.5 rounded transition-colors ${selectedTextAnnotation.textAlign === 'right' ? 'bg-blue-100 text-blue-600' : 'text-gray-500 hover:bg-gray-100'}`}
                          title="Align Right"
                        >
                          <FaAlignRight size={12} />
                        </button>
                      </div>
                    </div>

                    {/* Text Styling */}
                    <div className="flex justify-between items-center mb-4 mt-3">
                      <span className="text-gray-500">Style</span>
                      <div className="flex gap-1 bg-white p-0.5 rounded border">
                        <button
                          onClick={() => updateTextAnnotation(selectedTextAnnotation.id, { fontWeight: selectedTextAnnotation.fontWeight === 'bold' ? 'normal' : 'bold' })}
                          className={`p-1.5 rounded transition-colors ${selectedTextAnnotation.fontWeight === 'bold' ? 'bg-blue-100 text-blue-600' : 'text-gray-500 hover:bg-gray-100'}`}
                          title="Bold"
                        >
                          <FaBold size={12} />
                        </button>
                        <button
                          onClick={() => updateTextAnnotation(selectedTextAnnotation.id, { fontStyle: selectedTextAnnotation.fontStyle === 'italic' ? 'normal' : 'italic' })}
                          className={`p-1.5 rounded transition-colors ${selectedTextAnnotation.fontStyle === 'italic' ? 'bg-blue-100 text-blue-600' : 'text-gray-500 hover:bg-gray-100'}`}
                          title="Italic"
                        >
                          <FaItalic size={12} />
                        </button>
                        <button
                          onClick={() => updateTextAnnotation(selectedTextAnnotation.id, { textDecoration: selectedTextAnnotation.textDecoration === 'underline' ? 'none' : 'underline' })}
                          className={`p-1.5 rounded transition-colors ${selectedTextAnnotation.textDecoration === 'underline' ? 'bg-blue-100 text-blue-600' : 'text-gray-500 hover:bg-gray-100'}`}
                          title="Underline"
                        >
                          <FaUnderline size={12} />
                        </button>
                      </div>
                    </div>

                    {/* Highlight (Background Color) */}
                    <div className="flex justify-between items-center mb-2">
                      <div className="flex items-center gap-1.5 text-gray-500">
                        <FaHighlighter size={12} />
                        <span>Highlight</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={selectedTextAnnotation.backgroundColor && selectedTextAnnotation.backgroundColor !== 'transparent' ? selectedTextAnnotation.backgroundColor : '#ffff00'}
                          onChange={(e) => updateTextAnnotation(selectedTextAnnotation.id, { backgroundColor: e.target.value })}
                          className="w-6 h-6 p-0 border-0 rounded cursor-pointer"
                        />
                        <button
                          onClick={() => updateTextAnnotation(selectedTextAnnotation.id, { backgroundColor: 'transparent' })}
                          className="text-xs text-red-500 hover:underline"
                        >
                          Clear
                        </button>
                      </div>
                    </div>
                    {/* Text Color */}
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-gray-500">Color</span>
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={selectedTextAnnotation.color || '#000000'}
                          onChange={(e) => updateTextAnnotation(selectedTextAnnotation.id, { color: e.target.value })}
                          className="sidebar-input w-20 text-xs"
                        />
                        <input
                          type="color"
                          value={selectedTextAnnotation.color || '#000000'}
                          onChange={(e) => updateTextAnnotation(selectedTextAnnotation.id, { color: e.target.value })}
                          className="w-6 h-6 p-0 border-0 rounded cursor-pointer"
                        />
                      </div>
                    </div>

                    {/* Position */}
                    <div className="grid grid-cols-2 gap-2 mt-3 pt-3 border-t border-gray-100">
                      <div className="flex items-center justify-between">
                        <span className="text-gray-500">X</span>
                        <input
                          type="number"
                          value={roundForDisplay(selectedTextAnnotation.x)}
                          onChange={(e) => {
                            const val = Number(e.target.value);
                            updateTextAnnotation(selectedTextAnnotation.id, { x: val });
                          }}
                          className="sidebar-input w-16 text-center"
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-gray-500">Y</span>
                        <input
                          type="number"
                          value={roundForDisplay(selectedTextAnnotation.y)}
                          onChange={(e) => {
                            const val = Number(e.target.value);
                            updateTextAnnotation(selectedTextAnnotation.id, { y: val });
                          }}
                          className="sidebar-input w-16 text-center"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Label Arrow Properties */}
                {itemType === 'label-arrow' && selectedLabelArrow && (
                  <div className="mt-3 pt-3 border-t border-gray-100">
                    <div className="text-xs font-semibold mb-2 text-gray-600">Label Arrow Properties</div>

                    {/* Label Text */}
                    <div className="mb-2">
                      <label className="block text-xs text-gray-500 mb-1">Label</label>
                      <input
                        type="text"
                        value={selectedLabelArrow.label}
                        onChange={(e) => updateLabelArrow(selectedLabelArrow.id, { label: e.target.value })}
                        className="w-full text-sm border rounded px-2 py-1 bg-white"
                      />
                    </div>

                    {/* Font Size */}
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-gray-500">Font Size</span>
                      <input
                        type="number"
                        value={selectedLabelArrow.fontSize || 14}
                        onChange={(e) => {
                          const val = Number(e.target.value);
                          updateLabelArrow(selectedLabelArrow.id, { fontSize: Math.max(8, Math.min(72, val)) });
                        }}
                        className="sidebar-input w-16 text-center"
                        min={8}
                        max={72}
                      />
                    </div>

                    <div className="flex justify-between items-center mb-2">
                      <span className="text-gray-500">Font</span>
                      <select
                        value={selectedLabelArrow.fontFamily || 'Inter, sans-serif'}
                        onChange={(e) => updateLabelArrow(selectedLabelArrow.id, { fontFamily: e.target.value })}
                        className="text-xs border rounded px-2 py-1 bg-white w-36"
                      >
                        {textStyleFonts.map((font) => (
                          <option key={font} value={font}>{getFontDisplayName(font)}</option>
                        ))}
                      </select>
                    </div>

                    {/* Color */}
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-gray-500">Color</span>
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={selectedLabelArrow.color || '#000000'}
                          onChange={(e) => updateLabelArrow(selectedLabelArrow.id, { color: e.target.value })}
                          className="sidebar-input w-20 text-xs"
                        />
                        <input
                          type="color"
                          value={selectedLabelArrow.color || '#000000'}
                          onChange={(e) => updateLabelArrow(selectedLabelArrow.id, { color: e.target.value })}
                          className="w-6 h-6 p-0 border-0 rounded cursor-pointer"
                        />
                      </div>
                    </div>

                    {/* Stroke Width */}
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-gray-500">Stroke Width</span>
                      <input
                        type="number"
                        value={selectedLabelArrow.strokeWidth || 3}
                        onChange={(e) => {
                          const val = Number(e.target.value);
                          updateLabelArrow(selectedLabelArrow.id, { strokeWidth: Math.max(1, val) });
                        }}
                        className="sidebar-input w-16 text-center"
                        min={1}
                      />
                    </div>

                    <div className="flex justify-between items-center mb-2">
                      <span className="text-gray-500">Label Position</span>
                      <select
                        value={(selectedLabelArrow as any).textPosition || 'bottom'}
                        onChange={(e) => updateLabelArrow(selectedLabelArrow.id, { textPosition: e.target.value as any })}
                        className="sidebar-input w-28 text-xs"
                      >
                        <option value="bottom">Bottom (Tail)</option>
                        <option value="middle">Center</option>
                        <option value="top">Top (Head)</option>
                      </select>
                    </div>

                    <div className="grid grid-cols-2 gap-2 mb-2">
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Arrow Head</label>
                        <select
                          value={(selectedLabelArrow as any).arrowHeadType || 'filled-triangle'}
                          onChange={(e) => updateLabelArrow(selectedLabelArrow.id, { arrowHeadType: e.target.value as any })}
                          className="sidebar-input w-full text-xs"
                        >
                          <option value="filled-triangle">Filled Triangle</option>
                          <option value="triangle">Triangle</option>
                          <option value="open">Open</option>
                          <option value="circle">Circle</option>
                          <option value="square">Square</option>
                          <option value="diamond">Diamond</option>
                          <option value="bar">Bar</option>
                          <option value="none">None</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Arrow Bottom</label>
                        <select
                          value={(selectedLabelArrow as any).arrowTailType || 'none'}
                          onChange={(e) => updateLabelArrow(selectedLabelArrow.id, { arrowTailType: e.target.value as any })}
                          className="sidebar-input w-full text-xs"
                        >
                          <option value="none">None</option>
                          <option value="bar">Bar</option>
                          <option value="circle">Circle</option>
                          <option value="square">Square</option>
                          <option value="diamond">Diamond</option>
                          <option value="triangle">Triangle</option>
                          <option value="filled-triangle">Filled Triangle</option>
                          <option value="open">Open</option>
                        </select>
                      </div>
                    </div>
                  </div>
                )}

                {/* Dimension Properties */}
                {itemType === 'dimension' && selectedDimension && (
                  <div className="mt-3 pt-3 border-t border-gray-100">
                    <div className="text-xs font-semibold mb-2 text-gray-600">Dimension Properties</div>


                    {/* Value Override */}
                    <div className="mb-2">
                      <label className="block text-xs text-gray-500 mb-1">Text Value (Override)</label>
                      <input
                        type="text"
                        placeholder="Auto"
                        value={selectedDimension.value || ''}
                        onChange={(e) => {
                          const val = e.target.value ? parseFloat(e.target.value) : undefined;
                          updateDimension(selectedDimension.id, { value: isNaN(val as number) ? undefined : val });
                        }}
                        className="w-full text-sm border rounded px-2 py-1 bg-white"
                      />
                    </div>

                    {/* Style / Type */}
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-gray-500 text-xs">Line Style</span>
                      <select
                        value={selectedDimension.lineStyle || 'solid'}
                        onChange={(e) => updateDimension(selectedDimension.id, { lineStyle: e.target.value as any })}
                        className="text-xs border rounded px-2 py-1 bg-white w-32"
                      >
                        <option value="solid">Solid</option>
                        <option value="dashed">Dashed</option>
                        <option value="dotted">Dotted</option>
                        <option value="double">Double</option>
                      </select>
                    </div>

                    {/* Font Size */}
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-gray-500">Font Size</span>
                      <input
                        type="number"
                        value={selectedDimension.fontSize || 12}
                        onChange={(e) => {
                          const val = Number(e.target.value);
                          updateDimension(selectedDimension.id, { fontSize: Math.max(6, val) });
                        }}
                        className="sidebar-input w-16 text-center"
                        min={6}
                        max={500000}
                      />
                    </div>

                    <div className="pt-2 mt-2 mb-2 border-t border-gray-100 space-y-2">
                      <div className="text-[10px] uppercase font-bold text-gray-400">Dimension Text Style</div>
                      <div className="flex justify-between items-center">
                        <span className="text-gray-500 text-xs">Font</span>
                        <select
                          value={(selectedDimension as any).fontFamily || 'Inter, sans-serif'}
                          onChange={(e) => updateDimension(selectedDimension.id, { fontFamily: e.target.value } as any)}
                          className="text-xs border rounded px-2 py-1 bg-white w-32"
                        >
                          {textStyleFonts.map((font) => (
                            <option key={font} value={font}>{getFontDisplayName(font)}</option>
                          ))}
                        </select>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-gray-500 text-xs">Style</span>
                        <div className="flex gap-1 bg-white p-0.5 rounded border">
                          <button
                            onClick={() => updateDimension(selectedDimension.id, { fontWeight: (selectedDimension as any).fontWeight === '700' ? '600' : '700' } as any)}
                            className={`p-1.5 rounded transition-colors ${(selectedDimension as any).fontWeight === '700' ? 'bg-blue-100 text-blue-600' : 'text-gray-500 hover:bg-gray-100'}`}
                          >
                            <FaBold size={12} />
                          </button>
                          <button
                            onClick={() => updateDimension(selectedDimension.id, { fontStyle: (selectedDimension as any).fontStyle === 'italic' ? 'normal' : 'italic' } as any)}
                            className={`p-1.5 rounded transition-colors ${(selectedDimension as any).fontStyle === 'italic' ? 'bg-blue-100 text-blue-600' : 'text-gray-500 hover:bg-gray-100'}`}
                          >
                            <FaItalic size={12} />
                          </button>
                          <button
                            onClick={() => updateDimension(selectedDimension.id, { textDecoration: (selectedDimension as any).textDecoration === 'underline' ? 'none' : 'underline' } as any)}
                            className={`p-1.5 rounded transition-colors ${(selectedDimension as any).textDecoration === 'underline' ? 'bg-blue-100 text-blue-600' : 'text-gray-500 hover:bg-gray-100'}`}
                          >
                            <FaUnderline size={12} />
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Color */}
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-gray-500">Color</span>
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={selectedDimension.color || '#000000'}
                          onChange={(e) => updateDimension(selectedDimension.id, { color: e.target.value })}
                          className="sidebar-input w-20 text-xs"
                        />
                        <input
                          type="color"
                          value={selectedDimension.color || '#000000'}
                          onChange={(e) => updateDimension(selectedDimension.id, { color: e.target.value })}
                          className="w-6 h-6 p-0 border-0 rounded cursor-pointer"
                        />
                      </div>
                    </div>

                    {/* Stroke Width */}
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-gray-500">Line Weight</span>
                      <input
                        type="number"
                        value={selectedDimension.strokeWidth || 1.5}
                        onChange={(e) => {
                          const val = Number(e.target.value);
                          updateDimension(selectedDimension.id, { strokeWidth: Math.max(0.2, val) });
                        }}
                        className="sidebar-input w-16 text-center"
                        min={0.2}
                        step={0.1}
                      />
                    </div>

                    {/* Text Position */}
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-gray-500">Text Position</span>
                      <select
                        value={selectedDimension.textPosition || 'inbetween'}
                        onChange={(e) => updateDimension(selectedDimension.id, { textPosition: e.target.value as any })}
                        className="text-xs border rounded px-2 py-1 bg-white"
                      >
                        <option value="inbetween">In-between</option>
                        <option value="above">Above Line</option>
                      </select>
                    </div>

                    {/* Label Position Side */}
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-gray-500">Label Side</span>
                      <select
                        value={selectedDimension.labelPosition || 'top-right'}
                        onChange={(e) => updateDimension(selectedDimension.id, { labelPosition: e.target.value as any })}
                        className="text-xs border rounded px-2 py-1 bg-white"
                      >
                        <option value="top-right">Top / Right</option>
                        <option value="bottom-left">Bottom / Left</option>
                      </select>
                    </div>

                    {/* Dimension Gap */}
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-gray-500">Dimension Gap</span>
                      <input
                        type="number"
                        value={selectedDimension.offset || 0}
                        onChange={(e) => {
                          const val = Number(e.target.value);
                          updateDimension(selectedDimension.id, { offset: val });
                        }}
                        className="sidebar-input w-16 text-center"
                        step={5}
                      />
                    </div>
                  </div>
                )}

                {/* Wall Properties */}
                {(itemType === 'wall' || (itemType === 'asset' && (selectedAsset as any)?.type === 'wall-segments')) && (selectedWall || selectedAsset) && (
                  <div className="mt-3 pt-3 border-t border-gray-100">
                    <div className="text-xs font-semibold mb-2 text-gray-600">Wall Properties</div>

                    {/* Wall Fill Type */}
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-gray-500 text-xs">Fill Type</span>
                      <select
                        value={(selectedItem as any).fillType || 'color'}
                        onChange={(e) => {
                          const val = e.target.value;
                          if (itemType === 'wall') {
                            updateWall(selectedItem.id, { fillType: val as any });
                            syncToScene(selectedItem.id, { fillType: val });
                          }
                          else {
                            updateAsset(selectedItem.id, { fillType: val } as any);
                            updateSceneAsset(selectedItem.id, { fillType: val } as any);
                          }
                        }}
                        className="text-xs border rounded px-2 py-1 bg-white"
                      >
                        <option value="color">Color</option>
                        <option value="texture">Texture</option>
                        <option value="hatch">Hatch</option>
                        <option value="none">None</option>
                      </select>
                    </div>

                    {/* Wall Stroke Properties */}
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-gray-500 text-xs">Stroke Width</span>
                      <input
                        type="number"
                        value={(selectedItem as any).strokeWidth || 0}
                        onChange={(e) => {
                          const val = Number(e.target.value);
                          if (itemType === 'wall') {
                            updateWall(selectedItem.id, { strokeWidth: val });
                            syncToScene(selectedItem.id, { strokeWidth: val });
                          } else {
                            updateAsset(selectedItem.id, { strokeWidth: val } as any);
                            updateSceneAsset(selectedItem.id, { strokeWidth: val } as any);
                          }
                        }}
                        className="sidebar-input w-16 text-center"
                        min={0}
                      />
                    </div>
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-gray-500 text-xs">Stroke Color</span>
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={(selectedItem as any).stroke || '#000000'}
                          onChange={(e) => {
                            const val = e.target.value;
                            if (itemType === 'wall') {
                              updateWall(selectedItem.id, { stroke: val });
                              syncToScene(selectedItem.id, { stroke: val });
                            } else {
                              updateAsset(selectedItem.id, { strokeColor: val } as any);
                              updateSceneAsset(selectedItem.id, { strokeColor: val } as any);
                            }
                          }}
                          className="sidebar-input w-20 text-xs"
                        />
                        <input
                          type="color"
                          value={(selectedItem as any).stroke || '#000000'}
                          onChange={(e) => {
                            const val = e.target.value;
                            if (itemType === 'wall') {
                              updateWall(selectedItem.id, { stroke: val });
                              syncToScene(selectedItem.id, { stroke: val });
                            } else {
                              updateAsset(selectedItem.id, { strokeColor: val } as any);
                              updateSceneAsset(selectedItem.id, { strokeColor: val } as any);
                            }
                          }}
                          className="w-6 h-6 p-0 border-0 rounded cursor-pointer"
                        />
                      </div>
                    </div>

                    {/* Wall Fill Color */}
                    {(!(selectedItem as any).fillType || (selectedItem as any).fillType === 'color') && (
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-gray-500">Fill Color</span>
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            value={(itemType === 'wall' ? (selectedItem as any).fill : (selectedItem as any).fillColor) || '#ffffff'}
                            onChange={(e) => {
                              const val = e.target.value;
                              if (itemType === 'wall') {
                                updateWall(selectedItem.id, { fill: val });
                                syncToScene(selectedItem.id, { fill: val });
                              }
                              else {
                                updateAsset(selectedItem.id, { fillColor: val });
                                updateSceneAsset(selectedItem.id, { fillColor: val });
                              }
                            }}
                            className="sidebar-input w-20 text-xs"
                          />
                          <input
                            type="color"
                            value={(itemType === 'wall' && !(selectedItem as any).wallSegments ? (selectedItem as any).fill : (selectedItem as any).fillColor) || '#ffffff'}
                            onChange={(e) => {
                              const val = e.target.value;
                              if (itemType === 'wall' && !(selectedItem as any).wallSegments) {
                                updateWall(selectedItem.id, { fill: val });
                                syncToScene(selectedItem.id, { fill: val });
                              }
                              else {
                                updateAsset(selectedItem.id, { fillColor: val });
                                updateSceneAsset(selectedItem.id, { fillColor: val });
                              }
                            }}
                            className="w-6 h-6 p-0 border-0 rounded cursor-pointer"
                          />
                        </div>
                      </div>
                    )}



                    {/* Wall Texture Fill */}
                    {(selectedItem as any).fillType === 'texture' && (
                      <div className="space-y-2 mb-2">
                        <div className="grid grid-cols-2 gap-2">
                          {texturePatterns.filter(p => !p.id.startsWith('hatch-')).map((pattern) => (
                            <button
                              key={pattern.id}
                              className={`aspect-square h-auto border rounded overflow-hidden relative ${(selectedItem as any).fillTexture === pattern.id ? 'ring-2 ring-blue-500' : 'border-gray-300'
                                }`}
                              onClick={() => {
                                const val = pattern.id;
                                if ((itemType as string) === 'wall' && !(selectedItem as any).wallSegments) {
                                  updateWall(selectedItem.id, { fillTexture: val });
                                  syncToScene(selectedItem.id, { fillTexture: val });
                                }
                                else {
                                  updateAsset(selectedItem.id, { fillTexture: val } as any);
                                  updateSceneAsset(selectedItem.id, { fillTexture: val } as any);
                                }
                              }}
                              title={pattern.name}
                            >
                              <svg width="100%" height="100%" viewBox="0 0 512 512" preserveAspectRatio="none">
                                {pattern.isImage ? (
                                  <image href={pattern.path} width="512" height="512" preserveAspectRatio="none" />
                                ) : (
                                  <>
                                    <defs dangerouslySetInnerHTML={{ __html: (pattern.svg || "").replace(/id="([^"]+)"/g, 'id="preview-wall-$1"') }} />
                                    <rect width="512" height="512" fill={`url(#preview-wall-${pattern.id})`} />
                                  </>
                                )}
                              </svg>
                            </button>
                          ))}
                        </div>
                        <div className="flex justify-between items-center mt-2">
                          <span className="text-gray-500 text-xs">Scale</span>
                          <input
                            type="number"
                            value={(selectedItem as any).fillTextureScale || 1}
                            onChange={(e) => {
                              const val = Number(e.target.value);
                              if (itemType === 'wall') {
                                updateWall(selectedItem.id, { fillTextureScale: val });
                                syncToScene(selectedItem.id, { fillTextureScale: val });
                              }
                              else {
                                updateAsset(selectedItem.id, { fillTextureScale: val } as any);
                                updateSceneAsset(selectedItem.id, { fillTextureScale: val } as any);
                              }
                            }}
                            className="sidebar-input w-12 text-center text-xs"
                            min={0.1}
                            max={10}
                            step={0.1}
                          />
                        </div>

                        <div className="flex justify-between items-center mt-2">
                          <span className="text-gray-500 text-xs">Thickness</span>
                          <input
                            type="number"
                            value={(selectedItem as any).fillTextureThickness || 1}
                            onChange={(e) => {
                              const val = Number(e.target.value);
                              const safeVal = Math.max(0.1, val);
                              if (itemType === 'wall') {
                                updateWall(selectedItem.id, { fillTextureThickness: safeVal });
                                syncToScene(selectedItem.id, { fillTextureThickness: safeVal });
                              }
                              else {
                                updateAsset(selectedItem.id, { fillTextureThickness: safeVal } as any);
                                updateSceneAsset(selectedItem.id, { fillTextureThickness: safeVal } as any);
                              }
                            }}
                            className="sidebar-input w-12 text-center text-xs"
                            min={0.1}
                            max={10}
                            step={0.1}
                          />
                        </div>
                      </div>
                    )}

                    {/* Wall Hatch Fill */}
                    {(selectedItem as any).fillType === 'hatch' && (
                      <div className="space-y-2 mb-2">
                        <div className="grid grid-cols-2 gap-2">
                          {texturePatterns.filter(p => p.id.startsWith('hatch-')).map((pattern) => (
                            <button
                              key={pattern.id}
                              className={`aspect-square h-auto border rounded overflow-hidden relative ${(selectedItem as any).fillTexture === pattern.id ? 'ring-2 ring-blue-500' : 'border-gray-300'
                                }`}
                              onClick={() => {
                                const val = pattern.id;
                                if ((itemType as string) === 'wall' && !(selectedItem as any).wallSegments) {
                                  updateWall(selectedItem.id, { fillTexture: val });
                                  syncToScene(selectedItem.id, { fillTexture: val });
                                }
                                else {
                                  updateAsset(selectedItem.id, { fillTexture: val } as any);
                                  updateSceneAsset(selectedItem.id, { fillTexture: val } as any);
                                }
                              }}
                              title={pattern.name}
                            >
                              <svg width="100%" height="100%" viewBox="0 0 512 512" preserveAspectRatio="none">
                                {pattern.isImage ? (
                                  <image href={pattern.path} width="512" height="512" preserveAspectRatio="none" />
                                ) : (
                                  <>
                                    <defs dangerouslySetInnerHTML={{ __html: (pattern.svg || "").replace(/id="([^"]+)"/g, 'id="preview-wall-hatch-$1"') }} />
                                    <rect width="512" height="512" fill={`url(#preview-wall-hatch-${pattern.id})`} />
                                  </>
                                )}
                              </svg>
                            </button>
                          ))}
                        </div>
                        <div className="flex justify-between items-center mt-2">
                          <span className="text-gray-500 text-xs">Scale</span>
                          <input
                            type="number"
                            value={(selectedItem as any).fillTextureScale || 1}
                            onChange={(e) => {
                              const val = Number(e.target.value);
                              if (itemType === 'wall') {
                                updateWall(selectedItem.id, { fillTextureScale: val });
                                syncToScene(selectedItem.id, { fillTextureScale: val });
                              }
                              else {
                                updateAsset(selectedItem.id, { fillTextureScale: val } as any);
                                updateSceneAsset(selectedItem.id, { fillTextureScale: val } as any);
                              }
                            }}
                            className="sidebar-input w-12 text-center text-xs"
                            min={0.1}
                            max={10}
                            step={0.1}
                          />
                        </div>

                        <div className="flex justify-between items-center mt-2">
                          <span className="text-gray-500 text-xs">Thickness</span>
                          <input
                            type="number"
                            value={(selectedItem as any).fillTextureThickness || 1}
                            onChange={(e) => {
                              const val = Number(e.target.value);
                              const safeVal = Math.max(0.1, val);
                              if (itemType === 'wall') {
                                updateWall(selectedItem.id, { fillTextureThickness: safeVal });
                                syncToScene(selectedItem.id, { fillTextureThickness: safeVal });
                              }
                              else {
                                updateAsset(selectedItem.id, { fillTextureThickness: safeVal } as any);
                                updateSceneAsset(selectedItem.id, { fillTextureThickness: safeVal } as any);
                              }
                            }}
                            className="sidebar-input w-12 text-center text-xs"
                            min={0.1}
                            max={10}
                            step={0.1}
                          />
                        </div>
                      </div>
                    )}



                    <div className="space-y-2 mb-2">
                      {/* Wall Thickness */}
                      <div className="flex justify-between items-center">
                        <span className="text-gray-500">Thickness</span>
                        <input
                          type="number"
                          value={(itemType === 'wall' && !(selectedItem as any).wallSegments ? (selectedItem as any).edges?.[0]?.thickness : (selectedItem as any).wallThickness) || 75}
                          onChange={(e) => {
                            const val = Number(e.target.value);
                            const safeVal = Math.max(1, val);
                            if (itemType === 'wall' && (selectedItem as any).edges && !(selectedItem as any).wallSegments) {
                              const updatedEdges = (selectedItem as any).edges.map((edge: any) => ({
                                ...edge,
                                thickness: safeVal
                              }));
                              updateWall(selectedItem.id, { edges: updatedEdges });
                              syncToScene(selectedItem.id, { edges: updatedEdges });
                            } else {
                              updateAsset(selectedItem.id, { wallThickness: safeVal } as any);
                              updateSceneAsset(selectedItem.id, { wallThickness: safeVal } as any);
                            }
                          }}
                          className="sidebar-input w-16 text-center"
                          min={1}
                        />
                      </div>

                      {/* Wall Length & Height */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <div className="flex flex-col">
                          <span className="text-[10px] text-gray-400 uppercase font-semibold mb-0.5">Length ({unitLabel})</span>
                          <input
                            type="number"
                            value={(() => {
                              if (itemType === 'wall' && (selectedItem as any).nodes) {
                                const xs = (selectedItem as any).nodes.map((n: any) => n.x);
                                if (xs.length) return roundForDisplay(Math.max(...xs) - Math.min(...xs)) || 0;
                              }
                              if ((itemType === 'wall' || itemType === 'asset') && (selectedItem as any).wallSegments) {
                                let len = 0;
                                (selectedItem as any).wallSegments.forEach((s: any) => {
                                  len += Math.hypot(s.end.x - s.start.x, s.end.y - s.start.y);
                                });
                                return roundForDisplay(len);
                              }
                              if (itemType === 'asset' && (selectedItem as any).wallNodes) {
                                const xs = (selectedItem as any).wallNodes.map((n: any) => n.x);
                                if (xs.length) return roundForDisplay(Math.max(...xs) - Math.min(...xs)) || 0;
                              }
                              return 0;
                            })()}
                            onChange={(e) => {
                              const newStoreLen = toStoreValue(Number(e.target.value), unitSystem);
                              if (newStoreLen <= 0) return;

                              // 1. Native Walls (nodes)
                              if (itemType === 'wall' && (selectedItem as any).nodes) {
                                const xs = (selectedItem as any).nodes.map((n: any) => n.x);
                                const minX = Math.min(...xs);
                                const maxX = Math.max(...xs);
                                const currentLen = maxX - minX;
                                if (currentLen === 0) return;
                                const centerX = (minX + maxX) / 2;
                                const scale = newStoreLen / currentLen;
                                const updatedNodes = (selectedItem as any).nodes.map((node: any) => ({
                                  ...node,
                                  x: centerX + (node.x - centerX) * scale
                                }));
                                updateWall(selectedItem.id, { nodes: updatedNodes });
                                syncToScene(selectedItem.id, { nodes: updatedNodes });
                              }

                              // 2. Asset Walls (AI generated wallNodes)
                              else if (itemType === 'asset' && (selectedItem as any).wallNodes) {
                                const xs = (selectedItem as any).wallNodes.map((n: any) => n.x);
                                const minX = Math.min(...xs);
                                const maxX = Math.max(...xs);
                                const currentLen = maxX - minX;
                                if (currentLen > 0) {
                                  const centerX = (minX + maxX) / 2;
                                  const scale = newStoreLen / currentLen;
                                  const updatedNodes = (selectedItem as any).wallNodes.map((node: any) => ({
                                    ...node,
                                    x: centerX + (node.x - centerX) * scale
                                  }));
                                  updateAsset(selectedItem.id, { wallNodes: updatedNodes } as any);
                                  updateSceneAsset(selectedItem.id, { wallNodes: updatedNodes } as any);
                                }
                              }

                              // 3. Manual Wall Segments (Perimeter Scale)
                              if ((selectedItem as any).wallSegments) {
                                const segments = (selectedItem as any).wallSegments;
                                let currentLen = 0;
                                segments.forEach((s: any) => {
                                  currentLen += Math.hypot(s.end.x - s.start.x, s.end.y - s.start.y);
                                });

                                if (currentLen > 0) {
                                  const scale = newStoreLen / currentLen;
                                  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
                                  segments.forEach((s: any) => {
                                    minX = Math.min(minX, s.start.x, s.end.x);
                                    maxX = Math.max(maxX, s.start.x, s.end.x);
                                    minY = Math.min(minY, s.start.y, s.end.y);
                                    maxY = Math.max(maxY, s.start.y, s.end.y);
                                  });
                                  const cx = (minX + maxX) / 2;
                                  const cy = (minY + maxY) / 2;

                                  const updatedSegments = segments.map((s: any) => ({
                                    ...s,
                                    start: {
                                      x: cx + (s.start.x - cx) * scale,
                                      y: cy + (s.start.y - cy) * scale
                                    },
                                    end: {
                                      x: cx + (s.end.x - cx) * scale,
                                      y: cy + (s.end.y - cy) * scale
                                    }
                                  }));

                                  updateAsset(selectedItem.id, { wallSegments: updatedSegments } as any);
                                  updateSceneAsset(selectedItem.id, { wallSegments: updatedSegments } as any);
                                }
                              }
                            }}
                            className="sidebar-input w-full text-center font-medium"
                          />
                        </div>

                        <div className="flex flex-col">
                          <span className="text-[10px] text-gray-400 uppercase font-semibold mb-0.5">Height ({unitLabel})</span>
                          <input
                            type="number"
                            value={(() => {
                              if (itemType === 'wall' && (selectedItem as any).nodes) {
                                const ys = (selectedItem as any).nodes.map((n: any) => n.y);
                                if (ys.length) return roundForDisplay(Math.max(...ys) - Math.min(...ys)) || 0;
                              }
                              if (itemType === 'asset' && (selectedItem as any).wallNodes) {
                                const ys = (selectedItem as any).wallNodes.map((n: any) => n.y);
                                if (ys.length) return roundForDisplay(Math.max(...ys) - Math.min(...ys)) || 0;
                              }
                              if ((selectedItem as any).wallSegments) {
                                const s = (selectedItem as any).wallSegments;
                                let minY = Infinity, maxY = -Infinity;
                                s.forEach((seg: any) => {
                                  minY = Math.min(minY, seg.start.y, seg.end.y);
                                  maxY = Math.max(maxY, seg.start.y, seg.end.y);
                                });
                                if (minY !== Infinity && maxY !== -Infinity) return roundForDisplay(maxY - minY);
                              }
                              return roundForDisplay((selectedItem as any).height || 3000);
                            })()}
                            onChange={(e) => {
                              const val = toStoreValue(Number(e.target.value), unitSystem);
                              if (val <= 0) return;

                              // 1. Native Walls (nodes)
                              if (itemType === 'wall' && (selectedItem as any).nodes) {
                                const ys = (selectedItem as any).nodes.map((n: any) => n.y);
                                const minY = Math.min(...ys);
                                const maxY = Math.max(...ys);
                                const currentH = maxY - minY;
                                if (currentH <= 0) return;
                                const centerY = (minY + maxY) / 2;
                                const scale = val / currentH;
                                const updatedNodes = (selectedItem as any).nodes.map((node: any) => ({
                                  ...node,
                                  y: centerY + (node.y - centerY) * scale
                                }));
                                updateWall(selectedItem.id, { nodes: updatedNodes });
                                syncToScene(selectedItem.id, { nodes: updatedNodes });
                                return;
                              }

                              // 2. Asset Walls (AI generated wallNodes)
                              if (itemType === 'asset' && (selectedItem as any).wallNodes) {
                                const ys = (selectedItem as any).wallNodes.map((n: any) => n.y);
                                const minY = Math.min(...ys);
                                const maxY = Math.max(...ys);
                                const currentH = maxY - minY;
                                if (currentH > 0) {
                                  const centerY = (minY + maxY) / 2;
                                  const scale = val / currentH;
                                  const updatedNodes = (selectedItem as any).wallNodes.map((node: any) => ({
                                    ...node,
                                    y: centerY + (node.y - centerY) * scale
                                  }));
                                  updateAsset(selectedItem.id, { wallNodes: updatedNodes } as any);
                                  updateSceneAsset(selectedItem.id, { wallNodes: updatedNodes } as any);
                                  return;
                                }
                              }

                              // 3. Manual Wall Segments (Scale Y)
                              if ((selectedItem as any).wallSegments) {
                                const segments = (selectedItem as any).wallSegments;
                                let minY = Infinity, maxY = -Infinity;
                                segments.forEach((s: any) => {
                                  minY = Math.min(minY, s.start.y, s.end.y);
                                  maxY = Math.max(maxY, s.start.y, s.end.y);
                                });
                                const currentH = maxY - minY;
                                if (currentH > 0) {
                                  const scale = val / currentH;
                                  const cy = (minY + maxY) / 2;
                                  const updatedSegments = segments.map((s: any) => ({
                                    ...s,
                                    start: {
                                      ...s.start,
                                      y: cy + (s.start.y - cy) * scale
                                    },
                                    end: {
                                      ...s.end,
                                      y: cy + (s.end.y - cy) * scale
                                    }
                                  }));
                                  updateAsset(selectedItem.id, { wallSegments: updatedSegments } as any);
                                  updateSceneAsset(selectedItem.id, { wallSegments: updatedSegments } as any);
                                  return;
                                }
                              }

                              if (itemType === 'wall') {
                                updateWall(selectedItem.id, { height: val } as any);
                                syncToScene(selectedItem.id, { height: val });
                              } else {
                                updateAsset(selectedItem.id, { height: val });
                                updateSceneAsset(selectedItem.id, { height: val });
                              }
                            }}
                            className="sidebar-input w-full text-center font-medium"
                          />
                        </div>
                      </div>
                    </div>
                    <div className="flex justify-between items-center mt-3 pt-3 border-t border-gray-100">
                      <span className="text-xs text-gray-500">Show Dimensions</span>
                      <button
                        onClick={() => {
                          const val = !((selectedItem as any).showDimensions);
                          updateWall(selectedItem.id, { showDimensions: val });
                        }}
                        className={`w-10 h-5 rounded-full flex items-center transition-colors px-1 ${(selectedItem as any).showDimensions ? 'bg-blue-600' : 'bg-gray-300'}`}
                      >
                        <div
                          className={`w-3.5 h-3.5 bg-white rounded-full shadow-sm transform transition-transform ${(selectedItem as any).showDimensions ? 'translate-x-5' : 'translate-x-0'}`}
                        />
                      </button>
                    </div>

                    {(selectedItem as any).showDimensions && (
                      <div className="space-y-2 mt-3">
                        <div className="flex justify-between items-center">
                          <span className="text-gray-500 text-xs">Line Style</span>
                          <select
                            value={(selectedItem as any).dimensionType || 'solid'}
                            onChange={(e) => updateWall(selectedItem.id, { dimensionType: e.target.value as any })}
                            className="text-xs border rounded px-2 py-1 bg-white w-32"
                          >
                            <option value="solid">Solid</option>
                            <option value="dashed">Dashed</option>
                            <option value="dotted">Dotted</option>
                          </select>
                        </div>

                        <div className="flex justify-between items-center">
                          <span className="text-gray-500 text-xs">Font Size</span>
                          <input
                            type="number"
                            min="6"
                            max="500000"
                            value={(selectedItem as any).dimensionFontSize || 12}
                            onChange={(e) => updateWall(selectedItem.id, { dimensionFontSize: Number(e.target.value) })}
                            className="sidebar-input w-16 text-center"
                          />
                        </div>

                        <div className="flex justify-between items-center">
                          <span className="text-gray-500 text-xs">Dimension Gap</span>
                          <input
                            type="number"
                            min="0"
                            max="500000"
                            value={(selectedItem as any).dimensionOffset !== undefined ? (selectedItem as any).dimensionOffset : 200}
                            onChange={(e) => updateWall(selectedItem.id, { dimensionOffset: Number(e.target.value) })}
                            className="sidebar-input w-16 text-center"
                          />
                        </div>

                        <div className="flex justify-between items-center">
                          <span className="text-gray-500 text-xs">Line Weight</span>
                          <input
                            type="number"
                            min="0.2"
                            step="0.1"
                            value={(selectedItem as any).dimensionStrokeWidth || 1.5}
                            onChange={(e) => updateWall(selectedItem.id, { dimensionStrokeWidth: Math.max(0.2, Number(e.target.value)) })}
                            className="sidebar-input w-16 text-center"
                          />
                        </div>

                        <div className="flex justify-between items-center">
                          <span className="text-gray-500 text-xs">Color</span>
                          <div className="flex items-center gap-2">
                            <input
                              type="text"
                              value={(selectedItem as any).dimensionColor || '#666666'}
                              onChange={(e) => updateWall(selectedItem.id, { dimensionColor: e.target.value })}
                              className="sidebar-input w-20 text-xs"
                            />
                            <input
                              type="color"
                              value={(selectedItem as any).dimensionColor || '#666666'}
                              onChange={(e) => updateWall(selectedItem.id, { dimensionColor: e.target.value })}
                              className="w-6 h-6 p-0 border-0 rounded cursor-pointer"
                            />
                          </div>
                        </div>

                        <div className="flex justify-between items-center">
                          <span className="text-gray-500 text-xs">Text Position</span>
                          <select
                            value={(selectedItem as any).dimensionTextPosition || 'inbetween'}
                            onChange={(e) => updateWall(selectedItem.id, { dimensionTextPosition: e.target.value as any })}
                            className="text-xs border rounded px-2 py-1 bg-white w-32"
                          >
                            <option value="inbetween">In-between</option>
                            <option value="above">Above Line</option>
                          </select>
                        </div>

                        <div className="flex justify-between items-center">
                          <span className="text-gray-500 text-xs">Label Side</span>
                          <select
                            value={(selectedItem as any).dimensionLabelPosition || 'top-right'}
                            onChange={(e) => updateWall(selectedItem.id, { dimensionLabelPosition: e.target.value as any })}
                            className="text-xs border rounded px-2 py-1 bg-white w-32"
                          >
                            <option value="top-right">Top / Right</option>
                            <option value="bottom-left">Bottom / Left</option>
                          </select>
                        </div>
                      </div>
                    )}
                  </div>
                )}



                {/* End Of Object Properties */}
              </div>
            )}

          </div>
        )}
      </div>

      {/* Workspace Numbering Section */}
      {tableNumberingItems.length > 0 && (
        <div className="mx-4 mb-6">
          <div className="text-[10px] uppercase font-bold text-slate-500 tracking-wider mb-2">
            Table Numbering
          </div>

          <div className="mb-4 pb-4 border-b border-slate-200/50 space-y-3">
            <div className="grid grid-cols-2 gap-1 rounded-lg bg-slate-100 p-1">
              {[
                { id: 'manual', label: 'Manual' },
                { id: 'auto', label: 'Auto' },
              ].map((mode) => (
                <button
                  key={mode.id}
                  onClick={() => setNumberingMode(mode.id as TableNumberingMode)}
                  className={`rounded-md px-2 py-1 text-xs font-semibold transition ${
                    numberingMode === mode.id
                      ? 'bg-white text-blue-600 shadow-sm'
                      : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  {mode.label}
                </button>
              ))}
            </div>

            {numberingMode === 'auto' && (
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-700">Auto-Numbering</span>
                <button
                  onClick={() => setIsNumberingEnabled(!isNumberingEnabled)}
                  className={`relative inline-flex h-5 w-10 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    isNumberingEnabled ? 'bg-blue-600' : 'bg-slate-300'
                  }`}
                >
                  <span className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    isNumberingEnabled ? 'translate-x-5' : 'translate-x-0'
                  }`} />
                </button>
              </div>
            )}
          </div>

          <div className="space-y-3">
            {numberingMode === 'auto' && (
              <>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-600">Start At</span>
                  <input
                    type="number"
                    value={startingNumber}
                    onChange={(e) => setStartingNumber(Math.max(1, parseInt(e.target.value) || 1))}
                    className="sidebar-input w-20 text-center text-xs"
                    min={1}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-600">Pattern</span>
                  <select
                    value={numberingPattern}
                    onChange={(e) => setNumberingPattern(e.target.value as any)}
                    className="text-xs border border-slate-200 rounded px-2 py-1 bg-white w-36 focus:ring-1 focus:ring-blue-500 outline-none"
                  >
                    <option value="linear">Linear</option>
                    <option value="s-direction">S Direction</option>
                  </select>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-600">Direction</span>
                  <select
                    value={numberingDirection}
                    onChange={(e) => setNumberingDirection(e.target.value as any)}
                    className="text-xs border border-slate-200 rounded px-2 py-1 bg-white w-48 focus:ring-1 focus:ring-blue-500 outline-none"
                  >
                    <option value="from-top-right-to-left">From Top (Right - Left)</option>
                    <option value="from-bottom-right-to-left">From Bottom (Right - Left)</option>
                    <option value="from-top-left-to-right">From Top (Left - Right)</option>
                    <option value="from-bottom-left-to-right">From Bottom (Left - Right)</option>
                    <option value="radial">Radial</option>
                  </select>
                </div>
              </>
            )}

            {numberingMode === 'manual' && (
              <div className="pt-3 mt-3 border-t border-slate-200/60 space-y-2">
                <div className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">
                  Manual Table Numbers
                </div>
                <div className="max-h-48 overflow-y-auto pr-1 space-y-1">
                  {tableNumberingItems.map((table, index) => (
                    <div key={`${table.type}-${table.id}`} className="flex items-center gap-2">
                      <span className="min-w-0 flex-1 truncate text-[11px] text-slate-500" title={table.label}>
                        {index + 1}. {table.label}
                      </span>
                      <input
                        type="text"
                        value={table.name || ''}
                        onChange={(e) => {
                          const updates = { tableName: e.target.value };
                          if (table.type === 'asset') updateAsset(table.id, updates);
                          else updateShape(table.id, updates);
                        }}
                        className="sidebar-input w-16 text-center text-xs"
                        placeholder="#"
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Position commented out per user request
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-600 font-medium">Position</span>
              <select
                value={globalTableNumberingPosition}
                onChange={(e) => setGlobalTableNumberingPosition(e.target.value as any, true)}
                className="text-xs border border-slate-200 rounded px-2 py-1 bg-white w-28 focus:ring-1 focus:ring-blue-500 outline-none"
              >
                <option value="center">Center</option>
                <option value="top">Top</option>
                <option value="bottom">Bottom</option>
                <option value="top-left">Top Left</option>
                <option value="top-right">Top Right</option>
                <option value="bottom-left">Bottom Left</option>
                <option value="bottom-right">Bottom Right</option>
                <option value="middle-left">Middle Left</option>
                <option value="middle-right">Middle Right</option>
              </select>
            </div>
            */}

            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-600 font-medium">Orientation</span>
              <div className="flex bg-slate-200/50 rounded p-0.5">
                {[
                  { id: 'horizontal', label: 'H' },
                  { id: 'vertical', label: 'V' }
                ].map(mode => (
                  <button
                    key={mode.id}
                    onClick={() => setGlobalTableNumberingOrientation(mode.id as any, true)}
                    className={`px-3 py-0.5 text-[10px] rounded transition-all ${
                      globalTableNumberingOrientation === mode.id
                        ? 'bg-white shadow-sm text-blue-600 font-bold'
                        : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    {mode.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="pt-3 mt-3 border-t border-slate-200/60 space-y-2">
              <div className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">
                Table Numbering Text
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-600">Font</span>
                <select
                  value={globalTableNumberingFontFamily}
                  onChange={(e) => setGlobalTableNumberingTextStyle({ fontFamily: e.target.value }, true)}
                  className="text-xs border border-slate-200 rounded px-2 py-1 bg-white w-36 focus:ring-1 focus:ring-blue-500 outline-none"
                >
                  {textStyleFonts.map((font) => (
                    <option key={font} value={font}>{getFontDisplayName(font)}</option>
                  ))}
                </select>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-600">Size</span>
                <input
                  type="number"
                  value={globalTableNumberingFontSize || 0}
                  onChange={(e) => setGlobalTableNumberingTextStyle({ fontSize: Math.max(0, Number(e.target.value) || 0) }, true)}
                  className="sidebar-input w-20 text-center text-xs"
                  min={0}
                  placeholder="Auto"
                />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-600">Color</span>
                <input
                  type="color"
                  value={globalTableNumberingColor || '#000000'}
                  onChange={(e) => setGlobalTableNumberingTextStyle({ color: e.target.value }, true)}
                  className="w-6 h-6 p-0 border-0 rounded cursor-pointer"
                />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-600">Style</span>
                <div className="flex gap-1 bg-white p-0.5 rounded border">
                  <button
                    onClick={() => setGlobalTableNumberingTextStyle({ fontWeight: globalTableNumberingFontWeight === '900' ? '600' : '900' }, true)}
                    className={`p-1.5 rounded transition-colors ${globalTableNumberingFontWeight === '900' ? 'bg-blue-100 text-blue-600' : 'text-gray-500 hover:bg-gray-100'}`}
                    title="Bold"
                  >
                    <FaBold size={12} />
                  </button>
                  <button
                    onClick={() => setGlobalTableNumberingTextStyle({ fontStyle: globalTableNumberingFontStyle === 'italic' ? 'normal' : 'italic' }, true)}
                    className={`p-1.5 rounded transition-colors ${globalTableNumberingFontStyle === 'italic' ? 'bg-blue-100 text-blue-600' : 'text-gray-500 hover:bg-gray-100'}`}
                    title="Italic"
                  >
                    <FaItalic size={12} />
                  </button>
                  <button
                    onClick={() => setGlobalTableNumberingTextStyle({ textDecoration: globalTableNumberingTextDecoration === 'underline' ? 'none' : 'underline' }, true)}
                    className={`p-1.5 rounded transition-colors ${globalTableNumberingTextDecoration === 'underline' ? 'bg-blue-100 text-blue-600' : 'text-gray-500 hover:bg-gray-100'}`}
                    title="Underline"
                  >
                    <FaUnderline size={12} />
                  </button>
                </div>
              </div>
            </div>
          </div>

          <p className="text-[9px] text-slate-400 mt-2 leading-tight italic">
            * Global position and orientation settings for all tables.
          </p>
        </div>
      )}
      </div>
        <ExportPanel />
      </div>
    </aside >
  );
}
