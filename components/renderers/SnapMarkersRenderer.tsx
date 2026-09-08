import React, { useMemo } from 'react';
import { useEditorStore } from '@/store/editorStore';
import { useProjectStore } from '@/store/projectStore';
import { findClosestSnapPointFromList, getSnapPoints } from '@/utils/snapToDrawing';
import { ASSET_LIBRARY } from '@/lib/assets';

const marqueeAssetTypes = new Set(
    ASSET_LIBRARY
        .filter((def) => def.category === 'Marquee')
        .map((def) => def.id)
);

const snapDrawingTools = new Set(['wall', 'shape-line', 'shape-arrow', 'dimension', 'arch', 'shape-rectangle', 'shape-ellipse', 'shape-polygon', 'freehand']);

interface SnapMarkersRendererProps {
  dragPreview?: { ids: string[]; dx: number; dy: number } | null;
}

export default function SnapMarkersRenderer({ dragPreview }: SnapMarkersRendererProps) {
    const hoveredId = useEditorStore(s => s.hoveredId);
    const zoom = useEditorStore(s => s.zoom);
    const mouseWorldPos = useEditorStore(s => s.mouseWorldPos);
    const activeTool = useEditorStore(s => s.activeTool);
    const shapes = useProjectStore(s => s.shapes);
    const allAssets = useProjectStore(s => s.assets);
    const walls = useProjectStore(s => s.walls);

    const dragOffset = useMemo(() => {
        if (!dragPreview || dragPreview.ids.length === 0) return null;
        const offsetMap = new Map<string, { dx: number; dy: number }>();
        for (const id of dragPreview.ids) {
            offsetMap.set(id, { dx: dragPreview.dx, dy: dragPreview.dy });
        }
        return offsetMap;
    }, [dragPreview]);

    const offsetPoints = (id: string, pts: ReturnType<typeof getSnapPoints>) => {
        const off = dragOffset?.get(id);
        if (off) return pts.map(p => ({ ...p, x: p.x + off.dx, y: p.y + off.dy }));
        return pts;
    };

    const fallbackCandidates = useMemo<Array<{ id: string; points: ReturnType<typeof getSnapPoints> }>>(() => {
        if (!snapDrawingTools.has(activeTool)) return [];

        const candidates: Array<{ id: string; points: ReturnType<typeof getSnapPoints> }> = [
            ...shapes.map((shape) => ({ id: shape.id, points: offsetPoints(shape.id, getSnapPoints(shape)) })),
            ...walls.map((wall) => ({ id: wall.id, points: offsetPoints(wall.id, getSnapPoints(wall)) })),
            ...allAssets.map((asset) => ({ id: asset.id, points: offsetPoints(asset.id, getSnapPoints(asset)) })),
        ];

        return candidates;
    }, [activeTool, allAssets, shapes, walls, dragOffset]);

    const fallbackSnapTargetId = useMemo<string | null>(() => {
        if (fallbackCandidates.length === 0) {
            return null;
        }

        let bestMatchId: string | null = null;
        let bestDistance = Infinity;

        fallbackCandidates.forEach((candidate) => {
            const closest = findClosestSnapPointFromList(mouseWorldPos, candidate.points, 32 / zoom);
            if (!closest) return;

            const distance = Math.hypot(mouseWorldPos.x - closest.x, mouseWorldPos.y - closest.y);
            if (distance < bestDistance) {
                bestDistance = distance;
                bestMatchId = candidate.id;
            }
        });

        return bestMatchId;
    }, [fallbackCandidates, mouseWorldPos, zoom]);

    const markerSourceId = hoveredId || fallbackSnapTargetId;

    const snapPoints = useMemo(() => {
        if (!markerSourceId) return [];

        const shape = shapes.find(s => s.id === markerSourceId);
        if (shape) return offsetPoints(markerSourceId, getSnapPoints(shape));

        const asset = allAssets.find(a => a.id === markerSourceId);
        if (asset) return offsetPoints(markerSourceId, getSnapPoints(asset));

        const wall = walls.find(w => w.id === markerSourceId);
        if (wall) return offsetPoints(markerSourceId, getSnapPoints(wall));

        return [];
    }, [markerSourceId, shapes, allAssets, walls, dragOffset]);

    const activePoint = useMemo(() => {
        if (!markerSourceId || snapPoints.length === 0) return null;
        return findClosestSnapPointFromList(mouseWorldPos, snapPoints, 20 / zoom);
    }, [markerSourceId, mouseWorldPos, snapPoints, zoom]);

    if (!markerSourceId || snapPoints.length === 0) return null;

    const markerRadius = 8 / zoom;

    return (
        <g pointerEvents="none" className="snap-markers">
            {snapPoints.map((point, index) => (
                <g key={`${point.elementId}-${index}`} transform={`translate(${point.x}, ${point.y})`}>
                    <circle
                        r={markerRadius}
                        fill="#22c55e"
                        opacity={activePoint && activePoint.x === point.x && activePoint.y === point.y ? 1 : 0.8}
                    />
                </g>
            ))}
        </g>
    );
}
