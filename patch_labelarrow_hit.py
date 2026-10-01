import re

with open('components/Workspace2D.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

target = '''            } else if (item._renderType === 'labelArrow') {
              const arrow = item;
              const dx = arrow.endPoint.x - arrow.startPoint.x, dy = arrow.endPoint.y - arrow.startPoint.y;
              const lenSq = dx * dx + dy * dy;
              const thickness = (arrow.strokeWidth || 2) + 30;
'''

replacement = '''            } else if (item._renderType === 'labelArrow') {
              const arrow = item;
              const dx = arrow.endPoint.x - arrow.startPoint.x, dy = arrow.endPoint.y - arrow.startPoint.y;
              const lenSq = dx * dx + dy * dy;
              const thickness = Math.max((arrow.strokeWidth || 2) + 30, 20 / zoom);
'''

if target in content:
    content = content.replace(target, replacement)
    
    text_target = '''                  if (Math.abs(rotX) <= rectWidth / 2 + 10 && Math.abs(rotY) <= rectHeight / 2 + 10) isHit = true;'''
    text_replacement = '''                  const pad = Math.max(10, 10 / zoom);
                  if (Math.abs(rotX) <= rectWidth / 2 + pad && Math.abs(rotY) <= rectHeight / 2 + pad) isHit = true;'''
    
    content = content.replace(text_target, text_replacement)

    with open('components/Workspace2D.tsx', 'w', encoding='utf-8') as f:
        f.write(content)
    print("Success")
else:
    print("Failed")
