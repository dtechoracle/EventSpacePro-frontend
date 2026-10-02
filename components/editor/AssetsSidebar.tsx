"use client";

import React, { useMemo, useState, useCallback, useRef, useEffect } from "react";
import { ASSET_LIBRARY, AssetDef, ASSET_CATEGORIES } from "@/lib/assets";
import { getRasterAssetPath } from "@/utils/assetRasterPath";

type AssetsSidebarProps = {
  isOpen: boolean;
  onClose: () => void;
};

const SEARCH_RESULT_LIMIT = 40;

const formatLabel = (text: string) =>
  text
    .toLowerCase()
    .replace(/\b\w/g, c => c.toUpperCase());

const thumbCache = new Map<string, string | null>();
const getThumbnailPath = (asset: AssetDef): string | null => {
  const cached = thumbCache.get(asset.id);
  if (cached !== undefined) return cached;
  let result: string | null = null;
  if (asset.path) {
    if (asset.category === "Venue") {
      result = asset.path
        .replace('/assets/preloaded-venues/', '/assets/thumbnails/preloaded-venues/')
        .replace(/\.(svg|dwg|dxf)$/i, '.png');
      if (result) result = `${result}?v=svgo5`;
    } else if (asset.path.toLowerCase().endsWith(".svg")) {
      const rasterPath = getRasterAssetPath(asset.path);
      result = rasterPath ? `${rasterPath}?v=svgo9` : null;
    } else {
      result = encodeURI(asset.path);
    }
  }
  thumbCache.set(asset.id, result);
  return result;
};

const AssetCard = React.memo(function AssetCard({ asset }: { asset: AssetDef }) {
  const thumbnailSrc = getThumbnailPath(asset);
  const [imgFailed, setImgFailed] = useState(false);
  const useFallback = !thumbnailSrc || imgFailed;

  const handleDragStart = useCallback(
    (e: React.DragEvent<HTMLButtonElement>) => {
      e.dataTransfer.setData("assetType", asset.id);
      const dimMatch = asset.label.match(
        /(\d+(?:\.\d+)?)\s*(mm|cm|m|ft)?\s*[xX]\s*(\d+(?:\.\d+)?)\s*(mm|cm|m|ft)?/i
      );
      if (dimMatch) {
        const val1 = parseFloat(dimMatch[1]);
        const unit1 = dimMatch[2]?.toLowerCase() || "mm";
        const val2 = parseFloat(dimMatch[3]);
        const unit2 = dimMatch[4]?.toLowerCase() || unit1 || "mm";
        const toMm = (val: number, unit: string) => {
          switch (unit) {
            case "m": return val * 1000;
            case "cm": return val * 10;
            case "ft": return val * 304.8;
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
    },
    [asset.id, asset.label]
  );

  const handleClick = useCallback(() => {
    window.dispatchEvent(
      new CustomEvent("esp-add-asset", { detail: { assetId: asset.id } })
    );
  }, [asset.id]);

  const handleImgError = useCallback(() => {
    setImgFailed(true);
  }, []);

  return (
    <button
      draggable
      title={asset.label}
      onClick={handleClick}
      onDragStartCapture={handleDragStart}
      className="w-full h-16 flex flex-col items-center justify-center p-1 rounded-md border border-slate-200 bg-white hover:bg-slate-50 hover:border-blue-400 transition-all text-slate-800 hover:text-slate-950 group shadow-none"
    >
      <div className="w-8 h-8 flex items-center justify-center overflow-hidden mb-0.5">
        {!useFallback ? (
          <img
            src={thumbnailSrc!}
            alt={asset.label}
            className="w-full h-full object-contain pointer-events-none"
            loading="lazy"
            onError={handleImgError}
          />
        ) : (
          <div className="w-7 h-7 flex items-center justify-center rounded bg-slate-100 text-slate-400 text-[10px] font-bold pointer-events-none select-none">
            {asset.label.slice(0, 2).toUpperCase()}
          </div>
        )}
      </div>
      <span className="text-[0.6rem] text-center font-medium leading-none truncate w-full px-0.5 text-slate-700 group-hover:text-slate-900 transition-colors">
        {formatLabel(asset.label)}
      </span>
    </button>
  );
});

export default function AssetsSidebar({ isOpen, onClose }: AssetsSidebarProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setDebouncedSearch(searchTerm), 150);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [searchTerm]);

  const toggleCategory = useCallback((cat: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  }, []);

  const normalizedSearch = debouncedSearch.toLowerCase();

  const searchResults = useMemo(() => {
    if (!debouncedSearch) return [];
    const matches = ASSET_LIBRARY.filter(a =>
      `${a.label} ${a.category}`.toLowerCase().includes(normalizedSearch)
    );
    return matches.slice(0, SEARCH_RESULT_LIMIT);
  }, [debouncedSearch, normalizedSearch]);

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

  if (!isOpen) return null;

  return (
    <div className="w-60 h-full bg-white border-r border-gray-200 flex flex-col flex-shrink-0 z-20">
      {/* Header */}
      <div className="px-3 py-2.5 flex items-center justify-between flex-shrink-0">
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
      <div className="p-2 flex-shrink-0">
        <input
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          placeholder="Search assets..."
          className="w-full h-7 px-2 text-[11px] rounded bg-slate-100 border border-transparent focus:border-blue-400 focus:bg-white outline-none transition-all"
        />
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-2.5 space-y-4">
        {debouncedSearch ? (
          <div>
            <h3 className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-2">
              Search Results
            </h3>
            {searchResults.length === 0 ? (
              <p className="text-[11px] text-slate-400 italic">No matching assets found.</p>
            ) : (
              <div className="grid grid-cols-3 gap-1.5">
                {searchResults.map(a => (
                  <AssetCard key={a.id} asset={a} />
                ))}
              </div>
            )}
          </div>
        ) : (
          Array.from(assetsByCategory.entries()).map(([category, assets]) => {
            const isExpanded = expandedCategories.has(category);
            return (
              <section key={category} className="space-y-1.5">
                <button
                  onClick={() => toggleCategory(category)}
                  className="w-full flex items-center justify-between border-b border-slate-100 pb-0.5 hover:bg-slate-50 rounded px-0.5 -mx-0.5 transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-1">
                    <span className="text-[10px] text-slate-400 transition-transform duration-150">
                      {isExpanded ? '▼' : '▶'}
                    </span>
                    <h3 className="text-[11px] font-bold text-slate-700 tracking-wide">
                      {formatLabel(category)}
                    </h3>
                  </div>
                  <span className="text-[9px] text-slate-400 font-medium">
                    {assets.length} items
                  </span>
                </button>
                {isExpanded && (
                  <div className="grid grid-cols-3 gap-1.5 pt-0.5">
                    {assets.map(a => (
                      <AssetCard key={a.id} asset={a} />
                    ))}
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
