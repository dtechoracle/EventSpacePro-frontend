"use client";

import React from 'react';
import { Asset } from '@/store/projectStore';
import { ASSET_LIBRARY } from '@/lib/assets';

interface AssetRendererProps {
    asset: Asset;
    isSelected: boolean;
    isHovered: boolean;
}

export default function AssetRenderer({ asset }: AssetRendererProps) {
    const transform = `translate(${asset.x}, ${asset.y}) rotate(${asset.rotation}) scale(${asset.scale})`;

    // Find the definition for this asset type
    const definition = ASSET_LIBRARY.find(item => item.id === asset.type);

    return (
        <g transform={transform} style={{ cursor: 'pointer' }}>
            {/* Render the SVG image as-is */}
            {definition?.path && (
                <image
                    href={definition.path}
                    x={-asset.width / 2}
                    y={-asset.height / 2}
                    width={asset.width}
                    height={asset.height}
                    style={{ outline: 'none' }}
                />
            )}

            {/* Invisible rect for hit-testing only (no visual outline) */}
            <rect
                x={-asset.width / 2}
                y={-asset.height / 2}
                width={asset.width}
                height={asset.height}
                fill="transparent"
                stroke="none"
                pointerEvents="all"
            />

            {/* Fallback label when definition is missing */}
            {!definition && (
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
            )}
        </g>
    );
}
