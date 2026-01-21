import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown } from "lucide-react";
import { useToolbarTools, ToolOption } from "@/hooks/useToolBarTools";
import { useSceneStore, AssetInstance } from "@/store/sceneStore";
import { useEditorStore } from "@/store/editorStore"; // NEW STORE
import { useProjectStore } from "@/store/projectStore";
import { toast } from "react-hot-toast";
import { mergeAllWallIntersections } from "@/utils/mergeWalls";
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
                        className={`absolute z-[10001] px-2 py-1 text-xs text-white bg-gray-900 rounded shadow-lg whitespace-nowrap ${position === "top" ? "bottom-full mb-2" : "top-full mt-2"
                            } left-1/2 -translate-x-1/2`}
                    >
                        {content}
                        <div
                            className={`absolute left-1/2 -translate-x-1/2 w-0 h-0 ${position === "top"
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
    const [showWallTypeSubmenu, setShowWallTypeSubmenu] = useState(false);
    const [activeTool, setActiveTool] = useState<string | null>(null);

    // NEW STORE
    const { setActiveTool: setEditorTool, activeTool: editorActiveTool } = useEditorStore();

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
        // Removed call to non-existent setExportSelectionMode
        setActiveTool(null);
    };

    // Handle wall type selection
    const handleWallTypeSelection = (wallType: string) => {
        // Use the actual wall type ID directly (no mapping needed)
        const wallTypeId = wallType as "partition-75" | "partition-100" | "enclosure-150" | "enclosure-225";

        // Set wall type first
        setWallType(wallTypeId);
        setShowWallTypeSubmenu(false);

        // Activate wall drawing exclusively
        deactivateAllTools();
        setActiveTool("draw-wall");
        setEditorTool("wall"); // NEW: Activate wall tool in editorStore
        setWallDrawingMode(true);
    };

    const handleOptionClick = (option: ToolOption) => {
        switch (option.id) {
            // Selection tools
            case "pointer-select":
                deactivateAllTools();
                setEditorTool("select"); // NEW: Activate select tool
                setActiveTool("pointer-select");
                break;
            case "rectangular-select":
                deactivateAllTools();
                clearSelection();
                setRectangularSelectionMode(true);
                setActiveTool("rectangular-select");
                break;
            case "pan":
                deactivateAllTools();
                setEditorTool("pan");
                setActiveTool("pan");
                break;

            // Assets
            case "open-assets":
                setShowAssetsModal(true);
                break;

            // Shape tools
            case "rectangle":
                deactivateAllTools();
                setShapeMode("rectangle"); // Keep for compatibility
                setEditorTool("shape-rectangle"); // NEW: Activate new shape tool
                setActiveTool("rectangle");
                break;
            case "circle":
                deactivateAllTools();
                setShapeMode("ellipse"); // Keep for compatibility
                setEditorTool("shape-ellipse"); // NEW: Activate new shape tool
                setActiveTool("circle");
                break;
            case "line":
                deactivateAllTools();
                setShapeMode("line"); // Keep for compatibility
                setEditorTool("shape-line"); // Activate line tool
                setActiveTool("line");
                break;
            case "arrow-shape":
                deactivateAllTools();
                setEditorTool("shape-arrow"); // Activate arrow shape tool
                setActiveTool("arrow-shape");
                break;
            case "freehand":
                deactivateAllTools();
                setEditorTool("freehand"); // Activate freehand tool
                setActiveTool("freehand");
                break;
            case "polygon":
                deactivateAllTools();
                setEditorTool("shape-polygon");
                setActiveTool("polygon");
                break;

            // Drawing tools
            case "draw-line":
                deactivateAllTools();
                setEditorTool("shape-line"); // Use new shape system for lines
                setActiveTool("draw-line");
                break;
            case "draw-wall":
                // Prepare wall as exclusive; submenu will finalize activation
                deactivateAllTools();
                setShowWallTypeSubmenu(true);
                setOpenIndex(null); // Close the main dropdown
                break;
            // Modify tools - work with ALL element types
            case "trim":
                deactivateAllTools();
                setEditorTool("trim");
                setActiveTool("trim");
                toast("Trim Tool Active: Drag across shapes to cut", { icon: '✂️' });
                break;

            case "move":
                // Move is handled by drag-and-drop, this could activate a move mode
                toast("Use drag-and-drop to move elements", { icon: "ℹ️", duration: 2000 });
                break;

            case "copy":
                // Copy all selected elements
                {
                    const selectedIds = useEditorStore.getState().selectedIds;
                    if (selectedIds.length === 0) {
                        toast.error("No elements selected to copy", { duration: 2000 });
                        break;
                    }

                    const projectState = useProjectStore.getState();
                    const offset = 20; // Offset for copied elements

                    selectedIds.forEach(id => {
                        // Copy shapes
                        const shape = projectState.shapes.find(s => s.id === id);
                        if (shape) {
                            const newShape = { ...shape, id: `shape-${Date.now()}-${Math.random()}`, x: shape.x + offset, y: shape.y + offset };
                            projectState.addShape(newShape);
                            return;
                        }

                        // Copy assets
                        const asset = projectState.assets.find(a => a.id === id);
                        if (asset) {
                            const newAsset = { ...asset, id: `asset-${Date.now()}-${Math.random()}`, x: asset.x + offset, y: asset.y + offset };
                            projectState.addAsset(newAsset);
                            return;
                        }

                        // Copy walls
                        const wall = projectState.walls.find(w => w.id === id);
                        if (wall) {
                            const newWall = {
                                ...wall,
                                id: `wall-${Date.now()}-${Math.random()}`,
                                nodes: wall.nodes.map(n => ({ ...n, id: `node-${Date.now()}-${Math.random()}`, x: n.x + offset, y: n.y + offset }))
                            };
                            projectState.addWall(newWall);
                            return;
                        }

                        // Copy text annotations
                        const text = projectState.textAnnotations.find(t => t.id === id);
                        if (text) {
                            const newText = { ...text, id: `text-${Date.now()}-${Math.random()}`, x: text.x + offset, y: text.y + offset };
                            projectState.addTextAnnotation(newText);
                            return;
                        }

                        // Copy dimensions
                        const dim = projectState.dimensions.find(d => d.id === id);
                        if (dim) {
                            const newDim = {
                                ...dim,
                                id: `dim-${Date.now()}-${Math.random()}`,
                                startPoint: { x: dim.startPoint.x + offset, y: dim.startPoint.y + offset },
                                endPoint: { x: dim.endPoint.x + offset, y: dim.endPoint.y + offset }
                            };
                            projectState.addDimension(newDim);
                            return;
                        }

                        // Copy label arrows
                        const label = projectState.labelArrows.find(l => l.id === id);
                        if (label) {
                            const newLabel = {
                                ...label,
                                id: `label-${Date.now()}-${Math.random()}`,
                                startPoint: { x: label.startPoint.x + offset, y: label.startPoint.y + offset },
                                endPoint: { x: label.endPoint.x + offset, y: label.endPoint.y + offset }
                            };
                            projectState.addLabelArrow(newLabel);
                            return;
                        }
                    });

                    toast.success(`Copied ${selectedIds.length} element(s)`, { duration: 2000 });
                }
                break;

            case "rotate":
                // Rotate all selected elements by 90 degrees
                {
                    const selectedIds = useEditorStore.getState().selectedIds;
                    if (selectedIds.length === 0) {
                        toast.error("No elements selected to rotate", { duration: 2000 });
                        break;
                    }

                    const projectState = useProjectStore.getState();

                    selectedIds.forEach(id => {
                        // Rotate shapes
                        const shape = projectState.shapes.find(s => s.id === id);
                        if (shape) {
                            projectState.updateShape(id, { rotation: (shape.rotation + 90) % 360 });
                            return;
                        }

                        // Rotate assets
                        const asset = projectState.assets.find(a => a.id === id);
                        if (asset) {
                            projectState.updateAsset(id, { rotation: (asset.rotation + 90) % 360 });
                            return;
                        }
                    });

                    toast.success(`Rotated ${selectedIds.length} element(s) by 90°`, { duration: 2000 });
                }
                break;

            case "group":
                // Group all selected elements
                {
                    const selectedIds = useEditorStore.getState().selectedIds;
                    if (selectedIds.length < 2) {
                        toast.error("Select at least 2 elements to group", { duration: 2000 });
                        break;
                    }

                    // For now, use the existing groupSelectedAssets function
                    // In the future, this could be enhanced to group mixed element types
                    groupSelectedAssets();
                    toast.success(`Grouped ${selectedIds.length} elements`, { duration: 2000 });
                }
                break;

            case "ungroup":
                // Ungroup selected groups
                {
                    const selectedIds = useEditorStore.getState().selectedIds;
                    const projectState = useProjectStore.getState();

                    let ungrouped = 0;
                    selectedIds.forEach(id => {
                        const asset = projectState.assets.find((a: any) => a.id === id);
                        if (asset?.isGroup) {
                            ungroupAsset(id);
                            ungrouped++;
                        }
                    });

                    if (ungrouped > 0) {
                        toast.success(`Ungrouped ${ungrouped} group(s)`, { duration: 2000 });
                    } else {
                        toast.error("No groups selected to ungroup", { duration: 2000 });
                    }
                }
                break;

            case "align":
                // Align selected elements - show submenu or align to center
                {
                    const selectedIds = useEditorStore.getState().selectedIds;
                    if (selectedIds.length < 2) {
                        toast.error("Select at least 2 elements to align", { duration: 2000 });
                        break;
                    }

                    const projectState = useProjectStore.getState();
                    const elements: any[] = [];

                    // Collect all selected elements with their positions
                    selectedIds.forEach(id => {
                        const shape = projectState.shapes.find(s => s.id === id);
                        if (shape) {
                            elements.push({ id, type: 'shape', x: shape.x, y: shape.y });
                            return;
                        }

                        const asset = projectState.assets.find(a => a.id === id);
                        if (asset) {
                            elements.push({ id, type: 'asset', x: asset.x, y: asset.y });
                            return;
                        }
                    });

                    if (elements.length < 2) {
                        toast.error("Select at least 2 shapes or assets to align", { duration: 2000 });
                        break;
                    }

                    // Align to center (average position)
                    const avgX = elements.reduce((sum, el) => sum + el.x, 0) / elements.length;
                    const avgY = elements.reduce((sum, el) => sum + el.y, 0) / elements.length;

                    elements.forEach(el => {
                        if (el.type === 'shape') {
                            projectState.updateShape(el.id, { x: avgX, y: avgY });
                        } else if (el.type === 'asset') {
                            projectState.updateAsset(el.id, { x: avgX, y: avgY });
                        }
                    });

                    toast.success(`Aligned ${elements.length} elements to center`, { duration: 2000 });
                }
                break;

            case "array":
                // Create an array of selected elements
                {
                    const selectedIds = useEditorStore.getState().selectedIds;
                    if (selectedIds.length === 0) {
                        toast.error("No elements selected to array", { duration: 2000 });
                        break;
                    }

                    const projectState = useProjectStore.getState();
                    const rows = 2;
                    const cols = 3;
                    const spacing = 100; // 100mm spacing

                    selectedIds.forEach(id => {
                        const shape = projectState.shapes.find(s => s.id === id);
                        const asset = projectState.assets.find(a => a.id === id);

                        if (shape || asset) {
                            const baseX = shape ? shape.x : asset!.x;
                            const baseY = shape ? shape.y : asset!.y;

                            for (let row = 0; row < rows; row++) {
                                for (let col = 0; col < cols; col++) {
                                    if (row === 0 && col === 0) continue; // Skip original

                                    const newX = baseX + col * spacing;
                                    const newY = baseY + row * spacing;

                                    if (shape) {
                                        const newShape = { ...shape, id: `shape-${Date.now()}-${Math.random()}-${row}-${col}`, x: newX, y: newY };
                                        projectState.addShape(newShape);
                                    } else if (asset) {
                                        const newAsset = { ...asset, id: `asset-${Date.now()}-${Math.random()}-${row}-${col}`, x: newX, y: newY };
                                        projectState.addAsset(newAsset);
                                    }
                                }
                            }
                        }
                    });

                    toast.success(`Created ${rows}x${cols} array`, { duration: 2000 });
                }
                break;

            // Annotation tools
            case "label-arrow":
                deactivateAllTools();
                setEditorTool("label-arrow");
                setActiveTool("label-arrow");
                break;
            case "dimensions":
                deactivateAllTools();
                setEditorTool("dimension");
                setActiveTool("dimensions");
                break;
            case "text-annotation":
                deactivateAllTools();
                setEditorTool("text-annotation");
                setActiveTool("text-annotation");
                break;

            // Snapping tools
            case "snap-toggle":
                break;
            case "snap-to-anchor":
                deactivateAllTools();
                useSceneStore.getState().setSnapToAnchorMode(true);
                setActiveTool("snap-to-anchor");
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

            // Import Project
            case "import-project":
                {
                    const input = document.createElement('input');
                    input.type = 'file';
                    input.accept = '.json';
                    input.onchange = (e) => {
                        const file = (e.target as HTMLInputElement).files?.[0];
                        if (!file) return;

                        const reader = new FileReader();
                        reader.onload = (event) => {
                            try {
                                const data = JSON.parse(event.target?.result as string);
                                const { shapes, assets, walls } = useProjectStore.getState();

                                // Import shapes
                                if (data.shapes && Array.isArray(data.shapes)) {
                                    data.shapes.forEach((shape: any) => {
                                        useProjectStore.getState().addShape(shape);
                                    });
                                }

                                // Import assets
                                if (data.assets && Array.isArray(data.assets)) {
                                    data.assets.forEach((asset: any) => {
                                        useProjectStore.getState().addAsset(asset);
                                    });
                                }

                                // Import walls
                                if (data.walls && Array.isArray(data.walls)) {
                                    data.walls.forEach((wall: any) => {
                                        useProjectStore.getState().addWall(wall);
                                    });
                                }

                                toast.success('Project imported successfully!');
                            } catch (error) {
                                toast.error('Failed to import project. Invalid file format.');
                                console.error('Import error:', error);
                            }
                        };
                        reader.readAsText(file);
                    };
                    input.click();
                }
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
        <div
            ref={containerRef}
            className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[9999] pointer-events-auto"
        >
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
                initial={{ y: 100, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ type: "spring", stiffness: 200, damping: 20 }}
                className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl shadow-lg relative"
            >
                {tools.map((tool, index) => (
                    <div
                        key={index}
                        className="flex items-center relative"
                        // Keep dropdown open while hovering over button or menu
                        onMouseLeave={() => setOpenIndex(null)}
                    >
                        {/* Main Button */}
                        <div
                            onMouseEnter={() => setOpenIndex(index)}
                            className="flex items-center"
                        >
                            <motion.button
                                onClick={() => {
                                    const primary = tool.options[0];
                                    if (primary) {
                                        const isCurrentlyActive =
                                            (primary.id === "draw-wall" && (isWallMode || wallDrawingMode)) ||
                                            (primary.id === "draw-line" && isPenMode) ||
                                            (primary.id === "rectangular-select" && activeTool === "rectangular-select") ||
                                            (activeTool === primary.id);

                                        if (isCurrentlyActive) {
                                            deactivateAllTools();
                                            setEditorTool("select");
                                            setActiveTool("pointer-select");
                                        } else {
                                            handleOptionClick(primary);
                                        }
                                    }
                                    setOpenIndex(null);
                                }}
                                whileTap={{ scale: 0.95 }}
                                whileHover={{ scale: 1.03 }}
                                className={`w-8 h-8 border-2 flex items-center justify-center rounded-md ${(tool.options.some((opt) => opt.id === "draw-line") &&
                                    isPenMode) ||
                                    (tool.options.some((opt) => opt.id === "draw-wall") &&
                                        (isWallMode || wallDrawingMode)) ||
                                    (tool.options.some((opt) => opt.id === "rectangular-select") &&
                                        activeTool === "rectangular-select") ||
                                    (tool.options.some((opt) => ["rectangle", "circle", "line", "arrow-shape", "freehand"].includes(opt.id) &&
                                        activeTool === opt.id))
                                    ? "border-blue-500 text-blue-500"
                                    : "border-[var(--accent)] text-[var(--accent)]"
                                    }`}
                                aria-expanded={openIndex === index}
                                aria-haspopup="menu"
                            >
                                {tool.icon}
                            </motion.button>
                        </div>

                        {/* Dropdown Menu */}
                        <AnimatePresence>
                            {openIndex === index && (
                                <motion.div
                                    initial={{ opacity: 0, y: 8, scale: 0.98 }}
                                    animate={{ opacity: 1, y: 0, scale: 1 }}
                                    exit={{ opacity: 0, y: 8, scale: 0.98 }}
                                    transition={{ duration: 0.15 }}
                                    className="absolute bottom-12 left-1/2 -translate-x-1/2 bg-white rounded-md shadow-lg border p-1.5 w-48 z-[10000]"
                                    onMouseEnter={() => setOpenIndex(index)}
                                    onMouseLeave={() => setOpenIndex(null)}
                                >
                                    <div className="px-2 py-1.5 text-xs font-bold text-gray-900 border-b border-gray-100 mb-1">
                                        {tool.label}
                                    </div>
                                    <ul className="space-y-0.5 text-xs text-gray-700">
                                        {tool.options.map((option) => (
                                            <li
                                                key={option.id}
                                                className={`px-2 py-1.5 rounded hover:bg-gray-100 cursor-pointer flex items-center justify-between ${(option.id === "draw-line" && isPenMode) ||
                                                    (option.id === "draw-wall" &&
                                                        (isWallMode || wallDrawingMode)) ||
                                                    (option.id === "rectangular-select" &&
                                                        activeTool === "rectangular-select") ||
                                                    (["rectangle", "circle", "line", "arrow-shape", "freehand"].includes(option.id) &&
                                                        activeTool === option.id)
                                                    ? "bg-blue-100 text-blue-800"
                                                    : ""
                                                    }`}
                                                onClick={() => handleOptionClick(option)}
                                            >
                                                <div className="flex items-center gap-2">
                                                    {option.icon && (
                                                        <span className="text-gray-600">
                                                            {option.icon}
                                                        </span>
                                                    )}
                                                    <span>{option.label}</span>
                                                    {option.id === "draw-wall" && (
                                                        <svg
                                                            className="w-3 h-3 text-gray-400"
                                                            fill="none"
                                                            stroke="currentColor"
                                                            viewBox="0 0 24 24"
                                                        >
                                                            <path
                                                                strokeLinecap="round"
                                                                strokeLinejoin="round"
                                                                strokeWidth={2}
                                                                d="M9 5l7 7-7 7"
                                                            />
                                                        </svg>
                                                    )}
                                                </div>
                                                {(option.id === "draw-line" && isPenMode) ||
                                                    (option.id === "draw-wall" &&
                                                        (isWallMode || wallDrawingMode)) ||
                                                    (option.id === "rectangular-select" &&
                                                        activeTool === "rectangular-select") ||
                                                    (["rectangle", "circle", "line", "arrow-shape", "freehand"].includes(option.id) &&
                                                        activeTool === option.id) ? (
                                                    <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                                                ) : null}
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
                        <div className="text-xs font-medium text-gray-600 mb-2 px-2">
                            Select Wall Type:
                        </div>

                        <ul className="space-y-0.5 text-xs text-gray-700">
                            {/* Partitions */}
                            <li className="px-2 py-1 text-xs font-medium text-gray-500 bg-gray-50">
                                Partitions
                            </li>
                            {[
                                {
                                    id: "partition-75",
                                    label: "Partition Wall (75mm)",
                                    thickness: 1,
                                    visualThickness: 1,
                                    category: "partition",
                                },
                                {
                                    id: "partition-100",
                                    label: "Partition Wall (100mm)",
                                    thickness: 2,
                                    visualThickness: 2,
                                    category: "partition",
                                },
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
                                                    height: "16px",
                                                    backgroundColor: "#10b981",
                                                }}
                                            />
                                            <div
                                                className="bg-gray-400 rounded"
                                                style={{
                                                    width: `${wallType.visualThickness}px`,
                                                    height: "16px",
                                                    backgroundColor: "#10b981",
                                                }}
                                            />
                                        </div>
                                        <span>{wallType.label}</span>
                                    </div>
                                </li>
                            ))}

                            {/* Enclosure Walls */}
                            <li className="px-2 py-1 text-xs font-medium text-gray-500 bg-gray-50 mt-2">
                                Enclosure Walls
                            </li>
                            {[
                                {
                                    id: "enclosure-150",
                                    label: "Enclosure Wall (150mm)",
                                    thickness: 5,
                                    visualThickness: 5,
                                    category: "enclosure",
                                },
                                {
                                    id: "enclosure-225",
                                    label: "Enclosure Wall (225mm)",
                                    thickness: 8,
                                    visualThickness: 8,
                                    category: "enclosure",
                                },
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
                                                    height: "16px",
                                                    backgroundColor: "#3b82f6",
                                                }}
                                            />
                                            <div
                                                className="bg-gray-400 rounded"
                                                style={{
                                                    width: `${wallType.visualThickness}px`,
                                                    height: "16px",
                                                    backgroundColor: "#3b82f6",
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




