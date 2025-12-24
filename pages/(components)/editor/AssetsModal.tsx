"use client"

import Image from "next/image"
import { ASSET_LIBRARY, AssetDef, AssetCategory } from "@/lib/assets"
import { useEffect, useMemo, useRef, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"

type AssetsModalProps = {
  isOpen: boolean
  onClose: () => void
}

const CATEGORIES: AssetCategory[] = [
  "Funiture",
  "Layout",
  "Sitting Styles",
  "Windows and column",
]

const formatLabel = (text: string) =>
  text
    .toLowerCase()
    .replace(/\b\w/g, c => c.toUpperCase())

export default function AssetsModal({ isOpen, onClose }: AssetsModalProps) {
  const modalRef = useRef<HTMLDivElement | null>(null)
  const [position, setPosition] = useState({ x: 0, y: 0 })
  const [activeCategory, setActiveCategory] =
    useState<AssetCategory>("Funiture")
  const [searchTerm, setSearchTerm] = useState("")
  const [showAll, setShowAll] = useState(false)

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

  const previewAssets = useMemo(
    () => [...ASSET_LIBRARY].sort(() => 0.5 - Math.random()).slice(0, 8),
    []
  )

  const renderAsset = (asset: AssetDef) => (
    <motion.button
      key={asset.id}
      draggable
      onDragStartCapture={(e: React.DragEvent<HTMLButtonElement>) =>
        e.dataTransfer.setData("assetType", asset.id)
      }
      whileHover={{ scale: 1.08 }}
      whileTap={{ scale: 0.95 }}
      className="w-[4.5rem] h-[4.5rem] rounded-2xl bg-[#00000005] hover:bg-[#0933BB12] p-2 flex flex-col items-center justify-center"
    >
      <Image src={asset.path} alt={asset.label} width={26} height={26} />
      <span className="text-[0.6rem] mt-1 text-center leading-tight">
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
      className="fixed w-[28rem] h-[33rem] bg-white rounded-[2rem] p-5 shadow-2xl z-[9999] flex flex-col"
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
          ) : !showAll ? (
            <motion.div
              key="preview"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="grid grid-cols-4 gap-4"
            >
              {previewAssets.map(renderAsset)}
              <button
                onClick={() => setShowAll(true)}
                className="col-span-4 mt-2 bg-[var(--accent)] text-white rounded-lg py-1"
              >
                Browse All
              </button>
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
                {CATEGORIES.map(cat => (
                  <button
                    key={cat}
                    onClick={() => setActiveCategory(cat)}
                    className={`px-3 py-1 rounded text-xs whitespace-nowrap ${
                      activeCategory === cat
                        ? "bg-[var(--accent)] text-white"
                        : "bg-gray-200"
                    }`}
                  >
                    {formatLabel(cat)}
                  </button>
                ))}
              </div>

              {/* Assets */}
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

