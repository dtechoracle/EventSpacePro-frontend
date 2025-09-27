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

// 🔹 This type supports both React icons and custom SVG paths
export type AssetDef = {
  id: string;
  label: string;
  icon?: IconType; // React component for icons
  path?: string;   // SVG file path for custom assets
  isCustom?: boolean; // flag to indicate if it's a custom SVG
};

// Custom SVG assets from /public/assets/canvas
const CUSTOM_SVG_ASSETS: AssetDef[] = [
  { id: "circular-small-table", label: "Small Round Table", path: "/assets/canvas/circular-small-table.svg", isCustom: true },
  { id: "double-door", label: "Double Door", path: "/assets/canvas/double-door.svg", isCustom: true },
  { id: "normal-chair", label: "Normal Chair", path: "/assets/canvas/normal-chair.svg", isCustom: true },
  { id: "one-door", label: "Single Door", path: "/assets/canvas/one-door.svg", isCustom: true },
  { id: "padded-chair", label: "Padded Chair", path: "/assets/canvas/padded-chair.svg", isCustom: true },
  { id: "rectangular-table", label: "Rectangular Table", path: "/assets/canvas/rectangular-table.svg", isCustom: true },
  { id: "round-table", label: "Round Table", path: "/assets/canvas/round-table.svg", isCustom: true },
  { id: "square-table", label: "Square Table", path: "/assets/canvas/square-table.svg", isCustom: true },
  { id: "wall", label: "Wall", path: "/assets/canvas/wall.svg", isCustom: true },
];

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
  // Add custom SVG assets
  ...CUSTOM_SVG_ASSETS,
];

