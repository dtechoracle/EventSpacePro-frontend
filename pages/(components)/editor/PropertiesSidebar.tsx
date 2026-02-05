"use client";

import React, { useState, useEffect } from "react";
import { FaUserCircle, FaChevronDown, FaChevronRight, FaAlignLeft, FaAlignCenter, FaAlignRight, FaArrowUp, FaArrowDown, FaArrowsAltV, FaArrowsAltH, FaCircleNotch } from "react-icons/fa";
import { IoPlayOutline } from "react-icons/io5";
import ShareModal from "./ShareModal";
import ExportPanel from "./ExportPanel";
import { useSceneStore } from "@/store/sceneStore";
import { useEditorStore } from "@/store/editorStore";
import { useProjectStore } from "@/store/projectStore";
import { texturePatterns } from '@/utils/texturePatterns';
import { useRouter } from "next/router";
import { useUserStore } from "@/store/userStore";
import toast from "react-hot-toast";
import { convertAssetToShapes } from "@/utils/assetUtils";
import LineTypeSelector from "@/components/ui/LineTypeSelector";

export default function PropertiesSidebar(): React.JSX.Element {
  const { selectedIds } = useEditorStore();
  const {
    shapes, assets, walls, textAnnotations, labelArrows, dimensions,
    updateShape, updateAsset, updateWall, updateTextAnnotation, updateLabelArrow, updateDimension,
    isSaving, lastSaved, saveEvent, hasUnsavedChanges
  } = useProjectStore();

  // Resolve the single selected item
  const selectedId = selectedIds.length === 1 ? selectedIds[0] : null;

  const selectedShape = selectedId ? shapes.find(s => s.id === selectedId) : null;
  const selectedAsset = selectedId ? assets.find(a => a.id === selectedId) : null;
  const selectedWall = selectedId ? walls.find(w => w.id === selectedId) : null;
  const selectedTextAnnotation = selectedId ? textAnnotations.find(t => t.id === selectedId) : null;
  const selectedLabelArrow = selectedId ? labelArrows.find(l => l.id === selectedId) : null;
  const selectedDimension = selectedId ? dimensions.find(d => d.id === selectedId) : null;

  const selectedItem = selectedShape || selectedAsset || selectedWall || selectedTextAnnotation || selectedLabelArrow || selectedDimension;
  const itemType = selectedShape ? 'shape' : selectedWall ? 'wall' : (selectedAsset?.type === 'wall-segments') ? 'wall' : selectedAsset ? 'asset' : selectedTextAnnotation ? 'text-annotation' : selectedLabelArrow ? 'label-arrow' : selectedDimension ? 'dimension' : null;

  // Multi-selection logic
  const isMultiSelection = selectedIds.length > 1;
  const selectedShapes = isMultiSelection ? shapes.filter(s => selectedIds.includes(s.id)) : [];
  const allSelectedAreShapes = isMultiSelection && selectedShapes.length === selectedIds.length;

  const showGrid = useSceneStore((s) => s.showGrid);
  const toggleGrid = useSceneStore((s) => s.toggleGrid);
  const availableGridSizes = useSceneStore((s) => s.availableGridSizes);
  const selectedGridSizeIndex = useSceneStore((s) => s.selectedGridSizeIndex);
  const setSelectedGridSizeIndex = useSceneStore((s) => s.setSelectedGridSizeIndex);
  const snapToGridEnabled = useSceneStore((s) => s.snapToGridEnabled);
  const toggleSnapToGrid = useSceneStore((s) => s.toggleSnapToGrid);
  const updateSceneAsset = useSceneStore((s) => s.updateAsset);

  const editorStore = useEditorStore();

  const handleToggleGrid = () => {
    toggleGrid();
    editorStore.toggleGrid();
  };

  const handleToggleSnapToGrid = () => {
    toggleSnapToGrid();
    editorStore.toggleSnapToGrid();
  };

  const syncToScene = (id: string, updates: any) => {
    const assetUpdates: any = { ...updates };
    if (updates.fill) assetUpdates.fillColor = updates.fill;
    if (updates.edges && updates.edges[0]?.thickness) assetUpdates.wallThickness = updates.edges[0].thickness;
    if (updates.nodes) assetUpdates.wallNodes = updates.nodes;
    updateSceneAsset(id, assetUpdates);
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

  const [distributeSpacing, setDistributeSpacing] = useState(100);
  const [radialDiameter, setRadialDiameter] = useState(500);
  const [isFontDropdownOpen, setIsFontDropdownOpen] = useState(false);
  const [isArrowHeadDropdownOpen, setIsArrowHeadDropdownOpen] = useState(false);
  const [isArrowTailDropdownOpen, setIsArrowTailDropdownOpen] = useState(false);

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
    <aside className="h-screen flex flex-col p-3 pb-24 overflow-y-auto text-sm bg-white text-gray-900">
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

      {/* Grouping Controls Removed as per request (moved to Context Menu) */}

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
              <span className="text-black">Full Name</span>
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

            {/* Alignment & Distribution - Only when multiple items selected OR single group selected */}
            {(selectedIds.length > 1 || (selectedIds.length === 1 && useProjectStore.getState().groups.find(g => g.id === selectedIds[0]))) && (
              <div className="border-t border-gray-100 pt-3 mt-2">
                <div className="text-xs font-semibold mb-2 text-gray-600">Alignment</div>
                <div className="flex gap-1 mb-3 justify-between">
                  <button onClick={() => useProjectStore.getState().alignSelection('left', selectedIds)} className="p-1.5 hover:bg-gray-100 rounded" title="Align Left"> <FaAlignLeft /> </button>
                  <button onClick={() => useProjectStore.getState().alignSelection('center', selectedIds)} className="p-1.5 hover:bg-gray-100 rounded" title="Align Center"> <FaAlignCenter /> </button>
                  <button onClick={() => useProjectStore.getState().alignSelection('right', selectedIds)} className="p-1.5 hover:bg-gray-100 rounded" title="Align Right"> <FaAlignRight /> </button>
                  <div className="w-px bg-gray-200 mx-1"></div>
                  <button onClick={() => useProjectStore.getState().alignSelection('top', selectedIds)} className="p-1.5 hover:bg-gray-100 rounded" title="Align Top"> <FaArrowUp className="transform rotate-0" /> </button>
                  <button onClick={() => useProjectStore.getState().alignSelection('middle', selectedIds)} className="p-1.5 hover:bg-gray-100 rounded" title="Align Middle"> <FaArrowsAltV /> </button>
                  <button onClick={() => useProjectStore.getState().alignSelection('bottom', selectedIds)} className="p-1.5 hover:bg-gray-100 rounded" title="Align Bottom"> <FaArrowDown /> </button>
                </div>

                <div className="text-xs font-semibold mb-2 text-gray-600">Distribution</div>
                <div className="flex flex-col gap-2">
                  {/* Linear Distribution */}
                  <div className="flex gap-2 items-center">
                    <span className="text-gray-500 w-12">Linear</span>
                    <input
                      type="number"
                      value={distributeSpacing}
                      onChange={(e) => setDistributeSpacing(Number(e.target.value))}
                      className="w-16 sidebar-input text-right"
                      placeholder="Gap"
                    />
                    <span className="text-xs text-gray-400">mm</span>
                    <div className="flex gap-1 ml-auto">
                      <button onClick={() => useProjectStore.getState().distributeSelection('horizontal', distributeSpacing, selectedIds)} className="p-1.5 hover:bg-gray-100 rounded" title="Distribute Horizontally"> <FaArrowsAltH /> </button>
                      <button onClick={() => useProjectStore.getState().distributeSelection('vertical', distributeSpacing, selectedIds)} className="p-1.5 hover:bg-gray-100 rounded" title="Distribute Vertically"> <FaArrowsAltV /> </button>
                    </div>
                  </div>

                  {/* Circular Distribution */}
                  <div className="flex gap-2 items-center">
                    <span className="text-gray-500 w-12">Circle</span>
                    <input
                      type="number"
                      value={radialDiameter} // Using same state var, but semantically it's radius now
                      onChange={(e) => setRadialDiameter(Number(e.target.value))}
                      className="w-16 sidebar-input text-right"
                      placeholder="Radius"
                    />
                    <span className="text-xs text-gray-400">rad</span>
                    <div className="flex gap-1 ml-auto">
                      <button onClick={() => useProjectStore.getState().distributeRadial(radialDiameter, 0, 360, selectedIds)} className="p-1.5 hover:bg-gray-100 rounded" title="Distribute in Circle"> <FaCircleNotch /> </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
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



            {/* MULTI SELECTION PROPERTIES */}
            {isMultiSelection && allSelectedAreShapes && (
              <div className="mt-4 pt-4 border-t border-gray-200">
                <div className="text-xs font-bold mb-3 uppercase tracking-wider text-gray-500">
                  {selectedIds.length} Shapes Selected
                </div>

                {/* Fill Color */}
                <div className="flex justify-between items-center mb-2">
                  <span className="text-gray-500">Fill Color</span>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      onChange={(e) => selectedShapes.forEach(s => updateShape(s.id, { fill: e.target.value, fillType: 'color' }))}
                      className="w-6 h-6 p-0 border-0 rounded cursor-pointer"
                    />
                  </div>
                </div>

                {/* Stroke Color */}
                <div className="flex justify-between items-center mb-2">
                  <span className="text-gray-500">Stroke Color</span>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      onChange={(e) => selectedShapes.forEach(s => updateShape(s.id, { stroke: e.target.value }))}
                      className="w-6 h-6 p-0 border-0 rounded cursor-pointer"
                    />
                  </div>
                </div>

                {/* Stroke Width */}
                <div className="flex justify-between items-center mb-2">
                  <span className="text-gray-500">Stroke Width</span>
                  <input
                    type="number"
                    placeholder="Mixed"
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      if (val >= 0) selectedShapes.forEach(s => updateShape(s.id, { strokeWidth: val }));
                    }}
                    className="sidebar-input w-16 text-right"
                    min={0}
                    step={0.5}
                  />
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
                          if (itemType === 'asset') {
                            updateAsset(selectedItem.id, { x: val });
                            updateSceneAsset(selectedItem.id, { x: val });
                          }
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
                          if (itemType === 'asset') {
                            updateAsset(selectedItem.id, { y: val });
                            updateSceneAsset(selectedItem.id, { y: val });
                          }
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
                          if (itemType === 'asset') {
                            updateAsset(selectedItem.id, { width: val });
                            updateSceneAsset(selectedItem.id, { width: val });
                          }
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
                          if (itemType === 'asset') {
                            updateAsset(selectedItem.id, { height: val });
                            updateSceneAsset(selectedItem.id, { height: val });
                          }
                        }}
                        className="sidebar-input w-16 text-right"
                      />
                    </div>
                  </div>
                )}

                {/* ARROW PROPERTIES */}
                {itemType === 'shape' && (selectedItem as any).type === 'arrow' && (
                  <div className="mt-4 pt-4 border-t border-gray-200">
                    <div className="text-xs font-bold mb-3 uppercase tracking-wider text-gray-500">
                      Arrow Style
                    </div>

                    {/* Head Type */}
                    <div className="mb-2 relative">
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-gray-500 text-xs">Head Type</span>
                      </div>
                      <button
                        onClick={() => setIsArrowHeadDropdownOpen(!isArrowHeadDropdownOpen)}
                        className="w-full p-1 text-xs border border-gray-300 rounded flex justify-between items-center bg-white"
                      >
                        <span>{((selectedItem as any).arrowHeadType || 'filled-triangle').replace('-', ' ')}</span>
                        <FaChevronDown size={10} className="text-gray-400" />
                      </button>

                      {isArrowHeadDropdownOpen && (
                        <>
                          <div
                            className="fixed inset-0 z-10"
                            onClick={() => setIsArrowHeadDropdownOpen(false)}
                          />
                          <div className="absolute top-full left-0 right-0 mt-1 bg-white border rounded shadow-lg z-20 p-2">
                            <div className="grid grid-cols-4 gap-1">
                              {[
                                { id: 'none', label: 'None', path: 'M 2 10 L 22 10' },
                                { id: 'filled-triangle', label: 'Triangle (Filled)', path: 'M 2 10 L 16 10 M 16 6 L 22 10 L 16 14 Z', fill: 'currentColor' },
                                { id: 'triangle', label: 'Triangle (Outline)', path: 'M 2 10 L 16 10 M 16 6 L 22 10 L 16 14 Z', fill: 'none' },
                                { id: 'circle', label: 'Circle', path: 'M 2 10 L 16 10 M 22 10 m -3 0 a 3 3 0 1 0 6 0 a 3 3 0 1 0 -6 0', fill: 'none' },
                                { id: 'square', label: 'Square', path: 'M 2 10 L 16 10 M 16 7 L 22 7 L 22 13 L 16 13 Z', fill: 'none' },
                                { id: 'diamond', label: 'Diamond', path: 'M 2 10 L 16 10 M 19 6 L 22 10 L 19 14 L 16 10 Z', fill: 'none' },
                              ].map((type) => (
                                <button
                                  key={type.id}
                                  onClick={() => {
                                    updateShape(selectedItem.id, { arrowHeadType: type.id as any });
                                    setIsArrowHeadDropdownOpen(false);
                                  }}
                                  className={`h-8 border rounded flex items-center justify-center hover:bg-gray-50 ${((selectedItem as any).arrowHeadType || 'filled-triangle') === type.id ? 'ring-2 ring-blue-500 border-blue-500' : 'border-gray-200'
                                    }`}
                                  title={type.label}
                                >
                                  <svg width="24" height="20" viewBox="0 0 24 20" className="text-gray-700">
                                    <path d={type.path} stroke="currentColor" strokeWidth="1.5" fill={type.fill || 'none'} />
                                  </svg>
                                </button>
                              ))}
                            </div>
                          </div>
                        </>
                      )}
                    </div>

                    {/* Head Size */}
                    <div className="flex justify-between items-center mb-3">
                      <span className="text-gray-500 text-xs">Head Size</span>
                      <input
                        type="number"
                        min="0.1"
                        step="0.1"
                        value={(selectedItem as any).arrowHeadSize || 1}
                        onChange={(e) => updateShape(selectedItem.id, { arrowHeadSize: Number(e.target.value) })}
                        className="sidebar-input w-16 text-right"
                      />
                    </div>

                    {/* Tail Type */}
                    <div className="mb-2 relative">
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-gray-500 text-xs">Tail Type</span>
                      </div>
                      <button
                        onClick={() => setIsArrowTailDropdownOpen(!isArrowTailDropdownOpen)}
                        className="w-full p-1 text-xs border border-gray-300 rounded flex justify-between items-center bg-white"
                      >
                        <span>{((selectedItem as any).arrowTailType || 'none').replace('-', ' ')}</span>
                        <FaChevronDown size={10} className="text-gray-400" />
                      </button>

                      {isArrowTailDropdownOpen && (
                        <>
                          <div
                            className="fixed inset-0 z-10"
                            onClick={() => setIsArrowTailDropdownOpen(false)}
                          />
                          <div className="absolute top-full left-0 right-0 mt-1 bg-white border rounded shadow-lg z-20 p-2">
                            <div className="grid grid-cols-4 gap-1">
                              {[
                                { id: 'none', label: 'None', path: 'M 22 10 L 2 10' },
                                { id: 'standard-nock', label: 'Standard Nock', path: 'M 22 10 L 6 10 M 6 6 L 2 10 L 6 14' },
                                { id: 'circle', label: 'Circle', path: 'M 22 10 L 8 10 M 2 10 m 3 0 a 3 3 0 1 1 -6 0 a 3 3 0 1 1 6 0', fill: 'none' },
                                { id: 'square', label: 'Square', path: 'M 22 10 L 8 10 M 2 7 L 8 7 L 8 13 L 2 13 Z', fill: 'none' },
                                { id: 'diamond', label: 'Diamond', path: 'M 22 10 L 8 10 M 5 6 L 2 10 L 5 14 L 8 10 Z', fill: 'none' },
                                { id: 'triangle', label: 'Triangle', path: 'M 22 10 L 8 10 M 8 6 L 2 10 L 8 14 Z', fill: 'none' },
                                { id: 'filled-triangle', label: 'Filled Triangle', path: 'M 22 10 L 8 10 M 8 6 L 2 10 L 8 14 Z', fill: 'currentColor' },
                              ].map((type) => (
                                <button
                                  key={type.id}
                                  onClick={() => {
                                    updateShape(selectedItem.id, { arrowTailType: type.id as any });
                                    setIsArrowTailDropdownOpen(false);
                                  }}
                                  className={`h-8 border rounded flex items-center justify-center hover:bg-gray-50 ${((selectedItem as any).arrowTailType || 'none') === type.id ? 'ring-2 ring-blue-500 border-blue-500' : 'border-gray-200'
                                    }`}
                                  title={type.label}
                                >
                                  <svg width="24" height="20" viewBox="0 0 24 20" className="text-gray-700">
                                    <path d={type.path} stroke="currentColor" strokeWidth="1.5" fill={type.fill || 'none'} />
                                  </svg>
                                </button>
                              ))}
                            </div>
                          </div>
                        </>
                      )}
                    </div>

                    {/* Tail Size */}
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-gray-500 text-xs">Tail Size</span>
                      <input
                        type="number"
                        min="0.1"
                        step="0.1"
                        value={(selectedItem as any).arrowTailSize || 1}
                        onChange={(e) => updateShape(selectedItem.id, { arrowTailSize: Number(e.target.value) })}
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
                          if (itemType === 'asset') {
                            updateAsset(selectedItem.id, { rotation: val });
                            updateSceneAsset(selectedItem.id, { rotation: val });
                          }
                        }}
                        className="sidebar-input w-16 text-right"
                      />
                      <span className="ml-1 text-gray-400">°</span>
                    </div>
                  </div>
                )}

                {/* Appearance (Shape/Asset) */}
                {(itemType === 'shape' || itemType === 'asset') && (
                  <div className="mt-3 pt-3 border-t border-gray-100">
                    <div className="text-xs font-semibold mb-2 text-gray-600">Appearance</div>

                    {/* Fill Type Selector - Only for Shapes currently */}
                    {itemType === 'shape' && (
                      <div className="mb-3">
                        <label className="block text-xs text-gray-500 mb-1">Fill Type</label>
                        <select
                          value={(selectedItem as any).fillType || 'color'}
                          onChange={(e) => updateShape(selectedItem.id, { fillType: e.target.value as any })}
                          className="w-full text-xs border rounded px-2 py-1 bg-white"
                        >
                          <option value="color">Color</option>
                          <option value="gradient">Gradient</option>
                          <option value="solid">Solid Color</option>
                          <option value="hatch">Hatch Pattern</option>
                          <option value="texture">Texture</option>
                          <option value="image">Image</option>
                        </select>
                      </div>
                    )}

                    {/* Color Fill (Shape or Asset) */}
                    {((!((selectedItem as any).fillType) || (selectedItem as any).fillType === 'color') || itemType === 'asset') && (
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-gray-500">Fill Color</span>
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            value={(itemType === 'asset' ? (selectedItem as any).fillColor : (selectedItem as any).fill) || '#ffffff'}
                            onChange={(e) => {
                              if (itemType === 'shape') updateShape(selectedItem.id, { fill: e.target.value });
                              if (itemType === 'asset') {
                                updateAsset(selectedItem.id, { fillColor: e.target.value });
                                updateSceneAsset(selectedItem.id, { fillColor: e.target.value });
                              }
                            }}
                            className="sidebar-input w-20 text-xs"
                          />
                          <input
                            type="color"
                            value={(itemType === 'asset' ? (selectedItem as any).fillColor : (selectedItem as any).fill) || '#ffffff'}
                            onChange={(e) => {
                              if (itemType === 'shape') updateShape(selectedItem.id, { fill: e.target.value });
                              if (itemType === 'asset') {
                                updateAsset(selectedItem.id, { fillColor: e.target.value });
                                updateSceneAsset(selectedItem.id, { fillColor: e.target.value });
                              }
                            }}
                            className="w-6 h-6 p-0 border-0 rounded cursor-pointer"
                          />
                        </div>
                      </div>
                    )}

                    {/* Gradient Fill */}
                    {(selectedItem as any).fillType === 'gradient' && (
                      <div className="space-y-2 mb-2">
                        <div className="flex justify-between items-center">
                          <span className="text-gray-500 text-xs">Gradient Type</span>
                          <select
                            value={(selectedItem as any).gradientType || 'linear'}
                            onChange={(e) => updateShape(selectedItem.id, { gradientType: e.target.value as any })}
                            className="text-xs border rounded px-2 py-1 bg-white"
                          >
                            <option value="linear">Linear</option>
                            <option value="radial">Radial</option>
                          </select>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-gray-500 text-xs">Start Color</span>
                          <input
                            type="color"
                            value={((selectedItem as any).gradientColors || ['#ffffff', '#000000'])[0]}
                            onChange={(e) => {
                              const colors = (selectedItem as any).gradientColors || ['#ffffff', '#000000'];
                              updateShape(selectedItem.id, { gradientColors: [e.target.value, colors[1]] });
                            }}
                            className="w-6 h-6 p-0 border-0 rounded cursor-pointer"
                          />
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-gray-500 text-xs">End Color</span>
                          <input
                            type="color"
                            value={((selectedItem as any).gradientColors || ['#ffffff', '#000000'])[1]}
                            onChange={(e) => {
                              const colors = (selectedItem as any).gradientColors || ['#ffffff', '#000000'];
                              updateShape(selectedItem.id, { gradientColors: [colors[0], e.target.value] });
                            }}
                            className="w-6 h-6 p-0 border-0 rounded cursor-pointer"
                          />
                        </div>
                        {(selectedItem as any).gradientType === 'linear' && (
                          <div className="flex justify-between items-center">
                            <span className="text-gray-500 text-xs">Angle</span>
                            <div className="flex items-center gap-1">
                              <input
                                type="number"
                                value={(selectedItem as any).gradientAngle || 0}
                                onChange={(e) => updateShape(selectedItem.id, { gradientAngle: Number(e.target.value) })}
                                className="sidebar-input w-12 text-right text-xs"
                                min={0}
                                max={360}
                              />
                              <span className="text-gray-400 text-xs">°</span>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Hatch Fill */}
                    {(selectedItem as any).fillType === 'hatch' && (
                      <div className="space-y-2 mb-2">
                        <span className="text-gray-500 text-xs mb-1 block">Pattern</span>

                        <div className="grid grid-cols-4 gap-1 mb-2">
                          {[
                            { id: 'horizontal', label: 'Horizontal' },
                            { id: 'vertical', label: 'Vertical' },
                            { id: 'diagonal-right', label: 'Diag /' },
                            { id: 'diagonal-left', label: 'Diag \\' },
                            { id: 'cross', label: 'Cross +' },
                            { id: 'diagonal-cross', label: 'Diag X' },
                            { id: 'diagonal-cross', label: 'Diag X' },
                            { id: 'dots', label: 'Dots' },
                            { id: 'brick', label: 'Brick' },
                          ].map((pattern) => (
                            <button
                              key={pattern.id}
                              onClick={() => updateShape(selectedItem.id, { hatchPattern: pattern.id as any })}
                              className={`h-8 border rounded flex items-center justify-center relative ${(selectedItem as any).hatchPattern === pattern.id ? 'ring-2 ring-blue-500 border-blue-500' : 'border-gray-200 hover:border-gray-300'
                                } bg-white`}
                              title={pattern.label}
                            >
                              <svg width="100%" height="100%" viewBox="0 0 20 20">
                                <pattern id={`preview-${pattern.id}`} patternUnits="userSpaceOnUse" width="10" height="10">
                                  <rect width="10" height="10" fill="white" />
                                  {pattern.id === 'horizontal' && <line x1="0" y1="5" x2="10" y2="5" stroke="#000" strokeWidth="1" />}
                                  {pattern.id === 'vertical' && <line x1="5" y1="0" x2="5" y2="10" stroke="#000" strokeWidth="1" />}
                                  {pattern.id === 'diagonal-right' && <path d="M-2,2 l4,-4 M0,10 l10,-10 M8,12 l4,-4" stroke="#000" strokeWidth="1" />}
                                  {pattern.id === 'diagonal-left' && <path d="M-2,8 l4,4 M0,0 l10,10 M8,-2 l4,4" stroke="#000" strokeWidth="1" />}
                                  {pattern.id === 'cross' && <path d="M0,5 h10 M5,0 v10" stroke="#000" strokeWidth="1" />}
                                  {pattern.id === 'diagonal-cross' && <path d="M-2,2 l4,-4 M0,10 l10,-10 M8,12 l4,-4 M-2,8 l4,4 M0,0 l10,10 M8,-2 l4,4" stroke="#000" strokeWidth="1" />}
                                  {pattern.id === 'dots' && <circle cx="5" cy="5" r="1" fill="#000" />}
                                  {pattern.id === 'dots' && <circle cx="5" cy="5" r="1" fill="#000" />}
                                  {pattern.id === 'brick' && <path d="M0,5 h10 M5,0 v5 M0,5 v5 M10,5 v5" stroke="#000" strokeWidth="1" />}
                                </pattern>
                                <rect width="100%" height="100%" fill={`url(#preview-${pattern.id})`} />
                              </svg>
                            </button>
                          ))}
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-gray-500 text-xs">Spacing</span>
                          <input
                            type="number"
                            value={(selectedItem as any).hatchSpacing || 50}
                            onChange={(e) => updateShape(selectedItem.id, { hatchSpacing: Number(e.target.value) })}
                            className="sidebar-input w-12 text-right text-xs"
                            min={1}
                            max={200}
                          />
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-gray-500 text-xs">Color</span>
                          <input
                            type="color"
                            value={(selectedItem as any).hatchColor || '#000000'}
                            onChange={(e) => updateShape(selectedItem.id, { hatchColor: e.target.value })}
                            className="w-6 h-6 p-0 border-0 rounded cursor-pointer"
                          />
                        </div>
                      </div>
                    )}

                    {/* Texture Fill */}
                    {(selectedItem as any).fillType === 'texture' && (
                      <div className="space-y-2 mb-2">
                        <div className="grid grid-cols-2 gap-2">
                          {texturePatterns.map((pattern) => (
                            <button
                              key={pattern.id}
                              className={`h-8 border rounded overflow-hidden relative ${(selectedItem as any).fillTexture === pattern.id ? 'ring-2 ring-blue-500' : 'border-gray-300'
                                }`}
                              onClick={() => updateShape(selectedItem.id, { fillTexture: pattern.id } as any)}
                              title={pattern.name}
                            >
                              <svg width="100%" height="100%">
                                <defs dangerouslySetInnerHTML={{ __html: pattern.svg }} />
                                <rect width="100%" height="100%" fill={`url(#${pattern.id})`} />
                              </svg>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Image Fill */}
                    {(selectedItem as any).fillType === 'image' && (
                      <div className="space-y-2 mb-2">
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">Upload Image</label>
                          <input
                            type="file"
                            accept="image/*"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                const reader = new FileReader();
                                reader.onload = (event) => {
                                  updateShape(selectedItem.id, { fillImage: event.target?.result as string });
                                };
                                reader.readAsDataURL(file);
                              }
                            }}
                            className="text-xs w-full"
                          />
                        </div>
                        {(selectedItem as any).fillImage && (
                          <>
                            <div className="w-full h-20 border rounded overflow-hidden">
                              <img
                                src={(selectedItem as any).fillImage}
                                alt="Fill"
                                className="w-full h-full object-cover"
                              />
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-gray-500 text-xs">Scale</span>
                              <input
                                type="number"
                                value={(selectedItem as any).fillImageScale || 1}
                                onChange={(e) => updateShape(selectedItem.id, { fillImageScale: Number(e.target.value) })}
                                className="sidebar-input w-12 text-right text-xs"
                                min={0.1}
                                max={5}
                                step={0.1}
                              />
                            </div>
                          </>
                        )}
                      </div>
                    )}
                    {/* Stroke Color (Shape or Asset) */}
                    {(itemType === 'shape' || itemType === 'asset') && (
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-gray-500">Stroke Color</span>
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            value={(itemType === 'asset' ? (selectedItem as any).strokeColor : (selectedItem as any).stroke) || '#000000'}
                            onChange={(e) => {
                              if (itemType === 'shape') updateShape(selectedItem.id, { stroke: e.target.value });
                              if (itemType === 'asset') {
                                updateAsset(selectedItem.id, { strokeColor: e.target.value });
                                updateSceneAsset(selectedItem.id, { strokeColor: e.target.value });
                              }
                            }}
                            className="sidebar-input w-20 text-xs"
                          />
                          <input
                            type="color"
                            value={(itemType === 'asset' ? (selectedItem as any).strokeColor : (selectedItem as any).stroke) || '#000000'}
                            onChange={(e) => {
                              if (itemType === 'shape') updateShape(selectedItem.id, { stroke: e.target.value });
                              if (itemType === 'asset') {
                                updateAsset(selectedItem.id, { strokeColor: e.target.value });
                                updateSceneAsset(selectedItem.id, { strokeColor: e.target.value });
                              }
                            }}
                            className="w-6 h-6 p-0 border-0 rounded cursor-pointer"
                          />
                        </div>
                      </div>
                    )}

                    {/* Stroke Width (Shape or Asset) */}
                    {(itemType === 'shape' || itemType === 'asset') && (
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-gray-500">Stroke Width</span>
                        <input
                          type="number"
                          value={(itemType === 'asset' ? (selectedItem as any).strokeWidth : (selectedItem as any).strokeWidth) || 0}
                          onChange={(e) => {
                            const val = Number(e.target.value);
                            if (itemType === 'shape') updateShape(selectedItem.id, { strokeWidth: val });
                            if (itemType === 'asset') {
                              updateAsset(selectedItem.id, { strokeWidth: val });
                              updateSceneAsset(selectedItem.id, { strokeWidth: val });
                            }
                          }}
                          className="sidebar-input w-16 text-right"
                          min={0}
                          step={0.5}
                        />
                      </div>
                    )}

                    {/* Line Type (Shape Only) */}
                    {itemType === 'shape' && (
                      <LineTypeSelector
                        currentType={(selectedItem as any).lineType || 'solid'}
                        onChange={(type, dashArray) => {
                          updateShape(selectedItem.id, {
                            lineType: type,
                            strokeDasharray: dashArray
                          });
                        }}
                      />
                    )}

                    {/* Stroke */}
                    {/* This section is now redundant for shapes/assets and will be removed or refactored */}
                    {/* <div className="flex justify-between items-center mb-2">
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
                    </div> */}

                    {/* Stroke Width */}
                    {/* This section is now redundant for shapes/assets and will be removed or refactored */}
                    {/* <div className="flex justify-between items-center mb-2">
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
                    </div> */}


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
                      <span className="text-gray-500">Font Size (px)</span>
                      <input
                        type="number"
                        value={selectedTextAnnotation.fontSize || 200}
                        onChange={(e) => {
                          const val = Number(e.target.value);
                          updateTextAnnotation(selectedTextAnnotation.id, { fontSize: Math.max(8, Math.min(1000, val)) });
                        }}
                        className="sidebar-input w-16 text-right"
                        min={8}
                        max={1000}
                      />
                    </div>

                    {/* Font Family */}
                    <div className="mb-2 relative">
                      <label className="block text-xs text-gray-500 mb-1">Font Family</label>
                      <button
                        onClick={() => setIsFontDropdownOpen(!isFontDropdownOpen)}
                        className="w-full text-xs border rounded px-2 py-1 bg-white text-left flex justify-between items-center"
                        style={{ fontFamily: selectedTextAnnotation.fontFamily || 'Arial' }}
                      >
                        {selectedTextAnnotation.fontFamily || 'Arial'}
                        <FaChevronDown size={10} className="text-gray-400" />
                      </button>

                      {isFontDropdownOpen && (
                        <>
                          <div
                            className="fixed inset-0 z-10"
                            onClick={() => setIsFontDropdownOpen(false)}
                          />
                          <div className="absolute top-full left-0 right-0 mt-1 bg-white border rounded shadow-lg z-20 max-h-48 overflow-y-auto">
                            {[
                              "Arial", "Helvetica", "Times New Roman", "Courier New",
                              "Verdana", "Georgia", "Palatino", "Garamond",
                              "Comic Sans MS", "Impact"
                            ].map((font) => (
                              <div
                                key={font}
                                className="px-2 py-1.5 hover:bg-gray-100 cursor-pointer text-xs"
                                style={{ fontFamily: font }}
                                onClick={() => {
                                  updateTextAnnotation(selectedTextAnnotation.id, { fontFamily: font });
                                  setIsFontDropdownOpen(false);
                                }}
                              >
                                {font}
                              </div>
                            ))}
                          </div>
                        </>
                      )}
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

                {/* Wall Properties */}
                {(itemType === 'wall' || (itemType === 'asset' && (selectedAsset as any)?.type === 'wall-segments')) && (selectedWall || selectedAsset) && (
                  <div className="mt-3 pt-3 border-t border-gray-100">
                    <div className="text-xs font-semibold mb-2 text-gray-600">Wall Properties</div>

                    {/* Wall Fill Type */}
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-gray-500 text-xs">Fill Type</span>
                      <select
                        value={(selectedItem as any).fillType || 'color'}
                        onChange={(e) => {
                          const val = e.target.value;
                          if (itemType === 'wall') {
                            updateWall(selectedItem.id, { fillType: val as any });
                            syncToScene(selectedItem.id, { fillType: val });
                          }
                          else {
                            updateAsset(selectedItem.id, { fillType: val } as any);
                            updateSceneAsset(selectedItem.id, { fillType: val } as any);
                          }
                        }}
                        className="text-xs border rounded px-2 py-1 bg-white"
                      >
                        <option value="color">Color</option>
                        <option value="texture">Texture</option>
                      </select>
                    </div>

                    {/* Wall Fill Color */}
                    {(!(selectedItem as any).fillType || (selectedItem as any).fillType === 'color') && (
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-gray-500">Fill Color</span>
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            value={(itemType === 'wall' ? (selectedItem as any).fill : (selectedItem as any).fillColor) || '#ffffff'}
                            onChange={(e) => {
                              const val = e.target.value;
                              if (itemType === 'wall') {
                                updateWall(selectedItem.id, { fill: val });
                                syncToScene(selectedItem.id, { fill: val });
                              }
                              else {
                                updateAsset(selectedItem.id, { fillColor: val });
                                updateSceneAsset(selectedItem.id, { fillColor: val });
                              }
                            }}
                            className="sidebar-input w-20 text-xs"
                          />
                          <input
                            type="color"
                            value={(itemType === 'wall' && !(selectedItem as any).wallSegments ? (selectedItem as any).fill : (selectedItem as any).fillColor) || '#ffffff'}
                            onChange={(e) => {
                              const val = e.target.value;
                              if (itemType === 'wall' && !(selectedItem as any).wallSegments) {
                                updateWall(selectedItem.id, { fill: val });
                                syncToScene(selectedItem.id, { fill: val });
                              }
                              else {
                                updateAsset(selectedItem.id, { fillColor: val });
                                updateSceneAsset(selectedItem.id, { fillColor: val });
                              }
                            }}
                            className="w-6 h-6 p-0 border-0 rounded cursor-pointer"
                          />
                        </div>
                      </div>
                    )}

                    {/* Wall Texture Fill */}
                    {(selectedItem as any).fillType === 'texture' && (
                      <div className="space-y-2 mb-2">
                        <div className="grid grid-cols-2 gap-2">
                          {texturePatterns.map((pattern) => (
                            <button
                              key={pattern.id}
                              className={`h-24 border rounded overflow-hidden relative transition-all duration-200 hover:scale-150 hover:z-50 hover:shadow-xl hover:ring-2 hover:ring-white ${(selectedItem as any).fillTexture === pattern.id ? 'ring-2 ring-blue-500 z-10' : 'border-gray-300 z-0'
                                }`}
                              onClick={() => {
                                const val = pattern.id;
                                if (itemType === 'wall' && !(selectedItem as any).wallSegments) {
                                  updateWall(selectedItem.id, { fillTexture: val });
                                  syncToScene(selectedItem.id, { fillTexture: val });
                                }
                                else {
                                  updateAsset(selectedItem.id, { fillTexture: val } as any);
                                  updateSceneAsset(selectedItem.id, { fillTexture: val } as any);
                                }
                              }}
                              title={pattern.name}
                            >
                              <svg width="100%" height="100%">
                                <defs dangerouslySetInnerHTML={{ __html: pattern.svg }} />
                                <rect width="100%" height="100%" fill={`url(#${pattern.id})`} />
                              </svg>
                            </button>
                          ))}
                        </div>
                        <div className="flex justify-between items-center mt-2">
                          <span className="text-gray-500 text-xs">Scale</span>
                          <input
                            type="number"
                            value={(selectedItem as any).fillTextureScale || 1}
                            onChange={(e) => {
                              const val = Number(e.target.value);
                              if (itemType === 'wall') {
                                updateWall(selectedItem.id, { fillTextureScale: val });
                                syncToScene(selectedItem.id, { fillTextureScale: val });
                              }
                              else {
                                updateAsset(selectedItem.id, { fillTextureScale: val } as any);
                                updateSceneAsset(selectedItem.id, { fillTextureScale: val } as any);
                              }
                            }}
                            className="sidebar-input w-12 text-right text-xs"
                            min={0.1}
                            max={10}
                            step={0.1}
                          />
                        </div>
                      </div>
                    )}

                    {/* Wall Thickness */}
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-gray-500">Thickness</span>
                      <input
                        type="number"
                        value={(itemType === 'wall' && !(selectedItem as any).wallSegments ? (selectedItem as any).edges?.[0]?.thickness : (selectedItem as any).wallThickness) || 75}
                        onChange={(e) => {
                          const val = Number(e.target.value);
                          const safeVal = Math.max(1, val);
                          if (itemType === 'wall' && (selectedItem as any).edges && !(selectedItem as any).wallSegments) {
                            const updatedEdges = (selectedItem as any).edges.map((edge: any) => ({
                              ...edge,
                              thickness: safeVal
                            }));
                            updateWall(selectedItem.id, { edges: updatedEdges });
                            syncToScene(selectedItem.id, { edges: updatedEdges });
                          } else {
                            updateAsset(selectedItem.id, { wallThickness: safeVal } as any);
                            updateSceneAsset(selectedItem.id, { wallThickness: safeVal } as any);
                          }
                        }}
                        className="sidebar-input w-16 text-right"
                        min={1}
                      />
                    </div>

                    {/* Wall Length & Height */}
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-gray-500">Length</span>
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          value={(() => {
                            if (itemType === 'wall' && (selectedItem as any).nodes) {
                              const xs = (selectedItem as any).nodes.map((n: any) => n.x);
                              if (xs.length) return Math.round(Math.max(...xs) - Math.min(...xs)) || 0;
                            }
                            if ((itemType === 'wall' || itemType === 'asset') && (selectedItem as any).wallSegments) {
                              let len = 0;
                              (selectedItem as any).wallSegments.forEach((s: any) => {
                                len += Math.hypot(s.end.x - s.start.x, s.end.y - s.start.y);
                              });
                              return Math.round(len);
                            }
                            if (itemType === 'asset' && (selectedItem as any).wallNodes) {
                              const xs = (selectedItem as any).wallNodes.map((n: any) => n.x);
                              if (xs.length) return Math.round(Math.max(...xs) - Math.min(...xs)) || 0;
                            }
                            return 0;
                          })()}
                          onChange={(e) => {
                            const newLen = Number(e.target.value);
                            if (newLen <= 0) return;

                            // 1. Native Walls (nodes)
                            if (itemType === 'wall' && (selectedItem as any).nodes) {
                              const xs = (selectedItem as any).nodes.map((n: any) => n.x);
                              const minX = Math.min(...xs);
                              const maxX = Math.max(...xs);
                              const currentLen = maxX - minX;
                              if (currentLen === 0) return;
                              const centerX = (minX + maxX) / 2;
                              const scale = newLen / currentLen;
                              const updatedNodes = (selectedItem as any).nodes.map((node: any) => ({
                                ...node,
                                x: centerX + (node.x - centerX) * scale
                              }));
                              updateWall(selectedItem.id, { nodes: updatedNodes });
                              syncToScene(selectedItem.id, { nodes: updatedNodes });
                            }

                            // 2. Asset Walls (AI generated wallNodes)
                            else if (itemType === 'asset' && (selectedItem as any).wallNodes) {
                              const xs = (selectedItem as any).wallNodes.map((n: any) => n.x);
                              const minX = Math.min(...xs);
                              const maxX = Math.max(...xs);
                              const currentLen = maxX - minX;
                              if (currentLen > 0) {
                                const centerX = (minX + maxX) / 2;
                                const scale = newLen / currentLen;
                                const updatedNodes = (selectedItem as any).wallNodes.map((node: any) => ({
                                  ...node,
                                  x: centerX + (node.x - centerX) * scale
                                }));
                                updateAsset(selectedItem.id, { wallNodes: updatedNodes } as any);
                                updateSceneAsset(selectedItem.id, { wallNodes: updatedNodes } as any);
                              }
                            }

                            // 3. Manual Wall Segments (Perimeter Scale)
                            // This can apply to itemType='wall' (aliased) or 'asset'
                            if ((selectedItem as any).wallSegments) {
                              const segments = (selectedItem as any).wallSegments;
                              let currentLen = 0;
                              segments.forEach((s: any) => {
                                currentLen += Math.hypot(s.end.x - s.start.x, s.end.y - s.start.y);
                              });

                              if (currentLen > 0) {
                                const scale = newLen / currentLen;
                                // Find center of all segments
                                let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
                                segments.forEach((s: any) => {
                                  minX = Math.min(minX, s.start.x, s.end.x);
                                  maxX = Math.max(maxX, s.start.x, s.end.x);
                                  minY = Math.min(minY, s.start.y, s.end.y);
                                  maxY = Math.max(maxY, s.start.y, s.end.y);
                                });
                                const cx = (minX + maxX) / 2;
                                const cy = (minY + maxY) / 2;

                                const updatedSegments = segments.map((s: any) => ({
                                  ...s,
                                  start: {
                                    x: cx + (s.start.x - cx) * scale,
                                    y: cy + (s.start.y - cy) * scale
                                  },
                                  end: {
                                    x: cx + (s.end.x - cx) * scale,
                                    y: cy + (s.end.y - cy) * scale
                                  }
                                }));

                                updateAsset(selectedItem.id, { wallSegments: updatedSegments } as any);
                                updateSceneAsset(selectedItem.id, { wallSegments: updatedSegments } as any);
                              }
                            }
                          }}
                          className="sidebar-input w-16 text-right"
                        />
                        <span className="text-xs text-gray-400">mm</span>
                      </div>
                    </div>

                    <div className="flex justify-between items-center mb-2">
                      <span className="text-gray-500">Height</span>
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          value={(() => {
                            if ((selectedItem as any).wallSegments) {
                              const s = (selectedItem as any).wallSegments;
                              let minY = Infinity, maxY = -Infinity;
                              s.forEach((seg: any) => {
                                minY = Math.min(minY, seg.start.y, seg.end.y);
                                maxY = Math.max(maxY, seg.start.y, seg.end.y);
                              });
                              if (minY !== Infinity && maxY !== -Infinity) return Math.round(maxY - minY);
                            }
                            return (selectedItem as any).height || 3000;
                          })()}
                          onChange={(e) => {
                            const val = Number(e.target.value);
                            if (val <= 0) return;

                            // Handle manual wall segments (Scale Y)
                            if ((selectedItem as any).wallSegments) {
                              const segments = (selectedItem as any).wallSegments;
                              let minY = Infinity, maxY = -Infinity;
                              segments.forEach((s: any) => {
                                minY = Math.min(minY, s.start.y, s.end.y);
                                maxY = Math.max(maxY, s.start.y, s.end.y);
                              });
                              const currentH = maxY - minY;
                              if (currentH > 0) {
                                const scale = val / currentH;
                                const cy = (minY + maxY) / 2;
                                const updatedSegments = segments.map((s: any) => ({
                                  ...s,
                                  start: {
                                    ...s.start,
                                    y: cy + (s.start.y - cy) * scale
                                  },
                                  end: {
                                    ...s.end,
                                    y: cy + (s.end.y - cy) * scale
                                  }
                                }));
                                updateAsset(selectedItem.id, { wallSegments: updatedSegments } as any);
                                updateSceneAsset(selectedItem.id, { wallSegments: updatedSegments } as any);
                                return;
                              }
                            }

                            if (itemType === 'wall' && !(selectedItem as any).wallSegments) {
                              updateWall(selectedItem.id, { height: val } as any);
                              syncToScene(selectedItem.id, { height: val });
                            }
                            else {
                              updateAsset(selectedItem.id, { height: val });
                              updateSceneAsset(selectedItem.id, { height: val });
                            }
                          }}
                          className="sidebar-input w-16 text-right"
                        />
                        <span className="text-xs text-gray-400">mm</span>
                      </div>
                    </div>

                    {/* Show Dimensions Toggle */}
                    <div className="flex justify-between items-center mb-2 pt-2 border-t border-gray-100">
                      <span className="text-gray-500">Show Dimensions</span>
                      <button
                        onClick={() => {
                          const cur = !!(selectedItem as any).showDimensions;
                          const next = !cur;
                          if (itemType === 'wall' && !(selectedItem as any).wallSegments) {
                            updateWall(selectedItem.id, { showDimensions: next } as any);
                            syncToScene(selectedItem.id, { showDimensions: next });
                          }
                          else {
                            updateAsset(selectedItem.id, { showDimensions: next } as any);
                            updateSceneAsset(selectedItem.id, { showDimensions: next } as any);
                          }
                        }}
                        className={`w-10 h-5 rounded-full flex items-center transition-colors px-1 ${(selectedItem as any).showDimensions ? "bg-blue-600 justify-end" : "bg-gray-300 justify-start"
                          }`}
                      >
                        <div className="w-3 h-3 bg-white rounded-full shadow-sm" />
                      </button>
                    </div>
                  </div>
                )}


                {/* Dimension Properties */}
                {itemType === 'dimension' && selectedDimension && (
                  <div className="mt-3 pt-3 border-t border-gray-100">
                    <div className="text-xs font-semibold mb-2 text-gray-600">Dimension Properties</div>

                    {/* Stroke Width */}
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-gray-500">Line Width</span>
                      <input
                        type="number"
                        value={selectedDimension.strokeWidth || 7.5}
                        onChange={(e) => {
                          const val = Number(e.target.value);
                          updateDimension(selectedDimension.id, { strokeWidth: Math.max(0.5, val) });
                        }}
                        className="sidebar-input w-16 text-right"
                        min={0.5}
                        step={0.5}
                      />
                    </div>

                    {/* Color */}
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-gray-500">Color</span>
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={selectedDimension.color || '#000000'}
                          onChange={(e) => updateDimension(selectedDimension.id, { color: e.target.value })}
                          className="sidebar-input w-20 text-xs"
                        />
                        <input
                          type="color"
                          value={selectedDimension.color || '#000000'}
                          onChange={(e) => updateDimension(selectedDimension.id, { color: e.target.value })}
                          className="w-6 h-6 p-0 border-0 rounded cursor-pointer"
                        />
                      </div>
                    </div>

                    {/* Font Size */}
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-gray-500">Font Size</span>
                      <input
                        type="number"
                        value={selectedDimension.fontSize || 12}
                        onChange={(e) => {
                          const val = Number(e.target.value);
                          updateDimension(selectedDimension.id, { fontSize: Math.max(6, Math.min(48, val)) });
                        }}
                        className="sidebar-input w-16 text-right"
                        min={6}
                        max={48}
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