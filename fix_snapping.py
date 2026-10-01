with open('utils/snapToDrawing.ts', 'r', encoding='utf-8') as f:
    c = f.read()

# Fix NaN in findClosestSnapPointFromList
old_find = '''export function findClosestSnapPointFromList(
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
}'''

new_find = '''export function findClosestSnapPointFromList(
    cursorPos: { x: number; y: number },
    snapPoints: SnapPoint[],
    snapThreshold: number = 20
): SnapPoint | null {
    let closestPoint: SnapPoint | null = null;
    let closestDistance = snapThreshold;

    for (const point of snapPoints) {
        if (point == null || isNaN(point.x) || isNaN(point.y)) continue;
        const distance = Math.hypot(cursorPos.x - point.x, cursorPos.y - point.y);
        if (distance < closestDistance) {
            closestDistance = distance;
            closestPoint = point;
        }
    }

    return closestPoint;
}'''

c = c.replace(old_find, new_find)

# Fix NaN in Asset width/height calculation in getSnapPoints
old_asset_dim = '''        // Use scaled dimensions
        const width = asset.width * (asset.scale || 1);
        const height = asset.height * (asset.scale || 1);'''

new_asset_dim = '''        // Use scaled dimensions with safe fallbacks
        const rawW = asset.width || assetDef?.width || 100;
        const rawH = asset.height || assetDef?.height || 100;
        const width = rawW * (asset.scale || 1);
        const height = rawH * (asset.scale || 1);'''

c = c.replace(old_asset_dim, new_asset_dim)

with open('utils/snapToDrawing.ts', 'w', encoding='utf-8') as f:
    f.write(c)

print("Updated utils/snapToDrawing.ts")
