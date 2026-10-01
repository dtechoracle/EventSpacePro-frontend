with open("components/tools/ShapeTool.tsx", "r", encoding="utf-8") as f:
    c = f.read()

idx = c.find("const finishLine")
print(c[idx:idx+2500].encode("ascii", "ignore").decode("ascii"))
