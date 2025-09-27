"use client";

import { useState } from "react";
import { FiChevronDown, FiChevronRight, FiPlus, FiBox, FiSave } from "react-icons/fi";
import { LuFocus } from "react-icons/lu";

interface ToolbarProps {
  onSave?: () => void;
  hasUnsavedChanges?: boolean;
}

export default function Toolbar({ onSave, hasUnsavedChanges }: ToolbarProps) {
  const [showCanvases, setShowCanvases] = useState(true);
  const [showLayers, setShowLayers] = useState(true);

  const [layers, setLayers] = useState([
    { id: 1, name: "Layer 1", open: true, children: ["Child A", "Child B"] },
    { id: 2, name: "Layer 2", open: false, children: ["Child X"] },
  ]);

  const [editingLayer, setEditingLayer] = useState<number | null>(null);

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
    <div className="w-64 h-screen bg-[#FDFDFF] flex flex-col p-4 text-sm">
      {/* Toolbar Heading */}
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-lg font-bold">Toolbar</h1>
        {onSave && (
          <button
            onClick={onSave}
            className={`flex items-center gap-2 px-3 py-1 text-white text-sm rounded transition-colors ${
              hasUnsavedChanges 
                ? 'bg-orange-500 hover:bg-orange-600 animate-pulse' 
                : 'bg-green-500 hover:bg-green-600'
            }`}
            title={hasUnsavedChanges ? "Save changes" : "No changes to save"}
            disabled={!hasUnsavedChanges}
          >
            <FiSave size={14} />
            {hasUnsavedChanges ? "Save" : "Saved"}
          </button>
        )}
      </div>

      {/* Canvases Section */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2 cursor-pointer">
          <div
            className="flex items-center gap-1"
            onClick={() => setShowCanvases((p) => !p)}
          >
            <span className="capitalize text-xs font-semibold tracking-wide">
              Canvases
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div onClick={() => setShowCanvases((p) => !p)}>
              {showCanvases ? <FiChevronDown /> : <FiChevronRight />}
            </div>
            <button className="p-1 hover:bg-gray-100 rounded">
              <FiPlus size={14} />
            </button>
          </div>
        </div>

        {showCanvases && (
          <div className="space-y-2 pt-3">
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 bg-[var(--accent)] text-white flex items-center justify-center text-xs font-bold rounded">
                M
              </div>
              <span className="font-medium">Model Canvas</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 bg-[var(--accent)] text-white flex items-center justify-center text-xs font-bold rounded">
                P
              </div>
              <span className="font-medium">Paper Canvas</span>
            </div>
          </div>
        )}
      </div>

      {/* Layers Section */}
      <div className="mb-4 pt-3">
        <div className="flex items-center justify-between mb-2 cursor-pointer">
          <div
            className="flex items-center gap-1"
            onClick={() => setShowLayers((p) => !p)}
          >
            <span className="capitalize text-xs font-semibold tracking-wide">
              Layers
            </span>
          </div>
          <div className="flex gap-2 items-center">
            <div onClick={() => setShowLayers((p) => !p)} >
              {showLayers ? <FiChevronDown /> : <FiChevronRight />}
            </div>

            <button
              className="p-1 hover:bg-gray-100 rounded"
              onClick={addLayer}
            >
              <FiPlus size={14} />
            </button>
          </div>
        </div>

        {showLayers && (
          <div className="space-y-1 pt-3">
            {layers.map((layer) => (
              <div key={layer.id} className="">
                <div className="flex items-center gap-1">
                  <button
                    className="p-1"
                    onClick={() => toggleLayer(layer.id)}
                  >
                    {layer.open ? (
                      <FiChevronDown size={14} />
                    ) : (
                      <FiChevronRight size={14} />
                    )}
                  </button>

                  <div className="h-3 w-1 rounded-sm bg-[var(--accent)] mr-1" />

                  {editingLayer === layer.id ? (
                    <input
                      autoFocus
                      className="border rounded px-1 text-xs"
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
                  <div className="pl-6 text-gray-500 text-xs space-y-1">
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

      <div>
        <div className="space-y-1 text-xs text-black/65">
          <div className="flex items-center gap-2">
            <LuFocus size={14} />
            <span>Asset 1</span>
          </div>
          <div className="flex items-center gap-2">
            <LuFocus size={14} />
            <span>Asset 2</span>
          </div>
        </div>
      </div>
    </div>
  );
}

