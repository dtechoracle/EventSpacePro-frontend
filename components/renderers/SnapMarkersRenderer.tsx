import React, { useMemo } from 'react';
import { useEditorStore } from '@/store/editorStore';
import { useProjectStore } from '@/store/projectStore';
import { findClosestSnapPointFromList, getSnapPoints } from '@/utils/snapToDrawing';
import { ASSET_LIBRARY } from '@/lib/assets';

export default function SnapMarkersRenderer() {
    const { hoveredId, zoom, mouseWorldPos, activeTool } = useEditorStore();
    const { shapes, assets, walls } = useProjectStore();

    const fallbackSnapTargetId = useMemo<string | null>(() => {
        if (!(activeTool === 'wall' || activeTool === 'shape-line' || activeTool === 'shape-arrow' || activeTool === 'dimension' || activeTool === 'arch')) {
            return null;
        }

        const marqueeCandidates: Array<{ id: string; points: ReturnType<typeof getSnapPoints> }> = assets
            .flatMap((asset) => {
                const assetDef = ASSET_LIBRARY.find((def) => def.id === asset.type);
                return assetDef?.category === 'Marquee'
                    ? [{ id: asset.id, points: getSnapPoints(asset) }]
                    : [];
            });

        const candidates: Array<{ id: string; points: ReturnType<typeof getSnapPoints> }> = [
            ...shapes.map((shape) => ({ id: shape.id, points: getSnapPoints(shape) })),
            ...walls.map((wall) => ({ id: wall.id, points: getSnapPoints(wall) })),
            ...marqueeCandidates,
        ];

        let bestMatchId: string | null = null;
        let bestDistance = Infinity;

        candidates.forEach((candidate) => {
            const closest = findClosestSnapPointFromList(mouseWorldPos, candidate.points, 32 / zoom);
            if (!closest) return;

            const distance = Math.hypot(mouseWorldPos.x - closest.x, mouseWorldPos.y - closest.y);
            if (distance < bestDistance) {
                bestDistance = distance;
                bestMatchId = candidate.id;
            }
        });

        return bestMatchId;
    }, [activeTool, assets, mouseWorldPos, shapes, walls, zoom]);

    const markerSourceId = hoveredId || fallbackSnapTargetId;

    const snapPoints = useMemo(() => {
        if (!markerSourceId) return [];

        const shape = shapes.find(s => s.id === markerSourceId);
        if (shape) return getSnapPoints(shape);

        const asset = assets.find(a => a.id === markerSourceId);
        if (asset) {
            const assetDef = ASSET_LIBRARY.find((def) => def.id === asset.type);
            return assetDef?.category === 'Marquee' ? getSnapPoints(asset) : [];
        }

        const wall = walls.find(w => w.id === markerSourceId);
        if (wall) return getSnapPoints(wall);

        return [];
    }, [markerSourceId, shapes, assets, walls]);

    const activePoint = useMemo(() => {
        if (!markerSourceId || snapPoints.length === 0) return null;
        return findClosestSnapPointFromList(mouseWorldPos, snapPoints, 20 / zoom);
    }, [markerSourceId, mouseWorldPos, snapPoints, zoom]);

    if (!markerSourceId || snapPoints.length === 0) return null;

    // Scale markers based on zoom
    const markerRadius = 3.5 / zoom;
    const strokeWidth = 1 / zoom;

    return (
        <g pointerEvents="none" className="snap-markers">
            {/* Highlight the hovered element with a subtle outline */}
            {/* This depends on getting the shape/asset geometry which might be complex to re-calculate here. 
                Let's stick to just points for now. */}

            {snapPoints.map((point, index) => (
                <g key={`${point.elementId}-${index}`} transform={`translate(${point.x}, ${point.y})`}>
                    {activePoint && activePoint.x === point.x && activePoint.y === point.y && (
                        <circle
                            r={markerRadius * 1.9}
                            fill="none"
                            stroke="#ffffff"
                            strokeWidth={strokeWidth * 1.5}
                            opacity={0.95}
                        />
                    )}
                    <circle
                        r={markerRadius}
                        fill="#22c55e" // Green
                        opacity={activePoint && activePoint.x === point.x && activePoint.y === point.y ? 1 : 0.8}
                    />
                </g>
            ))}
        </g>
    );
}
