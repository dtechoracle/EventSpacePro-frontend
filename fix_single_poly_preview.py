with open("components/tools/SelectionTool.tsx", "r", encoding="utf-8") as f:
    c = f.read()

old_logic = """if (isSinglePolyline) {
        const shape = selectedItems[0].object as Shape;
        if (shape.points) {
            return (
                <g data-export-ignore="true">
                    {/* Bounding box for moving the whole thing */}
                    <polygon 
                        points={`${boxTopLeft.x},${boxTopLeft.y} ${boxTopRight.x},${boxTopRight.y} ${boxBottomRight.x},${boxBottomRight.y} ${boxBottomLeft.x},${boxBottomLeft.y}`} 
                        fill={overlayFill} 
                        stroke="#3B82F6" 
                        strokeWidth={isTooLarge ? 1 : 2} 
                        strokeDasharray={overlayDash}
                        vectorEffect="non-scaling-stroke" 
                        onMouseDown={(e) => handleMouseDown(e, 'move')} 
                        style={{ cursor: 'move' }}
                    />
                    {shape.points.map((p, i) => {
                        const pt = worldToScreenPoint(shape.x + p.x, shape.y + p.y);"""

new_logic = """if (isSinglePolyline) {
        const shape = selectedItems[0].object as Shape;
        let sx = shape.x;
        let sy = shape.y;
        if (dragPreview && dragPreview.ids.includes(shape.id)) {
            sx += dragPreview.dx;
            sy += dragPreview.dy;
        }
        if (shape.points) {
            return (
                <g data-export-ignore="true">
                    {/* Bounding box for moving the whole thing */}
                    <polygon 
                        points={`${boxTopLeft.x},${boxTopLeft.y} ${boxTopRight.x},${boxTopRight.y} ${boxBottomRight.x},${boxBottomRight.y} ${boxBottomLeft.x},${boxBottomLeft.y}`} 
                        fill={overlayFill} 
                        stroke="#3B82F6" 
                        strokeWidth={isTooLarge ? 1 : 2} 
                        strokeDasharray={overlayDash}
                        vectorEffect="non-scaling-stroke" 
                        onMouseDown={(e) => handleMouseDown(e, 'move')} 
                        style={{ cursor: 'move' }}
                    />
                    {shape.points.map((p, i) => {
                        const pt = worldToScreenPoint(sx + p.x, sy + p.y);"""

if old_logic in c:
    c = c.replace(old_logic, new_logic)
    with open("components/tools/SelectionTool.tsx", "w", encoding="utf-8") as f:
        f.write(c)
    print("Fixed isSinglePolyline drag preview")
else:
    print("Could not find old_logic")
