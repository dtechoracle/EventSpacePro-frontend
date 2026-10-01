with open("components/tools/WallTool.tsx", "r", encoding="utf-8") as f:
    c = f.read()

c = c.replace('const junctionMarkerRadius = 4.5 / zoom;', 'const junctionMarkerRadius = 2.5 / zoom;')
c = c.replace('const cursorMarkerStroke = 1.25 / zoom;', 'const cursorMarkerStroke = 1 / zoom;')

with open("components/tools/WallTool.tsx", "w", encoding="utf-8") as f:
    f.write(c)
print("Reduced snap marker size in WallTool")
