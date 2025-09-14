"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";

export default function CreateEventModal({ onClose }: { onClose: () => void }) {
  const [phase, setPhase] = useState(1);
  const [eventName, setEventName] = useState("");
  const [canvasSize, setCanvasSize] = useState("16:9");
  const [customHeight, setCustomHeight] = useState("");
  const [customWidth, setCustomWidth] = useState("");
  const router = useRouter();

  const handleStartEditing = () => {
    router.push("/dashboard/editor/123");
    onClose();
  };

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
                  Choose Canvas Size
                </h2>

                <select
                  value={canvasSize}
                  onChange={(e) => setCanvasSize(e.target.value)}
                  className="w-full h-14 rounded-2xl px-6 py-4 bg-[#0000000A] text-base outline-none"
                >
                  <option value="1:1">1:1</option>
                  <option value="4:3">4:3</option>
                  <option value="16:9">16:9</option>
                  <option value="custom">Custom size</option>
                </select>

                {canvasSize === "custom" && (
                  <div className="flex flex-col gap-4">
                    <input
                      type="number"
                      placeholder="Custom Height"
                      value={customHeight}
                      onChange={(e) => setCustomHeight(e.target.value)}
                      className="w-full h-14 rounded-2xl px-6 py-4 bg-[#0000000A] text-base outline-none"
                    />
                    <input
                      type="number"
                      placeholder="Custom Width"
                      value={customWidth}
                      onChange={(e) => setCustomWidth(e.target.value)}
                      className="w-full h-14 rounded-2xl px-6 py-4 bg-[#0000000A] text-base outline-none"
                    />
                  </div>
                )}

                <button
                  onClick={handleStartEditing}
                  className="w-full h-14 rounded-2xl text-white text-base font-medium bg-[var(--accent)]"
                >
                  Start Editing
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

