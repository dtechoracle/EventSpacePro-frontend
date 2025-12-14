"use client";

import { useEffect, useState, useRef } from "react";
import { FiSearch } from "react-icons/fi";
import { FaArrowUp } from "react-icons/fa";
import { GoPaperclip } from "react-icons/go";
import { motion, AnimatePresence } from "framer-motion";
import { useUserStore } from "@/store/userStore";
import { useSceneStore, AssetInstance } from "@/store/sceneStore";
import { useProjectStore, Asset as ProjectAsset, Shape, Wall } from "@/store/projectStore";
import { useEditorStore } from "@/store/editorStore";
import PlanPreview from "./dashboard/PlanPreview";

export default function AiTrigger() {
  const [isOpen, setIsOpen] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const inputRef = useRef<HTMLInputElement | null>(null);
  const user = useUserStore((s) => s.user);
  const [messages, setMessages] = useState<{ role: 'user' | 'assistant'; content: string }[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const messagesRef = useRef<HTMLDivElement | null>(null);

  // Scene actions for applying AI plans
  const addAssetObject = useSceneStore((s) => s.addAssetObject);
  const updateAsset = useSceneStore((s) => s.updateAsset);
  const canvas = useSceneStore((s) => s.canvas);
  const existingAssets = useSceneStore((s) => s.assets);
  const selectedAssetId = useSceneStore((s) => s.selectedAssetId);
  const selectedAssetIds = useSceneStore((s) => s.selectedAssetIds);

  // Workspace (Workspace2D) state
  const workspaceAssets = useProjectStore((s) => s.assets);
  const workspaceShapes = useProjectStore((s) => s.shapes);
  const workspaceWalls = useProjectStore((s) => s.walls);
  const projectCanvas = useProjectStore((s) => s.canvas);
  const updateWorkspaceAsset = useProjectStore((s) => s.updateAsset);
  const updateWorkspaceShape = useProjectStore((s) => s.updateShape);
  const editorSelectedIds = useEditorStore((s) => s.selectedIds);

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

    baseIds.forEach((id) => {
      // 1) New editor assets in sceneStore
      const sceneAsset = existingAssets.find((a) => a.id === id);
      if (sceneAsset) {
        results.push({ asset: sceneAsset, source: "scene" });
        return;
      }

      // 2) Workspace2D assets
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

      // 3) Workspace2D shapes
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

  const getCurrentSelectedAssets = () => getResolvedSelection().map((r) => r.asset);

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
      scene.selectedAssetIds = [];
    } catch (e) {
      console.warn("Failed to clear selection", e);
    }
    setIsOpen(true);
  };

  const applyPlan = (plan: any) => {
    if (!plan) return;
    const createdAssetIds: string[] = [];
    const createdAssetsInBatch: AssetInstance[] = []; // Track assets created in this batch

    // Get canvas center - use actual canvas center or default to (0, 0) for safety
    const getCanvasCenter = () => {
      if (canvas?.width && canvas?.height) {
        return { x: canvas.width / 2, y: canvas.height / 2 };
      }
      // Default to origin if no canvas - viewport will show this
      return { x: 0, y: 0 };
    };
    const canvasCenter = getCanvasCenter();

    // Find empty space on canvas by checking existing asset bounding boxes
    // Keep assets away from canvas edges (at least 1000mm margin)
    const findEmptySpace = (requiredWidth: number, requiredHeight: number, margin = 100): { x: number; y: number } | null => {
      const edgeMargin = 1000; // Keep assets away from canvas edges

      if (existingAssets.length === 0 && createdAssetsInBatch.length === 0) {
        // No existing assets, use canvas center (but ensure it's away from edges)
        if (canvas?.width && canvas?.height) {
          const safeCenterX = Math.max(edgeMargin + requiredWidth / 2,
            Math.min(canvas.width - edgeMargin - requiredWidth / 2, canvas.width / 2));
          const safeCenterY = Math.max(edgeMargin + requiredHeight / 2,
            Math.min(canvas.height - edgeMargin - requiredHeight / 2, canvas.height / 2));
          return { x: safeCenterX, y: safeCenterY };
        }
        return canvasCenter;
      }

      // Get bounding boxes of all existing assets + newly created assets in this batch
      const occupiedAreas: Array<{ minX: number; minY: number; maxX: number; maxY: number }> = [];
      [...existingAssets, ...createdAssetsInBatch].forEach(asset => {
        if (asset.type === 'wall-segments' && asset.wallNodes) {
          // For walls, use wallNodes to calculate bounds
          let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
          asset.wallNodes.forEach(node => {
            minX = Math.min(minX, node.x);
            minY = Math.min(minY, node.y);
            maxX = Math.max(maxX, node.x);
            maxY = Math.max(maxY, node.y);
          });
          if (isFinite(minX)) {
            occupiedAreas.push({ minX, minY, maxX, maxY });
          }
        } else {
          // For other assets, use x, y, width, height
          const w = (asset.width || 50) * (asset.scale || 1);
          const h = (asset.height || 50) * (asset.scale || 1);
          occupiedAreas.push({
            minX: asset.x - w / 2,
            minY: asset.y - h / 2,
            maxX: asset.x + w / 2,
            maxY: asset.y + h / 2,
          });
        }
      });

      // Try to find empty space - start from top-left, scan grid-like
      const canvasWidth = canvas?.width || 10000;
      const canvasHeight = canvas?.height || 10000;
      const stepSize = 500; // mm - grid step for searching
      const halfW = requiredWidth / 2 + margin;
      const halfH = requiredHeight / 2 + margin;

      // Start from top-left corner, but keep away from edges
      const startY = edgeMargin;
      const endY = canvasHeight - edgeMargin;
      const startX = edgeMargin;
      const endX = canvasWidth - edgeMargin;

      for (let y = startY; y < endY; y += stepSize) {
        for (let x = startX; x < endX; x += stepSize) {
          const testX = x;
          const testY = y;

          // Ensure position is away from edges
          if (testX - halfW < edgeMargin || testX + halfW > canvasWidth - edgeMargin ||
            testY - halfH < edgeMargin || testY + halfH > canvasHeight - edgeMargin) {
            continue;
          }

          // Check if this position overlaps with any existing asset
          const overlaps = occupiedAreas.some(area => {
            return !(testX + halfW < area.minX - margin ||
              testX - halfW > area.maxX + margin ||
              testY + halfH < area.minY - margin ||
              testY - halfH > area.maxY + margin);
          });

          if (!overlaps) {
            return { x: testX, y: testY };
          }
        }
      }

      // If no empty space found, place at safe center (away from edges)
      if (canvas?.width && canvas?.height) {
        const safeCenterX = Math.max(edgeMargin + requiredWidth / 2,
          Math.min(canvas.width - edgeMargin - requiredWidth / 2, canvas.width / 2));
        const safeCenterY = Math.max(edgeMargin + requiredHeight / 2,
          Math.min(canvas.height - edgeMargin - requiredHeight / 2, canvas.height / 2));
        return { x: safeCenterX, y: safeCenterY };
      }
      return canvasCenter;
    };

    // Derive a primary wall bounding box if available (first rectangular wall)
    let wallBounds: { minX: number; minY: number; maxX: number; maxY: number } | null = null;
    if (Array.isArray(plan.walls) && plan.walls.length > 0) {
      const w = plan.walls[0];
      const width = Number(w.widthMm || 0);
      const height = Number(w.heightMm || 0);

      // Find empty space for the wall
      let cx = Number(w.centerX);
      let cy = Number(w.centerY);

      // If position not provided or invalid, find empty space
      if (!cx || !cy || !isFinite(cx) || !isFinite(cy) || Math.abs(cx) > 100000 || Math.abs(cy) > 100000) {
        const emptySpace = findEmptySpace(width, height, 200);
        if (emptySpace) {
          cx = emptySpace.x;
          cy = emptySpace.y;
        } else {
          // Use safe center away from edges
          const edgeMargin = 1000;
          if (canvas?.width && canvas?.height) {
            cx = Math.max(edgeMargin + width / 2,
              Math.min(canvas.width - edgeMargin - width / 2, canvas.width / 2));
            cy = Math.max(edgeMargin + height / 2,
              Math.min(canvas.height - edgeMargin - height / 2, canvas.height / 2));
          } else {
            cx = canvasCenter.x;
            cy = canvasCenter.y;
          }
        }
      }

      const halfW = width / 2;
      const halfH = height / 2;
      wallBounds = { minX: cx - halfW, minY: cy - halfH, maxX: cx + halfW, maxY: cy + halfH };
    }
    // Clamp position to reasonable bounds - if position is way too large, use safe center away from edges
    const validatePosition = (x: number, y: number, width = 0, height = 0): { x: number; y: number } => {
      const edgeMargin = 1000;
      // If position is NaN, Infinity, or way too large (likely error), use safe center
      if (!isFinite(x) || !isFinite(y) || Math.abs(x) > 100000 || Math.abs(y) > 100000) {
        if (canvas?.width && canvas?.height) {
          const safeX = Math.max(edgeMargin + width / 2,
            Math.min(canvas.width - edgeMargin - width / 2, canvas.width / 2));
          const safeY = Math.max(edgeMargin + height / 2,
            Math.min(canvas.height - edgeMargin - height / 2, canvas.height / 2));
          return { x: safeX, y: safeY };
        }
        return canvasCenter;
      }
      // Ensure position is away from edges
      if (canvas?.width && canvas?.height) {
        const halfW = width / 2;
        const halfH = height / 2;
        x = Math.max(edgeMargin + halfW, Math.min(canvas.width - edgeMargin - halfW, x));
        y = Math.max(edgeMargin + halfH, Math.min(canvas.height - edgeMargin - halfH, y));
      }
      return { x, y };
    };

    const clampInWall = (x: number, y: number, margin = 50, width = 0, height = 0) => {
      const valid = validatePosition(x, y, width, height);
      if (!wallBounds) return valid;
      const cx = Math.max(wallBounds.minX + margin, Math.min(wallBounds.maxX - margin, valid.x));
      const cy = Math.max(wallBounds.minY + margin, Math.min(wallBounds.maxY - margin, valid.y));
      return { x: cx, y: cy };
    };
    // Walls: rectangle defined by widthMm/heightMm, center optional
    if (Array.isArray(plan.walls)) {
      plan.walls.forEach((w: any, idx: number) => {
        const width = Number(w.widthMm || 0);
        const height = Number(w.heightMm || 0);
        let cx: number;
        let cy: number;

        if (idx === 0 && wallBounds) {
          // First wall uses the calculated position from wallBounds
          cx = (wallBounds.minX + wallBounds.maxX) / 2;
          cy = (wallBounds.minY + wallBounds.maxY) / 2;
        } else {
          // For additional walls, find empty space
          let providedCx = Number(w.centerX);
          let providedCy = Number(w.centerY);
          if (!providedCx || !providedCy || !isFinite(providedCx) || !isFinite(providedCy) ||
            Math.abs(providedCx) > 100000 || Math.abs(providedCy) > 100000) {
            const emptySpace = findEmptySpace(width, height, 200);
            if (emptySpace) {
              cx = emptySpace.x;
              cy = emptySpace.y;
            } else {
              cx = canvasCenter.x;
              cy = canvasCenter.y;
            }
          } else {
            cx = providedCx;
            cy = providedCy;
          }
        }
        const halfW = width / 2;
        const halfH = height / 2;
        const nodes = [
          { x: cx - halfW, y: cy - halfH },
          { x: cx + halfW, y: cy - halfH },
          { x: cx + halfW, y: cy + halfH },
          { x: cx - halfW, y: cy + halfH },
        ];
        const edges = [
          { a: 0, b: 1 },
          { a: 1, b: 2 },
          { a: 2, b: 3 },
          { a: 3, b: 0 },
        ];
        const wall: AssetInstance = {
          id: `wall-segments-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          type: "wall-segments",
          x: cx,
          y: cy,
          scale: 1,
          rotation: 0,
          zIndex: 0,
          wallNodes: nodes,
          wallEdges: edges,
          wallThickness: w.thicknessPx ?? 2,
          wallGap: 8,
          lineColor: "#000000",
          backgroundColor: "transparent", // No white box in center
        } as any;
        addAssetObject(wall);
        createdAssetIds.push(wall.id);
        createdAssetsInBatch.push(wall); // Track for empty space detection
      });
    }
    // Tables - auto-calculate positions if missing
    if (Array.isArray(plan.tables)) {
      const tableSpacing = 200; // mm between tables
      plan.tables.forEach((t: any, idx: number) => {
        const width = Number(t.widthMm || t.sizePx || 100);
        const height = Number(t.heightMm || t.sizePx || width);
        let x = Number(t.xMm);
        let y = Number(t.yMm);
        // Validate and auto-calculate position if missing or invalid
        // Check if x/y are undefined/null or invalid (NaN, Infinity, or way too large)
        if (t.xMm === undefined || t.xMm === null || t.yMm === undefined || t.yMm === null ||
          !isFinite(x) || !isFinite(y) || Math.abs(x) > 100000 || Math.abs(y) > 100000) {
          if (wallBounds) {
            const cols = Math.ceil(Math.sqrt(plan.tables.length));
            const row = Math.floor(idx / cols);
            const col = idx % cols;
            x = wallBounds.minX + (col + 0.5) * (wallBounds.maxX - wallBounds.minX) / cols;
            y = wallBounds.minY + (row + 0.5) * (wallBounds.maxY - wallBounds.minY) / cols;
          } else {
            x = canvasCenter.x + (idx % 3 - 1) * tableSpacing;
            y = canvasCenter.y + Math.floor(idx / 3) * tableSpacing;
          }
        }
        const pos = clampInWall(x, y, Math.max(width, height) / 2 + 20, width, height);
        const a: AssetInstance = {
          id: `table-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          type: t.assetType || "rectangular-table",
          x: pos.x,
          y: pos.y,
          scale: 1,
          rotation: Number(t.rotation || 0),
          zIndex: 1,
          width,
          height,
          backgroundColor: "transparent",
        } as any;
        addAssetObject(a);
        createdAssetIds.push(a.id);
        createdAssetsInBatch.push(a); // Track for empty space detection
      });
    }
    // Chairs
    if (Array.isArray(plan.chairs)) {
      plan.chairs.forEach((c: any, idx: number) => {
        const size = Number(c.widthMm || c.sizePx || 24);
        let x = Number(c.xMm);
        let y = Number(c.yMm);
        // Validate and auto-calculate position if missing or invalid
        if (c.xMm === undefined || c.xMm === null || c.yMm === undefined || c.yMm === null ||
          !isFinite(x) || !isFinite(y) || Math.abs(x) > 100000 || Math.abs(y) > 100000) {
          if (wallBounds) {
            const cols = Math.ceil(Math.sqrt(plan.chairs.length));
            const row = Math.floor(idx / cols);
            const col = idx % cols;
            x = wallBounds.minX + (col + 0.5) * (wallBounds.maxX - wallBounds.minX) / cols;
            y = wallBounds.minY + (row + 0.5) * (wallBounds.maxY - wallBounds.minY) / cols;
          } else {
            x = canvasCenter.x + (idx % 5 - 2) * 100;
            y = canvasCenter.y + Math.floor(idx / 5) * 100;
          }
        }
        const pos = clampInWall(x, y, size / 2 + 10, size, size);
        const a: AssetInstance = {
          id: `chair-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          type: c.assetType || "normal-chair",
          x: pos.x,
          y: pos.y,
          scale: 1,
          rotation: Number(c.rotation || 0),
          zIndex: 1,
          width: size,
          height: size,
          backgroundColor: "transparent",
        } as any;
        addAssetObject(a);
        createdAssetIds.push(a.id);
        createdAssetsInBatch.push(a); // Track for empty space detection
      });
    }
    // Chairs around: place chairs in a circle around a center and optionally drop a table at center
    if (Array.isArray(plan.chairsAround)) {
      plan.chairsAround.forEach((spec: any, idx: number) => {
        let cx = Number(spec.centerX);
        let cy = Number(spec.centerY);
        // Validate and auto-calculate center if missing or invalid
        if (spec.centerX === undefined || spec.centerX === null || spec.centerY === undefined || spec.centerY === null ||
          !isFinite(cx) || !isFinite(cy) || Math.abs(cx) > 100000 || Math.abs(cy) > 100000) {
          if (wallBounds) {
            const cols = Math.ceil(Math.sqrt(plan.chairsAround.length));
            const row = Math.floor(idx / cols);
            const col = idx % cols;
            cx = wallBounds.minX + (col + 0.5) * (wallBounds.maxX - wallBounds.minX) / cols;
            cy = wallBounds.minY + (row + 0.5) * (wallBounds.maxY - wallBounds.minY) / cols;
          } else {
            cx = canvasCenter.x + (idx % 3 - 1) * 300;
            cy = canvasCenter.y + Math.floor(idx / 3) * 300;
          }
        }
        const chairSize = Number(spec.chairSizePx || 24);
        const tableSize = Number(spec.tableSizePx || 24);
        const minRadius = Math.ceil((tableSize / 2) + chairSize + 10);
        const r = Math.max(minRadius, Number(spec.radiusMm || minRadius));
        const count = Math.max(1, Number(spec.count || 1));

        // Ensure center position is away from canvas edges
        const edgeMargin = 1000;
        const totalRadius = r + chairSize; // Maximum extent from center
        if (canvas?.width && canvas?.height) {
          cx = Math.max(edgeMargin + totalRadius,
            Math.min(canvas.width - edgeMargin - totalRadius, cx));
          cy = Math.max(edgeMargin + totalRadius,
            Math.min(canvas.height - edgeMargin - totalRadius, cy));
        }
        if (spec.tableAsset) {
          const table: AssetInstance = {
            id: `table-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            type: spec.tableAsset,
            x: cx,
            y: cy,
            scale: 1,
            rotation: 0,
            zIndex: 1,
            width: tableSize,
            height: tableSize,
            backgroundColor: 'transparent',
          } as any;
          addAssetObject(table);
          createdAssetIds.push(table.id);
          createdAssetsInBatch.push(table); // Track for empty space detection
        }
        for (let i = 0; i < count; i++) {
          const angle = (i / count) * Math.PI * 2;
          const x = cx + Math.cos(angle) * r;
          const y = cy + Math.sin(angle) * r;
          const chair: AssetInstance = {
            id: `chair-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 5)}`,
            type: spec.chairAsset || 'normal-chair',
            x,
            y,
            scale: 1,
            rotation: (angle * 180) / Math.PI + 90,
            zIndex: 1,
            width: chairSize,
            height: chairSize,
            backgroundColor: 'transparent',
          } as any;
          addAssetObject(chair);
          createdAssetIds.push(chair.id);
          createdAssetsInBatch.push(chair); // Track for empty space detection
        }
      });
    }

    // Auto-center viewport on newly created assets
    if (createdAssetIds.length > 0) {
      setTimeout(() => {
        const assets = useSceneStore.getState().assets;
        const createdAssets = assets.filter(a => createdAssetIds.includes(a.id));
        if (createdAssets.length === 0) return;

        // Calculate bounding box of all created assets
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        createdAssets.forEach(asset => {
          if (asset.type === 'wall-segments' && asset.wallNodes) {
            asset.wallNodes.forEach(node => {
              minX = Math.min(minX, node.x);
              minY = Math.min(minY, node.y);
              maxX = Math.max(maxX, node.x);
              maxY = Math.max(maxY, node.y);
            });
          } else {
            const w = (asset.width || 0) * (asset.scale || 1);
            const h = (asset.height || 0) * (asset.scale || 1);
            minX = Math.min(minX, asset.x - w / 2);
            minY = Math.min(minY, asset.y - h / 2);
            maxX = Math.max(maxX, asset.x + w / 2);
            maxY = Math.max(maxY, asset.y + h / 2);
          }
        });

        if (isFinite(minX) && isFinite(minY) && isFinite(maxX) && isFinite(maxY)) {
          // Select the first created asset to trigger auto-center in Canvas.tsx
          // The Canvas component will automatically center on the selected asset
          useSceneStore.getState().selectMultipleAssets([createdAssetIds[0]]);
        }
      }, 150); // Slightly longer delay to ensure assets are fully added
    }
  };

  // Handle interactive commands (resize, move, etc.)
  const handleInteractiveCommand = async (prompt: string) => {
    const resolved = getResolvedSelection();
    const selectedAssets = resolved.map((r) => r.asset);

    if (selectedAssets.length === 0) {
      setMessages((m) => [...m, {
        role: 'assistant',
        content: 'Please select an asset first. Click on a shape, table, or other item to select it.'
      }]);
      return;
    }

    // Check if selected asset is a group
    const groupAsset = selectedAssets.find(a => a.isGroup && a.groupAssets);
    let groupContext = undefined;

    if (groupAsset && groupAsset.groupAssets) {
      // Calculate group bounds from child assets
      const childAssets = groupAsset.groupAssets;
      const minX = Math.min(...childAssets.map(a => {
        const w = (a.width || 0) * (a.scale || 1);
        return (a.x || 0) - w / 2;
      }));
      const maxX = Math.max(...childAssets.map(a => {
        const w = (a.width || 0) * (a.scale || 1);
        return (a.x || 0) + w / 2;
      }));
      const minY = Math.min(...childAssets.map(a => {
        const h = (a.height || 0) * (a.scale || 1);
        return (a.y || 0) - h / 2;
      }));
      const maxY = Math.max(...childAssets.map(a => {
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
        childAssets: childAssets.map(a => ({
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
        children: childAssets.map(a => ({
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
          selectedAssets: selectedAssets.map(a => ({
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
            groupAssets: a.groupAssets?.map(ga => ({
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
              updateAsset(asset.id, {
                width: nextWidth,
                height: nextHeight,
                scale: nextScale,
              });
            } else if (data.action.type === 'move') {
              const dx = data.action.dx ?? 0;
              const dy = data.action.dy ?? 0;
              updateAsset(asset.id, {
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
              updateAsset(asset.id, {
                rotation:
                  data.action.rotation !== undefined
                    ? data.action.rotation
                    : (asset.rotation || 0) + delta,
              });
            } else if (data.action.type === 'update') {
              updateAsset(asset.id, data.action.updates || {});
            } else if (data.action.type === 'moveWithinGroup') {
              // Handle moving a child asset within a group
              const groupAsset = existingAssets.find(a => a.id === asset.id && a.isGroup);
              if (!groupAsset || !groupAsset.groupAssets) {
                console.error('Group not found or has no child assets');
                return;
              }

              // Try to find child asset by ID first, then by type/description/color
              const groupAssets = groupAsset.groupAssets || [];
              let targetChildId = data.action.targetAssetId;
              let childAsset = groupAssets.find(ca => ca.id === targetChildId);
              
              console.log('🔍 Looking for child asset:', {
                targetAssetId: targetChildId,
                found: !!childAsset,
                availableChildren: groupAssets.map(ca => ({ 
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
                      return groupAssets.find(ca => 
                        (ca.type === 'ellipse' || ca.type === 'circle') && 
                        (ca.fillColor === '#3b82f6' || ca.fillColor === '#0000ff' || ca.fillColor === '#60a5fa')
                      );
                    }
                    return undefined;
                  },
                  // Match by "circle" keyword
                  () => {
                    if (promptLower.includes('circle')) {
                      return groupAssets.find(ca => 
                        ca.type === 'ellipse' || ca.type === 'circle'
                      );
                    }
                    return undefined;
                  },
                  // Match by "blue" color alone
                  () => {
                    if (promptLower.includes('blue')) {
                      return groupAssets.find(ca => 
                        ca.fillColor === '#3b82f6' || ca.fillColor === '#0000ff' || ca.fillColor === '#60a5fa'
                      );
                    }
                    return undefined;
                  },
                  // Match by "rectangle"
                  () => {
                    if (promptLower.includes('rectangle')) {
                      return groupAssets.find(ca => 
                        ca.type === 'rectangle'
                      );
                    }
                    return undefined;
                  },
                  // Match by "wall"
                  () => {
                    if (promptLower.includes('wall')) {
                      return groupAssets.find(ca => 
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
                  availableChildren: groupAssets.map(ca => ({ 
                    id: ca.id, 
                    type: ca.type, 
                    fillColor: ca.fillColor 
                  }))
                });
                setMessages((m) => [...m, { 
                  role: 'assistant', 
                  content: `Could not find the item you mentioned. Available items in the group: ${groupAssets.map(ca => ca.type || 'unknown').join(', ')}` 
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
              const updatedGroupAssets = groupAssets.map(ca =>
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
                allChildren: groupAssets.map(ca => ({ id: ca.id, type: ca.type, x: ca.x, y: ca.y }))
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
                updateWorkspaceAsset(asset.id, data.action.updates || {});
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
                updateWorkspaceShape(asset.id, data.action.updates || {});
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

        setMessages((m) => [...m, {
          role: 'assistant',
          content: data.message || 'Action completed successfully.'
        }]);
      } else if (data?.error) {
        // If error indicates this should go to plan generation, throw to trigger fallback
        if (data.error.includes('plan generation') || data.error.includes('not applicable')) {
          throw new Error(data.error);
        }
        setMessages((m) => [...m, { role: 'assistant', content: `Error: ${data.error}` }]);
      } else if (data?.message) {
        setMessages((m) => [...m, { role: 'assistant', content: data.message }]);
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
      setMessages((m) => [...m, { role: 'assistant', content: 'Sorry, I could not process that command.' }]);
      throw e; // Re-throw to trigger fallback
    }
  };

  const handleSubmit = async () => {
    if (!inputValue.trim()) return;
    const prompt = inputValue.trim();
    setMessages((m) => [...m, { role: 'user', content: prompt }]);
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
          // If command handler fails or returns an error, check if it's a "not applicable" error
          console.log('Command handler result:', commandError);
          // Continue to plan generation as fallback
        }
      }

      // Fallback to plan generation for general queries or when no assets selected
      const res = await fetch("/api/ai/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [...messages, { role: 'user', content: prompt }],
          canvas,
          selectedAssets: selectedAssets.length > 0 ? selectedAssets.map(a => ({
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
      if (data?.message) {
        // General question/answer
        setMessages((m) => [...m, { role: 'assistant', content: data.message }]);
      } else if (data?.followUp) {
        setMessages((m) => [...m, { role: 'assistant', content: data.followUp }]);
      } else if (data?.plan) {
        applyPlan(data.plan);
        setMessages((m) => [...m, { role: 'assistant', content: 'Plan generated and applied to canvas.' }]);
      } else {
        // Fallback for errors or unexpected responses
        setMessages((m) => [...m, { role: 'assistant', content: data?.error || 'I can help you with that. Could you provide more details?' }]);
      }
    } catch (e) {
      console.error(e);
      setMessages((m) => [...m, { role: 'assistant', content: 'Sorry, I could not process that request.' }]);
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
              className="w-[80vw] h-[90vh] bg-white shadow-xl rounded-lg p-6 flex flex-col items-center text-center relative"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex-1 flex flex-col items-stretch justify-start w-full max-w-3xl min-h-0 overflow-hidden">
                <div className="flex flex-col gap-3 mb-4 flex-shrink-0 items-stretch">
                  <h2 className="text-2xl font-bold">
                    Hello, {user?.firstName || user?.email || "there"}.
                  </h2>
                  {/* Selected assets preview for AI context */}
                  {(() => {
                    const selectedAssets = getCurrentSelectedAssets();
                    if (!selectedAssets.length) return null;
                    const primary = selectedAssets[0];
                    // Get full asset data from store to ensure groupAssets is populated
                    // Use existingAssets which is already reactive from the hook
                    const fullAsset = existingAssets.find(a => a.id === primary.id);
                    const isGroup = fullAsset?.isGroup && fullAsset?.groupAssets && fullAsset.groupAssets.length > 0;
                    const groupAssets = fullAsset?.groupAssets || primary.groupAssets;
                    
                    // Debug logging
                    console.log('AI Display Check:', {
                      primaryId: primary.id,
                      primaryIsGroup: primary.isGroup,
                      primaryHasGroupAssets: !!primary.groupAssets,
                      primaryGroupAssetsLength: primary.groupAssets?.length,
                      fullAssetFound: !!fullAsset,
                      fullAssetIsGroup: fullAsset?.isGroup,
                      fullAssetGroupAssetsLength: fullAsset?.groupAssets?.length,
                      isGroup: isGroup,
                      groupAssetsLength: groupAssets?.length
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
                              if (fullAsset?.isGroup && fullAsset?.groupAssets && fullAsset.groupAssets.length > 0) {
                                return (
                                  <div className="mt-1">
                                    <div className="font-medium">Group ({fullAsset.groupAssets.length} items)</div>
                                    <div className="text-xs text-gray-600 mt-1.5 space-y-1 max-h-32 overflow-y-auto">
                                      {fullAsset.groupAssets.map((child: any, idx: number) => (
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
                                  const nodes = (primary as any).wallNodes as { x: number; y: number }[] | undefined;
                                  const thickness = (primary as any).wallThickness || 150;

                                  if (nodes && nodes.length > 0) {
                                    const xs = nodes.map(n => n.x);
                                    const ys = nodes.map(n => n.y);
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
                      <p className="text-gray-700 text-lg font-semibold mb-2">Ask anything</p>
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
                      <div key={i} className={`${m.role === 'user' ? 'text-right' : 'text-left'}`}>
                        <span className={`inline-block px-3 py-2 rounded-lg text-sm ${m.role === 'user' ? 'bg-[var(--accent)] text-white' : 'bg-white border'}`}>{m.content}</span>
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
                    onClick={handleSubmit}
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

