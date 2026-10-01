with open("components/tools/ShapeTool.tsx", "r", encoding="utf-8") as f:
    c = f.read()

c = c.replace('r={4 / zoom}', 'r={2.5 / zoom}')
c = c.replace('strokeWidth={3 / zoom}', 'strokeWidth={1.5 / zoom}')

with open("components/tools/ShapeTool.tsx", "w", encoding="utf-8") as f:
    f.write(c)
print("Reduced more snap marker sizes in ShapeTool")
