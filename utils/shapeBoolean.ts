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
        // Note: IF the svgPath is absolute, we don't need to move it.
        // If svg path was generated from paper.js, paper.js outputs absolute world coordinates.
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
        // Apply rotation if any
        if (shape.rotation !== undefined && shape.rotation !== 0) {
            path.rotate(shape.rotation, center);
        }
    }

    return path;
};

export const trimToBlendShapes = (shapes: Shape[]): Shape | null => {
    // Only blend exactly 2 shapes when calling this specific feature, to avoid chaos from mass-selection
    if (shapes.length !== 2) return null;
    initPaper();

    const paths = shapes.map(s => shapeToPaperPath(s)).filter(p => p !== null) as (paper.Path | paper.CompoundPath)[];

    if (paths.length !== 2) return null;

    let resultPath: paper.PathItem = paths[0];

    // Boolean Unite all paths
    for (let i = 1; i < paths.length; i++) {
        // `unite` creates a new path representing the union
        const newPath = resultPath.unite(paths[i]) as paper.PathItem;
        resultPath = newPath;
    }

    // We want to create a new "composite" shape
    // Let's take the properties of the first shape (colors, etc.)
    const baseShape = shapes[0];

    // Let's calculate its absolute bounding box to determine X & Y bounds on the canvas.
    const bounds = resultPath.bounds;
    const centerX = bounds.center.x;
    const centerY = bounds.center.y;

    // Shift path geometry backwards so its center is perfectly at 0,0
    // This allows it to align with <g transform="translate(x, y)"> in ShapeRenderer
    // and correctly registers with standard hover/click boundary logic.
    resultPath.position = new paper.Point(0, 0);

    // Export the relative result to SVG path string
    const svgD = resultPath.pathData;

    const mergedShape: Shape = {
        ...baseShape, // inherit fill/stroke
        id: `shape-blended-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        type: 'path',
        x: centerX,
        y: centerY,
        width: bounds.width,
        height: bounds.height,
        rotation: 0, // Path data already incorporates original rotations!
        svgPath: svgD,
        points: undefined,
        polygonSides: undefined,
    };

    // Clean up paperjs active layer memory
    paper.project?.activeLayer.removeChildren();

    return mergedShape;
};
