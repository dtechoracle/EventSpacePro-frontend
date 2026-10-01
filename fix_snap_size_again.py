with open("components/renderers/SnapMarkersRenderer.tsx", "r", encoding="utf-8") as f:
    c = f.read()
c = c.replace('r={5}', 'r={7}')
c = c.replace('r={4}', 'r={5.5}')
with open("components/renderers/SnapMarkersRenderer.tsx", "w", encoding="utf-8") as f:
    f.write(c)

with open("components/tools/WallTool.tsx", "r", encoding="utf-8") as f:
    c = f.read()
c = c.replace('const junctionMarkerRadius = 5;', 'const junctionMarkerRadius = 7;')
with open("components/tools/WallTool.tsx", "w", encoding="utf-8") as f:
    f.write(c)

with open("components/tools/ShapeTool.tsx", "r", encoding="utf-8") as f:
    c = f.read()
c = c.replace('r={5}', 'r={7}')
c = c.replace('r={3}', 'r={4.5}')
with open("components/tools/ShapeTool.tsx", "w", encoding="utf-8") as f:
    f.write(c)

with open("components/renderers/ShapeRenderer.tsx", "r", encoding="utf-8") as f:
    c = f.read()
c = c.replace('r={5}', 'r={6.5}')
with open("components/renderers/ShapeRenderer.tsx", "w", encoding="utf-8") as f:
    f.write(c)

print("Increased vertex size")
