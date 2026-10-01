with open("components/renderers/ShapeRenderer.tsx", "r", encoding="utf-8") as f:
    c = f.read()

c = c.replace('r={4 / zoom}', 'r={2.5 / zoom}')
c = c.replace('strokeWidth={1.5}', 'strokeWidth={1}')

with open("components/renderers/ShapeRenderer.tsx", "w", encoding="utf-8") as f:
    f.write(c)
print("Reduced vertex size in ShapeRenderer")
