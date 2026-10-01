with open("components/renderers/ShapeRenderer.tsx", "r", encoding="utf-8") as f:
    c = f.read()

idx = c.find("if (shape.type === 'arrow') {")
print(c[idx+4500:idx+6500].encode("ascii", "ignore").decode("ascii"))
