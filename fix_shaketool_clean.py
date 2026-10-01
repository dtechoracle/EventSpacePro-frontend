with open('components/tools/ShapeTool.tsx', 'r', encoding='utf-8') as f:
    c = f.read()

# Replace hardcoded forceSnapToGrid in handleMouseDown
old_mousedown = '''        const worldPos = screenToWorld(e.clientX, e.clientY);
        const { zoom } = useEditorStore.getState();
        const forceSnapToGrid = true;
        const forceSnapToObjects = true;

        let snapped = forceSnapToGrid
            ? { x: Math.round(worldPos.x / getEffectiveGridSize(gridSize, useEditorStore.getState().zoom)) * getEffectiveGridSize(gridSize, useEditorStore.getState().zoom), y: Math.round(worldPos.y / getEffectiveGridSize(gridSize, useEditorStore.getState().zoom)) * getEffectiveGridSize(gridSize, useEditorStore.getState().zoom) }
            : worldPos;

        // Apply Smart Snapping on Click
        if (forceSnapToObjects) {
            const snapResult = findSnapPointInShapes(worldPos, drawingSnapTargets, 32 / zoom);
            if (snapResult) {
                snapped = { x: snapResult.x, y: snapResult.y };
            }
        }'''

new_mousedown = '''        const worldPos = screenToWorld(e.clientX, e.clientY);
        const { zoom, snapToObjects } = useEditorStore.getState();
        const doGridSnap = Boolean(snapToGridEnabled);
        const doObjectSnap = snapToObjects !== false;

        let snapped = doGridSnap
            ? { x: Math.round(worldPos.x / getEffectiveGridSize(gridSize, zoom)) * getEffectiveGridSize(gridSize, zoom), y: Math.round(worldPos.y / getEffectiveGridSize(gridSize, zoom)) * getEffectiveGridSize(gridSize, zoom) }
            : worldPos;

        if (doObjectSnap) {
            const snapResult = findSnapPointInShapes(worldPos, drawingSnapTargets, 32 / zoom);
            if (snapResult) {
                snapped = { x: snapResult.x, y: snapResult.y };
            }
        }'''

c = c.replace(old_mousedown, new_mousedown)

# Replace hardcoded forceSnapToGrid in handleMouseMove
old_mousemove = '''        const worldPos = screenToWorld(e.clientX, e.clientY);
        const { zoom } = useEditorStore.getState();
        const forceSnapToGrid = true;
        const forceSnapToObjects = true;

        let snapped = forceSnapToGrid
            ? { x: Math.round(worldPos.x / getEffectiveGridSize(gridSize, useEditorStore.getState().zoom)) * getEffectiveGridSize(gridSize, useEditorStore.getState().zoom), y: Math.round(worldPos.y / getEffectiveGridSize(gridSize, useEditorStore.getState().zoom)) * getEffectiveGridSize(gridSize, useEditorStore.getState().zoom) }
            : worldPos;

        // Enhanced snap-to-objects
        let currentSnapPoint: SnapPoint | null = null;
        if (forceSnapToObjects) {
            const snapResult = findSnapPointInShapes(worldPos, drawingSnapTargets, 32 / zoom);
            if (snapResult) {
                snapped = { x: snapResult.x, y: snapResult.y };
                currentSnapPoint = snapResult;
            }
        }'''

new_mousemove = '''        const worldPos = screenToWorld(e.clientX, e.clientY);
        const { zoom, snapToObjects } = useEditorStore.getState();
        const doGridSnap = Boolean(snapToGridEnabled);
        const doObjectSnap = snapToObjects !== false;

        let snapped = doGridSnap
            ? { x: Math.round(worldPos.x / getEffectiveGridSize(gridSize, zoom)) * getEffectiveGridSize(gridSize, zoom), y: Math.round(worldPos.y / getEffectiveGridSize(gridSize, zoom)) * getEffectiveGridSize(gridSize, zoom) }
            : worldPos;

        let currentSnapPoint: SnapPoint | null = null;
        if (doObjectSnap) {
            const snapResult = findSnapPointInShapes(worldPos, drawingSnapTargets, 32 / zoom);
            if (snapResult) {
                snapped = { x: snapResult.x, y: snapResult.y };
                currentSnapPoint = snapResult;
            }
        }'''

c = c.replace(old_mousemove, new_mousemove)

# Replace in handleLineMouseDown
old_linemousedown = '''        const worldPos = screenToWorld(e.clientX, e.clientY);
        const { zoom } = useEditorStore.getState();
        let snapped = snapToGridEnabled
            ? { x: Math.round(worldPos.x / getEffectiveGridSize(gridSize, zoom)) * getEffectiveGridSize(gridSize, zoom), y: Math.round(worldPos.y / getEffectiveGridSize(gridSize, zoom)) * getEffectiveGridSize(gridSize, zoom) }
            : worldPos;

        const snapResult = findSnapPointInShapes(worldPos, drawingSnapTargets, 32 / zoom);
        if (snapResult) {
            snapped = { x: snapResult.x, y: snapResult.y };
        }'''

new_linemousedown = '''        const worldPos = screenToWorld(e.clientX, e.clientY);
        const { zoom, snapToObjects } = useEditorStore.getState();
        const doGridSnap = Boolean(snapToGridEnabled);
        const doObjectSnap = snapToObjects !== false;

        let snapped = doGridSnap
            ? { x: Math.round(worldPos.x / getEffectiveGridSize(gridSize, zoom)) * getEffectiveGridSize(gridSize, zoom), y: Math.round(worldPos.y / getEffectiveGridSize(gridSize, zoom)) * getEffectiveGridSize(gridSize, zoom) }
            : worldPos;

        if (doObjectSnap) {
            const snapResult = findSnapPointInShapes(worldPos, drawingSnapTargets, 32 / zoom);
            if (snapResult) {
                snapped = { x: snapResult.x, y: snapResult.y };
            }
        }'''

c = c.replace(old_linemousedown, new_linemousedown)

with open('components/tools/ShapeTool.tsx', 'w', encoding='utf-8') as f:
    f.write(c)

print("Updated ShapeTool.tsx clean!")
