import re

with open('components/tools/SelectionTool.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

pattern = re.compile(r'(\s*)let halfW = initialShape\.width \/ 2;\s+let halfH = initialShape\.height \/ 2;\s+let centerX = initialShape\.x;\s+let centerY = initialShape\.y;\s+if \(dragHandle\.includes\(\'e\'\)\).*?store\.updateShape\(item\.id, \{ x: centerX, y: centerY, width: halfW \* 2, height: halfH \* 2 \}, true\);', re.DOTALL)
match = pattern.search(content)

if match:
    indent = match.group(1)
    original_logic = match.group(0)
    
    replacement = indent + '''if ((initialShape.type as string) === 'image') {
                    // Proportional scaling for image shapes
                    const initialWidth = initialShape.width;
                    const initialHeight = initialShape.height;
                    let scaleFactor = 1;
                    
                    if (dragHandle.length === 2) {
                        const diagLen = Math.hypot(initialWidth, initialHeight);
                        let proj = 0;
                        if (dragHandle === 'se') proj = (localDx * initialWidth + localDy * initialHeight) / diagLen;
                        if (dragHandle === 'nw') proj = (-localDx * initialWidth + -localDy * initialHeight) / diagLen;
                        if (dragHandle === 'ne') proj = (localDx * initialWidth + -localDy * initialHeight) / diagLen;
                        if (dragHandle === 'sw') proj = (-localDx * initialWidth + localDy * initialHeight) / diagLen;
                        scaleFactor = Math.max(0.05, (diagLen + proj) / diagLen);
                    } else if (dragHandle === 'n') {
                        scaleFactor = Math.max(0.05, (initialHeight - localDy) / initialHeight);
                    } else if (dragHandle === 's') {
                        scaleFactor = Math.max(0.05, (initialHeight + localDy) / initialHeight);
                    } else if (dragHandle === 'e') {
                        scaleFactor = Math.max(0.05, (initialWidth + localDx) / initialWidth);
                    } else if (dragHandle === 'w') {
                        scaleFactor = Math.max(0.05, (initialWidth - localDx) / initialWidth);
                    }

                    const newW = Math.max(5, initialWidth * scaleFactor);
                    const newH = Math.max(5, initialHeight * scaleFactor);

                    const isCorner = dragHandle.length === 2;
                    let offLX = 0, offLY = 0;
                    if (isCorner) {
                        const wDelta = (newW - initialWidth) / 2;
                        const hDelta = (newH - initialHeight) / 2;
                        if (dragHandle.includes('e')) offLX = wDelta;
                        if (dragHandle.includes('w')) offLX = -wDelta;
                        if (dragHandle.includes('s')) offLY = hDelta;
                        if (dragHandle.includes('n')) offLY = -hDelta;
                    } else {
                        if (dragHandle === 'e') offLX = (newW - initialWidth) / 2;
                        if (dragHandle === 'w') offLX = -(newW - initialWidth) / 2;
                        if (dragHandle === 's') offLY = (newH - initialHeight) / 2;
                        if (dragHandle === 'n') offLY = -(newH - initialHeight) / 2;
                    }

                    const nextX = initialShape.x + offLX * cosR - offLY * sinR;
                    const nextY = initialShape.y + offLX * sinR + offLY * cosR;

                    store.updateShape(item.id, { x: nextX, y: nextY, width: newW, height: newH }, true);
                } else {''' + '\n' + original_logic + '\n' + indent + '}'
    
    content = content.replace(original_logic, replacement)
    with open('components/tools/SelectionTool.tsx', 'w', encoding='utf-8') as f:
        f.write(content)
    print("Success")
else:
    print("Failed")
