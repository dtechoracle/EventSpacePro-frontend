import { Shape, Wall, Asset } from '@/store/projectStore';

export type AnchorType =
    | 'top-left'
    | 'top-center'
    | 'top-right'
    | 'left-center'
    | 'center'
    | 'right-center'
    | 'bottom-left'
    | 'bottom-center'
    | 'bottom-right';

export interface AnchorPoint {
    id: AnchorType;
    label: string;
    x: number;
    y: number;
}

/**
 * Calculate all anchor points for a shape
 */
export function calculateShapeAnchors(shape: Shape): AnchorPoint[] {
    const halfW = shape.width / 2;
    const halfH = shape.height / 2;

    // For rotated shapes, we need to calculate rotated corners
    // For now, using axis-aligned bounding box
    const left = shape.x - halfW;
    const right = shape.x + halfW;
    const top = shape.y - halfH;
    const bottom = shape.y + halfH;
    const centerX = shape.x;
    const centerY = shape.y;

    return [
        { id: 'top-left', label: 'Top-Left Corner', x: left, y: top },
        { id: 'top-center', label: 'Top Center', x: centerX, y: top },
        { id: 'top-right', label: 'Top-Right Corner', x: right, y: top },
        { id: 'left-center', label: 'Left Center', x: left, y: centerY },
        { id: 'center', label: 'Center', x: centerX, y: centerY },
        { id: 'right-center', label: 'Right Center', x: right, y: centerY },
        { id: 'bottom-left', label: 'Bottom-Left Corner', x: left, y: bottom },
        { id: 'bottom-center', label: 'Bottom Center', x: centerX, y: bottom },
        { id: 'bottom-right', label: 'Bottom-Right Corner', x: right, y: bottom },
    ];
}

/**
 * Calculate all anchor points for an asset
 */
export function calculateAssetAnchors(asset: Asset): AnchorPoint[] {
    const halfW = (asset.width * asset.scale) / 2;
    const halfH = (asset.height * asset.scale) / 2;

    const left = asset.x - halfW;
    const right = asset.x + halfW;
    const top = asset.y - halfH;
    const bottom = asset.y + halfH;
    const centerX = asset.x;
    const centerY = asset.y;

    return [
        { id: 'top-left', label: 'Top-Left Corner', x: left, y: top },
        { id: 'top-center', label: 'Top Center', x: centerX, y: top },
        { id: 'top-right', label: 'Top-Right Corner', x: right, y: top },
        { id: 'left-center', label: 'Left Center', x: left, y: centerY },
        { id: 'center', label: 'Center', x: centerX, y: centerY },
        { id: 'right-center', label: 'Right Center', x: right, y: centerY },
        { id: 'bottom-left', label: 'Bottom-Left Corner', x: left, y: bottom },
        { id: 'bottom-center', label: 'Bottom Center', x: centerX, y: bottom },
        { id: 'bottom-right', label: 'Bottom-Right Corner', x: right, y: bottom },
    ];
}

/**
 * Calculate anchor points for a wall (bounding box + node points)
 */
export function calculateWallAnchors(wall: Wall): AnchorPoint[] {
    // Calculate bounding box
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    wall.nodes.forEach(node => {
        minX = Math.min(minX, node.x);
        minY = Math.min(minY, node.y);
        maxX = Math.max(maxX, node.x);
        maxY = Math.max(maxY, node.y);
    });

    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;

    return [
        { id: 'top-left', label: 'Top-Left Corner', x: minX, y: minY },
        { id: 'top-center', label: 'Top Center', x: centerX, y: minY },
        { id: 'top-right', label: 'Top-Right Corner', x: maxX, y: minY },
        { id: 'left-center', label: 'Left Center', x: minX, y: centerY },
        { id: 'center', label: 'Center', x: centerX, y: centerY },
        { id: 'right-center', label: 'Right Center', x: maxX, y: centerY },
        { id: 'bottom-left', label: 'Bottom-Left Corner', x: minX, y: maxY },
        { id: 'bottom-center', label: 'Bottom Center', x: centerX, y: maxY },
        { id: 'bottom-right', label: 'Bottom-Right Corner', x: maxX, y: maxY },
    ];
}

/**
 * Check if a point is inside a shape's bounding box
 */
export function isPointInShape(point: { x: number; y: number }, shape: Shape): boolean {
    const halfW = shape.width / 2;
    const halfH = shape.height / 2;
    return (
        point.x >= shape.x - halfW &&
        point.x <= shape.x + halfW &&
        point.y >= shape.y - halfH &&
        point.y <= shape.y + halfH
    );
}

/**
 * Check if a point is inside an asset's bounding box
 */
export function isPointInAsset(point: { x: number; y: number }, asset: Asset): boolean {
    const halfW = (asset.width * asset.scale) / 2;
    const halfH = (asset.height * asset.scale) / 2;
    return (
        point.x >= asset.x - halfW &&
        point.x <= asset.x + halfW &&
        point.y >= asset.y - halfH &&
        point.y <= asset.y + halfH
    );
}

/**
 * Check if a point is inside a wall's bounding box
 */
export function isPointInWall(point: { x: number; y: number }, wall: Wall): boolean {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    wall.nodes.forEach(node => {
        minX = Math.min(minX, node.x);
        minY = Math.min(minY, node.y);
        maxX = Math.max(maxX, node.x);
        maxY = Math.max(maxY, node.y);
    });

    return (
        point.x >= minX &&
        point.x <= maxX &&
        point.y >= minY &&
        point.y <= maxY
    );
}

/**
 * Find objects that contain the given point
 */
export function findContainingObjects(
    point: { x: number; y: number },
    shapes: Shape[],
    walls: Wall[],
    assets: Asset[],
    excludeId?: string
): Array<{ type: 'shape' | 'wall' | 'asset'; object: Shape | Wall | Asset }> {
    const containing: Array<{ type: 'shape' | 'wall' | 'asset'; object: Shape | Wall | Asset }> = [];

    shapes.forEach(shape => {
        if (shape.id !== excludeId && isPointInShape(point, shape)) {
            containing.push({ type: 'shape', object: shape });
        }
    });

    walls.forEach(wall => {
        if (wall.id !== excludeId && isPointInWall(point, wall)) {
            containing.push({ type: 'wall', object: wall });
        }
    });

    assets.forEach(asset => {
        if (asset.id !== excludeId && isPointInAsset(point, asset)) {
            containing.push({ type: 'asset', object: asset });
        }
    });

    return containing;
}

/**
 * Find the nearest object to a given point
 */
export function findNearestObject(
    point: { x: number; y: number },
    shapes: Shape[],
    walls: Wall[],
    assets: Asset[],
    excludeId?: string
): { type: 'shape' | 'wall' | 'asset'; object: Shape | Wall | Asset; distance: number } | null {
    let nearest: { type: 'shape' | 'wall' | 'asset'; object: Shape | Wall | Asset; distance: number } | null = null;

    shapes.forEach(shape => {
        if (shape.id === excludeId) return;
        const dist = Math.sqrt((shape.x - point.x) ** 2 + (shape.y - point.y) ** 2);
        if (!nearest || dist < nearest.distance) {
            nearest = { type: 'shape', object: shape, distance: dist };
        }
    });

    assets.forEach(asset => {
        if (asset.id === excludeId) return;
        const dist = Math.sqrt((asset.x - point.x) ** 2 + (asset.y - point.y) ** 2);
        if (!nearest || dist < nearest.distance) {
            nearest = { type: 'asset', object: asset, distance: dist };
        }
    });

    walls.forEach(wall => {
        if (wall.id === excludeId) return;
        // Use wall center for distance calculation
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        wall.nodes.forEach(node => {
            minX = Math.min(minX, node.x);
            minY = Math.min(minY, node.y);
            maxX = Math.max(maxX, node.x);
            maxY = Math.max(maxY, node.y);
        });
        const centerX = (minX + maxX) / 2;
        const centerY = (minY + maxY) / 2;
        const dist = Math.sqrt((centerX - point.x) ** 2 + (centerY - point.y) ** 2);
        if (!nearest || dist < nearest.distance) {
            nearest = { type: 'wall', object: wall, distance: dist };
        }
    });

    return nearest;
}

/**
 * Get anchor points for any object type
 */
export function getAnchorsForObject(
    obj: { type: 'shape' | 'wall' | 'asset'; object: Shape | Wall | Asset }
): AnchorPoint[] {
    switch (obj.type) {
        case 'shape':
            return calculateShapeAnchors(obj.object as Shape);
        case 'wall':
            return calculateWallAnchors(obj.object as Wall);
        case 'asset':
            return calculateAssetAnchors(obj.object as Asset);
    }
}
