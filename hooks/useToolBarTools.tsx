import React from "react";
import {
  FaMousePointer,
  FaEdit,
  FaComment,
  FaMagnet,
  FaDownload,
  FaBox,
  FaPenNib,
  FaShapes,
  FaSquare,
  FaCircle,
  FaArrowRight,
  FaDrawPolygon,
  FaCut,
  FaArrowsAlt,
  FaCopy,
  FaRedo,
  FaLayerGroup,
  FaLayerGroup as FaUngroup,
  FaAlignLeft,
  FaTh,
  FaArrowDown,
  FaRuler,
  FaFont,
  FaToggleOn,
  FaCrosshairs,
  FaBullseye,
  FaTimes,
  FaFileExport,
  FaExpand,
  FaMinus,
} from "react-icons/fa";

export interface ToolOption {
  id: string;
  label: string;
  icon?: React.ReactNode; // Optional icon for dropdown options
  wallThickness?: number; // Optional wall thickness for wall size options
}

export interface Tool {
  icon: React.ReactNode;
  label: string;
  options: ToolOption[];
}

export function useToolbarTools(): Tool[] {
  return [
    // 1) Drawing
    {
      icon: <FaPenNib size={18} />,
      label: "Drawing",
      options: [
        { id: "draw-line", label: "Draw Line", icon: <FaPenNib size={14} /> },
        { id: "draw-wall", label: "Draw Wall ►", icon: <FaDrawPolygon size={14} /> },
        { id: "add-text", label: "Add Text", icon: <FaComment size={14} /> },
      ],
    },
    // 2) Shapes
    {
      icon: <FaShapes size={18} />,
      label: "Shapes",
      options: [
        { id: "rectangle", label: "Rectangle", icon: <FaSquare size={14} /> },
        { id: "circle", label: "Circle", icon: <FaCircle size={14} /> },
        { id: "line", label: "Line", icon: <FaMinus size={14} /> },
        { id: "arrow-shape", label: "Arrow", icon: <FaArrowRight size={14} /> },
        { id: "freehand", label: "Freehand Draw", icon: <FaPenNib size={14} /> },
        { id: "polygon", label: "Polygon", icon: <FaDrawPolygon size={14} /> },
      ],
    },
    // 3) Assets
    {
      icon: <FaBox size={18} />,
      label: "Assets",
      options: [
        { id: "open-assets", label: "Assets", icon: <FaBox size={14} /> },
      ],
    },
    // 4) Selection
    {
      icon: <FaMousePointer size={18} />,
      label: "Selection",
      options: [
        { id: "pointer-select", label: "Pointer", icon: <FaMousePointer size={14} /> },
        { id: "rectangular-select", label: "Rectangular Selector", icon: <FaExpand size={14} /> },
      ],
    },
    // 5) Modify
    {
      icon: <FaEdit size={18} />,
      label: "Modify",
      options: [
        { id: "trim", label: "Trim", icon: <FaCut size={14} /> },
        { id: "move", label: "Move", icon: <FaArrowsAlt size={14} /> },
        { id: "copy", label: "Copy", icon: <FaCopy size={14} /> },
        { id: "rotate", label: "Rotate", icon: <FaRedo size={14} /> },
        { id: "group", label: "Group", icon: <FaLayerGroup size={14} /> },
        { id: "ungroup", label: "Ungroup", icon: <FaUngroup size={14} /> },
        { id: "align", label: "Align", icon: <FaAlignLeft size={14} /> },
        { id: "array", label: "Array", icon: <FaTh size={14} /> },
      ],
    },
    // 6) Annotations (unchanged)
    {
      icon: <FaComment size={18} />,
      label: "Annotations",
      options: [
        { id: "label-arrow", label: "Label with Arrow", icon: <FaArrowDown size={14} /> },
        { id: "dimensions", label: "Dimensions", icon: <FaRuler size={14} /> },
        { id: "text-annotation", label: "Text", icon: <FaFont size={14} /> },
      ],
    },
    // 7) Snapping
    {
      icon: <FaMagnet size={18} />,
      label: "Snapping",
      options: [
        { id: "snap-toggle", label: "Toggle Snapping", icon: <FaToggleOn size={14} /> },
        { id: "snap-to-anchor", label: "Snap to Anchor", icon: <FaBullseye size={14} /> },
        { id: "snap-endpoint", label: "Snap to Endpoint", icon: <FaCrosshairs size={14} /> },
        { id: "snap-midpoint", label: "Snap to Midpoint", icon: <FaBullseye size={14} /> },
        { id: "snap-center", label: "Snap to Center", icon: <FaTimes size={14} /> },
        { id: "snap-intersection", label: "Snap to Intersection", icon: <FaTimes size={14} /> },
        { id: "snap-perpendicular", label: "Snap to Perpendicular", icon: <FaTimes size={14} /> },
        { id: "snap-grid", label: "Snap to Grid", icon: <FaTimes size={14} /> },
      ],
    },
    // 8) Export (unchanged)
    {
      icon: <FaDownload size={18} />,
      label: "Export",
      options: [{ id: "export-project", label: "Export Project", icon: <FaFileExport size={14} /> }],
    },
  ];
}

