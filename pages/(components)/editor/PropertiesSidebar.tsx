"use client";

import React, { useState, useEffect } from "react";
import { FaUserCircle, FaChevronDown, FaChevronRight } from "react-icons/fa";
import { IoPlayOutline } from "react-icons/io5";
import ShareModal from "./ShareModal";
import ExportPanel from "./ExportPanel";
import { useSceneStore } from "@/store/sceneStore";
import { useEditorStore } from "@/store/editorStore";
import { useProjectStore } from "@/store/projectStore";
import { useRouter } from "next/router";
import { useUserStore } from "@/store/userStore";

export default function PropertiesSidebar(): React.JSX.Element {
  const { selectedIds } = useEditorStore();
  const {
    shapes, assets, walls, textAnnotations, labelArrows,
    updateShape, updateAsset, updateWall, updateTextAnnotation, updateLabelArrow,
    isSaving, lastSaved, saveEvent, hasUnsavedChanges
  } = useProjectStore();

  // Resolve the single selected item
  const selectedId = selectedIds.length === 1 ? selectedIds[0] : null;

  const selectedShape = selectedId ? shapes.find(s => s.id === selectedId) : null;
  const selectedAsset = selectedId ? assets.find(a => a.id === selectedId) : null;
  const selectedWall = selectedId ? walls.find(w => w.id === selectedId) : null;
  const selectedTextAnnotation = selectedId ? textAnnotations.find(t => t.id === selectedId) : null;
  const selectedLabelArrow = selectedId ? labelArrows.find(l => l.id === selectedId) : null;

  const selectedItem = selectedShape || selectedAsset || selectedWall || selectedTextAnnotation || selectedLabelArrow;
  const itemType = selectedShape ? 'shape' : selectedAsset ? 'asset' : selectedWall ? 'wall' : selectedTextAnnotation ? 'text-annotation' : selectedLabelArrow ? 'label-arrow' : null;

  const showGrid = useSceneStore((s) => s.showGrid);
  const toggleGrid = useSceneStore((s) => s.toggleGrid);
  const availableGridSizes = useSceneStore((s) => s.availableGridSizes);
  const selectedGridSizeIndex = useSceneStore((s) => s.selectedGridSizeIndex);
  const setSelectedGridSizeIndex = useSceneStore((s) => s.setSelectedGridSizeIndex);
  const snapToGridEnabled = useSceneStore((s) => s.snapToGridEnabled);
  const toggleSnapToGrid = useSceneStore((s) => s.toggleSnapToGrid);

  const editorStore = useEditorStore();

  const handleToggleGrid = () => {
    toggleGrid();
    editorStore.toggleGrid();
  };

  const handleToggleSnapToGrid = () => {
    toggleSnapToGrid();
    editorStore.toggleSnapToGrid();
  };

  const handleSetGridSize = (index: number) => {
    setSelectedGridSizeIndex(index);
    const size = availableGridSizes?.[index] || 10;
    editorStore.setGridSize(size);
  };

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

  const user = useUserStore((s) => s.user);

  const getUserName = () => {
    if (!user) return "";
    const firstName = user.firstName || "";
    const lastName = user.lastName || "";
    return `${firstName} ${lastName}`.trim() || user.email || "";
  };

  const userName = getUserName();



  useEffect(() => {
    if (userName && !modelName) {
      setModelName(userName);
    }
  }, [userName, modelName]);



  const router = useRouter();
  const { id, slug } = router.query;

  const handleSave = async () => {
    if (id && typeof id === 'string' && slug && typeof slug === 'string') {
      await saveEvent(id, slug);
    }
  };

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
          <button
            className={`px-2 py-1.5 rounded text-xs shadow flex items-center gap-1 transition-colors
                ${hasUnsavedChanges
                ? 'bg-blue-600 text-white hover:bg-blue-700'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }
                ${isSaving ? 'opacity-50 cursor-not-allowed' : ''}
            `}
            onClick={handleSave}
            disabled={isSaving}
          >
            {isSaving ? 'Saving...' : hasUnsavedChanges ? 'Save' : 'Saved'}
          </button>
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

            {/* Snap to Grid */}
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

            {/* SELECTED ITEM PROPERTIES */}
            {selectedItem && (
              <div className="mt-4 pt-4 border-t border-gray-200">
                <div className="text-xs font-bold mb-3 uppercase tracking-wider text-gray-500">
                  {itemType} Properties
                </div>

                {/* Position */}
                {(itemType === 'shape' || itemType === 'asset') && (
                  <div className="grid grid-cols-2 gap-2 mb-2">
                    <div className="flex items-center justify-between">
                      <span className="text-gray-500">X</span>
                      <input
                        type="number"
                        value={roundForDisplay((selectedItem as any).x)}
                        onChange={(e) => {
                          const val = Number(e.target.value);
                          if (itemType === 'shape') updateShape(selectedItem.id, { x: val });
                          if (itemType === 'asset') updateAsset(selectedItem.id, { x: val });
                        }}
                        className="sidebar-input w-16 text-right"
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-500">Y</span>
                      <input
                        type="number"
                        value={roundForDisplay((selectedItem as any).y)}
                        onChange={(e) => {
                          const val = Number(e.target.value);
                          if (itemType === 'shape') updateShape(selectedItem.id, { y: val });
                          if (itemType === 'asset') updateAsset(selectedItem.id, { y: val });
                        }}
                        className="sidebar-input w-16 text-right"
                      />
                    </div>
                  </div>
                )}

                {/* Dimensions (Shape/Asset) */}
                {(itemType === 'shape' || itemType === 'asset') && (
                  <div className="grid grid-cols-2 gap-2 mb-2">
                    <div className="flex items-center justify-between">
                      <span className="text-gray-500">W</span>
                      <input
                        type="number"
                        value={roundForDisplay((selectedItem as any).width)}
                        onChange={(e) => {
                          const val = Number(e.target.value);
                          if (itemType === 'shape') updateShape(selectedItem.id, { width: val });
                          if (itemType === 'asset') updateAsset(selectedItem.id, { width: val });
                        }}
                        className="sidebar-input w-16 text-right"
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-500">H</span>
                      <input
                        type="number"
                        value={roundForDisplay((selectedItem as any).height)}
                        onChange={(e) => {
                          const val = Number(e.target.value);
                          if (itemType === 'shape') updateShape(selectedItem.id, { height: val });
                          if (itemType === 'asset') updateAsset(selectedItem.id, { height: val });
                        }}
                        className="sidebar-input w-16 text-right"
                      />
                    </div>
                  </div>
                )}

                {/* Rotation */}
                {(itemType === 'shape' || itemType === 'asset') && (
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-gray-500">Rotation</span>
                    <div className="flex items-center">
                      <input
                        type="number"
                        value={roundForDisplay((selectedItem as any).rotation || 0)}
                        onChange={(e) => {
                          const val = Number(e.target.value);
                          if (itemType === 'shape') updateShape(selectedItem.id, { rotation: val });
                          if (itemType === 'asset') updateAsset(selectedItem.id, { rotation: val });
                        }}
                        className="sidebar-input w-16 text-right"
                      />
                      <span className="ml-1 text-gray-400">°</span>
                    </div>
                  </div>
                )}

                {/* Appearance (Shape) */}
                {itemType === 'shape' && (
                  <div className="mt-3 pt-3 border-t border-gray-100">
                    <div className="text-xs font-semibold mb-2 text-gray-600">Appearance</div>

                    {/* Fill */}
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-gray-500">Fill</span>
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={(selectedItem as any).fill || '#ffffff'}
                          onChange={(e) => updateShape(selectedItem.id, { fill: e.target.value })}
                          className="sidebar-input w-20 text-xs"
                        />
                        <input
                          type="color"
                          value={(selectedItem as any).fill || '#ffffff'}
                          onChange={(e) => updateShape(selectedItem.id, { fill: e.target.value })}
                          className="w-6 h-6 p-0 border-0 rounded cursor-pointer"
                        />
                      </div>
                    </div>

                    {/* Stroke */}
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-gray-500">Stroke</span>
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={(selectedItem as any).stroke || '#000000'}
                          onChange={(e) => updateShape(selectedItem.id, { stroke: e.target.value })}
                          className="sidebar-input w-20 text-xs"
                        />
                        <input
                          type="color"
                          value={(selectedItem as any).stroke || '#000000'}
                          onChange={(e) => updateShape(selectedItem.id, { stroke: e.target.value })}
                          className="w-6 h-6 p-0 border-0 rounded cursor-pointer"
                        />
                      </div>
                    </div>

                    {/* Stroke Width */}
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-gray-500">Stroke Width</span>
                      <input
                        type="number"
                        value={(selectedItem as any).strokeWidth !== undefined ? (selectedItem as any).strokeWidth : 2}
                        onChange={(e) => {
                          const value = Number(e.target.value);
                          updateShape(selectedItem.id, { strokeWidth: value >= 0 ? value : 2 });
                        }}
                        className="sidebar-input w-16 text-right"
                        min={0}
                        step={0.5}
                      />
                    </div>
                  </div>
                )}

                {/* Text Annotation Properties */}
                {itemType === 'text-annotation' && selectedTextAnnotation && (
                  <div className="mt-3 pt-3 border-t border-gray-100">
                    <div className="text-xs font-semibold mb-2 text-gray-600">Text Properties</div>

                    {/* Text Content */}
                    <div className="mb-2">
                      <label className="block text-xs text-gray-500 mb-1">Text</label>
                      <textarea
                        value={selectedTextAnnotation.text}
                        onChange={(e) => updateTextAnnotation(selectedTextAnnotation.id, { text: e.target.value })}
                        className="w-full text-sm border rounded px-2 py-1 bg-white resize-none"
                        rows={3}
                      />
                    </div>

                    {/* Font Size */}
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-gray-500">Font Size</span>
                      <input
                        type="number"
                        value={selectedTextAnnotation.fontSize || 14}
                        onChange={(e) => {
                          const val = Number(e.target.value);
                          updateTextAnnotation(selectedTextAnnotation.id, { fontSize: Math.max(8, Math.min(72, val)) });
                        }}
                        className="sidebar-input w-16 text-right"
                        min={8}
                        max={72}
                      />
                    </div>

                    {/* Font Family */}
                    <div className="mb-2">
                      <label className="block text-xs text-gray-500 mb-1">Font Family</label>
                      <select
                        value={selectedTextAnnotation.fontFamily || 'Arial'}
                        onChange={(e) => updateTextAnnotation(selectedTextAnnotation.id, { fontFamily: e.target.value })}
                        className="w-full text-xs border rounded px-2 py-1 bg-white"
                      >
                        <option value="Arial">Arial</option>
                        <option value="Helvetica">Helvetica</option>
                        <option value="Times New Roman">Times New Roman</option>
                        <option value="Courier New">Courier New</option>
                        <option value="Verdana">Verdana</option>
                        <option value="Georgia">Georgia</option>
                        <option value="Palatino">Palatino</option>
                        <option value="Garamond">Garamond</option>
                        <option value="Comic Sans MS">Comic Sans MS</option>
                        <option value="Impact">Impact</option>
                      </select>
                    </div>

                    {/* Text Color */}
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-gray-500">Color</span>
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={selectedTextAnnotation.color || '#000000'}
                          onChange={(e) => updateTextAnnotation(selectedTextAnnotation.id, { color: e.target.value })}
                          className="sidebar-input w-20 text-xs"
                        />
                        <input
                          type="color"
                          value={selectedTextAnnotation.color || '#000000'}
                          onChange={(e) => updateTextAnnotation(selectedTextAnnotation.id, { color: e.target.value })}
                          className="w-6 h-6 p-0 border-0 rounded cursor-pointer"
                        />
                      </div>
                    </div>

                    {/* Position */}
                    <div className="grid grid-cols-2 gap-2 mt-3 pt-3 border-t border-gray-100">
                      <div className="flex items-center justify-between">
                        <span className="text-gray-500">X</span>
                        <input
                          type="number"
                          value={roundForDisplay(selectedTextAnnotation.x)}
                          onChange={(e) => {
                            const val = Number(e.target.value);
                            updateTextAnnotation(selectedTextAnnotation.id, { x: val });
                          }}
                          className="sidebar-input w-16 text-right"
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-gray-500">Y</span>
                        <input
                          type="number"
                          value={roundForDisplay(selectedTextAnnotation.y)}
                          onChange={(e) => {
                            const val = Number(e.target.value);
                            updateTextAnnotation(selectedTextAnnotation.id, { y: val });
                          }}
                          className="sidebar-input w-16 text-right"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Label Arrow Properties */}
                {itemType === 'label-arrow' && selectedLabelArrow && (
                  <div className="mt-3 pt-3 border-t border-gray-100">
                    <div className="text-xs font-semibold mb-2 text-gray-600">Label Arrow Properties</div>

                    {/* Label Text */}
                    <div className="mb-2">
                      <label className="block text-xs text-gray-500 mb-1">Label</label>
                      <input
                        type="text"
                        value={selectedLabelArrow.label}
                        onChange={(e) => updateLabelArrow(selectedLabelArrow.id, { label: e.target.value })}
                        className="w-full text-sm border rounded px-2 py-1 bg-white"
                      />
                    </div>

                    {/* Font Size */}
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-gray-500">Font Size</span>
                      <input
                        type="number"
                        value={selectedLabelArrow.fontSize || 14}
                        onChange={(e) => {
                          const val = Number(e.target.value);
                          updateLabelArrow(selectedLabelArrow.id, { fontSize: Math.max(8, Math.min(72, val)) });
                        }}
                        className="sidebar-input w-16 text-right"
                        min={8}
                        max={72}
                      />
                    </div>

                    {/* Color */}
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-gray-500">Color</span>
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={selectedLabelArrow.color || '#000000'}
                          onChange={(e) => updateLabelArrow(selectedLabelArrow.id, { color: e.target.value })}
                          className="sidebar-input w-20 text-xs"
                        />
                        <input
                          type="color"
                          value={selectedLabelArrow.color || '#000000'}
                          onChange={(e) => updateLabelArrow(selectedLabelArrow.id, { color: e.target.value })}
                          className="w-6 h-6 p-0 border-0 rounded cursor-pointer"
                        />
                      </div>
                    </div>

                    {/* Stroke Width */}
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-gray-500">Stroke Width</span>
                      <input
                        type="number"
                        value={selectedLabelArrow.strokeWidth || 2}
                        onChange={(e) => {
                          const val = Number(e.target.value);
                          updateLabelArrow(selectedLabelArrow.id, { strokeWidth: Math.max(1, val) });
                        }}
                        className="sidebar-input w-16 text-right"
                        min={1}
                      />
                    </div>
                  </div>
                )}
              </div>
            )}

          </div>
        )}
      </div>
      <ExportPanel />
    </aside>
  );
}