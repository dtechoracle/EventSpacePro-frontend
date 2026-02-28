"use client";

import React, { useMemo } from 'react';
import { useEditorStore } from '@/store/editorStore';
import { AssetInstance } from '@/store/sceneStore';
import { ASSET_LIBRARY } from '@/lib/assets';
import { InlineSvg } from '@/components/tools/InlineSvg';

interface PlacementRendererProps {
    mouseWorldPos: { x: number; y: number };
}

export const PlacementRenderer = ({ mouseWorldPos }: PlacementRendererProps) => {
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

    const { walls, assets, shapes, scale, centerX, centerY } = previewContent;

    return (
        <g
            transform={`translate(${mouseWorldPos.x}, ${mouseWorldPos.y}) scale(${scale}) translate(${-centerX}, ${-centerY})`}
            style={{ opacity: 0.6, pointerEvents: 'none' }}
        >
            {/* Render Walls */}
            {walls?.map((wall: any) => (
                <g key={wall.id}>
                    {wall.edges?.map((edge: any, i: number) => {
                        const nA = wall.nodes.find((n: any) => n.id === edge.nodeA);
                        const nB = wall.nodes.find((n: any) => n.id === edge.nodeB);
                        if (!nA || !nB) return null;
                        return (
                            <line
                                key={i}
                                x1={nA.x} y1={nA.y}
                                x2={nB.x} y2={nB.y}
                                stroke="#000"
                                strokeWidth={edge.thickness || wall.thickness || 150}
                                strokeLinecap="square"
                                fill="none"
                            />
                        );
                    })}
                </g>
            ))}

            {/* Render Shapes */}
            {shapes?.map((shape: any) => {
                // Normalise field names — AI may return xMm/yMm/widthMm/heightMm
                const sx = shape.x ?? shape.xMm ?? 0;
                const sy = shape.y ?? shape.yMm ?? 0;
                const sw = shape.width ?? shape.widthMm ?? 100;
                const sh = shape.height ?? shape.heightMm ?? sw;
                const fill = shape.fillColor ?? shape.fill ?? '#cccccc';
                const stroke = shape.strokeColor ?? shape.stroke ?? '#000000';
                const strokeW = shape.strokeWidth ?? 2;
                const t = shape.type;
                const isRect = t === 'rectangle' || t === 'rect';
                const isEllipse = t === 'ellipse' || t === 'circle';
                return (
                    <React.Fragment key={shape.id}>
                        {isRect && (
                            <rect
                                x={sx - sw / 2} y={sy - sh / 2}
                                width={sw} height={sh}
                                fill={fill} stroke={stroke} strokeWidth={strokeW}
                            />
                        )}
                        {isEllipse && (
                            <ellipse
                                cx={sx} cy={sy}
                                rx={sw / 2} ry={sh / 2}
                                fill={fill} stroke={stroke} strokeWidth={strokeW}
                            />
                        )}
                        {!isRect && !isEllipse && (
                            // Generic fallback — render as dashed rectangle placeholder
                            <rect
                                x={sx - sw / 2} y={sy - sh / 2}
                                width={sw} height={sh}
                                fill={fill} stroke={stroke} strokeWidth={strokeW}
                                strokeDasharray="8 4"
                            />
                        )}
                    </React.Fragment>
                );
            })}

            {/* Render Assets */}
            {assets?.map((asset: any) => {
                const def = ASSET_LIBRARY.find(a => a.id === asset.type);
                const w = (asset.width || 50) * (asset.scale || 1);
                const h = (asset.height || 50) * (asset.scale || 1);

                return (
                    <g key={asset.id} transform={`translate(${asset.x}, ${asset.y}) rotate(${asset.rotation || 0})`}>
                        <rect x={-w / 2} y={-h / 2} width={w} height={h} fill="none" stroke="#666" strokeDasharray="4 4" />
                        {def?.path && (
                            <foreignObject x={-w / 2} y={-h / 2} width={w} height={h}>
                                <div className="w-full h-full flex items-center justify-center">
                                    <InlineSvg
                                        src={def.path}
                                        fill={asset.fillColor}
                                        stroke={asset.strokeColor}
                                        strokeWidth={asset.strokeWidth}
                                    />
                                </div>
                            </foreignObject>
                        )}
                    </g>
                );
            })}

            {/* Render Text Annotations */}
            {previewContent.textAnnotations?.map((t: any) => (
                <text
                    key={t.id}
                    x={t.x}
                    y={t.y}
                    fontSize={t.fontSize || 16}
                    fill={t.textColor || "#000000"}
                    textAnchor="start"
                    dominantBaseline="middle"
                    style={{ fontFamily: t.fontFamily || "Arial", fontWeight: t.fontWeight || "normal" }}
                    transform={`translate(${t.x}, ${t.y}) rotate(${t.rotation || 0}) translate(${-t.x}, ${-t.y})`}
                >
                    {t.text}
                </text>
            ))}

            {/* Bounds Visualizer (Optional) */}
            {/* <rect x={minX} y={minY} width={maxX-minX} height={maxY-minY} fill="none" stroke="red" /> */}
        </g>
    );
};
