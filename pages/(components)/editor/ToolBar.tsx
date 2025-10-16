"use client";

import { useState } from "react";
import { FiChevronDown, FiChevronRight, FiPlus, FiBox, FiSave } from "react-icons/fi";
import { LuFocus } from "react-icons/lu";
import { useSceneStore, AssetInstance } from "@/store/sceneStore";
import { ASSET_LIBRARY, AssetDef } from "@/lib/assets";

interface ToolbarProps {
  onSave?: () => void;
  hasUnsavedChanges?: boolean;
}

export default function Toolbar({ onSave, hasUnsavedChanges }: ToolbarProps) {
  const [showCanvases, setShowCanvases] = useState(true);
  const [showLayers, setShowLayers] = useState(true);
  const [showAssets, setShowAssets] = useState(true);

  // Get assets and selection from scene store
  const assets = useSceneStore((s) => s.assets);
  const selectedAssetId = useSceneStore((s) => s.selectedAssetId);
  const selectAsset = useSceneStore((s) => s.selectAsset);

  const [layers, setLayers] = useState([
    { id: 1, name: "Layer 1", open: true, children: ["Child A", "Child B"] },
    { id: 2, name: "Layer 2", open: false, children: ["Child X"] },
  ]);

  const [editingLayer, setEditingLayer] = useState<number | null>(null);

  // Helper function to get asset display information
  const getAssetDisplayInfo = (asset: AssetInstance) => {
    const assetDef = ASSET_LIBRARY.find(def => def.id === asset.type);
    if (assetDef) {
      return {
        name: assetDef.label,
        icon: assetDef.icon,
        isCustom: assetDef.isCustom,
        path: assetDef.path
      };
    }
    
    // Fallback for unknown asset types
    return {
      name: asset.type.charAt(0).toUpperCase() + asset.type.slice(1),
      icon: FiBox,
      isCustom: false,
      path: undefined
    };
  };

  // Helper function to render asset icon
  const renderAssetIcon = (asset: AssetInstance, size = 12) => {
    const displayInfo = getAssetDisplayInfo(asset);
    
    if (displayInfo.isCustom && displayInfo.path) {
      return (
        <img 
          src={displayInfo.path} 
          alt={displayInfo.name}
          className="w-3 h-3 object-contain"
        />
      );
    } else if (displayInfo.icon) {
      const IconComponent = displayInfo.icon;
      return <IconComponent size={size} />;
    }
    
    return <FiBox size={size} />;
  };

  const toggleLayer = (id: number) => {
    setLayers((prev) =>
      prev.map((layer) =>
        layer.id === id ? { ...layer, open: !layer.open } : layer
      )
    );
  };

  const addLayer = () => {
    const newId = layers.length + 1;
    setLayers((prev) => [
      ...prev,
      { id: newId, name: `New Layer ${newId}`, open: false, children: [] },
    ]);
    setEditingLayer(newId);
  };

  return (
    <div className="w-32 h-screen bg-[#FDFDFF] flex flex-col text-xs">
      {/* Toolbar Heading */}
      <div className="flex items-center justify-between mb-4 p-2">
        <h1 className="text-sm font-bold">Toolbar</h1>
        {onSave && (
          <button
            onClick={onSave}
            className={`flex items-center gap-1 px-2 py-1 text-white text-xs rounded transition-colors invisible ${
              hasUnsavedChanges 
                ? 'bg-orange-500 hover:bg-orange-600 animate-pulse' 
                : 'bg-green-500 hover:bg-green-600'
            }`}
            title={hasUnsavedChanges ? "Save changes" : "No changes to save"}
            disabled={!hasUnsavedChanges}
          >
            <FiSave size={12} />
            {hasUnsavedChanges ? "Save" : "Saved"}
          </button>
        )}
      </div>

      {/* Canvases Section */}
      <div className="mb-4 px-2">
        <div className="flex items-center justify-between mb-2 cursor-pointer">
          <div
            className="flex items-center gap-1"
            onClick={() => setShowCanvases((p) => !p)}
          >
            <span className="capitalize text-xs font-semibold tracking-wide">
              Pages
            </span>
          </div>
          <div className="flex items-center gap-1">
            <div onClick={() => setShowCanvases((p) => !p)}>
              {showCanvases ? <FiChevronDown /> : <FiChevronRight />}
            </div>
            <button className="p-1 hover:bg-gray-100 rounded">
              <FiPlus size={12} />
            </button>
          </div>
        </div>

        {showCanvases && (
          <div className="space-y-1 pt-2">
            <div className="flex items-center gap-1">
              <div className="w-4 h-4 bg-[var(--accent)] text-white flex items-center justify-center text-xs font-bold rounded">
                M
              </div>
              <span className="font-medium text-xs">Model</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-4 h-4 bg-[var(--accent)] text-white flex items-center justify-center text-xs font-bold rounded">
                P
              </div>
              <span className="font-medium text-xs">Paper</span>
            </div>
          </div>
        )}
      </div>

      {/* Separator */}
      <div className="border-t border-gray-200 my-2"></div>

      {/* Layers Section */}
      <div className="mb-4 pt-3 px-2">
        <div className="flex items-center justify-between mb-2 cursor-pointer">
          <div
            className="flex items-center gap-1"
            onClick={() => setShowLayers((p) => !p)}
          >
            <span className="capitalize text-xs font-semibold tracking-wide">
              Layers
            </span>
          </div>
          <div className="flex gap-1 items-center">
            <div onClick={() => setShowLayers((p) => !p)} >
              {showLayers ? <FiChevronDown /> : <FiChevronRight />}
            </div>

            <button
              className="p-1 hover:bg-gray-100 rounded"
              onClick={addLayer}
            >
              <FiPlus size={12} />
            </button>
          </div>
        </div>

        {showLayers && (
          <div className="space-y-1 pt-2">
            {layers.map((layer) => (
              <div key={layer.id} className="">
                <div className="flex items-center gap-1">
                  <button
                    className="p-1"
                    onClick={() => toggleLayer(layer.id)}
                  >
                    {layer.open ? (
                      <FiChevronDown size={12} />
                    ) : (
                      <FiChevronRight size={12} />
                    )}
                  </button>

                  <div className="h-2 w-1 rounded-sm bg-[var(--accent)] mr-1" />

                  {editingLayer === layer.id ? (
                    <input
                      autoFocus
                      className="border rounded px-1 text-xs w-20"
                      value={layer.name}
                      onChange={(e) =>
                        setLayers((prev) =>
                          prev.map((l) =>
                            l.id === layer.id
                              ? { ...l, name: e.target.value }
                              : l
                          )
                        )
                      }
                      onBlur={() => setEditingLayer(null)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") setEditingLayer(null);
                      }}
                    />
                  ) : (
                    <span
                      className="cursor-text font-medium"
                      onClick={() => setEditingLayer(layer.id)}
                    >
                      {layer.name}
                    </span>
                  )}
                </div>

                {layer.open && (
                  <div className="pl-4 text-gray-500 text-xs space-y-0.5">
                    {layer.children.map((child, idx) => (
                      <div key={idx}>{child}</div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Separator */}
      <div className="border-t border-gray-200 my-2"></div>

      {/* Assets Section */}
      <div className="mb-4 pt-3 px-2">
        <div className="flex items-center justify-between mb-2 cursor-pointer">
          <div
            className="flex items-center gap-1"
            onClick={() => setShowAssets((p) => !p)}
          >
            <span className="capitalize text-xs font-semibold tracking-wide">
              Assets
            </span>
          </div>
          <div className="flex gap-1 items-center">
            <div onClick={() => setShowAssets((p) => !p)}>
              {showAssets ? <FiChevronDown /> : <FiChevronRight />}
            </div>
          </div>
        </div>

        {showAssets && (
          <div className="space-y-1 pt-2">
            {assets.length === 0 ? (
              <div className="text-xs text-gray-500 italic pl-2">
                No assets added yet
              </div>
            ) : (
              assets.map((asset, index) => {
                const displayInfo = getAssetDisplayInfo(asset);
                const isSelected = selectedAssetId === asset.id;
                
                return (
                  <div
                    key={asset.id}
                    className={`flex items-center gap-1 px-2 py-1 rounded cursor-pointer transition-colors ${
                      isSelected 
                        ? 'bg-[var(--accent)] text-white' 
                        : 'hover:bg-gray-100 text-black/65'
                    }`}
                    onClick={() => selectAsset(asset.id)}
                    title={`${displayInfo.name} (${asset.type})`}
                  >
                    <div className="flex-shrink-0">
                      {renderAssetIcon(asset, 12)}
                    </div>
                    <span className="text-xs truncate">
                      {displayInfo.name} {index + 1}
                    </span>
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>
    </div>
  );
}

