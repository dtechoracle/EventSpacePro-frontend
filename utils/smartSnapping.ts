
export interface SmartSnapResult {
    dx: number;
    dy: number;
    guides: Array<{ x1: number; y1: number; x2: number; y2: number; type: 'horizontal' | 'vertical' }>;
}

export interface Bounds {
    x: number;
    y: number;
    width: number;
    height: number;
    rotation?: number;
    id?: string;
}

/**
 * Calculates smart snap guides for an object being moved.
 * Checks for alignment with: Center-Center, Edge-Edge (Left, Right, Top, Bottom, Middle)
 * 
 * @param currentBounds The bounds of the object being moved (after applying the proposed delta)
 * @param otherObjects List of other objects to snap to
 * @param threshold Snap threshold in world units (e.g. 5)
 * @returns dx, dy adjustment and the guides to display
 */
export function calculateSmartSnap(
    currentBounds: Bounds,
    otherObjects: Bounds[],
    threshold: number = 5
): SmartSnapResult {
    let snapDx = 0;
    let snapDy = 0;

    let bestDistX = threshold;
    let bestDistY = threshold;

    let guidesX: Array<{ x1: number; y1: number; x2: number; y2: number; type: 'horizontal' | 'vertical' }> = [];
    let guidesY: Array<{ x1: number; y1: number; x2: number; y2: number; type: 'horizontal' | 'vertical' }> = [];

    // Current object edges and center
    const cLeft = currentBounds.x - currentBounds.width / 2;
    const cRight = currentBounds.x + currentBounds.width / 2;
    const cTop = currentBounds.y - currentBounds.height / 2;
    const cBottom = currentBounds.y + currentBounds.height / 2;
    const cCenterX = currentBounds.x;
    const cCenterY = currentBounds.y;

    for (const obj of otherObjects) {
        if (obj.id === currentBounds.id) continue; // Skip self if passed

        const oLeft = obj.x - obj.width / 2;
        const oRight = obj.x + obj.width / 2;
        const oTop = obj.y - obj.height / 2;
        const oBottom = obj.y + obj.height / 2;
        const oCenterX = obj.x;
        const oCenterY = obj.y;
        // Quarter points along each axis
        const oQ1X = oLeft + obj.width * 0.25;  // 25% from left
        const oQ3X = oLeft + obj.width * 0.75;  // 75% from left
        const oQ1Y = oTop + obj.height * 0.25;  // 25% from top
        const oQ3Y = oTop + obj.height * 0.75;  // 75% from top

        // --- X AXIS SNAPPING (Vertical Guides) ---
        const checkX = (currentVal: number, targetVal: number, type: string) => {
            const dist = Math.abs(currentVal - targetVal);
            if (dist < bestDistX) {
                bestDistX = dist;
                snapDx = targetVal - currentVal;
                // New best snap found, reset guides
                const minY = Math.min(cTop, oTop);
                const maxY = Math.max(cBottom, oBottom);
                guidesX = [{ x1: targetVal, y1: minY, x2: targetVal, y2: maxY, type: 'vertical' }];
            } else if (Math.abs(dist - bestDistX) < 0.01 && dist < threshold) {
                // Equal best snap, add guide
                const minY = Math.min(cTop, oTop);
                const maxY = Math.max(cBottom, oBottom);
                guidesX.push({ x1: targetVal, y1: minY, x2: targetVal, y2: maxY, type: 'vertical' });
            }
        };

        checkX(cCenterX, oCenterX, 'center-center');
        checkX(cLeft,    oLeft,    'left-left');
        checkX(cLeft,    oRight,   'left-right');
        checkX(cRight,   oRight,   'right-right');
        checkX(cRight,   oLeft,    'right-left');
        checkX(cCenterX, oLeft,    'center-left');
        checkX(cCenterX, oRight,   'center-right');
        // Quarter-point guide lines (X axis)
        checkX(cLeft,    oQ1X, 'left-q1');
        checkX(cCenterX, oQ1X, 'center-q1');
        checkX(cRight,   oQ1X, 'right-q1');
        checkX(cLeft,    oQ3X, 'left-q3');
        checkX(cCenterX, oQ3X, 'center-q3');
        checkX(cRight,   oQ3X, 'right-q3');


        // --- Y AXIS SNAPPING (Horizontal Guides) ---
        const checkY = (currentVal: number, targetVal: number, type: string) => {
            const dist = Math.abs(currentVal - targetVal);
            if (dist < bestDistY) {
                bestDistY = dist;
                snapDy = targetVal - currentVal;
                // New best snap found, reset guides
                const minX = Math.min(cLeft, oLeft);
                const maxX = Math.max(cRight, oRight);
                guidesY = [{ x1: minX, y1: targetVal, x2: maxX, y2: targetVal, type: 'horizontal' }];
            } else if (Math.abs(dist - bestDistY) < 0.01 && dist < threshold) {
                // Equal best snap
                const minX = Math.min(cLeft, oLeft);
                const maxX = Math.max(cRight, oRight);
                guidesY.push({ x1: minX, y1: targetVal, x2: maxX, y2: targetVal, type: 'horizontal' });
            }
        };

        checkY(cCenterY, oCenterY, 'center-center');
        checkY(cTop,     oTop,     'top-top');
        checkY(cTop,     oBottom,  'top-bottom');
        checkY(cBottom,  oBottom,  'bottom-bottom');
        checkY(cBottom,  oTop,     'bottom-top');
        checkY(cCenterY, oTop,     'center-top');
        checkY(cCenterY, oBottom,  'center-bottom');
        // Quarter-point guide lines (Y axis)
        checkY(cTop,     oQ1Y, 'top-q1');
        checkY(cCenterY, oQ1Y, 'center-q1');
        checkY(cBottom,  oQ1Y, 'bottom-q1');
        checkY(cTop,     oQ3Y, 'top-q3');
        checkY(cCenterY, oQ3Y, 'center-q3');
        checkY(cBottom,  oQ3Y, 'bottom-q3');
    }

    return {
        dx: snapDx,
        dy: snapDy,
        guides: [...guidesX, ...guidesY]
    };
}
