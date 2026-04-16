import { Wall, WallNode, WallEdge } from '@/store/projectStore';

/**
 * Finds the closest point on a line segment to a given point
 */
export function getClosestPointOnSegment(
    point: { x: number; y: number },
    segmentStart: { x: number; y: number },
    segmentEnd: { x: number; y: number }
): { x: number; y: number; t: number } {
    const dx = segmentEnd.x - segmentStart.x;
    const dy = segmentEnd.y - segmentStart.y;
    const lengthSquared = dx * dx + dy * dy;

    if (lengthSquared === 0) {
        return { x: segmentStart.x, y: segmentStart.y, t: 0 };
    }

    // Calculate parameter t (0 to 1) representing position along segment
    const t = Math.max(
        0,
        Math.min(
            1,
            ((point.x - segmentStart.x) * dx + (point.y - segmentStart.y) * dy) / lengthSquared
        )
    );

    return {
        x: segmentStart.x + t * dx,
        y: segmentStart.y + t * dy,
        t,
    };
}

/**
 * Finds the intersection point between two line segments
 */
export function getLineSegmentIntersection(
    segmentAStart: { x: number; y: number },
    segmentAEnd: { x: number; y: number },
    segmentBStart: { x: number; y: number },
    segmentBEnd: { x: number; y: number }
): { point: { x: number; y: number }; tSegment: number; tEdge: number } | null {
    const x1 = segmentAStart.x;
    const y1 = segmentAStart.y;
    const x2 = segmentAEnd.x;
    const y2 = segmentAEnd.y;
    const x3 = segmentBStart.x;
    const y3 = segmentBStart.y;
    const x4 = segmentBEnd.x;
    const y4 = segmentBEnd.y;

    const denominator = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);
    if (Math.abs(denominator) < 0.0001) {
        return null;
    }

    const tSegment = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / denominator;
    const tEdge = -((x1 - x2) * (y1 - y3) - (y1 - y2) * (x1 - x3)) / denominator;

    if (tSegment < 0 || tSegment > 1 || tEdge < 0 || tEdge > 1) {
        return null;
    }

    return {
        point: {
            x: x1 + tSegment * (x2 - x1),
            y: y1 + tSegment * (y2 - y1),
        },
        tSegment,
        tEdge,
    };
}

export type WallSegmentIntersection = {
    wallId: string;
    edgeId: string;
    point: { x: number; y: number };
    nodeA: WallNode;
    nodeB: WallNode;
    tSegment: number;
    tEdge: number;
};

function getLineLineIntersectionWithSegmentLimit(
    segmentAStart: { x: number; y: number },
    segmentAEnd: { x: number; y: number },
    segmentBStart: { x: number; y: number },
    segmentBEnd: { x: number; y: number },
    maxTSegment: number
): { point: { x: number; y: number }; tSegment: number; tEdge: number } | null {
    const x1 = segmentAStart.x;
    const y1 = segmentAStart.y;
    const x2 = segmentAEnd.x;
    const y2 = segmentAEnd.y;
    const x3 = segmentBStart.x;
    const y3 = segmentBStart.y;
    const x4 = segmentBEnd.x;
    const y4 = segmentBEnd.y;

    const denominator = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);
    if (Math.abs(denominator) < 0.0001) {
        return null;
    }

    const tSegment = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / denominator;
    const tEdge = -((x1 - x2) * (y1 - y3) - (y1 - y2) * (x1 - x3)) / denominator;

    if (tSegment < 0 || tSegment > maxTSegment || tEdge < 0 || tEdge > 1) {
        return null;
    }

    return {
        point: {
            x: x1 + tSegment * (x2 - x1),
            y: y1 + tSegment * (y2 - y1),
        },
        tSegment,
        tEdge,
    };
}

/**
 * Finds all wall-edge intersections along a proposed segment.
 * Results are sorted from the segment start toward the segment end.
 */
export function findWallIntersectionsAlongSegment(
    segmentStart: { x: number; y: number },
    segmentEnd: { x: number; y: number },
    walls: Wall[],
    excludeWallId?: string,
    tolerance: number = 0.001
): WallSegmentIntersection[] {
    const intersections: WallSegmentIntersection[] = [];

    for (const wall of walls) {
        if (excludeWallId && wall.id === excludeWallId) continue;

        const nodeMap = new Map(wall.nodes.map((node) => [node.id, node]));

        for (const edge of wall.edges) {
            const nodeA = nodeMap.get(edge.nodeA);
            const nodeB = nodeMap.get(edge.nodeB);
            if (!nodeA || !nodeB) continue;

            const intersection = getLineSegmentIntersection(segmentStart, segmentEnd, nodeA, nodeB);
            if (!intersection) continue;

            if (
                intersection.tSegment <= tolerance ||
                intersection.tSegment >= 1 - tolerance ||
                intersection.tEdge <= tolerance ||
                intersection.tEdge >= 1 - tolerance
            ) {
                continue;
            }

            intersections.push({
                wallId: wall.id,
                edgeId: edge.id,
                point: intersection.point,
                nodeA,
                nodeB,
                tSegment: intersection.tSegment,
                tEdge: intersection.tEdge,
            });
        }
    }

    intersections.sort((a, b) => a.tSegment - b.tSegment);

    return intersections.filter((intersection, index, sorted) => {
        if (index === 0) return true;
        const previous = sorted[index - 1];
        return Math.hypot(
            intersection.point.x - previous.point.x,
            intersection.point.y - previous.point.y
        ) > 0.5;
    });
}

/**
 * Finds intersections using the visual wall thickness, so crossing starts to
 * register as soon as the proposed wall overlaps the target wall body.
 */
export function findWallIntersectionsAlongExtendedSegment(
    segmentStart: { x: number; y: number },
    segmentEnd: { x: number; y: number },
    segmentThickness: number,
    walls: Wall[],
    excludeWallId?: string,
    tolerance: number = 0.001
): WallSegmentIntersection[] {
    const intersections: WallSegmentIntersection[] = [];
    const segmentDx = segmentEnd.x - segmentStart.x;
    const segmentDy = segmentEnd.y - segmentStart.y;
    const segmentLength = Math.hypot(segmentDx, segmentDy);

    if (segmentLength < 0.0001) return intersections;

    for (const wall of walls) {
        if (excludeWallId && wall.id === excludeWallId) continue;

        const nodeMap = new Map(wall.nodes.map((node) => [node.id, node]));

        for (const edge of wall.edges) {
            const nodeA = nodeMap.get(edge.nodeA);
            const nodeB = nodeMap.get(edge.nodeB);
            if (!nodeA || !nodeB) continue;

            const visualExtension = ((segmentThickness || 150) + (edge.thickness || 150)) / 2;
            const maxTSegment = 1 + (visualExtension / segmentLength);
            const intersection = getLineLineIntersectionWithSegmentLimit(
                segmentStart,
                segmentEnd,
                nodeA,
                nodeB,
                maxTSegment
            );
            if (!intersection) continue;

            if (
                intersection.tSegment <= tolerance ||
                intersection.tEdge <= tolerance ||
                intersection.tEdge >= 1 - tolerance
            ) {
                continue;
            }

            intersections.push({
                wallId: wall.id,
                edgeId: edge.id,
                point: intersection.point,
                nodeA,
                nodeB,
                tSegment: intersection.tSegment,
                tEdge: intersection.tEdge,
            });
        }
    }

    intersections.sort((a, b) => a.tSegment - b.tSegment);

    return intersections.filter((intersection, index, sorted) => {
        if (index === 0) return true;
        const previous = sorted[index - 1];
        return Math.hypot(
            intersection.point.x - previous.point.x,
            intersection.point.y - previous.point.y
        ) > 0.5;
    });
}

/**
 * Finds if a point is near any wall edge in the given walls array
 * Returns the wall, edge, and exact snap point if found
 */
export function findWallIntersection(
    point: { x: number; y: number },
    walls: Wall[],
    threshold: number = 10,
    excludeWallId?: string
): {
    wallId: string;
    edgeId: string;
    point: { x: number; y: number };
    nodeA: WallNode;
    nodeB: WallNode;
    t: number;
} | null {
    let closestIntersection: {
        wallId: string;
        edgeId: string;
        point: { x: number; y: number };
        nodeA: WallNode;
        nodeB: WallNode;
        t: number;
        distance: number;
    } | null = null;

    for (const wall of walls) {
        if (excludeWallId && wall.id === excludeWallId) continue;

        const nodeMap = new Map(wall.nodes.map((n) => [n.id, n]));

        for (const edge of wall.edges) {
            const nodeA = nodeMap.get(edge.nodeA);
            const nodeB = nodeMap.get(edge.nodeB);

            if (!nodeA || !nodeB) continue;

            const closest = getClosestPointOnSegment(point, nodeA, nodeB);
            const distance = Math.sqrt(
                (point.x - closest.x) ** 2 + (point.y - closest.y) ** 2
            );

            // Only consider points that are:
            // 1. Within threshold distance
            // 2. Not at the endpoints (t > 0.05 and t < 0.95)
            if (distance <= threshold && closest.t > 0.05 && closest.t < 0.95) {
                if (!closestIntersection || distance < closestIntersection.distance) {
                    closestIntersection = {
                        wallId: wall.id,
                        edgeId: edge.id,
                        point: closest,
                        nodeA,
                        nodeB,
                        t: closest.t,
                        distance,
                    };
                }
            }
        }
    }

    if (!closestIntersection) return null;

    const { distance, ...result } = closestIntersection;
    return result;
}

/**
 * Splits a wall edge at a given point, creating a new node
 * Returns the new node and updated edges
 */
export function splitWallAtPoint(
    wall: Wall,
    edgeId: string,
    point: { x: number; y: number }
): {
    newNode: WallNode;
    updatedEdges: WallEdge[];
    removedEdgeId: string;
} {
    const edge = wall.edges.find((e) => e.id === edgeId);
    if (!edge) {
        throw new Error(`Edge ${edgeId} not found in wall ${wall.id}`);
    }

    // Create new node at the split point
    const newNode: WallNode = {
        id: `node-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        x: point.x,
        y: point.y,
    };

    // Create two new edges to replace the original edge
    const edge1: WallEdge = {
        id: `edge-${Date.now()}-a`,
        nodeA: edge.nodeA,
        nodeB: newNode.id,
        thickness: edge.thickness,
    };

    const edge2: WallEdge = {
        id: `edge-${Date.now()}-b`,
        nodeA: newNode.id,
        nodeB: edge.nodeB,
        thickness: edge.thickness,
    };

    // Return the new node and edges, excluding the original edge
    const updatedEdges = wall.edges
        .filter((e) => e.id !== edgeId)
        .concat([edge1, edge2]);

    return {
        newNode,
        updatedEdges,
        removedEdgeId: edgeId,
    };
}

/**
 * Checks if two points are at the same location (within tolerance)
 */
export function arePointsEqual(
    p1: { x: number; y: number },
    p2: { x: number; y: number },
    tolerance: number = 0.1
): boolean {
    return Math.abs(p1.x - p2.x) < tolerance && Math.abs(p1.y - p2.y) < tolerance;
}

/**
 * Finds a node at a specific location in a wall
 */
export function findNodeAtPoint(
    wall: Wall,
    point: { x: number; y: number },
    tolerance: number = 0.1
): WallNode | null {
    return wall.nodes.find((node) => arePointsEqual(node, point, tolerance)) || null;
}
