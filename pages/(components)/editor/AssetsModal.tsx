"use client"

import Image from "next/image"
import { ASSET_LIBRARY, AssetDef, AssetCategory, ASSET_CATEGORIES } from "@/lib/assets"
import { useEffect, useMemo, useRef, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { InlineSvg } from "@/components/tools/InlineSvg"

type AssetsModalProps = {
  isOpen: boolean
  onClose: () => void
}

const formatLabel = (text: string) =>
  text
    .toLowerCase()
    .replace(/\b\w/g, c => c.toUpperCase())

export default function AssetsModal({ isOpen, onClose }: AssetsModalProps) {
  const modalRef = useRef<HTMLDivElement | null>(null)
  const [position, setPosition] = useState({ x: 0, y: 0 })
  const [activeCategory, setActiveCategory] =
    useState<AssetCategory>("Furniture")
  const [searchTerm, setSearchTerm] = useState("")

  useEffect(() => {
    setPosition({ x: window.innerWidth / 2 - 220, y: 90 })
  }, [])

  const normalizedSearch = searchTerm.toLowerCase()

  const searchResults = useMemo(() => {
    if (!searchTerm) return []
    return ASSET_LIBRARY.filter(a =>
      `${a.label} ${a.category}`.toLowerCase().includes(normalizedSearch)
    )
  }, [searchTerm, normalizedSearch])

  const categoryAssets = useMemo(
    () => ASSET_LIBRARY.filter(a => a.category === activeCategory),
    [activeCategory]
  )

  const renderAsset = (asset: AssetDef) => (
    <motion.button
      key={asset.id}
      draggable
      onDragStartCapture={(e: React.DragEvent<HTMLButtonElement>) => {
        e.dataTransfer.setData("assetType", asset.id);

        // Parse dimensions from name (e.g., "Table 120x60", "1300mm X 650mm", "6ft x 3ft")
        const dimMatch = asset.label.match(/(\d+(?:\.\d+)?)\s*(mm|cm|m|ft)?\s*[xX]\s*(\d+(?:\.\d+)?)\s*(mm|cm|m|ft)?/i);
        if (dimMatch) {
          const val1 = parseFloat(dimMatch[1]);
          const unit1 = dimMatch[2]?.toLowerCase() || 'mm';
          const val2 = parseFloat(dimMatch[3]);
          const unit2 = dimMatch[4]?.toLowerCase() || unit1 || 'mm'; // Inherit unit1 if unit2 missing, else mm

          const toMm = (val: number, unit: string) => {
            switch (unit) {
              case 'm': return val * 1000;
              case 'cm': return val * 10;
              case 'ft': return val * 304.8;
              default: return val; // mm
            }
          };

          const width = Math.round(toMm(val1, unit1));
          const height = Math.round(toMm(val2, unit2));

          // Only use if dimensions are reasonable (> 10mm) to avoid tiny accidental matches
          if (width > 10 && height > 10) {
            e.dataTransfer.setData("assetWidth", width.toString());
            e.dataTransfer.setData("assetHeight", height.toString());
          }
        }
      }}
      whileHover={{ scale: 1.08 }}
      whileTap={{ scale: 0.95 }}
      className="w-[5.5rem] h-[5.5rem] flex flex-col items-center justify-center transition-all text-slate-500 hover:text-slate-900 group"
    >
      <div className="w-16 h-16 flex items-center justify-center overflow-hidden mb-1">
        <InlineSvg
          key={asset.path}
          src={asset.path}
          fill="none"
          stroke="currentColor"
          strokeWidth={1.2}
          category={asset.category}
        />
      </div>
      <span className="text-[0.6rem] text-center font-medium leading-[1.1] truncate w-full px-1 opacity-70 group-hover:opacity-100 transition-opacity">
        {formatLabel(asset.label)}
      </span>
    </motion.button>
  )

  if (!isOpen) return null

  return (
    <motion.div
      ref={modalRef}
      drag
      dragMomentum={false}
      style={{ left: position.x, top: position.y }}
      className="fixed w-[28rem] h-[33rem] bg-white text-gray-900 rounded-lg p-5 shadow-2xl z-[9999] flex flex-col"
      initial={{ opacity: 0, scale: 0.92 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.92 }}
    >
      {/* Header */}
      <div className="flex justify-between items-center mb-4 flex-shrink-0 cursor-grab">
        <span className="text-lg font-medium">Assets</span>
        <button onClick={onClose}>✕</button>
      </div>

      {/* Search */}
      <input
        value={searchTerm}
        onChange={e => setSearchTerm(e.target.value)}
        placeholder="Search assets"
        className="mb-4 h-9 px-3 rounded-lg bg-[#00000008] outline-none flex-shrink-0"
      />

      {/* Content */}
      <div className="flex-1 min-h-0">
        <AnimatePresence mode="wait">
          {searchTerm ? (
            <motion.div
              key="search"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="grid grid-cols-5 gap-3 overflow-y-auto h-full pr-1"
            >
              {searchResults.map(renderAsset)}
            </motion.div>
          ) : (
            <motion.div
              key="library"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col h-full"
            >
              {/* Tabs */}
              <div className="flex gap-2 mb-3 overflow-x-auto flex-shrink-0">
                {ASSET_CATEGORIES.map(category => (
                  <button
                    key={category}
                    onClick={() => setActiveCategory(category)}
                    className={`px-3 py-1 rounded text-xs whitespace-nowrap ${activeCategory === category
                      ? "bg-[var(--accent)] text-white"
                      : "bg-gray-200"
                      }`}
                  >
                    {formatLabel(category)}
                  </button>
                ))}
              </div>

              {/* Assets - Show all for category immediately */}
              <motion.div
                layout
                className="grid grid-cols-5 gap-3 overflow-y-auto flex-1 min-h-0 pr-1"
              >
                {categoryAssets.map(renderAsset)}
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  )
}

