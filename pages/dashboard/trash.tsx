"use client";
import React, { useCallback, useState } from "react";
import DashboardSidebar from "@/pages/(components)/DashboardSidebar";
import { BsTrash, BsRecycle, BsExclamationTriangle } from "react-icons/bs";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/helpers/Config";
import toast from "react-hot-toast";

interface TrashedEvent {
  _id: string;
  name: string;
  type?: string;
  createdAt: string;
  updatedAt: string;
  trashedAt: string;
  trashedBy?: string;
}

function getTimeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const days = Math.floor(diff / 86400000);
  if (days > 30) return `${Math.floor(days / 30)}mo ago`;
  if (days > 0) return `${days}d ago`;
  const hours = Math.floor(diff / 3600000);
  if (hours > 0) return `${hours}h ago`;
  const mins = Math.floor(diff / 60000);
  return mins > 0 ? `${mins}m ago` : "Just now";
}

const Trash = () => {
  const queryClient = useQueryClient();
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

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
      setConfirmDeleteId(null);
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

  const handlePermanentDelete = useCallback(
    (e: React.MouseEvent, eventId: string) => {
      e.stopPropagation();
      if (confirmDeleteId === eventId) {
        permanentDeleteMutation.mutate(eventId);
      } else {
        setConfirmDeleteId(eventId);
      }
    },
    [confirmDeleteId, permanentDeleteMutation],
  );

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
            <div className="flex flex-col items-center justify-center text-center py-20">
              <div className="w-6 h-6 border-2 border-gray-300 border-t-blue-600 rounded-full animate-spin mb-4" />
              <p className="text-gray-500 text-sm">Loading trash...</p>
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
            <div className="max-w-4xl">
              <div className="space-y-2">
                {trashedEvents.map((event) => (
                  <div
                    key={event._id}
                    className="bg-white border border-gray-200 rounded-lg px-5 py-4 flex items-center justify-between hover:border-gray-300 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900 truncate">
                        {event.name}
                      </p>
                      <div className="flex items-center gap-3 mt-1">
                        <p className="text-xs text-gray-400">
                          Deleted {event.trashedAt ? getTimeAgo(event.trashedAt) : "recently"}
                        </p>
                        {event.type && (
                          <span className="text-xs text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">
                            {event.type}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 ml-4">
                      <button
                        onClick={(e) => handleRestore(e, event._id)}
                        disabled={restoreMutation.isPending}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-green-700 bg-green-50 border border-green-200 rounded-lg hover:bg-green-100 transition-colors disabled:opacity-50"
                      >
                        <BsRecycle className="w-3 h-3" />
                        Restore
                      </button>
                      <button
                        onClick={(e) => handlePermanentDelete(e, event._id)}
                        disabled={permanentDeleteMutation.isPending}
                        className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors disabled:opacity-50 ${
                          confirmDeleteId === event._id
                            ? "text-white bg-red-600 hover:bg-red-700 border border-red-600"
                            : "text-red-700 bg-red-50 border border-red-200 hover:bg-red-100"
                        }`}
                      >
                        <BsExclamationTriangle className="w-3 h-3" />
                        {confirmDeleteId === event._id
                          ? "Confirm Delete"
                          : "Delete"}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Trash;
