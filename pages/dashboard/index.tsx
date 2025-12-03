"use client";

import MainLayout from "../layouts/MainLayout";
import { BsStars, BsClock, BsFolder } from "react-icons/bs";
import { useUserStore } from "@/store/userStore";
import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/helpers/Config";
import { useRouter } from "next/router";
import { AssetInstance } from "@/store/sceneStore";
import { motion } from "framer-motion";

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

const Dashboard = () => {
  const { user, fetchUser } = useUserStore();
  const router = useRouter();

  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  const { data, isLoading } = useQuery<ApiResponse>({
    queryKey: ["projects"],
    queryFn: () => apiRequest("/projects", "GET", null, true),
  });

  // Get recent projects (sorted by updatedAt, limit to 6)
  const recentProjects = data?.data
    ? [...data.data]
        .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
        .slice(0, 6)
    : [];

  // Debug: Log project data structure
  useEffect(() => {
    if (recentProjects.length > 0) {
      console.log('Dashboard: Recent projects', recentProjects);
      recentProjects.forEach((project, idx) => {
        console.log(`Project ${idx}:`, {
          name: project.name,
          events: project.events?.length || 0,
          eventAssets: project.events?.[0]?.canvasAssets?.length || 0,
          projectAssets: project.assets?.length || 0,
          firstEvent: project.events?.[0]
        });
      });
    }
  }, [recentProjects]);

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

  // Calculate stats
  const totalProjects = data?.data?.length || 0;
  const totalEvents = data?.data?.reduce((sum, p) => sum + (p.events?.length || 0), 0) || 0;
  const totalCollaborations = data?.data?.reduce((sum, p) => sum + (p.users?.length || 0), 0) || 0;

  return (
    <MainLayout>
      <div className="p-6">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-4xl font-bold">Hi, {user?.firstName}!</h1>
            <p className="text-gray-500 mt-1">Welcome back to your workspace</p>
          </div>
          <button 
            onClick={() => router.push("/dashboard/projects")}
            className="bg-[var(--accent)] flex items-center gap-3 text-white px-4 py-2 rounded-lg shadow hover:bg-blue-700 transition"
          >
            <BsStars />
            Create Event with AI
          </button>
        </div>

        {/* Quick Stats Section - Moved to Top */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="bg-white rounded-xl p-6 shadow-md">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-500 text-sm mb-1">Total Projects</p>
                <p className="text-3xl font-bold">{totalProjects}</p>
              </div>
              <BsFolder className="text-3xl text-[var(--accent)] opacity-50" />
            </div>
          </div>

          <div className="bg-white rounded-xl p-6 shadow-md">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-500 text-sm mb-1">Total Events</p>
                <p className="text-3xl font-bold">{totalEvents}</p>
              </div>
              <BsStars className="text-3xl text-purple-500 opacity-50" />
            </div>
          </div>

          <div className="bg-white rounded-xl p-6 shadow-md">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-500 text-sm mb-1">Active Collaborations</p>
                <p className="text-3xl font-bold">{totalCollaborations}</p>
              </div>
              <BsClock className="text-3xl text-green-500 opacity-50" />
            </div>
          </div>
        </div>

        {/* Recent Projects Section */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <BsFolder className="text-xl text-gray-600" />
              <h2 className="text-2xl font-semibold">Recent Projects</h2>
            </div>
            <button
              onClick={() => router.push("/dashboard/projects")}
              className="text-[var(--accent)] hover:underline text-sm"
            >
              View all
            </button>
          </div>

          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div
                  key={i}
                  className="bg-gray-100 rounded-xl h-64 animate-pulse"
                />
              ))}
            </div>
          ) : recentProjects.length === 0 ? (
            <div className="bg-gray-50 rounded-xl p-12 text-center">
              <BsFolder className="text-4xl text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500 mb-4">No projects yet</p>
              <button
                onClick={() => router.push("/dashboard/projects")}
                className="bg-[var(--accent)] text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition"
              >
                Create your first project
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {recentProjects.map((project) => {
                // Get the last event worked on (most recently updated)
                const lastEvent = project?.events && project.events.length > 0
                  ? [...project.events].sort((a, b) => 
                      new Date(b.updatedAt || b.createdAt || 0).getTime() - 
                      new Date(a.updatedAt || a.createdAt || 0).getTime()
                    )[0]
                  : null;

                // Determine preview URL - use demo route if no event, otherwise use actual event
                // Add ?preview=true query parameter for iframe mode
                const previewUrl = lastEvent && lastEvent._id
                  ? `/dashboard/editor/${project.slug}/${lastEvent._id}?preview=true`
                  : `/dashboard/editor/project2/68ec3b52c37fab2d94b94d41?preview=true`; // Demo route

                return (
                  <motion.div
                    key={project._id}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => router.push(`/dashboard/projects/${project.slug}/events`)}
                    className="bg-white rounded-xl shadow-md overflow-hidden cursor-pointer hover:shadow-lg transition-shadow"
                  >
                    {/* Preview - Always use iframe with demo route as fallback */}
                    <div className="h-48 bg-gray-50 relative overflow-hidden" style={{ minHeight: '192px' }}>
                      <iframe
                        src={previewUrl}
                        className="w-full h-full border-0"
                        style={{ pointerEvents: 'none' }}
                        title={`Preview of ${project.name}`}
                      />
                      {/* Subtle overlay for better text readability */}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/5 to-transparent pointer-events-none" />
                    </div>

                    {/* Project Info */}
                    <div className="p-4">
                      <h3 className="font-semibold text-lg mb-1 truncate">
                        {project.name || "Unnamed Project"}
                      </h3>
                      <div className="flex items-center gap-2 text-sm text-gray-500">
                        <BsClock className="text-xs" />
                        <span>Updated {getTimeAgo(project.updatedAt)}</span>
                      </div>
                      {project.events && project.events.length > 0 && (
                        <p className="text-xs text-gray-400 mt-1">
                          {project.events.length} event{project.events.length !== 1 ? 's' : ''}
                        </p>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>

      </div>
    </MainLayout>
  );
};

export default Dashboard;
