"use client";

import { useRouter } from "next/router";
import { BsThreeDotsVertical, BsFolder } from "react-icons/bs";
import { AssetInstance } from "@/store/sceneStore";
import WorkspacePreview from "@/components/WorkspacePreview";

interface EventData {
  _id: string;
  name: string;
  canvasAssets: AssetInstance[];
  // Include canvasData type if we want to pass it to preview
  canvasData?: any;
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

interface ProjectCardProps {
  project: ProjectData;
}

export default function ProjectCard({ project }: ProjectCardProps) {
  const router = useRouter();

  // Calculate time since last update
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

  // Get the last event worked on (most recently updated) for preview
  const lastEvent = project?.events && project.events.length > 0
    ? [...project.events].sort((a, b) =>
      new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    )[0]
    : null;

  return (
    <div
      onClick={() => router.push(`/dashboard/projects/${project?.slug || ""}/events`)}
      className="bg-white rounded-lg border border-gray-200 overflow-hidden cursor-pointer hover:border-blue-300 transition-colors group relative flex flex-col"
    >
      {/* Three dots - Top Right */}
      <button
        className='absolute top-2 right-2 z-10 p-1.5 rounded-full bg-white/90 backdrop-blur-sm shadow-md hover:bg-white text-gray-400 hover:text-gray-700 transition-colors'
        onClick={(e) => {
          e.stopPropagation();
          // TODO: Open context menu
        }}
      >
        <BsThreeDotsVertical className='text-sm' />
      </button>

      {/* Preview Area - Matches EventCard Aspect Ratio */}
      <div className="bg-gray-50 w-full relative overflow-hidden flex items-center justify-center" style={{ aspectRatio: '2.5/1', height: '160px' }}>
        {lastEvent ? (
          // If we have an event, try to show its workspace preview (requires previewData props which we might not have fully normalized here without helpers, or simplified)
          // For now, simpler to use a folder icon or if we have canvasData, render WorkspacePreview.
          // ProjectData typically doesn't include full CanvasData for all events unless we fetched it.
          // Given the previous architecture, we might just use a placeholder styling OR if we have keys.
          <div className="w-full h-full bg-blue-50/50 flex flex-col items-center justify-center text-blue-300">
            <BsFolder className="text-4xl mb-2" />
            <span className="text-xs font-medium">{project.events.length} Events</span>
          </div>
        ) : (
          <div className="w-full h-full bg-gray-50 flex flex-col items-center justify-center text-gray-300">
            <BsFolder className="text-4xl mb-2" />
            <span className="text-xs font-medium">Empty</span>
          </div>
        )}
      </div>

      {/* Footer Info */}
      <div className="p-4 mt-auto">
        <h3 className="font-semibold text-sm mb-1 truncate text-gray-800 group-hover:text-blue-600 transition-colors">
          {project?.name || "Unnamed Project"}
        </h3>
        <p className="text-xs text-gray-500">
          Updated {getTimeAgo(project?.updatedAt || new Date().toISOString())}
        </p>
      </div>
    </div>
  );
}
