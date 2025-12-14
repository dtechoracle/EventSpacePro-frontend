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
import { useMultiplayer } from "@/hooks/useMultiplayer";
import { CursorOverlay } from "@/components/ui/CursorOverlay";
import { useAutoSave } from "@/hooks/useAutoSave";
import SyncStatusBanner from "@/components/SyncStatusBanner";
import toast from "react-hot-toast";
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
  const { slug, id, preview, venueLayout } = router.query;

  // Detect if we're in an iframe or preview mode
  useEffect(() => {
    setIsInIframe(window.self !== window.top || preview === 'true');
  }, [preview]);

  // New stores
  const { activeTool, zoom, panX, panY, setZoom, setPan } = useEditorStore();
  const { assets: projectAssets, walls, shapes, addWall, addShape } = useProjectStore();
  const sceneAssets = useSceneStore((s) => s.assets);

  // Multiplayer cursors
  const { remoteCursors, updateCursor } = useMultiplayer(id as string | undefined, true);

  // Auto-save with offline detection (saves every 30 seconds)
  useAutoSave({ interval: 30000, enabled: !isInIframe });

  //  Handle AI-analyzed venue layout
  useEffect(() => {
    if (!venueLayout || typeof venueLayout !== 'string') return;

    try {
      const layout = JSON.parse(venueLayout);
      console.log('Auto-populating venue layout:', layout);

      // Set canvas dimensions if provided
      if (layout.dimensions) {
        useProjectStore.setState({
          canvas: {
            width: layout.dimensions.width,
            height: layout.dimensions.height,
          }
        });
      }

      // Add walls
      if (layout.walls && Array.isArray(layout.walls)) {
        layout.walls.forEach((wallData: any) => {
          const wallId = `wall-${Date.now()}-${Math.random()}`;
          addWall({
            id: wallId,
            nodes: [
              { id: `${wallId}-node-0`, x: wallData.start.x, y: wallData.start.y },
              { id: `${wallId}-node-1`, x: wallData.end.x, y: wallData.end.y },
            ],
            edges: [
              {
                id: `${wallId}-edge-0`,
                nodeA: `${wallId}-node-0`,
                nodeB: `${wallId}-node-1`,
                thickness: wallData.thickness || 150,
              },
            ],
            layerId: 'default',
          });
        });
      }

      // Add furniture as shapes
      if (layout.furniture && Array.isArray(layout.furniture)) {
        layout.furniture.forEach((item: any) => {
          addShape({
            id: `shape-${Date.now()}-${Math.random()}`,
            type: item.type === 'circle' ? 'ellipse' : 'rectangle',
            x: item.x,
            y: item.y,
            width: item.width,
            height: item.height,
            rotation: item.rotation || 0,
            fillColor: '#E5E7EB',
            strokeColor: '#6B7280',
            strokeWidth: 2,
            layerId: 'default',
            zIndex: 1,
          });
        });
      }

      // Clear venueLayout from URL to prevent re-applying on refresh
      router.replace(`/dashboard/editor/${slug}/${id}`, undefined, { shallow: true });

      toast.success('Venue layout created from AI analysis!');
    } catch (error) {
      console.error('Failed to parse venue layout:', error);
      toast.error('Failed to load venue layout');
    }
  }, [venueLayout, addWall, addShape, router, slug, id]);

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

      // Load event data into projectStore using the new action
      if (id && typeof id === 'string' && slug && typeof slug === 'string') {
        // IMPORTANT: Clear workspace first to prevent localStorage pollution
        // This ensures new events start clean even if persist middleware hydrated old data
        useProjectStore.getState().clearWorkspace?.();

        useProjectStore.getState().loadEvent(id, slug);
      }

      // Also keep sceneStore in sync for now if needed, or rely on projectStore
      if (eventData.canvasAssets) {
        useSceneStore.setState({ assets: eventData.canvasAssets });
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

  // Auto-save functionality
  useEffect(() => {
    if (!currentEventData || !id || typeof id !== 'string' || !slug || typeof slug !== "string") return;

    const timeoutId = setTimeout(() => {
      const projectStore = useProjectStore.getState();
      // Check if projectStore has changes (we might need a dirty flag in projectStore)
      // For now, let's rely on the manual save or add a dirty flag check if available
      // Or we can check useSceneStore.hasUnsavedChanges as a proxy if they are synced

      if (projectStore.hasUnsavedChanges) {
        projectStore.saveEvent(id, slug);
      }
    }, 3000);

    return () => clearTimeout(timeoutId);
  }, [currentEventData, id, slug]);

  // Manual save function
  const handleSave = useCallback(async () => {
    if (!currentEventData || !id || typeof id !== 'string' || !slug || typeof slug !== 'string') {
      return;
    }

    await useProjectStore.getState().saveEvent(id, slug);

    // Update local state to reflect save
    markAsSaved();
  }, [currentEventData, id, markAsSaved, slug]);

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
                <SyncStatusBanner />
                <Workspace2D
                  remoteCursors={remoteCursors}
                  updateCursor={updateCursor}
                />
                <CursorOverlay cursors={remoteCursors} />
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
