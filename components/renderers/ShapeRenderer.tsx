"use client";

import React from 'react';
import { Shape } from '@/store/projectStore';

interface ShapeRendererProps {
    shape: Shape;
    isSelected: boolean;
    isHovered: boolean;
}

export default function ShapeRenderer({ shape, isSelected, isHovered }: ShapeRendererProps) {
    // Default pure black stroke so new shapes/lines pop clearly
    const strokeColor = shape.stroke || '#000000';
    const fillColor = shape.fill || 'transparent';
    // Ensure strokeWidth is always a valid number, defaulting to 4 if undefined/null/0
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

        if (shape.type === 'polygon') {
            // Use provided points or generate a regular polygon
            let pts: { x: number; y: number }[] = [];
            if (shape.points && shape.points.length >= 3) {
                pts = shape.points;
            } else {
                const sides = Math.max(3, shape.polygonSides || 4);
                const radius = Math.min(shape.width, shape.height) / 2;
                for (let i = 0; i < sides; i++) {
                    const angle = ((Math.PI * 2) / sides) * i - Math.PI / 2;
                    pts.push({
                        x: Math.cos(angle) * radius,
                        y: Math.sin(angle) * radius,
                    });
                }
            }
            const pointsStr = pts.map(p => `${p.x},${p.y}`).join(' ');
            return (
                <polygon
                    points={pointsStr}
                    {...commonProps}
                />
            );
        }

        if (shape.type === 'line') {
            // If this line has explicit polyline points, render them so slanted / multi‑segment lines keep their shape.
            if (shape.points && shape.points.length >= 2) {
                const points = shape.points.map(p => `${p.x},${p.y}`).join(' ');
                return (
                    <polyline
                        points={points}
                        fill="none"
                        stroke={commonProps.stroke}
                        strokeWidth={commonProps.strokeWidth}
                        opacity={commonProps.opacity}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    />
                );
            }

            // Fallback: legacy straight line using width / rotation.
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
            const renderArrowHead = (from: {x:number;y:number}, to: {x:number;y:number}, stroke: string, strokeWidth: number, opacity: number) => {
                const dx = to.x - from.x;
                const dy = to.y - from.y;
                const len = Math.sqrt(dx*dx + dy*dy) || 1;
                const ux = dx / len;
                const uy = dy / len;
                // Larger, more prominent arrow head scaled by stroke width
                const baseSize = strokeWidth || 1;
                const size = Math.min(len / 2, baseSize * 3);
                const backX = to.x - ux * size;
                const backY = to.y - uy * size;
                const perpX = -uy * (size / 2);
                const perpY = ux * (size / 2);
                const p1 = `${to.x},${to.y}`;
                const p2 = `${backX + perpX},${backY + perpY}`;
                const p3 = `${backX - perpX},${backY - perpY}`;
                return (
                    <polygon
                        points={`${p1} ${p2} ${p3}`}
                        fill={stroke}
                        stroke={stroke}
                        strokeWidth={strokeWidth}
                        opacity={opacity}
                    />
                );
            };

            // If polyline points exist, render polyline plus arrow head at the end
            if (shape.points && shape.points.length >= 2) {
                const pts = shape.points;
                const polyPoints = pts.map(p => `${p.x},${p.y}`).join(' ');
                const last = pts[pts.length - 1];
                const prev = pts[pts.length - 2];
                return (
                    <g>
                        <polyline
                            points={polyPoints}
                            fill="none"
                            stroke={commonProps.stroke}
                            strokeWidth={commonProps.strokeWidth}
                            opacity={commonProps.opacity}
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        />
                        {renderArrowHead(prev, last, commonProps.stroke as string, commonProps.strokeWidth as number, commonProps.opacity as number)}
                    </g>
                );
            }

            // Legacy straight arrow
            const arrowHeadSize = Math.min(shape.width / 2, (strokeWidth as number) * 3);
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
