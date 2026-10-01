# 1. SnapMarkersRenderer.tsx
with open("components/renderers/SnapMarkersRenderer.tsx", "r", encoding="utf-8") as f:
    c = f.read()
c = c.replace("r={6 / zoom}", "r={4 / zoom}")
# 3.5 is fine, we leave it.
with open("components/renderers/SnapMarkersRenderer.tsx", "w", encoding="utf-8") as f:
    f.write(c)
print("Updated SnapMarkersRenderer")

# 2. ShapeTool.tsx
with open("components/tools/ShapeTool.tsx", "r", encoding="utf-8") as f:
    c = f.read()

c = c.replace("r={12 / zoom}", "r={4 / zoom}")
c = c.replace("r={8 / zoom}", "r={5 / zoom}")

# Add arrowHeadSize: 20
old_arrow = """strokeWidth: shapeType === 'arrow' ? 3 : 1,
                ...(shapeType === 'arrow' ? { arrowHeadType: 'filled-triangle' as any, arrowTailType: 'none' as any } : {}),"""

new_arrow = """strokeWidth: shapeType === 'arrow' ? 2 : 1,
                ...(shapeType === 'arrow' ? { arrowHeadType: 'filled-triangle' as any, arrowTailType: 'none' as any, arrowHeadSize: 20 } : {}),"""

c = c.replace(old_arrow, new_arrow)

with open("components/tools/ShapeTool.tsx", "w", encoding="utf-8") as f:
    f.write(c)
print("Updated ShapeTool")

# 3. ArchTool.tsx
with open("components/tools/ArchTool.tsx", "r", encoding="utf-8") as f:
    c = f.read()

# find dotR and replace it
import re
c = re.sub(r'const dotR = .*?;', 'const dotR = 4 / zoom;', c)

with open("components/tools/ArchTool.tsx", "w", encoding="utf-8") as f:
    f.write(c)
print("Updated ArchTool")

