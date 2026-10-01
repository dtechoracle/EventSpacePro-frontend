with open("components/renderers/ShapeRenderer.tsx", "r", encoding="utf-8") as f:
    c = f.read()

import re
for m in re.finditer(r'const transform =.*', c):
    print(c[m.start():m.end()])
