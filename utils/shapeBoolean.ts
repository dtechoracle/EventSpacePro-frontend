import paper from 'paper';
import { Shape } from '@/store/projectStore';

// Initialize Paper.js headlessly
// We must only do this on the client side
let isPaperInitialized = false;

const initPaper = () => {
    if (typeof window === 'undefined') return;
    if (!isPaperInitialized) {
        // Setup without a canvas creates a headless project
        paper.setup(new paper.Size(10000, 10000));
        isPaperInitialized = true;
    }
};

const shapeToPaperPath = (shape: Shape): paper.Path | paper.CompoundPath | null => {
    initPaper();

    // We recreate the shape geometry in paper space, centered around its coordinates
    let path: paper.Path | paper.CompoundPath | null = null;
    const center = new paper.Point(shape.x, shape.y);

    if (shape.type === 'rectangle') {
        const size = new paper.Size(shape.width, shape.height);
        // paper's rectangle takes top-left or (center, size) depending on constructor,
        // Using Path.Rectangle(point, size) where point is top-left
        path = new paper.Path.Rectangle(
            new paper.Point(shape.x - shape.width / 2, shape.y - shape.height / 2),
            size
        );
    } else if (shape.type === 'ellipse') {
        path = new paper.Path.Ellipse({
            center: center,
            radius: [shape.width / 2, shape.height / 2]
        });
    } else if (shape.type === 'polygon' && shape.points && shape.points.length > 0) {
        path = new paper.Path();
        shape.points.forEach(pt => {
            // Apply polygon point directly (assume absolute, or relative? Wait, polygon points in Shape are absolute?)
            // Looking at `ShapeRenderer`, `Shape.points` are used as-relatives (in a `<g>` translated by shape.x, shape.y?)
            // WAIT - shape.points are often relative to the center, OR absolute. Let's check ShapeRenderer.
            // ShapeRenderer line 115 gives them directly to <polygon points="x,y x,y"> which usually means they are RELATIVE to shape.x, shape.y because ShapeRenderer translates the <g> wrapper to `shape.x`, `shape.y`.
            // Wait, does ShapeRenderer translate?
            // "pts = shape.points" with cx={0} cy={0}. So they are relative coordinates.
            // Therefore, absolute point is shape.x + pt.x
            const absPoint = new paper.Point(shape.x + pt.x, shape.y + pt.y);
            (path as paper.Path).add(absPoint);
        });
        path.closed = true;
    } else if (shape.type === 'path' && shape.svgPath) {
        path = new paper.CompoundPath(shape.svgPath);
        // Important: reposition to world center
        path.position = center;
    } else if (shape.type === 'line' || shape.type === 'arrow' || shape.type === 'freehand') {
        // If they have points relative to center
        if (shape.points) {
            path = new paper.Path();
            shape.points.forEach(pt => {
                (path as paper.Path).add(new paper.Point(shape.x + pt.x, shape.y + pt.y));
            });
            // If it's a closed shape like a filled freehand
            if (shape.fill && shape.fill !== 'transparent' && shape.fill !== 'none') {
                path.closed = true;
            }
        }
    }

    if (path) {
        // Bake rotation and position immediately into the path geometry
        path.applyMatrix = true;
        if (shape.rotation !== undefined && shape.rotation !== 0) {
            path.rotate(shape.rotation, center);
        }
        // Boolean operations require shapes to be closed and ideally filled
        path.fillColor = new paper.Color('black');
        path.closed = true;
        // Standardize winding for boolean union
        if (path instanceof paper.Path) path.reorient(true, true);
    }

    return path;
};

export const trimToBlendShapes = (shapes: Shape[], clickPoint?: { x: number; y: number }): Shape | null => {
    if (shapes.length < 2) return null;
    initPaper();

    // Create a temporary project for the slicing operation
    const project = new paper.Project(new paper.Size(10000, 10000));
    project.activate();

    try {
        const paths = shapes.map(s => {
            const p = shapeToPaperPath(s);
            if (p) {
                // Ensure all transforms are applied directly to the geometry
                p.applyMatrix = true;
                p.closed = true;
                // Standardize orientation for boolean consistency
                if (p instanceof paper.Path) p.reorient(true, true);
            }
            return p;
        }).filter(p => p !== null) as paper.PathItem[];

        if (paths.length < 2) return null;

        const cutterPath = paths[0];
        const targetPath = paths[1];

        let isInsideCutter = false;
        if (clickPoint) {
            const paperPoint = new paper.Point(clickPoint.x, clickPoint.y);
            isInsideCutter = cutterPath.contains(paperPoint);
        }

        // If user clicked inside cutter, subtract the cutter from target (removes overlap).
        // If outside, intersect (removes non-overlap).
        let resultPath: paper.PathItem;
        if (isInsideCutter) {
            resultPath = targetPath.subtract(cutterPath);
        } else {
            resultPath = targetPath.intersect(cutterPath);
        }

        const bounds = resultPath.bounds;
        if (bounds.width < 0.1 || bounds.height < 0.1) return null; // No intersection

        const centerX = bounds.center.x;
        const centerY = bounds.center.y;

        // Re-center the geometry for relative path storage in our Shape state
        resultPath.position = new paper.Point(0, 0);

        const svgD = resultPath.pathData;
        const baseShape = shapes[0];

        const blendedShape: Shape = {
            ...baseShape,
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

        return blendedShape;
    } catch (error) {
        console.error("[shapeBoolean] Blending error:", error);
        return null;
    } finally {
        // Always destroy the temporary project
        project.remove();
    }
};
