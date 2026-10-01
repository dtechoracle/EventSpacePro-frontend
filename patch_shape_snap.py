with open('components/tools/ShapeTool.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# For handleMouseDown
content = content.replace(
'''        const { snapToObjects, zoom } = useEditorStore.getState();

        let snapped = snapToGridEnabled
            ? { x: Math.round(worldPos.x / getEffectiveGridSize(gridSize, useEditorStore.getState().zoom)) * getEffectiveGridSize(gridSize, useEditorStore.getState().zoom), y: Math.round(worldPos.y / getEffectiveGridSize(gridSize, useEditorStore.getState().zoom)) * getEffectiveGridSize(gridSize, useEditorStore.getState().zoom) }
            : worldPos;

        // Apply Smart Snapping on Click
        if (snapToObjects) {''',
'''        const { zoom } = useEditorStore.getState();
        const forceSnapToGrid = true;
        const forceSnapToObjects = true;

        let snapped = forceSnapToGrid
            ? { x: Math.round(worldPos.x / getEffectiveGridSize(gridSize, useEditorStore.getState().zoom)) * getEffectiveGridSize(gridSize, useEditorStore.getState().zoom), y: Math.round(worldPos.y / getEffectiveGridSize(gridSize, useEditorStore.getState().zoom)) * getEffectiveGridSize(gridSize, useEditorStore.getState().zoom) }
            : worldPos;

        // Apply Smart Snapping on Click
        if (forceSnapToObjects) {'''
)

# For handleMouseMove
content = content.replace(
'''        const { zoom, snapToObjects } = useEditorStore.getState();

        let snapped = snapToGridEnabled
            ? { x: Math.round(worldPos.x / getEffectiveGridSize(gridSize, useEditorStore.getState().zoom)) * getEffectiveGridSize(gridSize, useEditorStore.getState().zoom), y: Math.round(worldPos.y / getEffectiveGridSize(gridSize, useEditorStore.getState().zoom)) * getEffectiveGridSize(gridSize, useEditorStore.getState().zoom) }
            : worldPos;

        // Enhanced snap-to-objects
        let currentSnapPoint: SnapPoint | null = null;
        if (snapToObjects) {''',
'''        const { zoom } = useEditorStore.getState();
        const forceSnapToGrid = true;
        const forceSnapToObjects = true;

        let snapped = forceSnapToGrid
            ? { x: Math.round(worldPos.x / getEffectiveGridSize(gridSize, useEditorStore.getState().zoom)) * getEffectiveGridSize(gridSize, useEditorStore.getState().zoom), y: Math.round(worldPos.y / getEffectiveGridSize(gridSize, useEditorStore.getState().zoom)) * getEffectiveGridSize(gridSize, useEditorStore.getState().zoom) }
            : worldPos;

        // Enhanced snap-to-objects
        let currentSnapPoint: SnapPoint | null = null;
        if (forceSnapToObjects) {'''
)

with open('components/tools/ShapeTool.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
print("Forced snapping in ShapeTool")
