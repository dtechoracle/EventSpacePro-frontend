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
  FaFont,
} from "react-icons/fa";
import { IconType } from "react-icons";

// 🔹 This type supports both React icons and custom SVG paths
export type AssetDef = {
  id: string;
  label: string;
  icon?: IconType; // React component for icons
  path?: string; // SVG file path for custom assets
  isCustom?: boolean; // flag to indicate if it's a custom SVG
};

// Custom SVG assets from /public/assets/canvas
const CUSTOM_SVG_ASSETS: AssetDef[] = [
  // Basic furniture
  {
    id: "circular-small-table",
    label: "Small Round Table",
    path: "/assets/canvas/circular-small-table.svg",
    isCustom: true,
  },
  {
    id: "double-door",
    label: "Double Door",
    path: "/assets/canvas/double-door.svg",
    isCustom: true,
  },
  {
    id: "normal-chair",
    label: "Normal Chair",
    path: "/assets/canvas/normal-chair.svg",
    isCustom: true,
  },
  {
    id: "one-door",
    label: "Single Door",
    path: "/assets/canvas/one-door.svg",
    isCustom: true,
  },
  {
    id: "padded-chair",
    label: "Padded Chair",
    path: "/assets/canvas/padded-chair.svg",
    isCustom: true,
  },
  {
    id: "rectangular-table",
    label: "Rectangular Table",
    path: "/assets/canvas/rectangular-table.svg",
    isCustom: true,
  },
  {
    id: "round-table",
    label: "Round Table",
    path: "/assets/canvas/round-table.svg",
    isCustom: true,
  },
  {
    id: "square-table",
    label: "Square Table",
    path: "/assets/canvas/square-table.svg",
    isCustom: true,
  },
  {
    id: "oval-shaped-table",
    label: "Oval Shaped Table",
    path: "/assets/canvas/oval-shaped-table.svg",
    isCustom: true,
  },

  // Cocktail Tables
  {
    id: "cocktail-table-1000mm",
    label: "1000mm Cocktail Table",
    path: "/assets/canvas/1000mm Cocktail table.svg",
    isCustom: true,
  },
  {
    id: "cocktail-table-700mm",
    label: "700mm Cocktail Table",
    path: "/assets/canvas/700mm Cocktail table.svg",
    isCustom: true,
  },

  // Round Tables
  {
    id: "round-table-1200mm",
    label: "1200mm (4ft) Round Table",
    path: "/assets/canvas/1200mm (4ft) round table.svg",
    isCustom: true,
  },
  {
    id: "round-table-1500mm",
    label: "1500mm (5ft) Round Table",
    path: "/assets/canvas/1500mm (5ft) round table.svg",
    isCustom: true,
  },
  {
    id: "round-table-2400mm",
    label: "2400mm (8ft) Round Table",
    path: "/assets/canvas/2400mm (8ft) round table.svg",
    isCustom: true,
  },

  // Coffee Tables
  {
    id: "coffee-table-500x700mm",
    label: "500mm x 700mm Coffee Table",
    path: "/assets/canvas/500mm X 700mm Coffee Table.svg",
    isCustom: true,
  },
  {
    id: "coffee-table-900x900mm",
    label: "900mm x 900mm Coffee Table",
    path: "/assets/canvas/900mm X 900mm Coffee Table.svg",
    isCustom: true,
  },
  {
    id: "coffee-table-1200x600mm",
    label: "1200mm x 600mm Coffee Table",
    path: "/assets/canvas/1200mm X 600mm Coffee Table.svg",
    isCustom: true,
  },
  {
    id: "coffee-table-1300x650mm",
    label: "1300mm x 650mm Coffee Table",
    path: "/assets/canvas/1300mm X 650mm Coffee Table.svg",
    isCustom: true,
  },

  // Rectangular Tables
  {
    id: "rect-table-6ft-2.5ft",
    label: "6ft x 2.5ft Rectangular Table",
    path: "/assets/canvas/6ft by 2.5ft Rectangular Table.svg",
    isCustom: true,
  },
  {
    id: "rect-table-6ft-2.5ft-alt",
    label: "6ft x 2.5ft Rectangular Table (Alt)",
    path: "/assets/canvas/6ft by 2.5ft Rectangular Table (1).svg",
    isCustom: true,
  },
  {
    id: "rect-table-6ft-3ft",
    label: "6ft x 3ft Rectangular Table",
    path: "/assets/canvas/6ft X 3ft Rectangular Table.svg",
    isCustom: true,
  },
  {
    id: "rect-table-8ft-2.5ft",
    label: "8ft x 2.5ft Rectangular Table",
    path: "/assets/canvas/8ft by 2.5ft Rectangular Table.svg",
    isCustom: true,
  },
  {
    id: "rect-table-8ft-3ft",
    label: "8ft x 3ft Rectangular Table",
    path: "/assets/canvas/8ft by 3ft Rectangular Table.svg",
    isCustom: true,
  },

  // Modular Stages
  {
    id: "stage-500x500mm",
    label: "500mm x 500mm Modular Stage",
    path: "/assets/canvas/500mm X 500mm Modular Stage.svg",
    isCustom: true,
  },
  {
    id: "stage-1m-1m",
    label: "1m x 1m Modular Stage",
    path: "/assets/canvas/1m X 1m modular stage.svg",
    isCustom: true,
  },
  {
    id: "stage-2ft-2ft",
    label: "2ft x 2ft Modular Stage",
    path: "/assets/canvas/2ft X 2ft modular stage.svg",
    isCustom: true,
  },
  {
    id: "stage-2ft-4ft",
    label: "2ft x 4ft Modular Stage",
    path: "/assets/canvas/2ft X 4ft modular stage.svg",
    isCustom: true,
  },
  {
    id: "stage-2ft-4ft-alt",
    label: "2ft x 4ft Modular Stage (Alt)",
    path: "/assets/canvas/2ft X 4ft modular stage (1).svg",
    isCustom: true,
  },
  {
    id: "stage-3ft-3ft",
    label: "3ft x 3ft Modular Stage",
    path: "/assets/canvas/3ft X 3ft modular stage.svg",
    isCustom: true,
  },

  // Sofas
  {
    id: "sofa",
    label: "Sofa",
    path: "/assets/canvas/sofa.svg",
    isCustom: true,
  },
  {
    id: "twin-sofa",
    label: "Twin Sofa",
    path: "/assets/canvas/twin-sofa.svg",
    isCustom: true,
  },
  {
    id: "l-shaped-sofa-6-seater",
    label: "6 Seater L Shaped Sofa",
    path: "/assets/canvas/6 Seater L Shaped Sofa.svg",
    isCustom: true,
  },

  // Walls
  {
    id: "wall",
    label: "Wall",
    path: "/assets/canvas/wall.svg",
    isCustom: true,
  },
  {
    id: "wall-1",
    label: "Wall 1",
    path: "/assets/canvas/wall-1.svg",
    isCustom: true,
  },
  {
    id: "wall-2",
    label: "Wall 2",
    path: "/assets/canvas/wall-2.svg",
    isCustom: true,
  },
  {
    id: "wall-90",
    label: "Wall 90 degree",
    path: "/assets/canvas/wall-90-degree.svg",
    isCustom: true,
  },
  {
    id: "wall-corner-joined",
    label: "Wall Corner Joined",
    path: "/assets/canvas/wall-corner-joined.svg",
    isCustom: true,
  },
  {
    id: "wall-corner",
    label: "Wall Corner",
    path: "/assets/canvas/wall-corner.svg",
    isCustom: true,
  },

  // Bathroom fixtures
  {
    id: "bathtub",
    label: "Bathtub",
    path: "/assets/canvas/bathtub.svg",
    isCustom: true,
  },
  {
    id: "shower",
    label: "Shower",
    path: "/assets/canvas/shower.svg",
    isCustom: true,
  },
  { id: "wc", label: "WC", path: "/assets/canvas/wc.svg", isCustom: true },

  // Other fixtures
  {
    id: "stairs",
    label: "Stairs",
    path: "/assets/canvas/stairs.svg",
    isCustom: true,
  },
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
  {
    id: "square",
    label: "Square",
    icon: () => <div className='w-full h-full bg-gray-300' />,
  },
  {
    id: "circle",
    label: "Circle",
    icon: () => <div className='w-full h-full rounded-full bg-gray-300' />,
  },
  {
    id: "line",
    label: "Line",
    icon: () => <div className='w-full h-1 bg-gray-300' />,
  },
  {
    id: "double-line",
    label: "Double Line",
    icon: () => (
      <div className='w-2 h-full flex flex-row justify-center space-x-1'>
        <div className='w-0.5 h-full bg-gray-300' />
        <div className='w-0.5 h-full bg-gray-300' />
      </div>
    ),
  },
  { id: "text", label: "Text", icon: FaFont },
  // Add custom SVG assets
  ...CUSTOM_SVG_ASSETS,
];
