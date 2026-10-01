with open("components/tools/FreehandTool.tsx", "r", encoding="utf-8") as f:
    c = f.read()

c = c.replace("strokeWidth: 3", "strokeWidth: 1")

with open("components/tools/FreehandTool.tsx", "w", encoding="utf-8") as f:
    f.write(c)
print("Fixed Freehand stroke width")
