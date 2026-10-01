with open("components/renderers/ShapeRenderer.tsx", "r", encoding="utf-8") as f:
    c = f.read()

idx = c.find("if (shape.type === 'line') {")
print(c[idx+1000:idx+2500].encode("ascii", "ignore").decode("ascii"))
