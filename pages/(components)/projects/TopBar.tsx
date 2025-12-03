"use client";

import { PiFolderPlusDuotone } from "react-icons/pi";
import {
  RiSearchLine,
  RiArrowUpDownFill,
  RiDownloadLine,
  RiAddLine,
} from "react-icons/ri";
// import { instrumentSans } from "@/helpers/fonts";
import CreateProjectModal from "./CreateProjectModal";
import CreateEventModal from "./CreateEventModal";
import ImportModal from "./ImportMOdal";
import { useState } from "react";

const TopBar = ({
  mainText,
  subText,
  type,
}: {
  mainText: string;
  subText: string;
  type: "event" | "project";
}) => {
  const [showCreateProjectModal, setShowCreateProjectModal] = useState(false);
  const [showCreateEventModal, setShowCreateEventModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);

  const handleProjectClick = () => setShowCreateProjectModal(true);
  const handleEventClick = () => setShowCreateEventModal(true);
  const handleImportClick = () => setShowImportModal(true);

  return (
    <div>
      {showCreateProjectModal && (
        <CreateProjectModal onClose={() => setShowCreateProjectModal(false)} />
      )}
      {showCreateEventModal && (
        <CreateEventModal onClose={() => setShowCreateEventModal(false)} />
      )}
      {showImportModal && (
        <ImportModal onClose={() => setShowImportModal(false)} />
      )}

      <div className="rounded-2xl border border-black/10 bg-white/80 p-4 shadow-sm backdrop-blur-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <h1 className="text-3xl font-bold sm:text-4xl">{mainText}</h1>

          <div className="flex flex-wrap items-center gap-3 lg:justify-end">
            <button className="rounded-md p-2 hover:bg-gray-100">
              <PiFolderPlusDuotone size={20} />
            </button>

            <div className="relative flex-1 basis-full min-w-[220px] sm:basis-64 lg:basis-auto lg:max-w-xs">
              <RiSearchLine className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
              <input
                type="text"
                placeholder="Search"
                className="h-11 w-full rounded-md bg-[var(--surface)] pl-10 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
              />
            </div>

            <button className="flex items-center gap-2 rounded-md bg-[var(--surface)] px-3 py-2 text-sm hover:bg-gray-50">
              <RiArrowUpDownFill />
              <span className="whitespace-nowrap">Last modified</span>
            </button>

            <button
              className="flex items-center gap-2 rounded-md bg-[var(--surface)] px-4 py-2 text-sm hover:bg-gray-50"
              onClick={handleImportClick}
            >
              <RiDownloadLine />
              <span className="whitespace-nowrap">Import</span>
            </button>

            {type === "project" ? (
              <button
                className="flex w-full items-center justify-center gap-2 rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 lg:w-auto"
                onClick={handleProjectClick}
              >
                <RiAddLine />
                <span className="whitespace-nowrap">New Project</span>
              </button>
            ) : (
              <button
                className="flex w-full items-center justify-center gap-2 rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 lg:w-auto"
                onClick={handleEventClick}
              >
                <RiAddLine />
                <span className="whitespace-nowrap">Event</span>
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="py-5 text-2xl font-semibold sm:text-3xl">{subText}</div>
    </div>
  );
};

export default TopBar;

