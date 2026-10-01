with open("components/renderers/ShapeRenderer.tsx", "r", encoding="utf-8") as f:
    c = f.read()

idx = c.find("case 'line':")
if idx == -1: idx = c.find("=== 'line'")
print(c[max(0, idx-500):idx+500].encode("ascii", "ignore").decode("ascii"))
