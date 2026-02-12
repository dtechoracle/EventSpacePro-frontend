"use client";

import React from 'react';
import { useEditorStore, type Tool } from '@/store/editorStore';
import { useProjectStore } from '@/store/projectStore';
import { useSceneStore } from '@/store/sceneStore';

interface ToolbarProps {
    className?: string;
}

export default function Toolbar({ className = '' }: ToolbarProps) {
    const { activeTool, setActiveTool, showGrid, toggleGrid, snapToGrid, toggleSnapToGrid, zoomIn, zoomOut, resetZoom } = useEditorStore();
    const { undo, redo, history } = useProjectStore();
    const { setRectangularSelectionMode, toggleSnapToGrid: toggleSceneSnap } = useSceneStore();

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
                        onClick={toggleGrid}
                        className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${showGrid
                            ? 'bg-blue-500 text-white'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                            }`}
                        title="Toggle Grid"
                    >
                        Grid
                    </button>

                    <button
                        onClick={toggleSnapToGrid}
                        className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${!snapToGrid
                            ? 'bg-blue-500 text-white'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                            }`}
                        title="Toggle Smart Snap"
                    >
                        Smart Snap
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
                            className="px-2 py-1 bg-gray-100 text-gray-700 hover:bg-gray-200 rounded-md text-sm"
                            title="Reset Zoom"
                        >
                            100%
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
