"use client";

import React from 'react';
import { useEditorStore, type Tool } from '@/store/editorStore';
import { useProjectStore } from '@/store/projectStore';
import { useSceneStore } from '@/store/sceneStore';

interface ToolbarProps {
    className?: string;
}

export default function Toolbar({ className = '' }: ToolbarProps) {
    const { activeTool, setActiveTool, zoomIn, zoomOut, resetZoom, zoom, snapToObjects, toggleSnapToObjects } = useEditorStore();
    const undo = useProjectStore(s => s.undo);
    const redo = useProjectStore(s => s.redo);
    const history = useProjectStore(s => s.history);
    const { setRectangularSelectionMode, snapToGridEnabled, showGrid } = useSceneStore();

    const handleGridToggle = () => {
        useSceneStore.getState().toggleGrid();
    };

    const handleSnapToggle = () => {
        const nextState = !snapToGridEnabled;
        useEditorStore.getState().setSnapToGrid(nextState);
        useSceneStore.getState().setSnapToGridEnabled(nextState);
    };

    const handleObjectSnapToggle = () => {
        toggleSnapToObjects();
    };

    const tools: { id: Tool; label: string; icon: string }[] = [
        { id: 'select', label: 'Select', icon: '⬚' },
        { id: 'wall', label: 'Wall', icon: '▬' },
        { id: 'shape-rectangle', label: 'Rectangle', icon: '▭' },
        { id: 'shape-ellipse', label: 'Ellipse', icon: '○' },
        { id: 'shape-line', label: 'Line', icon: '/' },
        { id: 'asset', label: 'Asset', icon: '⌂' },
        { id: 'pan', label: 'Pan', icon: '✋' },
    ];

    const handleToolClick = (toolId: Tool) => {
        setActiveTool(toolId);
        // Enable rectangular selection mode only when the Select tool is active
        if (toolId === 'select') {
            setRectangularSelectionMode(true);
        } else {
            setRectangularSelectionMode(false);
        }
    };

    return (
        <div className={`bg-white border-b border-gray-200 shadow-sm ${className}`}>
            <div className="flex items-center justify-between px-4 py-2">
                {/* Left: Tools */}
                <div className="flex items-center gap-1">
                    {tools.map((tool) => (
                        <button
                            key={tool.id}
                            onClick={() => handleToolClick(tool.id)}
                            className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${activeTool === tool.id
                                ? 'bg-blue-500 text-white'
                                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                }`}
                            title={tool.label}
                        >
                            <span className="text-lg">{tool.icon}</span>
                            <span className="ml-2 hidden md:inline">{tool.label}</span>
                        </button>
                    ))}
                </div>

                {/* Middle: View Controls */}
                <div className="flex items-center gap-2">
                    <button
                        onClick={handleGridToggle}
                        className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${showGrid
                            ? 'bg-blue-500 text-white'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                            }`}
                        title="Toggle Grid"
                    >
                        Grid
                    </button>

                    <button
                        onClick={handleSnapToggle}
                        className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${snapToGridEnabled
                            ? 'bg-blue-500 text-white'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                            }`}
                        title="Toggle Snap to Grid"
                    >
                        Snap to Grid
                    </button>

                    <button
                        onClick={handleObjectSnapToggle}
                        className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${snapToObjects
                            ? 'bg-blue-500 text-white'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                            }`}
                        title="Toggle Snap to Objects"
                    >
                        Snap Objects
                    </button>

                    <div className="flex items-center gap-1 ml-2">
                        <button
                            onClick={zoomOut}
                            className="px-2 py-1 bg-gray-100 text-gray-700 hover:bg-gray-200 rounded-md text-sm"
                            title="Zoom Out"
                        >
                            −
                        </button>
                        <button
                            onClick={resetZoom}
                            className="px-2 py-1 bg-gray-100 text-gray-700 hover:bg-gray-200 rounded-md text-sm min-w-[60px]"
                            title="Reset to 100%"
                        >
                            {Math.round(zoom * 100)}%
                        </button>
                        <button
                            onClick={zoomIn}
                            className="px-2 py-1 bg-gray-100 text-gray-700 hover:bg-gray-200 rounded-md text-sm"
                            title="Zoom In"
                        >
                            +
                        </button>
                    </div>
                </div>

                {/* Right: History Controls */}
                <div className="flex items-center gap-1">
                    <button
                        onClick={undo}
                        disabled={history.past.length === 0}
                        className="px-3 py-2 bg-gray-100 text-gray-700 hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed rounded-md text-sm font-medium"
                        title="Undo"
                    >
                        ↶ Undo
                    </button>
                    <button
                        onClick={redo}
                        disabled={history.future.length === 0}
                        className="px-3 py-2 bg-gray-100 text-gray-700 hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed rounded-md text-sm font-medium"
                        title="Redo"
                    >
                        ↷ Redo
                    </button>
                </div>
            </div>
        </div>
    );
}
