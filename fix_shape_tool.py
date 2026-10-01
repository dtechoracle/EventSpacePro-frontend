with open("components/tools/ShapeTool.tsx", "r", encoding="utf-8") as f:
    c = f.read()

old_logic = """        const width = Math.abs(endPoint.x - startPoint.x);
        const height = Math.abs(endPoint.y - startPoint.y);
        if (width < 5 || height < 5) {
            setStartPoint(null);
            setEndPoint(null);
            setIsDrawing(false);
            return;
        }

        const centerX = (startPoint.x + endPoint.x) / 2;
        const centerY = (startPoint.y + endPoint.y) / 2;

        let finalWidth = width;
        let finalHeight = height;

        const newShape: Shape = {
            id: crypto.randomUUID(),
            type: shapeType,
            x: centerX,
            y: centerY,
            width: finalWidth,
            height: finalHeight,
            rotation: 0,"""

new_logic = """        const dx = endPoint.x - startPoint.x;
        const dy = endPoint.y - startPoint.y;
        const dist = Math.hypot(dx, dy);

        if (dist < 5) {
            setStartPoint(null);
            setEndPoint(null);
            setIsDrawing(false);
            return;
        }

        const centerX = (startPoint.x + endPoint.x) / 2;
        const centerY = (startPoint.y + endPoint.y) / 2;

        let finalWidth = Math.abs(dx);
        let finalHeight = Math.abs(dy);
        let finalRotation = 0;

        if (shapeType === 'line' || shapeType === 'arrow') {
            finalWidth = dist;
            finalHeight = 0;
            finalRotation = Math.atan2(dy, dx) * (180 / Math.PI);
        }

        const newShape: Shape = {
            id: crypto.randomUUID(),
            type: shapeType,
            x: centerX,
            y: centerY,
            width: finalWidth,
            height: finalHeight,
            rotation: finalRotation,"""

c = c.replace(old_logic, new_logic)

with open("components/tools/ShapeTool.tsx", "w", encoding="utf-8") as f:
    f.write(c)
print("Fixed ShapeTool line rotation")
