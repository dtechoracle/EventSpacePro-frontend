"use client";

import { useState } from "react";
import { useRouter } from "next/router";
import { useSceneStore } from "@/store/sceneStore";
import { motion, AnimatePresence } from "framer-motion";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/helpers/Config";
import { PaperSize, PAPER_SIZES } from "@/lib/paperSizes";
import toast from "react-hot-toast";

interface ApiError {
  message: string;
  errors?: { path: string; message: string; code: string }[];
}

export default function CreateEventModal({ onClose }: { onClose: () => void }) {
  const [phase, setPhase] = useState(1);
  const [eventName, setEventName] = useState("");
  const [paperSize, setPaperSize] = useState<PaperSize>("A4");
  const router = useRouter();
  const setCanvas = useSceneStore((s) => s.setCanvas);
  const { slug } = router.query;

  const mutation = useMutation<{ message: string; data: { _id: string } }, ApiError>({
    mutationKey: ["create-event"],
    mutationFn: () => {
      const paperDimensions = PAPER_SIZES[paperSize];
      const canvases = [{
        size: paperSize,
        width: paperDimensions.width,
        height: paperDimensions.height
      }];
      
      return apiRequest(`/projects/${slug}/events`, "POST", { 
        name: eventName, 
        canvases 
      }, true);
    },
    onSuccess: (response) => {
      setCanvas(paperSize);
      router.push(`/dashboard/editor/${slug}/${response.data._id}`);
      toast.success("Event created successfully!");
      onClose();
    },
    onError: (err: ApiError) => {
      toast.error(err.message || "Event creation failed");
      setPhase(1); // Go back to phase 1 on error
    },
  });

  const handleSubmit = () => {
    setPhase(2);
    mutation.mutate();
  };

  // const handleStartEditing = () => {
  //   // eslint-disable-next-line @typescript-eslint/no-explicit-any
  //   setCanvas(paperSize as any);

  //   router.push(`/dashboard/editor/${slug}`);
  //   onClose();
  // };

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
          className="bg-[#FDFDFF] w-[35rem] min-h-[18.6rem] rounded-[2.25rem] p-[2.625rem] flex flex-col gap-6 relative"
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
                  Create New Event
                </h2>
                <input
                  type="text"
                  placeholder="Event Name"
                  value={eventName}
                  onChange={(e) => setEventName(e.target.value)}
                  className="w-full h-14 rounded-2xl px-6 py-4 bg-[#0000000A] text-base outline-none"
                />
                <button
                  onClick={() => eventName && setPhase(2)}
                  disabled={!eventName}
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
                <h2 className="text-[2rem] font-semibold text-[#272235]">
                  Choose Paper Size
                </h2>

                <select
                  value={paperSize}
                  onChange={(e) => setPaperSize(e.target.value as PaperSize)}
                  className="w-full h-14 rounded-2xl px-6 py-4 bg-[#0000000A] text-base outline-none"
                >
                  <option value="A1">A1 (59.4 × 84.1 cm)</option>
                  <option value="A2">A2 (42 × 59.4 cm)</option>
                  <option value="A3">A3 (29.7 × 42 cm)</option>
                  <option value="A4">A4 (21 × 29.7 cm)</option>
                  <option value="A5">A5 (14.8 × 21 cm)</option>
                </select>

                <button
                  onClick={handleSubmit}
                  disabled={mutation.isPending}
                  className="w-full h-14 rounded-2xl text-white text-base font-medium bg-[var(--accent)] disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {mutation.isPending ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      Creating Event...
                    </>
                  ) : (
                    "Start Editing"
                  )}
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

