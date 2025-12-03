// Utility functions for wall openings
import { Point } from '@/store/projectStore';

/**
 * Check if a point is near a line segment
 */
export function pointToLineDistance(
    point: Point,
    lineStart: Point,
    lineEnd: Point
): { distance: number; projection: Point; t: number } {
    const dx = lineEnd.x - lineStart.x;
    const dy = lineEnd.y - lineStart.y;
    const lengthSquared = dx * dx + dy * dy;

    if (lengthSquared === 0) {
        // Line segment is actually a point
        const dist = Math.sqrt(
            (point.x - lineStart.x) ** 2 + (point.y - lineStart.y) ** 2
        );
        return { distance: dist, projection: lineStart, t: 0 };
    }

    // Calculate projection parameter t
    let t =
        ((point.x - lineStart.x) * dx + (point.y - lineStart.y) * dy) /
        lengthSquared;

    // Clamp t to [0, 1] to stay on the segment
    t = Math.max(0, Math.min(1, t));

    // Calculate projection point
    const projection = {
        x: lineStart.x + t * dx,
        y: lineStart.y + t * dy,
    };

    // Calculate distance
    const distance = Math.sqrt(
        (point.x - projection.x) ** 2 + (point.y - projection.y) ** 2
    );

    return { distance, projection, t };
}

/**
 * Find the wall edge that an asset (door/window) should attach to
 */
export function findNearestWallEdge(
    assetPos: Point,
    walls: Array<{
        id: string;
        nodes: Array<Point & { id: string }>;
        edges: Array<{ id: string; nodeA: string; nodeB: string; thickness: number }>;
    }>,
    maxDistance: number = 50 // mm
): { wallId: string; edgeId: string; position: Point; rotation: number } | null {
    let nearest: {
        wallId: string;
        edgeId: string;
        distance: number;
        position: Point;
        rotation: number;
    } | null = null;

    for (const wall of walls) {
        const nodeMap = new Map(wall.nodes.map((n) => [n.id, n]));

        for (const edge of wall.edges) {
            const nodeA = nodeMap.get(edge.nodeA);
            const nodeB = nodeMap.get(edge.nodeB);

            if (!nodeA || !nodeB) continue;

            const { distance, projection } = pointToLineDistance(
                assetPos,
                nodeA,
                nodeB
            );

            if (distance < maxDistance && (!nearest || distance < nearest.distance)) {
                // Calculate rotation to align with wall
                const dx = nodeB.x - nodeA.x;
                const dy = nodeB.y - nodeA.y;
                const rotation = Math.atan2(dy, dx) * (180 / Math.PI);

                nearest = {
                    wallId: wall.id,
                    edgeId: edge.id,
                    distance,
                    position: projection,
                    rotation,
                };
            }
        }
    }

    return nearest;
}

/**
 * Calculate the opening geometry for a door/window on a wall edge
 */
export function calculateOpening(
    asset: { x: number; y: number; width: number; rotation: number },
    edgeStart: Point,
    edgeEnd: Point,
    wallThickness: number
): { left: Point; right: Point } | null {
    // Project asset position onto the wall edge
    const { projection, t } = pointToLineDistance(asset, edgeStart, edgeEnd);

    // Check if opening is within the edge bounds
    if (t < 0.01 || t > 0.99) return null;

    // Calculate perpendicular direction
    const dx = edgeEnd.x - edgeStart.x;
    const dy = edgeEnd.y - edgeStart.y;
    const length = Math.sqrt(dx * dx + dy * dy);

    if (length === 0) return null;

    const perpX = -dy / length;
    const perpY = dx / length;

    // Calculate opening width along the wall
    const halfWidth = asset.width / 2;
    const dirX = dx / length;
    const dirY = dy / length;

    const offset = wallThickness / 2;

    return {
        left: {
            x: projection.x - dirX * halfWidth + perpX * offset,
            y: projection.y - dirY * halfWidth + perpY * offset,
        },
        right: {
            x: projection.x + dirX * halfWidth + perpX * offset,
            y: projection.y + dirY * halfWidth + perpY * offset,
        },
    };
}
