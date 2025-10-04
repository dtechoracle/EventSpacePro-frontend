"use client";

import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown } from "lucide-react";
import { useToolbarTools, ToolOption } from "@/hooks/useToolBarTools";
import { useSceneStore } from "@/store/sceneStore";
// import AssetsModal from "./AssetsModal";


interface BarProps{
  setShowAssetsModal: React.Dispatch<React.SetStateAction<boolean>>
}

export default function BottomToolbar({setShowAssetsModal}: BarProps) {
  const tools = useToolbarTools();
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const { isPenMode, setPenMode } = useSceneStore();

  // Example states to toggle
  const [isPreviewOn, setIsPreviewOn] = useState(false);
  const [isGridVisible, setIsGridVisible] = useState(true);
  const [isEditMode, setIsEditMode] = useState(false);

  const containerRef = useRef<HTMLDivElement | null>(null);

  // Handle option clicks
  const handleOptionClick = (option: ToolOption) => {
    switch (option.id) {
      case "open-assets":
        setShowAssetsModal(true);
        break;
      case "reset-layout":
        console.log("Layout reset!");
        break;
      case "draw-line":
        setPenMode(!isPenMode);
        break;
      case "add-text":
        // Add text at center of canvas
        const canvas = useSceneStore.getState().canvas;
        if (canvas) {
          useSceneStore.getState().addAsset("text", canvas.width / 2, canvas.height / 2);
        }
        break;
      case "toggle-grid":
        setIsGridVisible((prev) => !prev);
        break;
      case "clear-grid":
        console.log("Grid cleared!");
        break;
      case "toggle-edit-mode":
        setIsEditMode((prev) => !prev);
        break;
      case "export-project":
        console.log("Exporting project...");
        break;
      default:
        console.log("Clicked:", option.id);
    }
    setOpenIndex(null);
  };

  // Close dropdowns when clicking outside
  useEffect(() => {
    function handlePointerDown(e: PointerEvent) {
      const el = containerRef.current;
      if (el && !el.contains(e.target as Node)) {
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
            {/* Main Button */}
            <motion.button
              whileTap={{ scale: 0.95 }}
              whileHover={{ scale: 1.03 }}
              className={`w-10 h-10 flex items-center justify-center rounded-lg ${
                tool.options.some(opt => opt.id === "draw-line") && isPenMode 
                  ? "bg-green-600 text-white" 
                  : "bg-[var(--accent)] text-white"
              }`}
              aria-expanded={openIndex === index}
              aria-haspopup="menu"
            >
              {tool.icon}
            </motion.button>

            {/* Dropdown Toggle */}
            <button
              onClick={() => setOpenIndex(openIndex === index ? null : index)}
              className="ml-1 text-gray-600 hover:text-black"
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
                    {tool.options.map((option) => (
                      <li
                        key={option.id}
                        className={`px-2 py-1 rounded hover:bg-gray-100 cursor-pointer flex items-center justify-between ${
                          option.id === "draw-line" && isPenMode ? "bg-green-100 text-green-800" : ""
                        }`}
                        onClick={() => handleOptionClick(option)}
                      >
                        <span>{option.label}</span>
                        {option.id === "draw-line" && isPenMode && (
                          <div className="w-2 h-2 bg-green-600 rounded-full"></div>
                        )}
                      </li>
                    ))}
                  </ul>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Divider */}
            {index !== tools.length - 1 && (
              <div className="w-px h-8 bg-gray-200 mx-3" />
            )}
          </div>
        ))}
      </motion.div>
    </div>
  );
}

