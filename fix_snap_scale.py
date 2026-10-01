with open("components/renderers/SnapMarkersRenderer.tsx", "r", encoding="utf-8") as f:
    c = f.read()

c = c.replace('r={2.5 / zoom}', 'r={5}')
c = c.replace('strokeWidth={1 / zoom}', 'strokeWidth={1.5}')
c = c.replace('r={2 / zoom}', 'r={4}')

with open("components/renderers/SnapMarkersRenderer.tsx", "w", encoding="utf-8") as f:
    f.write(c)

with open("components/tools/WallTool.tsx", "r", encoding="utf-8") as f:
    c = f.read()
c = c.replace('const junctionMarkerRadius = 2.5 / zoom;', 'const junctionMarkerRadius = 5;')
c = c.replace('const cursorMarkerStroke = 1 / zoom;', 'const cursorMarkerStroke = 1.5;')
with open("components/tools/WallTool.tsx", "w", encoding="utf-8") as f:
    f.write(c)

with open("components/tools/ShapeTool.tsx", "r", encoding="utf-8") as f:
    c = f.read()
c = c.replace('r={2.5 / zoom}', 'r={5}')
c = c.replace('strokeWidth={1.5 / zoom}', 'strokeWidth={1.5}')
c = c.replace('r={3 / zoom}', 'r={5}')
c = c.replace('strokeWidth={1 / zoom}', 'strokeWidth={1.5}')
c = c.replace('r={1.5 / zoom}', 'r={3}')
with open("components/tools/ShapeTool.tsx", "w", encoding="utf-8") as f:
    f.write(c)

print("Removed / zoom from snap markers")
