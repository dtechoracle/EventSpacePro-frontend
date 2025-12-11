"use client";

import MainLayout from "../layouts/MainLayout";
import { BsStars, BsClock, BsCalendar } from "react-icons/bs";
import { useUserStore } from "@/store/userStore";
import { useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/helpers/Config";
import { useRouter } from "next/router";
import { motion } from "framer-motion";
import WorkspacePreview from "@/components/WorkspacePreview";

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

  // Fetch events for all projects separately to get full event data
  const { data: allProjectEvents, isLoading: isLoadingEvents } = useQuery({
    queryKey: ["all-events", data?.data?.map(p => p.slug)],
    queryFn: async () => {
      if (!data?.data) return [];

      // Fetch events for each project
      const eventPromises = data.data.map(project =>
        apiRequest(`/projects/${project.slug}/events`, "GET", null, true)
          .then(res => ({
            projectSlug: project.slug,
            projectName: project.name,
            projectId: project._id,
            events: res.data || []
          }))
          .catch(() => ({
            projectSlug: project.slug,
            projectName: project.name,
            projectId: project._id,
            events: []
          }))
      );

      return Promise.all(eventPromises);
    },
    enabled: !!data?.data && data.data.length > 0,
  });

  // Flatten all events from separately fetched event data
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

    // Sort by most recently updated, with fallback to createdAt
    return events.sort((a, b) => {
      const dateA = new Date(a.updatedAt || a.createdAt).getTime();
      const dateB = new Date(b.updatedAt || b.createdAt).getTime();
      return dateB - dateA;
    });
  }, [allProjectEvents]);

  // Get recent events (limit to 6)
  const recentEvents = allEvents.slice(0, 6);

  const getTimeAgo = (dateString: string | undefined) => {
    if (!dateString) return "Recently";

    const now = new Date();
    const updated = new Date(dateString);

    if (isNaN(updated.getTime())) return "Recently";

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
  const totalEvents = allEvents.length;

  // Normalize event data into preview-friendly shapes/walls/assets
  const buildPreviewData = (event: EventData) => {
    const walls = (event.canvasData?.walls as any[]) || [];
    const shapes = (event.canvasData?.shapes as any[]) || [];
    const assets = (event.canvasData?.assets as any[]) || [];

    // If canvasData already has preview data, use it
    if (walls.length > 0 || shapes.length > 0 || assets.length > 0) {
      return { walls, shapes, assets };
    }

    // Fallback: derive preview data from canvasAssets (new editor format)
    const fallbackWalls: any[] = [];
    const fallbackShapes: any[] = [];
    const fallbackAssets: any[] = [];

    if (event.canvasAssets && Array.isArray(event.canvasAssets)) {
      event.canvasAssets.forEach((asset: any) => {
        if (asset.type === "wall-segments" && asset.wallNodes && asset.wallEdges) {
          const wallNodes = asset.wallNodes.map((node: any, idx: number) => ({
            id: `node-${asset.id}-${idx}`,
            x: node.x,
            y: node.y,
          }));

          const wallEdges = asset.wallEdges.map((edge: any, idx: number) => ({
            id: `edge-${asset.id}-${idx}`,
            nodeA: wallNodes[edge.a]?.id || "",
            nodeB: wallNodes[edge.b]?.id || "",
            thickness: asset.wallThickness || 75,
          }));

          fallbackWalls.push({
            id: asset.id,
            nodes: wallNodes,
            edges: wallEdges,
            zIndex: asset.zIndex || 0,
          });
        } else if (
          asset.type &&
          ["rectangle", "ellipse", "line", "arrow", "freehand"].includes(asset.type)
        ) {
          fallbackShapes.push({
            id: asset.id,
            type: asset.type,
            x: asset.x,
            y: asset.y,
            width: asset.width || 50,
            height: asset.height || 50,
            rotation: asset.rotation || 0,
            fill: asset.fillColor,
            stroke: asset.strokeColor,
            strokeWidth: asset.strokeWidth,
            points: asset.points,
            zIndex: asset.zIndex || 0,
          });
        } else if (asset.type) {
          fallbackAssets.push({
            id: asset.id,
            type: asset.type,
            x: asset.x,
            y: asset.y,
            width: asset.width || 50,
            height: asset.height || 50,
            rotation: asset.rotation || 0,
            scale: asset.scale || 1,
            zIndex: asset.zIndex || 0,
          });
        }
      });
    }

    return { walls: fallbackWalls, shapes: fallbackShapes, assets: fallbackAssets };
  };

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

        {/* Quick Stats Section */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
          <div className="bg-white rounded-xl p-6 shadow-md">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-500 text-sm mb-1">Total Projects</p>
                <p className="text-3xl font-bold">{totalProjects}</p>
              </div>
              <BsCalendar className="text-3xl text-[var(--accent)] opacity-50" />
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
        </div>

        {/* Recent Events Section */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <BsCalendar className="text-xl text-gray-600" />
              <h2 className="text-2xl font-semibold">Recent Events</h2>
            </div>
            <button
              onClick={() => router.push("/dashboard/projects")}
              className="text-[var(--accent)] hover:underline text-sm"
            >
              View all projects
            </button>
          </div>

          {(isLoading || isLoadingEvents) ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div
                  key={i}
                  className="bg-gray-100 rounded-xl h-64 animate-pulse"
                />
              ))}
            </div>
          ) : recentEvents.length === 0 ? (
            <div className="bg-gray-50 rounded-xl p-12 text-center">
              <BsCalendar className="text-4xl text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500 mb-4">No events yet</p>
              <button
                onClick={() => router.push("/dashboard/projects")}
                className="bg-[var(--accent)] text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition"
              >
                Create your first event
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {recentEvents.map((event) => {
                // Extract workspace data (with fallback from canvasAssets)
                const { walls, shapes, assets } = buildPreviewData(event);

                return (
                  <motion.div
                    key={event._id}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => router.push(`/dashboard/editor/${event.projectSlug}/${event._id}`)}
                    className="bg-white rounded-xl shadow-md overflow-hidden cursor-pointer hover:shadow-lg transition-shadow"
                  >
                    {/* Workspace Preview - Auto-cropped */}
                    <div className="relative">
                      <WorkspacePreview
                        walls={walls}
                        shapes={shapes}
                        assets={assets}
                        width={400}
                        height={192}
                        backgroundColor="#f9fafb"
                      />
                      {/* Subtle overlay for better text readability */}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/5 to-transparent pointer-events-none" />
                    </div>

                    {/* Event Info */}
                    <div className="p-4">
                      <h3 className="font-semibold text-lg mb-1 truncate">
                        {event.name || "Unnamed Event"}
                      </h3>
                      <p className="text-xs text-gray-400 mb-2 truncate">
                        {event.projectName || "Unknown Project"}
                      </p>
                      <div className="flex items-center gap-2 text-sm text-gray-500">
                        <BsClock className="text-xs" />
                        <span>Updated {getTimeAgo(event.updatedAt || event.createdAt)}</span>
                      </div>
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
