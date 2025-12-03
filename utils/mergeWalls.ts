import { useProjectStore, Wall } from '@/store/projectStore';

/**
 * Finds all intersection points between two walls
 */
function findWallIntersections(wall1: Wall, wall2: Wall): Array<{
    wall1EdgeId: string;
    wall2EdgeId: string;
    point: { x: number; y: number };
}> {
    const intersections: Array<{
        wall1EdgeId: string;
        wall2EdgeId: string;
        point: { x: number; y: number };
    }> = [];

    const nodeMap1 = new Map(wall1.nodes.map(n => [n.id, n]));
    const nodeMap2 = new Map(wall2.nodes.map(n => [n.id, n]));

    for (const edge1 of wall1.edges) {
        const node1A = nodeMap1.get(edge1.nodeA);
        const node1B = nodeMap1.get(edge1.nodeB);
        if (!node1A || !node1B) continue;

        for (const edge2 of wall2.edges) {
            const node2A = nodeMap2.get(edge2.nodeA);
            const node2B = nodeMap2.get(edge2.nodeB);
            if (!node2A || !node2B) continue;

            // Calculate line-line intersection
            const x1 = node1A.x, y1 = node1A.y;
            const x2 = node1B.x, y2 = node1B.y;
            const x3 = node2A.x, y3 = node2A.y;
            const x4 = node2B.x, y4 = node2B.y;

            const denom = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);
            if (Math.abs(denom) < 0.0001) continue; // Parallel

            const t1 = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / denom;
            const t2 = -((x1 - x2) * (y1 - y3) - (y1 - y2) * (x1 - x3)) / denom;

            // Check if intersection is within both segments (not at endpoints)
            if (t1 > 0.05 && t1 < 0.95 && t2 > 0.05 && t2 < 0.95) {
                intersections.push({
                    wall1EdgeId: edge1.id,
                    wall2EdgeId: edge2.id,
                    point: {
                        x: x1 + t1 * (x2 - x1),
                        y: y1 + t1 * (y2 - y1),
                    },
                });
            }
        }
    }

    return intersections;
}

/**
 * Merges all wall intersections in the project
 */
export function mergeAllWallIntersections() {
    const { walls, splitWallEdge } = useProjectStore.getState();

    if (walls.length < 2) {
        console.log('ℹ️ Not enough walls to merge');
        return 0;
    }

    console.log('🔄 Merging wall intersections...');
    let mergeCount = 0;

    // Process each pair of walls
    for (let i = 0; i < walls.length; i++) {
        for (let j = i + 1; j < walls.length; j++) {
            const wall1 = walls[i];
            const wall2 = walls[j];

            const intersections = findWallIntersections(wall1, wall2);

            // Split edges at intersection points
            for (const intersection of intersections) {
                console.log('🔗 Found intersection:', intersection);
                splitWallEdge(wall1.id, intersection.wall1EdgeId, intersection.point);
                splitWallEdge(wall2.id, intersection.wall2EdgeId, intersection.point);
                mergeCount++;
            }
        }
    }

    console.log(`✅ Merged ${mergeCount} intersections`);
    return mergeCount;
}
