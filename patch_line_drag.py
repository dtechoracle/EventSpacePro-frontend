import re

with open('components/tools/SelectionTool.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

target = '''            if (item.type === 'shape') {
                const initialShape = item.object as Shape;
                const rotation = initialShape.rotation || 0;
                const rotRad = rotation * (Math.PI / 180);'''

replacement = '''            if (item.type === 'shape') {
                const initialShape = item.object as Shape;
                const rotation = initialShape.rotation || 0;
                const rotRad = rotation * (Math.PI / 180);

                const isStraightLine = (initialShape.type === 'line' || initialShape.type === 'arrow') && !initialShape.points;
                if (isStraightLine && (dragHandle === 'w' || dragHandle === 'e')) {
                    const cx = initialShape.x;
                    const cy = initialShape.y;
                    const w2 = initialShape.width / 2;
                    const p1x = cx - w2 * Math.cos(rotRad);
                    const p1y = cy - w2 * Math.sin(rotRad);
                    const p2x = cx + w2 * Math.cos(rotRad);
                    const p2y = cy + w2 * Math.sin(rotRad);

                    let newP1x = p1x, newP1y = p1y;
                    let newP2x = p2x, newP2y = p2y;

                    if (dragHandle === 'w') {
                        newP1x += finalDx;
                        newP1y += finalDy;
                    } else if (dragHandle === 'e') {
                        newP2x += finalDx;
                        newP2y += finalDy;
                    }

                    const newCx = (newP1x + newP2x) / 2;
                    const newCy = (newP1y + newP2y) / 2;
                    const newWidth = Math.hypot(newP2x - newP1x, newP2y - newP1y);
                    let newRot = Math.atan2(newP2y - newP1y, newP2x - newP1x) * (180 / Math.PI);
                    
                    store.updateShape(item.id, { x: newCx, y: newCy, width: Math.max(5, newWidth), rotation: newRot }, true);
                    return;
                }
'''

if target in content:
    content = content.replace(target, replacement)
    with open('components/tools/SelectionTool.tsx', 'w', encoding='utf-8') as f:
        f.write(content)
    print("Success")
else:
    print("Failed")
