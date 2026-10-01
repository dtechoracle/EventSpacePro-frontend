with open('components/tools/ShapeTool.tsx', 'r', encoding='utf-8') as f:
    c = f.read()

# 1. Update drawingSnapTargets to include all assets
c = c.replace(
    'const drawingSnapTargets = useMemo(\n        () => [...shapes, ...walls, ...marqueeAssets],\n        [shapes, walls, marqueeAssets]\n    );',
    'const drawingSnapTargets = useMemo(\n        () => [...shapes, ...walls, ...assets],\n        [shapes, walls, assets]\n    );'
)

# 2. In handleMouseDown: update threshold to 32 / zoom
c = c.replace(
    'const snapResult = findSnapPointInShapes(worldPos, drawingSnapTargets, 20 / zoom);',
    'const snapResult = findSnapPointInShapes(worldPos, drawingSnapTargets, 32 / zoom);'
)

# 3. In handleMouseMove: update threshold to 32 / zoom
c = c.replace(
    'const snapResult = findSnapPointInShapes(worldPos, drawingSnapTargets, 20 / zoom);',
    'const snapResult = findSnapPointInShapes(worldPos, drawingSnapTargets, 32 / zoom);'
)

# 4. In handleLineMouseDown: add smart snapping to object vertices
line_mousedown_target = '''        const worldPos = screenToWorld(e.clientX, e.clientY);
        let snapped = snapToGridEnabled
            ? { x: Math.round(worldPos.x / getEffectiveGridSize(gridSize, useEditorStore.getState().zoom)) * getEffectiveGridSize(gridSize, useEditorStore.getState().zoom), y: Math.round(worldPos.y / getEffectiveGridSize(gridSize, useEditorStore.getState().zoom)) * getEffectiveGridSize(gridSize, useEditorStore.getState().zoom) }
            : worldPos;'''

line_mousedown_replacement = '''        const worldPos = screenToWorld(e.clientX, e.clientY);
        const { zoom } = useEditorStore.getState();
        let snapped = snapToGridEnabled
            ? { x: Math.round(worldPos.x / getEffectiveGridSize(gridSize, zoom)) * getEffectiveGridSize(gridSize, zoom), y: Math.round(worldPos.y / getEffectiveGridSize(gridSize, zoom)) * getEffectiveGridSize(gridSize, zoom) }
            : worldPos;

        const snapResult = findSnapPointInShapes(worldPos, drawingSnapTargets, 32 / zoom);
        if (snapResult) {
            snapped = { x: snapResult.x, y: snapResult.y };
        }'''

c = c.replace(line_mousedown_target, line_mousedown_replacement)

with open('components/tools/ShapeTool.tsx', 'w', encoding='utf-8') as f:
    f.write(c)

print("Updated ShapeTool.tsx snapping!")
