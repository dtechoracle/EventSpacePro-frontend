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

export const AutoDimensionRenderer: React.FC<AutoDimensionRendererProps> = React.memo(({ walls, shapes, assets, zoom }) => {
    const dimensionsToRender = React.useMemo(() => {
        const nextDimensions: Dimension[] = [];
        const applyAutoDimensionStyle = (dim: Dimension, source: Wall | Shape | Asset) => {
            const styleSource = source as any;
            dim.textPosition = styleSource.dimensionTextPosition || dim.textPosition || 'inbetween';
            dim.labelPosition = styleSource.dimensionLabelPosition || dim.labelPosition;
            dim.offset = styleSource.dimensionOffset ?? dim.offset;
            dim.strokeWidth = styleSource.dimensionStrokeWidth ?? dim.strokeWidth;
            dim.color = styleSource.dimensionColor || dim.color;
            dim.fontSize = styleSource.dimensionFontSize ?? dim.fontSize;
            dim.fontFamily = styleSource.dimensionFontFamily || dim.fontFamily;
            dim.fontWeight = styleSource.dimensionFontWeight || dim.fontWeight;
            dim.fontStyle = styleSource.dimensionFontStyle || dim.fontStyle;
            dim.textDecoration = styleSource.dimensionTextDecoration || dim.textDecoration;

            if (['solid', 'dashed', 'dotted', 'double'].includes(styleSource.dimensionType)) {
                dim.lineStyle = styleSource.dimensionType;
            }
        };

        // 1. Process Walls
        walls.forEach(wall => {
            const wallDims = getDimensionsForWall(wall);
            wallDims.forEach(dim => {
                applyAutoDimensionStyle(dim, wall);
            });
            nextDimensions.push(...wallDims);
        });

        // 2. Process Shapes
        shapes.forEach(shape => {
            const shapeDims = getDimensionsForObject(shape as Shape, `auto-dim-${shape.id}`);
            shapeDims.forEach(dim => {
                applyAutoDimensionStyle(dim, shape);
            });
            nextDimensions.push(...shapeDims);
        });

        // 3. Process pre-filtered assets with dimensions enabled
        assets.forEach(asset => {
            const assetDims = getDimensionsForObject(asset as Asset, `auto-dim-${asset.id}`);
            assetDims.forEach(dim => {
                applyAutoDimensionStyle(dim, asset);
            });
            nextDimensions.push(...assetDims);
        });

        return nextDimensions;
    }, [walls, shapes, assets]);

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
});

AutoDimensionRenderer.displayName = 'AutoDimensionRenderer';
