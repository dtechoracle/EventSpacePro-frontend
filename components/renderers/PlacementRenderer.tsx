"use client";

import React, { useMemo } from 'react';
import { useEditorStore } from '@/store/editorStore';
import { ASSET_LIBRARY } from '@/lib/assets';
import ShapeRenderer from './ShapeRenderer';
import AssetRenderer from './AssetRenderer';
import TextAnnotationRenderer from './TextAnnotationRenderer';


export const PlacementRenderer = () => {
    const mouseWorldPos = useEditorStore((s) => s.mouseWorldPos);
    const placementMode = useEditorStore((s) => s.placementMode);

    // Memoize the preview content to avoid recalculating on every mouse move
    const previewContent = useMemo(() => {
        if (!placementMode.active || !placementMode.data) return null;

        const { walls = [], assets = [], shapes = [], textAnnotations = [], width = 1000, height = 1000 } = placementMode.data;

        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        const includePoint = (x: number, y: number) => {
            if (!Number.isFinite(x) || !Number.isFinite(y)) return;
            minX = Math.min(minX, x);
            minY = Math.min(minY, y);
            maxX = Math.max(maxX, x);
            maxY = Math.max(maxY, y);
        };

        const includeRect = (cx: number, cy: number, w: number, h: number) => {
            const halfW = Math.max(1, Math.abs(w) / 2);
            const halfH = Math.max(1, Math.abs(h) / 2);
            includePoint(cx - halfW, cy - halfH);
            includePoint(cx + halfW, cy + halfH);
        };

        const allItems = [...walls, ...assets, ...shapes, ...textAnnotations];
        if (allItems.length === 0) return null;

        allItems.forEach(item => {
            if (item.x !== undefined && item.y !== undefined) {
                if (item.width !== undefined || item.height !== undefined) {
                    const scale = item.scale !== undefined ? item.scale : 1;
                    includeRect(
                        item.x,
                        item.y,
                        (item.width || 0) * scale,
                        (item.height || 0) * scale
                    );
                } else {
                    includePoint(item.x, item.y);
                }
            }

            if (item.nodes) {
                let maxThickness = 0;
                if (Array.isArray(item.edges)) {
                    item.edges.forEach((edge: any) => {
                        maxThickness = Math.max(maxThickness, edge?.thickness || 0);
                    });
                }
                const expand = Math.max(1, maxThickness / 2);
                item.nodes.forEach((n: any) => {
                    includePoint(n.x - expand, n.y - expand);
                    includePoint(n.x + expand, n.y + expand);
                });
            }
        });

        if (!isFinite(minX)) {
            minX = -width / 2;
            maxX = width / 2;
            minY = -height / 2;
            maxY = height / 2;
        }

        const boundsWidth = Math.max(1, maxX - minX);
        const boundsHeight = Math.max(1, maxY - minY);
        const MAX_PREVIEW_SIZE = 2200;
        const contentScale = Math.min(1, Math.min(MAX_PREVIEW_SIZE / boundsWidth, MAX_PREVIEW_SIZE / boundsHeight));
        const centerX = (minX + maxX) / 2;
        const centerY = (minY + maxY) / 2;

        return {
            walls,
            assets,
            shapes,
            textAnnotations,
            scale: contentScale,
            centerX,
            centerY,
            boundsWidth,
            boundsHeight
        };
    }, [placementMode.active, placementMode.data]);

    if (!placementMode.active || !previewContent) return null;

    const { walls, assets, shapes, textAnnotations, scale, centerX, centerY } = previewContent;
    const zoom = useEditorStore((s) => s.zoom);

    const renderPlacementWall = (wall: any) => {
        const nodes = Array.isArray(wall?.nodes) ? wall.nodes : [];
        const edges = Array.isArray(wall?.edges) ? wall.edges : [];
        if (nodes.length === 0 || edges.length === 0) return null;

        const stroke = wall.strokeColor || wall.stroke || '#1e293b';
        const rectLikeXs = Array.from(
            new Set<number>(nodes.map((n: any) => Number(n.x)).filter((v: number) => Number.isFinite(v)))
        );
        const rectLikeYs = Array.from(
            new Set<number>(nodes.map((n: any) => Number(n.y)).filter((v: number) => Number.isFinite(v)))
        );
        const defaultThickness =
            wall.wallThickness ||
            Math.max(0, ...edges.map((edge: any) => Number(edge?.thickness) || 0)) ||
            150;
        const previewThickness = 3;

        const isSimpleEnclosure =
            Boolean(wall?.isClosed) &&
            nodes.length === 4 &&
            edges.length === 4 &&
            rectLikeXs.length === 2 &&
            rectLikeYs.length === 2;

        if (isSimpleEnclosure) {
            const minX = Math.min(...rectLikeXs);
            const maxX = Math.max(...rectLikeXs);
            const minY = Math.min(...rectLikeYs);
            const maxY = Math.max(...rectLikeYs);
            return (
                <rect
                    key={wall.id}
                    x={minX}
                    y={minY}
                    width={maxX - minX}
                    height={maxY - minY}
                    fill="none"
                    stroke={stroke}
                    strokeWidth={previewThickness}
                    strokeLinejoin="miter"
                    vectorEffect="non-scaling-stroke"
                />
            );
        }

        return (
            <g key={wall.id}>
                {edges.map((edge: any, index: number) => {
                    const nodeAId = edge.nodeA !== undefined ? edge.nodeA : edge.a;
                    const nodeBId = edge.nodeB !== undefined ? edge.nodeB : edge.b;
                    const nodeA = typeof nodeAId === 'string' ? nodes.find((n: any) => n.id === nodeAId) : nodes[nodeAId];
                    const nodeB = typeof nodeBId === 'string' ? nodes.find((n: any) => n.id === nodeBId) : nodes[nodeBId];
                    if (!nodeA || !nodeB) return null;

                    return (
                        <line
                            key={`${wall.id}-edge-${index}`}
                            x1={nodeA.x}
                            y1={nodeA.y}
                            x2={nodeB.x}
                            y2={nodeB.y}
                            stroke={stroke}
                            strokeWidth={previewThickness}
                            strokeLinecap="butt"
                            vectorEffect="non-scaling-stroke"
                        />
                    );
                })}
            </g>
        );
    };

    return (
        <g
            transform={`translate(${mouseWorldPos.x}, ${mouseWorldPos.y}) scale(${scale}) translate(${-centerX}, ${-centerY})`}
            style={{ opacity: 0.6, pointerEvents: 'none' }}
        >
            {/* Render Walls */}
            {walls?.map((wall: any) => renderPlacementWall(wall))}

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
