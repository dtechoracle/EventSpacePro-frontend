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

    // Single edge - endpoint with perpendicular cap
    if (sortedEdges.length === 1) {
        const edge = sortedEdges[0];
        const perp = getPerpendicularVector(centerNode, edge.otherNode, edge.thickness / 2);
        results[edge.id] = {
            left: { x: centerNode.x + perp.x, y: centerNode.y + perp.y },
            right: { x: centerNode.x - perp.x, y: centerNode.y - perp.y },
        };
        return results;
    }

    // For 2+ edges, calculate junctions between adjacent edges
    // Key fix: Only process actual adjacent pairs, don't wrap around for 2 edges
    const numPairs = sortedEdges.length === 2 ? 1 : sortedEdges.length;

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

        // Find intersection of offset lines
        let intersection = getLineIntersection(p1_curr, p2_curr, p1_next, p2_next);

        if (!intersection) {
            intersection = p1_curr;
        } else {
            // Clamp extreme intersections
            const maxDist = Math.max(current.thickness, next.thickness) * 3;
            const dist = Math.sqrt(
                (intersection.x - centerNode.x) ** 2 + (intersection.y - centerNode.y) ** 2
            );
            if (dist > maxDist) {
                const angle = Math.atan2(intersection.y - centerNode.y, intersection.x - centerNode.x);
                intersection = {
                    x: centerNode.x + Math.cos(angle) * maxDist,
                    y: centerNode.y + Math.sin(angle) * maxDist,
                };
            }
        }

        // Initialize if needed
        if (!results[current.id]) results[current.id] = { left: { x: 0, y: 0 }, right: { x: 0, y: 0 } };
        if (!results[next.id]) results[next.id] = { left: { x: 0, y: 0 }, right: { x: 0, y: 0 } };

        // Assign junction point
        results[current.id].right = intersection;
        results[next.id].left = intersection;
    }

    // Fill in missing sides with perpendiculars (for 2-edge case)
    for (const edge of sortedEdges) {
        if (!results[edge.id]) {
            results[edge.id] = { left: { x: 0, y: 0 }, right: { x: 0, y: 0 } };
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
        if (results[edge.id].left.x === 0 && results[edge.id].left.y === 0) {
            results[edge.id].left = { x: centerNode.x + leftOffset.x, y: centerNode.y + leftOffset.y };
        }

        // If right is not set (last edge in 2-edge case)
        if (results[edge.id].right.x === 0 && results[edge.id].right.y === 0) {
            results[edge.id].right = { x: centerNode.x + rightOffset.x, y: centerNode.y + rightOffset.y };
        }
    }

    return results;
}
