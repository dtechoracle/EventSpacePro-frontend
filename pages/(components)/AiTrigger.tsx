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
import { ASSET_LIBRARY, compareAssetsForDisplay } from "@/lib/assets";
import { texturePatterns } from "@/utils/texturePatterns";
import { DEFAULT_ASSET_STROKE_WIDTH } from "@/utils/assetRenderMode";
import { isKnownMissingSvg, validateSvgPath } from "@/components/tools/InlineSvg";

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  assetSelection?: {
    category: string;
    message: string;
    options: { id: string; name: string; category: string; path: string; width?: number; height?: number }[];
  };
  choices?: string[];
  previewData?: any[]; // Array of combined assets for PlanPreview
  previewPlanData?: any;
  planData?: any;
  rawPlan?: any;
}

const AI_DEFAULT_STROKE_WIDTH = DEFAULT_ASSET_STROKE_WIDTH;

const buildAssetSelectionOptions = (filter: (asset: typeof ASSET_LIBRARY[number]) => boolean) =>
  ASSET_LIBRARY
    .filter(filter)
    .sort(compareAssetsForDisplay)
    .map((asset) => ({
      id: asset.id,
      name: asset.label,
      category: asset.category,
      path: asset.path,
      width: asset.width,
      height: asset.height,
    }));

const MarqueeOptionPreview = ({ width, height }: { width?: number; height?: number }) => {
  const w = Math.max(1000, width || 1200);
  const h = Math.max(1000, height || 900);
  const strokeOuter = Math.max(w, h) * 0.018;
  const strokeInner = Math.max(w, h) * 0.01;
  const inset = Math.max(w, h) * 0.08;
  const post = Math.max(w, h) * 0.05;
  const dashLen = Math.max(w, h) * 0.035;
  const dashGap = dashLen * 0.8;

  const horizontalSegments = Math.max(2, Math.floor((w - inset * 2) / (dashLen + dashGap)));
  const verticalSegments = Math.max(2, Math.floor((h - inset * 2) / (dashLen + dashGap)));

  return (
    <div className="w-full h-full bg-slate-50 flex items-center justify-center p-2">
      <svg
        viewBox={`0 0 ${w} ${h}`}
        className="w-full h-full"
        preserveAspectRatio="xMidYMid meet"
        aria-hidden="true"
      >
        <rect x="0" y="0" width={w} height={h} rx={Math.max(w, h) * 0.03} fill="#f8fafc" />
        <rect
          x={inset}
          y={inset}
          width={w - inset * 2}
          height={h - inset * 2}
          fill="none"
          stroke="#1f2937"
          strokeWidth={strokeOuter}
        />
        <rect
          x={inset + strokeOuter * 1.4}
          y={inset + strokeOuter * 1.4}
          width={w - (inset + strokeOuter * 1.4) * 2}
          height={h - (inset + strokeOuter * 1.4) * 2}
          fill="none"
          stroke="#475569"
          strokeWidth={strokeInner}
        />

        {[0, 1, 2, 3].map((i) => {
          const x = i % 2 === 0 ? inset - post / 2 : w - inset - post / 2;
          const y = i < 2 ? inset - post / 2 : h - inset - post / 2;
          return (
            <rect
              key={`post-${i}`}
              x={x}
              y={y}
              width={post}
              height={post}
              rx={post * 0.12}
              fill="#e2e8f0"
              stroke="#475569"
              strokeWidth={strokeInner}
            />
          );
        })}

        {Array.from({ length: horizontalSegments }).map((_, i) => {
          const startX = inset + ((w - inset * 2) / horizontalSegments) * i + dashGap / 2;
          const endX = Math.min(startX + dashLen, w - inset);
          return (
            <g key={`h-${i}`}>
              <line
                x1={startX}
                y1={inset}
                x2={endX}
                y2={inset}
                stroke="#475569"
                strokeWidth={strokeInner}
              />
              <line
                x1={startX}
                y1={h - inset}
                x2={endX}
                y2={h - inset}
                stroke="#475569"
                strokeWidth={strokeInner}
              />
            </g>
          );
        })}

        {Array.from({ length: verticalSegments }).map((_, i) => {
          const startY = inset + ((h - inset * 2) / verticalSegments) * i + dashGap / 2;
          const endY = Math.min(startY + dashLen, h - inset);
          return (
            <g key={`v-${i}`}>
              <line
                x1={inset}
                y1={startY}
                x2={inset}
                y2={endY}
                stroke="#475569"
                strokeWidth={strokeInner}
              />
              <line
                x1={w - inset}
                y1={startY}
                x2={w - inset}
                y2={endY}
                stroke="#475569"
                strokeWidth={strokeInner}
              />
            </g>
          );
        })}
      </svg>
    </div>
  );
};

export default function AiTrigger() {
  const [isOpen, setIsOpen] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const inputRef = useRef<HTMLInputElement | null>(null);
  const user = useUserStore((s: any) => s.user);
  const [messages, setMessages] = useState<ChatMessage[]>([
    { 
      role: 'assistant', 
      content: "Hello! I'm your EventSpacePro AI assistant. I'm here to help you design the perfect event layout. What would you like to do first?",
      choices: ["I want to create a new layout", "Help me arrange my furniture", "Show me the basics"]
    }
  ]);
  const [missingOptionPaths, setMissingOptionPaths] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(false);
  const messagesRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const optionPaths = Array.from(
      new Set(
        messages.flatMap((msg: any) =>
          Array.isArray(msg?.assetSelection?.options)
            ? msg.assetSelection.options.map((option: any) => option?.path).filter(Boolean)
            : []
        )
      )
    ) as string[];
    if (optionPaths.length === 0) return;
    let active = true;
    (async () => {
      const unresolved = optionPaths.filter(path => !missingOptionPaths.has(path) && !isKnownMissingSvg(path));
      if (unresolved.length === 0) return;
      const checks = await Promise.all(
        unresolved.map(async (path) => ({
          path,
          ok: await validateSvgPath(path),
        }))
      );
      if (!active) return;
      const failed = checks.filter(check => !check.ok).map(check => check.path);
      if (failed.length > 0) {
        setMissingOptionPaths(prev => {
          const next = new Set(prev);
          failed.forEach(path => next.add(path));
          return next;
        });
      }
    })();
    return () => {
      active = false;
    };
  }, [messages, missingOptionPaths]);

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
  const buildFallbackAssetSelectionFromFollowUp = (followUpText: string) => {
    const lower = (followUpText || '').toLowerCase();
    const asksForSummary =
      lower.includes('in plain language, tell me what you want for this event layout') ||
      lower.includes('describe what you want for this event layout') ||
      lower.includes('describe the event layout you want');
    if (asksForSummary) return undefined;
    const asksForGuestCount =
      lower.includes('how many guests') ||
      lower.includes('number of guests') ||
      lower.includes('guest count') ||
      lower.includes('how many people') ||
      lower.includes('how many attendees') ||
      lower.includes('capacity');
    if (asksForGuestCount) return undefined;
    const asksForArrangement =
      lower.includes('arranged') ||
      lower.includes('arrangement') ||
      lower.includes('u-shape') ||
      lower.includes('grid') ||
      lower.includes('circular') ||
      lower.includes('linear') ||
      lower.includes('perimeter') ||
      lower.includes('boardroom') ||
      lower.includes('classroom') ||
      lower.includes('chevron');
    const asksForChairsPerTable =
      lower.includes('how many chairs should i place around each table') ||
      lower.includes('how many seats should i place around each table') ||
      lower.includes('chairs per table');
    const asksForStageYesNo = lower.includes('would you like to add a stage');
    const asksForStagePlacement =
      lower.includes('where should i place the stage') ||
      lower.includes('where would you like the stage');
    const asksForExtras = lower.includes('would you like to include any additional features');
    if (asksForArrangement || asksForChairsPerTable || asksForStageYesNo || asksForStagePlacement || asksForExtras) {
      return undefined;
    }

    const userHistory = messages
      .filter((m) => m.role === 'user')
      .map((m) => m.content.toLowerCase())
      .join('\n');

    const marqueeContext =
      userHistory.includes('marquee') ||
      userHistory.includes('tent') ||
      lower.includes('marquee') ||
      lower.includes('tent');

    if (lower.includes('which marquee') || lower.includes('which tent')) {
      return {
        category: 'marquee',
        message: 'Select a marquee',
        options: buildAssetSelectionOptions((asset) => asset.category === 'Marquee'),
      };
    }

    const asksForTables =
      lower.includes('table') ||
      lower.includes('round tables') ||
      lower.includes('rectangular tables');
    const asksForChairs = lower.includes('chair') || lower.includes('chairs') || lower.includes('seating');
    const explicitlyAsksForChairChoice =
      lower.includes('what chair would you like') ||
      lower.includes('which chair would you like') ||
      lower.includes('what chair should i pair') ||
      lower.includes('which chair should i pair') ||
      lower.includes('what chair should i use') ||
      lower.includes('which chair should i use') ||
      lower.includes('would you like to add any specific chairs around') ||
      lower.includes('please select the chair type') ||
      lower.includes('what stool would you like') ||
      lower.includes('which stool would you like') ||
      lower.includes('select seating for the smaller area') ||
      lower.includes('select seating for the guest area');

    if (marqueeContext && (lower.includes('what would you like to add') || asksForTables || asksForChairs)) {
      return {
        category: 'furniture',
        message: 'Select furniture to add',
        options: buildAssetSelectionOptions((asset) => asset.category === 'Furniture'),
      };
    }

    if (explicitlyAsksForChairChoice) {
      return {
        category: 'chair',
        message: 'Select seating',
        options: buildAssetSelectionOptions((asset) => {
          if (asset.category !== 'Furniture') return false;
          const label = asset.label.toLowerCase();
          return (
            label.includes('chair') ||
            label.includes('stool')
          ) && !label.includes('sofa') && !label.includes('table');
        }),
      };
    }

    if (asksForTables && asksForChairs) {
      return {
        category: 'furniture',
        message: 'Select furniture',
        options: buildAssetSelectionOptions((asset) => {
          if (asset.category !== 'Furniture') return false;
          const label = asset.label.toLowerCase();
          return !label.includes('sofa');
        }),
      };
    }

    if (asksForTables) {
      const wantsRound = lower.includes('round');
      const wantsRectangular = lower.includes('rectangular') || lower.includes('rectangle');
      return {
        category: 'table',
        message: 'Select a table',
        options: buildAssetSelectionOptions((asset) => {
          if (asset.category !== 'Furniture') return false;
          const label = asset.label.toLowerCase();
          if (!label.includes('table')) return false;
          if (wantsRound && !label.includes('round')) return false;
          if (wantsRectangular && !label.includes('rectangular')) return false;
          return true;
        }),
      };
    }

    if (asksForChairs) {
      return {
        category: 'chair',
        message: 'Select seating',
        options: buildAssetSelectionOptions((asset) => {
          if (asset.category !== 'Furniture') return false;
          const label = asset.label.toLowerCase();
          return (
            label.includes('chair') ||
            label.includes('stool')
          ) && !label.includes('sofa') && !label.includes('table');
        }),
      };
    }

    return undefined;
  };

  const buildFallbackMarqueePreview = (source: string) => {
    const joinedHistory = messages
      .filter((m: any) => m.role === 'user')
      .map((m: any) => m.content || '')
      .join('\n');
    const text = `${joinedHistory}\n${source || ''}`.toLowerCase();
    const selectedMarquee = ASSET_LIBRARY
      .filter((asset) => asset.category === 'Marquee')
      .sort((a, b) => b.label.length - a.label.length)
      .find((asset) => text.includes(asset.label.toLowerCase()) || text.includes(asset.id.toLowerCase()));

    if (!selectedMarquee) return undefined;

    const previewWidth = Math.max((selectedMarquee.width || 1000) + 1200, 2400);
    const previewHeight = Math.max((selectedMarquee.height || 1000) + 1200, 1800);
    const previewAsset = {
      id: `preview-${selectedMarquee.id}`,
      type: selectedMarquee.id,
      x: previewWidth / 2,
      y: previewHeight / 2,
      width: selectedMarquee.width || 1000,
      height: selectedMarquee.height || 1000,
      strokeWidth: AI_DEFAULT_STROKE_WIDTH,
      strokeColor: '#1a1a1a',
      fillColor: 'transparent',
      scale: 1,
      zIndex: 5,
    };

    return {
      walls: [],
      assets: [previewAsset],
      shapes: [],
      textAnnotations: [],
      width: previewWidth,
      height: previewHeight,
      combined: [previewAsset],
    };
  };

  const isWallsOnlyPreviewPlan = (preview: any) =>
    Boolean(
      preview &&
        Array.isArray(preview.walls) &&
        preview.walls.length > 0 &&
        (!Array.isArray(preview.assets) || preview.assets.length === 0) &&
        (!Array.isArray(preview.shapes) || preview.shapes.length === 0) &&
        (!Array.isArray(preview.textAnnotations) || preview.textAnnotations.length === 0)
    );

  const getLatestPreviewPlanData = () => {
    for (let i = messages.length - 1; i >= 0; i -= 1) {
      const msg: any = messages[i];
      if (msg?.previewPlanData) return msg.previewPlanData;
      if (msg?.planData) return msg.planData;
    }
    return undefined;
  };

  const rebuildCombinedPreviewItems = (preview: any) => [
    ...(Array.isArray(preview?.walls) ? preview.walls : []),
    ...(Array.isArray(preview?.assets) ? preview.assets : []),
    ...(Array.isArray(preview?.shapes) ? preview.shapes : []),
    ...(Array.isArray(preview?.textAnnotations) ? preview.textAnnotations : []),
  ];

  const mergePreviewPlans = (basePreview: any, incomingPreview: any) => {
    if (!basePreview) return incomingPreview;
    if (!incomingPreview) {
      const mergedOnlyBase = { ...basePreview };
      mergedOnlyBase.combined = rebuildCombinedPreviewItems(mergedOnlyBase);
      return mergedOnlyBase;
    }

    const merged = {
      ...basePreview,
      ...incomingPreview,
      walls:
        Array.isArray(incomingPreview.walls) && incomingPreview.walls.length > 0
          ? incomingPreview.walls
          : basePreview.walls || [],
      assets:
        Array.isArray(incomingPreview.assets) && incomingPreview.assets.length > 0
          ? incomingPreview.assets
          : basePreview.assets || [],
      shapes:
        Array.isArray(incomingPreview.shapes) && incomingPreview.shapes.length > 0
          ? incomingPreview.shapes
          : basePreview.shapes || [],
      textAnnotations:
        Array.isArray(incomingPreview.textAnnotations) && incomingPreview.textAnnotations.length > 0
          ? incomingPreview.textAnnotations
          : basePreview.textAnnotations || [],
      width: Math.max(
        Number(incomingPreview.width || 0) || 0,
        Number(basePreview.width || 0) || 0
      ),
      height: Math.max(
        Number(incomingPreview.height || 0) || 0,
        Number(basePreview.height || 0) || 0
      ),
    } as any;

    merged.combined = rebuildCombinedPreviewItems(merged);
    return merged;
  };

  const processPlan = (plan: any, canvasRef: any) => {
    const generatedWalls: any[] = [];
    const generatedAssets: any[] = [];
    const generatedShapes: any[] = [];
    const generatedTextAnnotations: any[] = [];
    const planAssetList: any[] = Array.isArray(plan.assets) ? plan.assets : [];

    const canvasCenter = canvasRef?.width
      ? { x: canvasRef.width / 2, y: canvasRef.height / 2 }
      : { x: 5000, y: 5000 };

    // Helper: resolve loose name → { id, width, height } using ASSET_LIBRARY as source of truth
    const resolveAsset = (raw: string): { id: string; width: number; height: number } => {
      const r = (raw || '').toLowerCase();
      const canonicalRaw = String(raw || '').toLowerCase().replace(/[^a-z0-9]/g, '');

      // Try direct library match first (exact id)
      const direct = ASSET_LIBRARY.find(a => a.id === raw);
      if (direct) return { id: direct.id, width: direct.width || 823, height: direct.height || 1018 };

      const directByName = ASSET_LIBRARY.find((a) =>
        a.label?.toLowerCase() === r ||
        a.name?.toLowerCase() === r
      );
      if (directByName) {
        return { id: directByName.id, width: directByName.width || 823, height: directByName.height || 1018 };
      }

      const fuzzyLibraryMatch = ASSET_LIBRARY.find((a) => {
        const canonicalId = a.id.toLowerCase().replace(/[^a-z0-9]/g, '');
        const canonicalLabel = String(a.label || '').toLowerCase().replace(/[^a-z0-9]/g, '');
        const canonicalName = String(a.name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
        return (
          canonicalRaw === canonicalId ||
          canonicalRaw === canonicalLabel ||
          canonicalRaw === canonicalName ||
          canonicalRaw.includes(canonicalId) ||
          canonicalRaw.includes(canonicalLabel) ||
          canonicalRaw.includes(canonicalName)
        );
      });
      if (fuzzyLibraryMatch) {
        return {
          id: fuzzyLibraryMatch.id,
          width: fuzzyLibraryMatch.width || 823,
          height: fuzzyLibraryMatch.height || 1018
        };
      }

      // Fuzzy match by checking includes
      let id = raw;
      if (r.includes('stage')) id = '1m-x-1m-modular-stage';
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
      else if (r && texturePatterns.some(p => r.includes(p.id) || p.id.includes(r))) {
          // If it matches a texture ID (or substring), use it as the id directly
          // This ensures it uses the fallback rect renderer in AssetRenderer
          const pattern = texturePatterns.find(p => r.includes(p.id) || p.id.includes(r));
          id = pattern?.id || r;
      }

      const def = ASSET_LIBRARY.find(a => a.id === id);
      return { id, width: def?.width || 800, height: def?.height || 800 };
    };

    // Thin wrapper for just the id (backwards compat)
    const resolveType = (raw: string) => resolveAsset(raw).id;

    // Helper to resolve texture IDs from fill color/string
    const isTextureId = (id: string): boolean => {
      return texturePatterns.some(p => p.id === id);
    };

    // Helper to resolve the correct fill properties
    const getResolvedFill = (item: any) => {
      let fillType = item.fillType || 'solid';
      let fillTexture = item.fillTexture;
      let fillColor = item.fillColor || item.fill || 'transparent';

      // Detect if fillColor is actually a texture ID
      if (isTextureId(fillColor)) {
        fillType = 'texture';
        fillTexture = fillColor;
        const scale = item.fillTextureScale || 4;
        const thickness = item.fillTextureThickness || 1;
        fillColor = `url(#${fillTexture}-scale-${scale}-thick-${thickness})`;
      } else if (fillType === 'texture' && fillTexture) {
        const scale = item.fillTextureScale || 4;
        const thickness = item.fillTextureThickness || 1;
        fillColor = `url(#${fillTexture}-scale-${scale}-thick-${thickness})`;
      }

      return { fillType, fillTexture, fillColor, fill: fillColor };
    };

    // ─── 1. Parse Room ────────────────────────────────────────────────────────
    const WALL_THICKNESS = 150;
    const WALL_MARGIN = 700; // min clearance from inner wall face to any asset
    const primaryMarqueePlanAsset = planAssetList.find((asset: any) =>
      (asset?.assetType || asset?.assetName || '').toLowerCase().includes('marquee')
    );
    const primaryMarqueeLibraryDef = primaryMarqueePlanAsset
      ? ASSET_LIBRARY.find((def) => {
          const raw = String(primaryMarqueePlanAsset.assetType || primaryMarqueePlanAsset.assetName || '').toLowerCase();
          return (
            def.id.toLowerCase() === raw ||
            def.label.toLowerCase() === raw ||
            raw.includes(def.id.toLowerCase()) ||
            raw.includes(def.label.toLowerCase())
          );
        })
      : null;
    const standaloneMarqueePlan = Boolean(primaryMarqueePlanAsset);

    let roomW = 10000, roomH = 10000;
    if (Array.isArray(plan.walls) && plan.walls[0]) {
      let w = Number(plan.walls[0].widthMm || 10000);
      let h = Number(plan.walls[0].heightMm || 10000);
      if (w < 200) w *= 1000; // meters → mm
      if (h < 200) h *= 1000;
      roomW = w; roomH = h;
    }

    if (!(Array.isArray(plan.walls) && plan.walls[0]) && primaryMarqueePlanAsset) {
      let marqueeW = Number(primaryMarqueePlanAsset.widthMm || primaryMarqueeLibraryDef?.width || roomW);
      let marqueeH = Number(primaryMarqueePlanAsset.heightMm || primaryMarqueeLibraryDef?.height || roomH);
      if (marqueeW < 200) marqueeW *= 1000;
      if (marqueeH < 200) marqueeH *= 1000;
      roomW = marqueeW;
      roomH = marqueeH;
    }

    const roomCX = canvasCenter.x;
    const roomCY = canvasCenter.y;
    const wallMinX = roomCX - roomW / 2;
    const wallMinY = roomCY - roomH / 2;
    const wallMaxX = roomCX + roomW / 2;
    const wallMaxY = roomCY + roomH / 2;
    const createRoomEnclosureWall = (wallId: string, thickness = WALL_THICKNESS) => {
      const nIds = [`${wallId}-n0`, `${wallId}-n1`, `${wallId}-n2`, `${wallId}-n3`];
      return {
        id: wallId,
        nodes: [
          { id: nIds[0], x: wallMinX, y: wallMinY },
          { id: nIds[1], x: wallMaxX, y: wallMinY },
          { id: nIds[2], x: wallMaxX, y: wallMaxY },
          { id: nIds[3], x: wallMinX, y: wallMaxY },
        ],
        edges: [
          { id: `${wallId}-e0`, nodeA: nIds[0], nodeB: nIds[1], thickness },
          { id: `${wallId}-e1`, nodeA: nIds[1], nodeB: nIds[2], thickness },
          { id: `${wallId}-e2`, nodeA: nIds[2], nodeB: nIds[3], thickness },
          { id: `${wallId}-e3`, nodeA: nIds[3], nodeB: nIds[0], thickness },
        ],
        zIndex: 0,
        isClosed: true,
      };
    };

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
          // Check if we already have a marquee in the plan assets - if so, skip the room walls
          const assets = Array.isArray(plan.assets) ? plan.assets : [];
          const hasMarquee = assets.some((a: any) => 
            (a.assetType || a.assetName || '').toLowerCase().includes('marquee')
          );
          
          if (!hasMarquee) {
            generatedWalls.push(createRoomEnclosureWall('wall-room'));
          }
        }
      });
    }

    // ─── 2. Define Usable Rect (shrinks as we place fixed elements) ───────────
    let usableMinX = wallMinX + WALL_MARGIN;
    let usableMaxX = wallMaxX - WALL_MARGIN;
    let usableMinY = wallMinY + WALL_MARGIN;
    let usableMaxY = wallMaxY - WALL_MARGIN;
    const layoutZone = (plan.tableArrangement as any)?.zone || ((Array.isArray(plan.seatingLayout) && plan.seatingLayout[0]) ? (plan.seatingLayout[0] as any).zone : null);
    if (layoutZone) {
      const zoneMinX = wallMinX + Number(layoutZone.xMm || 0);
      const zoneMinY = wallMinY + Number(layoutZone.yMm || 0);
      const zoneMaxX = zoneMinX + Number(layoutZone.widthMm || roomW);
      const zoneMaxY = zoneMinY + Number(layoutZone.heightMm || roomH);
      usableMinX = Math.max(usableMinX, zoneMinX + WALL_MARGIN * 0.5);
      usableMaxX = Math.min(usableMaxX, zoneMaxX - WALL_MARGIN * 0.5);
      usableMinY = Math.max(usableMinY, zoneMinY + WALL_MARGIN * 0.5);
      usableMaxY = Math.min(usableMaxY, zoneMaxY - WALL_MARGIN * 0.5);
    }

    // ─── 3. Place Fixed Elements (Stage, etc.) First ─────────────────────────
    const STAGE_GAP = 1500; // clearance between stage and nearest table

    const assetList: any[] = planAssetList;
    const shapeList: any[] = Array.isArray(plan.shapes) ? plan.shapes : [];
    const chairsAroundList: any[] = Array.isArray(plan.chairsAround) ? plan.chairsAround : [];
    const normalizeAiAssetStrokeWidth = (value: any) => {
      const numeric = Number(value);
      if (!Number.isFinite(numeric) || numeric <= 0) return AI_DEFAULT_STROKE_WIDTH;
      if (numeric >= 4.5 && numeric <= 5.5) return AI_DEFAULT_STROKE_WIDTH;
      return numeric;
    };

    // Stages are shapes (rectangles with module grid lines), not assets
    const stageShapeItems = shapeList.filter((s: any) =>
      String(s.id || '').toLowerCase().includes('ai-stage-base') ||
      String(s.role || '').toLowerCase() === 'stage'
    );
    const nonStageItems = assetList.filter((a: any) =>
      !(a.assetType || a.assetName || '').toLowerCase().includes('stage')
    );
    const nonStageShapes = shapeList.filter((s: any) => !stageShapeItems.includes(s));

    stageShapeItems.forEach((s: any, idx: number) => {
      const sw = Number(s.widthMm ?? s.width ?? 3000);
      const sh = Number(s.heightMm ?? s.height ?? 2000);
      const sx = typeof s.xMm === 'number' ? wallMinX + s.xMm : typeof s.x === 'number' ? wallMinX + s.x : roomCX;
      const sy = typeof s.yMm === 'number' ? wallMinY + s.yMm : typeof s.y === 'number' ? wallMinY + s.y : roomCY;

      generatedShapes.push({
        ...s,
        ...getResolvedFill(s),
        id: s.id || `stage-shape-${idx}`,
        type: s.type || 'rectangle',
        x: sx,
        y: sy,
        width: sw,
        height: sh,
        stroke: s.stroke || s.strokeColor || '#475569',
        strokeColor: s.stroke || s.strokeColor || '#475569',
        strokeWidth: Number(s.strokeWidth ?? 2),
        rotation: Number(s.rotation ?? 0),
        zIndex: 2,
      });

      const left = sx - sw / 2 - STAGE_GAP;
      const right = sx + sw / 2 + STAGE_GAP;
      const top = sy - sh / 2 - STAGE_GAP;
      const bottom = sy + sh / 2 + STAGE_GAP;
      const distances = [
        { edge: 'top', value: Math.abs(top - usableMinY) },
        { edge: 'bottom', value: Math.abs(usableMaxY - bottom) },
        { edge: 'left', value: Math.abs(left - usableMinX) },
        { edge: 'right', value: Math.abs(usableMaxX - right) },
      ].sort((a, b) => a.value - b.value);
      const nearest = distances[0]?.edge;
      if (nearest === 'top') usableMinY = Math.max(usableMinY, bottom);
      else if (nearest === 'bottom') usableMaxY = Math.min(usableMaxY, top);
      else if (nearest === 'left') usableMinX = Math.max(usableMinX, right);
      else if (nearest === 'right') usableMaxX = Math.min(usableMaxX, left);
    });

    // ─── 4. Collect Table Specs ───────────────────────────────────────────────
    interface TableSpec {
      name?: string;
      chairCount: number;
      chairType?: string;
      chairW?: number;
      chairH?: number;
      tableW: number;
      tableH: number;
      tableType: string;
      isRound: boolean;
      hasBuiltInSeating: boolean;
      rotationDegrees?: number;
      chairFacingSide?: string;
      chairWorldSide?: string;
    }

    const tableSpecs: TableSpec[] = [];
    const CHAIR_SIZE = 450;
    const CHAIR_GAP = 600; // required AI spacing between seating elements
    let fallbackTableNumber = 1;
    const rotateLocalOffset = (dx: number, dy: number, rotationDeg: number) => {
      const rad = (rotationDeg * Math.PI) / 180;
      const cos = Math.cos(rad);
      const sin = Math.sin(rad);
      return {
        x: dx * cos - dy * sin,
        y: dx * sin + dy * cos,
      };
    };
    const buildFrontFacingChairOffsets = (
      facingSide: string,
      chairCount: number,
      width: number,
      height: number,
      frontX: number,
      frontY: number
    ) => {
      if (chairCount <= 0) return [] as Array<{ x: number; y: number; rotation: number }>;
      const count = Math.max(1, chairCount);
      if (facingSide === 'left' || facingSide === 'right') {
        const spread = height * 0.6;
        return Array.from({ length: count }, (_, idx) => {
          const t = count === 1 ? 0 : (idx / (count - 1)) - 0.5;
          return {
            x: frontX,
            y: t * spread,
            rotation: facingSide === 'left' ? 270 : 90,
          };
        });
      }
      const spread = width * 0.6;
      return Array.from({ length: count }, (_, idx) => {
        const t = count === 1 ? 0 : (idx / (count - 1)) - 0.5;
        return {
          x: t * spread,
          y: frontY,
          rotation: facingSide === 'top' ? 180 : 0,
        };
      });
    };
    const buildWorldSideChairOffsets = (
      worldSide: string,
      chairCount: number,
      displayWidth: number,
      displayHeight: number,
      gap: number,
      chairSize: number
    ) => {
      if (chairCount <= 0) return [] as Array<{ x: number; y: number; rotation: number }>;
      const count = Math.max(1, chairCount);
      if (worldSide === 'left' || worldSide === 'right') {
        const spread = displayHeight * 0.6;
        const x = worldSide === 'left'
          ? -displayWidth / 2 - gap - chairSize / 2
          : displayWidth / 2 + gap + chairSize / 2;
        return Array.from({ length: count }, (_, idx) => {
          const t = count === 1 ? 0 : (idx / (count - 1)) - 0.5;
          return {
            x,
            y: t * spread,
            rotation: worldSide === 'left' ? 270 : 90,
          };
        });
      }
      const spread = displayWidth * 0.6;
      const y = worldSide === 'top'
        ? -displayHeight / 2 - gap - chairSize / 2
        : displayHeight / 2 + gap + chairSize / 2;
      return Array.from({ length: count }, (_, idx) => {
        const t = count === 1 ? 0 : (idx / (count - 1)) - 0.5;
        return {
          x: t * spread,
          y,
          rotation: worldSide === 'top' ? 180 : 0,
        };
      });
    };
    const buildFrontArcChairAngles = (facingSide: string, chairCount: number) => {
      const count = Math.max(1, chairCount);
      const spread = count === 1 ? 0 : Math.min(Math.PI * 0.9, Math.PI * (0.22 * count));
      const centerAngle =
        facingSide === 'left' ? Math.PI :
        facingSide === 'right' ? 0 :
        facingSide === 'top' ? -Math.PI / 2 :
        Math.PI / 2;
      return Array.from({ length: count }, (_, idx) => {
        const offset = count === 1 ? 0 : (-spread / 2) + (idx * spread) / (count - 1);
        return centerAngle + offset;
      });
    };

    const assetHasBuiltInSeating = (assetId: string, assetLabel?: string) => {
      const label = `${assetLabel || ''} ${assetId}`.toLowerCase();
      return (
        /\b\d+\s*seater\b/.test(label) ||
        label.includes('executive table') ||
        label.includes('curve sofa') ||
        label.includes('serpentine table') ||
        label.includes('doughtnut table') ||
        label.includes('doughnut table') ||
        label.includes('vip table')
      );
    };

    const getRepeatedTableName = (spec: any, repeatIndex: number) => {
      const explicitStart = Number(spec.startTableNumber);
      if (Number.isFinite(explicitStart) && explicitStart > 0) {
        return String(explicitStart + repeatIndex);
      }

      const explicitTableName = spec.tableName ?? spec.name ?? spec.label;
      const parsedExplicit = Number(explicitTableName);
      if (Number.isFinite(parsedExplicit) && explicitTableName !== undefined && explicitTableName !== null && String(explicitTableName).trim() !== '') {
        return String(parsedExplicit + repeatIndex);
      }

      const next = fallbackTableNumber;
      fallbackTableNumber += 1;
      return String(next);
    };

    // From assets
    nonStageItems.forEach((a: any, idx: number) => {
      const rawType = (a.assetType || a.assetName || '').toLowerCase();

      // SPECIAL CASE: Aisle should be a rectangle (as requested by user)
      if (rawType.includes('aisle')) {
        const sw = Number(a.widthMm || a.width || 1200);
        const sh = Number(a.heightMm || a.height || 6000);
        const fillProps = getResolvedFill(a);

        // Calculate position - default to center if none provided
        let ax = roomCX;
        let ay = roomCY;
        if (typeof a.xMm === 'number') ax = wallMinX + a.xMm;
        else if (typeof a.x === 'number') ax = wallMinX + (a.x < 100 ? a.x * 1000 : a.x); // guess meters or mm

        if (typeof a.yMm === 'number') ay = wallMinY + a.yMm;
        else if (typeof a.y === 'number') ay = wallMinY + (a.y < 100 ? a.y * 1000 : a.y);

        generatedShapes.push({
          ...a,
          ...fillProps,
          id: `ai-aisle-${idx}`,
          type: 'rectangle', // Force to rectangle shape
          x: ax,
          y: ay,
          width: sw,
          height: sh,
          stroke: a.strokeColor || '#b8b8b8',
          strokeWidth: a.strokeWidth || 3,
          rotation: a.rotation || 0,
          zIndex: 1, // Draw below furniture but above floor
        });
        return;
      }

      const resolved = resolveAsset(a.assetType || a.assetName || '6-seater-rectangular-table-6');
      const libDef = ASSET_LIBRARY.find(x => x.id === resolved.id);
      const tw = libDef?.width || 823;
      const th = libDef?.height || 1018;
      const isRound = resolved.id.includes('round');
      const hasBuiltInSeating = assetHasBuiltInSeating(resolved.id, libDef?.label || a.assetName || a.assetType);
      const repeatCount = Math.max(1, Math.min(1000, Number(a.count || 1) || 1));
      const placementHint = String(a.wall || a.position || '').toLowerCase();
      const isDoorWindow = rawType.includes('door') || rawType.includes('window');
      const inferWallAttachedRotation = () => {
        if (!isDoorWindow) return Number(a.rotation || 0);
        if (placementHint.includes('left')) return 270;
        if (placementHint.includes('right')) return 90;
        if (placementHint.includes('bottom')) return 180;
        if (placementHint.includes('top')) return 0;
        return Number(a.rotation || 0);
      };
      const shouldUseArrangement =
        (Boolean(plan.tableArrangement?.type) || repeatCount > 1) &&
        (rawType.includes('table') || hasBuiltInSeating);

      if (typeof a.xMm === 'number' && typeof a.yMm === 'number') {
        if (shouldUseArrangement && repeatCount > 1) {
          for (let repeatIndex = 0; repeatIndex < repeatCount; repeatIndex++) {
            tableSpecs.push({
              name: getRepeatedTableName(a, repeatIndex),
              chairCount: (() => {
                const chairsPerTable = Number(a.chairCount || a.chairs || 4);
                const totalGuests = Number(a.guestCount || 0);
                if (!Number.isFinite(totalGuests) || totalGuests <= 0 || hasBuiltInSeating) return chairsPerTable;
                const guestsPlacedBefore = repeatIndex * chairsPerTable;
                const remainingGuests = Math.max(0, totalGuests - guestsPlacedBefore);
                return Math.max(0, Math.min(chairsPerTable, remainingGuests));
              })(),
              chairType: resolveAsset(a.chairAsset || 'normal-chair').id,
              chairW: resolveAsset(a.chairAsset || 'normal-chair').width,
              chairH: resolveAsset(a.chairAsset || 'normal-chair').height,
              tableW: tw,
              tableH: isRound ? tw : th,
              tableType: resolved.id,
              isRound,
              hasBuiltInSeating,
              rotationDegrees: Number(a.rotation || plan.tableArrangement?.rotationDegrees || 0),
              chairFacingSide: String(a.chairFacingSide || plan.tableArrangement?.chairFacingSide || ''),
            });
          }
          return;
        }

        // AI explicit dimensions take precedence over library defaults
        const w = a.widthMm ?? libDef?.width ?? tw;
        const h = a.heightMm ?? libDef?.height ?? th;

        let rawX = wallMinX + a.xMm;
        let rawY = wallMinY + a.yMm;
        let safeX = rawX;
        let safeY = rawY;

        // Resolve correct fill color/texture
        const fillProps = getResolvedFill(a);

        // Don't clamp doors/windows strictly inside, they belong on the wall edge or slightly intersecting!
        if (isDoorWindow) {
          const depth = Math.min(w, h);
          const halfDepth = depth / 2;
          if (placementHint.includes('left')) {
            safeX = wallMinX + halfDepth;
            safeY = Math.max(wallMinY + 200, Math.min(wallMaxY - 200, safeY));
          } else if (placementHint.includes('right')) {
            safeX = wallMaxX - halfDepth;
            safeY = Math.max(wallMinY + 200, Math.min(wallMaxY - 200, safeY));
          } else if (placementHint.includes('top')) {
            safeY = wallMinY + halfDepth;
            safeX = Math.max(wallMinX + 200, Math.min(wallMaxX - 200, safeX));
          } else if (placementHint.includes('bottom')) {
            safeY = wallMaxY - halfDepth;
            safeX = Math.max(wallMinX + 200, Math.min(wallMaxX - 200, safeX));
          }
        } else {
          const margin = 200; // Keep tables/sofas at least 200mm from the wall inner edge
          safeX = Math.max(wallMinX + w / 2 + margin, Math.min(wallMaxX - w / 2 - margin, safeX));
          safeY = Math.max(wallMinY + h / 2 + margin, Math.min(wallMaxY - h / 2 - margin, safeY));
        }

        const explicitRotation = isDoorWindow ? inferWallAttachedRotation() : Number(a.rotation || 0);
        generatedAssets.push({
          ...a, // Keep extra props
          ...fillProps, // Override with resolved fill
          id: `ai-explicit-asset-${idx}`,
          type: resolved.id,
          x: safeX,
          y: safeY,
          width: w,
          height: h,
          rotation: explicitRotation,
          strokeWidth: normalizeAiAssetStrokeWidth(a.strokeWidth),
          tableName: a.tableName || a.name || a.label, // NEW: Table Numbering
          scale: 1,
          zIndex: rawType.includes('rug') || rawType.includes('carpet') ? 2 : 5
        });

        if (rawType.includes('table') && !hasBuiltInSeating) {
          const explicitChairCount = Math.max(0, Number(a.chairCount || a.chairs || a.guestCount || 0));
          const chairFacingSide = String(a.chairFacingSide || '');
          const chairWorldSide = String((a as any).chairWorldSide || '');
          if (explicitChairCount > 0) {
            const looseChairType = resolveAsset(a.chairAsset || 'normal-chair').id;
            const looseChairW = resolveAsset(a.chairAsset || 'normal-chair').width || CHAIR_SIZE;
            const looseChairH = resolveAsset(a.chairAsset || 'normal-chair').height || CHAIR_SIZE;
            const effChairSize = Math.min(looseChairW, looseChairH) || CHAIR_SIZE;
            if (isRound) {
              const radius = w / 2 + CHAIR_GAP + effChairSize / 2;
              const useFrontArc = chairFacingSide && explicitChairCount <= 4;
              const angles = useFrontArc
                ? buildFrontArcChairAngles(chairFacingSide, explicitChairCount)
                : Array.from({ length: explicitChairCount }, (_, ci) => (ci / explicitChairCount) * Math.PI * 2 - Math.PI / 2);
              for (let ci = 0; ci < explicitChairCount; ci++) {
                const angle = angles[ci] + ((explicitRotation * Math.PI) / 180);
                generatedAssets.push({
                  id: `ai-explicit-roundchair-${idx}-${ci}`,
                  type: looseChairType,
                  x: safeX + Math.cos(angle) * radius,
                  y: safeY + Math.sin(angle) * radius,
                  rotation: (angle * 180 / Math.PI) + 90,
                  width: looseChairW,
                  height: looseChairH,
                  fillColor: 'transparent',
                  strokeWidth: AI_DEFAULT_STROKE_WIDTH,
                  scale: 1,
                  zIndex: 15
                });
              }
            } else {
              const displayWidth = Math.abs(explicitRotation % 180) === 90 ? h : w;
              const displayHeight = Math.abs(explicitRotation % 180) === 90 ? w : h;
              const perimeter = 2 * (w + h);
              const topCount = Math.max(1, Math.round(explicitChairCount * w / perimeter));
              const botCount = Math.max(1, Math.round(explicitChairCount * w / perimeter));
              const leftCount = Math.max(0, Math.round(explicitChairCount * h / perimeter));
              const rightCount = Math.max(0, explicitChairCount - topCount - botCount - leftCount);
              const topChairY = -h / 2 - CHAIR_GAP - effChairSize / 2;
              const botChairY = h / 2 + CHAIR_GAP + effChairSize / 2;
              const leftChairX = -w / 2 - CHAIR_GAP - effChairSize / 2;
              const rightChairX = w / 2 + CHAIR_GAP + effChairSize / 2;

              if (explicitChairCount <= 4 && chairWorldSide) {
                const worldOffsets = buildWorldSideChairOffsets(
                  chairWorldSide,
                  explicitChairCount,
                  displayWidth,
                  displayHeight,
                  CHAIR_GAP,
                  effChairSize
                );
                worldOffsets.forEach((pt, ci) => {
                  generatedAssets.push({
                    id: `ai-explicit-chair-world-${idx}-${ci}`,
                    type: looseChairType,
                    x: safeX + pt.x,
                    y: safeY + pt.y,
                    rotation: pt.rotation,
                    width: looseChairW,
                    height: looseChairH,
                    fillColor: 'transparent',
                    strokeWidth: AI_DEFAULT_STROKE_WIDTH,
                    scale: 1,
                    zIndex: 15
                  });
                });
                return;
              }

              if (explicitChairCount <= 4 && chairFacingSide) {
                const frontOffsets = buildFrontFacingChairOffsets(
                  chairFacingSide,
                  explicitChairCount,
                  w,
                  h,
                  chairFacingSide === 'left' ? leftChairX : chairFacingSide === 'right' ? rightChairX : 0,
                  chairFacingSide === 'top' ? topChairY : chairFacingSide === 'bottom' ? botChairY : 0
                );
                frontOffsets.forEach((pt, ci) => {
                  const offset = rotateLocalOffset(pt.x, pt.y, explicitRotation);
                  generatedAssets.push({
                    id: `ai-explicit-chair-front-${idx}-${ci}`,
                    type: looseChairType,
                    x: safeX + offset.x,
                    y: safeY + offset.y,
                    rotation: pt.rotation + explicitRotation,
                    width: looseChairW,
                    height: looseChairH,
                    fillColor: 'transparent',
                    strokeWidth: AI_DEFAULT_STROKE_WIDTH,
                    scale: 1,
                    zIndex: 15
                  });
                });
                return;
              }

              const addRow = (count: number, localY: number, rot: number) => {
                for (let ci = 0; ci < count; ci++) {
                  const localX = -w / 2 + (w / (count + 1)) * (ci + 1);
                  const offset = rotateLocalOffset(localX, localY, explicitRotation);
                  generatedAssets.push({
                    id: `ai-explicit-chair-r-${idx}-${ci}-${rot}`,
                    type: looseChairType,
                    x: safeX + offset.x,
                    y: safeY + offset.y,
                    rotation: rot + explicitRotation,
                    width: looseChairW,
                    height: looseChairH,
                    fillColor: 'transparent',
                    strokeWidth: AI_DEFAULT_STROKE_WIDTH,
                    scale: 1,
                    zIndex: 15
                  });
                }
              };
              const addCol = (count: number, localX: number, rot: number) => {
                for (let ci = 0; ci < count; ci++) {
                  const localY = -h / 2 + (h / (count + 1)) * (ci + 1);
                  const offset = rotateLocalOffset(localX, localY, explicitRotation);
                  generatedAssets.push({
                    id: `ai-explicit-chair-c-${idx}-${ci}-${rot}`,
                    type: looseChairType,
                    x: safeX + offset.x,
                    y: safeY + offset.y,
                    rotation: rot + explicitRotation,
                    width: looseChairW,
                    height: looseChairH,
                    fillColor: 'transparent',
                    strokeWidth: AI_DEFAULT_STROKE_WIDTH,
                    scale: 1,
                    zIndex: 15
                  });
                }
              };

              addRow(topCount, topChairY, 180);
              addRow(botCount, botChairY, 0);
              if (leftCount > 0) addCol(leftCount, leftChairX, 90);
              if (rightCount > 0) addCol(rightCount, rightChairX, 270);
            }
          }
        }

        return; // Skip adding to grid engine
      }

      // 2. If NO X/Y was provided, fall back to grid generator.
      // But skip standalone chairs without coordinates, since grid only does tables.
      const isChair = rawType.includes('chair') || rawType.includes('stool');
      if (isChair) return;
      if (isDoorWindow) {
        const w = a.widthMm ?? libDef?.width ?? tw;
        const h = a.heightMm ?? libDef?.height ?? th;
        const depth = Math.min(w, h);
        let x = roomCX;
        let y = roomCY;

        if (placementHint.includes('left')) {
          x = wallMinX + depth / 2;
        } else if (placementHint.includes('right')) {
          x = wallMaxX - depth / 2;
        } else if (placementHint.includes('top')) {
          y = wallMinY + depth / 2;
        } else if (placementHint.includes('bottom')) {
          y = wallMaxY - depth / 2;
        } else {
          y = wallMinY + depth / 2;
        }

        generatedAssets.push({
          ...a,
          ...getResolvedFill(a),
          id: `ai-door-window-${idx}`,
          type: resolved.id,
          x,
          y,
          width: w,
          height: h,
          rotation: inferWallAttachedRotation(),
          strokeWidth: normalizeAiAssetStrokeWidth(a.strokeWidth),
          scale: 1,
          zIndex: 5,
        });
        return;
      }

      for (let repeatIndex = 0; repeatIndex < repeatCount; repeatIndex++) {
        tableSpecs.push({
          name: getRepeatedTableName(a, repeatIndex),
          chairCount: (() => {
            const chairsPerTable = Number(a.chairCount || a.chairs || 4);
            const totalGuests = Number(a.guestCount || 0);
            if (!Number.isFinite(totalGuests) || totalGuests <= 0 || hasBuiltInSeating) return chairsPerTable;
            const guestsPlacedBefore = repeatIndex * chairsPerTable;
            const remainingGuests = Math.max(0, totalGuests - guestsPlacedBefore);
            return Math.max(0, Math.min(chairsPerTable, remainingGuests));
          })(),
          chairType: resolveAsset(a.chairAsset || 'normal-chair').id,
          chairW: resolveAsset(a.chairAsset || 'normal-chair').width,
          chairH: resolveAsset(a.chairAsset || 'normal-chair').height,
          tableW: tw,
          tableH: isRound ? tw : th,
          tableType: resolved.id,
          isRound,
          hasBuiltInSeating,
        });
      }
    });

    // From chairsAround
    chairsAroundList.forEach((spec: any, idx: number) => {
      const resolved = resolveAsset(spec.tableAsset || '6-seater-rectangular-table-6');
      const libDef = ASSET_LIBRARY.find(x => x.id === resolved.id);
      const tw = libDef?.width || 823;
      const th = libDef?.height || 1018;
      const isRound = resolved.id.includes('round');
      const hasBuiltInSeating = assetHasBuiltInSeating(resolved.id, libDef?.label || spec.tableAsset);

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

        generatedAssets.push({
          id: `ai-explicit-roundtable-${idx}`,
          type: resolved.id,
          x: cx, y: cy,
          width: tw, height: th,
          fillColor: 'transparent',
          tableName: spec.tableName || spec.name, // NEW: Table Numbering
          scale: 1, zIndex: 5
        });

        // Add chairs
        const cCount = Number(spec.count || 4);

        if (!hasBuiltInSeating) {
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
              strokeWidth: AI_DEFAULT_STROKE_WIDTH,
              scale: 1, zIndex: 15
            });
          }
        }

        return; // Skip grid
      }

      tableSpecs.push({
        name: spec.tableName || spec.name,
        chairCount: Number(spec.count || 4),
        chairType: resolveAsset(spec.chairAsset || 'normal-chair').id,
        chairW: resolveAsset(spec.chairAsset || 'normal-chair').width,
        chairH: resolveAsset(spec.chairAsset || 'normal-chair').height,
        tableW: tw,
        tableH: isRound ? tw : th,
        tableType: resolved.id,
        isRound,
        hasBuiltInSeating,
        rotationDegrees: Number(spec.rotation || plan.tableArrangement?.rotationDegrees || 0),
        chairFacingSide: String(spec.chairFacingSide || plan.tableArrangement?.chairFacingSide || ''),
        chairWorldSide: String((spec as any).chairWorldSide || ''),
      });
    });

    // ─── 5. Calculate Grid Layout in Usable Area ─────────────────────────────
    let layoutWarning = '';
    if (tableSpecs.length > 0) {
      const N = tableSpecs.length;
      const TABLE_GAP = 900;
      const usableW = Math.max(1, usableMaxX - usableMinX);
      const usableH = Math.max(1, usableMaxY - usableMinY);
      const arrangementType = String(plan.tableArrangement?.type || 'grid').toLowerCase();
      const layoutScaleMode = String((plan as any).layoutPreferences?.scaleMode || '').toLowerCase();
      const fitLayoutToSpace = layoutScaleMode === 'fit-space';
      const arrangementDirection =
        plan.tableArrangement?.direction ||
        (usableW >= usableH ? 'horizontal' : 'vertical');

      type LayoutSlot = { x: number; y: number };
      const gridCols = plan.gridLayout?.columns || Math.ceil(Math.sqrt(N));
      const gridRows = Math.ceil(N / gridCols);

      // Compute natural (unscaled) cell dimensions.
      // Built-in seating assets already include their chairs, so do not reserve
      // extra loose-chair footprint around them or the whole arrangement shrinks too aggressively.
      const repTW0 = tableSpecs[0].tableW;
      const repTH0 = tableSpecs[0].tableH;
      const builtInSeating = tableSpecs[0].hasBuiltInSeating;
      const cellW0 = builtInSeating
        ? repTW0 + TABLE_GAP
        : repTW0 + 2 * (CHAIR_SIZE + CHAIR_GAP) + TABLE_GAP;
      const cellH0 = builtInSeating
        ? repTH0 + TABLE_GAP
        : repTH0 + 2 * (CHAIR_SIZE + CHAIR_GAP) + TABLE_GAP;
      const buildRectanglePerimeterSlots = (
        count: number,
        width: number,
        height: number
      ): LayoutSlot[] => {
        if (count <= 0) return [];
        if (count === 1) return [{ x: 0, y: 0 }];

        const slots: LayoutSlot[] = [];
        const halfW = width / 2;
        const halfH = height / 2;
        const perimeter = 2 * (width + height);

        for (let i = 0; i < count; i++) {
          const distance = (i / count) * perimeter;
          if (distance < width) {
            slots.push({ x: -halfW + distance, y: -halfH });
          } else if (distance < width + height) {
            slots.push({ x: halfW, y: -halfH + (distance - width) });
          } else if (distance < 2 * width + height) {
            slots.push({
              x: halfW - (distance - width - height),
              y: halfH,
            });
          } else {
            slots.push({
              x: -halfW,
              y: halfH - (distance - 2 * width - height),
            });
          }
        }

        return slots;
      };
      const rawSlots: LayoutSlot[] =
        arrangementType === 'linear'
          ? arrangementDirection === 'vertical'
            ? tableSpecs.map((_, i) => ({ x: 0, y: i * cellH0 }))
            : tableSpecs.map((_, i) => ({ x: i * cellW0, y: 0 }))
          : arrangementType === 'boardroom'
            ? arrangementDirection === 'vertical'
              ? tableSpecs.map((_, i) => ({ x: 0, y: i * (cellH0 * 0.8) }))
              : tableSpecs.map((_, i) => ({ x: i * (cellW0 * 0.8), y: 0 }))
            : arrangementType === 'classroom'
              ? (() => {
                  const cols = Math.max(
                    2,
                    plan.gridLayout?.columns || Math.ceil(Math.sqrt(N))
                  );
                  const rowGap = cellH0 * 1.2;
                  const colGap = cellW0 * 0.95;
                  return tableSpecs.map((_, i) => {
                    const col = i % cols;
                    const row = Math.floor(i / cols);
                    return { x: col * colGap, y: row * rowGap };
                  });
                })()
              : arrangementType === 'chevron'
                ? (() => {
                    const cols = Math.max(
                      2,
                      plan.gridLayout?.columns || Math.ceil(Math.sqrt(N))
                    );
                    const rowGap = cellH0 * 1.05;
                    const colGap = cellW0 * 0.92;
                    return tableSpecs.map((_, i) => {
                      const col = i % cols;
                      const row = Math.floor(i / cols);
                      const offset = (row % 2 === 0 ? -0.25 : 0.25) * cellW0;
                      return { x: col * colGap + offset, y: row * rowGap };
                    });
                  })()
          : arrangementType === 'circular'
            ? (() => {
                if (N === 1) return [{ x: 0, y: 0 }];
                const slots: LayoutSlot[] = [];
                const baseRadius =
                  Number(plan.tableArrangement?.radiusMm) ||
                  Math.max(cellW0, cellH0) * 1.25;
                const ringStep = Math.max(cellW0, cellH0) * 1.15;
                let remaining = N;
                let ringIndex = 0;

                while (remaining > 0) {
                  const radius = baseRadius + ringIndex * ringStep;
                  const ringCapacity = Math.max(
                    ringIndex === 0 ? 6 : 8,
                    Math.floor((2 * Math.PI * radius) / Math.max(cellW0, cellH0))
                  );
                  const countThisRing = Math.min(remaining, ringCapacity);
                  for (let i = 0; i < countThisRing; i++) {
                    const angle = -Math.PI / 2 + (i / countThisRing) * Math.PI * 2;
                    slots.push({
                      x: Math.cos(angle) * radius,
                      y: Math.sin(angle) * radius,
                    });
                  }
                  remaining -= countThisRing;
                  ringIndex += 1;
                }

                return slots;
              })()
            : arrangementType === 'perimeter'
              ? (() => {
                  const aspect = usableW / Math.max(1, usableH);
                  const approxCols = Math.max(2, Math.round(Math.sqrt(N * aspect)));
                  const approxRows = Math.max(2, Math.ceil(N / approxCols));
                  const width = Math.max(cellW0 * 2, (approxCols - 1) * cellW0);
                  const height = Math.max(cellH0 * 2, (approxRows - 1) * cellH0);
                  return buildRectanglePerimeterSlots(N, width, height);
                })()
              : arrangementType === 'u-shape'
                ? (() => {
                    if (N === 1) return [{ x: 0, y: 0 }];
                    const slots: LayoutSlot[] = [];
                    const topCount = Math.max(2, Math.ceil(N / 2));
                    const sideCount = Math.max(0, Math.ceil((N - topCount) / 2));
                    const width = Math.max(cellW0 * 2, (topCount - 1) * cellW0);
                    const halfW = width / 2;

                    for (let i = 0; i < topCount && slots.length < N; i++) {
                      const x =
                        topCount === 1
                          ? 0
                          : -halfW + (i * width) / Math.max(1, topCount - 1);
                      slots.push({ x, y: 0 });
                    }

                    for (let i = 0; i < sideCount && slots.length < N; i++) {
                      slots.push({ x: -halfW, y: (i + 1) * cellH0 });
                    }

                    for (let i = 0; i < sideCount && slots.length < N; i++) {
                      slots.push({ x: halfW, y: (i + 1) * cellH0 });
                    }

                    while (slots.length < N) {
                      slots.push({ x: 0, y: (sideCount + 1) * cellH0 });
                    }

                    return slots;
                  })()
                : tableSpecs.map((_, i) => {
                    const col = i % gridCols;
                    const row = Math.floor(i / gridCols);
                    return { x: col * cellW0, y: row * cellH0 };
                  });
      // Total footprint = cols*cellW (each cell already contains the trailing gap)
      // But the LAST cell's trailing gap is excess, so subtract one TABLE_GAP
      const minX0 = Math.min(...rawSlots.map((slot) => slot.x - cellW0 / 2));
      const maxX0 = Math.max(...rawSlots.map((slot) => slot.x + cellW0 / 2));
      const minY0 = Math.min(...rawSlots.map((slot) => slot.y - cellH0 / 2));
      const maxY0 = Math.max(...rawSlots.map((slot) => slot.y + cellH0 / 2));
      const gridW0 = Math.max(1, maxX0 - minX0);
      const gridH0 = Math.max(1, maxY0 - minY0);

      // ── Auto-scale: shrink everything proportionally so it always fits
      const shrinkScaleX = gridW0 > usableW ? usableW / gridW0 : 1;
      const shrinkScaleY = gridH0 > usableH ? usableH / gridH0 : 1;
      let scaleFactor = Math.min(shrinkScaleX, shrinkScaleY) * 0.95; // 5% safety margin

      if (fitLayoutToSpace && gridW0 < usableW && gridH0 < usableH) {
        const expandScaleX = usableW / gridW0;
        const expandScaleY = usableH / gridH0;
        scaleFactor = Math.min(Math.min(expandScaleX, expandScaleY), 1.28) * 0.92;
        if (scaleFactor > 1.02) {
          layoutWarning = `ℹ️ Layout expanded to ${Math.round(scaleFactor * 100)}% to use more of the available room.`;
        }
      } else if (scaleFactor < 1) {
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
      const layoutCenterX0 = (minX0 + maxX0) / 2;
      const layoutCenterY0 = (minY0 + maxY0) / 2;
      const centerOverrideX =
        typeof plan.tableArrangement?.centerX === 'number'
          ? wallMinX + plan.tableArrangement.centerX
          : null;
      const centerOverrideY =
        typeof plan.tableArrangement?.centerY === 'number'
          ? wallMinY + plan.tableArrangement.centerY
          : null;
      const gridOriginX = centerOverrideX ?? (usableMinX + usableW / 2);
      const gridOriginY = centerOverrideY ?? (usableMinY + usableH / 2);

      tableSpecs.forEach((spec, i) => {
        const slot = rawSlots[i];

        // Scale this table's individual dimensions
        const tw = Math.round(spec.tableW * scaleFactor);
        const th = Math.round(spec.tableH * scaleFactor);
        const tableRotation = Number(spec.rotationDegrees || plan.tableArrangement?.rotationDegrees || 0);

        const tableCX = gridOriginX + (slot.x - layoutCenterX0) * scaleFactor;
        const tableCY = gridOriginY + (slot.y - layoutCenterY0) * scaleFactor;

        // Place table — use EXACT library dimensions, same as drag-and-drop
        const libDef = ASSET_LIBRARY.find(x => x.id === spec.tableType);
        const renderW = libDef?.width ?? tw;
        const renderH = libDef?.height ?? th;
        generatedAssets.push({
          id: `table-${i}`,
          type: spec.tableType,
          x: tableCX, y: tableCY,
          width: renderW, height: renderH,
          rotation: tableRotation,
          strokeWidth: AI_DEFAULT_STROKE_WIDTH,
          strokeColor: '#1a1a1a',
          fillColor: 'transparent', // No fill by default per user request
          tableName: spec.name, // NEW: Table Numbering
          scale: scaleFactor, zIndex: 5
        });

        // ─── Chairs ──────────────────────────────────────────────────────────
        if (!spec.hasBuiltInSeating) {
          const cCount = spec.chairCount;
          const looseChairType = spec.chairType || 'normal-chair';
          const looseChairW = spec.chairW || effChairSize;
          const looseChairH = spec.chairH || effChairSize;
          const chairFacingSide = String(spec.chairFacingSide || '');
          const chairWorldSide = String((spec as any).chairWorldSide || '');
          const topChairY = tableCY - th / 2 - effChairGap - effChairSize / 2;
          const botChairY = tableCY + th / 2 + effChairGap + effChairSize / 2;
          const leftChairX = tableCX - tw / 2 - effChairGap - effChairSize / 2;
          const rightChairX = tableCX + tw / 2 + effChairGap + effChairSize / 2;

          if (spec.isRound) {
            const radius = tw / 2 + effChairGap + effChairSize / 2;
            const useFrontArc = chairFacingSide && cCount <= 4;
            const angles = useFrontArc
              ? buildFrontArcChairAngles(chairFacingSide, cCount)
              : Array.from({ length: cCount }, (_, ci) => (ci / cCount) * Math.PI * 2 - Math.PI / 2);
            for (let ci = 0; ci < cCount; ci++) {
              const angle = angles[ci] + ((tableRotation * Math.PI) / 180);
              generatedAssets.push({
                id: `chair-${i}-${ci}`, type: looseChairType,
                x: tableCX + Math.cos(angle) * radius,
                y: tableCY + Math.sin(angle) * radius,
                rotation: (angle * 180 / Math.PI) + 90,
                width: looseChairW, height: looseChairH,
                strokeWidth: AI_DEFAULT_STROKE_WIDTH, scale: 1, zIndex: 15,
                fillColor: 'transparent'
              });
            }
          } else {
            const displayWidth = Math.abs(tableRotation % 180) === 90 ? th : tw;
            const displayHeight = Math.abs(tableRotation % 180) === 90 ? tw : th;
            if (cCount <= 4 && chairWorldSide) {
              const worldOffsets = buildWorldSideChairOffsets(
                chairWorldSide,
                cCount,
                displayWidth,
                displayHeight,
                effChairGap,
                effChairSize
              );
              worldOffsets.forEach((pt, ci) => {
                generatedAssets.push({
                  id: `chair-${i}-world-${ci}`,
                  type: looseChairType,
                  x: tableCX + pt.x,
                  y: tableCY + pt.y,
                  rotation: pt.rotation,
                  width: looseChairW,
                  height: looseChairH,
                  strokeWidth: AI_DEFAULT_STROKE_WIDTH,
                  scale: 1,
                  zIndex: 15,
                  fillColor: 'transparent'
                });
              });
              return;
            }
            if (cCount <= 4 && chairFacingSide) {
              const localOffsets = buildFrontFacingChairOffsets(
                chairFacingSide,
                cCount,
                tw,
                th,
                chairFacingSide === 'left' ? -tw / 2 - effChairGap - effChairSize / 2 : chairFacingSide === 'right' ? tw / 2 + effChairGap + effChairSize / 2 : 0,
                chairFacingSide === 'top' ? -th / 2 - effChairGap - effChairSize / 2 : chairFacingSide === 'bottom' ? th / 2 + effChairGap + effChairSize / 2 : 0
              );
              localOffsets.forEach((pt, ci) => {
                const offset = rotateLocalOffset(pt.x, pt.y, tableRotation);
                generatedAssets.push({
                  id: `chair-${i}-front-${ci}`,
                  type: looseChairType,
                  x: tableCX + offset.x,
                  y: tableCY + offset.y,
                  rotation: pt.rotation + tableRotation,
                  width: looseChairW,
                  height: looseChairH,
                  strokeWidth: AI_DEFAULT_STROKE_WIDTH,
                  scale: 1,
                  zIndex: 15,
                  fillColor: 'transparent'
                });
              });
              return;
            }
            const perimeter = 2 * (tw + th);
            const topCount = Math.max(1, Math.round(cCount * tw / perimeter));
            const botCount = Math.max(1, Math.round(cCount * tw / perimeter));
            const leftCount = Math.max(0, Math.round(cCount * th / perimeter));
            const rightCount = Math.max(0, cCount - topCount - botCount - leftCount);

            const addRow = (count: number, y: number, rot: number) => {
              for (let ci = 0; ci < count; ci++) {
                const localX = -tw / 2 + (tw / (count + 1)) * (ci + 1);
                const offset = rotateLocalOffset(localX, y - tableCY, tableRotation);
                generatedAssets.push({
                  id: `chair-${i}-r-${ci}-${rot}`, type: looseChairType,
                  x: tableCX + offset.x, y: tableCY + offset.y, rotation: rot + tableRotation,
                  width: looseChairW, height: looseChairH,
                  strokeWidth: AI_DEFAULT_STROKE_WIDTH, scale: 1, zIndex: 15,
                  fillColor: 'transparent'
                });
              }
            };
            const addCol = (count: number, x: number, rot: number) => {
              for (let ci = 0; ci < count; ci++) {
                const localY = -th / 2 + (th / (count + 1)) * (ci + 1);
                const offset = rotateLocalOffset(x - tableCX, localY, tableRotation);
                generatedAssets.push({
                  id: `chair-${i}-c-${ci}-${rot}`, type: looseChairType,
                  x: tableCX + offset.x, y: tableCY + offset.y, rotation: rot + tableRotation,
                  width: looseChairW, height: looseChairH,
                  strokeWidth: AI_DEFAULT_STROKE_WIDTH, scale: 1, zIndex: 15,
                  fillColor: 'transparent'
                });
              }
            };

            addRow(topCount, topChairY, 180);
            addRow(botCount, botChairY, 0);
            if (leftCount > 0) addCol(leftCount, leftChairX, 90);
            if (rightCount > 0) addCol(rightCount, rightChairX, 270);
          }
        }
      });
    }

    // ─── 5.5 Primitive Shapes ────────────────────────────────────────────────
    if (nonStageShapes.length > 0) {
      nonStageShapes.forEach((s: any, idx: number) => {
        let sx = roomCX;
        let sy = roomCY;
        if (typeof s.xMm === 'number') sx = wallMinX + s.xMm;
        else if (typeof s.x === 'number') sx = wallMinX + s.x;
        
        if (typeof s.yMm === 'number') sy = wallMinY + s.yMm;
        else if (typeof s.y === 'number') sy = wallMinY + s.y;

        const fillProps = getResolvedFill(s);

        generatedShapes.push({
          ...s, // Preserve extra props
          ...fillProps, // Override with resolved fill
          id: `ai-shape-${idx}`,
          type: s.type || 'rectangle',
          x: sx, y: sy,
          width: Number(s.widthMm ?? s.width ?? 1000),
          height: Number(s.heightMm ?? s.height ?? 1000),
          stroke: s.stroke || s.strokeColor || '#000000',
          strokeColor: s.stroke || s.strokeColor || '#000000',
          strokeWidth: Number(s.strokeWidth ?? AI_DEFAULT_STROKE_WIDTH),
          rotation: Number(s.rotation ?? 0),
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

    // ─── 7. Seating Layouts (Theater, Classroom, etc.) ───────────────────────
    if (Array.isArray(plan.seatingLayout)) {
        plan.seatingLayout.forEach((layout: any, lIdx: number) => {
            const resolved = resolveAsset(layout.assetName || 'normal-chair');
            const libDef = ASSET_LIBRARY.find(x => x.id === resolved.id);
            const aw = libDef?.width || 500;
            const ah = libDef?.height || 500;
            
            const count = Number(layout.count || 20);
            const orientation = layout.orientation || 'horizontal';
            const type = layout.type || 'theater';
            const zone = (layout as any).zone;
            const layoutRotation = Number((layout as any).rotationDegrees || 0);
            const layoutScaleMode = String((layout as any).scaleMode || (plan as any).layoutPreferences?.scaleMode || '').toLowerCase();
            const fitLayoutToSpace = layoutScaleMode === 'fit-space';
            
            const zoneWidth = zone ? Number(zone.widthMm || roomW) : roomW;
            const zoneHeight = zone ? Number(zone.heightMm || roomH) : roomH;
            const provisionalBaseRowSpacing = layout.rowSpacingMm || (ah + 600);
            const provisionalBaseColSpacing = layout.colSpacingMm || (aw + 600);
            const inferredColsFromZone = Math.max(1, Math.floor(zoneWidth / Math.max(provisionalBaseColSpacing, 1)));
            const cols = layout.columns || Math.max(1, Math.min(inferredColsFromZone, orientation === 'horizontal' ? Math.ceil(Math.sqrt(count * 1.5)) : Math.ceil(Math.sqrt(count / 1.5))));
            const rowsCount = Math.ceil(count / cols);

            const naturalLayoutWidth = aw + Math.max(0, cols - 1) * provisionalBaseColSpacing;
            const naturalLayoutHeight = ah + Math.max(0, rowsCount - 1) * provisionalBaseRowSpacing;
            const assetScale =
              zone && fitLayoutToSpace
                ? Math.max(
                    1,
                    Math.min(
                      Math.min((zoneWidth * 0.76) / Math.max(naturalLayoutWidth, 1), (zoneHeight * 0.62) / Math.max(naturalLayoutHeight, 1)),
                      1.8
                    )
                  )
                : 1;
            const effAw = aw * assetScale;
            const effAh = ah * assetScale;
            const scaledGap = 600 * (fitLayoutToSpace ? Math.min(assetScale, 1.5) : 1);
            const baseRowSpacing = layout.rowSpacingMm || (effAh + scaledGap);
            const baseColSpacing = layout.colSpacingMm || (effAw + scaledGap);

            let colSpacing = baseColSpacing;
            let rowSpacing = baseRowSpacing;
            if (!layout.colSpacingMm && !layout.rowSpacingMm && zone) {
              const targetWidth = Math.max(baseColSpacing * Math.max(1, cols - 1), zoneWidth * (fitLayoutToSpace ? 0.86 : 0.65));
              const targetHeight = Math.max(baseRowSpacing * Math.max(1, rowsCount - 1), zoneHeight * (fitLayoutToSpace ? 0.64 : 0.4));
              if (cols > 1) {
                colSpacing = Math.max(baseColSpacing, Math.min((zoneWidth - effAw) / (cols - 1), targetWidth / (cols - 1)));
              }
              if (rowsCount > 1) {
                rowSpacing = Math.max(baseRowSpacing, Math.min((zoneHeight - effAh) / (rowsCount - 1), targetHeight / (rowsCount - 1)));
              }
            }

            const layoutWidth = effAw + Math.max(0, cols - 1) * colSpacing;
            const layoutHeight = effAh + Math.max(0, rowsCount - 1) * rowSpacing;
            const zoneOriginX = zone ? wallMinX + Number(zone.xMm || 0) : wallMinX;
            const zoneOriginY = zone ? wallMinY + Number(zone.yMm || 0) : wallMinY;
            const startX = typeof layout.centerX === 'number'
              ? wallMinX + layout.centerX - (layoutWidth / 2) + effAw / 2
              : zoneOriginX + Math.max(0, (zoneWidth - layoutWidth) / 2) + effAw / 2;
            const startY = typeof layout.centerY === 'number'
              ? wallMinY + layout.centerY - (layoutHeight / 2) + effAh / 2
              : zoneOriginY + Math.max(0, (zoneHeight - layoutHeight) / 2) + effAh / 2;
            
            for (let i = 0; i < count; i++) {
                const col = i % cols;
                const row = Math.floor(i / cols);
                
                const x = startX + col * colSpacing;
                const y = startY + row * rowSpacing;
                
                // For classroom style, we add a table for every N chairs, or similar
                // But for now, let's just place the requested asset correctly in rows
                generatedAssets.push({
                    id: `seating-${lIdx}-${i}`,
                    type: resolved.id,
                    x: x,
                    y: y,
                    width: aw,
                    height: ah,
                    rotation: layoutRotation || (orientation === 'horizontal' ? 0 : 90),
                    scale: assetScale,
                    zIndex: 10
                });
                
                // If classroom, add tables in front of rows
                if (type === 'classroom' && col === 0) {
                    // Add one long table or individual tables
                    // This is a complex case, but for now we focus on the chairs stacking fix
                }
            }
        });
    }

    const computeWallBounds = (wall: any) => {
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      let maxThickness = Number(wall?.wallThickness) || 0;
      if (Array.isArray(wall?.edges)) {
        wall.edges.forEach((edge: any) => {
          maxThickness = Math.max(maxThickness, Number(edge?.thickness) || 0);
        });
      }
      const pad = Math.max(1, maxThickness / 2);
      const points = Array.isArray(wall?.nodes)
        ? wall.nodes
        : Array.isArray(wall?.wallNodes)
          ? wall.wallNodes
          : [];
      points.forEach((node: any) => {
        if (!Number.isFinite(node?.x) || !Number.isFinite(node?.y)) return;
        minX = Math.min(minX, node.x - pad);
        minY = Math.min(minY, node.y - pad);
        maxX = Math.max(maxX, node.x + pad);
        maxY = Math.max(maxY, node.y + pad);
      });
      if (!Number.isFinite(minX)) return null;
      return { minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY };
    };

    const computeNonWallBounds = () => {
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      const includePoint = (x: number, y: number) => {
        if (!Number.isFinite(x) || !Number.isFinite(y)) return;
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      };
      const includeRect = (cx: number, cy: number, w: number, h: number) => {
        const halfW = Math.max(1, Math.abs(w) / 2);
        const halfH = Math.max(1, Math.abs(h) / 2);
        includePoint(cx - halfW, cy - halfH);
        includePoint(cx + halfW, cy + halfH);
      };

      generatedAssets.forEach((asset: any) => {
        const scale = Number(asset?.scale) || 1;
        includeRect(asset.x, asset.y, (Number(asset?.width) || 0) * scale, (Number(asset?.height) || 0) * scale);
      });

      generatedShapes.forEach((shape: any) => {
        includeRect(shape.x, shape.y, Number(shape?.width) || 0, Number(shape?.height) || 0);
      });

      generatedTextAnnotations.forEach((annotation: any) => {
        const fontSize = Number(annotation?.fontSize) || 400;
        const textLength = String(annotation?.text || '').length || 1;
        includeRect(annotation.x, annotation.y, textLength * fontSize * 0.6, fontSize * 1.2);
      });

      if (!Number.isFinite(minX)) return null;
      return { minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY };
    };

    if (generatedWalls.length === 1) {
      const wallBounds = computeWallBounds(generatedWalls[0]);
      const contentBounds = computeNonWallBounds();
      const contentEscapesWall = Boolean(
        wallBounds &&
          contentBounds &&
          (
            contentBounds.minX < wallBounds.minX - 300 ||
            contentBounds.maxX > wallBounds.maxX + 300 ||
            contentBounds.minY < wallBounds.minY - 300 ||
            contentBounds.maxY > wallBounds.maxY + 300
          )
      );
      const wallLooksTooSmall = Boolean(
        wallBounds &&
          (
            wallBounds.width < roomW * 0.6 ||
            wallBounds.height < roomH * 0.6
          )
      );

      if (contentEscapesWall && wallLooksTooSmall) {
        generatedWalls[0] = createRoomEnclosureWall(generatedWalls[0].id || 'wall-room-repaired');
      }
    }

    return {
      walls: generatedWalls,
      assets: generatedAssets,
      shapes: generatedShapes,
      textAnnotations: generatedTextAnnotations,
      width: roomW,
      height: roomH,
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
          textAnnotations: result.textAnnotations,
          width: result.width,
          height: result.height
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

  const buildFallbackPreviewFromPrompt = (source: string) => {
    const marqueePreview = buildFallbackMarqueePreview(source);
    if (marqueePreview) return marqueePreview;

    const joinedHistory = messages
      .filter((m: any) => m.role === 'user')
      .map((m: any) => m.content || '')
      .join('\n');
    const text = `${joinedHistory}\n${source || ''}`;

    const match = text.match(
      /(\d+(?:\.\d+)?)\s*(mm|m)?\s*(?:x|by)\s*(\d+(?:\.\d+)?)\s*(mm|m)?/i
    );
    if (!match) return undefined;

    const toMm = (value: string, unit?: string) => {
      const numeric = Number(value);
      if (!Number.isFinite(numeric)) return null;
      return (unit || '').toLowerCase() === 'm' ? numeric * 1000 : numeric;
    };

    const widthMm = toMm(match[1], match[2]);
    const heightMm = toMm(match[3], match[4] || match[2]);
    if (!widthMm || !heightMm) return undefined;

    const latestAssistantText = [...messages]
      .reverse()
      .find((m: any) => m.role === 'assistant')?.content?.toLowerCase() || '';
    const summaryStepActive =
      latestAssistantText.includes('in plain language, tell me what you want for this event layout') ||
      latestAssistantText.includes('describe what you want for this event layout') ||
      latestAssistantText.includes('describe the event layout you want');

    const guestMatch = text.match(/(?:about\s+)?(\d+)\s*guest/i);
    const guestCount = guestMatch ? Number(guestMatch[1]) : null;
    const seaterMatch = text.match(/(\d+)\s*seater/i);
    const seatCount = seaterMatch ? Number(seaterMatch[1]) : null;

    const lower = text.toLowerCase();
    const arrangementType = lower.includes('u-shape') || lower.includes('u shape')
      ? 'u-shape'
      : lower.includes('boardroom')
        ? 'boardroom'
        : lower.includes('classroom')
          ? 'classroom'
          : lower.includes('chevron')
            ? 'chevron'
            : lower.includes('perimeter')
              ? 'perimeter'
              : lower.includes('circular')
                ? 'circular'
                : lower.includes('linear')
                  ? 'linear'
                  : lower.includes('grid')
                    ? 'grid'
                    : 'grid';

    const wantsRound = lower.includes('round');
    const wantsRectangular = lower.includes('rectangular') || lower.includes('rectangle');
    const inferredAsset = ASSET_LIBRARY.find((asset) => {
      const label = `${asset.label || ''} ${asset.id}`.toLowerCase();
      if (!label.includes('table')) return false;
      if (seatCount && !new RegExp(`\\b${seatCount}\\s*seater\\b`).test(label)) return false;
      if (wantsRound && !label.includes('round')) return false;
      if (wantsRectangular && !label.includes('rectangular')) return false;
      return true;
    });

    const count =
      guestCount && seatCount
        ? Math.max(1, Math.ceil(guestCount / seatCount))
        : 0;

    const previewPlan: any = {
      walls: [{ widthMm, heightMm, wallType: 'enclosure-150' }],
    };

    if (lower.includes('grassy field') || lower.includes('grass')) {
      previewPlan.shapes = [
        {
          type: 'rectangle',
          x: widthMm / 2,
          y: heightMm / 2,
          widthMm,
          heightMm,
          fillType: 'texture',
          fillTexture: 'grass-01',
          fillTextureScale: 4,
          fillTextureThickness: 1,
          stroke: 'transparent',
          strokeWidth: 0,
          previewLayer: 'background',
        },
      ];
    } else if (lower.includes('parking lot') || lower.includes('car park') || lower.includes('parking')) {
      previewPlan.shapes = [
        {
          type: 'rectangle',
          x: widthMm / 2,
          y: heightMm / 2,
          widthMm,
          heightMm,
          fillType: 'texture',
          fillTexture: 'parking-lot',
          fillTextureScale: 4,
          fillTextureThickness: 1,
          stroke: 'transparent',
          strokeWidth: 0,
          previewLayer: 'background',
        },
      ];
    } else if (lower.includes('beach') || lower.includes('sand')) {
      previewPlan.shapes = [
        {
          type: 'rectangle',
          x: widthMm / 2,
          y: heightMm / 2,
          widthMm,
          heightMm,
          fillType: 'texture',
          fillTexture: 'sand-01',
          fillTextureScale: 4,
          fillTextureThickness: 1,
          stroke: 'transparent',
          strokeWidth: 0,
          previewLayer: 'background',
        },
      ];
    }

    if (!summaryStepActive && inferredAsset && count > 0) {
      previewPlan.assets = [
        {
          assetName: inferredAsset.label || inferredAsset.id,
          count,
          chairCount: seatCount || 4,
          startTableNumber: 1,
        },
      ];
      previewPlan.tableArrangement = { type: arrangementType };
    }

    if (!summaryStepActive && /\byes stage\b|\badd a stage\b|\bwith stage\b/.test(lower)) {
      previewPlan.assets = [
        ...(previewPlan.assets || []),
        {
          assetName: '1m x 1m Modular Stage 2',
          wall: 'top',
          widthMm: 4000,
          heightMm: 2000,
        },
      ];
    }

    return processPlan(previewPlan, canvas);
  };

  const applyPreviewPlan = (previewPlan: any) => {
    if (!previewPlan) return;
    const walls = Array.isArray(previewPlan.walls) ? previewPlan.walls : [];
    const assets = Array.isArray(previewPlan.assets) ? previewPlan.assets : [];
    const shapes = Array.isArray(previewPlan.shapes) ? previewPlan.shapes : [];
    const textAnnotations = Array.isArray(previewPlan.textAnnotations) ? previewPlan.textAnnotations : [];
    if (walls.length === 0 && assets.length === 0 && shapes.length === 0 && textAnnotations.length === 0) return;

    setPlacementMode({
      active: true,
      data: {
        walls,
        assets,
        shapes,
        textAnnotations,
        width: previewPlan.width,
        height: previewPlan.height
      }
    });

    const parts: string[] = [];
    if (assets.length > 0) parts.push(`${assets.length} items`);
    if (walls.length > 0) parts.push(`${walls.length} walls`);
    if (shapes.length > 0) parts.push(`${shapes.length} shapes`);
    if (textAnnotations.length > 0) parts.push(`${textAnnotations.length} notes`);

    setMessages((m: any) => [
      ...m,
      { role: 'assistant', content: `✅ Draft preview ready. Click anywhere on the workspace to place the ${parts.join(', ')}.` }
    ]);
    setIsOpen(false);
    setInputValue("");
  };

    const handleSubmit = async (overridePrompt?: string) => {
      if (!inputValue.trim() && !overridePrompt) return;
      const prompt = overridePrompt || inputValue.trim();
      const isAssetSelectionReply = /^i want to use the\s+/i.test(prompt);
      setInputValue(""); // Clear immediately to prevent double-sends
      if (isAssetSelectionReply) {
        setMessages((m: any) =>
          m.map((msg: any) => (msg.assetSelection ? { ...msg, assetSelection: undefined } : msg))
        );
      }
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
      let previewPlanData: any | undefined;
      let planData: any | undefined;
      let rawPlan: any | undefined;
      let assetSelection: any | undefined;
      let inferredAssetSelection: any | undefined;

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
          previewPlanData = processed;
          previewData = processed.combined;
        } catch (e) {
          console.error("Preview processing failed", e);
        }
      }

        // Handle followUp (AI asking a clarifying question)
        const followUpText = data.followUp || null;
        if (!assetSelection && followUpText && !isAssetSelectionReply) {
          inferredAssetSelection = buildFallbackAssetSelectionFromFollowUp(followUpText);
        }
      if ((!previewData || previewData.length === 0) && followUpText) {
        const fallbackProcessed = buildFallbackPreviewFromPrompt(prompt);
        if (fallbackProcessed) {
          previewPlanData = fallbackProcessed;
          previewData = fallbackProcessed.combined;
        }
      }

      const previousPreviewPlan = getLatestPreviewPlanData();
      if (
        isWallsOnlyPreviewPlan(previewPlanData) &&
        previousPreviewPlan &&
        !isWallsOnlyPreviewPlan(previousPreviewPlan)
      ) {
        previewPlanData = mergePreviewPlans(previousPreviewPlan, previewPlanData);
        previewData = previewPlanData.combined;
      } else if (
        !previewPlanData &&
        previousPreviewPlan &&
        isAssetSelectionReply
      ) {
        previewPlanData = mergePreviewPlans(previousPreviewPlan, undefined);
        previewData = previewPlanData.combined;
      }

      if (assetSelection || inferredAssetSelection || planData || previewData || previewPlanData || data.message || followUpText) {
        let content = '';
        if (data.message) content = data.message;
        else if (followUpText) content = followUpText;
        else if (planData) {
          content = planData.warning
            ? `${planData.warning} I have still generated a draft preview. Click "Apply to Canvas" to use it, or adjust the room size/guest count first.`
            : 'I have generated your plan draft. Click "Apply to Canvas" to use it.';
        }
        else if (assetSelection) content = assetSelection.message || 'Please select an asset type:';
        else content = 'Done!';

        setMessages((m: any) => [...m, {
          role: 'assistant',
          content,
          assetSelection: assetSelection || inferredAssetSelection,
          planData,
          rawPlan,
          previewData,
          previewPlanData,
          choices: data.choices, // FIX: Pass choices to state so buttons show
          rawAssistantMessage: JSON.stringify(data)
        }]);
      } else if (data.error) {
        setMessages((m: any) => [...m, { role: 'assistant', content: `Error: ${data.error}` }]);
      } else {
        setMessages((m: any) => [...m, {
          role: 'assistant',
          content: 'I’m still with you. Tell me the next thing you want in the layout, and I’ll keep building from there.'
        }]);
      }
    } catch (e) {
      console.error(e);
      setMessages((m: any) => [...m, { role: 'assistant', content: 'Sorry, I could not process that request.' }]);
    } finally {
      setIsLoading(false);
    }
  };

  // Auto-submit initial greeting when modal opens and chat is empty
  useEffect(() => {
    if (isOpen && messages.length === 0 && !isLoading) {
      handleSubmit("I want to create a new layout");
    }
  }, [isOpen, messages.length]);

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

                        // 4. Reset to initial greeting
                        setMessages([
                          { 
                            role: 'assistant', 
                            content: "Hello! I'm your EventSpacePro AI assistant. I'm here to help you design the perfect event layout. What would you like to do first?",
                            choices: ["I want to create a new layout", "Help me arrange my furniture", "Show me the basics"]
                          }
                        ]);

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
                          (() => {
                            const wallOnlyPlanPreview =
                              Array.isArray(m.planData?.walls) &&
                              m.planData.walls.length > 0 &&
                              (!Array.isArray(m.planData?.assets) || m.planData.assets.length === 0) &&
                              (!Array.isArray(m.planData?.shapes) || m.planData.shapes.length === 0) &&
                              (!Array.isArray(m.planData?.textAnnotations) || m.planData.textAnnotations.length === 0);
                            return (
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
                            <div
                              className="relative"
                              style={
                                wallOnlyPlanPreview
                                  ? {
                                      aspectRatio: `${Math.max(1, m.planData.width || 600)} / ${Math.max(1, m.planData.height || 300)}`,
                                      minHeight: 240,
                                    }
                                  : {
                                      aspectRatio: `${Math.max(1, m.planData.width || 600)} / ${Math.max(1, m.planData.height || 300)}`,
                                      minHeight: 220
                                    }
                              }
                            >
                              <PlanPreview
                                assets={m.planData.assets}
                                walls={m.planData.walls}
                                shapes={m.planData.shapes}
                                textAnnotations={m.planData.textAnnotations}
                                width={600}
                                height={300}
                                className="w-full h-full"
                                stretchToContainer={false}
                              />
                            </div>
                          </div>
                            );
                          })()
                        )}

                        {m.previewPlanData && (
                          (() => {
                            const wallOnlyPreview =
                              Array.isArray(m.previewPlanData?.walls) &&
                              m.previewPlanData.walls.length > 0 &&
                              (!Array.isArray(m.previewPlanData?.assets) || m.previewPlanData.assets.length === 0) &&
                              (!Array.isArray(m.previewPlanData?.shapes) || m.previewPlanData.shapes.length === 0) &&
                              (!Array.isArray(m.previewPlanData?.textAnnotations) || m.previewPlanData.textAnnotations.length === 0);
                            return (
                          <div
                            className="w-full mt-2 rounded-xl border border-slate-200 overflow-hidden bg-slate-50 relative group shadow-sm"
                          >
                            <div className="p-2 bg-white border-b border-slate-100 flex items-center justify-between">
                              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">Draft Preview</span>
                              <button
                                onClick={() => applyPreviewPlan(m.previewPlanData)}
                                className="bg-[var(--accent)] text-white px-3 py-1 rounded-md text-[10px] font-bold hover:brightness-110 transition-all shadow-sm"
                              >
                                Apply to Canvas
                              </button>
                            </div>
                            <div
                              className="relative"
                              style={
                                wallOnlyPreview
                                  ? {
                                      aspectRatio: `${Math.max(1, m.previewPlanData.width || 600)} / ${Math.max(1, m.previewPlanData.height || 300)}`,
                                      minHeight: 240,
                                    }
                                  : {
                                      aspectRatio: `${Math.max(1, m.previewPlanData.width || 600)} / ${Math.max(1, m.previewPlanData.height || 300)}`,
                                      minHeight: 180
                                    }
                              }
                            >
                            <PlanPreview
                              assets={m.previewPlanData.assets}
                              walls={m.previewPlanData.walls}
                              shapes={m.previewPlanData.shapes}
                              textAnnotations={m.previewPlanData.textAnnotations}
                              width={600}
                              height={300}
                              className="w-full h-full"
                              stretchToContainer={false}
                            />
                            </div>
                          </div>
                            );
                          })()
                        )}

                        {/* Asset Selection Grid */}
                        {m.assetSelection && (
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 w-full max-w-3xl mt-1">
                            {m.assetSelection.options
                              .filter((option: { path: string }) => !option.path || !missingOptionPaths.has(option.path))
                              .map((option: { id: string; name: string; category: string; path: string; width?: number; height?: number }) => (
                              <button
                                key={option.id}
                                onClick={() => {
                                  handleSubmit(`I want to use the ${option.name}`);
                                }}
                                className="flex flex-col items-center p-1.5 rounded-md border border-gray-200 bg-white hover:border-[var(--accent)] hover:bg-blue-50 transition-all text-left"
                              >
                                  <div
                                    className={`w-full rounded mb-2 overflow-hidden flex items-center justify-center border border-gray-100 shadow-sm transition-colors relative ${
                                      option.category === 'Marquee'
                                        ? 'bg-slate-50 group-hover:bg-slate-100'
                                        : 'bg-white group-hover:bg-blue-50'
                                    }`}
                                    style={{
                                      aspectRatio: `${Math.max(1, option.width || 1200)} / ${Math.max(1, option.height || 900)}`,
                                      minHeight: 58
                                    }}
                                  >
                                    {option.category === 'Marquee' ? (
                                      <MarqueeOptionPreview
                                        width={option.width}
                                        height={option.height}
                                      />
                                    ) : (
                                      <PlanPreview
                                        assets={[{
                                        id: `asset-selection-${option.id}`,
                                        type: option.id,
                                        x: Math.max(1, option.width || 1200) / 2,
                                        y: Math.max(1, option.height || 900) / 2,
                                        width: option.width || 1200,
                                        height: option.height || 900,
                                        strokeWidth: Math.max(0.9, AI_DEFAULT_STROKE_WIDTH * 1.5),
                                        strokeColor: '#1a1a1a',
                                        fillColor: 'transparent',
                                        scale: 1,
                                        zIndex: 5
                                      } as any]}
                                      width={Math.max(1, option.width || 1200)}
                                      height={Math.max(1, option.height || 900)}
                                      className="w-full h-full"
                                    />
                                  )}
                                </div>
                                <span className="text-[9px] font-bold text-slate-700 line-clamp-1 w-full">{option.name}</span>
                                <span className="text-[8px] text-slate-400 uppercase tracking-widest w-full font-bold">{option.category}</span>
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
                  {/* Choices for the most recent assistant message */}
                  {(() => {
                    const lastMsg = messages[messages.length - 1];
                    if (lastMsg && lastMsg.role === 'assistant' && lastMsg.choices && lastMsg.choices.length > 0) {
                      return (
                        <div className="flex flex-wrap gap-2 mt-4 ml-2">
                           {lastMsg.choices.map((choice) => (
                             <button
                               key={choice}
                               onClick={() => {
                                 setInputValue(choice);
                                 handleSubmit(choice);
                               }}
                               className="px-3 py-1.5 bg-white border border-blue-200 text-blue-600 rounded-full text-xs font-medium hover:bg-blue-50 hover:border-blue-300 transition-all shadow-sm"
                             >
                               {choice}
                             </button>
                           ))}
                        </div>
                      );
                    }
                    return null;
                  })()}
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
                  placeholder={isLoading ? "AI is thinking..." : "What do you need help with?"}
                  disabled={isLoading}
                  className={`w-full pl-14 pr-16 py-4 rounded-full placeholder:opacity-100 shadow-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[var(--accent)] text-[var(--accent)] bg-white ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !isLoading) {
                      handleSubmit();
                    }
                  }}
                />

                {inputValue ? (
                  <button
                    onClick={() => handleSubmit()}
                    disabled={isLoading}
                    className={`absolute right-2 top-1/2 -translate-y-1/2 bg-[var(--accent)] text-white rounded-full p-2 hover:bg-[var(--accent)] transition ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
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

