
export const convertPlanToCanvasData = (plan: any, canvasWidth = 10000, canvasHeight = 10000) => {
    if (!plan) return { assets: [], walls: [], shapes: [] };

    const assets: any[] = [];
    const createdAssetsInBatch: any[] = [];
    const canvasCenter = { x: canvasWidth / 2, y: canvasHeight / 2 };

    // Helper to add asset
    const addAsset = (asset: any) => {
        assets.push(asset);
        createdAssetsInBatch.push(asset);
    };

    // Find empty space (simplified for new canvas)
    const findEmptySpace = (requiredWidth: number, requiredHeight: number): { x: number; y: number } => {
        // Simple grid search or just return center if empty
        if (createdAssetsInBatch.length === 0) return canvasCenter;

        const margin = 100;
        const edgeMargin = 1000;
        // ... (simplified logic: just offset from center if occupied)
        // For now, let's just place them in a grid logic if explicit position isn't given
        return canvasCenter;
    };

    // --- LOGIC PORTED FROM AiTrigger.tsx ---

    let wallBounds: { minX: number; minY: number; maxX: number; maxY: number } | null = null;

    // 1. Walls
    if (Array.isArray(plan.walls)) {
        plan.walls.forEach((w: any, idx: number) => {
            const width = Number(w.widthMm || 0);
            const height = Number(w.heightMm || 0);
            let cx = Number(w.centerX);
            let cy = Number(w.centerY);

            // Default to center if missing
            if (!cx || !cy || !isFinite(cx) || !isFinite(cy)) {
                cx = canvasCenter.x;
                cy = canvasCenter.y;
            }

            // Calculate wall bounds for first wall
            if (idx === 0) {
                wallBounds = {
                    minX: cx - width / 2,
                    minY: cy - height / 2,
                    maxX: cx + width / 2,
                    maxY: cy + height / 2
                };
            }

            const halfW = width / 2;
            const halfH = height / 2;
            const nodes = [
                { x: cx - halfW, y: cy - halfH },
                { x: cx + halfW, y: cy - halfH },
                { x: cx + halfW, y: cy + halfH },
                { x: cx - halfW, y: cy + halfH },
            ];
            const edges = [
                { a: 0, b: 1 },
                { a: 1, b: 2 },
                { a: 2, b: 3 },
                { a: 3, b: 0 },
            ];

            addAsset({
                id: `wall-${Date.now()}-${idx}`,
                type: "wall-segments",
                x: cx,
                y: cy,
                scale: 1,
                rotation: 0,
                zIndex: 0,
                wallNodes: nodes,
                wallEdges: edges,
                wallThickness: w.thicknessPx ?? 10,
                wallGap: 8,
                lineColor: "#000000",
                backgroundColor: "transparent",
            });
        });
    }

    // Positions for auto-layout
    const clampInWall = (x: number, y: number) => {
        // If we have wall bounds, clamp x/y to be inside
        if (wallBounds) {
            return {
                x: Math.max(wallBounds.minX + 200, Math.min(wallBounds.maxX - 200, x)),
                y: Math.max(wallBounds.minY + 200, Math.min(wallBounds.maxY - 200, y))
            };
        }
        return { x, y };
    };

    // 2. Assets - new comprehensive asset placement by name
    if (Array.isArray(plan.assets)) {
        plan.assets.forEach((assetSpec: any, idx: number) => {
            const assetType = assetSpec.assetType || assetSpec.assetName;
            const width = Number(assetSpec.widthMm || assetSpec.width || 500);
            const height = Number(assetSpec.heightMm || assetSpec.height || 500);
            let x = Number(assetSpec.xMm || assetSpec.x);
            let y = Number(assetSpec.yMm || assetSpec.y);

            // Auto-layout if missing or invalid
            if (!isFinite(x) || !isFinite(y) || Math.abs(x) > 100000 || Math.abs(y) > 100000) {
                const emptySpace = findEmptySpace(width, height);
                x = emptySpace.x;
                y = emptySpace.y;
            }

            const pos = clampInWall(x, y);
            addAsset({
                id: `asset-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 7)}`,
                type: assetType,
                x: pos.x,
                y: pos.y,
                scale: 1,
                rotation: Number(assetSpec.rotation || 0),
                zIndex: 1,
                width,
                height,
                fillColor: assetSpec.fillColor,
                strokeColor: assetSpec.strokeColor,
                backgroundColor: assetSpec.fillColor || 'transparent',
            });
        });
    }

    // 3. Shapes - rectangles, circles, lines
    if (Array.isArray(plan.shapes)) {
        plan.shapes.forEach((shape: any, idx: number) => {
            let x = Number(shape.x);
            let y = Number(shape.y);
            const width = Number(shape.width || 100);
            const height = Number(shape.height || 100);

            if (!isFinite(x) || !isFinite(y)) {
                const emptySpace = findEmptySpace(width, height);
                x = emptySpace.x;
                y = emptySpace.y;
            }

            const pos = clampInWall(x, y);
            addAsset({
                id: `shape-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 7)}`,
                type: shape.type === 'circle' ? 'ellipse' : shape.type,
                x: pos.x,
                y: pos.y,
                scale: 1,
                rotation: 0,
                zIndex: 1,
                width,
                height,
                fillColor: shape.fillColor || '#3b82f6',
                strokeColor: shape.strokeColor || '#000000',
                strokeWidth: shape.strokeWidth || 2,
                backgroundColor: shape.fillColor || 'transparent',
            });
        });
    }

    // 4. Annotations - text labels, arrows, dimensions
    if (Array.isArray(plan.annotations)) {
        plan.annotations.forEach((annotation: any, idx: number) => {
            const x = Number(annotation.x || canvasCenter.x);
            const y = Number(annotation.y || canvasCenter.y);
            const pos = clampInWall(x, y);

            if (annotation.type === 'text' || annotation.type === 'label') {
                addAsset({
                    id: `text-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 7)}`,
                    type: 'text',
                    x: pos.x,
                    y: pos.y,
                    scale: 1,
                    rotation: 0,
                    zIndex: 10,
                    width: 200,
                    height: 50,
                    text: annotation.text || 'Label',
                    fontSize: annotation.fontSize || 16,
                    textColor: '#000000',
                    fontFamily: 'Arial',
                    backgroundColor: 'transparent',
                });
            }

            // For arrows, add as line shapes
            if (annotation.type === 'arrow' && annotation.targetX && annotation.targetY) {
                addAsset({
                    id: `arrow-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 7)}`,
                    type: 'line',
                    x: (pos.x + annotation.targetX) / 2,
                    y: (pos.y + annotation.targetY) / 2,
                    scale: 1,
                    rotation: Math.atan2(annotation.targetY - pos.y, annotation.targetX - pos.x) * 180 / Math.PI,
                    zIndex: 10,
                    width: Math.hypot(annotation.targetX - pos.x, annotation.targetY - pos.y),
                    height: 2,
                    strokeColor: '#000000',
                    strokeWidth: 2,
                    backgroundColor: 'transparent',
                });
            }
        });
    }

    // 5. Tables (legacy support)

    if (Array.isArray(plan.tables)) {
        const cols = Math.ceil(Math.sqrt(plan.tables.length));

        plan.tables.forEach((t: any, idx: number) => {
            let x = Number(t.xMm);
            let y = Number(t.yMm);

            // Auto-layout if missing
            if (isNaN(x) || isNaN(y)) {
                const spacing = 3000; // 3m spacing
                if (wallBounds) {
                    // Spread within walls
                    const row = Math.floor(idx / cols);
                    const col = idx % cols;
                    const w = wallBounds.maxX - wallBounds.minX;
                    const h = wallBounds.maxY - wallBounds.minY;
                    x = wallBounds.minX + (w * (col + 0.5) / cols);
                    y = wallBounds.minY + (h * (row + 0.5) / Math.ceil(plan.tables.length / cols));
                } else {
                    x = canvasCenter.x + ((idx % 3) - 1) * spacing;
                    y = canvasCenter.y + (Math.floor(idx / 3) - 1) * spacing;
                }
            }

            const pos = clampInWall(x, y);

            addAsset({
                id: `table-${Date.now()}-${idx}`,
                type: t.assetType || "rectangular-table",
                x: pos.x,
                y: pos.y,
                width: Number(t.widthMm || 1800),
                height: Number(t.heightMm || 750),
                rotation: Number(t.rotation || 0),
                scale: 1,
                zIndex: 1,
                backgroundColor: "transparent"
            });
        });
    }

    // 6. Chairs (legacy support)
    if (Array.isArray(plan.chairs)) {
        plan.chairs.forEach((c: any, idx: number) => {
            let x = Number(c.xMm);
            let y = Number(c.yMm);
            if (isNaN(x) || isNaN(y)) {
                x = canvasCenter.x + (idx * 50); // Just stack them if no pos
                y = canvasCenter.y;
            }
            addAsset({
                id: `chair-${Date.now()}-${idx}`,
                type: c.assetType || "normal-chair",
                x,
                y,
                width: Number(c.widthMm || 500),
                height: Number(c.heightMm || 500),
                rotation: Number(c.rotation || 0),
                scale: 1,
                zIndex: 1,
                backgroundColor: "transparent"
            });
        });
    }

    // 7. Chairs Around (Circular arrangement)
    if (Array.isArray(plan.chairsAround)) {
        plan.chairsAround.forEach((spec: any, idx: number) => {
            let cx = Number(spec.centerX);
            let cy = Number(spec.centerY);
            if (isNaN(cx) || isNaN(cy)) {
                if (wallBounds) {
                    cx = (wallBounds.minX + wallBounds.maxX) / 2;
                    cy = (wallBounds.minY + wallBounds.maxY) / 2;
                } else {
                    cx = canvasCenter.x + (idx * 4000);
                    cy = canvasCenter.y;
                }
            }

            const count = spec.count || 1;
            const radius = spec.radiusMm || 1000;
            const tableSize = spec.tableSizePx || (radius * 0.8); // heuristic
            const chairSize = spec.chairSizePx || 500;

            // Table
            if (spec.tableAsset) {
                addAsset({
                    id: `table-grp-${idx}`,
                    type: spec.tableAsset,
                    x: cx,
                    y: cy,
                    width: tableSize,
                    height: tableSize,
                    rotation: 0,
                    scale: 1,
                    zIndex: 1,
                    backgroundColor: "transparent"
                });
            }

            // Chairs
            for (let i = 0; i < count; i++) {
                const angle = (i / count) * Math.PI * 2;
                const x = cx + Math.cos(angle) * radius;
                const y = cy + Math.sin(angle) * radius;

                addAsset({
                    id: `chair-grp-${idx}-${i}`,
                    type: spec.chairAsset || "normal-chair",
                    x,
                    y,
                    width: chairSize,
                    height: chairSize,
                    rotation: (angle * 180 / Math.PI) + 90,
                    scale: 1,
                    zIndex: 1,
                    backgroundColor: "transparent"
                });
            }
        });
    }

    return {
        assets,
        walls: [],
        shapes: []
    };
};
