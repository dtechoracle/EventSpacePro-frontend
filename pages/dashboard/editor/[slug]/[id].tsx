"use client";

import AssetsModal from "@/pages/(components)/editor/AssetsModal";
import BottomToolbar from "@/pages/(components)/editor/BottomToolBar";
import PropertiesSidebar from "@/pages/(components)/editor/PropertiesSidebar";
import Workspace2D from "@/components/Workspace2D"; // NEW WORKSPACE
import Scene3D from "@/components/Scene3D";
import MainLayout from "@/pages/layouts/MainLayout";
import { useState, useEffect, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useRouter } from "next/router";
import { apiRequest } from "@/helpers/Config";
import { useEditorStore } from "@/store/editorStore";
import { useProjectStore } from "@/store/projectStore";
import {
  useSceneStore,
  EventData,
  AssetInstance,
  CanvasData,
} from "@/store/sceneStore";

// Type for the payload we send to the API
type UpdateEventPayload = {
  name: string;
  type?: string;
  canvases: CanvasData[];
  canvasAssets: AssetInstance[];
};

export default function Editor() {
  const [showAssetsModal, setShowAssetsModal] = useState(false);
  const [show3D, setShow3D] = useState(false);
  const [isInIframe, setIsInIframe] = useState(false);
  const router = useRouter();
  const { slug, id, preview } = router.query;

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
  } = useQuery<EventData>({
    queryKey: ["event", slug, id],
    queryFn: () =>
      apiRequest(`/projects/${slug}/events/${id}`, "GET", null, true),
    enabled: !!(slug && id),
  });

  // Mutation to save canvas assets
  const saveCanvasAssets = useMutation({
    mutationFn: async (
      payload: UpdateEventPayload | { canvasAssets: AssetInstance[] }
    ) => {
      return apiRequest(`/projects/${slug}/events/${id}`, "PUT", payload, true);
    },
    onSuccess: (savedData) => {
      markAsSaved();
      setCurrentEventData(savedData);
    },
    onError: (error) => {
      console.error("Failed to save canvas assets:", error);
    },
  });

  // Set current event data when loaded and sync to stores
  useEffect(() => {
    if (eventData && eventData !== currentEventData) {
      setCurrentEventData(eventData);
      
      // Load event data into stores for Workspace2D
      if (eventData.canvasAssets && Array.isArray(eventData.canvasAssets) && eventData.canvasAssets.length > 0) {
        // Load into sceneStore (new editor) - use the store's set method
        useSceneStore.setState({ assets: eventData.canvasAssets });
        
        // Also load into projectStore for Workspace2D compatibility
        // Convert canvasAssets to projectStore format
        const projectStore = useProjectStore.getState();
        
        // Clear existing data first
        projectStore.reset();
        
        // Convert and add assets
        eventData.canvasAssets.forEach((asset: AssetInstance) => {
          // Check if it's a wall
          if (asset.type === 'wall-segments' && asset.wallNodes && asset.wallEdges) {
            // Convert to Wall format
            const wallNodes = asset.wallNodes.map((node, idx) => ({
              id: `node-${asset.id}-${idx}`,
              x: node.x,
              y: node.y
            }));
            
            const wallEdges = asset.wallEdges.map((edge, idx) => ({
              id: `edge-${asset.id}-${idx}`,
              nodeA: wallNodes[edge.a]?.id || '',
              nodeB: wallNodes[edge.b]?.id || '',
              thickness: asset.wallThickness || 75
            }));
            
            if (wallNodes.length > 0 && wallEdges.length > 0) {
              projectStore.addWall({
                id: asset.id,
                nodes: wallNodes,
                edges: wallEdges,
                zIndex: asset.zIndex || 0
              });
            }
          } else if (asset.type && ['rectangle', 'ellipse', 'line', 'arrow', 'freehand'].includes(asset.type)) {
            // Convert to Shape format
            projectStore.addShape({
              id: asset.id,
              type: asset.type as 'rectangle' | 'ellipse' | 'line' | 'arrow' | 'freehand',
              x: asset.x,
              y: asset.y,
              width: asset.width || 50,
              height: asset.height || 50,
              rotation: asset.rotation || 0,
              fill: asset.fillColor,
              stroke: asset.strokeColor,
              strokeWidth: asset.strokeWidth,
              zIndex: asset.zIndex || 0
            });
          } else if (asset.type) {
            // Convert to Asset format
            projectStore.addAsset({
              id: asset.id,
              type: asset.type,
              x: asset.x,
              y: asset.y,
              width: asset.width || 50,
              height: asset.height || 50,
              rotation: asset.rotation || 0,
              scale: asset.scale || 1,
              zIndex: asset.zIndex || 0,
            });
          }
        });
      }
    }
  }, [eventData, currentEventData]);

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

  // Auto-save functionality
  useEffect(() => {
    if (!currentEventData || !hasUnsavedChanges) return;

    const timeoutId = setTimeout(() => {
      const currentHasChanges = useSceneStore.getState().hasUnsavedChanges;

      if (currentHasChanges) {
        const updatedAssets = useSceneStore.getState().assets;
        const payload = {
          canvasAssets: updatedAssets,
        };
        saveCanvasAssets.mutate(payload);
      }
    }, 3000);

    return () => clearTimeout(timeoutId);
  }, [hasUnsavedChanges, currentEventData, saveCanvasAssets]);

  // Manual save function
  const handleSave = useCallback(() => {
    if (!hasUnsavedChanges || !currentEventData) {
      return;
    }

    const updatedAssets = syncToEventData();
    const payload = {
      name: currentEventData.name,
      type: currentEventData.type || "workshop",
      canvases: currentEventData.canvases,
      canvasAssets: updatedAssets,
    };
    saveCanvasAssets.mutate(payload);
  }, [hasUnsavedChanges, currentEventData, syncToEventData, saveCanvasAssets]);

  // Keyboard shortcut for saving (Ctrl+S)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        handleSave();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleSave]);

  // Render content based on iframe/preview status
  const renderContent = () => {
    const isPreviewMode = preview === 'true' || isInIframe;
    
    return (
    <div className={`${isPreviewMode ? 'h-full w-full' : 'h-screen'} flex flex-col overflow-hidden`}>
      {!isPreviewMode && (
        <>
          <AssetsModal
            isOpen={showAssetsModal}
            onClose={() => setShowAssetsModal(false)}
          />
          <BottomToolbar setShowAssetsModal={setShowAssetsModal} />
        </>
      )}

      {/* Main Content Area */}
      <div className={`flex-1 flex overflow-hidden ${isPreviewMode ? '' : ''}`}>
        {/* NEW WORKSPACE */}
        <div className="flex-1 relative overflow-hidden">
          {!show3D && (
            <div className="absolute inset-0">
              <Workspace2D />
            </div>
          )}

          {/* 3D Preview - disabled in preview mode */}
          {show3D && !isPreviewMode && (
            <div className="absolute inset-0">
              <Scene3D
                assets={eventData?.canvasAssets || []}
                width={isPreviewMode ? window.innerWidth : window.innerWidth - 256}
                height={isPreviewMode ? window.innerHeight : window.innerHeight - 120}
              />
            </div>
          )}

          {/* View Toggle - only show if not in preview mode */}
          {!isPreviewMode && (
            <div className="absolute bottom-4 right-4 z-10">
              <button
                onClick={() => setShow3D(!show3D)}
                className="px-4 py-2 bg-white border border-gray-300 rounded-lg shadow-lg hover:bg-gray-50 transition-colors font-medium"
              >
                {show3D ? '📐 2D View' : '🎨 3D Preview'}
              </button>
            </div>
          )}
        </div>

        {/* Properties Sidebar - only show if not in preview mode */}
        {!isPreviewMode && (
          <div className="flex-shrink-0 w-64 bg-white border-l border-gray-200">
            <PropertiesSidebar />
          </div>
        )}
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
      <MainLayout>
        <div className="h-screen flex items-center justify-center">
          <div className="text-lg">Loading event data...</div>
        </div>
      </MainLayout>
    );
  }

  if (error) {
    return isPreviewMode ? (
      <div className="h-full w-full flex items-center justify-center">
        <div className="text-lg text-red-600">
          Error loading event: {error.message}
        </div>
      </div>
    ) : (
      <MainLayout>
        <div className="h-screen flex items-center justify-center">
          <div className="text-lg text-red-600">
            Error loading event: {error.message}
          </div>
        </div>
      </MainLayout>
    );
  }

  if (!eventData) {
    return isPreviewMode ? (
      <div className="h-full w-full flex items-center justify-center">
        <div className="text-lg">No event data found</div>
      </div>
    ) : (
      <MainLayout>
        <div className="h-screen flex items-center justify-center">
          <div className="text-lg">No event data found</div>
        </div>
      </MainLayout>
    );
  }

  return isPreviewMode ? (
    renderContent()
  ) : (
    <MainLayout>
      {renderContent()}
    </MainLayout>
  );
}
