"use client";

import ProjectCard from "../../(components)/projects/ProjectCard";
import MainLayout from "../../layouts/MainLayout";
import TopBar from "../../(components)/projects/TopBar";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/helpers/Config";
import { AssetInstance } from "@/store/sceneStore";

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

// Shimmer loading component for ProjectCard
const ProjectCardShimmer = () => (
  <div className="relative w-full bg-white rounded-2xl border border-gray-200 p-6 overflow-hidden shadow-sm hover:shadow-md transition-shadow duration-300">
    <div className="absolute inset-0 -translate-x-full via-gray-50 to-transparent animate-[shimmer_2s_infinite]"></div>
    
    <div className="space-y-5 relative">
      <div className="flex items-start justify-between">
        <div className="flex-1 space-y-3">
          <div className="h-7 bg-gray-200 rounded-lg w-3/4 animate-pulse"></div>
          <div className="h-4 bg-gray-100 rounded-md w-1/2 animate-pulse"></div>
        </div>
        <div className="w-10 h-10 bg-gray-100 rounded-xl animate-pulse"></div>
      </div>
      
      <div className="space-y-2.5 pt-3">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 bg-gray-100 rounded animate-pulse"></div>
          <div className="h-3 bg-gray-100 rounded w-24 animate-pulse"></div>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 bg-gray-100 rounded animate-pulse"></div>
          <div className="h-3 bg-gray-100 rounded w-32 animate-pulse"></div>
        </div>
      </div>
      
      <div className="flex items-center justify-between pt-4 border-t border-gray-100">
        <div className="h-4 bg-gray-100 rounded-md w-28 animate-pulse"></div>
        <div className="w-20 h-8 bg-gray-100 rounded-lg animate-pulse"></div>
      </div>
    </div>
  </div>
);

const Projects = () => {
  const { data, isLoading, error } = useQuery<ApiResponse>({
    queryKey: ["projects"],
    queryFn: () => apiRequest("/projects", "GET", null, true),
  });

  return (
    <MainLayout>
      <div className="w-full min-h-screen bg-gray-50/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <TopBar mainText="My Projects" subText="Recents" type="project" />

          {isLoading && (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 mt-8">
              {Array.from({ length: 6 }).map((_, index) => (
                <ProjectCardShimmer key={index} />
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

          {data && data.data && data.data.length > 0 && (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 mt-8">
              {data.data.map((project) => (
                <ProjectCard key={project?._id || Math.random()} project={project} />
              ))}
            </div>
          )}

          {data && data.data && data.data.length === 0 && (
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
                <button className="mt-2 px-8 py-3 bg-gray-900 text-white rounded-xl hover:bg-gray-800 transition-colors duration-200 text-sm font-medium inline-flex items-center gap-2">
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
    </MainLayout>
  );
};

export default Projects;