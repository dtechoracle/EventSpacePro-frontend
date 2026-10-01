with open("components/tools/ShapeTool.tsx", "r", encoding="utf-8") as f:
    c = f.read()

idx = c.find("if (!isActive || isLineMode) return null;")
if idx == -1: idx = c.find("return polygonModal;")
print(c[max(0, idx-200):idx+800].encode("ascii", "ignore").decode("ascii"))
