"use client";

import React from 'react';
import { Asset } from '@/store/projectStore';
import { ASSET_LIBRARY } from '@/lib/assets';

interface AssetRendererProps {
    asset: Asset;
    isSelected: boolean;
    isHovered: boolean;
}

export default function AssetRenderer({ asset, isSelected, isHovered }: AssetRendererProps) {
    const strokeColor = isSelected ? '#3b82f6' : isHovered ? '#60a5fa' : '#6b7280';
    const transform = `translate(${asset.x}, ${asset.y}) rotate(${asset.rotation}) scale(${asset.scale})`;

    // Find the definition for this asset type
    const definition = ASSET_LIBRARY.find(item => item.id === asset.type);

    return (
        <g transform={transform} style={{ cursor: 'pointer' }}>
            {/* If we have a definition with a path (SVG URL), use an <image> */}
            {definition?.path && (
                <image
                    href={definition.path}
                    x={-asset.width / 2}
                    y={-asset.height / 2}
                    width={asset.width}
                    height={asset.height}
                    // If you want dragging via the image itself to be easy, 
                    // ensure pointer events are enabled. 
                    // The parent <g> has cursor: pointer.
                />
            )}

            {/* If we have a definition with an icon (React Component), use foreignObject */}
            {definition?.icon && !definition.path && (
                <foreignObject
                    x={-asset.width / 2}
                    y={-asset.height / 2}
                    width={asset.width}
                    height={asset.height}
                >
                    <div className="w-full h-full flex items-center justify-center text-gray-500">
                        {React.createElement(definition.icon, {
                            size: Math.min(asset.width, asset.height) * 0.8, // scale icon relative to box
                        } as any)}
                    </div>
                </foreignObject>
            )}

            {/* Transparent rect for hit-testing only - no visible outline */}
            <rect
                x={-asset.width / 2}
                y={-asset.height / 2}
                width={asset.width}
                height={asset.height}
                fill="transparent" 
                stroke="none"
                pointerEvents="all"
            />
            
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
