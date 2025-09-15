"use client";

import { PiFolderPlusDuotone } from "react-icons/pi";
import {
  RiSearchLine,
  RiArrowUpDownFill,
  RiDownloadLine,
  RiAddLine,
} from "react-icons/ri";
import { instrumentSerif } from "@/helpers/fonts";
import CreateProjectModal from "./CreateProjectModal";
import { useState, useRef, useEffect } from "react";
import CreateEventModal from "./CreateEventModal";

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
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const dropdownRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setDropdownOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const handleProjectClick = () => {
    setShowCreateProjectModal(true);
  };

  const handleEventClick = () => {
    setShowCreateEventModal(true);
    setDropdownOpen(false);
  };

  const handleUploadClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
    setDropdownOpen(false);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      console.log("Selected file:", e.target.files[0]);
    }
  };

  return (
    <div>
      {showCreateProjectModal && (
        <CreateProjectModal onClose={() => setShowCreateProjectModal(false)} />
      )}
      {showCreateEventModal && (
        <CreateEventModal onClose={() => setShowCreateEventModal(false)} />
      )}

      <input
        type="file"
        ref={fileInputRef}
        className="hidden"
        onChange={handleFileChange}
      />

      <div className="w-full flex justify-between pl-6 border border-black/10">
        <h1 className={`text-4xl ${instrumentSerif.className}`}>{mainText}</h1>
        <div className="flex items-center justify-between gap-4">
          <button className="p-2 rounded-md hover:bg-gray-100">
            <PiFolderPlusDuotone size={20} />
          </button>

          <div className="relative flex-1 max-w-xs">
            <RiSearchLine className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
            <input
              type="text"
              placeholder="Search"
              className="w-full pl-10 pr-3 py-2 rounded-md bg-[var(--surface)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
            />
          </div>

          <div className="flex items-center gap-2 bg-[var(--surface)] px-3 py-2 text-sm cursor-pointer hover:bg-gray-50">
            <RiArrowUpDownFill />
            <span>Last modified</span>
          </div>

          <button className="flex items-center gap-2 px-4 py-2 rounded-md bg-[var(--surface)] text-sm hover:bg-gray-50">
            <RiDownloadLine />
            Import
          </button>

          {type === "project" ? (
            <button
              className="flex capitalize items-center gap-2 px-4 py-2 rounded-md bg-[var(--accent)] text-white text-sm font-medium hover:bg-blue-700"
              onClick={handleProjectClick}
            >
              <RiAddLine />
              New {type}
            </button>
          ) : (
            <div className="relative" ref={dropdownRef}>
              <button
                className="flex capitalize items-center gap-2 px-4 py-2 rounded-md bg-[var(--accent)] text-white text-sm font-medium hover:bg-blue-700"
                onClick={() => setDropdownOpen((prev) => !prev)}
              >
                <RiAddLine />
                New
              </button>

              {dropdownOpen && (
                <div className="absolute right-0 mt-2 w-40 bg-white border border-gray-200 rounded-md shadow-lg z-50">
                  <button
                    onClick={handleEventClick}
                    className="block w-full text-left px-4 py-2 text-sm hover:bg-gray-100"
                  >
                    Event
                  </button>
                  <button
                    onClick={handleUploadClick}
                    className="block w-full text-left px-4 py-2 text-sm hover:bg-gray-100"
                  >
                    Upload
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <div className={`${instrumentSerif.className} text-3xl py-5 pl-6`}>
        {subText}
      </div>
    </div>
  );
};

export default TopBar;

