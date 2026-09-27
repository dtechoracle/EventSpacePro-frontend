import paper from 'paper';
import { Shape } from '@/store/projectStore';

let isPaperInitialized = false;

const initPaper = () => {
    if (typeof window === 'undefined') return;
    if (!isPaperInitialized || !paper.project) {
        paper.setup(new paper.Size(10000, 10000));
        isPaperInitialized = true;
    }
};

const closePathItem = (item: paper.PathItem) => {
    if (item instanceof paper.CompoundPath) {
        item.children?.forEach(child => {
            if (child instanceof paper.Path) child.closed = true;
        });
    } else if (item instanceof paper.Path) {
        item.closed = true;
    }
};

const shapeToPaperPath = (shape: Shape): paper.Path | paper.CompoundPath | null => {
    initPaper();
    if (!paper.project) return null;

    let path: paper.Path | paper.CompoundPath | null = null;
    const center = new paper.Point(shape.x, shape.y);

    if (shape.type === 'rectangle') {
        path = new paper.Path.Rectangle(
            new paper.Point(shape.x - shape.width / 2, shape.y - shape.height / 2),
            new paper.Size(shape.width, shape.height)
        );
    } else if (shape.type === 'ellipse') {
        path = new paper.Path.Ellipse({
            center: center,
            radius: [shape.width / 2, shape.height / 2]
        });
    } else if (shape.type === 'polygon' && shape.points && shape.points.length > 0) {
        path = new paper.Path();
        shape.points.forEach(pt => {
            (path as paper.Path).add(new paper.Point(shape.x + pt.x, shape.y + pt.y));
        });
        path.closed = true;
    } else if (shape.type === 'path' && shape.svgPath) {
        path = new paper.CompoundPath(shape.svgPath);
        path.translate(center);
    } else if (shape.type === 'line' || shape.type === 'arrow' || shape.type === 'freehand') {
        if (shape.points && shape.points.length >= 3) {
            path = new paper.Path();
            shape.points.forEach(pt => {
                (path as paper.Path).add(new paper.Point(shape.x + pt.x, shape.y + pt.y));
            });
            path.closed = true;
        }
    }

    if (path) {
        path.applyMatrix = true;
        if (shape.rotation !== undefined && shape.rotation !== 0) {
            path.rotate(shape.rotation, center);
        }
        path.fillColor = new paper.Color('black');
        closePathItem(path);
        if (path instanceof paper.Path && path.closed) path.reorient(true, true);
    }

    return path;
};

export const blendShapes = (shapes: Shape[], mode: 'intersect' | 'subtract'): Shape | null => {
    if (shapes.length < 2) return null;
    initPaper();
    if (!paper.project) return null;

    const created: paper.Item[] = [];

    try {
        const paths: paper.PathItem[] = [];
        for (const s of shapes) {
            const p = shapeToPaperPath(s);
            if (!p) continue;
            created.push(p);
            paths.push(p);
        }

        if (paths.length < 2) return null;

        const cutterPath = paths[0];
        const targetPath = paths[1];

        const resultPath = mode === 'intersect'
            ? targetPath.intersect(cutterPath)
            : targetPath.subtract(cutterPath);
        created.push(resultPath);

        const bounds = resultPath.bounds;
        if (bounds.width < 0.1 || bounds.height < 0.1) return null;

        const centerX = bounds.center.x;
        const centerY = bounds.center.y;

        resultPath.position = new paper.Point(0, 0);
        const svgD = resultPath.pathData;

        return {
            ...shapes[0],
            id: `shape-blended-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            type: 'path',
            x: centerX,
            y: centerY,
            width: Math.max(1, bounds.width),
            height: Math.max(1, bounds.height),
            rotation: 0,
            svgPath: svgD,
            points: undefined,
            polygonSides: undefined,
        };
    } catch (error) {
        console.error("[shapeBoolean] Blending error:", error);
        return null;
    } finally {
        created.forEach(item => {
            try { item.remove(); } catch { /* ignore */ }
        });
    }
};

export const trimToBlendShapes = (shapes: Shape[], clickPoint?: { x: number; y: number }): Shape | null => {
    if (shapes.length < 2) return null;
    if (clickPoint) {
        initPaper();
        const probe = shapeToPaperPath(shapes[0]);
        if (probe) {
            const inside = probe.contains(new paper.Point(clickPoint.x, clickPoint.y));
            try { probe.remove(); } catch { /* ignore */ }
            return blendShapes(shapes, inside ? 'subtract' : 'intersect');
        }
    }
    return blendShapes(shapes, 'intersect');
};
