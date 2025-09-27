"use client";

import { useRouter } from "next/router";
import { BsThreeDotsVertical } from "react-icons/bs";
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

  // Get total collaborators (users + pending invites)
  // const totalCollaborators = project.users.length + project.invites.length;

  return (
    <div 
      className="relative w-full h-60 rounded-3xl overflow-hidden shadow-lg cursor-pointer" 
      onClick={() => router.push(`/dashboard/projects/${project?.slug || ''}/events`)}
    >
      {/* Background with placeholder circles */}
      <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-gray-100 to-gray-200">
        <div className="absolute -top-10 -left-10 w-40 h-40 bg-green-300 rounded-full blur-3xl opacity-70" />
        <div className="absolute top-10 right-10 w-32 h-32 bg-yellow-300 rounded-full blur-3xl opacity-70" />
        <div className="absolute bottom-10 left-1/3 w-32 h-32 bg-blue-300 rounded-full blur-3xl opacity-70" />
      </div>

      {/* Frosted overlay */}
      <div className="absolute inset-0 bg-white/40 backdrop-blur-lg"></div>

      {/* Stylized grooves */}
      <div className="absolute top-0 left-0 w-full h-6 flex items-center justify-between px-4">
        <div className="w-10 h-1 bg-black rounded-full" />
        <div className="w-10 h-1 bg-black rounded-full" />
      </div>

      {/* Content */}
      <div className="absolute bottom-0 left-0 w-full p-4 flex justify-between items-end">
        <div>
          <h3 className="text-lg font-semibold text-black truncate">{project?.name || 'Unnamed Project'}</h3>
          <p className="text-sm text-gray-600">Updated {getTimeAgo(project?.updatedAt || new Date().toISOString())}</p>
          {/* <p className="text-xs text-gray-500 mt-1">{totalCollaborators} collaborator{totalCollaborators !== 1 ? 's' : ''}</p> */}
        </div>
        <button 
          className="p-2 rounded-full hover:bg-black/10"
          onClick={(e) => e.stopPropagation()}
        >
          <BsThreeDotsVertical className="text-xl text-gray-700" />
        </button>
      </div>
    </div>
  );
}

