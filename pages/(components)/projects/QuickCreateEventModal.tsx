"use client";

import { useState } from "react";
import { useRouter } from "next/router";
import { motion, AnimatePresence } from "framer-motion";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/helpers/Config";
import toast from "react-hot-toast";
import { FaPlus, FaChevronDown } from "react-icons/fa";

interface ApiError {
  message: string;
}

export default function QuickCreateEventModal({ onClose }: { onClose: () => void }) {
  const [eventName, setEventName] = useState("");
  const router = useRouter();
  const queryClient = useQueryClient();

  // Fetch projects to select one
  const { data: projects } = useQuery({
    queryKey: ['projects'],
    queryFn: () => apiRequest('/projects', 'GET'),
  });

  const projectsList = (Array.isArray(projects) ? projects : (projects as any)?.data || []);
  const [selectedProjectId, setSelectedProjectId] = useState("");

  const mutation = useMutation<{ message: string; data: { _id: string }; projectSlug: string }, ApiError>({
    mutationKey: ["quick-create-event"],
    mutationFn: async () => {
      if (!eventName) throw new Error("Please entered an event name");

      // 1. Find or create the silent "Personal Drafts" project
      const projectsRes = await apiRequest('/projects', 'GET', null, true);
      const projectsList = (Array.isArray(projectsRes) ? projectsRes : (projectsRes as any)?.data || []);

      const HIDDEN_PROJECT_NAME = "Personal Drafts";
      let targetProject = projectsList.find((p: any) => p.name === HIDDEN_PROJECT_NAME);

      if (!targetProject) {
        // Create the hidden project if it doesn't exist
        const newProjectRes = await apiRequest("/projects", "POST", { name: HIDDEN_PROJECT_NAME }, true);
        targetProject = newProjectRes.data;
      }

      if (!targetProject) throw new Error("Could not create space for event");

      // 2. Create the event inside this project
      const response = await apiRequest(`/projects/${targetProject.slug}/events`, "POST", {
        name: eventName,
        type: "Custom venue",
        canvases: [{ size: "layout", width: 10000, height: 10000 }]
      }, true);

      return { ...response, projectSlug: targetProject.slug };
    },
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: ["all-events"] });
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      const eventId = response.data._id;
      router.push(`/dashboard/editor/${response.projectSlug}/${eventId}`);
      toast.success("Event created successfully!");
      onClose();
    },
    onError: (err: ApiError) => {
      toast.error(err.message || "Event creation failed");
    },
  });

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.25 }}
        className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-[9999]"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 30 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 30 }}
          transition={{ type: "spring", stiffness: 200, damping: 20 }}
          className="bg-[#FDFDFF] text-[#272235] w-[35rem] rounded-[2.25rem] p-[2.625rem] flex flex-col gap-6 relative"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex flex-col gap-6">
            <h2 className="text-[2rem] font-semibold text-[#272235]">
              Create a new event
            </h2>

            <div className="flex flex-col gap-4">
              {/* Event Name */}
              <div className="flex flex-col gap-4">
                <label className="text-sm font-medium text-gray-700 ml-1">Event Name</label>
                <input
                  type="text"
                  placeholder="e.g. Summer Gala 2024"
                  value={eventName}
                  onChange={(e) => setEventName(e.target.value)}
                  className="w-full h-14 rounded-2xl px-6 bg-[#0000000A] text-base outline-none"
                  autoFocus
                />
              </div>
            </div>

            <div className="flex flex-col gap-4 mt-2">
              <button
                onClick={() => mutation.mutate()}
                disabled={!eventName || mutation.isPending}
                className="w-full h-14 rounded-2xl text-white text-base font-bold bg-[var(--accent)] disabled:bg-gray-100 disabled:text-gray-400 disabled:opacity-100 transition-all flex items-center justify-center gap-2"
              >
                {mutation.isPending ? "Creating..." : (
                  <>
                    <FaPlus size={16} />
                    <span>Create event</span>
                  </>
                )}
              </button>

              <div className="text-center mt-2 pb-2">
                <button
                  onClick={() => {
                    router.push('/dashboard/projects');
                    onClose();
                  }}
                  className="text-[18px] text-blue-600 hover:text-[var(--accent)] font-medium transition-all group inline-flex items-center justify-center gap-1.5 mx-auto"
                >
                  <span>Create a project instead?</span>
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
