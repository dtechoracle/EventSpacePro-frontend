"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FaPlus } from "react-icons/fa";
import { ImSpinner8 } from "react-icons/im";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/helpers/Config";
import toast from "react-hot-toast";

interface ApiError {
  message: string;
  errors?: { path: string; message: string; code: string }[];
}

export default function CreateProjectModal({
  onClose,
}: {
  onClose: () => void;
}) {
  const [phase, setPhase] = useState(1);
  const [projectName, setProjectName] = useState("");
  const [email, setEmail] = useState("");
  const [role] = useState("owner");
  const [, setLoading] = useState(false);

  const queryClient = useQueryClient();

  const mutation = useMutation<{ message: string }, ApiError>({
    mutationKey: ["create-project"],
    mutationFn: () => {
      const payload: {
        name: string;
        users?: { email: string; role: string }[];
      } = {
        name: projectName,
      };

      // Only include users if email is provided
      if (email && email.trim()) {
        payload.users = [{ email: email, role: role }];
      }

      return apiRequest("/projects", "POST", payload, true);
    },
    onSuccess: () => {
      // Invalidate and refetch projects list
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      localStorage.removeItem("scene-storage-v2")
      localStorage.removeItem("scene-storage")
      toast.success("Project created successfully!");
      onClose();
    },
    onError: (err: ApiError) => {
      toast.error(err.message || "Project creation failed");
      setPhase(2); // Go back to phase 2 on error
    },
  });

  const handleSubmit = () => {
    setPhase(3);
    mutation.mutate();
  };

  // Handle auto-close after loading
  useEffect(() => {
    if (phase === 3) {
      setLoading(true);
      const timer = setTimeout(() => {
        setLoading(false);
        onClose();
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [phase, onClose]);

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
          className="bg-[#FDFDFF] text-[#272235] w-[35rem] min-h-[18.6rem] rounded-[2.25rem] p-[2.625rem] flex flex-col gap-6 relative"
          onClick={(e) => e.stopPropagation()}
        >
          <AnimatePresence mode="wait">
            {phase === 1 && (
              <motion.div
                key="phase1"
                initial={{ opacity: 0, x: 40 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -40 }}
                transition={{ duration: 0.3 }}
                className="flex flex-col gap-6"
              >
                <h2 className="text-[2rem] font-semibold text-[#272235]">
                  Create a new project
                </h2>
                <input
                  type="text"
                  placeholder="Project Name"
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  className="w-full h-14 rounded-2xl px-6 py-4 bg-[#0000000A] text-base outline-none"
                />
                <button
                  onClick={() => projectName && setPhase(2)}
                  disabled={!projectName}
                  className="w-full h-14 rounded-2xl text-white text-base font-medium bg-[var(--accent)] disabled:opacity-50"
                >
                  Next
                </button>
              </motion.div>
            )}

            {phase === 2 && (
              <motion.div
                key="phase2"
                initial={{ opacity: 0, x: 40 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -40 }}
                transition={{ duration: 0.3 }}
                className="flex flex-col gap-6"
              >
                <div className="flex items-center justify-center gap-2 w-full">
                  <h2 className="text-[2rem] font-semibold text-[#272235]">
                    Add Collaborators
                  </h2>
                  <FaPlus className="text-xl text-[#272235]" />
                </div>
                <input
                  type="email"
                  placeholder="Email Address..."
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full h-14 rounded-2xl px-6 py-4 bg-[#0000000A] text-base outline-none"
                />
                <button
                  onClick={handleSubmit}
                  className={`w-full h-14 rounded-2xl text-base font-medium ${email
                      ? "bg-[var(--accent)] text-white"
                      : "bg-[#0000000A] text-gray-500"
                    }`}
                >
                  {email ? "Add" : "Skip for now"}
                </button>
              </motion.div>
            )}

            {phase === 3 && (
              <motion.div
                key="phase3"
                initial={{ opacity: 0, x: 40 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -40 }}
                transition={{ duration: 0.3 }}
                className="flex flex-col gap-10 items-center justify-center text-center"
              >
                <h2 className="text-[2rem] font-semibold text-[#272235]">
                  Creating a new Project
                </h2>
                <div className="w-16 h-16 flex justify-center items-center rounded-full bg-[var(--accent)]">
                  <ImSpinner8 size={30} className="text-white animate-spin" />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
