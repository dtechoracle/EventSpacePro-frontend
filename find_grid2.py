with open("components/renderers/CanvasGridLayer.tsx", "r", encoding="utf-8") as f:
    c = f.read()

idx = c.find("useEffect")
print(c[idx:idx+1500].encode("ascii", "ignore").decode("ascii"))
