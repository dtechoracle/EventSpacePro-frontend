with open("components/renderers/ShapeRenderer.tsx", "r", encoding="utf-8") as f:
    c = f.read()

idx = c.find("const transform =")
print(c[max(0, idx-100):idx+500])
