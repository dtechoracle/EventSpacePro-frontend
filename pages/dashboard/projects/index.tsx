"use client";

import ProjectCard from "@/components/dashboard/ProjectCard";
import DashboardSidebar from "../../(components)/DashboardSidebar";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/helpers/Config";
import { AssetInstance } from "@/store/sceneStore";
import { BsSearch } from "react-icons/bs";
import { useState, useMemo } from "react";
import CreateProjectModal from "../../(components)/projects/CreateProjectModal";
import ImportModal from "../../(components)/projects/ImportMOdal";

interface EventData {
  _id: string;
  name: string;
  canvasAssets: AssetInstance[];
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


const Projects = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [showCreateProjectModal, setShowCreateProjectModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);

  const { data, isLoading, error } = useQuery<ApiResponse>({
    queryKey: ["projects"],
    queryFn: () => apiRequest("/projects", "GET", null, true),
    staleTime: 0,
    gcTime: 0,
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
              return fullEventRes.data || fullEventRes;
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
    if (!searchQuery) return projectsWithEvents;
    const query = searchQuery.toLowerCase();
    return projectsWithEvents.filter(project =>
      project.name?.toLowerCase().includes(query)
    );
  }, [projectsWithEvents, searchQuery]);

  return (
    <div className="h-screen flex overflow-hidden bg-gray-50">
      <DashboardSidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="bg-white/60 backdrop-blur-sm border-b border-gray-300/50 px-8 py-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-[var(--accent)]">
                My Projects
              </h1>
              <p className="text-sm text-gray-500 mt-1">Manage and organize your projects</p>
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
                onClick={() => setShowImportModal(true)}
                className="px-5 py-2.5 text-sm font-medium border border-gray-300 rounded-xl hover:bg-gray-50 transition-colors bg-white/80"
              >
                Import
              </button>
              <button
                onClick={() => setShowCreateProjectModal(true)}
                className="px-5 py-2.5 text-sm font-semibold bg-[var(--accent)] text-white rounded-xl hover:opacity-90 flex items-center gap-2 shadow-md transition-opacity"
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