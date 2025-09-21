"use client";

import React, { useState } from "react";
import { FaUserCircle, FaChevronDown, FaChevronRight } from "react-icons/fa";
import { IoPlayOutline } from "react-icons/io5";
import ShareModal from "./ShareModal";
import { useAssetProperties } from "@/hooks/useAssetProperties";
import { useSceneStore } from "@/store/sceneStore";

export default function PropertiesSidebar(): React.JSX.Element {
  const {
    selectedAsset,
    unit,
    assetX,
    assetY,
    assetScale,
    assetRotation,
    onChangeX,
    onChangeY,
    onChangeScale,
    onChangeRotation,
    onChangeUnit,
    updateAsset
  } = useAssetProperties();

  const [showModel, setShowModel] = useState(true);
  const [showCanvas, setShowCanvas] = useState(true);
  const [showShareModal, setShowShareModal] = useState(false);
  const [modelName, setModelName] = useState<string>("");
  const [canvasName, setCanvasName] = useState<string>("");

  const roundForDisplay = (num: number) => Math.round(num * 100) / 100;

  return (
    <aside className="h-screen flex flex-col p-3 overflow-y-auto text-sm">
      {showShareModal && <ShareModal onClose={() => setShowShareModal(false)} />}

      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <FaUserCircle className="text-blue-600 bg-blue-100 rounded-full p-0.5" size={28} />
        <div className="flex items-center gap-1">
          <button className="p-1 rounded hover:bg-gray-100">
            <IoPlayOutline size={14} />
          </button>
          <button
            className="bg-[var(--accent)] text-white px-2 py-1.5 rounded text-xs shadow"
            onClick={() => setShowShareModal(true)}
          >
            Share
          </button>
        </div>
      </div>

      {/* Model Section */}
      <div className="mb-5">
        <button
          className="flex items-center gap-1 text-xs font-semibold tracking-wide mb-1"
          onClick={() => setShowModel((s) => !s)}
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

      {/* Canvas / Asset Properties Section */}
      <div className="mb-3">
        <button
          className="flex items-center gap-1 text-xs font-semibold tracking-wide mb-1"
          onClick={() => setShowCanvas((s) => !s)}
        >
          {showCanvas ? <FaChevronDown size={12} /> : <FaChevronRight size={12} />} Model Canvas
        </button>
        {showCanvas && (
          <div className="space-y-1 pl-5 text-xs">
            {/* Canvas Name */}
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

            {/* Transform Controls */}
            {selectedAsset && (
              <div className="mt-2">
                <div className="text-xs font-medium mb-2">Selected Asset</div>

                <div className="flex justify-between items-center mb-2">
                  <span>X ({unit})</span>
                  <input
                    type="number"
                    value={roundForDisplay(assetX)}
                    onChange={(e) => onChangeX(Number(e.target.value))}
                    className="sidebar-input w-28 text-xs"
                    step={0.01}
                  />
                </div>

                <div className="flex justify-between items-center mb-2">
                  <span>Y ({unit})</span>
                  <input
                    type="number"
                    value={roundForDisplay(assetY)}
                    onChange={(e) => onChangeY(Number(e.target.value))}
                    className="sidebar-input w-28 text-xs"
                    step={0.01}
                  />
                </div>

                <div className="flex justify-between items-center mb-2">
                  <span>Scale</span>
                  <input
                    type="number"
                    value={assetScale}
                    onChange={(e) => onChangeScale(Number(e.target.value))}
                    step={0.01}
                    min={0.01}
                    className="sidebar-input w-28 text-xs"
                  />
                </div>

                {/* Shape-specific properties */}
                {selectedAsset.type === "square" || selectedAsset.type === "circle" ? (
                  <div className="space-y-2 mt-2">
                    <div className="flex justify-between items-center">
                      <span>Width (px)</span>
                      <input
                        type="number"
                        value={selectedAsset.width}
                        onChange={(e) => updateAsset(selectedAsset.id, { width: Number(e.target.value) })}
                        className="sidebar-input w-28 text-xs"
                      />
                    </div>
                    <div className="flex justify-between items-center">
                      <span>Height (px)</span>
                      <input
                        type="number"
                        value={selectedAsset.height}
                        onChange={(e) => updateAsset(selectedAsset.id, { height: Number(e.target.value) })}
                        className="sidebar-input w-28 text-xs"
                      />
                    </div>
                    <div className="flex justify-between items-center">
                      <span>Fill Color</span>
                      <input
                        type="color"
                        value={selectedAsset.fillColor || "#93C5FD"}
                        onChange={(e) => updateAsset(selectedAsset.id, { fillColor: e.target.value })}
                        className="w-28 h-6 p-0 border-none"
                      />
                    </div>
                  </div>
                ) : selectedAsset.type === "line" ? (
                  <div className="space-y-2 mt-2">
                    <div className="flex justify-between items-center">
                      <span>Length (px)</span>
                      <input
                        type="number"
                        value={selectedAsset.width}
                        onChange={(e) => updateAsset(selectedAsset.id, { width: Number(e.target.value) })}
                        className="sidebar-input w-28 text-xs"
                      />
                    </div>
                    <div className="flex justify-between items-center">
                      <span>Stroke Width</span>
                      <input
                        type="number"
                        value={selectedAsset.strokeWidth}
                        onChange={(e) => updateAsset(selectedAsset.id, { strokeWidth: Number(e.target.value) })}
                        className="sidebar-input w-28 text-xs"
                      />
                    </div>
                    <div className="flex justify-between items-center">
                      <span>Stroke Color</span>
                      <input
                        type="color"
                        value={selectedAsset.strokeColor || "#3B82F6"}
                        onChange={(e) => updateAsset(selectedAsset.id, { strokeColor: e.target.value })}
                        className="w-28 h-6 p-0 border-none"
                      />
                    </div>
                  </div>
                ) : null}

                {/* Rotation */}
                <div className="flex justify-between items-center mb-2 mt-2">
                  <span>Rotation (deg)</span>
                  <input
                    type="number"
                    value={assetRotation}
                    onChange={(e) => onChangeRotation(Number(e.target.value))}
                    step={1}
                    className="sidebar-input w-28 text-xs"
                  />
                </div>

                {/* Unit dropdown */}
                <div className="flex justify-between items-center mt-3">
                  <span>Unit</span>
                  <select
                    value={unit}
                    onChange={(e) => onChangeUnit(e.target.value)}
                    className="sidebar-input w-22"
                  >
                    <option>px</option>
                    <option>cm</option>
                    <option>mm</option>
                  </select>
                </div>

                {/* Remove Asset Button */}
                <div className="mt-4">
                  <button
                    className="w-full text-xs bg-red-500 hover:bg-red-600 text-white py-1.5 rounded shadow"
                    onClick={() => {
                      useSceneStore.getState().removeAsset(selectedAsset.id);
                    }}
                  >
                    Remove Asset
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </aside>
  );
}

