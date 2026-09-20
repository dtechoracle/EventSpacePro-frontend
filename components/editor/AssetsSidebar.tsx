"use client";

import React, { useMemo, useState } from "react";
import { ASSET_LIBRARY, AssetDef, ASSET_CATEGORIES } from "@/lib/assets";
import { motion } from "framer-motion";
import { InlineSvg } from "@/components/tools/InlineSvg";

type AssetsSidebarProps = {
  isOpen: boolean;
  onClose: () => void;
};

const formatLabel = (text: string) =>
  text
    .toLowerCase()
    .replace(/\b\w/g, c => c.toUpperCase());

export default function AssetsSidebar({ isOpen, onClose }: AssetsSidebarProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set());

  const toggleCategory = (cat: string) => {
    setCollapsedCategories(prev => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  };

  const normalizedSearch = searchTerm.toLowerCase();

  const searchResults = useMemo(() => {
    if (!searchTerm) return [];
    return ASSET_LIBRARY.filter(a =>
      `${a.label} ${a.category}`.toLowerCase().includes(normalizedSearch)
    );
  }, [searchTerm, normalizedSearch]);

  const assetsByCategory = useMemo(() => {
    const map = new Map<string, AssetDef[]>();
    ASSET_CATEGORIES.forEach(cat => {
      const items = ASSET_LIBRARY.filter(a => a.category === cat);
      if (items.length > 0) {
        map.set(cat, items);
      }
    });
    return map;
  }, []);

  const renderAsset = (asset: AssetDef) => {
    return (
      <motion.button
        key={asset.id}
        draggable
        title={asset.label}
        onClick={() => {
          window.dispatchEvent(new CustomEvent("esp-add-asset", { detail: { assetId: asset.id } }));
        }}
        onDragStartCapture={(e: React.DragEvent<HTMLButtonElement>) => {
          e.dataTransfer.setData("assetType", asset.id);

          const dimMatch = asset.label.match(/(\d+(?:\.\d+)?)\s*(mm|cm|m|ft)?\s*[xX]\s*(\d+(?:\.\d+)?)\s*(mm|cm|m|ft)?/i);
          if (dimMatch) {
            const val1 = parseFloat(dimMatch[1]);
            const unit1 = dimMatch[2]?.toLowerCase() || 'mm';
            const val2 = parseFloat(dimMatch[3]);
            const unit2 = dimMatch[4]?.toLowerCase() || unit1 || 'mm';

            const toMm = (val: number, unit: string) => {
              switch (unit) {
                case 'm': return val * 1000;
                case 'cm': return val * 10;
                case 'ft': return val * 304.8;
                default: return val;
              }
            };

            const width = Math.round(toMm(val1, unit1));
            const height = Math.round(toMm(val2, unit2));

            if (width > 10 && height > 10) {
              e.dataTransfer.setData("assetWidth", width.toString());
              e.dataTransfer.setData("assetHeight", height.toString());
            }
          }
        }}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        className="w-full h-16 flex flex-col items-center justify-center p-1 rounded-md border border-slate-200 bg-white hover:bg-slate-50 hover:border-blue-400 transition-all text-slate-800 hover:text-slate-950 group shadow-none"
      >
        <div className="w-8 h-8 flex items-center justify-center overflow-hidden mb-0.5">
          <InlineSvg
            key={asset.path}
            src={asset.path}
            fill="none"
            stroke="#1e293b"
            strokeWidth={0.8}
            category={asset.category}
          />
        </div>
        <span className="text-[0.6rem] text-center font-medium leading-none truncate w-full px-0.5 text-slate-700 group-hover:text-slate-900 transition-colors">
          {formatLabel(asset.label)}
        </span>
      </motion.button>
    );
  };

  if (!isOpen) return null;

  return (
    <div className="w-60 h-full bg-white border-r border-gray-200 flex flex-col flex-shrink-0 z-20">
      {/* Header */}
      <div className="px-3 py-2.5 border-b border-gray-100 flex items-center justify-between flex-shrink-0">
        <span className="text-xs font-bold text-slate-800">Asset Library</span>
        <button
          onClick={onClose}
          className="text-slate-400 hover:text-slate-600 p-0.5 rounded hover:bg-slate-100 transition-colors text-xs"
          title="Close Assets Sidebar"
        >
          ✕
        </button>
      </div>

      {/* Search Bar */}
      <div className="p-2 border-b border-gray-100 flex-shrink-0">
        <input
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          placeholder="Search assets..."
          className="w-full h-7 px-2 text-[11px] rounded bg-slate-100 border border-transparent focus:border-blue-400 focus:bg-white outline-none transition-all"
        />
      </div>

      {/* Content - Scrollable Sections */}
      <div className="flex-1 overflow-y-auto p-2.5 space-y-4">
        {searchTerm ? (
          <div>
            <h3 className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-2">
              Search Results ({searchResults.length})
            </h3>
            {searchResults.length === 0 ? (
              <p className="text-[11px] text-slate-400 italic">No matching assets found.</p>
            ) : (
              <div className="grid grid-cols-3 gap-1.5">
                {searchResults.map(renderAsset)}
              </div>
            )}
          </div>
        ) : (
          Array.from(assetsByCategory.entries()).map(([category, assets]) => {
            const isCollapsed = collapsedCategories.has(category);
            return (
              <section key={category} className="space-y-1.5">
                <button
                  onClick={() => toggleCategory(category)}
                  className="w-full flex items-center justify-between border-b border-slate-100 pb-0.5 hover:bg-slate-50 rounded px-0.5 -mx-0.5 transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-1">
                    <span className="text-[10px] text-slate-400 transition-transform duration-150">
                      {isCollapsed ? '▶' : '▼'}
                    </span>
                    <h3 className="text-[11px] font-bold text-slate-700 tracking-wide">
                      {formatLabel(category)}
                    </h3>
                  </div>
                  <span className="text-[9px] text-slate-400 font-medium">
                    {assets.length} items
                  </span>
                </button>
                {!isCollapsed && (
                  <div className="grid grid-cols-3 gap-1.5 pt-0.5">
                    {assets.map(renderAsset)}
                  </div>
                )}
              </section>
            );
          })
        )}
      </div>
    </div>
  );
}
