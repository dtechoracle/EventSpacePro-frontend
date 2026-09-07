import { BsStars, BsClock, BsStar, BsStarFill, BsThreeDotsVertical, BsPencilSquare, BsTrash, BsFiles } from "react-icons/bs";
import { useRouter } from "next/router";
import WorkspacePreview from "@/components/WorkspacePreview";
import { useState, useRef, useEffect, useMemo, useCallback, memo } from "react";
import { buildPreviewData } from "@/helpers/previewHelpers";
import { apiRequest } from "@/helpers/Config";
import toast from "react-hot-toast";
import RenameEventModal from "@/pages/(components)/projects/RenameEventModal";

function getTimeAgo(dateString: string | undefined): string {
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
}

interface EventCardProps {
    event: any;
    user: any;
    previewData?: { walls: any[]; shapes: any[]; assets: any[]; textAnnotations?: any[] };
    onFavoriteToggle?: () => void;
    onDelete?: () => void;
}

const EventCard = memo(function EventCard({ event, user, previewData, onFavoriteToggle, onDelete }: EventCardProps) {
    const router = useRouter();
    const menuRef = useRef<HTMLDivElement>(null);

    const [isFavorited, setIsFavorited] = useState<boolean>(() => {
        if (!event) return false;
        const favs = event.favorites || event.favourites || [];
        return Array.isArray(favs) && user?._id && favs.includes(user._id);
    });

    const [eventName, setEventName] = useState(event.name || "Unnamed Event");
    const [isLoading, setIsLoading] = useState(false);
    const [showMenu, setShowMenu] = useState(false);
    const [showRenameModal, setShowRenameModal] = useState(false);

    useEffect(() => {
        if (event?.name && event.name !== eventName) setEventName(event.name);
    }, [event?.name]);

    const displayName = useMemo(() => {
        if (eventName === "Personal Drafts") {
            return event?.type
                ? `${event.type} — ${new Date(event.createdAt || event.updatedAt || Date.now()).toLocaleDateString()}`
                : "Untitled Event";
        }
        return eventName;
    }, [eventName, event?.type, event?.createdAt, event?.updatedAt]);

    const { walls, shapes, assets, textAnnotations } = useMemo(
        () => previewData || (event ? buildPreviewData(event) : { walls: [], shapes: [], assets: [], textAnnotations: [] }),
        [previewData, event]
    );

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
                setShowMenu(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const toggleFavorite = useCallback(async (e?: React.MouseEvent) => {
        e?.stopPropagation();
        if (!user) {
            toast.error("Please log in to manage favorites");
            return;
        }
        if (isLoading) return;

        const previousState = isFavorited;
        setIsFavorited(!previousState);
        setIsLoading(true);
        setShowMenu(false);

        try {
            const method = previousState ? "DELETE" : "POST";
            const url = event?.projectSlug === 'standalone'
                ? `/events/${event._id}/favorite`
                : `/projects/${event.projectSlug}/events/${event._id}/favorite`;
            await apiRequest(url, method, null, true);
            if (onFavoriteToggle) onFavoriteToggle();
        } catch (error) {
            console.error("Failed to toggle favorite:", error);
            setIsFavorited(previousState);
            toast.error("Failed to update favorite");
        } finally {
            setIsLoading(false);
        }
    }, [user, isLoading, isFavorited, event, onFavoriteToggle]);

    const handleDelete = useCallback(async (e?: React.MouseEvent) => {
        e?.stopPropagation();
        if (!confirm("Are you sure you want to delete this event? This cannot be undone.")) return;
        setShowMenu(false);
        try {
            const endpoint = event?.projectSlug === 'standalone'
                ? `/events/${event._id}`
                : `/projects/${event.projectSlug}/events/${event._id}`;
            await apiRequest(endpoint, "DELETE", null, true);
            toast.success("Event deleted successfully");
            if (onDelete) {
                onDelete();
            } else {
                window.location.reload();
            }
        } catch (err) {
            console.error("Failed to delete event", err);
            toast.error("Failed to delete event");
        }
    }, [event, onDelete]);

    const handleDuplicate = useCallback(async (e?: React.MouseEvent) => {
        e?.stopPropagation();
        setShowMenu(false);
        setIsLoading(true);
        const loadingToast = toast.loading("Duplicating event...");

        try {
            const getEndpoint = event?.projectSlug === 'standalone'
                ? `/events/${event._id}`
                : `/projects/${event.projectSlug}/events/${event._id}`;
            const fullRes = await apiRequest(getEndpoint, "GET", null, true);
            const eventData = fullRes.data || fullRes;

            const duplicateData = {
                name: `${eventData.name} (Copy)`,
                type: eventData.type,
                canvases: eventData.canvases || [{ size: "layout", width: 10000, height: 10000 }],
                canvasData: eventData.canvasData
            };

            const postEndpoint = event?.projectSlug === 'standalone'
                ? `/events`
                : `/projects/${event.projectSlug}/events`;
            await apiRequest(postEndpoint, "POST", duplicateData, true);

            toast.success(`"${eventData.name}" duplicated!`, { id: loadingToast });

            if (onDelete) {
                onDelete();
            } else {
                window.location.reload();
            }
        } catch (err) {
            console.error("Failed to duplicate event", err);
            toast.error("Failed to duplicate event", { id: loadingToast });
        } finally {
            setIsLoading(false);
        }
    }, [event, onDelete]);

    if (!event) return null;

    const navigateToEvent = () => {
        router.push(`/dashboard/editor/${event.projectSlug}/${event._id}`);
    };

    return (
        <div className="flex flex-col relative">
            <div
                onClick={navigateToEvent}
                className="bg-white rounded-xl border border-gray-200 cursor-pointer hover:border-blue-500 transition-colors group relative shadow-none"
            >
                {isFavorited && (
                    <div className="absolute top-2 left-2 z-10 p-1 rounded-full bg-white/80 backdrop-blur-sm shadow-sm">
                        <BsStarFill className="w-2.5 h-2.5 text-yellow-500" />
                    </div>
                )}

                <div className="absolute top-2 right-2 z-30" ref={menuRef}>
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            setShowMenu(!showMenu);
                        }}
                        className={`p-1.5 rounded-full backdrop-blur-sm shadow-md transition-all ${
                            showMenu ? "bg-[var(--accent)] text-white" : "bg-white/90 text-gray-500 hover:bg-white"
                        }`}
                        aria-label="Event options"
                    >
                        <BsThreeDotsVertical className="w-4 h-4" />
                    </button>

                    {showMenu && (
                        <div className="absolute right-0 mt-2 w-44 bg-white rounded-xl shadow-xl border border-gray-100 overflow-hidden animate-in fade-in zoom-in duration-200 origin-top-right z-50">
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setShowRenameModal(true);
                                    setShowMenu(false);
                                }}
                                className="w-full px-4 py-2.5 text-left text-sm hover:bg-gray-50 flex items-center gap-2.5 text-gray-700 font-medium"
                            >
                                <BsPencilSquare className="w-4 h-4 text-gray-400" />
                                Rename
                            </button>
                            <button
                                onClick={handleDuplicate}
                                className="w-full px-4 py-2.5 text-left text-sm hover:bg-gray-50 flex items-center gap-2.5 text-gray-700 font-medium"
                                disabled={isLoading}
                            >
                                <BsFiles className="w-4 h-4 text-gray-400" />
                                Duplicate
                            </button>
                            <button
                                onClick={toggleFavorite}
                                className="w-full px-4 py-2.5 text-left text-sm hover:bg-gray-50 flex items-center gap-2.5 text-gray-700 font-medium"
                            >
                                {isFavorited ? (
                                    <>
                                        <BsStar className="w-4 h-4 text-gray-400" />
                                        Unstar
                                    </>
                                ) : (
                                    <>
                                        <BsStarFill className="w-4 h-4 text-yellow-500" />
                                        Star
                                    </>
                                )}
                            </button>
                            <div className="border-t border-gray-100 my-1"></div>
                            <button
                                onClick={handleDelete}
                                className="w-full px-4 py-2.5 text-left text-sm hover:bg-red-50 flex items-center gap-2.5 text-red-600 font-medium"
                            >
                                <BsTrash className="w-4 h-4" />
                                Delete
                            </button>
                        </div>
                    )}
                </div>

                <div className="bg-white w-full relative overflow-hidden rounded-xl" style={{ height: '160px' }}>
                    <WorkspacePreview
                        walls={walls}
                        shapes={shapes}
                        assets={assets}
                        textAnnotations={textAnnotations}
                        width={480}
                        height={160}
                        backgroundColor="#ffffff"
                    />
                </div>
            </div>

            <div className="mt-2">
                <h3 className="font-semibold text-sm mb-1 truncate text-gray-800 hover:text-blue-600 transition-colors cursor-pointer" onClick={navigateToEvent}>
                    {displayName}
                </h3>
                <p className="text-xs text-gray-500 flex items-center gap-1.5">
                    <BsClock className="w-3 h-3" />
                    {getTimeAgo(event.updatedAt || event.createdAt)}
                </p>
            </div>

            {showRenameModal && (
                <RenameEventModal
                    event={{...event, name: eventName}}
                    onClose={() => setShowRenameModal(false)}
                    onSuccess={(newName) => setEventName(newName)}
                />
            )}
        </div>
    );
});

export default EventCard;
