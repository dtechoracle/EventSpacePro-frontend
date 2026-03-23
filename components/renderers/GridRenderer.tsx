"use client";

import React from 'react';

interface GridRendererProps {
    gridSize: number;
    viewportSize: { width: number; height: number };
    zoom: number;
    panX: number;
    panY: number;
    unitSystem?: 'metric-mm' | 'metric-m' | 'imperial-ft';
}

export default function GridRenderer({ gridSize, viewportSize, zoom, panX, panY, unitSystem = 'metric-mm' }: GridRendererProps) {
    // Calculate visible area in world coordinates
    const worldLeft = -panX / zoom;
    const worldTop = -panY / zoom;
    const worldRight = (viewportSize.width - panX) / zoom;
    const worldBottom = (viewportSize.height - panY) / zoom;

    // Snap to grid
    const startX = Math.floor(worldLeft / gridSize) * gridSize;
    const startY = Math.floor(worldTop / gridSize) * gridSize;
    const endX = Math.ceil(worldRight / gridSize) * gridSize;
    const endY = Math.ceil(worldBottom / gridSize) * gridSize;

    // Generate grid lines
    const verticalLines: number[] = [];
    const horizontalLines: number[] = [];

    for (let x = startX; x <= endX; x += gridSize) {
        verticalLines.push(x);
    }

    for (let y = startY; y <= endY; y += gridSize) {
        horizontalLines.push(y);
    }

    // Convert grid size for display based on unit system
    let displayText = '';
    if (unitSystem === 'imperial-ft') {
        const feet = gridSize / 304.8; // mm to feet
        const rounded = feet >= 10 ? feet.toFixed(0) : feet.toFixed(1);
        displayText = `${rounded}ft`;
    } else if (unitSystem === 'metric-m') {
        const gridSizeInMeters = gridSize / 1000;
        displayText = `${gridSizeInMeters}m`;
    } else {
        // metric-mm or fallback
        displayText = `${gridSize}mm`;
    }

    // Calculate position for grid size label (top-left in world coordinates)
    const labelX = worldLeft + 20 / zoom;
    const labelY = worldTop + 30 / zoom;

    return (
        <g className="grid-layer">
            {/* Grid lines with high visibility */}
            <g opacity={0.8}>
                {/* Vertical lines */}
                {verticalLines.map((x) => (
                    <line
                        key={`v-${x}`}
                        x1={x}
                        y1={startY}
                        x2={x}
                        y2={endY}
                        stroke="#cbd5e1" // Subtle slate-300
                        strokeWidth={x % (gridSize * 5) === 0 ? 0.4 : 0.15}
                        vectorEffect="non-scaling-stroke"
                    />
                ))}

                {/* Horizontal lines */}
                {horizontalLines.map((y) => (
                    <line
                        key={`h-${y}`}
                        x1={startX}
                        y1={y}
                        x2={endX}
                        y2={y}
                        stroke="#cbd5e1" // Subtle slate-300
                        strokeWidth={y % (gridSize * 5) === 0 ? 0.4 : 0.15}
                        vectorEffect="non-scaling-stroke"
                    />
                ))}
            </g>

            {/* Grid size label */}
            <g>
                {/* Background for label */}
                <rect
                    x={labelX - 5 / zoom}
                    y={labelY - 20 / zoom}
                    width={80 / zoom}
                    height={25 / zoom}
                    fill="rgba(255, 255, 255, 0.9)"
                    stroke="none"
                    rx={4 / zoom}
                />
                {/* Label text */}
                <text
                    x={labelX}
                    y={labelY}
                    fill="#1e293b"
                    fontSize={14 / zoom}
                    fontWeight="600"
                    fontFamily="system-ui, -apple-system, sans-serif"
                >
                    Grid: {displayText}
                </text>
            </g>
        </g>
    );
}