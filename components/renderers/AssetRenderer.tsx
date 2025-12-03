"use client";

import React from 'react';
import { Asset } from '@/store/projectStore';

interface AssetRendererProps {
    asset: Asset;
    isSelected: boolean;
    isHovered: boolean;
}

export default function AssetRenderer({ asset, isSelected, isHovered }: AssetRendererProps) {
    const strokeColor = isSelected ? '#3b82f6' : isHovered ? '#60a5fa' : '#6b7280';

    const transform = `translate(${asset.x}, ${asset.y}) rotate(${asset.rotation}) scale(${asset.scale})`;

    // Simple placeholder rendering - will be enhanced with actual asset library
    return (
        <g transform={transform} style={{ cursor: 'pointer' }}>
            {/* Bounding box */}
            <rect
                x={-asset.width / 2}
                y={-asset.height / 2}
                width={asset.width}
                height={asset.height}
                fill="#f3f4f6"
                stroke={strokeColor}
                strokeWidth={2}
                strokeDasharray={isSelected ? "5,5" : undefined}
            />

            {/* Asset type label */}
            <text
                x={0}
                y={0}
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize={12}
                fill="#374151"
                pointerEvents="none"
            >
                {asset.type}
            </text>
        </g>
    );
}
