with open("components/Workspace2D.tsx", "r", encoding="utf-8") as f:
    c = f.read()

idx = c.find("<pattern")
print(c[max(0, idx-100):idx+500].encode("ascii", "ignore").decode("ascii"))
