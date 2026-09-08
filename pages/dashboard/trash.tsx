"use client";
import React, { useCallback, useState } from "react";
import DashboardSidebar from "@/pages/(components)/DashboardSidebar";
import { BsTrash, BsRecycle, BsClock, BsThreeDotsVertical } from "react-icons/bs";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/helpers/Config";
import toast from "react-hot-toast";
import WorkspacePreview from "@/components/WorkspacePreview";
import ConfirmModal from "@/components/ui/ConfirmModal";

interface TrashedEvent {
  _id: string;
  name: string;
  type?: string;
  canvasData?: {
    walls: any[];
    shapes: any[];
    assets: any[];
    textAnnotations?: any[];
  };
  canvasAssets?: any[];
  createdAt: string;
  updatedAt: string;
  trashedAt: string;
  trashedBy?: string;
}

function getTimeAgo(dateString: string | undefined): string {
  if (!dateString) return "Recently";
  const now = new Date();
  const updated = new Date(dateString);
  if (isNaN(updated.getTime())) return "Recently";
  const diffInMs = now.getTime() - updated.getTime();
  const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));
  if (diffInDays === 0) return "Deleted today";
  if (diffInDays === 1) return "Deleted yesterday";
  if (diffInDays < 7) return `Deleted ${diffInDays} days ago`;
  if (diffInDays < 30) return `Deleted ${Math.floor(diffInDays / 7)} weeks ago`;
  return `Deleted ${Math.floor(diffInDays / 30)} months ago`;
}

function buildPreviewData(event: TrashedEvent) {
  const data = event.canvasData as any || {};
  return {
    walls: data.walls || [],
    shapes: data.shapes || [],
    assets: data.assets || event.canvasAssets || [],
    textAnnotations: data.textAnnotations || [],
  };
}

const Trash = () => {
  const queryClient = useQueryClient();
  const [deleteTarget, setDeleteTarget] = useState<TrashedEvent | null>(null);

  const { data: trashedEvents = [], isLoading } = useQuery<TrashedEvent[]>({
    queryKey: ["trashed-events"],
    queryFn: async () => {
      const res = await apiRequest("/events/trash/list", "GET", null, true);
      return res.data || [];
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  const restoreMutation = useMutation({
    mutationFn: async (eventId: string) => {
      return apiRequest(`/events/${eventId}/restore`, "POST", null, true);
    },
    onSuccess: () => {
      toast.success("Event restored");
      queryClient.invalidateQueries({ queryKey: ["trashed-events"] });
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      queryClient.invalidateQueries({ queryKey: ["standalone-events"] });
    },
    onError: () => {
      toast.error("Failed to restore event");
    },
  });

  const permanentDeleteMutation = useMutation({
    mutationFn: async (eventId: string) => {
      return apiRequest(`/events/${eventId}/permanent`, "DELETE", null, true);
    },
    onSuccess: () => {
      toast.success("Event permanently deleted");
      queryClient.invalidateQueries({ queryKey: ["trashed-events"] });
      setDeleteTarget(null);
    },
    onError: () => {
      toast.error("Failed to delete event");
    },
  });

  const handleRestore = useCallback(
    (e: React.MouseEvent, eventId: string) => {
      e.stopPropagation();
      restoreMutation.mutate(eventId);
    },
    [restoreMutation],
  );

  const handlePermanentDelete = useCallback((e: React.MouseEvent, event: TrashedEvent) => {
    e.stopPropagation();
    setDeleteTarget(event);
  }, []);

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      <DashboardSidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="bg-white border-b border-gray-200 px-8 py-5">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
                Trash
              </h1>
              <p className="text-xs text-gray-500 mt-0.5">
                {trashedEvents.length} item{trashedEvents.length !== 1 ? "s" : ""} in trash
              </p>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-8">
          {isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="animate-pulse">
                  <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                    <div className="bg-gray-100 h-40" />
                    <div className="p-3">
                      <div className="h-4 bg-gray-100 rounded w-2/3 mb-2" />
                      <div className="h-3 bg-gray-100 rounded w-1/3" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : trashedEvents.length === 0 ? (
            <div className="flex flex-col items-center justify-center text-center py-20">
              <div className="text-gray-400 mb-4">
                <BsTrash className="text-6xl mx-auto opacity-20" />
              </div>
              <h3 className="text-xl font-semibold text-gray-700 mb-2">
                Trash is Empty
              </h3>
              <p className="text-gray-500 max-w-sm">
                Items you delete will appear here. You can restore them or
                delete them permanently.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
              {trashedEvents.map((event) => {
                const preview = buildPreviewData(event);
                return (
                  <div key={event._id} className="flex flex-col relative">
                    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden group relative">
                      <div className="absolute top-2 right-2 z-30">
                        <div className="flex gap-1.5">
                          <button
                            onClick={(e) => handleRestore(e, event._id)}
                            disabled={restoreMutation.isPending}
                            className="p-1.5 rounded-full bg-white/90 text-green-600 hover:bg-green-50 shadow-md backdrop-blur-sm transition-all disabled:opacity-50"
                            title="Restore"
                          >
                            <BsRecycle className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={(e) => handlePermanentDelete(e, event)}
                            disabled={permanentDeleteMutation.isPending}
                            className="p-1.5 rounded-full bg-white/90 text-red-500 hover:bg-red-50 shadow-md backdrop-blur-sm transition-all disabled:opacity-50"
                            title="Delete permanently"
                          >
                            <BsTrash className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      <div className="bg-gray-50 w-full relative overflow-hidden" style={{ height: "160px" }}>
                        <div className="absolute inset-0 opacity-40 pointer-events-none">
                          <WorkspacePreview
                            walls={preview.walls}
                            shapes={preview.shapes}
                            assets={preview.assets}
                            textAnnotations={preview.textAnnotations}
                            width={480}
                            height={160}
                            backgroundColor="#f9fafb"
                          />
                        </div>
                        <div className="absolute inset-0 bg-white/30" />
                        <div className="absolute inset-0 flex items-center justify-center">
                          <span className="text-xs font-medium text-gray-400 bg-white/70 px-2 py-0.5 rounded-full backdrop-blur-sm">Trashed</span>
                        </div>
                      </div>
                    </div>

                    <div className="mt-2">
                      <h3 className="font-semibold text-sm mb-1 truncate text-gray-500">
                        {event.name || "Unnamed Event"}
                      </h3>
                      <p className="text-xs text-gray-400 flex items-center gap-1.5">
                        <BsClock className="w-3 h-3" />
                        {getTimeAgo(event.trashedAt)}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <ConfirmModal
        open={!!deleteTarget}
        title="Delete Permanently"
        description={`Are you sure you want to permanently delete "${deleteTarget?.name}"? This action cannot be undone.`}
        confirmLabel="Delete Permanently"
        confirmColor="bg-red-600 hover:bg-red-700"
        onConfirm={() => {
          if (deleteTarget) permanentDeleteMutation.mutate(deleteTarget._id);
        }}
        onCancel={() => setDeleteTarget(null)}
        isLoading={permanentDeleteMutation.isPending}
      />
    </div>
  );
};

export default Trash;
