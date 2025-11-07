"use client";

import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown } from "lucide-react";
import { useToolbarTools, ToolOption } from "@/hooks/useToolBarTools";
import { useSceneStore, AssetInstance } from "@/store/sceneStore";
// import AssetsModal from "./AssetsModal";

// Tooltip Component
interface TooltipProps {
  children: React.ReactNode;
  content: string;
  position?: "top" | "bottom";
}

function Tooltip({ children, content, position = "top" }: TooltipProps) {
  const [isVisible, setIsVisible] = useState(false);

  return (
    <div
      className="relative inline-block"
      onMouseEnter={() => setIsVisible(true)}
      onMouseLeave={() => setIsVisible(false)}
    >
      {children}
      <AnimatePresence>
        {isVisible && (
          <motion.div
            initial={{
              opacity: 0,
              scale: 0.8,
              y: position === "top" ? 10 : -10,
            }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: position === "top" ? 10 : -10 }}
            transition={{ duration: 0.15 }}
            className={`absolute z-[10001] px-2 py-1 text-xs text-white bg-gray-900 rounded shadow-lg whitespace-nowrap ${
              position === "top" ? "bottom-full mb-2" : "top-full mt-2"
            } left-1/2 -translate-x-1/2`}
          >
            {content}
            <div
              className={`absolute left-1/2 -translate-x-1/2 w-0 h-0 ${
                position === "top"
                  ? "top-full border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900"
                  : "bottom-full border-l-4 border-r-4 border-b-4 border-transparent border-b-gray-900"
              }`}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

interface BarProps {
  setShowAssetsModal: React.Dispatch<React.SetStateAction<boolean>>;
}

export default function BottomToolbar({ setShowAssetsModal }: BarProps) {
  const tools = useToolbarTools();
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const [showDebug, setShowDebug] = useState(false);
  const [showWallTypeSubmenu, setShowWallTypeSubmenu] = useState(false);
  const [activeTool, setActiveTool] = useState<string | null>(null);
  const {
    isPenMode,
    isWallMode,
    setPenMode,
    setWallMode,
    wallDrawingMode,
    setWallDrawingMode,
    finishWallDrawing,
    cancelWallDrawing,
    currentWallSegments,
    setShapeMode,
    selectedAssetId,
    assets,
    groupSelectedAssets,
    ungroupAsset,
    setWallType,
  } = useSceneStore(); // Updated

  // Example states to toggle (keeping for future use)
  // const [isPreviewOn, setIsPreviewOn] = useState(false);
  // const [isGridVisible, setIsGridVisible] = useState(true);
  // const [isEditMode, setIsEditMode] = useState(false);

  // Manual clearSelection function
  const clearSelection = () => {
    useSceneStore.setState({
      selectedAssetIds: [],
      selectedAssetId: null,
    });
  };

  // Manual setRectangularSelectionMode function
  const setRectangularSelectionMode = (enabled: boolean) => {
    useSceneStore.setState({
      isRectangularSelectionMode: enabled,
    });
  };

  const containerRef = useRef<HTMLDivElement | null>(null);

  // Ensure only one tool is active at a time
  const deactivateAllTools = () => {
    setPenMode(false);
    setWallMode(false);
    setWallDrawingMode(false);
    setRectangularSelectionMode(false);
    setShapeMode(null);
    useSceneStore.getState().setExportSelectionMode(false);
    setActiveTool(null);
  };

  // Handle option clicks
  const handleWallTypeSelection = (wallType: string) => {
    // Map the new wall type IDs to the store's expected format
    let mappedWallType: 'thin' | 'standard' | 'thick' | 'extra-thick';
    
    switch (wallType) {
      case 'enclosure-225':
        mappedWallType = 'extra-thick';
        break;
      case 'enclosure-150':
        mappedWallType = 'thick';
        break;
      case 'partition-100':
        mappedWallType = 'standard';
        break;
      case 'partition-75':
        mappedWallType = 'thin';
        break;
      default:
        mappedWallType = 'thin';
    }
    
    setWallType(mappedWallType);
    setShowWallTypeSubmenu(false);

    // Activate wall drawing exclusively
    deactivateAllTools();
    setActiveTool("draw-wall");
    setWallDrawingMode(true);
  };

  const handleOptionClick = (option: ToolOption) => {
    switch (option.id) {
      // Selection tools
      case "pointer-select":
        deactivateAllTools();
        setActiveTool("pointer-select");
        break;
      case "rectangular-select":
        deactivateAllTools();
        clearSelection();
        setRectangularSelectionMode(true);
        setActiveTool("rectangular-select");
        break;

      // Assets
      case "open-assets":
        setShowAssetsModal(true);
        break;

      // Shape tools
      case "rectangle":
        deactivateAllTools();
        setShapeMode("rectangle");
        break;
      case "circle":
        deactivateAllTools();
        setShapeMode("ellipse");
        break;
      case "arrow":
        deactivateAllTools();
        setShapeMode("line");
        break;
      case "polygon":
        break;

      // Drawing tools
      case "draw-line":
        if (isPenMode) {
          // toggle off if already active
          setPenMode(false);
          setActiveTool(null);
        } else {
          deactivateAllTools();
          setPenMode(true);
          setActiveTool("draw-line");
        }
        break;
      case "draw-wall":
        // Prepare wall as exclusive; submenu will finalize activation
        deactivateAllTools();
        setShowWallTypeSubmenu(true);
        setOpenIndex(null); // Close the main dropdown
        break;
      case "add-text":
        // Add text at center of canvas
        const canvas = useSceneStore.getState().canvas;
        if (canvas) {
          useSceneStore
            .getState()
            .addAsset("text", canvas.width / 2, canvas.height / 2);
        }
        break;

      // Modify tools
      case "trim":
        break;
      case "move":
        break;
      case "copy":
        break;
      case "rotate":
        break;
      case "group":
        groupSelectedAssets();
        break;
      case "ungroup":
        if (selectedAssetId && assets.find((a: AssetInstance) => a.id === selectedAssetId)?.isGroup) {
          ungroupAsset(selectedAssetId);
        }
        break;
      case "align":
        break;
      case "array":
        break;

      // Annotation tools
      case "label-arrow":
        break;
      case "dimensions":
        break;
      case "text-annotation":
        break;

      // Snapping tools
      case "snap-toggle":
        break;
      case "snap-endpoint":
        break;
      case "snap-midpoint":
        break;
      case "snap-center":
        break;
      case "snap-intersection":
        break;
      case "snap-perpendicular":
        break;
      case "snap-grid":
        break;

      // Export - removed drag selection, now handled by ExportPanel in sidebar
      case "export-project":
        // Export is now handled automatically when assets are selected
        // via the ExportPanel in the PropertiesSidebar
        break;

      default:
        break;
    }
    setOpenIndex(null);
  };

  // Close dropdowns when clicking outside
  useEffect(() => {
    function handlePointerDown(e: PointerEvent) {
      const el = containerRef.current;
      if (el && !el.contains(e.target as Node)) {
        setOpenIndex(null);
        setShowWallTypeSubmenu(false);
      }
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpenIndex(null);
        setShowWallTypeSubmenu(false);
      }
    }
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  return (
    <div ref={containerRef} className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[9999] pointer-events-auto">
      {/* Wall Drawing Status */}
      {isWallMode && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          className="absolute bottom-16 left-1/2 -translate-x-1/2 bg-blue-600 text-white px-4 py-2 rounded-lg shadow-lg text-sm whitespace-nowrap"
        >
          {currentWallSegments.length === 0
            ? "Click to start wall segment"
            : currentWallSegments.length === 1
            ? "Click to continue wall or finish"
            : `Wall with ${currentWallSegments.length} segments - Click to continue or finish`}
          <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-blue-600"></div>
        </motion.div>
      )}

      <motion.div
        ref={containerRef}
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: "spring", stiffness: 200, damping: 20 }}
        className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl shadow-lg relative"
      >
        {tools.map((tool, index) => (
          <div key={index} className="flex items-center relative">
            {/* Main Button with Tooltip */}
            <Tooltip content={tool.label} position="top">
              <motion.button
                onClick={() => {
                  // Activate the group's primary option and ensure exclusivity
                  const primary = tool.options[0];
                  if (primary) {
                    handleOptionClick(primary);
                  }
                  // Close any open dropdown when directly activating
                  setOpenIndex(null);
                }}
                whileTap={{ scale: 0.95 }}
                whileHover={{ scale: 1.03 }}
                className={`w-8 h-8 border-2 flex items-center justify-center rounded-md ${
                  (tool.options.some((opt) => opt.id === "draw-line") &&
                    isPenMode) ||
                  (tool.options.some((opt) => opt.id === "draw-wall") &&
                    (isWallMode || wallDrawingMode)) ||
                  (tool.options.some((opt) => opt.id === "rectangular-select") &&
                    activeTool === "rectangular-select")
                    ? "border-blue-500 text-blue-500"
                    : "border-[var(--accent)] text-[var(--accent)]"
                }`}
                aria-expanded={openIndex === index}
                aria-haspopup="menu"
              >
                {tool.icon}
              </motion.button>
            </Tooltip>

            {/* Dropdown Toggle */}
            <button
              onClick={() => setOpenIndex(openIndex === index ? null : index)}
              className="ml-0.5 text-gray-600 hover:text-black"
            >
              <ChevronDown size={14} />
            </button>

            {/* Dropdown Menu */}
            <AnimatePresence>
              {openIndex === index && (
                <motion.div
                  initial={{ opacity: 0, y: 8, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 8, scale: 0.98 }}
                  transition={{ duration: 0.15 }}
                  className="absolute bottom-12 left-1/2 -translate-x-1/2 bg-white rounded-md shadow-lg border p-1.5 w-48 z-[10000]"
                >
                  <ul className="space-y-0.5 text-xs text-gray-700">
                    {tool.options.map((option) => (
                      <li
                        key={option.id}
                        className={`px-2 py-1.5 rounded hover:bg-gray-100 cursor-pointer flex items-center justify-between ${
                          (option.id === "draw-line" && isPenMode) ||
                          (option.id === "draw-wall" &&
                            (isWallMode || wallDrawingMode)) ||
                          (option.id === "rectangular-select" && activeTool === "rectangular-select")
                            ? "bg-blue-100 text-blue-800"
                            : ""
                        }`}
                        onClick={() => handleOptionClick(option)}
                      >
                        <div className="flex items-center gap-2">
                          {option.icon && <span className="text-gray-600">{option.icon}</span>}
                          <span>{option.label}</span>
                          {option.id === "draw-wall" && (
                            <svg className="w-3 h-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                          )}
                        </div>
                        {((option.id === "draw-line" && isPenMode) ||
                          (option.id === "draw-wall" &&
                            (isWallMode || wallDrawingMode)) ||
                          (option.id === "rectangular-select" && activeTool === "rectangular-select")) && (
                              <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                            )}
                      </li>
                    ))}
                  </ul>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Divider */}
            {index !== tools.length - 1 && (
              <div className="w-px h-6 bg-gray-200 mx-2" />
            )}
          </div>
        ))}
      </motion.div>

      {/* Wall Type Submenu */}
      <AnimatePresence>
        {showWallTypeSubmenu && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ duration: 0.15 }}
            className="absolute bottom-16 left-1/2 -translate-x-1/2 bg-white rounded-md shadow-lg border p-1.5 w-56 z-[10000] pointer-events-auto"
            onClick={(e) => {
              // Don't stop propagation - let wall type clicks work
            }}
          >
            <div className="text-xs font-medium text-gray-600 mb-2 px-2">Select Wall Type:</div>
            
            <ul className="space-y-0.5 text-xs text-gray-700">
              {/* Partitions */}
              <li className="px-2 py-1 text-xs font-medium text-gray-500 bg-gray-50">Partitions</li>
              {[
                { id: 'partition-75', label: 'Partition Wall (75mm)', thickness: 1, visualThickness: 1, category: 'partition' },
                { id: 'partition-100', label: 'Partition Wall (100mm)', thickness: 2, visualThickness: 2, category: 'partition' }
              ].map((wallType) => (
                <li
                  key={wallType.id}
                  className="px-2 py-1.5 rounded hover:bg-gray-100 cursor-pointer flex items-center justify-between"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleWallTypeSelection(wallType.id as any);
                  }}
                >
                  <div className="flex items-center gap-2">
                    <div className="flex gap-1 items-center">
                      <div 
                        className="bg-gray-400 rounded"
                        style={{ 
                          width: `${wallType.visualThickness}px`,
                          height: '16px',
                          backgroundColor: '#10b981'
                        }}
                      />
                      <div 
                        className="bg-gray-400 rounded"
                        style={{ 
                          width: `${wallType.visualThickness}px`,
                          height: '16px',
                          backgroundColor: '#10b981'
                        }}
                      />
                    </div>
                    <span>{wallType.label}</span>
                  </div>
                </li>
              ))}
              
              {/* Enclosure Walls */}
              <li className="px-2 py-1 text-xs font-medium text-gray-500 bg-gray-50 mt-2">Enclosure Walls</li>
              {[
                { id: 'enclosure-150', label: 'Enclosure Wall (150mm)', thickness: 5, visualThickness: 5, category: 'enclosure' },
                { id: 'enclosure-225', label: 'Enclosure Wall (225mm)', thickness: 8, visualThickness: 8, category: 'enclosure' }
              ].map((wallType) => (
                <li
                  key={wallType.id}
                  className="px-2 py-1.5 rounded hover:bg-gray-100 cursor-pointer flex items-center justify-between"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleWallTypeSelection(wallType.id as any);
                  }}
                >
                  <div className="flex items-center gap-2">
                    <div className="flex gap-1 items-center">
                      <div 
                        className="bg-gray-400 rounded"
                        style={{ 
                          width: `${wallType.visualThickness}px`,
                          height: '16px',
                          backgroundColor: '#3b82f6'
                        }}
                      />
                      <div 
                        className="bg-gray-400 rounded"
                        style={{ 
                          width: `${wallType.visualThickness}px`,
                          height: '16px',
                          backgroundColor: '#3b82f6'
                        }}
                      />
                    </div>
                    <span>{wallType.label}</span>
                  </div>
                </li>
              ))}
            </ul>
            {/* Cross tool removed */}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
