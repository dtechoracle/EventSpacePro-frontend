import { Asset } from '@/store/projectStore';
import { Wall } from '@/store/projectStore';

export interface WallCutout {
    assetId: string;
    wallId: string;
    edgeId: string;
    startParam: number;
    endParam: number;
    width: number;
}

export function isCutoutAsset(asset: Partial<Asset>): boolean {
    const id = (asset.id || '').toLowerCase();
    const type = (asset.type || '').toLowerCase();
    return id.includes('door') ||
        id.includes('window') ||
        id.includes('group 91') ||
        id.includes('group-91') ||
        type.includes('door') ||
        type.includes('window') ||
        type.includes('group 91') ||
        type.includes('group-91');
}

export function detectWallCutout(
    asset: Asset,
    wall: Wall,
    threshold = 50
): WallCutout | null {
    // Check if it's a door/window by id, type, or path
    const isDoorOrWindow = isCutoutAsset(asset);

    if (!isDoorOrWindow || !asset.x || !asset.y || !asset.width) {
        return null;
    }

    const assetCenterX = asset.x;
    const assetCenterY = asset.y;
    const assetWidth = asset.width * (asset.scale || 1);
    const assetHeight = (asset.height || asset.width) * (asset.scale || 1);

    for (const edge of wall.edges) {
        const nodeA = wall.nodes.find(n => n.id === edge.nodeA);
        const nodeB = wall.nodes.find(n => n.id === edge.nodeB);

        if (!nodeA || !nodeB) continue;

        const { distance, param } = distanceToSegment(
            assetCenterX, assetCenterY,
            nodeA.x, nodeA.y, nodeB.x, nodeB.y
        );

        if (distance <= threshold) {
            const edgeLength = Math.hypot(nodeB.x - nodeA.x, nodeB.y - nodeA.y);
            const edgeAngle = Math.atan2(nodeB.y - nodeA.y, nodeB.x - nodeA.x);
            const assetRotation = (asset.rotation || 0) * Math.PI / 180;
            const relativeAngle = Math.abs(assetRotation - edgeAngle);

            const cutoutWidth = Math.abs(Math.cos(relativeAngle)) * assetWidth +
                Math.abs(Math.sin(relativeAngle)) * assetHeight;

            const halfCutout = cutoutWidth / (2 * edgeLength);
            const startParam = Math.max(0, param - halfCutout);
            const endParam = Math.min(1, param + halfCutout);

            return {
                assetId: asset.id,
                wallId: wall.id,
                edgeId: edge.id,
                startParam,
                endParam,
                width: cutoutWidth,
            };
        }
    }

    return null;
}

export function calculateAllCutouts(assets: Asset[], walls: Wall[]): WallCutout[] {
    const cutouts: WallCutout[] = [];

    for (const asset of assets) {
        for (const wall of walls) {
            const cutout = detectWallCutout(asset, wall);
            if (cutout) {
                cutouts.push(cutout);
            }
        }
    }

    return cutouts;
}

export function getCutoutsForEdge(wallId: string, edgeId: string, cutouts: WallCutout[]): WallCutout[] {
    return cutouts.filter(c => c.wallId === wallId && c.edgeId === edgeId);
}

function distanceToSegment(
    px: number, py: number,
    x1: number, y1: number,
    x2: number, y2: number
): { distance: number; param: number; closestPoint: { x: number; y: number } } {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const lenSq = dx * dx + dy * dy;

    if (lenSq === 0) {
        const dist = Math.hypot(px - x1, py - y1);
        return { distance: dist, param: 0, closestPoint: { x: x1, y: y1 } };
    }

    let t = ((px - x1) * dx + (py - y1) * dy) / lenSq;
    t = Math.max(0, Math.min(1, t));

    const closestX = x1 + t * dx;
    const closestY = y1 + t * dy;
    const dist = Math.hypot(px - closestX, py - closestY);

    return {
        distance: dist,
        param: t,
        closestPoint: { x: closestX, y: closestY },
    };
}
