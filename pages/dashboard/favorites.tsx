"use client";

import { BsStars, BsCalendar, BsSearch } from "react-icons/bs";
import { useUserStore } from "@/store/userStore";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/helpers/Config";
import { useRouter } from "next/router";
import DashboardSidebar from "@/pages/(components)/DashboardSidebar";
import CreateEventModal from "@/pages/(components)/projects/CreateEventModal";
import EventCard from "@/pages/(components)/dashboard/EventCard";
import { buildPreviewData } from "@/helpers/previewHelpers";

interface EventData {
    _id: string;
    name: string;
    canvasData?: {
        walls: any[];
        shapes: any[];
        assets: any[];
        layers?: any[];
        canvas?: any;
    };
    canvasAssets?: any[];
    projectId: string;
    projectName?: string;
    projectSlug?: string;
    createdAt: string;
    updatedAt: string;
    favourites?: string[]; // Array of user IDs
    favorites?: string[]; // Support US spelling
}

interface ProjectData {
    _id: string;
    name: string;
    slug: string;
    events: EventData[];
    createdAt: string;
    updatedAt: string;
}

interface ApiResponse {
    data: ProjectData[];
}

const Favorites = () => {
    const { user, fetchUser } = useUserStore();
    const router = useRouter();
    const [searchQuery, setSearchQuery] = useState("");
    const [showCreateEventModal, setShowCreateEventModal] = useState(false);
    const queryClient = useQueryClient();

    useEffect(() => {
        fetchUser();
        const interval = setInterval(() => {
            fetchUser();
        }, 30000);
        return () => clearInterval(interval);
    }, [fetchUser]);

    const { data, isLoading, refetch: refetchProjects } = useQuery<ApiResponse>({
        queryKey: ["projects"],
        queryFn: () => apiRequest("/projects", "GET", null, true),
        staleTime: 0,
        gcTime: 0,
    });

    const { data: allProjectEvents, isLoading: isLoadingEvents, refetch: refetchEvents } = useQuery({
        queryKey: ["all-events", data?.data?.map(p => p.slug)],
        queryFn: async () => {
            if (!data?.data) return [];
            const eventPromises = data.data.map(async (project) => {
                try {
                    const res = await apiRequest(`/projects/${project.slug}/events`, "GET", null, true);
                    const events = res.data || [];
                    const fullEventPromises = events.map(async (event: any) => {
                        try {
                            const fullEventRes = await apiRequest(`/projects/${project.slug}/events/${event._id}`, "GET", null, true);
                            return fullEventRes.data || fullEventRes;
                        } catch (error) {
                            return { ...event, canvasData: null, canvasAssets: [] };
                        }
                    });
                    const fullEvents = await Promise.all(fullEventPromises);
                    return {
                        projectSlug: project.slug,
                        projectName: project.name,
                        projectId: project._id,
                        events: fullEvents
                    };
                } catch (error) {
                    return {
                        projectSlug: project.slug,
                        projectName: project.name,
                        projectId: project._id,
                        events: []
                    };
                }
            });
            return Promise.all(eventPromises);
        },
        enabled: !!data?.data && data.data.length > 0,
        staleTime: 0,
        gcTime: 0,
        refetchOnMount: true,
    });

    const allEvents = useMemo(() => {
        if (!allProjectEvents || allProjectEvents.length === 0) return [];
        const events: EventData[] = [];
        allProjectEvents.forEach(projectData => {
            if (projectData.events && Array.isArray(projectData.events)) {
                projectData.events.forEach(event => {
                    events.push({
                        ...event,
                        projectId: projectData.projectId,
                        projectName: projectData.projectName,
                        projectSlug: projectData.projectSlug,
                    });
                });
            }
        });
        return events.sort((a, b) => {
            const dateA = new Date(a.updatedAt || a.createdAt).getTime();
            const dateB = new Date(b.updatedAt || b.createdAt).getTime();
            return dateB - dateA;
        });
    }, [allProjectEvents]);

    // Filter for FAVORITES only
    const favorites = useMemo(() => {
        let filtered = allEvents;

        // 1. Filter by User ID in favorites array (check both spellings)
        if (user?._id) {
            filtered = filtered.filter(event => {
                const favs = event.favorites || event.favourites || [];
                return favs.includes(user._id);
            });
        } else {
            return []; // No favorites if not logged in
        }

        // 2. Filter by Search
        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            filtered = filtered.filter(event =>
                event.name?.toLowerCase().includes(query) ||
                event.projectName?.toLowerCase().includes(query)
            );
        }
        return filtered;
    }, [allEvents, searchQuery, user]);

    const handleFavoriteToggle = () => {
        // Refresh list when item is unfavorited
        refetchEvents();
    };

    return (
        <div className="flex h-screen bg-gray-50 overflow-hidden">
            <DashboardSidebar />
            <div className="flex-1 flex flex-col overflow-hidden">
                {/* Header */}
                <div className="bg-white/60 backdrop-blur-sm border-b border-gray-300/50 px-8 py-5 shadow-sm">
                    <div className="flex items-center justify-between">
                        <div>
                            <h1 className="text-3xl font-bold text-[var(--accent)]">
                                My Favorites
                            </h1>
                            <p className="text-sm text-gray-500 mt-1">Your starred event spaces</p>
                        </div>
                        <div className="flex items-center gap-3">
                            <div className="relative">
                                <BsSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                                <input
                                    type="text"
                                    placeholder="Search favorites..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="pl-10 pr-4 py-2.5 text-sm border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent w-64 bg-white/80"
                                />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-8">
                    {showCreateEventModal && (
                        <CreateEventModal onClose={() => setShowCreateEventModal(false)} />
                    )}

                    <div className="mb-10">
                        <div className="flex items-center justify-between mb-6">
                            <span className="text-sm text-gray-500">{favorites.length} {favorites.length === 1 ? 'favorite' : 'favorites'}</span>
                        </div>
                        {(isLoading || isLoadingEvents) ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                                {[1, 2, 3, 4].map((i) => (
                                    <div key={i} className="bg-gray-100 rounded-lg h-48 animate-pulse" />
                                ))}
                            </div>
                        ) : favorites.length === 0 ? (
                            <div className="bg-gray-50 rounded-lg p-12 text-center">
                                <BsStars className="text-4xl text-gray-400 mx-auto mb-4" />
                                <p className="text-gray-500 mb-4">No favorites yet</p>
                                <button
                                    onClick={() => router.push('/dashboard')}
                                    className="text-[var(--accent)] hover:underline"
                                >
                                    Browse events to add some
                                </button>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                                {favorites.map((event) => {
                                    const previewData = buildPreviewData(event);
                                    return (
                                        <EventCard
                                            key={event._id}
                                            event={event}
                                            user={user}
                                            previewData={previewData}
                                            onFavoriteToggle={handleFavoriteToggle}
                                        />
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Favorites;
