"use client";

import { BsStars, BsClock, BsCalendar, BsSearch, BsBoxArrowUpRight, BsStar, BsStarFill } from "react-icons/bs";
import { useUserStore } from "@/store/userStore";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/helpers/Config";
import { useRouter } from "next/router";
import { motion } from "framer-motion";
import WorkspacePreview from "@/components/WorkspacePreview";
import DashboardSidebar from "@/pages/(components)/DashboardSidebar";
import CreateEventModal from "@/pages/(components)/projects/CreateEventModal";
import { ASSET_LIBRARY } from "@/lib/assets";
import EventCard from "@/components/dashboard/EventCard";
import ProjectFolder from "@/components/dashboard/ProjectFolder";

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
  favourites?: string[]; // Array of user IDs
  favorites?: string[]; // Support US spelling
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
  const [searchQuery, setSearchQuery] = useState("");
  const [showCreateEventModal, setShowCreateEventModal] = useState(false);

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

  // Fetch events for all projects separately to get full event data
  // CRITICAL: Fetch each event individually to get full canvasData
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
              console.log(`[Dashboard] Fetching full event data from DATABASE: ${project.slug}/${event._id}`);
              const fullEventRes = await apiRequest(`/projects/${project.slug}/events/${event._id}`, "GET", null, true);
              const fullEvent = fullEventRes.data || fullEventRes;
              console.log(`[Dashboard] ✅ Fetched full event data from DATABASE: ${event._id}`, {
                hasCanvasData: !!fullEvent.canvasData,
                canvasDataWalls: fullEvent.canvasData?.walls?.length || 0,
                canvasDataShapes: fullEvent.canvasData?.shapes?.length || 0,
                canvasDataAssets: fullEvent.canvasData?.assets?.length || 0,
                hasCanvasAssets: !!fullEvent.canvasAssets,
                canvasAssetsCount: fullEvent.canvasAssets?.length || 0,
              });
              return fullEvent;
            } catch (error: any) {
              console.error(`[Dashboard] ❌ Failed to fetch full event ${event._id} from DATABASE:`, {
                error: error.message,
                isCorsError: error.message?.includes('CORS'),
                eventId: event._id,
                projectSlug: project.slug,
              });
              // Return basic event data if full fetch fails
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
          console.error(`[Dashboard] ❌ Failed to fetch events for project ${project.slug} from DATABASE:`, {
            error: error.message,
            isCorsError: error.message?.includes('CORS'),
            projectSlug: project.slug,
          });
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
    staleTime: 0, // Always refetch
    gcTime: 0, // Don't cache
    refetchOnMount: true, // Always refetch on mount
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

  // Filter events by search query
  const filteredEvents = useMemo(() => {
    if (!searchQuery) return allEvents;
    const query = searchQuery.toLowerCase();
    return allEvents.filter(event =>
      event.name?.toLowerCase().includes(query) ||
      event.projectName?.toLowerCase().includes(query)
    );
  }, [allEvents, searchQuery]);

  const getTimeAgo = (dateString: string | undefined) => {
    if (!dateString) return "Recently";

    const now = new Date();
    const updated = new Date(dateString);

    if (isNaN(updated.getTime())) return "Recently";

    const diffInMs = now.getTime() - updated.getTime();
    const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));

    if (diffInDays === 0) return "Edited now";
    if (diffInDays === 1) return "Edited yesterday";
    if (diffInDays < 7) return `Edited ${diffInDays} days ago`;
    if (diffInDays < 30) return `Edited ${Math.floor(diffInDays / 7)} weeks ago`;
    return `Edited ${Math.floor(diffInDays / 30)} months ago`;
  };

  // Normalize event data into preview-friendly shapes/walls/assets
  // IMPORTANT: This should ONLY use data from the database (event parameter), NOT localStorage
  const buildPreviewData = (event: EventData) => {
    // PRIORITY 1: Use canvasData if available (preferred format)
    const walls = (event.canvasData?.walls as any[]) || [];
    const rawShapes = (event.canvasData?.shapes as any[]) || [];
    const rawAssets = (event.canvasData?.assets as any[]) || [];

    // Normalize shapes to ensure fill property is set - match ShapeRenderer logic
    // Preserve ALL properties including width, height, x, y, etc.
    const shapes = rawShapes.map((s: any) => {
      // Use fill if it exists and is not empty/transparent, otherwise use backgroundColor, otherwise transparent
      const fill = (s.fill && s.fill !== 'transparent' && s.fill !== '')
        ? s.fill
        : (s.backgroundColor && s.backgroundColor !== 'transparent' && s.backgroundColor !== '')
          ? s.backgroundColor
          : 'transparent';
      return {
        ...s, // Preserve all original properties (width, height, x, y, rotation, stroke, strokeWidth, etc.)
        fill: fill, // Override fill with normalized value
      };
    });

    // Debug log to verify dimensions are preserved
    if (shapes.length > 0) {
      console.log(`[Dashboard] Normalized shapes with dimensions:`, shapes.map((s: any) => ({
        id: s.id,
        type: s.type,
        width: s.width,
        height: s.height,
        x: s.x,
        y: s.y,
        fill: s.fill,
      })));
    }

    // Normalize assets to ensure fillColor property is set
    const assets = rawAssets.map((a: any) => ({
      ...a,
      fillColor: a.fillColor || a.backgroundColor || '#3B82F6',
    }));

    // If canvasData already has preview data, use it
    if (walls.length > 0 || shapes.length > 0 || assets.length > 0) {
      console.log(`[Dashboard] Using canvasData for preview:`, {
        eventId: event._id,
        walls: walls.length,
        shapes: shapes.length,
        assets: assets.length,
        sampleShape: shapes[0] ? {
          id: shapes[0].id,
          type: shapes[0].type,
          width: shapes[0].width,
          height: shapes[0].height,
          x: shapes[0].x,
          y: shapes[0].y,
          fill: shapes[0].fill,
        } : null,
      });
      return { walls, shapes, assets };
    }

    // PRIORITY 2: Fallback to canvasAssets (most events use this format)
    console.log(`[Dashboard] canvasData empty, using canvasAssets for preview:`, {
      eventId: event._id,
      hasCanvasAssets: !!event.canvasAssets,
      canvasAssetsCount: event.canvasAssets?.length || 0,
    });

    // Fallback: derive preview data from canvasAssets (new editor format)
    const fallbackWalls: any[] = [];
    const fallbackShapes: any[] = [];
    const fallbackAssets: any[] = [];

    if (event.canvasAssets && Array.isArray(event.canvasAssets)) {
      console.log(`[Dashboard] Building preview from canvasAssets for event ${event._id}:`, {
        canvasAssetsCount: event.canvasAssets.length,
        assetTypes: event.canvasAssets.map((a: any) => a.type),
      });

      event.canvasAssets.forEach((asset: any) => {
        // Handle wall-polygon type (new format)
        if (asset.type === "wall-polygon" && asset.wallPolygon && Array.isArray(asset.wallPolygon)) {
          // Convert wall-polygon to wall format with nodes and edges
          const wallNodes = asset.wallPolygon.map((point: any, idx: number) => ({
            id: `node-${asset.id}-${idx}`,
            x: asset.x + (point.x || 0),
            y: asset.y + (point.y || 0),
          }));

          // Create edges connecting consecutive nodes
          const wallEdges = [];
          for (let i = 0; i < wallNodes.length; i++) {
            const nextIdx = (i + 1) % wallNodes.length;
            wallEdges.push({
              id: `edge-${asset.id}-${i}`,
              nodeA: wallNodes[i].id,
              nodeB: wallNodes[nextIdx].id,
              thickness: asset.wallThickness || 75,
            });
          }

          if (wallNodes.length > 0 && wallEdges.length > 0) {
            fallbackWalls.push({
              id: asset.id,
              nodes: wallNodes,
              edges: wallEdges,
              zIndex: asset.zIndex || 0,
            });
          }
        }
        // Handle wall-segments type (legacy format)
        else if (asset.type === "wall-segments" && asset.wallNodes && asset.wallEdges) {
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
        }
        // Handle line-segment type (convert to line shape)
        else if (asset.type === "line-segment" && asset.startPoint && asset.endPoint) {
          // Convert line-segment to line shape format
          const startX = asset.startPoint.x || asset.x;
          const startY = asset.startPoint.y || asset.y;
          const endX = asset.endPoint.x || (asset.x + asset.width);
          const endY = asset.endPoint.y || (asset.y + asset.height);

          fallbackShapes.push({
            id: asset.id,
            type: "line",
            x: (startX + endX) / 2, // Center point
            y: (startY + endY) / 2, // Center point
            width: Math.sqrt(Math.pow(endX - startX, 2) + Math.pow(endY - startY, 2)), // Length
            height: 2, // Line thickness
            rotation: asset.rotation || 0,
            fill: asset.backgroundColor || "transparent",
            stroke: asset.strokeColor || "#3B82F6",
            strokeWidth: asset.strokeWidth || 2,
            points: [
              { x: startX - (startX + endX) / 2, y: startY - (startY + endY) / 2 },
              { x: endX - (startX + endX) / 2, y: endY - (startY + endY) / 2 },
            ],
            zIndex: asset.zIndex || 0,
          });
        }
        // Handle standard shape types (rectangle, ellipse, line, arrow, freehand)
        else if (
          asset.type &&
          ["rectangle", "ellipse", "line", "arrow", "freehand"].includes(asset.type)
        ) {
          // Use reasonable defaults for missing dimensions
          const defaultWidth = asset.width || 100;
          const defaultHeight = asset.height || 100;

          fallbackShapes.push({
            id: asset.id,
            type: asset.type,
            x: asset.x || 0,
            y: asset.y || 0,
            width: defaultWidth,
            height: defaultHeight,
            rotation: asset.rotation || 0,
            fill: asset.fillColor || asset.backgroundColor || asset.fill || 'transparent',
            stroke: asset.strokeColor || asset.stroke || "#1E40AF",
            strokeWidth: asset.strokeWidth || 2,
            points: asset.points,
            zIndex: asset.zIndex || 0,
          });

          console.log(`[Dashboard] Converted ${asset.type} shape for preview:`, {
            id: asset.id,
            x: asset.x,
            y: asset.y,
            width: defaultWidth,
            height: defaultHeight,
          });
        }
        // Handle other asset types (furniture, etc.)
        else if (asset.type) {
          // Use reasonable defaults based on asset type for preview
          let defaultWidth = asset.width || 100;
          let defaultHeight = asset.height || 100;

          if (asset.type.includes('chair')) {
            defaultWidth = asset.width || 80;
            defaultHeight = asset.height || 80;
          } else if (asset.type.includes('table') || asset.type.includes('cocktail')) {
            defaultWidth = asset.width || 200;
            defaultHeight = asset.height || 200;
          }

          fallbackAssets.push({
            id: asset.id,
            type: asset.type, // Preserve the original type so ASSET_LIBRARY lookup works
            x: asset.x || 0,
            y: asset.y || 0,
            width: defaultWidth,
            height: defaultHeight,
            rotation: asset.rotation || 0,
            scale: asset.scale || 1,
            fillColor: asset.fillColor || asset.backgroundColor,
            strokeColor: asset.strokeColor,
            strokeWidth: asset.strokeWidth,
            opacity: asset.opacity,
            zIndex: asset.zIndex || 0,
          });

          // Debug: Log asset type to help identify mismatches
          if (asset.type) {
            console.log(`[Dashboard] Building preview asset:`, {
              id: asset.id,
              type: asset.type,
              hasDefinition: !!ASSET_LIBRARY.find(a => a.id === asset.type),
            });
          }

          console.log(`[Dashboard] Converted ${asset.type} asset for preview:`, {
            id: asset.id,
            x: asset.x,
            y: asset.y,
            width: defaultWidth,
            height: defaultHeight,
          });
        }
      });

      console.log(`[Dashboard] Built preview data for event ${event._id}:`, {
        walls: fallbackWalls.length,
        shapes: fallbackShapes.length,
        assets: fallbackAssets.length,
        shapesData: fallbackShapes.map(s => ({ id: s.id, type: s.type, x: s.x, y: s.y, width: s.width, height: s.height })),
      });
    }

    const result = { walls: fallbackWalls, shapes: fallbackShapes, assets: fallbackAssets };
    console.log(`[Dashboard] Final preview data for event ${event._id}:`, {
      totalWalls: result.walls.length,
      totalShapes: result.shapes.length,
      totalAssets: result.assets.length,
      hasAnyContent: result.walls.length > 0 || result.shapes.length > 0 || result.assets.length > 0,
    });
    return result;
  };

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
                My Events
              </h1>
              <p className="text-sm text-gray-500 mt-1">Manage and organize your event spaces</p>
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
                onClick={() => setShowCreateEventModal(true)}
                className="px-5 py-2.5 text-sm font-semibold bg-[var(--accent)] text-white rounded-xl hover:opacity-90 flex items-center gap-2 shadow-md transition-opacity"
              >
                <BsStars className="w-4 h-4" />
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

          {/* New User Empty State - Unified View */}
          {!isLoading && !isLoadingEvents && (!data?.data || data.data.length === 0) && !searchQuery ? (
            <div className="flex flex-col items-center justify-center h-full max-h-[60vh] text-center space-y-6 animate-in fade-in zoom-in duration-500">
              <div className="w-24 h-24 bg-blue-50 rounded-full flex items-center justify-center mb-4 shadow-sm">
                <svg className="w-10 h-10 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
              </div>
              <div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Welcome to EventSpacePro</h2>
                <p className="text-gray-500 max-w-md mx-auto text-lg mb-8">
                  You don't have any projects yet. Create your first project to start organizing your events and layouts.
                </p>
                <a
                  href="/dashboard/projects"
                  className="px-8 py-4 bg-blue-600 text-white text-lg rounded-xl font-semibold hover:bg-blue-700 transition-all shadow-lg hover:shadow-xl active:scale-95 transform transition-transform inline-flex items-center gap-2"
                >
                  <BsBoxArrowUpRight className="w-5 h-5" />
                  <span>Create First Project</span>
                </a>
              </div>
            </div>
          ) : (
            <>
              {/* Projects Folders Section */}
              <div className="mb-10">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-bold text-gray-800">Projects</h2>
                  <a href="/dashboard/projects" className="text-sm font-medium text-blue-600 hover:text-blue-700 flex items-center gap-1">
                    Manage Projects <BsBoxArrowUpRight className="w-3 h-3" />
                  </a>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6">
                  {isLoading ? (
                    [1, 2, 3, 4, 5].map((i) => (
                      <div key={i} className="h-40 bg-gray-100 rounded-2xl animate-pulse" />
                    ))
                  ) : (
                    data?.data?.slice(0, 5).map((project) => (
                      <ProjectFolder key={project._id} project={project} />
                    ))
                  )}

                  {/* Fallback empty state for search results or weird states */}
                  {!isLoading && (!data?.data || data.data.length === 0) && (
                    <div className="col-span-full py-8 text-center text-gray-500 italic">
                      No projects found matching your search.
                    </div>
                  )}
                </div>
              </div>

              {/* Events Section */}
              <div className="mb-10">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-bold text-gray-800">Recent Events</h2>
                  <div className="flex items-center gap-4">
                    <span className="text-sm text-gray-500">{filteredEvents.length} {filteredEvents.length === 1 ? 'event' : 'events'}</span>
                    <a href="/dashboard/projects" className="text-sm font-medium text-blue-600 hover:text-blue-700 flex items-center gap-1">
                      View all <BsBoxArrowUpRight className="w-3 h-3" />
                    </a>
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
                ) : filteredEvents.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 text-center space-y-6 animate-in fade-in zoom-in duration-500">
                    <div className="w-24 h-24 bg-[var(--accent)]/10 rounded-full flex items-center justify-center mb-4">
                      <BsStars className="w-12 h-12 text-[var(--accent)]" />

                    </div>
                    <h2 className="text-3xl font-bold text-gray-800">Start Creating Today</h2>
                    <p className="text-gray-500 max-w-md text-lg">
                      Create your first event to start designing layouts and organizing spaces.
                    </p>
                    <button
                      onClick={() => setShowCreateEventModal(true)}
                      className="px-8 py-4 text-lg font-semibold bg-[var(--accent)] text-white rounded-xl hover:opacity-90 flex items-center gap-2 shadow-lg hover:shadow-xl transition-all"
                    >
                      <BsStars className="w-5 h-5" />
                      <span>Create New Event</span>
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {filteredEvents.slice(0, 6).map((event) => {
                      const { walls, shapes, assets } = buildPreviewData(event);
                      return (
                        <EventCard
                          key={event._id}
                          event={event}
                          user={user}
                          previewData={{ walls, shapes, assets }}
                        />
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Templates Section */}
              <div>
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
                      <h3 className="font-semibold text-sm text-gray-800">Outdoor</h3>
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
              </div>
            </>
          )}

        </div>
      </div>
    </div>
  );
};

export default Dashboard;