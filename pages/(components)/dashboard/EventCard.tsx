"use client";

import { BsStars, BsClock, BsStar, BsStarFill } from "react-icons/bs";
import { useRouter } from "next/router";
import WorkspacePreview from "@/components/WorkspacePreview";
import { useState } from "react";
import { buildPreviewData } from "@/helpers/previewHelpers";
import { apiRequest } from "@/helpers/Config";
import toast from "react-hot-toast";

interface EventCardProps {
    event: any;
    user: any;
    previewData?: { walls: any[]; shapes: any[]; assets: any[] };
    onFavoriteToggle?: () => void; // Optional callback to refresh parent list
}

export default function EventCard({ event, user, previewData, onFavoriteToggle }: EventCardProps) {
    const router = useRouter();

    // Use local state for immediate feedback, initialized from props
    const [isFavorited, setIsFavorited] = useState<boolean>(() => {
        if (!event) return false;
        const favs = event.favorites || event.favourites || [];
        return Array.isArray(favs) && user?._id && favs.includes(user._id);
    });

    const [isLoading, setIsLoading] = useState(false);

    const { walls, shapes, assets } = previewData || (event ? buildPreviewData(event) : { walls: [], shapes: [], assets: [] });

    if (!event) return null;

    const toggleFavorite = async (e: React.MouseEvent) => {
        e.stopPropagation();
        if (!user) {
            toast.error("Please log in to manage favorites");
            return;
        }

        if (isLoading) return;

        const previousState = isFavorited;
        // Optimistic update
        setIsFavorited(!previousState);
        setIsLoading(true);

        try {
            const method = previousState ? "DELETE" : "POST";
            const url = `/projects/${event.projectSlug}/events/${event._id}/favorite`;

            await apiRequest(url, method, null, true);

            // Notify parent if needed (e.g. to remove from list)
            if (onFavoriteToggle) {
                onFavoriteToggle();
            }
        } catch (error) {
            console.error("Failed to toggle favorite:", error);
            // Revert optimistic update
            setIsFavorited(previousState);
            toast.error("Failed to update favorite");
        } finally {
            setIsLoading(false);
        }
    };

    const getTimeAgo = (dateString: string | undefined) => {
        if (!dateString) return "Recently";
        const now = new Date();
        const updated = new Date(dateString);
        if (isNaN(updated.getTime())) return "Recently";
        const diffInMs = now.getTime() - updated.getTime();
        const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));
        if (diffInDays === 0) return "Edited now";
        if (diffInDays === 1) return "Edited yesterday";
        if (diffInDays < 7) return `Edited ${diffInDays} days ago`;
        if (diffInDays < 30) return `Edited ${Math.floor(diffInDays / 7)} weeks ago`;
        return `Edited ${Math.floor(diffInDays / 30)} months ago`;
    };

    return (
        <div className="flex flex-col">
            {/* Card with Preview Only */}
            <div
                onClick={() => {
                    router.push(`/dashboard/editor/${event.projectSlug}/${event._id}`);
                }}
                className="bg-white rounded-lg border border-gray-200 overflow-hidden cursor-pointer hover:border-blue-300 transition-colors group relative"
            >
                {/* Star Icon - Top Right Corner */}
                <button
                    onClick={toggleFavorite}
                    className="absolute top-2 right-2 z-10 p-1.5 rounded-full bg-white/90 backdrop-blur-sm shadow-md hover:bg-white transition-colors"
                    aria-label={isFavorited ? "Remove from favorites" : "Add to favorites"}
                >
                    {isFavorited ? (
                        <BsStarFill className="w-4 h-4 text-yellow-500" />
                    ) : (
                        <BsStar className="w-4 h-4 text-gray-400 hover:text-yellow-500 transition-colors" />
                    )}
                </button>

                {/* Workspace Preview - Wider than tall */}
                <div className="bg-white w-full relative overflow-hidden" style={{ aspectRatio: '2.5/1', height: '160px' }}>
                    {/* Note: In a real refactor, we should pass the fallback data correctly. 
                 For now, we rely on the event data having canvasData. 
                 If it doesn't (and uses `canvasAssets`), the preview might be empty here unlike the main dashboard 
                 which has complex fallback logic.
                 To fix this, we should really move `buildPreviewData` to a shared utility or helper.
                 I will assume for this step that `buildPreviewData` is sufficient or I will COPY the fallback logic.
             */}
                    <WorkspacePreview
                        walls={walls}
                        shapes={shapes}
                        assets={assets}
                        width={400}
                        height={160}
                        backgroundColor="#ffffff"
                    />
                </div>
            </div>

            {/* Event Info - Outside the card, below */}
            <div className="mt-2">
                <h3 className="font-semibold text-sm mb-1 truncate text-gray-800 hover:text-blue-600 transition-colors cursor-pointer" onClick={() => router.push(`/dashboard/editor/${event.projectSlug}/${event._id}`)}>
                    {event.name || "Unnamed Event"}
                </h3>
                <p className="text-xs text-gray-500 flex items-center gap-1.5">
                    <BsClock className="w-3 h-3" />
                    {getTimeAgo(event.updatedAt || event.createdAt)}
                </p>
            </div>
        </div>
    );
}
