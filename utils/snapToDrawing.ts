import { Wall, Asset, Shape } from '@/store/projectStore';

export interface SnapPoint {
    x: number;
    y: number;
    type: 'corner' | 'midpoint' | 'edge' | 'center';
    elementId: string;
}

type SnapTarget = Shape | Wall | Asset;

/**
 * Find the closest snap point on a target element
 */
export function findClosestSnapPoint(
    cursorPos: { x: number; y: number },
    element: SnapTarget,
    snapThreshold: number = 20
): SnapPoint | null {
    const snapPoints: SnapPoint[] = [];

    // Handle Shapes
    if ('type' in element && (element.type === 'rectangle' || element.type === 'ellipse')) {
        const shape = element as Shape;
        const halfW = shape.width / 2;
        const halfH = shape.height / 2;

        snapPoints.push(
            { x: shape.x - halfW, y: shape.y - halfH, type: 'corner', elementId: shape.id },
            { x: shape.x + halfW, y: shape.y - halfH, type: 'corner', elementId: shape.id },
            { x: shape.x + halfW, y: shape.y + halfH, type: 'corner', elementId: shape.id },
            { x: shape.x - halfW, y: shape.y + halfH, type: 'corner', elementId: shape.id }
        );

        snapPoints.push(
            { x: shape.x, y: shape.y - halfH, type: 'midpoint', elementId: shape.id },
            { x: shape.x + halfW, y: shape.y, type: 'midpoint', elementId: shape.id },
            { x: shape.x, y: shape.y + halfH, type: 'midpoint', elementId: shape.id },
            { x: shape.x - halfW, y: shape.y, type: 'midpoint', elementId: shape.id }
        );

        snapPoints.push({ x: shape.x, y: shape.y, type: 'center', elementId: shape.id });
    }
    // Handle Lines/Polygons
    else if ('points' in element && element.points && element.points.length > 0) {
        const shape = element as Shape;
        shape.points!.forEach((point, index) => {
            snapPoints.push({
                x: shape.x + point.x,
                y: shape.y + point.y,
                type: 'corner',
                elementId: shape.id
            });

            const nextIndex = (index + 1) % shape.points!.length;
            const nextPoint = shape.points![nextIndex];

            if (shape.type === 'polygon' || index < shape.points!.length - 1) {
                snapPoints.push({
                    x: shape.x + (point.x + nextPoint.x) / 2,
                    y: shape.y + (point.y + nextPoint.y) / 2,
                    type: 'midpoint',
                    elementId: shape.id
                });
            }
        });

        // Center
        const centerX = shape.points!.reduce((sum, p) => sum + p.x, 0) / shape.points!.length;
        const centerY = shape.points!.reduce((sum, p) => sum + p.y, 0) / shape.points!.length;
        snapPoints.push({ x: shape.x + centerX, y: shape.y + centerY, type: 'center', elementId: shape.id });
    }
    // Handle Assets
    else if ('src' in element) { // Asset has src
        const asset = element as Asset;
        // Use scaled dimensions
        const width = asset.width * (asset.scale || 1);
        const height = asset.height * (asset.scale || 1);
        const halfW = width / 2;
        const halfH = height / 2;

        snapPoints.push(
            { x: asset.x - halfW, y: asset.y - halfH, type: 'corner', elementId: asset.id },
            { x: asset.x + halfW, y: asset.y - halfH, type: 'corner', elementId: asset.id },
            { x: asset.x + halfW, y: asset.y + halfH, type: 'corner', elementId: asset.id },
            { x: asset.x - halfW, y: asset.y + halfH, type: 'corner', elementId: asset.id }
        );

        snapPoints.push(
            { x: asset.x, y: asset.y - halfH, type: 'midpoint', elementId: asset.id },
            { x: asset.x + halfW, y: asset.y, type: 'midpoint', elementId: asset.id },
            { x: asset.x, y: asset.y + halfH, type: 'midpoint', elementId: asset.id },
            { x: asset.x - halfW, y: asset.y, type: 'midpoint', elementId: asset.id }
        );

        snapPoints.push({ x: asset.x, y: asset.y, type: 'center', elementId: asset.id });
    }
    // Handle Walls
    else if ('nodes' in element && 'edges' in element) {
        const wall = element as Wall;
        wall.nodes.forEach(node => {
            snapPoints.push({ x: node.x, y: node.y, type: 'center', elementId: wall.id });
        });

        wall.edges.forEach(edge => {
            const n1 = wall.nodes.find(n => n.id === edge.nodeA);
            const n2 = wall.nodes.find(n => n.id === edge.nodeB);
            if (n1 && n2) {
                // Centerline midpoint
                snapPoints.push({
                    x: (n1.x + n2.x) / 2,
                    y: (n1.y + n2.y) / 2,
                    type: 'midpoint',
                    elementId: wall.id
                });

                // Add visual corners (offset by thickness/2)
                const dx = n2.x - n1.x;
                const dy = n2.y - n1.y;
                const length = Math.sqrt(dx * dx + dy * dy);
                if (length > 0) {
                    const thickness = edge.thickness || 150; // Default if missing
                    const halfThick = thickness / 2;
                    const ux = dx / length;
                    const uy = dy / length;
                    const px = -uy * halfThick;
                    const py = ux * halfThick;

                    // Four corners of the segment (visual approximation)
                    snapPoints.push(
                        { x: n1.x + px, y: n1.y + py, type: 'corner', elementId: wall.id },
                        { x: n1.x - px, y: n1.y - py, type: 'corner', elementId: wall.id },
                        { x: n2.x + px, y: n2.y + py, type: 'corner', elementId: wall.id },
                        { x: n2.x - px, y: n2.y - py, type: 'corner', elementId: wall.id }
                    );
                }
            }
        });
    }

    // Find closest snap point
    let closestPoint: SnapPoint | null = null;
    let closestDistance = snapThreshold;

    for (const point of snapPoints) {
        const distance = Math.hypot(cursorPos.x - point.x, cursorPos.y - point.y);
        if (distance < closestDistance) {
            closestDistance = distance;
            closestPoint = point;
        }
    }

    return closestPoint;
}

/**
 * Find snap points for multiple elements (shapes, walls, assets)
 */
export function findSnapPointInShapes(
    cursorPos: { x: number; y: number },
    elements: SnapTarget[],
    snapThreshold: number = 20
): SnapPoint | null {
    let closestPoint: SnapPoint | null = null;
    let closestDistance = snapThreshold;

    for (const element of elements) {
        const snapPoint = findClosestSnapPoint(cursorPos, element, snapThreshold);
        if (snapPoint) {
            const distance = Math.hypot(cursorPos.x - snapPoint.x, cursorPos.y - snapPoint.y);
            if (distance < closestDistance) {
                closestDistance = distance;
                closestPoint = snapPoint;
            }
        }
    }

    return closestPoint;
}


/**
 * Snap to edge of a shape (closest point on perimeter)
 */
export function snapToEdge(
    cursorPos: { x: number; y: number },
    shape: Shape,
    snapThreshold: number = 20
): SnapPoint | null {
    if (shape.type === 'rectangle') {
        const halfW = shape.width / 2;
        const halfH = shape.height / 2;

        // Find closest edge
        const edges = [
            { x: cursorPos.x, y: shape.y - halfH, dist: Math.abs(cursorPos.y - (shape.y - halfH)) }, // Top
            { x: cursorPos.x, y: shape.y + halfH, dist: Math.abs(cursorPos.y - (shape.y + halfH)) }, // Bottom
            { x: shape.x - halfW, y: cursorPos.y, dist: Math.abs(cursorPos.x - (shape.x - halfW)) }, // Left
            { x: shape.x + halfW, y: cursorPos.y, dist: Math.abs(cursorPos.x - (shape.x + halfW)) }  // Right
        ];

        const closestEdge = edges.reduce((min, edge) => edge.dist < min.dist ? edge : min);

        if (closestEdge.dist < snapThreshold) {
            return {
                x: Math.max(shape.x - halfW, Math.min(shape.x + halfW, closestEdge.x)),
                y: Math.max(shape.y - halfH, Math.min(shape.y + halfH, closestEdge.y)),
                type: 'edge',
                elementId: shape.id
            };
        }
    }

    return null;
}
