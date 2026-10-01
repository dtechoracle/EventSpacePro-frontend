with open("components/tools/ShapeTool.tsx", "r", encoding="utf-8") as f:
    c = f.read()

c = c.replace('r={5 / zoom}', 'r={3 / zoom}')
c = c.replace('strokeWidth={2 / zoom}', 'strokeWidth={1 / zoom}')
c = c.replace('r={2 / zoom}', 'r={1.5 / zoom}')

with open("components/tools/ShapeTool.tsx", "w", encoding="utf-8") as f:
    f.write(c)
print("Reduced snap marker size in ShapeTool")
