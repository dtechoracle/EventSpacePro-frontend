import { ASSET_LIBRARY } from "@/lib/assets";

interface EventData {
    _id: string;
    name: string;
    canvasData?: {
        walls: any[];
        shapes: any[];
        assets: any[];
        layers?: any[];
        canvas?: any;
    };
    canvasAssets?: any[];
    projectId: string;
    projectName?: string;
    projectSlug?: string;
    createdAt: string;
    updatedAt: string;
    favourites?: string[];
    favorites?: string[];
}

export const buildPreviewData = (event: EventData | any) => {
    // PRIORITY 1: Use canvasData if available (preferred format)
    const walls = (event.canvasData?.walls as any[]) || [];
    const rawShapes = (event.canvasData?.shapes as any[]) || [];
    const rawAssets = (event.canvasData?.assets as any[]) || [];

    // Normalize shapes to ensure fill property is set - match ShapeRenderer logic
    // Preserve ALL properties including width, height, x, y, etc.
    const shapes = rawShapes.map((s: any) => {
        // Use fill if it exists and is not empty/transparent, otherwise use backgroundColor, otherwise transparent
        const fill = (s.fill && s.fill !== 'transparent' && s.fill !== '')
            ? s.fill
            : (s.backgroundColor && s.backgroundColor !== 'transparent' && s.backgroundColor !== '')
                ? s.backgroundColor
                : 'transparent';
        return {
            ...s, // Preserve all original properties (width, height, x, y, rotation, stroke, strokeWidth, etc.)
            fill: fill, // Override fill with normalized value
        };
    });

    // Normalize assets to ensure fillColor property is set
    const assets = rawAssets.map((a: any) => ({
        ...a,
        fillColor: a.fillColor || a.backgroundColor || '#3B82F6',
    }));

    // If canvasData already has preview data, use it
    if (walls.length > 0 || shapes.length > 0 || assets.length > 0) {
        return { walls, shapes, assets };
    }

    // PRIORITY 2: Fallback to canvasAssets (most events use this format)
    // Fallback: derive preview data from canvasAssets (new editor format)
    const fallbackWalls: any[] = [];
    const fallbackShapes: any[] = [];
    const fallbackAssets: any[] = [];

    if (event.canvasAssets && Array.isArray(event.canvasAssets)) {
        event.canvasAssets.forEach((asset: any) => {
            // Handle wall-polygon type (new format)
            if (asset.type === "wall-polygon" && asset.wallPolygon && Array.isArray(asset.wallPolygon)) {
                // Convert wall-polygon to wall format with nodes and edges
                const wallNodes = asset.wallPolygon.map((point: any, idx: number) => ({
                    id: `node-${asset.id}-${idx}`,
                    x: asset.x + (point.x || 0),
                    y: asset.y + (point.y || 0),
                }));

                // Create edges connecting consecutive nodes
                const wallEdges = [];
                for (let i = 0; i < wallNodes.length; i++) {
                    const nextIdx = (i + 1) % wallNodes.length;
                    wallEdges.push({
                        id: `edge-${asset.id}-${i}`,
                        nodeA: wallNodes[i].id,
                        nodeB: wallNodes[nextIdx].id,
                        thickness: asset.wallThickness || 75,
                    });
                }

                if (wallNodes.length > 0 && wallEdges.length > 0) {
                    fallbackWalls.push({
                        id: asset.id,
                        nodes: wallNodes,
                        edges: wallEdges,
                        zIndex: asset.zIndex || 0,
                    });
                }
            }
            // Handle wall-segments type (legacy format)
            else if (asset.type === "wall-segments" && asset.wallNodes && asset.wallEdges) {
                const wallNodes = asset.wallNodes.map((node: any, idx: number) => ({
                    id: `node-${asset.id}-${idx}`,
                    x: node.x,
                    y: node.y,
                }));

                const wallEdges = asset.wallEdges.map((edge: any, idx: number) => ({
                    id: `edge-${asset.id}-${idx}`,
                    nodeA: wallNodes[edge.a]?.id || "",
                    nodeB: wallNodes[edge.b]?.id || "",
                    thickness: asset.wallThickness || 75,
                }));

                fallbackWalls.push({
                    id: asset.id,
                    nodes: wallNodes,
                    edges: wallEdges,
                    zIndex: asset.zIndex || 0,
                });
            }
            // Handle line-segment type (convert to line shape)
            else if (asset.type === "line-segment" && asset.startPoint && asset.endPoint) {
                // Convert line-segment to line shape format
                const startX = asset.startPoint.x || asset.x;
                const startY = asset.startPoint.y || asset.y;
                const endX = asset.endPoint.x || (asset.x + asset.width);
                const endY = asset.endPoint.y || (asset.y + asset.height);

                fallbackShapes.push({
                    id: asset.id,
                    type: "line",
                    x: (startX + endX) / 2, // Center point
                    y: (startY + endY) / 2, // Center point
                    width: Math.sqrt(Math.pow(endX - startX, 2) + Math.pow(endY - startY, 2)), // Length
                    height: 2, // Line thickness
                    rotation: asset.rotation || 0,
                    fill: asset.backgroundColor || "transparent",
                    stroke: asset.strokeColor || "#3B82F6",
                    strokeWidth: asset.strokeWidth || 2,
                    points: [
                        { x: startX - (startX + endX) / 2, y: startY - (startY + endY) / 2 },
                        { x: endX - (startX + endX) / 2, y: endY - (startY + endY) / 2 },
                    ],
                    zIndex: asset.zIndex || 0,
                });
            }
            // Handle standard shape types (rectangle, ellipse, line, arrow, freehand)
            else if (
                asset.type &&
                ["rectangle", "ellipse", "line", "arrow", "freehand"].includes(asset.type)
            ) {
                // Use reasonable defaults for missing dimensions
                const defaultWidth = asset.width || 100;
                const defaultHeight = asset.height || 100;

                fallbackShapes.push({
                    id: asset.id,
                    type: asset.type,
                    x: asset.x || 0,
                    y: asset.y || 0,
                    width: defaultWidth,
                    height: defaultHeight,
                    rotation: asset.rotation || 0,
                    fill: asset.fillColor || asset.backgroundColor || asset.fill || 'transparent',
                    stroke: asset.strokeColor || asset.stroke || "#1E40AF",
                    strokeWidth: asset.strokeWidth || 2,
                    points: asset.points,
                    zIndex: asset.zIndex || 0,
                });
            }
            // Handle other asset types (furniture, etc.)
            else if (asset.type) {
                // Use reasonable defaults based on asset type for preview
                let defaultWidth = asset.width || 100;
                let defaultHeight = asset.height || 100;

                if (asset.type.includes('chair')) {
                    defaultWidth = asset.width || 80;
                    defaultHeight = asset.height || 80;
                } else if (asset.type.includes('table') || asset.type.includes('cocktail')) {
                    defaultWidth = asset.width || 200;
                    defaultHeight = asset.height || 200;
                }

                fallbackAssets.push({
                    id: asset.id,
                    type: asset.type, // Preserve the original type so ASSET_LIBRARY lookup works
                    x: asset.x || 0,
                    y: asset.y || 0,
                    width: defaultWidth,
                    height: defaultHeight,
                    rotation: asset.rotation || 0,
                    scale: asset.scale || 1,
                    fillColor: asset.fillColor || asset.backgroundColor,
                    strokeColor: asset.strokeColor,
                    strokeWidth: asset.strokeWidth,
                    opacity: asset.opacity,
                    zIndex: asset.zIndex || 0,
                });
            }
        });
    }

    return { walls: fallbackWalls, shapes: fallbackShapes, assets: fallbackAssets };
};
