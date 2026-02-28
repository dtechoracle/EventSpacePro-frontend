import React, { useMemo } from 'react';
import { useEditorStore } from '@/store/editorStore';
import { useProjectStore } from '@/store/projectStore';
import { getSnapPoints, SnapPoint } from '@/utils/snapToDrawing';

export default function SnapMarkersRenderer() {
    const { hoveredId, zoom } = useEditorStore();
    const { shapes, assets, walls } = useProjectStore();

    const snapPoints = useMemo(() => {
        if (!hoveredId) return [];

        const shape = shapes.find(s => s.id === hoveredId);
        if (shape) return getSnapPoints(shape);

        const asset = assets.find(a => a.id === hoveredId);
        if (asset) return getSnapPoints(asset);

        const wall = walls.find(w => w.id === hoveredId);
        if (wall) return getSnapPoints(wall);

        return [];
    }, [hoveredId, shapes, assets, walls]);

    // Find the closest point to cursor for highlighting
    const activePoint = useMemo(() => {
        if (!hoveredId || snapPoints.length === 0) return null;

        // We need cursor position here, but we don't have it in props.
        // We can get it from EditorStore if we track it, or we rely on 'snapIndicator' from the tools?
        // Actually, the TOOLS (`ShapeTool`, `WallTool`) determine the *active* snap point.
        // This renderer just shows *potential* snap points.

        // However, we want to hide the others or highlight the active one?
        // The implementation plan says: "Render distinct indicator for the *active* snap target".
        // The active target is usually effectively shown by the Tool's own preview (e.g. the line sticking to it).
        // But let's check if we can get the `snapSourceId` or similar from store?
        // EditorStore has `hoveredId`.  Let's keep this simple:
        // Green dots = "Here are places you CAN snap".
        // The Tool itself draws the "I AM snapping here" indicator (usually).

        return null;
    }, [hoveredId, snapPoints]);

    if (!hoveredId || snapPoints.length === 0) return null;

    // Scale markers based on zoom
    const markerRadius = 5 / zoom;
    const strokeWidth = 1.5 / zoom;

    return (
        <g pointerEvents="none" className="snap-markers">
            {/* Highlight the hovered element with a subtle outline */}
            {/* This depends on getting the shape/asset geometry which might be complex to re-calculate here. 
                Let's stick to just points for now. */}

            {snapPoints.map((point, index) => (
                <g key={`${point.elementId}-${index}`} transform={`translate(${point.x}, ${point.y})`}>
                    <circle
                        r={markerRadius}
                        fill="#22c55e" // Green
                        stroke="#ffffff"
                        strokeWidth={strokeWidth}
                        opacity={0.8}
                    />
                </g>
            ))}
        </g>
    );
}
