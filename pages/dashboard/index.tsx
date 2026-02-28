"use client";

import { BsStars, BsSearch } from "react-icons/bs";
import { useUserStore } from "@/store/userStore";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/helpers/Config";
import { useRouter } from "next/router";
import { motion } from "framer-motion";
import DashboardSidebar from "@/pages/(components)/DashboardSidebar";
import CreateEventModal from "@/pages/(components)/projects/CreateEventModal";
import CreateProjectModal from "@/pages/(components)/projects/CreateProjectModal";
import EventCard from "@/components/dashboard/EventCard"; // Switch to EventCard

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

interface ProjectData {
  _id: string;
  name: string;
  slug: string;
  events: EventData[];
  createdAt: string;
  updatedAt: string;
  // Add optional fields to match ProjectCard interface if needed
  users?: any[];
  invites?: any[];
  assets?: any[];
}

interface ApiResponse {
  data: ProjectData[];
}

const Dashboard = () => {
  const { user, fetchUser } = useUserStore();
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [showCreateEventModal, setShowCreateEventModal] = useState(false);
  const [showCreateProjectModal, setShowCreateProjectModal] = useState(false); // Added for New Project button

  useEffect(() => {
    // Fetch user on mount and check periodically
    fetchUser();

    // Set up interval to check user status every 30 seconds
    const interval = setInterval(() => {
      fetchUser();
    }, 30000);

    return () => clearInterval(interval);
  }, [fetchUser]);

  const { data, isLoading } = useQuery<ApiResponse>({
    queryKey: ["projects"],
    queryFn: () => {
      console.log('[Dashboard] Fetching projects from DATABASE');
      return apiRequest("/projects", "GET", null, true);
    },
    staleTime: 0, // Always refetch
    gcTime: 0, // Don't cache
  });

  // Fetch events for all projects separately to get full event data (needed for thumbnails)
  const { data: allProjectEvents, isLoading: isLoadingEvents } = useQuery({
    queryKey: ["all-events", data?.data?.map(p => p.slug)],
    queryFn: async () => {
      if (!data?.data) return [];

      console.log('[Dashboard] Fetching ALL events from DATABASE for projects:', data.data.map(p => p.slug));

      // Fetch events for each project
      const eventPromises = data.data.map(async (project) => {
        try {
          console.log(`[Dashboard] Fetching events from DATABASE for project: ${project.slug}`);
          const res = await apiRequest(`/projects/${project.slug}/events`, "GET", null, true);
          const events = res.data || [];

          console.log(`[Dashboard] ✅ Fetched ${events.length} events from DATABASE for project ${project.slug}`);

          // CRITICAL: Fetch full event data for each event to get canvasData
          const fullEventPromises = events.map(async (event: any) => {
            try {
              // Only fetch full data if canvasData is missing or we need it for thumbnail
              // But for Dashboard list, we might want to optimize?
              // ProjectCard needs Last Event's preview.
              // So we effectively need details for at least the last updated event.
              // For now, keep existing logic to be safe.

              const fullEventRes = await apiRequest(`/projects/${project.slug}/events/${event._id}`, "GET", null, true);
              const fullEvent = fullEventRes.data || fullEventRes;
              return fullEvent;
            } catch (error: any) {
              console.error(`[Dashboard] ❌ Failed to fetch full event ${event._id} from DATABASE:`, error);
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
        } catch (error: any) {
          console.error(`[Dashboard] ❌ Failed to fetch events for project ${project.slug}:`, error);
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

  // Merge projects with their fetched events
  const projectsWithEvents = useMemo(() => {
    if (!data?.data) return [];
    if (!allProjectEvents) return data.data;

    return data.data.map(project => {
      const eventsData = allProjectEvents.find(p => p.projectSlug === project.slug);
      return {
        ...project,
        events: eventsData?.events || []
      };
    });
  }, [data?.data, allProjectEvents]);

  // Filter projects by search query
  const filteredProjects = useMemo(() => {
    if (!searchQuery) return projectsWithEvents;
    const query = searchQuery.toLowerCase();
    return projectsWithEvents.filter(project =>
      project.name?.toLowerCase().includes(query)
    );
  }, [projectsWithEvents, searchQuery]);

  // Flatten events and take 6 most recent
  const recentEvents = useMemo(() => {
    if (!allProjectEvents) return [];

    const allEventsFlat = allProjectEvents.flatMap(project =>
      (project.events || []).map((event: any) => ({
        ...event,
        projectSlug: project.projectSlug,
        projectName: project.projectName
      }))
    );

    const filteredEvents = searchQuery
      ? allEventsFlat.filter(event =>
        event.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        event.projectName?.toLowerCase().includes(searchQuery.toLowerCase())
      )
      : allEventsFlat;

    return filteredEvents
      .sort((a, b) => new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime())
      .slice(0, 8);
  }, [allProjectEvents, searchQuery]);

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      {/* Left Sidebar */}
      <DashboardSidebar />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="bg-white/60 backdrop-blur-sm border-b border-gray-300/50 px-8 py-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-[var(--accent)]">
                Recent Events
              </h1>
              <p className="text-sm text-gray-500 mt-1">Pick up where you left off</p>
            </div>
            <div className="flex items-center gap-3">
              <div className="relative">
                <BsSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input
                  type="text"
                  placeholder="Search projects..."
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
                onClick={() => setShowCreateProjectModal(true)}
                className="px-5 py-2.5 text-sm font-semibold bg-[var(--accent)] text-white rounded-xl hover:opacity-90 flex items-center gap-2 shadow-md transition-opacity"
              >
                <BsStars className="w-4 h-4" />
                <span>New Project</span>
              </button>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-8 pb-32">
          {showCreateEventModal && (
            <CreateEventModal onClose={() => setShowCreateEventModal(false)} />
          )}
          {showCreateProjectModal && (
            <CreateProjectModal onClose={() => setShowCreateProjectModal(false)} />
          )}

          {/* Recent Events Section */}
          <section className="mb-16">
            {!isLoading && (!data?.data || data.data.length === 0) && !searchQuery ? (
              <div className="flex flex-col items-center justify-center h-full max-h-[60vh] text-center space-y-6 animate-in fade-in zoom-in duration-500">
                <div className="w-24 h-24 bg-blue-50 rounded-full flex items-center justify-center mb-4 shadow-sm">
                  <svg className="w-10 h-10 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-gray-900 mb-2">Welcome to EventSpacePro</h2>
                  <p className="text-gray-500 max-w-md mx-auto text-lg mb-8">
                    You don't have any projects yet. Create your first project to start organizing your events and layouts.
                  </p>
                  <button
                    onClick={() => setShowCreateProjectModal(true)}
                    className="px-8 py-4 bg-blue-600 text-white text-lg rounded-xl font-semibold hover:bg-blue-700 transition-all shadow-lg hover:shadow-xl active:scale-95 transform transition-transform inline-flex items-center gap-2"
                  >
                    <BsStars className="w-5 h-5" />
                    <span>Create First Project</span>
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-bold text-gray-800">Recent Events</h2>
                  <div className="flex items-center gap-4">
                    <span className="text-sm text-gray-500">{recentEvents.length} {recentEvents.length === 1 ? 'event' : 'events'}</span>
                  </div>
                </div>

                {(isLoading || isLoadingEvents) ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {[1, 2, 3, 4].map((i) => (
                      <div
                        key={i}
                        className="bg-gray-100 rounded-lg h-48 animate-pulse"
                      />
                    ))}
                  </div>
                ) : recentEvents.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 text-center space-y-6 animate-in fade-in zoom-in duration-500">
                    <div className="w-24 h-24 bg-[var(--accent)]/10 rounded-full flex items-center justify-center mb-4">
                      <BsStars className="w-12 h-12 text-[var(--accent)]" />
                    </div>
                    <h2 className="text-3xl font-bold text-gray-800">No Events Found</h2>
                    <p className="text-gray-500 max-w-md text-lg">
                      Try adjusting your search or create a new event.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {recentEvents.map((event: any) => (
                      <EventCard
                        key={event._id}
                        event={event}
                        user={user}
                      />
                    ))}
                  </div>
                )}
              </>
            )}
          </section>

          {/* Templates Section */}
          <section>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-gray-800">Templates</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {/* Template Placeholder Cards */}
              <motion.div
                whileHover={{ scale: 1.03, y: -4 }}
                className="bg-white rounded-2xl border border-gray-200/60 overflow-hidden cursor-pointer hover:shadow-xl transition-all duration-300"
              >
                <div className="h-40 bg-gradient-to-br from-green-400 to-green-600 flex items-center justify-center">
                  <div className="text-white text-5xl">🌳</div>
                </div>
                <div className="p-4">
                  <h3 className="font-semibold text-sm text-gray-800">Outdoor Event</h3>
                  <p className="text-xs text-gray-500 mt-1">Outdoor event layout with various zones</p>
                </div>
              </motion.div>
              <motion.div
                whileHover={{ scale: 1.03, y: -4 }}
                className="bg-white rounded-2xl border border-gray-200/60 overflow-hidden cursor-pointer hover:shadow-xl transition-all duration-300"
              >
                <div className="h-40 bg-gradient-to-br from-purple-400 to-purple-600 flex items-center justify-center">
                  <div className="text-white text-5xl">🎪</div>
                </div>
                <div className="p-4">
                  <h3 className="font-semibold text-sm text-gray-800">Marquee Event</h3>
                  <p className="text-xs text-gray-500 mt-1">Large marquee setup for special events</p>
                </div>
              </motion.div>
              <motion.div
                whileHover={{ scale: 1.03, y: -4 }}
                className="bg-white rounded-2xl border border-gray-200/60 overflow-hidden cursor-pointer hover:shadow-xl transition-all duration-300"
              >
                <div className="h-40 bg-gradient-to-br from-gray-200 to-gray-300 flex items-center justify-center">
                  <div className="text-gray-500 text-4xl">📐</div>
                </div>
                <div className="p-4">
                  <h3 className="font-semibold text-sm text-gray-800">Starter Template</h3>
                  <p className="text-xs text-gray-500 mt-1">Begin with a blank canvas</p>
                </div>
              </motion.div>
            </div>
          </section>
        </div>


      </div>
    </div>
  );
};

export default Dashboard;