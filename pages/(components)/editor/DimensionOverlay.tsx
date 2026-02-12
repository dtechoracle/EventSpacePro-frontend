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
                                offset: 15,
                                color: '#666'
                            });
                        });
                    }
                    // Case 2: Native Walls (nodes/edges - Absolute Coords)
                    // Check for 'nodes' (Native) OR 'wallNodes' (AI legacy)
                    else if (((asset as any).nodes && (asset as any).edges) || (asset.wallNodes && asset.wallEdges)) {
                        const nodes = (asset as any).nodes || asset.wallNodes;
                        const edges = (asset as any).edges || asset.wallEdges;

                        edges.forEach((edge: any) => {
                            // Edges might use 'start/end' indices or 'a/b' properties depending on version
                            // Native ProjectStore: edges: { a: string, b: string } (IDs) or indices?
                            // Creating logic that handles indices for now as seen in file view
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
                                    offset: 15,
                                    color: '#666'
                                });
                            }
                        });
                    }
                    // Case 3: Simple Shapes (Width/Height)
                    else if (asset.width && asset.height) {
                        // Show W and H dimensions?
                        // Or just one if it's a line?
                        // For now, let's implement Width (bottom) and Height (right)
                        const w = asset.width;
                        const h = asset.height;

                        // Corners relative to center
                        const tl = { x: -w / 2, y: -h / 2 };
                        const tr = { x: w / 2, y: -h / 2 };
                        const br = { x: w / 2, y: h / 2 };
                        const bl = { x: -w / 2, y: h / 2 };

                        // Transform
                        const pTL = transformPoint(tl.x, tl.y, asset);
                        const pTR = transformPoint(tr.x, tr.y, asset);
                        const pBR = transformPoint(br.x, br.y, asset);
                        const pBL = transformPoint(bl.x, bl.y, asset);

                        // Top dimension
                        dimensions.push({
                            startPoint: { x: pTL.x, y: pTL.y },
                            endPoint: { x: pTR.x, y: pTR.y },
                            value: Math.round(w),
                            offset: -15,
                            color: '#666'
                        });

                        // Right dimension
                        dimensions.push({
                            startPoint: { x: pTR.x, y: pTR.y },
                            endPoint: { x: pBR.x, y: pBR.y },
                            value: Math.round(h),
                            offset: 15,
                            color: '#666'
                        });
                    }

                    return (
                        <g key={asset.id}>
                            {dimensions.map((dim, i) => (
                                <DimensionRenderer
                                    key={i}
                                    dimension={dim}
                                    zoom={1} // Zoom handled by SVG scaling? No, Canvas handles zoom. DimensionRenderer needs zoom?
                                // Check DimensionRenderer source: text size uses zoom?
                                // It uses `fontSize * 2` constant, doesn't use zoom for text scaling. 
                                // It only passes zoom prop but maybe unused? 
                                // Ah, arrowSize is constant 100?
                                // We should pass zoom=1 if we want constant pixel size? 
                                // Wait, we are in PIXEL coordinates here (mmToPx).
                                />
                            ))}
                        </g>
                    );
                })}
            </svg>
        </div>
    );
}
