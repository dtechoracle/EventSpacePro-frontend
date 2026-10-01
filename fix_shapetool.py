with open("components/tools/ShapeTool.tsx", "r", encoding="utf-8") as f:
    c = f.read()

# 1. Remove line and arrow from isLineMode (we'll just not use it at all for anything?)
# Wait, what else uses isLineMode? Nothing else.
# Let's see:
old_isLineMode = "const isLineMode = shapeType === 'line' || shapeType === 'arrow';"
new_isLineMode = "const isLineMode = false; // Disable multi-segment line mode for now"

c = c.replace(old_isLineMode, new_isLineMode)

# 2. Modify handleMouseUp
old_mouseup = """        const width = Math.abs(endPoint.x - startPoint.x);
        const height = Math.abs(endPoint.y - startPoint.y);
        const centerX = (startPoint.x + endPoint.x) / 2;
        const centerY = (startPoint.y + endPoint.y) / 2;

        const finalWidth = width;
        const finalHeight = height;

        const newShape: Shape = {
            id: crypto.randomUUID(),
            type: shapeType,
            x: centerX,
            y: centerY,
            width: finalWidth,
            height: finalHeight,
            rotation: 0,
            fill: 'transparent',
            fillType: 'solid',
            // Default black stroke for better visibility
            stroke: '#000000',
            strokeWidth: 1,
            zIndex: getNextZIndex(),
        };"""

new_mouseup = """        let finalWidth = Math.abs(endPoint.x - startPoint.x);
        let finalHeight = Math.abs(endPoint.y - startPoint.y);
        let centerX = (startPoint.x + endPoint.x) / 2;
        let centerY = (startPoint.y + endPoint.y) / 2;
        let rotation = 0;

        if (shapeType === 'line' || shapeType === 'arrow') {
            const dx = endPoint.x - startPoint.x;
            const dy = endPoint.y - startPoint.y;
            finalWidth = Math.sqrt(dx * dx + dy * dy);
            finalHeight = 2; // Default stroke representation height
            rotation = Math.atan2(dy, dx) * (180 / Math.PI);
        }

        const newShape: Shape = {
            id: crypto.randomUUID(),
            type: shapeType,
            x: centerX,
            y: centerY,
            width: finalWidth,
            height: finalHeight,
            rotation: rotation,
            fill: 'transparent',
            fillType: 'solid',
            // Default black stroke for better visibility
            stroke: '#000000',
            strokeWidth: shapeType === 'arrow' ? 2 : 1,
            ...(shapeType === 'arrow' ? { arrowHeadType: 'filled-triangle' as any, arrowTailType: 'none' as any, arrowHeadSize: 20 } : {}),
            zIndex: getNextZIndex(),
        };"""

c = c.replace(old_mouseup, new_mouseup)

with open("components/tools/ShapeTool.tsx", "w", encoding="utf-8") as f:
    f.write(c)
print("Updated ShapeTool.tsx")
