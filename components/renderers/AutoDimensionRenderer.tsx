import React from 'react';
import { Wall, Shape, Asset, Dimension } from '@/store/projectStore';
import { DimensionRenderer } from './DimensionRenderer';
import { getDimensionsForObject, getDimensionsForWall } from '@/utils/dimensionUtils';

interface AutoDimensionRendererProps {
    walls: Wall[];
    shapes: Shape[];
    assets: Asset[];
    zoom: number;
}

export const AutoDimensionRenderer: React.FC<AutoDimensionRendererProps> = ({ walls, shapes, assets, zoom }) => {
    const dimensionsToRender: Dimension[] = [];

    // 1. Process Walls
    walls.forEach(wall => {
        dimensionsToRender.push(...getDimensionsForWall(wall));
    });

    // 2. Process Shapes
    shapes.forEach(shape => {
        if ((shape as any).showDimensions && shape.type !== 'line' && shape.type !== 'arrow') {
            dimensionsToRender.push(...getDimensionsForObject(shape as Shape, `auto-dim-${shape.id}`));
        }
    });

    // 3. Process Assets
    assets.forEach(asset => {
        if ((asset as any).showDimensions && !asset.isExploded) {
            dimensionsToRender.push(...getDimensionsForObject(asset as Asset, `auto-dim-${asset.id}`));
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
