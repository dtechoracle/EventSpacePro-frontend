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

    const fileInputRef = React.useRef<HTMLInputElement>(null);

    const compressImage = (dataUrl: string, maxWidth = 1200, maxHeight = 1200): Promise<string> => {
        return new Promise((resolve) => {
            const img = new Image();
            img.onload = () => {
                let width = img.width;
                let height = img.height;

                if (width > maxWidth || height > maxHeight) {
                    const ratio = Math.min(maxWidth / width, maxHeight / height);
                    width = width * ratio;
                    height = height * ratio;
                }

                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;

                const ctx = canvas.getContext('2d');
                if (ctx) {
                    ctx.drawImage(img, 0, 0, width, height);
                    resolve(canvas.toDataURL('image/jpeg', 0.75));
                } else {
                    resolve(dataUrl);
                }
            };
            img.onerror = () => {
                resolve(dataUrl);
            };
            img.src = dataUrl;
        });
    };

    const handleImportClick = () => {
        fileInputRef.current?.click();
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();

        if (file.type.startsWith('image/')) {
            reader.onload = (event) => {
                const rawUrl = event.target?.result as string;
                compressImage(rawUrl).then((dataUrl) => {
                    const img = new Image();
                    img.onload = () => {
                        const maxSize = 1500;
                        let w = img.width;
                        let h = img.height;
                        if (w > maxSize || h > maxSize) {
                            const ratio = Math.min(maxSize / w, maxSize / h);
                            w = w * ratio;
                            h = h * ratio;
                        }

                        const newShape = {
                            id: crypto.randomUUID(),
                            type: 'image' as any,
                            x: 0,
                            y: 0,
                            width: Math.max(100, w),
                            height: Math.max(100, h),
                            rotation: 0,
                            fillImage: dataUrl,
                            fillType: 'image' as any,
                            stroke: '#000000',
                            strokeWidth: 1,
                            zIndex: useProjectStore.getState().getNextZIndex(),
                        };

                        useEditorStore.getState().setPendingImportShape(newShape);
                        useEditorStore.getState().setActiveTool('select');
                    };
                    img.src = dataUrl;
                });
            };
            reader.readAsDataURL(file);
        } else if (file.type === 'application/pdf') {
            reader.onload = async (event) => {
                const arrayBuffer = event.target?.result as ArrayBuffer;

                const loadPDFJS = () => {
                    return new Promise<any>((resolve, reject) => {
                        if ((window as any).pdfjsLib) {
                            resolve((window as any).pdfjsLib);
                            return;
                        }
                        const script = document.createElement('script');
                        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.min.js';
                        script.onload = () => {
                            const pdfjsLib = (window as any).pdfjsLib;
                            pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.worker.min.js';
                            resolve(pdfjsLib);
                        };
                        script.onerror = reject;
                        document.head.appendChild(script);
                    });
                };

                try {
                    const pdfjsLib = await loadPDFJS();
                    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
                    const page = await pdf.getPage(1);
                    
                    const viewport = page.getViewport({ scale: 1.5 });
                    const canvas = document.createElement('canvas');
                    const context = canvas.getContext('2d');
                    if (context) {
                        canvas.width = viewport.width;
                        canvas.height = viewport.height;
                        await page.render({ canvasContext: context, viewport }).promise;
                        
                        const dataUrl = await compressImage(canvas.toDataURL('image/jpeg', 0.7), 1200, 1200);
                        
                        const maxSize = 1500;
                        let w = canvas.width;
                        let h = canvas.height;
                        if (w > maxSize || h > maxSize) {
                            const ratio = Math.min(maxSize / w, maxSize / h);
                            w = w * ratio;
                            h = h * ratio;
                        }

                        const newShape = {
                            id: crypto.randomUUID(),
                            type: 'image' as any,
                            x: 0,
                            y: 0,
                            width: Math.max(100, w),
                            height: Math.max(100, h),
                            rotation: 0,
                            fillImage: dataUrl,
                            fillType: 'image' as any,
                            stroke: '#000000',
                            strokeWidth: 1,
                            zIndex: useProjectStore.getState().getNextZIndex(),
                        };

                        useEditorStore.getState().setPendingImportShape(newShape);
                        useEditorStore.getState().setActiveTool('select');
                    }
                } catch (err) {
                    console.error("PDF import error:", err);
                }
            };
            reader.readAsArrayBuffer(file);
        }

        e.target.value = '';
    };

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

                {/* Right: History Controls & Import */}
                <div className="flex items-center gap-1">
                    <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleFileChange}
                        accept="image/*,application/pdf"
                        className="hidden"
                    />
                    <button
                        onClick={handleImportClick}
                        className="px-3 py-2 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-md text-sm font-semibold flex items-center gap-1 mr-2 transition-all shadow-sm"
                        title="Import Image or PDF file"
                    >
                        📥 Import
                    </button>
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
