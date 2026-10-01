with open("components/tools/ShapeTool.tsx", "r", encoding="utf-8") as f:
    c = f.read()

idx = c.find("if (!isActive")
while idx != -1:
    print("---")
    print(c[max(0, idx-50):idx+500].encode("ascii", "ignore").decode("ascii"))
    idx = c.find("if (!isActive", idx+1)
