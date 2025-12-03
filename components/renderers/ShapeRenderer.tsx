"use client";

import React from 'react';
import { Shape } from '@/store/projectStore';

interface ShapeRendererProps {
    shape: Shape;
    isSelected: boolean;
    isHovered: boolean;
}

export default function ShapeRenderer({ shape, isSelected, isHovered }: ShapeRendererProps) {
    const strokeColor = isSelected ? '#3b82f6' : isHovered ? '#60a5fa' : shape.stroke || '#1f2937';
    const fillColor = shape.fill || 'transparent';
    const strokeWidth = shape.strokeWidth || 2;

    const transform = `translate(${shape.x}, ${shape.y}) rotate(${shape.rotation})`;

    if (shape.type === 'rectangle') {
        return (
            <rect
                x={-shape.width / 2}
                y={-shape.height / 2}
                width={shape.width}
                height={shape.height}
                fill={fillColor}
                stroke={strokeColor}
                strokeWidth={strokeWidth}
                transform={transform}
                style={{ cursor: 'pointer' }}
            />
        );
    }

    if (shape.type === 'ellipse') {
        return (
            <ellipse
                cx={0}
                cy={0}
                rx={shape.width / 2}
                ry={shape.height / 2}
                fill={fillColor}
                stroke={strokeColor}
                strokeWidth={strokeWidth}
                transform={transform}
                style={{ cursor: 'pointer' }}
            />
        );
    }

    if (shape.type === 'line') {
        return (
            <line
                x1={-shape.width / 2}
                y1={0}
                x2={shape.width / 2}
                y2={0}
                stroke={strokeColor}
                strokeWidth={strokeWidth}
                transform={transform}
                style={{ cursor: 'pointer' }}
            />
        );
    }

    if (shape.type === 'arrow') {
        // Draw an arrow from left to right
        const arrowHeadSize = Math.min(shape.width / 4, 20);
        return (
            <g transform={transform} style={{ cursor: 'pointer' }}>
                {/* Arrow line */}
                <line
                    x1={-shape.width / 2}
                    y1={0}
                    x2={shape.width / 2 - arrowHeadSize}
                    y2={0}
                    stroke={strokeColor}
                    strokeWidth={strokeWidth}
                />
                {/* Arrow head */}
                <polygon
                    points={`${shape.width / 2},0 ${shape.width / 2 - arrowHeadSize},${-arrowHeadSize / 2} ${shape.width / 2 - arrowHeadSize},${arrowHeadSize / 2}`}
                    fill={strokeColor}
                    stroke={strokeColor}
                    strokeWidth={strokeWidth}
                />
            </g>
        );
    }

    return null;
}
