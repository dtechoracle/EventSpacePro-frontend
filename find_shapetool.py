with open("components/tools/ShapeTool.tsx", "r", encoding="utf-8") as f:
    c = f.read()

idx = c.find("isLineMode")
print(c[max(0, idx-200):idx+500])
