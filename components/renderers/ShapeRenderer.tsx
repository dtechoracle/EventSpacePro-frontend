"use client";

import React from 'react';
import { Shape } from '@/store/projectStore';

interface ShapeRendererProps {
    shape: Shape;
    isSelected: boolean;
    isHovered: boolean;
}

export default function ShapeRenderer({ shape, isSelected, isHovered }: ShapeRendererProps) {
    const strokeColor = shape.stroke || '#1f2937';
    const fillColor = shape.fill || 'transparent';
    // Ensure strokeWidth is always a valid number, defaulting to 2 if undefined/null/0
    const strokeWidth = (shape.strokeWidth !== undefined && shape.strokeWidth !== null && shape.strokeWidth > 0) 
        ? shape.strokeWidth 
        : 2;

    const transform = `translate(${shape.x}, ${shape.y}) rotate(${shape.rotation})`;

    // Selection/Hover highlight color
    const highlightColor = isSelected ? '#3b82f6' : '#60a5fa';
    const showHighlight = isSelected || isHovered;

    const renderShape = (isHighlight: boolean) => {
        const commonProps = {
            fill: isHighlight ? 'transparent' : fillColor,
            stroke: isHighlight ? highlightColor : strokeColor,
            strokeWidth: isHighlight ? strokeWidth + 4 : strokeWidth,
            opacity: isHighlight ? 0.5 : 1,
        };

        if (shape.type === 'rectangle') {
            return (
                <rect
                    x={-shape.width / 2}
                    y={-shape.height / 2}
                    width={shape.width}
                    height={shape.height}
                    {...commonProps}
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
                    {...commonProps}
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
                    {...commonProps}
                />
            );
        }

        if (shape.type === 'arrow') {
            const arrowHeadSize = Math.min(shape.width / 4, 20);
            return (
                <g>
                    <line
                        x1={-shape.width / 2}
                        y1={0}
                        x2={shape.width / 2 - arrowHeadSize}
                        y2={0}
                        stroke={commonProps.stroke}
                        strokeWidth={commonProps.strokeWidth}
                        opacity={commonProps.opacity}
                    />
                    <polygon
                        points={`${shape.width / 2},0 ${shape.width / 2 - arrowHeadSize},${-arrowHeadSize / 2} ${shape.width / 2 - arrowHeadSize},${arrowHeadSize / 2}`}
                        fill={commonProps.stroke}
                        stroke={commonProps.stroke}
                        strokeWidth={commonProps.strokeWidth}
                        opacity={commonProps.opacity}
                    />
                </g>
            );
        }

        return null;
    };

    return (
        <g transform={transform} style={{ cursor: 'pointer' }}>
            {/* Render highlight behind the shape */}
            {showHighlight && renderShape(true)}
            {/* Render actual shape */}
            {renderShape(false)}
        </g>
    );
}
