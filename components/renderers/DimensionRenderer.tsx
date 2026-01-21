import React from 'react';
import { Dimension } from '@/store/projectStore';

interface DimensionRendererProps {
    dimension: Dimension;
    zoom: number;
}

export const DimensionRenderer: React.FC<DimensionRendererProps> = ({ dimension, zoom }) => {
    const { startPoint, endPoint, offset, value, strokeWidth = 10, color = '#000000', fontSize = 18 } = dimension;

    // Calculate vector from start to end
    const dx = endPoint.x - startPoint.x;
    const dy = endPoint.y - startPoint.y;
    const length = Math.sqrt(dx * dx + dy * dy);

    if (length === 0) return null;

    // Normalized direction vector
    const nx = dx / length;
    const ny = dy / length;

    // Perpendicular vector (rotated 90 degrees)
    // We want the offset to be applied in the direction of the offset value
    // If offset is positive, it goes one way; negative, the other.
    // Standard rotation (-y, x) for 90 degrees counter-clockwise
    const px = -ny;
    const py = nx;

    // Calculate offset points for the dimension line
    const p1x = startPoint.x + px * offset;
    const p1y = startPoint.y + py * offset;
    const p2x = endPoint.x + px * offset;
    const p2y = endPoint.y + py * offset;

    // Calculate text position (midpoint of dimension line)
    const midX = (p1x + p2x) / 2;
    const midY = (p1y + p2y) / 2;

    // Calculate rotation angle for text
    let angle = Math.atan2(dy, dx) * (180 / Math.PI);
    // Keep text readable (not upside down)
    if (angle > 90 || angle < -90) {
        angle += 180;
    }

    // Display value
    const displayValue = value !== undefined ? value : Math.round(length);
    const text = `${displayValue} mm`;

    // Arrow size scaled by zoom (inverse scale to keep constant visual size)
    // Actually, in SVG world space, we want it to look consistent relative to the drawing?
    // Or consistent relative to the screen?
    // Usually dimensions scale with the drawing, but text size might need to be readable.
    // For now, let's make it fixed in world units or slightly adaptive.
    const arrowSize = 100; // 100mm arrow size? Might be too big/small depending on scale.
    // Let's assume 1 unit = 1mm. 100mm is 10cm.

    // Extension line overshoot
    const overshoot = 50;

    // Convert fontSize to world units (fontSize is in points, we scale it)
    const worldFontSize = fontSize * 2; // Approximate conversion

    return (
        <g className="dimension-group" style={{ pointerEvents: 'all', cursor: 'pointer' }}>
            {/* Extension Lines */}
            <line
                x1={startPoint.x}
                y1={startPoint.y}
                x2={p1x + px * overshoot}
                y2={p1y + py * overshoot}
                stroke={color}
                strokeWidth={strokeWidth * 0.5}
                opacity={0.5}
            />
            <line
                x1={endPoint.x}
                y1={endPoint.y}
                x2={p2x + px * overshoot}
                y2={p2y + py * overshoot}
                stroke={color}
                strokeWidth={strokeWidth * 0.5}
                opacity={0.5}
            />

            {/* Main Dimension Line */}
            <line
                x1={p1x}
                y1={p1y}
                x2={p2x}
                y2={p2y}
                stroke={color}
                strokeWidth={strokeWidth}
            />

            {/* Arrows / Ticks */}
            {/* Start Arrow */}
            <path
                d={`M ${p1x} ${p1y} L ${p1x + nx * arrowSize + px * (arrowSize * 0.3)} ${p1y + ny * arrowSize + py * (arrowSize * 0.3)} M ${p1x} ${p1y} L ${p1x + nx * arrowSize - px * (arrowSize * 0.3)} ${p1y + ny * arrowSize - py * (arrowSize * 0.3)}`}
                stroke={color}
                strokeWidth={strokeWidth}
                fill="none"
            />
            {/* End Arrow */}
            <path
                d={`M ${p2x} ${p2y} L ${p2x - nx * arrowSize + px * (arrowSize * 0.3)} ${p2y - ny * arrowSize + py * (arrowSize * 0.3)} M ${p2x} ${p2y} L ${p2x - nx * arrowSize - px * (arrowSize * 0.3)} ${p2y - ny * arrowSize - py * (arrowSize * 0.3)}`}
                stroke={color}
                strokeWidth={strokeWidth}
                fill="none"
            />

            {/* Text Label */}
            {/* We use a white background rect for readability */}
            <g transform={`translate(${midX}, ${midY}) rotate(${angle})`}>
                <rect
                    x="-40"
                    y="-15"
                    width="80"
                    height="30"
                    fill="white"
                    opacity="0.8"
                />
                <text
                    x="0"
                    y="0"
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fontSize={worldFontSize}
                    fill={color}
                    fontFamily="sans-serif"
                >
                    {text}
                </text>
            </g>
        </g>
    );
};

