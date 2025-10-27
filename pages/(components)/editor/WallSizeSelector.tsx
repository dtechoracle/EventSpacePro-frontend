"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, Square } from "lucide-react";
import { useSceneStore } from "@/store/sceneStore";

interface WallSizeSelectorProps {
  className?: string;
}

export default function WallSizeSelector({ className = "" }: WallSizeSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const {
    availableWallTypes,
    wallType,
    setWallType,
    wallDrawingMode
  } = useSceneStore();

  // Fallback wall types if store doesn't have them
  const defaultWallTypes = [
    { id: 'thin', label: 'Thin (5mm)', thickness: 5 },
    { id: 'standard', label: 'Standard (10mm)', thickness: 10 },
    { id: 'thick', label: 'Thick (20mm)', thickness: 20 },
    { id: 'extra-thick', label: 'Extra Thick (40mm)', thickness: 40 }
  ];
  
  const wallTypes = availableWallTypes || defaultWallTypes;
  const currentWallType = wallTypes.find(wt => wt.id === wallType);
  const currentThickness = currentWallType?.thickness || 10;

  const formatThickness = (thickness: number) => {
    if (thickness < 1) {
      return `${thickness * 1000}μm`; // Show in micrometers for very small sizes
    } else if (thickness < 10) {
      return `${thickness}mm`;
    } else if (thickness < 1000) {
      return `${thickness}mm`;
    } else {
      return `${thickness / 1000}m`;
    }
  };

  return (
    <div className={`relative ${className}`}>
      {/* Wall Size Selector */}
      <div className="relative">
        <button
          onClick={() => setIsOpen(!isOpen)}
          disabled={wallDrawingMode}
          className={`flex items-center gap-1 px-2 py-1 text-sm border rounded-md transition-colors ${
            wallDrawingMode
              ? "border-gray-200 text-gray-400 cursor-not-allowed bg-gray-50"
              : "border-gray-300 hover:border-gray-400 bg-white"
          }`}
          title={wallDrawingMode ? "Cannot change wall size while drawing" : "Select Wall Size"}
        >
          <Square size={14} />
          <span>{currentWallType?.label || 'Standard'}</span>
          <ChevronDown size={12} className={`transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </button>

        <AnimatePresence>
          {isOpen && !wallDrawingMode && (
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
                className="absolute bottom-full mb-2 left-0 z-[9999] bg-white border border-gray-200 rounded-lg shadow-lg py-1 min-w-[160px]"
              >
                {wallTypes.map((wallTypeOption) => (
                  <button
                    key={wallTypeOption.id}
                    onClick={() => {
                      setWallType(wallTypeOption.id);
                      setIsOpen(false);
                    }}
                    className={`w-full px-3 py-2 text-left text-sm hover:bg-gray-50 transition-colors ${
                      wallTypeOption.id === wallType
                        ? "bg-blue-50 text-blue-700 font-medium"
                        : "text-gray-700"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div 
                          className="w-4 h-1 bg-gray-400 rounded"
                          style={{ 
                            width: `${Math.max(2, wallTypeOption.thickness * 0.1)}px`,
                            backgroundColor: wallTypeOption.id === wallType ? '#3b82f6' : '#9ca3af'
                          }}
                        />
                        <span>{wallTypeOption.label}</span>
                      </div>
                      {wallTypeOption.id === wallType && (
                        <div className="w-2 h-2 bg-blue-600 rounded-full"></div>
                      )}
                    </div>
                  </button>
                ))}
                
                {/* Current Thickness Display */}
                <div className="border-t border-gray-100 mt-1 pt-1 px-3 py-1">
                  <div className="text-xs text-gray-500">
                    Current: {formatThickness(currentThickness)}
                  </div>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
