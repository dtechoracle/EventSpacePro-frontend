"use client";

import ProjectCard from "../../(components)/projects/ProjectCard";
import MainLayout from "../../layouts/MainLayout";
import TopBar from "../../(components)/projects/TopBar";

const projects = () => {
  return (
    <MainLayout>
      <div className="w-full min-h-screen">
        <TopBar mainText="My Projects" subText="Recents"/>
        <div className="grid grid-cols-4 gap-3 pl-6">
          {
            Array.from({ length: 8 }).map((_, i) => (
              <ProjectCard key={i} id={i} />
            ))
          }
        </div>
      </div>
    </MainLayout>
  );
};

export default projects;
