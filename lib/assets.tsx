import {
  FaChair,
  FaUtensils,
  FaMusic,
  FaBeer,
  FaBirthdayCake,
  FaMicrophone,
  FaTable,
  FaWineGlassAlt,
  FaUsers,
  FaCamera,
} from "react-icons/fa";
import { IconType } from "react-icons";

// 🔹 This type can be swapped later to point to SVG paths instead of React components
export type AssetDef = {
  id: string;
  label: string;
  icon: IconType; // currently a React component
  path?: string;  // optional, for when you switch to real SVG files
};

export const ASSET_LIBRARY: AssetDef[] = [
  { id: "chair", label: "Chair", icon: FaChair },
  { id: "table", label: "Table", icon: FaTable },
  { id: "guests", label: "Guests", icon: FaUsers },
  { id: "food", label: "Food", icon: FaUtensils },
  { id: "drinks", label: "Drinks", icon: FaBeer },
  { id: "music", label: "Music", icon: FaMusic },
  { id: "mic", label: "Mic", icon: FaMicrophone },
  { id: "cake", label: "Cake", icon: FaBirthdayCake },
  { id: "wine", label: "Wine", icon: FaWineGlassAlt },
  { id: "camera", label: "Camera", icon: FaCamera },
  { id: "square", label: "Square", icon: () => <div className="w-full h-full bg-gray-300" /> },
  { id: "circle", label: "Circle", icon: () => <div className="w-full h-full rounded-full bg-gray-300" /> },
  { id: "line", label: "Line", icon: () => <div className="w-full h-1 bg-gray-300" /> },
];

