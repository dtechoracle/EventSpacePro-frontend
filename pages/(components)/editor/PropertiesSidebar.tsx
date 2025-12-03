"use client";

import React, { useState, useEffect } from "react";
import { FaUserCircle, FaChevronDown, FaChevronRight } from "react-icons/fa";
import { IoPlayOutline } from "react-icons/io5";
import ShareModal from "./ShareModal";
import ExportPanel from "./ExportPanel";
import { useAssetProperties } from "@/hooks/useAssetProperties";
import { useSceneStore } from "@/store/sceneStore";
import { useEditorStore } from "@/store/editorStore"; // NEW STORE
import { useProjectStore } from "@/store/projectStore";
import { useUserStore } from "@/store/userStore";

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
    updateAsset,
  } = useAssetProperties();

  const showGrid = useSceneStore((s) => s.showGrid);
  const toggleGrid = useSceneStore((s) => s.toggleGrid);
  const availableGridSizes = useSceneStore((s) => s.availableGridSizes);
  const selectedGridSizeIndex = useSceneStore((s) => s.selectedGridSizeIndex);
  const setSelectedGridSizeIndex = useSceneStore((s) => s.setSelectedGridSizeIndex);
  const snapToGridEnabled = useSceneStore((s) => s.snapToGridEnabled);
  const toggleSnapToGrid = useSceneStore((s) => s.toggleSnapToGrid);

  // NEW STORE - sync grid controls
  const editorStore = useEditorStore();

  // Sync function to toggle grid in both stores
  const handleToggleGrid = () => {
    toggleGrid(); // Old store
    editorStore.toggleGrid(); // New store
  };

  // Sync function to toggle snap to grid in both stores
  const handleToggleSnapToGrid = () => {
    toggleSnapToGrid(); // Old store
    editorStore.toggleSnapToGrid(); // New store
  };

  // Sync function to set grid size in both stores
  const handleSetGridSize = (index: number) => {
    setSelectedGridSizeIndex(index); // Old store
    const size = availableGridSizes?.[index] || 10;
    editorStore.setGridSize(size); // New store
  };
  // const addAsset = useSceneStore((s) => s.addAsset);

  // Wall drawing state
  const wallDrawingMode = useSceneStore((s) => s.wallDrawingMode);
  const currentWallSegments = useSceneStore((s) => s.currentWallSegments);
  const finishWallDrawing = useSceneStore((s) => s.finishWallDrawing);
  const cancelWallDrawing = useSceneStore((s) => s.cancelWallDrawing);

  const [showModel, setShowModel] = useState(true);
  const [showCanvas, setShowCanvas] = useState(true);
  const [showShareModal, setShowShareModal] = useState(false);
  const [modelName, setModelName] = useState<string>("");
  const open3D = useSceneStore((s) => s.open3DOverlay);

  // Get logged in user
  const user = useUserStore((s) => s.user);

  // Get user's full name
  const getUserName = () => {
    if (!user) return "";
    const firstName = user.firstName || "";
    const lastName = user.lastName || "";
    return `${firstName} ${lastName}`.trim() || user.email || "";
  };

  const userName = getUserName();

  // Set model name to user's name when user is loaded
  useEffect(() => {
    if (userName && !modelName) {
      setModelName(userName);
    }
  }, [userName, modelName]);

  // Chair placement state from store with fallback
  const chairSettings = useSceneStore((s) => s.chairSettings) || { numChairs: 8, radius: 80 };

  // Direct function to update chair settings
  const updateChairSettings = (settings: { numChairs: number; radius: number }) => {
    const state = useSceneStore.getState();
    if (state.setChairSettings) {
      state.setChairSettings(settings);
    }
  };

  // Auto-populate wall thickness based on current wall type when a wall is selected
  useEffect(() => {
    if (selectedAsset && selectedAsset.type === "wall-segments") {
      const currentWallThickness = useSceneStore.getState().getCurrentWallThickness();
      // Only update if the asset doesn't already have a thickness set
      if (!selectedAsset.wallThickness) {
        updateAsset(selectedAsset.id, {
          wallThickness: currentWallThickness,
        });
      }
    }
  }, [selectedAsset, updateAsset]);
  const [canvasName, setCanvasName] = useState<string>("");

  const roundForDisplay = (num: number) => Math.round(num * 100) / 100;

  return (
    <aside className="h-screen flex flex-col p-3 pb-24 overflow-y-auto text-sm">
      {showShareModal && (
        <ShareModal onClose={() => setShowShareModal(false)} />
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <FaUserCircle
          className="text-blue-600 bg-blue-100 rounded-full p-0.5"
          size={28}
        />
        <div className="flex items-center gap-1">
          <button className="p-1 rounded hover:bg-gray-100" onClick={() => open3D && open3D()}>
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
          {showModel ? (
            <FaChevronDown size={12} />
          ) : (
            <FaChevronRight size={12} />
          )}{" "}
          Model
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
              <span className="font-medium w-full">{userName || "Not logged in"}</span>
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
          {showCanvas ? (
            <FaChevronDown size={12} />
          ) : (
            <FaChevronRight size={12} />
          )}{" "}
          Model Pages
        </button>
        {showCanvas && (
          <div className="space-y-1 pl-5 text-xs">
            {/* Canvas Name */}
            <div className="flex justify-between items-center">
              <span>Name</span>
              <input
                type="text"
                placeholder="New page name"
                value={canvasName}
                onChange={(e) => setCanvasName(e.target.value)}
                className="sidebar-input"
              />
            </div>

            {/* Grid Toggle */}
            <div className="flex justify-between items-center py-2">
              <span>Grid</span>
              <div className="inline-flex rounded-lg bg-[#0000000D] p-1">
                <button
                  onClick={() => !showGrid && handleToggleGrid()}
                  className={`px-4 py-1 text-xs rounded-md transition-all ${showGrid
                    ? "bg-white text-gray-900 shadow-sm font-medium"
                    : "text-gray-600 hover:text-gray-900"
                    }`}
                >
                  Show
                </button>
                <button
                  onClick={() => showGrid && handleToggleGrid()}
                  className={`px-4 py-1 text-xs rounded-md transition-all ${!showGrid
                    ? "bg-white text-gray-900 shadow-sm font-medium"
                    : "text-gray-600 hover:text-gray-900"
                    }`}
                >
                  Hide
                </button>
              </div>
            </div>

            {/* Grid Size */}
            {showGrid && (
              <div className="py-2">
                <label className="block text-xs text-gray-600 mb-1">Grid Size</label>
                <select
                  value={availableGridSizes?.[selectedGridSizeIndex] || 1000}
                  onChange={(e) => {
                    const selectedSize = Number(e.target.value);
                    const index = availableGridSizes?.indexOf(selectedSize) ?? 2;
                    handleSetGridSize(index);
                  }}
                  className="w-full text-xs border rounded px-2 py-1 bg-white"
                >
                  {(availableGridSizes || [100, 500, 1000, 2000, 5000]).map((size) => {
                    const meters = size / 1000;
                    const label = meters >= 1 ? `${meters}m` : `${meters * 1000}mm (${meters}m)`;
                    return <option key={size} value={size}>{label}</option>;
                  })}
                </select>
              </div>
            )}

            {/* Snap to Grid - only show when grid is enabled */}
            {showGrid && (
              <div className="flex justify-between items-center py-2">
                <span>Snap to Grid</span>
                <div className="inline-flex rounded-lg bg-[#0000000D] p-1">
                  <button
                    onClick={() => !snapToGridEnabled && handleToggleSnapToGrid()}
                    className={`px-4 py-1 text-xs rounded-md transition-all ${snapToGridEnabled
                      ? "bg-white text-gray-900 shadow-sm font-medium"
                      : "text-gray-600 hover:text-gray-900"
                      }`}
                  >
                    On
                  </button>
                  <button
                    onClick={() => snapToGridEnabled && handleToggleSnapToGrid()}
                    className={`px-4 py-1 text-xs rounded-md transition-all ${!snapToGridEnabled
                      ? "bg-white text-gray-900 shadow-sm font-medium"
                      : "text-gray-600 hover:text-gray-900"
                      }`}
                  >
                    Off
                  </button>
                </div>
              </div>
            )}

            {/* Wall Drawing Controls */}
            {wallDrawingMode && (
              <div className="mt-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
                <div className="text-xs font-medium text-blue-800 mb-2">
                  Wall Drawing
                </div>
                <div className="text-xs text-blue-600 mb-3">
                  Segments: {currentWallSegments.length}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={finishWallDrawing}
                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white text-xs py-2 px-3 rounded shadow"
                  >
                    Finish Wall
                  </button>
                  <button
                    onClick={cancelWallDrawing}
                    className="flex-1 bg-gray-500 hover:bg-gray-600 text-white text-xs py-2 px-3 rounded shadow"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

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

                {/* Universal sizing properties - disabled for text */}
                {selectedAsset.type !== "text" && (
                  <div className="space-y-2 mt-2">
                    <div className="flex justify-between items-center">
                      <span>Width (px)</span>
                      <input
                        type="number"
                        value={selectedAsset.width || 24}
                        onChange={(e) =>
                          updateAsset(selectedAsset.id, {
                            width: Number(e.target.value),
                          })
                        }
                        className="sidebar-input w-28 text-xs"
                        min={1}
                      />
                    </div>
                    <div className="flex justify-between items-center">
                      <span>Height (px)</span>
                      <input
                        type="number"
                        value={selectedAsset.height || 24}
                        onChange={(e) =>
                          updateAsset(selectedAsset.id, {
                            height: Number(e.target.value),
                          })
                        }
                        className="sidebar-input w-28 text-xs"
                        min={1}
                      />
                    </div>
                  </div>
                )}

                {/* Shape-specific properties */}
                {selectedAsset.type === "square" ||
                  selectedAsset.type === "circle" ? (
                  <div className="space-y-2 mt-2">
                    <div className="flex justify-between items-center">
                      <span>Fill Color</span>
                      <input
                        type="color"
                        value={selectedAsset.fillColor || "transparent"}
                        onChange={(e) =>
                          updateAsset(selectedAsset.id, {
                            fillColor: e.target.value,
                          })
                        }
                        className="w-28 h-6 p-0 border-none"
                      />
                    </div>
                  </div>
                ) : selectedAsset.type === "line" ? (
                  <div className="space-y-2 mt-2">
                    <div className="flex justify-between items-center">
                      <span>Stroke Width</span>
                      <input
                        type="number"
                        value={selectedAsset.strokeWidth || 2}
                        onChange={(e) =>
                          updateAsset(selectedAsset.id, {
                            strokeWidth: Number(e.target.value),
                          })
                        }
                        className="sidebar-input w-28 text-xs"
                        min={1}
                      />
                    </div>
                    <div className="flex justify-between items-center">
                      <span>Stroke Color</span>
                      <input
                        type="color"
                        value={selectedAsset.strokeColor || "#000000"}
                        onChange={(e) =>
                          updateAsset(selectedAsset.id, {
                            strokeColor: e.target.value,
                          })
                        }
                        className="w-28 h-6 p-0 border-none"
                      />
                    </div>
                  </div>
                ) : selectedAsset.type === "double-line" ? (
                  <div className="space-y-2 mt-2">
                    <div className="flex justify-between items-center">
                      <span>Line Width</span>
                      <input
                        type="number"
                        value={selectedAsset.strokeWidth || 2}
                        onChange={(e) =>
                          updateAsset(selectedAsset.id, {
                            strokeWidth: Number(e.target.value),
                          })
                        }
                        className="sidebar-input w-28 text-xs"
                        min={1}
                      />
                    </div>
                    <div className="flex justify-between items-center">
                      <span>Line Gap</span>
                      <input
                        type="number"
                        value={selectedAsset.lineGap || 8}
                        onChange={(e) =>
                          updateAsset(selectedAsset.id, {
                            lineGap: Number(e.target.value),
                          })
                        }
                        className="sidebar-input w-28 text-xs"
                        min={1}
                      />
                    </div>
                    <div className="flex justify-between items-center">
                      <span>Line Color</span>
                      <input
                        type="color"
                        value={selectedAsset.lineColor || "#000000"}
                        onChange={(e) =>
                          updateAsset(selectedAsset.id, {
                            lineColor: e.target.value,
                          })
                        }
                        className="w-28 h-6 p-0 border-none"
                      />
                    </div>
                  </div>
                ) : selectedAsset.type === "drawn-line" ? (
                  <div className="space-y-2 mt-2">
                    <div className="flex justify-between items-center">
                      <span>Stroke Width</span>
                      <input
                        type="number"
                        value={selectedAsset.strokeWidth || 2}
                        onChange={(e) =>
                          updateAsset(selectedAsset.id, {
                            strokeWidth: Number(e.target.value),
                          })
                        }
                        className="sidebar-input w-28 text-xs"
                        min={1}
                      />
                    </div>
                    <div className="flex justify-between items-center">
                      <span>Stroke Color</span>
                      <input
                        type="color"
                        value={selectedAsset.strokeColor || "#000000"}
                        onChange={(e) =>
                          updateAsset(selectedAsset.id, {
                            strokeColor: e.target.value,
                          })
                        }
                        className="w-28 h-6 p-0 border-none"
                      />
                    </div>
                  </div>
                ) : selectedAsset.type === "text" ? (
                  <div className="space-y-2 mt-2">
                    <div className="flex justify-between items-center">
                      <span>Text</span>
                      <input
                        type="text"
                        value={selectedAsset.text || ""}
                        onChange={(e) =>
                          updateAsset(selectedAsset.id, {
                            text: e.target.value,
                          })
                        }
                        className="sidebar-input w-28 text-xs"
                        placeholder="Enter text"
                      />
                    </div>
                    <div className="flex justify-between items-center">
                      <span>Font Size</span>
                      <input
                        type="number"
                        value={selectedAsset.fontSize || 16}
                        onChange={(e) =>
                          updateAsset(selectedAsset.id, {
                            fontSize: Number(e.target.value),
                          })
                        }
                        className="sidebar-input w-28 text-xs"
                        min={8}
                        max={72}
                      />
                    </div>
                    <div className="flex justify-between items-center">
                      <span>Text Color</span>
                      <input
                        type="color"
                        value={selectedAsset.textColor || "#000000"}
                        onChange={(e) =>
                          updateAsset(selectedAsset.id, {
                            textColor: e.target.value,
                          })
                        }
                        className="w-28 h-6 p-0 border-none"
                      />
                    </div>
                    <div className="flex justify-between items-center">
                      <span>Font Family</span>
                      <select
                        value={selectedAsset.fontFamily || "Arial"}
                        onChange={(e) =>
                          updateAsset(selectedAsset.id, {
                            fontFamily: e.target.value,
                          })
                        }
                        className="sidebar-input w-28 text-xs"
                      >
                        <option value="Arial">Arial</option>
                        <option value="Helvetica">Helvetica</option>
                        <option value="Times New Roman">Times New Roman</option>
                        <option value="Georgia">Georgia</option>
                        <option value="Verdana">Verdana</option>
                        <option value="Courier New">Courier New</option>
                      </select>
                    </div>
                  </div>
                ) : selectedAsset.type === "wall-segments" ? (
                  <div className="space-y-2 mt-2">
                    <div className="flex justify-between items-center">
                      <span>Line Color</span>
                      <input
                        type="color"
                        value={selectedAsset.lineColor || "#000000"}
                        onChange={(e) =>
                          updateAsset(selectedAsset.id, {
                            lineColor: e.target.value,
                          })
                        }
                        className="w-28 h-6 p-0 border-none"
                      />
                    </div>
                    <div className="flex justify-between items-center">
                      <span>Line</span>
                      <input
                        type="number"
                        value={selectedAsset.wallThickness || useSceneStore.getState().getCurrentWallThickness()}
                        onChange={(e) => {
                          updateAsset(selectedAsset.id, {
                            wallThickness: Number(e.target.value),
                          });
                        }}
                        className="sidebar-input w-28 text-xs"
                        min={1}
                        max={20}
                      />
                    </div>
                    <div className="text-xs text-gray-500 ml-2">
                      Current wall type: {useSceneStore.getState().getCurrentWallThickness()}px
                    </div>
                    <div className="flex justify-between items-center">
                      <span>Wall Thickness</span>
                      <input
                        type="number"
                        value={selectedAsset.wallGap || 8}
                        onChange={(e) =>
                          updateAsset(selectedAsset.id, {
                            wallGap: Number(e.target.value),
                          })
                        }
                        className="sidebar-input w-28 text-xs"
                        min={2}
                        max={50}
                      />
                    </div>
                  </div>
                ) : null}

                {/* Background Color */}
                <div className="flex justify-between items-center mb-2 mt-2">
                  <span>Background</span>
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={
                        !!(
                          selectedAsset.backgroundColor &&
                          selectedAsset.backgroundColor !== "transparent"
                        )
                      }
                      onChange={(e) => {
                        if (e.target.checked) {
                          updateAsset(selectedAsset.id, {
                            backgroundColor: "#FFFFFF",
                          });
                        } else {
                          updateAsset(selectedAsset.id, {
                            backgroundColor: "transparent",
                          });
                        }
                      }}
                      className="w-4 h-4"
                    />
                    {selectedAsset.backgroundColor &&
                      selectedAsset.backgroundColor !== "transparent" && (
                        <input
                          type="color"
                          value={selectedAsset.backgroundColor}
                          onChange={(e) =>
                            updateAsset(selectedAsset.id, {
                              backgroundColor: e.target.value,
                            })
                          }
                          className="w-8 h-6 p-0 border-none"
                        />
                      )}
                  </div>
                </div>

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

                {/* Layering Controls */}
                <div className="mt-4 space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-medium text-gray-700">
                      Layer Order
                    </span>
                    <span className="text-xs text-gray-500">
                      Z: {selectedAsset.zIndex || 0}
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <button
                      className="flex-1 text-xs bg-blue-500 hover:bg-blue-600 text-white py-1.5 rounded shadow"
                      onClick={() => {
                        const state = useSceneStore.getState();
                        const nextZIndex =
                          state.assets.length > 0
                            ? Math.max(
                              ...state.assets.map((a) => a.zIndex || 0)
                            ) + 25
                            : 25;
                        state.updateAsset(selectedAsset.id, {
                          zIndex: nextZIndex,
                        });
                      }}
                    >
                      Send to Front
                    </button>
                    <button
                      className="flex-1 text-xs bg-gray-500 hover:bg-gray-600 text-white py-1.5 rounded shadow"
                      onClick={() => {
                        const state = useSceneStore.getState();
                        state.updateAsset(selectedAsset.id, {
                          zIndex: -1,
                        });
                      }}
                    >
                      Send to Back
                    </button>
                  </div>

                  {/* Chair Placement Controls for Tables */}
                  {selectedAsset.type.includes('table') && (
                    <div className="mb-4 p-3 bg-gray-100 border-t">
                      <div className="text-xs font-semibold text-gray-700 mb-3">Chair Placement</div>

                      {/* Number of Chairs */}
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-xs">Number of Chairs</span>
                        <input
                          type="number"
                          value={chairSettings.numChairs}
                          min={2}
                          max={20}
                          className="sidebar-input w-16 text-xs"
                          onChange={(e) => {
                            updateChairSettings({
                              numChairs: Number(e.target.value),
                              radius: chairSettings.radius
                            });
                          }}
                        />
                      </div>

                      {/* Radius Around Table */}
                      <div className="flex justify-between items-center mb-3">
                        <span className="text-xs">Radius (mm)</span>
                        <input
                          type="number"
                          value={chairSettings.radius}
                          min={40}
                          max={200}
                          className="sidebar-input w-16 text-xs"
                          onChange={(e) => {
                            updateChairSettings({
                              numChairs: chairSettings.numChairs,
                              radius: Number(e.target.value)
                            });
                          }}
                        />
                      </div>

                      {/* Add Chairs Button */}
                      <button
                        className="w-full text-xs bg-blue-500 hover:bg-blue-600 text-white py-1.5 rounded shadow"
                        onClick={() => {
                          const state = useSceneStore.getState();
                          const addAssetObject = state.addAssetObject;

                          // Get table dimensions for chair sizing
                          const tableWidth = (selectedAsset.width || 100) * selectedAsset.scale;
                          const tableHeight = (selectedAsset.height || 100) * selectedAsset.scale;
                          const chairSize = Math.min(tableWidth, tableHeight) * 0.3; // 30% of smaller table dimension

                          // Use values from state with fallbacks
                          const numChairs = chairSettings.numChairs;
                          const radius = chairSettings.radius;

                          // Calculate chair positions in a circle around the table
                          const chairs = [];
                          const angleStep = 360 / numChairs; // Degrees per chair

                          for (let i = 0; i < numChairs; i++) {
                            const angleDegrees = i * angleStep;
                            const angleRadians = (angleDegrees * Math.PI) / 180;
                            const x = selectedAsset.x + Math.cos(angleRadians) * radius;
                            const y = selectedAsset.y + Math.sin(angleRadians) * radius;
                            // Calculate rotation so chair faces the table center
                            // Chair should point directly toward the table center (like spokes on a wheel)
                            // Add 180 degrees to make chair point toward table center, then rotate 90 degrees left
                            const chairRotation = (angleDegrees + 180 + 90) % 360;
                            chairs.push({ x, y, rotation: chairRotation });
                          }

                          // Create chair assets with table-proportional sizing
                          chairs.forEach((chairPos, index) => {
                            const chairAsset = {
                              id: `chair-${Date.now()}-${index}`,
                              type: 'normal-chair',
                              x: chairPos.x,
                              y: chairPos.y,
                              scale: 1,
                              rotation: chairPos.rotation,
                              zIndex: state.assets.length > 0 ? Math.max(...state.assets.map(a => a.zIndex || 0)) + 1 : 1,
                              width: chairSize,
                              height: chairSize,
                              backgroundColor: '#f3f4f6'
                            };
                            addAssetObject(chairAsset);
                          });
                        }}
                      >
                        Add Chairs
                      </button>
                    </div>
                  )}

                  {/* Remove Asset Button */}
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
      {/* Export Panel - shows when assets are selected */}
      <ExportPanel />
    </aside>
  );
}
