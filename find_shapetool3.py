with open("components/tools/ShapeTool.tsx", "r", encoding="utf-8") as f:
    c = f.read()

idx = c.find("handleClick =")
print(c[idx:idx+1500].encode("ascii", "ignore").decode("ascii"))
