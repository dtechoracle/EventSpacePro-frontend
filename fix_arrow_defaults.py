with open('components/renderers/LabelArrowRenderer.tsx', 'r', encoding='utf-8') as f:
    c = f.read()

c = c.replace('const headSize = Math.max(14, strokeWidth * 5) * (arrow.arrowHeadSize || 1);', 'const headSize = arrow.arrowHeadSize || 20;')
c = c.replace('const tailSize = Math.max(14, strokeWidth * 5) * (arrow.arrowTailSize || 1);', 'const tailSize = arrow.arrowTailSize || 20;')

with open('components/renderers/LabelArrowRenderer.tsx', 'w', encoding='utf-8') as f:
    f.write(c)

with open('components/tools/LabelArrowTool.tsx', 'r', encoding='utf-8') as f:
    c = f.read()
    
c = c.replace('strokeWidth: 3,', 'strokeWidth: 2,')

with open('components/tools/LabelArrowTool.tsx', 'w', encoding='utf-8') as f:
    f.write(c)

print("Updated arrow defaults")
