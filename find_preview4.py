with open("components/tools/ShapeTool.tsx", "r", encoding="utf-8") as f:
    c = f.read()

idx = c.rfind("return (")
print(c[max(0, idx-500):idx+1500].encode("ascii", "ignore").decode("ascii"))
