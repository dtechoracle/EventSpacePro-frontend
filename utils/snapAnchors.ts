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
 * Rotate a point around a center
 */
function rotatePoint(x: number, y: number, cx: number, cy: number, angleDeg: number) {
    if (angleDeg === 0) return { x, y };
    const angleRad = (angleDeg * Math.PI) / 180;
    const cos = Math.cos(angleRad);
    const sin = Math.sin(angleRad);
    const dx = x - cx;
    const dy = y - cy;
    return {
        x: cx + dx * cos - dy * sin,
        y: cy + dx * sin + dy * cos
    };
}

/**
 * Calculate all anchor points for a shape
 */
export function calculateShapeAnchors(shape: Shape): AnchorPoint[] {
    const halfW = shape.width / 2;
    const halfH = shape.height / 2;
    const rot = shape.rotation || 0;

    const anchors: { id: AnchorType; label: string; x: number; y: number }[] = [
        { id: 'top-left', label: 'Top-Left Corner', x: shape.x - halfW, y: shape.y - halfH },
        { id: 'top-center', label: 'Top Center', x: shape.x, y: shape.y - halfH },
        { id: 'top-right', label: 'Top-Right Corner', x: shape.x + halfW, y: shape.y - halfH },
        { id: 'left-center', label: 'Left Center', x: shape.x - halfW, y: shape.y },
        { id: 'center', label: 'Center', x: shape.x, y: shape.y },
        { id: 'right-center', label: 'Right Center', x: shape.x + halfW, y: shape.y },
        { id: 'bottom-left', label: 'Bottom-Left Corner', x: shape.x - halfW, y: shape.y + halfH },
        { id: 'bottom-center', label: 'Bottom Center', x: shape.x, y: shape.y + halfH },
        { id: 'bottom-right', label: 'Bottom-Right Corner', x: shape.x + halfW, y: shape.y + halfH },
    ];

    if (rot === 0) return anchors;

    return anchors.map(a => {
        const rotated = rotatePoint(a.x, a.y, shape.x, shape.y, rot);
        return { ...a, x: rotated.x, y: rotated.y };
    });
}

/**
 * Calculate all anchor points for an asset
 */
export function calculateAssetAnchors(asset: Asset): AnchorPoint[] {
    const halfW = (asset.width * (asset.scale || 1)) / 2;
    const halfH = (asset.height * (asset.scale || 1)) / 2;
    const rot = asset.rotation || 0;

    const anchors: { id: AnchorType; label: string; x: number; y: number }[] = [
        { id: 'top-left', label: 'Top-Left Corner', x: asset.x - halfW, y: asset.y - halfH },
        { id: 'top-center', label: 'Top Center', x: asset.x, y: asset.y - halfH },
        { id: 'top-right', label: 'Top-Right Corner', x: asset.x + halfW, y: asset.y - halfH },
        { id: 'left-center', label: 'Left Center', x: asset.x - halfW, y: asset.y },
        { id: 'center', label: 'Center', x: asset.x, y: asset.y },
        { id: 'right-center', label: 'Right Center', x: asset.x + halfW, y: asset.y },
        { id: 'bottom-left', label: 'Bottom-Left Corner', x: asset.x - halfW, y: asset.y + halfH },
        { id: 'bottom-center', label: 'Bottom Center', x: asset.x, y: asset.y + halfH },
        { id: 'bottom-right', label: 'Bottom-Right Corner', x: asset.x + halfW, y: asset.y + halfH },
    ];

    if (rot === 0) return anchors;

    return anchors.map(a => {
        const rotated = rotatePoint(a.x, a.y, asset.x, asset.y, rot);
        return { ...a, x: rotated.x, y: rotated.y };
    });
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
    const rot = shape.rotation || 0;
    const p = rot === 0 ? point : rotatePoint(point.x, point.y, shape.x, shape.y, -rot);

    const halfW = shape.width / 2;
    const halfH = shape.height / 2;
    return (
        p.x >= shape.x - halfW &&
        p.x <= shape.x + halfW &&
        p.y >= shape.y - halfH &&
        p.y <= shape.y + halfH
    );
}

/**
 * Check if a point is inside an asset's bounding box
 */
export function isPointInAsset(point: { x: number; y: number }, asset: Asset): boolean {
    const rot = asset.rotation || 0;
    const p = rot === 0 ? point : rotatePoint(point.x, point.y, asset.x, asset.y, -rot);

    const halfW = (asset.width * (asset.scale || 1)) / 2;
    const halfH = (asset.height * (asset.scale || 1)) / 2;
    return (
        p.x >= asset.x - halfW &&
        p.x <= asset.x + halfW &&
        p.y >= asset.y - halfH &&
        p.y <= asset.y + halfH
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
/**
 * Snap a rectangle to other objects
 */
export function snapToObjects(
    rect: { x: number; y: number; width: number; height: number; rotation?: number },
    others: Array<{ id: string; x: number; y: number; width: number; height: number; rotation?: number; type?: string }>,
    threshold: number = 15
): { x: number; y: number; guides: Array<{ x1: number; y1: number; x2: number; y2: number; type: 'horizontal' | 'vertical' }> } {
    let newX = rect.x;
    let newY = rect.y;
    const guides: Array<{ x1: number; y1: number; x2: number; y2: number; type: 'horizontal' | 'vertical' }> = [];

    // Calculate edges of the moving object
    // Assuming unrotated bounding box for simplicity for now, or center-based
    const halfW = rect.width / 2;
    const halfH = rect.height / 2;

    // Points of interest on the moving object
    const moving = {
        left: rect.x - halfW,
        centerX: rect.x,
        right: rect.x + halfW,
        top: rect.y - halfH,
        centerY: rect.y,
        bottom: rect.y + halfH
    };

    let snappedX = false;
    let snappedY = false;

    // Iterate through other objects
    for (const other of others) {
        const otherHalfW = other.width / 2;
        const otherHalfH = other.height / 2;

        const target = {
            left: other.x - otherHalfW,
            centerX: other.x,
            right: other.x + otherHalfW,
            top: other.y - otherHalfH,
            centerY: other.y,
            bottom: other.y + otherHalfH
        };

        // Horizontal Snapping (X-axis)
        if (!snappedX) {
            // Left to Left
            if (Math.abs(moving.left - target.left) < threshold) {
                newX = target.left + halfW;
                guides.push({ x1: target.left, y1: Math.min(moving.top, target.top) - 20, x2: target.left, y2: Math.max(moving.bottom, target.bottom) + 20, type: 'vertical' });
                snappedX = true;
            }
            // Left to Right
            else if (Math.abs(moving.left - target.right) < threshold) {
                newX = target.right + halfW;
                guides.push({ x1: target.right, y1: Math.min(moving.top, target.top) - 20, x2: target.right, y2: Math.max(moving.bottom, target.bottom) + 20, type: 'vertical' });
                snappedX = true;
            }
            // Right to Left
            else if (Math.abs(moving.right - target.left) < threshold) {
                newX = target.left - halfW;
                guides.push({ x1: target.left, y1: Math.min(moving.top, target.top) - 20, x2: target.left, y2: Math.max(moving.bottom, target.bottom) + 20, type: 'vertical' });
                snappedX = true;
            }
            // Right to Right
            else if (Math.abs(moving.right - target.right) < threshold) {
                newX = target.right - halfW;
                guides.push({ x1: target.right, y1: Math.min(moving.top, target.top) - 20, x2: target.right, y2: Math.max(moving.bottom, target.bottom) + 20, type: 'vertical' });
                snappedX = true;
            }
            // Center to Center
            else if (Math.abs(moving.centerX - target.centerX) < threshold) {
                newX = target.centerX;
                guides.push({ x1: target.centerX, y1: Math.min(moving.top, target.top) - 20, x2: target.centerX, y2: Math.max(moving.bottom, target.bottom) + 20, type: 'vertical' });
                snappedX = true;
            }
        }

        // Vertical Snapping (Y-axis)
        if (!snappedY) {
            // Top to Top
            if (Math.abs(moving.top - target.top) < threshold) {
                newY = target.top + halfH;
                guides.push({ x1: Math.min(moving.left, target.left) - 20, y1: target.top, x2: Math.max(moving.right, target.right) + 20, y2: target.top, type: 'horizontal' });
                snappedY = true;
            }
            // Top to Bottom
            else if (Math.abs(moving.top - target.bottom) < threshold) {
                newY = target.bottom + halfH;
                guides.push({ x1: Math.min(moving.left, target.left) - 20, y1: target.bottom, x2: Math.max(moving.right, target.right) + 20, y2: target.bottom, type: 'horizontal' });
                snappedY = true;
            }
            // Bottom to Top
            else if (Math.abs(moving.bottom - target.top) < threshold) {
                newY = target.top - halfH;
                guides.push({ x1: Math.min(moving.left, target.left) - 20, y1: target.top, x2: Math.max(moving.right, target.right) + 20, y2: target.top, type: 'horizontal' });
                snappedY = true;
            }
            // Bottom to Bottom
            else if (Math.abs(moving.bottom - target.bottom) < threshold) {
                newY = target.bottom - halfH;
                guides.push({ x1: Math.min(moving.left, target.left) - 20, y1: target.bottom, x2: Math.max(moving.right, target.right) + 20, y2: target.bottom, type: 'horizontal' });
                snappedY = true;
            }
            // Center to Center
            else if (Math.abs(moving.centerY - target.centerY) < threshold) {
                newY = target.centerY;
                guides.push({ x1: Math.min(moving.left, target.left) - 20, y1: target.centerY, x2: Math.max(moving.right, target.right) + 20, y2: target.centerY, type: 'horizontal' });
                snappedY = true;
            }
        }
    }

    return { x: newX, y: newY, guides };
}
