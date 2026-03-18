"use client";

import { useEffect, useState, useRef } from "react";
import { FiSearch, FiRefreshCw } from "react-icons/fi";
import { FaArrowUp } from "react-icons/fa";
import { GoPaperclip } from "react-icons/go";
import { motion, AnimatePresence } from "framer-motion";
import { useUserStore } from "@/store/userStore";
import { useSceneStore, AssetInstance } from "@/store/sceneStore";
import { useProjectStore, Asset as ProjectAsset, Shape, Wall } from "@/store/projectStore";
import { useEditorStore } from "@/store/editorStore";
import PlanPreview from "./dashboard/PlanPreview";
import { ASSET_LIBRARY } from "@/lib/assets";

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  assetSelection?: {
    category: string;
    message: string;
    options: { id: string; name: string; category: string; path: string }[];
  };
  previewData?: any[]; // Array of combined assets for PlanPreview
  planData?: any;
  rawPlan?: any;
}

export default function AiTrigger() {
  const [isOpen, setIsOpen] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const inputRef = useRef<HTMLInputElement | null>(null);
  const user = useUserStore((s: any) => s.user);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const messagesRef = useRef<HTMLDivElement | null>(null);

  // Workspace (Workspace2D) state - declare these first
  const workspaceAssets = useProjectStore((s: any) => s.assets);
  const workspaceShapes = useProjectStore((s) => s.shapes);
  const workspaceWalls = useProjectStore((s) => s.walls);
  const projectCanvas = useProjectStore((s) => s.canvas);
  const updateWorkspaceAsset = useProjectStore((s) => s.updateAsset);
  const updateWorkspaceShape = useProjectStore((s) => s.updateShape);
  const editorSelectedIds = useEditorStore((s: any) => s.selectedIds);
  const setEditorSelectedIds = useEditorStore((s) => s.setSelectedIds);

  // Workspace actions for applying AI plans - use projectStore for Workspace2D
  const addProjectAsset = useProjectStore((s) => s.addAsset);
  const addProjectShape = useProjectStore((s) => s.addShape);
  const addProjectWall = useProjectStore((s) => s.addWall);
  const updateProjectWall = useProjectStore((s) => s.updateWall);
  const deleteWorkspaceAsset = useProjectStore((s) => s.removeAsset);
  const deleteProjectWall = useProjectStore((s) => s.removeWall);
  const addGroup = useProjectStore((s) => s.addGroup);
  const removeGroup = useProjectStore((s) => s.removeGroup);
  const removeItemsBatch = useProjectStore((s) => s.removeItemsBatch);
  const copySelection = useProjectStore((s) => s.copySelection);
  const pasteSelection = useProjectStore((s) => s.pasteSelection);
  const batchUpdateItems = useProjectStore((s) => s.batchUpdateItems);
  const updateAsset = useSceneStore((s) => s.updateAsset);
  const canvas = projectCanvas || useSceneStore((s) => s.canvas);
  const existingAssets = [...workspaceAssets, ...useSceneStore((s) => s.assets)];
  const selectedAssetId = useSceneStore((s) => s.selectedAssetId);
  const selectedAssetIds = useSceneStore((s) => s.selectedAssetIds);

  type ResolvedSelection = {
    asset: AssetInstance;
    source: "scene" | "project-asset" | "project-shape" | "project-wall";
  };

  // Resolve current selected assets (from either new editor or Workspace2D),
  // optionally using IDs pushed from "Add to AI chat"
  // Returns empty array if no assets are explicitly selected for AI chat
  const getResolvedSelection = (): ResolvedSelection[] => {
    let idsFromContext: string[] | undefined;
    try {
      idsFromContext = (window as any).__ESP_AI_SELECTED_IDS__ as string[] | undefined;
      // If no explicit AI context IDs, return empty (general mode)
      if (!idsFromContext || idsFromContext.length === 0) {
        return [];
      }
    } catch {
      return [];
    }

    // Priority: explicit AI context IDs -> editor selection (Workspace2D) -> scene selection
    const sceneSelectionIds =
      selectedAssetId || (selectedAssetIds && selectedAssetIds.length)
        ? [
          ...(selectedAssetId ? [selectedAssetId] : []),
          ...(selectedAssetIds || []),
        ]
        : [];

    const baseIds =
      Array.isArray(idsFromContext) && idsFromContext.length > 0
        ? idsFromContext
        : editorSelectedIds && editorSelectedIds.length > 0
          ? editorSelectedIds
          : sceneSelectionIds;

    if (!baseIds || baseIds.length === 0) return [];

    const results: ResolvedSelection[] = [];

    baseIds.forEach((id: string) => {
      // 1) Workspace2D assets (check FIRST before scene)
      const projAsset = workspaceAssets.find((a: ProjectAsset) => a.id === id);
      if (projAsset) {
        const aiAsset: AssetInstance = {
          id: projAsset.id,
          type: projAsset.type,
          x: projAsset.x,
          y: projAsset.y,
          width: projAsset.width,
          height: projAsset.height,
          rotation: projAsset.rotation,
          scale: projAsset.scale,
          zIndex: projAsset.zIndex,
        };
        results.push({ asset: aiAsset, source: "project-asset" });
        return;
      }

      // 2) Workspace2D shapes
      const shape = workspaceShapes.find((s: Shape) => s.id === id);
      if (shape) {
        const aiAsset: AssetInstance = {
          id: shape.id,
          type: shape.type,
          x: shape.x,
          y: shape.y,
          width: shape.width,
          height: shape.height,
          rotation: shape.rotation,
          scale: 1,
          zIndex: shape.zIndex,
          fillColor: shape.fill,
          strokeColor: shape.stroke,
          strokeWidth: shape.strokeWidth,
        };
        results.push({ asset: aiAsset, source: "project-shape" });
        return;
      }

      // 3) Scene assets (check LAST)
      const sceneAsset = existingAssets.find((a: any) => a.id === id);
      if (sceneAsset) {
        results.push({ asset: sceneAsset, source: "scene" });
        return;
      }


      // 4) Workspace2D walls (convert to wall-segments AssetInstance for preview)
      const wall = workspaceWalls.find((w: Wall) => w.id === id);
      if (wall) {
        const nodes = wall.nodes.map((n) => ({ x: n.x, y: n.y }));
        const edges = wall.edges
          .map((e) => {
            const aIdx = wall.nodes.findIndex((n) => n.id === e.nodeA);
            const bIdx = wall.nodes.findIndex((n) => n.id === e.nodeB);
            if (aIdx === -1 || bIdx === -1) return null;
            return { a: aIdx, b: bIdx };
          })
          .filter((e): e is { a: number; b: number } => !!e);
        const thickness = wall.edges[0]?.thickness ?? 150;

        const aiAsset: AssetInstance = {
          id: wall.id,
          type: "wall-segments",
          x: 0,
          y: 0,
          scale: 1,
          rotation: 0,
          zIndex: wall.zIndex,
          wallNodes: nodes,
          wallEdges: edges,
          wallThickness: thickness,
        } as any;
        results.push({ asset: aiAsset, source: "project-wall" });
      }
    });

    return results;
  };

  const getCurrentSelectedAssets = () => getResolvedSelection().map((r: any) => r.asset);

  // Handle keyboard shortcut (Ctrl + K) and external "open AI" events / helpers
  useEffect(() => {
    const openFromExternal = () => {
      setIsOpen(true);
      // Slight delay so modal mounts before focusing
      setTimeout(() => {
        inputRef.current?.focus();
      }, 0);
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        openFromExternal();
      }
    };

    const handleAddToChat = (e: Event) => {
      const custom = e as CustomEvent<{ selectedIds?: string[] }>;
      if (custom.detail && Array.isArray(custom.detail.selectedIds)) {
        try {
          (window as any).__ESP_AI_SELECTED_IDS__ = custom.detail.selectedIds;
          const scene = useSceneStore.getState();
          scene.selectMultipleAssets(custom.detail.selectedIds);
        } catch {
          // ignore selection errors
        }
      }
      openFromExternal();
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("esp-open-ai-chat", openFromExternal as any);
    window.addEventListener("esp-add-to-ai-chat", handleAddToChat as any);
    try {
      // Expose an explicit helper so the editor can open the AI modal directly
      (window as any).__ESP_OPEN_AI_CHAT__ = openFromExternal;
    } catch {
      // ignore if window is not available
    }

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("esp-open-ai-chat", openFromExternal as any);
      window.removeEventListener("esp-add-to-ai-chat", handleAddToChat as any);
      try {
        if ((window as any).__ESP_OPEN_AI_CHAT__ === openFromExternal) {
          (window as any).__ESP_OPEN_AI_CHAT__ = undefined;
        }
      } catch {
        // ignore cleanup errors
      }
    };
  }, []);

  const handleAIClick = () => {
    // When clicking the CTA button, clear any selected assets and open in general mode
    // Only "Add to AI chat" should set selected assets
    try {
      (window as any).__ESP_AI_SELECTED_IDS__ = undefined;
      // Clear selection in scene store
      const scene = useSceneStore.getState();
      scene.selectAsset(null);
      scene.clearSelection();

      // Clear selection in editor store
      const editor = useEditorStore.getState();
      editor.clearSelection();

      setIsOpen(true);
      setTimeout(() => inputRef.current?.focus(), 0);
    } catch (e) {
      console.warn("Failed to clear selection", e);
      setIsOpen(true);
    }
  };

  const setPlacementMode = useEditorStore((s: any) => s.setPlacementMode);

  // ═══════════════════════════════════════════════════════════════════════════
  // LAYOUT ENGINE — Calculates positions from first principles.
  // We do NOT trust AI coordinates. We compute them from room size + counts.
  // ═══════════════════════════════════════════════════════════════════════════
  const processPlan = (plan: any, canvasRef: any) => {
    const generatedWalls: any[] = [];
    const generatedAssets: any[] = [];
    const generatedShapes: any[] = [];
    const generatedTextAnnotations: any[] = [];

    const canvasCenter = canvasRef?.width
      ? { x: canvasRef.width / 2, y: canvasRef.height / 2 }
      : { x: 5000, y: 5000 };

    // Helper: resolve loose name → { id, width, height } using ASSET_LIBRARY as source of truth
    const resolveAsset = (raw: string): { id: string; width: number; height: number } => {
      const r = (raw || '').toLowerCase();

      // Try direct library match first (exact id)
      const direct = ASSET_LIBRARY.find(a => a.id === raw);
      if (direct) return { id: direct.id, width: direct.width || 823, height: direct.height || 1018 };

      // Fuzzy match by checking includes
      let id = raw;
      if (r.includes('stage')) id = '1m-x-1m-modular-stage-2';
      else if (r.includes('6-seater') || r === '6-seater-rectangular-table-6') id = '6-seater-rectangular-table-6';
      else if (r.includes('10-seater') && r.includes('rect')) id = '10-seater-rectangular-table-6';
      else if (r.includes('round') && r.includes('6')) id = '6-seater-round-table';
      else if (r.includes('round') && r.includes('10')) id = '10-seater-round-table';
      else if (r.includes('round') && r.includes('12')) id = '12-seater-round-table';
      else if (r.includes('round') && r.includes('8')) id = '8-seater-round-table-1550mm-table';
      else if (r.includes('cocktail') && r.includes('4')) id = '4-seater-cocktail-table';
      else if (r.includes('cocktail')) id = '1000mm-cocktail-table';
      else if (r.includes('6ft') || r.includes('rectangular')) id = '6ft-x-3ft-rectangular-table-corrected';
      else if (r.includes('rect') || r.includes('seater')) id = '6-seater-rectangular-table-6';
      else if (r.includes('event-chair') || r.includes('event chair')) id = 'event-chair';
      else if (r.includes('padded')) id = 'padded-chair';
      else if (r.includes('office')) id = 'office-chair';
      else if (r.includes('stool')) id = 'cocktail-stool';
      else if (r.includes('marquee')) id = '12m-x-12m-marquee'; // Default fuzzy marquee
      else if (r.includes('chair') || r.includes('seat')) id = 'normal-chair';

      const def = ASSET_LIBRARY.find(a => a.id === id);
      return { id, width: def?.width || 600, height: def?.height || 600 };
    };

    // Thin wrapper for just the id (backwards compat)
    const resolveType = (raw: string) => resolveAsset(raw).id;

    // ─── 1. Parse Room ────────────────────────────────────────────────────────
    const WALL_THICKNESS = 150;
    const WALL_MARGIN = 700; // min clearance from inner wall face to any asset

    let roomW = 10000, roomH = 10000;
    if (Array.isArray(plan.walls) && plan.walls[0]) {
      let w = Number(plan.walls[0].widthMm || 10000);
      let h = Number(plan.walls[0].heightMm || 10000);
      if (w < 200) w *= 1000; // meters → mm
      if (h < 200) h *= 1000;
      roomW = w; roomH = h;
    }

    const roomCX = canvasCenter.x;
    const roomCY = canvasCenter.y;
    const wallMinX = roomCX - roomW / 2;
    const wallMinY = roomCY - roomH / 2;
    const wallMaxX = roomCX + roomW / 2;
    const wallMaxY = roomCY + roomH / 2;

    // Generate wall
    if (Array.isArray(plan.walls) && plan.walls.length > 0) {
      plan.walls.forEach((wallDef: any, wIndex: number) => {
        // If the AI explicitly provided nodes and edges, use them!
        if (wallDef.nodes && wallDef.edges) {
          const shiftX = roomCX - wallDef.centerX || 0;
          const shiftY = roomCY - wallDef.centerY || 0;
          generatedWalls.push({
            id: `wall-room-${wIndex}`,
            nodes: wallDef.nodes.map((n: any, i: number) => ({
              id: `rn-${wIndex}-${i}`,
              x: wallMinX + (n.xMm ?? n.x ?? 0),
              y: wallMinY + (n.yMm ?? n.y ?? 0)
            })),
            edges: wallDef.edges.map((e: any, i: number) => ({
              id: `re-${wIndex}-${i}`,
              nodeA: `rn-${wIndex}-${e.a ?? e.nodeA}`,
              nodeB: `rn-${wIndex}-${e.b ?? e.nodeB}`,
              thickness: e.thickness || wallDef.thicknessPx || WALL_THICKNESS
            })),
            zIndex: 0, 
            isClosed: wallDef.isClosed !== false
          });
        }
        // Otherwise, generate a bounding rectangle
        else if (wIndex === 0) {
          const nIds = ['rn-0', 'rn-1', 'rn-2', 'rn-3'];
          generatedWalls.push({
            id: 'wall-room',
            nodes: [
              { id: nIds[0], x: wallMinX, y: wallMinY },
              { id: nIds[1], x: wallMaxX, y: wallMinY },
              { id: nIds[2], x: wallMaxX, y: wallMaxY },
              { id: nIds[3], x: wallMinX, y: wallMaxY },
            ],
            edges: [
              { id: 're-0', nodeA: nIds[0], nodeB: nIds[1], thickness: WALL_THICKNESS },
              { id: 're-1', nodeA: nIds[1], nodeB: nIds[2], thickness: WALL_THICKNESS },
              { id: 're-2', nodeA: nIds[2], nodeB: nIds[3], thickness: WALL_THICKNESS },
              { id: 're-3', nodeA: nIds[3], nodeB: nIds[0], thickness: WALL_THICKNESS },
            ],
            zIndex: 0, isClosed: true
          });
        }
      });
    }

    // ─── 2. Define Usable Rect (shrinks as we place fixed elements) ───────────
    let usableMinX = wallMinX + WALL_MARGIN;
    let usableMaxX = wallMaxX - WALL_MARGIN;
    let usableMinY = wallMinY + WALL_MARGIN;
    let usableMaxY = wallMaxY - WALL_MARGIN;

    // ─── 3. Place Fixed Elements (Stage, etc.) First ─────────────────────────
    const STAGE_GAP = 1500; // clearance between stage and nearest table

    const assetList: any[] = Array.isArray(plan.assets) ? plan.assets : [];
    const chairsAroundList: any[] = Array.isArray(plan.chairsAround) ? plan.chairsAround : [];

    // Identify stages from assets
    const stageItems = assetList.filter((a: any) =>
      (a.assetType || a.assetName || '').toLowerCase().includes('stage')
    );
    const nonStageItems = assetList.filter((a: any) =>
      !(a.assetType || a.assetName || '').toLowerCase().includes('stage')
    );

    stageItems.forEach((a: any, idx: number) => {
      let sw = Number(a.widthMm || 6000);
      let sh = Number(a.heightMm || 3000);
      if (sw < 100) sw *= 1000;
      if (sh < 100) sh *= 1000;

      // ── Cap stage size: max 40% of room dimension so tables always have space
      const maxStageW = roomW * 0.4;
      const maxStageH = roomH * 0.7;
      if (sw > maxStageW) sw = maxStageW;
      if (sh > maxStageH) sh = maxStageH;

      const wallHint = (a.wall || a.position || '').toLowerCase();
      let sx = roomCX, sy = roomCY;

      if (typeof a.xMm === 'number' && typeof a.yMm === 'number') {
        let rawX = wallMinX + a.xMm;
        let rawY = wallMinY + a.yMm;
        sx = Math.max(wallMinX + sw / 2 + 100, Math.min(wallMaxX - sw / 2 - 100, rawX));
        sy = Math.max(wallMinY + sh / 2 + 100, Math.min(wallMaxY - sh / 2 - 100, rawY));
      } else if (wallHint.includes('left')) {
        sx = wallMinX + WALL_MARGIN + sw / 2;
        sy = roomCY;
        usableMinX = sx + sw / 2 + STAGE_GAP;
      } else if (wallHint.includes('right')) {
        sx = wallMaxX - WALL_MARGIN - sw / 2;
        sy = roomCY;
        usableMaxX = sx - sw / 2 - STAGE_GAP;
      } else if (wallHint.includes('top')) {
        sx = roomCX;
        sy = wallMinY + WALL_MARGIN + sh / 2;
        usableMinY = sy + sh / 2 + STAGE_GAP;
      } else if (wallHint.includes('bottom')) {
        sx = roomCX;
        sy = wallMaxY - WALL_MARGIN - sh / 2;
        usableMaxY = sy - sh / 2 - STAGE_GAP;
      } else if (wallHint.includes('center') || wallHint.includes('middle')) {
        sx = roomCX;
        sy = roomCY;
      } else {
        // Default: right wall (only if no coordinates AND no clear hint provided)
        sx = wallMaxX - WALL_MARGIN - sw / 2;
        sy = roomCY;
        usableMaxX = sx - sw / 2 - STAGE_GAP;
      }

      generatedAssets.push({
        id: `stage-${idx}`,
        type: resolveType(a.assetType || a.assetName || 'stage'),
        x: sx, y: sy,
        width: a.widthMm || sw,
        height: a.heightMm || sh,
        strokeWidth: a.strokeWidth || 5, // AI provided or natural 5
        strokeColor: a.strokeColor || '#1a1a1a',
        fillColor: a.fillColor || 'transparent',   // No fill by default per user request
        scale: 1, zIndex: 3
      });

      const stageName = a.tableName || a.name || a.label || 'Stage';
      generatedTextAnnotations.push({
        id: `label-stage-${idx}`, text: stageName,
        x: sx, y: sy, fontSize: 700,
        color: '#111111', backgroundColor: '#ffffff',
        type: 'text', zIndex: 200
      });
    });

    // ─── 4. Collect Table Specs ───────────────────────────────────────────────
    interface TableSpec {
      name?: string;
      chairCount: number;
      tableW: number;
      tableH: number;
      tableType: string;
      isRound: boolean;
    }

    const tableSpecs: TableSpec[] = [];
    const CHAIR_SIZE = 450;
    const CHAIR_GAP = 180; // gap from table edge to chair edge

    // From assets
    nonStageItems.forEach((a: any, idx: number) => {
      const rawType = (a.assetType || a.assetName || '').toLowerCase();
      const resolved = resolveAsset(a.assetType || a.assetName || '6-seater-rectangular-table-6');
      const libDef = ASSET_LIBRARY.find(x => x.id === resolved.id);
      const tw = libDef?.width || 823;
      const th = libDef?.height || 1018;
      const isRound = resolved.id.includes('round');

      if (typeof a.xMm === 'number' && typeof a.yMm === 'number') {
        // AI explicit dimensions take precedence over library defaults
        const w = a.widthMm ?? libDef?.width ?? tw;
        const h = a.heightMm ?? libDef?.height ?? th;

        let rawX = wallMinX + a.xMm;
        let rawY = wallMinY + a.yMm;
        let safeX = rawX;
        let safeY = rawY;

        // Don't clamp doors/windows strictly inside, they belong on the wall edge or slightly intersecting!
        const isDoorWindow = rawType.includes('door') || rawType.includes('window');
        if (!isDoorWindow) {
          const margin = 200; // Keep tables/sofas at least 200mm from the wall inner edge
          safeX = Math.max(wallMinX + w / 2 + margin, Math.min(wallMaxX - w / 2 - margin, safeX));
          safeY = Math.max(wallMinY + h / 2 + margin, Math.min(wallMaxY - h / 2 - margin, safeY));
        }

        generatedAssets.push({
          id: `ai-explicit-asset-${idx}`,
          type: resolved.id,
          x: safeX,
          y: safeY,
          width: w,
          height: h,
          rotation: a.rotation || 0,
          strokeWidth: a.strokeWidth || 5, // Respect AI request
          fillColor: a.fillColor || 'transparent', // No fill by default
          scale: 1,
          zIndex: rawType.includes('rug') || rawType.includes('carpet') ? 2 : 5
        });

        const name = a.tableName || a.name || a.label;
        if (name) {
          generatedTextAnnotations.push({
            id: `label-ai-explicit-${idx}`,
            text: name,
            x: a.xMm, y: a.yMm,
            fontSize: 250,
            color: '#111111', backgroundColor: '#ffffff',
            type: 'text', zIndex: 200
          });
        }
        return; // Skip adding to grid engine
      }

      // 2. If NO X/Y was provided, fall back to grid generator.
      // But skip standalone chairs without coordinates, since grid only does tables.
      const isChair = rawType.includes('chair') || rawType.includes('stool');
      if (isChair) return;

      tableSpecs.push({
        name: a.tableName || a.name || a.label,
        chairCount: Number(a.chairCount || a.chairs || 4),
        tableW: tw,
        tableH: isRound ? tw : th,
        tableType: resolved.id,
        isRound,
      });
    });

    // From chairsAround
    chairsAroundList.forEach((spec: any, idx: number) => {
      const resolved = resolveAsset(spec.tableAsset || '6-seater-rectangular-table-6');
      const libDef = ASSET_LIBRARY.find(x => x.id === resolved.id);
      const tw = libDef?.width || 823;
      const th = libDef?.height || 1018;
      const isRound = resolved.id.includes('round');

      // If AI explicitly provided X/Y, build the exact circle right away, no grid
      if (typeof spec.centerX === 'number' && typeof spec.centerY === 'number') {
        const radius = spec.radiusMm || (tw / 2 + CHAIR_GAP + CHAIR_SIZE / 2);
        const margin = 200;
        const outR = radius + CHAIR_SIZE / 2; // the entire footprint including chairs

        let cx = wallMinX + spec.centerX;
        let cy = wallMinY + spec.centerY;

        // Clamp to ensure chairs don't go through the walls
        cx = Math.max(wallMinX + outR + margin, Math.min(wallMaxX - outR - margin, cx));
        cy = Math.max(wallMinY + outR + margin, Math.min(wallMaxY - outR - margin, cy));

        // Add table
        generatedAssets.push({
          id: `ai-explicit-roundtable-${idx}`,
          type: resolved.id,
          x: cx, y: cy,
          width: tw, height: th,
          fillColor: 'transparent',
          scale: 1, zIndex: 5
        });

        // Add chairs
        const cCount = Number(spec.count || 4);

        for (let ci = 0; ci < cCount; ci++) {
          const angle = (ci / cCount) * Math.PI * 2 - Math.PI / 2;
          generatedAssets.push({
            id: `ai-explicit-roundchair-${idx}-${ci}`,
            type: 'normal-chair',
            x: cx + Math.cos(angle) * radius,
            y: cy + Math.sin(angle) * radius,
            rotation: (angle * 180 / Math.PI) + 90,
            width: CHAIR_SIZE, height: CHAIR_SIZE,
            fillColor: 'transparent',
            scale: 1, zIndex: 15
          });
        }

        const name = spec.tableName || spec.name;
        if (name) {
          generatedTextAnnotations.push({
            id: `label-ai-explicit-table-${idx}`,
            text: name,
            x: cx, y: cy, fontSize: 250,
            color: '#111111', backgroundColor: '#ffffff',
            type: 'text', zIndex: 200
          });
        }
        return; // Skip grid
      }

      tableSpecs.push({
        name: spec.tableName || spec.name,
        chairCount: Number(spec.count || 4),
        tableW: tw,
        tableH: isRound ? tw : th,
        tableType: resolved.id,
        isRound,
      });
    });

    // ─── 5. Calculate Grid Layout in Usable Area ─────────────────────────────
    let layoutWarning = '';
    if (tableSpecs.length > 0) {
      const N = tableSpecs.length;
      const gridCols = plan.gridLayout?.columns || Math.ceil(Math.sqrt(N));
      const gridRows = Math.ceil(N / gridCols);

      const TABLE_GAP = 900;

      const usableW = Math.max(1, usableMaxX - usableMinX);
      const usableH = Math.max(1, usableMaxY - usableMinY);

      // Compute natural (unscaled) cell dimensions
      // cellW = chairs-left + table + chairs-right + gap-to-next-cell
      const repTW0 = tableSpecs[0].tableW;
      const repTH0 = tableSpecs[0].tableH;
      const cellW0 = repTW0 + 2 * (CHAIR_SIZE + CHAIR_GAP) + TABLE_GAP;
      const cellH0 = repTH0 + 2 * (CHAIR_SIZE + CHAIR_GAP) + TABLE_GAP;
      // Total footprint = cols*cellW (each cell already contains the trailing gap)
      // But the LAST cell's trailing gap is excess, so subtract one TABLE_GAP
      const gridW0 = gridCols * cellW0 - TABLE_GAP;
      const gridH0 = gridRows * cellH0 - TABLE_GAP;

      // ── Auto-scale: shrink everything proportionally so it always fits
      const scaleX = gridW0 > usableW ? usableW / gridW0 : 1;
      const scaleY = gridH0 > usableH ? usableH / gridH0 : 1;
      const scaleFactor = Math.min(scaleX, scaleY) * 0.95; // 5% safety margin

      if (scaleFactor < 1) {
        if (scaleFactor < 0.7) {
          layoutWarning = `⚠️ The room is quite small for ${N} tables. Layout scaled to ${Math.round(scaleFactor * 100)}% to fit.`;
        } else {
          layoutWarning = `ℹ️ Layout scaled to ${Math.round(scaleFactor * 100)}% to fit within the room.`;
        }
      }

      // Effective (scaled) sizes
      const effChairSize = Math.round(CHAIR_SIZE * scaleFactor);
      const effChairGap = Math.round(CHAIR_GAP * scaleFactor);
      const effTableGap = Math.round(TABLE_GAP * scaleFactor);

      // Recompute cell and grid sizes at effective scale
      const repTW = Math.round(repTW0 * scaleFactor);
      const repTH = Math.round(repTH0 * scaleFactor);
      const cellW = repTW + 2 * (effChairSize + effChairGap) + effTableGap;
      const cellH = repTH + 2 * (effChairSize + effChairGap) + effTableGap;
      const gridW = gridCols * cellW - effTableGap;
      const gridH = gridRows * cellH - effTableGap;

      // Center the grid in the usable space
      const gridOriginX = usableMinX + (usableW - gridW) / 2;
      const gridOriginY = usableMinY + (usableH - gridH) / 2;

      tableSpecs.forEach((spec, i) => {
        const col = i % gridCols;
        const row = Math.floor(i / gridCols);

        // Scale this table's individual dimensions
        const tw = Math.round(spec.tableW * scaleFactor);
        const th = Math.round(spec.tableH * scaleFactor);

        // The cell starts at gridOriginX + col*cellW.
        // Inside the cell, the table center is at: chairs-on-left + table/2
        const tableCX = gridOriginX + col * cellW + (effChairSize + effChairGap) + tw / 2;
        const tableCY = gridOriginY + row * cellH + (effChairSize + effChairGap) + th / 2;

        // Place table — use EXACT library dimensions, same as drag-and-drop
        const libDef = ASSET_LIBRARY.find(x => x.id === spec.tableType);
        const renderW = libDef?.width ?? tw;
        const renderH = libDef?.height ?? th;
        generatedAssets.push({
          id: `table-${i}`,
          type: spec.tableType,
          x: tableCX, y: tableCY,
          width: renderW, height: renderH,
          strokeWidth: 5, // Natural mode default
          strokeColor: '#1a1a1a',
          fillColor: 'transparent', // No fill by default per user request
          scale: 1, zIndex: 5
        });

        // Label
        if (spec.name) {
          generatedTextAnnotations.push({
            id: `label-table-${i}`,
            text: spec.name,
            x: tableCX, y: tableCY,
            fontSize: Math.max(200, Math.round(380 * Math.min(scaleFactor, 1))),
            color: '#111111', backgroundColor: '#ffffff',
            type: 'text', zIndex: 200
          });
        }

        // ─── Chairs ──────────────────────────────────────────────────────────
        const cCount = spec.chairCount;
        const topChairY = tableCY - th / 2 - effChairGap - effChairSize / 2;
        const botChairY = tableCY + th / 2 + effChairGap + effChairSize / 2;
        const leftChairX = tableCX - tw / 2 - effChairGap - effChairSize / 2;
        const rightChairX = tableCX + tw / 2 + effChairGap + effChairSize / 2;

        if (spec.isRound) {
          const radius = tw / 2 + effChairGap + effChairSize / 2;
          for (let ci = 0; ci < cCount; ci++) {
            const angle = (ci / cCount) * Math.PI * 2 - Math.PI / 2;
            generatedAssets.push({
              id: `chair-${i}-${ci}`, type: 'normal-chair',
              x: tableCX + Math.cos(angle) * radius,
              y: tableCY + Math.sin(angle) * radius,
              rotation: (angle * 180 / Math.PI) + 90,
              width: effChairSize, height: effChairSize,
              strokeWidth: 5, scale: 1, zIndex: 15,
              fillColor: 'transparent'
            });
          }
        } else {
          const perimeter = 2 * (tw + th);
          const topCount = Math.max(1, Math.round(cCount * tw / perimeter));
          const botCount = Math.max(1, Math.round(cCount * tw / perimeter));
          const leftCount = Math.max(0, Math.round(cCount * th / perimeter));
          const rightCount = Math.max(0, cCount - topCount - botCount - leftCount);

          const addRow = (count: number, y: number, rot: number) => {
            for (let ci = 0; ci < count; ci++) {
              const x = tableCX - tw / 2 + (tw / (count + 1)) * (ci + 1);
              generatedAssets.push({
                id: `chair-${i}-r-${ci}-${rot}`, type: 'normal-chair',
                x, y, rotation: rot,
                width: effChairSize, height: effChairSize,
                strokeWidth: 5, scale: 1, zIndex: 15,
                fillColor: 'transparent'
              });
            }
          };
          const addCol = (count: number, x: number, rot: number) => {
            for (let ci = 0; ci < count; ci++) {
              const y = tableCY - th / 2 + (th / (count + 1)) * (ci + 1);
              generatedAssets.push({
                id: `chair-${i}-c-${ci}-${rot}`, type: 'normal-chair',
                x, y, rotation: rot,
                width: effChairSize, height: effChairSize,
                strokeWidth: 5, scale: 1, zIndex: 15,
                fillColor: 'transparent'
              });
            }
          };

          addRow(topCount, topChairY, 180);
          addRow(botCount, botChairY, 0);
          if (leftCount > 0) addCol(leftCount, leftChairX, 90);
          if (rightCount > 0) addCol(rightCount, rightChairX, 270);
        }
      });
    }

    // ─── 5.5 Primitive Shapes ────────────────────────────────────────────────
    if (Array.isArray(plan.shapes)) {
      plan.shapes.forEach((s: any, idx: number) => {
        let sx = roomCX;
        let sy = roomCY;
        if (typeof s.xMm === 'number') sx = wallMinX + s.xMm;
        else if (typeof s.x === 'number') sx = wallMinX + s.x;
        
        if (typeof s.yMm === 'number') sy = wallMinY + s.yMm;
        else if (typeof s.y === 'number') sy = wallMinY + s.y;

        generatedShapes.push({
          id: `ai-shape-${idx}`,
          type: s.type || 'rectangle',
          x: sx, y: sy,
          width: s.widthMm ?? s.width ?? 1000,
          height: s.heightMm ?? s.height ?? 1000,
          fill: s.fillColor || s.fill || 'transparent',
          stroke: s.strokeColor || s.stroke || '#000000',
          strokeWidth: s.strokeWidth ?? 5,
          rotation: s.rotation ?? 0,
          zIndex: 2,
        });
      });
    }

    // ─── 6. Text Annotations & Dimensions ────────────────────────────────────
    if (Array.isArray(plan.annotations)) {
      plan.annotations.forEach((a: any, idx: number) => {
        let sx = roomCX;
        let sy = wallMaxY - 600;
        if (typeof a.xMm === 'number') sx = wallMinX + a.xMm;
        else if (typeof a.x === 'number') sx = wallMinX + a.x;
        
        if (typeof a.yMm === 'number') sy = wallMinY + a.yMm;
        else if (typeof a.y === 'number') sy = wallMinY + a.y;

        if (a.type === 'dimension') {
          generatedShapes.push({
            id: `ai-dimension-${idx}`,
            type: 'line',
            x: sx, y: sy,
            width: a.widthMm ?? a.width ?? 1000,
            height: 10,
            stroke: a.strokeColor || '#000000',
            strokeWidth: 2,
            showDimensions: true,
            dimensionType: 'linear',
            rotation: a.rotation ?? 0,
            zIndex: 150
          });
        } else {
          generatedTextAnnotations.push({
            id: `ann-${idx}`, text: a.text || '',
            x: sx, y: sy,
            fontSize: Number(a.fontSize || 400),
            color: '#333', type: 'text', zIndex: 150
          });
        }
      });
    }

    return {
      walls: generatedWalls,
      assets: generatedAssets,
      shapes: generatedShapes,
      textAnnotations: generatedTextAnnotations,
      combined: [...generatedWalls, ...generatedAssets, ...generatedShapes, ...generatedTextAnnotations],
      warning: layoutWarning || undefined
    };
  };



  const applyPlan = (plan: any) => {
    if (!plan) return;
    const result = processPlan(plan, canvas);

    if (result.combined.length > 0) {
      setPlacementMode({
        active: true,
        data: {
          walls: result.walls,
          assets: result.assets,
          shapes: result.shapes,
          textAnnotations: result.textAnnotations
        }
      });
      const parts: string[] = [];
      if (result.assets.length > 0) parts.push(`${result.assets.length} items`);
      if (result.walls.length > 0) parts.push(`${result.walls.length} walls`);
      if (result.shapes.length > 0) parts.push(`${result.shapes.length} shapes`);

      const successMsg = `✅ Layout processed. Click anywhere on the workspace to place the ${parts.join(', ')}.`;
      const msgs: any[] = [{ role: 'assistant', content: successMsg }];
      if ((result as any).warning) {
        msgs.push({ role: 'assistant', content: (result as any).warning });
      }
      setMessages((m: any) => [...m, ...msgs]);
      setIsOpen(false);
      setInputValue("");
      return;
    }

    // 2. Process Modifications
    const mods = plan.modifications || plan.modification;
    if (Array.isArray(mods) && mods.length > 0) {
      let modCount = 0;
      mods.forEach((mod: any) => {
        const asset = workspaceAssets.find((a: any) => a.id === mod.assetId);
        if (asset) {
          const updates: any = {};
          if (mod.xMm !== undefined) updates.x = mod.xMm;
          if (mod.yMm !== undefined) updates.y = mod.yMm;
          if (mod.rotation !== undefined) updates.rotation = mod.rotation;
          if (mod.scale !== undefined) updates.scale = mod.scale;
          if (mod.fillColor !== undefined) updates.fillColor = mod.fillColor;
          updateWorkspaceAsset(mod.assetId, updates);
          modCount++;
        }
      });
      if (modCount > 0) {
        setMessages((m: any) => [...m, { role: 'assistant', content: `✅ Updated ${modCount} items.` }]);
      }
    }

    // 3. Process Operations (Delete, Align, Duplicate, Group, etc.)
    if (plan.operation) {
      const op = plan.operation;
      let opMessage = "";
      
      if (op.type === "delete") {
        const idsToDelete = op.deleteSelected 
          ? getResolvedSelection().map((a: any) => a.asset.id)
          : (op.assetIds || []);
        
        if (idsToDelete.length > 0) {
          removeItemsBatch(idsToDelete);
          opMessage = `Deleted ${idsToDelete.length} items`;
        }
      } 
      else if (op.type === "duplicate") {
        const selectedIds = getResolvedSelection().map((a: any) => a.asset.id);
        if (selectedIds.length > 0) {
          const count = op.count || 1;
          copySelection(selectedIds);
          let newIds: string[] = [];
          for (let i = 0; i < count; i++) {
            const pasted = pasteSelection();
            newIds.push(...(Array.isArray(pasted) ? pasted : []));
          }
          if (newIds.length > 0) setEditorSelectedIds(newIds);
          opMessage = `Duplicated items ${count} time(s)`;
        }
      }
      else if (op.type === "group") {
        const selectedIds = getResolvedSelection().map((a: any) => a.asset.id);
        if (selectedIds.length > 1) {
          const groupId = `group-${Date.now()}`;
          addGroup({ id: groupId, itemIds: selectedIds, zIndex: 100 });
          setEditorSelectedIds([groupId]);
          opMessage = `Grouped ${selectedIds.length} items`;
        }
      }
      else if (op.type === "ungroup") {
        const resolved = getResolvedSelection();
        let ungroupedCount = 0;
        let childrenToSelect: string[] = [];
        resolved.forEach((r: any) => {
           if (r.asset.isGroup) {
             removeGroup(r.asset.id);
             ungroupedCount++;
             if (r.asset.groupAssets) {
               childrenToSelect.push(...r.asset.groupAssets.map((c: any) => c.id));
             }
           }
        });
        if (ungroupedCount > 0) {
          setEditorSelectedIds(childrenToSelect);
          opMessage = `Ungrouped ${ungroupedCount} group(s)`;
        }
      }

      if (opMessage) {
        setMessages((m: any) => [...m, { role: 'assistant', content: `✅ ${opMessage}` }]);
      }
    }
  };

  // Handle interactive commands (resize, move, etc.)
  const handleInteractiveCommand = async (prompt: string) => {
    const resolved = getResolvedSelection();
    const selectedAssets = resolved.map((r: any) => r.asset);

    if (selectedAssets.length === 0) {
      setMessages((m: any) => [...m, {
        role: 'assistant',
        content: 'Please select an asset first. Click on a shape, table, or other item to select it.'
      }]);
      return;
    }

    // Check if selected asset is a group
    const groupAsset = selectedAssets.find((a: any) => a.isGroup && a.groupAssets);
    let groupContext = undefined;

    if (groupAsset && groupAsset.groupAssets) {
      // Calculate group bounds from child assets
      const childAssets = groupAsset.groupAssets;
      const minX = Math.min(...childAssets.map((a: any) => {
        const w = (a.width || 0) * (a.scale || 1);
        return (a.x || 0) - w / 2;
      }));
      const maxX = Math.max(...childAssets.map((a: any) => {
        const w = (a.width || 0) * (a.scale || 1);
        return (a.x || 0) + w / 2;
      }));
      const minY = Math.min(...childAssets.map((a: any) => {
        const h = (a.height || 0) * (a.scale || 1);
        return (a.y || 0) - h / 2;
      }));
      const maxY = Math.max(...childAssets.map((a: any) => {
        const h = (a.height || 0) * (a.scale || 1);
        return (a.y || 0) + h / 2;
      }));

      groupContext = {
        groupId: groupAsset.id,
        groupBounds: {
          minX,
          minY,
          maxX,
          maxY,
          width: maxX - minX,
          height: maxY - minY,
        },
        childAssets: childAssets.map((a: any) => ({
          id: a.id,
          type: a.type || 'unknown',
          x: a.x || 0,
          y: a.y || 0,
          width: a.width,
          height: a.height,
          fillColor: a.fillColor,
          strokeColor: a.strokeColor,
          scale: a.scale || 1,
          rotation: a.rotation || 0,
          // Add descriptive labels to help AI identify items
          description: a.type === 'ellipse' || a.type === 'circle' ? 'circle' :
            a.type === 'rectangle' ? 'rectangle' :
              a.type === 'wall-segments' ? 'wall' :
                a.type || 'item',
        })),
      };

      console.log('Group context created:', {
        groupId: groupAsset.id,
        childCount: childAssets.length,
        children: childAssets.map((a: any) => ({
          id: a.id,
          type: a.type,
          fillColor: a.fillColor,
          description: a.type === 'ellipse' || a.type === 'circle' ? 'circle' : a.type
        }))
      });
    }

    try {
      const res = await fetch("/api/ai/command", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt,
          selectedAssets: selectedAssets.map((a: any) => ({
            id: a.id,
            type: a.type,
            x: a.x,
            y: a.y,
            width: a.width,
            height: a.height,
            scale: a.scale,
            rotation: a.rotation,
            fill: a.fillColor,
            stroke: a.strokeColor,
            strokeWidth: a.strokeWidth,
            isGroup: a.isGroup,
            groupAssets: a.groupAssets?.map((ga: any) => ({
              id: ga.id,
              type: ga.type || 'unknown',
              x: ga.x || 0,
              y: ga.y || 0,
              width: ga.width,
              height: ga.height,
            })),
          })),
          canvas: canvas || projectCanvas,
          groupContext,
        }),
      });
      console.log('Sending to AI:', {
        prompt,
        selectedAssets: selectedAssets.map(a => ({
          id: a.id,
          type: a.type,
          width: a.width,
          height: a.height,
          fill: a.fillColor,
          stroke: a.strokeColor
        })),
        canvas: canvas || projectCanvas
      }); // Debug log
      const data = await res.json();

      if (data?.error) {
        // If AI returns an error, it means it can't handle this as a command
        // Throw to fall back to plan generation
        throw new Error(data.error);
      }

      if (data?.action) {
        console.log('AI Action Received:', data.action); // Debug log
        // Capture groupContext and prompt in closure for use in handlers
        const capturedGroupContext = groupContext;
        const capturedPrompt = prompt;
        // Apply the action to selected assets (both new editor + Workspace2D)
        resolved.forEach(({ asset, source }) => {
          console.log(`Applying action to ${source} asset:`, asset.id); // Debug log
          const applyToScene = () => {
            // Use captured groupContext and prompt
            const ctx = capturedGroupContext;
            const userPrompt = capturedPrompt;
            if (data.action.type === 'resize') {
              const scaleFactor = data.action.scaleFactor ?? 1;

              // DEBUG: Show in chat what's happening
              setMessages((m: any) => [...m, {
                role: 'assistant',
                content: `🔧 DEBUG: Resize triggered\nSource: ${source}\nAsset: ${asset.id}\nScaleFactor: ${scaleFactor}\nCurrentScale: ${asset.scale}`
              }]);
              console.log('🔧 RESIZE ACTION:', { source, assetId: asset.id, scaleFactor, currentScale: asset.scale, currentWidth: asset.width, currentHeight: asset.height });

              // For assets from projectStore, only update scale
              // For shapes, update width/height
              if (source === 'project-asset') {
                const nextScale = data.action.scale ?? (asset.scale || 1) * scaleFactor;
                console.log('📦 Updating ASSET scale:', { assetId: asset.id, nextScale });
                updateWorkspaceAsset(asset.id, { scale: nextScale });
                setMessages((m: any) => [...m, { role: 'assistant', content: `📦 Updated asset scale to ${nextScale}` }]);
              } else if (source === 'project-shape') {
                const nextWidth = data.action.width ?? (asset.width || 0) * scaleFactor;
                const nextHeight = data.action.height ?? (asset.height || 0) * scaleFactor;
                updateWorkspaceShape(asset.id, { width: nextWidth, height: nextHeight });
              } else {
                // Scene assets
                const nextWidth = data.action.width ?? (asset.width || 0) * scaleFactor;
                const nextHeight = data.action.height ?? (asset.height || 0) * scaleFactor;
                const nextScale = data.action.scale ?? (asset.scale || 1) * scaleFactor;
                updateAsset(asset.id, { width: nextWidth, height: nextHeight, scale: nextScale });
              }
            } else if (data.action.type === 'move') {
              const dx = data.action.dx ?? 0;
              const dy = data.action.dy ?? 0;
              const updates = {
                x: data.action.x !== undefined ? data.action.x : asset.x + dx,
                y: data.action.y !== undefined ? data.action.y : asset.y + dy,
              };
              if (source === 'project-asset') {
                updateWorkspaceAsset(asset.id, updates);
              } else if (source === 'project-shape') {
                updateWorkspaceShape(asset.id, updates);
              } else {
                updateAsset(asset.id, updates);
              }
            } else if (data.action.type === 'rotate') {
              const delta = data.action.deltaRotation ?? 0;
              const updates = {
                rotation: data.action.rotation !== undefined ? data.action.rotation : (asset.rotation || 0) + delta,
              };
              if (source === 'project-asset') {
                updateWorkspaceAsset(asset.id, updates);
              } else if (source === 'project-shape') {
                updateWorkspaceShape(asset.id, updates);
              } else {
                updateAsset(asset.id, updates);
              }
            } else if (data.action.type === 'update') {
              const rawUpdates = data.action.updates || {};
              const updates: any = { ...rawUpdates };
              // Normalize color props
              if (rawUpdates.fillColor && !rawUpdates.fill) {
                updates.fill = rawUpdates.fillColor;
              }
              if (rawUpdates.backgroundColor && !updates.fill && !rawUpdates.fill) {
                updates.fill = rawUpdates.backgroundColor;
              }
              if (rawUpdates.strokeColor && !rawUpdates.stroke) {
                updates.stroke = rawUpdates.strokeColor;
              }
              if (source === 'project-asset') {
                updateWorkspaceAsset(asset.id, updates);
              } else if (source === 'project-shape') {
                updateWorkspaceShape(asset.id, updates);
              } else {
                updateAsset(asset.id, updates);
              }
            } else if (data.action.type === 'moveWithinGroup') {
              // Handle moving a child asset within a group
              const groupAsset = existingAssets.find(a => a.id === asset.id && a.isGroup);
              if (!groupAsset || !(groupAsset as any).groupAssets) {
                console.error('Group not found or has no child assets');
                return;
              }

              // Try to find child asset by ID first, then by type/description/color
              const groupAssets = (groupAsset as any).groupAssets || [];
              let targetChildId = data.action.targetAssetId;
              let childAsset = groupAssets.find((ca: any) => ca.id === targetChildId);

              console.log('🔍 Looking for child asset:', {
                targetAssetId: targetChildId,
                found: !!childAsset,
                availableChildren: groupAssets.map((ca: any) => ({
                  id: ca.id,
                  type: ca.type,
                  fillColor: ca.fillColor,
                  description: ca.type === 'ellipse' || ca.type === 'circle' ? 'circle' : ca.type
                }))
              });

              // If not found by ID, try to find by type/description/color from prompt
              if (!childAsset) {
                const userPrompt = capturedPrompt || '';
                const promptLower = userPrompt.toLowerCase();

                // Try multiple matching strategies
                const matchingStrategies: Array<() => AssetInstance | undefined> = [
                  // Match by "blue circle" (both color and type)
                  () => {
                    if (promptLower.includes('blue') && promptLower.includes('circle')) {
                      return groupAssets.find((ca: any) =>
                        (ca.type === 'ellipse' || ca.type === 'circle') &&
                        (ca.fillColor === '#3b82f6' || ca.fillColor === '#0000ff' || ca.fillColor === '#60a5fa')
                      );
                    }
                    return undefined;
                  },
                  // Match by "circle" keyword
                  () => {
                    if (promptLower.includes('circle')) {
                      return groupAssets.find((ca: any) =>
                        ca.type === 'ellipse' || ca.type === 'circle'
                      );
                    }
                    return undefined;
                  },
                  // Match by "blue" color alone
                  () => {
                    if (promptLower.includes('blue')) {
                      return groupAssets.find((ca: any) =>
                        ca.fillColor === '#3b82f6' || ca.fillColor === '#0000ff' || ca.fillColor === '#60a5fa'
                      );
                    }
                    return undefined;
                  },
                  // Match by "rectangle"
                  () => {
                    if (promptLower.includes('rectangle')) {
                      return groupAssets.find((ca: any) =>
                        ca.type === 'rectangle'
                      );
                    }
                    return undefined;
                  },
                  // Match by "wall"
                  () => {
                    if (promptLower.includes('wall')) {
                      return groupAssets.find((ca: any) =>
                        ca.type === 'wall-segments'
                      );
                    }
                    return undefined;
                  },
                ];

                for (const strategy of matchingStrategies) {
                  childAsset = strategy();
                  if (childAsset) {
                    targetChildId = childAsset.id;
                    console.log('✅ Found child asset via fallback matching:', { id: childAsset.id, type: childAsset.type, fillColor: childAsset.fillColor });
                    break;
                  }
                }
              }

              if (!childAsset) {
                console.error('❌ Child asset not found!', {
                  targetAssetId: targetChildId,
                  prompt: capturedPrompt,
                  availableChildren: groupAssets.map((ca: any) => ({
                    id: ca.id,
                    type: ca.type,
                    fillColor: ca.fillColor
                  }))
                });
                setMessages((m: any) => [...m, {
                  role: 'assistant',
                  content: `Could not find the item you mentioned. Available items in the group: ${groupAssets.map((ca: any) => ca.type || 'unknown').join(', ')}`
                }]);
                return;
              }

              // Calculate new position based on position string or relative coordinates
              // Note: child assets have relative positions (centered at group origin)
              let newX = childAsset.x || 0;
              let newY = childAsset.y || 0;

              // Use group bounds from context or calculate from group asset
              const ctx = capturedGroupContext;
              const bounds = ctx?.groupBounds || {
                minX: -(groupAsset.width || 1000) / 2,
                minY: -(groupAsset.height || 1000) / 2,
                maxX: (groupAsset.width || 1000) / 2,
                maxY: (groupAsset.height || 1000) / 2,
                width: groupAsset.width || 1000,
                height: groupAsset.height || 1000,
              };

              console.log('MoveWithinGroup - Using bounds:', bounds, 'from context:', !!ctx);

              const childWidth = (childAsset.width || 0) * (childAsset.scale || 1);
              const childHeight = (childAsset.height || 0) * (childAsset.scale || 1);

              if (data.action.position) {
                switch (data.action.position) {
                  case 'top-left':
                    newX = bounds.minX + childWidth / 2;
                    newY = bounds.minY + childHeight / 2;
                    break;
                  case 'top-right':
                    newX = bounds.maxX - childWidth / 2;
                    newY = bounds.minY + childHeight / 2;
                    break;
                  case 'bottom-left':
                    newX = bounds.minX + childWidth / 2;
                    newY = bounds.maxY - childHeight / 2;
                    break;
                  case 'bottom-right':
                    newX = bounds.maxX - childWidth / 2;
                    newY = bounds.maxY - childHeight / 2;
                    break;
                  case 'center':
                    newX = (bounds.minX + bounds.maxX) / 2;
                    newY = (bounds.minY + bounds.maxY) / 2;
                    break;
                  case 'top-center':
                    newX = (bounds.minX + bounds.maxX) / 2;
                    newY = bounds.minY + childHeight / 2;
                    break;
                  case 'bottom-center':
                    newX = (bounds.minX + bounds.maxX) / 2;
                    newY = bounds.maxY - childHeight / 2;
                    break;
                  case 'left-center':
                    newX = bounds.minX + childWidth / 2;
                    newY = (bounds.minY + bounds.maxY) / 2;
                    break;
                  case 'right-center':
                    newX = bounds.maxX - childWidth / 2;
                    newY = (bounds.minY + bounds.maxY) / 2;
                    break;
                }
              } else if (data.action.relativeX !== undefined || data.action.relativeY !== undefined) {
                if (data.action.relativeX !== undefined) {
                  newX = bounds.minX + (bounds.width * data.action.relativeX);
                }
                if (data.action.relativeY !== undefined) {
                  newY = bounds.minY + (bounds.height * data.action.relativeY);
                }
              } else if (data.action.offsetX !== undefined || data.action.offsetY !== undefined) {
                // Apply offset from current position
                newX = (childAsset.x || 0) + (data.action.offsetX || 0);
                newY = (childAsset.y || 0) + (data.action.offsetY || 0);
              }

              // Update the child asset's position within the group
              const updatedGroupAssets = groupAssets.map((ca: any) =>
                ca.id === targetChildId
                  ? { ...ca, x: newX, y: newY }
                  : ca
              );

              console.log('Updating group asset:', {
                groupId: groupAsset.id,
                targetChildId,
                oldPosition: { x: childAsset.x, y: childAsset.y },
                newPosition: { x: newX, y: newY },
                bounds,
                updatedChildren: updatedGroupAssets.length,
                allChildren: groupAssets.map((ca: any) => ({ id: ca.id, type: ca.type, x: ca.x, y: ca.y }))
              });

              // Update the group asset with new child positions
              // Make sure we're updating the actual asset in the store
              const currentState = useSceneStore.getState();
              const currentGroupAsset = currentState.assets.find(a => a.id === groupAsset.id);

              if (currentGroupAsset) {
                console.log('Before update - current groupAssets:', currentGroupAsset.groupAssets?.map(ca => ({ id: ca.id, x: ca.x, y: ca.y })));

                // Update the asset with new groupAssets
                updateAsset(groupAsset.id, {
                  groupAssets: updatedGroupAssets,
                });

                // Verify the update
                setTimeout(() => {
                  const verifyState = useSceneStore.getState();
                  const updatedGroup = verifyState.assets.find(a => a.id === groupAsset.id);
                  console.log('After update - new groupAssets:', updatedGroup?.groupAssets?.map(ca => ({ id: ca.id, x: ca.x, y: ca.y })));

                  if (updatedGroup?.groupAssets) {
                    const movedChild = updatedGroup.groupAssets.find(ca => ca.id === targetChildId);
                    if (movedChild && (movedChild.x !== childAsset.x || movedChild.y !== childAsset.y)) {
                      console.log('✅ Successfully moved child asset!');
                    } else {
                      console.error('❌ Child asset position not updated!');
                    }
                  }
                }, 100);

                // Force a re-render by marking as changed
                useSceneStore.getState().hasUnsavedChanges = true;

                console.log('Group asset update called');
              } else {
                console.error('Group asset not found in store after update attempt');
              }
            }
          };

          const applyToWorkspace = () => {
            if (source === "project-asset") {
              if (data.action.type === 'resize') {
                const scaleFactor = data.action.scaleFactor ?? 1;
                const nextWidth =
                  data.action.width ??
                  (data.action.scaleFactor != null && asset.width != null
                    ? asset.width * scaleFactor
                    : asset.width);
                const nextHeight =
                  data.action.height ??
                  (data.action.scaleFactor != null && asset.height != null
                    ? asset.height * scaleFactor
                    : asset.height);
                const nextScale =
                  data.action.scale ??
                  (data.action.scaleFactor != null && asset.scale != null
                    ? asset.scale * scaleFactor
                    : asset.scale);
                updateWorkspaceAsset(asset.id, {
                  width: nextWidth as number | undefined,
                  height: nextHeight as number | undefined,
                  scale: nextScale as number | undefined,
                });
              } else if (data.action.type === 'move') {
                const dx = data.action.dx ?? 0;
                const dy = data.action.dy ?? 0;
                updateWorkspaceAsset(asset.id, {
                  x:
                    data.action.x !== undefined
                      ? data.action.x
                      : asset.x + dx,
                  y:
                    data.action.y !== undefined
                      ? data.action.y
                      : asset.y + dy,
                });
              } else if (data.action.type === 'rotate') {
                const delta = data.action.deltaRotation ?? 0;
                updateWorkspaceAsset(asset.id, {
                  rotation:
                    data.action.rotation !== undefined
                      ? data.action.rotation
                      : (asset.rotation || 0) + delta,
                });
              } else if (data.action.type === 'update') {
                const rawUpdates = data.action.updates || {};
                const updates: any = { ...rawUpdates };
                if (rawUpdates.fillColor && !rawUpdates.fill) {
                  updates.fill = rawUpdates.fillColor;
                }
                if (rawUpdates.backgroundColor && !updates.fill && !rawUpdates.fill) {
                  updates.fill = rawUpdates.backgroundColor;
                }
                if (rawUpdates.strokeColor && !rawUpdates.stroke) {
                  updates.stroke = rawUpdates.strokeColor;
                }
                updateWorkspaceAsset(asset.id, updates);
              }
            } else if (source === "project-shape") {
              if (data.action.type === 'resize') {
                const scaleFactor = data.action.scaleFactor ?? 1;
                const nextWidth =
                  data.action.width ??
                  (data.action.scaleFactor != null && asset.width != null
                    ? asset.width * scaleFactor
                    : asset.width);
                const nextHeight =
                  data.action.height ??
                  (data.action.scaleFactor != null && asset.height != null
                    ? asset.height * scaleFactor
                    : asset.height);
                updateWorkspaceShape(asset.id, {
                  width: nextWidth as number | undefined,
                  height: nextHeight as number | undefined,
                });
              } else if (data.action.type === 'move') {
                const dx = data.action.dx ?? 0;
                const dy = data.action.dy ?? 0;
                updateWorkspaceShape(asset.id, {
                  x:
                    data.action.x !== undefined
                      ? data.action.x
                      : asset.x + dx,
                  y:
                    data.action.y !== undefined
                      ? data.action.y
                      : asset.y + dy,
                });
              } else if (data.action.type === 'rotate') {
                const delta = data.action.deltaRotation ?? 0;
                updateWorkspaceShape(asset.id, {
                  rotation:
                    data.action.rotation !== undefined
                      ? data.action.rotation
                      : (asset.rotation || 0) + delta,
                });
              } else if (data.action.type === 'update') {
                const rawUpdates = data.action.updates || {};
                const updates: any = { ...rawUpdates };
                if (rawUpdates.fillColor && !rawUpdates.fill) {
                  updates.fill = rawUpdates.fillColor;
                }
                if (rawUpdates.backgroundColor && !updates.fill && !rawUpdates.fill) {
                  updates.fill = rawUpdates.backgroundColor;
                }
                if (rawUpdates.strokeColor && !rawUpdates.stroke) {
                  updates.stroke = rawUpdates.strokeColor;
                }
                updateWorkspaceShape(asset.id, updates);
              }
            }
          };

          if (source === "scene") {
            applyToScene();
          } else {
            console.log('Applying to workspace (project-shape/asset/wall)'); // Debug log
            applyToWorkspace();
          }
        });

        setMessages((m: any) => [...m, {
          role: 'assistant',
          content: data.message || 'Action completed successfully.'
        }]);
      } else if (data?.error) {
        // If error indicates this should go to plan generation, throw to trigger fallback
        if (data.error.includes('plan generation') || data.error.includes('not applicable')) {
          throw new Error(data.error);
        }
        setMessages((m: any) => [...m, { role: 'assistant', content: `Error: ${data.error}` }]);
      } else if (data?.message) {
        setMessages((m: any) => [...m, { role: 'assistant', content: data.message }]);
      } else {
        // No action and no error - AI couldn't understand as a command
        // Throw to fall back to plan generation
        throw new Error('Request not recognized as a command');
      }
    } catch (e: any) {
      // Re-throw if it's a "fallback to plan" error, otherwise show error message
      if (e?.message?.includes('plan generation') || e?.message?.includes('not applicable') || e?.message?.includes('not recognized')) {
        throw e; // Re-throw to trigger fallback in handleSubmit
      }
      console.error(e);
      setMessages((m: any) => [...m, { role: 'assistant', content: 'Sorry, I could not process that command.' }]);
      throw e; // Re-throw to trigger fallback
    }
  };

  const handleSubmit = async (overridePrompt?: string) => {
    if (!inputValue.trim() && !overridePrompt) return;
    const prompt = overridePrompt || inputValue.trim();
    setMessages((m: any) => [...m, { role: 'user', content: prompt }]);
    setIsLoading(true);

    const selectedAssets = getCurrentSelectedAssets();

    try {
      // If there are selected assets, try interactive command handler first
      // The AI will determine if it can handle the request
      if (selectedAssets.length > 0) {
        try {
          await handleInteractiveCommand(prompt);
          // If successful, we're done
          return;
        } catch (commandError: any) {
          console.log('Command handler result:', commandError);
          const msg = (commandError && (commandError.message || String(commandError))) || "";
          // Only fall back to plan generation for explicit routing errors
          if (
            !msg.includes('plan generation') &&
            !msg.includes('not applicable') &&
            !msg.includes('not recognized')
          ) {
            // Hard failure for command – we've already shown an error message in handleInteractiveCommand
            // Do NOT fall back to plan (which is layout-only and can't manipulate colors)
            return;
          }
          // Otherwise, continue to plan generation as fallback
        }
      }

      // Identify non-selected assets as obstacles for spatial awareness
      const obstacles = workspaceAssets
        .filter((wa: any) => !selectedAssets.some((sa: any) => sa.id === wa.id))
        .map((o: any) => ({
          id: o.id,
          type: o.type,
          x: o.x,
          y: o.y,
          width: o.width,
          height: o.height
        }));

      // Pass the conversation history (user/assistant only) to the server
      // Send the rawAssistantMessage if available to preserve JSON structure from previous turns
      const conversationHistory = messages
        .filter((m: any) => m.role === 'user' || m.role === 'assistant')
        .map((m: any) => ({
          role: m.role,
          content: m.role === 'assistant' && m.rawAssistantMessage ? m.rawAssistantMessage : m.content
        }));

      const res = await fetch("/api/ai/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: conversationHistory,
          prompt,
          canvas,
          obstacles: obstacles.length > 0 ? obstacles : undefined,
          selectedAssets: selectedAssets.length > 0 ? selectedAssets.map((a: any) => ({
            id: a.id,
            type: a.type,
            x: a.x,
            y: a.y,
            width: a.width,
            height: a.height
          })) : undefined
        }),
      });
      const data = await res.json();

      let previewData: any[] | undefined;
      let planData: any | undefined;
      let rawPlan: any | undefined;
      let assetSelection: any | undefined;

      if (data?.assetSelection) {
        assetSelection = data.assetSelection;
      }

      if (data?.plan) {
        planData = processPlan(data.plan, canvas);
        rawPlan = data.plan;
      }

      if (data?.preview) {
        try {
          const processed = processPlan(data.preview, canvas);
          previewData = processed.combined;
        } catch (e) {
          console.error("Preview processing failed", e);
        }
      }

      // Handle followUp (AI asking a clarifying question)
      const followUpText = data.followUp || null;

      if (assetSelection || planData || previewData || data.message || followUpText) {
        let content = '';
        if (data.message) content = data.message;
        else if (followUpText) content = followUpText;
        else if (planData) content = 'I have generated your plan draft. Click "Apply to Canvas" to use it.';
        else if (assetSelection) content = assetSelection.message || 'Please select an asset type:';
        else content = 'Done!';

        setMessages((m: any) => [...m, {
          role: 'assistant',
          content,
          assetSelection,
          planData,
          rawPlan,
          previewData,
          rawAssistantMessage: JSON.stringify(data)
        }]);
      } else if (data.error) {
        setMessages((m: any) => [...m, { role: 'assistant', content: `Error: ${data.error}` }]);
      } else {
        setMessages((m: any) => [...m, { role: 'assistant', content: 'I did not understand that request. Could you rephrase it?' }]);
      }
    } catch (e) {
      console.error(e);
      setMessages((m: any) => [...m, { role: 'assistant', content: 'Sorry, I could not process that request.' }]);
    } finally {
      setInputValue("");
      setIsLoading(false);
    }
  };

  // Auto-scroll to bottom when messages change or modal opens
  useEffect(() => {
    const el = messagesRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
  }, [messages, isLoading, isOpen]);

  return (
    <>
      {/* AI CTA Button */}
      <motion.button
        onClick={handleAIClick}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        className="fixed bottom-6 right-6 z-50 bg-gradient-to-r from-[var(--accent)] to-purple-600 text-white rounded-full shadow-lg hover:shadow-xl transition-all duration-200 flex items-center gap-2 px-4 py-3"
      >
        <FiSearch className="w-4 h-4" />
        <span className="text-sm font-medium">AI Assistant</span>
        <div className="text-xs bg-white/20 rounded px-1.5 py-0.5">
          Ctrl+K
        </div>
      </motion.button>

      {/* Modal */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[9999] flex items-center justify-center backdrop-blur-sm bg-black/30"
            onClick={() => setIsOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="w-[80vw] h-[90vh] bg-white shadow-xl rounded-lg p-6 flex flex-col items-center relative"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex-1 flex flex-col items-stretch justify-start w-full max-w-3xl min-h-0 overflow-hidden">
                <div className="flex flex-col gap-3 mb-4 flex-shrink-0 items-stretch">
                  <div className="flex items-center justify-between">
                    <h2 className="text-2xl font-bold">
                      Hello, {user?.firstName || user?.email || "there"}.
                    </h2>
                    <button
                      onClick={() => {
                        // 1. Clear Chat History
                        setMessages([]);
                        setInputValue("");

                        // 2. Clear Scene Store Selection (Legacy Editor)
                        const scene = useSceneStore.getState();
                        scene.selectAsset(null);
                        scene.clearSelection();

                        // 3. Clear Editor Store Selection (New Workspace)
                        const editor = useEditorStore.getState();
                        editor.clearSelection();

                        // 4. Clear Global AI Selection Context
                        try { (window as any).__ESP_AI_SELECTED_IDS__ = undefined; } catch { }

                        console.log('✅ AI session and all selections cleared.');
                      }}
                      title="Clear chat and selection"
                      className="px-3 py-1.5 text-sm font-medium text-gray-600 hover:text-gray-900 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors flex items-center gap-2"
                    >
                      <FiRefreshCw className="w-4 h-4" />
                      New Chat
                    </button>
                  </div>
                  {/* Selected assets preview for AI context */}
                  {(() => {
                    const selectedAssets = getCurrentSelectedAssets();
                    if (!selectedAssets.length) return null;
                    const primary = selectedAssets[0];
                    // Get full asset data from store to ensure groupAssets is populated
                    // Use existingAssets which is already reactive from the hook
                    const fullAsset = existingAssets.find(a => a.id === primary.id);
                    const isGroup = fullAsset?.isGroup && (fullAsset as any)?.groupAssets && (fullAsset as any).groupAssets.length > 0;
                    const groupAssets = (fullAsset as any)?.groupAssets || (primary as any).groupAssets;

                    // Debug logging
                    console.log('AI Display Check:', {
                      primaryId: primary.id,
                      primaryIsGroup: primary.isGroup,
                      primaryHasGroupAssets: !!(primary as any).groupAssets,
                      primaryGroupAssetsLength: (primary as any).groupAssets?.length,
                      fullAssetFound: !!fullAsset,
                      fullAssetIsGroup: fullAsset?.isGroup,
                      fullAssetGroupAssetsLength: (fullAsset as any)?.groupAssets?.length,
                      isGroup: isGroup,
                      groupAssetsLength: (groupAssets as any)?.length
                    });
                    const w = Math.round((primary.width || 0) * (primary.scale || 1));
                    const h = Math.round((primary.height || 0) * (primary.scale || 1));
                    return (
                      <div className="flex flex-col md:flex-row gap-3 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-left">
                        <div className="flex-1 flex flex-col justify-center">
                          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                            Working on
                          </span>
                          <span className="text-sm text-gray-800">
                            {(() => {
                              // Always check for group first, even if primary doesn't show it
                              if ((fullAsset as any)?.isGroup && (fullAsset as any)?.groupAssets && (fullAsset as any).groupAssets.length > 0) {
                                return (
                                  <div className="mt-1">
                                    <div className="font-medium">Group ({(fullAsset as any).groupAssets.length} items)</div>
                                    <div className="text-xs text-gray-600 mt-1.5 space-y-1 max-h-32 overflow-y-auto">
                                      {(fullAsset as any).groupAssets.map((child: any, idx: number) => (
                                        <div key={child.id || idx} className="flex items-center gap-2">
                                          <span
                                            className="w-3 h-3 rounded-full border border-gray-300 flex-shrink-0"
                                            style={{ backgroundColor: child.fillColor || 'transparent' }}
                                          ></span>
                                          <span className="capitalize">{child.type || 'unknown'}</span>
                                          {child.fillColor && (
                                            <span className="text-gray-400 text-xs">({child.fillColor})</span>
                                          )}
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                );
                              }

                              // Fallback to single item display
                              if (selectedAssets.length === 1) {
                                if (primary.type === "wall-segments") {
                                  // Calculate wall bounding box from nodes
                                  const nodes = (primary as any).nodes || (primary as any).wallNodes;
                                  const thickness = (primary as any).wallThickness || 150;

                                  if (nodes && nodes.length > 0) {
                                    const xs = nodes.map((n: any) => n.x);
                                    const ys = nodes.map((n: any) => n.y);
                                    const width = Math.round(Math.max(...xs) - Math.min(...xs));
                                    const height = Math.round(Math.max(...ys) - Math.min(...ys));

                                    return `${primary.type} — ${width}mm × ${height}mm (${thickness}mm thick)`;
                                  }
                                  return `${primary.type} — ${thickness}mm thick`;
                                }
                                return `${primary.type} — ${w || "?"}mm × ${h || "?"}mm`;
                              }
                              // Multiple selection: show a concise list of selected items
                              const maxItemsToShow = 6;
                              const items = selectedAssets.slice(0, maxItemsToShow);
                              return (
                                <div className="mt-1 space-y-1">
                                  <div className="font-medium">{selectedAssets.length} items selected</div>
                                  <div className="text-xs text-gray-600 space-y-0.5 max-h-32 overflow-y-auto">
                                    {items.map((item) => (
                                      <div key={item.id} className="flex items-center gap-2">
                                        <span
                                          className="w-3 h-3 rounded-full border border-gray-300 flex-shrink-0"
                                          style={{ backgroundColor: (item as any).fillColor || 'transparent' }}
                                        ></span>
                                        <span className="capitalize">{item.type || 'unknown'}</span>
                                      </div>
                                    ))}
                                    {selectedAssets.length > maxItemsToShow && (
                                      <div className="text-gray-400">+{selectedAssets.length - maxItemsToShow} more...</div>
                                    )}
                                  </div>
                                </div>
                              );
                            })()}
                          </span>
                          <span className="mt-1 text-xs text-gray-500">
                            Ask me to manipulate this element: "Resize this", "Move to center", "Change color", "Rotate 45 degrees", etc.
                          </span>
                          <button
                            type="button"
                            className="mt-1 self-start text-xs text-[var(--accent)] hover:underline"
                            onClick={() => {
                              try {
                                (window as any).__ESP_AI_SELECTED_IDS__ = undefined;
                              } catch {
                                // ignore
                              }
                            }}
                          >
                            Clear AI selection
                          </button>
                        </div>
                        <div className="w-full md:w-48 h-24 rounded-md overflow-hidden bg-white border border-gray-200 flex-shrink-0">
                          <PlanPreview
                            assets={selectedAssets as AssetInstance[]}
                            width={192}
                            height={96}
                            className="w-full h-full"
                          />
                        </div>
                      </div>
                    );
                  })()}
                </div>
                <div ref={messagesRef} className="flex-1 overflow-y-auto overscroll-contain rounded-lg p-4 space-y-3 min-h-0">
                  {messages.length === 0 ? (
                    <div className="space-y-2 flex flex-col items-center justify-center h-full">
                      <p className="text-gray-700 text-lg font-semibold mb-2 text-center">Ask anything</p>
                      <p className="text-gray-500 text-sm text-center max-w-md">
                        Ask me anything about your workspace, or select an element and ask me to manipulate it.
                      </p>
                      {(() => {
                        const selectedAssets = getCurrentSelectedAssets();
                        if (selectedAssets.length > 0) {
                          return (
                            <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-200 max-w-md">
                              <p className="text-sm text-blue-800 font-medium mb-1">
                                {selectedAssets.length} element{selectedAssets.length > 1 ? 's' : ''} selected
                              </p>
                              <p className="text-xs text-blue-600">
                                Try: "Resize this", "Move to center", "Change color", or "Rotate 45 degrees"
                              </p>
                            </div>
                          );
                        }
                        return null;
                      })()}
                    </div>
                  ) : (
                    messages.map((m, i) => (
                      <div key={i} className={`flex flex-col gap-2 ${m.role === 'user' ? 'items-end' : 'items-start'}`}>
                        <div className={`inline-block px-3 py-2 rounded-lg text-sm max-w-[85%] text-left ${m.role === 'user' ? 'bg-[var(--accent)] text-white' : 'bg-white border text-gray-800'}`}>
                          {m.content}
                        </div>

                        {/* Layout Preview */}
                        {m.planData && (
                          <div className="w-full mt-2 rounded-xl border border-slate-200 overflow-hidden bg-slate-50 relative group shadow-sm">
                            <div className="p-2 bg-white border-b border-slate-100 flex items-center justify-between">
                              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">Draft Preview</span>
                              <button
                                onClick={() => applyPlan(m.rawPlan)}
                                className="bg-[var(--accent)] text-white px-3 py-1 rounded-md text-[10px] font-bold hover:brightness-110 transition-all shadow-sm"
                              >
                                Apply to Canvas
                              </button>
                            </div>
                            <div className="aspect-video relative">
                              <PlanPreview
                                assets={m.planData.assets}
                                walls={m.planData.walls}
                                shapes={m.planData.shapes}
                                textAnnotations={m.planData.textAnnotations}
                                width={600}
                                height={300}
                                className="w-full h-full"
                              />
                            </div>
                          </div>
                        )}

                        {m.previewData && (
                          <div className="w-full mt-2 rounded-lg border border-gray-200 overflow-hidden bg-gray-50 aspect-video relative group">
                            <PlanPreview
                              assets={m.previewData}
                              width={600}
                              height={300}
                              className="w-full h-full"
                            />
                            <div className="absolute inset-0 bg-black/5 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                              <span className="bg-white/90 px-3 py-1.5 rounded-full text-xs font-medium shadow-sm border">Draft Preview</span>
                            </div>
                          </div>
                        )}

                        {/* Asset Selection Grid */}
                        {m.assetSelection && (
                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 w-full max-w-lg mt-1">
                            {m.assetSelection.options.map((option: { id: string; name: string; category: string; path: string }) => (
                              <button
                                key={option.id}
                                onClick={() => {
                                  handleSubmit(`I want to use the ${option.name}`);
                                }}
                                className="flex flex-col items-center p-2 rounded-md border border-gray-200 bg-white hover:border-[var(--accent)] hover:bg-blue-50 transition-all text-left"
                              >
                                <div className="w-full h-16 bg-white rounded mb-2 overflow-hidden flex items-center justify-center p-2 border border-gray-100 shadow-sm group-hover:bg-blue-50 transition-colors">
                                  <img
                                    src={option.path}
                                    alt={option.name}
                                    className="max-w-full max-h-full object-contain"
                                  />
                                </div>
                                <span className="text-[10px] font-medium text-gray-700 line-clamp-1 w-full">{option.name}</span>
                                <span className="text-[8px] text-gray-400 uppercase tracking-tighter w-full">{option.category}</span>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    ))
                  )}
                  {isLoading && (
                    <div className="text-left">
                      <span className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm bg-white border">
                        <span className="inline-flex gap-1">
                          <span className="w-1.5 h-1.5 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                          <span className="w-1.5 h-1.5 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '120ms' }}></span>
                          <span className="w-1.5 h-1.5 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '240ms' }}></span>
                        </span>
                        Thinking…
                      </span>
                    </div>
                  )}
                </div>
              </div>

              <div className="w-full max-w-lg relative flex-shrink-0 mt-4">
                {/* Left icon */}
                <div className="absolute left-3 top-1/2 -translate-y-1/2 bg-gray-200 p-2 rounded-full">
                  {inputValue ? (
                    <GoPaperclip className="text-gray-600 w-4 h-4" />
                  ) : (
                    <FiSearch className="text-gray-600 w-4 h-4" />
                  )}
                </div>

                <input
                  ref={inputRef}
                  type="text"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  placeholder="What do you need help with?"
                  className="w-full pl-14 pr-16 py-4 rounded-full placeholder:opacity-100 shadow-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[var(--accent)] text-[var(--accent)] bg-white"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleSubmit();
                    }
                  }}
                />

                {inputValue ? (
                  <button
                    onClick={() => handleSubmit()}
                    className="absolute right-2 top-1/2 -translate-y-1/2 bg-[var(--accent)] text-white rounded-full p-2 hover:bg-[var(--accent)] transition"
                  >
                    <FaArrowUp className="w-3 h-3" />
                  </button>
                ) : (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 text-xs bg-gray-100 border border-gray-300 rounded-full px-2 py-1 text-gray-600 select-none">
                    Ctrl + K
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

