import re

with open('components/tools/SelectionTool.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

pattern = re.compile(r'(\s*)// Proportional corner scaling for assets\s+let scaleFactor = 1;\s+if \(dragHandle === \'se\'.*?else if \(dragHandle === \'w\'\) \{.*?\}', re.DOTALL)
match = pattern.search(content)

if match:
    indent = match.group(1)
    replacement = indent + '''// Proportional corner scaling for assets
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
                }'''
    # Fix the indentation of the replacement
    replacement = replacement.replace('\n                ', '\n' + indent)
    content = content.replace(match.group(0), replacement)
    
    with open('components/tools/SelectionTool.tsx', 'w', encoding='utf-8') as f:
        f.write(content)
    print("Success")
else:
    print("Failed")
