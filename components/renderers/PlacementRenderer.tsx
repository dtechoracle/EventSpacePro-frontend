"use client";

import React, { useMemo } from 'react';
import { useEditorStore } from '@/store/editorStore';
import { ASSET_LIBRARY } from '@/lib/assets';
import WallRenderer from './WallRenderer';
import ShapeRenderer from './ShapeRenderer';
import AssetRenderer from './AssetRenderer';
import TextAnnotationRenderer from './TextAnnotationRenderer';


export const PlacementRenderer = () => {
    const mouseWorldPos = useEditorStore((s) => s.mouseWorldPos);
    const placementMode = useEditorStore((s) => s.placementMode);

    // Memoize the preview content to avoid recalculating on every mouse move
    const previewContent = useMemo(() => {
        if (!placementMode.active || !placementMode.data) return null;

        const { walls, assets, shapes, width = 1000, height = 1000 } = placementMode.data;

        // Calculate scale to fit within a reasonable preview size (e.g., 300px)
        // ONLY if it's larger than that size
        const MAX_PREVIEW_SIZE = 800;
        const contentScale = Math.min(1, Math.min(MAX_PREVIEW_SIZE / width, MAX_PREVIEW_SIZE / height));

        // Calculate the center offset of the plan itself
        // We assume the plan data is centered around (0,0) or we need to find its bounds?
        // The AiTrigger logic suggests we might be generating relative to a center.
        // Let's assume the data passed in is already "centered" relative to a theoretical origin.
        // If not, we SHOULD center it.
        // Let's calculate bounds just in case.
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

        // Check bounds
        // Implementation detail: for now assuming the passed data is roughly centered or we just render it.
        // If we want to center the plan *on the cursor*, we should probably find its center.

        const allItems = [...(walls || []), ...(assets || []), ...(shapes || [])];
        if (allItems.length === 0) return null;

        // Simple bounds check
        allItems.forEach(item => {
            if (item.x !== undefined) {
                minX = Math.min(minX, item.x);
                maxX = Math.max(maxX, item.x);
            }
            if (item.y !== undefined) {
                minY = Math.min(minY, item.y);
                maxY = Math.max(maxY, item.y);
            }
            // Walls have nodes
            if (item.nodes) {
                item.nodes.forEach((n: any) => {
                    minX = Math.min(minX, n.x);
                    minY = Math.min(minY, n.y);
                    maxX = Math.max(maxX, n.x);
                    maxY = Math.max(maxY, n.y);
                });
            }
        });

        if (!isFinite(minX)) { minX = -500; maxX = 500; minY = -500; maxY = 500; }

        const centerX = (minX + maxX) / 2;
        const centerY = (minY + maxY) / 2;

        return {
            walls,
            assets,
            shapes,
            textAnnotations: placementMode.data.textAnnotations || [],
            scale: contentScale,
            centerX,
            centerY
        };
    }, [placementMode.data]);

    if (!placementMode.active || !previewContent) return null;

    const { walls, assets, shapes, textAnnotations, scale, centerX, centerY } = previewContent;
    const zoom = useEditorStore((s) => s.zoom);

    return (
        <g
            transform={`translate(${mouseWorldPos.x}, ${mouseWorldPos.y}) scale(${scale}) translate(${-centerX}, ${-centerY})`}
            style={{ opacity: 0.6, pointerEvents: 'none' }}
        >
            {/* Render Walls */}
            {walls?.map((wall: any) => (
                <WallRenderer
                    key={wall.id}
                    wall={wall}
                    isSelected={false}
                    isHovered={false}
                />
            ))}

            {/* Render Shapes */}
            {shapes?.map((shape: any) => (
                <ShapeRenderer
                    key={shape.id}
                    shape={shape}
                    isSelected={false}
                    isHovered={false}
                />
            ))}

            {/* Render Assets */}
            {assets?.map((asset: any) => (
                <AssetRenderer
                    key={asset.id}
                    asset={asset}
                    isSelected={false}
                    isHovered={false}
                />
            ))}

            {/* Render Text Annotations */}
            {textAnnotations?.map((t: any) => (
                <TextAnnotationRenderer
                    key={t.id}
                    annotation={t}
                    zoom={zoom}
                />
            ))}

            {/* Bounds Visualizer (Optional) */}
            {/* <rect x={minX} y={minY} width={maxX-minX} height={maxY-minY} fill="none" stroke="red" /> */}
        </g>
    );
};
