"use client";

import React from "react";
import { useSceneStore, AssetInstance } from "@/store/sceneStore";
import { DimensionRenderer } from "@/components/renderers/DimensionRenderer";

export default function DimensionOverlay({ mmToPx }: { mmToPx: number }) {
    const assets = useSceneStore((s) => s.assets);

    // Helper to transform local point to world point
    const transformPoint = (x: number, y: number, asset: AssetInstance) => {
        // If native wall with nodes, points are already world (often). 
        // BUT checking sceneStore logic, native walls (wallNodes) seem to store absolute coords?
        // Let's check: "const nodes: { x: number; y: number }[]". 
        // In WallRendering, it does: "start: { x: a.x - asset.x, y: a.y - asset.y }" -> Local.
        // So wallNodes are ABSOLUTE.
        // wallSegments are RELATIVE.

        // We need to handle both.
        // For rotation: native walls usually have rotation=0?
        // Let's assume general case.

        const rad = (asset.rotation || 0) * Math.PI / 180;
        const cos = Math.cos(rad);
        const sin = Math.sin(rad);

        const rx = x * cos - y * sin;
        const ry = x * sin + y * cos;

        return { x: rx + asset.x, y: ry + asset.y };
    };

    return (
        <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 1000, overflow: "visible" }}>
            <svg className="w-full h-full overflow-visible">
                {assets.map((asset) => {
                    // Show dimensions for all elements by default
                    const dimensions: any[] = [];

                    // Case 1: Wall Segments (Manual Walls - Relative Coords)
                    // Prioritize if wallSegments exist and have length
                    if ((asset.type === 'wall-segments' || (asset as any).wallSegments) && (asset as any).wallSegments?.length > 0) {
                        const segments = (asset as any).wallSegments || [];
                        segments.forEach((seg: any) => {
                            const start = transformPoint(seg.start.x, seg.start.y, asset);
                            const end = transformPoint(seg.end.x, seg.end.y, asset);

                            const dx = end.x - start.x;
                            const dy = end.y - start.y;
                            const len = Math.hypot(dx, dy);

                            dimensions.push({
                                startPoint: { x: start.x, y: start.y },
                                endPoint: { x: end.x, y: end.y },
                                value: Math.round(len),
                                labelPosition: (asset as any).dimensionLabelPosition || 'top-right',
                                color: '#666'
                            });
                        });
                    }
                    // Case 2: Native Walls (nodes/edges - Absolute Coords)
                    else if (((asset as any).nodes && (asset as any).edges) || (asset.wallNodes && asset.wallEdges)) {
                        const nodes = (asset as any).nodes || asset.wallNodes;
                        const edges = (asset as any).edges || asset.wallEdges;

                        edges.forEach((edge: any) => {
                            const n1 = nodes[edge.a || edge.start || 0];
                            const n2 = nodes[edge.b || edge.end || 1];

                            if (n1 && n2) {
                                const start = { x: n1.x, y: n1.y };
                                const end = { x: n2.x, y: n2.y };
                                const len = Math.hypot(end.x - start.x, end.y - start.y);

                                dimensions.push({
                                    startPoint: { x: start.x, y: start.y },
                                    endPoint: { x: end.x, y: end.y },
                                    value: Math.round(len),
                                    labelPosition: (asset as any).dimensionLabelPosition || 'top-right',
                                    color: '#666'
                                });
                            }
                        });
                    }
                    // Case 3: Simple Shapes (Width/Height)
                    else if (asset.width && asset.height) {
                        const w = asset.width;
                        const h = asset.height;
                        const labelPos = (asset as any).dimensionLabelPosition || 'top-right';

                        // Corners relative to center
                        const tl = { x: -w / 2, y: -h / 2 };
                        const tr = { x: w / 2, y: -h / 2 };
                        const br = { x: w / 2, y: h / 2 };
                        const bl = { x: -w / 2, y: h / 2 };

                        if (labelPos === 'bottom-left') {
                            // Bottom dimension
                            const pBL = transformPoint(bl.x, bl.y, asset);
                            const pBR = transformPoint(br.x, br.y, asset);
                            dimensions.push({
                                startPoint: { x: pBL.x, y: pBL.y },
                                endPoint: { x: pBR.x, y: pBR.y },
                                value: Math.round(w),
                                labelPosition: 'bottom-left',
                                color: '#666'
                            });

                            // Left dimension
                            const pTL = transformPoint(tl.x, tl.y, asset);
                            const pBL_left = transformPoint(bl.x, bl.y, asset);
                            dimensions.push({
                                startPoint: { x: pTL.x, y: pTL.y },
                                endPoint: { x: pBL_left.x, y: pBL_left.y },
                                value: Math.round(h),
                                labelPosition: 'bottom-left',
                                color: '#666'
                            });
                        } else {
                            // Top dimension
                            const pTL = transformPoint(tl.x, tl.y, asset);
                            const pTR = transformPoint(tr.x, tr.y, asset);
                            dimensions.push({
                                startPoint: { x: pTL.x, y: pTL.y },
                                endPoint: { x: pTR.x, y: pTR.y },
                                value: Math.round(w),
                                labelPosition: 'top-right',
                                color: '#666'
                            });

                            // Right dimension
                            const pTR_right = transformPoint(tr.x, tr.y, asset);
                            const pBR = transformPoint(br.x, br.y, asset);
                            dimensions.push({
                                startPoint: { x: pTR_right.x, y: pTR_right.y },
                                endPoint: { x: pBR.x, y: pBR.y },
                                value: Math.round(h),
                                labelPosition: 'top-right',
                                color: '#666'
                            });
                        }
                    }

                    return (
                        <g key={asset.id}>
                            {dimensions.map((dim, i) => (
                                <DimensionRenderer
                                    key={i}
                                    dimension={{
                                        ...dim,
                                        labelPosition: (asset as any).dimensionLabelPosition
                                    } as any}
                                    zoom={1}
                                />
                            ))}
                        </g>
                    );
                })}
            </svg>
        </div>
    );
}
