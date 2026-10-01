with open("components/renderers/ShapeRenderer.tsx", "r", encoding="utf-8") as f:
    c = f.read()

idx = c.find("if (shape.type === 'arrow') {")
print(c[idx:idx+2500].encode("ascii", "ignore").decode("ascii"))
