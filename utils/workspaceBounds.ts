import { Wall, Shape, Asset } from '@/store/projectStore';

/**
 * Calculates the bounding box of all workspace items
 */
export function calculateWorkspaceBounds(
    walls: Wall[],
    shapes: Shape[],
    assets: Asset[]
): { minX: number; minY: number; maxX: number; maxY: number; width: number; height: number } | null {
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    // Process walls (support both node-based walls and wall-polygon from API)
    walls.forEach(wall => {
        // Node-based walls
        if (wall.nodes && wall.nodes.length) {
            wall.nodes.forEach(node => {
                minX = Math.min(minX, node.x);
                minY = Math.min(minY, node.y);
                maxX = Math.max(maxX, node.x);
                maxY = Math.max(maxY, node.y);
            });
        }

        // Polygon-based walls (API uses wallPolygon + x/y offsets)
        const poly = (wall as any).wallPolygon as Array<{ x: number; y: number }> | undefined;
        if (poly && poly.length) {
            poly.forEach(point => {
                const px = point.x + ((wall as any).x || 0);
                const py = point.y + ((wall as any).y || 0);
                minX = Math.min(minX, px);
                minY = Math.min(minY, py);
                maxX = Math.max(maxX, px);
                maxY = Math.max(maxY, py);
            });
        }

        // Centerline fallback if provided
        const centerline = (wall as any).centerline as Array<{ x: number; y: number }> | undefined;
        if (centerline && centerline.length) {
            centerline.forEach(point => {
                const px = point.x + ((wall as any).x || 0);
                const py = point.y + ((wall as any).y || 0);
                minX = Math.min(minX, px);
                minY = Math.min(minY, py);
                maxX = Math.max(maxX, px);
                maxY = Math.max(maxY, py);
            });
        }
    });

    // Process shapes (shapes are centered at x, y)
    shapes.forEach(shape => {
        const halfWidth = shape.width / 2;
        const halfHeight = shape.height / 2;
        const left = shape.x - halfWidth;
        const top = shape.y - halfHeight;
        const right = shape.x + halfWidth;
        const bottom = shape.y + halfHeight;

        minX = Math.min(minX, left);
        minY = Math.min(minY, top);
        maxX = Math.max(maxX, right);
        maxY = Math.max(maxY, bottom);
    });

    // Process assets (assets are centered at x, y)
    assets.forEach(asset => {
        const scaledWidth = (asset.width || 50) * (asset.scale || 1);
        const scaledHeight = (asset.height || 50) * (asset.scale || 1);
        const halfWidth = scaledWidth / 2;
        const halfHeight = scaledHeight / 2;
        const left = asset.x - halfWidth;
        const top = asset.y - halfHeight;
        const right = asset.x + halfWidth;
        const bottom = asset.y + halfHeight;

        minX = Math.min(minX, left);
        minY = Math.min(minY, top);
        maxX = Math.max(maxX, right);
        maxY = Math.max(maxY, bottom);
    });

    // If no items found, return null
    if (!isFinite(minX) || !isFinite(minY)) {
        return null;
    }

    return {
        minX,
        minY,
        maxX,
        maxY,
        width: maxX - minX,
        height: maxY - minY,
    };
}

/**
 * Calculates the optimal viewport to show all workspace items
 * with specified padding
 */
export function calculateOptimalViewport(
    walls: Wall[],
    shapes: Shape[],
    assets: Asset[],
    padding: number = 100
): {
    centerX: number;
    centerY: number;
    zoom: number;
    panX: number;
    panY: number;
} | null {
    const bounds = calculateWorkspaceBounds(walls, shapes, assets);

    if (!bounds) {
        // No items - return default centered view
        return {
            centerX: 0,
            centerY: 0,
            zoom: 1,
            panX: 0,
            panY: 0,
        };
    }

    // Add padding to bounds
    const paddedWidth = bounds.width + (padding * 2);
    const paddedHeight = bounds.height + (padding * 2);

    // Calculate center point
    const centerX = bounds.minX + (bounds.width / 2);
    const centerY = bounds.minY + (bounds.height / 2);

    return {
        centerX,
        centerY,
        zoom: 1, // Can be calculated based on container size if needed
        panX: -bounds.minX + padding,
        panY: -bounds.minY + padding,
    };
}

/**
 * Generates viewport settings to fit workspace in a container
 */
export function fitWorkspaceToContainer(
    walls: Wall[],
    shapes: Shape[],
    assets: Asset[],
    containerWidth: number,
    containerHeight: number,
    padding: number = 50
): {
    zoom: number;
    panX: number;
    panY: number;
} {
    const bounds = calculateWorkspaceBounds(walls, shapes, assets);

    if (!bounds) {
        return { zoom: 1, panX: 0, panY: 0 };
    }

    // Calculate zoom to fit content
    // Use smaller padding for better cropping in previews
    const effectivePadding = Math.min(padding, 20);
    const availableWidth = containerWidth - (effectivePadding * 2);
    const availableHeight = containerHeight - (effectivePadding * 2);

    // Ensure we have valid dimensions
    if (bounds.width <= 0 || bounds.height <= 0) {
        return { zoom: 1, panX: 0, panY: 0 };
    }

    const zoomX = availableWidth / bounds.width;
    const zoomY = availableHeight / bounds.height;
    // Use the smaller zoom to ensure everything fits (like Figma - always zoom out to fit all)
    const zoom = Math.min(zoomX, zoomY);

    // Calculate pan to center the content within the boundary
    const scaledWidth = bounds.width * zoom;
    const scaledHeight = bounds.height * zoom;

    // Center the content in the container, accounting for the boundary
    const panX = (containerWidth - scaledWidth) / 2 - (bounds.minX * zoom) + effectivePadding;
    const panY = (containerHeight - scaledHeight) / 2 - (bounds.minY * zoom) + effectivePadding;

    return { zoom, panX, panY };
}
