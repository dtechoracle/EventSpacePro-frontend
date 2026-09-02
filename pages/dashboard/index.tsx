"use client";

import { BsStars, BsSearch } from "react-icons/bs";
import { FaPlus } from "react-icons/fa";
import { useUserStore } from "@/store/userStore";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/helpers/Config";
import { useRouter } from "next/router";
import { motion } from "framer-motion";
import DashboardSidebar from "@/pages/(components)/DashboardSidebar";
import CreateEventModal from "@/pages/(components)/projects/CreateEventModal";
import QuickCreateEventModal from "@/pages/(components)/projects/QuickCreateEventModal";
import CreateProjectModal from "@/pages/(components)/projects/CreateProjectModal";
import EventCard from "@/components/dashboard/EventCard";
import { TEMPLATES } from "@/lib/templates";
import TemplatePreview from "@/components/dashboard/TemplatePreview";
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

interface ProjectData {
  _id: string;
  name: string;
  slug: string;
  events: EventData[];
  createdAt: string;
  updatedAt: string;
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
  const [createEventMode, setCreateEventMode] = useState<'manual' | 'ai'>('manual');
  const [showQuickCreateModal, setShowQuickCreateModal] = useState(false);
  const [showCreateProjectModal, setShowCreateProjectModal] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<any>(null);
  const [hoveredTemplate, setHoveredTemplate] = useState<string | null>(null);

  useEffect(() => {
    fetchUser();
    const interval = setInterval(() => {
      fetchUser();
    }, 30000);
    return () => clearInterval(interval);
  }, [fetchUser]);

  const { data, isLoading, error: projectsError } = useQuery<ApiResponse>({
    queryKey: ["projects"],
    queryFn: () => {
      console.log('[Dashboard] Fetching projects from DATABASE');
      return apiRequest("/projects", "GET", null, true);
    },
    staleTime: 0,
    gcTime: 0,
  });

  const { data: allProjectEvents, isLoading: isLoadingEvents, error: eventsError } = useQuery({
    queryKey: ["all-events", data?.data?.map(p => p.slug)],
    queryFn: async () => {
      if (!data?.data) return [];

      console.log('[Dashboard] Fetching ALL events from DATABASE for projects:', data.data.map(p => p.slug));

      const failedProjects: string[] = [];

      const eventPromises = data.data.map(async (project) => {
        try {
          console.log(`[Dashboard] Fetching events from DATABASE for project: ${project.slug}`);
          const res = await apiRequest(`/projects/${project.slug}/events`, "GET", null, true);
          const events = res.data || [];

          console.log(`[Dashboard] ✅ Fetched ${events.length} events from DATABASE for project ${project.slug}`);

          const fullEventPromises = events.map(async (event: any) => {
            try {
              const fullEventRes = await apiRequest(`/projects/${project.slug}/events/${event._id}`, "GET", null, true);
              const fullEvent = fullEventRes.data || fullEventRes;
              return withPreviewableCanvasAssets(fullEvent);
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
          failedProjects.push(project.slug);
          return {
            projectSlug: project.slug,
            projectName: project.name,
            projectId: project._id,
            events: []
          };
        }
      });

      const results = await Promise.all(eventPromises);

      if (failedProjects.length === data.data.length && data.data.length > 0) {
        throw new Error("Failed to load events from server");
      }

      return results;
    },
    enabled: !!data?.data && data.data.length > 0,
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: true,
  });

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

  const filteredProjects = useMemo(() => {
    const HIDDEN_PROJECT_NAME = "Personal Drafts";
    const baseProjects = projectsWithEvents.filter(p => p.name !== HIDDEN_PROJECT_NAME);
    if (!searchQuery) return baseProjects;
    const query = searchQuery.toLowerCase();
    return baseProjects.filter(project =>
      project.name?.toLowerCase().includes(query)
    );
  }, [projectsWithEvents, searchQuery]);

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
      <DashboardSidebar />

      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="bg-white border-b border-gray-200 px-8 py-5">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
                Recent Events
              </h1>
              <p className="text-xs text-gray-500 mt-0.5">Pick up where you left off</p>
            </div>
            <div className="flex items-center gap-3">
              <div className="relative">
                <BsSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-3.5 h-3.5" />
                <input
                  type="text"
                  placeholder="Search projects..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 pr-4 py-2 text-xs border border-gray-200 rounded-lg focus:outline-none focus:border-blue-500 w-60 bg-gray-50/50"
                />
              </div>
              <button
                onClick={() => {
                  setShowCreateEventModal(true);
                }}
                className="px-4 py-2 text-xs font-semibold bg-blue-600 text-white rounded-lg hover:bg-blue-500 flex items-center gap-1.5 transition-colors"
              >
                <FaPlus size={12} />
                <span>New Event</span>
              </button>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-8 pb-32">
          {showQuickCreateModal && (
            <QuickCreateEventModal onClose={() => setShowQuickCreateModal(false)} />
          )}
          {showCreateEventModal && (
            <CreateEventModal 
              onClose={() => setShowCreateEventModal(false)} 
              preSelectedMode={createEventMode}
            />
          )}
          {showCreateProjectModal && (
            <CreateProjectModal onClose={() => setShowCreateProjectModal(false)} />
          )}
          {selectedTemplate && (
            <CreateEventModal
              onClose={() => setSelectedTemplate(null)}
              initialTemplateData={selectedTemplate.canvasData || {
                canvasAssets: selectedTemplate.canvasAssets,
                canvases: selectedTemplate.canvases,
              }}
            />
          )}

          <section className="mb-16">
            {!isLoading && !isLoadingEvents && (filteredProjects.length === 0) && recentEvents.length === 0 && !searchQuery ? (
              <div className="w-full bg-white rounded-xl border border-gray-200 p-8 my-4">
                <div className="max-w-2xl">
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-md bg-blue-50 text-blue-600 text-xs font-semibold mb-4 border border-blue-100">
                    <BsStars className="w-3.5 h-3.5" />
                    <span>Get Started</span>
                  </div>
                  <h2 className="text-2xl font-bold text-gray-900 tracking-tight">
                    Welcome to EventSpacePro
                  </h2>
                  <p className="text-xs text-gray-500 mt-1 leading-relaxed max-w-lg">
                    You don't have any projects yet. Create a project to start organizing your floor plans, venues, and layout events.
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-6">
                    <button
                      onClick={() => setShowCreateProjectModal(true)}
                      className="p-4 rounded-xl border border-gray-200 hover:border-blue-500 hover:bg-blue-50/40 text-left transition-all group flex flex-col justify-between h-28"
                    >
                      <div className="flex items-center justify-between w-full">
                        <span className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center text-xs font-bold">
                          +
                        </span>
                        <span className="text-xs text-gray-400 group-hover:text-blue-600 transition-colors">→</span>
                      </div>
                      <div>
                        <h3 className="font-bold text-xs text-gray-900 group-hover:text-blue-600">Create Blank Project</h3>
                        <p className="text-[11px] text-gray-400 mt-0.5">Start with a custom empty space</p>
                      </div>
                    </button>

                    <button
                      onClick={() => setShowCreateEventModal(true)}
                      className="p-4 rounded-xl border border-gray-200 hover:border-blue-500 hover:bg-blue-50/40 text-left transition-all group flex flex-col justify-between h-28"
                    >
                      <div className="flex items-center justify-between w-full">
                        <span className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center text-xs font-bold">
                          <BsStars size={12} />
                        </span>
                        <span className="text-xs text-gray-400 group-hover:text-blue-600 transition-colors">→</span>
                      </div>
                      <div>
                        <h3 className="font-bold text-xs text-gray-900 group-hover:text-blue-600">Quick Event Layout</h3>
                        <p className="text-[11px] text-gray-400 mt-0.5">Pick a preloaded venue or marquee</p>
                      </div>
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-bold text-gray-800">Recent Events</h2>
                  <div className="flex items-center gap-4">
                  <div className="flex flex-col items-end">
                    <span className="text-sm text-gray-500">{recentEvents.length} {recentEvents.length === 1 ? 'event' : 'events'}</span>
                    <button 
                      onClick={() => router.push("/dashboard/projects")}
                      className="text-xs font-medium text-blue-600 hover:text-blue-700 hover:underline transition-colors mt-0.5"
                    >
                      View Projects
                    </button>
                  </div>
                  </div>
                </div>

                {(isLoading || isLoadingEvents) ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {[1, 2, 3, 4].map((i) => (
                      <div
                        key={i}
                        className="bg-white rounded-2xl border border-gray-200/60 overflow-hidden animate-pulse"
                      >
                        <div className="h-40 bg-gray-200" />
                        <div className="p-4 space-y-3">
                          <div className="h-4 bg-gray-200 rounded w-3/4" />
                          <div className="h-3 bg-gray-100 rounded w-1/2" />
                          <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                            <div className="h-3 bg-gray-100 rounded w-1/3" />
                            <div className="h-3 bg-gray-100 rounded w-1/4" />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : projectsError || eventsError ? (
                  <div className="flex flex-col items-center justify-center py-16 text-center space-y-4">
                    <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center">
                      <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                      </svg>
                    </div>
                    <h2 className="text-xl font-bold text-gray-800">Failed to load events</h2>
                    <p className="text-gray-500 max-w-md text-sm">
                      Something went wrong while fetching your events. Please try again.
                    </p>
                    <button
                      onClick={() => window.location.reload()}
                      className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm font-medium transition-colors"
                    >
                      Retry
                    </button>
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

          <section>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-gray-800">Templates</h2>
              <button
                onClick={() => router.push("/dashboard/templates")}
                className="text-sm font-medium text-blue-600 hover:text-blue-700 transition-colors"
              >
                View all templates →
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {TEMPLATES.filter(t => t.canvasData || t.canvasAssets).slice(0, 4).map((template) => (
                <motion.div
                  key={template.id}
                  onHoverStart={() => setHoveredTemplate(template.id)}
                  onHoverEnd={() => setHoveredTemplate(null)}
                  className="bg-white rounded-2xl border border-gray-200/60 overflow-hidden cursor-pointer hover:shadow-xl transition-all duration-300 group"
                >
                  <div className="h-40 relative overflow-hidden bg-gradient-to-br from-slate-50 to-slate-100">
                    {template.canvasAssets ? (
                      <TemplatePreview items={template.canvasAssets} />
                    ) : (
                      <div className={`w-full h-full flex items-center justify-center ${template.id === 'bedroom' ? 'bg-gradient-to-br from-orange-400 to-orange-600' :
                        template.id === 'office' ? 'bg-gradient-to-br from-blue-400 to-blue-600' :
                          'bg-gradient-to-br from-green-400 to-green-600'
                        }`}>
                        <div className={`${template.id === 'starter' ? 'text-gray-500' : 'text-white'} text-5xl`}>
                          {template.icon}
                        </div>
                      </div>
                    )}
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: hoveredTemplate === template.id ? 1 : 0 }}
                      className="absolute inset-0 bg-black/20 flex items-center justify-center"
                    >
                      <motion.button
                        initial={{ scale: 0.8 }}
                        animate={{ scale: hoveredTemplate === template.id ? 1 : 0.8 }}
                        onClick={(e) => { e.stopPropagation(); setSelectedTemplate(template); }}
                        className="bg-white text-gray-900 font-semibold px-6 py-3 rounded-xl shadow-lg hover:bg-gray-50 transition-colors"
                      >
                        Use template
                      </motion.button>
                    </motion.div>
                  </div>
                  <div className="p-4">
                    <h3 className="font-semibold text-sm text-gray-800">{template.name}</h3>
                    <p className="text-xs text-gray-500 mt-1 line-clamp-1">{template.description}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </section>
        </div>


      </div>
    </div>
  );
};

export default Dashboard;
