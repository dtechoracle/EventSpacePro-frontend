"use client";

import { useRouter } from "next/router";
import { BsThreeDotsVertical, BsFolder, BsGrid } from "react-icons/bs";
import { AssetInstance } from "@/store/sceneStore";
import WorkspacePreview from "@/components/WorkspacePreview";
import { buildPreviewData } from "@/helpers/previewHelpers";
import { useMemo } from "react";

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
  const lastEvent = useMemo(() => {
    if (!project?.events || project.events.length === 0) return null;
    return [...project.events].sort((a, b) =>
      new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    )[0];
  }, [project?.events]);

  const previewData = useMemo(() => {
    if (!lastEvent) return null;
    return buildPreviewData(lastEvent);
  }, [lastEvent]);

  return (
    <div
      onClick={() => router.push(`/dashboard/projects/${project?.slug || ""}/events`)}
      className="bg-white rounded-xl border border-gray-200 overflow-hidden cursor-pointer hover:shadow-lg hover:border-blue-300 transition-all group relative flex flex-col h-full"
    >
      {/* Three dots - Top Right */}
      <button
        className='absolute top-2 right-2 z-10 p-1.5 rounded-full bg-white/90 backdrop-blur-sm shadow-sm hover:bg-white text-gray-400 hover:text-gray-700 transition-colors opacity-0 group-hover:opacity-100'
        onClick={(e) => {
          e.stopPropagation();
          // TODO: Open context menu
        }}
      >
        <BsThreeDotsVertical className='text-sm' />
      </button>

      {/* Preview Area */}
      <div className="bg-gray-50 w-full relative overflow-hidden flex items-center justify-center border-b border-gray-100" style={{ height: '180px' }}>
        {previewData ? (
          <div className="w-full h-full relative">
            <WorkspacePreview
              walls={previewData.walls}
              shapes={previewData.shapes}
              assets={previewData.assets}
              width={400}
              height={180}
              backgroundColor="#ffffff"
            />
            {/* Overlay for Event Name */}
            <div className="absolute bottom-2 left-2 bg-black/50 backdrop-blur-sm text-white text-[10px] px-2 py-0.5 rounded-full max-w-[90%] truncate">
              Last edited: {lastEvent?.name}
            </div>
          </div>
        ) : (
          <div className="w-full h-full bg-gray-50 flex flex-col items-center justify-center text-gray-300">
            <BsGrid className="text-4xl mb-2 opacity-20" />
            <span className="text-xs font-medium text-gray-400">Empty Project</span>
          </div>
        )}
      </div>

      {/* Footer Info */}
      <div className="p-5 mt-auto bg-white">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-base mb-1 truncate text-gray-900 group-hover:text-blue-600 transition-colors">
              {project?.name || "Unnamed Project"}
            </h3>
            <p className="text-xs text-gray-500">
              {project.events?.length || 0} {(project.events?.length === 1) ? 'event' : 'events'} • Updated {getTimeAgo(project?.updatedAt || new Date().toISOString())}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
