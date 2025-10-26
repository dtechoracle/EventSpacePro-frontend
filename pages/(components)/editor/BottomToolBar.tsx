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
  } = useSceneStore();

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
    console.log("Setting rectangular selection mode to:", enabled);
    useSceneStore.setState({
      isRectangularSelectionMode: enabled,
    });
    console.log("Store state after setting:", useSceneStore.getState().isRectangularSelectionMode);
  };

  const containerRef = useRef<HTMLDivElement | null>(null);

  // Handle option clicks
  const handleOptionClick = (option: ToolOption) => {
    switch (option.id) {
      // Selection tools
      case "pointer-select":
        console.log("Pointer selection mode activated");
        setRectangularSelectionMode(false);
        setActiveTool("pointer-select");
        break;
      case "rectangular-select":
        console.log("Rectangular selection mode activated");
        // Clear any existing selections and enable rectangular selection mode
        clearSelection();
        setRectangularSelectionMode(true);
        setActiveTool("rectangular-select");
        console.log("Rectangular selection mode set to true");
        break;

      // Assets
      case "open-assets":
        setShowAssetsModal(true);
        break;

      // Shape tools
      case "rectangle":
        setShapeMode("rectangle");
        break;
      case "circle":
        setShapeMode("ellipse");
        break;
      case "arrow":
        setShapeMode("line");
        break;
      case "polygon":
        console.log("Polygon tool activated");
        break;

      // Drawing tools
      case "draw-line":
        setPenMode(!isPenMode);
        if (isPenMode) setWallMode(false); // Turn off wall mode when turning off pen mode
        break;
      case "draw-wall":
        if (wallDrawingMode) {
          // If we're currently drawing walls, finish the wall
          if (currentWallSegments.length > 0) {
            finishWallDrawing();
          } else {
            cancelWallDrawing();
          }
        } else {
          // Start wall drawing mode
          setWallDrawingMode(true);
          setPenMode(false); // Turn off pen mode when starting wall mode
          setWallMode(false); // Turn off old wall mode
        }
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
        console.log("Trim tool activated");
        break;
      case "move":
        console.log("Move tool activated");
        break;
      case "copy":
        console.log("Copy tool activated");
        break;
      case "rotate":
        console.log("Rotate tool activated");
        break;
      case "group":
        console.log("Group objects");
        groupSelectedAssets();
        break;
      case "ungroup":
        console.log("Ungroup objects");
        if (selectedAssetId && assets.find((a: AssetInstance) => a.id === selectedAssetId)?.isGroup) {
          ungroupAsset(selectedAssetId);
        }
        break;
      case "align":
        console.log("Align objects");
        break;
      case "array":
        console.log("Array objects");
        break;

      // Annotation tools
      case "label-arrow":
        console.log("Label with arrow tool activated");
        break;
      case "dimensions":
        console.log("Dimension tool activated");
        break;
      case "text-annotation":
        console.log("Text annotation tool activated");
        break;

      // Snapping tools
      case "snap-toggle":
        console.log("Toggle snapping mode");
        break;
      case "snap-endpoint":
        console.log("Snap to endpoint");
        break;
      case "snap-midpoint":
        console.log("Snap to midpoint");
        break;
      case "snap-center":
        console.log("Snap to center");
        break;
      case "snap-intersection":
        console.log("Snap to intersection");
        break;
      case "snap-perpendicular":
        console.log("Snap to perpendicular");
        break;
      case "snap-grid":
        console.log("Snap to grid");
        break;

      // Export
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
      {/* Wall Drawing Status */}
      {wallDrawingMode && (
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
                whileTap={{ scale: 0.95 }}
                whileHover={{ scale: 1.03 }}
                className={`w-8 h-8 border-2 flex items-center justify-center rounded-md ${
                  (tool.options.some((opt) => opt.id === "draw-line") &&
                    isPenMode) ||
                  (tool.options.some((opt) => opt.id === "draw-wall") &&
                    (isWallMode || wallDrawingMode)) ||
                  (tool.options.some((opt) => opt.id === "rectangular-select") &&
                    activeTool === "rectangular-select")
                    ? "border-green-600 text-green-600"
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
                            ? "bg-green-100 text-green-800"
                            : ""
                        }`}
                        onClick={() => handleOptionClick(option)}
                      >
                        <span>{option.label}</span>
                        {((option.id === "draw-line" && isPenMode) ||
                          (option.id === "draw-wall" &&
                            (isWallMode || wallDrawingMode)) ||
                          (option.id === "rectangular-select" && activeTool === "rectangular-select")) && (
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
              <div className="w-px h-6 bg-gray-200 mx-2" />
            )}
          </div>
        ))}
      </motion.div>
    </div>
  );
}
