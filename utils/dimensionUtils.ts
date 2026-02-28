import { Wall, Shape, Asset, Dimension } from '../store/projectStore';

export const MM_TO_PX = 2; // Used for export
export const OFFSET = -100; // Distance from element edge to dimension line (mm)

// Helper to transform local point to world point
export const transformPoint = (x: number, y: number, center: { x: number, y: number }, rotation: number) => {
    const rad = (rotation || 0) * Math.PI / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);

    const rx = x * cos - y * sin;
    const ry = x * sin + y * cos;

    return { x: rx + center.x, y: ry + center.y };
};

// Map dimensionType to visual lineStyle
export const getLineStyleFromType = (dimensionType: string): 'solid' | 'dashed' | 'dotted' | 'double' => {
    if (dimensionType === 'dotted') return 'dotted';
    if (dimensionType === 'dashed') return 'dashed';
    if (dimensionType === 'double') return 'double';
    return 'solid';
};

// Helper to generate dimensions for an object (Shape or Asset)
export const getDimensionsForObject = (obj: Shape | Asset, idPrefix: string): Dimension[] => {
    const dims: Dimension[] = [];
    const scale = (obj as Asset).scale || 1;
    const w = obj.width * scale;
    const h = obj.height * scale;
    const dimensionType = (obj as any).dimensionType || 'solid';

    // Common world points
    const tl = { x: -w / 2, y: -h / 2 };
    const tr = { x: w / 2, y: -h / 2 };
    const br = { x: w / 2, y: h / 2 };
    const bl = { x: -w / 2, y: h / 2 };

    const pTL = transformPoint(tl.x, tl.y, obj, obj.rotation);
    const pTR = transformPoint(tr.x, tr.y, obj, obj.rotation);
    const pBR = transformPoint(br.x, br.y, obj, obj.rotation);
    const pBL = transformPoint(bl.x, bl.y, obj, obj.rotation);

    const lineStyle = getLineStyleFromType(dimensionType);

    // Check if it's a circular/radial dimension
    const isCircular = dimensionType === 'circular' || dimensionType === 'radial';

    if (isCircular) {
        const radius = Math.min(w, h) / 2;
        dims.push({
            id: `${idPrefix}-rad`,
            type: 'circular',
            startPoint: { x: obj.x, y: obj.y },
            endPoint: {
                x: obj.x + radius * Math.cos(obj.rotation * Math.PI / 180),
                y: obj.y + radius * Math.sin(obj.rotation * Math.PI / 180)
            },
            value: Math.round(radius),
            offset: 0,
            color: '#666666',
            fontSize: 48,
            zIndex: 100,
            lineStyle
        });
    } else {
        // Aligned (Standard)
        dims.push({
            id: `${idPrefix}-w-ali`,
            type: dimensionType as any,
            startPoint: pTL,
            endPoint: pTR,
            value: Math.round(w),
            offset: OFFSET,
            color: '#666666',
            fontSize: 48,
            zIndex: 100,
            lineStyle
        });

        dims.push({
            id: `${idPrefix}-h-ali`,
            type: dimensionType as any,
            startPoint: pTR,
            endPoint: pBR,
            value: Math.round(h),
            offset: OFFSET,
            color: '#666666',
            fontSize: 48,
            zIndex: 100,
            lineStyle
        });
    }

    return dims;
};

// Helper to generate dimensions for a wall
export const getDimensionsForWall = (wall: Wall): Dimension[] => {
    const dims: Dimension[] = [];
    if (!wall.showDimensions) return dims;

    wall.edges.forEach(edge => {
        const n1 = wall.nodes.find(n => n.id === edge.nodeA);
        const n2 = wall.nodes.find(n => n.id === edge.nodeB);

        if (n1 && n2) {
            const len = Math.hypot(n2.x - n1.x, n2.y - n1.y);
            const wallThickness = edge.thickness || 75;
            const wallOffset = OFFSET - (wallThickness / 2);
            const dimensionType = (wall as any).dimensionType || 'solid';
            const lineStyle = getLineStyleFromType(dimensionType);

            dims.push({
                id: `auto-dim-${edge.id}`,
                startPoint: { x: n1.x, y: n1.y },
                endPoint: { x: n2.x, y: n2.y },
                value: Math.round(len),
                offset: wallOffset,
                color: '#666666',
                type: dimensionType as any,
                fontSize: 48,
                zIndex: 100,
                lineStyle
            });
        }
    });

    return dims;
};

// Helper to render a dimension to canvas (used for high-res export)
export const renderDimensionToCanvas = (ctx: CanvasRenderingContext2D, dim: Dimension, minX: number, minY: number, padding: number, MM_TO_PX: number) => {
    const { startPoint, endPoint, offset, value, strokeWidth = 10, color = '#666666', fontSize = 48, lineStyle = 'solid' } = dim;

    // Calculate vector from start to end
    const dx = endPoint.x - startPoint.x;
    const dy = endPoint.y - startPoint.y;
    const length = Math.sqrt(dx * dx + dy * dy);

    if (length === 0) return;

    // Normalized direction vector
    const nx = dx / length;
    const ny = dy / length;

    // Perpendicular vector
    const px = -ny;
    const py = nx;

    // World to Canvas transform helper
    const toCanvasX = (wx: number) => (wx - minX + padding) * MM_TO_PX;
    const toCanvasY = (wy: number) => (wy - minY + padding) * MM_TO_PX;

    const p1x = toCanvasX(startPoint.x + px * offset);
    const p1y = toCanvasY(startPoint.y + py * offset);
    const p2x = toCanvasX(endPoint.x + px * offset);
    const p2y = toCanvasY(endPoint.y + py * offset);

    const isRadial = dim.type === 'radial' || dim.type === 'circular';

    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = strokeWidth * 0.5 * MM_TO_PX;
    ctx.lineCap = 'round';

    if (isRadial) {
        // Radial Line
        ctx.beginPath();
        ctx.moveTo(toCanvasX(startPoint.x), toCanvasY(startPoint.y));
        ctx.lineTo(toCanvasX(endPoint.x), toCanvasY(endPoint.y));
        ctx.stroke();

        // Arrow at edge
        const arrowSize = 100 * MM_TO_PX;
        const ex = toCanvasX(endPoint.x);
        const ey = toCanvasY(endPoint.y);

        ctx.beginPath();
        ctx.moveTo(ex, ey);
        ctx.lineTo(ex - nx * arrowSize + px * (arrowSize * 0.3), ey - ny * arrowSize + py * (arrowSize * 0.3));
        ctx.moveTo(ex, ey);
        ctx.lineTo(ex - nx * arrowSize - px * (arrowSize * 0.3), ey - ny * arrowSize - py * (arrowSize * 0.3));
        ctx.stroke();

        // Label
        const midX = toCanvasX((startPoint.x + endPoint.x) / 2);
        const midY = toCanvasY((startPoint.y + endPoint.y) / 2);
        const label = `R ${Math.round(value || length)}`;
        renderTextLabel(ctx, label, midX, midY, dy, dx, fontSize * MM_TO_PX, color);

        // Center Mark
        const cx = toCanvasX(startPoint.x);
        const cy = toCanvasY(startPoint.y);
        ctx.beginPath();
        ctx.moveTo(cx - 10 * MM_TO_PX, cy); ctx.lineTo(cx + 10 * MM_TO_PX, cy);
        ctx.moveTo(cx, cy - 10 * MM_TO_PX); ctx.lineTo(cx, cy + 10 * MM_TO_PX);
        ctx.stroke();
    } else {
        // Extension lines
        const overshoot = 10;
        ctx.globalAlpha = 0.5;
        ctx.beginPath();
        ctx.moveTo(toCanvasX(startPoint.x), toCanvasY(startPoint.y));
        ctx.lineTo(toCanvasX(startPoint.x + px * (offset + (offset > 0 ? overshoot : -overshoot))), toCanvasY(startPoint.y + py * (offset + (offset > 0 ? overshoot : -overshoot))));
        ctx.moveTo(toCanvasX(endPoint.x), toCanvasY(endPoint.y));
        ctx.lineTo(toCanvasX(endPoint.x + px * (offset + (offset > 0 ? overshoot : -overshoot))), toCanvasY(endPoint.y + py * (offset + (offset > 0 ? overshoot : -overshoot))));
        ctx.stroke();
        ctx.globalAlpha = 1.0;

        // Main dimension line
        if (lineStyle === 'dashed') ctx.setLineDash([15 * MM_TO_PX, 10 * MM_TO_PX]);
        else if (lineStyle === 'dotted') ctx.setLineDash([4 * MM_TO_PX, 4 * MM_TO_PX]);
        else ctx.setLineDash([]);

        if (lineStyle === 'double') {
            const gap = strokeWidth * 0.75 * MM_TO_PX;
            ctx.setLineDash([10 * MM_TO_PX, 10 * MM_TO_PX]);
            ctx.beginPath();
            ctx.moveTo(p1x + px * gap, p1y + py * gap); ctx.lineTo(p2x + px * gap, p2y + py * gap);
            ctx.moveTo(p1x - px * gap, p1y - py * gap); ctx.lineTo(p2x - px * gap, p2y - py * gap);
            ctx.stroke();
        } else {
            ctx.beginPath();
            ctx.moveTo(p1x, p1y);
            ctx.lineTo(p2x, p2y);
            ctx.stroke();
        }
        ctx.setLineDash([]); // Reset

        // Arrows
        const arrowSize = 100 * MM_TO_PX;
        renderArrow(ctx, p1x, p1y, nx, ny, px, py, arrowSize);
        renderArrow(ctx, p2x, p2y, -nx, -ny, px, py, arrowSize);

        // Label
        const midX = (p1x + p2x) / 2;
        const midY = (p1y + p2y) / 2;
        const label = `${Math.round(value || length)} mm`;
        renderTextLabel(ctx, label, midX, midY, dy, dx, fontSize * MM_TO_PX, color);
    }
};

const renderArrow = (ctx: CanvasRenderingContext2D, x: number, y: number, nx: number, ny: number, px: number, py: number, size: number) => {
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + nx * size + px * (size * 0.3), y + ny * size + py * (size * 0.3));
    ctx.moveTo(x, y);
    ctx.lineTo(x + nx * size - px * (size * 0.3), y + ny * size - py * (size * 0.3));
    ctx.stroke();
};

const renderTextLabel = (ctx: CanvasRenderingContext2D, text: string, x: number, y: number, dy: number, dx: number, size: number, color: string) => {
    ctx.save();
    ctx.translate(x, y);
    let angle = Math.atan2(dy, dx);
    if (angle > Math.PI / 2 || angle < -Math.PI / 2) angle += Math.PI;
    ctx.rotate(angle);

    ctx.font = `bold ${size}px Arial`;
    const metrics = ctx.measureText(text);
    const w = metrics.width + 20;
    const h = size + 10;

    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.fillRect(-w / 2, -h / 2, w, h);

    ctx.fillStyle = color;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 0, 0);
    ctx.restore();
};
