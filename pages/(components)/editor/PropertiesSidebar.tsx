import { useState } from "react";
import { motion } from "framer-motion";
import {
  FaUserCircle,
  FaChevronDown,
  FaChevronRight,
  FaEllipsisH,
  FaPlus,
} from "react-icons/fa";
import { IoPlayOutline } from "react-icons/io5";
import ShareModal from "./ShareModal";

export default function PropertiesSidebar() {
  // Dropdown toggles
  const [showModel, setShowModel] = useState(true);
  const [showCanvas, setShowCanvas] = useState(true);
  const [showCustom, setShowCustom] = useState(true);

  // Example states
  const [modelName, setModelName] = useState("");
  const [canvasName, setCanvasName] = useState("");
  const [activeLayer, setActiveLayer] = useState("Layer 1");
  const [wireframe, setWireframe] = useState(false);
  const [grid, setGrid] = useState(false);
  const [unit, setUnit] = useState("px");
  const [strokeScale, setStrokeScale] = useState<number | "">(1);
  const [bgColor, setBgColor] = useState("#ffffff");

  // Custom properties
  const [drawingName, setDrawingName] = useState("");
  const [pageNumber, setPageNumber] = useState("");
  const [pricing, setPricing] = useState("");
  const [location, setLocation] = useState("");
const [showShareModal, setShowShareModal] = useState(false)

  return (
    <aside className="h-screen flex flex-col p-3 overflow-y-auto text-sm">
      {/* Top bar */}
      {showShareModal && <ShareModal onClose={() => setShowShareModal(false)}/> }
      <div className="flex items-center justify-between mb-8">
        <FaUserCircle
          className="text-blue-600 bg-blue-100 rounded-full p-0.5"
          size={28}
        />
        <div className="flex items-center gap-1">
          <button className="p-1 rounded hover:bg-gray-100">
            <IoPlayOutline size={14} />
          </button>
          <button className="bg-[var(--accent)] text-white px-2 py-1.5 rounded text-xs shadow" onClick={() => setShowShareModal(true)}>
            Share
          </button>
        </div>
      </div>

      {/* Model Section */}
      <div className="mb-5">
        <button
          className="flex items-center gap-1 text-xs font-semibold tracking-wide mb-1"
          onClick={() => setShowModel(!showModel)}
        >
          {showModel ? <FaChevronDown size={12} /> : <FaChevronRight size={12} />} Model
        </button>
        {showModel && (
          <div className="space-y-3 pl-5 text-xs">
            <div className="flex justify-between items-center">
              <span>Name</span>
              <input
                type="text"
                value={modelName}
                placeholder="New Model"
                onChange={(e) => setModelName(e.target.value)}
                className="sidebar-input"
              />
            </div>
            <div className="flex justify-between items-center">
              <span className="w-full">Owner</span>
              <span className="font-medium w-full">John Doe</span>
            </div>
          </div>
        )}
      </div>

      {/* Model Canvas Section */}
      <div className="mb-3">
        <button
          className="flex items-center gap-1 text-xs font-semibold tracking-wide mb-1"
          onClick={() => setShowCanvas(!showCanvas)}
        >
          {showCanvas ? <FaChevronDown size={12} /> : <FaChevronRight size={12} />} Model Canvas
        </button>
        {showCanvas && (
          <div className="space-y-1 pl-5 text-xs">
            <div className="flex justify-between items-center">
              <span>Name</span>
              <input
                type="text"
                placeholder="new canvas name"
                value={canvasName}
                onChange={(e) => setCanvasName(e.target.value)}
                className="sidebar-input"
              />
            </div>

            <div className="flex justify-between items-center">
              <span>Active Layer</span>
              <select
                value={activeLayer}
                onChange={(e) => setActiveLayer(e.target.value)}
                className="sidebar-input"
              >
                <option>Layer 1</option>
                <option>Layer 2</option>
              </select>
            </div>

            <div className="flex justify-between items-center">
              <span>Wireframe</span>
              <div className="p-1 rounded-md bg-gray-200 inline-flex cursor-pointer">
                <div className="relative flex w-28 h-5 rounded-sm overflow-hidden">
                  <motion.div
                    layout
                    transition={{ type: "spring", stiffness: 300, damping: 25 }}
                    className="absolute top-0 bottom-0 w-1/2 bg-white rounded-sm"
                    style={{ left: wireframe ? "0%" : "50%" }}
                  />

                  <div
                    className={`w-1/2 flex items-center justify-center relative z-10 select-none text-black`}
                    onClick={() => setWireframe(true)}
                  >
                    On
                  </div>

                  <div
                    className={`w-1/2 flex items-center justify-center relative z-10 select-none text-black`}
                    onClick={() => setWireframe(false)}
                  >
                    Off
                  </div>
                </div>
              </div>

            </div>

            <div className="flex justify-between items-center">
              <span>Grid</span>

              <div className="p-1 rounded-md bg-gray-200 inline-flex cursor-pointer">
                <div className="relative flex w-28 h-5 rounded-sm overflow-hidden">
                  <motion.div
                    layout
                    transition={{ type: "spring", stiffness: 300, damping: 25 }}
                    className="absolute top-0 bottom-0 w-1/2 bg-white rounded-sm"
                    style={{ left: grid ? "0%" : "50%" }}
                  />

                  <div
                    className={`w-1/2 flex items-center justify-center relative z-10 select-none text-black`}
                    onClick={() => setGrid(true)}
                  >
                    Show
                  </div>

                  <div
                    className={`w-1/2 flex items-center justify-center relative z-10 select-none text-black`}
                    onClick={() => setGrid(false)}
                  >
                    Hide
                  </div>
                </div>
              </div>

            </div>

            <div className="flex justify-between items-center">
              <span>Unit</span>
              <div className="flex gap-1 items-center">
                <select
                  value={unit}
                  onChange={(e) => setUnit(e.target.value)}
                  className="sidebar-input w-22"
                >
                  <option>px</option>
                  <option>cm</option>
                  <option>in</option>
                </select>
                <button className="sidebar-input w-5">
                  <FaEllipsisH size={10} />
                </button>
              </div>
            </div>

            <div className="flex justify-between items-center">
              <span>Stroke Scale</span>
              <div className="flex items-center overflow-hidden sidebar-input">
                <input
                  type="number"
                  value={strokeScale}
                  onChange={(e) =>
                    setStrokeScale(e.target.value === "" ? "" : +e.target.value)
                  }
                  className="px-1 py-0.5 w-20 outline-none text-xs"
                />
                <button className="px-1 border-l bg-gray-100">
                  <FaChevronDown size={10} />
                </button>
              </div>
            </div>

            <div className="flex justify-between items-center">
              <span>Background</span>
              <div className="flex items-center rounded overflow-hidden sidebar-input">
                <input
                  type="text"
                  value={bgColor}
                  onChange={(e) => setBgColor(e.target.value)}
                  className="px-1 py-0.5 w-20 outline-none text-xs"
                />
                <input
                  type="color"
                  value={bgColor}
                  onChange={(e) => setBgColor(e.target.value)}
                  className="w-6 h-6 border-l cursor-pointer"
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Custom Properties Section */}
      <div className="mb-3">
        <button
          className="flex items-center gap-1 text-xs font-semibold tracking-wide mb-1"
          onClick={() => setShowCustom(!showCustom)}
        >
          {showCustom ? <FaChevronDown size={12} /> : <FaChevronRight size={12} />} Custom Properties
        </button>
        {showCustom && (
          <div className="space-y-1 pl-5 text-xs">
            <div className="flex justify-between items-center">
              <span>Model</span>
              <button className="p-0.5 text-black/35">
                <FaPlus size={10} />
              </button>
            </div>

            <div className="flex justify-between items-center">
              <span>Drawing Name</span>
              <div className="flex items-center rounded overflow-hidden sidebar-input">
                <input
                  type="text"
                  value={drawingName}
                  onChange={(e) => setDrawingName(e.target.value)}
                  className="px-1 py-0.5 w-22 outline-none text-xs"
                />
                <button className="px-1 border-l bg-gray-100">
                  <FaChevronDown size={10} />
                </button>
              </div>
            </div>

            <div className="flex justify-between items-center">
              <span>Page Number</span>
              <div className="flex items-center sidebar-input rounded overflow-hidden">
                <input
                  type="text"
                  value={pageNumber}
                  onChange={(e) => setPageNumber(e.target.value)}
                  className="px-1 py-0.5 w-22 outline-none text-xs"
                />
                <button className="px-1 border-l bg-gray-100">
                  <FaChevronDown size={10} />
                </button>
              </div>
            </div>

            <div className="flex justify-between items-center">
              <span>Pricing</span>
              <div className="flex items-center sidebar-input rounded overflow-hidden">
                <span className="px-1 text-gray-500">$</span>
                <input
                  type="text"
                  value={pricing}
                  onChange={(e) => setPricing(e.target.value)}
                  className="px-1 py-0.5 w-16 outline-none text-xs"
                />
                <button className="px-1 border-l bg-gray-100">
                  <FaChevronDown size={10} />
                </button>
              </div>
            </div>

            <div className="flex justify-between items-center">
              <span>Location</span>
              <div className="flex items-center sidebar-input rounded overflow-hidden">
                <input
                  type="text"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  className="px-1 py-0.5 w-22 outline-none text-xs"
                />
                <button className="px-1 border-l bg-gray-100">
                  <FaChevronDown size={10} />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}

