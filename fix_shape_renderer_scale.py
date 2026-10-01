with open("components/renderers/ShapeRenderer.tsx", "r", encoding="utf-8") as f:
    c = f.read()

c = c.replace('r={2.5 / zoom}', 'r={5}')
# Since we removed vectorEffect="non-scaling-stroke", it will scale with the drawing now.
# Wait, vectorEffect="non-scaling-stroke" is STILL THERE in ShapeRenderer!
c = c.replace('vectorEffect="non-scaling-stroke"', '')

with open("components/renderers/ShapeRenderer.tsx", "w", encoding="utf-8") as f:
    f.write(c)

print("Fixed ShapeRenderer vertices scale")
