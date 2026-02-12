import React from 'react';
import { useProjectStore, Wall, Shape, Asset, Dimension } from '@/store/projectStore';
import { DimensionRenderer } from './DimensionRenderer';

interface AutoDimensionRendererProps {
    walls: Wall[];
    shapes: Shape[];
    assets: Asset[];
    zoom: number;
}

export const AutoDimensionRenderer: React.FC<AutoDimensionRendererProps> = ({ walls, shapes, assets, zoom }) => {
    const dimensionsToRender: Dimension[] = [];
    const OFFSET = -150; // Inverted to show "outside" based on coordinate system

    // Helper to transform local point to world point
    const transformPoint = (x: number, y: number, center: { x: number, y: number }, rotation: number) => {
        const rad = (rotation || 0) * Math.PI / 180;
        const cos = Math.cos(rad);
        const sin = Math.sin(rad);

        const rx = x * cos - y * sin;
        const ry = x * sin + y * cos;

        return { x: rx + center.x, y: ry + center.y };
    };

    // 1. Process Walls
    walls.forEach(wall => {
        if ((wall as any).showDimensions) {
            wall.edges.forEach(edge => {
                const n1 = wall.nodes.find(n => n.id === edge.nodeA);
                const n2 = wall.nodes.find(n => n.id === edge.nodeB);

                if (n1 && n2) {
                    const len = Math.hypot(n2.x - n1.x, n2.y - n1.y);
                    dimensionsToRender.push({
                        id: `auto-dim-${edge.id}`,
                        startPoint: { x: n1.x, y: n1.y },
                        endPoint: { x: n2.x, y: n2.y },
                        value: Math.round(len),
                        offset: OFFSET,
                        color: '#666666',
                        type: 'linear',
                        fontSize: 48,
                        zIndex: 100
                    });
                }
            });
        }
    });

    // 2. Process Shapes
    shapes.forEach(shape => {
        if ((shape as any).showDimensions && shape.type !== 'line' && shape.type !== 'arrow') {
            const w = shape.width;
            const h = shape.height;

            // Local corners relative to center
            const tl = { x: -w / 2, y: -h / 2 };
            const tr = { x: w / 2, y: -h / 2 };
            const br = { x: w / 2, y: h / 2 };
            // const bl = { x: -w / 2, y: h / 2 };

            // Transform to world space
            const pTL = transformPoint(tl.x, tl.y, shape, shape.rotation);
            const pTR = transformPoint(tr.x, tr.y, shape, shape.rotation);
            const pBR = transformPoint(br.x, br.y, shape, shape.rotation);
            // const pBL = transformPoint(bl.x, bl.y, shape, shape.rotation);

            // Top Dimension (Width) - Offset upwards (negative relative to shape top?)
            // We rely on DimensionRenderer's offset logic which uses perpendicular vector.
            // Vector TL -> TR. Perpendicular (90deg CCW) is Up.
            // So positive offset moves UP relative to the line. 
            dimensionsToRender.push({
                id: `auto-dim-${shape.id}-w`,
                startPoint: pTL,
                endPoint: pTR,
                value: Math.round(w),
                offset: OFFSET,
                color: '#666666',
                type: 'linear',
                fontSize: 48,
                zIndex: 100
            });

            // Right Dimension (Height)
            // Vector TR -> BR. Perpendicular is Right.
            dimensionsToRender.push({
                id: `auto-dim-${shape.id}-h`,
                startPoint: pTR,
                endPoint: pBR,
                value: Math.round(h),
                offset: OFFSET,
                color: '#666666',
                type: 'linear',
                fontSize: 48,
                zIndex: 100
            });
        }
        // TODO: Handle lines/polygons if needed
    });

    // 3. Process Assets
    assets.forEach(asset => {
        if ((asset as any).showDimensions && !asset.isExploded) {
            const w = asset.width * (asset.scale || 1);
            const h = asset.height * (asset.scale || 1);

            // Local corners relative to center
            const tl = { x: -w / 2, y: -h / 2 };
            const tr = { x: w / 2, y: -h / 2 };
            const br = { x: w / 2, y: h / 2 };

            // Transform to world space
            const pTL = transformPoint(tl.x, tl.y, asset, asset.rotation);
            const pTR = transformPoint(tr.x, tr.y, asset, asset.rotation);
            const pBR = transformPoint(br.x, br.y, asset, asset.rotation);

            // Top Dimension
            dimensionsToRender.push({
                id: `auto-dim-${asset.id}-w`,
                startPoint: pTL,
                endPoint: pTR,
                value: Math.round(w),
                offset: OFFSET,
                color: '#666666',
                type: 'linear',
                fontSize: 48,
                zIndex: 100
            });

            // Right Dimension
            dimensionsToRender.push({
                id: `auto-dim-${asset.id}-h`,
                startPoint: pTR,
                endPoint: pBR,
                value: Math.round(h),
                offset: OFFSET,
                color: '#666666',
                type: 'linear',
                fontSize: 48,
                zIndex: 100
            });
        }
    });

    return (
        <>
            {dimensionsToRender.map(dim => (
                <DimensionRenderer
                    key={dim.id}
                    dimension={dim}
                    zoom={zoom}
                />
            ))}
        </>
    );
};
