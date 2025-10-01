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
  { id: "wall-1", label: "Wall 1", path: "/assets/canvas/wall-1.svg", isCustom: true },
  { id: "wall-2", label: "Wall 2", path: "/assets/canvas/wall-2.svg", isCustom: true },
  { id: "wall-90", label: "Wall 90 degree", path: "/assets/canvas/wall-90-degree.svg", isCustom: true },
  { id: "wall-corner-joined", label: "Wall Corner Joined", path: "/assets/canvas/wall-corner-joined.svg", isCustom: true },
  { id: "wall-corner", label: "Wall Corner", path: "/assets/canvas/wall-corner.svg", isCustom: true },
  { id: "bathtub", label: "Bathtub", path: "/assets/canvas/bathtub.svg", isCustom: true },
  { id: "shower", label: "Shower", path: "/assets/canvas/shower.svg", isCustom: true },
  { id: "sofa", label: "Sofa", path: "/assets/canvas/sofa.svg", isCustom: true },
  { id: "twin-sofa", label: "Twin Sofa", path: "/assets/canvas/twin-sofa.svg", isCustom: true },
  { id: "stairs", label: "Stairs", path: "/assets/canvas/stairs.svg", isCustom: true },
  { id: "wc", label: "WC", path: "/assets/canvas/wc.svg", isCustom: true },
  { id: "oval-shaped-table", label: "Oval Shaped Table", path: "/assets/canvas/oval-shaped-table.svg", isCustom: true },
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

