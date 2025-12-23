import EventCard from "@/pages/(components)/projects/EventCard";
import DashboardSidebar from "@/pages/(components)/DashboardSidebar";
import { useRouter } from "next/router";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/helpers/Config";
import { AssetInstance } from "@/store/sceneStore";
import { BsSearch } from "react-icons/bs";
import { useState } from "react";
import CreateEventModal from "@/pages/(components)/projects/CreateEventModal";

interface EventData {
  _id: string;
  name: string;
  canvasAssets: AssetInstance[];
  createdAt: string;
  updatedAt: string;
  __v: number;
}

interface ApiResponse {
  data: EventData[];
}

// Shimmer loading component
const EventCardShimmer = () => (
  <div className="relative w-full h-60 p-12 rounded-3xl overflow-hidden bg-gradient-to-br from-[#E0EAFF] via-[#C7D2FE] to-[#A5B4FC]">
    {/* Background shimmer - matching the actual card's gradient */}
    <div className="absolute inset-0 bg-gradient-to-br from-blue-100/40 via-indigo-100/40 to-slate-100/50">
      <div className="absolute -top-10 -left-10 w-40 h-40 bg-blue-300/60 rounded-full blur-3xl opacity-80" />
      <div className="absolute top-10 right-10 w-32 h-32 bg-sky-300/60 rounded-full blur-3xl opacity-70" />
      <div className="absolute bottom-10 left-1/3 w-32 h-32 bg-indigo-300/60 rounded-full blur-3xl opacity-70" />
    </div>

    {/* Shimmer animation overlay */}
    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-shimmer"></div>

    {/* Frosted overlay shimmer */}
    <div className="absolute inset-0 bg-white/40 backdrop-blur-lg"></div>

    {/* Stylized grooves */}
    <div className="absolute top-0 left-0 w-full h-6 flex items-center justify-between px-4">
      <div className="w-10 h-1 bg-black/20 rounded-full animate-pulse" />
      <div className="w-10 h-1 bg-black/20 rounded-full animate-pulse" />
    </div>

    {/* Content shimmer */}
    <div className="absolute bottom-0 left-0 w-full p-4 flex justify-between items-end">
      <div className="flex-1">
        <div className="h-5 bg-black/20 rounded w-3/4 mb-2 animate-pulse"></div>
        <div className="h-4 bg-gray-500/30 rounded w-1/2 animate-pulse"></div>
      </div>
      <div className="w-8 h-8 bg-black/20 rounded-full animate-pulse"></div>
    </div>
  </div>
);

const Events = () => {
  const router = useRouter();
  const { slug } = router.query;
  const [searchQuery, setSearchQuery] = useState("");
  const [showCreateEventModal, setShowCreateEventModal] = useState(false);

  const { data, isLoading, error } = useQuery<ApiResponse>({
    queryKey: ["events", slug],
    queryFn: () => apiRequest(`/projects/${slug}/events`, "GET", null, true),
    enabled: !!slug, // Only run query when slug is available
  });

  return (
    <div className="h-screen flex overflow-hidden bg-gray-50">
      <DashboardSidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="bg-white/60 backdrop-blur-sm border-b border-gray-300/50 px-8 py-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-[var(--accent)]">
                {slug ? `Project ${slug}` : "Events"}
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
              <select className="px-4 py-2.5 text-sm border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--accent)] bg-white/80">
                <option>Last modified ↓</option>
                <option>Last modified ↑</option>
                <option>Name A-Z</option>
                <option>Name Z-A</option>
              </select>
              <button
                className="px-5 py-2.5 text-sm font-medium border border-gray-300 rounded-xl hover:bg-gray-50 transition-colors bg-white/80"
              >
                Import
              </button>
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
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
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
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {data.data.map((event) => (
                <EventCard key={event?._id || Math.random()} event={event} />
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