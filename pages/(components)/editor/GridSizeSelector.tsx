"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, Grid3X3 } from "lucide-react";
import { useSceneStore } from "@/store/sceneStore";

interface GridSizeSelectorProps {
  className?: string;
}

export default function GridSizeSelector({ className = "" }: GridSizeSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const {
    availableGridSizes,
    selectedGridSizeIndex,
    setSelectedGridSizeIndex,
    showGrid,
    toggleGrid,
    snapToGridEnabled,
    toggleSnapToGrid
  } = useSceneStore();

  // Fallback grid sizes if store doesn't have them
  const defaultGridSizes = [5, 10, 25, 50, 100];
  const gridSizes = availableGridSizes || defaultGridSizes;
  const currentGridSize = gridSizes[selectedGridSizeIndex] || gridSizes[1] || 10;

  const formatGridSize = (size: number) => {
    if (size < 1) {
      return `${size * 1000}μm`; // Show in micrometers for very small sizes
    } else if (size < 10) {
      return `${size}mm`;
    } else if (size < 1000) {
      return `${size}mm`;
    } else {
      return `${size / 1000}m`;
    }
  };

  return (
    <div className={`relative ${className}`}>
      {/* Grid Toggle Button */}
      <div className="flex items-center gap-2">
        <button
          onClick={toggleGrid}
          className={`w-8 h-8 border-2 flex items-center justify-center rounded-md transition-colors ${
            showGrid
              ? "border-green-600 text-green-600 bg-green-50"
              : "border-gray-300 text-gray-500 hover:border-gray-400"
          }`}
          title={`${showGrid ? 'Hide' : 'Show'} Grid`}
        >
          <Grid3X3 size={16} />
        </button>

        {/* Grid Size Selector */}
        <div className="relative">
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="flex items-center gap-1 px-2 py-1 text-sm border border-gray-300 rounded-md hover:border-gray-400 transition-colors bg-white"
            title="Select Grid Size"
          >
            <span>{formatGridSize(currentGridSize)}</span>
            <ChevronDown size={12} className={`transition-transform ${isOpen ? 'rotate-180' : ''}`} />
          </button>

          <AnimatePresence>
            {isOpen && (
              <>
                {/* Backdrop */}
                <div
                  className="fixed inset-0 z-[9998]"
                  onClick={() => setIsOpen(false)}
                />
                
                {/* Dropdown */}
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: -10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: -10 }}
                  transition={{ duration: 0.15 }}
                  className="absolute bottom-full mb-2 left-0 z-[9999] bg-white border border-gray-200 rounded-lg shadow-lg py-1 min-w-[120px]"
                >
                  {gridSizes.map((size, index) => (
                    <button
                      key={size}
                      onClick={() => {
                        setSelectedGridSizeIndex(index);
                        setIsOpen(false);
                      }}
                      className={`w-full px-3 py-2 text-left text-sm hover:bg-gray-50 transition-colors ${
                        index === selectedGridSizeIndex
                          ? "bg-blue-50 text-blue-700 font-medium"
                          : "text-gray-700"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span>{formatGridSize(size)}</span>
                        {index === selectedGridSizeIndex && (
                          <div className="w-2 h-2 bg-blue-600 rounded-full"></div>
                        )}
                      </div>
                    </button>
                  ))}
                  
                  {/* Snap to Grid Toggle */}
                  <div className="border-t border-gray-100 mt-1 pt-1">
                    <button
                      onClick={() => {
                        toggleSnapToGrid();
                        setIsOpen(false);
                      }}
                      className={`w-full px-3 py-2 text-left text-sm hover:bg-gray-50 transition-colors ${
                        snapToGridEnabled
                          ? "bg-green-50 text-green-700 font-medium"
                          : "text-gray-700"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span>Snap to Grid</span>
                        {snapToGridEnabled && (
                          <div className="w-2 h-2 bg-green-600 rounded-full"></div>
                        )}
                      </div>
                    </button>
                  </div>
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
