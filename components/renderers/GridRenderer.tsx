"use client";

import React, { useMemo } from 'react';

interface GridRendererProps {
    gridSize: number;
    viewportSize: { width: number; height: number };
    zoom: number;
    panX: number;
    panY: number;
    unitSystem?: 'metric-mm' | 'metric-m' | 'imperial-ft';
}

/**
 * GridRenderer - Uses a performance-optimized pattern-based approach 
 * to render the background grid. This prevents lag by avoiding thousands
 * of individual SVG line elements in the DOM.
 */
export default function GridRenderer({ gridSize, viewportSize, zoom, panX, panY, unitSystem = 'metric-mm' }: GridRendererProps) {
    // Determine major/minor grid line spacing
    // Minor lines = gridSize, Major lines = gridSize * 5
    const majorGridSize = gridSize * 5;

    // Convert grid size for display based on unit system
    const displayText = useMemo(() => {
        if (unitSystem === 'imperial-ft') {
            const feet = gridSize / 304.8; // mm to feet
            const rounded = feet >= 10 ? feet.toFixed(0) : feet.toFixed(1);
            return `${rounded}ft`;
        } else if (unitSystem === 'metric-m') {
            const gridSizeInMeters = gridSize / 1000;
            return `${gridSizeInMeters}m`;
        }
        return `${gridSize}mm`;
    }, [gridSize, unitSystem]);

    // Calculate grid label position (fixed viewport but stays at edge)
    const labelX = (20 - panX) / zoom;
    const labelY = (30 - panY) / zoom;

    return (
        <g className="grid-layer pointer-events-none" style={{ pointerEvents: 'none' }}>
            <defs>
                {/* Minor grid pattern */}
                <pattern
                    id="grid-minor"
                    x="0"
                    y="0"
                    width={gridSize}
                    height={gridSize}
                    patternUnits="userSpaceOnUse"
                >
                    <path
                        d={`M ${gridSize} 0 L 0 0 0 ${gridSize}`}
                        fill="none"
                        stroke="#e2e8f0" // slate-200
                        strokeWidth="1"
                        vectorEffect="non-scaling-stroke"
                    />
                </pattern>
                {/* Major grid pattern */}
                <pattern
                    id="grid-major"
                    x="0"
                    y="0"
                    width={majorGridSize}
                    height={majorGridSize}
                    patternUnits="userSpaceOnUse"
                >
                    <rect width={majorGridSize} height={majorGridSize} fill="url(#grid-minor)" />
                    <path
                        d={`M ${majorGridSize} 0 L 0 0 0 ${majorGridSize}`}
                        fill="none"
                        stroke="#cbd5e1" // slate-300
                        strokeWidth="2"
                        vectorEffect="non-scaling-stroke"
                    />
                </pattern>
            </defs>

            {/* Performant background grid using the patterns defined above */}
            {/* We draw a huge rectangle covers the world or at least a large area around the viewport */}
            <rect
                x={-500000} // Very large area to avoid edges 
                y={-500000}
                width={1000000}
                height={1000000}
                fill="url(#grid-major)"
            />

            {/* Grid size label - positioned relative to viewport but drawn in world space */}
            <g transform={`translate(${labelX}, ${labelY})`}>
                <rect
                    x={-5 / zoom}
                    y={-18 / zoom}
                    width={80 / zoom}
                    height={24 / zoom}
                    fill="rgba(255, 255, 255, 0.85)"
                    rx={4 / zoom}
                />
                <text
                    x={0}
                    y={0}
                    fill="#475569"
                    fontSize={12 / zoom}
                    fontWeight="600"
                    fontFamily="Inter, system-ui, sans-serif"
                >
                    Grid: {displayText}
                </text>
            </g>
        </g>
    );
}