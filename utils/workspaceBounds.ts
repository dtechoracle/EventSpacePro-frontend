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

    // Process walls
    walls.forEach(wall => {
        wall.nodes.forEach(node => {
            minX = Math.min(minX, node.x);
            minY = Math.min(minY, node.y);
            maxX = Math.max(maxX, node.x);
            maxY = Math.max(maxY, node.y);
        });
    });

    // Process shapes
    shapes.forEach(shape => {
        const left = shape.x;
        const top = shape.y;
        const right = shape.x + shape.width;
        const bottom = shape.y + shape.height;

        minX = Math.min(minX, left);
        minY = Math.min(minY, top);
        maxX = Math.max(maxX, right);
        maxY = Math.max(maxY, bottom);
    });

    // Process assets
    assets.forEach(asset => {
        const left = asset.x;
        const top = asset.y;
        const right = asset.x + asset.width;
        const bottom = asset.y + asset.height;

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
    const availableWidth = containerWidth - (padding * 2);
    const availableHeight = containerHeight - (padding * 2);

    const zoomX = availableWidth / bounds.width;
    const zoomY = availableHeight / bounds.height;
    const zoom = Math.min(zoomX, zoomY, 1); // Don't zoom in, only out

    // Calculate pan to center the content
    const scaledWidth = bounds.width * zoom;
    const scaledHeight = bounds.height * zoom;

    const panX = (containerWidth - scaledWidth) / 2 - (bounds.minX * zoom);
    const panY = (containerHeight - scaledHeight) / 2 - (bounds.minY * zoom);

    return { zoom, panX, panY };
}
