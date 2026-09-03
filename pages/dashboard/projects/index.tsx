"use client";

import ProjectCard from "@/components/dashboard/ProjectCard";
import DashboardSidebar from "../../(components)/DashboardSidebar";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/router";
import { apiRequest } from "@/helpers/Config";
import { AssetInstance } from "@/store/sceneStore";
import { BsSearch, BsGrid } from "react-icons/bs";
import { useState, useMemo } from "react";
import CreateProjectModal from "../../(components)/projects/CreateProjectModal";
import ImportModal from "../../(components)/projects/ImportMOdal";
import { withPreviewableCanvasAssets } from "@/lib/canvasAssets";
import { buildPreviewData } from "@/helpers/previewHelpers";
import WorkspacePreview from "@/components/WorkspacePreview";
import { STANDALONE_SLUG } from "@/lib/standaloneEvent";

interface EventData {
  _id: string;
  name: string;
  canvasAssets: AssetInstance[];
  canvasData?: any;
  type?: string;
  createdAt: string;
  updatedAt: string;
  __v: number;
}

interface ProjectData {
  _id: string;
  name: string;
  users: Array<{
    user: string;
    role: string;
    email: string;
  }>;
  invites: Array<{
    email: string;
    role: string;
    status: string;
    invitedAt: string;
  }>;
  events: EventData[];
  assets: AssetInstance[];
  slug: string;
  createdAt: string;
  updatedAt: string;
  __v: number;
}

interface ApiResponse {
  data: ProjectData[];
}

const StandaloneEventCard = ({ event }: { event: EventData }) => {
  const router = useRouter();
  const previewData = useMemo(() => buildPreviewData(event), [event]);
  const previewDataLoaded = useMemo(() => {
    if (!previewData) return false;
    return (
      previewData.walls.length > 0 ||
      previewData.shapes.length > 0 ||
      previewData.assets.length > 0
    );
  }, [previewData]);

  const getTimeAgo = (dateString: string) => {
    const now = new Date();
    const updated = new Date(dateString);
    const diffInMs = now.getTime() - updated.getTime();
    const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));

    if (diffInDays === 0) return "Today";
    if (diffInDays === 1) return "Yesterday";
    if (diffInDays < 7) return `${diffInDays} days ago`;
    if (diffInDays < 30) return `${Math.floor(diffInDays / 7)} weeks ago`;
    return `${Math.floor(diffInDays / 30)} months ago`;
  };

  return (
    <div
      onClick={() => router.push(`/dashboard/editor/${STANDALONE_SLUG}/${event._id}`)}
      className="bg-white rounded-xl border border-gray-200 overflow-hidden cursor-pointer hover:shadow-lg hover:border-blue-300 transition-all group relative flex flex-col h-full"
    >
      <div className="bg-gray-50 w-full relative overflow-hidden flex items-center justify-center border-b border-gray-100" style={{ height: '180px' }}>
        {previewDataLoaded ? (
          <div className="w-full h-full relative">
            <WorkspacePreview
              walls={previewData.walls}
              shapes={previewData.shapes}
              assets={previewData.assets}
              textAnnotations={previewData.textAnnotations}
              width={400}
              height={180}
              backgroundColor="#ffffff"
            />
          </div>
        ) : (
          <div className="w-full h-full bg-gray-50 flex flex-col items-center justify-center text-gray-300">
            <BsGrid className="text-4xl mb-2 opacity-20" />
            <span className="text-xs font-medium text-gray-400">Empty Event</span>
          </div>
        )}
      </div>
      <div className="p-5 mt-auto bg-white">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-base mb-1 truncate text-gray-900 group-hover:text-blue-600 transition-colors">
              {event?.name || "Unnamed Event"}
            </h3>
            <p className="text-xs text-gray-500">
              Updated {getTimeAgo(event?.updatedAt || new Date().toISOString())}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

const Projects = () => {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [showCreateProjectModal, setShowCreateProjectModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);

  const { data, isLoading, error } = useQuery<ApiResponse>({
    queryKey: ["projects"],
    queryFn: () => apiRequest("/projects", "GET", null, true),
    staleTime: 0,
    gcTime: 0,
  });

  // Standalone events (no project) live under GET /events. They are listed
  // here in their own section so they don't look like an event inside a
  // project — clicking one opens the standalone editor.
  const { data: standaloneEvents, isLoading: isLoadingStandalone } = useQuery<EventData[]>({
    queryKey: ["standalone-events"],
    queryFn: async () => {
      const res = await apiRequest("/events", "GET", null, true);
      const events = (res.data || res || []) as any[];
      return Promise.all(events.map(async (event: any) => {
        try {
          const fullEvent = await apiRequest(`/events/${event._id}`, "GET", null, true);
          return withPreviewableCanvasAssets(fullEvent.data || fullEvent);
        } catch (error) {
          return withPreviewableCanvasAssets(event);
        }
      }));
    },
    enabled: true,
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: true,
  });

  const { data: allProjectEvents, isLoading: isLoadingEvents } = useQuery({
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
              return withPreviewableCanvasAssets(fullEventRes.data || fullEventRes);
            } catch (error) {
              return { ...event, canvasData: null, canvasAssets: [] };
            }
          });
          const fullEvents = await Promise.all(fullEventPromises);
          return { projectSlug: project.slug, events: fullEvents };
        } catch (error) {
          return { projectSlug: project.slug, events: [] };
        }
      });
      return Promise.all(eventPromises);
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
        events: eventsData?.events || project.events || []
      };
    });
  }, [data?.data, allProjectEvents]);

  const filteredProjects = useMemo(() => {
    // Personal Drafts is now shown so users can access their draft events.
    const baseProjects = projectsWithEvents;
    if (!searchQuery) return baseProjects;
    const query = searchQuery.toLowerCase();
    return baseProjects.filter(project =>
      project.name?.toLowerCase().includes(query)
    );
  }, [projectsWithEvents, searchQuery]);

  const filteredStandaloneEvents = useMemo(() => {
    if (!standaloneEvents) return [];
    if (!searchQuery) return standaloneEvents;
    const query = searchQuery.toLowerCase();
    return standaloneEvents.filter(event =>
      event.name?.toLowerCase().includes(query)
    );
  }, [standaloneEvents, searchQuery]);

  return (
    <div className="h-screen flex overflow-hidden bg-gray-50">
      <DashboardSidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="bg-white border-b border-gray-200 px-8 py-5">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
                My Projects
              </h1>
              <p className="text-xs text-gray-500 mt-0.5">Manage and organize your projects</p>
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
              <select className="px-4 py-2 text-xs border border-gray-200 rounded-lg focus:outline-none focus:border-blue-500 bg-gray-50/50">
                <option>Last modified ↓</option>
                <option>Last modified ↑</option>
                <option>Name A-Z</option>
                <option>Name Z-A</option>
              </select>
              <button
                onClick={() => setShowImportModal(true)}
                className="px-4 py-2 text-xs font-medium border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors bg-white"
              >
                Import
              </button>
              <button
                onClick={() => setShowCreateProjectModal(true)}
                className="px-4 py-2 text-xs font-semibold bg-blue-600 text-white rounded-lg hover:bg-blue-500 flex items-center gap-1.5 transition-colors"
              >
                <span>New Project</span>
              </button>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-8">
          {showCreateProjectModal && (
            <CreateProjectModal onClose={() => setShowCreateProjectModal(false)} />
          )}
          {showImportModal && (
            <ImportModal onClose={() => setShowImportModal(false)} />
          )}

          {/* My events: standalone events that live outside any project */}
          {!isLoadingStandalone && filteredStandaloneEvents && filteredStandaloneEvents.length > 0 && (
            <div className="mb-8">
              <div className="mb-6">
                <h2 className="text-2xl font-semibold">My events</h2>
                <p className="text-sm text-gray-500 mt-1">Standalone events not tied to a project</p>
              </div>
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {filteredStandaloneEvents.map((event) => (
                  <StandaloneEventCard key={event._id} event={event} />
                ))}
              </div>
            </div>
          )}

          <div className="mb-6">
            <h2 className="text-2xl font-semibold">Recents</h2>
          </div>

          {(isLoading || isLoadingEvents) && (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 mt-8">
              {Array.from({ length: 6 }).map((_, index) => (
                <div key={index} className="h-64 bg-gray-100 rounded-2xl animate-pulse" />
              ))}
            </div>
          )}

          {error && (
            <div className="mt-8 flex items-center justify-center rounded-2xl bg-white shadow-sm border border-gray-200 p-12">
              <div className="text-center space-y-4 max-w-md">
                <div className="w-16 h-16 mx-auto bg-red-50 rounded-2xl flex items-center justify-center">
                  <svg className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <div className="space-y-2">
                  <h3 className="text-lg font-semibold text-gray-900">Failed to load projects</h3>
                  <p className="text-sm text-gray-500">There was an error loading your projects. Please try refreshing the page.</p>
                </div>
                <button className="mt-4 px-6 py-2.5 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors duration-200 text-sm font-medium">
                  Retry
                </button>
              </div>
            </div>
          )}

          {filteredProjects && filteredProjects.length > 0 && !(isLoading || isLoadingEvents) && (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 mt-8">
              {filteredProjects.map((project) => (
                <ProjectCard key={project._id} project={project} />
              ))}
            </div>
          )}

          {filteredProjects && filteredProjects.length === 0 && !(isLoading || isLoadingEvents) && (
            <div className="mt-8 flex items-center justify-center rounded-2xl bg-white shadow-sm border border-gray-200 p-16">
              <div className="text-center space-y-6 max-w-md">
                <div className="w-20 h-20 mx-auto bg-gray-50 rounded-2xl flex items-center justify-center">
                  <svg className="w-10 h-10 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                  </svg>
                </div>
                <div className="space-y-3">
                  <h3 className="text-xl font-semibold text-gray-900">No projects yet</h3>
                  <p className="text-sm text-gray-500 leading-relaxed">
                    Get started by creating your first project and bring your ideas to life.
                  </p>
                </div>
                <button
                  onClick={() => setShowCreateProjectModal(true)}
                  className="mt-2 px-8 py-3 bg-gray-900 text-white rounded-xl hover:bg-gray-800 transition-colors duration-200 text-sm font-medium inline-flex items-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Create Project
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Projects;