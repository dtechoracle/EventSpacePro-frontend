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

  // Get the last event worked on (most recently updated)
  const lastEvent = project?.events && project.events.length > 0
    ? [...project.events].sort((a, b) => 
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      )[0]
    : null;

  return (
    <div
      className='relative w-full min-h-[220px] rounded-3xl overflow-hidden shadow-lg cursor-pointer transition hover:-translate-y-1 hover:shadow-xl'
      onClick={() =>
        router.push(`/dashboard/projects/${project?.slug || ""}/events`)
      }
    >
      {/* Background: Show event preview if available, otherwise show gradient */}
      {lastEvent && lastEvent._id ? (
        <div className='absolute inset-0'>
          <iframe
            src={`/dashboard/editor/${project.slug}/${lastEvent._id}?preview=true`}
            className="w-full h-full border-0"
            style={{ pointerEvents: 'none' }}
            title={`Preview of ${project.name}`}
          />
          {/* Frosted overlay for better text readability */}
          <div className='absolute inset-0 bg-white/30 backdrop-blur-sm pointer-events-none'></div>
        </div>
      ) : (
        <>
          {/* Background with placeholder circles */}
          <div className='absolute inset-0 flex items-center justify-center bg-gradient-to-br from-[#E0EAFF] via-[#D4E4FF] to-[#C7D2FE]'>
            <div className='absolute -top-10 -left-10 w-40 h-40 bg-blue-200 rounded-full blur-3xl opacity-70' />
            <div className='absolute top-8 right-6 w-32 h-32 bg-sky-200 rounded-full blur-3xl opacity-60' />
            <div className='absolute bottom-8 left-1/3 w-32 h-32 bg-indigo-200 rounded-full blur-3xl opacity-60' />
          </div>
          {/* Frosted overlay */}
          <div className='absolute inset-0 bg-white/40 backdrop-blur-lg'></div>
        </>
      )}

      {/* Content */}
      <div className='absolute bottom-0 left-0 flex w-full items-end justify-between p-4'>
        <div>
          <h3 className='truncate text-lg font-semibold text-black'>
            {project?.name || "Unnamed Project"}
          </h3>
          <p className='text-sm text-gray-600'>
            Updated {getTimeAgo(project?.updatedAt || new Date().toISOString())}
          </p>
        </div>
        <button
          className='rounded-full p-2 hover:bg-black/10'
          onClick={(e) => e.stopPropagation()}
        >
          <BsThreeDotsVertical className='text-xl text-gray-700' />
        </button>
      </div>
    </div>
  );
}
