import { Wall, Asset, Shape } from '@/store/projectStore';
import { calculateNodeJunctions } from '@/utils/geometry';
import { getCachedAssetVertices, getMarqueeVertices } from '@/utils/assetUtils';
import { ASSET_LIBRARY } from '@/lib/assets';

export interface SnapPoint {
    x: number;
    y: number;
    type: 'corner' | 'midpoint' | 'edge' | 'center' | 'quad';
    elementId: string;
}

type SnapTarget = Shape | Wall | Asset;

/**
 * Find the closest snap point on a target element
 */
/**
 * Rotate a point around a center
 */
function rotatePoint(x: number, y: number, cx: number, cy: number, angleDeg: number) {
    if (angleDeg === 0) return { x, y };
    const angleRad = (angleDeg * Math.PI) / 180;
    const cos = Math.cos(angleRad);
    const sin = Math.sin(angleRad);
    const dx = x - cx;
    const dy = y - cy;
    return {
        x: cx + dx * cos - dy * sin,
        y: cy + dx * sin + dy * cos
    };
}

function dedupeSnapPoints(points: SnapPoint[], tolerance: number = 1) {
    const seen = new Set<string>();
    const unique: SnapPoint[] = [];

    points.forEach((point) => {
        const key = `${point.elementId}:${Math.round(point.x / tolerance)}:${Math.round(point.y / tolerance)}`;
        if (!seen.has(key)) {
            seen.add(key);
            unique.push(point);
        }
    });

    return unique;
}

export function findClosestSnapPointFromList(
    cursorPos: { x: number; y: number },
    snapPoints: SnapPoint[],
    snapThreshold: number = 20
): SnapPoint | null {
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
 * Get all potential snap points for an element
 */
/**
 * Get all potential snap points for an element
 */
export function getSnapPoints(element: SnapTarget, vertices: { x: number; y: number }[] = []): SnapPoint[] {
    const snapPoints: SnapPoint[] = [];

    // Handle Shapes
    if ('type' in element && (element.type === 'rectangle' || element.type === 'ellipse')) {
        const shape = element as Shape;
        const halfW = shape.width / 2;
        const halfH = shape.height / 2;
        const rot = shape.rotation || 0;

        let rawPoints: { x: number; y: number; type: 'corner' | 'midpoint' | 'center' | 'quad' }[] = [];

        if (shape.type === 'ellipse') {
            rawPoints = [
                { x: shape.x, y: shape.y - halfH, type: 'midpoint' as const },
                { x: shape.x - halfW, y: shape.y, type: 'midpoint' as const },
                { x: shape.x + halfW, y: shape.y, type: 'midpoint' as const },
                { x: shape.x, y: shape.y + halfH, type: 'midpoint' as const },
                { x: shape.x, y: shape.y, type: 'center' as const }
            ];
        } else {
            rawPoints = [
                { x: shape.x - halfW, y: shape.y - halfH, type: 'corner' as const },
                { x: shape.x + halfW, y: shape.y - halfH, type: 'corner' as const },
                { x: shape.x + halfW, y: shape.y + halfH, type: 'corner' as const },
                { x: shape.x - halfW, y: shape.y + halfH, type: 'corner' as const },
                { x: shape.x - halfW / 2, y: shape.y - halfH, type: 'quad' as const },
                { x: shape.x, y: shape.y - halfH, type: 'midpoint' as const },
                { x: shape.x + halfW / 2, y: shape.y - halfH, type: 'quad' as const },
                { x: shape.x + halfW, y: shape.y - halfH / 2, type: 'quad' as const },
                { x: shape.x + halfW, y: shape.y, type: 'midpoint' as const },
                { x: shape.x + halfW, y: shape.y + halfH / 2, type: 'quad' as const },
                { x: shape.x + halfW / 2, y: shape.y + halfH, type: 'quad' as const },
                { x: shape.x, y: shape.y + halfH, type: 'midpoint' as const },
                { x: shape.x - halfW / 2, y: shape.y + halfH, type: 'quad' as const },
                { x: shape.x - halfW, y: shape.y + halfH / 2, type: 'quad' as const },
                { x: shape.x - halfW, y: shape.y, type: 'midpoint' as const },
                { x: shape.x - halfW, y: shape.y - halfH / 2, type: 'quad' as const },
                { x: shape.x, y: shape.y, type: 'center' as const }
            ];
        }

        rawPoints.forEach(p => {
            const rotated = rotatePoint(p.x, p.y, shape.x, shape.y, rot);
            snapPoints.push({ ...rotated, type: p.type, elementId: shape.id });
        });
    }
    // Handle Lines/Polygons
    else if ('points' in element && element.points && element.points.length > 0) {
        const shape = element as Shape;
        const rot = shape.rotation || 0;

        shape.points!.forEach((point, index) => {
            const absPoint = { x: shape.x + point.x, y: shape.y + point.y };
            const rotated = rotatePoint(absPoint.x, absPoint.y, shape.x, shape.y, rot);

            snapPoints.push({
                ...rotated,
                type: 'corner',
                elementId: shape.id
            });

            const nextIndex = (index + 1) % shape.points!.length;
            const nextPoint = shape.points![nextIndex];

            if (shape.type === 'polygon' || index < shape.points!.length - 1) {
                const absMid = {
                    x: shape.x + (point.x + nextPoint.x) / 2,
                    y: shape.y + (point.y + nextPoint.y) / 2
                };
                const rotatedMid = rotatePoint(absMid.x, absMid.y, shape.x, shape.y, rot);
                snapPoints.push({
                    ...rotatedMid,
                    type: 'midpoint',
                    elementId: shape.id
                });
            }
        });

        // Center
        const centerX = shape.points!.reduce((sum, p) => sum + p.x, 0) / shape.points!.length;
        const centerY = shape.points!.reduce((sum, p) => sum + p.y, 0) / shape.points!.length;
        const absCenter = { x: shape.x + centerX, y: shape.y + centerY };
        const rotatedCenter = rotatePoint(absCenter.x, absCenter.y, shape.x, shape.y, rot);
        snapPoints.push({ ...rotatedCenter, type: 'center', elementId: shape.id });
    }
    // Handle Assets
    else if ('type' in element && !('nodes' in element)) { // Asset check
        const asset = element as Asset;
        const assetDef = ASSET_LIBRARY.find((def) => def.id === asset.type);
        const liveVertices = assetDef?.category === 'Marquee' ? getMarqueeVertices(asset) : [];
        const cachedVertices = liveVertices.length > 0
            ? liveVertices
            : (vertices.length > 0 ? vertices : getCachedAssetVertices(asset.id));
        // Use scaled dimensions
        const width = asset.width * (asset.scale || 1);
        const height = asset.height * (asset.scale || 1);
        const halfW = width / 2;
        const halfH = height / 2;
        const rot = asset.rotation || 0;

        const rawPoints = cachedVertices.length > 0 ? [
            { x: asset.x - halfW, y: asset.y - halfH, type: 'corner' as const },
            { x: asset.x + halfW, y: asset.y - halfH, type: 'corner' as const },
            { x: asset.x + halfW, y: asset.y + halfH, type: 'corner' as const },
            { x: asset.x - halfW, y: asset.y + halfH, type: 'corner' as const },
            { x: asset.x, y: asset.y - halfH, type: 'midpoint' as const },
            { x: asset.x + halfW, y: asset.y, type: 'midpoint' as const },
            { x: asset.x, y: asset.y + halfH, type: 'midpoint' as const },
            { x: asset.x - halfW, y: asset.y, type: 'midpoint' as const },
            { x: asset.x, y: asset.y, type: 'center' as const }
        ] : [
            // Corners
            { x: asset.x - halfW, y: asset.y - halfH, type: 'corner' as const },
            { x: asset.x + halfW, y: asset.y - halfH, type: 'corner' as const },
            { x: asset.x + halfW, y: asset.y + halfH, type: 'corner' as const },
            { x: asset.x - halfW, y: asset.y + halfH, type: 'corner' as const },
            // Top side: Q1 (25%), midpoint (50%), Q3 (75%)
            { x: asset.x - halfW / 2, y: asset.y - halfH, type: 'midpoint' as const },
            { x: asset.x,             y: asset.y - halfH, type: 'midpoint' as const },
            { x: asset.x + halfW / 2, y: asset.y - halfH, type: 'midpoint' as const },
            // Bottom side: Q1, midpoint, Q3
            { x: asset.x - halfW / 2, y: asset.y + halfH, type: 'midpoint' as const },
            { x: asset.x,             y: asset.y + halfH, type: 'midpoint' as const },
            { x: asset.x + halfW / 2, y: asset.y + halfH, type: 'midpoint' as const },
            // Left side: Q1, midpoint, Q3
            { x: asset.x - halfW, y: asset.y - halfH / 2, type: 'midpoint' as const },
            { x: asset.x - halfW, y: asset.y,             type: 'midpoint' as const },
            { x: asset.x - halfW, y: asset.y + halfH / 2, type: 'midpoint' as const },
            // Right side: Q1, midpoint, Q3
            { x: asset.x + halfW, y: asset.y - halfH / 2, type: 'midpoint' as const },
            { x: asset.x + halfW, y: asset.y,             type: 'midpoint' as const },
            { x: asset.x + halfW, y: asset.y + halfH / 2, type: 'midpoint' as const },
            // Center
            { x: asset.x, y: asset.y, type: 'center' as const }
        ];

        rawPoints.forEach(p => {
            const rotated = rotatePoint(p.x, p.y, asset.x, asset.y, rot);
            snapPoints.push({ ...rotated, type: p.type, elementId: asset.id });
        });

        if (cachedVertices.length > 0) {
            cachedVertices.forEach(v => {
                snapPoints.push({
                    x: v.x,
                    y: v.y,
                    type: 'corner',
                    elementId: asset.id
                });
            });
        }
    }
    // Handle Walls
    else if ('nodes' in element && 'edges' in element) {
        const wall = element as Wall;
        wall.nodes.forEach(node => {
            snapPoints.push({ x: node.x, y: node.y, type: 'center', elementId: wall.id });
        });

        wall.nodes.forEach((node) => {
            const connectedEdges = wall.edges.flatMap((edge) => {
                if (edge.nodeA === node.id) {
                    const otherNode = wall.nodes.find((n) => n.id === edge.nodeB);
                    return otherNode ? [{ id: edge.id, otherNode, thickness: edge.thickness || 150 }] : [];
                }
                if (edge.nodeB === node.id) {
                    const otherNode = wall.nodes.find((n) => n.id === edge.nodeA);
                    return otherNode ? [{ id: edge.id, otherNode, thickness: edge.thickness || 150 }] : [];
                }
                return [];
            });

            if (connectedEdges.length === 0) return;

            const junctions = calculateNodeJunctions(node, connectedEdges);
            Object.values(junctions).forEach(({ left, right }) => {
                snapPoints.push({ x: left.x, y: left.y, type: 'corner', elementId: wall.id });
                snapPoints.push({ x: right.x, y: right.y, type: 'corner', elementId: wall.id });
            });
        });

                wall.edges.forEach(edge => {
                    const n1 = wall.nodes.find(n => n.id === edge.nodeA);
                    const n2 = wall.nodes.find(n => n.id === edge.nodeB);
                    if (n1 && n2) {
                        const dx = n2.x - n1.x;
                        const dy = n2.y - n1.y;
                        const length = Math.sqrt(dx * dx + dy * dy);

                        // Centerline midpoint
                        snapPoints.push({
                            x: (n1.x + n2.x) / 2,
                            y: (n1.y + n2.y) / 2,
                            type: 'midpoint',
                            elementId: wall.id
                        });

                        if (length > 0) {
                            const thickness = edge.thickness || 150;
                            const halfThick = thickness / 2;
                            const ux = dx / length;
                            const uy = dy / length;
                            const px = -uy * halfThick;
                            const py = ux * halfThick;

                            const midX = (n1.x + n2.x) / 2;
                            const midY = (n1.y + n2.y) / 2;

                            // Left and Right midpoints
                            snapPoints.push(
                                { x: midX + px, y: midY + py, type: 'midpoint', elementId: wall.id },
                                { x: midX - px, y: midY - py, type: 'midpoint', elementId: wall.id }
                            );

                        }
                    }
                });
    }
    return dedupeSnapPoints(snapPoints);
}

/**
 * Closest point on a line segment
 */
function getClosestPointOnSegment(px: number, py: number, x1: number, y1: number, x2: number, y2: number) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const lengthSq = dx * dx + dy * dy;
    if (lengthSq === 0) return { x: x1, y: y1 };

    let t = ((px - x1) * dx + (py - y1) * dy) / lengthSq;
    t = Math.max(0, Math.min(1, t));

    return {
        x: x1 + t * dx,
        y: y1 + t * dy
    };
}

/**
 * Find the closest snap point on a target element
 */
export function findClosestSnapPoint(
    cursorPos: { x: number; y: number },
    element: SnapTarget,
    snapThreshold: number = 20,
    vertices: { x: number; y: number }[] = []
): SnapPoint | null {
    const snapPoints = getSnapPoints(element, vertices);

    // 1. Check discrete snap points first (corners, midpoints, centers)
    // If the cursor is close to a visible snap marker, prefer that exact point
    // instead of allowing nearby edge snapping to override it.
    const discreteSnapPoint = findClosestSnapPointFromList(cursorPos, snapPoints, snapThreshold);
    if (discreteSnapPoint) {
        return discreteSnapPoint;
    }

    let closestPoint: SnapPoint | null = null;
    let closestDistance = snapThreshold;

    // 2. Specialized Edge Snapping for Walls (Inner, Outer, and Center lines)
    if ('nodes' in element && 'edges' in element) {
        const wall = element as Wall;
        wall.edges.forEach(edge => {
            const n1 = wall.nodes.find(n => n.id === edge.nodeA);
            const n2 = wall.nodes.find(n => n.id === edge.nodeB);
            if (n1 && n2) {
                const thickness = edge.thickness || 150;
                const halfThick = thickness / 2;
                const dx = n2.x - n1.x;
                const dy = n2.y - n1.y;
                const len = Math.sqrt(dx * dx + dy * dy);

                if (len > 0) {
                    const ux = dx / len;
                    const uy = dy / len;
                    const px = -uy * halfThick;
                    const py = ux * halfThick;

                    const paths = [
                        { a: n1, b: n2 }, // Centerline
                        { a: { x: n1.x + px, y: n1.y + py }, b: { x: n2.x + px, y: n2.y + py } }, // Inner
                        { a: { x: n1.x - px, y: n1.y - py }, b: { x: n2.x - px, y: n2.y - py } }  // Outer
                    ];

                    paths.forEach(path => {
                        const cp = getClosestPointOnSegment(cursorPos.x, cursorPos.y, path.a.x, path.a.y, path.b.x, path.b.y);
                        const dist = Math.hypot(cursorPos.x - cp.x, cursorPos.y - cp.y);
                        if (dist < closestDistance) {
                            closestDistance = dist;
                            closestPoint = { ...cp, type: 'edge', elementId: wall.id };
                        }
                    });
                }
            }
        });
    }

    // 3. Edge Snapping for Shapes (Rectangle boundaries and Polygons)
    if ('type' in element && (element.type === 'rectangle' || element.type === 'polygon' || element.type === 'line' || element.type === 'polyline')) {
        const shape = element as Shape;
        const rot = shape.rotation || 0;
        
        const getPoints = () => {
             if (shape.type === 'rectangle') {
                 const halfW = shape.width / 2;
                 const halfH = shape.height / 2;
                 return [
                     { x: -halfW, y: -halfH }, { x: halfW, y: -halfH },
                     { x: halfW, y: halfH }, { x: -halfW, y: halfH },
                     { x: -halfW, y: -halfH }
                 ];
             }
             if (shape.points) return [...shape.points, (shape.type === 'polygon' && shape.points.length > 2) ? shape.points[0] : null].filter(Boolean) as {x: number, y: number}[];
             return [];
        };

        const pts = getPoints();
        for (let i = 0; i < pts.length - 1; i++) {
            const p1raw = { x: shape.x + pts[i].x, y: shape.y + pts[i].y };
            const p2raw = { x: shape.x + pts[i+1].x, y: shape.y + pts[i+1].y };
            const p1 = rotatePoint(p1raw.x, p1raw.y, shape.x, shape.y, rot);
            const p2 = rotatePoint(p2raw.x, p2raw.y, shape.x, shape.y, rot);

            const cp = getClosestPointOnSegment(cursorPos.x, cursorPos.y, p1.x, p1.y, p2.x, p2.y);
            const dist = Math.hypot(cursorPos.x - cp.x, cursorPos.y - cp.y);
            if (dist < closestDistance) {
                closestDistance = dist;
                closestPoint = { ...cp, type: 'edge', elementId: shape.id };
            }
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
    snapThreshold: number = 20,
    verticesMap: Record<string, { x: number; y: number }[]> = {}
): SnapPoint | null {
    let closestPoint: SnapPoint | null = null;
    let closestDistance = snapThreshold;

    for (const element of elements) {
        const vertices = verticesMap[element.id] || [];
        const snapPoint = findClosestSnapPoint(cursorPos, element, snapThreshold, vertices);
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
    return findClosestSnapPoint(cursorPos, shape, snapThreshold);
}
