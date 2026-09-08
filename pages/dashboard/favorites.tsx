"use client";

import { BsStars, BsSearch } from "react-icons/bs";
import { useUserStore } from "@/store/userStore";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/helpers/Config";
import { useRouter } from "next/router";
import DashboardSidebar from "@/pages/(components)/DashboardSidebar";
import CreateEventModal from "@/pages/(components)/projects/CreateEventModal";
import EventCard from "@/components/dashboard/EventCard";
import { buildPreviewData } from "@/helpers/previewHelpers";
import { withPreviewableCanvasAssets } from "@/lib/canvasAssets";

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
    favourites?: string[];
    favorites?: string[];
}

interface BatchResponse {
    data: {
        projects: Array<{
            _id: string;
            name: string;
            slug: string;
            events: EventData[];
        }>;
        standaloneEvents: EventData[];
    };
}

const Favorites = () => {
    const { user } = useUserStore();
    const router = useRouter();
    const [searchQuery, setSearchQuery] = useState("");
    const [showCreateEventModal, setShowCreateEventModal] = useState(false);

    const { data: batchData, isLoading } = useQuery<BatchResponse>({
        queryKey: ["batch-all-events"],
        queryFn: async () => {
            return apiRequest("/events/batch/all", "GET", null, true);
        },
        staleTime: 5 * 60 * 1000,
        gcTime: 10 * 60 * 1000,
        refetchOnMount: false,
    });

    const allEvents = useMemo(() => {
        if (!batchData?.data) return [];
        const events: EventData[] = [];
        batchData.data.projects.forEach(project => {
            (project.events || []).forEach(event => {
                events.push({
                    ...event,
                    projectId: project._id,
                    projectName: project.name,
                    projectSlug: project.slug,
                });
            });
        });
        (batchData.data.standaloneEvents || []).forEach(event => {
            events.push({
                ...event,
                projectId: '',
                projectName: 'Standalone',
                projectSlug: 'standalone',
            });
        });
        return events.sort((a, b) => {
            const dateA = new Date(a.updatedAt || a.createdAt).getTime();
            const dateB = new Date(b.updatedAt || b.createdAt).getTime();
            return dateB - dateA;
        });
    }, [batchData]);

    const favorites = useMemo(() => {
        let filtered = allEvents;

        if (user?._id) {
            filtered = filtered.filter(event => {
                const favs = event.favorites || event.favourites || [];
                return favs.includes(user._id);
            });
        } else {
            return [];
        }

        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            filtered = filtered.filter(event =>
                event.name?.toLowerCase().includes(query) ||
                event.projectName?.toLowerCase().includes(query)
            );
        }
        return filtered;
    }, [allEvents, searchQuery, user]);

    const handleFavoriteToggle = () => {};

    return (
        <div className="flex h-screen bg-gray-50 overflow-hidden">
            <DashboardSidebar />
            <div className="flex-1 flex flex-col overflow-hidden">
                <div className="bg-white border-b border-gray-200 px-8 py-5">
                    <div className="flex items-center justify-between">
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
                                My Favorites
                            </h1>
                            <p className="text-xs text-gray-500 mt-0.5">Your starred event spaces</p>
                        </div>
                        <div className="flex items-center gap-3">
                            <div className="relative">
                                <BsSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-3.5 h-3.5" />
                                <input
                                    type="text"
                                    placeholder="Search favorites..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="pl-9 pr-4 py-2 text-xs border border-gray-200 rounded-lg focus:outline-none focus:border-blue-500 w-60 bg-gray-50/50"
                                />
                            </div>
                        </div>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-8">
                    {showCreateEventModal && (
                        <CreateEventModal onClose={() => setShowCreateEventModal(false)} />
                    )}

                    <div className="mb-10">
                        <div className="flex items-center justify-between mb-6">
                            <span className="text-sm text-gray-500">{favorites.length} {favorites.length === 1 ? 'favorite' : 'favorites'}</span>
                        </div>
                        {isLoading ? (
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
