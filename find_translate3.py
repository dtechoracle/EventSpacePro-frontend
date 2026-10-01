with open("components/renderers/ShapeRenderer.tsx", "r", encoding="utf-8") as f:
    c = f.read()

idx = c.find("<g")
while idx != -1:
    end_tag = c.find(">", idx)
    print(c[idx:end_tag+1])
    idx = c.find("<g", end_tag)
