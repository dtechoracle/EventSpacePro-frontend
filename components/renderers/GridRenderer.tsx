"use client";

import React from 'react';

interface GridRendererProps {
    gridSize: number;
    viewportSize: { width: number; height: number };
    zoom: number;
    panX: number;
    panY: number;
    unitSystem?: 'metric' | 'imperial';
}

export default function GridRenderer({ gridSize, viewportSize, zoom, panX, panY, unitSystem = 'metric' }: GridRendererProps) {
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
    if (unitSystem === 'imperial') {
        const feet = gridSize / 304.8; // mm to feet
        const rounded = feet >= 10 ? feet.toFixed(0) : feet.toFixed(1);
        displayText = `${rounded}ft`;
    } else {
        const gridSizeInMeters = gridSize / 1000;
        displayText = gridSizeInMeters >= 1
            ? `${gridSizeInMeters}m`
            : `${gridSize}mm`;
    }

    // Calculate position for grid size label (top-left in world coordinates)
    const labelX = worldLeft + 20 / zoom;
    const labelY = worldTop + 30 / zoom;

    return (
        <g className="grid-layer">
            {/* Grid lines with reduced visibility */}
            <g opacity={0.3}>
                {/* Vertical lines */}
                {verticalLines.map((x) => (
                    <line
                        key={`v-${x}`}
                        x1={x}
                        y1={startY}
                        x2={x}
                        y2={endY}
                        stroke="#64748b" // Darker slate color for better visibility
                        strokeWidth={(x % (gridSize * 5) === 0 ? 2 : 1) / zoom}
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
                        stroke="#64748b" // Darker slate color for better visibility
                        strokeWidth={(y % (gridSize * 5) === 0 ? 2 : 1) / zoom}
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
                    stroke="#3b82f6"
                    strokeWidth={1 / zoom}
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
