import EventCard from "@/pages/(components)/dashboard/EventCard";
import DashboardSidebar from "@/pages/(components)/DashboardSidebar";
import { useRouter } from "next/router";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/helpers/Config";
import { AssetInstance } from "@/store/sceneStore";
import { BsSearch } from "react-icons/bs";
import { useState } from "react";
import CreateEventModal from "@/pages/(components)/projects/CreateEventModal";
import { useUserStore } from "@/store/userStore";

interface EventData {
  _id: string;
  name: string;
  canvasAssets: AssetInstance[];
  canvasData?: { // Add canvasData for new preview logic
    walls: any[];
    shapes: any[];
    assets: any[];
  };
  createdAt: string;
  updatedAt: string;
  __v: number;
  projectSlug?: string; // Ensure this is present for EventCard routing
}

interface ApiResponse {
  data: EventData[];
}

// Shimmer loading component
const EventCardShimmer = () => (
  <div className="relative w-full h-60 p-12 rounded-lg bg-gray-100 animate-pulse">
  </div>
);

const Events = () => {
  const router = useRouter();
  const { slug } = router.query;
  const { user } = useUserStore(); // Needed for EventCard
  const [searchQuery, setSearchQuery] = useState("");
  const [showCreateEventModal, setShowCreateEventModal] = useState(false);

  const { data, isLoading, error } = useQuery<ApiResponse>({
    queryKey: ["events", slug],
    queryFn: async () => {
      const res = await apiRequest(`/projects/${slug}/events`, "GET", null, true);
      // Fetch full data for each event to ensure preview data exists
      const events = res.data || [];
      const fullEvents = await Promise.all(events.map(async (event: any) => {
        try {
          const fullRes = await apiRequest(`/projects/${slug}/events/${event._id}`, "GET", null, true);
          return { ...fullRes.data, projectSlug: slug }; // Ensure slug is attached
        } catch (e) { return { ...event, projectSlug: slug }; }
      }));
      return { data: fullEvents };
    },
    enabled: !!slug,
  });

  // Helper (copied from dashboard index)
  const buildPreviewData = (event: EventData) => {
    const walls = (event.canvasData?.walls as any[]) || [];
    const shapes = (event.canvasData?.shapes as any[]) || [];
    const assets = (event.canvasData?.assets as any[]) || [];

    // Normalize shapes
    const normalizedShapes = shapes.map((s: any) => ({
      ...s,
      fill: s.fill && s.fill !== 'transparent' ? s.fill : (s.backgroundColor || 'transparent')
    }));

    // Fallback if empty but canvasAssets exist
    if (!walls.length && !shapes.length && !assets.length && event.canvasAssets) {
      // Minimal fallback
      return {
        walls: [],
        shapes: [],
        assets: event.canvasAssets.map((a: any) => ({
          ...a,
          fillColor: a.fillColor || a.backgroundColor || '#3B82F6',
          type: a.type
        }))
      };
    }

    return { walls, shapes: normalizedShapes, assets };
  };

  return (
    <div className="h-screen flex overflow-hidden bg-gray-50">
      <DashboardSidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="bg-white/60 backdrop-blur-sm border-b border-gray-300/50 px-8 py-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-[var(--accent)]">
                {slug ? `Project: ${slug}` : "Events"}
              </h1>
              <p className="text-sm text-gray-500 mt-1">Manage and organize your events</p>
            </div>
            <div className="flex items-center gap-3">
              <div className="relative">
                <BsSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input
                  type="text"
                  placeholder="Search events..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 pr-4 py-2.5 text-sm border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent w-64 bg-white/80"
                />
              </div>

              <button
                onClick={() => setShowCreateEventModal(true)}
                className="px-5 py-2.5 text-sm font-semibold bg-[var(--accent)] text-white rounded-xl hover:opacity-90 flex items-center gap-2 shadow-md transition-opacity"
              >
                <span>New Event</span>
              </button>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-8">
          {showCreateEventModal && (
            <CreateEventModal onClose={() => setShowCreateEventModal(false)} />
          )}

          <div className="mb-6">
            <h2 className="text-2xl font-semibold">Events</h2>
          </div>

          {isLoading && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {Array.from({ length: 6 }).map((_, index) => (
                <EventCardShimmer key={index} />
              ))}
            </div>
          )}

          {error && (
            <div className="flex h-64 items-center justify-center rounded-2xl bg-white shadow">
              <p className="text-red-500">Error loading events</p>
            </div>
          )}

          {data && data.data && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {data.data.map((event) => (
                <EventCard
                  key={event._id || Math.random()}
                  event={event}
                  user={user}
                  previewData={buildPreviewData(event)}
                />
              ))}
            </div>
          )}

          {data && data.data && data.data.length === 0 && (
            <div className="flex h-64 items-center justify-center rounded-2xl bg-white shadow">
              <p className="text-gray-500">
                No events found. Create your first event!
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Events;