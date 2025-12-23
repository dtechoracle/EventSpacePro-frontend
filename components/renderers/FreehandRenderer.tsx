import React from 'react';
import { Shape } from '@/store/projectStore';

interface FreehandRendererProps {
    shape: Shape;
    isSelected: boolean;
    isHovered: boolean;
}

export default function FreehandRenderer({ shape, isSelected, isHovered }: FreehandRendererProps) {
    if (shape.type !== 'freehand' || !shape.points || shape.points.length < 2) return null;

    // Construct path data relative to shape center (x, y)
    const pathData = `M ${shape.points[0].x} ${shape.points[0].y} ` +
        shape.points.slice(1).map(p => `L ${p.x} ${p.y}`).join(' ');

    return (
        <g
            transform={`translate(${shape.x}, ${shape.y}) rotate(${shape.rotation})`}
            style={{ pointerEvents: 'all' }}
        >
            {/* Main Path */}
            <path
                d={pathData}
                fill="none"
                // Match pure black, thick defaults used when creating freehand shapes
                stroke={shape.stroke || '#000000'}
                strokeWidth={shape.strokeWidth || 2}
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity={1}
            />

            {/* Selection Box - same style as other shapes */}
            {isSelected && (
                <rect
                    x={-shape.width / 2}
                    y={-shape.height / 2}
                    width={shape.width}
                    height={shape.height}
                    fill="none"
                    stroke="#3b82f6"
                    strokeWidth={2}
                    strokeDasharray="5,5"
                    opacity={0.8}
                />
            )}

            {/* Hover highlight */}
            {isHovered && !isSelected && (
                <rect
                    x={-shape.width / 2}
                    y={-shape.height / 2}
                    width={shape.width}
                    height={shape.height}
                    fill="none"
                    stroke="#3b82f6"
                    strokeWidth={1}
                    opacity={0.5}
                />
            )}
        </g>
    );
}
