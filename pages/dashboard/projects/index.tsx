"use client";

import ProjectCard from "../../(components)/projects/ProjectCard";
import MainLayout from "../../layouts/MainLayout";
import TopBar from "../../(components)/projects/TopBar";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/helpers/Config";
import { ImSpinner8 } from "react-icons/im";
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

const Projects = () => {
  const { data, isLoading, error } = useQuery<ApiResponse>({
    queryKey: ["projects"],
    queryFn: () => apiRequest("/projects", "GET", null, true),
  });

  return (
    <MainLayout>
      <div className="w-full min-h-screen">
        <TopBar mainText="My Projects" subText="Recents" type="project"/>
        
        {isLoading && (
          <div className="flex justify-center items-center h-64">
            <ImSpinner8 size={40} className="animate-spin text-gray-400" />
          </div>
        )}

        {error && (
          <div className="flex justify-center items-center h-64">
            <p className="text-red-500">Error loading projects</p>
          </div>
        )}

        {data && data.data && (
          <div className="grid grid-cols-4 gap-3 pl-6">
            {data.data.map((project) => (
              <ProjectCard key={project?._id || Math.random()} project={project} />
            ))}
          </div>
        )}

        {data && data.data && data.data.length === 0 && (
          <div className="flex justify-center items-center h-64">
            <p className="text-gray-500">No projects found. Create your first project!</p>
          </div>
        )}
      </div>
    </MainLayout>
  );
};

export default Projects;
