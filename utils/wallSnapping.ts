import { Wall, Shape, Asset } from '@/store/projectStore';
import { getClosestPointOnSegment } from './wallSplitting';

export interface SnapResult {
    snapped: boolean;
    x: number;
    y: number;
    snapType?: 'wall-edge' | 'wall-node' | 'grid';
    wallId?: string;
    edgeId?: string;
}

/**
 * Finds the nearest point on any wall edge to snap to
 */
export function findWallSnapPoint(
    point: { x: number; y: number },
    walls: Wall[],
    snapDistance: number = 15
): SnapResult {
    let closestSnap: SnapResult = {
        snapped: false,
        x: point.x,
        y: point.y,
    };
    let minDistance = snapDistance;

    // Check all wall edges
    for (const wall of walls) {
        const nodeMap = new Map(wall.nodes.map(n => [n.id, n]));

        // Check wall nodes first (corners)
        for (const node of wall.nodes) {
            const dist = Math.hypot(point.x - node.x, point.y - node.y);
            if (dist < minDistance) {
                minDistance = dist;
                closestSnap = {
                    snapped: true,
                    x: node.x,
                    y: node.y,
                    snapType: 'wall-node',
                    wallId: wall.id,
                };
            }
        }

        // Check wall edges (centerline and faces)
        for (const edge of wall.edges) {
            const nodeA = nodeMap.get(edge.nodeA);
            const nodeB = nodeMap.get(edge.nodeB);

            if (!nodeA || !nodeB) continue;

            // 1. Centerline snap
            const closest = getClosestPointOnSegment(point, nodeA, nodeB);
            const dist = Math.hypot(point.x - closest.x, point.y - closest.y);

            if (dist < minDistance && closest.t > 0.01 && closest.t < 0.99) {
                minDistance = dist;
                closestSnap = {
                    snapped: true,
                    x: closest.x,
                    y: closest.y,
                    snapType: 'wall-edge',
                    wallId: wall.id,
                    edgeId: edge.id,
                };
            }

            // 2. Face snapping (offset by thickness/2)
            const dx = nodeB.x - nodeA.x;
            const dy = nodeB.y - nodeA.y;
            const length = Math.hypot(dx, dy);
            if (length > 0) {
                const thickness = edge.thickness || 150;
                const halfThick = thickness / 2;
                const nx = -dy / length; // Normal X
                const ny = dx / length;  // Normal Y
                
                // Left face and Right face
                const faces = [
                    { x: closest.x + nx * halfThick, y: closest.y + ny * halfThick },
                    { x: closest.x - nx * halfThick, y: closest.y - ny * halfThick }
                ];

                for (const facePt of faces) {
                    const faceDist = Math.hypot(point.x - facePt.x, point.y - facePt.y);
                    if (faceDist < minDistance) {
                        minDistance = faceDist;
                        closestSnap = {
                            snapped: true,
                            x: facePt.x,
                            y: facePt.y,
                            snapType: 'wall-edge',
                            wallId: wall.id,
                            edgeId: edge.id,
                        };
                    }
                }
            }
        }
    }

    return closestSnap;
}

/**
 * Combined snap function that checks walls AND grid
 */
export function findSnapPoint(
    point: { x: number; y: number },
    walls: Wall[],
    snapToGrid: boolean,
    gridSize: number,
    wallSnapDistance: number = 15
): SnapResult {
    // First try wall snapping (higher priority)
    const wallSnap = findWallSnapPoint(point, walls, wallSnapDistance);

    if (wallSnap.snapped) {
        return wallSnap;
    }

    // Fall back to grid snapping
    if (snapToGrid) {
        return {
            snapped: true,
            x: Math.round(point.x / gridSize) * gridSize,
            y: Math.round(point.y / gridSize) * gridSize,
            snapType: 'grid',
        };
    }

    // No snapping
    return {
        snapped: false,
        x: point.x,
        y: point.y,
    };
}
