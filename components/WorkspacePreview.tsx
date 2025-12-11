"use client";

import React, { useEffect, useRef } from 'react';
import { Wall, Shape, Asset } from '@/store/projectStore';
import WallRenderer from '@/components/renderers/WallRenderer';
import ShapeRenderer from '@/components/renderers/ShapeRenderer';
import AssetRenderer from '@/components/renderers/AssetRenderer';
import { fitWorkspaceToContainer } from '@/utils/workspaceBounds';

interface WorkspacePreviewProps {
    walls: Wall[];
    shapes: Shape[];
    assets: Asset[];
    width?: number;
    height?: number;
    backgroundColor?: string;
}

/**
 * Renders a cropped preview of workspace items fitted to the container
 * Perfect for dashboard thumbnails
 */
export default function WorkspacePreview({
    walls = [],
    shapes = [],
    assets = [],
    width = 400,
    height = 300,
    backgroundColor = '#f5f5f5'
}: WorkspacePreviewProps) {
    const containerRef = useRef<HTMLDivElement>(null);

    // Calculate optimal viewport to fit all items
    const { zoom, panX, panY } = fitWorkspaceToContainer(
        walls,
        shapes,
        assets,
        width,
        height,
        30 // padding
    );

    return (
        <div
            ref={containerRef}
            style={{
                width: `${width}px`,
                height: `${height}px`,
                backgroundColor,
                position: 'relative',
                overflow: 'hidden',
                borderRadius: '8px',
                border: '1px solid #e5e5e5',
            }}
        >
            {/* Transformed container */}
            <div
                style={{
                    transform: `translate(${panX}px, ${panY}px) scale(${zoom})`,
                    transformOrigin: '0 0',
                    position: 'absolute',
                    top: 0,
                    left: 0,
                }}
            >
                {/* Render walls */}
                {walls.map((wall) => (
                    <WallRenderer
                        key={wall.id}
                        wall={wall}
                        isSelected={false}
                        isHovered={false}
                    />
                ))}

                {/* Render shapes */}
                {shapes.map((shape) => (
                    <ShapeRenderer
                        key={shape.id}
                        shape={shape}
                        isSelected={false}
                        isHovered={false}
                        zoom={zoom}
                    />
                ))}

                {/* Render assets */}
                {assets.map((asset) => (
                    <AssetRenderer
                        key={asset.id}
                        asset={asset}
                        isSelected={false}
                        isHovered={false}
                        zoom={zoom}
                    />
                ))}
            </div>

            {/* Empty state */}
            {walls.length === 0 && shapes.length === 0 && assets.length === 0 && (
                <div
                    style={{
                        position: 'absolute',
                        top: '50%',
                        left: '50%',
                        transform: 'translate(-50%, -50%)',
                        color: '#999',
                        fontSize: '14px',
                        textAlign: 'center',
                    }}
                >
                    Empty workspace
                </div>
            )}
        </div>
    );
}
