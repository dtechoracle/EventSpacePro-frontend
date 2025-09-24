"use client";

import { IoClose } from "react-icons/io5";
import { ASSET_LIBRARY, AssetDef } from "@/lib/assets";
import { useSceneStore } from "@/store/sceneStore";
import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

type AssetsModalProps = {
  isOpen: boolean;
  onClose: () => void;
};

// Define asset categories for the full library tabs
const ASSET_CATEGORIES = {
  main: ASSET_LIBRARY.filter(a => !["square", "circle", "line"].includes(a.id)),
  shapes: ASSET_LIBRARY.filter(a => ["square", "circle", "line"].includes(a.id)),
};

export default function AssetsModal({ isOpen, onClose }: AssetsModalProps) {
  // const addAsset = useSceneStore((s) => s.addAsset);

  const [hydrated, setHydrated] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const modalRef = useRef<HTMLDivElement | null>(null);
  const isDragging = useRef(false);
  const offset = useRef({ x: 0, y: 0 });

  const [showAll, setShowAll] = useState(false);
  const [activeTab, setActiveTab] = useState<keyof typeof ASSET_CATEGORIES>("main");
  const [searchTerm, setSearchTerm] = useState("");

  // Hydration + initial modal position
  useEffect(() => {
    setHydrated(true);
    const startX = window.innerWidth / 2 - 200;
    const startY = 100;
    setPosition({ x: startX, y: startY });
  }, []);

  const handleMouseDown = (e: React.MouseEvent) => {
    isDragging.current = true;
    offset.current = { x: e.clientX - position.x, y: e.clientY - position.y };
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!isDragging.current) return;
    setPosition({ x: e.clientX - offset.current.x, y: e.clientY - offset.current.y });
  };

  const handleMouseUp = () => {
    isDragging.current = false;
  };

  useEffect(() => {
    if (!hydrated) return;
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [hydrated]);

  if (!hydrated || !isOpen) return null;

  // Generic function to render asset buttons
  const renderAssetButton = (asset: AssetDef) => {
    const Icon = asset.icon;
    return (
      <button
        key={asset.id}
        draggable
        onDragStart={(e) => e.dataTransfer.setData("assetType", asset.id)}
        className="w-[4.5rem] h-[4.5rem] rounded-2xl bg-[#0933BB08] p-2 flex flex-col items-center justify-center"
      >
        <div className="text-[var(--accent)]">
          <Icon size={24} />
        </div>
        <span className="text-[0.625rem] text-[var(--accent)] mt-1">
          {asset.label}
        </span>
      </button>
    );
  };

  // Filter assets based on search term
  const filteredAssets = searchTerm
    ? ASSET_LIBRARY.filter((a) =>
      a.label.toLowerCase().includes(searchTerm.toLowerCase())
    )
    : [];

  return (
    <div
      ref={modalRef}
      className="fixed w-[27.75rem] min-h-[19.5rem] bg-[#FDFDFF] rounded-[2rem] p-5 shadow-2xl z-[9999] cursor-move"
      style={{ left: position.x, top: position.y }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between mb-4 cursor-grab active:cursor-grabbing"
        onMouseDown={handleMouseDown}
      >
        <span className="text-[1.25rem] font-medium text-[#272235]">Assets</span>
        <div className="flex items-center gap-2">
          <select className="w-[16.5rem] h-[2.125rem] rounded-lg px-3 text-sm bg-[#00000008] outline-none">
            <option>Starter Layouts</option>
            <option>Layout 1</option>
            <option>Layout 2</option>
          </select>
          <button onClick={onClose} className="text-gray-500 hover:text-black">
            <IoClose size={20} />
          </button>
        </div>
      </div>

      {/* Search */}
      <input
        type="text"
        placeholder="Search for Assets"
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        className="w-full h-[2.125rem] rounded-lg px-3 text-sm bg-[#00000008] outline-none mb-4"
      />

      {/* Assets Grid */}
      <AnimatePresence>
        {searchTerm ? (
          <motion.div
            key="search-results"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="grid grid-cols-5 gap-3 overflow-y-auto flex-1"
          >
            {filteredAssets.length > 0
              ? filteredAssets?.map(renderAssetButton)
              : <span className="col-span-5 text-center text-gray-400">No assets found</span>
            }
          </motion.div>
        ) : !showAll ? (
          <motion.div
            key="preview"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="grid grid-cols-5 gap-3"
          >
            {ASSET_LIBRARY.slice(0, 5).map(renderAssetButton)}
            <button
              onClick={() => setShowAll(true)}
              className="col-span-5 bg-[var(--accent)] text-white py-1 rounded text-sm"
            >
              See All Assets
            </button>
          </motion.div>
        ) : (
          <motion.div
            key="full-library"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="flex flex-col h-full"
          >
            {/* Tabs */}
            <div className="flex gap-2 mb-2">
              {Object.keys(ASSET_CATEGORIES).map((cat) => (
                <button
                  key={cat}
                  onClick={() => setActiveTab(cat as keyof typeof ASSET_CATEGORIES)}
                  className={`px-3 py-1 rounded ${activeTab === cat
                      ? "bg-[var(--accent)] text-white"
                      : "bg-gray-200 text-gray-700"
                    }`}
                >
                  {cat.charAt(0).toUpperCase() + cat.slice(1)}
                </button>
              ))}
            </div>

            {/* Tab content */}
            <div className="grid grid-cols-5 gap-3 overflow-y-auto flex-1">
              {ASSET_CATEGORIES[activeTab].map(renderAssetButton)}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

