"use client";

import React from 'react';
import { LabelArrow } from '@/store/projectStore';

interface LabelArrowRendererProps {
    arrow: LabelArrow;
    zoom: number;
}

export default function LabelArrowRenderer({ arrow, zoom }: LabelArrowRendererProps) {
    const dx = arrow.endPoint.x - arrow.startPoint.x;
    const dy = arrow.endPoint.y - arrow.startPoint.y;
    const len = Math.sqrt(dx * dx + dy * dy);
    const angle = Math.atan2(dy, dx) * (180 / Math.PI);

    // Arrow head
    const arrowHeadSize = ((arrow.strokeWidth || 2) * 5) / zoom;
    const arrowAngle = angle * (Math.PI / 180);
    const arrowX = arrow.endPoint.x - Math.cos(arrowAngle) * arrowHeadSize;
    const arrowY = arrow.endPoint.y - Math.sin(arrowAngle) * arrowHeadSize;
    const perpX = -Math.sin(arrowAngle) * (arrowHeadSize / 2);
    const perpY = Math.cos(arrowAngle) * (arrowHeadSize / 2);

    // Label position (centered on the line, like dimension text)
    const midX = (arrow.startPoint.x + arrow.endPoint.x) / 2;
    const midY = (arrow.startPoint.y + arrow.endPoint.y) / 2;
    // Position text directly on the line at midpoint
    const labelX = midX;
    const labelY = midY;

    // Keep text readable (not upside down) - same logic as dimension
    let textAngle = angle;
    if (textAngle > 90 || textAngle < -90) {
        textAngle += 180;
    }

    return (
        <g>
            {/* Arrow line */}
            <line
                x1={arrow.startPoint.x}
                y1={arrow.startPoint.y}
                x2={arrowX}
                y2={arrowY}
                stroke={arrow.color || '#000000'}
                strokeWidth={arrow.strokeWidth || 2}
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
            />
            {/* Arrow head */}
            <polygon
                points={`${arrow.endPoint.x},${arrow.endPoint.y} ${arrowX + perpX},${arrowY + perpY} ${arrowX - perpX},${arrowY - perpY}`}
                fill={arrow.color || '#000000'}
                stroke={arrow.color || '#000000'}
            />
            {/* Label text with white background for readability (like dimension) */}
            {/* Label text with white background for readability (like dimension) */}
            <g transform={`translate(${labelX}, ${labelY}) scale(${1 / zoom}) rotate(${textAngle})`}>
                <rect
                    x={-(arrow.label.length * 4) - 4}
                    y={-10}
                    width={arrow.label.length * 8 + 8}
                    height={20}
                    fill="#ffffff"
                    rx="4"
                    opacity="0.9"
                    style={{ filter: 'drop-shadow(0px 1px 2px rgba(0,0,0,0.1))' }}
                />
                <text
                    x="0"
                    y="1"
                    fontSize={12}
                    fontWeight="600"
                    fill={arrow.color || '#000000'}
                    dominantBaseline="middle"
                    textAnchor="middle"
                    fontFamily="sans-serif"
                >
                    {arrow.label}
                </text>
            </g>
        </g>
    );
}

