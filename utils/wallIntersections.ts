import { Wall, WallNode, WallEdge } from '@/store/projectStore';
import { getClosestPointOnSegment } from './wallSplitting';

/**
 * Finds all intersection points between two walls
 */
export function findWallIntersections(wall1: Wall, wall2: Wall): Array<{
    wall1EdgeId: string;
    wall2EdgeId: string;
    point: { x: number; y: number };
    t1: number; // parametric position on wall1 edge
    t2: number; // parametric position on wall2 edge
}> {
    const intersections: Array<{
        wall1EdgeId: string;
        wall2EdgeId: string;
        point: { x: number; y: number };
        t1: number;
        t2: number;
    }> = [];

    const nodeMap1 = new Map(wall1.nodes.map(n => [n.id, n]));
    const nodeMap2 = new Map(wall2.nodes.map(n => [n.id, n]));

    // Check each edge of wall1 against each edge of wall2
    for (const edge1 of wall1.edges) {
        const node1A = nodeMap1.get(edge1.nodeA);
        const node1B = nodeMap1.get(edge1.nodeB);
        if (!node1A || !node1B) continue;

        for (const edge2 of wall2.edges) {
            const node2A = nodeMap2.get(edge2.nodeA);
            const node2B = nodeMap2.get(edge2.nodeB);
            if (!node2A || !node2B) continue;

            // Calculate line-line intersection
            const intersection = getLineLineIntersection(
                node1A, node1B,
                node2A, node2B
            );

            if (intersection && intersection.t1 > 0.05 && intersection.t1 < 0.95 &&
                intersection.t2 > 0.05 && intersection.t2 < 0.95) {
                intersections.push({
                    wall1EdgeId: edge1.id,
                    wall2EdgeId: edge2.id,
                    point: intersection.point,
                    t1: intersection.t1,
                    t2: intersection.t2,
                });
            }
        }
    }

    return intersections;
}

/**
 * Calculates the intersection point of two line segments
 */
function getLineLineIntersection(
    p1: { x: number; y: number },
    p2: { x: number; y: number },
    p3: { x: number; y: number },
    p4: { x: number; y: number }
): { point: { x: number; y: number }; t1: number; t2: number } | null {
    const x1 = p1.x, y1 = p1.y;
    const x2 = p2.x, y2 = p2.y;
    const x3 = p3.x, y3 = p3.y;
    const x4 = p4.x, y4 = p4.y;

    const denom = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);

    // Lines are parallel
    if (Math.abs(denom) < 0.0001) return null;

    const t1 = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / denom;
    const t2 = -((x1 - x2) * (y1 - y3) - (y1 - y2) * (x1 - x3)) / denom;

    // Check if intersection is within both line segments
    if (t1 >= 0 && t1 <= 1 && t2 >= 0 && t2 <= 1) {
        return {
            point: {
                x: x1 + t1 * (x2 - x1),
                y: y1 + t1 * (y2 - y1),
            },
            t1,
            t2,
        };
    }

    return null;
}

/**
 * Automatically merges all intersecting walls in the project
 */
export function autoMergeWallIntersections(
    walls: Wall[],
    splitWallEdge: (wallId: string, edgeId: string, point: { x: number; y: number }) => WallNode | null
): void {
    // Process each pair of walls
    for (let i = 0; i < walls.length; i++) {
        for (let j = i + 1; j < walls.length; j++) {
            const wall1 = walls[i];
            const wall2 = walls[j];

            const intersections = findWallIntersections(wall1, wall2);

            // Split edges at intersection points
            for (const intersection of intersections) {
                // Split both edges at the intersection point
                splitWallEdge(wall1.id, intersection.wall1EdgeId, intersection.point);
                splitWallEdge(wall2.id, intersection.wall2EdgeId, intersection.point);
            }
        }
    }
}
