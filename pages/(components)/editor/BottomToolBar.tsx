"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  FaPaperPlane,
  FaPuzzlePiece,
  FaShapes,
  FaPencilRuler,
  FaColumns,
  FaBriefcase,
} from "react-icons/fa";
import { ChevronDown } from "lucide-react";
import { RiPushpinLine } from "react-icons/ri";

const tools = [
  { icon: <FaPaperPlane size={18} />, label: "Tool 1" },
  { icon: <FaPuzzlePiece size={18} />, label: "Tool 2" },
  { icon: <FaShapes size={18} />, label: "Tool 3" },
  { icon: <RiPushpinLine size={18} />, label: "Tool 4" },
  { icon: <FaPencilRuler size={18} />, label: "Tool 5" },
  { icon: <FaColumns size={18} />, label: "Tool 6" },
  { icon: <FaBriefcase size={18} />, label: "Tool 7" },
];

export default function BottomToolbar() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const toggleDropdown = (index: number) => {
    setOpenIndex((prev) => (prev === index ? null : index));
  };

  useEffect(() => {
    function handlePointerDown(e: PointerEvent) {
      const el = containerRef.current;
      if (!el) return;
      const target = e.target as Node | null;
      if (!target) return;
      if (!el.contains(target)) {
        setOpenIndex(null);
      }
    }

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpenIndex(null);
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[9999] pointer-events-auto">
      <motion.div
        ref={containerRef}
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: "spring", stiffness: 200, damping: 20 }}
        className="flex items-center gap-3 bg-white px-4 py-2 rounded-2xl shadow-lg relative"
      >
        {tools.map((tool, index) => (
          <div key={index} className="flex items-center relative">
            {/* Button */}
            <motion.button
              whileTap={{ scale: 0.95 }}
              whileHover={{ scale: 1.03 }}
              className="w-10 h-10 flex items-center justify-center bg-[var(--accent)] text-white rounded-lg"
              aria-expanded={openIndex === index}
              aria-haspopup="menu"
            >
              {tool.icon}
            </motion.button>

            {/* Dropdown Chevron */}
            <button
              onClick={() => toggleDropdown(index)}
              className="ml-1 text-gray-600 hover:text-black"
              aria-label={`${tool.label} options`}
            >
              <ChevronDown size={16} />
            </button>

            {/* Dropdown Menu */}
            <AnimatePresence>
              {openIndex === index && (
                <motion.div
                  initial={{ opacity: 0, y: 8, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 8, scale: 0.98 }}
                  transition={{ duration: 0.15 }}
                  className="absolute bottom-14 left-1/2 -translate-x-1/2 bg-white rounded-lg shadow-lg border p-2 w-44 z-[10000]"
                >
                  <ul className="space-y-1 text-sm text-gray-700">
                    <li
                      className="px-2 py-1 rounded hover:bg-gray-100 cursor-pointer"
                      onClick={() => setOpenIndex(null)}
                    >
                      {tool.label} Option 1
                    </li>
                    <li
                      className="px-2 py-1 rounded hover:bg-gray-100 cursor-pointer"
                      onClick={() => setOpenIndex(null)}
                    >
                      {tool.label} Option 2
                    </li>
                    <li
                      className="px-2 py-1 rounded hover:bg-gray-100 cursor-pointer"
                      onClick={() => setOpenIndex(null)}
                    >
                      {tool.label} Option 3
                    </li>
                  </ul>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Divider (not for last item) */}
            {index !== tools.length - 1 && (
              <div className="w-px h-8 bg-gray-200 mx-3" />
            )}
          </div>
        ))}
      </motion.div>
    </div>
  );
}

