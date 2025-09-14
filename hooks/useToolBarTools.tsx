import React from "react";
import {
  FaPaperPlane,
  FaPuzzlePiece,
  FaShapes,
  FaPencilRuler,
  FaColumns,
  FaBriefcase,
} from "react-icons/fa";
import { RiPushpinLine } from "react-icons/ri";

export interface ToolOption {
  id: string;
  label: string;
}

export interface Tool {
  icon: React.ReactNode;
  label: string;
  options: ToolOption[];
}

export function useToolbarTools(): Tool[] {
  return [
    {
      icon: <FaPaperPlane size={18} />,
      label: "Tool 1",
      options: [
        { id: "toggle-preview", label: "Toggle Preview" },
        { id: "reset-layout", label: "Reset Layout" },
      ],
    },
    {
      icon: <FaPuzzlePiece size={18} />,
      label: "Tool 2",
      options: [
        { id: "open-assets", label: "Assets" },
      ],
    },
    {
      icon: <FaShapes size={18} />,
      label: "Tool 3",
      options: [{ id: "randomize-shapes", label: "Randomize Shapes" }],
    },
    {
      icon: <RiPushpinLine size={18} />,
      label: "Tool 4",
      options: [{ id: "pin-toolbar", label: "Pin Toolbar" }],
    },
    {
      icon: <FaPencilRuler size={18} />,
      label: "Tool 5",
      options: [{ id: "toggle-edit-mode", label: "Toggle Edit Mode" }],
    },
    {
      icon: <FaColumns size={18} />,
      label: "Tool 6",
      options: [{ id: "split-view", label: "Split View" }],
    },
    {
      icon: <FaBriefcase size={18} />,
      label: "Tool 7",
      options: [{ id: "export-project", label: "Export Project" }],
    },
  ];
}

