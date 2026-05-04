export type Point = { x: number; y: number };

/**
 * Calculates the intersection point of two infinite lines defined by (p1, p2) and (p3, p4).
 * Returns null if lines are parallel.
 */
export function getLineIntersection(p1: Point, p2: Point, p3: Point, p4: Point): Point | null {
    const det = (p2.x - p1.x) * (p4.y - p3.y) - (p4.x - p3.x) * (p2.y - p1.y);
    if (det === 0) return null; // Parallel lines

    const lambda = ((p4.y - p3.y) * (p4.x - p1.x) + (p3.x - p4.x) * (p4.y - p1.y)) / det;

    return {
        x: p1.x + lambda * (p2.x - p1.x),
        y: p1.y + lambda * (p2.y - p1.y),
    };
}

function getLineIntersectionWithParams(
    p1: Point,
    p2: Point,
    p3: Point,
    p4: Point
): { point: Point; t1: number; t2: number } | null {
    const dx1 = p2.x - p1.x;
    const dy1 = p2.y - p1.y;
    const dx2 = p4.x - p3.x;
    const dy2 = p4.y - p3.y;
    const det = dx1 * dy2 - dx2 * dy1;
    if (Math.abs(det) < 0.000001) return null;

    const cx = p3.x - p1.x;
    const cy = p3.y - p1.y;
    const t1 = (cx * dy2 - cy * dx2) / det;
    const t2 = (cx * dy1 - cy * dx1) / det;

    return {
        point: {
            x: p1.x + t1 * dx1,
            y: p1.y + t1 * dy1,
        },
        t1,
        t2,
    };
}

/**
 * Sorts edges connected to a node by angle.
 * Returns an array of edges sorted counter-clockwise.
 */
export function sortEdgesByAngle(
    centerNode: Point,
    edges: Array<{ id: string; otherNode: Point; thickness: number }>
) {
    return edges.sort((a, b) => {
        const angleA = Math.atan2(a.otherNode.y - centerNode.y, a.otherNode.x - centerNode.x);
        const angleB = Math.atan2(b.otherNode.y - centerNode.y, b.otherNode.x - centerNode.x);
        return angleA - angleB;
    });
}

/**
 * Calculates the offset vector for a wall segment.
 */
export function getPerpendicularVector(p1: Point, p2: Point, length: number = 1): Point {
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist === 0) return { x: 0, y: 0 };
    return {
        x: (-dy / dist) * length,
        y: (dx / dist) * length,
    };
}

function distanceBetween(a: Point, b: Point): number {
    return Math.hypot(a.x - b.x, a.y - b.y);
}

/**
 * Calculates the corners of a polygon formed by joining multiple wall segments at a node.
 * Returns a map of edge ID to the two corner points at this node (left and right relative to the edge looking away from node).
 * 
 * FIXED: Properly handles both closed shapes (rectangles) and open shapes (L-shapes, U-shapes) without twisting.
 */
export function calculateNodeJunctions(
    centerNode: Point,
    edges: Array<{ id: string; otherNode: Point; thickness: number }>
) {
    if (edges.length === 0) return {};

    const sortedEdges = sortEdgesByAngle(centerNode, edges);
    const results: Record<string, { left: Point; right: Point }> = {};
    const sideSet: Record<string, { left: boolean; right: boolean }> = {};

    // Single edge - endpoint with perpendicular cap
    if (sortedEdges.length === 1) {
        const edge = sortedEdges[0];
        const perp = getPerpendicularVector(centerNode, edge.otherNode, edge.thickness / 2);
        results[edge.id] = {
            left: { x: centerNode.x + perp.x, y: centerNode.y + perp.y },
            right: { x: centerNode.x - perp.x, y: centerNode.y - perp.y },
        };
        sideSet[edge.id] = { left: true, right: true };
        return results;
    }

    // For 2+ edges, calculate junctions between adjacent edges.
    // When a miter would land too far away or behind the wall rays, fall back
    // to a bevel-style join instead of clamping a bad spike into place.
    const numPairs = sortedEdges.length;

    for (let i = 0; i < numPairs; i++) {
        const current = sortedEdges[i];
        const next = sortedEdges[(i + 1) % sortedEdges.length];

        // Calculate offset lines for current edge (right side)
        const vec1 = { x: current.otherNode.x - centerNode.x, y: current.otherNode.y - centerNode.y };
        const len1 = Math.sqrt(vec1.x * vec1.x + vec1.y * vec1.y);
        const norm1 = { x: vec1.y / len1, y: -vec1.x / len1 }; // Right normal
        const offset1 = { x: norm1.x * (current.thickness / 2), y: norm1.y * (current.thickness / 2) };

        const p1_curr = { x: centerNode.x + offset1.x, y: centerNode.y + offset1.y };
        const p2_curr = { x: current.otherNode.x + offset1.x, y: current.otherNode.y + offset1.y };

        // Calculate offset lines for next edge (left side)
        const vec2 = { x: next.otherNode.x - centerNode.x, y: next.otherNode.y - centerNode.y };
        const len2 = Math.sqrt(vec2.x * vec2.x + vec2.y * vec2.y);
        const norm2 = { x: -vec2.y / len2, y: vec2.x / len2 }; // Left normal
        const offset2 = { x: norm2.x * (next.thickness / 2), y: norm2.y * (next.thickness / 2) };

        const p1_next = { x: centerNode.x + offset2.x, y: centerNode.y + offset2.y };
        const p2_next = { x: next.otherNode.x + offset2.x, y: next.otherNode.y + offset2.y };

        // Find intersection of offset rays. If the infinite-line intersection lands
        // "behind" either wall ray, use a small bevel midpoint instead of creating a spike.
        const rawIntersection = getLineIntersectionWithParams(p1_curr, p2_curr, p1_next, p2_next);

        let currentRightPoint: Point;
        let nextLeftPoint: Point;

        if (!rawIntersection) {
            currentRightPoint = p1_curr;
            nextLeftPoint = p1_next;
        } else {
            const intersectionPoint = rawIntersection.point;
            const miterLimit = Math.max(current.thickness, next.thickness) * 1.6;
            const miterDistance = distanceBetween(centerNode, intersectionPoint);

            // Overly long miters are what produce the visible spikes/caps at
            // corner joins. Fall back to each wall's own offset point so the
            // wall width stays stable and the union forms a bevel naturally.
            if (!Number.isFinite(miterDistance) || miterDistance > miterLimit) {
                currentRightPoint = p1_curr;
                nextLeftPoint = p1_next;
            } else {
                currentRightPoint = intersectionPoint;
                nextLeftPoint = intersectionPoint;
            }
        }

        // Initialize if needed
        if (!results[current.id]) results[current.id] = { left: { x: 0, y: 0 }, right: { x: 0, y: 0 } };
        if (!results[next.id]) results[next.id] = { left: { x: 0, y: 0 }, right: { x: 0, y: 0 } };
        if (!sideSet[current.id]) sideSet[current.id] = { left: false, right: false };
        if (!sideSet[next.id]) sideSet[next.id] = { left: false, right: false };

        // Assign junction point
        results[current.id].right = currentRightPoint;
        results[next.id].left = nextLeftPoint;
        sideSet[current.id].right = true;
        sideSet[next.id].left = true;
    }

    // Fill in missing sides with perpendiculars (for 2-edge case)
    for (const edge of sortedEdges) {
        if (!results[edge.id]) {
            results[edge.id] = { left: { x: 0, y: 0 }, right: { x: 0, y: 0 } };
        }
        if (!sideSet[edge.id]) {
            sideSet[edge.id] = { left: false, right: false };
        }

        // Calculate perpendicular offset matching the junction calculation coordinate system
        const vec = { x: edge.otherNode.x - centerNode.x, y: edge.otherNode.y - centerNode.y };
        const len = Math.sqrt(vec.x * vec.x + vec.y * vec.y);
        if (len === 0) continue;

        // Left normal (counter-clockwise)
        const leftNorm = { x: -vec.y / len, y: vec.x / len };
        const leftOffset = { x: leftNorm.x * (edge.thickness / 2), y: leftNorm.y * (edge.thickness / 2) };

        // Right normal (clockwise)
        const rightNorm = { x: vec.y / len, y: -vec.x / len };
        const rightOffset = { x: rightNorm.x * (edge.thickness / 2), y: rightNorm.y * (edge.thickness / 2) };

        // If left is not set (first edge in 2-edge case)
        if (!sideSet[edge.id].left) {
            results[edge.id].left = { x: centerNode.x + leftOffset.x, y: centerNode.y + leftOffset.y };
            sideSet[edge.id].left = true;
        }

        // If right is not set (last edge in 2-edge case)
        if (!sideSet[edge.id].right) {
            results[edge.id].right = { x: centerNode.x + rightOffset.x, y: centerNode.y + rightOffset.y };
            sideSet[edge.id].right = true;
        }
    }

    return results;
}
