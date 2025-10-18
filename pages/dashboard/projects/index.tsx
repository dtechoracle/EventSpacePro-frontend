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
  <div className='relative w-full h-60 rounded-3xl overflow-hidden bg-gradient-to-br from-gray-100 to-gray-200'>
    {/* Background shimmer - matching the actual ProjectCard's gradient */}
    <div className='absolute inset-0 bg-gradient-to-br from-gray-100 to-gray-200'>
      <div className='absolute -top-10 -left-10 w-40 h-40 bg-cyan-300/70 rounded-full blur-3xl opacity-70' />
      <div className='absolute top-10 right-10 w-32 h-32 bg-yellow-300/70 rounded-full blur-3xl opacity-70' />
      <div className='absolute bottom-10 left-1/3 w-32 h-32 bg-blue-300/70 rounded-full blur-3xl opacity-70' />
    </div>

    {/* Shimmer animation overlay */}
    <div className='absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-shimmer'></div>

    {/* Frosted overlay shimmer */}
    <div className='absolute inset-0 bg-white/40 backdrop-blur-lg'></div>

    {/* Stylized grooves */}
    <div className='absolute top-0 left-0 w-full h-6 flex items-center justify-between px-4'>
      <div className='w-10 h-1 bg-black/20 rounded-full animate-pulse' />
      <div className='w-10 h-1 bg-black/20 rounded-full animate-pulse' />
    </div>

    {/* Content shimmer */}
    <div className='absolute bottom-0 left-0 w-full p-4 flex justify-between items-end'>
      <div className='flex-1'>
        <div className='h-5 bg-black/20 rounded w-3/4 mb-2 animate-pulse'></div>
        <div className='h-4 bg-gray-500/30 rounded w-1/2 animate-pulse'></div>
      </div>
      <div className='w-8 h-8 bg-black/20 rounded-full animate-pulse'></div>
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
      <div className='w-full min-h-screen'>
        <TopBar mainText='My Projects' subText='Recents' type='project' />

        {isLoading && (
          <div className='grid grid-cols-4 gap-3 pl-6'>
            {Array.from({ length: 8 }).map((_, index) => (
              <ProjectCardShimmer key={index} />
            ))}
          </div>
        )}

        {error && (
          <div className='flex justify-center items-center h-64'>
            <p className='text-red-500'>Error loading projects</p>
          </div>
        )}

        {data && data.data && (
          <div className='grid grid-cols-4 gap-3 pl-6'>
            {data.data.map((project) => (
              <ProjectCard
                key={project?._id || Math.random()}
                project={project}
              />
            ))}
          </div>
        )}

        {data && data.data && data.data.length === 0 && (
          <div className='flex justify-center items-center h-64'>
            <p className='text-gray-500'>
              No projects found. Create your first project!
            </p>
          </div>
        )}
      </div>
    </MainLayout>
  );
};

export default Projects;
