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
        const wallDims = getDimensionsForWall(wall);
        wallDims.forEach(dim => {
            (dim as any).textPosition = (wall as any).dimensionTextPosition || 'inbetween';
            (dim as any).fontSize = (wall as any).dimensionFontSize || 25000;
            (dim as any).lineStyle = (wall as any).dimensionType || 'solid';
        });
        dimensionsToRender.push(...wallDims);
    });

    // 2. Process Shapes
    shapes.forEach(shape => {
        if ((shape as any).showDimensions && shape.type !== 'line' && shape.type !== 'arrow') {
            const shapeDims = getDimensionsForObject(shape as Shape, `auto-dim-${shape.id}`);
            shapeDims.forEach(dim => {
                (dim as any).textPosition = (shape as any).dimensionTextPosition || 'inbetween';
                (dim as any).fontSize = (shape as any).dimensionFontSize || 25000;
                (dim as any).lineStyle = (shape as any).dimensionType || 'solid';
            });
            dimensionsToRender.push(...shapeDims);
        }
    });

    // 3. Process Assets
    assets.forEach(asset => {
        if ((asset as any).showDimensions && !asset.isExploded) {
            const assetDims = getDimensionsForObject(asset as Asset, `auto-dim-${asset.id}`);
            assetDims.forEach(dim => {
                (dim as any).textPosition = (asset as any).dimensionTextPosition || 'inbetween';
                (dim as any).fontSize = (asset as any).dimensionFontSize || 25000;
                (dim as any).lineStyle = (asset as any).dimensionType || 'solid';
            });
            dimensionsToRender.push(...assetDims);
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
