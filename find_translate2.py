with open("components/renderers/ShapeRenderer.tsx", "r", encoding="utf-8") as f:
    c = f.read()

import re
for m in re.finditer(r'<g [^>]*transform=.*?translate.*?>', c):
    print(c[max(0, m.start()-200):m.end()+200].encode("ascii", "ignore").decode("ascii"))
