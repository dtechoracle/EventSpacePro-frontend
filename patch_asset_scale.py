import re

with open('components/tools/SelectionTool.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

target = '''                  // Proportional corner scaling for assets
                  let scaleFactor = 1;
                  if (dragHandle === 'se' || dragHandle === 'ne') {
                      scaleFactor = Math.max(0.05, (initialWidth + localDx) / initialWidth);
                  } else if (dragHandle === 'sw' || dragHandle === 'nw') {
                      scaleFactor = Math.max(0.05, (initialWidth - localDx) / initialWidth);
                  } else if (dragHandle === 'n') {
                      scaleFactor = Math.max(0.05, (initialHeight - localDy) / initialHeight);
                  } else if (dragHandle === 's') {
                      scaleFactor = Math.max(0.05, (initialHeight + localDy) / initialHeight);
                  } else if (dragHandle === 'e') {
                      scaleFactor = Math.max(0.05, (initialWidth + localDx) / initialWidth);
                  } else if (dragHandle === 'w') {
                      scaleFactor = Math.max(0.05, (initialWidth - localDx) / initialWidth);
                  }'''

replacement = '''                  // Proportional corner scaling for assets
                  let scaleFactor = 1;
                  
                  if (dragHandle.length === 2) {
                      // Project mouse vector onto the diagonal direction for the specific corner
                      // se: dx > 0, dy > 0 -> scale up
                      // nw: dx < 0, dy < 0 -> scale up
                      // ne: dx > 0, dy < 0 -> scale up
                      // sw: dx < 0, dy > 0 -> scale up
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

if target in content:
    content = content.replace(target, replacement)
    with open('components/tools/SelectionTool.tsx', 'w', encoding='utf-8') as f:
        f.write(content)
    print("Success")
else:
    print("Failed")
