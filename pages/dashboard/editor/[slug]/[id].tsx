"use client";

import AssetsModal from "@/pages/(components)/editor/AssetsModal";
import BottomToolbar from "@/pages/(components)/editor/BottomToolBar";
import PropertiesSidebar from "@/pages/(components)/editor/PropertiesSidebar";
import Toolbar from "@/pages/(components)/editor/ToolBar";
import MainLayout from "@/pages/layouts/MainLayout";
import { useState, useEffect, useCallback } from "react";
import Canvas from "@/pages/(components)/editor/Canvas";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useRouter } from "next/router";
import { apiRequest } from "@/helpers/Config";
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
  const router = useRouter();
  const { slug, id } = router.query;

  // Scene store methods
  // const reset = useSceneStore((s) => s.reset);
  const hasUnsavedChanges = useSceneStore((s) => s.hasUnsavedChanges);
  const syncToEventData = useSceneStore((s) => s.syncToEventData);
  const markAsSaved = useSceneStore((s) => s.markAsSaved);
  // const queryClient = useQueryClient();

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
    enabled: !!(slug && id), // Only run query when both slug and id are available
  });

  // Mutation to save canvas assets
  const saveCanvasAssets = useMutation({
    mutationFn: async (
      payload: UpdateEventPayload | { canvasAssets: AssetInstance[] }
    ) => {
      return apiRequest(`/projects/${slug}/events/${id}`, "PUT", payload, true);
    },
    onSuccess: (savedData) => {
      // Mark as saved and update local event data
      markAsSaved();
      setCurrentEventData(savedData);
      // Don't invalidate queries - we already have the updated data
    },
    onError: (error) => {
      console.error("Failed to save canvas assets:", error);
    },
  });

  // Set current event data when loaded
  useEffect(() => {
    if (eventData && eventData !== currentEventData) {
      setCurrentEventData(eventData);
    }
  }, [eventData, currentEventData]);

  // Auto-save functionality - only saves when there are actual unsaved changes
  useEffect(() => {
    if (!currentEventData || !hasUnsavedChanges) return;

    const timeoutId = setTimeout(() => {
      // Double-check if there are still unsaved changes before making the request
      const currentHasChanges = useSceneStore.getState().hasUnsavedChanges;

      if (currentHasChanges) {
        const updatedAssets = useSceneStore.getState().assets;
        // Only send canvasAssets for auto-save since that's what we're primarily updating
        const payload = {
          canvasAssets: updatedAssets,
        };
        saveCanvasAssets.mutate(payload);
      }
    }, 3000); // Save 3 seconds after user stops making changes

    return () => clearTimeout(timeoutId);
  }, [hasUnsavedChanges, currentEventData, saveCanvasAssets]);

  // Manual save function
  const handleSave = useCallback(() => {
    if (!hasUnsavedChanges || !currentEventData) {
      return;
    }

    const updatedAssets = syncToEventData();
    // Send only the fields that can be updated: name, type, canvases, canvasAssets
    const payload = {
      name: currentEventData.name,
      type: currentEventData.type || "workshop", // Add default type if not present
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

  if (isLoading) {
    return (
      <MainLayout>
        <div className="h-screen flex items-center justify-center">
          <div className="text-lg">Loading event data...</div>
        </div>
      </MainLayout>
    );
  }

  if (error) {
    return (
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
    return (
      <MainLayout>
        <div className="h-screen flex items-center justify-center">
          <div className="text-lg">No event data found</div>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="h-screen flex overflow-hidden">
        <AssetsModal
          isOpen={showAssetsModal}
          onClose={() => setShowAssetsModal(false)}
        />
        <BottomToolbar setShowAssetsModal={setShowAssetsModal} />

        {/* Fixed Toolbar */}
        <div className="flex-shrink-0 w-fit bg-white">
          <Toolbar onSave={handleSave} hasUnsavedChanges={hasUnsavedChanges} />
        </div>

        {/* Main Content Area */}
        <div className="flex-1 overflow-hidden bg-gray-50">
          <Canvas
            canvas={eventData?.canvases?.[0] ? {
              size: eventData.canvases[0].size,
              width: eventData.canvases[0].width,
              height: eventData.canvases[0].height,
            } : undefined}
            assets={eventData?.canvasAssets || []}
          />
        </div>

        <div className="flex-shrink-0 w-64 bg-white">
          <PropertiesSidebar />
        </div>
      </div>
    </MainLayout>
  );
}
