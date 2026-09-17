"use client";

import React, { useEffect, useMemo, useState } from "react";
import { ASSET_LIBRARY, AssetDef, ASSET_CATEGORIES } from "@/lib/assets";
import { motion } from "framer-motion";
import { InlineSvg, isKnownMissingSvg, validateSvgPath } from "@/components/tools/InlineSvg";

const venuePngCache = new Map<string, boolean>();

function deriveVenuePngPath(assetPath: string): string {
  return assetPath
    .replace('/assets/preloaded-venues/', '/assets/thumbnails/preloaded-venues/')
    .replace(/\.(svg|dwg|dxf)$/i, '.png');
}

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
  const [missingAssetPaths, setMissingAssetPaths] = useState<Set<string>>(new Set());
  const [venuePngAvailable, setVenuePngAvailable] = useState<Set<string>>(new Set());

  const normalizedSearch = searchTerm.toLowerCase();

  const searchResults = useMemo(() => {
    if (!searchTerm) return [];
    return ASSET_LIBRARY.filter(a =>
      `${a.label} ${a.category}`.toLowerCase().includes(normalizedSearch)
    );
  }, [searchTerm, normalizedSearch]);

  const visibleCandidates = useMemo(
    () => (searchTerm ? searchResults : ASSET_LIBRARY).filter(a => a.path),
    [searchTerm, searchResults]
  );

  useEffect(() => {
    if (!isOpen || visibleCandidates.length === 0) return;
    let active = true;
    (async () => {
      const unresolved = visibleCandidates.filter(asset => asset.path && !missingAssetPaths.has(asset.path) && !isKnownMissingSvg(asset.path));
      if (unresolved.length === 0) return;
      const checks = await Promise.all(
        unresolved.map(async asset => ({
          path: asset.path,
          ok: await validateSvgPath(asset.path!),
        }))
      );
      if (!active) return;
      const failed = checks.filter(check => !check.ok).map(check => check.path!);
      if (failed.length > 0) {
        setMissingAssetPaths(prev => {
          const next = new Set(prev);
          failed.forEach(path => next.add(path));
          return next;
        });
      }
    })();
    return () => {
      active = false;
    };
  }, [isOpen, visibleCandidates, missingAssetPaths]);

  // Check for PNG thumbnails for venue assets
  useEffect(() => {
    if (!isOpen) return;
    let active = true;
    (async () => {
      const venueAssets = visibleCandidates.filter(a => a.path && a.category === "Venue" && !venuePngCache.has(a.path));
      if (venueAssets.length === 0) return;
      const checks = await Promise.all(
        venueAssets.map(async asset => {
          const pngPath = deriveVenuePngPath(asset.path!);
          try {
            const res = await fetch(pngPath, { method: "HEAD" });
            return { path: asset.path!, ok: res.ok };
          } catch {
            return { path: asset.path!, ok: false };
          }
        })
      );
      if (!active) return;
      const available = new Set<string>();
      checks.forEach(c => { if (c.ok) available.add(c.path); });
      setVenuePngAvailable(prev => {
        const next = new Set(prev);
        available.forEach(p => { next.add(p); venuePngCache.set(p, true); });
        return next;
      });
    })();
    return () => { active = false; };
  }, [isOpen, visibleCandidates]);

  const filteredSearchResults = useMemo(
    () => searchResults.filter(asset => !asset.path || !missingAssetPaths.has(asset.path)),
    [searchResults, missingAssetPaths]
  );

  const assetsByCategory = useMemo(() => {
    const map = new Map<string, AssetDef[]>();
    ASSET_CATEGORIES.forEach(cat => {
      const items = ASSET_LIBRARY.filter(a => a.category === cat && (!a.path || !missingAssetPaths.has(a.path)));
      if (items.length > 0) {
        map.set(cat, items);
      }
    });
    return map;
  }, [missingAssetPaths]);

  const renderAsset = (asset: AssetDef) => (
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
      className="w-full h-16 flex flex-col items-center justify-center p-1 rounded-md border border-slate-100 bg-white hover:bg-slate-50 hover:border-blue-300 transition-all text-slate-600 hover:text-slate-900 shadow-sm group"
    >
      <div className="w-8 h-8 flex items-center justify-center overflow-hidden mb-0.5">
        {asset.category === "Venue" && asset.path && venuePngAvailable.has(asset.path) ? (
          <img
            src={deriveVenuePngPath(asset.path)}
            alt={asset.label}
            className="w-full h-full object-contain"
            loading="lazy"
          />
        ) : (
          <InlineSvg
            key={asset.path}
            src={asset.path}
            fill="none"
            stroke="currentColor"
            strokeWidth={0.6}
            category={asset.category}
            onLoadError={() => {
              if (!asset.path) return;
              setMissingAssetPaths(prev => {
                if (prev.has(asset.path!)) return prev;
                const next = new Set(prev);
                next.add(asset.path!);
                return next;
              });
            }}
          />
        )}
      </div>
      <span className="text-[0.6rem] text-center font-medium leading-none truncate w-full px-0.5 opacity-80 group-hover:opacity-100 transition-opacity">
        {formatLabel(asset.label)}
      </span>
    </motion.button>
  );

  if (!isOpen) return null;

  return (
    <div className="w-60 h-full bg-white border-r border-gray-200 flex flex-col flex-shrink-0 shadow-md z-20">
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
              Search Results ({filteredSearchResults.length})
            </h3>
            {filteredSearchResults.length === 0 ? (
              <p className="text-[11px] text-slate-400 italic">No matching assets found.</p>
            ) : (
              <div className="grid grid-cols-3 gap-1.5">
                {filteredSearchResults.map(renderAsset)}
              </div>
            )}
          </div>
        ) : (
          Array.from(assetsByCategory.entries()).map(([category, assets]) => (
            <section key={category} className="space-y-1.5">
              <div className="flex items-center justify-between border-b border-slate-100 pb-0.5">
                <h3 className="text-[11px] font-bold text-slate-700 tracking-wide">
                  {formatLabel(category)}
                </h3>
                <span className="text-[9px] text-slate-400 font-medium">
                  {assets.length} items
                </span>
              </div>
              <div className="grid grid-cols-3 gap-1.5 pt-0.5">
                {assets.map(renderAsset)}
              </div>
            </section>
          ))
        )}
      </div>
    </div>
  );
}
