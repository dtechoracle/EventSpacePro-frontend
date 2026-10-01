with open("components/tools/SelectionTool.tsx", "r", encoding="utf-8") as f:
    c = f.read()

old_logic = """if (isSingleStraightLine) {
        const shape = selectedItems[0].object as Shape;
        const rot = (shape.rotation || 0) * (Math.PI / 180);
        const s = { x: shape.x - (shape.width / 2) * Math.cos(rot), y: shape.y - (shape.width / 2) * Math.sin(rot) };
        const e = { x: shape.x + (shape.width / 2) * Math.cos(rot), y: shape.y + (shape.width / 2) * Math.sin(rot) };
        const ss = worldToScreenPoint(s.x, s.y), es = worldToScreenPoint(e.x, e.y), cs = worldToScreenPoint(shape.x, shape.y);
        const rp = worldToScreenPoint(shape.x - Math.sin(rot) * (30 / zoom), shape.y + Math.cos(rot) * (30 / zoom));"""

new_logic = """if (isSingleStraightLine) {
        const shape = selectedItems[0].object as Shape;
        let sx = shape.x;
        let sy = shape.y;
        if (dragPreview && dragPreview.ids.includes(shape.id)) {
            sx += dragPreview.dx;
            sy += dragPreview.dy;
        }
        const rot = (shape.rotation || 0) * (Math.PI / 180);
        const s = { x: sx - (shape.width / 2) * Math.cos(rot), y: sy - (shape.width / 2) * Math.sin(rot) };
        const e = { x: sx + (shape.width / 2) * Math.cos(rot), y: sy + (shape.width / 2) * Math.sin(rot) };
        const ss = worldToScreenPoint(s.x, s.y), es = worldToScreenPoint(e.x, e.y), cs = worldToScreenPoint(sx, sy);
        const rp = worldToScreenPoint(sx - Math.sin(rot) * (30 / zoom), sy + Math.cos(rot) * (30 / zoom));"""

if old_logic in c:
    c = c.replace(old_logic, new_logic)
    with open("components/tools/SelectionTool.tsx", "w", encoding="utf-8") as f:
        f.write(c)
    print("Fixed isSingleStraightLine drag preview")
else:
    print("Could not find old_logic")
