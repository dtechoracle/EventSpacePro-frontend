"use client";

import AssetsModal from "@/pages/(components)/editor/AssetsModal";
import BottomToolbar from "@/pages/(components)/editor/BottomToolBar";
import PropertiesSidebar from "@/pages/(components)/editor/PropertiesSidebar";
import Workspace2D from "@/components/Workspace2D"; // NEW WORKSPACE
import Scene3D from "@/components/Scene3D";
import DashboardSidebar from "@/pages/(components)/DashboardSidebar";
import AiTrigger from "@/pages/(components)/AiTrigger";
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

// Extended EventData type with canvasData
type EventData = BaseEventData & {
  canvasData?: {
    walls: any[];
    shapes: any[];
    assets: any[];
    layers?: any[];
    canvas?: any;
  };
};

// Lightweight pane listing all elements on the workspace (walls, shapes, assets)
function ElementsPane() {
  const { walls, shapes, assets, textAnnotations, dimensions, labelArrows } = useProjectStore();
  const { setSelectedIds, zoom, setPan } = useEditorStore();

  const items = [
    // Walls: compute a rough center from their nodes
    ...walls.map((w) => {
      if (!w.nodes || w.nodes.length === 0) {
        return { id: w.id, label: "Wall", type: "Wall" as const, x: 0, y: 0 };
      }
      const xs = w.nodes.map((n) => n.x);
      const ys = w.nodes.map((n) => n.y);
      const centerX = (Math.min(...xs) + Math.max(...xs)) / 2;
      const centerY = (Math.min(...ys) + Math.max(...ys)) / 2;
      return { id: w.id, label: "Wall", type: "Wall" as const, x: centerX, y: centerY };
    }),
    // Shapes already have x/y at their center
    ...shapes.map((s) => ({
      id: s.id,
      label: s.type,
      type: "Shape" as const,
      x: s.x,
      y: s.y,
      shape: s,
    })),
    // Assets have x/y at their center
    ...assets.map((a) => ({
      id: a.id,
      label: (a.metadata as any)?.label || a.type || "Asset",
      type: "Asset" as const,
      x: a.x,
      y: a.y,
      asset: a,
    })),
    // Text annotations
    ...textAnnotations.map((t) => ({
      id: t.id,
      label: t.text || "Text",
      type: "Text" as const,
      x: t.x,
      y: t.y,
      text: t,
    })),
    // Dimensions
    ...dimensions.map((d) => ({
      id: d.id,
      label: d.type === "wall" ? "Wall Dimension" : "Dimension",
      type: "Dimension" as const,
      x: (d.startPoint.x + d.endPoint.x) / 2,
      y: (d.startPoint.y + d.endPoint.y) / 2,
      dimension: d,
    })),
    // Label arrows
    ...labelArrows.map((la) => ({
      id: la.id,
      label: la.label || "Label",
      type: "Label" as const,
      x: (la.startPoint.x + la.endPoint.x) / 2,
      y: (la.startPoint.y + la.endPoint.y) / 2,
      labelArrow: la,
    })),
  ];

  const handleSelect = (item: { id: string; x: number; y: number }) => {
    setSelectedIds([item.id]);

    // Pan the workspace so that the selected element is roughly centered
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
    <div className="h-full flex flex-col">
      <div className="px-3 py-2 border-b border-gray-200 text-xs font-semibold text-gray-500 uppercase tracking-wide">
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

          return (
          <button
            key={item.id}
            onClick={() => handleSelect(item)}
            className="w-full flex items-center gap-1 px-1.5 py-1.5 text-[11px] hover:bg-gray-100 border-b border-gray-100"
          >
            {/* Mini preview - approximate but shape-accurate */}
            <div className="w-7 h-7 rounded border border-gray-200 bg-white flex-shrink-0 overflow-hidden flex items-center justify-center">
              {item.type === "Asset" && item.asset && (
                assetDef?.path ? (
                  <img
                    src={assetDef.path}
                    alt={assetDef.label}
                    className="w-full h-full object-contain"
                    style={{ maxWidth: '100%', maxHeight: '100%' }}
                  />
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
                      x={4}
                      y={7}
                      width={16}
                      height={10}
                      fill={item.shape.fill || "transparent"}
                      stroke={item.shape.stroke || "#9CA3AF"}
                      strokeWidth={2}
                      rx={2}
                      ry={2}
                    />
                  )}
                  {item.shape.type === "ellipse" && (
                    <ellipse
                      cx={12}
                      cy={12}
                      rx={8}
                      ry={9}
                      fill={item.shape.fill || "transparent"}
                      stroke={item.shape.stroke || "#9CA3AF"}
                      strokeWidth={2}
                    />
                  )}
                  {item.shape.type === "line" && (
                    <line
                      x1={4}
                      y1={12}
                      x2={20}
                      y2={12}
                      stroke={item.shape.stroke || "#9CA3AF"}
                      strokeWidth={2.5}
                      strokeLinecap="round"
                    />
                  )}
                  {item.shape.type === "polygon" && (
                    <polygon
                      points={(() => {
                        const sides =
                          item.shape.polygonSides ||
                          (item.shape.points ? item.shape.points.length : 4);
                        const s = Math.max(4, Math.min(12, sides || 4));
                        const cx = 12;
                        const cy = 12;
                        const r = 8;
                        const pts: string[] = [];
                        for (let i = 0; i < s; i++) {
                          const angle = ((Math.PI * 2) / s) * i - Math.PI / 2;
                          const x = cx + r * Math.cos(angle);
                          const y = cy + r * Math.sin(angle);
                          pts.push(`${x},${y}`);
                        }
                        return pts.join(" ");
                      })()}
                      fill={item.shape.fill || "transparent"}
                      stroke={item.shape.stroke || "#9CA3AF"}
                      strokeWidth={2}
                      strokeLinejoin="round"
                    />
                  )}
                </svg>
              )}
              {item.type === "Wall" && (
                <svg width={24} height={24} viewBox="0 0 24 24">
                  <line
                    x1={4}
                    y1={12}
                    x2={20}
                    y2={12}
                    stroke="#9CA3AF"
                    strokeWidth={3}
                    strokeLinecap="round"
                  />
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
                  {/* main dimension line */}
                  <line
                    x1={4}
                    y1={12}
                    x2={20}
                    y2={12}
                    stroke="#111827"
                    strokeWidth={1.5}
                    strokeLinecap="round"
                  />
                  {/* arrows */}
                  <polyline
                    points="6,10 4,12 6,14"
                    fill="none"
                    stroke="#111827"
                    strokeWidth={1.2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <polyline
                    points="18,10 20,12 18,14"
                    fill="none"
                    stroke="#111827"
                    strokeWidth={1.2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  {/* text */}
                  <text
                    x={12}
                    y={10}
                    textAnchor="middle"
                    fontSize={7}
                    fill="#111827"
                    fontFamily="system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
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
                    stroke="#111827"
                    strokeWidth={1.5}
                    strokeLinecap="round"
                  />
                  {/* arrow head */}
                  <polyline
                    points="16,14 18,16 16,18"
                    fill="none"
                    stroke="#111827"
                    strokeWidth={1.5}
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
                    stroke="#9CA3AF"
                    strokeWidth={1}
                  />
                  <text
                    x={12}
                    y={10}
                    textAnchor="middle"
                    fontSize={6}
                    fill="#111827"
                    fontFamily="system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
                  >
                    Aa
                  </text>
                </svg>
              )}
            </div>

            {/* Label and type */}
            <div className="flex-1 min-w-0">
              <div className="truncate text-gray-700 leading-tight">{item.label}</div>
              <div className="text-[0.6rem] text-gray-400 mt-0.5">{item.type}</div>
            </div>
          </button>
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
  const { activeTool, zoom, panX, panY, setZoom, setPan } = useEditorStore();
  const { assets: projectAssets, walls, shapes } = useProjectStore();
  const sceneAssets = useSceneStore((s) => s.assets);

  // Old scene store methods (for compatibility)
  const hasUnsavedChanges = useSceneStore((s) => s.hasUnsavedChanges);
  const projectHasUnsavedChanges = useProjectStore((s) => s.hasUnsavedChanges);
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
        }
        
        // PRIORITY 1: Load from canvasData (preferred format from DATABASE)
        if (eventData.canvasData) {
          const { walls = [], shapes = [], assets = [] } = eventData.canvasData;
          
          console.log(`[Editor] Loading canvasData from DATABASE:`, {
            walls: walls.length,
            shapes: shapes.length,
            assets: assets.length,
          });
          
          // Always load from DATABASE when opening an event
          if (isDifferentEvent) {
            walls.forEach((wall: any) => {
              console.log(`[Editor] Adding wall:`, wall.id);
              projectStore.addWall(wall);
            });
            shapes.forEach((shape: any) => {
              console.log(`[Editor] Adding shape:`, shape.id, shape.type);
              projectStore.addShape(shape);
            });
            assets.forEach((asset: any) => {
              console.log(`[Editor] Adding asset:`, asset.id, asset.type);
              projectStore.addAsset(asset);
            });
            
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
          // Handle wall-polygon type (new format)
          if (asset.type === 'wall-polygon' && asset.wallPolygon && Array.isArray(asset.wallPolygon)) {
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
                thickness: asset.wallThickness || 75,
              });
            }

            if (wallNodes.length > 0 && wallEdges.length > 0) {
              const existingWall = projectStore.walls.find(w => w.id === asset.id);
              if (!existingWall) {
                projectStore.addWall({
                  id: asset.id,
                  nodes: wallNodes,
                  edges: wallEdges,
                  zIndex: asset.zIndex || 0
                });
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
              thickness: asset.wallThickness || 75
            }));
            
            if (wallNodes.length > 0 && wallEdges.length > 0) {
              const existingWall = projectStore.walls.find(w => w.id === asset.id);
              if (!existingWall) {
                projectStore.addWall({
                  id: asset.id,
                  nodes: wallNodes,
                  edges: wallEdges,
                  zIndex: asset.zIndex || 0
                });
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
                strokeWidth: asset.strokeWidth || 2,
                points: [
                  { x: startX - (startX + endX) / 2, y: startY - (startY + endY) / 2 },
                  { x: endX - (startX + endX) / 2, y: endY - (startY + endY) / 2 },
                ],
                zIndex: asset.zIndex || 0
              });
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
                id: asset.id,
                type: asset.type as 'rectangle' | 'ellipse' | 'line' | 'arrow' | 'freehand',
                x: asset.x || 0,
                y: asset.y || 0,
                width: defaultWidth,
                height: defaultHeight,
                rotation: asset.rotation || 0,
                fill: asset.fillColor || asset.backgroundColor || "#3B82F6",
                stroke: asset.strokeColor || "#1E40AF",
                strokeWidth: asset.strokeWidth || 2,
                points: asset.points,
                zIndex: asset.zIndex || 0
              });
              
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
                id: asset.id,
                type: asset.type,
                x: asset.x || 0,
                y: asset.y || 0,
                width: defaultWidth,
                height: defaultHeight,
                rotation: asset.rotation || 0,
                scale: asset.scale || 1,
                zIndex: asset.zIndex || 0,
              });
              
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
        }
      } else {
        console.log(`[Editor] Skipping load - same event and we have current data`);
      }
    }
  }, [eventData, currentEventData, id]);

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
    
    const projectStore = useProjectStore.getState();
    const hasChanges = projectStore.hasUnsavedChanges;
    
    if (!hasChanges) return;

    console.log('[Editor] Auto-save triggered - saving to DATABASE');

    const timeoutId = setTimeout(() => {
      const currentHasChanges = useProjectStore.getState().hasUnsavedChanges;
      
      if (currentHasChanges && id && typeof id === 'string' && slug && typeof slug === 'string') {
        const store = useProjectStore.getState();
        const { walls, shapes, assets } = store;
        
        console.log('[Editor] Auto-save: Saving to DATABASE:', {
          eventId: id,
          walls: walls.length,
          shapes: shapes.length,
          assets: assets.length,
        });
        
        // Mark that we're saving to prevent reload
        justSavedRef.current = true;
        
        // Save to database automatically
        store.saveEvent(id, slug)
          .then(() => {
            console.log('[Editor] ✅ Auto-saved to DATABASE successfully');
            setTimeout(() => {
              justSavedRef.current = false;
            }, 2000);
          })
          .catch((error) => {
            console.error('[Editor] ❌ Auto-save failed:', error);
            justSavedRef.current = false;
          });
      }
    }, 2000); // Auto-save after 2 seconds

    return () => clearTimeout(timeoutId);
  }, [hasUnsavedChanges, currentEventData, id, slug]);

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
